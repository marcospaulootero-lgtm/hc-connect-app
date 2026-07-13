'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    async function direcionar() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user?.id) {
        router.replace('/login')
        return
      }

      const { data: perfil } = await supabase
        .from('perfis')
        .select('tipo_acesso, ativo')
        .eq('id', user.id)
        .maybeSingle()

      if (!perfil || perfil.ativo === false) {
        await supabase.auth.signOut()
        router.replace('/login')
        return
      }

      const tipo = String(perfil.tipo_acesso || '').toLowerCase()

      if (tipo === 'admin') {
        router.replace('/admin')
      } else {
        router.replace('/cliente')
      }
    }

    direcionar()
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020817] px-6 text-white">
      <div className="rounded-3xl border border-blue-900 bg-[#071225] p-8 text-center shadow-2xl">
        <p className="text-sm font-black uppercase tracking-[0.35em] text-blue-400">
          HC Connect
        </p>
        <h1 className="mt-3 text-2xl font-black">Verificando acesso...</h1>
        <p className="mt-2 text-sm text-slate-400">
          Esta área exige login autorizado.
        </p>
      </div>
    </div>
  )
}
