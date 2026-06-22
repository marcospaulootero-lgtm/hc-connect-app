import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

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
        const awb = String(embarque.awb || '').trim()
        const transportadora = String(embarque.transportadora || '').toUpperCase()

        if (!awb || awb === 'AGUARDANDO AWB') {
          resultados.push({
            id: embarque.id,
            awb,
            transportadora: embarque.transportadora || '-',
            sucesso: false,
            erro: 'AWB inválido.',
          })
          continue
        }

        if (transportadora.includes('DHL')) {
          const resultado = await rastrearDHL(embarque, awb)
          resultados.push(resultado)
          continue
        }

        if (transportadora.includes('FEDEX') || transportadora.includes('FED EX')) {
          const resultado = await rastrearFedEx(embarque, awb)
          resultados.push(resultado)
          continue
        }

        resultados.push({
          id: embarque.id,
          awb,
          transportadora: embarque.transportadora || '-',
          sucesso: false,
          erro: 'Transportadora não suportada.',
        })
      } catch (erro: any) {
        const mensagemErro = erro?.message || String(erro)

        if (
          mensagemErro.includes('429') ||
          mensagemErro.includes('Too Many Requests')
        ) {
          const proximaTentativa = new Date(
            Date.now() + 3 * 60 * 60 * 1000
          ).toISOString()

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

async function rastrearDHL(embarque: any, awb: string) {
  const dhlApiKey = process.env.DHL_API_KEY

  if (!dhlApiKey) {
    throw new Error('DHL_API_KEY não configurada.')
  }

  const url = `https://api-eu.dhl.com/track/shipments?trackingNumber=${encodeURIComponent(
    awb
  )}`

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

  const eventoAtual = shipment?.events?.[0]

  const descricaoOriginal =
    shipment?.status?.description ||
    eventoAtual?.description ||
    shipment?.status?.status ||
    shipment?.status?.statusCode ||
    'Sem descrição'

  const descricao = traduzirDescricao(descricaoOriginal)

  const statusCompleto = [
    shipment?.status?.description,
    shipment?.status?.status,
    shipment?.status?.statusCode,
    eventoAtual?.description,
    eventoAtual?.typeCode,
  ]
    .filter(Boolean)
    .join(' | ')

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
    status: statusCompleto || descricao,
    descricao,
    local,
    dataEvento,
  })

  return {
    id: embarque.id,
    awb,
    transportadora: 'DHL',
    sucesso: true,
    status: statusNormalizado,
    descricao,
  }
}

async function rastrearFedEx(embarque: any, awb: string) {
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

  const trackResponse = await fetch(
    'https://apis.fedex.com/track/v1/trackingnumbers',
    {
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
    }
  )

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

  const status =
    resultado?.latestStatusDetail?.description ||
    ultimoEvento?.eventDescription ||
    'Status FedEx não informado'

  const descricaoOriginal =
    ultimoEvento?.eventDescription ||
    resultado?.latestStatusDetail?.description ||
    'Sem descrição'

  const descricao = traduzirDescricao(descricaoOriginal)

  const statusCompleto = [
  resultado?.latestStatusDetail?.description,
  resultado?.latestStatusDetail?.code,
  ultimoEvento?.eventDescription,
  ultimoEvento?.eventType,
  ...eventos.map((item: any) => item?.eventDescription).filter(Boolean),
  ...eventos.map((item: any) => item?.eventType).filter(Boolean),
]
  .filter(Boolean)
  .join(' | ')

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
    status: statusCompleto || status,
    descricao,
    local,
    dataEvento,
  })

  return {
    id: embarque.id,
    awb,
    transportadora: 'FEDEX',
    sucesso: true,
    status: statusNormalizado,
    descricao,
  }
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

  // FedEx - PT/EN
  if (d === 'delivered' || d.includes('shipment delivered') || d.includes('envio entregue') || d === 'entregue') {
    return 'Entregue'
  }

  if (
    d.includes('on fedex vehicle for delivery') ||
    d.includes('on vehicle for delivery') ||
    d.includes('em veiculo fedex para entrega') ||
    d.includes('em veículo fedex para entrega') ||
    d.includes('out for delivery') ||
    d.includes('with delivery courier') ||
    d.includes('saiu com o mensageiro para entrega') ||
    d.includes('mensageiro para entrega') ||
    d.includes('saiu para entrega')
  ) {
    return 'Saiu para entrega'
  }

  if (
    d.includes('shipment information sent to fedex') ||
    d.includes('shipment information received') ||
    d.includes('shipping information received') ||
    d.includes('informacoes de remessa enviadas para a fedex') ||
    d.includes('informações de remessa enviadas para a fedex') ||
    d.includes('label created') ||
    d.includes('label generated') ||
    d.includes('pre-shipment')
  ) {
    return 'Informações de remessa enviadas para a transportadora'
  }

  if (
    d === 'picked up' ||
    d === 'pego' ||
    d.includes('shipment picked up') ||
    d.includes('picked up') ||
    d.includes('pickup') ||
    d.includes('collected') ||
    d.includes('envio recolhido') ||
    d.includes('remessa coletada')
  ) {
    return 'Coletado'
  }

  if (
    d.includes('international shipment release') ||
    d.includes('liberacao internacional de remessas') ||
    d.includes('liberação internacional de remessas') ||
    d.includes('customs status updated') ||
    d.includes('customs clearance') ||
    d.includes('clearance event') ||
    d.includes('clearance processing') ||
    d.includes('clearance in progress') ||
    d.includes('processo de liberacao alfandegaria') ||
    d.includes('processo de liberação alfandegária') ||
    d.includes('em processo de liberacao') ||
    d.includes('em processo de liberação') ||
    d.includes('envio em proceso de liberacao') ||
    d.includes('envio em processo de liberacao') ||
    d.includes('envio em processo de liberação')
  ) {
    return 'Em processo de liberação'
  }

  if (
    d.includes('shipment will be cleared and delivered by broker') ||
    d.includes('cleared and delivered by broker') ||
    d.includes('customs broker') ||
    d.includes('despachante aduaneiro') ||
    d.includes('despachante foi notificado') ||
    d.includes('broker has been notified')
  ) {
    if (d.includes('notificado') || d.includes('notified')) {
      return 'O despachante foi notificado para providenciar a liberação'
    }

    return 'A remessa será liberada e entregue pelo despachante aduaneiro'
  }

  if (
    d.includes('clearance processing complete') ||
    d.includes('clearance complete') ||
    d.includes('liberacao concluida') ||
    d.includes('liberação concluída') ||
    d.includes('liberacao aduaneira concluida') ||
    d.includes('liberação aduaneira concluída')
  ) {
    return 'Liberação aduaneira concluída'
  }

  if (
    d.includes('at destination sort facility') ||
    d.includes('na instalacao de classificacao de destino') ||
    d.includes('na instalação de classificação de destino')
  ) {
    return 'Na instalação de classificação de destino'
  }

  if (
    d.includes('arrived at fedex hub') ||
    d.includes('chegaram ao hub da fedex') ||
    d.includes('arrived at facility') ||
    d.includes('arrived at') ||
    d.includes('arrived') ||
    d.includes('chegou nas instalacoes') ||
    d.includes('chegou nas instalações') ||
    d.includes('chegou a unidade')
  ) {
    return original.match(/chegou|chegaram/i) ? original : 'Chegou à unidade da transportadora'
  }

  if (
    d.includes('departed fedex hub') ||
    d.includes('deixou o hub da fedex') ||
    d.includes('left fedex origin facility') ||
    d.includes('deixei a instalacao de origem da fedex') ||
    d.includes('deixei a instalação de origem da fedex') ||
    d.includes('departed from') ||
    d.includes('departed') ||
    d.includes('partiu de uma instalacao') ||
    d.includes('partiu de uma instalação') ||
    d.includes('partiu')
  ) {
    return original.match(/partiu|deix/i) ? original : 'Saiu da unidade da transportadora'
  }

  if (
    d.includes('on the way') ||
    d.includes('a caminho') ||
    d.includes('in transit') ||
    d.includes('transit')
  ) {
    return 'A caminho'
  }

  if (
    d.includes('processed at') ||
    d.includes('processed in') ||
    d.includes('processed') ||
    d.includes('processado')
  ) {
    return original.match(/processado/i) ? original : 'Processado na unidade da transportadora'
  }

  if (
    d.includes('shipment is scheduled to depart') ||
    d.includes('scheduled to depart') ||
    d.includes('programada para partir')
  ) {
    return 'Remessa programada para partir no próximo movimento disponível'
  }

  return original
}

function normalizarStatusPorTransportadora(transportadora: string, status: string) {
  const carrier = String(transportadora || '').toUpperCase()

  if (carrier.includes('DHL')) return normalizarStatusDHL(status)
  if (carrier.includes('FEDEX') || carrier.includes('FED EX')) return normalizarStatusFedEx(status)

  return normalizarStatusGenerico(status)
}

function normalizarStatusDHL(status: string) {
  const s = removerAcentos(status)

  // Ordem importante: eventos específicos antes dos genéricos.
  // Nunca usar apenas "entregue" ou "delivered", porque a DHL usa delivered/broker em evento aduaneiro.

  if (
    s === 'envio entregue' ||
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
    s.includes('out for delivery') ||
    s.includes('with delivery courier') ||
    s.includes('with courier') ||
    s.includes('courier for delivery') ||
    s.includes('saiu com o mensageiro para entrega') ||
    s.includes('mensageiro para entrega') ||
    s.includes('saiu para entrega')
  ) {
    return 'Saiu para entrega'
  }

  if (
    s.includes('shipment will be cleared and delivered by broker') ||
    s.includes('cleared and delivered by broker') ||
    s.includes('customs broker') ||
    s.includes('despachante aduaneiro') ||
    s.includes('despachante') ||
    s.includes('broker') ||
    s.includes('aduaneiro')
  ) {
    return 'Liberado'
  }

  if (
    s.includes('clearance event') ||
    s.includes('customs status updated') ||
    s.includes('customs clearance') ||
    s.includes('customs') ||
    s.includes('clearance processing') ||
    s.includes('clearance process') ||
    s.includes('clearance in progress') ||
    s.includes('clearance') ||
    s.includes('processo de liberacao alfandegaria') ||
    s.includes('liberacao alfandegaria') ||
    s.includes('em processo de liberacao') ||
    s.includes('envio em proceso de liberacao') ||
    s.includes('envio em processo de liberacao') ||
    s.includes('liberacao') ||
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
    s.includes('shipment picked up') ||
    s.includes('picked up') ||
    s.includes('pickup') ||
    s.includes('collected') ||
    s.includes('coletado') ||
    s.includes('coleta realizada') ||
    s.includes('colet') ||
    s.includes('envio recolhido') ||
    s.includes('remessa coletada')
  ) {
    return 'Coletado'
  }

  if (
    s.includes('shipment information received') ||
    s.includes('shipping information received') ||
    s.includes('label created') ||
    s.includes('label generated') ||
    s.includes('etiqueta') ||
    s.includes('gerou a etiqueta') ||
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

function normalizarStatusFedEx(status: string) {
  const s = removerAcentos(status)

  // FedEx separado da DHL para não quebrar exportação/importação já entregue.
  if (
    s === 'delivered' ||
    s === 'entregue' ||
    s.includes('delivered') ||
    s.includes('entregue') ||
    s.includes('proof of delivery') ||
    s.includes('obtain proof of delivery') ||
    s.includes('signed for')
  ) {
    return 'Entregue'
  }

  if (
    s.includes('on fedex vehicle for delivery') ||
    s.includes('on vehicle for delivery') ||
    s.includes('out for delivery') ||
    s.includes('em veiculo fedex para entrega') ||
    s.includes('em veículo fedex para entrega') ||
    s.includes('saiu para entrega')
  ) {
    return 'Saiu para entrega'
  }

  if (
    s.includes('clearance') ||
    s.includes('customs') ||
    s.includes('international shipment release') ||
    s.includes('liberacao internacional de remessas') ||
    s.includes('liberação internacional de remessas')
  ) {
    return 'Fiscalização'
  }

  if (
    s.includes('picked up') ||
    s.includes('pickup') ||
    s.includes('pego') ||
    s.includes('coletado') ||
    s.includes('collected')
  ) {
    return 'Coletado'
  }

  if (
    s.includes('shipment information sent to fedex') ||
    s.includes('informacoes de remessa enviadas para a fedex') ||
    s.includes('informações de remessa enviadas para a fedex') ||
    s.includes('shipment information received') ||
    s.includes('label created') ||
    s.includes('label generated')
  ) {
    return 'Etiqueta gerada'
  }

  if (
    s.includes('on the way') ||
    s.includes('a caminho') ||
    s.includes('in transit') ||
    s.includes('left fedex') ||
    s.includes('departed fedex') ||
    s.includes('arrived at fedex') ||
    s.includes('at destination sort facility') ||
    s.includes('destination sort facility') ||
    s.includes('fedex hub') ||
    s.includes('hub') ||
    s.includes('facility') ||
    s.includes('instalacao') ||
    s.includes('instalação')
  ) {
    return 'Em trânsito'
  }

  return 'Etiqueta gerada'
}

function normalizarStatusGenerico(status: string) {
  const s = removerAcentos(status)

  if (s.includes('delivered') || s.includes('entregue')) return 'Entregue'
  if (s.includes('out for delivery') || s.includes('saiu para entrega')) return 'Saiu para entrega'
  if (s.includes('clearance') || s.includes('customs') || s.includes('liberacao')) return 'Fiscalização'
  if (s.includes('picked') || s.includes('pickup') || s.includes('colet')) return 'Coletado'
  if (s.includes('transit') || s.includes('transito') || s.includes('processed') || s.includes('processado')) return 'Em trânsito'

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
}: any) {
  const statusNormalizado = normalizarStatusPorTransportadora(transportadora, status)

  const dadosAtualizar: any = {
    status_operacional: statusNormalizado,
    ultima_atualizacao: new Date().toISOString(),
    proxima_tentativa_rastreio: null,
  }

  if (statusNormalizado === 'Entregue') {
    dadosAtualizar.data_entrega = new Date().toISOString().split('T')[0]
  } else {
    dadosAtualizar.data_entrega = null
  }

  if (
    ['Coletado', 'Em trânsito', 'Fiscalização', 'Liberado', 'Saiu para entrega', 'Entregue'].includes(statusNormalizado) &&
    !embarque.data_envio
  ) {
    dadosAtualizar.data_envio = new Date().toISOString().split('T')[0]
  }

  const { error: erroUpdate } = await supabase
    .from('embarques')
    .update(dadosAtualizar)
    .eq('id', embarque.id)

  if (erroUpdate) {
    throw new Error(`Erro ao atualizar embarque: ${erroUpdate.message}`)
  }

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

  if (texto.includes('Too Many Requests')) {
    return 'Limite de consultas atingido na transportadora. Tente novamente mais tarde.'
  }

  if (texto.includes('429')) {
    return 'Limite de consultas atingido na transportadora. Tente novamente mais tarde.'
  }

  if (texto.length > 220) {
    return `${texto.slice(0, 220)}...`
  }

  return texto || 'Erro não informado.'
}