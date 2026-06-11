'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function SuporteClientePage() {
  const [usuario, setUsuario] = useState<any>(null)
  const [embarqueId, setEmbarqueId] = useState<string | null>(null)
  const [awb, setAwb] = useState<string | null>(null)

  const [chamados, setChamados] = useState<any[]>([])
  const [mensagens, setMensagens] = useState<any[]>([])
  const [salvando, setSalvando] = useState(false)
  const [respondendoId, setRespondendoId] = useState<string | null>(null)
  const [respostaCliente, setRespostaCliente] = useState('')
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  const [form, setForm] = useState({
    categoria: 'Operacional',
    prioridade: 'Normal',
    assunto: '',
    mensagem: '',
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const awbParam = params.get('awb')
    const embarqueParam = params.get('embarque_id')

    setAwb(awbParam)
    setEmbarqueId(embarqueParam)

    if (awbParam) {
      setForm({
        categoria: 'Embarques',
        prioridade: 'Normal',
        assunto: `Suporte referente ao AWB ${awbParam}`,
        mensagem: `Olá HC Consultoria,

Preciso de suporte referente ao embarque AWB ${awbParam}.`,
      })
    }

    carregarUsuario()
  }, [])

  useEffect(() => {
    if (!usuario?.id) return

    const channel = supabase
      .channel(`suporte-cliente-${usuario.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'suporte',
          filter: `usuario_id=eq.${usuario.id}`,
        },
        () => carregarChamados(usuario.id)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mensagens_suporte',
        },
        carregarMensagens
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
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

    setUsuario(user)
    carregarChamados(user.id)
    carregarMensagens()
  }

  async function carregarChamados(usuarioId: string) {
    const { data, error } = await supabase
      .from('suporte')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('criado_em', { ascending: false })

    if (error) {
      console.log(error)
      return
    }

    setChamados(data || [])
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

  async function abrirChamado() {
    if (!usuario?.id) {
      alert('Usuário não identificado')
      return
    }

    if (!form.assunto || !form.mensagem) {
      alert('Preencha assunto e descrição')
      return
    }

    setSalvando(true)

    const assuntoFinal = awb
      ? `Suporte referente ao AWB ${awb}`
      : `[${form.categoria}] ${form.assunto}`

    const { data, error } = await supabase
      .from('suporte')
      .insert([
        {
          usuario_id: usuario.id,
          email: usuario.email,
          embarque_id: embarqueId || null,
          assunto: assuntoFinal,
          mensagem: form.mensagem,
          status: 'ABERTO',
          categoria: form.categoria,
          prioridade: form.prioridade,
        },
      ])
      .select()
      .single()

    if (error) {
      setSalvando(false)
      console.log(error)
      alert(error.message || 'Erro ao abrir chamado')
      return
    }

    const { error: erroMensagem } = await supabase
      .from('mensagens_suporte')
      .insert([
        {
          chamado_id: data.id,
          usuario_id: usuario.id,
          assunto: assuntoFinal,
          mensagem: form.mensagem,
          autor: 'CLIENTE',
          criado_por: 'CLIENTE',
          status: 'ABERTO',
        },
      ])

    setSalvando(false)

    if (erroMensagem) {
      console.log(erroMensagem)
      alert(erroMensagem.message || 'Chamado aberto, mas houve erro ao iniciar conversa')
      return
    }

    alert('Chamado aberto com sucesso')

    setForm({
      categoria: 'Operacional',
      prioridade: 'Normal',
      assunto: '',
      mensagem: '',
    })

    carregarChamados(usuario.id)
    carregarMensagens()
  }

  async function enviarMensagemCliente(chamado: any) {
    if (!respostaCliente.trim()) {
      alert('Digite uma mensagem')
      return
    }

    const texto = respostaCliente.trim()

    const { error: erroMensagem } = await supabase
      .from('mensagens_suporte')
      .insert([
        {
          chamado_id: chamado.id,
          usuario_id: usuario.id,
          assunto: chamado.assunto || 'Suporte',
          mensagem: texto,
          autor: 'CLIENTE',
          criado_por: 'CLIENTE',
          status: 'ABERTO',
        },
      ])

    if (erroMensagem) {
      console.log(erroMensagem)
      alert(erroMensagem.message || 'Erro ao enviar mensagem')
      return
    }

    await supabase
      .from('suporte')
      .update({ status: 'ABERTO' })
      .eq('id', chamado.id)

    setRespostaCliente('')
    setRespondendoId(null)

    carregarChamados(usuario.id)
    carregarMensagens()
  }

  function corStatus(status: string) {
    if (status === 'ABERTO') return 'bg-yellow-400 text-black'
    if (status === 'EM ANÁLISE') return 'bg-blue-600 text-white'
    if (status === 'RESPONDIDO') return 'bg-purple-600 text-white'
    if (status === 'RESOLVIDO') return 'bg-green-700 text-white'
    return 'bg-slate-600 text-white'
  }

  function corPrioridade(prioridade: string) {
    if (prioridade === 'Alta') return 'bg-red-600 text-white'
    if (prioridade === 'Normal') return 'bg-blue-600 text-white'
    return 'bg-slate-700 text-white'
  }

  function dataHora(data?: string | null) {
    if (!data) return '-'
    return new Date(data).toLocaleString('pt-BR')
  }

  const chamadosFiltrados = useMemo(() => {
    return chamados.filter((item) => {
      const texto = `
        ${item.assunto}
        ${item.mensagem}
        ${item.status}
        ${item.categoria}
        ${item.prioridade}
      `.toLowerCase()

      const matchBusca = texto.includes(busca.toLowerCase())
      const matchStatus = !filtroStatus || item.status === filtroStatus

      return matchBusca && matchStatus
    })
  }, [chamados, busca, filtroStatus])

  const totalAbertos = chamados.filter((c) => c.status === 'ABERTO').length
  const totalAnalise = chamados.filter((c) => c.status === 'EM ANÁLISE').length
  const totalRespondidos = chamados.filter((c) => c.status === 'RESPONDIDO').length
  const totalResolvidos = chamados.filter((c) => c.status === 'RESOLVIDO').length

  return (
    <main className="min-h-screen bg-[#020817] text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col lg:flex-row justify-between gap-6">
          <div>
            <p className="text-blue-400 font-bold mb-2">Central de atendimento</p>

            <h1 className="text-5xl font-black mb-2">Suporte</h1>

            <p className="text-slate-400 text-lg">
              Abra chamados, acompanhe respostas e converse com a HC Consultoria.
            </p>
          </div>

          <a
            href="/cliente"
            className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl text-white font-bold h-fit"
          >
            Voltar ao portal
          </a>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-8">
          <Card titulo="Total" valor={chamados.length} detalhe="Chamados abertos" icone="🎫" />
          <Card titulo="Abertos" valor={totalAbertos} detalhe="Aguardando HC" icone="🔴" />
          <Card titulo="Em análise" valor={totalAnalise} detalhe="Em atendimento" icone="🔎" />
          <Card titulo="Respondidos" valor={totalRespondidos} detalhe="Resposta enviada" icone="💬" />
          <Card titulo="Resolvidos" valor={totalResolvidos} detalhe="Finalizados" icone="✅" />
        </section>
        <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7 mb-8">
          <h2 className="text-2xl font-black mb-2">Contato rápido</h2>

          <p className="text-slate-400 mb-6">
            Precisa de atendimento imediato? Entre em contato diretamente com nossa equipe.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <a
              href="https://wa.me/553136436175"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-600 hover:bg-green-500 text-white rounded-2xl p-5 transition"
            >
              <div className="text-2xl mb-2">🏢</div>
              <div className="font-black text-lg">WhatsApp HC Consultoria</div>
              <div className="text-sm opacity-90">(31) 3643-6175</div>
            </a>

            <a
              href="https://wa.me/5531988134482"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-700 hover:bg-green-600 text-white rounded-2xl p-5 transition"
            >
              <div className="text-2xl mb-2">👨‍💼</div>
              <div className="font-black text-lg">Marcos Paulo</div>
              <div className="text-sm opacity-90">Diretor Financeiro</div>
            </a>

            <a
              href="https://wa.me/5531999097666"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-700 hover:bg-green-600 text-white rounded-2xl p-5 transition"
            >
              <div className="text-2xl mb-2">👩‍💼</div>
              <div className="font-black text-lg">Hérica Couto</div>
              <div className="text-sm opacity-90">Diretora Operacional</div>
            </a>

            <a
              href="mailto:marcos@hcbhz.com?subject=Suporte HC Connect"
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-2xl p-5 transition"
            >
              <div className="text-2xl mb-2">📧</div>
              <div className="font-black text-lg">E-mail Marcos</div>
              <div className="text-sm opacity-90">marcos@hcbhz.com</div>
            </a>

            <a
              href="mailto:hericamcouto@outlook.com?subject=Suporte HC Connect"
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-2xl p-5 transition"
            >
              <div className="text-2xl mb-2">📧</div>
              <div className="font-black text-lg">E-mail Hérica</div>
              <div className="text-sm opacity-90">hericamcouto@outlook.com</div>
            </a>

            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
              <div className="text-2xl mb-2">⏰</div>
              <div className="font-black text-lg mb-2">Atendimento</div>
              <div className="text-slate-300 text-sm">
                Segunda a Sexta
                <br />
                08:00 às 18:00
                <br />
                <br />
                Resposta média:
                <br />
                até 2 horas úteis
              </div>
            </div>
          </div>
        </section>
        <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7 mb-8">
          <div className="flex items-center gap-3 mb-7">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-xl">
              🎧
            </div>

            <div>
              <h2 className="text-2xl font-black">Abrir novo chamado</h2>
              <p className="text-blue-400 font-bold">
  Chamado relacionado ao embarque AWB {awb}
</p>
            </div>
          </div>

          {awb && (
            <div className="border border-purple-500 bg-purple-600/10 rounded-2xl p-4 mb-5">
              <p className="text-purple-300 font-black">
                Chamado vinculado ao AWB {awb}
              </p>
              <p className="text-slate-400 text-sm mt-1">
                Este chamado será salvo com vínculo ao embarque selecionado.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-5">
            <select
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            >
              <option value="Operacional">Operacional</option>
              <option value="Embarques">Embarques</option>
              <option value="Faturas">Faturas</option>
              <option value="Cotações">Cotações</option>
              <option value="Financeiro">Financeiro</option>
              <option value="Comercial">Comercial</option>
              <option value="Outros">Outros</option>
            </select>

            <select
              value={form.prioridade}
              onChange={(e) => setForm({ ...form, prioridade: e.target.value })}
            >
              <option value="Baixa">Baixa</option>
              <option value="Normal">Normal</option>
              <option value="Alta">Alta</option>
            </select>

            <div className="md:col-span-2">
              <input
                placeholder="Assunto do chamado"
                value={form.assunto}
                onChange={(e) => setForm({ ...form, assunto: e.target.value })}
              />
            </div>
          </div>

          <textarea
            placeholder="Descreva sua solicitação com detalhes..."
            value={form.mensagem}
            onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
            className="min-h-[160px]"
          />

          <button
            onClick={abrirChamado}
            disabled={salvando}
            className="mt-5 bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold disabled:opacity-60"
          >
            {salvando ? 'Enviando...' : 'Abrir chamado'}
          </button>
        </section>

        <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7 mb-8">
          <div className="flex flex-col lg:flex-row justify-between gap-5 mb-7">
            <div>
              <h2 className="text-2xl font-black">Meus chamados</h2>
              <p className="text-slate-400 text-sm">
                Acompanhe o andamento e responda a equipe da HC.
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-7">
            <input
              placeholder="Buscar por assunto, mensagem ou status..."
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
              {chamadosFiltrados.length} chamado(s)
            </div>
          </div>

          {chamadosFiltrados.length === 0 ? (
            <div className="border border-blue-900 bg-[#020817] rounded-2xl p-8 text-center text-slate-400">
              Nenhum chamado encontrado.
            </div>
          ) : (
            <div className="space-y-5">
              {chamadosFiltrados.map((item) => {
                const conversa = mensagensDoChamado(item.id)

                return (
                  <div
                    key={item.id}
                    className="border border-blue-900 rounded-3xl p-6 bg-[#020817]"
                  >
                    <div className="flex flex-col lg:flex-row justify-between gap-5 mb-5">
                      <div>
                        <div className="flex gap-3 flex-wrap mb-3">
                          <span className={`px-4 py-2 rounded-xl text-xs font-black ${corStatus(item.status)}`}>
                            {item.status || 'ABERTO'}
                          </span>

                          <span className={`px-4 py-2 rounded-xl text-xs font-black ${corPrioridade(item.prioridade || 'Normal')}`}>
                            {item.prioridade || 'Normal'}
                          </span>

                          {item.embarque_id && (
                            <span className="bg-purple-600 text-white px-4 py-2 rounded-xl text-xs font-black">
                              AWB vinculado
                            </span>
                          )}

                          <span className="bg-slate-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-black">
                            #{item.id?.slice(0, 8)}
                          </span>
                        </div>

                        <h3 className="text-2xl font-black">
                          {item.assunto || 'Sem assunto'}
                        </h3>

                        <p className="text-slate-500 text-sm mt-2">
                          Aberto em {dataHora(item.criado_em)}
                        </p>
                      </div>
                    </div>

                    <div className="border border-blue-900 bg-[#071225] rounded-2xl p-5 mb-5">
                      <p className="text-slate-400 font-bold mb-2">
                        Mensagem inicial
                      </p>

                      <p className="text-slate-300 leading-7 whitespace-pre-wrap">
                        {item.mensagem || '-'}
                      </p>
                    </div>

                    <div className="border border-blue-900 bg-[#071225] rounded-2xl p-5 mb-5">
                      <div className="flex justify-between items-center mb-5">
                        <p className="text-slate-300 font-black">Conversa</p>
                        <span className="text-slate-500 text-sm">
                          {conversa.length} mensagem(ns)
                        </span>
                      </div>

                      {conversa.length === 0 ? (
                        <p className="text-slate-500">Nenhuma mensagem ainda.</p>
                      ) : (
                        <div className="space-y-4">
                          {conversa.map((msg) => {
                            const cliente = msg.autor === 'CLIENTE'

                            return (
                              <div key={msg.id} className={`flex ${cliente ? 'justify-end' : 'justify-start'}`}>
                                <div
                                  className={`max-w-[85%] rounded-2xl p-4 ${
                                    cliente
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-green-900/40 border border-green-600 text-slate-100'
                                  }`}
                                >
                                  <p className="text-xs opacity-80 mb-1">
                                    {cliente ? 'Você' : 'HC Consultoria'}
                                  </p>

                                  <p className="leading-7 whitespace-pre-wrap">
                                    {msg.mensagem}
                                  </p>

                                  <p className="text-xs opacity-70 mt-2">
                                    {dataHora(msg.criado_em)}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {respondendoId === item.id ? (
                      <div>
                        <textarea
                          placeholder="Digite sua resposta..."
                          value={respostaCliente}
                          onChange={(e) => setRespostaCliente(e.target.value)}
                          className="min-h-[120px]"
                        />

                        <div className="flex gap-3 mt-3">
                          <button
                            onClick={() => enviarMensagemCliente(item)}
                            className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-bold"
                          >
                            Enviar mensagem
                          </button>

                          <button
                            onClick={() => {
                              setRespondendoId(null)
                              setRespostaCliente('')
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
                          setRespostaCliente('')
                        }}
                        className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl font-bold"
                      >
                        Responder chamado
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
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