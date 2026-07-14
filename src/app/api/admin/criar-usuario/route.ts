import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function erro(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status })
}

export async function POST(req: NextRequest) {
  try {
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return erro('Variáveis do Supabase não configuradas no servidor.', 500)
    }

    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()

    if (!token) {
      return erro('Sessão não enviada.', 401)
    }

    const supabaseAuth = createClient(supabaseUrl, anonKey)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    const {
      data: { user: usuarioLogado },
      error: erroSessao,
    } = await supabaseAuth.auth.getUser(token)

    if (erroSessao || !usuarioLogado?.id) {
      return erro('Sessão inválida.', 401)
    }

    const { data: perfilAdmin, error: erroPerfil } = await supabaseAdmin
      .from('perfis')
      .select('id, email, tipo_acesso, ativo')
      .eq('id', usuarioLogado.id)
      .maybeSingle()

    if (
      erroPerfil ||
      !perfilAdmin ||
      perfilAdmin.ativo === false ||
      String(perfilAdmin.tipo_acesso || '').toLowerCase() !== 'admin'
    ) {
      return erro('Apenas administradores podem criar usuários.', 403)
    }

    const body = await req.json()

    const nome = String(body.nome || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const senha = String(body.senha || '').trim()
    const tipoAcesso = String(body.tipo_acesso || 'cliente').trim().toLowerCase()
    const ativo = body.ativo !== false

    if (!nome) return erro('Informe o nome.')
    if (!email) return erro('Informe o e-mail.')
    if (!senha || senha.length < 6) return erro('A senha precisa ter pelo menos 6 caracteres.')

    if (!['admin', 'cliente'].includes(tipoAcesso)) {
      return erro('Tipo de acesso inválido.')
    }

    const { data: criado, error: erroCriar } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: {
        nome,
        tipo_acesso: tipoAcesso,
      },
    })

    if (erroCriar || !criado.user?.id) {
      return erro(erroCriar?.message || 'Erro ao criar usuário.', 400)
    }

    const userId = criado.user.id

    const { error: erroPerfilNovo } = await supabaseAdmin
      .from('perfis')
      .upsert(
        {
          id: userId,
          nome,
          email,
          tipo_acesso: tipoAcesso,
          ativo,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )

    if (erroPerfilNovo) {
      return erro(
        'Login criado no Auth, mas houve erro ao salvar o perfil: ' + erroPerfilNovo.message,
        500
      )
    }

    return NextResponse.json({
      ok: true,
      usuario: {
        id: userId,
        nome,
        email,
        tipo_acesso: tipoAcesso,
        ativo,
      },
    })
  } catch (error: any) {
    return erro(error?.message || 'Erro inesperado ao criar usuário.', 500)
  }
}
