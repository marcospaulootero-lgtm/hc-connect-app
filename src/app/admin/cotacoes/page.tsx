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
    const { error } = await supabase
      .from('cotacoes')
      .update({ status })
      .eq('id', id)

    if (error) {
      alert('Erro ao atualizar status')
      console.log(error)
      return
    }

    carregar()
  }

  async function excluirCotacao(id: string) {
    const confirmar = confirm('Deseja realmente excluir esta cotação?')

    if (!confirmar) return

    const { error } = await supabase
      .from('cotacoes')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erro ao excluir cotação')
      console.log(error)
      return
    }

    alert('Cotação excluída')
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

  return (
    <main className="max-w-7xl mx-auto p-8 text-white">
      <div className="mb-8">
        <h1 className="text-5xl font-black mb-2">
          Cotações
        </h1>

        <p className="text-slate-400 text-lg">
          Fila de solicitações recebidas pelo portal.
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <p className="text-slate-400">Total</p>
          <h2 className="text-5xl font-black mt-4">
            {cotacoes.length}
          </h2>
        </div>

        <div className="card">
          <p className="text-slate-400">Aguardando análise</p>
          <h2 className="text-5xl font-black mt-4">
            {cotacoes.filter((c) => c.status === 'AGUARDANDO ANÁLISE').length}
          </h2>
        </div>

        <div className="card">
          <p className="text-slate-400">Em análise</p>
          <h2 className="text-5xl font-black mt-4">
            {cotacoes.filter((c) => c.status === 'EM ANÁLISE').length}
          </h2>
        </div>

        <div className="card">
          <p className="text-slate-400">Disponíveis</p>
          <h2 className="text-5xl font-black mt-4">
            {cotacoes.filter((c) => c.status === 'COTAÇÃO DISPONÍVEL').length}
          </h2>
        </div>
      </section>

      <section className="card mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            placeholder="Buscar por usuário, e-mail, cliente final, origem, destino..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="AGUARDANDO ANÁLISE">Aguardando análise</option>
            <option value="EM ANÁLISE">Em análise</option>
            <option value="AGUARDANDO TRANSPORTADORA">Aguardando transportadora</option>
            <option value="COTAÇÃO DISPONÍVEL">Cotação disponível</option>
            <option value="APROVADA">Aprovada</option>
            <option value="RECUSADA">Recusada</option>
            <option value="CONVERTIDA EM EMBARQUE">Convertida em embarque</option>
          </select>
        </div>
      </section>

      <section className="card">
        <h2 className="text-2xl font-black mb-6">
          Solicitações recebidas
        </h2>

        <div className="overflow-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Usuário</th>
                <th>E-mail</th>
                <th>Cliente final</th>
                <th>Operação</th>
                <th>Origem</th>
                <th>Destino</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              {cotacoesFiltradas.map((item) => (
                <tr key={item.id}>
                  <td>
                    {new Date(item.criado_em).toLocaleDateString('pt-BR')}
                  </td>

                  <td>{nomeUsuario(item.usuario_id)}</td>

                  <td>
                    {item.solicitante_email || emailUsuario(item.usuario_id)}
                  </td>

                  <td>{item.cliente_final || '-'}</td>
                  <td>{item.tipo_operacao || '-'}</td>
                  <td>{item.origem || '-'}</td>
                  <td>{item.destino || '-'}</td>

                  <td>
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${corStatus(item.status)}`}>
                      {item.status}
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
                      >
                        Em análise
                      </button>

                      <button
                        onClick={() =>
                          atualizarStatus(item.id, 'AGUARDANDO TRANSPORTADORA')
                        }
                        className="bg-purple-600 hover:bg-purple-500"
                      >
                        Aguardando
                      </button>

                      <button
                        onClick={() =>
                          atualizarStatus(item.id, 'COTAÇÃO DISPONÍVEL')
                        }
                        className="bg-emerald-600 hover:bg-emerald-500"
                      >
                        Disponível
                      </button>

                      <button
                        onClick={() => atualizarStatus(item.id, 'RECUSADA')}
                        className="bg-red-600 hover:bg-red-500"
                      >
                        Recusar
                      </button>

                      <button
                        onClick={() => excluirCotacao(item.id)}
                        className="bg-red-800 hover:bg-red-700"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}