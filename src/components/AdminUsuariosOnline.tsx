'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type UsuarioOnline = {
  user_id: string
  nome: string | null
  email: string | null
  tipo_acesso: string | null
  area: string | null
  pagina_atual: string | null
  ultima_atividade: string | null
}

const LIMITE_ONLINE_MS = 2 * 60 * 1000

function tempoRelativo(data: string | null) {
  if (!data) return 'sem registro'

  const diff = Date.now() - new Date(data).getTime()
  const segundos = Math.max(0, Math.floor(diff / 1000))

  if (segundos < 60) return `ativo há ${segundos}s`

  const minutos = Math.floor(segundos / 60)
  return `ativo há ${minutos}min`
}

function nomePagina(pathname: string | null) {
  if (!pathname) return 'Portal'

  const mapa: Record<string, string> = {
    '/admin': 'Dashboard admin',
    '/admin/financeiro': 'Financeiro',
    '/admin/embarques': 'Embarques',
    '/admin/cotacoes': 'Cotações',
    '/admin/faturas': 'Faturas clientes',
    '/admin/faturas-transportadoras': 'Faturas DHL/FedEx',
    '/admin/suporte': 'Suporte admin',
    '/admin/intelligence': 'Intelligence',
    '/admin/usuarios': 'Usuários',
    '/cliente': 'Portal cliente',
    '/cliente/embarques': 'Meus embarques',
    '/cliente/faturas': 'Minhas faturas',
    '/cliente/cotacoes': 'Solicitar cotação',
    '/cliente/minhas-cotacoes': 'Minhas cotações',
    '/cliente/recebimentos': 'Recebimentos',
    '/cliente/suporte': 'Suporte cliente',
  }

  return mapa[pathname] || pathname
}

function labelTipo(usuario: UsuarioOnline) {
  const tipo = String(usuario.tipo_acesso || usuario.area || '').toLowerCase()

  if (tipo.includes('admin')) return 'Admin'
  if (tipo.includes('cliente')) return 'Cliente'

  return tipo || '-'
}

export default function AdminUsuariosOnline() {
  const [usuarios, setUsuarios] = useState<UsuarioOnline[]>([])
  const [loading, setLoading] = useState(true)
  const [aberto, setAberto] = useState(false)
  const [agora, setAgora] = useState(Date.now())

  async function carregarOnline() {
    const { data, error } = await supabase
      .from('usuarios_online')
      .select('*')
      .order('ultima_atividade', { ascending: false })

    if (error) {
      console.error('Erro ao carregar usuários online:', error.message)
      setLoading(false)
      return
    }

    setUsuarios((data || []) as UsuarioOnline[])
    setLoading(false)
  }

  useEffect(() => {
    carregarOnline()

    const intervaloBusca = setInterval(() => {
      carregarOnline()
    }, 15000)

    const intervaloTempo = setInterval(() => {
      setAgora(Date.now())
    }, 1000)

    const canal = supabase
      .channel('usuarios-online-admin')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'usuarios_online',
        },
        () => {
          carregarOnline()
        }
      )
      .subscribe()

    return () => {
      clearInterval(intervaloBusca)
      clearInterval(intervaloTempo)
      supabase.removeChannel(canal)
    }
  }, [])

  const onlineAgora = useMemo(() => {
    const limite = agora - LIMITE_ONLINE_MS

    return usuarios.filter((item) => {
      if (!item.ultima_atividade) return false
      return new Date(item.ultima_atividade).getTime() >= limite
    })
  }, [usuarios, agora])

  const adminsOnline = onlineAgora.filter((item) =>
    String(item.tipo_acesso || item.area || '').toLowerCase().includes('admin')
  ).length

  const clientesOnline = onlineAgora.filter((item) =>
    String(item.tipo_acesso || item.area || '').toLowerCase().includes('cliente')
  ).length

  return (
    <div
      className="relative z-50 mb-4 flex justify-end"
      onMouseEnter={() => setAberto(true)}
      onMouseLeave={() => setAberto(false)}
    >
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        className="flex items-center gap-3 rounded-2xl border border-blue-800 bg-[#071225] px-4 py-3 text-left text-white shadow-[0_0_24px_rgba(37,99,235,0.20)] transition hover:border-cyan-400 hover:bg-[#0b1b35]"
      >
        <span className="flex h-3 w-3 rounded-full bg-green-400 shadow-[0_0_12px_rgba(74,222,128,0.95)]" />

        <span>
          <span className="block text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
            Online agora
          </span>
          <span className="block text-lg font-black">
            {loading ? '...' : onlineAgora.length} online
          </span>
        </span>

        <span className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white">
          Ver
        </span>
      </button>

      {aberto && (
        <div className="absolute right-0 top-full mt-3 w-[620px] max-w-[92vw] rounded-3xl border border-blue-800 bg-[#071225] p-4 text-white shadow-2xl">
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-blue-900 pb-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
                Presença em tempo real
              </p>
              <h3 className="text-xl font-black">Usuários online agora</h3>
              <p className="mt-1 text-xs text-slate-400">
                Atividade registrada nos últimos 2 minutos.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl border border-blue-800 bg-[#020817] px-3 py-2">
                <p className="font-bold text-slate-400">Total</p>
                <p className="text-lg font-black text-white">{onlineAgora.length}</p>
              </div>

              <div className="rounded-xl border border-blue-800 bg-[#020817] px-3 py-2">
                <p className="font-bold text-slate-400">Admins</p>
                <p className="text-lg font-black text-cyan-300">{adminsOnline}</p>
              </div>

              <div className="rounded-xl border border-blue-800 bg-[#020817] px-3 py-2">
                <p className="font-bold text-slate-400">Clientes</p>
                <p className="text-lg font-black text-green-300">{clientesOnline}</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-blue-900 bg-[#020817] p-4 text-sm text-slate-400">
              Carregando presença online...
            </div>
          ) : onlineAgora.length === 0 ? (
            <div className="rounded-2xl border border-blue-900 bg-[#020817] p-4 text-sm text-slate-400">
              Nenhum usuário online agora.
            </div>
          ) : (
            <div className="max-h-[360px] space-y-3 overflow-auto pr-1">
              {onlineAgora.map((usuario) => (
                <div
                  key={usuario.user_id}
                  className="rounded-2xl border border-blue-900 bg-[#020817] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-white">
                        {usuario.nome || usuario.email || 'Usuário'}
                      </p>
                      <p className="text-xs text-slate-500">{usuario.email || '-'}</p>
                    </div>

                    <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-black uppercase text-green-300">
                      online
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 text-xs md:grid-cols-3">
                    <div className="rounded-xl bg-[#071225] p-2">
                      <p className="font-bold text-slate-500">Tipo</p>
                      <p className="font-black text-slate-100">{labelTipo(usuario)}</p>
                    </div>

                    <div className="rounded-xl bg-[#071225] p-2">
                      <p className="font-bold text-slate-500">Atividade</p>
                      <p className="font-black text-slate-100">
                        {tempoRelativo(usuario.ultima_atividade)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-[#071225] p-2">
                      <p className="font-bold text-slate-500">Página atual</p>
                      <p className="font-black text-blue-300">
                        {nomePagina(usuario.pagina_atual)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="mt-3 text-right text-[11px] text-slate-500">
            Passe o mouse para manter aberto ou clique no resumo para fixar temporariamente.
          </p>
        </div>
      )}
    </div>
  )
}
