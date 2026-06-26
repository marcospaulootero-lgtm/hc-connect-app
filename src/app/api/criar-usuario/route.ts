import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function texto(valor: unknown) {
  if (valor === null || valor === undefined) return ''
  return String(valor).trim()
}

function getBaseUrl(request: Request) {
  const origin = request.headers.get('origin')

  if (origin) return origin

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  return 'http://localhost:3000'
}

async function enviarEmailBoasVindas(params: {
  email: string
  nome: string
}) {
  const resendApiKey = process.env.RESEND_API_KEY

  if (!resendApiKey) {
    console.log('RESEND_API_KEY nao configurada. Email de boas-vindas nao enviado.')
    return
  }

  const { email, nome } = params

  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'HC Consultoria <noreply@hcbhz.com>',
      to: email,
      subject: 'Cadastro realizado com sucesso - Portal HC Connect',
      html: `
        <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6">
          <h2>Cadastro realizado com sucesso</h2>

          <p>Ola, <strong>${nome || 'Cliente'}</strong>!</p>

          <p>
            Seu cadastro no <strong>Portal HC Connect</strong> foi realizado com sucesso.
          </p>

          <p>
            Atraves do portal voce podera acompanhar embarques,
            consultar documentos, visualizar cotacoes,
            acessar faturas e recibos e solicitar suporte diretamente a nossa equipe.
          </p>

          <p>
            <strong>Acesso ao portal:</strong><br>
            <a href="https://portal.hcbhz.com">https://portal.hcbhz.com</a>
          </p>

          <p>
            <strong>Importante:</strong>
          </p>

          <ul>
            <li>Utilize este e-mail para acessar sua conta e recuperar sua senha;</li>
            <li>Os embarques serao vinculados ao seu usuario pela equipe da HC Consultoria;</li>
            <li>Apos a vinculacao, os processos ficarao disponiveis em seu painel.</li>
          </ul>

          <p>
            Em caso de duvidas, estamos a disposicao.
          </p>

          <p>
            <strong>HC Consultoria - Couto e Otero Intermediacao LTDA</strong><br>
            (31) 3643-6175<br>
            marcos@hcbhz.com<br>
            www.hcbhz.com
          </p>
        </div>
      `,
    }),
  })

  const resultado = await resposta.json().catch(() => null)

  if (!resposta.ok) {
    console.log('Erro ao enviar email de boas-vindas:', resultado)
  }
}

async function enviarAlertaHC(params: {
  baseUrl: string
  nome: string
  email: string
  tipo_acesso: string
  empresa_id: string
}) {
  const { baseUrl, nome, email, tipo_acesso, empresa_id } = params

  const resposta = await fetch(`${baseUrl}/api/email-alerta-hc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tipo: 'NOVO_USUARIO',
      titulo: 'Novo usuario cadastrado no Portal HC Connect',
      mensagem: 'Um novo usuario foi criado no portal e precisa ser conferido no painel administrativo.',
      dados: {
        Nome: nome || 'Nao informado',
        Email: email || 'Nao informado',
        'Tipo de acesso': tipo_acesso || 'Nao informado',
        'Empresa ID': empresa_id || 'Nao informado',
        Data: new Date().toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
        }),
      },
    }),
  })

  const resultado = await resposta.json().catch(() => null)

  if (!resposta.ok) {
    console.log('Erro ao enviar alerta interno HC:', resultado)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const email = texto(body.email).toLowerCase()
    const senha = texto(body.senha)
    const tipo_acesso = texto(body.tipo_acesso) || 'cliente'
    const empresa_id = texto(body.empresa_id)
    const nome = texto(body.nome)

    if (!email || !senha) {
      return NextResponse.json(
        { erro: 'E-mail e senha sao obrigatorios' },
        { status: 400 }
      )
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { erro: 'Variaveis do Supabase nao configuradas' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
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

    if (error || !data.user) {
      return NextResponse.json(
        { erro: error?.message || 'Erro ao criar usuario' },
        { status: 400 }
      )
    }

    const { error: perfilError } = await supabaseAdmin.from('perfis').insert({
      id: data.user.id,
      email,
      nome,
      tipo_acesso,
      empresa_id: empresa_id || null,
      ativo: true,
    })

    if (perfilError) {
      console.log('Erro ao inserir perfil:', perfilError)

      return NextResponse.json(
        { erro: perfilError.message },
        { status: 400 }
      )
    }

    try {
      await enviarEmailBoasVindas({
        email,
        nome,
      })
    } catch (emailError) {
      console.log('Usuario criado, mas falhou o email de boas-vindas:', emailError)
    }

    try {
      await enviarAlertaHC({
        baseUrl: getBaseUrl(request),
        nome,
        email,
        tipo_acesso,
        empresa_id,
      })
    } catch (alertaError) {
      console.log('Usuario criado, mas falhou o alerta interno HC:', alertaError)
    }

    return NextResponse.json({
      sucesso: true,
      user_id: data.user.id,
    })
  } catch (error) {
    console.log('Erro interno ao criar usuario:', error)

    return NextResponse.json(
      { erro: 'Erro interno ao criar usuario' },
      { status: 500 }
    )
  }
}