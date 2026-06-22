'use client'

import StatusBadge from '@/components/StatusBadge'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function EmbarquesPage() {
  const [embarques, setEmbarques] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [admins, setAdmins] = useState<any[]>([])
  const [vinculos, setVinculos] = useState<any[]>([])

  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroTransportadora, setFiltroTransportadora] = useState('')
  const [filtroArquivamento, setFiltroArquivamento] = useState('ATIVOS')

  const [vinculandoId, setVinculandoId] = useState<string | null>(null)
  const [usuariosVinculo, setUsuariosVinculo] = useState<string[]>([])

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>(null)

  const formInicial = {
    usuarios_ids: [] as string[],
    responsavel_id: '',
    exportador: '',
    importador: '',
    referencia_cliente: '',
    referencia_hc: '',
    awb: '',
    master: '',
    transportadora: 'DHL',
    servico: '',
    origem: '',
    destino: '',
    peso_real: '',
    peso_taxado: '',
    status_operacional: 'Aguardando coleta',
    data_envio: '',
    data_prevista: '',
    observacoes: '',

    valor_cobrado_cliente: '',
    moeda_cobranca: 'USD',
    taxa_conversao: '',
    spread_percentual: '3',

    
  }

  const [form, setForm] = useState(formInicial)

  useEffect(() => {
    carregar()
    carregarUsuarios()
    carregarAdmins()
  }, [])

  function numero(valor: any) {
    if (valor === null || valor === undefined || valor === '') return null
    return Number(String(valor).replace(',', '.'))
  }

  function moeda(valor: any, moedaBase = 'USD') {
    if (valor === null || valor === undefined || valor === '') return '-'

    const numeroValor = Number(valor)

    if (moedaBase === 'BRL') {
      return numeroValor.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })
    }

    return `${moedaBase} ${numeroValor.toFixed(2)}`
  }

  function calcularDivergencia(pesoInicial: any, pesoFinal: any) {
    const inicial = Number(pesoInicial || 0)
    const final = Number(pesoFinal || 0)

    if (!inicial || !final) return null

    return final - inicial
  }

  async function carregar() {
    const { data: embarquesData } = await supabase
      .from('embarques')
      .select('*')
      .order('criado_em', { ascending: false })

    const { data: vinculosData } = await supabase
      .from('embarque_clientes')
      .select('*')

    setEmbarques(embarquesData || [])
    setVinculos(vinculosData || [])
  }

  async function carregarUsuarios() {
    const { data } = await supabase
      .from('perfis')
      .select('*')
      .eq('tipo_acesso', 'cliente')
      .order('nome')

    setUsuarios(data || [])
  }

  async function carregarAdmins() {
    const { data } = await supabase
      .from('perfis')
      .select('*')
      .in('tipo_acesso', ['admin', 'administrador'])
      .order('nome')

    setAdmins(data || [])
  }

  function clientesDoEmbarque(embarqueId: string) {
    const ids = vinculos
      .filter((v) => v.embarque_id === embarqueId)
      .map((v) => v.cliente_id)

    return usuarios.filter((u) => ids.includes(u.id))
  }

  function nomesClientes(embarqueId: string, usuarioIdAntigo?: string) {
    const clientes = clientesDoEmbarque(embarqueId)

    if (clientes.length > 0) {
      return clientes.map((c) => c.nome || c.email).join(', ')
    }

    const antigo = usuarios.find((u) => u.id === usuarioIdAntigo)
    return antigo?.nome || antigo?.email || 'Não vinculado'
  }

  function alterarSelecaoCliente(id: string, marcado: boolean) {
    setForm((atual) => ({
      ...atual,
      usuarios_ids: marcado
        ? [...atual.usuarios_ids, id]
        : atual.usuarios_ids.filter((item) => item !== id),
    }))
  }

  function alterarSelecaoVinculo(id: string, marcado: boolean) {
    setUsuariosVinculo((atual) =>
      marcado ? [...atual, id] : atual.filter((item) => item !== id)
    )
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

  if (!form.servico || !form.origem || !form.destino) {
    alert('Preencha serviço, origem e destino')
    return
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    alert('Usuário administrador não identificado. Faça login novamente.')
    return
  }

  const { data: perfilAdmin } = await supabase
    .from('perfis')
    .select('nome, email')
    .eq('id', user.id)
    .single()

  const primeiroClienteId = form.usuarios_ids[0] || null
  const primeiroCliente = usuarios.find((u) => u.id === primeiroClienteId)

  const responsavel =
    admins.find((a) => a.id === form.responsavel_id) || perfilAdmin

  const responsavelId = form.responsavel_id || user.id

  const { data, error } = await supabase
    .from('embarques')
    .insert([
      {
        usuario_id: primeiroClienteId,
        empresa_id: primeiroCliente?.empresa_id || null,

        criado_por_admin_id: user.id,
        criado_por_admin_nome: perfilAdmin?.nome || user.email || null,
        criado_por_admin_email: perfilAdmin?.email || user.email || null,

        responsavel_id: responsavelId,
        responsavel_nome: responsavel?.nome || user.email || null,
        responsavel_email: responsavel?.email || user.email || null,

        exportador: form.exportador || null,
        importador: form.importador || null,
        referencia_cliente: form.referencia_cliente || null,
        referencia_hc: form.referencia_hc || null,

        awb: form.awb,
        master: form.master || null,
        data_master: form.master ? new Date().toISOString() : null,
        transportadora: form.transportadora,
        servico: form.servico,
        origem: form.origem,
        destino: form.destino,

        peso_real: numero(form.peso_real),
        peso_taxado: numero(form.peso_taxado),

        valor_cobrado_cliente: numero(form.valor_cobrado_cliente),
        moeda_cobranca: form.moeda_cobranca || 'USD',
        taxa_conversao: numero(form.taxa_conversao),
        spread_percentual: numero(form.spread_percentual) || 3,

        status_operacional: 'Aguardando coleta',
        data_envio: null,
        data_prevista: form.data_prevista || null,
        ultima_atualizacao: new Date().toISOString(),
        observacoes: form.observacoes || null,
      },
    ])
    .select()
    .single()

  if (error) {
    console.error('Erro Supabase:', error)
    alert(error.message)
    return
  }

  if (form.usuarios_ids.length > 0) {
    const registros = form.usuarios_ids.map((clienteId) => ({
      embarque_id: data.id,
      cliente_id: clienteId,
    }))

    const { error: erroVinculos } = await supabase
      .from('embarque_clientes')
      .upsert(registros, { onConflict: 'embarque_id,cliente_id' })

    if (erroVinculos) {
      alert(erroVinculos.message)
      console.error('Erro vínculos:', erroVinculos)
      return
    }
  }

  try {
    await fetch('/api/rastreio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embarque_id: data.id,
      }),
    })
  } catch (erro) {
    console.error('Erro ao atualizar rastreio inicial:', erro)
  }

  alert('Embarque salvo com sucesso')
  setForm(formInicial)
  carregar()
}

  function abrirEdicao(item: any) {
    setEditandoId(item.id)
    setEditForm({
      responsavel_id: item.responsavel_id || '',
      exportador: item.exportador || '',
      importador: item.importador || '',
      referencia_cliente: item.referencia_cliente || '',
      referencia_hc: item.referencia_hc || '',
      awb: item.awb || '',
      master: item.master || '',
      master_original: item.master || '',
      data_master: item.data_master || null,
      transportadora: item.transportadora || 'DHL',
      servico: item.servico || '',
      origem: item.origem || '',
      destino: item.destino || '',
      peso_real: item.peso_real ? String(item.peso_real) : '',
      peso_taxado: item.peso_taxado ? String(item.peso_taxado) : '',
      status_operacional: item.status_operacional || 'Aguardando coleta',
      data_prevista: item.data_prevista || '',
      observacoes: item.observacoes || '',

      valor_cobrado_cliente: item.valor_cobrado_cliente
        ? String(item.valor_cobrado_cliente)
        : '',
      moeda_cobranca: item.moeda_cobranca || 'USD',
      taxa_conversao: item.taxa_conversao ? String(item.taxa_conversao) : '',
      spread_percentual: item.spread_percentual
        ? String(item.spread_percentual)
        : '3',

      peso_inicial_taxado: item.peso_inicial_taxado
        ? String(item.peso_inicial_taxado)
        : '',
      peso_final_taxado: item.peso_final_taxado
        ? String(item.peso_final_taxado)
        : '',
      valor_adicional_peso: item.valor_adicional_peso
        ? String(item.valor_adicional_peso)
        : '',
      mostrar_divergencia_cliente:
        item.mostrar_divergencia_cliente || false,
      observacao_divergencia_peso:
        item.observacao_divergencia_peso || '',
    })
  }

  async function salvarEdicao(id: string) {
    if (!editForm) return

    const responsavel = admins.find((a) => a.id === editForm.responsavel_id)

    const divergenciaCalculada = calcularDivergencia(
      editForm.peso_inicial_taxado,
      editForm.peso_final_taxado
    )

    const dadosAtualizar: any = {
      responsavel_id: responsavel?.id || null,
      responsavel_nome: responsavel?.nome || null,
      responsavel_email: responsavel?.email || null,

      exportador: editForm.exportador || null,
      importador: editForm.importador || null,
      referencia_cliente: editForm.referencia_cliente || null,
      referencia_hc: editForm.referencia_hc || null,

      awb: editForm.awb || null,
      master: editForm.master || null,
      data_master: editForm.master
        ? editForm.master !== editForm.master_original
          ? new Date().toISOString()
          : editForm.data_master || new Date().toISOString()
        : null,
      transportadora: editForm.transportadora || null,
      servico: editForm.servico || null,
      origem: editForm.origem || null,
      destino: editForm.destino || null,

      peso_real: numero(editForm.peso_real),
      peso_taxado: numero(editForm.peso_taxado),

      valor_cobrado_cliente: numero(editForm.valor_cobrado_cliente),
      moeda_cobranca: editForm.moeda_cobranca || 'USD',
      taxa_conversao: numero(editForm.taxa_conversao),
      spread_percentual: numero(editForm.spread_percentual) || 3,

      peso_inicial_taxado: numero(editForm.peso_inicial_taxado),
      peso_final_taxado: numero(editForm.peso_final_taxado),
      divergencia_peso: divergenciaCalculada,
      valor_adicional_peso: numero(editForm.valor_adicional_peso),
      mostrar_divergencia_cliente:
        editForm.mostrar_divergencia_cliente || false,
      observacao_divergencia_peso:
        editForm.observacao_divergencia_peso || null,

      status_operacional: editForm.status_operacional || null,
      data_prevista: editForm.data_prevista || null,
      observacoes: editForm.observacoes || null,
      ultima_atualizacao: new Date().toISOString(),
    }

    if (editForm.status_operacional === 'Entregue') {
      dadosAtualizar.data_entrega = new Date().toISOString().split('T')[0]
    }

    const { error } = await supabase
      .from('embarques')
      .update(dadosAtualizar)
      .eq('id', id)

    if (error) {
      alert(error.message)
      console.error('Erro edição:', error)
      return
    }

    await supabase.from('timeline_embarques').insert({
      embarque_id: id,
      status: 'EDIÇÃO',
      descricao: 'Embarque editado pelo painel administrativo.',
    })

    alert('Embarque atualizado com sucesso')
    setEditandoId(null)
    setEditForm(null)
    carregar()
  }

  async function vincularClientes(embarqueId: string) {
    if (usuariosVinculo.length === 0) {
      alert('Selecione pelo menos um cliente')
      return
    }

    const registros = usuariosVinculo.map((clienteId) => ({
      embarque_id: embarqueId,
      cliente_id: clienteId,
    }))

    const primeiroCliente = usuarios.find((u) => u.id === usuariosVinculo[0])

    const { error: erroVinculos } = await supabase
      .from('embarque_clientes')
      .upsert(registros, { onConflict: 'embarque_id,cliente_id' })

    if (erroVinculos) {
      alert(erroVinculos.message)
      console.error('Erro Supabase:', erroVinculos)
      return
    }

    await supabase
      .from('embarques')
      .update({
        usuario_id: usuariosVinculo[0],
        empresa_id: primeiroCliente?.empresa_id || null,
        ultima_atualizacao: new Date().toISOString(),
      })
      .eq('id', embarqueId)

    alert('Cliente(s) vinculado(s) ao embarque')

    setVinculandoId(null)
    setUsuariosVinculo([])
    carregar()
  }


  async function alternarArquivamentoEmbarque(item: any, arquivar: boolean) {
    const acao = arquivar ? 'arquivar' : 'restaurar'
    const confirmar = confirm(
      arquivar
        ? `Deseja arquivar o embarque ${item.awb || '-'} no painel admin?`
        : `Deseja restaurar o embarque ${item.awb || '-'} para a lista principal?`
    )

    if (!confirmar) return

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('embarques')
      .update({
        arquivado_admin: arquivar,
        arquivado_admin_em: arquivar ? new Date().toISOString() : null,
        arquivado_admin_por: arquivar ? user?.id || null : null,
        ultima_atualizacao: new Date().toISOString(),
      })
      .eq('id', item.id)

    if (error) {
      alert(`Erro ao ${acao} embarque: ${error.message}`)
      console.error('Erro arquivamento admin:', error)
      return
    }

    await supabase.from('timeline_embarques').insert({
      embarque_id: item.id,
      status: arquivar ? 'ARQUIVADO ADMIN' : 'RESTAURADO ADMIN',
      descricao: arquivar
        ? 'Embarque arquivado no painel administrativo.'
        : 'Embarque restaurado no painel administrativo.',
    })

    alert(arquivar ? 'Embarque arquivado no admin.' : 'Embarque restaurado no admin.')
    carregar()
  }

  async function excluirEmbarque(id: string) {
    const confirmar = confirm('Deseja realmente excluir este embarque?')
    if (!confirmar) return

    await supabase.from('embarque_clientes').delete().eq('embarque_id', id)
    await supabase.from('timeline_embarques').delete().eq('embarque_id', id)
    await supabase.from('rastreios_embarques').delete().eq('embarque_id', id)

    const { error } = await supabase.from('embarques').delete().eq('id', id)

    if (error) {
      alert(error.message)
      console.error('Erro Supabase:', error)
      return
    }

    alert('Embarque excluído')
    carregar()
  }

  const embarquesFiltrados = useMemo(() => {
    return embarques.filter((item) => {
      const texto = `
        ${item.awb}
        ${item.master}
        ${item.exportador}
        ${item.importador}
        ${item.referencia_cliente}
        ${item.referencia_hc}
        ${item.transportadora}
        ${item.origem}
        ${item.destino}
        ${item.status_operacional}
        ${item.criado_por_admin_nome}
        ${item.criado_por_admin_email}
        ${item.responsavel_nome}
        ${item.responsavel_email}
        ${item.valor_cobrado_cliente}
        ${item.valor_adicional_peso}
        ${nomesClientes(item.id, item.usuario_id)}
      `.toLowerCase()

      const matchBusca = texto.includes(busca.toLowerCase())
      const matchStatus = !filtroStatus || item.status_operacional === filtroStatus
      const matchTransportadora =
        !filtroTransportadora || item.transportadora === filtroTransportadora
      const matchArquivamento =
        filtroArquivamento === 'TODOS' ||
        (filtroArquivamento === 'ARQUIVADOS'
          ? !!item.arquivado_admin
          : !item.arquivado_admin)

      return matchBusca && matchStatus && matchTransportadora && matchArquivamento
    })
  }, [
    embarques,
    usuarios,
    vinculos,
    busca,
    filtroStatus,
    filtroTransportadora,
    filtroArquivamento,
  ])

  const embarquesAtivos = embarques.filter((e) => !e.arquivado_admin)
  const totalEmbarques = embarquesAtivos.length
  const totalTransito = embarquesAtivos.filter((e) => e.status_operacional === 'Em trânsito').length
  const totalFiscalizacao = embarquesAtivos.filter((e) => e.status_operacional === 'Fiscalização').length
  const totalLiberados = embarquesAtivos.filter((e) => e.status_operacional === 'Liberado').length
  const totalEntregues = embarquesAtivos.filter((e) => e.status_operacional === 'Entregue').length
  const totalArquivados = embarques.filter((e) => e.arquivado_admin).length

  return (
    <main className="w-full max-w-none p-8 text-white">
      <div className="mb-8 flex justify-between items-start gap-6">
        <div>
          <h1 className="text-5xl font-black mb-2">Embarques</h1>
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

      <section className="grid grid-cols-1 md:grid-cols-6 gap-5 mb-8">
        <KpiCard titulo="Total de embarques" valor={totalEmbarques} detalhe="Processos cadastrados" icone="📦" />
        <KpiCard titulo="Em trânsito" valor={totalTransito} detalhe="Em andamento" icone="🚚" />
        <KpiCard titulo="Em fiscalização" valor={totalFiscalizacao} detalhe="Atenção operacional" icone="🛡️" />
        <KpiCard titulo="Liberados" valor={totalLiberados} detalhe="Liberados para seguir" icone="✅" />
        <KpiCard titulo="Entregues" valor={totalEntregues} detalhe="Finalizados" icone="📬" />
        <KpiCard titulo="Arquivados" valor={totalArquivados} detalhe="Ocultos do admin" icone="🗄️" />
      </section>

      <section className="border border-blue-800 rounded-3xl p-7 bg-[#071225] mb-8">
        <h2 className="text-2xl font-black mb-7">Cadastrar novo embarque</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          <div className="border border-slate-700 rounded-2xl p-4">
            <label className="block text-slate-300 font-bold mb-3">
              Clientes vinculados
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[180px] overflow-auto">
              {usuarios.map((usuario) => (
                <label key={usuario.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.usuarios_ids.includes(usuario.id)}
                    onChange={(e) => alterarSelecaoCliente(usuario.id, e.target.checked)}
                  />
                  {usuario.nome || usuario.email}
                </label>
              ))}
            </div>
          </div>

          <Campo label="Responsável pelo embarque">
            <select
              value={form.responsavel_id}
              onChange={(e) => setForm({ ...form, responsavel_id: e.target.value })}
            >
              <option value="">Quem está criando</option>
              {admins.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.nome || admin.email}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
          <Campo label="Exportador">
            <input value={form.exportador} onChange={(e) => setForm({ ...form, exportador: e.target.value })} />
          </Campo>

          <Campo label="Importador">
            <input value={form.importador} onChange={(e) => setForm({ ...form, importador: e.target.value })} />
          </Campo>

          <Campo label="Referência cliente">
            <input value={form.referencia_cliente} onChange={(e) => setForm({ ...form, referencia_cliente: e.target.value })} />
          </Campo>

          <Campo label="Referência HC Consultoria">
            <input value={form.referencia_hc} onChange={(e) => setForm({ ...form, referencia_hc: e.target.value })} />
          </Campo>

          <Campo label="AWB">
            <input value={form.awb} onChange={(e) => setForm({ ...form, awb: e.target.value })} />
          </Campo>

          <Campo label="Master">
            <input
              value={form.master}
              onChange={(e) => setForm({ ...form, master: e.target.value })}
              placeholder="Número master quando gerado"
            />
          </Campo>

          <Campo label="Transportadora">
            <select value={form.transportadora} onChange={(e) => setForm({ ...form, transportadora: e.target.value })}>
              <option value="DHL">DHL</option>
              <option value="FedEx">FedEx</option>
              <option value="UPS">UPS</option>
              <option value="Outra">Outra</option>
            </select>
          </Campo>

          <Campo label="Serviço">
            <input value={form.servico} onChange={(e) => setForm({ ...form, servico: e.target.value })} />
          </Campo>

          <Campo label="Origem">
            <input value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })} />
          </Campo>

          <Campo label="Destino">
            <input value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })} />
          </Campo>

          <Campo label="Peso real (kg)">
            <input value={form.peso_real} onChange={(e) => setForm({ ...form, peso_real: e.target.value })} />
          </Campo>

          <Campo label="Peso taxado (kg)">
            <input value={form.peso_taxado} onChange={(e) => setForm({ ...form, peso_taxado: e.target.value })} />
          </Campo>

          <Campo label="Data prevista">
            <input type="date" value={form.data_prevista} onChange={(e) => setForm({ ...form, data_prevista: e.target.value })} />
          </Campo>

          <div className="md:col-span-3">
            <Campo label="Observações">
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                className="min-h-[92px]"
              />
            </Campo>
          </div>

          <div className="md:col-span-5 mt-6 border-t border-blue-900 pt-6">
            <h3 className="text-2xl font-black text-green-400">
              Financeiro do Embarque
            </h3>
            <p className="text-slate-400 text-sm mt-1">
              Esses valores serão usados automaticamente na aba Faturas quando o embarque for entregue.
            </p>
          </div>

          <Campo label="Valor cobrado ao cliente">
            <input
              value={form.valor_cobrado_cliente}
              onChange={(e) =>
                setForm({ ...form, valor_cobrado_cliente: e.target.value })
              }
              placeholder="Ex: 182,55"
            />
          </Campo>

          <Campo label="Moeda">
            <select
              value={form.moeda_cobranca}
              onChange={(e) =>
                setForm({ ...form, moeda_cobranca: e.target.value })
              }
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="BRL">BRL</option>
            </select>
          </Campo>

          <Campo label="Taxa de conversão">
            <input
              value={form.taxa_conversao}
              onChange={(e) =>
                setForm({ ...form, taxa_conversao: e.target.value })
              }
              placeholder="Ex: 5,2086"
            />
          </Campo>

                    <Campo label="Spread (%)">
            <input
              value={form.spread_percentual}
              onChange={(e) =>
                setForm({ ...form, spread_percentual: e.target.value })
              }
            />
          </Campo>
        </div>

        <button
          onClick={salvar}
          className="mt-6 bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold"
        >
          💾 Salvar embarque
        </button>
      </section>

      <section className="border border-blue-800 rounded-3xl p-7 bg-[#071225]">
        <div className="flex justify-between items-center gap-4 mb-7">
          <h2 className="text-2xl font-black">Embarques cadastrados</h2>

          <button
            onClick={() => {
              setBusca('')
              setFiltroStatus('')
              setFiltroTransportadora('')
              setFiltroArquivamento('ATIVOS')
            }}
            className="bg-slate-700 hover:bg-slate-600 px-4 py-3 rounded-xl font-bold"
          >
            Limpar filtros
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <input
            placeholder="Buscar por AWB, Master, cliente, exportador..."
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

          <select value={filtroTransportadora} onChange={(e) => setFiltroTransportadora(e.target.value)}>
            <option value="">Todas transportadoras</option>
            <option value="DHL">DHL</option>
            <option value="FedEx">FedEx</option>
            <option value="UPS">UPS</option>
            <option value="Outra">Outra</option>
          </select>

          <select value={filtroArquivamento} onChange={(e) => setFiltroArquivamento(e.target.value)}>
            <option value="ATIVOS">Ativos</option>
            <option value="ARQUIVADOS">Arquivados</option>
            <option value="TODOS">Todos</option>
          </select>

          <div className="text-slate-400 flex items-center">
            {embarquesFiltrados.length} embarque(s) encontrado(s)
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {embarquesFiltrados.map((item) => (
            <article
              key={item.id}
              className="border border-blue-900 rounded-3xl bg-[#020817] p-6 shadow-[0_0_20px_rgba(37,99,235,0.08)]"
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
                <div>
                  <p className="text-slate-500 text-sm">AWB</p>
                  <a
                    href={`/admin/embarques/${item.id}`}
                    className="text-3xl font-black text-blue-400 underline break-all"
                  >
                    {item.awb || '-'}
                  </a>

                  <div className="mt-3 flex flex-wrap gap-2 items-center">
                    <StatusBadge status={item.status_operacional} />

                    {item.arquivado_admin && (
                      <span className="bg-slate-600/20 text-slate-300 border border-slate-500 px-3 py-1 rounded-full text-xs font-black">
                        🗄️ Arquivado admin
                      </span>
                    )}

                    <span className="text-slate-400">
                      {item.transportadora || '-'} • {item.servico || '-'}
                    </span>

                    {item.valor_adicional_peso && (
                      <span className="bg-yellow-500/20 text-yellow-300 border border-yellow-500 px-3 py-1 rounded-full text-xs font-black">
                        ⚠️ Divergência de peso
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-slate-500 text-sm">Responsável</p>
                  <p className="font-black">
                    {item.responsavel_nome ||
                      item.responsavel_email ||
                      item.criado_por_admin_nome ||
                      '-'}
                  </p>
                </div>
              </div>

              {editandoId === item.id && editForm ? (
                <div className="border border-blue-900 rounded-2xl p-5 mb-5 bg-[#071225]">
                  <h3 className="text-xl font-black mb-5">Editar embarque</h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Campo label="Responsável">
                      <select
                        value={editForm.responsavel_id}
                        onChange={(e) =>
                          setEditForm({ ...editForm, responsavel_id: e.target.value })
                        }
                      >
                        <option value="">Sem responsável</option>
                        {admins.map((admin) => (
                          <option key={admin.id} value={admin.id}>
                            {admin.nome || admin.email}
                          </option>
                        ))}
                      </select>
                    </Campo>

                    <Campo label="AWB">
                      <input value={editForm.awb} onChange={(e) => setEditForm({ ...editForm, awb: e.target.value })} />
                    </Campo>

                    <Campo label="Master">
                      <input
                        value={editForm.master}
                        onChange={(e) => setEditForm({ ...editForm, master: e.target.value })}
                        placeholder="Número master quando gerado"
                      />
                    </Campo>

                    <Campo label="Status">
                      <select value={editForm.status_operacional} onChange={(e) => setEditForm({ ...editForm, status_operacional: e.target.value })}>
                        <option value="Aguardando coleta">Aguardando coleta</option>
                        <option value="Coletado">Coletado</option>
                        <option value="Em trânsito">Em trânsito</option>
                        <option value="Fiscalização">Fiscalização</option>
                        <option value="Liberado">Liberado</option>
                        <option value="Entregue">Entregue</option>
                        <option value="Atrasado">Atrasado</option>
                        <option value="Aguardando AWB">Aguardando AWB</option>
                      </select>
                    </Campo>

                    <Campo label="Transportadora">
                      <select value={editForm.transportadora} onChange={(e) => setEditForm({ ...editForm, transportadora: e.target.value })}>
                        <option value="DHL">DHL</option>
                        <option value="FedEx">FedEx</option>
                        <option value="UPS">UPS</option>
                        <option value="Outra">Outra</option>
                      </select>
                    </Campo>

                    <Campo label="Serviço">
                      <input value={editForm.servico} onChange={(e) => setEditForm({ ...editForm, servico: e.target.value })} />
                    </Campo>

                    <Campo label="Data prevista">
                      <input type="date" value={editForm.data_prevista} onChange={(e) => setEditForm({ ...editForm, data_prevista: e.target.value })} />
                    </Campo>

                    <Campo label="Exportador">
                      <input value={editForm.exportador} onChange={(e) => setEditForm({ ...editForm, exportador: e.target.value })} />
                    </Campo>

                    <Campo label="Importador">
                      <input value={editForm.importador} onChange={(e) => setEditForm({ ...editForm, importador: e.target.value })} />
                    </Campo>

                    <Campo label="Referência cliente">
                      <input value={editForm.referencia_cliente} onChange={(e) => setEditForm({ ...editForm, referencia_cliente: e.target.value })} />
                    </Campo>

                    <Campo label="Referência HC">
                      <input value={editForm.referencia_hc} onChange={(e) => setEditForm({ ...editForm, referencia_hc: e.target.value })} />
                    </Campo>

                    <Campo label="Origem">
                      <input value={editForm.origem} onChange={(e) => setEditForm({ ...editForm, origem: e.target.value })} />
                    </Campo>

                    <Campo label="Destino">
                      <input value={editForm.destino} onChange={(e) => setEditForm({ ...editForm, destino: e.target.value })} />
                    </Campo>

                    <Campo label="Peso real">
                      <input value={editForm.peso_real} onChange={(e) => setEditForm({ ...editForm, peso_real: e.target.value })} />
                    </Campo>

                    <Campo label="Peso taxado">
                      <input value={editForm.peso_taxado} onChange={(e) => setEditForm({ ...editForm, peso_taxado: e.target.value })} />
                    </Campo>

                    <div className="md:col-span-3 border-t border-blue-900 pt-5 mt-3">
                      <h3 className="text-xl font-black text-green-400 mb-4">
                        Financeiro do Embarque
                      </h3>
                    </div>

                    <Campo label="Valor cobrado ao cliente">
                      <input
                        value={editForm.valor_cobrado_cliente}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            valor_cobrado_cliente: e.target.value,
                          })
                        }
                      />
                    </Campo>

                    <Campo label="Moeda">
                      <select
                        value={editForm.moeda_cobranca}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            moeda_cobranca: e.target.value,
                          })
                        }
                      >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="BRL">BRL</option>
                      </select>
                    </Campo>

                    <Campo label="Taxa de conversão">
                      <input
                        value={editForm.taxa_conversao}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            taxa_conversao: e.target.value,
                          })
                        }
                      />
                    </Campo>

                    <Campo label="Spread (%)">
                      <input
                        value={editForm.spread_percentual}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            spread_percentual: e.target.value,
                          })
                        }
                      />
                    </Campo>

                    <div className="md:col-span-3 border-t border-blue-900 pt-5 mt-3">
                      <h3 className="text-xl font-black text-yellow-400 mb-4">
                        Divergência de Peso
                      </h3>
                    </div>

                    <Campo label="Peso inicial taxado">
                      <input
                        value={editForm.peso_inicial_taxado}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            peso_inicial_taxado: e.target.value,
                          })
                        }
                      />
                    </Campo>

                    <Campo label="Peso final taxado">
                      <input
                        value={editForm.peso_final_taxado}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            peso_final_taxado: e.target.value,
                          })
                        }
                      />
                    </Campo>

                    <Campo label="Valor adicional">
                      <input
                        value={editForm.valor_adicional_peso}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            valor_adicional_peso: e.target.value,
                          })
                        }
                      />
                    </Campo>

                    <div className="flex items-center gap-3 mt-8">
                      <input
                        type="checkbox"
                        checked={editForm.mostrar_divergencia_cliente}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            mostrar_divergencia_cliente: e.target.checked,
                          })
                        }
                      />

                      <span>Mostrar divergência para o cliente</span>
                    </div>

                    <div className="md:col-span-3">
                      <Campo label="Observação da divergência">
                        <textarea
                          value={editForm.observacao_divergencia_peso}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              observacao_divergencia_peso: e.target.value,
                            })
                          }
                          className="min-h-[90px]"
                        />
                      </Campo>
                    </div>

                    <div className="md:col-span-3">
                      <Campo label="Observações">
                        <textarea
                          value={editForm.observacoes}
                          onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })}
                          className="min-h-[90px]"
                        />
                      </Campo>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-5">
                    <button
                      onClick={() => salvarEdicao(item.id)}
                      className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-bold"
                    >
                      Salvar edição
                    </button>

                    <button
                      onClick={() => {
                        setEditandoId(null)
                        setEditForm(null)
                      }}
                      className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <Info label="Clientes" valor={nomesClientes(item.id, item.usuario_id)} />
                <Info label="Criado por" valor={item.criado_por_admin_nome || item.criado_por_admin_email || '-'} />
                <Info label="Exportador" valor={item.exportador || '-'} />
                <Info label="Importador" valor={item.importador || '-'} />
                <Info label="Ref. Cliente" valor={item.referencia_cliente || '-'} />
                <Info label="Ref. HC" valor={item.referencia_hc || '-'} />
                <Info label="Master" valor={item.master || 'Aguardando geração'} />
                <Info label="Origem → Destino" valor={`${item.origem || '-'} → ${item.destino || '-'}`} />
                <Info
                  label="Previsão"
                  valor={
                    item.data_prevista
                      ? new Date(item.data_prevista).toLocaleDateString('pt-BR')
                      : '-'
                  }
                />

                <Info
                  label="Valor cobrado"
                  valor={moeda(item.valor_cobrado_cliente, item.moeda_cobranca || 'USD')}
                />

                <Info
                  label="Divergência peso"
                  valor={
                    item.valor_adicional_peso
                      ? `${moeda(item.valor_adicional_peso, item.moeda_cobranca || 'USD')} • ${item.peso_inicial_taxado || '-'}kg → ${item.peso_final_taxado || '-'}kg`
                      : 'Sem divergência'
                  }
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href={`/admin/embarques/${item.id}`}
                  className="bg-blue-600 hover:bg-blue-500 px-4 py-3 rounded-xl text-white font-bold"
                >
                  Ver detalhes
                </a>

                <button
                  onClick={() => abrirEdicao(item)}
                  className="bg-purple-600 hover:bg-purple-500 px-4 py-3 rounded-xl font-bold"
                >
                  Editar
                </button>

                {linkRastreio(item) && (
                  <a
                    href={linkRastreio(item)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-yellow-500 hover:bg-yellow-400 px-4 py-3 rounded-xl text-black font-bold"
                  >
                    Rastrear
                  </a>
                )}

                <button
                  onClick={() => alternarArquivamentoEmbarque(item, !item.arquivado_admin)}
                  className={
                    item.arquivado_admin
                      ? 'bg-green-700 hover:bg-green-600 px-4 py-3 rounded-xl font-bold'
                      : 'bg-slate-700 hover:bg-slate-600 px-4 py-3 rounded-xl font-bold'
                  }
                >
                  {item.arquivado_admin ? 'Restaurar' : 'Arquivar'}
                </button>

                <button
                  onClick={() => excluirEmbarque(item.id)}
                  className="bg-red-700 hover:bg-red-600 px-4 py-3 rounded-xl font-bold"
                >
                  Excluir
                </button>

                {vinculandoId === item.id ? (
                  <div className="border border-slate-700 rounded-xl p-3 w-full mt-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 max-h-[180px] overflow-auto mb-3">
                      {usuarios.map((usuario) => (
                        <label key={usuario.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={usuariosVinculo.includes(usuario.id)}
                            onChange={(e) => alterarSelecaoVinculo(usuario.id, e.target.checked)}
                          />
                          {usuario.nome || usuario.email}
                        </label>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => vincularClientes(item.id)} className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-xl font-bold">
                        Salvar vínculos
                      </button>

                      <button
                        onClick={() => {
                          setVinculandoId(null)
                          setUsuariosVinculo([])
                        }}
                        className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl font-bold"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      const idsAtuais = vinculos
                        .filter((v) => v.embarque_id === item.id)
                        .map((v) => v.cliente_id)

                      setVinculandoId(item.id)
                      setUsuariosVinculo(idsAtuais)
                    }}
                    className="bg-slate-700 hover:bg-slate-600 px-4 py-3 rounded-xl font-bold"
                  >
                    Vincular clientes
                  </button>
                )}
              </div>
            </article>
          ))}

          {embarquesFiltrados.length === 0 && (
            <div className="border border-blue-900 rounded-3xl bg-[#020817] p-8 text-slate-400">
              Nenhum embarque encontrado.
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

function KpiCard({ titulo, valor, detalhe, icone }: any) {
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

function Campo({ label, children }: any) {
  return (
    <div>
      <label className="block text-slate-300 font-bold mb-2">{label}</label>
      {children}
    </div>
  )
}

function Info({ label, valor }: any) {
  return (
    <div className="border border-blue-950 bg-[#071225] rounded-2xl p-4">
      <p className="text-slate-500 text-sm mb-2">{label}</p>
      <p className="font-bold break-words">{valor}</p>
    </div>
  )
}