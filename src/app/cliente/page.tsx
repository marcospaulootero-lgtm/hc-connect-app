'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import StatusBadge from '@/components/StatusBadge'

export default function ClientePage() {
  const [usuario, setUsuario] = useState<any>(null)
  const [embarques, setEmbarques] = useState<any[]>([])
  const [busca, setBusca] = useState('')

  useEffect(() => {
    carregarUsuario()
  }, [])

  async function carregarUsuario() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data: perfil } = await supabase
      .from('perfis')
      .select('*')
      .eq('email', user.email)
      .single()

    setUsuario({
      nome: perfil?.nome || user.email,
      email: user.email,
      tipo: perfil?.tipo_acesso || 'CLIENTE',
      empresa_id: perfil?.empresa_id,
    })

    carregarEmbarques(perfil?.empresa_id)
  }

  async function carregarEmbarques(empresaId: string) {
    const { data, error } = await supabase
      .from('embarques')
      .select(`
        *,
        empresas (
          razao_social
        )
      `)
      .eq('empresa_id', empresaId)
      .order('criado_em', { ascending: false })

    if (error) {
      console.log(error)
      return
    }

    setEmbarques(data || [])
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
      ${item.empresas?.razao_social}
    `.toLowerCase()

    return texto.includes(busca.toLowerCase())
  })

  return (
    <main className="min-h-screen bg-[#020817] text-white p-10">
      <div className="max-w-7xl mx-auto">

        <div className="flex justify-between items-start mb-10">

          <div>
            <h1 className="text-5xl font-bold mb-2">
              Meus embarques
            </h1>

            <p className="text-slate-400 text-lg">
              Acompanhe seus processos, faturas e documentos.
            </p>
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

        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="card">
            <p className="text-slate-400">Total</p>

            <h2 className="text-5xl font-bold mt-4">
              {embarques.length}
            </h2>
          </div>

          <div className="card">
            <p className="text-slate-400">Em trânsito</p>

            <h2 className="text-5xl font-bold mt-4">
              {
                embarques.filter(
                  (e) =>
                    e.status_operacional === 'Em trânsito'
                ).length
              }
            </h2>
          </div>

          <div className="card">
            <p className="text-slate-400">Fiscalização</p>

            <h2 className="text-5xl font-bold mt-4">
              {
                embarques.filter(
                  (e) =>
                    e.status_operacional === 'Fiscalização'
                ).length
              }
            </h2>
          </div>

          <div className="card">
            <p className="text-slate-400">Entregues</p>

            <h2 className="text-5xl font-bold mt-4">
              {
                embarques.filter(
                  (e) =>
                    e.status_operacional === 'Entregue'
                ).length
              }
            </h2>
          </div>
        </div>

        <section className="card mb-8">
          <div className="flex justify-end">
            <input
              className="max-w-md"
              placeholder="Buscar AWB, destino, status..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </section>

        <section className="grid gap-6">
          {filtrados.map((item) => (
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
                    {item.empresas?.razao_social}
                  </p>
                </div>

                <StatusBadge
                  status={item.status_operacional}
                />
              </div>
            </a>
          ))}
        </section>

      </div>
    </main>
  )
}