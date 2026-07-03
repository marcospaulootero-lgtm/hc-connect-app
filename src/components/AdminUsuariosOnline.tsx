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

type HistoricoPresenca = {
  id: string
  usuario_id: string | null
  nome: string | null
  email: string | null
  tipo_acesso: string | null
  area: string | null
  pagina: string | null
  acao: string | null
  status: string | null
  criado_em: string | null
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

function formatarDataHora(data: string | null) {
  if (!data) return '-'

  const d = new Date(data)
  if (Number.isNaN(d.getTime())) return '-'

  return d.toLocaleString('pt-BR')
}

function nomePagina(pathname: string | null) {
  if (!pathname) return 'Portal'

  const mapa: Record<string, string> = {
    '/admin': 'Dashboard admin',
    '/admin/financeiro': 'Financeiro',
    '/admin/embarques': 'Embarques',
    '/admin/capas-processos': 'Capas de Processo',
    '/admin/embarque-direto': 'Embarque Direto',
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

function labelTipo(usuario: { tipo_acesso?: string | null; area?: string | null }) {
  const tipo = String(usuario.tipo_acesso || usuario.area || '').toLowerCase()

  if (tipo.includes('admin')) return 'Admin'
  if (tipo.includes('cliente')) return 'Cliente'

  return tipo || '-'
}

export default function AdminUsuariosOnline() {
  const [usuarios, setUsuarios] = useState<UsuarioOnline[]>([])
  const [historico, setHistorico] = useState<HistoricoPresenca[]>([])
  const [loading, setLoading] = useState(true)
  const [aberto, setAberto] = useState(false)
  const [aba, setAba] = useState<'ONLINE' | 'HISTORICO'>('ONLINE')
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

  async function carregarHistorico() {
    const { data, error } = await supabase
      .from('presenca_historico')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(80)

    if (error) {
      console.error('Erro ao carregar histórico de presença:', error.message)
      return
    }

    setHistorico((data || []) as HistoricoPresenca[])
  }

  useEffect(() => {
    carregarOnline()
    carregarHistorico()

    const intervaloBusca = setInterval(() => {
      carregarOnline()
      carregarHistorico()
    }, 15000)

    const intervaloTempo = setInterval(() => {
      setAgora(Date.now())
    }, 1000)

    const canalOnline = supabase
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

    const canalHistorico = supabase
      .channel('presenca-historico-admin')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'presenca_historico',
        },
        () => {
          carregarHistorico()
        }
      )
      .subscribe()

    return () => {
      clearInterval(intervaloBusca)
      clearInterval(intervaloTempo)
      supabase.removeChannel(canalOnline)
      supabase.removeChannel(canalHistorico)
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
        <div className="absolute right-0 top-full mt-3 w-[680px] max-w-[92vw] rounded-3xl border border-blue-800 bg-[#071225] p-4 text-white shadow-2xl">
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-blue-900 pb-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
                Presença em tempo real
              </p>
              <h3 className="text-xl font-black">
                {aba === 'ONLINE' ? 'Usuários online agora' : 'Histórico de acessos'}
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Online agora e registros de entrada no portal.
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

          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setAba('ONLINE')}
              className={`rounded-xl px-4 py-2 text-xs font-black ${
                aba === 'ONLINE'
                  ? 'bg-blue-600 text-white'
                  : 'border border-blue-900 bg-[#020817] text-slate-300'
              }`}
            >
              Online agora
            </button>

            <button
              type="button"
              onClick={() => setAba('HISTORICO')}
              className={`rounded-xl px-4 py-2 text-xs font-black ${
                aba === 'HISTORICO'
                  ? 'bg-blue-600 text-white'
                  : 'border border-blue-900 bg-[#020817] text-slate-300'
              }`}
            >
              Histórico
            </button>
          </div>

          {aba === 'ONLINE' ? (
            loading ? (
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
                      <InfoMini label="Tipo" value={labelTipo(usuario)} />
                      <InfoMini label="Atividade" value={tempoRelativo(usuario.ultima_atividade)} />
                      <InfoMini label="Página atual" value={nomePagina(usuario.pagina_atual)} destaque />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="max-h-[420px] space-y-3 overflow-auto pr-1">
              {historico.length === 0 ? (
                <div className="rounded-2xl border border-blue-900 bg-[#020817] p-4 text-sm text-slate-400">
                  Nenhum histórico registrado ainda.
                </div>
              ) : (
                historico.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-blue-900 bg-[#020817] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-white">
                          {item.nome || item.email || 'Usuário'}
                        </p>
                        <p className="text-xs text-slate-500">{item.email || '-'}</p>
                      </div>

                      <span className="rounded-full bg-blue-600/20 px-3 py-1 text-xs font-black uppercase text-blue-200">
                        {item.acao || 'ENTROU'}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 text-xs md:grid-cols-4">
                      <InfoMini label="Tipo" value={labelTipo(item)} />
                      <InfoMini label="Área" value={item.area || '-'} />
                      <InfoMini label="Página" value={nomePagina(item.pagina)} destaque />
                      <InfoMini label="Entrada" value={formatarDataHora(item.criado_em)} />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <p className="mt-3 text-right text-[11px] text-slate-500">
            O histórico registra entrada e troca de página no portal.
          </p>
        </div>
      )}
    </div>
  )
}

function InfoMini({
  label,
  value,
  destaque = false,
}: {
  label: string
  value: string
  destaque?: boolean
}) {
  return (
    <div className="rounded-xl bg-[#071225] p-2">
      <p className="font-bold text-slate-500">{label}</p>
      <p className={`font-black ${destaque ? 'text-blue-300' : 'text-slate-100'}`}>
        {value}
      </p>
    </div>
  )
}
