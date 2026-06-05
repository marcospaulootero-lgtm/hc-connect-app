'use client'

import StatusBadge from '@/components/StatusBadge'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function EmbarquesPage() {
  const [embarques, setEmbarques] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])

  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroTransportadora, setFiltroTransportadora] = useState('')

  const [form, setForm] = useState({
    usuario_id: '',
    cliente_final: '',
    awb: '',
    transportadora: '',
    servico: '',
    origem: '',
    destino: '',
    peso_real: '',
    peso_taxado: '',
    status_operacional: '',
  })

  useEffect(() => {
    carregar()
    carregarUsuarios()
  }, [])

  async function carregar() {
    const { data } = await supabase
      .from('embarques')
      .select('*')
      .order('criado_em', { ascending: false })

    setEmbarques(data || [])
  }

  async function carregarUsuarios() {
    const { data } = await supabase
      .from('perfis')
      .select('*')
      .eq('tipo_acesso', 'cliente')
      .order('nome')

    setUsuarios(data || [])
  }

  async function salvar() {
    if (!form.usuario_id || !form.awb) {
      alert('Informe o usuário responsável e o AWB')
      return
    }

    const usuarioSelecionado = usuarios.find(
      (usuario) => usuario.id === form.usuario_id
    )

    const { error } = await supabase
      .from('embarques')
      .insert([
        {
          usuario_id: form.usuario_id,
          cliente_final: form.cliente_final,
          awb: form.awb,
          transportadora: form.transportadora,
          servico: form.servico,
          origem: form.origem,
          destino: form.destino,
          peso_real: form.peso_real,
          peso_taxado: form.peso_taxado,
          status_operacional: form.status_operacional,
          empresa_id: usuarioSelecionado?.empresa_id || null,
        },
      ])

    if (error) {
      alert('Erro ao salvar embarque')
      console.log(error)
      return
    }

    alert('Embarque salvo com sucesso')

    setForm({
      usuario_id: '',
      cliente_final: '',
      awb: '',
      transportadora: '',
      servico: '',
      origem: '',
      destino: '',
      peso_real: '',
      peso_taxado: '',
      status_operacional: '',
    })

    carregar()
  }

  function nomeUsuario(usuarioId: string) {
    const usuario = usuarios.find((item) => item.id === usuarioId)
    return usuario?.nome || usuario?.email || '-'
  }

  const embarquesFiltrados = useMemo(() => {
    return embarques.filter((item) => {
      const texto = `
        ${item.awb}
        ${item.cliente_final}
        ${item.transportadora}
        ${item.origem}
        ${item.destino}
        ${nomeUsuario(item.usuario_id)}
      `.toLowerCase()

      const matchBusca = texto.includes(busca.toLowerCase())

      const matchStatus =
        !filtroStatus ||
        item.status_operacional === filtroStatus

      const matchTransportadora =
        !filtroTransportadora ||
        item.transportadora === filtroTransportadora

      return matchBusca && matchStatus && matchTransportadora
    })
  }, [embarques, usuarios, busca, filtroStatus, filtroTransportadora])

  return (
    <main className="max-w-7xl mx-auto p-6 text-white">
      <div className="mb-10">
        <h1 className="text-4xl font-bold mb-2">
          Embarques
        </h1>

        <p className="text-slate-400">
          Controle operacional dos processos HC.
        </p>
      </div>

      <section className="card">
        <h2 className="text-2xl font-bold mb-6">
          Cadastrar embarque
        </h2>

        <div className="form-grid">
          <select
            value={form.usuario_id}
            onChange={(e) =>
              setForm({
                ...form,
                usuario_id: e.target.value,
              })
            }
          >
            <option value="">
              Selecione o usuário responsável
            </option>

            {usuarios.map((usuario) => (
              <option
                key={usuario.id}
                value={usuario.id}
              >
                {usuario.nome || usuario.email}
              </option>
            ))}
          </select>

          <input
            placeholder="Cliente final"
            value={form.cliente_final}
            onChange={(e) =>
              setForm({
                ...form,
                cliente_final: e.target.value,
              })
            }
          />

          <input
            placeholder="AWB"
            value={form.awb}
            onChange={(e) =>
              setForm({
                ...form,
                awb: e.target.value,
              })
            }
          />

          <input
            placeholder="Transportadora"
            value={form.transportadora}
            onChange={(e) =>
              setForm({
                ...form,
                transportadora: e.target.value,
              })
            }
          />

          <input
            placeholder="Serviço"
            value={form.servico}
            onChange={(e) =>
              setForm({
                ...form,
                servico: e.target.value,
              })
            }
          />

          <input
            placeholder="Origem"
            value={form.origem}
            onChange={(e) =>
              setForm({
                ...form,
                origem: e.target.value,
              })
            }
          />

          <input
            placeholder="Destino"
            value={form.destino}
            onChange={(e) =>
              setForm({
                ...form,
                destino: e.target.value,
              })
            }
          />

          <input
            placeholder="Peso real"
            value={form.peso_real}
            onChange={(e) =>
              setForm({
                ...form,
                peso_real: e.target.value,
              })
            }
          />

          <input
            placeholder="Peso taxado"
            value={form.peso_taxado}
            onChange={(e) =>
              setForm({
                ...form,
                peso_taxado: e.target.value,
              })
            }
          />

          <select
            value={form.status_operacional}
            onChange={(e) =>
              setForm({
                ...form,
                status_operacional: e.target.value,
              })
            }
          >
            <option value="">
              Selecione o status
            </option>

            <option value="Em trânsito">Em trânsito</option>
            <option value="Fiscalização">Fiscalização</option>
            <option value="Liberado">Liberado</option>
            <option value="Entregue">Entregue</option>
            <option value="Atrasado">Atrasado</option>
            <option value="Aguardando AWB">Aguardando AWB</option>
          </select>
        </div>

        <button onClick={salvar} className="mt-6">
          Salvar embarque
        </button>
      </section>

      <section className="card mt-8">
        <h2 className="text-2xl font-bold mb-6">
          Embarques cadastrados
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <input
            placeholder="Buscar AWB, usuário, cliente final..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />

          <select
            value={filtroStatus}
            onChange={(e) =>
              setFiltroStatus(e.target.value)
            }
          >
            <option value="">Todos os status</option>
            <option value="Em trânsito">Em trânsito</option>
            <option value="Fiscalização">Fiscalização</option>
            <option value="Liberado">Liberado</option>
            <option value="Entregue">Entregue</option>
            <option value="Atrasado">Atrasado</option>
            <option value="Aguardando AWB">Aguardando AWB</option>
          </select>

          <select
            value={filtroTransportadora}
            onChange={(e) =>
              setFiltroTransportadora(e.target.value)
            }
          >
            <option value="">Todas transportadoras</option>
            <option value="DHL">DHL</option>
            <option value="FedEx">FedEx</option>
            <option value="UPS">UPS</option>
          </select>
        </div>

        <div className="overflow-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Usuário responsável</th>
                <th>Cliente final</th>
                <th>AWB</th>
                <th>Transportadora</th>
                <th>Origem</th>
                <th>Destino</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {embarquesFiltrados.map((item) => (
                <tr key={item.id}>
                  <td>{nomeUsuario(item.usuario_id)}</td>

                  <td>
                    {item.cliente_final || '-'}
                  </td>

                  <td>
                    <a
                      href={`/admin/embarques/${item.id}`}
                      className="text-blue-400 hover:text-blue-300 font-bold"
                    >
                      {item.awb}
                    </a>
                  </td>

                  <td>{item.transportadora}</td>
                  <td>{item.origem}</td>
                  <td>{item.destino}</td>

                  <td>
                    <StatusBadge
                      status={item.status_operacional}
                    />
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