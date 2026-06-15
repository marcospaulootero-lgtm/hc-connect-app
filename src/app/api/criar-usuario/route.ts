import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const { email, senha, tipo_acesso, empresa_id, nome } = body

    if (!email || !senha) {
      return NextResponse.json(
        { erro: 'E-mail e senha são obrigatórios' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: {
        nome,
        tipo_acesso,
        empresa_id,
      },
    })

    if (error) {
      return NextResponse.json(
        { erro: error.message },
        { status: 400 }
      )
    }

    await supabaseAdmin.from('perfis').insert({
      id: data.user.id,
      email,
      nome,
      tipo_acesso,
      empresa_id,
    })
try {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'HC Consultoria <noreply@hcbhz.com>',
      to: email,
      subject: 'Cadastro realizado com sucesso - Portal HC Connect',
      html: `
        <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6">
          <h2>Cadastro realizado com sucesso</h2>

          <p>Olá, <strong>${nome || 'Cliente'}</strong>!</p>

          <p>
            Seu cadastro no <strong>Portal HC Connect</strong> foi realizado com sucesso.
          </p>

          <p>
            Através do portal você poderá acompanhar embarques,
            consultar documentos, visualizar cotações,
            acessar faturas e recibos e solicitar suporte diretamente à nossa equipe.
          </p>

          <p>
            <strong>Acesso ao portal:</strong><br>
            https://portal.hcbhz.com
          </p>

          <p>
            <strong>Importante:</strong>
          </p>

          <ul>
            <li>Utilize este e-mail para acessar sua conta e recuperar sua senha;</li>
            <li>Os embarques serão vinculados ao seu usuário pela equipe da HC Consultoria;</li>
            <li>Após a vinculação, os processos ficarão disponíveis em seu painel.</li>
          </ul>

          <p>
            Em caso de dúvidas, estamos à disposição.
          </p>

          <p>
            <strong>HC Consultoria – Couto e Otero Intermediação LTDA</strong><br>
            (31) 3643-6175<br>
            marcos@hcbhz.com<br>
            www.hcbhz.com
          </p>
        </div>
      `,
    }),
  })
} catch (e) {
  console.log('Erro ao enviar e-mail de boas-vindas:', e)
}
    return NextResponse.json({
      sucesso: true,
      user_id: data.user.id,
    })
  } catch (error) {
    return NextResponse.json(
      { erro: 'Erro interno ao criar usuário' },
      { status: 500 }
    )
  }
}