'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function SuporteClientePage() {
  const [usuario, setUsuario] = useState<any>(null)
  const [chamados, setChamados] = useState<any[]>([])
  const [mensagens, setMensagens] = useState<any[]>([])
  const [salvando, setSalvando] = useState(false)
  const [respondendoId, setRespondendoId] = useState<string | null>(null)
  const [respostaCliente, setRespostaCliente] = useState('')

  const [form, setForm] = useState({
    assunto: '',
    mensagem: '',
  })

  useEffect(() => {
    carregarUsuario()
  }, [])

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
      alert('Preencha assunto e mensagem')
      return
    }

    setSalvando(true)

    const { data, error } = await supabase
      .from('suporte')
      .insert([
        {
          usuario_id: usuario.id,
          email: usuario.email,
          assunto: form.assunto,
          mensagem: form.mensagem,
          status: 'ABERTO',
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
          assunto: form.assunto,
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
      .update({
        status: 'ABERTO',
      })
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

  return (
    <main className="min-h-screen bg-[#020817] text-white p-10">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 flex justify-between items-start gap-6">
          <div>
            <h1 className="text-5xl font-black mb-2">Suporte</h1>

            <p className="text-slate-400 text-lg">
              Abra chamados e acompanhe as respostas da HC Consultoria.
            </p>
          </div>

          <a
            href="/cliente"
            className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl text-white font-bold"
          >
            Voltar ao portal
          </a>
        </div>

        <section className="card mb-8">
          <h2 className="text-2xl font-black mb-6">Abrir novo chamado</h2>

          <input
            placeholder="Assunto"
            value={form.assunto}
            onChange={(e) => setForm({ ...form, assunto: e.target.value })}
            className="mb-4"
          />

          <textarea
            placeholder="Descreva sua solicitação"
            value={form.mensagem}
            onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
            className="min-h-[160px]"
          />

          <button onClick={abrirChamado} disabled={salvando} className="mt-5">
            {salvando ? 'Enviando...' : 'Abrir chamado'}
          </button>
        </section>

        <section className="card">
          <h2 className="text-2xl font-black mb-6">Meus chamados</h2>

          {chamados.length === 0 ? (
            <p className="text-slate-400">Nenhum chamado aberto.</p>
          ) : (
            <div className="space-y-4">
              {chamados.map((item) => {
                const conversa = mensagensDoChamado(item.id)

                return (
                  <div
                    key={item.id}
                    className="border border-blue-900 rounded-2xl p-5 bg-[#071225]"
                  >
                    <div className="flex justify-between gap-4 mb-3">
                      <div>
                        <h3 className="text-xl font-bold">{item.assunto}</h3>

                        <p className="text-slate-400 text-sm">
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
                        {item.status}
                      </span>
                    </div>

                    <div className="bg-[#020817] border border-blue-950 rounded-xl p-4 mb-4">
                      <p className="text-slate-400 font-bold mb-2">
                        Conversa
                      </p>

                      {conversa.length === 0 ? (
                        <p className="text-slate-500">
                          Nenhuma mensagem ainda.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {conversa.map((msg) => {
                            const cliente = msg.autor === 'CLIENTE'

                            return (
                              <div
                                key={msg.id}
                                className={`flex ${
                                  cliente ? 'justify-end' : 'justify-start'
                                }`}
                              >
                                <div
                                  className={`max-w-[80%] rounded-2xl p-4 ${
                                    cliente
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-green-900/40 border border-green-600 text-slate-100'
                                  }`}
                                >
                                  <p className="text-xs opacity-80 mb-1">
                                    {cliente ? 'Você' : 'HC Consultoria'}
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
                      <div className="mb-4">
                        <textarea
                          placeholder="Digite sua resposta..."
                          value={respostaCliente}
                          onChange={(e) => setRespostaCliente(e.target.value)}
                          className="min-h-[120px]"
                        />

                        <div className="flex gap-3 mt-3">
                          <button
                            onClick={() => enviarMensagemCliente(item)}
                            className="bg-green-600 hover:bg-green-500"
                          >
                            Enviar mensagem
                          </button>

                          <button
                            onClick={() => {
                              setRespondendoId(null)
                              setRespostaCliente('')
                            }}
                            className="bg-slate-700 hover:bg-slate-600"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setRespondendoId(item.id)
                        setRespostaCliente('')
                      }}
                      className="bg-blue-600 hover:bg-blue-500"
                    >
                      Responder chamado
                    </button>
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