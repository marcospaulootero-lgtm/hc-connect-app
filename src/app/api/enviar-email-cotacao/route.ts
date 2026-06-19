import { Resend } from 'resend'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const body = await req.json()

    const {
      cotacao_id,
      solicitante_email,
      exportador,
      importador,
      referencia_cliente,
      servico,
      transportadoras_consulta,
      origem,
      destino,
      peso_real,
      peso_taxado,
      peso_total,
      moeda,
      valor_mercadoria,
      observacoes,
      link_admin,
    } = body

    const transportadoras = Array.isArray(transportadoras_consulta)
      ? transportadoras_consulta.join(', ')
      : transportadoras_consulta || '-'

    const { error } = await resend.emails.send({
      from: 'HC Connect - Cotações <cotacoes@hcbhz.com>',
      to: ['marcos@hcbhz.com', 'hericamcouto@outlook.com'],
      subject: `Nova cotação recebida | ${servico || 'HC Connect'}`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:760px;margin:0 auto;color:#111827;">
          <div style="background:#020817;padding:26px;border-radius:14px 14px 0 0;">
            <h1 style="color:#ffffff;margin:0;">Nova cotação recebida</h1>
            <p style="color:#cbd5e1;margin:8px 0 0;">
              Uma nova solicitação foi enviada pelo portal HC Connect.
            </p>
          </div>

          <div style="border:1px solid #e5e7eb;border-top:none;padding:30px;border-radius:0 0 14px 14px;">
            <h2 style="margin-top:0;color:#0f172a;">Dados da solicitação</h2>

            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;"><strong>Solicitante</strong></td>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${solicitante_email || '-'}</td>
              </tr>
              <tr>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;"><strong>Exportador</strong></td>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${exportador || '-'}</td>
              </tr>
              <tr>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;"><strong>Importador</strong></td>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${importador || '-'}</td>
              </tr>
              <tr>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;"><strong>Referência cliente</strong></td>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${referencia_cliente || '-'}</td>
              </tr>
              <tr>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;"><strong>Serviço</strong></td>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${servico || '-'}</td>
              </tr>
              <tr>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;"><strong>Transportadoras</strong></td>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${transportadoras}</td>
              </tr>
              <tr>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;"><strong>Rota</strong></td>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${origem || '-'} → ${destino || '-'}</td>
              </tr>
              <tr>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;"><strong>Pesos</strong></td>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;">Real: ${peso_real || '-'} kg | Taxado: ${peso_taxado || '-'} kg | Total volumes: ${peso_total || '-'} kg</td>
              </tr>
              <tr>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;"><strong>Valor mercadoria</strong></td>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${moeda || ''} ${valor_mercadoria || '-'}</td>
              </tr>
              <tr>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;"><strong>Observações</strong></td>
                <td style="padding:10px;border-bottom:1px solid #e5e7eb;">${observacoes || '-'}</td>
              </tr>
            </table>

            ${
              link_admin
                ? `
                  <div style="text-align:center;margin:30px 0 10px;">
                    <a href="${link_admin}" style="background:#2563eb;color:#ffffff;padding:14px 26px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
                      Abrir cotação no ADM
                    </a>
                  </div>
                `
                : ''
            }

            <p style="font-size:12px;color:#64748b;margin-top:25px;">
              ID da cotação: ${cotacao_id || '-'}
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
      { error: error.message || 'Erro ao enviar aviso de nova cotação' },
      { status: 500 }
    )
  }
}
