'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function CotacoesAdminPage() {
  const [cotacoes, setCotacoes] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  useEffect(() => {
    carregar()
    carregarUsuarios()
  }, [])

  async function carregar() {
    const { data } = await supabase
      .from('cotacoes')
      .select('*')
      .order('criado_em', { ascending: false })

    setCotacoes(data || [])
  }

  async function carregarUsuarios() {
    const { data } = await supabase
      .from('perfis')
      .select('*')
      .order('nome')

    setUsuarios(data || [])
  }

  function nomeUsuario(usuarioId: string) {
    const usuario = usuarios.find((item) => item.id === usuarioId)
    return usuario?.nome || usuario?.email || '-'
  }

  function emailUsuario(usuarioId: string) {
    const usuario = usuarios.find((item) => item.id === usuarioId)
    return usuario?.email || '-'
  }

  async function atualizarStatus(id: string, status: string) {
  const cotacao = cotacoes.find((c) => c.id === id)

  const { error } = await supabase
    .from('cotacoes')
    .update({ status })
    .eq('id', id)

  if (error) {
    alert('Erro ao atualizar status')
    console.log(error)
    return
  }

  if (
    status === 'COTAÇÃO DISPONÍVEL' &&
    cotacao?.solicitante_email
  ) {
    try {
      await fetch('/api/enviar-email-cotacao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          referencia_hc: cotacao.referencia_hc, 
          email: cotacao.solicitante_email,
          cliente: cotacao.cliente_final,
          origem: cotacao.origem,
          destino: cotacao.destino,
          tipo_operacao: cotacao.tipo_operacao,
        }),
      })
    } catch (err) {
      console.error(err)
    }
  }

  carregar()
}

  async function excluirCotacao(id: string) {
    const confirmar = confirm('Deseja realmente excluir esta cotação?')
    if (!confirmar) return

    const { error } = await supabase.from('cotacoes').delete().eq('id', id)

    if (error) {
      alert('Erro ao excluir cotação')
      console.log(error)
      return
    }

    carregar()
  }

  const cotacoesFiltradas = useMemo(() => {
    return cotacoes.filter((item) => {
      const texto = `
        ${nomeUsuario(item.usuario_id)}
        ${emailUsuario(item.usuario_id)}
        ${item.solicitante_email}
        ${item.cliente_final}
        ${item.tipo_operacao}
        ${item.origem}
        ${item.destino}
        ${item.status}
      `.toLowerCase()

      const matchBusca = texto.includes(busca.toLowerCase())
      const matchStatus = !filtroStatus || item.status === filtroStatus

      return matchBusca && matchStatus
    })
  }, [cotacoes, usuarios, busca, filtroStatus])

  function corStatus(status: string) {
    if (status === 'AGUARDANDO ANÁLISE') return 'bg-yellow-400 text-black'
    if (status === 'EM ANÁLISE') return 'bg-blue-600 text-white'
    if (status === 'AGUARDANDO TRANSPORTADORA') return 'bg-purple-600 text-white'
    if (status === 'COTAÇÃO DISPONÍVEL') return 'bg-emerald-600 text-white'
    if (status === 'APROVADA') return 'bg-green-700 text-white'
    if (status === 'AUTORIZADA') return 'bg-green-700 text-white'
    if (status === 'RECUSADA') return 'bg-red-600 text-white'
    if (status === 'CONVERTIDA EM EMBARQUE') return 'bg-slate-700 text-white'
    return 'bg-slate-600 text-white'
  }

  const totalAguardando = cotacoes.filter((c) => c.status === 'AGUARDANDO ANÁLISE').length
  const totalAnalise = cotacoes.filter((c) => c.status === 'EM ANÁLISE').length
  const totalDisponiveis = cotacoes.filter((c) => c.status === 'COTAÇÃO DISPONÍVEL').length
  const totalAprovadas = cotacoes.filter((c) => c.status === 'APROVADA' || c.status === 'AUTORIZADA').length
  const totalRecusadas = cotacoes.filter((c) => c.status === 'RECUSADA').length

  return (
    <main className="w-full max-w-none p-8 text-white">
      <div className="mb-8 flex flex-col lg:flex-row justify-between gap-6">
        <div>
          <p className="text-blue-400 font-bold mb-2">Comercial</p>

          <h1 className="text-5xl font-black mb-2">
            Cotações
          </h1>

          <p className="text-slate-400 text-lg">
            Gerencie solicitações recebidas, acompanhe status e envie respostas ao cliente.
          </p>
        </div>

        <button
          onClick={carregar}
          className="bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold h-fit"
        >
          Atualizar fila
        </button>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-6 gap-5 mb-8">
        <Card titulo="Total" valor={cotacoes.length} detalhe="Solicitações" icone="📨" />
        <Card titulo="Aguardando" valor={totalAguardando} detalhe="Nova análise" icone="⏳" />
        <Card titulo="Em análise" valor={totalAnalise} detalhe="Em tratamento" icone="🔎" />
        <Card titulo="Disponíveis" valor={totalDisponiveis} detalhe="Resposta enviada" icone="📄" />
        <Card titulo="Aprovadas" valor={totalAprovadas} detalhe="Cliente aprovou" icone="✅" />
        <Card titulo="Recusadas" valor={totalRecusadas} detalhe="Não aprovadas" icone="❌" />
      </section>

      <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7 mb-8">
        <div className="flex flex-col lg:flex-row justify-between gap-5 mb-7">
          <div>
            <h2 className="text-2xl font-black">
              Filtros da fila comercial
            </h2>

            <p className="text-slate-400 text-sm mt-1">
              Busque por cliente, e-mail, operação, origem, destino ou status.
            </p>
          </div>

          <button
            onClick={() => {
              setBusca('')
              setFiltroStatus('')
            }}
            className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold h-fit"
          >
            Limpar filtros
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            placeholder="Buscar por usuário, e-mail, cliente, origem, destino..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />

          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="AGUARDANDO ANÁLISE">Aguardando análise</option>
            <option value="EM ANÁLISE">Em análise</option>
            <option value="AGUARDANDO TRANSPORTADORA">Aguardando transportadora</option>
            <option value="COTAÇÃO DISPONÍVEL">Cotação disponível</option>
            <option value="APROVADA">Aprovada</option>
            <option value="AUTORIZADA">Autorizada</option>
            <option value="RECUSADA">Recusada</option>
            <option value="CONVERTIDA EM EMBARQUE">Convertida em embarque</option>
          </select>

          <div className="border border-blue-900 rounded-2xl bg-[#020817] px-5 py-3 text-slate-300 font-bold flex items-center">
            {cotacoesFiltradas.length} cotação(ões) encontrada(s)
          </div>
        </div>
      </section>

      <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
        <div className="flex flex-col lg:flex-row justify-between gap-5 mb-7">
          <div>
            <h2 className="text-2xl font-black">
              Solicitações recebidas
            </h2>

            <p className="text-slate-400 text-sm">
              Acompanhe os pedidos e atualize o status da cotação.
            </p>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Solicitante</th>
                <th>E-mail</th>
                <th>Cliente final</th>
                <th>Operação</th>
                <th>Rota</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              {cotacoesFiltradas.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div>
                      <p className="font-bold">
                        {item.criado_em
                          ? new Date(item.criado_em).toLocaleDateString('pt-BR')
                          : '-'}
                      </p>

                      <p className="text-slate-500 text-xs">
                        {item.criado_em
                          ? new Date(item.criado_em).toLocaleTimeString('pt-BR')
                          : '-'}
                      </p>
                    </div>
                  </td>

                  <td>
                    <div>
                      <p className="font-black">
                        {nomeUsuario(item.usuario_id)}
                      </p>

                      <p className="text-slate-500 text-xs">
                        ID: {item.id?.slice(0, 8)}
                      </p>
                    </div>
                  </td>

                  <td>{item.solicitante_email || emailUsuario(item.usuario_id)}</td>

                  <td>{item.cliente_final || '-'}</td>

                  <td>
                    <span className="bg-slate-800 border border-blue-900 px-3 py-2 rounded-xl font-bold">
                      {item.tipo_operacao || '-'}
                    </span>
                  </td>

                  <td>
                    <div>
                      <p className="font-bold">{item.origem || '-'}</p>
                      <p className="text-slate-500 text-sm">→ {item.destino || '-'}</p>
                    </div>
                  </td>

                  <td>
                    <span className={`px-3 py-2 rounded-xl text-xs font-black ${corStatus(item.status)}`}>
                      {item.status || 'AGUARDANDO ANÁLISE'}
                    </span>
                  </td>

                  <td>
                    <div className="flex gap-2 flex-wrap">
                      <a
                        href={`/admin/cotacoes/${item.id}`}
                        className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl text-white font-bold"
                      >
                        Ver
                      </a>

                      <button
                        onClick={() => atualizarStatus(item.id, 'EM ANÁLISE')}
                        className="bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded-xl font-bold"
                      >
                        Análise
                      </button>

                      <button
                        onClick={() => atualizarStatus(item.id, 'AGUARDANDO TRANSPORTADORA')}
                        className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-xl font-bold"
                      >
                        Aguardando
                      </button>

                      <button
                        onClick={() => atualizarStatus(item.id, 'COTAÇÃO DISPONÍVEL')}
                        className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-xl font-bold"
                      >
                        Disponível
                      </button>

                      <button
                        onClick={() => atualizarStatus(item.id, 'RECUSADA')}
                        className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-xl font-bold"
                      >
                        Recusar
                      </button>

                      <button
                        onClick={() => excluirCotacao(item.id)}
                        className="bg-red-800 hover:bg-red-700 px-4 py-2 rounded-xl font-bold"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {cotacoesFiltradas.length === 0 && (
            <div className="border border-blue-900 bg-[#020817] rounded-2xl p-8 text-center text-slate-400 mt-6">
              Nenhuma cotação encontrada.
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

function Card({ titulo, valor, detalhe, icone }: any) {
  return (
    <div className="border border-blue-900 rounded-3xl bg-[#071225] p-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <p className="text-slate-300 font-bold">{titulo}</p>
          <h2 className="text-5xl font-black mt-4 text-white">{valor}</h2>
          <p className="text-slate-400 mt-2">{detalhe}</p>
        </div>

        <div className="text-4xl">{icone}</div>
      </div>
    </div>
  )
}