'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import StatusBadge from '@/components/StatusBadge'

export default function ClientePage() {
  const [usuario, setUsuario] = useState<any>(null)
  const [embarques, setEmbarques] = useState<any[]>([])
  const [cotacoes, setCotacoes] = useState<any[]>([])
  const [faturas, setFaturas] = useState<any[]>([])
  const [busca, setBusca] = useState('')

  useEffect(() => {
    carregarUsuario()
  }, [])

  useEffect(() => {
    if (!usuario?.id) return

    const canal = supabase
      .channel(`bloqueio-usuario-${usuario.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'perfis',
          filter: `id=eq.${usuario.id}`,
        },
        async (payload) => {
          const novoPerfil: any = payload.new

          if (novoPerfil.ativo === false) {
            alert('Seu acesso foi removido pela HC Consultoria.')
            await supabase.auth.signOut()
            window.location.href = '/login'
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
  }, [usuario?.id])

  async function carregarUsuario() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/login'
      return
    }

    const { data: perfil, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error || !perfil) {
      await supabase.auth.signOut()
      window.location.href = '/login'
      return
    }

    if (perfil.ativo === false) {
      alert('Seu acesso foi removido pela HC Consultoria.')
      await supabase.auth.signOut()
      window.location.href = '/login'
      return
    }

    if (perfil.tipo_acesso === 'admin') {
      window.location.href = '/admin'
      return
    }

    setUsuario({
      id: user.id,
      nome: perfil?.nome || user.email,
      email: user.email,
      tipo: perfil?.tipo_acesso || 'CLIENTE',
    })

    carregarEmbarques(user.id)
    carregarCotacoes(user.id)
    carregarFaturas(user.id)
  }

  async function carregarEmbarques(usuarioId: string) {
    const { data, error } = await supabase
      .from('embarques')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('criado_em', { ascending: false })

    if (error) {
      console.log(error)
      return
    }

    setEmbarques(data || [])
  }

  async function carregarCotacoes(usuarioId: string) {
    const { data, error } = await supabase
      .from('cotacoes')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('criado_em', { ascending: false })

    if (error) {
      console.log(error)
      return
    }

    setCotacoes(data || [])
  }

  async function carregarFaturas(usuarioId: string) {
    const { data, error } = await supabase
      .from('faturas')
      .select('*')
      .eq('usuario_id', usuarioId)
      .eq('visivel_cliente', true)
      .order('criado_em', { ascending: false })

    if (error) {
      console.log(error)
      return
    }

    setFaturas(data || [])
  }

  async function sair() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const filtrados = embarques.filter((item) => {
    const texto = `
      ${item.awb}
      ${item.transportadora}
      ${item.origem}
      ${item.destino}
      ${item.status_operacional}
      ${item.cliente_final}
    `.toLowerCase()

    return texto.includes(busca.toLowerCase())
  })

  const cotacoesComResposta = cotacoes.filter(
    (c) =>
      c.status === 'COTAÇÃO DISPONÍVEL' ||
      c.status === 'APROVADA' ||
      c.status === 'CONVERTIDA EM EMBARQUE'
  ).length

  const cotacoesPendentes = cotacoes.filter(
    (c) =>
      c.status === 'AGUARDANDO ANÁLISE' ||
      c.status === 'EM ANÁLISE' ||
      c.status === 'AGUARDANDO TRANSPORTADORA'
  ).length

  return (
    <main className="min-h-screen bg-[#020817] text-white p-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-10 gap-6">
          <div>
            <div className="bg-white inline-block p-5 rounded-2xl shadow-lg mb-6">
              <Image
                src="/HC-CONSULTORIA-TRANSPARENTE.png"
                alt="HC Consultoria"
                width={260}
                height={140}
                priority
              />
            </div>

            <h1 className="text-5xl font-bold mb-2">
              Meu portal
            </h1>

            <p className="text-slate-400 text-lg mb-5">
              Acompanhe seus embarques, cotações, faturas e documentos.
            </p>

            <div className="flex gap-4 flex-wrap">
              <a
                href="/cliente/cotacoes"
                className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl text-white font-bold inline-block"
              >
                Solicitar cotação
              </a>

              <a
                href="/cliente/cotacoes"
                className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl text-white font-bold inline-block"
              >
                Minhas cotações
              </a>

              <a
                href="/cliente/faturas"
                className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl text-white font-bold inline-block"
              >
                Minhas faturas
              </a>

              <a
                href="/cliente/suporte"
                className="bg-purple-600 hover:bg-purple-500 px-5 py-3 rounded-xl text-white font-bold inline-block"
              >
                Suporte
              </a>
            </div>
          </div>

          {usuario && (
            <div className="flex items-center gap-4 border border-blue-900 bg-[#071225] rounded-3xl px-5 py-4">
              <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xl">
                {usuario.nome?.charAt(0)}
              </div>

              <div>
                <p className="font-bold text-lg">
                  {usuario.nome}
                </p>

                <p className="text-slate-400 text-sm">
                  {usuario.email}
                </p>
              </div>

              <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase">
                {usuario.tipo}
              </span>

              <button
                onClick={sair}
                className="bg-blue-600 hover:bg-blue-700 transition px-5 py-3 rounded-2xl font-bold"
              >
                Sair
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="card">
            <p className="text-slate-400">Embarques</p>
            <h2 className="text-5xl font-bold mt-4">{embarques.length}</h2>
          </div>

          <div className="card">
            <p className="text-slate-400">Em trânsito</p>
            <h2 className="text-5xl font-bold mt-4">
              {embarques.filter((e) => e.status_operacional === 'Em trânsito').length}
            </h2>
          </div>

          <div className="card">
            <p className="text-slate-400">Cotações pendentes</p>
            <h2 className="text-5xl font-bold mt-4">{cotacoesPendentes}</h2>
          </div>

          <div className="card">
            <p className="text-slate-400">Cotações respondidas</p>
            <h2 className="text-5xl font-bold mt-4">{cotacoesComResposta}</h2>
          </div>

          <div className="card">
            <p className="text-slate-400">Faturas</p>
            <h2 className="text-5xl font-bold mt-4">{faturas.length}</h2>
          </div>
        </div>

        {faturas.length > 0 && (
          <section className="card mb-8 border-green-500">
            <div className="flex justify-between items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold mb-2">
                  Você tem faturas disponíveis
                </h2>

                <p className="text-slate-400">
                  Acesse suas faturas para baixar os PDFs vinculados aos seus embarques.
                </p>
              </div>

              <a
                href="/cliente/faturas"
                className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl text-white font-bold"
              >
                Ver faturas
              </a>
            </div>
          </section>
        )}

        {cotacoesComResposta > 0 && (
          <section className="card mb-8 border-green-500">
            <div className="flex justify-between items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold mb-2">
                  Você tem cotação disponível
                </h2>

                <p className="text-slate-400">
                  Acesse suas cotações para baixar o PDF enviado pela HC Consultoria.
                </p>
              </div>

              <a
                href="/cliente/cotacoes"
                className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl text-white font-bold"
              >
                Ver cotações
              </a>
            </div>
          </section>
        )}

        <section className="card mb-8">
          <div className="flex justify-between items-center gap-4">
            <h2 className="text-2xl font-bold">
              Meus embarques
            </h2>

            <input
              className="max-w-md"
              placeholder="Buscar AWB, destino, status..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </section>

        <section className="grid gap-6">
          {filtrados.length === 0 ? (
            <div className="card text-center">
              <p className="text-slate-400">
                Nenhum embarque encontrado.
              </p>
            </div>
          ) : (
            filtrados.map((item) => (
              <a
                key={item.id}
                href={`/cliente/embarques/${item.id}`}
                className="card hover:border-blue-500 transition block"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-3xl font-bold text-blue-400">
                      AWB {item.awb}
                    </h2>

                    <p className="text-slate-400 mt-3 text-lg">
                      {item.origem} → {item.destino}
                    </p>

                    <p className="text-slate-500 mt-2">
                      {item.transportadora} • {item.servico}
                    </p>

                    <p className="text-slate-500 mt-2">
                      Cliente final: {item.cliente_final || '-'}
                    </p>
                  </div>

                  <StatusBadge status={item.status_operacional} />
                </div>
              </a>
            ))
          )}
        </section>
      </div>
    </main>
  )
}