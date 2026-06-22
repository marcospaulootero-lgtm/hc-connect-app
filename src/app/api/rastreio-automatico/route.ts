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

  const descricao =
    shipment?.status?.description ||
    eventoAtual?.description ||
    shipment?.status?.status ||
    shipment?.status?.statusCode ||
    'Sem descrição'

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

  const ultimoEvento = resultado?.scanEvents?.[0]

  const status =
    resultado?.latestStatusDetail?.description ||
    ultimoEvento?.eventDescription ||
    'Status FedEx não informado'

  const descricao =
    ultimoEvento?.eventDescription ||
    resultado?.latestStatusDetail?.description ||
    'Sem descrição'

  const statusCompleto = [
    resultado?.latestStatusDetail?.description,
    resultado?.latestStatusDetail?.code,
    ultimoEvento?.eventDescription,
    ultimoEvento?.eventType,
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

function normalizarStatus(status: string) {
  const s = String(status || '').toLowerCase()

  // DHL pode retornar: "A remessa será liberada e entregue pelo despachante aduaneiro".
  // Isso NÃO é entrega final ao destinatário; é transferência/liberação para o despachante.
  // Esta regra precisa vir antes de qualquer validação de entregue.
  if (
    s.includes('despachante aduaneiro') ||
    s.includes('despachante') ||
    s.includes('customs broker') ||
    s.includes('broker') ||
    s.includes('aduaneiro')
  ) {
    return 'Liberado'
  }

  // Entrega final somente quando a transportadora indicar POD/entrega concluída.
  // Não usamos apenas "entregue", porque a DHL usa essa palavra em eventos de despachante.
  if (
    s.includes('proof of delivery') ||
    s.includes('shipment delivered') ||
    s.includes('delivered to consignee') ||
    s.includes('delivered to recipient') ||
    s.includes('signed for') ||
    s.includes('delivery completed') ||
    s.includes('entrega realizada') ||
    s.includes('entrega concluída') ||
    s.includes('entrega concluida') ||
    s.includes('entregue ao destinatário') ||
    s.includes('entregue ao destinatario') ||
    s.includes('recebedor') ||
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
    s.includes('remessa ainda não foi entregue') ||
    s.includes('remessa ainda nao foi entregue') ||
    s.includes('não foi entregue fisicamente') ||
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
    s.includes('liberação') ||
    s.includes('liberacao') ||
    s.includes('clearance') ||
    s.includes('customs') ||
    s.includes('fiscal') ||
    s.includes('desembaraço') ||
    s.includes('desembaraco')
  ) {
    return 'Fiscalização'
  }

  if (
    s.includes('available for delivery') ||
    s.includes('out for delivery') ||
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
    s.includes('colet')
  ) {
    return 'Coletado'
  }

  if (
    s.includes('transit') ||
    s.includes('trânsito') ||
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
    s.includes('hub')
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
}: any) {
  const statusNormalizado = normalizarStatus(status)

  const dadosAtualizar: any = {
    status_operacional: statusNormalizado,
    ultima_atualizacao: new Date().toISOString(),
    proxima_tentativa_rastreio: null,
  }

  if (statusNormalizado === 'Entregue') {
    dadosAtualizar.data_entrega = new Date().toISOString().split('T')[0]
  }

  if (
    (statusNormalizado === 'Coletado' || statusNormalizado === 'Em trânsito') &&
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