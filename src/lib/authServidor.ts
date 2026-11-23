// HC_AUTH_SERVIDOR_V1 - Autenticação das rotas de API (somente no servidor).
// Uso:
//   const auth = await exigirAdmin(req); if (auth instanceof NextResponse) return auth
//   const auth = await exigirUsuario(req); if (auth instanceof NextResponse) return auth
import { NextResponse } from 'next/server'
import { createClient, type User } from '@supabase/supabase-js'

export type Autenticado = { user: User; tipoAcesso: string }

function clienteSupabase(chave: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url || !chave) throw new Error('Supabase não configurado.')
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } })
}

function tokenDaRequisicao(req: Request) {
  return (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
}

/** Exige usuário logado e ativo (cliente ou admin). */
export async function exigirUsuario(req: Request): Promise<Autenticado | NextResponse> {
  try {
    const token = tokenDaRequisicao(req)
    if (!token) return NextResponse.json({ error: 'Faça login novamente.' }, { status: 401 })

    const auth = clienteSupabase(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
    const { data: { user }, error } = await auth.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

    const admin = clienteSupabase(process.env.SUPABASE_SERVICE_ROLE_KEY || '')
    const { data: perfil } = await admin.from('perfis')
      .select('tipo_acesso, ativo').eq('id', user.id).maybeSingle()
    if (!perfil || perfil.ativo === false) {
      return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 })
    }
    return { user, tipoAcesso: String(perfil.tipo_acesso || '').trim().toLowerCase() }
  } catch (error) {
    console.error('Falha na autenticação:', error)
    return NextResponse.json({ error: 'Erro de autenticação.' }, { status: 500 })
  }
}

/** Exige usuário logado com tipo_acesso = admin. */
export async function exigirAdmin(req: Request): Promise<Autenticado | NextResponse> {
  const auth = await exigirUsuario(req)
  if (auth instanceof NextResponse) return auth
  if (auth.tipoAcesso !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores.' }, { status: 403 })
  }
  return auth
}

/** Chamada do cron da Vercel (Authorization: Bearer CRON_SECRET). */
export function ehCronVercel(req: Request) {
  const segredo = process.env.CRON_SECRET
  return !!segredo && (req.headers.get('authorization') || '') === `Bearer ${segredo}`
}

/** Escapa texto antes de inserir em HTML de e-mail. */
export function escaparHtml(valor: unknown) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
