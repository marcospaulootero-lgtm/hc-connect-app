'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Volume = {
  quantidade: string
  comprimento_cm: string
  largura_cm: string
  altura_cm: string
  peso_kg: string
}

export default function CotacoesClientePage() {
  const [usuario, setUsuario] = useState<any>(null)
  const [cotacoes, setCotacoes] = useState<any[]>([])
  const [salvando, setSalvando] = useState(false)

  const [form, setForm] = useState({
  cliente_final: '',
  tipo_operacao: '',
  origem: '',
  destino: '',
  descricao_mercadoria: '',
  moeda: 'USD',
  valor_mercadoria: '',
  observacoes: '',
})

  const [volumes, setVolumes] = useState<Volume[]>([
    {
      quantidade: '1',
      comprimento_cm: '',
      largura_cm: '',
      altura_cm: '',
      peso_kg: '',
    },
  ])

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

  function adicionarVolume() {
    setVolumes([
      ...volumes,
      {
        quantidade: '1',
        comprimento_cm: '',
        largura_cm: '',
        altura_cm: '',
        peso_kg: '',
      },
    ])
  }

  function removerVolume(index: number) {
    if (volumes.length === 1) {
      alert('A cotação precisa ter pelo menos um volume.')
      return
    }

    setVolumes(volumes.filter((_, i) => i !== index))
  }

  function atualizarVolume(index: number, campo: keyof Volume, valor: string) {
    const novosVolumes = [...volumes]
    novosVolumes[index][campo] = valor
    setVolumes(novosVolumes)
  }

  function calcularPesoTotal() {
    return volumes.reduce((total, volume) => {
      const qtd = Number(volume.quantidade || 0)
      const peso = Number(volume.peso_kg || 0)
      return total + qtd * peso
    }, 0)
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

    const algumVolumeIncompleto = volumes.some(
      (v) =>
        !v.quantidade ||
        !v.comprimento_cm ||
        !v.largura_cm ||
        !v.altura_cm ||
        !v.peso_kg
    )

    if (algumVolumeIncompleto) {
      alert('Preencha todos os dados dos volumes.')
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
        peso: String(calcularPesoTotal()),
        dimensoes: `${volumes.length} volume(s)`,
        volumes,
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
  descricao_mercadoria: '',
  moeda: 'USD',
  valor_mercadoria: '',
  observacoes: '',
})

    setVolumes([
      {
        quantidade: '1',
        comprimento_cm: '',
        largura_cm: '',
        altura_cm: '',
        peso_kg: '',
      },
    ])

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
              <option value="">Tipo de operação</option>
              <option value="Importação">Importação</option>
              <option value="Exportação">Exportação</option>
              <option value="Courier">Courier</option>
              <option value="Marítimo">Marítimo</option>
              <option value="Aéreo formal">Aéreo formal</option>
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
              placeholder="Descrição da mercadoria"
              value={form.descricao_mercadoria}
              onChange={(e) =>
                setForm({
                  ...form,
                  descricao_mercadoria: e.target.value,
                })
              }
            />

            <select
  value={form.moeda}
  onChange={(e) =>
    setForm({ ...form, moeda: e.target.value })
  }
>
  <option value="USD">USD - Dólar Americano</option>
  <option value="EUR">EUR - Euro</option>
  <option value="BRL">BRL - Real Brasileiro</option>
  <option value="CNY">CNY - Yuan Chinês</option>
</select>

<input
  placeholder="Valor da mercadoria"
  value={form.valor_mercadoria}
  onChange={(e) =>
    setForm({ ...form, valor_mercadoria: e.target.value })
  }
/>
          </div>

          <section className="mt-8">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-2xl font-black">
                  Volumes / caixas
                </h3>

                <p className="text-slate-400">
                  Informe quantidade, dimensões em cm e peso em kg de cada volume.
                </p>
              </div>

              <button type="button" onClick={adicionarVolume}>
                + Adicionar volume
              </button>
            </div>

            <div className="space-y-5">
              {volumes.map((volume, index) => (
                <div
                  key={index}
                  className="border border-blue-900 rounded-3xl p-5 bg-[#071225]"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xl font-bold">
                      Volume {index + 1}
                    </h4>

                    <button
                      type="button"
                      onClick={() => removerVolume(index)}
                      className="bg-red-600 hover:bg-red-500"
                    >
                      Remover
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <input
                      placeholder="Quantidade"
                      value={volume.quantidade}
                      onChange={(e) =>
                        atualizarVolume(index, 'quantidade', e.target.value)
                      }
                    />

                    <input
                      placeholder="Comprimento cm"
                      value={volume.comprimento_cm}
                      onChange={(e) =>
                        atualizarVolume(index, 'comprimento_cm', e.target.value)
                      }
                    />

                    <input
                      placeholder="Largura cm"
                      value={volume.largura_cm}
                      onChange={(e) =>
                        atualizarVolume(index, 'largura_cm', e.target.value)
                      }
                    />

                    <input
                      placeholder="Altura cm"
                      value={volume.altura_cm}
                      onChange={(e) =>
                        atualizarVolume(index, 'altura_cm', e.target.value)
                      }
                    />

                    <input
                      placeholder="Peso kg"
                      value={volume.peso_kg}
                      onChange={(e) =>
                        atualizarVolume(index, 'peso_kg', e.target.value)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 border border-blue-900 rounded-2xl p-5 bg-[#020817]">
              <p className="text-slate-400">Peso total informado</p>
              <h3 className="text-3xl font-black mt-2">
                {calcularPesoTotal()} kg
              </h3>
            </div>
          </section>

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
                  <th>Peso total</th>
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
                    <td>{item.peso} kg</td>
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