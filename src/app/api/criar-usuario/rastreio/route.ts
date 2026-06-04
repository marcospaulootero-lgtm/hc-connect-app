import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json()

  const { awb, transportadora } = body

  if (!awb || !transportadora) {
    return NextResponse.json(
      { erro: 'AWB e transportadora são obrigatórios' },
      { status: 400 }
    )
  }

  return NextResponse.json({
    status: 'Em trânsito',
    localizacao: 'Atualização aguardando integração oficial',
    previsao_entrega: '',
    eventos: [
      {
        data: new Date().toISOString(),
        status: 'Consulta realizada',
        localizacao: transportadora,
        descricao: `Rastreio consultado para AWB ${awb}`,
      },
    ],
  })
}