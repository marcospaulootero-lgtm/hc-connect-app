'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function SuporteAdminPage() {
  const [chamados, setChamados] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [mensagens, setMensagens] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [respondendoId, setRespondendoId] = useState<string | null>(null)
  const [resposta, setResposta] = useState('')

  useEffect(() => {
    carregarTudo()
  }, [])

  async function carregarTudo() {
    await Promise.all([
      carregarChamados(),
      carregarUsuarios(),
      carregarMensagens(),
    ])
  }

  async function carregarChamados() {
    const { data, error } = await supabase
      .from('suporte')
      .select('*')
      .order('criado_em', { ascending: false })

    if (error) {
      console.log(error)
      return
    }

    setChamados(data || [])
  }

  async function carregarUsuarios() {
    const { data, error } = await supabase
      .from('perfis')
      .select('*')
      .order('nome')

    if (error) {
      console.log(error)
      return
    }

    setUsuarios(data || [])
  }

  async function carregarMensagens() {
    const { data, error } = await supabase
      .from('mensagens_suporte')
      .select('*')
      .order('criado_em', { ascending: true })

    if (error) {
      console.log(error)
      return
    }

    setMensagens(data || [])
  }

  function mensagensDoChamado(chamadoId: string) {
    return mensagens.filter((item) => item.chamado_id === chamadoId)
  }

  function nomeUsuario(usuarioId: string) {
    const usuario = usuarios.find((item) => item.id === usuarioId)
    return usuario?.nome || usuario?.email || '-'
  }

  function emailUsuario(usuarioId: string) {
    const usuario = usuarios.find((item) => item.id === usuarioId)
    return usuario?.email || '-'
  }

  function corStatus(status: string) {
    if (status === 'ABERTO') return 'bg-yellow-400 text-black'
    if (status === 'EM ANÁLISE') return 'bg-blue-600 text-white'
    if (status === 'RESPONDIDO') return 'bg-purple-600 text-white'
    if (status === 'RESOLVIDO') return 'bg-green-700 text-white'

    return 'bg-slate-600 text-white'
  }

  async function atualizarStatus(id: string, status: string) {
    const { error } = await supabase
      .from('suporte')
      .update({ status })
      .eq('id', id)

    if (error) {
      alert(error.message || 'Erro ao atualizar status')
      console.log(error)
      return
    }

    carregarChamados()
  }

  async function enviarResposta(chamado: any) {
    if (!resposta.trim()) {
      alert('Digite uma resposta')
      return
    }

    const respostaFinal = resposta.trim()

    const { error: erroMensagem } = await supabase
      .from('mensagens_suporte')
      .insert([
        {
          chamado_id: chamado.id,
          empresa_id: chamado.empresa_id || null,
          embarque_id: chamado.embarque_id || null,
          usuario_id: chamado.usuario_id || null,
          assunto: chamado.assunto || 'Suporte',
          mensagem: respostaFinal,
          autor: 'ADMIN',
          criado_por: 'ADMIN',
          status: 'RESPONDIDO',
          respondido_em: new Date().toISOString(),
        },
      ])

    if (erroMensagem) {
      alert(erroMensagem.message || 'Erro ao enviar resposta')
      console.log(erroMensagem)
      return
    }

    const { error: erroChamado } = await supabase
      .from('suporte')
      .update({
        resposta: respostaFinal,
        status: 'RESPONDIDO',
      })
      .eq('id', chamado.id)

    if (erroChamado) {
      alert(erroChamado.message || 'Resposta enviada, mas houve erro ao atualizar o chamado')
      console.log(erroChamado)
      return
    }

    alert('Resposta enviada ao cliente')

    setResposta('')
    setRespondendoId(null)

    carregarChamados()
    carregarMensagens()
  }

  async function excluirChamado(id: string) {
    const confirmar = confirm('Deseja realmente excluir este chamado?')

    if (!confirmar) return

    const { error } = await supabase
      .from('suporte')
      .delete()
      .eq('id', id)

    if (error) {
      alert(error.message || 'Erro ao excluir chamado')
      console.log(error)
      return
    }

    alert('Chamado excluído')

    carregarChamados()
    carregarMensagens()
  }

  const chamadosFiltrados = useMemo(() => {
    return chamados.filter((item) => {
      const texto = `
        ${nomeUsuario(item.usuario_id)}
        ${emailUsuario(item.usuario_id)}
        ${item.email}
        ${item.assunto}
        ${item.mensagem}
        ${item.status}
      `.toLowerCase()

      const matchBusca = texto.includes(busca.toLowerCase())
      const matchStatus = !filtroStatus || item.status === filtroStatus

      return matchBusca && matchStatus
    })
  }, [chamados, usuarios, busca, filtroStatus])

  const totalAbertos = chamados.filter((c) => c.status === 'ABERTO').length
  const totalRespondidos = chamados.filter((c) => c.status === 'RESPONDIDO').length
  const totalResolvidos = chamados.filter((c) => c.status === 'RESOLVIDO').length

  return (
    <main className="max-w-7xl mx-auto p-8 text-white">
      <div className="mb-8">
        <h1 className="text-5xl font-black mb-2">Suporte</h1>

        <p className="text-slate-400 text-lg">
          Central de atendimento e chamados dos clientes.
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <p className="text-slate-400">Total</p>
          <h2 className="text-5xl font-black mt-4">{chamados.length}</h2>
        </div>

        <div className="card">
          <p className="text-slate-400">Abertos</p>
          <h2 className="text-5xl font-black mt-4 text-yellow-400">
            {totalAbertos}
          </h2>
        </div>

        <div className="card">
          <p className="text-slate-400">Respondidos</p>
          <h2 className="text-5xl font-black mt-4 text-purple-400">
            {totalRespondidos}
          </h2>
        </div>

        <div className="card">
          <p className="text-slate-400">Resolvidos</p>
          <h2 className="text-5xl font-black mt-4 text-green-400">
            {totalResolvidos}
          </h2>
        </div>
      </section>

      <section className="card mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            placeholder="Buscar por usuário, e-mail, assunto, mensagem..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="ABERTO">Aberto</option>
            <option value="EM ANÁLISE">Em análise</option>
            <option value="RESPONDIDO">Respondido</option>
            <option value="RESOLVIDO">Resolvido</option>
          </select>
        </div>
      </section>

      <section className="card">
        <h2 className="text-2xl font-black mb-6">Chamados recebidos</h2>

        {chamadosFiltrados.length === 0 ? (
          <p className="text-slate-400">Nenhum chamado encontrado.</p>
        ) : (
          <div className="space-y-5">
            {chamadosFiltrados.map((item) => {
              const conversa = mensagensDoChamado(item.id)

              return (
                <div
                  key={item.id}
                  className="border border-blue-900 rounded-3xl p-6 bg-[#071225]"
                >
                  <div className="flex justify-between gap-4 mb-5">
                    <div>
                      <h3 className="text-2xl font-black">
                        {item.assunto || 'Sem assunto'}
                      </h3>

                      <p className="text-slate-400 mt-1">
                        {nomeUsuario(item.usuario_id)} •{' '}
                        {item.email || emailUsuario(item.usuario_id)}
                      </p>

                      <p className="text-slate-500 text-sm mt-1">
                        {item.criado_em
                          ? new Date(item.criado_em).toLocaleString('pt-BR')
                          : '-'}
                      </p>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-sm font-bold h-fit ${corStatus(
                        item.status
                      )}`}
                    >
                      {item.status || 'ABERTO'}
                    </span>
                  </div>

                  <div className="bg-[#020817] border border-blue-950 rounded-2xl p-5 mb-5">
                    <p className="text-slate-400 font-bold mb-2">
                      Mensagem inicial do cliente
                    </p>

                    <p className="text-slate-300 leading-7">
                      {item.mensagem || '-'}
                    </p>
                  </div>

                  <div className="bg-[#020817] border border-blue-950 rounded-2xl p-5 mb-5">
                    <p className="text-slate-400 font-bold mb-4">Conversa</p>

                    {conversa.length === 0 ? (
                      <p className="text-slate-500">Nenhuma resposta ainda.</p>
                    ) : (
                      <div className="space-y-4">
                        {conversa.map((msg) => {
                          const admin = msg.autor === 'ADMIN'

                          return (
                            <div
                              key={msg.id}
                              className={`flex ${
                                admin ? 'justify-end' : 'justify-start'
                              }`}
                            >
                              <div
                                className={`max-w-[80%] rounded-2xl p-4 ${
                                  admin
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-800 text-slate-200'
                                }`}
                              >
                                <p className="text-xs opacity-80 mb-1">
                                  {admin ? 'HC Consultoria' : 'Cliente'}
                                </p>

                                <p className="leading-7">{msg.mensagem}</p>

                                <p className="text-xs opacity-70 mt-2">
                                  {msg.criado_em
                                    ? new Date(msg.criado_em).toLocaleString(
                                        'pt-BR'
                                      )
                                    : '-'}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {respondendoId === item.id && (
                    <div className="mb-5">
                      <textarea
                        placeholder="Digite a resposta para o cliente..."
                        value={resposta}
                        onChange={(e) => setResposta(e.target.value)}
                        className="min-h-[140px]"
                      />

                      <div className="flex gap-3 mt-3">
                        <button
                          onClick={() => enviarResposta(item)}
                          className="bg-green-600 hover:bg-green-500"
                        >
                          Enviar resposta
                        </button>

                        <button
                          onClick={() => {
                            setRespondendoId(null)
                            setResposta('')
                          }}
                          className="bg-slate-700 hover:bg-slate-600"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={() => atualizarStatus(item.id, 'EM ANÁLISE')}
                      className="bg-blue-600 hover:bg-blue-500"
                    >
                      Em análise
                    </button>

                    <button
                      onClick={() => {
                        setRespondendoId(item.id)
                        setResposta('')
                      }}
                      className="bg-purple-600 hover:bg-purple-500"
                    >
                      Responder
                    </button>

                    <button
                      onClick={() => atualizarStatus(item.id, 'RESOLVIDO')}
                      className="bg-green-600 hover:bg-green-500"
                    >
                      Resolver
                    </button>

                    <button
                      onClick={() => excluirChamado(item.id)}
                      className="bg-red-700 hover:bg-red-600"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}