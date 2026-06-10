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
  const [vinculandoId, setVinculandoId] = useState<string | null>(null)
  const [usuarioVinculo, setUsuarioVinculo] = useState('')

  const [form, setForm] = useState({
    usuario_id: '',
    cliente_final: '',
    awb: '',
    transportadora: 'DHL',
    servico: '',
    origem: '',
    destino: '',
    peso_real: '',
    peso_taxado: '',
    status_operacional: 'Em trânsito',
    data_envio: '',
    data_prevista: '',
    observacoes: '',
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

  function nomeUsuario(usuarioId: string) {
    const usuario = usuarios.find((item) => item.id === usuarioId)
    return usuario?.nome || usuario?.email || 'Não vinculado'
  }

  function linkRastreio(item: any) {
  const awb = item.awb || ''
  const transportadora = (item.transportadora || '').toUpperCase()

  if (!awb || awb === 'AGUARDANDO AWB') return ''

  if (transportadora.includes('DHL')) {
    return `https://mydhl.express.dhl/br/pt/tracking.html#/results?id=${awb}`
  }

  if (transportadora.includes('FEDEX')) {
    return `https://www.fedex.com/fedextrack/?trknbr=${awb}`
  }

  if (transportadora.includes('UPS')) {
    return `https://www.ups.com/track?tracknum=${awb}`
  }

  return ''
}

  async function salvar() {
    if (!form.awb) {
      alert('Informe o AWB')
      return
    }

    const usuarioSelecionado = usuarios.find(
      (usuario) => usuario.id === form.usuario_id
    )

    const { error } = await supabase
      .from('embarques')
      .insert([
        {
          usuario_id: form.usuario_id || null,
          cliente_final: form.cliente_final,
          awb: form.awb,
          transportadora: form.transportadora,
          servico: form.servico,
          origem: form.origem,
          destino: form.destino,
          peso_real: form.peso_real,
          peso_taxado: form.peso_taxado,
          status_operacional: 'Aguardando coleta',
          data_envio: null,
          data_prevista: form.data_prevista || null,
          ultima_atualizacao: new Date().toISOString(),
          observacoes: form.observacoes,
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
      transportadora: 'DHL',
      servico: '',
      origem: '',
      destino: '',
      peso_real: '',
      peso_taxado: '',
      status_operacional: 'Em trânsito',
      data_envio: '',
      data_prevista: '',
      observacoes: '',
    })

    carregar()
  }

  async function vincularCliente(embarqueId: string) {
    if (!usuarioVinculo) {
      alert('Selecione um cliente')
      return
    }

    const usuarioSelecionado = usuarios.find(
      (usuario) => usuario.id === usuarioVinculo
    )

    const { error } = await supabase
      .from('embarques')
      .update({
        usuario_id: usuarioVinculo,
        empresa_id: usuarioSelecionado?.empresa_id || null,
        ultima_atualizacao: new Date().toISOString(),
      })
      .eq('id', embarqueId)

    if (error) {
      alert('Erro ao vincular cliente')
      console.log(error)
      return
    }

    alert('Cliente vinculado ao embarque')

    setVinculandoId(null)
    setUsuarioVinculo('')
    carregar()
  }

  async function excluirEmbarque(id: string) {
    const confirmar = confirm('Deseja realmente excluir este embarque?')

    if (!confirmar) return

    await supabase
      .from('timeline_embarques')
      .delete()
      .eq('embarque_id', id)

    const { error } = await supabase
      .from('embarques')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erro ao excluir embarque')
      console.log(error)
      return
    }

    alert('Embarque excluído')
    carregar()
  }

  const embarquesFiltrados = useMemo(() => {
    return embarques.filter((item) => {
      const texto = `
        ${item.awb}
        ${item.cliente_final}
        ${item.transportadora}
        ${item.origem}
        ${item.destino}
        ${item.status_operacional}
        ${nomeUsuario(item.usuario_id)}
      `.toLowerCase()

      const matchBusca = texto.includes(busca.toLowerCase())
      const matchStatus = !filtroStatus || item.status_operacional === filtroStatus
      const matchTransportadora = !filtroTransportadora || item.transportadora === filtroTransportadora

      return matchBusca && matchStatus && matchTransportadora
    })
  }, [embarques, usuarios, busca, filtroStatus, filtroTransportadora])

  const totalEmbarques = embarques.length
  const totalTransito = embarques.filter((e) => e.status_operacional === 'Em trânsito').length
  const totalFiscalizacao = embarques.filter((e) => e.status_operacional === 'Fiscalização').length
  const totalLiberados = embarques.filter((e) => e.status_operacional === 'Liberado').length
  const totalEntregues = embarques.filter((e) => e.status_operacional === 'Entregue').length

  return (
    <main className="max-w-[1600px] mx-auto p-8 text-white">
      <div className="mb-8 flex justify-between items-start gap-6">
        <div>
          <h1 className="text-5xl font-black mb-2">
            Embarques
          </h1>

          <p className="text-slate-400 text-lg">
            Acompanhe e gerencie todos os embarques da HC.
          </p>
        </div>

        <button
          onClick={() => window.scrollTo({ top: 260, behavior: 'smooth' })}
          className="bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold"
        >
          + Novo embarque
        </button>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-8">
        <KpiCard titulo="Total de embarques" valor={totalEmbarques} detalhe="Processos cadastrados" icone="📦" />
        <KpiCard titulo="Em trânsito" valor={totalTransito} detalhe="Em andamento" icone="🚚" />
        <KpiCard titulo="Em fiscalização" valor={totalFiscalizacao} detalhe="Atenção operacional" icone="🛡️" />
        <KpiCard titulo="Liberados" valor={totalLiberados} detalhe="Liberados para seguir" icone="✅" />
        <KpiCard titulo="Entregues" valor={totalEntregues} detalhe="Finalizados" icone="📬" />
      </section>

      <section className="border border-blue-800 rounded-3xl p-7 bg-[#071225] shadow-[0_0_35px_rgba(37,99,235,0.10)] mb-8">
        <div className="flex items-center gap-3 mb-7">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-xl">
            📦
          </div>

          <h2 className="text-2xl font-black">
            Cadastrar novo embarque
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
          <Campo label="Cliente responsável">
            <select
              value={form.usuario_id}
              onChange={(e) => setForm({ ...form, usuario_id: e.target.value })}
            >
              <option value="">Selecione o cliente</option>

              {usuarios.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {usuario.nome || usuario.email}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Cliente final">
            <input
              placeholder="Nome do cliente final"
              value={form.cliente_final}
              onChange={(e) => setForm({ ...form, cliente_final: e.target.value })}
            />
          </Campo>

          <Campo label="AWB">
            <input
              placeholder="Ex: 2545481864"
              value={form.awb}
              onChange={(e) => setForm({ ...form, awb: e.target.value })}
            />
          </Campo>

          <Campo label="Transportadora">
            <select
              value={form.transportadora}
              onChange={(e) => setForm({ ...form, transportadora: e.target.value })}
            >
              <option value="DHL">DHL</option>
              <option value="FedEx">FedEx</option>
              <option value="UPS">UPS</option>
              <option value="Outra">Outra</option>
            </select>
          </Campo>

          <Campo label="Serviço">
            <input
              placeholder="Ex: Express Import"
              value={form.servico}
              onChange={(e) => setForm({ ...form, servico: e.target.value })}
            />
          </Campo>

          <Campo label="Origem">
            <input
              placeholder="País de origem"
              value={form.origem}
              onChange={(e) => setForm({ ...form, origem: e.target.value })}
            />
          </Campo>

          <Campo label="Destino">
            <input
              placeholder="País de destino"
              value={form.destino}
              onChange={(e) => setForm({ ...form, destino: e.target.value })}
            />
          </Campo>

          <Campo label="Peso real (kg)">
            <input
              placeholder="0,00"
              value={form.peso_real}
              onChange={(e) => setForm({ ...form, peso_real: e.target.value })}
            />
          </Campo>

          <Campo label="Peso taxado (kg)">
            <input
              placeholder="0,00"
              value={form.peso_taxado}
              onChange={(e) => setForm({ ...form, peso_taxado: e.target.value })}
            />
          </Campo>

          

          <Campo label="Data prevista">
            <input
              type="date"
              value={form.data_prevista}
              onChange={(e) => setForm({ ...form, data_prevista: e.target.value })}
            />
          </Campo>

          

          <div className="md:col-span-3">
            <Campo label="Observações">
              <textarea
                placeholder="Informações adicionais sobre o embarque"
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                className="min-h-[92px]"
              />
            </Campo>
          </div>
        </div>

        <button
          onClick={salvar}
          className="mt-6 bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold"
        >
          💾 Salvar embarque
        </button>
      </section>

      <section className="border border-blue-800 rounded-3xl p-7 bg-[#071225] shadow-[0_0_35px_rgba(37,99,235,0.10)]">
        <div className="flex justify-between items-center gap-4 mb-7">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-xl">
              📦
            </div>

            <h2 className="text-2xl font-black">
              Embarques cadastrados
            </h2>
          </div>

          <button
            onClick={() => {
              setBusca('')
              setFiltroStatus('')
              setFiltroTransportadora('')
            }}
            className="bg-slate-700 hover:bg-slate-600"
          >
            Limpar filtros
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <input
            placeholder="Buscar por AWB, cliente, origem, destino..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />

          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
  <option value="">Todos os status</option>
  <option value="Aguardando coleta">Aguardando coleta</option>
  <option value="Em trânsito">Em trânsito</option>
  <option value="Fiscalização">Fiscalização</option>
  <option value="Liberado">Liberado</option>
  <option value="Entregue">Entregue</option>
  <option value="Atrasado">Atrasado</option>
  <option value="Aguardando AWB">Aguardando AWB</option>
</select>

          <select
            value={filtroTransportadora}
            onChange={(e) => setFiltroTransportadora(e.target.value)}
          >
            <option value="">Todas transportadoras</option>
            <option value="DHL">DHL</option>
            <option value="FedEx">FedEx</option>
            <option value="UPS">UPS</option>
            <option value="Outra">Outra</option>
          </select>

          <div className="text-slate-400 flex items-center">
            {embarquesFiltrados.length} embarque(s) encontrado(s)
          </div>
        </div>

        <div className="overflow-auto">
          <table className="table">
            <thead>
              <tr>
                <th>AWB</th>
                <th>Cliente responsável</th>
                <th>Cliente final</th>
                <th>Transportadora</th>
                <th>Origem → Destino</th>
                <th>Status</th>
                <th>Data envio</th>
                <th>Previsão</th>
                <th>Última atualização</th>
                <th>Rastreio</th>
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              {embarquesFiltrados.map((item) => (
                <tr key={item.id}>
                  <td>
                    <a
                      href={`/admin/embarques/${item.id}`}
                      className="text-blue-400 hover:text-blue-300 font-black underline"
                    >
                      {item.awb}
                    </a>
                  </td>

                  <td>{nomeUsuario(item.usuario_id)}</td>
                  <td>{item.cliente_final || '-'}</td>
                  <td>{item.transportadora || '-'}</td>

                  <td>
                    {item.origem || '-'} → {item.destino || '-'}
                  </td>

                  <td>
                    <StatusBadge status={item.status_operacional} />
                  </td>

                  <td>
                    {item.data_envio
                      ? new Date(item.data_envio).toLocaleDateString('pt-BR')
                      : '-'}
                  </td>

                  <td>
                    {item.data_prevista
                      ? new Date(item.data_prevista).toLocaleDateString('pt-BR')
                      : '-'}
                  </td>

                  <td>
                    {item.ultima_atualizacao
                      ? new Date(item.ultima_atualizacao).toLocaleString('pt-BR')
                      : '-'}
                  </td>

                  <td>
                    {linkRastreio(item) ? (
                      <a
                        href={linkRastreio(item)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-yellow-500 hover:bg-yellow-400 px-4 py-2 rounded-xl text-black font-bold inline-block"
                      >
                        {item.transportadora || 'Rastrear'}
                      </a>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>

                  <td>
                    <div className="flex gap-2 flex-wrap">
                      <a
                        href={`/admin/embarques/${item.id}`}
                        className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl text-white font-bold"
                      >
                        Ver
                      </a>

                      <button
                        onClick={() => excluirEmbarque(item.id)}
                        className="bg-red-700 hover:bg-red-600"
                      >
                        Excluir
                      </button>

                      {vinculandoId === item.id ? (
                        <div className="flex gap-2 w-full">
                          <select
                            value={usuarioVinculo}
                            onChange={(e) => setUsuarioVinculo(e.target.value)}
                          >
                            <option value="">Selecionar cliente</option>

                            {usuarios.map((usuario) => (
                              <option key={usuario.id} value={usuario.id}>
                                {usuario.nome || usuario.email}
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={() => vincularCliente(item.id)}
                            className="bg-green-600 hover:bg-green-500"
                          >
                            Salvar
                          </button>

                          <button
                            onClick={() => {
                              setVinculandoId(null)
                              setUsuarioVinculo('')
                            }}
                            className="bg-slate-700 hover:bg-slate-600"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setVinculandoId(item.id)
                            setUsuarioVinculo(item.usuario_id || '')
                          }}
                          className="bg-slate-700 hover:bg-slate-600"
                        >
                          Vincular
                        </button>
                      )}
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

function KpiCard({ titulo, valor, detalhe, icone }: any) {
  return (
    <div className="border border-blue-900 rounded-3xl bg-[#071225] p-6 shadow-[0_0_30px_rgba(37,99,235,0.08)]">
      <div className="flex justify-between items-start gap-4">
        <div>
          <p className="text-slate-300 font-bold">
            {titulo}
          </p>

          <h2 className="text-5xl font-black mt-4 text-white">
            {valor}
          </h2>

          <p className="text-slate-400 mt-2">
            {detalhe}
          </p>
        </div>

        <div className="text-4xl">
          {icone}
        </div>
      </div>
    </div>
  )
}

function Campo({ label, children }: any) {
  return (
    <div>
      <label className="block text-slate-300 font-bold mb-2">
        {label}
      </label>

      {children}
    </div>
  )
}