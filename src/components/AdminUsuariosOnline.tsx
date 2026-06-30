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
    '/cliente': 'Portal cliente',
    '/cliente/embarques': 'Meus embarques',
    '/cliente/faturas': 'Minhas faturas',
    '/cliente/cotacoes': 'Solicitar cotação',
    '/cliente/minhas-cotacoes': 'Minhas cotações',
    '/cliente/suporte': 'Suporte cliente',
  }

  return mapa[pathname] || pathname
}

export default function AdminUsuariosOnline() {
  const [usuarios, setUsuarios] = useState<UsuarioOnline[]>([])
  const [loading, setLoading] = useState(true)

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

    const intervalo = setInterval(() => {
      carregarOnline()
    }, 15000)

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
      clearInterval(intervalo)
      supabase.removeChannel(canal)
    }
  }, [])

  const onlineAgora = useMemo(() => {
    const limite = Date.now() - LIMITE_ONLINE_MS

    return usuarios.filter((item) => {
      if (!item.ultima_atividade) return false
      return new Date(item.ultima_atividade).getTime() >= limite
    })
  }, [usuarios])

  return (
    <section className="mb-6 rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-600">
            Presença em tempo real
          </p>
          <h2 className="text-xl font-black text-slate-950">Usuários online agora</h2>
          <p className="text-sm text-slate-500">
            Mostra quem teve atividade no portal nos últimos 2 minutos.
          </p>
        </div>

        <div className="rounded-2xl bg-blue-600 px-5 py-3 text-center text-white">
          <p className="text-xs font-bold uppercase opacity-80">Online</p>
          <p className="text-2xl font-black">{onlineAgora.length}</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
          Carregando presença online...
        </div>
      ) : onlineAgora.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
          Nenhum usuário online agora.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {onlineAgora.map((usuario) => (
            <div
              key={usuario.user_id}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-950">
                    {usuario.nome || usuario.email || 'Usuário'}
                  </p>
                  <p className="text-xs text-slate-500">{usuario.email || '-'}</p>
                </div>

                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black uppercase text-green-700">
                  online
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-white p-2">
                  <p className="font-bold text-slate-400">Tipo</p>
                  <p className="font-black text-slate-800">
                    {usuario.tipo_acesso || usuario.area || '-'}
                  </p>
                </div>

                <div className="rounded-xl bg-white p-2">
                  <p className="font-bold text-slate-400">Atividade</p>
                  <p className="font-black text-slate-800">
                    {tempoRelativo(usuario.ultima_atividade)}
                  </p>
                </div>
              </div>

              <div className="mt-2 rounded-xl bg-white p-2 text-xs">
                <p className="font-bold text-slate-400">Página atual</p>
                <p className="font-black text-blue-700">
                  {nomePagina(usuario.pagina_atual)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
