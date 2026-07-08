import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const email = String(body.email || '').trim()
    const nome = String(body.nome || 'cliente').trim()
    const referencia = String(body.referencia_hc || 'Cotação HC').trim()
    const pdfUrl = String(body.pdf_url || '').trim()
    const pdfNome = String(body.pdf_nome || 'cotacao-hc.pdf').trim()
    const modelo = String(body.modelo || 'Cotação HC').trim()
    const total = String(body.total || '').trim()

    if (!email) {
      return NextResponse.json({ error: 'E-mail não informado.' }, { status: 400 })
    }

    if (!pdfUrl) {
      return NextResponse.json({ error: 'PDF não informado.' }, { status: 400 })
    }

    const resendApiKey = process.env.RESEND_API_KEY

    if (!resendApiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY não configurada.' }, { status: 400 })
    }

    const html = `
      <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6">
        <h2>Olá, ${nome}</h2>

        <p>Segue a cotação solicitada pela HC Consultoria.</p>

        <p><strong>Referência:</strong> ${referencia}</p>
        <p><strong>Modelo:</strong> ${modelo}</p>
        ${total ? `<p><strong>Total:</strong> ${total}</p>` : ''}

        <p>
          <a href="${pdfUrl}" target="_blank" style="background:#2563eb;color:white;padding:12px 18px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block">
            Abrir cotação em PDF
          </a>
        </p>

        <p style="font-size:13px;color:#6b7280">
          Arquivo: ${pdfNome}
        </p>

        <p>Atenciosamente,<br/>HC Consultoria</p>
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
        to: [email],
        subject: `Cotação HC - ${referencia}`,
        html,
      }),
    })

    const resultado = await resposta.json().catch(() => null)

    if (!resposta.ok) {
      console.log('Erro Resend enviar-cotacao-manual:', resultado)
      return NextResponse.json(
        { error: 'Erro ao enviar e-mail.', detalhes: resultado },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, resultado })
  } catch (error: any) {
    console.log('Erro geral enviar-cotacao-manual:', error)
    return NextResponse.json(
      { error: error?.message || 'Erro interno.' },
      { status: 500 }
    )
  }
}
