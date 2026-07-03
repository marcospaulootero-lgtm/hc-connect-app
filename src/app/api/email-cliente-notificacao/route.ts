import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function texto(valor: any) {
  return String(valor || '').trim()
}

function portalUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://portal.hcbhz.com'
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Supabase admin não configurado.')
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

function modeloEmail(tipo: string) {
  const modelos: Record<string, any> = {
    COTACAO_RESPONDIDA: {
      assunto: 'Cotação disponível no Portal HC Connect',
      titulo: 'Sua cotação está disponível',
      descricao: 'A equipe HC respondeu sua solicitação de cotação. Acesse o portal para visualizar os detalhes.',
      botao: 'Ver cotação',
    },
    FATURA_DISPONIVEL: {
      assunto: 'Nova fatura disponível no Portal HC Connect',
      titulo: 'Nova fatura disponível',
      descricao: 'Uma nova fatura foi disponibilizada para consulta no Portal HC Connect.',
      botao: 'Ver fatura',
    },
    DOCUMENTO_DISPONIVEL: {
      assunto: 'Novo documento disponível no Portal HC Connect',
      titulo: 'Novo documento disponível',
      descricao: 'Um novo documento foi anexado ao seu processo no Portal HC Connect.',
      botao: 'Ver documentos',
    },
    SUPORTE_RESPONDIDO: {
      assunto: 'Seu chamado foi respondido no Portal HC Connect',
      titulo: 'Resposta no suporte',
      descricao: 'A equipe HC respondeu seu chamado no suporte.',
      botao: 'Ver suporte',
    },
    EMBARQUE_ATUALIZADO: {
      assunto: 'Atualização no seu embarque - HC Connect',
      titulo: 'Seu embarque foi atualizado',
      descricao: 'Houve uma atualização no acompanhamento do seu embarque.',
      botao: 'Ver embarque',
    },
  }

  return modelos[tipo] || modelos.EMBARQUE_ATUALIZADO
}

function montarHtml(params: any) {
  const modelo = modeloEmail(params.tipo)
  const nome = texto(params.nome) || 'Cliente'
  const link = texto(params.link) || portalUrl()
  const awb = texto(params.awb)
  const referencia = texto(params.referencia)
  const mensagem = texto(params.mensagem)
  const dados = params.dados && typeof params.dados === 'object' ? params.dados : {}

  const linhasDados = Object.entries(dados)
    .filter(([, valor]) => texto(valor))
    .map(([chave, valor]) => {
      return `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#475569;font-weight:bold;">${texto(chave)}</td>
          <td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:bold;">${texto(valor)}</td>
        </tr>
      `
    })
    .join('')

  return {
    assunto: modelo.assunto,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:0 auto;color:#111827;line-height:1.6;">
        <div style="background:#020817;padding:28px;border-radius:16px 16px 0 0;">
          <h1 style="color:#ffffff;margin:0;font-size:26px;">${modelo.titulo}</h1>
          <p style="color:#cbd5e1;margin:8px 0 0;">HC Connect - Portal do Cliente</p>
        </div>

        <div style="border:1px solid #e5e7eb;border-top:none;padding:28px;border-radius:0 0 16px 16px;">
          <p>Olá, <strong>${nome}</strong>.</p>

          <p>${modelo.descricao}</p>

          ${
            mensagem
              ? `<p style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e5e7eb;padding:14px;border-radius:10px;">${mensagem}</p>`
              : ''
          }

          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:18px;">
            ${
              awb
                ? `
                  <tr>
                    <td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#475569;font-weight:bold;">AWB / Referência</td>
                    <td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:bold;">${awb}</td>
                  </tr>
                `
                : ''
            }

            ${
              referencia
                ? `
                  <tr>
                    <td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#475569;font-weight:bold;">Referência</td>
                    <td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:bold;">${referencia}</td>
                  </tr>
                `
                : ''
            }

            ${linhasDados}
          </table>

          <div style="text-align:center;margin:28px 0 18px;">
            <a href="${link}" style="background:#2563eb;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:10px;font-weight:bold;display:inline-block;">
              ${modelo.botao}
            </a>
          </div>

          <p style="font-size:13px;color:#64748b;margin-top:24px;">
            Portal HC Connect:<br />
            <a href="${portalUrl()}" style="color:#2563eb;">${portalUrl()}</a>
          </p>

          <p style="margin-top:24px;">
            Atenciosamente,<br />
            <strong>HC Consultoria - Couto e Otero Intermediação LTDA</strong>
          </p>
        </div>
      </div>
    `,
  }
}

export async function POST(req: Request) {
  const admin = supabaseAdmin()
  let logId: string | null = null

  try {
    const body = await req.json()

    const tipo = texto(body.tipo)
    const email = texto(body.email).toLowerCase()
    const nome = texto(body.nome)
    const awb = texto(body.awb)
    const referencia = texto(body.referencia)
    const referencia_tipo = texto(body.referencia_tipo)
    const referencia_id = texto(body.referencia_id)
    const mensagem = texto(body.mensagem)

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'RESEND_API_KEY não configurada.' }, { status: 500 })
    }

    if (!email) {
      return NextResponse.json({ error: 'E-mail do cliente é obrigatório.' }, { status: 400 })
    }

    if (!tipo) {
      return NextResponse.json({ error: 'Tipo de notificação é obrigatório.' }, { status: 400 })
    }

    const { assunto, html } = montarHtml(body)

    const { data: logCriado } = await admin
      .from('emails_enviados')
      .insert({
        tipo,
        destinatario_email: email,
        destinatario_nome: nome || null,
        assunto,
        mensagem: mensagem || null,
        referencia_tipo: referencia_tipo || null,
        referencia_id: referencia_id || null,
        awb: awb || null,
        status: 'PENDENTE',
        payload: body || {},
      })
      .select('id')
      .single()

    logId = logCriado?.id || null

    const resend = new Resend(process.env.RESEND_API_KEY)

    const { data, error } = await resend.emails.send({
      from: 'HC Connect <noreply@hcbhz.com>',
      to: email,
      subject: assunto,
      html,
    })

    if (error) {
      if (logId) {
        await admin
          .from('emails_enviados')
          .update({
            status: 'ERRO',
            erro: error.message || JSON.stringify(error),
          })
          .eq('id', logId)
      }

      return NextResponse.json({ error }, { status: 400 })
    }

    if (logId) {
      await admin
        .from('emails_enviados')
        .update({
          status: 'ENVIADO',
          resend_id: data?.id || null,
          enviado_em: new Date().toISOString(),
        })
        .eq('id', logId)
    }

    return NextResponse.json({
      success: true,
      data,
      log_id: logId,
    })
  } catch (error: any) {
    if (logId) {
      await admin
        .from('emails_enviados')
        .update({
          status: 'ERRO',
          erro: error?.message || 'Erro geral ao enviar e-mail.',
        })
        .eq('id', logId)
    }

    return NextResponse.json(
      { error: error?.message || 'Erro ao enviar e-mail ao cliente.' },
      { status: 500 }
    )
  }
}
