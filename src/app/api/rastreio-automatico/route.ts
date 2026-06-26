import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

type TransportadoraRastreio = 'DHL' | 'FEDEX'

type IdentificacaoRastreio = {
  transportadora: TransportadoraRastreio | ''
  awb: string
  aviso: string
}

const STATUS_PRIORIDADE: Record<string, number> = {
  'Aguardando coleta': 0,
  'Etiqueta gerada': 0,
  Coletado: 1,
  'Em trânsito': 2,
  Fiscalização: 3,
  Liberado: 4,
  Entregue: 5,
}

export async function GET(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET
    const authHeader = req.headers.get('authorization')

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const { data: embarques, error } = await supabase
      .from('embarques')
      .select('*')
      .not('awb', 'is', null)
      .not('awb', 'eq', 'AGUARDANDO AWB')
      .not('status_operacional', 'eq', 'Entregue')
      .not('status_operacional', 'eq', 'Finalizado')
      .not('status_operacional', 'eq', 'Cancelado')
      .order('ultima_atualizacao', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao buscar embarques.', detalhes: error.message },
        { status: 500 }
      )
    }

    const resultados: any[] = []

    for (const embarque of embarques || []) {
      if (
        embarque.proxima_tentativa_rastreio &&
        new Date(embarque.proxima_tentativa_rastreio) > new Date()
      ) {
        resultados.push({
          id: embarque.id,
          awb: embarque.awb,
          transportadora: embarque.transportadora,
          sucesso: false,
          erro: `AWB temporariamente bloqueado até ${embarque.proxima_tentativa_rastreio}`,
        })

        continue
      }

      try {
        const identificacao = identificarTransportadoraRastreio(
          embarque.transportadora,
          embarque.awb
        )

        if (!identificacao.awb || identificacao.awb === 'AGUARDANDO AWB') {
          resultados.push({
            id: embarque.id,
            awb: embarque.awb || '-',
            transportadora: embarque.transportadora || '-',
            sucesso: false,
            erro: 'AWB inválido.',
          })
          continue
        }

        if (identificacao.transportadora === 'DHL') {
          const resultado = await rastrearDHL(embarque, identificacao.awb, identificacao.aviso)
          resultados.push(resultado)
          continue
        }

        if (identificacao.transportadora === 'FEDEX') {
          const resultado = await rastrearFedEx(embarque, identificacao.awb, identificacao.aviso)
          resultados.push(resultado)
          continue
        }

        resultados.push({
          id: embarque.id,
          awb: identificacao.awb || embarque.awb || '-',
          transportadora: embarque.transportadora || '-',
          sucesso: false,
          erro:
            'Transportadora não suportada. Cadastre DHL ou FedEx, ou informe AWB de 10 dígitos para DHL / 12 dígitos para FedEx.',
        })
      } catch (erro: any) {
        const mensagemErro = erro?.message || String(erro)

        if (mensagemErro.includes('429') || mensagemErro.includes('Too Many Requests')) {
          const proximaTentativa = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()

          await supabase
            .from('embarques')
            .update({
              proxima_tentativa_rastreio: proximaTentativa,
            })
            .eq('id', embarque.id)
        }

        resultados.push({
          id: embarque.id,
          awb: embarque.awb || '-',
          transportadora: embarque.transportadora || '-',
          sucesso: false,
          erro: limparMensagemErro(mensagemErro),
        })
      }
    }

    const totalSucesso = resultados.filter((r) => r.sucesso === true).length
    const totalErro = resultados.filter((r) => r.sucesso === false).length

    const errosDetalhados = resultados
      .filter((r) => r.sucesso === false)
      .map((r) => ({
        id: r.id || null,
        awb: r.awb || '-',
        transportadora: r.transportadora || '-',
        erro: limparMensagemErro(r.erro || 'Erro não informado.'),
      }))

    const { error: erroLog } = await supabase.from('logs_rastreio').insert({
      total_processado: resultados.length,
      total_sucesso: totalSucesso,
      total_erro: totalErro,
      detalhes: errosDetalhados,
    })

    if (erroLog) {
      return NextResponse.json(
        {
          error: 'Rastreio executado, mas houve erro ao salvar log.',
          detalhes: erroLog.message,
          total_processado: resultados.length,
          total_sucesso: totalSucesso,
          total_erro: totalErro,
          erros: errosDetalhados,
          resultados,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      sucesso: true,
      total_processado: resultados.length,
      total_sucesso: totalSucesso,
      total_erro: totalErro,
      erros: errosDetalhados,
      resultados,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Erro interno no rastreio automático.',
        detalhes: error?.message || String(error),
      },
      { status: 500 }
    )
  }
}

async function rastrearDHL(embarque: any, awb: string, avisoValidacao = '') {
  const dhlApiKey = process.env.DHL_API_KEY

  if (!dhlApiKey) {
    throw new Error('DHL_API_KEY não configurada.')
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
    throw new Error(`Erro DHL: ${extrairErroApi(data)}`)
  }

  const shipment = data?.shipments?.[0]

  if (!shipment) {
    throw new Error('Nenhuma remessa DHL encontrada.')
  }

  const eventos = Array.isArray(shipment?.events) ? shipment.events : []
  const eventoAtual = eventos[0]
  const dataColeta = encontrarDataColetaDHL(eventos)

  const descricaoOriginal =
    shipment?.status?.description ||
    eventoAtual?.description ||
    shipment?.status?.status ||
    shipment?.status?.statusCode ||
    'Sem descrição'

  const descricao = traduzirDescricao(descricaoOriginal, 'DHL')

  const textosStatus = [
    shipment?.status?.description,
    shipment?.status?.status,
    shipment?.status?.statusCode,
    eventoAtual?.description,
    eventoAtual?.typeCode,
    ...eventos.flatMap((evento: any) => [
      evento?.description,
      evento?.status,
      evento?.statusCode,
      evento?.typeCode,
    ]),
  ]

  const local =
    shipment?.status?.location?.address?.addressLocality ||
    eventoAtual?.location?.address?.addressLocality ||
    null

  const dataEvento =
    shipment?.status?.timestamp ||
    eventoAtual?.timestamp ||
    new Date().toISOString()

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

  return {
    id: embarque.id,
    awb,
    transportadora: 'DHL',
    sucesso: true,
    status: statusNormalizado,
    descricao,
    aviso: avisoValidacao || null,
  }
}

async function rastrearFedEx(embarque: any, awb: string, avisoValidacao = '') {
  const clientId = process.env.FEDEX_CLIENT_ID
  const clientSecret = process.env.FEDEX_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('FedEx não configurada.')
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
    throw new Error(`Erro ao autenticar FedEx: ${extrairErroApi(tokenData)}`)
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
    throw new Error(`Erro FedEx: ${extrairErroApi(data)}`)
  }

  const resultado = data?.output?.completeTrackResults?.[0]?.trackResults?.[0]

  if (!resultado) {
    throw new Error('Nenhuma remessa FedEx encontrada.')
  }

  const eventos = Array.isArray(resultado?.scanEvents) ? resultado.scanEvents : []
  const ultimoEvento = eventos[0]
  const dataColeta = encontrarDataColetaFedEx(eventos)

  const descricaoOriginal =
    ultimoEvento?.eventDescription ||
    resultado?.latestStatusDetail?.description ||
    'Sem descrição'

  const descricao = traduzirDescricao(descricaoOriginal, 'FEDEX')

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
    ...eventos.flatMap((evento: any) => [
      evento?.eventDescription,
      evento?.eventType,
      evento?.derivedStatus,
      evento?.exceptionDescription,
    ]),
  ]

  const local =
    ultimoEvento?.scanLocation?.city ||
    resultado?.latestStatusDetail?.scanLocation?.city ||
    null

  const dataEvento =
    ultimoEvento?.date ||
    resultado?.dateAndTimes?.[0]?.dateTime ||
    new Date().toISOString()

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

  return {
    id: embarque.id,
    awb,
    transportadora: 'FEDEX',
    sucesso: true,
    status: statusNormalizado,
    descricao,
    aviso: avisoValidacao || null,
  }
}

function normalizarAwb(valor: any) {
  return String(valor || '').replace(/\D/g, '')
}

function identificarTransportadoraRastreio(transportadora: any, awb: any): IdentificacaoRastreio {
  const textoTransportadora = removerAcentos(String(transportadora || '')).toUpperCase()
  const awbLimpo = normalizarAwb(awb)

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

    return (
      texto.includes('picked up') ||
      texto.includes('shipment picked up') ||
      texto.includes('collected') ||
      texto.includes('coletado') ||
      texto.includes('coleta realizada') ||
      texto.includes('envio recolhido') ||
      texto === 'pu' ||
      texto.includes(' pu ')
    )
  })

  return eventoColeta?.timestamp || null
}

function encontrarDataColetaFedEx(eventos: any[]) {
  const eventoColeta = eventos.find((evento) => {
    const texto = removerAcentos(
      `${evento?.eventDescription || ''} ${evento?.eventType || ''} ${evento?.derivedStatus || ''}`
    )

    const pickupReal =
      texto.includes('picked up') ||
      texto.includes('shipment picked up') ||
      texto.includes('collected') ||
      texto.includes('coletado') ||
      texto.includes('coleta realizada') ||
      texto.includes('envio recolhido') ||
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
  })

  return eventoColeta?.date || null
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
  if (ehSaiuParaEntrega(d)) return 'A remessa saiu para entrega'
  if (ehBrokerOuLiberado(d)) return 'A remessa será liberada e entregue pelo despachante aduaneiro'
  if (ehFiscalizacao(d)) return 'Envio em processo de liberação'
  if (ehColetado(d)) return 'Envio recolhido'

  if (ehTransito(d)) {
    if (transportadora === 'FEDEX') return original
    if (d.includes('processed') || d.includes('processado')) return 'Processado na unidade DHL'
    if (d.includes('arrived') || d.includes('chegou')) return 'Chegou nas instalações da DHL'
    if (d.includes('departed') || d.includes('partiu')) return 'A remessa partiu de uma instalação da DHL'
    return original
  }

  if (ehEtiquetaGerada(d)) return 'Etiqueta criada. Aguardando coleta pela transportadora'

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
  return (
    s === 'envio entregue' ||
    s === 'delivered' ||
    s.includes('shipment delivered') ||
    s.includes('proof of delivery') ||
    s.includes('delivered to consignee') ||
    s.includes('delivered to recipient') ||
    s.includes('signed for') ||
    s.includes('delivery completed') ||
    s.includes('entrega realizada') ||
    s.includes('entrega concluida') ||
    s.includes('entregue ao destinatario') ||
    s.includes('comprovante de entrega')
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
    (s.includes('transit') && !s.includes('shipment information sent to fedex')) ||
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

function statusMaisForte(statusAtual: any, statusNovo: string) {
  const atual = normalizarStatus(String(statusAtual || ''))
  const prioridadeAtual = STATUS_PRIORIDADE[atual] ?? 0
  const prioridadeNova = STATUS_PRIORIDADE[statusNovo] ?? 0

  return prioridadeNova >= prioridadeAtual ? statusNovo : atual
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
  const statusDetectado = normalizarStatus(status)
  const statusAtualAntes = normalizarStatus(embarque.status_operacional || '')
  let statusNormalizado = statusMaisForte(embarque.status_operacional, statusDetectado)

  // Correção importante:
  // "Aguardando coleta" / "Etiqueta criada" não pode permanecer como Coletado.
  // Se o status anterior foi gravado errado como Coletado e a transportadora voltou etiqueta criada,
  // o sistema deve corrigir para Aguardando coleta.
  if (statusDetectado === 'Aguardando coleta' && statusAtualAntes === 'Coletado' && !dataColeta) {
    statusNormalizado = 'Aguardando coleta'
  }

  const mudouStatus = statusNormalizado !== statusAtualAntes

  const dadosAtualizar: any = {
    status_operacional: statusNormalizado,
    ultima_atualizacao: new Date().toISOString(),
    proxima_tentativa_rastreio: null,
  }

  if (statusNormalizado === 'Aguardando coleta' && statusAtualAntes === 'Coletado' && !dataColeta) {
    dadosAtualizar.data_envio = null
  }

  if (statusNormalizado === 'Entregue') {
    dadosAtualizar.data_entrega = new Date(dataEvento || new Date()).toISOString().split('T')[0]
  }

  if (
    ['Coletado', 'Em trânsito', 'Fiscalização', 'Liberado', 'Entregue'].includes(statusNormalizado) &&
    !embarque.data_envio
  ) {
    const dataBaseEnvio = dataColeta || dataEvento || new Date().toISOString()
    dadosAtualizar.data_envio = new Date(dataBaseEnvio).toISOString().split('T')[0]
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

function extrairErroApi(data: any) {
  return (
    data?.detail ||
    data?.title ||
    data?.message ||
    data?.errors?.[0]?.message ||
    data?.errors?.[0]?.code ||
    JSON.stringify(data)
  )
}

function limparMensagemErro(mensagem: string) {
  const texto = String(mensagem || '').trim()

  if (texto.includes('Too Many Requests') || texto.includes('429')) {
    return 'Limite de consultas atingido na transportadora. Tente novamente mais tarde.'
  }

  if (texto.length > 220) {
    return `${texto.slice(0, 220)}...`
  }

  return texto || 'Erro não informado.'
}
