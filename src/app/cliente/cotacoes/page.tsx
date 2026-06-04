'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function CotacoesClientePage() {
  const [usuario, setUsuario] = useState<any>(null)
  const [cotacoes, setCotacoes] = useState<any[]>([])
  const [salvando, setSalvando] = useState(false)

  const [form, setForm] = useState({
    cliente_final: '',
    tipo_operacao: '',
    origem: '',
    destino: '',
    peso: '',
    dimensoes: '',
    descricao_mercadoria: '',
    valor_mercadoria: '',
    observacoes: '',
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

    const { data: perfil } = await supabase
      .from('perfis')
      .select('*')
      .eq('email', user.email)
      .single()

    setUsuario(perfil)

    carregarCotacoes(perfil?.codigo_vinculo)
  }

  async function carregarCotacoes(codigo: string) {
    const { data } = await supabase
      .from('cotacoes')
      .select('*')
      .eq('codigo_vinculo', codigo)
      .order('criado_em', { ascending: false })

    setCotacoes(data || [])
  }

  async function enviarCotacao() {
    if (!usuario?.codigo_vinculo) {
      alert('Usuário sem código de vínculo')
      return
    }

    if (!form.tipo_operacao || !form.origem || !form.destino) {
      alert('Informe tipo de operação, origem e destino')
      return
    }

    setSalvando(true)

    const { error } = await supabase.from('cotacoes').insert([
      {
        codigo_vinculo: usuario.codigo_vinculo,
        empresa_id: usuario.empresa_id,
        solicitante_email: usuario.email,
        cliente_final: form.cliente_final,
        tipo_operacao: form.tipo_operacao,
        origem: form.origem,
        destino: form.destino,
        peso: form.peso,
        dimensoes: form.dimensoes,
        descricao_mercadoria: form.descricao_mercadoria,
        valor_mercadoria: form.valor_mercadoria,
        observacoes: form.observacoes,
        status: 'AGUARDANDO ANÁLISE',
      },
    ])

    setSalvando(false)

    if (error) {
      alert('Erro ao enviar cotação')
      console.log(error)
      return
    }

    alert('Solicitação de cotação enviada com sucesso')

    setForm({
      cliente_final: '',
      tipo_operacao: '',
      origem: '',
      destino: '',
      peso: '',
      dimensoes: '',
      descricao_mercadoria: '',
      valor_mercadoria: '',
      observacoes: '',
    })

    carregarCotacoes(usuario.codigo_vinculo)
  }

  return (
    <main className="min-h-screen bg-[#020817] text-white p-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10">
          <h1 className="text-5xl font-black mb-2">
            Cotações
          </h1>

          <p className="text-slate-400 text-lg">
            Solicite novas cotações e acompanhe o andamento.
          </p>
        </div>

        <section className="card mb-8">
          <h2 className="text-2xl font-black mb-6">
            Nova solicitação de cotação
          </h2>

          <div className="form-grid">
            <input
              placeholder="Cliente final"
              value={form.cliente_final}
              onChange={(e) =>
                setForm({ ...form, cliente_final: e.target.value })
              }
            />

            <select
              value={form.tipo_operacao}
              onChange={(e) =>
                setForm({ ...form, tipo_operacao: e.target.value })
              }
            >
              <option value="">
                Tipo de operação
              </option>
              <option value="Importação">
                Importação
              </option>
              <option value="Exportação">
                Exportação
              </option>
              <option value="Courier">
                Courier
              </option>
              <option value="Marítimo">
                Marítimo
              </option>
              <option value="Aéreo formal">
                Aéreo formal
              </option>
            </select>

            <input
              placeholder="Origem"
              value={form.origem}
              onChange={(e) =>
                setForm({ ...form, origem: e.target.value })
              }
            />

            <input
              placeholder="Destino"
              value={form.destino}
              onChange={(e) =>
                setForm({ ...form, destino: e.target.value })
              }
            />

            <input
              placeholder="Peso"
              value={form.peso}
              onChange={(e) =>
                setForm({ ...form, peso: e.target.value })
              }
            />

            <input
              placeholder="Dimensões"
              value={form.dimensoes}
              onChange={(e) =>
                setForm({ ...form, dimensoes: e.target.value })
              }
            />

            <input
              placeholder="Descrição da mercadoria"
              value={form.descricao_mercadoria}
              onChange={(e) =>
                setForm({
                  ...form,
                  descricao_mercadoria: e.target.value,
                })
              }
            />

            <input
              placeholder="Valor da mercadoria"
              value={form.valor_mercadoria}
              onChange={(e) =>
                setForm({ ...form, valor_mercadoria: e.target.value })
              }
            />
          </div>

          <textarea
            placeholder="Observações"
            value={form.observacoes}
            onChange={(e) =>
              setForm({ ...form, observacoes: e.target.value })
            }
            className="mt-5 min-h-[120px]"
          />

          <button
            onClick={enviarCotacao}
            disabled={salvando}
            className="mt-6"
          >
            {salvando ? 'Enviando...' : 'Enviar cotação'}
          </button>
        </section>

        <section className="card">
          <h2 className="text-2xl font-black mb-6">
            Minhas cotações
          </h2>

          <div className="overflow-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Cliente final</th>
                  <th>Operação</th>
                  <th>Origem</th>
                  <th>Destino</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {cotacoes.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {new Date(item.criado_em).toLocaleDateString('pt-BR')}
                    </td>
                    <td>{item.cliente_final}</td>
                    <td>{item.tipo_operacao}</td>
                    <td>{item.origem}</td>
                    <td>{item.destino}</td>
                    <td>
                      <span className="px-3 py-1 rounded-full bg-yellow-400 text-black text-sm font-bold">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}