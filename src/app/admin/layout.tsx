'use client'

import Link from 'next/link'
import AdminFloatingNotes from '@/components/AdminFloatingNotes'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import OnlinePresence from '@/components/OnlinePresence'


const STATUS_COTACOES_BADGE = [
  'AGUARDANDO ANÁLISE',
  'AGUARDANDO ANALISE',
  'NOVA',
  'NOVO',
  'PENDENTE',
  'EM ANÁLISE',
  'EM ANALISE',
  'AGUARDANDO TRANSPORTADORA',
]

type NotificacoesMenu = {
  cotacoes: number
  embarques: number
  embarqueDireto: number
  faturasClientes: number
  faturasTransportadoras: number
  usuarios: number
}

const NOTIFICACOES_MENU_ZERADAS: NotificacoesMenu = {
  cotacoes: 0,
  embarques: 0,
  embarqueDireto: 0,
  faturasClientes: 0,
  faturasTransportadoras: 0,
  usuarios: 0,
}

const STORAGE_ULTIMA_VISUALIZACAO_USUARIOS =
  'hc_admin_ultima_visualizacao_usuarios_v1'

function normalizarTextoMenu(valor: any) {
  return String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function normalizarDataMenu(valor: any) {
  if (!valor) return null

  if (valor instanceof Date && !isNaN(valor.getTime())) {
    return valor.toISOString().slice(0, 10)
  }

  const texto = String(valor).trim()
  if (!texto) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10)

  const partes = texto.split('/')
  if (partes.length === 3) {
    const [dia, mes, ano] = partes
    const anoFinal = ano.length === 2 ? `20${ano}` : ano
    return `${anoFinal.padStart(4, '20')}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
  }

  const tentativa = new Date(texto)
  if (!isNaN(tentativa.getTime())) return tentativa.toISOString().slice(0, 10)

  return null
}

function hojeIsoMenu() {
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function campoFaturaTransportadoraMenu(item: any, nomes: string[]) {
  for (const nome of nomes) {
    const valor = item?.[nome]
    if (valor !== undefined && valor !== null && valor !== '') return valor
  }

  return ''
}

function faturaTransportadoraUrgenteMenu(item: any) {
  const transportadora = normalizarTextoMenu(
    campoFaturaTransportadoraMenu(item, ['transportadora', 'empresa', 'carrier'])
  )

  if (
    !transportadora.includes('DHL') &&
    !transportadora.includes('FEDEX') &&
    !transportadora.includes('FED EX')
  ) {
    return false
  }

  const flagArquivada = campoFaturaTransportadoraMenu(item, [
    'arquivada',
    'arquivado',
    'oculta',
    'oculto',
  ])

  if (
    flagArquivada === true ||
    ['TRUE', 'SIM', '1'].includes(normalizarTextoMenu(flagArquivada))
  ) {
    return false
  }

  const situacao = normalizarTextoMenu(
    campoFaturaTransportadoraMenu(item, ['situacao', 'situação', 'status'])
  )

  const pagamento = normalizarDataMenu(
    campoFaturaTransportadoraMenu(item, [
      'data_pagamento',
      'pagamento',
      'data_pago',
      'pago_em',
    ])
  )

  if (pagamento) return false
  if (
    situacao.includes('PAGO') ||
    situacao.includes('PAGA') ||
    situacao.includes('BAIXADO') ||
    situacao.includes('CANCEL') ||
    situacao.includes('CONTEST')
  ) {
    return false
  }

  const vencimento = normalizarDataMenu(
    campoFaturaTransportadoraMenu(item, [
      'vencimento',
      'data_vencimento',
      'vencimento_fatura',
      'data_vencimento_fatura',
    ])
  )

  return !!vencimento && vencimento <= hojeIsoMenu()
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const [carregando, setCarregando] = useState(true)
  const [usuario, setUsuario] = useState<any>(null)
  const [menuMobileAberto, setMenuMobileAberto] = useState(false)
  const [notificacoesMenu, setNotificacoesMenu] =
    useState<NotificacoesMenu>(NOTIFICACOES_MENU_ZERADAS)

  useEffect(() => {
    verificarAcesso()
  }, [])

  useEffect(() => {
    setMenuMobileAberto(false)

    if (pathname?.startsWith('/admin/usuarios')) {
      window.localStorage.setItem(
        STORAGE_ULTIMA_VISUALIZACAO_USUARIOS,
        new Date().toISOString()
      )
      setNotificacoesMenu((atual) => ({ ...atual, usuarios: 0 }))
    }
  }, [pathname])

  useEffect(() => {
    carregarNotificacoesMenu()

    const atualizar = () => carregarNotificacoesMenu()

    const canal = supabase
      .channel('notificacoes-menu-admin-v2')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cotacoes' },
        atualizar
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'embarque_direto' },
        atualizar
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'faturas' },
        atualizar
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'financeiro_embarques' },
        atualizar
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'faturas_transportadoras' },
        atualizar
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'perfis' },
        atualizar
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'solicitacoes_acesso_embarque' },
        atualizar
      )
      .subscribe()

    const intervalo = window.setInterval(atualizar, 60000)

    return () => {
      window.clearInterval(intervalo)
      supabase.removeChannel(canal)
    }
  }, [])

  async function verificarAcesso() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.replace('/')
      return
    }

    const { data: perfil } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!perfil || perfil.tipo_acesso !== 'admin') {
      await supabase.auth.signOut()
      router.push('/')
      return
    }

    setUsuario({
      nome: perfil.nome || user.email,
      email: user.email,
    })

    setCarregando(false)
  }

  async function carregarNotificacoesMenu() {
    try {
      const [
        cotacoesRes,
        solicitacoesAcessoRes,
        embarquesDiretosRes,
        perfisRes,
        financeiroRes,
        faturasClientesRes,
        faturasTransportadorasRes,
      ] = await Promise.all([
        supabase
          .from('cotacoes')
          .select('id', { count: 'exact', head: true })
          .in('status', STATUS_COTACOES_BADGE),
        supabase
          .from('solicitacoes_acesso_embarque')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'PENDENTE'),
        supabase
          .from('embarque_direto')
          .select('id, status, embarque_id, arquivado_admin'),
        supabase
          .from('perfis')
          .select('id, criado_em'),
        supabase
          .from('financeiro_embarques')
          .select('id, embarque_id, awb, vencimento_cobranca, recebimento'),
        supabase
          .from('faturas')
          .select(
            'id, embarque_id, comprovante_pagamento, data_comprovante, status_pagamento, arquivado_admin'
          ),
        supabase.from('faturas_transportadoras').select('*'),
      ])

      if (cotacoesRes.error) {
        console.error('Erro no badge de cotações:', cotacoesRes.error.message)
      }
      if (embarquesDiretosRes.error) {
        console.error(
          'Erro no badge de embarque direto:',
          embarquesDiretosRes.error.message
        )
      }
      if (perfisRes.error) {
        console.error('Erro no badge de usuários:', perfisRes.error.message)
      }
      if (financeiroRes.error) {
        console.error(
          'Erro no badge de faturas de clientes:',
          financeiroRes.error.message
        )
      }
      if (faturasClientesRes.error) {
        console.error(
          'Erro no badge de comprovantes:',
          faturasClientesRes.error.message
        )
      }
      if (faturasTransportadorasRes.error) {
        console.error(
          'Erro no badge de faturas DHL/FedEx:',
          faturasTransportadorasRes.error.message
        )
      }

      const embarquesDiretosPendentes = (embarquesDiretosRes.data || []).filter(
        (item: any) => {
          const status = normalizarTextoMenu(item.status)

          if (item.arquivado_admin === true) return false
          if (item.embarque_id) return false
          if (
            status.includes('CONVERTID') ||
            status.includes('RECUSAD') ||
            status.includes('CANCELAD') ||
            status.includes('EXCLUID')
          ) {
            return false
          }

          return true
        }
      ).length

      const hoje = hojeIsoMenu()
      const financeiro = financeiroRes.data || []
      const recebidosPorEmbarque = new Set(
        financeiro
          .filter((item: any) => !!item.recebimento && !!item.embarque_id)
          .map((item: any) => String(item.embarque_id))
      )

      const alertasFaturasClientes = new Set<string>()

      financeiro.forEach((item: any) => {
        const vencimento = normalizarDataMenu(item.vencimento_cobranca)
        if (!vencimento || vencimento >= hoje || item.recebimento) return

        alertasFaturasClientes.add(
          String(item.embarque_id || item.awb || item.id)
        )
      })

      ;(faturasClientesRes.data || []).forEach((fatura: any) => {
        if (fatura.arquivado_admin === true) return
        if (!fatura.comprovante_pagamento) return

        const status = normalizarTextoMenu(
          fatura.status_pagamento || 'COMPROVANTE ENVIADO'
        )

        if (
          status === 'PAGO' ||
          status === 'COMPROVANTE REJEITADO' ||
          (fatura.embarque_id &&
            recebidosPorEmbarque.has(String(fatura.embarque_id)))
        ) {
          return
        }

        alertasFaturasClientes.add(
          String(fatura.embarque_id || `fatura:${fatura.id}`)
        )
      })

      const faturasTransportadorasUrgentes = (
        faturasTransportadorasRes.data || []
      ).filter(faturaTransportadoraUrgenteMenu).length

      let usuariosNovos = 0

      if (typeof window !== 'undefined') {
        let ultimaVisualizacao = window.localStorage.getItem(
          STORAGE_ULTIMA_VISUALIZACAO_USUARIOS
        )

        if (!ultimaVisualizacao) {
          ultimaVisualizacao = new Date().toISOString()
          window.localStorage.setItem(
            STORAGE_ULTIMA_VISUALIZACAO_USUARIOS,
            ultimaVisualizacao
          )
        }

        const limite = new Date(ultimaVisualizacao).getTime()

        usuariosNovos = (perfisRes.data || []).filter((perfil: any) => {
          if (!perfil.criado_em) return false
          const criadoEm = new Date(perfil.criado_em).getTime()
          return !isNaN(criadoEm) && criadoEm > limite
        }).length

        if (window.location.pathname.startsWith('/admin/usuarios')) {
          window.localStorage.setItem(
            STORAGE_ULTIMA_VISUALIZACAO_USUARIOS,
            new Date().toISOString()
          )
          usuariosNovos = 0
        }
      }

      setNotificacoesMenu({
        cotacoes: cotacoesRes.count || 0,
        embarques: solicitacoesAcessoRes.count || 0,
        embarqueDireto: embarquesDiretosPendentes,
        faturasClientes: alertasFaturasClientes.size,
        faturasTransportadoras: faturasTransportadorasUrgentes,
        usuarios: usuariosNovos,
      })
    } catch (error) {
      console.error('Erro ao carregar notificações do menu:', error)
    }
  }

  async function sair() {
    await supabase.auth.signOut()
    router.push('/')
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
      {/* Topo mobile/tablet */}
      <header className="xl:hidden fixed top-0 left-0 right-0 z-40 h-16 bg-[#050d1f]/95 backdrop-blur border-b border-blue-950 px-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black leading-tight">HC Connect</h1>
          <p className="text-slate-500 text-xs">Painel Administrativo</p>
        </div>

        <button
          type="button"
          onClick={() => setMenuMobileAberto(true)}
          className="bg-blue-600 hover:bg-blue-500 px-4 py-3 rounded-2xl font-black shadow-lg"
        >
          ☰ Menu
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
        className={`xl:hidden fixed top-0 left-0 bottom-0 z-[60] w-[88%] max-w-[330px] bg-[#050d1f] border-r border-blue-950 p-4 flex flex-col transition-transform duration-300 shadow-2xl ${
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

        <MenuContent pathname={pathname} notificacoes={notificacoesMenu} />

        <UserBox usuario={usuario} sair={sair} />
      </aside>

      {/* Menu desktop fixo */}
      <aside className="hidden xl:flex w-72 min-h-screen bg-[#050d1f] border-r border-blue-950 p-6 flex-col fixed left-0 top-0 bottom-0">
        <div className="mb-8">
          <h1 className="text-3xl font-black">HC Connect</h1>
          <p className="text-slate-500 mt-1">Painel Administrativo</p>
        </div>

        <MenuContent pathname={pathname} notificacoes={notificacoesMenu} />

        <UserBox usuario={usuario} sair={sair} />
      </aside>

      <main className="min-h-screen overflow-x-hidden pt-20 xl:pt-8 px-3 sm:px-5 xl:px-8 xl:ml-72">
        <OnlinePresence area="admin" />
        {children}
      <AdminFloatingNotes />
      </main>
    </div>
  )
}

function MenuContent({
  pathname,
  notificacoes,
}: {
  pathname: string | null
  notificacoes: NotificacoesMenu
}) {
  return (
    <nav className="space-y-5 overflow-y-auto pr-1 pb-8">
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
<MenuItem
          href="/admin/prospeccao"
          label="Prospecção IA"
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
          badge={Number(notificacoes?.embarques || 0)}
        />
        <MenuItem
          href="/admin/embarque-direto"
          label="Embarque Direto"
          descricao="Criar operação rápida"
          icon="🚚"
          pathname={pathname}
          badge={Number(notificacoes?.embarqueDireto || 0)}
        />
        <MenuItem
          href="/admin/cotacoes"
          label="Cotações"
          descricao="Pedidos e aprovações"
          icon="📄"
          pathname={pathname}
          badge={Number(notificacoes?.cotacoes || 0)}
        />
        <MenuItem
          href="/admin/faturas"
          label="Faturas clientes"
          descricao="PDFs e recibos"
          icon="🧾"
          pathname={pathname}
          badge={Number(notificacoes?.faturasClientes || 0)}
        />
        <MenuItem
          href="/admin/faturas-transportadoras"
          label="Faturas DHL/FedEx"
          descricao="Cobranças das transportadoras"
          icon="🚛"
          pathname={pathname}
          badge={Number(notificacoes?.faturasTransportadoras || 0)}
        />
      </MenuGroup>

      <MenuGroup titulo="Financeiro">
        <MenuItem
          href="/admin/financeiro"
          label="Painel financeiro"
          descricao="Painel do dono"
          icon="💰"
          pathname={pathname}
          destaque
        />

        <MenuItem
          href="/admin/clientes-faturamento"
          label="Clientes Faturamento"
          descricao="Dados fiscais para emissão"
          icon="🏢"
          pathname={pathname}
        />

        <MenuItem
          href="/admin/clientes/performance"
          label="Ranking de Clientes"
          descricao="Ticket médio e faturamento"
          icon="🏆"
          pathname={pathname}
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
          badge={Number(notificacoes?.usuarios || 0)}
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
  )
}

function UserBox({ usuario, sair }: { usuario: any; sair: () => void }) {
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
}: {
  titulo: string
  children: ReactNode
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
  badge = 0,
}: {
  href: string
  label: string
  descricao?: string
  icon: string
  pathname: string | null
  destaque?: boolean
  badge?: number
}) {
  const ativo =
    pathname === href ||
    (href !== '/admin' && !!pathname && pathname.startsWith(`${href}/`))

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
        <span className="block leading-tight"><span className="inline-flex items-center gap-2">
              {label}
              {badge > 0 && (
                <span className="min-w-[22px] rounded-full bg-red-600 px-2 py-0.5 text-center text-[11px] font-black text-white shadow-lg">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </span></span>
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
