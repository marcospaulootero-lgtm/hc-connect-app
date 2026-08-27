import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

type TransportadoraRastreio = 'DHL' | 'FEDEX'

type IdentificacaoRastreio = {
  transportadora: TransportadoraRastreio | ''
  awb: string
  aviso: string
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : ''

    if (!token) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    // O botão administrativo usa o access token do usuário.
    // O rastreio automático usa o CRON_SECRET. Ambos entram no MESMO motor abaixo.
    const cronSecret = process.env.CRON_SECRET
    const chamadaAutomatica = Boolean(cronSecret && token === cronSecret)

    if (!chamadaAutomatica) {
      const {
        data: { user },
        error: erroAuth,
      } = await supabaseAuth.auth.getUser(token)

      if (erroAuth || !user?.id) {
        return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
      }

      const { data: perfil, error: erroPerfil } = await supabase
        .from('perfis')
        .select('tipo_acesso, ativo')
        .eq('id', user.id)
        .maybeSingle()

      if (
        erroPerfil ||
        !perfil ||
        perfil.ativo === false ||
        String(perfil.tipo_acesso || '').toLowerCase() !== 'admin'
      ) {
        return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
      }
    }

    const body = await req.json()
    const embarqueId = body.embarque_id

    if (!embarqueId) {
      return NextResponse.json({ error: 'Informe o ID do embarque.' }, { status: 400 })
    }

    const { data: embarque, error: erroEmbarque } = await supabase
      .from('embarques')
      .select('*')
      .eq('id', embarqueId)
      .single()

    if (erroEmbarque || !embarque) {
      return NextResponse.json({ error: 'Embarque não encontrado.' }, { status: 404 })
    }

    const identificacao = identificarTransportadoraRastreio(
      embarque.transportadora,
      embarque.awb
    )

    if (!identificacao.awb) {
      return NextResponse.json({ error: 'Este embarque não possui AWB válido.' }, { status: 400 })
    }

    if (identificacao.transportadora === 'DHL') {
      return await rastrearDHL(embarque, identificacao.awb, identificacao.aviso)
    }

    if (identificacao.transportadora === 'FEDEX') {
      return await rastrearFedEx(embarque, identificacao.awb, identificacao.aviso)
    }

    return NextResponse.json(
      {
        error: 'Transportadora não suportada para rastreio automático.',
        detalhes:
          'Cadastre a transportadora como DHL ou FedEx. Se deixar vazio, o sistema tenta identificar por 10 dígitos para DHL ou 12 dígitos para FedEx.',
      },
      { status: 400 }
    )
  } catch (error: any) {
    console.log('ERRO GERAL RASTREIO:', error)

    return NextResponse.json(
      {
        error: 'Erro interno ao atualizar rastreio.',
        detalhes: error?.message || String(error),
      },
      { status: 500 }
    )
  }
}

async function rastrearDHL(embarque: any, awb: string, avisoValidacao = '') {
  const dhlApiKey = process.env.DHL_API_KEY

  if (!dhlApiKey) {
    return NextResponse.json({ error: 'DHL_API_KEY não configurada na Vercel.' }, { status: 400 })
  }

  const url = `https://api-eu.dhl.com/track/shipments?trackingNumber=${encodeURIComponent(awb)}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'DHL-API-Key': dhlApiKey,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  const data = await response.json()

  if (!response.ok) {
    return NextResponse.json(
      {
        error: 'Não foi possível consultar o rastreio DHL.',
        detalhes: JSON.stringify(data),
      },
      { status: response.status }
    )
  }

  const shipment = data?.shipments?.[0]

  if (!shipment) {
    return NextResponse.json(
      { error: 'Nenhuma remessa DHL encontrada para este AWB.', detalhes: JSON.stringify(data) },
      { status: 404 }
    )
  }

  const eventos = Array.isArray(shipment?.events) ? shipment.events : []
  const eventoAtual = eventoMaisRecenteDHL(eventos)
  const dataColeta = encontrarDataColetaDHL(eventos)

  const descricaoOriginal =
    shipment?.status?.description ||
    eventoAtual?.description ||
    shipment?.status?.status ||
    shipment?.status?.statusCode ||
    'Sem descrição'

  const descricao = traduzirDescricao(descricaoOriginal, 'DHL')

  const local =
    shipment?.status?.location?.address?.addressLocality ||
    eventoAtual?.location?.address?.addressLocality ||
    null

  const dataEvento =
    shipment?.status?.timestamp ||
    eventoAtual?.timestamp ||
    new Date().toISOString()

  // O status operacional deve refletir o estado ATUAL da transportadora.
  // O histórico completo continua sendo usado apenas para localizar a coleta física.
  const textosStatus = [
    shipment?.status?.description,
    shipment?.status?.status,
    shipment?.status?.statusCode,
    eventoAtual?.description,
    eventoAtual?.typeCode,
  ]

  const statusNormalizado = await salvarRastreio({
    embarque,
    awb,
    transportadora: 'DHL',
    status: textosStatus.filter(Boolean).join(' | ') || descricao,
    descricao,
    local,
    dataEvento,
    dataColeta,
    avisoValidacao,
  })

  return NextResponse.json({
    sucesso: true,
    transportadora: 'DHL',
    awb,
    status: statusNormalizado,
    descricao,
    local,
    data_evento: dataEvento,
    data_coleta: dataColeta,
    aviso: avisoValidacao || null,
  })
}

async function rastrearFedEx(embarque: any, awb: string, avisoValidacao = '') {
  const clientId = process.env.FEDEX_CLIENT_ID
  const clientSecret = process.env.FEDEX_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error:
          'FedEx não configurada. Cadastre FEDEX_CLIENT_ID e FEDEX_CLIENT_SECRET na Vercel.',
      },
      { status: 400 }
    )
  }

  const tokenResponse = await fetch('https://apis.fedex.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: 'no-store',
  })

  const tokenData = await tokenResponse.json()

  if (!tokenResponse.ok) {
    return NextResponse.json(
      {
        error: 'Erro ao autenticar na FedEx.',
        detalhes: JSON.stringify(tokenData),
      },
      { status: tokenResponse.status }
    )
  }

  const accessToken = tokenData.access_token

  const trackResponse = await fetch('https://apis.fedex.com/track/v1/trackingnumbers', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      includeDetailedScans: true,
      trackingInfo: [
        {
          trackingNumberInfo: {
            trackingNumber: awb,
          },
        },
      ],
    }),
    cache: 'no-store',
  })

  const data = await trackResponse.json()

  if (!trackResponse.ok) {
    return NextResponse.json(
      {
        error: 'Não foi possível consultar o rastreio FedEx.',
        detalhes: JSON.stringify(data),
      },
      { status: trackResponse.status }
    )
  }

  const resultado = data?.output?.completeTrackResults?.[0]?.trackResults?.[0]

  if (!resultado) {
    return NextResponse.json(
      {
        error: 'Nenhuma remessa FedEx encontrada para este AWB.',
        detalhes: JSON.stringify(data),
      },
      { status: 404 }
    )
  }

  const eventos = Array.isArray(resultado?.scanEvents) ? resultado.scanEvents : []
  const ultimoEvento = eventoMaisRecenteFedEx(eventos)
  const dataColeta = encontrarDataColetaFedEx(eventos)

  const descricaoOriginal =
    ultimoEvento?.eventDescription ||
    resultado?.latestStatusDetail?.description ||
    'Sem descrição'

  const descricao = traduzirDescricao(descricaoOriginal, 'FEDEX')

  const local =
    ultimoEvento?.scanLocation?.city ||
    resultado?.latestStatusDetail?.scanLocation?.city ||
    null

  const dataEvento =
    ultimoEvento?.date ||
    resultado?.dateAndTimes?.[0]?.dateTime ||
    new Date().toISOString()

  // Não misturar eventos antigos na decisão do status atual.
  // O histórico continua disponível para detectar a coleta física.
  const textosStatus = [
    resultado?.latestStatusDetail?.description,
    resultado?.latestStatusDetail?.code,
    resultado?.latestStatusDetail?.ancillaryDetails?.[0]?.reason,
    resultado?.latestStatusDetail?.ancillaryDetails?.[0]?.reasonDescription,
    resultado?.derivedStatus,
    resultado?.statusByLocale,
    ultimoEvento?.eventDescription,
    ultimoEvento?.eventType,
    ultimoEvento?.derivedStatus,
  ]

  const statusNormalizado = await salvarRastreio({
    embarque,
    awb,
    transportadora: 'FEDEX',
    status: textosStatus.filter(Boolean).join(' | ') || descricao,
    descricao,
    local,
    dataEvento,
    dataColeta,
    avisoValidacao,
  })

  return NextResponse.json({
    sucesso: true,
    transportadora: 'FEDEX',
    awb,
    status: statusNormalizado,
    descricao,
    local,
    data_evento: dataEvento,
    data_coleta: dataColeta,
    aviso: avisoValidacao || null,
  })
}

function normalizarAwb(valor: any) {
  return String(valor || '').replace(/\D/g, '')
}

function eventoMaisRecenteDHL(eventos: any[]) {
  return [...(eventos || [])]
    .filter((evento) => evento?.timestamp)
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() -
        new Date(a.timestamp).getTime()
    )[0] || eventos?.[0]
}

function eventoMaisRecenteFedEx(eventos: any[]) {
  return [...(eventos || [])]
    .filter((evento) => evento?.date)
    .sort(
      (a, b) =>
        new Date(b.date).getTime() -
        new Date(a.date).getTime()
    )[0] || eventos?.[0]
}

function identificarTransportadoraRastreio(transportadora: any, awb: any): IdentificacaoRastreio {
  const awbOriginal = String(awb || '').trim()
  const textoAwbOriginal = removerAcentos(awbOriginal).toUpperCase()

  if (textoAwbOriginal.startsWith('AGUARDANDO AWB')) {
    return {
      transportadora: '',
      awb: '',
      aviso: 'AWB ainda não informado.',
    }
  }

  const textoTransportadora = removerAcentos(String(transportadora || '')).toUpperCase()
  const awbLimpo = normalizarAwb(awbOriginal)

  if (textoTransportadora.includes('DHL')) {
    return {
      transportadora: 'DHL',
      awb: awbLimpo,
      aviso:
        awbLimpo.length !== 10
          ? 'AWB DHL normalmente possui 10 dígitos. Confira o número informado.'
          : '',
    }
  }

  if (textoTransportadora.includes('FEDEX') || textoTransportadora.includes('FED EX')) {
    return {
      transportadora: 'FEDEX',
      awb: awbLimpo,
      aviso:
        awbLimpo.length !== 12
          ? 'AWB FedEx normalmente possui 12 dígitos no padrão usado pela HC. Confira o número informado.'
          : '',
    }
  }

  if (awbLimpo.length === 10) {
    return {
      transportadora: 'DHL',
      awb: awbLimpo,
      aviso: 'Transportadora identificada automaticamente pelo AWB de 10 dígitos.',
    }
  }

  if (awbLimpo.length === 12) {
    return {
      transportadora: 'FEDEX',
      awb: awbLimpo,
      aviso: 'Transportadora identificada automaticamente pelo AWB de 12 dígitos.',
    }
  }

  return {
    transportadora: '',
    awb: awbLimpo,
    aviso: 'Não foi possível identificar a transportadora pelo AWB.',
  }
}

function encontrarDataColetaDHL(eventos: any[]) {
  const eventoColeta = eventos.find((evento) => {
    const texto = removerAcentos(
      `${evento?.description || ''} ${evento?.status || ''} ${evento?.statusCode || ''} ${evento?.typeCode || ''}`
    )

    return ehColetado(texto)
  })

  if (eventoColeta?.timestamp) return eventoColeta.timestamp

  // Algumas respostas DHL não retornam um evento explícito de pickup, mesmo quando
  // já existem eventos que comprovam posse/movimentação física do volume.
  // Nesses casos, usa o primeiro evento físico conhecido como referência operacional.
  const eventosFisicos = eventos
    .filter((evento) => {
      const texto = removerAcentos(
        `${evento?.description || ''} ${evento?.status || ''} ${evento?.statusCode || ''} ${evento?.typeCode || ''}`
      )
      return ehMovimentoFisicoConfirmado(texto) && evento?.timestamp
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  return eventosFisicos[0]?.timestamp || null
}

function encontrarDataColetaFedEx(eventos: any[]) {
  const eventoColeta = eventos.find((evento) => {
    const texto = removerAcentos(
      `${evento?.eventDescription || ''} ${evento?.eventType || ''} ${evento?.derivedStatus || ''}`
    )

    return ehColetado(texto)
  })

  if (eventoColeta?.date) return eventoColeta.date

  // A FedEx também pode não devolver o pickup explícito em alguns históricos.
  // Se houver movimentação física inequívoca, usa o primeiro scan físico conhecido.
  const eventosFisicos = eventos
    .filter((evento) => {
      const texto = removerAcentos(
        `${evento?.eventDescription || ''} ${evento?.eventType || ''} ${evento?.derivedStatus || ''}`
      )
      return ehMovimentoFisicoConfirmado(texto) && evento?.date
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return eventosFisicos[0]?.date || null
}

function removerAcentos(texto: string) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function traduzirDescricao(descricao: string, transportadora?: TransportadoraRastreio) {
  const original = String(descricao || '').trim()
  const d = removerAcentos(original)

  if (!original) return 'Sem descrição'

  if (ehEntregue(d)) return 'Envio entregue'

  if (ehSaiuParaEntrega(d)) {
    return 'A remessa saiu para entrega'
  }

  if (ehBrokerOuLiberado(d)) {
    return 'A remessa será liberada e entregue pelo despachante aduaneiro'
  }

  if (ehFiscalizacao(d)) {
    return 'Envio em processo de liberação'
  }

  if (ehColetado(d)) {
    return 'Envio recolhido'
  }

  if (ehTransito(d)) {
    if (transportadora === 'FEDEX') return original
    if (d.includes('processed') || d.includes('processado')) return 'Processado na unidade DHL'
    if (d.includes('arrived') || d.includes('chegou')) return 'Chegou nas instalações da DHL'
    if (d.includes('departed') || d.includes('partiu')) return 'A remessa partiu de uma instalação da DHL'
    return original
  }

  if (ehEtiquetaGerada(d)) {
    return 'Etiqueta criada. Aguardando coleta pela transportadora'
  }

  return original
}

function normalizarStatus(status: string) {
  const s = removerAcentos(status)

  if (ehEntregue(s)) return 'Entregue'
  if (ehSaiuParaEntrega(s) || ehBrokerOuLiberado(s)) return 'Liberado'
  if (ehFiscalizacao(s)) return 'Fiscalização'
  if (ehTransito(s)) return 'Em trânsito'
  if (ehColetado(s)) return 'Coletado'
  if (ehEtiquetaGerada(s)) return 'Aguardando coleta'

  return 'Aguardando coleta'
}

function ehEntregue(s: string) {
  const texto = removerAcentos(s)

  const naoEntregue =
    texto.includes('nao foi entregue') ||
    texto.includes('not delivered') ||
    texto.includes('not yet delivered') ||
    texto.includes('not yet handed over') ||
    texto.includes('ainda nao foi entregue')

  if (naoEntregue) return false

  const codigoFedExEntregue = /(^|[\s|,;:/-])dl([\s|,;:/-]|$)/.test(texto)

  return (
    texto === 'entregue' ||
    texto === 'envio entregue' ||
    texto === 'delivered' ||
    codigoFedExEntregue ||
    texto.includes('shipment delivered') ||
    texto.includes('proof of delivery') ||
    texto.includes('delivered to consignee') ||
    texto.includes('delivered to recipient') ||
    texto.includes('signed for') ||
    texto.includes('delivery completed') ||
    texto.includes('entrega realizada') ||
    texto.includes('entrega concluida') ||
    texto.includes('entregue ao destinatario') ||
    texto.includes('comprovante de entrega')
  )
}

function ehSaiuParaEntrega(s: string) {
  return (
    s.includes('out for delivery') ||
    s.includes('with delivery courier') ||
    s.includes('with courier') ||
    s.includes('saiu com o mensageiro para entrega') ||
    s.includes('mensageiro para entrega') ||
    s.includes('saiu para entrega')
  )
}

function ehBrokerOuLiberado(s: string) {
  return (
    s.includes('shipment will be cleared and delivered by broker') ||
    s.includes('cleared and delivered by broker') ||
    s.includes('customs broker') ||
    s.includes('broker') ||
    s.includes('despachante aduaneiro') ||
    s.includes('despachante') ||
    s.includes('aduaneiro') ||
    s.includes('available for delivery') ||
    s.includes('released') ||
    s.includes('liberado') ||
    s.includes('liberada') ||
    s.includes('clearance complete') ||
    s.includes('clearance processing complete') ||
    s.includes('liberacao concluida') ||
    s.includes('liberacao aduaneira concluida')
  )
}

function ehFiscalizacao(s: string) {
  return (
    s.includes('clearance event') ||
    s.includes('customs status updated') ||
    s.includes('clearance') ||
    s.includes('customs') ||
    s.includes('fiscal') ||
    s.includes('desembaraco') ||
    s.includes('processo de liberacao') ||
    s.includes('em processo de liberacao') ||
    s.includes('envio em proceso de liberacao') ||
    s.includes('envio em processo de liberacao')
  )
}

function ehTransito(s: string) {
  return (
    s.includes('on the way') ||
    s.includes('we have your package') ||
    s.includes('estamos com seu pacote') ||
    s.includes('delivery updated') ||
    s.includes('shipment information sent to fedex') === false && s.includes('transit') ||
    s.includes('transito') ||
    s.includes('in transit') ||
    s.includes('processed') ||
    s.includes('processado') ||
    s.includes('depart') ||
    s.includes('partiu') ||
    s.includes('arrived') ||
    s.includes('arrival') ||
    s.includes('chegou') ||
    s.includes('movement') ||
    s.includes('facility') ||
    s.includes('sort facility') ||
    s.includes('hub') ||
    s.includes('origin facility') ||
    s.includes('destination facility') ||
    s.includes('left fedex') ||
    s.includes('at fedex') ||
    s.includes('fedex hub') ||
    s.includes('instalacoes da dhl') ||
    s.includes('instalacao da dhl') ||
    s.includes('instalacao do dhl')
  )
}

function ehColetado(s: string) {
  const texto = removerAcentos(s)

  const pickupReal =
    texto.includes('picked up') ||
    texto.includes('shipment picked up') ||
    texto.includes('collected') ||
    texto.includes('coletado') ||
    texto.includes('coleta realizada') ||
    texto.includes('envio recolhido') ||
    texto.includes('remessa recolhida') ||
    texto === 'pu' ||
    texto.includes(' pu ')

  const pickupAgendadoOuPendente =
    texto.includes('pickup scheduled') ||
    texto.includes('pickup requested') ||
    texto.includes('pickup pending') ||
    texto.includes('scheduled pickup') ||
    texto.includes('coleta agendada') ||
    texto.includes('aguardando coleta')

  return pickupReal && !pickupAgendadoOuPendente
}

function ehEtiquetaGerada(s: string) {
  return (
    s.includes('shipment information received') ||
    s.includes('shipping information received') ||
    s.includes('shipment information sent to fedex') ||
    s.includes('label created') ||
    s.includes('label generated') ||
    s.includes('etiqueta') ||
    s.includes('gerou a etiqueta') ||
    s.includes('remessa ainda nao foi entregue') ||
    s.includes('nao foi entregue fisicamente') ||
    s.includes('not yet handed over') ||
    s.includes('not yet been handed over') ||
    s.includes('not yet received') ||
    s.includes('has not been handed over') ||
    s.includes('aguardando coleta') ||
    s.includes('pre-shipment')
  )
}

function ehMovimentoFisicoConfirmado(s: string) {
  const texto = removerAcentos(s)

  if (ehColetado(texto)) return true

  return (
    texto.includes('departed') ||
    texto.includes('partiu') ||
    texto.includes('processed') ||
    texto.includes('processado') ||
    texto.includes('arrived at') ||
    texto.includes('arrival at') ||
    texto.includes('chegou') ||
    texto.includes('in transit') ||
    texto.includes('em transito') ||
    texto.includes('on the way') ||
    texto.includes('a caminho do destino') ||
    texto.includes('at fedex location') ||
    texto.includes('at local fedex facility') ||
    texto.includes('fedex facility') ||
    texto.includes('fedex hub') ||
    texto.includes('origin facility') ||
    texto.includes('destination facility') ||
    texto.includes('instalacoes da dhl') ||
    texto.includes('instalacao da dhl') ||
    texto.includes('instalacao do dhl')
  )
}

async function salvarRastreio({
  embarque,
  awb,
  transportadora,
  status,
  descricao,
  local,
  dataEvento,
  dataColeta,
  avisoValidacao,
}: any) {
  let statusDetectado = normalizarStatus(status)
  const statusAtualAntes = normalizarStatus(embarque.status_operacional || '')

  // Regra operacional HC:
  // etiqueta/pré-envio sem evidência física = Aguardando coleta.
  // Porém, eventos atuais como "departed", "processed", "arrived" ou scans em
  // instalações DHL/FedEx comprovam que a transportadora já recebeu/movimentou o volume,
  // mesmo quando a API não devolve um evento explícito de pickup.
  const movimentoFisicoConfirmado = Boolean(dataColeta) || ehMovimentoFisicoConfirmado(status)

  if (!movimentoFisicoConfirmado && ['Coletado', 'Em trânsito'].includes(statusDetectado)) {
    statusDetectado = 'Aguardando coleta'
  }

  // O status operacional acompanha o estado ATUAL informado pela transportadora.
  // Fiscalização/Liberado podem naturalmente voltar para Em trânsito após o desembaraço.
  // Apenas Entregue é terminal e nunca regride.
  let statusNormalizado = statusAtualAntes === 'Entregue' ? 'Entregue' : statusDetectado

  if (
    statusDetectado === 'Aguardando coleta' &&
    !movimentoFisicoConfirmado &&
    statusAtualAntes !== 'Entregue'
  ) {
    statusNormalizado = 'Aguardando coleta'
  }

  const mudouStatus = statusNormalizado !== statusAtualAntes

  const dadosAtualizar: any = {
    status_operacional: statusNormalizado,
    ultima_atualizacao: new Date().toISOString(),
    proxima_tentativa_rastreio: null,
  }

  // Se ainda não houve coleta, remove data de envio gravada por classificação incorreta anterior.
  if (statusNormalizado === 'Aguardando coleta' && !dataColeta && statusAtualAntes !== 'Entregue') {
    dadosAtualizar.data_envio = null
  }

  if (statusNormalizado === 'Entregue') {
    dadosAtualizar.data_entrega = new Date(dataEvento || new Date()).toISOString().split('T')[0]
  }

  // Data de envio = data da coleta física. Nunca usar data de etiqueta/status como substituta.
  if (dataColeta) {
    dadosAtualizar.data_envio = new Date(dataColeta).toISOString().split('T')[0]
  }

  const { error: erroUpdate } = await supabase
    .from('embarques')
    .update(dadosAtualizar)
    .eq('id', embarque.id)

  if (erroUpdate) {
    throw new Error(`Erro ao atualizar embarque: ${erroUpdate.message}`)
  }

  const { data: rastreioExistente } = await supabase
    .from('rastreios_embarques')
    .select('id')
    .eq('embarque_id', embarque.id)
    .eq('awb', awb)
    .eq('status', statusNormalizado)
    .eq('descricao', descricao)
    .eq('data_evento', dataEvento)
    .maybeSingle()

  if (!rastreioExistente) {
    const { error: erroInsert } = await supabase.from('rastreios_embarques').insert({
      embarque_id: embarque.id,
      awb,
      transportadora,
      status: statusNormalizado,
      descricao,
      localizacao: local,
      data_evento: dataEvento,
    })

    if (erroInsert) {
      throw new Error(`Erro ao salvar rastreio: ${erroInsert.message}`)
    }
  }

  if (mudouStatus || !rastreioExistente) {
    await supabase.from('timeline_embarques').insert({
      embarque_id: embarque.id,
      status: statusNormalizado,
      descricao: avisoValidacao
        ? `Rastreio atualizado: ${descricao}. Aviso: ${avisoValidacao}`
        : `Rastreio atualizado: ${descricao}`,
    })
  }

  return statusNormalizado
}
