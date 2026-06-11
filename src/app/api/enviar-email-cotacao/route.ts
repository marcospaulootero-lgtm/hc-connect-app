import { Resend } from 'resend'
import { NextResponse } from 'next/server'


export async function POST(req: Request) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const body = await req.json()

    const {
      email,
      nome,
      referencia,
      valor,
      validade,
      link,
    } = body

    if (!email) {
      return NextResponse.json(
        { error: 'E-mail do cliente não informado' },
        { status: 400 }
      )
    }

    const { error } = await resend.emails.send({
      from: 'HC Consultoria <no-reply@hcbhz.com>',
      to: email,
      subject: 'Nova cotação disponível - HC Consultoria',
      html: `
        <div style="font-family: Arial, sans-serif; color: #111827;">
          <h2>Nova cotação disponível</h2>

          <p>Olá, ${nome || 'cliente'}.</p>

          <p>Uma nova cotação foi disponibilizada para você no portal da HC Consultoria.</p>

          <p><strong>Referência:</strong> ${referencia || '-'}</p>
          <p><strong>Valor:</strong> ${valor || '-'}</p>
          <p><strong>Validade:</strong> ${validade || '-'}</p>

          ${
            link
              ? `<p>
                  <a href="${link}" style="background:#2563eb;color:white;padding:12px 18px;text-decoration:none;border-radius:8px;display:inline-block;">
                    Acessar cotação
                  </a>
                </p>`
              : ''
          }

          <p>Atenciosamente,<br/>
          <strong>HC Consultoria</strong></p>
        </div>
      `,
    })

    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao enviar e-mail' },
      { status: 500 }
    )
  }
}