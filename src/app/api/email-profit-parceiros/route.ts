import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function limparEmails(valor: any) {
  return String(valor || '')
    .split(/[;, \n\r]+/)
    .map((email) => email.trim())
    .filter((email) => email.includes('@'))
}

function texto(valor: any) {
  return String(valor || '').trim()
}

export async function POST(req: Request) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const body = await req.json()

    const destinatarios = limparEmails(body?.destinatarios)
    const assunto = texto(body?.assunto)
    const mensagem = texto(body?.mensagem)
    const pdfBase64 = texto(body?.pdfBase64)
    const nomeArquivo = texto(body?.nomeArquivo) || 'profit-parceiros.pdf'

    if (destinatarios.length === 0) {
      return NextResponse.json({ error: 'Informe pelo menos um destinatário válido.' }, { status: 400 })
    }

    if (!assunto) {
      return NextResponse.json({ error: 'Informe o assunto do e-mail.' }, { status: 400 })
    }

    if (!mensagem) {
      return NextResponse.json({ error: 'Informe o corpo do e-mail.' }, { status: 400 })
    }

    if (!pdfBase64) {
      return NextResponse.json({ error: 'PDF não recebido para envio.' }, { status: 400 })
    }

    const { error } = await resend.emails.send({
      from: 'HC Consultoria - Financeiro <cotacoes@hcbhz.com>',
      to: destinatarios,
      cc: ['marcos@hcbhz.com', 'hericamcouto@outlook.com'],
      subject: assunto,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:760px;margin:0 auto;color:#111827;">
          <div style="background:#0f172a;padding:24px;border-radius:14px 14px 0 0;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;">HC Consultoria</h1>
            <p style="color:#cbd5e1;margin:8px 0 0;">Relatório de Profit Parceiros</p>
          </div>

          <div style="border:1px solid #e5e7eb;border-top:0;padding:24px;border-radius:0 0 14px 14px;">
            <div style="white-space:pre-wrap;font-size:14px;line-height:1.6;">${mensagem
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')}</div>

            <p style="margin-top:24px;color:#64748b;font-size:12px;">
              PDF enviado automaticamente pelo HC Connect.
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: nomeArquivo,
          content: pdfBase64,
        },
      ],
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao enviar PDF por e-mail.' },
      { status: 500 }
    )
  }
}
