'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type TipoPermitido = 'admin' | 'cliente'

export default function AuthGate({
  children,
  tipo,
}: {
  children: React.ReactNode
  tipo: TipoPermitido
}) {
  const router = useRouter()
  const [liberado, setLiberado] = useState(false)

  useEffect(() => {
    let ativo = true

    async function verificarAcesso() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!ativo) return

      if (!user?.id) {
        router.replace('/login')
        return
      }

      const { data: perfil, error } = await supabase
        .from('perfis')
        .select('id, email, tipo_acesso, ativo')
        .eq('id', user.id)
        .maybeSingle()

      if (!ativo) return

      if (error || !perfil || perfil.ativo === false) {
        await supabase.auth.signOut()
        router.replace('/login')
        return
      }

      const tipoAcesso = String(perfil.tipo_acesso || '').toLowerCase()

      if (tipo === 'admin' && tipoAcesso !== 'admin') {
        router.replace('/cliente')
        return
      }

      if (tipo === 'cliente' && tipoAcesso === 'admin') {
        router.replace('/admin')
        return
      }

      setLiberado(true)
    }

    verificarAcesso()

    return () => {
      ativo = false
    }
  }, [router, tipo])

  if (!liberado) {
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

  return <>{children}</>
}
