'use client'

import StatusBadge from '@/components/StatusBadge'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'


type ServicoFinanceiroEmbarque = {
  nome: string
  valor: string
}

const SERVICOS_OPERACIONAIS = [
  'IMPORTAÇÃO COURIER',
  'EXPORTAÇÃO COURIER',
  'IMPORTAÇÃO FORMAL',
  'EXPORTAÇÃO FORMAL',
  'COURIER',
  'FORMAL',
  'DTA',
  'DUE / DRE',
  'PRESTAÇÃO DE CONTAS',
  'OUTRO',
]

const ITENS_FINANCEIROS_EMBARQUE = [
  'PRESTAÇÃO DE CONTAS',
  'ÁREA REMOTA',
  'MANUSEIO FORMAL',
  'DELIVER FEE DOC',
  'DESCONTO',
  'DGR',
  'TARIFA ADICIONAL P/ CARGA NÃO EMPILHÁVEL',
  'DTA',
  'OUTRAS TAXAS',
  'DUE / DRE',
  'FRETE',
  'FRETE FEDEX',
  'HANDLING',
  'IMPOSTOS',
  'IMPOSTOS R$',
  'DIVERGÊNCIA DE PESO',
  'OVERSIZE PIECE',
  'SEGURO',
  'TAXA DE ALTA DEMANDA',
  'ENTREGA FORA DA ÁREA',
  'COBERTA NÍVEL B',
]

export default function EmbarquesPage() {
  const [embarques, setEmbarques] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [admins, setAdmins] = useState<any[]>([])
  const [vinculos, setVinculos] = useState<any[]>([])

  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroTransportadora, setFiltroTransportadora] = useState('')
  const [filtroArquivamento, setFiltroArquivamento] = useState('ATIVOS')
  const [embarquesSelecionados, setEmbarquesSelecionados] = useState<string[]>([])
  const [arquivandoLote, setArquivandoLote] = useState(false)
  const [abaTela, setAbaTela] = useState<'CADASTRO' | 'LISTAGEM'>('LISTAGEM')
  const [filtroDashboard, setFiltroDashboard] = useState('')

  const [vinculandoId, setVinculandoId] = useState<string | null>(null)
  const [usuariosVinculo, setUsuariosVinculo] = useState<string[]>([])
  const [clienteVinculoLote, setClienteVinculoLote] = useState('')
  const [vinculandoLote, setVinculandoLote] = useState(false)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>(null)
  const [conhecimentoEmbarque, setConhecimentoEmbarque] = useState<File | null>(null)
  const [salvandoEmbarque, setSalvandoEmbarque] = useState(false)

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
    servicos_financeiros: [] as ServicoFinanceiroEmbarque[],

  }

  const [form, setForm] = useState(formInicial)

  useEffect(() => {
    aplicarFiltrosDaDashboard()
    carregar()
    carregarUsuarios()
    carregarAdmins()
  }, [])


  function aplicarFiltrosDaDashboard() {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const origemDashboard = params.get('origem') === 'dashboard' || params.get('dash') === '1'

    if (!origemDashboard) return

    const abaUrl = params.get('aba')
    const statusUrl = params.get('status')
    const transportadoraUrl = params.get('transportadora')
    const arquivamentoUrl = params.get('arquivamento')
    const buscaUrl = params.get('busca')

    if (abaUrl === 'CADASTRO' || abaUrl === 'LISTAGEM') {
      setAbaTela(abaUrl)
    } else {
      setAbaTela('LISTAGEM')
    }

    if (statusUrl) {
      const mapaStatus: Record<string, string> = {
        AGUARDANDO_COLETA: 'Aguardando coleta',
        ETIQUETA_GERADA: 'Etiqueta gerada',
        COLETADO: 'Coletado',
        EM_TRANSITO: 'Em trânsito',
        FISCALIZACAO: 'Fiscalização',
        LIBERADO: 'Liberado',
        SAIU_PARA_ENTREGA: 'Saiu para entrega',
        ENTREGUE: 'Entregue',
        ATRASADO: 'Atrasado',
      }

      const statusFinal = mapaStatus[statusUrl] || statusUrl
      setFiltroStatus(statusFinal)
      setFiltroDashboard(`Dashboard: status ${statusFinal}`)
    }

    if (transportadoraUrl) {
      setFiltroTransportadora(transportadoraUrl)
      setFiltroDashboard((atual) =>
        atual ? `${atual} • transportadora ${transportadoraUrl}` : `Dashboard: transportadora ${transportadoraUrl}`
      )
    }

    if (arquivamentoUrl) {
      setFiltroArquivamento(arquivamentoUrl)
    }

    if (buscaUrl) {
      setBusca(buscaUrl)
      setFiltroDashboard((atual) =>
        atual ? `${atual} • busca ${buscaUrl}` : `Dashboard: busca ${buscaUrl}`
      )
    }

    if (!statusUrl && !transportadoraUrl && !buscaUrl && arquivamentoUrl) {
      setFiltroDashboard(`Dashboard: ${arquivamentoUrl.toLowerCase()}`)
    }
  }

  function numero(valor: any) {
    if (valor === null || valor === undefined || valor === '') return null
    return Number(String(valor).replace(',', '.'))
  }

  function nomeSeguroArquivo(nome: string) {
    const partes = String(nome || 'arquivo')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    return partes || 'arquivo'
  }

  async function anexarConhecimentoEmbarque(embarqueId: string, arquivo: File) {
    const nomeOriginal = arquivo.name || 'conhecimento-embarque.pdf'
    const nomeArquivo = `${embarqueId}/conhecimento-embarque/${Date.now()}-${nomeSeguroArquivo(nomeOriginal)}`

    const { error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(nomeArquivo, arquivo, {
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) {
      console.error('Erro upload conhecimento:', uploadError)
      return uploadError.message
    }

    const { data: publicUrl } = supabase.storage
      .from('documentos')
      .getPublicUrl(nomeArquivo)

    const nomeDocumento = `Conhecimento de Embarque - ${nomeOriginal}`

    const { error: insertError } = await supabase
      .from('documentos_embarques')
      .insert({
        embarque_id: embarqueId,
        nome: nomeDocumento,
        url: publicUrl.publicUrl,
        caminho: nomeArquivo,
      })

    if (insertError) {
      console.error('Erro documento conhecimento:', insertError)
      return insertError.message
    }

    await supabase
      .from('embarques')
      .update({
        documento_url: publicUrl.publicUrl,
        ultima_atualizacao: new Date().toISOString(),
      })
      .eq('id', embarqueId)

    await supabase.from('timeline_embarques').insert({
      embarque_id: embarqueId,
      status: 'CONHECIMENTO DE EMBARQUE',
      descricao: `Conhecimento de Embarque anexado: ${nomeOriginal}`,
    })

    return null
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

  function numeroFinanceiro(valor: any) {
    if (valor === null || valor === undefined || valor === '') return 0
    if (typeof valor === 'number') return valor

    return (
      Number(
        String(valor)
          .replace(/[R$USD\s]/gi, '')
          .replace(/\./g, '')
          .replace(',', '.')
      ) || 0
    )
  }

  function servicosFinanceirosLista(lista: any): ServicoFinanceiroEmbarque[] {
    return Array.isArray(lista)
      ? lista.map((item) => ({
          nome: String(item?.nome || ''),
          valor: item?.valor === null || item?.valor === undefined ? '' : String(item.valor),
        })).filter((item) => item.nome)
      : []
  }

  function itemFinanceiroSelecionado(lista: any, nome: string) {
    return servicosFinanceirosLista(lista).some((item) => item.nome === nome)
  }

  function valorItemFinanceiro(lista: any, nome: string) {
    return servicosFinanceirosLista(lista).find((item) => item.nome === nome)?.valor || ''
  }

  function atualizarItemFinanceiro(lista: any, nome: string, marcado: boolean) {
    const atual = servicosFinanceirosLista(lista)

    if (marcado) {
      if (atual.some((item) => item.nome === nome)) return atual
      return [...atual, { nome, valor: '' }]
    }

    return atual.filter((item) => item.nome !== nome)
  }

  function alterarValorItemFinanceiro(lista: any, nome: string, valor: string) {
    return servicosFinanceirosLista(lista).map((item) =>
      item.nome === nome ? { ...item, valor } : item
    )
  }

  function totalServicosFinanceiros(lista: any) {
    return servicosFinanceirosLista(lista).reduce((acc, item) => {
      const valor = numeroFinanceiro(item.valor)
      const sinal = item.nome === 'DESCONTO' ? -1 : 1
      return acc + valor * sinal
    }, 0)
  }

  function quantidadeServicosFinanceiros(lista: any) {
    return servicosFinanceirosLista(lista).length
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
    setEmbarquesSelecionados([])
    setClienteVinculoLote('')
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
    if (salvandoEmbarque) return

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

    setSalvandoEmbarque(true)

    try {
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
      const servicosFinanceiros = servicosFinanceirosLista(form.servicos_financeiros)
      const totalFinanceiro = totalServicosFinanceiros(servicosFinanceiros)

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

            valor_cobrado_cliente: totalFinanceiro || null,
            moeda_cobranca: form.moeda_cobranca || 'USD',
            taxa_conversao: null,
            spread_percentual: null,
            servicos_financeiros: servicosFinanceiros,

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

      let erroConhecimento: string | null = null

      if (conhecimentoEmbarque) {
        erroConhecimento = await anexarConhecimentoEmbarque(data.id, conhecimentoEmbarque)
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

      if (erroConhecimento) {
        alert(
          'Embarque salvo com sucesso, mas houve erro ao anexar o Conhecimento de Embarque.\n\n' +
            erroConhecimento +
            '\n\nVocê pode anexar o documento depois no detalhe do embarque.'
        )
      } else {
        alert(
          conhecimentoEmbarque
            ? 'Embarque salvo com sucesso e Conhecimento de Embarque anexado para o cliente.'
            : 'Embarque salvo com sucesso'
        )
      }

      setForm(formInicial)
      setConhecimentoEmbarque(null)
      setAbaTela('LISTAGEM')
      carregar()
    } finally {
      setSalvandoEmbarque(false)
    }
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
      servicos_financeiros: servicosFinanceirosLista(item.servicos_financeiros),

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

    const servicosFinanceiros = servicosFinanceirosLista(editForm.servicos_financeiros)
    const totalFinanceiro = totalServicosFinanceiros(servicosFinanceiros)

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

      valor_cobrado_cliente: totalFinanceiro || null,
      moeda_cobranca: editForm.moeda_cobranca || 'USD',
      taxa_conversao: null,
      spread_percentual: null,
      servicos_financeiros: servicosFinanceiros,

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
    const clientesSelecionados = Array.from(new Set(usuariosVinculo))

    const confirmar = confirm(
      clientesSelecionados.length > 0
        ? `Salvar vínculos deste embarque com ${clientesSelecionados.length} cliente(s)?`
        : 'Remover todos os vínculos de cliente deste embarque?'
    )

    if (!confirmar) return

    try {
      const vinculosAtuais = vinculos
        .filter((v) => String(v.embarque_id) === String(embarqueId))
        .map((v) => String(v.cliente_id))

      const clientesParaAdicionar = clientesSelecionados.filter(
        (clienteId) => !vinculosAtuais.includes(String(clienteId))
      )

      const clientesParaRemover = vinculosAtuais.filter(
        (clienteId) => !clientesSelecionados.map(String).includes(String(clienteId))
      )

      if (clientesParaAdicionar.length > 0) {
        const registros = clientesParaAdicionar.map((clienteId) => ({
          embarque_id: embarqueId,
          cliente_id: clienteId,
        }))

        const { error: erroAdicionar } = await supabase
          .from('embarque_clientes')
          .upsert(registros, { onConflict: 'embarque_id,cliente_id' })

        if (erroAdicionar) {
          throw new Error('Erro ao adicionar vínculo: ' + erroAdicionar.message)
        }
      }

      if (clientesParaRemover.length > 0) {
        const { error: erroRemover } = await supabase
          .from('embarque_clientes')
          .delete()
          .eq('embarque_id', embarqueId)
          .in('cliente_id', clientesParaRemover)

        if (erroRemover) {
          throw new Error('Erro ao remover vínculo: ' + erroRemover.message)
        }
      }

      const primeiroClienteId = clientesSelecionados[0] || null
      const primeiroCliente = usuarios.find((u) => u.id === primeiroClienteId)

      const { error: erroEmbarque } = await supabase
        .from('embarques')
        .update({
          usuario_id: primeiroClienteId,
          empresa_id: primeiroCliente?.empresa_id || null,
          ultima_atualizacao: new Date().toISOString(),
        })
        .eq('id', embarqueId)

      if (erroEmbarque) {
        throw new Error('Vínculos salvos, mas houve erro ao atualizar o cliente principal do embarque: ' + erroEmbarque.message)
      }

      alert('Vínculos atualizados com sucesso.')

      setUsuariosVinculo([])
      setVinculandoId(null)

      await carregar()
    } catch (error: any) {
      console.error(error)
      alert('Erro ao salvar vínculos: ' + (error?.message || 'erro desconhecido'))
    }
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

  function alterarSelecaoEmbarque(id: string, marcado: boolean) {
    setEmbarquesSelecionados((atual) =>
      marcado ? Array.from(new Set([...atual, id])) : atual.filter((item) => item !== id)
    )
  }

  function selecionarTodosFiltrados(marcado: boolean) {
    if (!marcado) {
      setEmbarquesSelecionados([])
      return
    }

    setEmbarquesSelecionados(embarquesFiltrados.map((item) => item.id))
  }

  async function vincularSelecionadosAoCliente() {
    if (vinculandoLote) return

    if (embarquesSelecionados.length === 0) {
      alert('Selecione pelo menos um embarque para vincular.')
      return
    }

    if (!clienteVinculoLote) {
      alert('Selecione o cliente/login que receberá os embarques.')
      return
    }

    const cliente = usuarios.find((u) => u.id === clienteVinculoLote)

    if (!cliente) {
      alert('Cliente não encontrado. Atualize a página e tente novamente.')
      return
    }

    const confirmar = confirm(
      `Vincular ${embarquesSelecionados.length} embarque(s) ao cliente ${cliente.nome || cliente.email}?`
    )

    if (!confirmar) return

    setVinculandoLote(true)

    try {
      const registros = embarquesSelecionados.map((embarqueId) => ({
        embarque_id: embarqueId,
        cliente_id: clienteVinculoLote,
      }))

      const { error: erroVinculos } = await supabase
        .from('embarque_clientes')
        .upsert(registros, { onConflict: 'embarque_id,cliente_id' })

      if (erroVinculos) {
        console.error('Erro ao vincular embarques em lote:', erroVinculos)
        alert(erroVinculos.message)
        return
      }

      const { error: erroEmbarques } = await supabase
        .from('embarques')
        .update({
          usuario_id: clienteVinculoLote,
          empresa_id: cliente.empresa_id || null,
          ultima_atualizacao: new Date().toISOString(),
        })
        .in('id', embarquesSelecionados)

      if (erroEmbarques) {
        console.error('Erro ao atualizar usuário principal dos embarques:', erroEmbarques)
        alert(erroEmbarques.message)
        return
      }

      alert(`${embarquesSelecionados.length} embarque(s) vinculado(s) ao cliente com sucesso.`)

      setEmbarquesSelecionados([])
      setClienteVinculoLote('')
      carregar()
    } finally {
      setVinculandoLote(false)
    }
  }

  async function arquivarSelecionados(arquivar: boolean) {
    if (embarquesSelecionados.length === 0) {
      alert('Selecione pelo menos um embarque.')
      return
    }

    const confirmar = confirm(
      arquivar
        ? `Arquivar ${embarquesSelecionados.length} embarque(s) selecionado(s)?`
        : `Restaurar ${embarquesSelecionados.length} embarque(s) selecionado(s)?`
    )

    if (!confirmar) return

    setArquivandoLote(true)

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
      .in('id', embarquesSelecionados)

    if (error) {
      setArquivandoLote(false)
      alert(error.message)
      return
    }

    const timeline = embarquesSelecionados.map((embarqueId) => ({
      embarque_id: embarqueId,
      status: arquivar ? 'ARQUIVADO ADMIN' : 'RESTAURADO ADMIN',
      descricao: arquivar
        ? 'Embarque arquivado em lote no painel administrativo.'
        : 'Embarque restaurado em lote no painel administrativo.',
    }))

    await supabase.from('timeline_embarques').insert(timeline)

    setArquivandoLote(false)
    setEmbarquesSelecionados([])
    alert(arquivar ? 'Embarques arquivados com sucesso.' : 'Embarques restaurados com sucesso.')
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
        ${Array.isArray(item.servicos_financeiros) ? item.servicos_financeiros.map((s: any) => s.nome).join(' ') : ''}
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
  const todosFiltradosSelecionados =
    embarquesFiltrados.length > 0 &&
    embarquesFiltrados.every((item) => embarquesSelecionados.includes(item.id))

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
          onClick={() => setAbaTela('CADASTRO')}
          className="bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold"
        >
          + Novo embarque
        </button>
      </div>

      {filtroDashboard && (
        <section className="mb-6 rounded-2xl border border-blue-500/40 bg-blue-600/10 p-4 text-blue-100">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-blue-300">Filtro aplicado pela Dashboard</p>
              <p className="mt-1 font-bold">{filtroDashboard}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                setBusca('')
                setFiltroStatus('')
                setFiltroTransportadora('')
                setFiltroArquivamento('ATIVOS')
                setFiltroDashboard('')
              }}
              className="w-fit rounded-xl bg-slate-700 px-4 py-2 text-sm font-black text-white hover:bg-slate-600"
            >
              Limpar filtro
            </button>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 md:grid-cols-6 gap-5 mb-8">
        <KpiCard titulo="Total de embarques" valor={totalEmbarques} detalhe="Processos cadastrados" icone="📦" />
        <KpiCard titulo="Em trânsito" valor={totalTransito} detalhe="Em andamento" icone="🚚" />
        <KpiCard titulo="Em fiscalização" valor={totalFiscalizacao} detalhe="Atenção operacional" icone="🛡️" />
        <KpiCard titulo="Liberados" valor={totalLiberados} detalhe="Liberados para seguir" icone="✅" />
        <KpiCard titulo="Entregues" valor={totalEntregues} detalhe="Finalizados" icone="📬" />
        <KpiCard titulo="Arquivados" valor={totalArquivados} detalhe="Ocultos do admin" icone="🗄️" />
      </section>

      <section className="mb-8 border border-blue-900 rounded-3xl bg-[#071225] p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setAbaTela('LISTAGEM')}
            className={
              abaTela === 'LISTAGEM'
                ? 'bg-blue-600 text-white px-6 py-4 rounded-2xl font-black shadow-[0_0_18px_rgba(37,99,235,0.35)]'
                : 'bg-[#020817] hover:bg-blue-600/20 border border-blue-900 text-slate-300 px-6 py-4 rounded-2xl font-black transition'
            }
          >
            📋 Embarques cadastrados
            <span className="block text-xs font-medium mt-1 opacity-80">
              Lista, filtros, rastreio, arquivar e vincular clientes
            </span>
          </button>

          <button
            type="button"
            onClick={() => setAbaTela('CADASTRO')}
            className={
              abaTela === 'CADASTRO'
                ? 'bg-blue-600 text-white px-6 py-4 rounded-2xl font-black shadow-[0_0_18px_rgba(37,99,235,0.35)]'
                : 'bg-[#020817] hover:bg-blue-600/20 border border-blue-900 text-slate-300 px-6 py-4 rounded-2xl font-black transition'
            }
          >
            ➕ Cadastrar embarque
            <span className="block text-xs font-medium mt-1 opacity-80">
              Criar novo processo operacional
            </span>
          </button>
        </div>
      </section>

      {abaTela === 'CADASTRO' && (
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
            <select
              value={form.servico}
              onChange={(e) => setForm({ ...form, servico: e.target.value })}
            >
              <option value="">Selecione o serviço</option>
              {SERVICOS_OPERACIONAIS.map((servico) => (
                <option key={servico} value={servico}>
                  {servico}
                </option>
              ))}
            </select>
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


          <div className="md:col-span-2">
            <label className="block text-slate-300 font-bold mb-2">
              Conhecimento de Embarque
            </label>

            <label className="block border border-blue-900 bg-[#020817] rounded-2xl p-4 cursor-pointer hover:border-blue-500 transition">
              <span className="block font-black text-blue-300">
                📄 Anexar conhecimento
              </span>
              <span className="block text-xs text-slate-500 mt-1">
                PDF, imagem ou documento. O cliente verá este arquivo no detalhe do embarque.
              </span>

              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
                onChange={(e) => setConhecimentoEmbarque(e.target.files?.[0] || null)}
              />
            </label>

            {conhecimentoEmbarque && (
              <div className="mt-3 rounded-xl border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                <p className="font-black">Arquivo selecionado</p>
                <p className="break-all text-xs mt-1">{conhecimentoEmbarque.name}</p>
                <button
                  type="button"
                  onClick={() => setConhecimentoEmbarque(null)}
                  className="mt-2 text-xs font-black text-red-300 hover:text-red-200"
                >
                  Remover arquivo
                </button>
              </div>
            )}
          </div>

          <div className="md:col-span-5 mt-6 border-t border-blue-900 pt-6">
            <h3 className="text-2xl font-black text-green-400">
              Financeiro do Embarque
            </h3>
            <p className="text-slate-400 text-sm mt-1">
              Selecione quais serviços entram neste embarque e informe o valor de cada item. O total será gravado como valor cobrado do embarque.
            </p>
          </div>

          <Campo label="Moeda dos serviços">
            <select
              value={form.moeda_cobranca}
              onChange={(e) => setForm({ ...form, moeda_cobranca: e.target.value })}
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="BRL">BRL</option>
            </select>
          </Campo>

          <div className="md:col-span-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {ITENS_FINANCEIROS_EMBARQUE.map((item) => {
              const selecionado = itemFinanceiroSelecionado(form.servicos_financeiros, item)

              return (
                <div
                  key={item}
                  className={
                    selecionado
                      ? 'border border-green-500 bg-green-500/10 rounded-2xl p-4'
                      : 'border border-blue-900 bg-[#020817] rounded-2xl p-4'
                  }
                >
                  <label className="flex items-center gap-2 font-bold text-sm">
                    <input
                      type="checkbox"
                      checked={selecionado}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          servicos_financeiros: atualizarItemFinanceiro(
                            form.servicos_financeiros,
                            item,
                            e.target.checked
                          ),
                        })
                      }
                    />
                    {item}
                  </label>

                  {selecionado && (
                    <input
                      value={valorItemFinanceiro(form.servicos_financeiros, item)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          servicos_financeiros: alterarValorItemFinanceiro(
                            form.servicos_financeiros,
                            item,
                            e.target.value
                          ),
                        })
                      }
                      placeholder={item === 'DESCONTO' ? 'Valor do desconto' : 'Valor'}
                      className="mt-3"
                    />
                  )}
                </div>
              )
            })}
          </div>

          <div className="md:col-span-5 border border-green-600/50 bg-green-600/10 rounded-2xl p-5">
            <p className="text-slate-400 text-sm font-bold">Total selecionado</p>
            <h3 className="text-3xl font-black text-green-400 mt-2">
              {moeda(totalServicosFinanceiros(form.servicos_financeiros), form.moeda_cobranca || 'USD')}
            </h3>
            <p className="text-slate-500 text-xs mt-1">
              {quantidadeServicosFinanceiros(form.servicos_financeiros)} item(ns) selecionado(s). Desconto entra abatendo do total.
            </p>
          </div>
        </div>

        <button
          onClick={salvar}
          disabled={salvandoEmbarque}
          className="mt-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed px-6 py-4 rounded-2xl font-bold"
        >
          {salvandoEmbarque ? 'Salvando...' : '💾 Salvar embarque'}
        </button>
      </section>
      )}

      {abaTela === 'LISTAGEM' && (
      <section className="border border-blue-800 rounded-3xl p-7 bg-[#071225]">
        <div className="flex justify-between items-center gap-4 mb-7">
          <h2 className="text-2xl font-black">Embarques cadastrados</h2>

          <button
            onClick={() => {
              setBusca('')
              setFiltroStatus('')
              setFiltroTransportadora('')
              setFiltroArquivamento('ATIVOS')
              setEmbarquesSelecionados([])
              setClienteVinculoLote('')
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

        <div className="border border-blue-900 bg-[#020817] rounded-2xl p-4 mb-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <label className="flex items-center gap-3 text-sm font-bold text-slate-300">
            <input
              type="checkbox"
              checked={todosFiltradosSelecionados}
              onChange={(e) => selecionarTodosFiltrados(e.target.checked)}
            />
            Selecionar todos os embarques filtrados
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-slate-400 text-sm">
              {embarquesSelecionados.length} selecionado(s)
            </span>

            <select
              value={clienteVinculoLote}
              onChange={(e) => setClienteVinculoLote(e.target.value)}
              disabled={embarquesSelecionados.length === 0 || vinculandoLote}
              className="min-w-[260px] rounded-xl border border-blue-900 bg-[#071225] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              <option value="">Escolher cliente/login</option>
              {usuarios.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {usuario.nome || usuario.email}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={vincularSelecionadosAoCliente}
              disabled={embarquesSelecionados.length === 0 || !clienteVinculoLote || vinculandoLote}
              className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 px-4 py-3 rounded-xl font-bold text-sm"
            >
              {vinculandoLote ? 'Vinculando...' : 'Vincular selecionados'}
            </button>

            <button
              type="button"
              onClick={() => arquivarSelecionados(true)}
              disabled={embarquesSelecionados.length === 0 || arquivandoLote}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-4 py-3 rounded-xl font-bold text-sm"
            >
              {arquivandoLote ? 'Processando...' : 'Arquivar selecionados'}
            </button>

            <button
              type="button"
              onClick={() => arquivarSelecionados(false)}
              disabled={embarquesSelecionados.length === 0 || arquivandoLote}
              className="bg-green-700 hover:bg-green-600 disabled:opacity-50 px-4 py-3 rounded-xl font-bold text-sm"
            >
              Restaurar selecionados
            </button>

            {embarquesSelecionados.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setEmbarquesSelecionados([])
                  setClienteVinculoLote('')
                }}
                className="bg-blue-700 hover:bg-blue-600 px-4 py-3 rounded-xl font-bold text-sm"
              >
                Limpar seleção
              </button>
            )}
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
                  <label className="inline-flex items-center gap-2 mb-3 text-xs font-bold text-slate-400">
                    <input
                      type="checkbox"
                      checked={embarquesSelecionados.includes(item.id)}
                      onChange={(e) => alterarSelecaoEmbarque(item.id, e.target.checked)}
                    />
                    Selecionar
                  </label>

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
                      <select
                        value={editForm.servico}
                        onChange={(e) => setEditForm({ ...editForm, servico: e.target.value })}
                      >
                        <option value="">Selecione o serviço</option>
                        {SERVICOS_OPERACIONAIS.map((servico) => (
                          <option key={servico} value={servico}>
                            {servico}
                          </option>
                        ))}
                      </select>
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
                      <h3 className="text-xl font-black text-green-400 mb-2">
                        Financeiro do Embarque
                      </h3>
                      <p className="text-slate-400 text-sm">
                        Selecione os serviços financeiros deste embarque. O total será gravado como valor cobrado.
                      </p>
                    </div>

                    <Campo label="Moeda dos serviços">
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

                    <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {ITENS_FINANCEIROS_EMBARQUE.map((item) => {
                        const selecionado = itemFinanceiroSelecionado(editForm.servicos_financeiros, item)

                        return (
                          <div
                            key={item}
                            className={
                              selecionado
                                ? 'border border-green-500 bg-green-500/10 rounded-2xl p-4'
                                : 'border border-blue-900 bg-[#020817] rounded-2xl p-4'
                            }
                          >
                            <label className="flex items-center gap-2 font-bold text-sm">
                              <input
                                type="checkbox"
                                checked={selecionado}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    servicos_financeiros: atualizarItemFinanceiro(
                                      editForm.servicos_financeiros,
                                      item,
                                      e.target.checked
                                    ),
                                  })
                                }
                              />
                              {item}
                            </label>

                            {selecionado && (
                              <input
                                value={valorItemFinanceiro(editForm.servicos_financeiros, item)}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    servicos_financeiros: alterarValorItemFinanceiro(
                                      editForm.servicos_financeiros,
                                      item,
                                      e.target.value
                                    ),
                                  })
                                }
                                placeholder={item === 'DESCONTO' ? 'Valor do desconto' : 'Valor'}
                                className="mt-3"
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>

                    <div className="md:col-span-3 border border-green-600/50 bg-green-600/10 rounded-2xl p-5">
                      <p className="text-slate-400 text-sm font-bold">Total selecionado</p>
                      <h3 className="text-3xl font-black text-green-400 mt-2">
                        {moeda(totalServicosFinanceiros(editForm.servicos_financeiros), editForm.moeda_cobranca || 'USD')}
                      </h3>
                    </div>

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
                  label="Financeiro selecionado"
                  valor={
                    item.servicos_financeiros && Array.isArray(item.servicos_financeiros)
                      ? `${moeda(item.valor_cobrado_cliente, item.moeda_cobranca || 'USD')} • ${item.servicos_financeiros.length} item(ns)`
                      : moeda(item.valor_cobrado_cliente, item.moeda_cobranca || 'USD')
                  }
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
      )}
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