'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
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
        <div className="mb-8">
          <h1 className="text-3xl font-black">HC Connect</h1>
          <p className="text-slate-500 mt-1">Painel Administrativo</p>
        </div>

        <nav className="space-y-6 overflow-y-auto pr-1">
          <MenuGroup titulo="Visão geral">
            <MenuItem
              href="/admin"
              label="Dashboard"
              descricao="Operação do dia"
              icon="📊"
              pathname={pathname}
            />
            <MenuItem
              href="/admin/intelligence"
              label="Alertas"
              descricao="O que precisa de ação"
              icon="🚨"
              pathname={pathname}
            />
          </MenuGroup>

          <MenuGroup titulo="Operação">
            <MenuItem
              href="/admin/embarques"
              label="Embarques"
              descricao="Processos e rastreios"
              icon="📦"
              pathname={pathname}
            />
            <MenuItem
              href="/admin/embarque-direto"
              label="Embarque Direto"
              descricao="Criar operação rápida"
              icon="🚚"
              pathname={pathname}
            />
            <MenuItem
              href="/admin/cotacoes"
              label="Cotações"
              descricao="Pedidos e aprovações"
              icon="📄"
              pathname={pathname}
            />
            <MenuItem
              href="/admin/faturas"
              label="Faturas"
              descricao="PDFs e recibos"
              icon="🧾"
              pathname={pathname}
            />
          </MenuGroup>

          <MenuGroup titulo="Dinheiro">
            <MenuItem
              href="/admin/financeiro"
              label="Financeiro"
              descricao="Painel do dono"
              icon="💰"
              pathname={pathname}
              destaque
            />
            <MenuItem
              href="/admin/parceiros"
              label="Terceiros / Parceiros"
              descricao="Valores protegidos"
              icon="🔒"
              pathname={pathname}
            />
          </MenuGroup>

          <MenuGroup titulo="Administração">
            <MenuItem
              href="/admin/usuarios"
              label="Usuários"
              descricao="Acessos e clientes"
              icon="👥"
              pathname={pathname}
            />
            <MenuItem
              href="/admin/suporte"
              label="Suporte"
              descricao="Chamados dos clientes"
              icon="🎧"
              pathname={pathname}
            />
          </MenuGroup>
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

function MenuGroup({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-600 font-black mb-3 px-2">
        {titulo}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function MenuItem({
  href,
  label,
  descricao,
  icon,
  pathname,
  destaque = false,
}: {
  href: string
  label: string
  descricao?: string
  icon: string
  pathname: string | null
  destaque?: boolean
}) {
  const ativo = pathname === href || (href !== '/admin' && pathname?.startsWith(href))

  return (
    <Link
      href={href}
      className={
        ativo
          ? 'flex items-center gap-3 px-4 py-3 rounded-2xl font-bold bg-blue-600 text-white shadow-[0_0_25px_rgba(37,99,235,0.35)] transition'
          : destaque
            ? 'flex items-center gap-3 px-4 py-3 rounded-2xl font-bold bg-emerald-600/15 border border-emerald-700/60 text-emerald-100 hover:bg-emerald-600/25 hover:text-white transition'
            : 'flex items-center gap-3 px-4 py-3 rounded-2xl font-bold bg-[#071225] hover:bg-blue-600 text-slate-300 hover:text-white transition'
      }
    >
      <span className="text-xl">{icon}</span>

      <span className="min-w-0">
        <span className="block leading-tight">{label}</span>
        {descricao ? (
          <span
            className={
              ativo
                ? 'block text-xs text-blue-100 font-medium mt-1 truncate'
                : 'block text-xs text-slate-500 font-medium mt-1 truncate'
            }
          >
            {descricao}
          </span>
        ) : null}
      </span>
    </Link>
  )
}
