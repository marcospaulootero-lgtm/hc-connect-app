'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
    <div className="min-h-screen bg-[#020817] text-white flex">
      <aside className="w-72 min-h-screen bg-[#050d1f] border-r border-blue-950 p-6 hidden xl:flex flex-col fixed left-0 top-0 bottom-0">
        <div className="mb-10">
          <h1 className="text-3xl font-black">HC Connect</h1>
          <p className="text-slate-500 mt-1">Painel Administrativo</p>
        </div>

        <nav className="space-y-3 overflow-y-auto pr-1">
          <MenuItem href="/admin" label="Dashboard" icon="📊" />
          <MenuItem href="/admin/embarques" label="Embarques" icon="📦" />
          <MenuItem href="/admin/embarque-direto" label="Embarque Direto" icon="🚚" />
          <MenuItem href="/admin/cotacoes" label="Cotações" icon="📄" />
          <MenuItem href="/admin/faturas" label="Faturas" icon="🧾" />
          <MenuItem href="/admin/financeiro" label="Financeiro" icon="💰" />
          <MenuItem href="/admin/resultado-financeiro" label="Resultado Financeiro" icon="📈" />
          <MenuItem href="/admin/intelligence" label="Intelligence" icon="🧠" />
          <MenuItem href="/admin/usuarios" label="Usuários" icon="👥" />
          <MenuItem href="/admin/suporte" label="Suporte" icon="🎧" />
        </nav>

        <div className="mt-auto border border-blue-900 rounded-3xl p-5 bg-[#071225]">
          <p className="text-slate-400 text-sm">Logado como</p>
          <p className="font-bold mt-1 truncate">{usuario?.nome}</p>
          <p className="text-slate-500 text-sm truncate">{usuario?.email}</p>

          <button
            onClick={sair}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-500 px-4 py-3 rounded-xl font-bold"
          >
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 xl:ml-72 p-8">{children}</main>
    </div>
  )
}

function MenuItem({ href, label, icon }: any) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl font-bold bg-[#071225] hover:bg-blue-600 text-slate-300 hover:text-white transition"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </Link>
  )
}