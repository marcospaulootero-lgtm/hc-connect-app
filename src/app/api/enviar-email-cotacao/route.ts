import { Resend } from 'resend'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)

    const body = await req.json()

    const {
      email,
      nome,
      referencia_hc,
      link,
    } = body

    if (!email) {
      return NextResponse.json(
        { error: 'E-mail do cliente não informado' },
        { status: 400 }
      )
    }

    const { error } = await resend.emails.send({
      from: 'HC Consultoria - Cotações <cotacoes@hcbhz.com>'
      to: email,
      subject: `Cotação disponível | ${referencia_hc || 'HC Consultoria'}`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:700px;margin:0 auto;color:#111827;">

          <div style="background:#0f172a;padding:25px;text-align:center;border-radius:12px 12px 0 0;">
            <h1 style="color:#ffffff;margin:0;">
              HC Consultoria
            </h1>

            <p style="color:#cbd5e1;margin-top:8px;">
              Gestão Inteligente em Comércio Exterior e Logística Internacional
            </p>
          </div>

          <div style="border:1px solid #e5e7eb;padding:35px;border-top:none;border-radius:0 0 12px 12px;">

            <h2 style="margin-top:0;color:#0f172a;">
              Cotação disponível para consulta
            </h2>

            <p>
              Prezado(a) ${nome || 'cliente'},
            </p>

            <p>
              Informamos que sua solicitação de cotação foi analisada e já está disponível para consulta em seu portal HC Connect.
            </p>

            <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:18px;border-radius:10px;margin:25px 0;">
              <strong>Referência HC:</strong><br/>
              ${referencia_hc || '-'}
            </div>

            <p>
              Para visualizar os detalhes da proposta e os documentos anexados, acesse sua área exclusiva através do botão abaixo.
            </p>

            ${
              link
                ? `
                <div style="text-align:center;margin:35px 0;">
                  <a
                    href="${link}"
                    style="
                      background:#2563eb;
                      color:#ffffff;
                      padding:14px 28px;
                      text-decoration:none;
                      border-radius:8px;
                      font-weight:bold;
                      display:inline-block;
                    "
                  >
                    Acessar Portal HC Connect
                  </a>
                </div>
              `
                : ''
            }

            <p>
              Em caso de dúvidas, nossa equipe permanece à disposição.
            </p>

            <br/>

            <p>
              Atenciosamente,
            </p>

            <p>
              <strong>HC Consultoria</strong><br/>
              Couto e Otero Intermediação LTDA
            </p>

          </div>
        </div>
      `,
    })

    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || 'Erro ao enviar e-mail',
      },
      { status: 500 }
    )
  }
}