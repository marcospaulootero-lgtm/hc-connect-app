'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [carregando, setCarregando] = useState(true)
  const [usuario, setUsuario] = useState<any>(null)

  useEffect(() => {
    verificarAcesso()
  }, [])

  async function verificarAcesso() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { data: perfil } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!perfil || perfil.tipo_acesso !== 'admin') {
      await supabase.auth.signOut()
      router.push('/login')
      return
    }

    setUsuario({
      nome: perfil.nome || user.email,
      email: user.email,
      tipo: perfil.tipo_acesso,
    })

    setCarregando(false)
  }

  async function sair() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (carregando) {
    return (
      <main className="min-h-screen bg-[#020817] text-white flex items-center justify-center">
        Verificando acesso...
      </main>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(135deg, #020617 0%, #00113a 45%, #000814 100%)',
        color: 'white',
      }}
    >
      <main
        style={{
          width: '100%',
          maxWidth: '1800px',
          margin: '0 auto',
          padding: 30,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            marginBottom: 30,
            gap: 18,
          }}
        >
          <div className="text-right">
            <p className="font-bold">{usuario?.nome}</p>
            <p className="text-slate-400 text-sm">{usuario?.email}</p>
          </div>

          <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase">
            ADMIN
          </span>

          <button
            onClick={sair}
            style={{
              background: '#2563eb',
              border: 'none',
              color: 'white',
              padding: '12px 20px',
              borderRadius: 12,
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Sair
          </button>
        </div>

        {children}
      </main>
    </div>
  )
}