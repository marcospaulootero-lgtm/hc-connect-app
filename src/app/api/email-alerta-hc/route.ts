import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function limpar(valor: unknown) {
  if (valor === null || valor === undefined) return '-'
  return String(valor).trim() || '-'
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const tipo = limpar(body.tipo || 'ALERTA')
    const titulo = limpar(body.titulo || 'Novo alerta no HC Connect')
    const mensagem = limpar(body.mensagem || '')
    const dados = body.dados && typeof body.dados === 'object' ? body.dados : {}

    const resendApiKey = process.env.RESEND_API_KEY

    if (!resendApiKey) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY nao configurada.' },
        { status: 400 }
      )
    }

    const detalhes = Object.entries(dados)
      .map(([chave, valor]) => {
        return `<li><strong>${limpar(chave)}:</strong> ${limpar(valor)}</li>`
      })
      .join('')

    const html = `
      <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6">
        <h2>${titulo}</h2>

        <p><strong>Tipo:</strong> ${tipo}</p>

        ${
          mensagem !== '-'
            ? `<p>${mensagem}</p>`
            : ''
        }

        ${
          detalhes
            ? `<ul>${detalhes}</ul>`
            : ''
        }

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

    const resultado = await resposta.json().catch(() => null)

    if (!resposta.ok) {
      console.log('Erro Resend email-alerta-hc:', resultado)

      return NextResponse.json(
        { error: resultado || 'Erro ao enviar alerta.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      resultado,
    })
  } catch (error: any) {
    console.log('Erro geral email-alerta-hc:', error)

    return NextResponse.json(
      { error: error?.message || 'Erro ao enviar alerta.' },
      { status: 500 }
    )
  }
}