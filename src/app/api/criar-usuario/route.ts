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