// HC_AUTH_SERVIDOR_V1 - fetch do navegador que envia o token da sessão Supabase.
import { supabase } from '@/lib/supabaseClient'

export async function fetchAutenticado(input: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(init.headers || {})
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
  return fetch(input, { ...init, headers })
}
