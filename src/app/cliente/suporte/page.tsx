'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function SuporteClientePage() {
  const [usuario, setUsuario] = useState<any>(null)
  const [chamados, setChamados] = useState<any[]>([])
  const [salvando, setSalvando] = useState(false)

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

    const { error } = await supabase
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

    setSalvando(false)

    if (error) {
  console.log(error)

  alert(
    JSON.stringify(error, null, 2)
  )

  return
}

    alert('Chamado aberto com sucesso')

    setForm({
      assunto: '',
      mensagem: '',
    })

    carregarChamados(usuario.id)
  }

  function corStatus(status: string) {
    if (status === 'ABERTO') return 'bg-yellow-400 text-black'
    if (status === 'EM ANÁLISE') return 'bg-blue-600 text-white'
    if (status === 'RESOLVIDO') return 'bg-green-700 text-white'
    return 'bg-slate-600 text-white'
  }

  return (
    <main className="min-h-screen bg-[#020817] text-white p-10">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 flex justify-between items-start gap-6">
          <div>
            <h1 className="text-5xl font-black mb-2">
              Suporte
            </h1>

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
          <h2 className="text-2xl font-black mb-6">
            Abrir novo chamado
          </h2>

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

          <button
            onClick={abrirChamado}
            disabled={salvando}
            className="mt-5"
          >
            {salvando ? 'Enviando...' : 'Abrir chamado'}
          </button>
        </section>

        <section className="card">
          <h2 className="text-2xl font-black mb-6">
            Meus chamados
          </h2>

          {chamados.length === 0 ? (
            <p className="text-slate-400">
              Nenhum chamado aberto.
            </p>
          ) : (
            <div className="space-y-4">
              {chamados.map((item) => (
                <div
                  key={item.id}
                  className="border border-blue-900 rounded-2xl p-5 bg-[#071225]"
                >
                  <div className="flex justify-between gap-4 mb-3">
                    <div>
                      <h3 className="text-xl font-bold">
                        {item.assunto}
                      </h3>

                      <p className="text-slate-400 text-sm">
                        {item.criado_em
                          ? new Date(item.criado_em).toLocaleString('pt-BR')
                          : '-'}
                      </p>
                    </div>

                    <span className={`px-3 py-1 rounded-full text-sm font-bold h-fit ${corStatus(item.status)}`}>
                      {item.status}
                    </span>
                  </div>

                  <p className="text-slate-300 leading-7">
                    {item.mensagem}
                  </p>

                  {item.resposta && (
                    <div className="mt-4 bg-green-900/20 border border-green-600 rounded-xl p-4">
                      <p className="text-green-400 font-bold mb-2">
                        Resposta da HC
                      </p>

                      <p className="text-slate-300">
                        {item.resposta}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}