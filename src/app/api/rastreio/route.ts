import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const embarqueId = body.embarqueId
    const awb = body.awb
    const transportadora = String(body.transportadora || '').toUpperCase()

    if (!embarqueId || !awb) {
      return NextResponse.json(
        { error: 'Embarque ou AWB não informado.' },
        { status: 400 }
      )
    }

    if (!transportadora.includes('FEDEX')) {
      return NextResponse.json(
        { error: 'Integração automática disponível apenas para FedEx neste momento.' },
        { status: 400 }
      )
    }

    const fedexClientId = process.env.FEDEX_CLIENT_ID
    const fedexClientSecret = process.env.FEDEX_CLIENT_SECRET

    if (!fedexClientId || !fedexClientSecret) {
      return NextResponse.json(
        { error: 'Credenciais FedEx não configuradas na Vercel.' },
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
        client_id: fedexClientId,
        client_secret: fedexClientSecret,
      }),
    })

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok) {
      console.log('Erro token FedEx:', tokenData)

      return NextResponse.json(
        { error: 'Erro ao autenticar na FedEx.' },
        { status: 400 }
      )
    }

    const accessToken = tokenData.access_token

    const trackResponse = await fetch('https://apis.fedex.com/track/v1/trackingnumbers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-locale': 'pt_BR',
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
    })

    const trackData = await trackResponse.json()

    if (!trackResponse.ok) {
      console.log('Erro rastreio FedEx:', trackData)

      return NextResponse.json(
        { error: 'Erro ao consultar rastreio na FedEx.' },
        { status: 400 }
      )
    }

    const completeTrackResults = trackData?.output?.completeTrackResults || []
    const trackResults = completeTrackResults[0]?.trackResults || []
    const resultado = trackResults[0]

    if (!resultado) {
      return NextResponse.json(
        { error: 'Nenhum rastreio encontrado para este AWB.' },
        { status: 404 }
      )
    }

    const eventos = resultado.scanEvents || []
    const statusFedex =
      resultado.latestStatusDetail?.description ||
      resultado.latestStatusDetail?.statusByLocale ||
      resultado.latestStatusDetail?.code ||
      'Atualizado'

    await supabase
      .from('rastreios_embarques')
      .delete()
      .eq('embarque_id', embarqueId)

    const eventosFormatados = eventos.map((evento: any) => {
      const localizacao = [
        evento.scanLocation?.city,
        evento.scanLocation?.stateOrProvinceCode,
        evento.scanLocation?.countryCode,
      ]
        .filter(Boolean)
        .join(', ')

      return {
        embarque_id: embarqueId,
        transportadora: 'FedEx',
        awb,
        data_evento: evento.date || new Date().toISOString(),
        status:
          evento.eventDescription ||
          evento.derivedStatus ||
          evento.eventType ||
          'Evento FedEx',
        descricao:
          evento.exceptionDescription ||
          evento.eventDescription ||
          evento.derivedStatus ||
          'Atualização FedEx',
        localizacao: localizacao || null,
      }
    })

    if (eventosFormatados.length > 0) {
      const { error: erroInsert } = await supabase
        .from('rastreios_embarques')
        .insert(eventosFormatados)

      if (erroInsert) {
        console.log('Erro ao salvar eventos:', erroInsert)

        return NextResponse.json(
          { error: `Erro ao salvar eventos: ${erroInsert.message}` },
          { status: 400 }
        )
      }
    }

    const textoStatus = String(statusFedex).toLowerCase()
    const entregue =
      textoStatus.includes('entregue') ||
      textoStatus.includes('delivered') ||
      eventos.some((e: any) =>
        String(e.eventDescription || e.derivedStatus || '')
          .toLowerCase()
          .includes('delivered')
      ) ||
      eventos.some((e: any) =>
        String(e.eventDescription || e.derivedStatus || '')
          .toLowerCase()
          .includes('entregue')
      )

    let statusOperacional = 'Em trânsito'

    if (entregue) {
      statusOperacional = 'Entregue'
    } else if (
      textoStatus.includes('clearance') ||
      textoStatus.includes('liberação') ||
      textoStatus.includes('aduana') ||
      textoStatus.includes('customs')
    ) {
      statusOperacional = 'Fiscalização'
    }

    const dadosAtualizar: any = {
      status_operacional: statusOperacional,
      ultima_atualizacao: new Date().toISOString(),
    }

    if (statusOperacional === 'Entregue') {
      dadosAtualizar.data_entrega = new Date().toISOString().split('T')[0]
    }

    const { error: erroUpdate } = await supabase
      .from('embarques')
      .update(dadosAtualizar)
      .eq('id', embarqueId)

    if (erroUpdate) {
      console.log('Erro atualizar embarque:', erroUpdate)

      return NextResponse.json(
        { error: `Erro ao atualizar embarque: ${erroUpdate.message}` },
        { status: 400 }
      )
    }

    await supabase.from('timeline_embarques').insert({
      embarque_id: embarqueId,
      status: statusOperacional,
      descricao: `Rastreio FedEx atualizado automaticamente. Status FedEx: ${statusFedex}`,
    })

    return NextResponse.json({
      success: true,
      status: statusOperacional,
      eventos: eventosFormatados.length,
      fedexStatus: statusFedex,
    })
  } catch (error: any) {
    console.log('Erro geral rastreio:', error)

    return NextResponse.json(
      { error: error.message || 'Erro interno ao atualizar rastreio.' },
      { status: 500 }
    )
  }
}