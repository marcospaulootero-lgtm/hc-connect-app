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

    const channel = supabase
      .channel('suporte-admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suporte' }, carregarChamados)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens_suporte' }, carregarMensagens)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function carregarTudo() {
    await Promise.all([carregarChamados(), carregarUsuarios(), carregarMensagens()])
  }

  async function carregarChamados() {
    const { data } = await supabase
      .from('suporte')
      .select('*')
      .order('criado_em', { ascending: false })

    setChamados(data || [])
  }

  async function carregarUsuarios() {
    const { data } = await supabase
      .from('perfis')
      .select('*')
      .order('nome')

    setUsuarios(data || [])
  }

  async function carregarMensagens() {
    const { data } = await supabase
      .from('mensagens_suporte')
      .select('*')
      .order('criado_em', { ascending: true })

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
    const { error } = await supabase.from('suporte').update({ status }).eq('id', id)

    if (error) {
      alert(error.message)
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

    const { error: erroMensagem } = await supabase.from('mensagens_suporte').insert([
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
      alert(erroMensagem.message)
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
      alert(erroChamado.message)
      return
    }

    setResposta('')
    setRespondendoId(null)
    carregarChamados()
    carregarMensagens()
  }

  async function excluirChamado(id: string) {
    const confirmar = confirm('Deseja realmente excluir este chamado?')
    if (!confirmar) return

    const { error } = await supabase.from('suporte').delete().eq('id', id)

    if (error) {
      alert(error.message)
      return
    }

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
  const totalAnalise = chamados.filter((c) => c.status === 'EM ANÁLISE').length
  const totalRespondidos = chamados.filter((c) => c.status === 'RESPONDIDO').length
  const totalResolvidos = chamados.filter((c) => c.status === 'RESOLVIDO').length

  return (
    <main className="max-w-[1500px] mx-auto p-8 text-white">
      <div className="mb-8 flex flex-col lg:flex-row justify-between gap-6">
        <div>
          <p className="text-blue-400 font-bold mb-2">Central de atendimento</p>
          <h1 className="text-5xl font-black mb-2">Suporte</h1>
          <p className="text-slate-400 text-lg">
            Gerencie chamados, respostas e solicitações dos clientes em tempo real.
          </p>
        </div>

        <button
          onClick={carregarTudo}
          className="bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold h-fit"
        >
          Atualizar chamados
        </button>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-8">
        <Card titulo="Total" valor={chamados.length} detalhe="Chamados recebidos" icone="🎫" />
        <Card titulo="Abertos" valor={totalAbertos} detalhe="Aguardando atendimento" icone="🔴" />
        <Card titulo="Em análise" valor={totalAnalise} detalhe="Em atendimento" icone="🔎" />
        <Card titulo="Respondidos" valor={totalRespondidos} detalhe="Cliente notificado" icone="💬" />
        <Card titulo="Resolvidos" valor={totalResolvidos} detalhe="Finalizados" icone="✅" />
      </section>

      <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7 mb-8">
        <div className="flex flex-col lg:flex-row justify-between gap-5 mb-7">
          <div>
            <h2 className="text-2xl font-black">Filtros de atendimento</h2>
            <p className="text-slate-400 text-sm">
              Pesquise por cliente, e-mail, assunto, mensagem ou status.
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
            placeholder="Buscar chamado..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />

          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="ABERTO">Aberto</option>
            <option value="EM ANÁLISE">Em análise</option>
            <option value="RESPONDIDO">Respondido</option>
            <option value="RESOLVIDO">Resolvido</option>
          </select>

          <div className="border border-blue-900 rounded-2xl bg-[#020817] px-5 py-3 text-slate-300 font-bold flex items-center">
            {chamadosFiltrados.length} chamado(s) encontrado(s)
          </div>
        </div>
      </section>

      <section className="space-y-5">
        {chamadosFiltrados.length === 0 ? (
          <div className="border border-blue-900 rounded-3xl bg-[#071225] p-8 text-center text-slate-400">
            Nenhum chamado encontrado.
          </div>
        ) : (
          chamadosFiltrados.map((item) => {
            const conversa = mensagensDoChamado(item.id)

            return (
              <div key={item.id} className="border border-blue-900 rounded-3xl p-7 bg-[#071225]">
                <div className="flex flex-col lg:flex-row justify-between gap-5 mb-6">
                  <div>
                    <div className="flex gap-3 flex-wrap mb-3">
                      <span className={`px-4 py-2 rounded-xl text-xs font-black ${corStatus(item.status)}`}>
                        {item.status || 'ABERTO'}
                      </span>

                      <span className="px-4 py-2 rounded-xl text-xs font-black bg-slate-800 text-slate-300">
                        Ticket #{item.id?.slice(0, 8)}
                      </span>
                    </div>

                    <h3 className="text-3xl font-black">{item.assunto || 'Sem assunto'}</h3>

                    <p className="text-slate-400 mt-2">
                      {nomeUsuario(item.usuario_id)} • {item.email || emailUsuario(item.usuario_id)}
                    </p>

                    <p className="text-slate-500 text-sm mt-1">
                      Aberto em{' '}
                      {item.criado_em ? new Date(item.criado_em).toLocaleString('pt-BR') : '-'}
                    </p>
                  </div>

                  <div className="flex gap-2 flex-wrap h-fit">
                    <button onClick={() => atualizarStatus(item.id, 'EM ANÁLISE')} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl font-bold">
                      Em análise
                    </button>

                    <button onClick={() => atualizarStatus(item.id, 'RESOLVIDO')} className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-xl font-bold">
                      Resolver
                    </button>

                    <button onClick={() => excluirChamado(item.id)} className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded-xl font-bold">
                      Excluir
                    </button>
                  </div>
                </div>

                <div className="border border-blue-900 bg-[#020817] rounded-2xl p-5 mb-5">
                  <p className="text-slate-400 font-bold mb-2">Mensagem inicial</p>
                  <p className="text-slate-300 leading-7">{item.mensagem || '-'}</p>
                </div>

                <div className="border border-blue-900 bg-[#020817] rounded-2xl p-5 mb-5">
                  <div className="flex justify-between items-center mb-5">
                    <p className="text-slate-300 font-black">Conversa</p>
                    <span className="text-slate-500 text-sm">{conversa.length} mensagem(ns)</span>
                  </div>

                  {conversa.length === 0 ? (
                    <p className="text-slate-500">Nenhuma resposta ainda.</p>
                  ) : (
                    <div className="space-y-4">
                      {conversa.map((msg) => {
                        const admin = msg.autor === 'ADMIN'

                        return (
                          <div key={msg.id} className={`flex ${admin ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl p-4 ${admin ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
                              <p className="text-xs opacity-80 mb-1">
                                {admin ? 'HC Consultoria' : 'Cliente'}
                              </p>

                              <p className="leading-7 whitespace-pre-wrap">{msg.mensagem}</p>

                              <p className="text-xs opacity-70 mt-2">
                                {msg.criado_em ? new Date(msg.criado_em).toLocaleString('pt-BR') : '-'}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {respondendoId === item.id ? (
                  <div className="border border-purple-900 bg-[#020817] rounded-2xl p-5">
                    <textarea
                      placeholder="Digite a resposta para o cliente..."
                      value={resposta}
                      onChange={(e) => setResposta(e.target.value)}
                      className="min-h-[140px]"
                    />

                    <div className="flex gap-3 mt-3">
                      <button onClick={() => enviarResposta(item)} className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-bold">
                        Enviar resposta
                      </button>

                      <button
                        onClick={() => {
                          setRespondendoId(null)
                          setResposta('')
                        }}
                        className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setRespondendoId(item.id)
                      setResposta('')
                    }}
                    className="bg-purple-600 hover:bg-purple-500 px-5 py-3 rounded-xl font-bold"
                  >
                    Responder chamado
                  </button>
                )}
              </div>
            )
          })
        )}
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