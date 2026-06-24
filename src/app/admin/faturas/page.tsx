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
  codigo_hc?: string | null
  ativo?: boolean | null
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
  const [clientesFaturamento, setClientesFaturamento] = useState<ClienteFaturamento[]>([])
  const [abaFaturas, setAbaFaturas] = useState<'LISTA' | 'EMISSOR'>('LISTA')
  const [buscaClienteFaturamento, setBuscaClienteFaturamento] = useState('')
  const [clienteFaturamentoId, setClienteFaturamentoId] = useState('')
  const [buscaEmbarqueEmissor, setBuscaEmbarqueEmissor] = useState('')
  const [embarqueEmissorId, setEmbarqueEmissorId] = useState('')
  const [numeroFaturaEmissor, setNumeroFaturaEmissor] = useState('')
  const [vencimentoFaturaEmissor, setVencimentoFaturaEmissor] = useState('')
  const [valorFaturaEmissor, setValorFaturaEmissor] = useState('')
  const [observacoesEmissor, setObservacoesEmissor] = useState('')
  const [mostrarPreviewEmissor, setMostrarPreviewEmissor] = useState(false)
  const [gerandoFaturaEmissor, setGerandoFaturaEmissor] = useState(false)
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

    if (erroClientesFaturamento) console.log('ERRO CLIENTES FATURAMENTO:', erroClientesFaturamento)

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
          ${cliente.cidade || ''}
          ${cliente.estado || ''}
          ${cliente.codigo_hc || ''}
        `)

        return base.includes(termo)
      })
      .slice(0, 80)
  }, [clientesFaturamento, buscaClienteFaturamento])

  const clienteFaturamentoSelecionado = useMemo(() => {
    return clientesFaturamento.find((cliente) => cliente.id === clienteFaturamentoId) || null
  }, [clientesFaturamento, clienteFaturamentoId])

  const embarquesEmissorFiltrados = useMemo(() => {
    const termo = normalizarTexto(buscaEmbarqueEmissor)

    return embarques
      .filter((embarque) => {
        if (!termo) return true

        const financeiro = financeiroDoEmbarque(embarque)
        const base = normalizarTexto(`
          ${embarque.awb || ''}
          ${embarque.cliente_final || ''}
          ${embarque.exportador || ''}
          ${embarque.importador || ''}
          ${embarque.transportadora || ''}
          ${embarque.servico || ''}
          ${embarque.referencia_cliente || ''}
          ${embarque.referencia_hc || ''}
          ${financeiro?.cliente || ''}
          ${financeiro?.fatura || ''}
        `)

        return base.includes(termo)
      })
      .slice(0, 120)
  }, [embarques, financeiros, buscaEmbarqueEmissor])

  const embarqueEmissorSelecionado = useMemo(() => {
    return embarques.find((embarque) => embarque.id === embarqueEmissorId) || null
  }, [embarques, embarqueEmissorId])

  const financeiroEmissorSelecionado = useMemo(() => {
    return embarqueEmissorSelecionado ? financeiroDoEmbarque(embarqueEmissorSelecionado) : null
  }, [embarqueEmissorSelecionado, financeiros])

  function documentoFiscalCliente(cliente?: ClienteFaturamento | null) {
    if (!cliente) return '-'
    return cliente.cnpj || cliente.cpf || '-'
  }

  function enderecoFiscalCliente(cliente?: ClienteFaturamento | null) {
    if (!cliente) return '-'

    return [cliente.endereco, cliente.cidade, cliente.estado, cliente.cep]
      .map((item) => texto(item))
      .filter(Boolean)
      .join(' - ') || '-'
  }

  function valorEmissorNumero() {
    return numero(valorFaturaEmissor)
  }

  function mesDaDataEmissor(valor: any) {
    const data = normalizarData(valor)
    if (!data) return ''
    return data.slice(0, 7)
  }

  function selecionarClienteFaturamento(cliente: ClienteFaturamento) {
    setClienteFaturamentoId(cliente.id)
    setBuscaClienteFaturamento(cliente.nome_empresa || '')
  }

  function selecionarEmbarqueEmissor(embarque: Embarque) {
    const financeiro = financeiroDoEmbarque(embarque)
    const fatura = faturaDoEmbarque(embarque.id)
    const valor =
      valorFinanceiro(financeiro) ||
      numero(embarque.valor_cobrado_cliente) ||
      numero(embarque.valor_fechado) ||
      numero(embarque.valor_venda)

    setEmbarqueEmissorId(embarque.id)
    setNumeroFaturaEmissor(fatura?.numero_fatura || financeiro?.fatura || '')
    setVencimentoFaturaEmissor(normalizarData(vencimentoFinanceiro(financeiro)) || '')
    setValorFaturaEmissor(valor ? String(valor).replace('.', ',') : '')
    setObservacoesEmissor(fatura?.observacoes || '')
    setMostrarPreviewEmissor(true)

    const clienteReferencia = embarque.cliente_final || embarque.importador || financeiro?.cliente || ''
    if (clienteReferencia && !buscaClienteFaturamento) {
      setBuscaClienteFaturamento(clienteReferencia)
    }
  }

  function limparEmissor() {
    setBuscaClienteFaturamento('')
    setClienteFaturamentoId('')
    setBuscaEmbarqueEmissor('')
    setEmbarqueEmissorId('')
    setNumeroFaturaEmissor('')
    setVencimentoFaturaEmissor('')
    setValorFaturaEmissor('')
    setObservacoesEmissor('')
    setMostrarPreviewEmissor(false)
  }

  function validarEmissorPorEmbarque() {
    if (!embarqueEmissorSelecionado) {
      alert('Selecione primeiro o embarque/AWB que será faturado.')
      return false
    }

    if (!clienteFaturamentoSelecionado) {
      alert('Selecione o cliente de faturamento com CNPJ/CPF.')
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

    if (valorEmissorNumero() <= 0) {
      alert('Informe o valor da fatura.')
      return false
    }

    return true
  }

  function copiarResumoFatura() {
    if (!validarEmissorPorEmbarque()) return

    const cliente = clienteFaturamentoSelecionado
    const embarque = embarqueEmissorSelecionado
    if (!cliente || !embarque) return

    const resumo =
      `Fatura: ${numeroFaturaEmissor}\n` +
      `AWB: ${embarque.awb || '-'}\n` +
      `Cliente fiscal: ${cliente.nome_empresa || '-'}\n` +
      `CNPJ/CPF: ${documentoFiscalCliente(cliente)}\n` +
      `Vencimento: ${dataBR(vencimentoFaturaEmissor)}\n` +
      `Serviço: ${embarque.servico || '-'}\n` +
      `Transportadora: ${embarque.transportadora || '-'}\n` +
      `Total: ${moeda(valorEmissorNumero())}`

    navigator.clipboard.writeText(resumo)
    alert('Resumo da fatura copiado.')
  }

  async function gerarPdfBlobFaturaEmbarque() {
    const cliente = clienteFaturamentoSelecionado
    const embarque = embarqueEmissorSelecionado

    if (!cliente || !embarque) {
      throw new Error('Cliente ou embarque não selecionado.')
    }

    const { default: jsPDF } = await import('jspdf')
    await import('jspdf-autotable')

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const margem = 42
    const numeroFatura = numeroFaturaEmissor.trim()
    const dataEmissao = new Date().toLocaleDateString('pt-BR')
    const total = valorEmissorNumero()

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text('HC Consultoria', margem, 52)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Couto e Otero Intermediação LTDA', margem, 69)
    doc.text('Fatura gerada pelo HC Connect', margem, 84)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(24)
    doc.text('FATURA', 553, 52, { align: 'right' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Nº: ${numeroFatura}`, 553, 70, { align: 'right' })
    doc.text(`Emissão: ${dataEmissao}`, 553, 85, { align: 'right' })
    doc.text(`Vencimento: ${dataBR(vencimentoFaturaEmissor)}`, 553, 100, { align: 'right' })

    doc.setDrawColor(15, 23, 42)
    doc.setLineWidth(2)
    doc.line(margem, 118, 553, 118)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Cliente faturado', margem, 150)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const dadosCliente = [
      cliente.nome_empresa || '-',
      `CNPJ/CPF: ${documentoFiscalCliente(cliente)}`,
      `Endereço: ${enderecoFiscalCliente(cliente)}`,
      `Contato: ${cliente.nome_contato || cliente.contato || '-'}`,
      `E-mail: ${cliente.email || '-'}`,
      `Inscrição Estadual: ${cliente.inscricao_estadual || '-'}`,
      `Inscrição Municipal: ${cliente.inscricao_municipal || '-'}`,
    ]

    let y = 168
    dadosCliente.forEach((linha) => {
      doc.text(String(linha), margem, y)
      y += 14
    })

    const referencia = embarque.referencia_cliente || embarque.referencia_hc || '-'

    ;(doc as any).autoTable({
      startY: y + 18,
      head: [['AWB', 'Referência', 'Serviço', 'Transportadora', 'Valor']],
      body: [[
        embarque.awb || '-',
        referencia,
        embarque.servico || '-',
        embarque.transportadora || '-',
        moeda(total),
      ]],
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 8,
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
      },
      columnStyles: {
        4: { halign: 'right' },
      },
      margin: { left: margem, right: margem },
    })

    const finalY = ((doc as any).lastAutoTable?.finalY || 330) + 28

    doc.setFillColor(15, 23, 42)
    doc.roundedRect(340, finalY, 213, 68, 10, 10, 'F')
    doc.setTextColor(203, 213, 225)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Total da fatura', 360, finalY + 22)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text(moeda(total), 533, finalY + 50, { align: 'right' })
    doc.setTextColor(17, 24, 39)

    if (observacoesEmissor.trim()) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('Observações', margem, finalY + 103)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(doc.splitTextToSize(observacoesEmissor.trim(), 500), margem, finalY + 120)
    }

    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(
      `HC Connect © ${new Date().getFullYear()} • Sistema desenvolvido por Marcos Paulo Otero`,
      297,
      810,
      { align: 'center' }
    )

    return doc.output('blob')
  }

  async function salvarFaturaEmitida() {
    if (!validarEmissorPorEmbarque()) return

    const cliente = clienteFaturamentoSelecionado
    const embarque = embarqueEmissorSelecionado
    if (!cliente || !embarque) return

    setGerandoFaturaEmissor(true)

    try {
      const faturaExistente = faturaDoEmbarque(embarque.id)
      const blob = await gerarPdfBlobFaturaEmbarque()
      const numeroLimpo = numeroFaturaEmissor.trim().replace(/[^a-zA-Z0-9_-]/g, '-')
      const nomeArquivo = `emitidas/${embarque.id}/${Date.now()}-${numeroLimpo || 'fatura'}.pdf`

      const { error: erroUpload } = await supabase.storage
        .from('faturas')
        .upload(nomeArquivo, blob, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'application/pdf',
        })

      if (erroUpload) throw erroUpload

      const { data: urlData } = supabase.storage.from('faturas').getPublicUrl(nomeArquivo)
      const urlPdf = urlData.publicUrl

      const caminhoAntigo = extrairCaminhoStorage(faturaExistente?.arquivo_pdf)
      if (caminhoAntigo) {
        await supabase.storage.from('faturas').remove([caminhoAntigo])
      }

      const payloadFatura = {
        embarque_id: embarque.id,
        usuario_id: embarque.usuario_id || null,
        numero_fatura: numeroFaturaEmissor.trim(),
        arquivo_pdf: urlPdf,
        visivel_cliente: true,
        observacoes: observacoesEmissor || null,
      }

      if (faturaExistente) {
        const { error } = await supabase
          .from('faturas')
          .update(payloadFatura)
          .eq('id', faturaExistente.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from('faturas').insert([payloadFatura])
        if (error) throw error
      }

      const valor = valorEmissorNumero()
      const payloadFinanceiro = {
        embarque_id: embarque.id,
        awb: embarque.awb || null,
        cliente: cliente.nome_empresa || embarque.cliente_final || embarque.importador || null,
        fatura: numeroFaturaEmissor.trim() || null,
        transportadora: embarque.transportadora || null,
        servico: embarque.servico || null,
        valor_cobranca: valor,
        doc_dta: 0,
        debito_terceiro: 0,
        valor_compra: 0,
        vencimento_cobranca: vencimentoFaturaEmissor || null,
        mes: mesDaDataEmissor(vencimentoFaturaEmissor) || null,
        observacoes: observacoesEmissor || null,
      }

      const financeiroExistente = financeiroDoEmbarque(embarque)

      if (financeiroExistente?.id) {
        const { error } = await supabase
          .from('financeiro_embarques')
          .update(payloadFinanceiro)
          .eq('id', financeiroExistente.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from('financeiro_embarques').insert([payloadFinanceiro])
        if (error) throw error
      }

      alert('Fatura gerada, vinculada ao AWB, liberada para o cliente e lançada em Processos Faturados.')
      limparEmissor()
      setAbaFaturas('LISTA')
      carregar()
    } catch (error: any) {
      console.error('Erro ao gerar fatura:', error)
      alert(error?.message || 'Erro ao gerar a fatura.')
    } finally {
      setGerandoFaturaEmissor(false)
    }
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
              Puxar AWB, gerar PDF, liberar cliente e lançar financeiro
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
                <h2 className="text-3xl font-black">Emitir fatura pelo AWB do embarque</h2>
                <p className="text-slate-400 mt-2">
                  Primeiro selecione o embarque, depois o cliente fiscal. O PDF será salvo e vinculado ao AWB para aparecer no portal do cliente.
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
              <div className="border border-blue-900 rounded-3xl bg-[#020817] p-5">
                <h3 className="text-xl font-black mb-4">1. Puxar embarque</h3>

                <input
                  value={buscaEmbarqueEmissor}
                  onChange={(e) => setBuscaEmbarqueEmissor(e.target.value)}
                  placeholder="Buscar por AWB, cliente, importador, referência..."
                  className="w-full mb-4"
                />

                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {embarquesEmissorFiltrados.map((embarque) => {
                    const ativo = embarqueEmissorId === embarque.id
                    const financeiro = financeiroDoEmbarque(embarque)
                    const fatura = faturaDoEmbarque(embarque.id)

                    return (
                      <button
                        key={embarque.id}
                        type="button"
                        onClick={() => selecionarEmbarqueEmissor(embarque)}
                        className={
                          ativo
                            ? 'w-full text-left border border-blue-400 bg-blue-600/20 rounded-2xl p-4'
                            : 'w-full text-left border border-blue-900 bg-[#071225] hover:bg-blue-600/10 rounded-2xl p-4'
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-blue-300">AWB {embarque.awb || '-'}</p>
                            <p className="font-bold text-white mt-1">
                              {embarque.cliente_final || embarque.importador || '-'}
                            </p>
                            <p className="text-slate-500 text-xs mt-1">
                              {embarque.transportadora || '-'} • {embarque.servico || '-'}
                            </p>
                          </div>

                          {fatura?.arquivo_pdf ? (
                            <span className="rounded-full border border-green-500 bg-green-600/20 px-2 py-1 text-[10px] font-black text-green-300">
                              Com fatura
                            </span>
                          ) : financeiro ? (
                            <span className="rounded-full border border-yellow-500 bg-yellow-500/20 px-2 py-1 text-[10px] font-black text-yellow-300">
                              Financeiro
                            </span>
                          ) : (
                            <span className="rounded-full border border-slate-500 bg-slate-600/20 px-2 py-1 text-[10px] font-black text-slate-300">
                              Novo
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}

                  {embarquesEmissorFiltrados.length === 0 && (
                    <div className="border border-blue-900 rounded-2xl p-4 text-slate-400">
                      Nenhum embarque encontrado.
                    </div>
                  )}
                </div>
              </div>

              <div className="xl:col-span-2 border border-blue-900 rounded-3xl bg-[#020817] p-5">
                <h3 className="text-xl font-black mb-4">Informações carregadas do embarque</h3>

                {embarqueEmissorSelecionado ? (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <InfoPacote label="AWB" valor={embarqueEmissorSelecionado.awb || '-'} destaque />
                      <InfoPacote label="Status" valor={embarqueEmissorSelecionado.status_operacional || '-'} />
                      <InfoPacote label="Transportadora" valor={embarqueEmissorSelecionado.transportadora || '-'} />
                      <InfoPacote label="Cliente processo" valor={embarqueEmissorSelecionado.cliente_final || '-'} />
                      <InfoPacote label="Exportador" valor={embarqueEmissorSelecionado.exportador || '-'} />
                      <InfoPacote label="Importador" valor={embarqueEmissorSelecionado.importador || '-'} />
                      <InfoPacote label="Serviço" valor={embarqueEmissorSelecionado.servico || '-'} />
                      <InfoPacote label="Origem/Destino" valor={`${embarqueEmissorSelecionado.origem || '-'} → ${embarqueEmissorSelecionado.destino || '-'}`} />
                      <InfoPacote label="Referência" valor={embarqueEmissorSelecionado.referencia_cliente || embarqueEmissorSelecionado.referencia_hc || '-'} />
                      <InfoPacote label="Valor sugerido" valor={moeda(valorFinanceiro(financeiroEmissorSelecionado) || numero(embarqueEmissorSelecionado.valor_cobrado_cliente) || numero(embarqueEmissorSelecionado.valor_fechado) || numero(embarqueEmissorSelecionado.valor_venda))} destaque />
                      <InfoPacote label="Vencimento financeiro" valor={dataBR(normalizarData(vencimentoFinanceiro(financeiroEmissorSelecionado)))} />
                      <InfoPacote label="Fatura atual" valor={faturaDoEmbarque(embarqueEmissorSelecionado.id)?.numero_fatura || '-'} />
                    </div>

                    <div className="border border-yellow-500/40 bg-yellow-500/10 rounded-2xl p-4 text-yellow-200 text-sm">
                      Ao gerar a fatura, ela será salva em Faturas clientes, ficará visível ao cliente e o AWB será criado ou atualizado em Financeiro &gt; Processos Faturados.
                    </div>
                  </div>
                ) : (
                  <div className="border border-blue-900 rounded-2xl p-6 text-center text-slate-400">
                    Busque e selecione um embarque para carregar os dados.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
              <h3 className="text-xl font-black mb-4">2. Cliente de faturamento</h3>

              <input
                value={buscaClienteFaturamento}
                onChange={(e) => setBuscaClienteFaturamento(e.target.value)}
                placeholder="Buscar por nome, CNPJ, CPF, cidade ou código HC..."
                className="w-full mb-4"
              />

              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {clientesFaturamentoFiltrados.map((cliente) => {
                  const ativo = clienteFaturamentoId === cliente.id

                  return (
                    <button
                      key={cliente.id}
                      type="button"
                      onClick={() => selecionarClienteFaturamento(cliente)}
                      className={
                        ativo
                          ? 'w-full text-left border border-blue-400 bg-blue-600/20 rounded-2xl p-4'
                          : 'w-full text-left border border-blue-900 bg-[#020817] hover:bg-blue-600/10 rounded-2xl p-4'
                      }
                    >
                      <p className="font-black text-blue-300">{cliente.nome_empresa || '-'}</p>
                      <p className="text-slate-300 text-xs mt-1">{documentoFiscalCliente(cliente)}</p>
                      <p className="text-slate-500 text-xs mt-1">
                        {cliente.cidade || '-'} / {cliente.estado || '-'} • {cliente.email || '-'}
                      </p>
                    </button>
                  )
                })}

                {clientesFaturamentoFiltrados.length === 0 && (
                  <div className="border border-blue-900 rounded-2xl p-4 text-slate-400">
                    Nenhum cliente encontrado. Cadastre em Clientes Faturamento.
                  </div>
                )}
              </div>
            </div>

            <div className="xl:col-span-2 border border-blue-900 rounded-3xl bg-[#071225] p-7">
              <div className="flex flex-col xl:flex-row justify-between gap-5 mb-6">
                <div>
                  <h3 className="text-xl font-black">3. Conferir e gerar PDF</h3>
                  <p className="text-slate-400 text-sm mt-1">
                    Preencha número, vencimento e valor. Depois gere a fatura final.
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
                    onClick={salvarFaturaEmitida}
                    disabled={gerandoFaturaEmissor}
                    className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-black disabled:opacity-60"
                  >
                    {gerandoFaturaEmissor ? 'Gerando e salvando...' : 'Gerar PDF, vincular AWB e lançar financeiro'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                  <label className="block text-slate-300 font-bold mb-2">Valor da fatura</label>
                  <input
                    value={valorFaturaEmissor}
                    onChange={(e) => setValorFaturaEmissor(e.target.value)}
                    placeholder="Ex: 1500,00"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-2">Total</label>
                  <div className="border border-green-700 bg-green-950/20 rounded-2xl px-4 py-3 font-black text-green-300">
                    {moeda(valorEmissorNumero())}
                  </div>
                </div>

                <div className="md:col-span-4">
                  <label className="block text-slate-300 font-bold mb-2">Observações da fatura</label>
                  <textarea
                    value={observacoesEmissor}
                    onChange={(e) => setObservacoesEmissor(e.target.value)}
                    placeholder="Observações que devem aparecer na fatura..."
                    className="min-h-[90px]"
                  />
                </div>
              </div>

              {mostrarPreviewEmissor && (
                <div className="border border-blue-900 rounded-3xl bg-[#020817] p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
                    <InfoPacote label="AWB vinculado" valor={embarqueEmissorSelecionado?.awb || '-'} destaque />
                    <InfoPacote label="Cliente fiscal" valor={clienteFaturamentoSelecionado?.nome_empresa || '-'} destaque />
                    <InfoPacote label="CNPJ/CPF" valor={documentoFiscalCliente(clienteFaturamentoSelecionado)} />
                    <InfoPacote label="Endereço" valor={enderecoFiscalCliente(clienteFaturamentoSelecionado)} />
                    <InfoPacote label="Número da fatura" valor={numeroFaturaEmissor || '-'} />
                    <InfoPacote label="Vencimento" valor={dataBR(vencimentoFaturaEmissor)} />
                    <InfoPacote label="Valor" valor={moeda(valorEmissorNumero())} destaque />
                    <InfoPacote label="Status final" valor="PDF visível para o cliente + financeiro lançado" />
                  </div>

                  {embarqueEmissorSelecionado ? (
                    <div className="border border-blue-900 rounded-2xl p-4">
                      <p className="font-black text-blue-300 mb-2">Item da fatura</p>
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
                        <InfoPacote label="AWB" valor={embarqueEmissorSelecionado.awb || '-'} />
                        <InfoPacote label="Serviço" valor={embarqueEmissorSelecionado.servico || '-'} />
                        <InfoPacote label="Transportadora" valor={embarqueEmissorSelecionado.transportadora || '-'} />
                        <InfoPacote label="Referência" valor={embarqueEmissorSelecionado.referencia_cliente || embarqueEmissorSelecionado.referencia_hc || '-'} />
                        <InfoPacote label="Valor" valor={moeda(valorEmissorNumero())} destaque />
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-500">Nenhum embarque selecionado.</div>
                  )}
                </div>
              )}
            </div>
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
