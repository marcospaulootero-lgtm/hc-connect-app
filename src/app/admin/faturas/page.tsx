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

type StatusPagamentoFinanceiro = {
  status: 'PAGO' | 'ATRASADO' | 'EM_ABERTO' | 'SEM_FINANCEIRO'
  label: string
  detalhe: string
  classe: string
}

type AbaFaturasAdmin = 'FATURAS' | 'EMISSOR'

type ClienteFaturamento = {
  id: string
  codigo_hc?: string | null
  nome_empresa: string
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
}

type PerfilCliente = {
  id: string
  nome?: string | null
  email?: string | null
  tipo_acesso?: string | null
  ativo?: boolean | null
}

type ItemFaturaServico = {
  id: string
  descricao: string
  selecionado: boolean
  valor_usd: string
  valor_brl: string
  observacao: string
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


  const [abaAtiva, setAbaAtiva] = useState<AbaFaturasAdmin>('FATURAS')
  const [clientesFaturamento, setClientesFaturamento] = useState<ClienteFaturamento[]>([])
  const [usuariosPortal, setUsuariosPortal] = useState<PerfilCliente[]>([])
  const [buscaEmissorAwb, setBuscaEmissorAwb] = useState('')
  const [buscaClienteEmissor, setBuscaClienteEmissor] = useState('')
  const [buscaUsuarioEmissor, setBuscaUsuarioEmissor] = useState('')
  const [emissorEmbarqueId, setEmissorEmbarqueId] = useState('')
  const [emissorClienteId, setEmissorClienteId] = useState('')
  const [emissorUsuarioId, setEmissorUsuarioId] = useState('')
  const [emissorNumeroFatura, setEmissorNumeroFatura] = useState('')
  const [emissorVencimento, setEmissorVencimento] = useState('')
  const [emissorTaxaConversao, setEmissorTaxaConversao] = useState('')
  const [emissorSpread, setEmissorSpread] = useState('3')
  const [emissorObservacoes, setEmissorObservacoes] = useState('')
  const [emissorVisivelCliente, setEmissorVisivelCliente] = useState(true)
  const [salvandoEmissao, setSalvandoEmissao] = useState(false)
  const [itensFatura, setItensFatura] = useState<ItemFaturaServico[]>(itensPadraoFatura())

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


    const { data: clientesFaturamentoData, error: erroClientesFaturamento } = await supabase
      .from('clientes_faturamento')
      .select('*')
      .eq('ativo', true)
      .order('nome_empresa', { ascending: true })

    if (erroClientesFaturamento) {
      console.log('ERRO CLIENTES FATURAMENTO:', erroClientesFaturamento)
    }

    setClientesFaturamento((clientesFaturamentoData as ClienteFaturamento[]) || [])

    const { data: usuariosPortalData, error: erroUsuariosPortal } = await supabase
      .from('perfis')
      .select('id, nome, email, tipo_acesso, ativo')
      .neq('tipo_acesso', 'admin')
      .order('nome', { ascending: true })

    if (erroUsuariosPortal) {
      console.log('ERRO USUÁRIOS PORTAL:', erroUsuariosPortal)
    }

    setUsuariosPortal(((usuariosPortalData as PerfilCliente[]) || []).filter((item) => item.ativo !== false))

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
    if (abaAtiva !== 'FATURAS') return []

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
    abaAtiva,
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

  const resumoFaturasAdmin = useMemo(() => {
    if (abaAtiva !== 'FATURAS') {
      return {
        totalComFatura: 0,
        totalVisiveis: 0,
        totalRecibos: 0,
        totalSemFatura: 0,
        totalFaturasArquivadas: 0,
        totalPagos: 0,
        totalAtrasados: 0,
        totalEmAberto: 0,
        totalSemFinanceiro: 0,
        statusDisponiveis: [] as any[],
      }
    }

    const faturasAtivas = faturas.filter((f) => !f.arquivado_admin)
    const pagamentosFinanceiros = embarques.map((e) => {
      const financeiro = financeiroDoEmbarque(e)

      return {
        embarque: e,
        fatura: faturaDoEmbarque(e.id),
        financeiro,
        pagamento: statusPagamentoFinanceiro(financeiro),
      }
    })

    return {
      totalComFatura: faturasAtivas.filter((f) => f.arquivo_pdf).length,
      totalVisiveis: faturasAtivas.filter((f) => f.visivel_cliente).length,
      totalRecibos: faturasAtivas.filter((f) => f.recibo_pdf).length,
      totalSemFatura: embarques.filter((e) => !faturaDoEmbarque(e.id)?.arquivo_pdf).length,
      totalFaturasArquivadas: faturas.filter((f) => f.arquivado_admin).length,
      totalPagos: pagamentosFinanceiros.filter((item) => item.pagamento.status === 'PAGO').length,
      totalAtrasados: pagamentosFinanceiros.filter((item) => item.pagamento.status === 'ATRASADO').length,
      totalEmAberto: pagamentosFinanceiros.filter((item) => item.pagamento.status === 'EM_ABERTO').length,
      totalSemFinanceiro: pagamentosFinanceiros.filter((item) => item.pagamento.status === 'SEM_FINANCEIRO').length,
      statusDisponiveis: statusOperacionaisDisponiveis(),
    }
  }, [abaAtiva, embarques, faturas, financeiros])

  const {
    totalComFatura,
    totalVisiveis,
    totalRecibos,
    totalSemFatura,
    totalFaturasArquivadas,
    totalPagos,
    totalAtrasados,
    totalEmAberto,
    totalSemFinanceiro,
    statusDisponiveis,
  } = resumoFaturasAdmin

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


  const emissorEmbarqueSelecionado = useMemo(() => {
    return embarques.find((item) => item.id === emissorEmbarqueId) || null
  }, [embarques, emissorEmbarqueId])

  const emissorClienteSelecionado = useMemo(() => {
    return clientesFaturamento.find((item) => item.id === emissorClienteId) || null
  }, [clientesFaturamento, emissorClienteId])

  const emissorUsuarioSelecionado = useMemo(() => {
    return usuariosPortal.find((item) => item.id === emissorUsuarioId) || null
  }, [usuariosPortal, emissorUsuarioId])

  const embarquesDisponiveisEmissor = useMemo(() => {
    const termo = normalizarTexto(buscaEmissorAwb)

    return embarques
      .filter((embarque) => {
        if (!termo) return true

        const base = normalizarTexto(`
          ${embarque.awb || ''}
          ${embarque.cliente_final || ''}
          ${embarque.importador || ''}
          ${embarque.exportador || ''}
          ${embarque.referencia_cliente || ''}
          ${embarque.referencia_hc || ''}
          ${embarque.transportadora || ''}
          ${embarque.servico || ''}
        `)

        return base.includes(termo)
      })
      .slice(0, 120)
  }, [embarques, buscaEmissorAwb])

  const clientesFaturamentoEmissor = useMemo(() => {
    const termo = normalizarTexto(buscaClienteEmissor)
    const clienteSelecionado = clientesFaturamento.find((item) => item.id === emissorClienteId) || null

    const filtrados = clientesFaturamento
      .filter((cliente) => {
        if (!termo) return true

        const base = normalizarTexto(`
          ${cliente.codigo_hc || ''}
          ${cliente.nome_empresa || ''}
          ${cliente.cnpj || ''}
          ${cliente.cpf || ''}
          ${cliente.cidade || ''}
          ${cliente.estado || ''}
          ${cliente.email || ''}
        `)

        return base.includes(termo)
      })
      .slice(0, 120)

    if (clienteSelecionado && !filtrados.some((item) => item.id === clienteSelecionado.id)) {
      return [clienteSelecionado, ...filtrados.slice(0, 119)]
    }

    return filtrados
  }, [clientesFaturamento, buscaClienteEmissor, emissorClienteId])

  const usuariosPortalEmissor = useMemo(() => {
    const termo = normalizarTexto(buscaUsuarioEmissor)
    const usuarioSelecionado = usuariosPortal.find((item) => item.id === emissorUsuarioId) || null

    const filtrados = usuariosPortal
      .filter((usuario) => {
        if (!termo) return true

        const base = normalizarTexto(`
          ${usuario.nome || ''}
          ${usuario.email || ''}
          ${usuario.tipo_acesso || ''}
        `)

        return base.includes(termo)
      })
      .slice(0, 120)

    if (usuarioSelecionado && !filtrados.some((item) => item.id === usuarioSelecionado.id)) {
      return [usuarioSelecionado, ...filtrados.slice(0, 119)]
    }

    return filtrados
  }, [usuariosPortal, buscaUsuarioEmissor, emissorUsuarioId])

  const totaisEmissor = useMemo(() => {
    return itensFatura.reduce(
      (acc, item) => {
        if (!item.selecionado) return acc

        acc.totalUSD += numero(item.valor_usd)
        acc.totalBRL += numero(item.valor_brl)
        return acc
      },
      { totalUSD: 0, totalBRL: 0 }
    )
  }, [itensFatura])

  function taxaConversaoFinal(ptaxValor = emissorTaxaConversao, spreadValor = emissorSpread) {
    const ptax = numero(ptaxValor)
    const spread = numero(spreadValor)

    if (ptax <= 0) return 0

    return ptax * (1 + spread / 100)
  }

  function taxaConversaoFinalFormatada(ptaxValor = emissorTaxaConversao, spreadValor = emissorSpread) {
    const taxa = taxaConversaoFinal(ptaxValor, spreadValor)
    if (taxa <= 0) return '-'

    return taxa.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  }

  function gerarNumeroFaturaSugerido(embarque?: Embarque | null) {
    const data = new Date()
    const ano = String(data.getFullYear()).slice(2)
    const mes = String(data.getMonth() + 1).padStart(2, '0')
    const dia = String(data.getDate()).padStart(2, '0')
    const awbFinal = String(embarque?.awb || '').replace(/\D/g, '').slice(-4) || '0000'

    return `HC${ano}${mes}${dia}${awbFinal}`
  }

  function selecionarEmbarqueEmissor(embarqueId: string) {
    setEmissorEmbarqueId(embarqueId)

    const embarque = embarques.find((item) => item.id === embarqueId) || null
    if (!embarque) return

    const financeiro = financeiroDoEmbarque(embarque)
    const valor = valorFinanceiro(financeiro) || numero(embarque.valor_fechado) || numero(embarque.valor_cobrado_cliente) || numero(embarque.valor_venda)
    const vencimento = normalizarData(vencimentoFinanceiro(financeiro)) || ''
    const taxa = numero(embarque.taxa_conversao)
    const numeroAtual = faturaDoEmbarque(embarque.id)?.numero_fatura || gerarNumeroFaturaSugerido(embarque)

    setEmissorNumeroFatura(numeroAtual)
    setEmissorVencimento(vencimento)
    setEmissorTaxaConversao(taxa ? String(taxa).replace('.', ',') : '')
    setEmissorUsuarioId(embarque.usuario_id || '')

    const taxaFinal = taxaConversaoFinal(taxa ? String(taxa).replace('.', ',') : '', emissorSpread)

    setItensFatura((atuais) =>
      atuais.map((item) => {
        if (item.id !== 'frete') return { ...item, selecionado: false, valor_usd: '', valor_brl: '', observacao: '' }

        return {
          ...item,
          selecionado: valor > 0,
          valor_usd: taxaFinal > 0 && valor > 0 ? formatarNumeroInput(valor / taxaFinal) : '',
          valor_brl: valor > 0 ? formatarNumeroInput(valor) : '',
          observacao: embarque.transportadora || '',
        }
      })
    )
  }

  function atualizarItemFatura(id: string, campo: keyof ItemFaturaServico, valor: string | boolean) {
    setItensFatura((atuais) =>
      atuais.map((item) => {
        if (item.id !== id) return item

        const atualizado: ItemFaturaServico = {
          ...item,
          [campo]: valor,
        } as ItemFaturaServico

        if (campo === 'valor_usd') {
          const taxa = taxaConversaoFinal()
          const valorUsd = numero(valor)
          if (taxa > 0 && valorUsd > 0) {
            atualizado.valor_brl = formatarNumeroInput(valorUsd * taxa)
          }
        }

        return atualizado
      })
    )
  }

  function recalcularItensPorTaxa(novaTaxa: string) {
    setEmissorTaxaConversao(novaTaxa)

    const taxa = taxaConversaoFinal(novaTaxa, emissorSpread)
    if (taxa <= 0) return

    setItensFatura((atuais) =>
      atuais.map((item) => {
        const valorUsd = numero(item.valor_usd)
        if (!item.selecionado || valorUsd <= 0) return item

        return {
          ...item,
          valor_brl: formatarNumeroInput(valorUsd * taxa),
        }
      })
    )
  }

  function recalcularItensPorSpread(novoSpread: string) {
    setEmissorSpread(novoSpread)

    const taxa = taxaConversaoFinal(emissorTaxaConversao, novoSpread)
    if (taxa <= 0) return

    setItensFatura((atuais) =>
      atuais.map((item) => {
        const valorUsd = numero(item.valor_usd)
        if (!item.selecionado || valorUsd <= 0) return item

        return {
          ...item,
          valor_brl: formatarNumeroInput(valorUsd * taxa),
        }
      })
    )
  }

  function limparEmissor() {
    setBuscaEmissorAwb('')
    setBuscaClienteEmissor('')
    setBuscaUsuarioEmissor('')
    setEmissorEmbarqueId('')
    setEmissorClienteId('')
    setEmissorUsuarioId('')
    setEmissorNumeroFatura('')
    setEmissorVencimento('')
    setEmissorTaxaConversao('')
    setEmissorSpread('3')
    setEmissorObservacoes('')
    setEmissorVisivelCliente(true)
    setItensFatura(itensPadraoFatura())
  }

  function mesFinanceiroDaFatura() {
    return normalizarData(emissorVencimento)?.slice(0, 7) || new Date().toISOString().slice(0, 7)
  }

  function itensSelecionadosFatura() {
    return itensFatura
      .filter((item) => item.selecionado && (numero(item.valor_usd) > 0 || numero(item.valor_brl) > 0 || item.observacao.trim()))
      .map((item) => ({
        descricao: item.descricao,
        valor_usd: numero(item.valor_usd),
        valor_brl: numero(item.valor_brl),
        observacao: item.observacao || null,
      }))
  }

  async function salvarFinanceiroDaFatura(arquivoPdfUrl: string) {
    if (!emissorEmbarqueSelecionado || !emissorClienteSelecionado) return

    const financeiroAtual = financeiroDoEmbarque(emissorEmbarqueSelecionado)
    const itensResumo = itensSelecionadosFatura()
      .map((item) => `${item.descricao}: ${moeda(item.valor_brl)}`)
      .join(' | ')

    const payloadBase: any = {
      cliente: emissorClienteSelecionado.nome_empresa || emissorEmbarqueSelecionado.cliente_final || emissorEmbarqueSelecionado.importador || null,
      awb: emissorEmbarqueSelecionado.awb || null,
      fatura: emissorNumeroFatura || null,
      transportadora: emissorEmbarqueSelecionado.transportadora || null,
      servico: emissorEmbarqueSelecionado.servico || null,
      valor_cobranca: totaisEmissor.totalBRL,
      doc_dta: 0,
      debito_terceiro: 0,
      valor_compra: 0,
      vencimento_cobranca: emissorVencimento || null,
      recebimento: null,
      mes: mesFinanceiroDaFatura(),
      mes_profit: '',
      observacoes: `Fatura emitida pelo HC Connect. PDF: ${arquivoPdfUrl}. Itens: ${itensResumo}${emissorObservacoes ? ` | Obs: ${emissorObservacoes}` : ''}`,
    }

    if (financeiroAtual?.id) {
      const { error } = await supabase
        .from('financeiro_embarques')
        .update(payloadBase)
        .eq('id', financeiroAtual.id)

      if (error) throw new Error(`Fatura salva, mas houve erro ao atualizar Processos Faturados: ${error.message}`)
      return
    }

    const payloadComEmbarqueId = {
      ...payloadBase,
      embarque_id: emissorEmbarqueSelecionado.id,
    }

    const { error } = await supabase.from('financeiro_embarques').insert([payloadComEmbarqueId])

    if (error) {
      const erroColunaEmbarque = String(error.message || '').toLowerCase().includes('embarque_id')

      if (erroColunaEmbarque) {
        const { error: erroSemEmbarque } = await supabase.from('financeiro_embarques').insert([payloadBase])
        if (erroSemEmbarque) throw new Error(`Fatura salva, mas houve erro ao lançar em Processos Faturados: ${erroSemEmbarque.message}`)
        return
      }

      throw new Error(`Fatura salva, mas houve erro ao lançar em Processos Faturados: ${error.message}`)
    }
  }

  async function garantirLoginVinculadoAoEmbarque() {
    if (!emissorEmbarqueSelecionado || !emissorUsuarioId) return

    if (!emissorEmbarqueSelecionado.usuario_id) {
      await supabase
        .from('embarques')
        .update({ usuario_id: emissorUsuarioId })
        .eq('id', emissorEmbarqueSelecionado.id)
    }

    const { data: vinculoExistente, error: erroConsultaVinculo } = await supabase
      .from('embarque_clientes')
      .select('*')
      .eq('embarque_id', emissorEmbarqueSelecionado.id)
      .eq('usuario_id', emissorUsuarioId)
      .limit(1)

    if (erroConsultaVinculo) {
      console.log('Não foi possível consultar vínculo do embarque com o login:', erroConsultaVinculo)
      return
    }

    if (vinculoExistente && vinculoExistente.length > 0) return

    const { error: erroInserirVinculo } = await supabase
      .from('embarque_clientes')
      .insert([{
        embarque_id: emissorEmbarqueSelecionado.id,
        usuario_id: emissorUsuarioId,
      }])

    if (erroInserirVinculo) {
      console.log('Não foi possível vincular embarque ao login do cliente:', erroInserirVinculo)
    }
  }

  async function gerarPdfFaturaHC() {
    if (!emissorEmbarqueSelecionado) return alert('Selecione o embarque/AWB primeiro.')
    if (!emissorClienteSelecionado) return alert('Selecione o cliente de faturamento.')
    if (emissorVisivelCliente && !emissorUsuarioId) return alert('Selecione o login do cliente que visualizará a fatura no portal.')
    if (!emissorNumeroFatura.trim()) return alert('Informe o número da fatura.')
    if (!emissorVencimento) return alert('Informe o vencimento da fatura.')
    if (itensSelecionadosFatura().length === 0 || totaisEmissor.totalBRL <= 0) {
      return alert('Selecione pelo menos um serviço com valor para emitir a fatura.')
    }

    setSalvandoEmissao(true)

    try {
      const jsPDFModule = await import('jspdf')
      const autoTableModule = await import('jspdf-autotable')

      const jsPDF = (jsPDFModule as any).jsPDF || (jsPDFModule as any).default
      const autoTable = (autoTableModule as any).default || (autoTableModule as any).autoTable

      if (!jsPDF || !autoTable) {
        throw new Error('Biblioteca de PDF não carregou corretamente. Rode npm install jspdf jspdf-autotable e publique novamente.')
      }

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' }) as any
      const margem = 32
      const larguraPagina = pdf.internal.pageSize.getWidth()
      const itens = itensSelecionadosFatura()
      const dadosCliente = dadosClienteFiscal(emissorClienteSelecionado)

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text('FATURA DE SERVIÇO', margem, 34)
      pdf.text(`CÓDIGO CLIENTE: ${emissorClienteSelecionado.codigo_hc || '-'}`, 185, 34)
      pdf.text(`FATURA Nº: ${emissorNumeroFatura}`, 348, 34)

      pdf.setFontSize(10)
      pdf.text(`DATA DA FATURA: ${dataBR(new Date().toISOString())}`, 430, 56)
      pdf.text(`DATA DE VENC.: ${dataBR(emissorVencimento)}`, 430, 76)

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.text('COUTO E OTERO INTERMEDIAÇÃO LTDA', margem, 58)
      pdf.setFont('helvetica', 'normal')
      pdf.text('RUA DOS COMANCHES Nº 131', margem, 78)
      pdf.text('BELO HORIZONTE, MG', margem, 92)
      pdf.text('31530250', margem, 106)
      pdf.text('CNPJ 41.456.630/0001-52', margem, 120)
      pdf.text('TELEFONE: 55 (31) 3643-6175', 185, 78)
      pdf.text('E-MAIL: GRUPOHCCONSULTORIA@OUTLOOK.COM', 185, 106)
      pdf.text('INSCRIÇÃO ESTADUAL: ISENTO', 185, 128)
      pdf.text('INSCRIÇÃO MUNICIPAL: 1296606100', 350, 128)

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(22)
      pdf.text('HC', larguraPagina - 92, 104)
      pdf.setFontSize(7)
      pdf.text('CONSULTORIA', larguraPagina - 112, 116)

      pdf.setDrawColor(0, 0, 0)
      pdf.setFillColor(221, 229, 244)
      pdf.rect(margem, 140, larguraPagina - margem * 2, 94, 'FD')
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Cobrança para:', margem + 8, 158)
      pdf.text('CNPJ / CPF:', 360, 158)
      pdf.text('Endereço:', margem + 8, 182)

      pdf.setFont('helvetica', 'normal')
      pdf.text(dadosCliente.nome || '-', 150, 158)
      pdf.text(dadosCliente.documento || '-', 430, 158)
      pdf.text(dadosCliente.endereco || '-', 150, 182)
      pdf.text(`${dadosCliente.cidade || '-'} / ${dadosCliente.estado || '-'}`, 150, 204)
      pdf.text(`CEP: ${dadosCliente.cep || '-'}`, 150, 222)

      pdf.setFont('helvetica', 'bold')
      pdf.text('DISCRIMINAÇÃO DOS SERVIÇOS', margem, 252)
      pdf.text(`HAWB/AWB: ${emissorEmbarqueSelecionado.awb || '-'}`, 245, 252)

      const linhas = itens.map((item) => [
        item.descricao,
        item.observacao || '',
        item.valor_usd > 0 ? formatarValorSimples(item.valor_usd) : '-',
        item.valor_brl > 0 ? moeda(item.valor_brl) : '-',
      ])

      autoTable(pdf, {
        startY: 260,
        head: [['SERVIÇO', 'OBSERVAÇÃO', 'VALOR USD', 'VALOR R$']],
        body: linhas,
        theme: 'grid',
        margin: { left: margem, right: margem },
        styles: { fontSize: 8, cellPadding: 4, lineColor: [25, 25, 25], lineWidth: 0.4 },
        headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 190 },
          1: { cellWidth: 170 },
          2: { cellWidth: 80, halign: 'right' },
          3: { cellWidth: 90, halign: 'right' },
        },
      })

      const yFinal = (pdf as any).lastAutoTable.finalY + 14
      pdf.setFillColor(190, 190, 190)
      pdf.rect(margem, yFinal, larguraPagina - margem * 2, 18, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(8)
      pdf.text('TOTAL', margem + 6, yFinal + 12)
      pdf.text('USD', 390, yFinal + 12)
      pdf.text(formatarValorSimples(totaisEmissor.totalUSD), 435, yFinal + 12, { align: 'right' })
      pdf.text('R$', 470, yFinal + 12)
      pdf.text(moeda(totaisEmissor.totalBRL).replace('R$', '').trim(), larguraPagina - margem - 6, yFinal + 12, { align: 'right' })

      const yExtenso = yFinal + 42
      pdf.setDrawColor(0, 0, 0)
      pdf.rect(margem, yExtenso - 20, larguraPagina - margem * 2, 32)
      pdf.setFont('helvetica', 'bold')
      pdf.text('VALOR POR EXTENSO', margem + 8, yExtenso)
      pdf.setFont('helvetica', 'normal')
      pdf.text(valorPorExtensoBRL(totaisEmissor.totalBRL), 230, yExtenso)

      const yTaxa = yExtenso + 36
      pdf.rect(margem, yTaxa - 18, larguraPagina - margem * 2, 26)
      pdf.setFont('helvetica', 'bold')
      pdf.text('TAXA DE CONVERSÃO:', margem + 8, yTaxa)
      pdf.text(`SPREAD ${emissorSpread || '0'}%`, 240, yTaxa)
      pdf.text(`R$ ${taxaConversaoFinalFormatada()}`, larguraPagina - margem - 6, yTaxa, { align: 'right' })

      const yBanco = yTaxa + 30
      pdf.setFillColor(45, 119, 183)
      pdf.rect(margem, yBanco - 16, larguraPagina - margem * 2, 54, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'bold')
      pdf.text('BANCO BS2 - 218 - BS2 - AGÊNCIA 0001 CONTA: 8749272', larguraPagina / 2, yBanco, { align: 'center' })
      pdf.text('BANCO ITAÚ - AG. 4508 CONTA: 99842-6 CHAVE PIX E-MAIL: GRUPOHCCONSULTORIA@OUTLOOK.COM', larguraPagina / 2, yBanco + 15, { align: 'center' })
      pdf.text('BANCO CONTABILIZEI DOCK IP S.A. 301 - AG: 0001 CONTA 311413-7 CHAVE PIX CNPJ: 41.456.630/0001-52', larguraPagina / 2, yBanco + 30, { align: 'center' })
      pdf.setTextColor(0, 0, 0)

      const yAssinatura = yBanco + 70
      pdf.setFont('helvetica', 'italic')
      pdf.setFontSize(10)
      pdf.text('Marcos Paulo Otero', larguraPagina / 2, yAssinatura, { align: 'center' })
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      pdf.text('COUTO E OTERO INTERMEDIAÇÃO LTDA', larguraPagina / 2, yAssinatura + 12, { align: 'center' })
      pdf.text('CNPJ: 41.456.630/0001-52', larguraPagina / 2, yAssinatura + 23, { align: 'center' })

      if (emissorObservacoes) {
        pdf.setFontSize(7)
        pdf.text(`Observações: ${emissorObservacoes}`, margem, yAssinatura + 48, {
          maxWidth: larguraPagina - margem * 2,
        })
      }

      const blob = pdf.output('blob') as Blob
      const nomeArquivo = `${emissorEmbarqueSelecionado.id}/${Date.now()}-fatura-${emissorNumeroFatura.replace(/[^A-Z0-9_-]/gi, '-')}.pdf`

      const { error: erroUpload } = await supabase.storage
        .from('faturas')
        .upload(nomeArquivo, blob, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'application/pdf',
        })

      if (erroUpload) throw new Error(erroUpload.message)

      const { data: urlData } = supabase.storage.from('faturas').getPublicUrl(nomeArquivo)
      const urlPdf = urlData.publicUrl
      const faturaExistente = faturaDoEmbarque(emissorEmbarqueSelecionado.id)
      const caminhoAntigo = extrairCaminhoStorage(faturaExistente?.arquivo_pdf)

      if (caminhoAntigo) {
        await supabase.storage.from('faturas').remove([caminhoAntigo])
      }

      const payloadFatura: any = {
        embarque_id: emissorEmbarqueSelecionado.id,
        usuario_id: emissorUsuarioId || emissorEmbarqueSelecionado.usuario_id || null,
        numero_fatura: emissorNumeroFatura || null,
        arquivo_pdf: urlPdf,
        visivel_cliente: emissorVisivelCliente,
        observacoes: emissorObservacoes || null,
        cliente_faturamento_id: emissorClienteSelecionado.id,
        dados_cliente_faturamento: dadosCliente,
        itens_fatura: itensSelecionadosFatura(),
        valor_total: totaisEmissor.totalBRL,
        valor_usd: totaisEmissor.totalUSD,
        taxa_conversao: taxaConversaoFinal(),
        spread: numero(emissorSpread),
        vencimento: emissorVencimento || null,
      }

      if (faturaExistente) {
        const { error } = await supabase.from('faturas').update(payloadFatura).eq('id', faturaExistente.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase.from('faturas').insert([payloadFatura])
        if (error) throw new Error(error.message)
      }

      await garantirLoginVinculadoAoEmbarque()
      await salvarFinanceiroDaFatura(urlPdf)

      alert('Fatura emitida, salva, vinculada ao AWB/login e lançada em Processos Faturados.')
      limparEmissor()
      setAbaAtiva('FATURAS')
      carregar()
    } catch (error: any) {
      console.error(error)
      alert(
        `Erro ao emitir fatura: ${error?.message || error}\n\nSe o erro mencionar uma coluna da tabela faturas, rode primeiro o SQL de atualização que eu enviei.`
      )
    } finally {
      setSalvandoEmissao(false)
    }
  }

  function renderAbaEmissor() {
    const embarque = emissorEmbarqueSelecionado
    const cliente = emissorClienteSelecionado
    const financeiro = embarque ? financeiroDoEmbarque(embarque) : null
    const dadosCliente = cliente ? dadosClienteFiscal(cliente) : null
    const usuarioPortal = emissorUsuarioSelecionado

    return (
      <section className="space-y-6">
        <div className="rounded-3xl border border-blue-900 bg-[#071225] p-6 lg:p-7">
          <div className="mb-6 flex flex-col lg:flex-row justify-between gap-5">
            <div>
              <p className="text-blue-400 font-black mb-2">Emissor de faturas</p>
              <h2 className="text-3xl font-black">Emitir fatura vinculada ao AWB</h2>
              <p className="mt-2 text-slate-400">
                Primeiro selecione o embarque, depois o cliente fiscal, escolha os serviços cobrados e gere o PDF para o cliente.
              </p>
            </div>

            <button
              type="button"
              onClick={limparEmissor}
              className="h-fit rounded-2xl bg-slate-700 px-5 py-3 font-black hover:bg-slate-600"
            >
              Limpar emissão
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="rounded-2xl border border-blue-900 bg-[#020817] p-5">
              <h3 className="text-xl font-black mb-4">1. Puxar embarque</h3>

              <input
                value={buscaEmissorAwb}
                onChange={(e) => setBuscaEmissorAwb(e.target.value)}
                placeholder="Buscar por AWB, cliente, referência..."
                className="mb-3 w-full"
              />

              <select
                value={emissorEmbarqueId}
                onChange={(e) => selecionarEmbarqueEmissor(e.target.value)}
                className="w-full"
              >
                <option value="">Selecione o AWB</option>
                {embarquesDisponiveisEmissor.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.awb || 'Sem AWB'} - {item.cliente_final || item.importador || 'Cliente não informado'}
                  </option>
                ))}
              </select>

              {embarque ? (
                <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
                  <InfoPacote label="AWB / HAWB" valor={embarque.awb || '-'} destaque />
                  <InfoPacote label="Cliente embarque" valor={embarque.cliente_final || embarque.importador || '-'} />
                  <InfoPacote label="Exportador" valor={embarque.exportador || '-'} />
                  <InfoPacote label="Importador" valor={embarque.importador || '-'} />
                  <InfoPacote label="Serviço" valor={embarque.servico || '-'} />
                  <InfoPacote label="Transportadora" valor={embarque.transportadora || '-'} />
                  <InfoPacote label="Origem / destino" valor={`${embarque.origem || '-'} → ${embarque.destino || '-'}`} />
                  <InfoPacote label="Valor base encontrado" valor={moedaFechada(embarque, financeiro)} destaque />
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Selecione um embarque para carregar os dados.</p>
              )}
            </div>

            <div className="rounded-2xl border border-blue-900 bg-[#020817] p-5">
              <h3 className="text-xl font-black mb-4">2. Cliente para faturamento</h3>

              <input
                value={buscaClienteEmissor}
                onChange={(e) => setBuscaClienteEmissor(e.target.value)}
                placeholder="Buscar cliente fiscal por nome, CNPJ, CPF ou código..."
                className="mb-3 w-full"
              />

              <select
                value={emissorClienteId}
                onChange={(e) => setEmissorClienteId(e.target.value)}
                className="w-full"
              >
                <option value="">Selecione o cliente fiscal</option>
                {clientesFaturamentoEmissor.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.codigo_hc ? `${item.codigo_hc} - ` : ''}{item.nome_empresa} - {item.cnpj || item.cpf || 'sem documento'}
                  </option>
                ))}
              </select>

              <p className="mt-2 text-xs text-slate-500">
                Mostrando até 120 cadastros para deixar a digitação rápida. Use a busca para filtrar.
              </p>

              <div className="mt-4 rounded-2xl border border-blue-900 bg-[#071225] p-4">
                <label className="text-sm font-black text-slate-300">
                  Login que verá a fatura no portal
                  <input
                    value={buscaUsuarioEmissor}
                    onChange={(e) => setBuscaUsuarioEmissor(e.target.value)}
                    placeholder="Buscar login por nome ou e-mail..."
                    className="mt-2 mb-3 w-full"
                  />

                  <select
                    value={emissorUsuarioId}
                    onChange={(e) => setEmissorUsuarioId(e.target.value)}
                    className="w-full"
                  >
                    <option value="">Selecione o login do cliente</option>
                    {usuariosPortalEmissor.map((usuario) => (
                      <option key={usuario.id} value={usuario.id}>
                        {(usuario.nome || usuario.email || 'Cliente sem nome')} - {usuario.email || 'sem e-mail'}
                      </option>
                    ))}
                  </select>
                </label>

                {usuarioPortal ? (
                  <p className="mt-3 text-xs text-green-300">
                    Esta fatura ficará vinculada ao login: <strong>{usuarioPortal.email || usuarioPortal.nome}</strong>
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-yellow-300">
                    Se a fatura for visível para o cliente, selecione o login para aparecer no portal.
                  </p>
                )}
              </div>

              {dadosCliente ? (
                <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
                  <InfoPacote label="Cobrança para" valor={dadosCliente.nome} destaque />
                  <InfoPacote label="CNPJ / CPF" valor={dadosCliente.documento} />
                  <InfoPacote label="Endereço" valor={dadosCliente.endereco} />
                  <InfoPacote label="Cidade / Estado" valor={`${dadosCliente.cidade || '-'} / ${dadosCliente.estado || '-'}`} />
                  <InfoPacote label="CEP" valor={dadosCliente.cep} />
                  <InfoPacote label="Inscrição estadual" valor={dadosCliente.inscricao_estadual || 'ISENTO'} />
                  <InfoPacote label="Inscrição municipal" valor={dadosCliente.inscricao_municipal || '-'} />
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Selecione o cadastro fiscal que sairá na fatura.</p>
              )}
            </div>

            <div className="rounded-2xl border border-blue-900 bg-[#020817] p-5">
              <h3 className="text-xl font-black mb-4">3. Dados da fatura</h3>

              <div className="grid grid-cols-1 gap-3">
                <input
                  value={emissorNumeroFatura}
                  onChange={(e) => setEmissorNumeroFatura(e.target.value)}
                  placeholder="Número da fatura"
                />

                <label className="text-sm font-bold text-slate-300">
                  Vencimento
                  <input
                    type="date"
                    value={emissorVencimento}
                    onChange={(e) => setEmissorVencimento(e.target.value)}
                    className="mt-2 w-full"
                  />
                </label>

                <label className="text-sm font-bold text-slate-300">
                  PTAX base
                  <input
                    value={emissorTaxaConversao}
                    onChange={(e) => recalcularItensPorTaxa(e.target.value)}
                    placeholder="Ex.: 5,1743"
                    className="mt-2 w-full"
                  />
                </label>

                <label className="text-sm font-bold text-slate-300">
                  Spread %
                  <input
                    value={emissorSpread}
                    onChange={(e) => recalcularItensPorSpread(e.target.value)}
                    placeholder="3"
                    className="mt-2 w-full"
                  />
                </label>

                <div className="rounded-2xl border border-green-900 bg-green-950/20 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">Taxa final com spread</p>
                  <p className="mt-1 text-2xl font-black text-green-300">R$ {taxaConversaoFinalFormatada()}</p>
                  <p className="mt-1 text-xs text-slate-400">O USD é convertido usando PTAX + spread.</p>
                </div>

                <label className="flex items-center gap-2 rounded-2xl border border-blue-900 bg-[#071225] px-4 py-3 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={emissorVisivelCliente}
                    onChange={(e) => setEmissorVisivelCliente(e.target.checked)}
                  />
                  Disponibilizar para o cliente
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-blue-900 bg-[#071225] p-5 lg:p-7">
          <div className="mb-5 flex flex-col lg:flex-row justify-between gap-4">
            <div>
              <h3 className="text-2xl font-black">4. Serviços da cobrança</h3>
              <p className="text-slate-400 text-sm">
                Marque os serviços que entram na fatura. Os valores detalhados ficam no PDF; o total vai para Processos Faturados.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="rounded-2xl border border-blue-900 bg-[#020817] p-4">
                <p className="text-xs text-slate-500 font-black">TOTAL USD</p>
                <p className="text-2xl font-black text-blue-300">{formatarValorSimples(totaisEmissor.totalUSD)}</p>
              </div>
              <div className="rounded-2xl border border-green-900 bg-green-950/20 p-4">
                <p className="text-xs text-slate-500 font-black">TOTAL R$</p>
                <p className="text-2xl font-black text-green-300">{moeda(totaisEmissor.totalBRL)}</p>
              </div>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm [&_th]:border-b [&_th]:border-blue-900 [&_th]:px-3 [&_th]:py-3 [&_th]:text-left [&_th]:font-black [&_th]:text-slate-300 [&_td]:border-b [&_td]:border-blue-900/50 [&_td]:px-3 [&_td]:py-3">
              <thead>
                <tr>
                  <th className="w-[80px]">Usar</th>
                  <th>Serviço</th>
                  <th className="w-[160px]">Valor USD</th>
                  <th className="w-[180px]">Valor R$</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {itensFatura.map((item) => (
                  <tr key={item.id} className={item.selecionado ? 'bg-blue-600/10' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={item.selecionado}
                        onChange={(e) => atualizarItemFatura(item.id, 'selecionado', e.target.checked)}
                      />
                    </td>
                    <td className="font-black text-slate-200">{item.descricao}</td>
                    <td>
                      <input
                        value={item.valor_usd}
                        onChange={(e) => atualizarItemFatura(item.id, 'valor_usd', e.target.value)}
                        placeholder="0,00"
                        className="w-full"
                      />
                    </td>
                    <td>
                      <input
                        value={item.valor_brl}
                        onChange={(e) => atualizarItemFatura(item.id, 'valor_brl', e.target.value)}
                        placeholder="0,00"
                        className="w-full"
                      />
                    </td>
                    <td>
                      <input
                        value={item.observacao}
                        onChange={(e) => atualizarItemFatura(item.id, 'observacao', e.target.value)}
                        placeholder="Opcional"
                        className="w-full"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-blue-900 bg-[#071225] p-6 lg:p-7">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <h3 className="text-2xl font-black mb-3">5. Observações e emissão</h3>
              <textarea
                value={emissorObservacoes}
                onChange={(e) => setEmissorObservacoes(e.target.value)}
                placeholder="Observações internas ou detalhes que devem constar no histórico da fatura"
                className="min-h-[110px] w-full"
              />

              <div className="mt-4 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-yellow-100">
                Ao emitir, o sistema salva o PDF em Faturas clientes, vincula ao AWB e lança o total em Financeiro &gt; Processos Faturados. O custo fica zerado até você lançar o custo real no financeiro.
              </div>
            </div>

            <div className="rounded-2xl border border-green-900 bg-green-950/20 p-5">
              <p className="text-slate-400 text-sm font-black">Resumo final</p>
              <h3 className="mt-2 text-4xl font-black text-green-300">{moeda(totaisEmissor.totalBRL)}</h3>
              <p className="mt-2 text-sm text-slate-400">{valorPorExtensoBRL(totaisEmissor.totalBRL)}</p>

              <button
                type="button"
                onClick={gerarPdfFaturaHC}
                disabled={salvandoEmissao}
                className="mt-5 w-full rounded-2xl bg-blue-600 px-5 py-4 font-black hover:bg-blue-500 disabled:opacity-60"
              >
                {salvandoEmissao ? 'Gerando e salvando...' : 'Gerar PDF e lançar fatura'}
              </button>
            </div>
          </div>
        </div>
      </section>
    )
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
          onClick={() => setAbaAtiva('EMISSOR')}
          className="bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold h-fit"
        >
          Emitir nova fatura
        </button>
      </div>

      <div className="mb-8 flex flex-wrap gap-3 rounded-3xl border border-blue-900 bg-[#071225] p-3">
        <button
          type="button"
          onClick={() => setAbaAtiva('FATURAS')}
          className={
            abaAtiva === 'FATURAS'
              ? 'rounded-2xl bg-blue-600 px-5 py-3 font-black text-white shadow-[0_0_25px_rgba(37,99,235,0.25)]'
              : 'rounded-2xl bg-[#020817] px-5 py-3 font-black text-slate-300 hover:bg-blue-600/20 hover:text-white'
          }
        >
          🧾 Faturas clientes
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('EMISSOR')}
          className={
            abaAtiva === 'EMISSOR'
              ? 'rounded-2xl bg-blue-600 px-5 py-3 font-black text-white shadow-[0_0_25px_rgba(37,99,235,0.25)]'
              : 'rounded-2xl bg-[#020817] px-5 py-3 font-black text-slate-300 hover:bg-blue-600/20 hover:text-white'
          }
        >
          🧮 Emitir nova fatura
        </button>
      </div>

      {abaAtiva === 'EMISSOR' ? (
        renderAbaEmissor()
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

function itensPadraoFatura(): ItemFaturaServico[] {
  return [
    { id: 'contas', descricao: 'CONTAS', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'area_remota', descricao: 'ÁREA REMOTA', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'manuseio_formal', descricao: 'MANUSEIO FORMAL', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'delivery_fee_doc', descricao: 'DELIVERY FEE DOC', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'desconto', descricao: 'DESCONTO', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'dgr', descricao: 'DGR', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'tarifa_carga_nao_empilhavel', descricao: 'TARIFA ADICIONAL P/ CARGA NÃO EMPILHÁVEL', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'dta', descricao: 'DTA', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'outras_taxas', descricao: 'OUTRAS TAXAS', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'due_dre', descricao: 'DUE / DRE', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'frete', descricao: 'FRETE', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'frete_fedex', descricao: 'FRETE FEDEX', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'handling', descricao: 'HANDLING', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'impostos', descricao: 'IMPOSTOS', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'impostos_brl', descricao: 'IMPOSTOS R$', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'divergencia_peso', descricao: 'DIVERGÊNCIA DE PESO', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'oversize_piece', descricao: 'OVERSIZE PIECE', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'seguro', descricao: 'SEGURO', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'taxa_alta_demanda', descricao: 'TAXA DE ALTA DEMANDA', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'entrega_fora_area', descricao: 'ENTREGA FORA DA ÁREA', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'coberta_nivel_b', descricao: 'COBERTA NÍVEL B', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
  ]
}

function dadosClienteFiscal(cliente: ClienteFaturamento) {
  return {
    id: cliente.id,
    codigo_hc: cliente.codigo_hc || null,
    nome: cliente.nome_empresa || '',
    contato: cliente.nome_contato || cliente.contato || null,
    documento: cliente.cnpj || cliente.cpf || '',
    endereco: cliente.endereco || '',
    cidade: cliente.cidade || '',
    estado: cliente.estado || '',
    cep: cliente.cep || '',
    email: cliente.email || null,
    inscricao_estadual: cliente.inscricao_estadual || null,
    inscricao_municipal: cliente.inscricao_municipal || null,
  }
}

function formatarNumeroInput(valor: number) {
  if (!Number.isFinite(valor)) return ''
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatarValorSimples(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function valorPorExtensoBRL(valorOriginal: number) {
  const valor = Math.max(0, Math.round(Number(valorOriginal || 0) * 100) / 100)
  const reais = Math.floor(valor)
  const centavos = Math.round((valor - reais) * 100)

  const partes: string[] = []

  if (reais === 0) {
    partes.push('zero real')
  } else {
    partes.push(`${numeroPorExtenso(reais)} ${reais === 1 ? 'real' : 'reais'}`)
  }

  if (centavos > 0) {
    partes.push(`${numeroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`)
  }

  return partes.join(' e ')
}

function numeroPorExtenso(numero: number): string {
  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
  const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

  function ate999(n: number): string {
    if (n === 0) return ''
    if (n === 100) return 'cem'

    const c = Math.floor(n / 100)
    const d = Math.floor((n % 100) / 10)
    const u = n % 10
    const partes: string[] = []

    if (c > 0) partes.push(centenas[c])

    const resto = n % 100
    if (resto >= 10 && resto <= 19) {
      partes.push(especiais[resto - 10])
    } else {
      if (d > 1) partes.push(dezenas[d])
      if (u > 0) partes.push(unidades[u])
    }

    return partes.filter(Boolean).join(' e ')
  }

  if (numero === 0) return 'zero'
  if (numero < 1000) return ate999(numero)

  const milhoes = Math.floor(numero / 1000000)
  const milhares = Math.floor((numero % 1000000) / 1000)
  const resto = numero % 1000
  const partes: string[] = []

  if (milhoes > 0) {
    partes.push(`${numeroPorExtenso(milhoes)} ${milhoes === 1 ? 'milhão' : 'milhões'}`)
  }

  if (milhares > 0) {
    if (milhares === 1) partes.push('mil')
    else partes.push(`${ate999(milhares)} mil`)
  }

  if (resto > 0) {
    partes.push(ate999(resto))
  }

  return partes.join(resto > 0 && (resto < 100 || numero < 100000) ? ' e ' : ', ')
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
