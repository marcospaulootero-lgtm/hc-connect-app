import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const tipo = body.tipo || 'ALERTA'
    const titulo = body.titulo || 'Novo alerta no HC Connect'
    const mensagem = body.mensagem || ''
    const dados = body.dados || {}

    const resendApiKey = process.env.RESEND_API_KEY

    if (!resendApiKey) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY não configurada.' },
        { status: 400 }
      )
    }

    const detalhes = Object.entries(dados)
      .map(([chave, valor]) => `<li><strong>${chave}:</strong> ${valor || '-'}</li>`)
      .join('')

    const html = `
      <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6">
        <h2>${titulo}</h2>

        <p><strong>Tipo:</strong> ${tipo}</p>
        <p>${mensagem}</p>

        <ul>${detalhes}</ul>

        <p>
          <strong>Acessar painel:</strong><br/>
          <a href="https://portal.hcbhz.com/admin">https://portal.hcbhz.com/admin</a>
        </p>

        <p>
          HC Connect<br/>
          Sistema interno HC Consultoria
        </p>
      </div>
    `

    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'HC Connect <noreply@hcbhz.com>',
        to: ['marcos@hcbhz.com', 'hericamcouto@outlook.com'],
        subject: titulo,
        html,
      }),
    })

    const resultado = await resposta.json()

    if (!resposta.ok) {
      console.log(resultado)
      return NextResponse.json({ error: resultado }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao enviar alerta.' },
      { status: 500 }
    )
  }
}