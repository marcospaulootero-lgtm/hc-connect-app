import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: Request) {
  try {
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

    const awb = String(embarque.awb || '').trim()
    const transportadora = String(embarque.transportadora || '').toUpperCase()

    if (!awb) {
      return NextResponse.json({ error: 'Este embarque não possui AWB.' }, { status: 400 })
    }

    if (transportadora.includes('DHL')) {
      return await rastrearDHL(embarque, awb)
    }

    if (transportadora.includes('FEDEX') || transportadora.includes('FED EX')) {
      return await rastrearFedEx(embarque, awb)
    }

    return NextResponse.json(
      { error: 'Transportadora não suportada para rastreio automático.' },
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

async function rastrearDHL(embarque: any, awb: string) {
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
  const eventoEntregue = encontrarEventoEntregueDHL(eventos)
  const eventoAtual = eventoEntregue || eventos[0]
  const dataColeta = encontrarDataColetaDHL(eventos)

  const statusCompleto = [
    shipment?.status?.description,
    shipment?.status?.status,
    shipment?.status?.statusCode,
    eventoAtual?.description,
    eventoAtual?.status,
    eventoAtual?.statusCode,
    eventoAtual?.typeCode,
  ]
    .filter(Boolean)
    .join(' | ')

  const descricaoOriginal =
    eventoEntregue?.description ||
    shipment?.status?.description ||
    eventoAtual?.description ||
    shipment?.status?.status ||
    shipment?.status?.statusCode ||
    'Sem descrição'

  const descricao = traduzirDescricao(descricaoOriginal)

  const local =
    eventoAtual?.location?.address?.addressLocality ||
    shipment?.status?.location?.address?.addressLocality ||
    null

  const dataEvento =
    eventoAtual?.timestamp ||
    shipment?.status?.timestamp ||
    new Date().toISOString()

  const statusNormalizado = await salvarRastreio({
    embarque,
    awb,
    transportadora: 'DHL',
    status: statusCompleto || descricao,
    descricao,
    local,
    dataEvento,
    dataColeta,
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
  })
}


async function rastrearFedEx(embarque: any, awb: string) {
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
  const eventoEntregue = encontrarEventoEntregueFedEx(eventos)
  const ultimoEvento = eventoEntregue || eventos[0]
  const dataColeta = encontrarDataColetaFedEx(eventos)

  const statusCompleto = [
    resultado?.latestStatusDetail?.description,
    resultado?.latestStatusDetail?.code,
    ultimoEvento?.eventDescription,
    ultimoEvento?.eventType,
    ultimoEvento?.derivedStatus,
  ]
    .filter(Boolean)
    .join(' | ')

  const status =
    statusCompleto ||
    resultado?.latestStatusDetail?.description ||
    ultimoEvento?.eventDescription ||
    'Status FedEx não informado'

  const descricaoOriginal =
    eventoEntregue?.eventDescription ||
    ultimoEvento?.eventDescription ||
    resultado?.latestStatusDetail?.description ||
    'Sem descrição'

  const descricao = traduzirDescricao(descricaoOriginal)

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
    status,
    descricao,
    local,
    dataEvento,
    dataColeta,
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
  })
}


function encontrarDataColetaDHL(eventos: any[]) {
  const eventoColeta = eventos.find((evento) => {
    const texto = String(
      `${evento?.description || ''} ${evento?.status || ''} ${evento?.statusCode || ''}`
    ).toLowerCase()

    return (
      texto.includes('picked') ||
      texto.includes('pickup') ||
      texto.includes('colet') ||
      texto.includes('shipment picked up') ||
      texto.includes('remessa coletada')
    )
  })

  return eventoColeta?.timestamp || null
}

function encontrarDataColetaFedEx(eventos: any[]) {
  const eventoColeta = eventos.find((evento) => {
    const texto = String(
      `${evento?.eventDescription || ''} ${evento?.eventType || ''} ${evento?.derivedStatus || ''}`
    ).toLowerCase()

    return (
      texto.includes('picked') ||
      texto.includes('pickup') ||
      texto.includes('picked up') ||
      texto.includes('colet') ||
      texto.includes('pu')
    )
  })

  return eventoColeta?.date || null
}

function textoEventoDHL(evento: any) {
  return [
    evento?.description,
    evento?.status,
    evento?.statusCode,
    evento?.typeCode,
  ]
    .filter(Boolean)
    .join(' | ')
}

function textoEventoFedEx(evento: any) {
  return [
    evento?.eventDescription,
    evento?.eventType,
    evento?.derivedStatus,
  ]
    .filter(Boolean)
    .join(' | ')
}

function textoIndicaEntregaReal(texto: any) {
  const s = removerAcentos(String(texto || ''))

  return (
    s === 'envio entregue' ||
    s === 'delivered' ||
    s.includes('shipment delivered') ||
    s.includes('envio entregue') ||
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

function encontrarEventoEntregueDHL(eventos: any[]) {
  return eventos.find((evento) => textoIndicaEntregaReal(textoEventoDHL(evento))) || null
}

function encontrarEventoEntregueFedEx(eventos: any[]) {
  return eventos.find((evento) => textoIndicaEntregaReal(textoEventoFedEx(evento))) || null
}

function dataParaISODate(valor: any) {
  const data = valor ? new Date(valor) : new Date()

  if (isNaN(data.getTime())) {
    return new Date().toISOString().split('T')[0]
  }

  return data.toISOString().split('T')[0]
}

function removerAcentos(texto: string) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function traduzirDescricao(descricao: string) {
  const original = String(descricao || '').trim()
  const d = removerAcentos(original)

  if (!original) return 'Sem descrição'

  if (
    d.includes('shipment will be cleared and delivered by broker') ||
    d.includes('cleared and delivered by broker') ||
    d.includes('customs broker') ||
    d.includes('broker')
  ) {
    return 'A remessa será liberada e entregue pelo despachante aduaneiro'
  }

  if (
    d.includes('shipment delivered') ||
    d === 'delivered' ||
    d.includes('proof of delivery') ||
    d.includes('envio entregue')
  ) {
    return 'Envio entregue'
  }

  if (
    d.includes('out for delivery') ||
    d.includes('with delivery courier') ||
    d.includes('with courier') ||
    d.includes('saiu com o mensageiro para entrega') ||
    d.includes('mensageiro para entrega') ||
    d.includes('saiu para entrega')
  ) {
    return 'A remessa saiu com o mensageiro para entrega'
  }

  if (
    d.includes('clearance processing complete') ||
    d.includes('clearance complete') ||
    d.includes('liberacao concluida') ||
    d.includes('liberacao aduaneira concluida')
  ) {
    return 'Liberação aduaneira concluída'
  }

  if (
    d.includes('clearance event') ||
    d.includes('customs status updated') ||
    d.includes('clearance') ||
    d.includes('customs') ||
    d.includes('processo de liberacao') ||
    d.includes('em processo de liberacao') ||
    d.includes('envio em proceso de liberacao') ||
    d.includes('envio em processo de liberacao')
  ) {
    return 'Envio em processo de liberação'
  }

  if (
    d.includes('broker has been notified') ||
    d.includes('despachante foi notificado')
  ) {
    return 'O despachante foi notificado para providenciar a liberação'
  }

  if (
    d.includes('shipment picked up') ||
    d.includes('picked up') ||
    d.includes('pickup') ||
    d.includes('collected') ||
    d.includes('envio recolhido') ||
    d.includes('remessa coletada')
  ) {
    return 'Envio recolhido'
  }

  if (
    d.includes('processed at') ||
    d.includes('processed in') ||
    d.includes('processed') ||
    d.includes('processado')
  ) {
    return original.match(/processado/i) ? original : 'Processado na unidade DHL'
  }

  if (
    d.includes('arrived at') ||
    d.includes('arrived') ||
    d.includes('chegou nas instalacoes') ||
    d.includes('chegou a unidade')
  ) {
    return original.match(/chegou/i) ? original : 'Chegou nas instalações da DHL'
  }

  if (
    d.includes('departed from') ||
    d.includes('departed') ||
    d.includes('partiu de uma instalacao') ||
    d.includes('partiu')
  ) {
    return original.match(/partiu/i) ? original : 'A remessa partiu de uma instalação da DHL'
  }

  if (
    d.includes('shipment is scheduled to depart') ||
    d.includes('scheduled to depart') ||
    d.includes('programada para partir')
  ) {
    return 'Remessa programada para partir no próximo movimento disponível'
  }

  if (
    d.includes('shipment information received') ||
    d.includes('shipping information received') ||
    d.includes('label created') ||
    d.includes('label generated') ||
    d.includes('pre-shipment')
  ) {
    return 'Etiqueta criada. Aguardando coleta pela transportadora'
  }

  return original
}

function normalizarStatus(status: string) {
  const s = removerAcentos(status)

  if (textoIndicaEntregaReal(status)) {
    return 'Entregue'
  }

  if (
    s.includes('despachante aduaneiro') ||
    s.includes('despachante') ||
    s.includes('customs broker') ||
    s.includes('cleared and delivered by broker') ||
    s.includes('broker') ||
    s.includes('aduaneiro')
  ) {
    return 'Liberado'
  }

  if (
    s.includes('out for delivery') ||
    s.includes('with delivery courier') ||
    s.includes('with courier') ||
    s.includes('saiu com o mensageiro para entrega') ||
    s.includes('mensageiro para entrega') ||
    s.includes('saiu para entrega')
  ) {
    return 'Saiu para entrega'
  }

  if (
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
  ) {
    return 'Entregue'
  }

  if (
    s.includes('shipment information received') ||
    s.includes('shipping information received') ||
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
  ) {
    return 'Etiqueta gerada'
  }

  if (
    s.includes('clearance event') ||
    s.includes('customs status updated') ||
    s.includes('liberacao') ||
    s.includes('clearance') ||
    s.includes('customs') ||
    s.includes('fiscal') ||
    s.includes('desembaraco')
  ) {
    return 'Fiscalização'
  }

  if (
    s.includes('available for delivery') ||
    s.includes('released') ||
    s.includes('liberado') ||
    s.includes('liberada')
  ) {
    return 'Liberado'
  }

  if (
    s.includes('picked up') ||
    s.includes('pickup') ||
    s.includes('collected') ||
    s.includes('coletado') ||
    s.includes('coleta realizada') ||
    s.includes('shipment picked up') ||
    s.includes('colet') ||
    s.includes('envio recolhido')
  ) {
    return 'Coletado'
  }

  if (
    s.includes('transit') ||
    s.includes('transito') ||
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
    s.includes('instalacoes da dhl')
  ) {
    return 'Em trânsito'
  }

  return 'Etiqueta gerada'
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
}: any) {
  const statusDetectado = normalizarStatus(status)

  const statusNormalizado =
    embarque.status_operacional === 'Entregue' && statusDetectado !== 'Entregue'
      ? 'Entregue'
      : statusDetectado

  const dadosAtualizar: any = {
    status_operacional: statusNormalizado,
    ultima_atualizacao: new Date().toISOString(),
  }

  if (statusNormalizado === 'Entregue') {
    dadosAtualizar.data_entrega = dataParaISODate(dataEvento)
  } else if (embarque.status_operacional !== 'Entregue') {
    dadosAtualizar.data_entrega = null
  }

  if (dataColeta && !embarque.data_coleta) {
    dadosAtualizar.data_coleta = dataColeta
  }

  if (
    ['Coletado', 'Em trânsito', 'Fiscalização', 'Liberado', 'Saiu para entrega', 'Entregue'].includes(statusNormalizado) &&
    !embarque.data_envio
  ) {
    const dataBaseEnvio = dataColeta || dataEvento || new Date().toISOString()
    dadosAtualizar.data_envio = dataParaISODate(dataBaseEnvio)
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

  await supabase.from('timeline_embarques').insert({
    embarque_id: embarque.id,
    status: statusNormalizado,
    descricao: `Rastreio atualizado: ${descricao}`,
  })

  return statusNormalizado
}
