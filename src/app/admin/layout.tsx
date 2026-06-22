'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const [carregando, setCarregando] = useState(true)
  const [usuario, setUsuario] = useState<any>(null)
  const [menuMobileAberto, setMenuMobileAberto] = useState(false)
  const [menuDesktopAberto, setMenuDesktopAberto] = useState(false)

  useEffect(() => {
    verificarAcesso()
  }, [])

  useEffect(() => {
    setMenuMobileAberto(false)
  }, [pathname])

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
    <div className="min-h-screen bg-[#020817] text-white">
      {/* Botão flutuante mobile/tablet */}
      <button
        type="button"
        onClick={() => setMenuMobileAberto(true)}
        className="xl:hidden fixed left-0 top-24 z-40 bg-blue-600 hover:bg-blue-500 text-white rounded-r-2xl px-3 py-5 font-black shadow-[0_0_25px_rgba(37,99,235,0.45)]"
        aria-label="Abrir menu"
      >
        ›
      </button>

      {/* Topo mobile/tablet */}
      <header className="xl:hidden fixed top-0 left-0 right-0 z-30 h-20 bg-[#050d1f] border-b border-blue-950 px-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black leading-tight">HC Connect</h1>
          <p className="text-slate-500 text-xs">Painel Administrativo</p>
        </div>

        <button
          type="button"
          onClick={() => setMenuMobileAberto(true)}
          className="bg-[#071225] border border-blue-900 hover:bg-blue-600 px-4 py-3 rounded-2xl font-black"
        >
          Menu
        </button>
      </header>

      {/* Overlay mobile/tablet */}
      {menuMobileAberto ? (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMenuMobileAberto(false)}
          className="xl:hidden fixed inset-0 bg-black/70 z-50"
        />
      ) : null}

      {/* Menu mobile/tablet */}
      <aside
        className={`xl:hidden fixed top-0 left-0 bottom-0 z-[60] w-[86%] max-w-[360px] bg-[#050d1f] border-r border-blue-950 p-5 flex flex-col transition-transform duration-300 ${
          menuMobileAberto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">HC Connect</h1>
            <p className="text-slate-500 mt-1">Painel Administrativo</p>
          </div>

          <button
            type="button"
            onClick={() => setMenuMobileAberto(false)}
            className="bg-[#071225] border border-blue-900 px-3 py-2 rounded-xl font-black"
          >
            ✕
          </button>
        </div>

        <MenuContent pathname={pathname} compacto={false} />

        <UserBox usuario={usuario} sair={sair} compacto={false} />
      </aside>

      {/* Menu desktop recolhível */}
      <aside
        className={`hidden xl:flex min-h-screen bg-[#050d1f] border-r border-blue-950 flex-col fixed left-0 top-0 bottom-0 transition-all duration-300 ${
          menuDesktopAberto ? 'w-72 p-6' : 'w-20 p-4'
        }`}
      >
        <button
          type="button"
          onClick={() => setMenuDesktopAberto((valor) => !valor)}
          className="absolute -right-4 top-24 z-20 w-8 h-16 rounded-r-2xl bg-blue-600 hover:bg-blue-500 border border-blue-400/40 text-white font-black shadow-[0_0_25px_rgba(37,99,235,0.45)]"
          title={menuDesktopAberto ? 'Recolher menu' : 'Abrir menu'}
          aria-label={menuDesktopAberto ? 'Recolher menu' : 'Abrir menu'}
        >
          {menuDesktopAberto ? '‹' : '›'}
        </button>

        <div className={menuDesktopAberto ? 'mb-8' : 'mb-8 text-center'}>
          {menuDesktopAberto ? (
            <>
              <h1 className="text-3xl font-black">HC Connect</h1>
              <p className="text-slate-500 mt-1">Painel Administrativo</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-black">HC</h1>
              <p className="text-slate-600 text-[10px] mt-1">Admin</p>
            </>
          )}
        </div>

        <MenuContent pathname={pathname} compacto={!menuDesktopAberto} />

        <UserBox usuario={usuario} sair={sair} compacto={!menuDesktopAberto} />
      </aside>

      <main
        className={`min-h-screen pt-24 xl:pt-8 px-4 sm:px-6 xl:px-8 transition-all duration-300 ${
          menuDesktopAberto ? 'xl:ml-72' : 'xl:ml-20'
        }`}
      >
        {children}
      </main>
    </div>
  )
}

function MenuContent({
  pathname,
  compacto,
}: {
  pathname: string | null
  compacto: boolean
}) {
  return (
    <nav className="space-y-6 overflow-y-auto pr-1 pb-6">
      <MenuGroup titulo="Visão geral" compacto={compacto}>
        <MenuItem
          href="/admin"
          label="Dashboard"
          descricao="Operação do dia"
          icon="📊"
          pathname={pathname}
          compacto={compacto}
        />
        <MenuItem
          href="/admin/intelligence"
          label="Alertas"
          descricao="O que precisa de ação"
          icon="🚨"
          pathname={pathname}
          compacto={compacto}
        />
      </MenuGroup>

      <MenuGroup titulo="Operação" compacto={compacto}>
        <MenuItem
          href="/admin/embarques"
          label="Embarques"
          descricao="Processos e rastreios"
          icon="📦"
          pathname={pathname}
          compacto={compacto}
        />
        <MenuItem
          href="/admin/embarque-direto"
          label="Embarque Direto"
          descricao="Criar operação rápida"
          icon="🚚"
          pathname={pathname}
          compacto={compacto}
        />
        <MenuItem
          href="/admin/cotacoes"
          label="Cotações"
          descricao="Pedidos e aprovações"
          icon="📄"
          pathname={pathname}
          compacto={compacto}
        />
        <MenuItem
          href="/admin/faturas"
          label="Faturas"
          descricao="PDFs e recibos"
          icon="🧾"
          pathname={pathname}
          compacto={compacto}
        />
      </MenuGroup>

      <MenuGroup titulo="Dinheiro" compacto={compacto}>
        <MenuItem
          href="/admin/financeiro"
          label="Financeiro"
          descricao="Painel do dono"
          icon="💰"
          pathname={pathname}
          compacto={compacto}
          destaque
        />
        <MenuItem
          href="/admin/parceiros"
          label="Terceiros / Parceiros"
          descricao="Valores protegidos"
          icon="🔒"
          pathname={pathname}
          compacto={compacto}
        />
      </MenuGroup>

      <MenuGroup titulo="Administração" compacto={compacto}>
        <MenuItem
          href="/admin/usuarios"
          label="Usuários"
          descricao="Acessos e clientes"
          icon="👥"
          pathname={pathname}
          compacto={compacto}
        />
        <MenuItem
          href="/admin/suporte"
          label="Suporte"
          descricao="Chamados dos clientes"
          icon="🎧"
          pathname={pathname}
          compacto={compacto}
        />
      </MenuGroup>
    </nav>
  )
}

function UserBox({
  usuario,
  sair,
  compacto,
}: {
  usuario: any
  sair: () => void
  compacto: boolean
}) {
  if (compacto) {
    return (
      <div className="mt-auto">
        <button
          onClick={sair}
          className="w-full bg-blue-600 hover:bg-blue-500 px-3 py-3 rounded-2xl font-bold"
          title={`Sair - ${usuario?.nome || ''}`}
        >
          ⏻
        </button>
      </div>
    )
  }

  return (
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
  )
}

function MenuGroup({
  titulo,
  children,
  compacto,
}: {
  titulo: string
  children: ReactNode
  compacto: boolean
}) {
  return (
    <div>
      {compacto ? (
        <div className="h-px bg-blue-950 my-3" />
      ) : (
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-600 font-black mb-3 px-2">
          {titulo}
        </p>
      )}
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
  compacto,
  destaque = false,
}: {
  href: string
  label: string
  descricao?: string
  icon: string
  pathname: string | null
  compacto: boolean
  destaque?: boolean
}) {
  const ativo = pathname === href || (href !== '/admin' && pathname?.startsWith(href))

  const baseCompacto =
    'flex items-center justify-center h-12 rounded-2xl font-bold transition text-xl'

  const baseAberto =
    'flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition'

  const cor =
    ativo
      ? 'bg-blue-600 text-white shadow-[0_0_25px_rgba(37,99,235,0.35)]'
      : destaque
        ? 'bg-emerald-600/15 border border-emerald-700/60 text-emerald-100 hover:bg-emerald-600/25 hover:text-white'
        : 'bg-[#071225] hover:bg-blue-600 text-slate-300 hover:text-white'

  return (
    <Link
      href={href}
      title={compacto ? label : undefined}
      className={`${compacto ? baseCompacto : baseAberto} ${cor}`}
    >
      <span className="text-xl">{icon}</span>

      {!compacto ? (
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
      ) : null}
    </Link>
  )
}
