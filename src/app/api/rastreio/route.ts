import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const body = await req.json()

  const fedexClientId = process.env.FEDEX_CLIENT_ID
  const fedexClientSecret = process.env.FEDEX_CLIENT_SECRET
  const dhlApiKey = process.env.DHL_API_KEY

  const transportadora = String(body.transportadora || '').toUpperCase()

  if (transportadora.includes('FEDEX')) {
    if (!fedexClientId || !fedexClientSecret) {
      return NextResponse.json(
        {
          error:
            'FedEx ainda não configurada. Cadastre FEDEX_CLIENT_ID e FEDEX_CLIENT_SECRET na Vercel.',
        },
        { status: 400 }
      )
    }
  }

  if (transportadora.includes('DHL')) {
    if (!dhlApiKey) {
      return NextResponse.json(
        {
          error:
            'DHL ainda não configurada. Cadastre DHL_API_KEY na Vercel.',
        },
        { status: 400 }
      )
    }
  }

  return NextResponse.json(
    {
      error:
        'Integração automática ainda não finalizada. Agora falta conectar a API oficial da transportadora.',
    },
    { status: 400 }
  )
}