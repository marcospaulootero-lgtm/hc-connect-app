import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function texto(valor: any) {
  return String(valor || '').trim() || '-'
}

export async function POST(req: Request) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const body = await req.json()

    const {
      cliente_final,
      solicitante_email,
      tipo_operacao,
      origem,
      destino,
      transportadora,
      awb,
      peso,
      volumes,
      descricao_mercadoria,
      instrucoes,
      documentos,
    } = body || {}

    const linkAdmin = 'https://portal.hcbhz.com/admin/embarque-direto'

    const listaDocumentos = Array.isArray(documentos) && documentos.length > 0
      ? documentos.map((nome: string) => `<li>${texto(nome)}</li>`).join('')
      : '<li>Nenhum documento informado.</li>'

    const { error } = await resend.emails.send({
      from: 'HC Consultoria - Portal <cotacoes@hcbhz.com>',
      to: ['marcos@hcbhz.com', 'hericamcouto@outlook.com'],
      subject: `Novo Embarque Direto | ${texto(cliente_final)}`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:760px;margin:0 auto;color:#111827;">
          <div style="background:#0f172a;padding:24px;border-radius:14px 14px 0 0;">
            <h1 style="color:#ffffff;margin:0;font-size:24px;">Novo Embarque Direto</h1>
            <p style="color:#cbd5e1;margin:8px 0 0;">Uma nova solicitação foi enviada pelo portal do cliente.</p>
          </div>

          <div style="border:1px solid #e5e7eb;border-top:0;padding:24px;border-radius:0 0 14px 14px;">
            <h2 style="margin:0 0 16px;color:#0f172a;">Dados da solicitação</h2>

            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;"><strong>Cliente final</strong></td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${texto(cliente_final)}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;"><strong>Solicitante</strong></td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${texto(solicitante_email)}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;"><strong>Operação</strong></td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${texto(tipo_operacao)}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;"><strong>Rota</strong></td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${texto(origem)} → ${texto(destino)}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;"><strong>Transportadora</strong></td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${texto(transportadora)}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;"><strong>AWB / Referência</strong></td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${texto(awb)}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;"><strong>Peso</strong></td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${texto(peso)}</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;"><strong>Volumes</strong></td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${texto(volumes)}</td></tr>
            </table>

            <h3 style="margin:24px 0 8px;">Mercadoria</h3>
            <p style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e5e7eb;padding:14px;border-radius:10px;">${texto(descricao_mercadoria)}</p>

            <h3 style="margin:24px 0 8px;">Instruções</h3>
            <p style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e5e7eb;padding:14px;border-radius:10px;">${texto(instrucoes)}</p>

            <h3 style="margin:24px 0 8px;">Documentos anexados</h3>
            <ul>${listaDocumentos}</ul>

            <div style="margin-top:28px;">
              <a href="${linkAdmin}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold;display:inline-block;">
                Abrir Embarque Direto no Admin
              </a>
            </div>
          </div>
        </div>
      `,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao enviar alerta de embarque direto.' },
      { status: 500 }
    )
  }
}
