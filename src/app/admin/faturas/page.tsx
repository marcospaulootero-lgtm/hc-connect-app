'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import StatusBadge from '@/components/StatusBadge'

const LOTE_SUPABASE = 1000
const STORAGE_FILTROS_FATURAS_ADMIN = 'hc_admin_faturas_filtros_v1'

type Embarque = {
  id: string
  awb: string
  usuario_id: string | null
  cliente_final: string | null
  exportador?: string | null
  importador?: string | null
  transportadora: string | null
  status_operacional: string | null
  criado_em?: string | null
  servico?: string | null
  origem?: string | null
  destino?: string | null
  referencia_cliente?: string | null
  referencia_hc?: string | null
  valor_venda?: number | string | null
  valor_fechado?: number | string | null
  valor_cobrado_cliente?: number | string | null
  moeda?: string | null
  moeda_cobranca?: string | null
  taxa_conversao?: number | string | null
  spread?: number | string | null
  peso_real?: number | string | null
  peso_taxado?: number | string | null
}

type Fatura = {
  id: string
  embarque_id: string | null
  usuario_id: string | null
  numero_fatura: string | null
  arquivo_pdf: string | null
  recibo_pdf: string | null
  recibo_nome: string | null
  comprovante_pagamento?: string | null
  data_comprovante?: string | null
  status_pagamento?: string | null
  observacao_pagamento?: string | null
  criado_em: string
  visivel_cliente?: boolean | null
  observacoes?: string | null
  arquivado_admin?: boolean | null
  arquivado_admin_em?: string | null
  arquivado_admin_por?: string | null
  embarques?: any
}

type FinanceiroProcesso = {
  id?: string
  embarque_id?: string | null
  awb?: string | number | null
  numero_awb?: string | number | null
  hawb?: string | number | null
  h_awb?: string | number | null
  valor_cobranca?: number | string | null
  valor_faturado?: number | string | null
  valor_venda?: number | string | null
  valor?: number | string | null
  vencimento_cobranca?: string | null
  vencimento_cliente?: string | null
  vencimento?: string | null
  data_vencimento?: string | null
  recebimento?: string | null
  recebimento_cliente?: string | null
  data_recebimento?: string | null
  data_pagamento?: string | null
  cliente?: string | null
  cliente_final?: string | null
  fatura?: string | null
  numero_fatura?: string | null
}

type DocumentoEmbarque = {
  id: string
  embarque_id: string
  nome?: string | null
  nome_arquivo?: string | null
  filename?: string | null
  tipo?: string | null
  categoria?: string | null
  url?: string | null
  arquivo_url?: string | null
  arquivo_pdf?: string | null
  criado_em?: string | null
}

type ClienteFaturamento = {
  id: string
  codigo_hc?: string | null
  nome_empresa: string | null
  nome_contato?: string | null
  endereco?: string | null
  cidade?: string | null
  estado?: string | null
  cep?: string | null
  cnpj?: string | null
  cpf?: string | null
  email?: string | null
  contato?: string | null
  inscricao_estadual?: string | null
  inscricao_municipal?: string | null
  observacoes?: string | null
  ativo?: boolean | null
  criado_em?: string | null
  atualizado_em?: string | null
}

type ProcessoEmissor = {
  chave: string
  financeiro: FinanceiroProcesso
  embarque: Embarque | null
  awb: string
  cliente: string
  servico: string
  referencia: string
  transportadora: string
  vencimento: string | null
  valor: number
}

type StatusPagamentoFinanceiro = {
  status: 'PAGO' | 'ATRASADO' | 'EM_ABERTO' | 'SEM_FINANCEIRO'
  label: string
  detalhe: string
  classe: string
}

export default function FaturasPage() {
  const [embarques, setEmbarques] = useState<Embarque[]>([])
  const [faturas, setFaturas] = useState<Fatura[]>([])
  const [financeiros, setFinanceiros] = useState<FinanceiroProcesso[]>([])
  const [documentosPorEmbarque, setDocumentosPorEmbarque] = useState<Record<string, DocumentoEmbarque[]>>({})
  const [pacoteAbertoId, setPacoteAbertoId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [enviandoRecibo, setEnviandoRecibo] = useState<string | null>(null)
  const [removendoFatura, setRemovendoFatura] = useState<string | null>(null)

  const [busca, setBusca] = useState('')
  const [filtroDocumento, setFiltroDocumento] = useState('TODOS')
  const [filtroStatusEmbarque, setFiltroStatusEmbarque] = useState('TODOS')
  const [filtroPagamento, setFiltroPagamento] = useState('TODOS')
  const [filtroArquivamento, setFiltroArquivamento] = useState('ATIVAS')
  const [filtrosCarregados, setFiltrosCarregados] = useState(false)

  const [embarqueSelecionado, setEmbarqueSelecionado] = useState<Embarque | null>(null)
  const [numeroFatura, setNumeroFatura] = useState('')
  const [visivelCliente, setVisivelCliente] = useState(true)
  const [observacoes, setObservacoes] = useState('')
  const [arquivoPdf, setArquivoPdf] = useState<File | null>(null)

  const [abaFaturas, setAbaFaturas] = useState<'LISTA' | 'EMISSOR'>('LISTA')
  const [clientesFaturamento, setClientesFaturamento] = useState<ClienteFaturamento[]>([])
  const [buscaClienteFaturamento, setBuscaClienteFaturamento] = useState('')
  const [clienteFaturamentoId, setClienteFaturamentoId] = useState('')
  const [buscaProcessoEmissor, setBuscaProcessoEmissor] = useState('')
  const [processosSelecionados, setProcessosSelecionados] = useState<string[]>([])
  const [numeroFaturaEmissor, setNumeroFaturaEmissor] = useState('')
  const [vencimentoFaturaEmissor, setVencimentoFaturaEmissor] = useState('')
  const [observacoesEmissor, setObservacoesEmissor] = useState('')
  const [mostrarPreviewEmissor, setMostrarPreviewEmissor] = useState(false)

  useEffect(() => {
    carregar()
  }, [])

  useEffect(() => {
    try {
      const filtrosSalvos = localStorage.getItem(STORAGE_FILTROS_FATURAS_ADMIN)

      if (filtrosSalvos) {
        const filtros = JSON.parse(filtrosSalvos)

        setBusca(filtros.busca || '')
        setFiltroDocumento(filtros.filtroDocumento || 'TODOS')
        setFiltroStatusEmbarque(filtros.filtroStatusEmbarque || 'TODOS')
        setFiltroPagamento(filtros.filtroPagamento || 'TODOS')
        setFiltroArquivamento(filtros.filtroArquivamento || 'ATIVAS')
      }
    } catch (error) {
      console.log('Não foi possível carregar filtros salvos:', error)
    } finally {
      setFiltrosCarregados(true)
    }
  }, [])

  useEffect(() => {
    if (!filtrosCarregados) return

    try {
      localStorage.setItem(
        STORAGE_FILTROS_FATURAS_ADMIN,
        JSON.stringify({
          busca,
          filtroDocumento,
          filtroStatusEmbarque,
          filtroPagamento,
          filtroArquivamento,
        })
      )
    } catch (error) {
      console.log('Não foi possível salvar filtros:', error)
    }
  }, [
    busca,
    filtroDocumento,
    filtroStatusEmbarque,
    filtroPagamento,
    filtroArquivamento,
    filtrosCarregados,
  ])

  async function carregar() {
    const { data: embarquesData, error: erroEmbarques } = await supabase
      .from('embarques')
      .select('*')
      .order('criado_em', { ascending: false })

    if (erroEmbarques) console.log(erroEmbarques)

    const { data: faturasData, error: erroFaturas } = await supabase
      .from('faturas')
      .select(`
        id,
        embarque_id,
        usuario_id,
        numero_fatura,
        arquivo_pdf,
        recibo_pdf,
        recibo_nome,
        comprovante_pagamento,
        data_comprovante,
        status_pagamento,
        observacao_pagamento,
        criado_em,
        visivel_cliente,
        observacoes,
        arquivado_admin,
        arquivado_admin_em,
        arquivado_admin_por,
        embarques (
          awb,
          cliente_final,
          exportador,
          importador,
          transportadora,
          status_operacional
        )
      `)
      .order('criado_em', { ascending: false })

    if (erroFaturas) console.log(erroFaturas)

    const { data: clientesFaturamentoData, error: erroClientesFaturamento } = await supabase
      .from('clientes_faturamento')
      .select('*')
      .order('nome_empresa', { ascending: true })

    if (erroClientesFaturamento) {
      console.log('ERRO CLIENTES FATURAMENTO:', erroClientesFaturamento)
    }

    const { count: totalFinanceiro, error: erroCountFinanceiro } = await supabase
      .from('financeiro_embarques')
      .select('*', { count: 'exact', head: true })

    if (erroCountFinanceiro) console.log('ERRO COUNT FINANCEIRO:', erroCountFinanceiro)

    let financeiroData: any[] = []

    const total = totalFinanceiro || 0
    const paginasFinanceiro = Math.max(1, Math.ceil(total / LOTE_SUPABASE))

    if (total > 0) {
      const consultasFinanceiro = Array.from({ length: paginasFinanceiro }, (_, index) => {
        const inicio = index * LOTE_SUPABASE
        const fim = inicio + LOTE_SUPABASE - 1

        return supabase
          .from('financeiro_embarques')
          .select('*')
          .range(inicio, fim)
      })

      const respostasFinanceiro = await Promise.all(consultasFinanceiro)
      const erroFinanceiro = respostasFinanceiro.find((res) => res.error)

      if (erroFinanceiro?.error) {
        console.log('ERRO FINANCEIRO:', erroFinanceiro.error)
      }

      financeiroData = respostasFinanceiro.flatMap((res) => res.data || [])
    }

    const idsEmbarques = ((embarquesData as Embarque[]) || []).map((item) => item.id)
    let documentosAgrupados: Record<string, DocumentoEmbarque[]> = {}

    if (idsEmbarques.length > 0) {
      const { data: documentosData, error: erroDocumentos } = await supabase
        .from('documentos_embarques')
        .select('*')
        .in('embarque_id', idsEmbarques)

      if (erroDocumentos) {
        console.log('ERRO DOCUMENTOS EMBARQUES:', erroDocumentos)
      }

      ;((documentosData as DocumentoEmbarque[]) || []).forEach((doc) => {
        if (!doc.embarque_id) return
        if (!documentosAgrupados[doc.embarque_id]) documentosAgrupados[doc.embarque_id] = []
        documentosAgrupados[doc.embarque_id].push(doc)
      })
    }

    setClientesFaturamento((clientesFaturamentoData as ClienteFaturamento[]) || [])
    setEmbarques((embarquesData as Embarque[]) || [])
    setFaturas((faturasData as Fatura[]) || [])
    setFinanceiros((financeiroData as FinanceiroProcesso[]) || [])
    setDocumentosPorEmbarque(documentosAgrupados)
  }

  function normalizarAwb(valor?: any) {
    return String(valor || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
  }

  function awbsFinanceiro(item: FinanceiroProcesso) {
    return [
      item.awb,
      item.numero_awb,
      item.hawb,
      item.h_awb,
    ]
      .map((valor) => normalizarAwb(valor as any))
      .filter(Boolean)
  }

  function faturaDoEmbarque(embarqueId: string) {
    return faturas.find((f) => f.embarque_id === embarqueId) || null
  }

  function financeiroDoEmbarque(embarque: Embarque) {
    if (!embarque) return null

    // Regra principal correta: se existir embarque_id no financeiro, usa ele.
    const porEmbarqueId =
      financeiros.find((item) => String(item.embarque_id || '') === String(embarque.id || '')) ||
      null

    if (porEmbarqueId) return porEmbarqueId

    // Fallback: enquanto financeiro_embarques ainda não tiver embarque_id em todos os registros,
    // procura pelo AWB de forma forte, inclusive se vier com pontuação, texto, aspas ou outro nome de coluna.
    const awbLimpo = normalizarAwb(embarque.awb)
    if (!awbLimpo) return null

    return (
      financeiros.find((item) => {
        const awbsDiretos = awbsFinanceiro(item)

        if (awbsDiretos.includes(awbLimpo)) return true

        return Object.values(item || {}).some((valor) => {
          const valorNormalizado = normalizarAwb(valor as any)
          if (!valorNormalizado) return false

          if (valorNormalizado === awbLimpo) return true

          // Ex.: campo vindo como "AWB 9284060166" ou "9284060166 / 123".
          if (awbLimpo.length >= 8 && valorNormalizado.includes(awbLimpo)) return true
          if (valorNormalizado.length >= 8 && awbLimpo.includes(valorNormalizado)) return true

          return false
        })
      }) ||
      null
    )
  }

  function embarqueDoFinanceiro(financeiro: FinanceiroProcesso) {
    if (!financeiro) return null

    if (financeiro.embarque_id) {
      const porId = embarques.find((item) => String(item.id) === String(financeiro.embarque_id))
      if (porId) return porId
    }

    const awbs = awbsFinanceiro(financeiro)
    if (awbs.length === 0) return null

    return (
      embarques.find((embarque) => {
        const awbEmbarque = normalizarAwb(embarque.awb)
        if (!awbEmbarque) return false

        return awbs.some((awb) => {
          if (awb === awbEmbarque) return true
          if (awb.length >= 8 && awbEmbarque.includes(awb)) return true
          if (awbEmbarque.length >= 8 && awb.includes(awbEmbarque)) return true
          return false
        })
      }) || null
    )
  }

  function valorFinanceiro(item?: FinanceiroProcesso | null) {
    if (!item) return 0

    // Mesmo campo usado em Financeiro > Processos Faturados.
    return (
      numero(item.valor_cobranca) ||
      numero(item.valor_faturado) ||
      numero(item.valor_venda) ||
      numero(item.valor)
    )
  }

  function vencimentoFinanceiro(item?: FinanceiroProcesso | null) {
    if (!item) return null

    // No banco, o campo da coluna "Vencimento cliente" é vencimento_cobranca.
    return (
      item.vencimento_cobranca ||
      item.vencimento_cliente ||
      item.vencimento ||
      item.data_vencimento ||
      null
    )
  }

  function recebimentoFinanceiro(item?: FinanceiroProcesso | null) {
    if (!item) return null

    // Mesmo campo usado em Financeiro > Processos Faturados.
    return (
      item.recebimento ||
      item.recebimento_cliente ||
      item.data_recebimento ||
      item.data_pagamento ||
      null
    )
  }

  function statusOperacionaisDisponiveis() {
    return Array.from(
      new Set(
        embarques
          .map((item) => item.status_operacional)
          .filter(Boolean)
      )
    ).sort((a: any, b: any) => String(a).localeCompare(String(b), 'pt-BR'))
  }

  function dataBR(data?: string | null) {
    if (!data) return '-'

    const texto = String(data).slice(0, 10)
    const [ano, mes, dia] = texto.split('-')

    if (ano && mes && dia) return `${dia}/${mes}/${ano}`

    return new Date(data).toLocaleDateString('pt-BR')
  }

  function normalizarData(valor: any) {
    if (!valor) return null

    if (valor instanceof Date && !isNaN(valor.getTime())) {
      return valor.toISOString().split('T')[0]
    }

    if (typeof valor === 'number') {
      const data = new Date((valor - 25569) * 86400 * 1000)
      return data.toISOString().split('T')[0]
    }

    const texto = String(valor).trim()
    if (!texto || texto === '0') return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto

    const partes = texto.split('/')
    if (partes.length === 3) {
      const [dia, mes, ano] = partes
      return `${ano.padStart(4, '20')}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
    }

    return null
  }

  function moeda(valor?: number | string | null) {
    return Number(valor || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  function numero(valor: any) {
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

  function texto(valor: any) {
    return String(valor || '').trim()
  }

  function normalizarTexto(valor: any) {
    return texto(valor)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
  }

  function limparDocumentoFiscal(valor?: any) {
    return String(valor || '').replace(/\D/g, '')
  }

  function formatarCnpjCpf(valor?: any) {
    const numeros = limparDocumentoFiscal(valor)

    if (numeros.length === 14) {
      return numeros.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    }

    if (numeros.length === 11) {
      return numeros.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
    }

    return texto(valor) || '-'
  }

  function documentoFiscalCliente(cliente?: ClienteFaturamento | null) {
    if (!cliente) return '-'
    if (cliente.cnpj) return formatarCnpjCpf(cliente.cnpj)
    if (cliente.cpf) return formatarCnpjCpf(cliente.cpf)
    return '-'
  }

  function enderecoFiscalCliente(cliente?: ClienteFaturamento | null) {
    if (!cliente) return '-'

    const partes = [
      cliente.endereco,
      cliente.cidade,
      cliente.estado,
      cliente.cep ? `CEP ${cliente.cep}` : '',
    ].filter(Boolean)

    return partes.join(' - ') || '-'
  }

  function escaparHtml(valor: any) {
    return String(valor || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')
  }

  function moedaFechada(embarque: Embarque, financeiro: FinanceiroProcesso | null) {
    const valorFin = valorFinanceiro(financeiro)

    if (valorFin > 0) return moeda(valorFin)

    const valor =
      numero(embarque.valor_fechado) ||
      numero(embarque.valor_cobrado_cliente) ||
      numero(embarque.valor_venda)

    if (!valor) return '-'

    const moedaBase = normalizarTexto(embarque.moeda_cobranca || embarque.moeda || 'BRL')

    if (moedaBase === 'BRL' || !moedaBase) return moeda(valor)

    return `${moedaBase} ${valor.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  function documentosDoEmbarque(embarqueId: string) {
    return documentosPorEmbarque[embarqueId] || []
  }

  function nomeDocumento(doc: DocumentoEmbarque) {
    return texto(doc.nome || doc.nome_arquivo || doc.filename || doc.tipo || doc.categoria || 'Documento')
  }

  function urlDocumento(doc: DocumentoEmbarque) {
    return texto(doc.url || doc.arquivo_url || doc.arquivo_pdf)
  }

  function documentoEhCotacao(doc: DocumentoEmbarque) {
    const base = normalizarTexto(`${nomeDocumento(doc)} ${doc.tipo || ''} ${doc.categoria || ''}`)
    return (
      base.includes('COTACAO') ||
      base.includes('ORCAMENTO') ||
      base.includes('PROPOSTA') ||
      base.includes('QUOTE')
    )
  }

  function cotacoesDoEmbarque(embarqueId: string) {
    return documentosDoEmbarque(embarqueId).filter(documentoEhCotacao)
  }

  function hojeISO() {
    return new Date().toISOString().slice(0, 10)
  }

  function statusPagamentoFinanceiro(financeiro: FinanceiroProcesso | null): StatusPagamentoFinanceiro {
    if (!financeiro) {
      return {
        status: 'SEM_FINANCEIRO',
        label: 'Não lançado',
        detalhe: 'Sem registro em Processos Faturados',
        classe: 'border-slate-600 bg-slate-700/20 text-slate-300',
      }
    }

    const recebimento = normalizarData(recebimentoFinanceiro(financeiro))
    const vencimento = normalizarData(vencimentoFinanceiro(financeiro))
    const valor = valorFinanceiro(financeiro)

    // Igual ao Financeiro: se tem recebimento, é PAGO.
    if (recebimento) {
      return {
        status: 'PAGO',
        label: `Pago em ${dataBR(recebimento)}`,
        detalhe: moeda(valor),
        classe: 'border-green-500 bg-green-600/20 text-green-300',
      }
    }

    // Igual ao Financeiro: sem recebimento + vencido = ATRASADO.
    if (vencimento && vencimento < hojeISO()) {
      return {
        status: 'ATRASADO',
        label: `Vencido desde ${dataBR(vencimento)}`,
        detalhe: moeda(valor),
        classe: 'border-red-500 bg-red-600/20 text-red-300',
      }
    }

    if (vencimento) {
      return {
        status: 'EM_ABERTO',
        label: `Em aberto até ${dataBR(vencimento)}`,
        detalhe: moeda(valor),
        classe: 'border-yellow-500 bg-yellow-500/20 text-yellow-300',
      }
    }

    return {
      status: 'EM_ABERTO',
      label: 'Em aberto',
      detalhe: moeda(valor),
      classe: 'border-yellow-500 bg-yellow-500/20 text-yellow-300',
    }
  }


  function statusComprovanteFatura(fatura?: Fatura | null) {
    if (!fatura?.arquivo_pdf) {
      return {
        label: '-',
        detalhe: 'Sem fatura',
        classe: 'border-slate-600 bg-slate-700/20 text-slate-400',
      }
    }

    if (!fatura.comprovante_pagamento) {
      return {
        label: 'Não enviado',
        detalhe: 'Cliente ainda não anexou',
        classe: 'border-slate-600 bg-slate-700/20 text-slate-300',
      }
    }

    const status = String(fatura.status_pagamento || 'COMPROVANTE ENVIADO').toUpperCase()

    if (status === 'PAGO') {
      return {
        label: 'Aprovado',
        detalhe: fatura.data_comprovante ? `Enviado em ${dataBR(fatura.data_comprovante)}` : 'Comprovante aprovado',
        classe: 'border-green-500 bg-green-600/20 text-green-300',
      }
    }

    if (status === 'COMPROVANTE REJEITADO') {
      return {
        label: 'Rejeitado',
        detalhe: fatura.observacao_pagamento || 'Aguardando reenvio do cliente',
        classe: 'border-red-500 bg-red-600/20 text-red-300',
      }
    }

    return {
      label: 'Enviado pelo cliente',
      detalhe: fatura.data_comprovante ? `Enviado em ${dataBR(fatura.data_comprovante)}` : 'Aguardando análise',
      classe: 'border-yellow-500 bg-yellow-500/20 text-yellow-300',
    }
  }

  function extrairCaminhoStorage(url?: string | null) {
    if (!url) return null
    const marcador = '/storage/v1/object/public/faturas/'
    if (!url.includes(marcador)) return null
    return url.split(marcador)[1] || null
  }

  const embarquesFiltrados = useMemo(() => {
    return embarques.filter((e) => {
      const fatura = faturaDoEmbarque(e.id)
      const financeiro = financeiroDoEmbarque(e)
      const pagamento = statusPagamentoFinanceiro(financeiro)

      const texto = `
        ${e.awb || ''}
        ${e.cliente_final || ''}
        ${e.exportador || ''}
        ${e.importador || ''}
        ${e.transportadora || ''}
        ${e.servico || ''}
        ${e.referencia_cliente || ''}
        ${e.referencia_hc || ''}
        ${fatura?.numero_fatura || ''}
        ${fatura?.status_pagamento || ''}
        ${fatura?.observacao_pagamento || ''}
        ${fatura?.comprovante_pagamento ? 'comprovante enviado' : ''}
        ${documentosDoEmbarque(e.id).map(nomeDocumento).join(' ')}
      `.toLowerCase()

      const passaBusca = texto.includes(busca.toLowerCase())

      const passaDocumento =
        filtroDocumento === 'TODOS' ||
        (filtroDocumento === 'COM_FATURA' && !!fatura?.arquivo_pdf) ||
        (filtroDocumento === 'SEM_FATURA' && !fatura?.arquivo_pdf) ||
        (filtroDocumento === 'COM_RECIBO' && !!fatura?.recibo_pdf) ||
        (filtroDocumento === 'SEM_RECIBO' && !!fatura?.arquivo_pdf && !fatura?.recibo_pdf) ||
        (filtroDocumento === 'COM_COMPROVANTE' && !!fatura?.comprovante_pagamento) ||
        (filtroDocumento === 'SEM_COMPROVANTE' && !!fatura?.arquivo_pdf && !fatura?.comprovante_pagamento) ||
        (filtroDocumento === 'VISIVEL' && !!fatura?.visivel_cliente) ||
        (filtroDocumento === 'OCULTO' && fatura && !fatura?.visivel_cliente)

      const passaStatusEmbarque =
        filtroStatusEmbarque === 'TODOS' ||
        e.status_operacional === filtroStatusEmbarque

      const passaPagamento =
        filtroPagamento === 'TODOS' ||
        (filtroPagamento === 'PAGO' && pagamento.status === 'PAGO') ||
        (filtroPagamento === 'ATRASADO' && pagamento.status === 'ATRASADO') ||
        (filtroPagamento === 'EM_ABERTO' && pagamento.status === 'EM_ABERTO') ||
        (filtroPagamento === 'SEM_FINANCEIRO' && pagamento.status === 'SEM_FINANCEIRO') ||
        (filtroPagamento === 'SEM_FATURA' && !fatura)

      const passaArquivamento =
        filtroArquivamento === 'TODAS' ||
        (filtroArquivamento === 'ARQUIVADAS'
          ? !!fatura?.arquivado_admin
          : !fatura?.arquivado_admin)

      return (
        passaBusca &&
        passaDocumento &&
        passaStatusEmbarque &&
        passaPagamento &&
        passaArquivamento
      )
    })
  }, [
    embarques,
    faturas,
    financeiros,
    documentosPorEmbarque,
    busca,
    filtroDocumento,
    filtroStatusEmbarque,
    filtroPagamento,
    filtroArquivamento,
  ])

  const faturasAtivas = faturas.filter((f) => !f.arquivado_admin)
  const totalComFatura = faturasAtivas.filter((f) => f.arquivo_pdf).length
  const totalVisiveis = faturasAtivas.filter((f) => f.visivel_cliente).length
  const totalRecibos = faturasAtivas.filter((f) => f.recibo_pdf).length
  const totalSemFatura = embarques.filter((e) => !faturaDoEmbarque(e.id)?.arquivo_pdf).length
  const totalFaturasArquivadas = faturas.filter((f) => f.arquivado_admin).length

  const pagamentosFinanceiros = embarques.map((e) => ({
    embarque: e,
    fatura: faturaDoEmbarque(e.id),
    financeiro: financeiroDoEmbarque(e),
    pagamento: statusPagamentoFinanceiro(financeiroDoEmbarque(e)),
  }))

  const totalPagos = pagamentosFinanceiros.filter((item) => item.pagamento.status === 'PAGO').length
  const totalAtrasados = pagamentosFinanceiros.filter((item) => item.pagamento.status === 'ATRASADO').length
  const totalEmAberto = pagamentosFinanceiros.filter((item) => item.pagamento.status === 'EM_ABERTO').length
  const totalSemFinanceiro = pagamentosFinanceiros.filter((item) => item.pagamento.status === 'SEM_FINANCEIRO').length
  const statusDisponiveis = statusOperacionaisDisponiveis()

  const clientesFaturamentoFiltrados = useMemo(() => {
    const termo = normalizarTexto(buscaClienteFaturamento)

    return clientesFaturamento
      .filter((cliente) => cliente.ativo !== false)
      .filter((cliente) => {
        if (!termo) return true

        const base = normalizarTexto(`
          ${cliente.nome_empresa || ''}
          ${cliente.nome_contato || ''}
          ${cliente.cnpj || ''}
          ${cliente.cpf || ''}
          ${cliente.email || ''}
          ${cliente.codigo_hc || ''}
          ${cliente.cidade || ''}
          ${cliente.estado || ''}
        `)

        return base.includes(termo)
      })
      .slice(0, 80)
  }, [clientesFaturamento, buscaClienteFaturamento])

  const clienteFaturamentoSelecionado = useMemo(() => {
    return clientesFaturamento.find((cliente) => cliente.id === clienteFaturamentoId) || null
  }, [clientesFaturamento, clienteFaturamentoId])

  function chaveProcessoFinanceiro(item: FinanceiroProcesso, index: number) {
    return String(item.id || `${normalizarAwb(item.awb || item.numero_awb || item.hawb || item.h_awb)}-${index}`)
  }

  const processosFaturaveis = useMemo<ProcessoEmissor[]>(() => {
    return financeiros
      .map((financeiro, index) => {
        const embarque = embarqueDoFinanceiro(financeiro)
        const awb =
          normalizarAwb(financeiro.awb || financeiro.numero_awb || financeiro.hawb || financeiro.h_awb) ||
          normalizarAwb(embarque?.awb) ||
          '-'

        const cliente = texto(financeiro.cliente || financeiro.cliente_final || embarque?.cliente_final || embarque?.importador || '-')
        const servico = texto(embarque?.servico || '-')
        const referencia = texto(embarque?.referencia_cliente || embarque?.referencia_hc || financeiro.fatura || financeiro.numero_fatura || '-')
        const transportadora = texto(embarque?.transportadora || '-')
        const vencimento = normalizarData(vencimentoFinanceiro(financeiro))
        const valor = valorFinanceiro(financeiro)

        return {
          chave: chaveProcessoFinanceiro(financeiro, index),
          financeiro,
          embarque,
          awb,
          cliente,
          servico,
          referencia,
          transportadora,
          vencimento,
          valor,
        }
      })
      .filter((item) => item.valor > 0)
      .sort((a, b) => {
        const clienteA = a.cliente || ''
        const clienteB = b.cliente || ''
        return clienteA.localeCompare(clienteB, 'pt-BR')
      })
  }, [financeiros, embarques])

  const processosEmissorFiltrados = useMemo(() => {
    const termo = normalizarTexto(buscaProcessoEmissor)
    const clienteSelecionado = normalizarTexto(clienteFaturamentoSelecionado?.nome_empresa || '')

    return processosFaturaveis.filter((item) => {
      const base = normalizarTexto(`
        ${item.awb}
        ${item.cliente}
        ${item.servico}
        ${item.referencia}
        ${item.transportadora}
        ${item.valor}
      `)

      const passaBusca = !termo || base.includes(termo)

      // Ajuda na busca inicial, mas não bloqueia. Alguns clientes são faturados com nome abreviado no financeiro.
      const passaCliente =
        !clienteSelecionado ||
        !termo ||
        base.includes(clienteSelecionado) ||
        true

      return passaBusca && passaCliente
    })
  }, [processosFaturaveis, buscaProcessoEmissor, clienteFaturamentoSelecionado])

  const itensSelecionadosFatura = useMemo(() => {
    return processosFaturaveis.filter((item) => processosSelecionados.includes(item.chave))
  }, [processosFaturaveis, processosSelecionados])

  const totalFaturaEmissor = useMemo(() => {
    return itensSelecionadosFatura.reduce((acc, item) => acc + Number(item.valor || 0), 0)
  }, [itensSelecionadosFatura])

  function alternarProcessoEmissor(chave: string, marcado: boolean) {
    setProcessosSelecionados((atual) =>
      marcado ? Array.from(new Set([...atual, chave])) : atual.filter((item) => item !== chave)
    )
  }

  function selecionarTodosProcessosFiltrados(marcado: boolean) {
    if (!marcado) {
      setProcessosSelecionados([])
      return
    }

    setProcessosSelecionados(processosEmissorFiltrados.map((item) => item.chave))
  }

  function limparEmissor() {
    setBuscaClienteFaturamento('')
    setClienteFaturamentoId('')
    setBuscaProcessoEmissor('')
    setProcessosSelecionados([])
    setNumeroFaturaEmissor('')
    setVencimentoFaturaEmissor('')
    setObservacoesEmissor('')
    setMostrarPreviewEmissor(false)
  }

  function validarEmissor() {
    if (!clienteFaturamentoSelecionado) {
      alert('Selecione o cliente de faturamento.')
      return false
    }

    if (itensSelecionadosFatura.length === 0) {
      alert('Selecione pelo menos um processo faturado.')
      return false
    }

    if (!numeroFaturaEmissor.trim()) {
      alert('Informe o número da fatura.')
      return false
    }

    if (!vencimentoFaturaEmissor) {
      alert('Informe o vencimento da fatura.')
      return false
    }

    return true
  }

  function abrirFaturaParaImprimir() {
    if (!validarEmissor()) return

    const cliente = clienteFaturamentoSelecionado
    if (!cliente) return

    const numeroFatura = numeroFaturaEmissor.trim()
    const dataEmissao = new Date().toLocaleDateString('pt-BR')
    const vencimento = dataBR(vencimentoFaturaEmissor)

    const linhas = itensSelecionadosFatura
      .map((item, index) => {
        return `
          <tr>
            <td>${index + 1}</td>
            <td>${escaparHtml(item.awb)}</td>
            <td>${escaparHtml(item.referencia)}</td>
            <td>${escaparHtml(item.servico)}</td>
            <td>${escaparHtml(item.transportadora)}</td>
            <td class="right">${escaparHtml(moeda(item.valor))}</td>
          </tr>
        `
      })
      .join('')

    const html = `
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Fatura ${escaparHtml(numeroFatura)}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 0; padding: 32px; }
            .page { max-width: 900px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 3px solid #0f172a; padding-bottom: 20px; margin-bottom: 28px; }
            .brand h1 { margin: 0; font-size: 30px; color: #0f172a; }
            .brand p { margin: 5px 0 0; color: #475569; font-size: 13px; }
            .invoice-box { text-align: right; }
            .invoice-box h2 { margin: 0; font-size: 28px; color: #1d4ed8; }
            .invoice-box p { margin: 5px 0; color: #475569; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 24px; }
            .card { border: 1px solid #cbd5e1; border-radius: 14px; padding: 16px; background: #f8fafc; }
            .card h3 { margin: 0 0 10px; font-size: 14px; color: #0f172a; text-transform: uppercase; letter-spacing: .05em; }
            .card p { margin: 4px 0; font-size: 13px; color: #334155; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th { background: #0f172a; color: white; padding: 11px; font-size: 12px; text-align: left; }
            td { border-bottom: 1px solid #e2e8f0; padding: 11px; font-size: 12px; vertical-align: top; }
            .right { text-align: right; }
            .total { margin-top: 22px; display: flex; justify-content: flex-end; }
            .total-box { min-width: 280px; background: #0f172a; color: white; border-radius: 16px; padding: 18px; }
            .total-box p { margin: 0; font-size: 13px; color: #cbd5e1; }
            .total-box h2 { margin: 6px 0 0; font-size: 30px; }
            .obs { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px; color: #475569; font-size: 12px; }
            .footer { margin-top: 36px; text-align: center; color: #64748b; font-size: 11px; }
            .actions { margin: 22px auto 0; max-width: 900px; text-align: center; }
            .actions button { background: #2563eb; color: white; border: 0; border-radius: 10px; padding: 12px 18px; font-weight: 700; cursor: pointer; }
            @media print {
              body { padding: 0; }
              .actions { display: none; }
              .page { max-width: none; padding: 24px; }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header">
              <div class="brand">
                <h1>HC Consultoria</h1>
                <p>Couto e Otero Intermediação LTDA</p>
                <p>Fatura gerada pelo HC Connect</p>
              </div>
              <div class="invoice-box">
                <h2>FATURA</h2>
                <p><strong>Nº:</strong> ${escaparHtml(numeroFatura)}</p>
                <p><strong>Emissão:</strong> ${escaparHtml(dataEmissao)}</p>
                <p><strong>Vencimento:</strong> ${escaparHtml(vencimento)}</p>
              </div>
            </div>

            <div class="grid">
              <div class="card">
                <h3>Cliente faturado</h3>
                <p><strong>${escaparHtml(cliente.nome_empresa || '-')}</strong></p>
                <p><strong>CNPJ/CPF:</strong> ${escaparHtml(documentoFiscalCliente(cliente))}</p>
                <p><strong>Endereço:</strong> ${escaparHtml(enderecoFiscalCliente(cliente))}</p>
                <p><strong>Contato:</strong> ${escaparHtml(cliente.nome_contato || cliente.contato || '-')}</p>
                <p><strong>E-mail:</strong> ${escaparHtml(cliente.email || '-')}</p>
              </div>

              <div class="card">
                <h3>Dados fiscais</h3>
                <p><strong>Inscrição Estadual:</strong> ${escaparHtml(cliente.inscricao_estadual || '-')}</p>
                <p><strong>Inscrição Municipal:</strong> ${escaparHtml(cliente.inscricao_municipal || '-')}</p>
                <p><strong>Código HC:</strong> ${escaparHtml(cliente.codigo_hc || '-')}</p>
                <p><strong>Quantidade de processos:</strong> ${itensSelecionadosFatura.length}</p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>AWB</th>
                  <th>Referência</th>
                  <th>Serviço</th>
                  <th>Transportadora</th>
                  <th class="right">Valor</th>
                </tr>
              </thead>
              <tbody>
                ${linhas}
              </tbody>
            </table>

            <div class="total">
              <div class="total-box">
                <p>Total da fatura</p>
                <h2>${escaparHtml(moeda(totalFaturaEmissor))}</h2>
              </div>
            </div>

            ${
              observacoesEmissor.trim()
                ? `<div class="obs"><strong>Observações:</strong><br />${escaparHtml(observacoesEmissor).replaceAll('\n', '<br />')}</div>`
                : ''
            }

            <div class="footer">
              HC Connect © ${new Date().getFullYear()} • Sistema desenvolvido por Marcos Paulo Otero
            </div>
          </div>

          <div class="actions">
            <button onclick="window.print()">Imprimir / salvar em PDF</button>
          </div>
        </body>
      </html>
    `

    const janela = window.open('', '_blank')
    if (!janela) {
      alert('O navegador bloqueou a abertura da fatura. Permita pop-ups para o HC Connect.')
      return
    }

    janela.document.open()
    janela.document.write(html)
    janela.document.close()
  }

  function copiarResumoFatura() {
    if (!validarEmissor()) return

    const cliente = clienteFaturamentoSelecionado
    if (!cliente) return

    const linhas = itensSelecionadosFatura
      .map((item, index) => `${index + 1}. AWB ${item.awb} - ${item.servico} - ${moeda(item.valor)}`)
      .join('\n')

    const resumo =
      `Fatura: ${numeroFaturaEmissor}\n` +
      `Cliente: ${cliente.nome_empresa || '-'}\n` +
      `CNPJ/CPF: ${documentoFiscalCliente(cliente)}\n` +
      `Vencimento: ${dataBR(vencimentoFaturaEmissor)}\n\n` +
      `${linhas}\n\n` +
      `Total: ${moeda(totalFaturaEmissor)}`

    navigator.clipboard.writeText(resumo)
    alert('Resumo da fatura copiado.')
  }

  function abrirFormulario(embarque: Embarque) {
    const fatura = faturaDoEmbarque(embarque.id)

    setEmbarqueSelecionado(embarque)
    setNumeroFatura(fatura?.numero_fatura || '')
    setVisivelCliente(fatura?.visivel_cliente ?? true)
    setObservacoes(fatura?.observacoes || '')
    setArquivoPdf(null)

    setTimeout(() => {
      document.getElementById('form_fatura')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  function limparFormulario() {
    setEmbarqueSelecionado(null)
    setNumeroFatura('')
    setVisivelCliente(true)
    setObservacoes('')
    setArquivoPdf(null)

    const inputArquivo = document.getElementById('pdf_fatura') as HTMLInputElement | null
    if (inputArquivo) inputArquivo.value = ''
  }

  function limparFiltros() {
    setBusca('')
    setFiltroDocumento('TODOS')
    setFiltroStatusEmbarque('TODOS')
    setFiltroPagamento('TODOS')
    setFiltroArquivamento('ATIVAS')
    setPacoteAbertoId(null)
  }

  function aplicarFiltroRapido(opcoes: {
    documento?: string
    statusEmbarque?: string
    pagamento?: string
    arquivamento?: string
  }) {
    setBusca('')
    setFiltroDocumento(opcoes.documento || 'TODOS')
    setFiltroStatusEmbarque(opcoes.statusEmbarque || 'TODOS')
    setFiltroPagamento(opcoes.pagamento || 'TODOS')
    setFiltroArquivamento(opcoes.arquivamento || 'ATIVAS')
    setPacoteAbertoId(null)

    setTimeout(() => {
      document.getElementById('tabela_faturas')?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }

  async function salvarFatura() {
    if (!embarqueSelecionado) return alert('Selecione um embarque.')

    const faturaExistente = faturaDoEmbarque(embarqueSelecionado.id)

    if (!faturaExistente && !arquivoPdf) {
      return alert('Selecione o PDF da fatura.')
    }

    if (arquivoPdf && arquivoPdf.type !== 'application/pdf') {
      return alert('O arquivo precisa ser um PDF.')
    }

    setSalvando(true)

    let urlPdf = faturaExistente?.arquivo_pdf || null

    if (arquivoPdf) {
      const nomeArquivo = `${embarqueSelecionado.id}/${Date.now()}-${arquivoPdf.name.replaceAll(' ', '-')}`

      const { error: erroUpload } = await supabase.storage
        .from('faturas')
        .upload(nomeArquivo, arquivoPdf, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'application/pdf',
        })

      if (erroUpload) {
        setSalvando(false)
        alert(erroUpload.message)
        return
      }

      const { data: urlData } = supabase.storage.from('faturas').getPublicUrl(nomeArquivo)
      urlPdf = urlData.publicUrl

      const caminhoAntigo = extrairCaminhoStorage(faturaExistente?.arquivo_pdf)
      if (caminhoAntigo) {
        await supabase.storage.from('faturas').remove([caminhoAntigo])
      }
    }

    const payload = {
      embarque_id: embarqueSelecionado.id,
      usuario_id: embarqueSelecionado.usuario_id || null,
      numero_fatura: numeroFatura || null,
      arquivo_pdf: urlPdf,
      visivel_cliente: visivelCliente,
      observacoes: observacoes || null,
    }

    if (faturaExistente) {
      const { error } = await supabase
        .from('faturas')
        .update(payload)
        .eq('id', faturaExistente.id)

      if (error) {
        setSalvando(false)
        alert(error.message)
        return
      }

      alert('Fatura atualizada com sucesso.')
    } else {
      const { error } = await supabase.from('faturas').insert([payload])

      if (error) {
        setSalvando(false)
        alert(error.message)
        return
      }

      alert('Fatura anexada com sucesso.')
    }

    setSalvando(false)
    limparFormulario()
    carregar()
  }

  async function removerFatura(embarque: Embarque) {
    const fatura = faturaDoEmbarque(embarque.id)

    if (!fatura) return alert('Fatura não encontrada.')

    const confirmar = confirm(`Deseja remover a fatura do AWB ${embarque.awb}?`)
    if (!confirmar) return

    setRemovendoFatura(embarque.id)

    const caminhoFatura = extrairCaminhoStorage(fatura.arquivo_pdf)
    const caminhoRecibo = extrairCaminhoStorage(fatura.recibo_pdf)
    const arquivosParaRemover = [caminhoFatura, caminhoRecibo].filter(Boolean) as string[]

    if (arquivosParaRemover.length > 0) {
      await supabase.storage.from('faturas').remove(arquivosParaRemover)
    }

    const { error } = await supabase.from('faturas').delete().eq('id', fatura.id)

    setRemovendoFatura(null)

    if (error) {
      alert(error.message)
      return
    }

    alert('Fatura removida com sucesso.')
    carregar()
  }

  async function anexarRecibo(embarque: Embarque, arquivo: File | null) {
    if (!arquivo) return
    if (arquivo.type !== 'application/pdf') return alert('O recibo precisa ser um PDF.')

    const fatura = faturaDoEmbarque(embarque.id)
    if (!fatura) return alert('Cadastre a fatura antes de anexar o recibo.')

    setEnviandoRecibo(embarque.id)

    const nomeArquivo = `recibos/${fatura.id}/${Date.now()}-${arquivo.name.replaceAll(' ', '-')}`

    const { error: erroUpload } = await supabase.storage
      .from('faturas')
      .upload(nomeArquivo, arquivo, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'application/pdf',
      })

    if (erroUpload) {
      setEnviandoRecibo(null)
      alert(erroUpload.message)
      return
    }

    const { data: urlData } = supabase.storage.from('faturas').getPublicUrl(nomeArquivo)

    const caminhoAntigo = extrairCaminhoStorage(fatura.recibo_pdf)
    if (caminhoAntigo) {
      await supabase.storage.from('faturas').remove([caminhoAntigo])
    }

    const { error } = await supabase
      .from('faturas')
      .update({
        recibo_pdf: urlData.publicUrl,
        recibo_nome: arquivo.name,
      })
      .eq('id', fatura.id)

    setEnviandoRecibo(null)

    if (error) {
      alert(error.message)
      return
    }

    alert('Recibo anexado com sucesso.')
    carregar()
  }

  async function alternarVisibilidade(fatura: Fatura) {
    const { error } = await supabase
      .from('faturas')
      .update({
        visivel_cliente: !fatura.visivel_cliente,
      })
      .eq('id', fatura.id)

    if (error) {
      alert(error.message)
      return
    }

    carregar()
  }


  async function alternarArquivamentoFatura(fatura: Fatura, arquivar: boolean) {
    const confirmar = confirm(
      arquivar
        ? `Deseja arquivar a fatura ${fatura.numero_fatura || ''} no painel admin?`
        : `Deseja restaurar a fatura ${fatura.numero_fatura || ''} para a lista principal?`
    )

    if (!confirmar) return

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('faturas')
      .update({
        arquivado_admin: arquivar,
        arquivado_admin_em: arquivar ? new Date().toISOString() : null,
        arquivado_admin_por: arquivar ? user?.id || null : null,
      })
      .eq('id', fatura.id)

    if (error) {
      alert(error.message)
      console.error('Erro arquivamento fatura admin:', error)
      return
    }

    alert(arquivar ? 'Fatura arquivada no admin.' : 'Fatura restaurada no admin.')
    carregar()
  }

  return (
    <main className="w-full max-w-none p-6 lg:p-8 text-white">
      <div className="mb-8 flex flex-col lg:flex-row justify-between gap-6">
        <div>
          <p className="text-blue-400 font-bold mb-2">Documentos do cliente</p>
          <h1 className="text-5xl font-black mb-2">Faturas</h1>
          <p className="text-slate-400 text-lg">
            Anexe faturas e recibos em PDF. Para faturar, consulte o valor fechado, cotação, documentos do embarque e status financeiro.
          </p>
        </div>

        <button
          onClick={() => document.getElementById('tabela_faturas')?.scrollIntoView({ behavior: 'smooth' })}
          className="bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold h-fit"
        >
          Ver embarques
        </button>
      </div>

      <section className="mb-8 border border-blue-900 rounded-3xl bg-[#071225] p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setAbaFaturas('LISTA')}
            className={
              abaFaturas === 'LISTA'
                ? 'bg-blue-600 text-white px-6 py-4 rounded-2xl font-black shadow-[0_0_18px_rgba(37,99,235,0.35)]'
                : 'bg-[#020817] hover:bg-blue-600/20 border border-blue-900 text-slate-300 px-6 py-4 rounded-2xl font-black transition'
            }
          >
            🧾 Faturas clientes
            <span className="block text-xs font-medium mt-1 opacity-80">
              Anexar PDFs, recibos, comprovantes e visibilidade do cliente
            </span>
          </button>

          <button
            type="button"
            onClick={() => setAbaFaturas('EMISSOR')}
            className={
              abaFaturas === 'EMISSOR'
                ? 'bg-blue-600 text-white px-6 py-4 rounded-2xl font-black shadow-[0_0_18px_rgba(37,99,235,0.35)]'
                : 'bg-[#020817] hover:bg-blue-600/20 border border-blue-900 text-slate-300 px-6 py-4 rounded-2xl font-black transition'
            }
          >
            🧮 Emitir nova fatura
            <span className="block text-xs font-medium mt-1 opacity-80">
              Puxar dados fiscais e processos faturados
            </span>
          </button>
        </div>
      </section>

      {abaFaturas === 'EMISSOR' ? (
        <section className="space-y-8">
          <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
            <div className="flex flex-col xl:flex-row justify-between gap-6 mb-7">
              <div>
                <p className="text-blue-400 font-bold mb-2">Emissor de faturas</p>
                <h2 className="text-3xl font-black">Nova fatura por cliente fiscal</h2>
                <p className="text-slate-400 mt-2">
                  Selecione o CNPJ/CPF de faturamento, escolha os processos e gere o modelo para imprimir ou salvar em PDF.
                </p>
              </div>

              <div className="flex gap-3 flex-wrap h-fit">
                <button
                  type="button"
                  onClick={limparEmissor}
                  className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold"
                >
                  Limpar emissão
                </button>

                <Link
                  href="/admin/clientes-faturamento"
                  className="bg-purple-600 hover:bg-purple-500 px-5 py-3 rounded-xl font-bold"
                >
                  Clientes faturamento
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-1 border border-blue-900 rounded-3xl bg-[#020817] p-5">
                <h3 className="text-xl font-black mb-4">1. Cliente de faturamento</h3>

                <input
                  value={buscaClienteFaturamento}
                  onChange={(e) => setBuscaClienteFaturamento(e.target.value)}
                  placeholder="Buscar por nome, CNPJ, CPF, cidade ou código HC..."
                  className="w-full mb-4"
                />

                <div className="space-y-3 max-h-[430px] overflow-y-auto pr-1">
                  {clientesFaturamentoFiltrados.map((cliente) => {
                    const ativo = clienteFaturamentoId === cliente.id

                    return (
                      <button
                        key={cliente.id}
                        type="button"
                        onClick={() => setClienteFaturamentoId(cliente.id)}
                        className={
                          ativo
                            ? 'w-full text-left border border-blue-400 bg-blue-600/20 rounded-2xl p-4'
                            : 'w-full text-left border border-blue-900 bg-[#071225] hover:bg-blue-600/10 rounded-2xl p-4'
                        }
                      >
                        <p className="font-black text-white">{cliente.nome_empresa || '-'}</p>
                        <p className="text-blue-300 text-sm mt-1">{documentoFiscalCliente(cliente)}</p>
                        <p className="text-slate-500 text-xs mt-1">
                          {cliente.cidade || '-'} / {cliente.estado || '-'}
                          {cliente.codigo_hc ? ` • ID ${cliente.codigo_hc}` : ''}
                        </p>
                      </button>
                    )
                  })}

                  {clientesFaturamentoFiltrados.length === 0 && (
                    <div className="border border-blue-900 rounded-2xl p-4 text-slate-400">
                      Nenhum cliente fiscal encontrado.
                    </div>
                  )}
                </div>
              </div>

              <div className="xl:col-span-2 border border-blue-900 rounded-3xl bg-[#020817] p-5">
                <h3 className="text-xl font-black mb-4">Dados carregados para emissão</h3>

                {clienteFaturamentoSelecionado ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoPacote label="Razão social / Nome" valor={clienteFaturamentoSelecionado.nome_empresa || '-'} destaque />
                    <InfoPacote label="CNPJ/CPF" valor={documentoFiscalCliente(clienteFaturamentoSelecionado)} destaque />
                    <InfoPacote label="Endereço" valor={clienteFaturamentoSelecionado.endereco || '-'} />
                    <InfoPacote label="Cidade / UF / CEP" valor={`${clienteFaturamentoSelecionado.cidade || '-'} / ${clienteFaturamentoSelecionado.estado || '-'} / ${clienteFaturamentoSelecionado.cep || '-'}`} />
                    <InfoPacote label="E-mail" valor={clienteFaturamentoSelecionado.email || '-'} />
                    <InfoPacote label="Contato" valor={clienteFaturamentoSelecionado.nome_contato || clienteFaturamentoSelecionado.contato || '-'} />
                    <InfoPacote label="Inscrição estadual" valor={clienteFaturamentoSelecionado.inscricao_estadual || '-'} />
                    <InfoPacote label="Inscrição municipal" valor={clienteFaturamentoSelecionado.inscricao_municipal || '-'} />
                  </div>
                ) : (
                  <div className="border border-yellow-500/40 bg-yellow-500/10 rounded-2xl p-5 text-yellow-200">
                    Selecione um cliente da lista para carregar os dados fiscais da fatura.
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div>
                    <label className="block text-slate-300 font-bold mb-2">Número da fatura</label>
                    <input
                      value={numeroFaturaEmissor}
                      onChange={(e) => setNumeroFaturaEmissor(e.target.value)}
                      placeholder="Ex: 2026-001"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-2">Vencimento</label>
                    <input
                      type="date"
                      value={vencimentoFaturaEmissor}
                      onChange={(e) => setVencimentoFaturaEmissor(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-2">Total selecionado</label>
                    <div className="border border-green-700 bg-green-950/20 rounded-2xl px-4 py-3 font-black text-green-300">
                      {moeda(totalFaturaEmissor)}
                    </div>
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-slate-300 font-bold mb-2">Observações da fatura</label>
                    <textarea
                      value={observacoesEmissor}
                      onChange={(e) => setObservacoesEmissor(e.target.value)}
                      placeholder="Observações que devem aparecer na fatura..."
                      className="min-h-[90px]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
            <div className="flex flex-col xl:flex-row justify-between gap-5 mb-6">
              <div>
                <h3 className="text-2xl font-black">2. Processos faturados</h3>
                <p className="text-slate-400 text-sm">
                  Selecione os processos que entrarão nesta fatura. A base vem de Financeiro &gt; Processos Faturados.
                </p>
              </div>

              <div className="flex flex-col md:flex-row gap-3 w-full xl:max-w-3xl">
                <input
                  value={buscaProcessoEmissor}
                  onChange={(e) => setBuscaProcessoEmissor(e.target.value)}
                  placeholder="Buscar AWB, cliente, serviço, referência..."
                  className="flex-1"
                />

                <button
                  type="button"
                  onClick={() => selecionarTodosProcessosFiltrados(true)}
                  className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold"
                >
                  Selecionar filtrados
                </button>

                <button
                  type="button"
                  onClick={() => setProcessosSelecionados([])}
                  className="bg-red-700 hover:bg-red-600 px-5 py-3 rounded-xl font-bold"
                >
                  Limpar seleção
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <ResumoFiltro titulo="Disponíveis" valor={processosEmissorFiltrados.length} detalhe="processos filtrados" />
              <ResumoFiltro titulo="Selecionados" valor={itensSelecionadosFatura.length} detalhe="itens da fatura" />
              <ResumoFiltro titulo="Total" valor={moeda(totalFaturaEmissor)} detalhe="valor da fatura" />
              <ResumoFiltro titulo="Clientes fiscais" valor={clientesFaturamento.length} detalhe="cadastros ativos/inativos" />
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[1250px] border-collapse text-sm [&_th]:border-b [&_th]:border-blue-900 [&_th]:px-3 [&_th]:py-3 [&_th]:text-left [&_th]:font-black [&_th]:text-slate-300 [&_td]:px-3 [&_td]:py-4 [&_td]:align-middle">
                <thead>
                  <tr>
                    <th className="w-[60px]">Sel.</th>
                    <th>AWB</th>
                    <th>Cliente no financeiro</th>
                    <th>Serviço</th>
                    <th>Referência</th>
                    <th>Transportadora</th>
                    <th>Vencimento</th>
                    <th className="text-right">Valor</th>
                  </tr>
                </thead>

                <tbody>
                  {processosEmissorFiltrados.slice(0, 300).map((item) => (
                    <tr key={item.chave} className="border-b border-blue-900/60 hover:bg-[#0b1730] transition">
                      <td>
                        <input
                          type="checkbox"
                          checked={processosSelecionados.includes(item.chave)}
                          onChange={(e) => alternarProcessoEmissor(item.chave, e.target.checked)}
                        />
                      </td>
                      <td className="font-black text-blue-400">{item.awb || '-'}</td>
                      <td>
                        <strong>{item.cliente || '-'}</strong>
                        {item.embarque ? (
                          <p className="text-slate-500 text-xs mt-1">Vinculado ao embarque</p>
                        ) : (
                          <p className="text-yellow-400 text-xs mt-1">Sem vínculo direto com embarque</p>
                        )}
                      </td>
                      <td>{item.servico || '-'}</td>
                      <td>{item.referencia || '-'}</td>
                      <td>{item.transportadora || '-'}</td>
                      <td>{dataBR(item.vencimento)}</td>
                      <td className="text-right font-black text-green-400">{moeda(item.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {processosEmissorFiltrados.length > 300 && (
                <div className="mt-4 border border-yellow-500/40 bg-yellow-500/10 rounded-2xl p-4 text-yellow-200 text-sm">
                  Mostrando os primeiros 300 processos filtrados. Use a busca para refinar.
                </div>
              )}

              {processosEmissorFiltrados.length === 0 && (
                <div className="border border-blue-900 bg-[#020817] rounded-2xl p-6 text-center text-slate-400 mt-6">
                  Nenhum processo faturado encontrado.
                </div>
              )}
            </div>
          </section>

          <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
            <div className="flex flex-col xl:flex-row justify-between gap-6">
              <div>
                <h3 className="text-2xl font-black">3. Gerar fatura</h3>
                <p className="text-slate-400 mt-2">
                  Esta primeira versão gera a fatura em uma janela de impressão. Depois você salva como PDF e anexa na própria aba Faturas clientes.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 h-fit">
                <button
                  type="button"
                  onClick={() => setMostrarPreviewEmissor(!mostrarPreviewEmissor)}
                  className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold"
                >
                  {mostrarPreviewEmissor ? 'Ocultar prévia' : 'Ver prévia'}
                </button>

                <button
                  type="button"
                  onClick={copiarResumoFatura}
                  className="bg-purple-600 hover:bg-purple-500 px-5 py-3 rounded-xl font-bold"
                >
                  Copiar resumo
                </button>

                <button
                  type="button"
                  onClick={abrirFaturaParaImprimir}
                  className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-black"
                >
                  Gerar / imprimir fatura
                </button>
              </div>
            </div>

            {mostrarPreviewEmissor && (
              <div className="mt-7 border border-blue-900 rounded-3xl bg-[#020817] p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
                  <InfoPacote label="Cliente" valor={clienteFaturamentoSelecionado?.nome_empresa || '-'} destaque />
                  <InfoPacote label="CNPJ/CPF" valor={documentoFiscalCliente(clienteFaturamentoSelecionado)} destaque />
                  <InfoPacote label="Número da fatura" valor={numeroFaturaEmissor || '-'} />
                  <InfoPacote label="Vencimento" valor={dataBR(vencimentoFaturaEmissor)} />
                </div>

                <div className="space-y-2">
                  {itensSelecionadosFatura.map((item, index) => (
                    <div key={item.chave} className="flex flex-col md:flex-row md:items-center justify-between gap-3 border border-blue-900 rounded-2xl p-4">
                      <div>
                        <p className="font-black text-blue-300">
                          {index + 1}. AWB {item.awb}
                        </p>
                        <p className="text-slate-400 text-sm">
                          {item.servico} • {item.referencia} • {item.transportadora}
                        </p>
                      </div>

                      <p className="font-black text-green-400">{moeda(item.valor)}</p>
                    </div>
                  ))}

                  {itensSelecionadosFatura.length === 0 && (
                    <div className="text-slate-500">Nenhum processo selecionado.</div>
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <div className="border border-green-700 bg-green-950/20 rounded-2xl p-5 min-w-[260px]">
                    <p className="text-slate-400 text-sm">Total da fatura</p>
                    <p className="text-3xl font-black text-green-400">{moeda(totalFaturaEmissor)}</p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </section>
      ) : (
        <>

      <section className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-8">
        <Card
          titulo="Com fatura"
          valor={totalComFatura}
          detalhe="PDF anexado"
          icone="🧾"
          ativo={filtroDocumento === 'COM_FATURA' && filtroArquivamento === 'ATIVAS'}
          onClick={() => aplicarFiltroRapido({ documento: 'COM_FATURA', arquivamento: 'ATIVAS' })}
        />

        <Card
          titulo="Sem fatura"
          valor={totalSemFatura}
          detalhe="Pendente de anexo"
          icone="📄"
          ativo={filtroDocumento === 'SEM_FATURA' && filtroArquivamento === 'ATIVAS'}
          onClick={() => aplicarFiltroRapido({ documento: 'SEM_FATURA', arquivamento: 'ATIVAS' })}
        />

        <Card
          titulo="Visíveis"
          valor={totalVisiveis}
          detalhe="Cliente pode acessar"
          icone="👁️"
          ativo={filtroDocumento === 'VISIVEL' && filtroArquivamento === 'ATIVAS'}
          onClick={() => aplicarFiltroRapido({ documento: 'VISIVEL', arquivamento: 'ATIVAS' })}
        />

        <Card
          titulo="Com recibo"
          valor={totalRecibos}
          detalhe="Recibo anexado"
          icone="✅"
          ativo={filtroDocumento === 'COM_RECIBO' && filtroArquivamento === 'ATIVAS'}
          onClick={() => aplicarFiltroRapido({ documento: 'COM_RECIBO', arquivamento: 'ATIVAS' })}
        />

        <Card
          titulo="Arquivadas"
          valor={totalFaturasArquivadas}
          detalhe="Ocultas do admin"
          icone="🗄️"
          ativo={filtroArquivamento === 'ARQUIVADAS'}
          onClick={() => aplicarFiltroRapido({ arquivamento: 'ARQUIVADAS' })}
        />
      </section>

      {embarqueSelecionado && (
        <section id="form_fatura" className="border border-blue-900 rounded-3xl bg-[#071225] p-7 mb-8">
          <div className="flex flex-col lg:flex-row justify-between gap-5 mb-7">
            <div>
              <p className="text-blue-400 font-bold mb-2">
                {faturaDoEmbarque(embarqueSelecionado.id) ? 'Editar fatura' : 'Anexar fatura'}
              </p>
              <h2 className="text-2xl font-black">AWB {embarqueSelecionado.awb}</h2>
              <p className="text-slate-400 text-sm">
                {embarqueSelecionado.cliente_final || embarqueSelecionado.importador || 'Cliente não informado'} • {embarqueSelecionado.transportadora || '-'}
              </p>
            </div>

            <button
              onClick={limparFormulario}
              className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-2xl font-bold h-fit"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <input
              value={numeroFatura}
              onChange={(e) => setNumeroFatura(e.target.value)}
              placeholder="Número da fatura"
            />

            <input
              id="pdf_fatura"
              type="file"
              accept="application/pdf"
              onChange={(e) => setArquivoPdf(e.target.files?.[0] || null)}
              className="cursor-pointer"
            />

            <label className="flex items-center gap-2 bg-[#020817] border border-blue-900 rounded-2xl px-4">
              <input
                type="checkbox"
                checked={visivelCliente}
                onChange={(e) => setVisivelCliente(e.target.checked)}
              />
              Visível para cliente
            </label>

            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações internas"
              className="md:col-span-3 min-h-[90px]"
            />

            <div className="md:col-span-3 border border-yellow-500/40 bg-yellow-500/10 rounded-2xl p-4 text-yellow-200 text-sm">
              Vencimento e pagamento não são editados aqui. Atualize essas informações em Financeiro &gt; Processos Faturados.
            </div>

            <button
              onClick={salvarFatura}
              disabled={salvando}
              className="md:col-span-3 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold disabled:opacity-60 py-4"
            >
              {salvando ? 'Salvando...' : 'Salvar fatura'}
            </button>
          </div>
        </section>
      )}

      <section id="tabela_faturas" className="w-full border border-blue-900 rounded-3xl bg-[#071225] p-5 lg:p-7">
        <div className="flex flex-col lg:flex-row justify-between gap-5 mb-7">
          <div>
            <h2 className="text-2xl font-black">Faturas por embarque</h2>
            <p className="text-slate-400 text-sm">
              Esta tela mostra o pacote do embarque para faturamento e usa a mesma base de Financeiro &gt; Processos Faturados.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3 w-full lg:max-w-[1380px]">
            <select value={filtroDocumento} onChange={(e) => setFiltroDocumento(e.target.value)}>
              <option value="TODOS">Documentos: todos</option>
              <option value="COM_FATURA">Com fatura</option>
              <option value="SEM_FATURA">Sem fatura</option>
              <option value="COM_RECIBO">Com recibo</option>
              <option value="SEM_RECIBO">Com fatura sem recibo</option>
              <option value="COM_COMPROVANTE">Com comprovante</option>
              <option value="SEM_COMPROVANTE">Sem comprovante</option>
              <option value="VISIVEL">Visível para cliente</option>
              <option value="OCULTO">Oculto do cliente</option>
            </select>

            <select
              value={filtroStatusEmbarque}
              onChange={(e) => setFiltroStatusEmbarque(e.target.value)}
            >
              <option value="TODOS">Status embarque: todos</option>
              {statusDisponiveis.map((status) => (
                <option key={status} value={status || ''}>
                  {status}
                </option>
              ))}
            </select>

            <select value={filtroPagamento} onChange={(e) => setFiltroPagamento(e.target.value)}>
              <option value="TODOS">Pagamento: todos</option>
              <option value="PAGO">Pago no financeiro</option>
              <option value="ATRASADO">Vencido no financeiro</option>
              <option value="EM_ABERTO">Em aberto no financeiro</option>
              <option value="SEM_FINANCEIRO">Não lançado no financeiro</option>
              <option value="SEM_FATURA">Sem fatura</option>
            </select>

            <select value={filtroArquivamento} onChange={(e) => setFiltroArquivamento(e.target.value)}>
              <option value="ATIVAS">Arquivamento: ativas</option>
              <option value="ARQUIVADAS">Arquivamento: arquivadas</option>
              <option value="TODAS">Arquivamento: todas</option>
            </select>

            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por AWB, cliente, fatura..."
              className="w-full xl:col-span-2"
            />

            <button
              type="button"
              onClick={limparFiltros}
              className="bg-slate-700 hover:bg-slate-600 px-4 py-3 rounded-xl font-bold"
            >
              Limpar filtros
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <ResumoFiltro titulo="Filtrados" valor={embarquesFiltrados.length} detalhe="embarques na tela" />
          <ResumoFiltro titulo="Pagos" valor={totalPagos} detalhe="recebimento no financeiro" />
          <ResumoFiltro titulo="Vencidos" valor={totalAtrasados} detalhe="vencimento passou" />
          <ResumoFiltro titulo="Em aberto" valor={totalEmAberto} detalhe="sem recebimento" />
          <ResumoFiltro titulo="Sem financeiro" valor={totalSemFinanceiro} detalhe="AWB não lançado" />
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[1900px] border-collapse text-xs lg:text-sm [&_th]:border-b [&_th]:border-blue-900 [&_th]:px-3 [&_th]:py-3 [&_th]:text-left [&_th]:font-black [&_th]:text-slate-300 [&_td]:px-3 [&_td]:py-4 [&_td]:align-middle">
            <thead>
              <tr>
                <th>AWB</th>
                <th>Cliente</th>
                <th>Serviço</th>
                <th>Status</th>
                <th>Valor fechado</th>
                <th>Cotação / Docs</th>
                <th>Nº Fatura</th>
                <th>Vencimento</th>
                <th>Visível</th>
                <th>Fatura</th>
                <th>Recibo</th>
                <th>Comprovante</th>
                <th>Pagamento</th>
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              {embarquesFiltrados.map((embarque) => {
                const fatura = faturaDoEmbarque(embarque.id)
                const financeiro = financeiroDoEmbarque(embarque)
                const pagamento = statusPagamentoFinanceiro(financeiro)
                const comprovante = statusComprovanteFatura(fatura)
                const documentos = documentosDoEmbarque(embarque.id)
                const cotacoes = cotacoesDoEmbarque(embarque.id)
                const pacoteAberto = pacoteAbertoId === embarque.id

                return (
                  <Fragment key={embarque.id}>
                    <tr className="border-b border-blue-900/60 hover:bg-[#0b1730] transition">
                      <td className="font-black text-blue-400 whitespace-nowrap">{embarque.awb || '-'}</td>
                      <td>
                        <strong>{embarque.cliente_final || embarque.importador || '-'}</strong>
                        <p className="text-slate-500 text-xs mt-1">{embarque.transportadora || '-'}</p>
                      </td>
                      <td>
                        <strong>{embarque.servico || '-'}</strong>
                        <p className="text-slate-500 text-xs mt-1">
                          {embarque.origem || '-'} → {embarque.destino || '-'}
                        </p>
                      </td>
                      <td>
                        <StatusBadge status={embarque.status_operacional || '-'} />
                      </td>
                      <td>
                        <strong className="text-green-400">{moedaFechada(embarque, financeiro)}</strong>
                        <p className="text-slate-500 text-xs mt-1">
                          {embarque.moeda_cobranca || embarque.moeda || 'BRL'}
                          {embarque.taxa_conversao ? ` • tx ${embarque.taxa_conversao}` : ''}
                          {embarque.spread ? ` • spread ${embarque.spread}%` : ''}
                        </p>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <span className={cotacoes.length > 0 ? 'text-green-400 font-black' : 'text-yellow-400 font-black'}>
                            {cotacoes.length > 0 ? `${cotacoes.length} cotação(ões)` : 'Sem cotação'}
                          </span>
                          <span className="text-slate-400 text-xs">{documentos.length} documento(s)</span>
                        </div>
                      </td>
                      <td>
                        <strong>{fatura?.numero_fatura || '-'}</strong>
                        {fatura?.arquivado_admin && (
                          <p className="mt-1 inline-flex rounded-full border border-slate-500 bg-slate-600/20 px-2 py-1 text-[10px] font-black text-slate-300">
                            🗄️ Arquivada
                          </p>
                        )}
                      </td>
                      <td>{dataBR(normalizarData(vencimentoFinanceiro(financeiro)))}</td>
                      <td>{fatura?.visivel_cliente ? 'Sim' : 'Não'}</td>
                      <td>
                        {fatura?.arquivo_pdf ? (
                          <Link href={fatura.arquivo_pdf} target="_blank" className="inline-block rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-500">
                            Abrir
                          </Link>
                        ) : (
                          <span className="text-slate-500">Sem fatura</span>
                        )}
                      </td>
                      <td>
                        {fatura?.recibo_pdf ? (
                          <Link href={fatura.recibo_pdf} target="_blank" className="inline-block rounded-lg bg-green-600 px-3 py-2 text-xs font-black text-white hover:bg-green-500">
                            Abrir
                          </Link>
                        ) : fatura?.arquivo_pdf ? (
                          <label className="inline-flex cursor-pointer rounded-lg bg-green-600 px-3 py-2 text-xs font-black text-white hover:bg-green-500">
                            {enviandoRecibo === embarque.id ? 'Enviando...' : 'Anexar'}
                            <input
                              type="file"
                              accept="application/pdf"
                              disabled={enviandoRecibo === embarque.id}
                              onChange={(e) => anexarRecibo(embarque, e.target.files?.[0] || null)}
                              className="hidden"
                            />
                          </label>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-col gap-2">
                          <span className={`inline-flex flex-col rounded-xl border px-2 py-1 text-[11px] font-black ${comprovante.classe}`}>
                            <span>{comprovante.label}</span>
                            <span className="opacity-80 font-bold">{comprovante.detalhe}</span>
                          </span>

                          {fatura?.comprovante_pagamento && (
                            <Link
                              href={fatura.comprovante_pagamento}
                              target="_blank"
                              className="inline-block rounded-lg bg-purple-600 px-3 py-2 text-center text-xs font-black text-white hover:bg-purple-500"
                            >
                              Abrir comprovante
                            </Link>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`inline-flex flex-col rounded-xl border px-2 py-1 text-[11px] font-black ${pagamento.classe}`}>
                          <span>{pagamento.label}</span>
                          {financeiro ? (
                            <span className="opacity-80 font-bold">{pagamento.detalhe}</span>
                          ) : null}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <button
                            onClick={() => setPacoteAbertoId(pacoteAberto ? null : embarque.id)}
                            className="bg-purple-600 hover:bg-purple-500 px-3 py-2 rounded-lg text-xs font-black"
                          >
                            {pacoteAberto ? 'Fechar' : 'Pacote'}
                          </button>

                          <Link
                            href={`/admin/embarques/${embarque.id}`}
                            className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-xs font-black"
                          >
                            Ver embarque
                          </Link>

                          <button onClick={() => abrirFormulario(embarque)} className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg text-xs font-black">
                            {fatura ? 'Editar' : 'Anexar'}
                          </button>

                          {fatura && (
                            <button onClick={() => alternarVisibilidade(fatura)} className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-xs font-black">
                              {fatura.visivel_cliente ? 'Ocultar' : 'Mostrar'}
                            </button>
                          )}

                          {fatura && (
                            <button
                              onClick={() => alternarArquivamentoFatura(fatura, !fatura.arquivado_admin)}
                              className={
                                fatura.arquivado_admin
                                  ? 'bg-green-700 hover:bg-green-600 px-3 py-2 rounded-lg text-xs font-black'
                                  : 'bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-xs font-black'
                              }
                            >
                              {fatura.arquivado_admin ? 'Restaurar' : 'Arquivar'}
                            </button>
                          )}

                          {fatura?.arquivo_pdf && (
                            <button
                              onClick={() => removerFatura(embarque)}
                              disabled={removendoFatura === embarque.id}
                              className="bg-red-600 hover:bg-red-500 px-3 py-2 rounded-lg text-xs font-black disabled:opacity-60"
                            >
                              {removendoFatura === embarque.id ? 'Removendo...' : 'Remover'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {pacoteAberto && (
                      <tr className="border-b border-blue-900/80 bg-[#020817]">
                        <td colSpan={14} className="p-5">
                          <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
                            <div className="rounded-2xl border border-blue-900 bg-[#071225] p-5">
                              <h3 className="text-xl font-black mb-4 text-blue-300">Dados para faturar</h3>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <InfoPacote label="Cliente" valor={embarque.cliente_final || embarque.importador || '-'} />
                                <InfoPacote label="Exportador" valor={embarque.exportador || '-'} />
                                <InfoPacote label="Importador" valor={embarque.importador || '-'} />
                                <InfoPacote label="Referência cliente" valor={embarque.referencia_cliente || '-'} />
                                <InfoPacote label="Referência HC" valor={embarque.referencia_hc || '-'} />
                                <InfoPacote label="Transportadora" valor={embarque.transportadora || '-'} />
                                <InfoPacote label="Serviço" valor={embarque.servico || '-'} />
                                <InfoPacote label="Peso taxado" valor={embarque.peso_taxado ? `${embarque.peso_taxado} kg` : '-'} />
                              </div>
                            </div>

                            <div className="rounded-2xl border border-green-900 bg-green-950/10 p-5">
                              <h3 className="text-xl font-black mb-4 text-green-300">Valor fechado / financeiro</h3>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <InfoPacote label="Valor fechado" valor={moedaFechada(embarque, financeiro)} destaque />
                                <InfoPacote label="Moeda" valor={embarque.moeda_cobranca || embarque.moeda || 'BRL'} />
                                <InfoPacote label="Taxa conversão" valor={embarque.taxa_conversao || '-'} />
                                <InfoPacote label="Spread" valor={embarque.spread ? `${embarque.spread}%` : '-'} />
                                <InfoPacote label="Vencimento financeiro" valor={dataBR(normalizarData(vencimentoFinanceiro(financeiro)))} />
                                <InfoPacote label="Recebimento" valor={dataBR(normalizarData(recebimentoFinanceiro(financeiro)))} />
                                <InfoPacote
                                  label="Ligação financeira"
                                  valor={financeiro ? 'Encontrado em Processos Faturados' : `Não encontrado para AWB ${embarque.awb || '-'}`}
                                />
                              </div>
                            </div>

                            <div className="rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-5">
                              <h3 className="text-xl font-black mb-4 text-yellow-300">Comprovante do cliente</h3>

                              {fatura?.comprovante_pagamento ? (
                                <div className="space-y-3 text-sm">
                                  <InfoPacote label="Status" valor={fatura.status_pagamento || 'COMPROVANTE ENVIADO'} destaque />
                                  <InfoPacote label="Enviado em" valor={dataBR(fatura.data_comprovante)} />
                                  <InfoPacote label="Observação HC" valor={fatura.observacao_pagamento || '-'} />

                                  <Link
                                    href={fatura.comprovante_pagamento}
                                    target="_blank"
                                    className="block rounded-xl bg-purple-600 px-4 py-3 text-center text-sm font-black text-white hover:bg-purple-500"
                                  >
                                    Abrir comprovante anexado
                                  </Link>
                                </div>
                              ) : (
                                <p className="text-slate-500">Nenhum comprovante enviado pelo cliente para esta fatura.</p>
                              )}
                            </div>

                            <div className="rounded-2xl border border-purple-900 bg-purple-950/10 p-5">
                              <h3 className="text-xl font-black mb-4 text-purple-300">Cotação e documentos</h3>

                              {documentos.length === 0 ? (
                                <p className="text-slate-500">Nenhum documento anexado neste embarque.</p>
                              ) : (
                                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                                  {documentos.map((doc) => {
                                    const url = urlDocumento(doc)
                                    const ehCotacao = documentoEhCotacao(doc)

                                    return url ? (
                                      <Link
                                        key={doc.id}
                                        href={url}
                                        target="_blank"
                                        className={
                                          ehCotacao
                                            ? 'block rounded-xl border border-green-700 bg-green-950/20 p-3 hover:bg-green-950/40'
                                            : 'block rounded-xl border border-blue-900 bg-[#020817] p-3 hover:bg-blue-950/30'
                                        }
                                      >
                                        <p className={ehCotacao ? 'font-black text-green-300' : 'font-black text-blue-300'}>
                                          {ehCotacao ? '💰 Cotação - ' : '📎 '}
                                          {nomeDocumento(doc)}
                                        </p>
                                        <p className="text-slate-500 text-xs mt-1">{dataBR(doc.criado_em)}</p>
                                      </Link>
                                    ) : (
                                      <div key={doc.id} className="rounded-xl border border-blue-900 bg-[#020817] p-3">
                                        <p className="font-black text-slate-300">📎 {nomeDocumento(doc)}</p>
                                        <p className="text-slate-500 text-xs mt-1">Documento sem URL pública</p>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>

          {embarquesFiltrados.length === 0 && (
            <div className="border border-blue-900 bg-[#020817] rounded-2xl p-6 text-center text-slate-400 mt-6">
              Nenhum embarque encontrado.
            </div>
          )}
        </div>
      </section>
        </>
      )}
    </main>
  )
}

function ResumoFiltro({ titulo, valor, detalhe }: any) {
  return (
    <div className="rounded-2xl border border-blue-900 bg-[#020817] p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{titulo}</p>
      <p className="mt-2 text-2xl font-black text-white">{valor}</p>
      <p className="mt-1 text-xs text-slate-500">{detalhe}</p>
    </div>
  )
}

function InfoPacote({ label, valor, destaque = false }: any) {
  return (
    <div className="rounded-xl border border-blue-900 bg-[#020817] p-3">
      <p className="text-slate-500 text-xs mb-1">{label}</p>
      <p className={destaque ? 'font-black text-green-400 break-words' : 'font-bold text-slate-200 break-words'}>
        {valor || '-'}
      </p>
    </div>
  )
}

function Card({ titulo, valor, detalhe, icone, ativo = false, onClick }: any) {
  const classe = ativo
    ? 'border-blue-400 bg-blue-600/25 ring-2 ring-blue-500 shadow-[0_0_25px_rgba(37,99,235,0.25)]'
    : 'border-blue-900 bg-[#071225] hover:border-blue-400 hover:bg-blue-600/10'

  const conteudo = (
    <div className="flex justify-between items-start gap-4">
      <div>
        <p className={ativo ? 'text-white font-black' : 'text-slate-300 font-bold'}>{titulo}</p>
        <h2 className="text-5xl font-black mt-4 text-white">{valor}</h2>
        <p className={ativo ? 'text-blue-100 mt-2' : 'text-slate-400 mt-2'}>{detalhe}</p>
      </div>

      <div className="text-4xl">{icone}</div>
    </div>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`text-left w-full border rounded-3xl p-6 transition cursor-pointer ${classe}`}
      >
        {conteudo}
      </button>
    )
  }

  return <div className={`border rounded-3xl p-6 ${classe}`}>{conteudo}</div>
}
