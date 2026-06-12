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

  const eventoAtual = shipment?.events?.[0]

  const descricao =
    shipment?.status?.description ||
    eventoAtual?.description ||
    shipment?.status?.status ||
    shipment?.status?.statusCode ||
    'Sem descrição'

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
    status: descricao,
    descricao,
    local,
    dataEvento,
  })

  return NextResponse.json({
    sucesso: true,
    transportadora: 'DHL',
    awb,
    status: statusNormalizado,
    descricao,
    local,
    data_evento: dataEvento,
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

  const ultimoEvento = resultado?.scanEvents?.[0]

  const status =
    resultado?.latestStatusDetail?.description ||
    ultimoEvento?.eventDescription ||
    'Status FedEx não informado'

  const descricao =
    ultimoEvento?.eventDescription ||
    resultado?.latestStatusDetail?.description ||
    'Sem descrição'

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
  })

  return NextResponse.json({
    sucesso: true,
    transportadora: 'FEDEX',
    awb,
    status: statusNormalizado,
    descricao,
    local,
    data_evento: dataEvento,
  })
}

function normalizarStatus(status: string) {
  const s = String(status || '').toLowerCase()

  if (s.includes('delivered') || s.includes('entregue')) return 'Entregue'

  if (
    s.includes('liberação') ||
    s.includes('liberacao') ||
    s.includes('clearance') ||
    s.includes('customs') ||
    s.includes('fiscal') ||
    s.includes('despachante') ||
    s.includes('desembaraço') ||
    s.includes('desembaraco')
  ) {
    return 'Fiscalização'
  }

  if (
    s.includes('released') ||
    s.includes('liberado') ||
    s.includes('liberada')
  ) {
    return 'Liberado'
  }

  if (
    s.includes('transit') ||
    s.includes('trânsito') ||
    s.includes('transito') ||
    s.includes('processed') ||
    s.includes('processado') ||
    s.includes('chegou') ||
    s.includes('partiu')
  ) {
    return 'Em trânsito'
  }

  if (s.includes('picked') || s.includes('pickup') || s.includes('colet')) {
    return 'Coletado'
  }

  return 'Em trânsito'
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
  }

  if (statusNormalizado === 'Entregue') {
    dadosAtualizar.data_entrega = new Date().toISOString().split('T')[0]
  }

  if (statusNormalizado === 'Coletado' && !embarque.data_envio) {
    dadosAtualizar.data_envio = new Date().toISOString().split('T')[0]
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