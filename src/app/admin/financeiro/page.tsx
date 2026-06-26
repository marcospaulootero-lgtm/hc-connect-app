'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'

type FormState = {
  cliente: string
  despachante: string
  awb: string
  fatura: string
  transportadora: string
  servico: string
  valor_cobranca: string
  doc_dta: string
  debito_terceiro: string
  valor_compra: string
  vencimento_cobranca: string
  recebimento: string
  mes: string
  mes_profit: string
  observacoes: string
}

type MovimentacaoFormState = {
  tipo: string
  categoria: string
  descricao: string
  valor: string
  data_vencimento: string
  data_pagamento: string
  mes_referencia: string
  status: string
  socio: string
  forma_pagamento: string
  impacta_resultado: boolean
  impacta_caixa: boolean
  observacoes: string
  comprovante_url: string
}

type InputProps = {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}

const formVazio: FormState = {
  cliente: '',
  despachante: '',
  awb: '',
  fatura: '',
  transportadora: '',
  servico: '',
  valor_cobranca: '',
  doc_dta: '',
  debito_terceiro: '',
  valor_compra: '',
  vencimento_cobranca: '',
  recebimento: '',
  mes: '',
  mes_profit: '',
  observacoes: '',
}

const movimentacaoVazia: MovimentacaoFormState = {
  tipo: 'DESPESA',
  categoria: '',
  descricao: '',
  valor: '',
  data_vencimento: '',
  data_pagamento: '',
  mes_referencia: new Date().toISOString().slice(0, 7),
  status: 'PENDENTE',
  socio: '',
  forma_pagamento: '',
  impacta_resultado: true,
  impacta_caixa: true,
  observacoes: '',
  comprovante_url: '',
}

const PAGE_SIZE = 10
const LOTE_SUPABASE = 1000
const ANO_BASE_FINANCEIRO = 2025
const ANO_ATUAL_FINANCEIRO = new Date().getFullYear()
const ANOS_FINANCEIRO_PERMITIDOS = Array.from(
  new Set([ANO_ATUAL_FINANCEIRO, ANO_BASE_FINANCEIRO])
).sort((a, b) => b - a)
const MES_MINIMO_FINANCEIRO = `${ANO_BASE_FINANCEIRO}-01`
const MES_MAXIMO_FINANCEIRO = `${ANO_ATUAL_FINANCEIRO}-12`

const EMPRESTIMOS_HC = [
  {
    contrato: '2925262376',
    banco: 'Itaú',
    valorContratado: 50956.16,
    saldoDevedor: 45012.20,
    valorParcela: 1654.19,
    parcelas: '19 de 48',
    vencimentoFinal: '06/11/2028',
  },
  {
    contrato: '2715959991',
    banco: 'Itaú',
    valorContratado: 37252.87,
    saldoDevedor: 36613.48,
    valorParcela: 1008.26,
    parcelas: '8 de 48',
    vencimentoFinal: '08/10/2029',
  },
]

const TOTAL_PARCELAS_EMPRESTIMOS_HC = EMPRESTIMOS_HC.reduce(
  (acc, item) => acc + item.valorParcela,
  0
)

const TOTAL_SALDO_DEVEDOR_EMPRESTIMOS_HC = EMPRESTIMOS_HC.reduce(
  (acc, item) => acc + item.saldoDevedor,
  0
)

const TIPOS_MOVIMENTACAO = [
  { value: 'DESPESA', label: 'Despesa da empresa' },
  { value: 'PAGAMENTO_EMPRESTIMO', label: 'Pagamento de empréstimo' },
  { value: 'RETIRADA_SOCIO', label: 'Retirada de sócio' },
  { value: 'PAGAMENTO_SOCIO', label: 'Pagamento de sócio' },
  { value: 'REEMBOLSO_SOCIO', label: 'Reembolso de sócio' },
  { value: 'APORTE_SOCIO', label: 'Aporte de sócio' },
  { value: 'FUNDO_CAIXA_ENTRADA', label: 'Entrada no fundo de caixa' },
  { value: 'FUNDO_CAIXA_SAIDA', label: 'Saída do fundo de caixa' },
  { value: 'AJUSTE_CAIXA', label: 'Ajuste de caixa' },
]

const CATEGORIAS_DESPESA = [
  'Aluguel',
  'Contador',
  'Impostos',
  'Empréstimos',
  'Sistema',
  'Internet',
  'Telefone',
  'Marketing',
  'Tarifa bancária',
  'Combustível',
  'Material de escritório',
  'Manutenção',
  'Cartão empresa',
  'Veículo',
  'Plano de saúde',
  'Outros',
]

const STATUS_PROCESSOS = [
  { value: 'EM ABERTO', label: 'Em aberto' },
  { value: 'ATRASADO', label: 'Atrasado' },
  { value: 'PAGO', label: 'Pago' },
  { value: 'AGUARDANDO_CUSTO', label: 'Aguardando custo' },
]

const STATUS_MOVIMENTOS = [
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'VENCIDO', label: 'Vencido' },
  { value: 'PAGO', label: 'Pago' },
]

const SOCIOS_OPCOES = [
  { value: 'MARCOS', label: 'Marcos' },
  { value: 'HERICA', label: 'Hérica' },
]

const TIPOS_EXTRATO = [
  { value: 'RECEBIMENTO_PROCESSO', label: 'Recebimentos de processos' },
  { value: 'DESPESA', label: 'Despesas' },
  { value: 'PAGAMENTO_EMPRESTIMO', label: 'Pagamentos de empréstimo' },
  { value: 'RETIRADA_SOCIO', label: 'Retiradas de sócio' },
  { value: 'REEMBOLSO_SOCIO', label: 'Reembolsos de sócio' },
  { value: 'APORTE_SOCIO', label: 'Aportes' },
  { value: 'FUNDO_CAIXA_ENTRADA', label: 'Entradas no fundo' },
  { value: 'FUNDO_CAIXA_SAIDA', label: 'Saídas do fundo' },
  { value: 'AJUSTE_CAIXA', label: 'Ajustes de caixa' },
]

export default function FinanceiroPage() {
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [movimentacoes, setMovimentacoes] = useState<any[]>([])

  const [loading, setLoading] = useState(false)
  const [loadingMovimentos, setLoadingMovimentos] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [salvandoMovimento, setSalvandoMovimento] = useState(false)
  const [importando, setImportando] = useState(false)
  const [gerandoFechamento, setGerandoFechamento] = useState(false)
  const [gerandoRetroativos, setGerandoRetroativos] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editandoMovimentoId, setEditandoMovimentoId] = useState<string | null>(null)

  const [abaPrincipal, setAbaPrincipal] = useState('EXTRATO')
  const [anoFinanceiro, setAnoFinanceiro] = useState(String(new Date().getFullYear()))
  const [aba, setAba] = useState('EM ABERTO')
  const [pagina, setPagina] = useState(1)
  const [paginaMovimentos, setPaginaMovimentos] = useState(1)
  const [paginaExtrato, setPaginaExtrato] = useState(1)

  const [busca, setBusca] = useState('')
  const [filtroStatusProcessos, setFiltroStatusProcessos] = useState<string[]>([])
  const [filtroTransportadora, setFiltroTransportadora] = useState<string[]>([])
  const [filtroDespachante, setFiltroDespachante] = useState<string[]>([])
  const [filtroServico, setFiltroServico] = useState<string[]>([])

  const [buscaMovimento, setBuscaMovimento] = useState('')
  const [filtroMesMovimento, setFiltroMesMovimento] = useState<string[]>([])
  const [filtroStatusMovimento, setFiltroStatusMovimento] = useState<string[]>([])
  const [filtroSocioMovimento, setFiltroSocioMovimento] = useState<string[]>([])
  const [mesResultado, setMesResultado] = useState(new Date().toISOString().slice(0, 7))

  const [anoExtrato, setAnoExtrato] = useState(String(new Date().getFullYear()))
  const [buscaExtrato, setBuscaExtrato] = useState('')
  const [tipoExtrato, setTipoExtrato] = useState<string[]>([])
  const [filtroStatusExtrato, setFiltroStatusExtrato] = useState<string[]>([])
  const [filtroSocioExtrato, setFiltroSocioExtrato] = useState<string[]>([])

  const [form, setForm] = useState<FormState>(formVazio)
  const [formMovimento, setFormMovimento] = useState<MovimentacaoFormState>(movimentacaoVazia)

  useEffect(() => {
    carregarDados()
    aplicarParametrosUrl()
  }, [])

  useEffect(() => {
    if (String(anoFinanceiro).toUpperCase() === 'TODOS') {
      setAnoExtrato('TODOS')
      setPagina(1)
      setPaginaMovimentos(1)
      setPaginaExtrato(1)
      return
    }

    const anoValido = anoFinanceiroPermitido(anoFinanceiro)
      ? String(anoFinanceiro)
      : String(ANO_ATUAL_FINANCEIRO)

    setAnoExtrato(anoValido)

    setMesResultado((atual) => {
      if (String(atual || '').startsWith(`${anoValido}-`)) return atual

      const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0')
      const mesPadrao = anoValido === String(ANO_ATUAL_FINANCEIRO) ? mesAtual : '12'
      return `${anoValido}-${mesPadrao}`
    })

    setFormMovimento((atual) => {
      if (String(atual.mes_referencia || '').startsWith(`${anoValido}-`)) return atual

      const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0')
      const mesPadrao = anoValido === String(ANO_ATUAL_FINANCEIRO) ? mesAtual : '12'
      return { ...atual, mes_referencia: `${anoValido}-${mesPadrao}` }
    })

    setFiltroMesMovimento((atuais) =>
      atuais.filter((mes) => String(mes || '').startsWith(`${anoValido}-`))
    )

    setPagina(1)
    setPaginaMovimentos(1)
    setPaginaExtrato(1)
  }, [anoFinanceiro])

  function aplicarParametrosUrl() {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const abaUrl =
      params.get('aba') ||
      params.get('tab') ||
      params.get('abaPrincipal')

    const buscaUrl =
      params.get('busca') ||
      params.get('q') ||
      params.get('awb') ||
      params.get('cliente')

    const statusUrl = params.get('status')

    const abaNormalizada = normalizarBusca(abaUrl)
    const statusNormalizado = normalizarBusca(statusUrl)

    if (abaNormalizada.includes('RESULTADO')) {
      setAbaPrincipal('RESULTADO')
    } else if (abaNormalizada.includes('PROCESS')) {
      setAbaPrincipal('PROCESSOS')
    } else if (abaNormalizada.includes('MOVIMENT')) {
      setAbaPrincipal('MOVIMENTACOES')
    } else if (abaNormalizada.includes('EXTRATO')) {
      setAbaPrincipal('EXTRATO')
    }

    const statusValido = STATUS_PROCESSOS.some(
      (item) => item.value === statusNormalizado
    )

    if (buscaUrl || statusValido) {
      setAbaPrincipal('PROCESSOS')
      setBusca(buscaUrl?.trim() || '')

      // O filtro múltiplo funciona para ATRASADO, EM ABERTO, PAGO
      // e também para AGUARDANDO_CUSTO.
      setAba('TODOS')
      setFiltroStatusProcessos(
        statusValido ? [statusNormalizado] : []
      )

      setFiltroTransportadora([])
      setFiltroDespachante([])
      setFiltroServico([])
      setPagina(1)

      setTimeout(() => {
        document
          .getElementById('processos_faturados')
          ?.scrollIntoView({ behavior: 'smooth' })
      }, 500)
    }
  }

  function moeda(valor: any) {
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
          .replace(/[R$\s]/g, '')
          .replace(/\./g, '')
          .replace(',', '.')
      ) || 0
    )
  }

  function formatarValorParaForm(valor: any) {
    const n = Number(valor || 0)
    if (!n) return ''

    return n.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  function normalizarTexto(valor: any) {
    if (valor === null || valor === undefined) return ''
    return String(valor).trim()
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

  function dataInput(valor: any) {
    if (!valor) return ''
    return String(valor).slice(0, 10)
  }

  function mesDaData(valor: any) {
    const data = normalizarData(valor)
    if (!data) return ''
    return data.slice(0, 7)
  }

  function anoFinanceiroPermitido(ano: any) {
    const anoNumero = Number(String(ano || '').slice(0, 4))
    return ANOS_FINANCEIRO_PERMITIDOS.includes(anoNumero)
  }

  function mesFinanceiroPermitido(mes: any) {
    const texto = String(mes || '').slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(texto)) return false
    return anoFinanceiroPermitido(texto.slice(0, 4))
  }

  function mesBaseLancamento(item: any) {
    return (
      item.mes_profit ||
      mesDaData(item.recebimento) ||
      mesDaData(item.vencimento_cobranca) ||
      item.mes ||
      ''
    )
  }

  function lancamentoAnoPermitido(item: any) {
    return mesFinanceiroPermitido(mesBaseLancamento(item))
  }

  function movimentoAnoPermitido(item: any) {
    return mesFinanceiroPermitido(
      item.mes_referencia ||
        mesDaData(item.data_pagamento) ||
        mesDaData(item.data_vencimento)
    )
  }

  function todosAnosFinanceiroAtivo() {
    return String(anoFinanceiro || '').toUpperCase() === 'TODOS'
  }

  function anoFinanceiroAtivo() {
    if (todosAnosFinanceiroAtivo()) return 'TODOS'

    return anoFinanceiroPermitido(anoFinanceiro)
      ? String(anoFinanceiro)
      : String(ANO_ATUAL_FINANCEIRO)
  }

  function rotuloAnoFinanceiro() {
    return todosAnosFinanceiroAtivo() ? 'Todos os anos' : anoFinanceiroAtivo()
  }

  function mesPadraoAnoFinanceiroAtivo() {
    if (todosAnosFinanceiroAtivo()) {
      return new Date().toISOString().slice(0, 7)
    }

    const anoAtivo = anoFinanceiroAtivo()
    const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0')
    const mesPadrao = anoAtivo === String(ANO_ATUAL_FINANCEIRO) ? mesAtual : '12'
    return `${anoAtivo}-${mesPadrao}`
  }

  function mesDoAnoFinanceiroAtivo(mes: any) {
    if (todosAnosFinanceiroAtivo()) return true

    return String(mes || '').slice(0, 7).startsWith(`${anoFinanceiroAtivo()}-`)
  }

  function lancamentoAnoSelecionado(item: any) {
    return mesDoAnoFinanceiroAtivo(mesBaseLancamento(item))
  }

  function movimentoAnoSelecionado(item: any) {
    return mesDoAnoFinanceiroAtivo(
      item.mes_referencia ||
        mesDaData(item.data_pagamento) ||
        mesDaData(item.data_vencimento)
    )
  }

  function textoAnosFinanceiroPermitidos() {
    return ANOS_FINANCEIRO_PERMITIDOS.join(' e ')
  }

  function aplicarTodosAnosFinanceiro() {
    setAnoFinanceiro('TODOS')
    setFiltroMesMovimento([])
    setFiltroStatusProcessos([])
    setPagina(1)
    setPaginaMovimentos(1)
    setPaginaExtrato(1)
  }

  function calcularFundoAtualPermitido(lista = movimentacoes) {
    return lista.reduce((acc, item) => {
      if (!movimentoAnoSelecionado(item)) return acc
      if (statusMovimento(item) !== 'PAGO') return acc
      if (item.tipo === 'FUNDO_CAIXA_ENTRADA') return acc + Number(item.valor || 0)
      if (item.tipo === 'FUNDO_CAIXA_SAIDA') return acc - Number(item.valor || 0)
      if (item.tipo === 'AJUSTE_CAIXA') return acc + Number(item.valor || 0)
      return acc
    }, 0)
  }

  function calcularCustos(item: any) {
    return (
      Number(item.doc_dta || 0) +
      Number(item.debito_terceiro || 0) +
      Number(item.valor_compra || 0)
    )
  }

  function calcularProfit(item: any) {
    return Number(item.valor_cobranca || 0) - calcularCustos(item)
  }

  function temDataValida(valor: any) {
    return !!normalizarData(valor)
  }

  function statusCobranca(item: any) {
    if (temDataValida(item.recebimento)) return 'PAGO'

    const vencimento = normalizarData(item.vencimento_cobranca)
    if (vencimento) {
      const hoje = new Date().toISOString().slice(0, 10)
      if (vencimento < hoje) return 'ATRASADO'
    }

    return 'EM ABERTO'
  }

  function aguardandoCustoProcesso(item: any) {
    return Number(item.valor_compra || 0) <= 0
  }

  function statusMovimento(item: any) {
    if (item.status === 'PAGO' || temDataValida(item.data_pagamento)) return 'PAGO'

    const vencimento = normalizarData(item.data_vencimento)
    if (vencimento) {
      const hoje = new Date().toISOString().slice(0, 10)
      if (vencimento < hoje) return 'VENCIDO'
    }

    return item.status || 'PENDENTE'
  }

  function badgeStatus(status: string) {
    if (status === 'PAGO') return 'bg-green-100 text-green-700 border-green-300'
    if (status === 'ATRASADO' || status === 'VENCIDO') return 'bg-red-100 text-red-700 border-red-300'
    if (status === 'AGUARDANDO_CUSTO') return 'bg-orange-100 text-orange-700 border-orange-300'
    return 'bg-yellow-100 text-yellow-700 border-yellow-300'
  }

  function labelTipo(tipo: string) {
    return TIPOS_MOVIMENTACAO.find((item) => item.value === tipo)?.label || tipo
  }

  function normalizarServicoFinanceiro(valor: any) {
    const original = normalizarTexto(valor)
    const texto = normalizarBusca(original)

    if (!texto) return ''

    if (texto.includes('IMPORTACAO COURIER')) return 'IMPORTAÇÃO COURIER'
    if (texto.includes('EXPORTACAO COURIER')) return 'EXPORTAÇÃO COURIER'

    // Importação simples, importação formal e formal são serviços diferentes.
    // FORMAL é usado quando o processo é com agente de carga.
    if (texto === 'IMPORTACAO FORMAL' || texto.includes('IMPORTACAO FORMAL')) {
      return 'IMPORTAÇÃO FORMAL'
    }

    if (texto === 'EXPORTACAO FORMAL' || texto.includes('EXPORTACAO FORMAL')) {
      return 'EXPORTAÇÃO FORMAL'
    }

    if (texto === 'IMPORTACAO') return 'IMPORTAÇÃO'
    if (texto === 'EXPORTACAO') return 'EXPORTAÇÃO'
    if (texto === 'FORMAL') return 'FORMAL'

    if (texto.includes('DUE') || texto.includes('DRE')) return 'DUE / DRE'
    if (texto.includes('DTA')) return 'DTA'
    if (texto.includes('PRESTACAO DE CONTAS')) return 'PRESTAÇÃO DE CONTAS'
    if (texto === 'COURIER') return 'COURIER'

    return original.toUpperCase()
  }

  function filtraServicoMultipla(valores: string[], valor: any) {
    return valores.length === 0 || valores.includes(normalizarServicoFinanceiro(valor))
  }

  function textoPeriodoFundo() {
    if (filtroMesMovimento.length === 0) return `Ano ${anoFinanceiroAtivo()} inteiro`
    return textoMesesSelecionados(filtroMesMovimento)
  }


  function filtraMultipla(valores: string[], valor: any) {
    return valores.length === 0 || valores.includes(String(valor || ''))
  }

  function textoFiltroMultiplo(valores: string[], opcoes: { value: string; label: string }[], vazio = 'Todos') {
    if (valores.length === 0) return vazio

    return valores
      .map((valor) => opcoes.find((opcao) => opcao.value === valor)?.label || valor)
      .join(', ')
  }

  function textoMesesSelecionados(valores: string[]) {
    if (valores.length === 0) return `Todos os meses de ${anoFinanceiroAtivo()}`
    if (valores.length > 3) return `${valores.length} meses selecionados`
    return valores.map((valor) => formatarMesVisual(valor)).join(', ')
  }

  function ehReservaOperacionalFundo(item: any) {
    const tipo = String(item.tipo || '')
    const categoria = normalizarBusca(item.categoria || '')
    const descricao = normalizarBusca(item.descricao || '')

    if (tipo !== 'FUNDO_CAIXA_ENTRADA') return false

    return (
      categoria.includes('FECHAMENTO MENSAL') ||
      categoria.includes('RESERVA 50') ||
      descricao.includes('FECHAMENTO MENSAL') ||
      descricao.includes('RESERVA 50')
    )
  }

  function limparFiltros() {
    setBusca('')
    setAba('TODOS')
    setFiltroStatusProcessos([])
    setFiltroTransportadora([])
    setFiltroDespachante([])
    setFiltroServico([])
    setPagina(1)
  }

  function limparFiltrosMovimentos() {
    setBuscaMovimento('')
    setFiltroMesMovimento([])
    setFiltroStatusMovimento([])
    setFiltroSocioMovimento([])
    setPaginaMovimentos(1)
  }

  function limparFiltrosExtrato() {
    setBuscaExtrato('')
    setTipoExtrato([])
    setFiltroStatusExtrato([])
    setFiltroSocioExtrato([])
    setPaginaExtrato(1)
  }

  async function carregarDados() {
    await Promise.all([carregarFinanceiro(), carregarMovimentacoes()])
  }

  async function carregarFinanceiro() {
    setLoading(true)

    const { count, error: countError } = await supabase
      .from('financeiro_embarques')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      alert('Erro ao contar financeiro: ' + countError.message)
      setLoading(false)
      return
    }

    const total = count || 0
    const paginas = Math.max(1, Math.ceil(total / LOTE_SUPABASE))

    const consultas = Array.from({ length: paginas }, (_, index) => {
      const inicio = index * LOTE_SUPABASE
      const fim = inicio + LOTE_SUPABASE - 1

      return supabase.from('financeiro_embarques').select('*').range(inicio, fim)
    })

    const respostas = await Promise.all(consultas)
    const erro = respostas.find((res) => res.error)

    if (erro?.error) {
      alert('Erro ao carregar financeiro: ' + erro.error.message)
      setLoading(false)
      return
    }

    const todos = respostas.flatMap((res) => res.data || [])
    const todosPermitidos = todos.filter((item) => lancamentoAnoPermitido(item))

    setLancamentos(
      todosPermitidos.sort((a, b) => {
        const statusA = statusCobranca(a)
        const statusB = statusCobranca(b)

        if (statusA === 'ATRASADO' && statusB !== 'ATRASADO') return -1
        if (statusA !== 'ATRASADO' && statusB === 'ATRASADO') return 1

        const vencA = normalizarData(a.vencimento_cobranca) || '9999-99-99'
        const vencB = normalizarData(b.vencimento_cobranca) || '9999-99-99'
        return vencA.localeCompare(vencB)
      })
    )

    setPagina(1)
    setLoading(false)
  }

  async function carregarMovimentacoes() {
    setLoadingMovimentos(true)

    const { data, error } = await supabase
      .from('financeiro_movimentacoes')
      .select('*')
      .order('data_vencimento', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) {
      alert(
        'Erro ao carregar despesas/caixa. Rode o SQL da tabela financeiro_movimentacoes no Supabase antes de publicar. Detalhe: ' +
          error.message
      )
      setLoadingMovimentos(false)
      return
    }

    setMovimentacoes(((data || []) as any[]).filter((item) => movimentoAnoPermitido(item)))
    setPaginaMovimentos(1)
    setLoadingMovimentos(false)
  }

  function montarPayload() {
    return {
      cliente: form.cliente,
      despachante: form.despachante,
      awb: form.awb,
      fatura: form.fatura,
      transportadora: form.transportadora,
      servico: normalizarServicoFinanceiro(form.servico),
      valor_cobranca: numero(form.valor_cobranca),
      doc_dta: numero(form.doc_dta),
      debito_terceiro: numero(form.debito_terceiro),
      valor_compra: numero(form.valor_compra),
      vencimento_cobranca: form.vencimento_cobranca || null,
      recebimento: form.recebimento || null,
      mes: form.mes,
      mes_profit: form.mes_profit,
      observacoes: form.observacoes,
      atualizado_em: new Date().toISOString(),
    }
  }

  function montarPayloadMovimento() {
    const statusFinal = formMovimento.data_pagamento ? 'PAGO' : formMovimento.status

    return {
      tipo: formMovimento.tipo,
      categoria: formMovimento.categoria,
      descricao: formMovimento.descricao,
      valor: numero(formMovimento.valor),
      data_vencimento: formMovimento.data_vencimento || null,
      data_pagamento: formMovimento.data_pagamento || null,
      mes_referencia: formMovimento.mes_referencia,
      status: statusFinal,
      socio: formMovimento.socio || null,
      forma_pagamento: formMovimento.forma_pagamento,
      impacta_resultado: formMovimento.impacta_resultado,
      impacta_caixa: formMovimento.impacta_caixa,
      observacoes: formMovimento.observacoes,
      comprovante_url: formMovimento.comprovante_url,
    }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)

    const payload = montarPayload()

    if (editandoId) {
      const { error } = await supabase
        .from('financeiro_embarques')
        .update(payload)
        .eq('id', editandoId)

      if (error) {
        alert('Erro ao atualizar: ' + error.message)
        setSalvando(false)
        return
      }

      alert('Lançamento atualizado com sucesso.')
    } else {
      const { error } = await supabase.from('financeiro_embarques').insert(payload)

      if (error) {
        alert('Erro ao salvar: ' + error.message)
        setSalvando(false)
        return
      }

      alert('Lançamento salvo com sucesso.')
    }

    setForm(formVazio)
    setEditandoId(null)
    await carregarFinanceiro()
    setSalvando(false)
  }

  async function salvarMovimentacao(e: FormEvent) {
    e.preventDefault()

    if (!formMovimento.descricao.trim()) {
      alert('Informe uma descrição.')
      return
    }

    if (numero(formMovimento.valor) <= 0) {
      alert('Informe um valor maior que zero.')
      return
    }

    setSalvandoMovimento(true)
    const payload = montarPayloadMovimento()

    if (editandoMovimentoId) {
      const { error } = await supabase
        .from('financeiro_movimentacoes')
        .update(payload)
        .eq('id', editandoMovimentoId)

      if (error) {
        alert('Erro ao atualizar movimentação: ' + error.message)
        setSalvandoMovimento(false)
        return
      }

      alert('Movimentação atualizada com sucesso.')
    } else {
      const { error } = await supabase.from('financeiro_movimentacoes').insert(payload)

      if (error) {
        alert('Erro ao salvar movimentação: ' + error.message)
        setSalvandoMovimento(false)
        return
      }

      alert('Movimentação salva com sucesso.')
    }

    setFormMovimento(movimentacaoVazia)
    setEditandoMovimentoId(null)
    await carregarMovimentacoes()
    setSalvandoMovimento(false)
  }

  function editar(item: any) {
    setEditandoId(item.id)

    setForm({
      cliente: item.cliente || '',
      despachante: item.despachante || '',
      awb: item.awb || '',
      fatura: item.fatura || '',
      transportadora: item.transportadora || '',
      servico: normalizarServicoFinanceiro(item.servico) || item.servico || '',
      valor_cobranca: formatarValorParaForm(item.valor_cobranca),
      doc_dta: formatarValorParaForm(item.doc_dta),
      debito_terceiro: formatarValorParaForm(item.debito_terceiro),
      valor_compra: formatarValorParaForm(item.valor_compra),
      vencimento_cobranca: dataInput(item.vencimento_cobranca),
      recebimento: dataInput(item.recebimento),
      mes: item.mes || '',
      mes_profit: item.mes_profit || '',
      observacoes: item.observacoes || '',
    })

    setAbaPrincipal('PROCESSOS')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function editarMovimentacao(item: any) {
    setEditandoMovimentoId(item.id)

    setFormMovimento({
      tipo: item.tipo || 'DESPESA',
      categoria: item.categoria || '',
      descricao: item.descricao || '',
      valor: formatarValorParaForm(item.valor),
      data_vencimento: dataInput(item.data_vencimento),
      data_pagamento: dataInput(item.data_pagamento),
      mes_referencia: item.mes_referencia || new Date().toISOString().slice(0, 7),
      status: item.status || 'PENDENTE',
      socio: item.socio || '',
      forma_pagamento: item.forma_pagamento || '',
      impacta_resultado: item.impacta_resultado ?? true,
      impacta_caixa: item.impacta_caixa ?? true,
      observacoes: item.observacoes || '',
      comprovante_url: item.comprovante_url || '',
    })

    if (item.tipo === 'DESPESA') setAbaPrincipal('DESPESAS')
    else if (String(item.tipo || '').includes('SOCIO')) setAbaPrincipal('SOCIOS')
    else setAbaPrincipal('FUNDO')

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setForm(formVazio)
  }

  function cancelarEdicaoMovimento() {
    setEditandoMovimentoId(null)
    setFormMovimento(movimentacaoVazia)
  }


  function normalizarBusca(valor: any) {
    return normalizarTexto(valor)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
  }

  function pegarCampoExcel(linha: any, nomes: string[]) {
    for (const nome of nomes) {
      if (linha[nome] !== undefined && linha[nome] !== null && linha[nome] !== '') {
        return linha[nome]
      }
    }

    const chaves = Object.keys(linha || {})

    for (const nome of nomes) {
      const nomeNormalizado = normalizarBusca(nome)
      const chaveEncontrada = chaves.find((chave) => normalizarBusca(chave) === nomeNormalizado)

      if (
        chaveEncontrada &&
        linha[chaveEncontrada] !== undefined &&
        linha[chaveEncontrada] !== null &&
        linha[chaveEncontrada] !== ''
      ) {
        return linha[chaveEncontrada]
      }
    }

    return ''
  }

  function mesReferenciaExcel(linha: any) {
    const data = normalizarData(pegarCampoExcel(linha, ['DATA', 'Data', 'PAGAMENTO', 'DATA PAGAMENTO']))
    const mesTexto = normalizarBusca(pegarCampoExcel(linha, ['MÊS', 'MES', 'Mês', 'Mes']))
    const anoTexto = normalizarTexto(pegarCampoExcel(linha, ['ANO', 'Ano']))

    const meses: Record<string, string> = {
      JANEIRO: '01',
      FEVEREIRO: '02',
      MARCO: '03',
      ABRIL: '04',
      MAIO: '05',
      JUNHO: '06',
      JULHO: '07',
      AGOSTO: '08',
      SETEMBRO: '09',
      OUTUBRO: '10',
      NOVEMBRO: '11',
      DEZEMBRO: '12',
    }

    const mesNumero = meses[mesTexto]
    const anoNumero = String(anoTexto || '').replace(/\D/g, '').slice(0, 4)

    if (anoNumero && mesNumero) return `${anoNumero}-${mesNumero}`
    if (data) return data.slice(0, 7)

    return new Date().toISOString().slice(0, 7)
  }

  function classificarMovimentoDespesaExcel(descricaoOriginal: any) {
    const descricao = normalizarBusca(descricaoOriginal)
    const temNomeSocio =
      descricao.includes('HERICA') ||
      descricao.includes('MARCOS') ||
      descricao.includes('PAULO')

    const pareceRetiradaSocio =
      temNomeSocio &&
      (
        descricao.includes('ADIANTAMENTO') ||
        descricao.includes('RETIRADA') ||
        descricao.includes('PRO LABORE') ||
        descricao.includes('PRO-LABORE') ||
        descricao.includes('PAGAMENTO SOCIO') ||
        descricao.includes('PAGAMENTO SOCIO')
      )

    if (pareceRetiradaSocio) {
      return {
        tipo: 'RETIRADA_SOCIO',
        socio: descricao.includes('HERICA') ? 'HERICA' : 'MARCOS',
        categoria: 'Retirada',
        impacta_resultado: false,
        impacta_caixa: true,
      }
    }

    const categoria = categoriaDespesaExcel(descricaoOriginal)

    if (categoria === 'Empréstimos') {
      return {
        tipo: 'PAGAMENTO_EMPRESTIMO',
        socio: null,
        categoria,
        impacta_resultado: true,
        impacta_caixa: true,
      }
    }

    return {
      tipo: 'DESPESA',
      socio: null,
      categoria,
      impacta_resultado: true,
      impacta_caixa: true,
    }
  }

  function categoriaDespesaExcel(descricaoOriginal: any) {
    const descricao = normalizarBusca(descricaoOriginal)

    if (descricao.includes('ALUGUEL')) return 'Aluguel'
    if (descricao.includes('CONTABILIDADE') || descricao.includes('CONTADOR')) return 'Contador'
    if (descricao.includes('EMPRESTIMO') || descricao.includes('EMPRÉSTIMO') || descricao.includes('PRONAMPE') || descricao.includes('CREDITO') || descricao.includes('CRÉDITO')) return 'Empréstimos'
    if (
      descricao.includes('IMPOSTO') ||
      descricao.includes('DAS') ||
      descricao.includes('DARF') ||
      descricao.includes('SIMPLES') ||
      descricao.includes('ISS')
    ) return 'Impostos'
    if (
      descricao.includes('OFFICE') ||
      descricao.includes('SISTEMA') ||
      descricao.includes('SOFTWARE') ||
      descricao.includes('PORTAL') ||
      descricao.includes('DOMINIO') ||
      descricao.includes('HOSPEDAGEM')
    ) return 'Sistema'
    if (descricao.includes('INTERNET') || descricao.includes('EMBRATEL')) return 'Internet'
    if (
      descricao.includes('CLARO') ||
      descricao.includes('VIVO') ||
      descricao.includes('OI') ||
      descricao.includes('TELEFONE') ||
      descricao.includes('CHIP') ||
      descricao.includes('TIM')
    ) return 'Telefone'
    if (descricao.includes('BRINDE') || descricao.includes('MARKETING') || descricao.includes('ANUNCIO') || descricao.includes('ADESIVO')) return 'Marketing'
    if (
      descricao.includes('BANCO') ||
      descricao.includes('BS2') ||
      descricao.includes('ITAU') ||
      descricao.includes('BOLETO') ||
      descricao.includes('TARIFA') ||
      descricao.includes('CARTAO EMPRESA')
    ) return descricao.includes('CARTAO EMPRESA') ? 'Cartão empresa' : 'Tarifa bancária'
    if (
      descricao.includes('CARRO') ||
      descricao.includes('SEGURO CARRO') ||
      descricao.includes('FINANCIAMENTO CARRO') ||
      descricao.includes('UBER') ||
      descricao.includes('ESTACIONAMENTO')
    ) return 'Veículo'
    if (
      descricao.includes('COMBUSTIVEL') ||
      descricao.includes('GASOLINA') ||
      descricao.includes('ETANOL')
    ) return 'Combustível'
    if (
      descricao.includes('FOLHA') ||
      descricao.includes('PAPEL') ||
      descricao.includes('A4') ||
      descricao.includes('BLOCO') ||
      descricao.includes('IMPRESSORA') ||
      descricao.includes('MATERIAL')
    ) return 'Material de escritório'
    if (descricao.includes('CONSERTO') || descricao.includes('MANUTENCAO')) return 'Manutenção'
    if (descricao.includes('PLANO DE SAUDE') || descricao.includes('SAUDE')) return 'Plano de saúde'

    return 'Outros'
  }

  function chaveMovimentoImportado(item: any) {
    return [
      item.tipo || '',
      normalizarBusca(item.descricao || ''),
      Number(item.valor || 0).toFixed(2),
      item.data_pagamento || '',
      item.data_vencimento || '',
      item.mes_referencia || '',
      item.socio || '',
    ].join('|')
  }

  async function importarDespesasExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!confirm('Importar este Excel para Despesas/Sócios? Os processos faturados não serão alterados.')) return

    setImportando(true)

    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const linhas: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

      const registros = linhas
        .map((linha) => {
          const descricao = normalizarTexto(pegarCampoExcel(linha, ['DESCRIÇÃO', 'DESCRICAO', 'Descrição', 'Descricao']))
          const valor = numero(pegarCampoExcel(linha, ['VALOR', 'Valor']))
          const data = normalizarData(pegarCampoExcel(linha, ['DATA', 'Data', 'PAGAMENTO', 'DATA PAGAMENTO']))
          const classificacao = classificarMovimentoDespesaExcel(descricao)

          return {
            tipo: classificacao.tipo,
            categoria: classificacao.categoria,
            descricao,
            valor,
            data_vencimento: data,
            data_pagamento: data,
            mes_referencia: mesReferenciaExcel(linha),
            status: data ? 'PAGO' : 'PENDENTE',
            socio: classificacao.socio,
            forma_pagamento: '',
            impacta_resultado: classificacao.impacta_resultado,
            impacta_caixa: classificacao.impacta_caixa,
            observacoes: 'Importado do Excel de despesas',
            comprovante_url: '',
          }
        })
        .filter((item) => item.descricao && item.valor > 0)

      if (registros.length === 0) {
        alert('Nenhuma despesa válida encontrada no Excel.')
        setImportando(false)
        return
      }

      const chaves = new Set(movimentacoes.map((item) => chaveMovimentoImportado(item)))
      const registrosUnicos: any[] = []
      let duplicados = 0

      registros.forEach((item) => {
        const chave = chaveMovimentoImportado(item)

        if (chaves.has(chave)) {
          duplicados += 1
          return
        }

        chaves.add(chave)
        registrosUnicos.push(item)
      })

      if (registrosUnicos.length === 0) {
        alert(`Nenhuma nova movimentação importada. ${duplicados} linhas já existiam no sistema.`)
        setImportando(false)
        event.target.value = ''
        return
      }

      for (let i = 0; i < registrosUnicos.length; i += 500) {
        const lote = registrosUnicos.slice(i, i + 500)

        const { error } = await supabase.from('financeiro_movimentacoes').insert(lote)

        if (error) {
          alert('Erro ao importar despesas: ' + error.message)
          setImportando(false)
          return
        }
      }

      alert(
        `Importação concluída: ${registrosUnicos.length} movimentações importadas.` +
          (duplicados > 0 ? ` ${duplicados} duplicadas foram ignoradas.` : '')
      )

      await carregarMovimentacoes()
      setAbaPrincipal('DESPESAS')
    } catch (error: any) {
      alert('Erro ao importar Excel de despesas: ' + error.message)
    }

    setImportando(false)
    event.target.value = ''
  }


  async function importarRetiradasSociosExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!confirm('Importar este Excel para Sócios / Retiradas? As colunas SALÁRIO e TOTAL RECEBIDO serão ignoradas.')) return

    setImportando(true)

    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const linhas: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      const nomeArquivo = normalizarBusca(file.name)

      function identificarSocio(linha: any) {
        const beneficiario = normalizarBusca(pegarCampoExcel(linha, ['BENEFICIARIO', 'BENEFICIÁRIO', 'Beneficiário', 'Beneficiario']))

        if (beneficiario.includes('HERICA')) return 'HERICA'
        if (beneficiario.includes('MARCOS') || beneficiario.includes('PAULO')) return 'MARCOS'
        if (nomeArquivo.includes('HERICA')) return 'HERICA'
        if (nomeArquivo.includes('MARCOS') || nomeArquivo.includes('PAULO')) return 'MARCOS'

        return ''
      }

      const registros = linhas.flatMap((linha) => {
        const beneficiarioOriginal = normalizarTexto(pegarCampoExcel(linha, ['BENEFICIARIO', 'BENEFICIÁRIO', 'Beneficiário', 'Beneficiario']))
        const beneficiarioBusca = normalizarBusca(beneficiarioOriginal)

        if (!beneficiarioOriginal || beneficiarioBusca.includes('TOTAL')) return []

        const socio = identificarSocio(linha)
        if (!socio) return []

        const data = normalizarData(pegarCampoExcel(linha, ['DATA', 'Data', 'PAGAMENTO', 'DATA PAGAMENTO']))
        const mesReferencia = mesReferenciaExcel(linha)
        const valorSaida = numero(pegarCampoExcel(linha, ['VALOR DE SAIDA', 'VALOR DE SAÍDA', 'Valor de saída', 'Valor de Saida']))
        const reembolso = numero(pegarCampoExcel(linha, ['REEMBOLSO', 'Reembolso']))
        const nomeSocio = socio === 'HERICA' ? 'Hérica' : 'Marcos'
        const registrosLinha: any[] = []

        if (valorSaida > 0) {
          registrosLinha.push({
            tipo: 'RETIRADA_SOCIO',
            categoria: 'Retirada',
            descricao: `Retirada ${nomeSocio} - ${mesReferencia}`,
            valor: valorSaida,
            data_vencimento: data,
            data_pagamento: data,
            mes_referencia: mesReferencia,
            status: data ? 'PAGO' : 'PENDENTE',
            socio,
            forma_pagamento: '',
            impacta_resultado: false,
            impacta_caixa: true,
            observacoes: 'Importado do Excel de retiradas. Salário e total recebido ignorados pela regra 50% caixa / 25% Marcos / 25% Hérica.',
            comprovante_url: '',
          })
        }

        if (reembolso > 0) {
          registrosLinha.push({
            tipo: 'REEMBOLSO_SOCIO',
            categoria: 'Reembolso',
            descricao: `Reembolso ${nomeSocio} - ${mesReferencia}`,
            valor: reembolso,
            data_vencimento: data,
            data_pagamento: data,
            mes_referencia: mesReferencia,
            status: data ? 'PAGO' : 'PENDENTE',
            socio,
            forma_pagamento: '',
            impacta_resultado: false,
            impacta_caixa: true,
            observacoes: 'Importado do Excel de retiradas de sócios.',
            comprovante_url: '',
          })
        }

        return registrosLinha
      })

      if (registros.length === 0) {
        alert('Nenhuma retirada válida encontrada no Excel.')
        setImportando(false)
        return
      }

      const chaves = new Set(movimentacoes.map((item) => chaveMovimentoImportado(item)))
      const registrosUnicos: any[] = []
      let duplicados = 0

      registros.forEach((item) => {
        const chave = chaveMovimentoImportado(item)

        if (chaves.has(chave)) {
          duplicados += 1
          return
        }

        chaves.add(chave)
        registrosUnicos.push(item)
      })

      if (registrosUnicos.length === 0) {
        alert(`Nenhuma nova retirada importada. ${duplicados} linhas já existiam no sistema.`)
        setImportando(false)
        event.target.value = ''
        return
      }

      for (let i = 0; i < registrosUnicos.length; i += 500) {
        const lote = registrosUnicos.slice(i, i + 500)

        const { error } = await supabase.from('financeiro_movimentacoes').insert(lote)

        if (error) {
          alert('Erro ao importar retiradas: ' + error.message)
          setImportando(false)
          return
        }
      }

      alert(
        `Importação concluída: ${registrosUnicos.length} retiradas/reembolsos importados.` +
          (duplicados > 0 ? ` ${duplicados} duplicados foram ignorados.` : '')
      )

      await carregarMovimentacoes()
      setAbaPrincipal('SOCIOS')
    } catch (error: any) {
      alert('Erro ao importar Excel de retiradas: ' + error.message)
    }

    setImportando(false)
    event.target.value = ''
  }

  async function importarExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!confirm('Importar este Excel para o financeiro?')) return

    setImportando(true)

    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const linhas: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

      const registros = linhas
        .map((linha) => ({
          cliente: normalizarTexto(linha['CLIENTE']),
          despachante: normalizarTexto(linha['DESPACHANTE']),
          awb: normalizarTexto(linha['AWB']),
          fatura: normalizarTexto(
            linha['FATURA'] ||
              linha['Fatura'] ||
              linha['NUMERO_FATURA'] ||
              linha['Nº FATURA'] ||
              linha['N° FATURA'] ||
              linha['NUMERO DA FATURA'] ||
              linha['NÚMERO DA FATURA']
          ),
          transportadora: normalizarTexto(linha['EMPRESA PRESTADORA DE SERVIÇO']),
          servico: normalizarServicoFinanceiro(linha['SERVIÇO']),
          valor_cobranca: numero(linha['VALOR DO FATURAMENTO']),
          doc_dta: numero(linha['DELIVER FEE DOC / DTA / IMPOSTOS/ DUE']),
          debito_terceiro: numero(linha['PROFIT TERCEIROS']),
          valor_compra: numero(linha['VALOR DA COMPRA']),
          vencimento_cobranca: normalizarData(linha['VENCIMENTO_CLIENTE']),
          recebimento: normalizarData(linha['RECEBIMENTO_CLIENTE']),
          atualizado_em: new Date().toISOString(),
        }))
        .filter((item) => item.awb || item.cliente || item.valor_cobranca > 0)

      if (registros.length === 0) {
        alert('Nenhuma linha válida encontrada no Excel.')
        setImportando(false)
        return
      }

      for (let i = 0; i < registros.length; i += 500) {
        const lote = registros.slice(i, i + 500)

        const { error } = await supabase.from('financeiro_embarques').insert(lote)

        if (error) {
          alert('Erro ao importar lote: ' + error.message)
          setImportando(false)
          return
        }
      }

      alert(`Importação concluída: ${registros.length} lançamentos importados.`)
      await carregarFinanceiro()
    } catch (error: any) {
      alert('Erro ao importar Excel: ' + error.message)
    }

    setImportando(false)
    event.target.value = ''
  }

  async function excluir(id: string) {
    if (!confirm('Deseja excluir este lançamento financeiro?')) return

    const { error } = await supabase
      .from('financeiro_embarques')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erro ao excluir: ' + error.message)
      return
    }

    carregarFinanceiro()
  }

  async function excluirMovimentacao(id: string) {
    if (!confirm('Deseja excluir esta movimentação?')) return

    const { error } = await supabase
      .from('financeiro_movimentacoes')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erro ao excluir movimentação: ' + error.message)
      return
    }

    carregarMovimentacoes()
  }

  function prepararDespesa() {
    setFormMovimento({
      ...movimentacaoVazia,
      tipo: 'DESPESA',
      mes_referencia: mesPadraoAnoFinanceiroAtivo(),
      impacta_resultado: true,
      impacta_caixa: true,
    })
    setEditandoMovimentoId(null)
  }

  function prepararSocio(tipo = 'RETIRADA_SOCIO') {
    setFormMovimento({
      ...movimentacaoVazia,
      tipo,
      mes_referencia: mesPadraoAnoFinanceiroAtivo(),
      socio: 'MARCOS',
      impacta_resultado: false,
      impacta_caixa: true,
      categoria: tipo === 'APORTE_SOCIO' ? 'Aporte' : tipo === 'REEMBOLSO_SOCIO' ? 'Reembolso' : 'Retirada',
    })
    setEditandoMovimentoId(null)
  }

  function prepararFundo(tipo = 'FUNDO_CAIXA_ENTRADA') {
    setFormMovimento({
      ...movimentacaoVazia,
      tipo,
      mes_referencia: mesPadraoAnoFinanceiroAtivo(),
      categoria: tipo === 'FUNDO_CAIXA_ENTRADA' ? 'Reserva' : 'Uso do fundo',
      impacta_resultado: false,
      impacta_caixa: true,
    })
    setEditandoMovimentoId(null)
  }


  async function gerarFechamentoMensal() {
    if (!mesResultado) {
      alert('Selecione o mês do resultado antes de gerar o fechamento.')
      return
    }

    if (resultadoGeral.resultadoOperacional <= 0) {
      alert('Este mês não possui lucro líquido positivo para distribuir. Confira Profit HC e despesas pagas antes de fechar.')
      return
    }

    const valorReserva = Number((resultadoGeral.saldoFundoMes || 0).toFixed(2))

    if (valorReserva <= 0) {
      alert('O fundo de caixa deste mês já está reservado ou foi reservado acima dos 50%.')
      return
    }

    const descricaoFechamento = `Fechamento mensal - reserva 50% ${mesResultado}`
    const fechamentoJaLancado = movimentacoes.find((item) => {
      const descricao = normalizarBusca(item.descricao || '')

      return (
        item.tipo === 'FUNDO_CAIXA_ENTRADA' &&
        item.mes_referencia === mesResultado &&
        descricao.includes('FECHAMENTO MENSAL') &&
        descricao.includes('RESERVA 50')
      )
    })

    if (fechamentoJaLancado) {
      alert('Já existe um fechamento mensal lançado para este mês. Se precisar corrigir, exclua ou edite o lançamento no Fundo de Caixa.')
      return
    }

    const mensagem =
      `Gerar fechamento de ${mesResultado}?\n\n` +
      `Lucro líquido: ${moeda(resultadoGeral.resultadoOperacional)}\n` +
      `Fundo de caixa 50%: ${moeda(resultadoGeral.fundoPrevistoMes)}\n` +
      `Já reservado no fundo: ${moeda(resultadoGeral.reservasFundoMes)}\n` +
      `Valor que será lançado agora: ${moeda(valorReserva)}\n\n` +
      `Parte Marcos 25%: ${moeda(resultadoGeral.parteMarcos)}\n` +
      `Parte Hérica 25%: ${moeda(resultadoGeral.parteHerica)}`

    if (!confirm(mensagem)) return

    setGerandoFechamento(true)

    const hoje = new Date().toISOString().slice(0, 10)

    const { error } = await supabase.from('financeiro_movimentacoes').insert({
      tipo: 'FUNDO_CAIXA_ENTRADA',
      categoria: 'Fechamento mensal',
      descricao: descricaoFechamento,
      valor: valorReserva,
      data_vencimento: hoje,
      data_pagamento: hoje,
      mes_referencia: mesResultado,
      status: 'PAGO',
      socio: null,
      forma_pagamento: 'Fechamento automático',
      impacta_resultado: false,
      impacta_caixa: true,
      observacoes:
        `Fechamento gerado pelo Resultado Mensal. ` +
        `Profit HC recebido: ${moeda(resultadoGeral.profitRecebido)}. ` +
        `Despesas pagas: ${moeda(resultadoGeral.despesasPagas)}. ` +
        `Lucro líquido: ${moeda(resultadoGeral.resultadoOperacional)}. ` +
        `Fundo 50%: ${moeda(resultadoGeral.fundoPrevistoMes)}. ` +
        `Marcos 25%: ${moeda(resultadoGeral.parteMarcos)}. ` +
        `Hérica 25%: ${moeda(resultadoGeral.parteHerica)}. ` +
        `Retirado Marcos: ${moeda(resultadoGeral.retiradasMarcos)}. ` +
        `Retirado Hérica: ${moeda(resultadoGeral.retiradasHerica)}.`,
      comprovante_url: '',
    })

    if (error) {
      alert('Erro ao gerar fechamento mensal: ' + error.message)
      setGerandoFechamento(false)
      return
    }

    await carregarMovimentacoes()
    setFiltroMesMovimento([mesResultado])
    setGerandoFechamento(false)

    alert('Fechamento mensal gerado com sucesso. A reserva de 50% foi lançada no Fundo de Caixa.')
  }


  function ultimoDiaDoMes(mesRef: string) {
    const [ano, mes] = mesRef.split('-').map(Number)
    const data = new Date(ano, mes, 0)
    return data.toISOString().slice(0, 10)
  }

  function calcularResultadoDoMes(mesRef: string) {
    const embarquesMes = lancamentos.filter((item) => {
      const mesBase =
        item.mes_profit ||
        mesDaData(item.recebimento) ||
        mesDaData(item.vencimento_cobranca)

      return mesBase === mesRef
    })

    const processosPagosMes = embarquesMes.filter(
      (item) => statusCobranca(item) === 'PAGO'
    )

    const valorRecebido = processosPagosMes.reduce(
      (acc, item) => acc + Number(item.valor_cobranca || 0),
      0
    )

    const profitRecebido = processosPagosMes.reduce((acc, item) => {
      const possuiCusto = Number(item.valor_compra || 0) > 0
      return possuiCusto ? acc + calcularProfit(item) : acc
    }, 0)

    const semCusto = processosPagosMes.filter((item) =>
      aguardandoCustoProcesso(item)
    ).length

    const movimentosMes = movimentacoes.filter(
      (item) => item.mes_referencia === mesRef
    )

    const despesasPagas = movimentosMes
      .filter(
        (item) =>
          item.tipo === 'DESPESA' &&
          statusMovimento(item) === 'PAGO'
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const emprestimosPagos = movimentosMes
      .filter(
        (item) =>
          item.tipo === 'PAGAMENTO_EMPRESTIMO' &&
          statusMovimento(item) === 'PAGO'
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const reservasFundoMes = movimentosMes
      .filter(
        (item) =>
          ehReservaOperacionalFundo(item) &&
          statusMovimento(item) === 'PAGO'
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const resultadoOperacional =
      profitRecebido - despesasPagas - emprestimosPagos

    const lucroDistribuivel = resultadoOperacional > 0 ? resultadoOperacional : 0
    const fundoPrevistoMes = lucroDistribuivel * 0.5
    const saldoFundoMes = fundoPrevistoMes - reservasFundoMes

    return {
      mesRef,
      processos: processosPagosMes.length,
      valorRecebido,
      profitRecebido,
      semCusto,
      despesasPagas,
      emprestimosPagos,
      reservasFundoMes,
      resultadoOperacional,
      lucroDistribuivel,
      fundoPrevistoMes,
      saldoFundoMes,
    }
  }

  async function gerarFechamentosRetroativos() {
    const mesAtual = new Date().toISOString().slice(0, 7)

    const meses = Array.from(
      new Set([
        ...lancamentos
          .map((item) =>
            item.mes_profit ||
            mesDaData(item.recebimento) ||
            mesDaData(item.vencimento_cobranca)
          )
          .filter(Boolean),
        ...movimentacoes
          .map((item) => item.mes_referencia)
          .filter(Boolean),
      ])
    )
      .filter((mes: any) => /^\d{4}-\d{2}$/.test(String(mes)))
      .filter((mes: any) => mesFinanceiroPermitido(mes))
      .filter((mes: any) => mesDoAnoFinanceiroAtivo(mes))
      .filter((mes: any) => String(mes) < mesAtual)
      .sort((a: any, b: any) => String(a).localeCompare(String(b)))

    if (meses.length === 0) {
      alert('Nenhum mês anterior encontrado para fechamento retroativo no ano selecionado.')
      return
    }

    const existeSaldoInicial = movimentacoes.some((item) => {
      const descricao = normalizarBusca(item.descricao || '')
      const categoria = normalizarBusca(item.categoria || '')

      return (
        statusMovimento(item) === 'PAGO' &&
        (descricao.includes('SALDO INICIAL') ||
          categoria.includes('SALDO INICIAL') ||
          descricao.includes('FUNDO INICIAL'))
      )
    })

    const resultados = meses.map((mes) => calcularResultadoDoMes(String(mes)))

    const candidatos = resultados.filter(
      (item) =>
        item.resultadoOperacional > 0 &&
        item.saldoFundoMes > 0.009
    )

    if (candidatos.length === 0) {
      alert(
        'Nenhum fechamento retroativo pendente encontrado.\n\n' +
          'Os meses anteriores já estão fechados, não tiveram lucro positivo ou já possuem reserva suficiente no fundo.'
      )
      return
    }

    const totalReservar = candidatos.reduce(
      (acc, item) => acc + Number(item.saldoFundoMes || 0),
      0
    )

    const listaMeses = candidatos
      .map(
        (item) =>
          `${formatarMesVisual(item.mesRef)}: ${moeda(item.saldoFundoMes)}`
      )
      .join('\n')

    const avisoSaldoInicial = existeSaldoInicial
      ? '\n\nATENÇÃO: existe lançamento de saldo inicial/fundo inicial no caixa. Se esse valor já representa os meses antigos, gerar retroativos pode duplicar o fundo. Confirme somente se deseja detalhar mês a mês.'
      : ''

    const confirmar = confirm(
      `Gerar fechamentos retroativos de ${anoFinanceiroAtivo()}?\n\n` +
        `Meses que serão lançados: ${candidatos.length}\n` +
        `Total a reservar no fundo: ${moeda(totalReservar)}\n\n` +
        listaMeses +
        avisoSaldoInicial
    )

    if (!confirmar) return

    if (existeSaldoInicial) {
      const confirmarSaldoInicial = confirm(
        'Confirma mesmo assim?\n\n' +
          'Foi encontrado saldo inicial/fundo inicial. Para evitar duplicidade, só continue se esse saldo inicial NÃO representa esses fechamentos mensais.'
      )

      if (!confirmarSaldoInicial) return
    }

    setGerandoRetroativos(true)

    const registros = candidatos.map((item) => {
      const dataFechamento = ultimoDiaDoMes(item.mesRef)
      const valorReserva = Number(item.saldoFundoMes.toFixed(2))

      return {
        tipo: 'FUNDO_CAIXA_ENTRADA',
        categoria: 'Fechamento mensal',
        descricao: `Fechamento mensal - reserva 50% ${item.mesRef}`,
        valor: valorReserva,
        data_vencimento: dataFechamento,
        data_pagamento: dataFechamento,
        mes_referencia: item.mesRef,
        status: 'PAGO',
        socio: null,
        forma_pagamento: 'Fechamento retroativo',
        impacta_resultado: false,
        impacta_caixa: true,
        observacoes:
          `Fechamento retroativo gerado pelo Resultado Mensal. ` +
          `Valor recebido: ${moeda(item.valorRecebido)}. ` +
          `Profit HC recebido: ${moeda(item.profitRecebido)}. ` +
          `Despesas pagas: ${moeda(item.despesasPagas)}. ` +
          `Empréstimos pagos: ${moeda(item.emprestimosPagos)}. ` +
          `Lucro líquido: ${moeda(item.resultadoOperacional)}. ` +
          `Fundo previsto 50%: ${moeda(item.fundoPrevistoMes)}. ` +
          `Já reservado anteriormente: ${moeda(item.reservasFundoMes)}. ` +
          `Valor lançado agora: ${moeda(valorReserva)}. ` +
          `Processos pagos sem custo no mês: ${item.semCusto}.`,
        comprovante_url: '',
      }
    })

    for (let i = 0; i < registros.length; i += 500) {
      const lote = registros.slice(i, i + 500)

      const { error } = await supabase
        .from('financeiro_movimentacoes')
        .insert(lote)

      if (error) {
        alert('Erro ao gerar fechamentos retroativos: ' + error.message)
        setGerandoRetroativos(false)
        return
      }
    }

    await carregarMovimentacoes()
    setGerandoRetroativos(false)

    alert(
      `Fechamentos retroativos gerados com sucesso.\n\n` +
        `Meses lançados: ${registros.length}\n` +
        `Total reservado no fundo: ${moeda(totalReservar)}`
    )
  }

  const transportadoras = useMemo(() => {
    return [
      ...new Set(lancamentos.filter(lancamentoAnoSelecionado).map((item) => item.transportadora).filter(Boolean)),
    ].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))
  }, [lancamentos, anoFinanceiro])

  const despachantes = useMemo(() => {
    return [
      ...new Set(lancamentos.filter(lancamentoAnoSelecionado).map((item) => item.despachante).filter(Boolean)),
    ].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))
  }, [lancamentos, anoFinanceiro])

  const servicos = useMemo(() => {
    return [
      ...new Set(
        lancamentos
          .filter(lancamentoAnoSelecionado)
          .map((item) => normalizarServicoFinanceiro(item.servico))
          .filter(Boolean)
      ),
    ].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))
  }, [lancamentos, anoFinanceiro])

  const resumo = useMemo(() => {
    const lancamentosAno = lancamentos.filter(lancamentoAnoSelecionado)
    const emAberto = lancamentosAno.filter((item) => statusCobranca(item) === 'EM ABERTO')
    const atrasado = lancamentosAno.filter((item) => statusCobranca(item) === 'ATRASADO')
    const pago = lancamentosAno.filter((item) => statusCobranca(item) === 'PAGO')
    const aguardandoCusto = lancamentosAno.filter((item) => aguardandoCustoProcesso(item))

    function total(lista: any[]) {
      return lista.reduce((acc, item) => acc + Number(item.valor_cobranca || 0), 0)
    }

    return {
      emAberto: { qtd: emAberto.length, total: total(emAberto) },
      atrasado: { qtd: atrasado.length, total: total(atrasado) },
      pago: { qtd: pago.length, total: total(pago) },
      aguardandoCusto: { qtd: aguardandoCusto.length, total: total(aguardandoCusto) },
      todos: { qtd: lancamentosAno.length, total: total(lancamentosAno) },
    }
  }, [lancamentos, anoFinanceiro])

  const filtrados = useMemo(() => {
    const termo = busca.toLowerCase().trim()

    return lancamentos.filter((item) => {
      const texto = `
        ${item.cliente || ''}
        ${item.despachante || ''}
        ${item.awb || ''}
        ${item.fatura || ''}
        ${item.transportadora || ''}
        ${item.servico || ''}
      `.toLowerCase()

      const passaAno = lancamentoAnoSelecionado(item)
      const passaBusca = !termo || texto.includes(termo)
      const statusAtual = statusCobranca(item)
      const processoSemCusto = aguardandoCustoProcesso(item)
      const passaAba = aba === 'TODOS' ? true : statusAtual === aba
      const passaStatusMultiplo =
        filtroStatusProcessos.length === 0 ||
        filtroStatusProcessos.some((status) => {
          if (status === 'AGUARDANDO_CUSTO') return processoSemCusto
          return statusAtual === status
        })
      const passaTransportadora = filtraMultipla(filtroTransportadora, item.transportadora)
      const passaDespachante = filtraMultipla(filtroDespachante, item.despachante)
      const passaServico = filtraServicoMultipla(filtroServico, item.servico)

      return (
        passaAno &&
        passaAba &&
        passaStatusMultiplo &&
        passaBusca &&
        passaTransportadora &&
        passaDespachante &&
        passaServico
      )
    })
  }, [
    lancamentos,
    aba,
    busca,
    filtroStatusProcessos,
    filtroTransportadora,
    filtroDespachante,
    filtroServico,
    anoFinanceiro,
  ])

  const resumoFiltrado = useMemo(() => {
    const totalValorFaturado = filtrados.reduce(
      (acc, item) => acc + Number(item.valor_cobranca || 0),
      0
    )

    const totalDtaDocImpostos = filtrados.reduce(
      (acc, item) => acc + Number(item.doc_dta || 0),
      0
    )

    const totalTerceiros = filtrados.reduce(
      (acc, item) => acc + Number(item.debito_terceiro || 0),
      0
    )

    const totalValorCompra = filtrados.reduce(
      (acc, item) => acc + Number(item.valor_compra || 0),
      0
    )

    const totalProfitHC = filtrados.reduce((acc, item) => {
      const possuiCusto = Number(item.valor_compra || 0) > 0
      return possuiCusto ? acc + calcularProfit(item) : acc
    }, 0)

    const aguardandoCusto = filtrados.filter((item) => aguardandoCustoProcesso(item)).length

    const emAberto = filtrados.filter(
      (item) => statusCobranca(item) === 'EM ABERTO'
    )

    const atrasado = filtrados.filter(
      (item) => statusCobranca(item) === 'ATRASADO'
    )

    const pago = filtrados.filter(
      (item) => statusCobranca(item) === 'PAGO'
    )

    function totalCobranca(lista: any[]) {
      return lista.reduce((acc, item) => acc + Number(item.valor_cobranca || 0), 0)
    }

    return {
      qtd: filtrados.length,
      totalValorFaturado,
      totalDtaDocImpostos,
      totalTerceiros,
      totalValorCompra,
      totalProfitHC,
      aguardandoCusto,
      emAberto: {
        qtd: emAberto.length,
        total: totalCobranca(emAberto),
      },
      atrasado: {
        qtd: atrasado.length,
        total: totalCobranca(atrasado),
      },
      pago: {
        qtd: pago.length,
        total: totalCobranca(pago),
      },
    }
  }, [filtrados])

  const movimentacoesDaAba = useMemo(() => {
    const movimentosAno = movimentacoes.filter(movimentoAnoSelecionado)

    if (abaPrincipal === 'DESPESAS') {
      return movimentosAno.filter((item) => ['DESPESA', 'PAGAMENTO_EMPRESTIMO'].includes(item.tipo))
    }

    if (abaPrincipal === 'SOCIOS') {
      return movimentosAno.filter((item) =>
        ['RETIRADA_SOCIO', 'PAGAMENTO_SOCIO', 'REEMBOLSO_SOCIO', 'APORTE_SOCIO'].includes(item.tipo)
      )
    }

    if (abaPrincipal === 'FUNDO') {
      return movimentosAno.filter((item) =>
        ['FUNDO_CAIXA_ENTRADA', 'FUNDO_CAIXA_SAIDA', 'AJUSTE_CAIXA'].includes(item.tipo)
      )
    }

    return movimentosAno
  }, [abaPrincipal, movimentacoes, anoFinanceiro])

  const mesesMovimentacoes = useMemo(() => {
    return [
      ...new Set(
        movimentacoesDaAba
          .map((item) => item.mes_referencia)
          .filter(Boolean)
          .filter((mes) => mesFinanceiroPermitido(mes))
          .filter((mes) => mesDoAnoFinanceiroAtivo(mes))
      ),
    ].sort((a, b) => String(b).localeCompare(String(a)))
  }, [movimentacoesDaAba, anoFinanceiro])

  const movimentacoesFiltradas = useMemo(() => {
    const termo = buscaMovimento.toLowerCase().trim()

    return movimentacoesDaAba.filter((item) => {
      const texto = `
        ${item.tipo || ''}
        ${item.categoria || ''}
        ${item.descricao || ''}
        ${item.socio || ''}
        ${item.forma_pagamento || ''}
        ${item.observacoes || ''}
      `.toLowerCase()

      const passaBusca = !termo || texto.includes(termo)
      const passaMes = filtraMultipla(filtroMesMovimento, item.mes_referencia)
      const statusAtual = statusMovimento(item)
      const passaStatus = filtraMultipla(filtroStatusMovimento, statusAtual)
      const passaSocio = filtraMultipla(filtroSocioMovimento, item.socio)

      return passaBusca && passaMes && passaStatus && passaSocio
    })
  }, [
    movimentacoesDaAba,
    buscaMovimento,
    filtroMesMovimento,
    filtroStatusMovimento,
    filtroSocioMovimento,
  ])

  const resumoMovimentosFiltrados = useMemo(() => {
    const total = movimentacoesFiltradas.reduce((acc, item) => acc + Number(item.valor || 0), 0)
    const pago = movimentacoesFiltradas.filter((item) => statusMovimento(item) === 'PAGO')
    const pendente = movimentacoesFiltradas.filter((item) => statusMovimento(item) === 'PENDENTE')
    const vencido = movimentacoesFiltradas.filter((item) => statusMovimento(item) === 'VENCIDO')

    function somar(lista: any[]) {
      return lista.reduce((acc, item) => acc + Number(item.valor || 0), 0)
    }

    return {
      qtd: movimentacoesFiltradas.length,
      total,
      pago: { qtd: pago.length, total: somar(pago) },
      pendente: { qtd: pendente.length, total: somar(pendente) },
      vencido: { qtd: vencido.length, total: somar(vencido) },
    }
  }, [movimentacoesFiltradas])

  const resultadoGeral = useMemo(() => {
    const embarquesMes = lancamentos.filter((item) => {
      const mesBase = item.mes_profit || mesDaData(item.recebimento) || mesDaData(item.vencimento_cobranca)
      return mesBase === mesResultado
    })

    const processosPagosMes = embarquesMes.filter((item) => statusCobranca(item) === 'PAGO')

    const valorRecebido = processosPagosMes.reduce(
      (acc, item) => acc + Number(item.valor_cobranca || 0),
      0
    )

    const profitRecebido = processosPagosMes.reduce((acc, item) => {
      const possuiCusto = Number(item.valor_compra || 0) > 0
      return possuiCusto ? acc + calcularProfit(item) : acc
    }, 0)

    const semCusto = processosPagosMes.filter((item) => aguardandoCustoProcesso(item)).length

    const movimentosMes = movimentacoes.filter((item) => item.mes_referencia === mesResultado)

    const despesasPagas = movimentosMes
      .filter((item) => item.tipo === 'DESPESA' && statusMovimento(item) === 'PAGO')
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const emprestimosPagos = movimentosMes
      .filter((item) => item.tipo === 'PAGAMENTO_EMPRESTIMO' && statusMovimento(item) === 'PAGO')
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const despesasPendentes = movimentosMes
      .filter((item) => item.tipo === 'DESPESA' && statusMovimento(item) !== 'PAGO')
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const emprestimosPendentes = movimentosMes
      .filter((item) => item.tipo === 'PAGAMENTO_EMPRESTIMO' && statusMovimento(item) !== 'PAGO')
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const retiradasMarcos = movimentosMes
      .filter((item) =>
        ['RETIRADA_SOCIO', 'PAGAMENTO_SOCIO', 'REEMBOLSO_SOCIO'].includes(item.tipo) &&
        item.socio === 'MARCOS' &&
        statusMovimento(item) === 'PAGO'
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const retiradasHerica = movimentosMes
      .filter((item) =>
        ['RETIRADA_SOCIO', 'PAGAMENTO_SOCIO', 'REEMBOLSO_SOCIO'].includes(item.tipo) &&
        item.socio === 'HERICA' &&
        statusMovimento(item) === 'PAGO'
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const aportes = movimentosMes
      .filter((item) => item.tipo === 'APORTE_SOCIO' && statusMovimento(item) === 'PAGO')
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const entradasFundoMes = movimentosMes
      .filter((item) => item.tipo === 'FUNDO_CAIXA_ENTRADA' && statusMovimento(item) === 'PAGO')
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const reservasFundoMes = movimentosMes
      .filter((item) => ehReservaOperacionalFundo(item) && statusMovimento(item) === 'PAGO')
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const entradasNaoOperacionaisMes = movimentosMes
      .filter((item) =>
        item.tipo === 'FUNDO_CAIXA_ENTRADA' &&
        statusMovimento(item) === 'PAGO' &&
        !ehReservaOperacionalFundo(item)
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const saidasFundoMes = movimentosMes
      .filter((item) => item.tipo === 'FUNDO_CAIXA_SAIDA' && statusMovimento(item) === 'PAGO')
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const fundoAtual = calcularFundoAtualPermitido()

    const retiradasTotal = retiradasMarcos + retiradasHerica
    const resultadoOperacional = profitRecebido - despesasPagas - emprestimosPagos
    const lucroDistribuivel = resultadoOperacional > 0 ? resultadoOperacional : 0
    const fundoPrevistoMes = lucroDistribuivel * 0.5
    const parteMarcos = lucroDistribuivel * 0.25
    const parteHerica = lucroDistribuivel * 0.25
    const saldoMarcos = parteMarcos - retiradasMarcos
    const saldoHerica = parteHerica - retiradasHerica

    // Reserva operacional é somente o fechamento mensal dos 50% do lucro.
    // Entradas não operacionais, como venda de carro, aumentam caixa,
    // mas não contam como reserva mensal dos 50%.
    const saldoFundoMes = fundoPrevistoMes - reservasFundoMes

    // Caixa real do mês considera lucro operacional, entradas não operacionais,
    // aportes, retiradas dos sócios e saídas reais do fundo/caixa.
    const saldoCaixaRealMes =
      resultadoOperacional +
      entradasNaoOperacionaisMes +
      aportes -
      retiradasTotal -
      saidasFundoMes

    return {
      processos: processosPagosMes.length,
      valorRecebido,
      profitRecebido,
      semCusto,
      despesasPagas,
      emprestimosPagos,
      despesasPendentes,
      emprestimosPendentes,
      parcelaEmprestimosMensal: TOTAL_PARCELAS_EMPRESTIMOS_HC,
      saldoDevedorEmprestimos: TOTAL_SALDO_DEVEDOR_EMPRESTIMOS_HC,
      retiradasMarcos,
      retiradasHerica,
      retiradasTotal,
      aportes,
      entradasFundoMes,
      reservasFundoMes,
      entradasNaoOperacionaisMes,
      saidasFundoMes,
      fundoAtual,
      resultadoOperacional,
      lucroDistribuivel,
      fundoPrevistoMes,
      parteMarcos,
      parteHerica,
      saldoMarcos,
      saldoHerica,
      saldoFundoMes,
      saldoCaixaRealMes,
    }
  }, [lancamentos, movimentacoes, mesResultado, anoFinanceiro])


  const resumoFundoFiltro = useMemo(() => {
    const movimentosFundo = movimentacoes.filter((item) => {
      const tipoFundo = ['FUNDO_CAIXA_ENTRADA', 'FUNDO_CAIXA_SAIDA', 'AJUSTE_CAIXA'].includes(item.tipo)
      const passaAno = movimentoAnoSelecionado(item)
      const passaMes = filtraMultipla(filtroMesMovimento, item.mes_referencia)
      return tipoFundo && passaAno && passaMes && statusMovimento(item) === 'PAGO'
    })

    const entradas = movimentosFundo
      .filter((item) => item.tipo === 'FUNDO_CAIXA_ENTRADA')
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const saidas = movimentosFundo
      .filter((item) => item.tipo === 'FUNDO_CAIXA_SAIDA')
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const ajustes = movimentosFundo
      .filter((item) => item.tipo === 'AJUSTE_CAIXA')
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    return {
      entradas,
      saidas,
      ajustes,
      saldoPeriodo: entradas - saidas + ajustes,
    }
  }, [movimentacoes, filtroMesMovimento, anoFinanceiro])

  const extratoAnual = useMemo(() => {
    const anoSelecionado = anoFinanceiroPermitido(anoExtrato)
      ? String(anoExtrato)
      : String(ANO_ATUAL_FINANCEIRO)
    const ano = anoSelecionado

    const linhasProcessos = lancamentos
      .filter((item) => {
        if (statusCobranca(item) !== 'PAGO') return false
        const mesBase = item.mes_profit || mesDaData(item.recebimento) || mesDaData(item.vencimento_cobranca)
        return String(mesBase || '').startsWith(ano)
      })
      .map((item) => {
        const data = normalizarData(item.recebimento) || normalizarData(item.vencimento_cobranca) || `${item.mes_profit || ano + '-01'}-01`
        const possuiCusto = Number(item.valor_compra || 0) > 0
        const profit = possuiCusto ? calcularProfit(item) : 0

        return {
          id: `processo-${item.id}`,
          origem: 'PROCESSO',
          data,
          mes: (item.mes_profit || mesDaData(item.recebimento) || mesDaData(item.vencimento_cobranca) || '').slice(0, 7),
          tipo: 'RECEBIMENTO_PROCESSO',
          tipoLabel: 'Recebimento de processo',
          categoria: normalizarServicoFinanceiro(item.servico) || 'Processo faturado',
          descricao: `${item.cliente || 'Cliente'}${item.awb ? ` - AWB ${item.awb}` : ''}${item.fatura ? ` - Fatura ${item.fatura}` : ''}`,
          socio: '',
          entrada: Number(item.valor_cobranca || 0),
          saida: 0,
          profit,
          terceiros: Number(item.debito_terceiro || 0),
          custosProtegidos: Number(item.doc_dta || 0) + Number(item.valor_compra || 0),
          status: statusCobranca(item),
          forma_pagamento: '',
          impacta_resultado: true,
          impacta_caixa: true,
          naoOperacional: false,
        }
      })

    const linhasMovimentos = movimentacoes
      .filter((item) => String(item.mes_referencia || '').startsWith(ano))
      .map((item) => {
        const valor = Number(item.valor || 0)
        const status = statusMovimento(item)
        let entrada = 0
        let saida = 0

        if (item.tipo === 'APORTE_SOCIO' || item.tipo === 'FUNDO_CAIXA_ENTRADA') entrada = valor
        else if (['DESPESA', 'PAGAMENTO_EMPRESTIMO', 'RETIRADA_SOCIO', 'PAGAMENTO_SOCIO', 'REEMBOLSO_SOCIO', 'FUNDO_CAIXA_SAIDA'].includes(item.tipo)) saida = valor
        else if (item.tipo === 'AJUSTE_CAIXA') {
          if (valor >= 0) entrada = valor
          else saida = Math.abs(valor)
        }

        return {
          id: `mov-${item.id}`,
          origem: 'MOVIMENTACAO',
          data: normalizarData(item.data_pagamento) || normalizarData(item.data_vencimento) || `${item.mes_referencia || ano + '-01'}-01`,
          mes: item.mes_referencia || '',
          tipo: item.tipo,
          tipoLabel: labelTipo(item.tipo),
          categoria: item.categoria || '-',
          descricao: item.descricao || '-',
          socio: item.socio || '',
          entrada: status === 'PAGO' ? entrada : 0,
          saida: status === 'PAGO' ? saida : 0,
          profit: 0,
          terceiros: 0,
          custosProtegidos: 0,
          status,
          forma_pagamento: item.forma_pagamento || '',
          impacta_resultado: item.impacta_resultado ?? false,
          impacta_caixa: item.impacta_caixa ?? true,
          naoOperacional: item.tipo === 'FUNDO_CAIXA_ENTRADA' && !ehReservaOperacionalFundo(item),
        }
      })

    return [...linhasProcessos, ...linhasMovimentos].sort((a, b) => {
      const dataA = a.data || '1900-01-01'
      const dataB = b.data || '1900-01-01'
      return dataB.localeCompare(dataA)
    })
  }, [anoExtrato, lancamentos, movimentacoes])

  const extratoFiltrado = useMemo(() => {
    const termo = normalizarBusca(buscaExtrato)

    return extratoAnual.filter((item) => {
      const texto = normalizarBusca(`
        ${item.tipoLabel || ''}
        ${item.categoria || ''}
        ${item.descricao || ''}
        ${item.socio || ''}
        ${item.forma_pagamento || ''}
      `)

      const passaBusca = !termo || texto.includes(termo)
      const passaTipo = filtraMultipla(tipoExtrato, item.tipo)
      const passaStatus = filtraMultipla(filtroStatusExtrato, item.status)
      const passaSocio = filtraMultipla(filtroSocioExtrato, item.socio)

      return passaBusca && passaTipo && passaStatus && passaSocio
    })
  }, [extratoAnual, buscaExtrato, tipoExtrato, filtroStatusExtrato, filtroSocioExtrato])

  function calcularResumoExtratoFinanceiro(lista: any[]) {
    const pagos = lista.filter((item) => item.status === 'PAGO')
    const entradas = pagos.reduce((acc, item) => acc + Number(item.entrada || 0), 0)
    const saidas = pagos.reduce((acc, item) => acc + Number(item.saida || 0), 0)
    const valorRecebido = pagos
      .filter((item) => item.tipo === 'RECEBIMENTO_PROCESSO')
      .reduce((acc, item) => acc + Number(item.entrada || 0), 0)
    const profitHC = pagos
      .filter((item) => item.tipo === 'RECEBIMENTO_PROCESSO')
      .reduce((acc, item) => acc + Number(item.profit || 0), 0)
    const despesas = pagos
      .filter((item) => item.tipo === 'DESPESA')
      .reduce((acc, item) => acc + Number(item.saida || 0), 0)
    const emprestimosPagos = pagos
      .filter((item) => item.tipo === 'PAGAMENTO_EMPRESTIMO')
      .reduce((acc, item) => acc + Number(item.saida || 0), 0)
    const retiradasMarcos = pagos
      .filter((item) => ['RETIRADA_SOCIO', 'PAGAMENTO_SOCIO', 'REEMBOLSO_SOCIO'].includes(item.tipo) && item.socio === 'MARCOS')
      .reduce((acc, item) => acc + Number(item.saida || 0), 0)
    const retiradasHerica = pagos
      .filter((item) => ['RETIRADA_SOCIO', 'PAGAMENTO_SOCIO', 'REEMBOLSO_SOCIO'].includes(item.tipo) && item.socio === 'HERICA')
      .reduce((acc, item) => acc + Number(item.saida || 0), 0)
    const aportes = pagos
      .filter((item) => item.tipo === 'APORTE_SOCIO')
      .reduce((acc, item) => acc + Number(item.entrada || 0), 0)
    const entradasNaoOperacionais = pagos
      .filter((item) => item.naoOperacional)
      .reduce((acc, item) => acc + Number(item.entrada || 0), 0)
    const saidasFundo = pagos
      .filter((item) => item.tipo === 'FUNDO_CAIXA_SAIDA')
      .reduce((acc, item) => acc + Number(item.saida || 0), 0)

    const terceirosProtegidos = pagos
      .filter((item) => item.tipo === 'RECEBIMENTO_PROCESSO')
      .reduce((acc, item) => acc + Number(item.terceiros || 0), 0)

    const custosOperacionaisProtegidos = pagos
      .filter((item) => item.tipo === 'RECEBIMENTO_PROCESSO')
      .reduce((acc, item) => acc + Number(item.custosProtegidos || 0), 0)

    const caixaProtegido = terceirosProtegidos + custosOperacionaisProtegidos
    const saldoMovimentado = entradas - saidas

    // Saldo gerencial é o saldo estimado do movimento.
    // Ele pode existir, mas não significa que é dinheiro livre da HC.
    const saldoGerencial = profitHC - despesas - emprestimosPagos + entradasNaoOperacionais + aportes - retiradasMarcos - retiradasHerica - saidasFundo
    const usoCaixaProtegido = Math.max(saldoGerencial * -1, 0)

    const resultadoOperacional = profitHC - despesas - emprestimosPagos
    const lucroDistribuivel = Math.max(resultadoOperacional, 0)
    const caixaMinimoRecomendado = lucroDistribuivel * 0.5
    const direitoMarcos = lucroDistribuivel * 0.25
    const direitoHerica = lucroDistribuivel * 0.25
    const saldoMarcos = direitoMarcos - retiradasMarcos
    const saldoHerica = direitoHerica - retiradasHerica
    const retiradasTotal = retiradasMarcos + retiradasHerica
    const totalDireitoSocios = direitoMarcos + direitoHerica
    const excessoRetiradasMarcos = Math.max(retiradasMarcos - direitoMarcos, 0)
    const excessoRetiradasHerica = Math.max(retiradasHerica - direitoHerica, 0)
    const excessoRetiradasSocios = excessoRetiradasMarcos + excessoRetiradasHerica
    const entradasLivresUsadasEmExcesso = Math.min(excessoRetiradasSocios, entradasNaoOperacionais + aportes)

    const processosPagos = pagos.filter((item) => item.tipo === 'RECEBIMENTO_PROCESSO')
    const processosSemCompra = processosPagos.filter((item) => Number(item.valorCompra || 0) <= 0)
    const qtdProcessosSemCompra = processosSemCompra.length
    const valorRecebidoSemCompra = processosSemCompra.reduce((acc, item) => acc + Number(item.entrada || 0), 0)
    const processosComTerceiros = processosPagos.filter((item) => Number(item.terceiros || 0) > 0).length

    const emprestimosMensaisHC = TOTAL_PARCELAS_EMPRESTIMOS_HC
    const saldoDevedorEmprestimosHC = TOTAL_SALDO_DEVEDOR_EMPRESTIMOS_HC
    const qtdEmprestimosHC = EMPRESTIMOS_HC.length
    const faltaReservaHC = Math.max(caixaMinimoRecomendado - Math.max(saldoGerencial, 0), 0)
    const necessidadeMinimaAntesRetirada = faltaReservaHC + emprestimosMensaisHC
    const faltaReporCaixa = usoCaixaProtegido + necessidadeMinimaAntesRetirada
    const caixaNegativoRealRegularizar = faltaReporCaixa + terceirosProtegidos
    const caixaAcimaDoMinimo = Math.max(saldoGerencial - caixaMinimoRecomendado - emprestimosMensaisHC, 0)
    const saldoPositivoSocios = Math.max(saldoMarcos, 0) + Math.max(saldoHerica, 0)

    // Caixa livre da HC só existe depois de:
    // 1) proteger terceiros/custos, 2) recompor caixa mínimo, 3) não existir retirada acima do permitido.
    const caixaLivreHC = excessoRetiradasSocios > 0 || faltaReporCaixa > 0
      ? 0
      : Math.min(caixaAcimaDoMinimo, saldoPositivoSocios || caixaAcimaDoMinimo)

    const podeRetirarAgora = excessoRetiradasSocios > 0 || faltaReporCaixa > 0
      ? 0
      : Math.min(caixaAcimaDoMinimo, saldoPositivoSocios)
    const gastoLivrePermitido = excessoRetiradasSocios > 0 || faltaReporCaixa > 0
      ? 0
      : Math.max(caixaAcimaDoMinimo - podeRetirarAgora, 0)

    const baseMinimaComEmprestimos = caixaMinimoRecomendado + emprestimosMensaisHC
    const percentualCaixa = baseMinimaComEmprestimos > 0
      ? Math.min(Math.max((Math.max(saldoGerencial, 0) / baseMinimaComEmprestimos) * 100, 0), 100)
      : saldoGerencial > 0 ? 100 : 0

    const maiorErroFinanceiro = usoCaixaProtegido > 0
      ? 'Usou dinheiro protegido'
      : excessoRetiradasSocios > 0
        ? 'Retiradas acima do permitido'
        : qtdProcessosSemCompra > 0
          ? 'Processos pagos sem custo'
          : faltaReservaHC > 0
            ? 'Caixa abaixo do mínimo'
            : 'Sem erro crítico'

    let statusDono = 'CONTROLADO'
    let mensagemDono = 'Caixa dentro da regra. Manter controle antes de novas retiradas.'
    let acaoRecomendada = 'Manter a regra 50% caixa / 25% Marcos / 25% Hérica.'

    if (usoCaixaProtegido > 0) {
      statusDono = 'CRÍTICO'
      mensagemDono = 'A HC usou dinheiro protegido de terceiros/custos. Bloquear retiradas agora.'
      acaoRecomendada = 'Repor primeiro o dinheiro protegido, depois recompor o caixa mínimo.'
    } else if (excessoRetiradasSocios > 0) {
      statusDono = 'ATENÇÃO'
      mensagemDono = 'O caixa da HC não está livre: retiradas acima do permitido e empréstimos consomem a reserva.'
      acaoRecomendada = 'Bloquear retiradas, pagar empréstimos e recompor o caixa mínimo antes de qualquer gasto livre.'
    } else if (faltaReservaHC > 0) {
      statusDono = 'ATENÇÃO'
      mensagemDono = 'Existe saldo gerencial, mas ele ainda precisa cobrir caixa mínimo e empréstimos.'
      acaoRecomendada = 'Economizar primeiro até recompor o caixa mínimo e cobrir a parcela mensal dos empréstimos.'
    } else if (podeRetirarAgora > 0) {
      statusDono = 'SAUDÁVEL'
      mensagemDono = 'Existe caixa acima da reserva e saldo positivo para distribuição.'
      acaoRecomendada = 'Retirada permitida somente até o limite calculado.'
    }

    return {
      qtd: lista.length,
      entradas,
      saidas,
      saldoMovimentado,
      valorRecebido,
      profitHC,
      despesas,
      emprestimosPagos,
      emprestimosMensaisHC,
      saldoDevedorEmprestimosHC,
      qtdEmprestimosHC,
      necessidadeMinimaAntesRetirada,
      baseMinimaComEmprestimos,
      retiradasMarcos,
      retiradasHerica,
      retiradasTotal,
      aportes,
      entradasNaoOperacionais,
      saidasFundo,
      terceirosProtegidos,
      custosOperacionaisProtegidos,
      caixaProtegido,
      caixaLivreHC,
      usoCaixaProtegido,
      faltaReservaHC,
      saldoGerencial,
      caixaGerencialAtual: saldoGerencial,
      resultadoOperacional,
      lucroDistribuivel,
      caixaMinimoRecomendado,
      direitoMarcos,
      direitoHerica,
      saldoMarcos,
      saldoHerica,
      totalDireitoSocios,
      excessoRetiradasMarcos,
      excessoRetiradasHerica,
      excessoRetiradasSocios,
      entradasLivresUsadasEmExcesso,
      processosComTerceiros,
      qtdProcessosSemCompra,
      valorRecebidoSemCompra,
      maiorErroFinanceiro,
      faltaReporCaixa,
      caixaNegativoRealRegularizar,
      caixaAcimaDoMinimo,
      saldoPositivoSocios,
      podeRetirarAgora,
      gastoLivrePermitido,
      percentualCaixa,
      statusDono,
      mensagemDono,
      acaoRecomendada,
    }
  }

  const resumoExtratoGeralAno = useMemo(() => {
    return calcularResumoExtratoFinanceiro(extratoAnual)
  }, [extratoAnual])

  const resumoExtrato = useMemo(() => {
    return calcularResumoExtratoFinanceiro(extratoFiltrado)
  }, [extratoFiltrado])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))

  const filtradosPaginados = useMemo(() => {
    const inicio = (pagina - 1) * PAGE_SIZE
    return filtrados.slice(inicio, inicio + PAGE_SIZE)
  }, [filtrados, pagina])

  const totalPaginasMovimentos = Math.max(1, Math.ceil(movimentacoesFiltradas.length / PAGE_SIZE))

  const movimentosPaginados = useMemo(() => {
    const inicio = (paginaMovimentos - 1) * PAGE_SIZE
    return movimentacoesFiltradas.slice(inicio, inicio + PAGE_SIZE)
  }, [movimentacoesFiltradas, paginaMovimentos])

  const totalPaginasExtrato = Math.max(1, Math.ceil(extratoFiltrado.length / PAGE_SIZE))

  const extratoPaginado = useMemo(() => {
    const inicio = (paginaExtrato - 1) * PAGE_SIZE
    return extratoFiltrado.slice(inicio, inicio + PAGE_SIZE)
  }, [extratoFiltrado, paginaExtrato])

  function mudarAba(novaAba: string) {
    setAba(novaAba)
    setFiltroStatusProcessos([])
    setPagina(1)
  }

  function filtrarAguardandoCusto() {
    setAba('TODOS')
    setFiltroStatusProcessos(['AGUARDANDO_CUSTO'])
    setPagina(1)
  }

  function mudarAbaPrincipal(novaAba: string) {
    setAbaPrincipal(novaAba)
    setPaginaMovimentos(1)
    setPaginaExtrato(1)

    if (novaAba === 'DESPESAS') prepararDespesa()
    if (novaAba === 'SOCIOS') prepararSocio()
    if (novaAba === 'FUNDO') prepararFundo()
  }

  function escaparHtml(valor: any) {
    return String(valor ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  function formatarMesVisual(valor: any) {
    const texto = String(valor || '')
    if (!/^\d{4}-\d{2}$/.test(texto)) return texto || '-'

    const [ano, mes] = texto.split('-')
    const nomes: Record<string, string> = {
      '01': 'janeiro',
      '02': 'fevereiro',
      '03': 'março',
      '04': 'abril',
      '05': 'maio',
      '06': 'junho',
      '07': 'julho',
      '08': 'agosto',
      '09': 'setembro',
      '10': 'outubro',
      '11': 'novembro',
      '12': 'dezembro',
    }

    return `${nomes[mes] || mes} de ${ano}`
  }

  function abrirPdfDoFiltro({ titulo, subtitulo, filtros, cards, cabecalhos, linhas }: any) {
    const janela = window.open('', '_blank')

    if (!janela) {
      alert('O navegador bloqueou a janela do PDF. Libere pop-ups para o portal e tente novamente.')
      return
    }

    const dataGeracao = new Date().toLocaleString('pt-BR')
    const filtrosHtml = (filtros || [])
      .filter((item: any) => item && item.valor !== undefined && item.valor !== null && item.valor !== '')
      .map((item: any) => `<span><strong>${escaparHtml(item.label)}:</strong> ${escaparHtml(item.valor)}</span>`)
      .join('')

    const cardsHtml = (cards || [])
      .map((item: any) => `
        <div class="card">
          <p>${escaparHtml(item.label)}</p>
          <strong>${escaparHtml(item.valor)}</strong>
          ${item.detalhe ? `<small>${escaparHtml(item.detalhe)}</small>` : ''}
        </div>
      `)
      .join('')

    const tabelaHtml = cabecalhos?.length
      ? `
        <table>
          <thead>
            <tr>${cabecalhos.map((item: any) => `<th>${escaparHtml(item)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${linhas.length > 0
              ? linhas
                  .map((linha: any[]) => `<tr>${linha.map((item: any) => `<td>${escaparHtml(item)}</td>`).join('')}</tr>`)
                  .join('')
              : `<tr><td colspan="${cabecalhos.length}" class="vazio">Nenhum registro encontrado para os filtros aplicados.</td></tr>`
            }
          </tbody>
        </table>
      `
      : ''

    janela.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>${escaparHtml(titulo)}</title>
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              font-family: Arial, Helvetica, sans-serif;
              color: #111827;
              background: #ffffff;
              font-size: 11px;
            }
            .header {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 20px;
              border-bottom: 2px solid #1d4ed8;
              padding-bottom: 12px;
              margin-bottom: 14px;
            }
            .brand {
              font-size: 20px;
              line-height: 1;
              font-weight: 900;
              color: #0f172a;
              margin: 0 0 6px;
            }
            h1 {
              font-size: 18px;
              margin: 0 0 4px;
              color: #1d4ed8;
            }
            .subtitle {
              margin: 0;
              color: #4b5563;
              font-size: 11px;
            }
            .meta {
              text-align: right;
              color: #4b5563;
              font-size: 10px;
              white-space: nowrap;
            }
            .filters {
              display: flex;
              flex-wrap: wrap;
              gap: 6px;
              margin-bottom: 12px;
            }
            .filters span {
              border: 1px solid #dbeafe;
              background: #eff6ff;
              color: #1e3a8a;
              border-radius: 999px;
              padding: 5px 8px;
            }
            .cards {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              margin-bottom: 14px;
            }
            .card {
              border: 1px solid #e5e7eb;
              border-radius: 10px;
              padding: 10px;
              background: #f9fafb;
              min-height: 62px;
            }
            .card p {
              margin: 0 0 4px;
              color: #4b5563;
              font-size: 9px;
              font-weight: 800;
              text-transform: uppercase;
            }
            .card strong {
              display: block;
              color: #111827;
              font-size: 14px;
              font-weight: 900;
            }
            .card small {
              display: block;
              margin-top: 3px;
              color: #6b7280;
              font-size: 9px;
              font-weight: 700;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: auto;
            }
            th {
              background: #0f172a;
              color: #ffffff;
              text-align: left;
              font-size: 9px;
              padding: 6px;
              border: 1px solid #0f172a;
              white-space: nowrap;
            }
            td {
              padding: 6px;
              border: 1px solid #e5e7eb;
              vertical-align: top;
              font-size: 9px;
            }
            tr:nth-child(even) td { background: #f9fafb; }
            .vazio {
              text-align: center;
              color: #6b7280;
              padding: 18px;
            }
            .footer {
              margin-top: 14px;
              padding-top: 8px;
              border-top: 1px solid #e5e7eb;
              color: #6b7280;
              font-size: 9px;
            }
            @media print {
              button { display: none; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <p class="brand">HC Connect</p>
              <h1>${escaparHtml(titulo)}</h1>
              <p class="subtitle">${escaparHtml(subtitulo)}</p>
            </div>
            <div class="meta">
              <strong>HC Consultoria</strong><br />
              Gerado em ${escaparHtml(dataGeracao)}<br />
              Total de registros: ${escaparHtml(linhas.length)}
            </div>
          </div>

          ${filtrosHtml ? `<div class="filters">${filtrosHtml}</div>` : ''}
          ${cardsHtml ? `<div class="cards">${cardsHtml}</div>` : ''}
          ${tabelaHtml}

          <div class="footer">
            Relatório gerado a partir dos filtros aplicados no HC Connect. Valores em reais (BRL).
          </div>
        </body>
      </html>
    `)

    janela.document.close()
    janela.focus()
    setTimeout(() => janela.print(), 500)
  }

  function exportarPdfDoFiltro() {
    if (abaPrincipal === 'PROCESSOS') {
      abrirPdfDoFiltro({
        titulo: 'Processos faturados filtrados',
        subtitulo: 'Relatório de processos, recebimentos, custos e Profit HC conforme os filtros aplicados.',
        filtros: [
          { label: 'Status', valor: filtroStatusProcessos.length > 0 ? textoFiltroMultiplo(filtroStatusProcessos, STATUS_PROCESSOS) : (aba === 'TODOS' ? 'Todos' : aba) },
          { label: 'Busca', valor: busca || 'Todas' },
          { label: 'Transportadora', valor: textoFiltroMultiplo(filtroTransportadora, transportadoras.map((item: any) => ({ value: String(item), label: String(item) })), 'Todas') },
          { label: 'Despachante', valor: textoFiltroMultiplo(filtroDespachante, despachantes.map((item: any) => ({ value: String(item), label: String(item) })), 'Todos') },
          { label: 'Serviço', valor: textoFiltroMultiplo(filtroServico, servicos.map((item: any) => ({ value: String(item), label: String(item) })), 'Todos') },
        ],
        cards: [
          { label: 'Valor faturado', valor: moeda(resumoFiltrado.totalValorFaturado), detalhe: `${resumoFiltrado.qtd} lançamentos` },
          { label: 'Valor compra', valor: moeda(resumoFiltrado.totalValorCompra), detalhe: 'Custo HC' },
          { label: 'Profit HC', valor: moeda(resumoFiltrado.totalProfitHC), detalhe: `${resumoFiltrado.aguardandoCusto} sem custo` },
          { label: 'Recebido', valor: moeda(resumoFiltrado.pago.total), detalhe: `${resumoFiltrado.pago.qtd} pagos` },
        ],
        cabecalhos: [
          'Cliente',
          'Despachante',
          'AWB',
          'Fatura',
          'Transportadora',
          'Serviço',
          'Valor faturado',
          'DTA/DOC/Impostos',
          'Terceiros',
          'Valor compra',
          'Profit HC',
          'Vencimento',
          'Recebimento',
          'Status',
        ],
        linhas: filtrados.map((item) => {
          const possuiCusto = Number(item.valor_compra || 0) > 0
          const profit = possuiCusto ? calcularProfit(item) : null

          return [
            item.cliente || '-',
            item.despachante || '-',
            item.awb || '-',
            item.fatura || '-',
            item.transportadora || '-',
            normalizarServicoFinanceiro(item.servico) || '-',
            moeda(item.valor_cobranca),
            moeda(item.doc_dta),
            moeda(item.debito_terceiro),
            possuiCusto ? moeda(item.valor_compra) : 'Aguardando custo',
            profit === null ? 'Aguardando custo' : moeda(profit),
            normalizarData(item.vencimento_cobranca) || '-',
            normalizarData(item.recebimento) || '-',
            statusCobranca(item),
          ]
        }),
      })

      return
    }

    if (abaPrincipal === 'EXTRATO') {
      abrirPdfDoFiltro({
        titulo: `Extrato geral ${anoExtrato}`,
        subtitulo: 'Visão anual das movimentações lançadas no financeiro, incluindo processos recebidos, despesas, retiradas, aportes e fundo de caixa.',
        filtros: [
          { label: 'Ano', valor: anoExtrato },
          { label: 'Busca', valor: buscaExtrato || 'Todas' },
          { label: 'Tipo', valor: textoFiltroMultiplo(tipoExtrato, TIPOS_EXTRATO, 'Todos') },
          { label: 'Status', valor: textoFiltroMultiplo(filtroStatusExtrato, STATUS_MOVIMENTOS, 'Todos') },
          { label: 'Sócio', valor: textoFiltroMultiplo(filtroSocioExtrato, SOCIOS_OPCOES, 'Todos') },
        ],
        cards: [
          { label: 'Caixa livre HC', valor: moeda(resumoExtratoGeralAno.caixaLivreHC), detalhe: resumoExtratoGeralAno.mensagemDono },
          { label: 'Caixa protegido', valor: moeda(resumoExtratoGeralAno.caixaProtegido), detalhe: 'Terceiros + custos operacionais dos processos pagos' },
          { label: 'Terceiros a pagar/proteger', valor: moeda(resumoExtratoGeralAno.terceirosProtegidos), detalhe: 'Dinheiro que não pertence à HC' },
          { label: 'Uso de caixa protegido', valor: moeda(resumoExtratoGeralAno.usoCaixaProtegido), detalhe: 'Quando o caixa livre da HC fica negativo' },
          { label: 'Caixa mínimo recomendado', valor: moeda(resumoExtratoGeralAno.caixaMinimoRecomendado), detalhe: '50% do lucro operacional positivo' },
          { label: 'Empréstimos mensais', valor: moeda(resumoExtratoGeralAno.emprestimosMensaisHC), detalhe: `${resumoExtratoGeralAno.qtdEmprestimosHC} contratos ativos` },
          { label: 'Precisa economizar/repor', valor: moeda(resumoExtratoGeralAno.faltaReporCaixa), detalhe: resumoExtratoGeralAno.acaoRecomendada },
          { label: 'Pode retirar agora', valor: moeda(resumoExtratoGeralAno.podeRetirarAgora), detalhe: 'Limite seguro total dos sócios' },
          { label: 'Pode gastar livre', valor: moeda(resumoExtratoGeralAno.gastoLivrePermitido), detalhe: 'Após caixa mínimo e retiradas permitidas' },
          { label: 'Profit HC', valor: moeda(resumoExtratoGeralAno.profitHC), detalhe: `${moeda(resumoExtratoGeralAno.valorRecebido)} recebido` },
          { label: 'Despesas', valor: moeda(resumoExtratoGeralAno.despesas), detalhe: 'Despesas pagas no ano' },
          { label: 'Status', valor: resumoExtratoGeralAno.statusDono, detalhe: 'Regra 50% / 25% / 25%' },
        ],
        cabecalhos: [
          'Data',
          'Mês',
          'Tipo',
          'Categoria',
          'Descrição',
          'Sócio',
          'Entrada',
          'Saída',
          'Status',
          'Forma',
        ],
        linhas: extratoFiltrado.map((item) => [
          normalizarData(item.data) || '-',
          item.mes || '-',
          item.tipoLabel || item.tipo,
          item.categoria || '-',
          item.descricao || '-',
          item.socio || '-',
          item.entrada > 0 ? moeda(item.entrada) : '-',
          item.saida > 0 ? moeda(item.saida) : '-',
          item.status || '-',
          item.forma_pagamento || '-',
        ]),
      })

      return
    }

    if (abaPrincipal === 'RESULTADO') {
      abrirPdfDoFiltro({
        titulo: 'Resultado geral do mês',
        subtitulo: 'Distribuição do lucro pela regra 50% fundo de caixa, 25% Marcos e 25% Hérica.',
        filtros: [
          { label: 'Mês', valor: formatarMesVisual(mesResultado) },
        ],
        cards: [
          { label: 'Valor recebido', valor: moeda(resultadoGeral.valorRecebido), detalhe: `${resultadoGeral.processos} processos pagos` },
          { label: 'Profit HC', valor: moeda(resultadoGeral.profitRecebido), detalhe: `${resultadoGeral.semCusto} sem custo` },
          { label: 'Despesas pagas', valor: moeda(resultadoGeral.despesasPagas), detalhe: `${moeda(resultadoGeral.despesasPendentes)} pendente` },
          { label: 'Empréstimos pagos', valor: moeda(resultadoGeral.emprestimosPagos), detalhe: `${moeda(resultadoGeral.emprestimosPendentes)} pendente` },
          { label: 'Lucro líquido', valor: moeda(resultadoGeral.resultadoOperacional), detalhe: 'Profit - despesas - empréstimos' },
          { label: 'Fundo 50%', valor: moeda(resultadoGeral.fundoPrevistoMes), detalhe: `${moeda(resultadoGeral.reservasFundoMes)} reservado` },
          { label: 'Parte Marcos 25%', valor: moeda(resultadoGeral.parteMarcos), detalhe: `${moeda(resultadoGeral.retiradasMarcos)} retirado` },
          { label: 'Parte Hérica 25%', valor: moeda(resultadoGeral.parteHerica), detalhe: `${moeda(resultadoGeral.retiradasHerica)} retirado` },
          { label: 'Fundo atual', valor: moeda(resultadoGeral.fundoAtual), detalhe: 'Acumulado' },
        ],
        cabecalhos: ['Descrição', 'Valor'],
        linhas: [
          ['Profit HC dos processos recebidos', moeda(resultadoGeral.profitRecebido)],
          ['Despesas pagas da empresa', `- ${moeda(resultadoGeral.despesasPagas)}`],
          ['Empréstimos pagos da HC', `- ${moeda(resultadoGeral.emprestimosPagos)}`],
          ['Lucro líquido para distribuição', moeda(resultadoGeral.resultadoOperacional)],
          ['50% para fundo de caixa', moeda(resultadoGeral.fundoPrevistoMes)],
          ['25% parte Marcos', moeda(resultadoGeral.parteMarcos)],
          ['25% parte Hérica', moeda(resultadoGeral.parteHerica)],
          ['Retirado Marcos no mês', `- ${moeda(resultadoGeral.retiradasMarcos)}`],
          ['Saldo Marcos a retirar', moeda(resultadoGeral.saldoMarcos)],
          ['Retirado Hérica no mês', `- ${moeda(resultadoGeral.retiradasHerica)}`],
          ['Saldo Hérica a retirar', moeda(resultadoGeral.saldoHerica)],
          ['Reservado no fundo no mês', moeda(resultadoGeral.reservasFundoMes)],
          ['Entradas não operacionais no caixa', moeda(resultadoGeral.entradasNaoOperacionaisMes)],
          ['Saldo para reservar no fundo', moeda(resultadoGeral.saldoFundoMes)],
          ['Saldo real do caixa no mês', moeda(resultadoGeral.saldoCaixaRealMes)],
        ],
      })

      return
    }

    const tituloAba: Record<string, string> = {
      DESPESAS: 'Despesas filtradas',
      SOCIOS: 'Sócios / Retiradas filtradas',
      FUNDO: 'Fundo de caixa filtrado',
    }

    abrirPdfDoFiltro({
      titulo: tituloAba[abaPrincipal] || 'Movimentações filtradas',
      subtitulo: 'Relatório das movimentações conforme os filtros aplicados na tela.',
      filtros: [
        { label: 'Busca', valor: buscaMovimento || 'Todas' },
        { label: 'Mês', valor: textoMesesSelecionados(filtroMesMovimento) },
        { label: 'Status', valor: textoFiltroMultiplo(filtroStatusMovimento, STATUS_MOVIMENTOS, 'Todos') },
        { label: 'Sócio', valor: textoFiltroMultiplo(filtroSocioMovimento, SOCIOS_OPCOES, 'Todos') },
      ],
      cards: [
        { label: 'Total filtrado', valor: moeda(resumoMovimentosFiltrados.total), detalhe: `${resumoMovimentosFiltrados.qtd} lançamentos` },
        { label: 'Pagos', valor: moeda(resumoMovimentosFiltrados.pago.total), detalhe: `${resumoMovimentosFiltrados.pago.qtd} lançamentos` },
        { label: 'Pendentes', valor: moeda(resumoMovimentosFiltrados.pendente.total), detalhe: `${resumoMovimentosFiltrados.pendente.qtd} lançamentos` },
        { label: 'Vencidos', valor: moeda(resumoMovimentosFiltrados.vencido.total), detalhe: `${resumoMovimentosFiltrados.vencido.qtd} lançamentos` },
      ],
      cabecalhos: [
        'Tipo',
        'Categoria',
        'Descrição',
        'Sócio',
        'Valor',
        'Mês',
        'Vencimento',
        'Pagamento',
        'Status',
        'Forma',
      ],
      linhas: movimentacoesFiltradas.map((item) => [
        labelTipo(item.tipo),
        item.categoria || '-',
        item.descricao || '-',
        item.socio || '-',
        moeda(item.valor),
        item.mes_referencia || '-',
        normalizarData(item.data_vencimento) || '-',
        normalizarData(item.data_pagamento) || '-',
        statusMovimento(item),
        item.forma_pagamento || '-',
      ]),
    })
  }

  function renderFormularioMovimento(titulo: string, subtitulo: string) {
    const mostrarSocio = ['RETIRADA_SOCIO', 'PAGAMENTO_SOCIO', 'REEMBOLSO_SOCIO', 'APORTE_SOCIO'].includes(formMovimento.tipo)

    return (
      <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6">
        <div className="mb-4 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-950">
              {editandoMovimentoId ? 'Editando movimentação' : titulo}
            </h2>
            <p className="text-sm text-gray-500">{subtitulo}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {abaPrincipal === 'SOCIOS' && (
              <>
                <button type="button" onClick={() => prepararSocio('RETIRADA_SOCIO')} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-black hover:bg-gray-50">Retirada</button>
                <button type="button" onClick={() => prepararSocio('REEMBOLSO_SOCIO')} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-black hover:bg-gray-50">Reembolso</button>
                <button type="button" onClick={() => prepararSocio('APORTE_SOCIO')} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-black hover:bg-gray-50">Aporte</button>
              </>
            )}

            {abaPrincipal === 'FUNDO' && (
              <>
                <button type="button" onClick={() => prepararFundo('FUNDO_CAIXA_ENTRADA')} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-black hover:bg-gray-50">Entrada</button>
                <button type="button" onClick={() => prepararFundo('FUNDO_CAIXA_SAIDA')} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-black hover:bg-gray-50">Saída</button>
                <button type="button" onClick={() => prepararFundo('AJUSTE_CAIXA')} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-black hover:bg-gray-50">Ajuste</button>
              </>
            )}
          </div>
        </div>

        <form onSubmit={salvarMovimentacao} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-semibold text-gray-600">Tipo</label>
            <select
              value={formMovimento.tipo}
              onChange={(e) => setFormMovimento({ ...formMovimento, tipo: e.target.value })}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TIPOS_MOVIMENTACAO.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600">Categoria</label>
            {formMovimento.tipo === 'DESPESA' ? (
              <select
                value={formMovimento.categoria}
                onChange={(e) => setFormMovimento({ ...formMovimento, categoria: e.target.value })}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione</option>
                {CATEGORIAS_DESPESA.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            ) : (
              <input
                value={formMovimento.categoria}
                onChange={(e) => setFormMovimento({ ...formMovimento, categoria: e.target.value })}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          <Input label="Descrição" value={formMovimento.descricao} onChange={(v) => setFormMovimento({ ...formMovimento, descricao: v })} />
          <InputMoney label="Valor R$" value={formMovimento.valor} onChange={(v) => setFormMovimento({ ...formMovimento, valor: v })} />

          <Input type="date" label="Vencimento" value={formMovimento.data_vencimento} onChange={(v) => setFormMovimento({ ...formMovimento, data_vencimento: v })} />
          <Input type="date" label="Pagamento" value={formMovimento.data_pagamento} onChange={(v) => setFormMovimento({ ...formMovimento, data_pagamento: v, status: v ? 'PAGO' : formMovimento.status })} />
          <Input
            type="month"
            label="Mês referência"
            value={formMovimento.mes_referencia}
            onChange={(v) => {
              if (!mesFinanceiroPermitido(v)) {
                alert(`O financeiro está limitado a ${textoAnosFinanceiroPermitidos()}.`)
                return
              }

              setFormMovimento({ ...formMovimento, mes_referencia: v })
            }}
          />

          <div>
            <label className="text-sm font-semibold text-gray-600">Status</label>
            <select
              value={formMovimento.status}
              onChange={(e) => setFormMovimento({ ...formMovimento, status: e.target.value })}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="PENDENTE">Pendente</option>
              <option value="PAGO">Pago</option>
            </select>
          </div>

          {mostrarSocio && (
            <div>
              <label className="text-sm font-semibold text-gray-600">Sócio</label>
              <select
                value={formMovimento.socio}
                onChange={(e) => setFormMovimento({ ...formMovimento, socio: e.target.value })}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione</option>
                <option value="MARCOS">Marcos</option>
                <option value="HERICA">Hérica</option>
              </select>
            </div>
          )}

          <Input label="Forma de pagamento" value={formMovimento.forma_pagamento} onChange={(v) => setFormMovimento({ ...formMovimento, forma_pagamento: v })} placeholder="Pix, boleto, cartão..." />
          <Input label="Link do comprovante" value={formMovimento.comprovante_url} onChange={(v) => setFormMovimento({ ...formMovimento, comprovante_url: v })} />

          <div className="md:col-span-2 flex flex-col justify-end gap-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
              <input
                type="checkbox"
                checked={formMovimento.impacta_resultado}
                onChange={(e) => setFormMovimento({ ...formMovimento, impacta_resultado: e.target.checked })}
              />
              Impacta resultado da empresa
            </label>

            <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
              <input
                type="checkbox"
                checked={formMovimento.impacta_caixa}
                onChange={(e) => setFormMovimento({ ...formMovimento, impacta_caixa: e.target.checked })}
              />
              Impacta caixa
            </label>
          </div>

          <div className="md:col-span-4">
            <label className="text-sm font-semibold text-gray-600">Observações</label>
            <textarea
              value={formMovimento.observacoes}
              onChange={(e) => setFormMovimento({ ...formMovimento, observacoes: e.target.value })}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>

          <div className="md:col-span-4 flex gap-3">
            <button
              disabled={salvandoMovimento}
              className="bg-blue-600 text-white px-5 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 font-bold"
            >
              {salvandoMovimento ? 'Salvando...' : editandoMovimentoId ? 'Salvar alterações' : 'Salvar movimentação'}
            </button>

            {editandoMovimentoId && (
              <button
                type="button"
                onClick={cancelarEdicaoMovimento}
                className="bg-gray-100 text-gray-800 px-5 py-3 rounded-xl hover:bg-gray-200 font-bold"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>
    )
  }

  function renderTabelaMovimentos() {
    return (
      <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-5">
          <input
            value={buscaMovimento}
            onChange={(e) => { setBuscaMovimento(e.target.value); setPaginaMovimentos(1) }}
            placeholder="Buscar descrição, categoria, sócio..."
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <MultiSelect
            label="Mês"
            values={filtroMesMovimento}
            onChange={(valores) => { setFiltroMesMovimento(valores); setPaginaMovimentos(1) }}
            options={mesesMovimentacoes.map((item: any) => ({ value: String(item), label: formatarMesVisual(item) }))}
            placeholder={`Todos os meses de ${anoFinanceiroAtivo()}`}
          />

          <MultiSelect
            label="Status"
            values={filtroStatusMovimento}
            onChange={(valores) => { setFiltroStatusMovimento(valores); setPaginaMovimentos(1) }}
            options={STATUS_MOVIMENTOS}
            placeholder="Todos status"
          />

          <MultiSelect
            label="Sócios"
            values={filtroSocioMovimento}
            onChange={(valores) => { setFiltroSocioMovimento(valores); setPaginaMovimentos(1) }}
            options={SOCIOS_OPCOES}
            placeholder="Todos sócios"
          />

          <button type="button" onClick={limparFiltrosMovimentos} className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold hover:bg-gray-50">
            ⌁ Limpar filtros
          </button>
        </div>

        <section className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <FiltroResumoCard titulo="Total filtrado" valor={moeda(resumoMovimentosFiltrados.total)} detalhe={`${resumoMovimentosFiltrados.qtd} lançamentos`} classe="bg-white text-blue-700 border-blue-100" />
            <FiltroResumoCard titulo="Pagos" valor={moeda(resumoMovimentosFiltrados.pago.total)} detalhe={`${resumoMovimentosFiltrados.pago.qtd} lançamentos`} classe="bg-white text-green-700 border-green-100" />
            <FiltroResumoCard titulo="Pendentes" valor={moeda(resumoMovimentosFiltrados.pendente.total)} detalhe={`${resumoMovimentosFiltrados.pendente.qtd} lançamentos`} classe="bg-white text-yellow-700 border-yellow-100" />
            <FiltroResumoCard titulo="Vencidos" valor={moeda(resumoMovimentosFiltrados.vencido.total)} detalhe={`${resumoMovimentosFiltrados.vencido.qtd} lançamentos`} classe="bg-white text-red-700 border-red-100" />
          </div>
        </section>

        <div className="overflow-x-auto">
          <table className="min-w-[1400px] w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <Th>Tipo</Th>
                <Th>Categoria</Th>
                <Th>Descrição</Th>
                <Th>Sócio</Th>
                <Th>Valor</Th>
                <Th>Mês</Th>
                <Th>Vencimento</Th>
                <Th>Pagamento</Th>
                <Th>Status</Th>
                <Th>Forma</Th>
                <Th>Ações</Th>
              </tr>
            </thead>

            <tbody>
              {loadingMovimentos ? (
                <tr><td colSpan={11} className="p-6 text-center">Carregando movimentações...</td></tr>
              ) : movimentosPaginados.length === 0 ? (
                <tr><td colSpan={11} className="p-6 text-center text-gray-500">Nenhuma movimentação encontrada.</td></tr>
              ) : (
                movimentosPaginados.map((item) => {
                  const status = statusMovimento(item)

                  return (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <Td>{labelTipo(item.tipo)}</Td>
                      <Td>{item.categoria || '-'}</Td>
                      <Td>{item.descricao}</Td>
                      <Td>{item.socio || '-'}</Td>
                      <Td>{moeda(item.valor)}</Td>
                      <Td>{item.mes_referencia || '-'}</Td>
                      <Td>{normalizarData(item.data_vencimento) || '-'}</Td>
                      <Td>{normalizarData(item.data_pagamento) || '-'}</Td>
                      <Td><Badge texto={status} classe={badgeStatus(status)} /></Td>
                      <Td>{item.forma_pagamento || '-'}</Td>
                      <Td>
                        <div className="flex gap-2">
                          <button onClick={() => editarMovimentacao(item)} className="bg-blue-50 text-blue-600 border border-blue-200 px-3 py-2 rounded-lg hover:bg-blue-100 font-bold">✎</button>
                          <button onClick={() => excluirMovimentacao(item.id)} className="bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-100 font-bold"></button>
                        </div>
                      </Td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <Paginacao pagina={paginaMovimentos} totalPaginas={totalPaginasMovimentos} onAnterior={() => setPaginaMovimentos((p) => Math.max(1, p - 1))} onProxima={() => setPaginaMovimentos((p) => Math.min(totalPaginasMovimentos, p + 1))} />
      </section>
    )
  }


  function renderExtratoGeral() {
    const resumoDono = resumoExtratoGeralAno

    const statusClasse =
      resumoDono.statusDono === 'CRÍTICO'
        ? 'bg-red-50 text-red-700 border-red-200'
        : resumoDono.statusDono === 'ATENÇÃO'
          ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
          : resumoDono.statusDono === 'SAUDÁVEL'
            ? 'bg-green-50 text-green-700 border-green-200'
            : 'bg-blue-50 text-blue-700 border-blue-200'

    const barraCaixaClasse =
      resumoDono.faltaReporCaixa > 0
        ? 'bg-yellow-400'
        : resumoDono.caixaLivreHC <= 0
          ? 'bg-red-500'
          : 'bg-green-500'

    return (
      <section className="space-y-5">
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <div className="mb-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-gray-950">Painel do Dono</h2>
              <p className="text-sm font-semibold text-gray-500">
                Somente os números que importam para decidir retirada, gasto e recomposição do caixa.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={anoExtrato}
                onChange={(e) => { setAnoFinanceiro(e.target.value); setAnoExtrato(e.target.value); setPaginaExtrato(1) }}
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="TODOS">Todos</option>
                {ANOS_FINANCEIRO_PERMITIDOS.map((ano) => (
                  <option key={ano} value={String(ano)}>
                    {ano}
                  </option>
                ))}
              </select>

              <div className={`rounded-xl border px-4 py-3 text-sm font-black ${statusClasse}`}>
                Status: {resumoDono.statusDono}
              </div>
            </div>
          </div>

          <section className="rounded-3xl border border-slate-800 bg-slate-950 p-5 text-white shadow-sm">
            <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-200">Decisão direta</p>
                <h3 className="mt-2 text-2xl font-black">A HC tem dinheiro livre para usar?</h3>
                <p className="mt-2 text-sm font-semibold text-slate-300">
                  A regra agora é simples: primeiro protege terceiros, paga obrigações e empréstimos, recompõe caixa mínimo e só depois libera retirada.
                </p>
              </div>

              <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-black text-yellow-800 max-w-xl">
                {resumoDono.mensagemDono}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <DonoResumoCard
                titulo="Caixa livre real da HC"
                valor={moeda(resumoDono.caixaLivreHC)}
                detalhe="Dinheiro realmente liberado depois de reservas, empréstimos e regra dos sócios."
                classe={resumoDono.caixaLivreHC > 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}
                destaque
              />

              <DonoResumoCard
                titulo="Caixa negativo real para regularizar"
                valor={moeda(resumoDono.caixaNegativoRealRegularizar)}
                detalhe={`Inclui ${moeda(resumoDono.faltaReporCaixa)} para recompor + ${moeda(resumoDono.terceirosProtegidos)} de terceiros.`}
                classe={resumoDono.caixaNegativoRealRegularizar > 0 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-green-50 text-green-700 border-green-200'}
                destaque
              />

              <DonoResumoCard
                titulo="Posso retirar agora"
                valor={moeda(resumoDono.podeRetirarAgora)}
                detalhe={resumoDono.podeRetirarAgora > 0 ? 'Limite seguro de retirada pela regra.' : 'Retirada bloqueada até recompor o caixa.'}
                classe={resumoDono.podeRetirarAgora > 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}
                destaque
              />

              <DonoResumoCard
                titulo="Terceiros a proteger"
                valor={moeda(resumoDono.terceirosProtegidos)}
                detalhe="Valor que não pertence à HC. Não entra em retirada nem gasto livre."
                classe="bg-orange-50 text-orange-700 border-orange-200"
              />

              <DonoResumoCard
                titulo="Empréstimos da HC"
                valor={moeda(resumoDono.emprestimosMensaisHC)}
                detalhe={`Parcela mensal fixa. Dívida atual: ${moeda(resumoDono.saldoDevedorEmprestimosHC)}`}
                classe="bg-purple-50 text-purple-700 border-purple-200"
              />

              <DonoResumoCard
                titulo="Posso gastar livre"
                valor={moeda(resumoDono.gastoLivrePermitido)}
                detalhe={resumoDono.gastoLivrePermitido > 0 ? 'Sobra segura para gasto não obrigatório.' : 'Sem gasto livre. Apenas obrigações essenciais.'}
                classe={resumoDono.gastoLivrePermitido > 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}
              />
            </div>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-sm font-black text-slate-200">Cobertura mínima para voltar a respirar</p>
                <p className="text-sm font-black text-white">{resumoDono.percentualCaixa.toFixed(0)}%</p>
              </div>
              <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
                <div className={`h-full rounded-full ${barraCaixaClasse}`} style={{ width: `${resumoDono.percentualCaixa}%` }} />
              </div>
              <p className="mt-2 text-xs font-bold text-slate-400">
                Caixa mínimo: {moeda(resumoDono.caixaMinimoRecomendado)} | Empréstimos do mês: {moeda(resumoDono.emprestimosMensaisHC)} | Regularização real: {moeda(resumoDono.caixaNegativoRealRegularizar)}
              </p>
            </div>
          </section>
        </section>

        <section className="rounded-2xl border border-red-100 bg-red-50 p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-4">
            <div>
              <h3 className="text-xl font-black text-red-950">Onde estou errando</h3>
              <p className="text-sm font-semibold text-red-700">
                O sistema mostra os motivos que impedem retirada e gasto livre.
              </p>
            </div>

            <div className="rounded-2xl border border-red-200 bg-white px-4 py-3">
              <p className="text-xs font-black uppercase tracking-wide text-red-500">Maior ponto de atenção</p>
              <p className="text-lg font-black text-red-900">{resumoDono.maiorErroFinanceiro}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <ErroCard
              titulo="Retiradas acima do permitido"
              valor={moeda(resumoDono.excessoRetiradasSocios)}
              detalhe={`Marcos: ${moeda(resumoDono.excessoRetiradasMarcos)} | Hérica: ${moeda(resumoDono.excessoRetiradasHerica)}`}
              ruim={resumoDono.excessoRetiradasSocios > 0}
            />

            <ErroCard
              titulo="Caixa mínimo faltando"
              valor={moeda(resumoDono.faltaReservaHC)}
              detalhe={`Mínimo obrigatório: ${moeda(resumoDono.caixaMinimoRecomendado)}`}
              ruim={resumoDono.faltaReservaHC > 0}
            />

            <ErroCard
              titulo="Caixa negativo real"
              valor={moeda(resumoDono.caixaNegativoRealRegularizar)}
              detalhe="Terceiros + caixa mínimo + empréstimos para regularizar."
              ruim={resumoDono.caixaNegativoRealRegularizar > 0}
            />

            <ErroCard
              titulo="Empréstimos fixos"
              valor={moeda(resumoDono.emprestimosMensaisHC)}
              detalhe="Esse valor sai todo mês antes de retirada dos sócios."
              ruim={resumoDono.emprestimosMensaisHC > 0}
            />

            <ErroCard
              titulo="Processos pagos sem custo"
              valor={resumoDono.qtdProcessosSemCompra}
              detalhe={`${moeda(resumoDono.valorRecebidoSemCompra)} recebidos com compra zerada`}
              ruim={resumoDono.qtdProcessosSemCompra > 0}
            />
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-xl font-black text-gray-950">Plano de correção</h3>
            <p className="text-sm font-semibold text-gray-500 mt-1">
              Ordem para a HC voltar a ter caixa livre real.
            </p>

            <div className="mt-5 space-y-3">
              <DecisionRow label="1. Bloquear retirada" valor={resumoDono.podeRetirarAgora > 0 ? 'Liberado com limite' : 'Bloqueado agora'} perigo={resumoDono.podeRetirarAgora <= 0} sucesso={resumoDono.podeRetirarAgora > 0} />
              <DecisionRow label="2. Proteger terceiros" valor={moeda(resumoDono.terceirosProtegidos)} destaque />
              <DecisionRow label="3. Cobrir empréstimos do mês" valor={moeda(resumoDono.emprestimosMensaisHC)} perigo={resumoDono.emprestimosMensaisHC > 0} />
              <DecisionRow label="4. Repor caixa mínimo" valor={moeda(resumoDono.faltaReservaHC)} perigo={resumoDono.faltaReservaHC > 0} sucesso={resumoDono.faltaReservaHC <= 0} />
              <DecisionRow label="5. Nova retirada só depois de" valor={moeda(resumoDono.caixaNegativoRealRegularizar)} perigo={resumoDono.caixaNegativoRealRegularizar > 0} sucesso={resumoDono.caixaNegativoRealRegularizar <= 0} />
            </div>

            <div className="mt-5 rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-sm font-black text-yellow-900">Ação recomendada</p>
              <p className="mt-1 text-sm font-semibold text-yellow-800">{resumoDono.acaoRecomendada}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-xl font-black text-gray-950">Sócios pela regra 25% / 25%</h3>
            <p className="text-sm font-semibold text-gray-500 mt-1">
              Retirada é abatimento da parte de cada sócio, não despesa da empresa.
            </p>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-[620px] w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <Th>Sócio</Th>
                    <Th>Direito</Th>
                    <Th>Já retirou</Th>
                    <Th>Saldo</Th>
                    <Th>Situação</Th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <Td>Marcos</Td>
                    <Td>{moeda(resumoDono.direitoMarcos)}</Td>
                    <Td><span className="font-black text-red-700">{moeda(resumoDono.retiradasMarcos)}</span></Td>
                    <Td><span className={resumoDono.saldoMarcos >= 0 ? 'font-black text-green-700' : 'font-black text-red-700'}>{moeda(resumoDono.saldoMarcos)}</span></Td>
                    <Td><Badge texto={resumoDono.saldoMarcos >= 0 ? 'DENTRO DA REGRA' : 'ADIANTADO'} classe={resumoDono.saldoMarcos >= 0 ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300'} /></Td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <Td>Hérica</Td>
                    <Td>{moeda(resumoDono.direitoHerica)}</Td>
                    <Td><span className="font-black text-red-700">{moeda(resumoDono.retiradasHerica)}</span></Td>
                    <Td><span className={resumoDono.saldoHerica >= 0 ? 'font-black text-green-700' : 'font-black text-red-700'}>{moeda(resumoDono.saldoHerica)}</span></Td>
                    <Td><Badge texto={resumoDono.saldoHerica >= 0 ? 'DENTRO DA REGRA' : 'ADIANTADO'} classe={resumoDono.saldoHerica >= 0 ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300'} /></Td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </section>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-950">Financeiro</h1>
          <p className="text-sm text-gray-500">
            Painel do Dono, resultado mensal, terceiros, processos faturados e movimentações financeiras
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={carregarDados}
            className="bg-white border border-gray-200 text-gray-800 px-5 py-3 rounded-xl font-bold hover:bg-gray-100 shadow-sm"
          >
             Atualizar dados
          </button>

          <button
            type="button"
            onClick={exportarPdfDoFiltro}
            className="bg-slate-900 text-white px-5 py-3 rounded-xl font-bold hover:bg-slate-800 shadow-sm"
          >
             PDF do filtro
          </button>

          {abaPrincipal === 'PROCESSOS' && (
            <label className="bg-blue-600 text-white px-5 py-3 rounded-xl font-bold cursor-pointer hover:bg-blue-700 shadow-sm">
               Importar Excel
              <input
                type="file"
                accept=".xlsx,.xls,.xlsm"
                onChange={importarExcel}
                disabled={importando}
                className="hidden"
              />
            </label>
          )}

          {abaPrincipal === 'DESPESAS' && (
            <label className="bg-green-600 text-white px-5 py-3 rounded-xl font-bold cursor-pointer hover:bg-green-700 shadow-sm">
               Importar Despesas Excel
              <input
                type="file"
                accept=".xlsx,.xls,.xlsm"
                onChange={importarDespesasExcel}
                disabled={importando}
                className="hidden"
              />
            </label>
          )}

          {abaPrincipal === 'SOCIOS' && (
            <label className="bg-purple-600 text-white px-5 py-3 rounded-xl font-bold cursor-pointer hover:bg-purple-700 shadow-sm">
               Importar Retiradas Excel
              <input
                type="file"
                accept=".xlsx,.xls,.xlsm"
                onChange={importarRetiradasSociosExcel}
                disabled={importando}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>


      <section className="mb-6 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">Filtro geral do financeiro</p>
            <h2 className="text-xl font-black text-gray-950">Ano em análise: {rotuloAnoFinanceiro()}</h2>
            <p className="text-sm font-semibold text-gray-500">
              Todas as abas abaixo usam este ano como base: Painel do Dono, Resultado, Processos, Despesas, Sócios e Caixa/Fundo.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <label className="text-sm font-bold text-gray-600">
              Ano
              <select
                value={anoFinanceiroAtivo()}
                onChange={(e) => setAnoFinanceiro(e.target.value)}
                className="mt-1 block min-w-[180px] rounded-xl border border-gray-200 px-4 py-3 text-sm font-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ANOS_FINANCEIRO_PERMITIDOS.map((ano) => (
                  <option key={ano} value={String(ano)}>
                    {ano}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={aplicarTodosAnosFinanceiro}
              className={
                todosAnosFinanceiroAtivo()
                  ? 'rounded-xl bg-green-600 px-5 py-3 text-sm font-black text-white shadow-sm'
                  : 'rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-slate-800'
              }
            >
              {todosAnosFinanceiroAtivo() ? 'Todos exibidos' : 'Mostrar todos'}
            </button>

            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
              Período permitido: {textoAnosFinanceiroPermitidos()}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6 flex gap-2 overflow-x-auto pb-1">
        <TabButton ativo={abaPrincipal === 'EXTRATO'} onClick={() => mudarAbaPrincipal('EXTRATO')}>Painel do Dono</TabButton>
        <TabButton ativo={abaPrincipal === 'RESULTADO'} onClick={() => mudarAbaPrincipal('RESULTADO')}>Resultado Mensal</TabButton>
        <TabButton ativo={abaPrincipal === 'PROCESSOS'} onClick={() => mudarAbaPrincipal('PROCESSOS')}>Processos Faturados</TabButton>
        <TabButton ativo={abaPrincipal === 'DESPESAS'} onClick={() => mudarAbaPrincipal('DESPESAS')}>Despesas</TabButton>
        <TabButton ativo={abaPrincipal === 'SOCIOS'} onClick={() => mudarAbaPrincipal('SOCIOS')}>Retiradas / Sócios</TabButton>
        <TabButton ativo={abaPrincipal === 'FUNDO'} onClick={() => mudarAbaPrincipal('FUNDO')}>Caixa / Fundo</TabButton>
      </section>

      {abaPrincipal === 'PROCESSOS' && (
        <>
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <BigCard
              titulo="VALOR EM ABERTO"
              valor={moeda(resumo.emAberto.total)}
              subtitulo="Valor pendente de recebimento"
              icone=""
              classe="bg-orange-50 border-orange-200 text-orange-600"
            />

            <BigCard
              titulo="VALOR EM ATRASO"
              valor={moeda(resumo.atrasado.total)}
              subtitulo="Valor vencido não recebido"
              icone=""
              classe="bg-red-50 border-red-200 text-red-600"
            />
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-5">
            <ResumoCard ativo={aba === 'EM ABERTO' && filtroStatusProcessos.length === 0} titulo="Em aberto" quantidade={resumo.emAberto.qtd} valor={moeda(resumo.emAberto.total)} cor="yellow" onClick={() => mudarAba('EM ABERTO')} />
            <ResumoCard ativo={aba === 'ATRASADO' && filtroStatusProcessos.length === 0} titulo="Atrasados" quantidade={resumo.atrasado.qtd} valor={moeda(resumo.atrasado.total)} cor="red" onClick={() => mudarAba('ATRASADO')} />
            <ResumoCard ativo={aba === 'PAGO' && filtroStatusProcessos.length === 0} titulo="Pagos" quantidade={resumo.pago.qtd} valor={moeda(resumo.pago.total)} cor="green" onClick={() => mudarAba('PAGO')} />
            <ResumoCard ativo={filtroStatusProcessos.includes('AGUARDANDO_CUSTO')} titulo="Aguardando custo" quantidade={resumo.aguardandoCusto.qtd} valor={moeda(resumo.aguardandoCusto.total)} cor="orange" onClick={filtrarAguardandoCusto} />
            <ResumoCard ativo={aba === 'TODOS' && filtroStatusProcessos.length === 0} titulo="Todos" quantidade={resumo.todos.qtd} valor={moeda(resumo.todos.total)} cor="blue" onClick={() => mudarAba('TODOS')} />
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6">
            <h2 className="text-lg font-bold mb-4">
              {editandoId ? 'Editando lançamento' : 'Novo lançamento'}
            </h2>

            <form onSubmit={salvar} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input label="Cliente" value={form.cliente} onChange={(v) => setForm({ ...form, cliente: v })} />
              <Input label="Despachante" value={form.despachante} onChange={(v) => setForm({ ...form, despachante: v })} />
              <Input label="AWB" value={form.awb} onChange={(v) => setForm({ ...form, awb: v })} />
              <Input label="Número da Fatura" value={form.fatura} onChange={(v) => setForm({ ...form, fatura: v })} />

              <Input label="Transportadora" value={form.transportadora} onChange={(v) => setForm({ ...form, transportadora: v })} />
              <Input label="Serviço" value={form.servico} onChange={(v) => setForm({ ...form, servico: v })} />
              <InputMoney label="Valor faturado ao cliente R$" value={form.valor_cobranca} onChange={(v) => setForm({ ...form, valor_cobranca: v })} />
              <InputMoney label="DTA / DOC / Impostos R$" value={form.doc_dta} onChange={(v) => setForm({ ...form, doc_dta: v })} />

              <InputMoney label="Terceiros a pagar R$" value={form.debito_terceiro} onChange={(v) => setForm({ ...form, debito_terceiro: v })} />
              <InputMoney label="Valor compra R$" value={form.valor_compra} onChange={(v) => setForm({ ...form, valor_compra: v })} />
              <Input type="date" label="Vencimento cliente" value={form.vencimento_cobranca} onChange={(v) => setForm({ ...form, vencimento_cobranca: v })} />
              <Input type="date" label="Recebimento cliente" value={form.recebimento} onChange={(v) => setForm({ ...form, recebimento: v })} />

              <div className="md:col-span-4">
                <label className="text-sm font-semibold text-gray-600">Observações</label>
                <textarea
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>

              <div className="md:col-span-4 flex gap-3">
                <button
                  disabled={salvando}
                  className="bg-blue-600 text-white px-5 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 font-bold"
                >
                  {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Salvar lançamento'}
                </button>

                {editandoId && (
                  <button
                    type="button"
                    onClick={cancelarEdicao}
                    className="bg-gray-100 text-gray-800 px-5 py-3 rounded-xl hover:bg-gray-200 font-bold"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </section>

          <section id="processos_faturados" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-5">
              <input value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1) }} placeholder="Buscar por cliente, AWB, fatura, serviço..." className="rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />

              <MultiSelect
                label="Status"
                values={filtroStatusProcessos}
                onChange={(valores) => { setFiltroStatusProcessos(valores); if (valores.length > 0) setAba('TODOS'); setPagina(1) }}
                options={STATUS_PROCESSOS}
                placeholder="Todos status"
              />

              <MultiSelect
                label="Transportadoras"
                values={filtroTransportadora}
                onChange={(valores) => { setFiltroTransportadora(valores); setPagina(1) }}
                options={transportadoras.map((item: any) => ({ value: String(item), label: String(item) }))}
                placeholder="Todas transportadoras"
              />

              <MultiSelect
                label="Despachantes"
                values={filtroDespachante}
                onChange={(valores) => { setFiltroDespachante(valores); setPagina(1) }}
                options={despachantes.map((item: any) => ({ value: String(item), label: String(item) }))}
                placeholder="Todos despachantes"
              />

              <MultiSelect
                label="Serviços"
                values={filtroServico}
                onChange={(valores) => { setFiltroServico(valores); setPagina(1) }}
                options={servicos.map((item: any) => ({ value: String(item), label: String(item) }))}
                placeholder="Todos serviços"
              />

              <button type="button" onClick={limparFiltros} className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold hover:bg-gray-50">
                ⌁ Limpar filtros
              </button>
            </div>

            <section className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
              <div className="mb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <h3 className="text-lg font-black text-gray-950">Resumo dos filtros aplicados</h3>
                  <p className="text-sm text-gray-500">
                    Somatório calculado somente com os registros exibidos no filtro atual.
                  </p>
                </div>

                <span className="inline-flex w-fit rounded-full bg-white px-3 py-1 text-xs font-black text-blue-700 border border-blue-100">
                  {resumoFiltrado.qtd} lançamentos filtrados
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
                <FiltroResumoCard
                  titulo="Valor Faturado"
                  valor={moeda(resumoFiltrado.totalValorFaturado)}
                  detalhe="Cliente"
                  classe="bg-white text-blue-700 border-blue-100"
                />

                <FiltroResumoCard
                  titulo="DTA/DOC/Impostos"
                  valor={moeda(resumoFiltrado.totalDtaDocImpostos)}
                  detalhe="Custos extras"
                  classe="bg-white text-slate-700 border-slate-100"
                />

                <FiltroResumoCard
                  titulo="Terceiros"
                  valor={moeda(resumoFiltrado.totalTerceiros)}
                  detalhe="Parceiros"
                  classe="bg-white text-orange-700 border-orange-100"
                />

                <FiltroResumoCard
                  titulo="Valor Compra"
                  valor={moeda(resumoFiltrado.totalValorCompra)}
                  detalhe="Custo HC"
                  classe="bg-white text-slate-700 border-slate-100"
                />

                <FiltroResumoCard
                  titulo="Profit HC"
                  valor={moeda(resumoFiltrado.totalProfitHC)}
                  detalhe={
                    resumoFiltrado.aguardandoCusto > 0
                      ? `${resumoFiltrado.aguardandoCusto} sem custo`
                      : 'Com custo lançado'
                  }
                  classe={
                    resumoFiltrado.totalProfitHC >= 0
                      ? 'bg-white text-green-700 border-green-100'
                      : 'bg-white text-red-700 border-red-100'
                  }
                />

                <FiltroResumoCard
                  titulo="Recebimento"
                  valor={`${resumoFiltrado.pago.qtd} pagos`}
                  detalhe={`${moeda(resumoFiltrado.pago.total)} recebido`}
                  classe="bg-white text-green-700 border-green-100"
                />
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                <FiltroMiniStatus
                  titulo="Em aberto"
                  quantidade={resumoFiltrado.emAberto.qtd}
                  valor={moeda(resumoFiltrado.emAberto.total)}
                  classe="bg-yellow-50 text-yellow-700 border-yellow-200"
                />

                <FiltroMiniStatus
                  titulo="Atrasados"
                  quantidade={resumoFiltrado.atrasado.qtd}
                  valor={moeda(resumoFiltrado.atrasado.total)}
                  classe="bg-red-50 text-red-700 border-red-200"
                />

                <FiltroMiniStatus
                  titulo="Pagos"
                  quantidade={resumoFiltrado.pago.qtd}
                  valor={moeda(resumoFiltrado.pago.total)}
                  classe="bg-green-50 text-green-700 border-green-200"
                />

                <FiltroMiniStatus
                  titulo="Aguardando custo"
                  quantidade={resumoFiltrado.aguardandoCusto}
                  valor="sem custo lançado"
                  classe="bg-orange-50 text-orange-700 border-orange-200"
                />
              </div>
            </section>

            <div className="overflow-x-auto">
              <table className="min-w-[1750px] w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <Th>Cliente</Th>
                    <Th>Despachante</Th>
                    <Th>AWB</Th>
                    <Th>Nº Fatura</Th>
                    <Th>Transportadora</Th>
                    <Th>Serviço</Th>
                    <Th>Valor Faturado</Th>
                    <Th>DTA/DOC/Impostos</Th>
                    <Th>Terceiros</Th>
                    <Th>Valor Compra</Th>
                    <Th>Profit HC</Th>
                    <Th>Venc. Cliente</Th>
                    <Th>Recebimento</Th>
                    <Th>Status</Th>
                    <Th>Ações</Th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr><td colSpan={15} className="p-6 text-center">Carregando todos os registros...</td></tr>
                  ) : filtradosPaginados.length === 0 ? (
                    <tr><td colSpan={15} className="p-6 text-center text-gray-500">Nenhum lançamento encontrado.</td></tr>
                  ) : (
                    filtradosPaginados.map((item) => {
                      const cobranca = statusCobranca(item)
                      const possuiCusto = !aguardandoCustoProcesso(item)
                      const profit = possuiCusto ? calcularProfit(item) : null

                      return (
                        <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <Td>{item.cliente}</Td>
                          <Td>{item.despachante}</Td>
                          <Td>{item.awb}</Td>
                          <Td>{item.fatura || '-'}</Td>
                          <Td>{item.transportadora}</Td>
                          <Td>{normalizarServicoFinanceiro(item.servico) || '-'}</Td>
                          <Td>{moeda(item.valor_cobranca)}</Td>
                          <Td>{moeda(item.doc_dta)}</Td>
                          <Td>{moeda(item.debito_terceiro)}</Td>
                          <Td>{possuiCusto ? moeda(item.valor_compra) : <span className="inline-flex rounded-lg bg-yellow-100 px-2 py-1 text-xs font-black text-yellow-700 border border-yellow-300">⚠ AGUARDANDO CUSTO</span>}</Td>
                          <Td>{profit === null ? <span className="text-gray-400 font-black">AGUARDANDO CUSTO</span> : <span className={profit >= 0 ? 'text-green-600 font-black' : 'text-red-600 font-black'}>{moeda(profit)}</span>}</Td>
                          <Td>{normalizarData(item.vencimento_cobranca) || '-'}</Td>
                          <Td>{normalizarData(item.recebimento) || '-'}</Td>
                          <Td><Badge texto={cobranca} classe={badgeStatus(cobranca)} /></Td>
                          <Td>
                            <div className="flex gap-2">
                              <button onClick={() => editar(item)} className="bg-blue-50 text-blue-600 border border-blue-200 px-3 py-2 rounded-lg hover:bg-blue-100 font-bold">✎</button>
                              <button onClick={() => excluir(item.id)} className="bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-100 font-bold"></button>
                            </div>
                          </Td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <Paginacao pagina={pagina} totalPaginas={totalPaginas} onAnterior={() => setPagina((p) => Math.max(1, p - 1))} onProxima={() => setPagina((p) => Math.min(totalPaginas, p + 1))} />
          </section>
        </>
      )}

      {abaPrincipal === 'DESPESAS' && (
        <>
          {renderFormularioMovimento('Nova despesa', 'Lance despesas fixas ou variáveis da empresa, sem misturar com os processos faturados.')}
          {renderTabelaMovimentos()}
        </>
      )}

      {abaPrincipal === 'SOCIOS' && (
        <>
          {renderFormularioMovimento('Nova movimentação de sócio', 'Controle retiradas, reembolsos e aportes de Marcos e Hérica. As retiradas abatem a parte de cada sócio no lucro.')}
          {renderTabelaMovimentos()}
        </>
      )}

      {abaPrincipal === 'FUNDO' && (
        <>
          <section className="grid grid-cols-1 lg:grid-cols-4 gap-5 mb-5">
            <BigCard
              titulo="FUNDO DE CAIXA ATUAL"
              valor={moeda(resultadoGeral.fundoAtual)}
              subtitulo={`Saldo acumulado de ${anoFinanceiroAtivo()}`}
              icone=""
              classe="bg-blue-50 border-blue-200 text-blue-700"
            />
            <BigCard
              titulo="ENTRADAS DO PERÍODO"
              valor={moeda(resumoFundoFiltro.entradas)}
              subtitulo={textoPeriodoFundo()}
              icone="⬆ï¸"
              classe="bg-green-50 border-green-200 text-green-700"
            />
            <BigCard
              titulo="SAÍDAS DO PERÍODO"
              valor={moeda(resumoFundoFiltro.saidas)}
              subtitulo={textoPeriodoFundo()}
              icone="⬇ï¸"
              classe="bg-red-50 border-red-200 text-red-700"
            />
            <BigCard
              titulo="SALDO DO PERÍODO"
              valor={moeda(resumoFundoFiltro.saldoPeriodo)}
              subtitulo="Entradas - saídas + ajustes"
              icone={resumoFundoFiltro.saldoPeriodo >= 0 ? '✅' : '⚠ï¸'}
              classe={resumoFundoFiltro.saldoPeriodo >= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}
            />
          </section>

          {renderFormularioMovimento('Nova movimentação do fundo de caixa', 'Registre entradas, saídas e ajustes do fundo de caixa da empresa.')}
          {renderTabelaMovimentos()}
        </>
      )}

      {abaPrincipal === 'EXTRATO' && renderExtratoGeral()}

      {abaPrincipal === 'RESULTADO' && (
        <section className="space-y-5">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-gray-950">Resultado Mensal</h2>
              <p className="text-sm text-gray-500">
                Visão do mês pela regra: lucro líquido = Profit HC - despesas; 50% fica no caixa, 25% Marcos e 25% Hérica.
              </p>
            </div>

            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div>
                <label className="text-sm font-semibold text-gray-600">Mês do resultado</label>
                <input
                  type="month"
                  min={MES_MINIMO_FINANCEIRO}
                  max={MES_MAXIMO_FINANCEIRO}
                  value={mesResultado}
                  onChange={(e) => {
                    if (!mesFinanceiroPermitido(e.target.value)) {
                      alert(`O financeiro está limitado a ${textoAnosFinanceiroPermitidos()}.`)
                      return
                    }

                    setAnoFinanceiro(e.target.value.slice(0, 4))
                    setMesResultado(e.target.value)
                  }}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="button"
                onClick={gerarFechamentoMensal}
                disabled={gerandoFechamento || resultadoGeral.saldoFundoMes <= 0 || resultadoGeral.resultadoOperacional <= 0}
                className="bg-green-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm whitespace-nowrap"
              >
                {gerandoFechamento ? 'Gerando...' : 'Gerar fechamento do mês'}
              </button>

              <button
                type="button"
                onClick={gerarFechamentosRetroativos}
                disabled={gerandoRetroativos || loading || loadingMovimentos}
                className="bg-slate-900 text-white px-5 py-3 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm whitespace-nowrap"
              >
                {gerandoRetroativos ? 'Gerando retroativos...' : 'Gerar retroativos'}
              </button>
            </div>
          </div>

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <FiltroResumoCard titulo="Valor recebido" valor={moeda(resultadoGeral.valorRecebido)} detalhe={`${resultadoGeral.processos} processos pagos`} classe="bg-white text-blue-700 border-blue-100" />
            <FiltroResumoCard titulo="Profit HC recebido" valor={moeda(resultadoGeral.profitRecebido)} detalhe={resultadoGeral.semCusto > 0 ? `${resultadoGeral.semCusto} sem custo` : 'Com custo lançado'} classe="bg-white text-green-700 border-green-100" />
            <FiltroResumoCard titulo="Despesas pagas" valor={moeda(resultadoGeral.despesasPagas)} detalhe={`${moeda(resultadoGeral.despesasPendentes)} pendente`} classe="bg-white text-red-700 border-red-100" />
            <FiltroResumoCard titulo="Empréstimos pagos" valor={moeda(resultadoGeral.emprestimosPagos)} detalhe={`Parcela mensal fixa: ${moeda(resultadoGeral.parcelaEmprestimosMensal)}`} classe="bg-white text-purple-700 border-purple-100" />
            <FiltroResumoCard titulo="Lucro líquido" valor={moeda(resultadoGeral.resultadoOperacional)} detalhe="Profit - despesas - empréstimos" classe={resultadoGeral.resultadoOperacional >= 0 ? 'bg-white text-green-700 border-green-100' : 'bg-white text-red-700 border-red-100'} />
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <FiltroResumoCard titulo="Fundo de caixa 50%" valor={moeda(resultadoGeral.fundoPrevistoMes)} detalhe={`${moeda(resultadoGeral.reservasFundoMes)} já reservado dos 50%`} classe="bg-white text-blue-700 border-blue-100" />
            <FiltroResumoCard titulo="Parte Marcos 25%" valor={moeda(resultadoGeral.parteMarcos)} detalhe={`${moeda(resultadoGeral.retiradasMarcos)} já retirado`} classe="bg-white text-slate-700 border-slate-100" />
            <FiltroResumoCard titulo="Parte Hérica 25%" valor={moeda(resultadoGeral.parteHerica)} detalhe={`${moeda(resultadoGeral.retiradasHerica)} já retirado`} classe="bg-white text-slate-700 border-slate-100" />
            <FiltroResumoCard titulo="Fundo atual" valor={moeda(resultadoGeral.fundoAtual)} detalhe="Saldo reservado acumulado" classe="bg-white text-blue-700 border-blue-100" />
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FiltroResumoCard
              titulo="Saldo Marcos"
              valor={moeda(resultadoGeral.saldoMarcos)}
              detalhe={resultadoGeral.saldoMarcos >= 0 ? 'Ainda pode retirar' : 'Retirou acima da parte'}
              classe={resultadoGeral.saldoMarcos >= 0 ? 'bg-white text-green-700 border-green-100' : 'bg-white text-red-700 border-red-100'}
            />

            <FiltroResumoCard
              titulo="Saldo Hérica"
              valor={moeda(resultadoGeral.saldoHerica)}
              detalhe={resultadoGeral.saldoHerica >= 0 ? 'Ainda pode retirar' : 'Retirou acima da parte'}
              classe={resultadoGeral.saldoHerica >= 0 ? 'bg-white text-green-700 border-green-100' : 'bg-white text-red-700 border-red-100'}
            />

            <FiltroResumoCard
              titulo="Saldo fundo do mês"
              valor={moeda(resultadoGeral.saldoFundoMes)}
              detalhe={resultadoGeral.saldoFundoMes >= 0 ? 'Ainda falta reservar' : 'Reservado acima dos 50%'}
              classe={resultadoGeral.saldoFundoMes >= 0 ? 'bg-white text-orange-700 border-orange-100' : 'bg-white text-blue-700 border-blue-100'}
            />
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-black text-gray-950 mb-4">Distribuição do lucro do mês</h3>

            <div className="space-y-3 text-sm">
              <LinhaResultado label="Profit HC dos processos recebidos" valor={resultadoGeral.profitRecebido} positivo />
              <LinhaResultado label="Despesas pagas da empresa" valor={resultadoGeral.despesasPagas} negativo />
              <LinhaResultado label="Lucro líquido para distribuição" valor={resultadoGeral.resultadoOperacional} destaque />
              <LinhaResultado label="50% para fundo de caixa" valor={resultadoGeral.fundoPrevistoMes} negativo />
              <LinhaResultado label="25% parte Marcos" valor={resultadoGeral.parteMarcos} negativo />
              <LinhaResultado label="25% parte Hérica" valor={resultadoGeral.parteHerica} negativo />

              <div className="border-t border-gray-200 pt-4 mt-4 space-y-3">
                <LinhaResultado label="Retirado Marcos no mês" valor={resultadoGeral.retiradasMarcos} negativo />
                <LinhaResultado label="Saldo Marcos a retirar" valor={resultadoGeral.saldoMarcos} destaque />
                <LinhaResultado label="Retirado Hérica no mês" valor={resultadoGeral.retiradasHerica} negativo />
                <LinhaResultado label="Saldo Hérica a retirar" valor={resultadoGeral.saldoHerica} destaque />
                <LinhaResultado label="Reservado no fundo no mês" valor={resultadoGeral.reservasFundoMes} negativo />
                <LinhaResultado label="Entradas não operacionais no caixa" valor={resultadoGeral.entradasNaoOperacionaisMes} positivo />
                <LinhaResultado label="Saldo para reservar no fundo" valor={resultadoGeral.saldoFundoMes} destaque />
              </div>

              <div className="border-t border-gray-200 pt-4 mt-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-black text-gray-950">Saldo real do caixa no mês</p>
                  <p className="text-xs font-bold text-gray-500">Lucro líquido + entradas não operacionais + aportes - retiradas - saídas do caixa/fundo</p>
                </div>
                <p className={`text-2xl font-black ${resultadoGeral.saldoCaixaRealMes >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {moeda(resultadoGeral.saldoCaixaRealMes)}
                </p>
              </div>
            </div>
          </section>
        </section>
      )}
    </main>
  )
}

function FiltroResumoCard({ titulo, valor, detalhe, classe }: any) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${classe}`}>
      <p className="text-xs font-black tracking-wide opacity-80">{titulo}</p>
      <p className="mt-2 text-xl font-black">{valor}</p>
      <p className="mt-1 text-xs font-bold opacity-70">{detalhe}</p>
    </div>
  )
}



function ErroCard({ titulo, valor, detalhe, ruim }: any) {
  return (
    <div className={`rounded-2xl border p-4 ${ruim ? 'border-red-200 bg-white text-red-900' : 'border-green-200 bg-white text-green-900'}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-70">{titulo}</p>
      <p className="mt-2 text-xl font-black">{valor}</p>
      <p className="mt-1 text-xs font-bold opacity-75">{detalhe}</p>
    </div>
  )
}

function DonoResumoCard({ titulo, valor, detalhe, classe, destaque }: any) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${classe} ${destaque ? 'xl:col-span-1' : ''}`}>
      <p className="text-xs font-black uppercase tracking-wide opacity-75">{titulo}</p>
      <p className="mt-2 text-2xl font-black leading-tight">{valor}</p>
      <p className="mt-2 text-xs font-bold opacity-75 leading-snug">{detalhe}</p>
    </div>
  )
}

function DecisionRow({ label, valor, destaque, perigo, sucesso }: any) {
  return (
    <div className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 ${
      destaque
        ? 'bg-gray-50 border-gray-200'
        : perigo
          ? 'bg-red-50 border-red-100'
          : sucesso
            ? 'bg-green-50 border-green-100'
            : 'bg-white border-gray-100'
    }`}>
      <p className="text-sm font-black text-gray-600">{label}</p>
      <p className={`text-right text-sm font-black ${perigo ? 'text-red-700' : sucesso ? 'text-green-700' : 'text-gray-950'}`}>{valor}</p>
    </div>
  )
}

function FiltroMiniStatus({ titulo, quantidade, valor, classe }: any) {
  return (
    <div className={`rounded-xl border px-4 py-3 flex items-center justify-between ${classe}`}>
      <div>
        <p className="text-sm font-black">{titulo}</p>
        <p className="text-xs font-bold opacity-75">{quantidade} lançamentos</p>
      </div>

      <p className="text-sm font-black">{valor}</p>
    </div>
  )
}

function BigCard({ titulo, valor, subtitulo, icone, classe }: any) {
  return (
    <div className={`rounded-2xl border p-8 shadow-sm ${classe}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black tracking-wide">{titulo}</p>
          <p className="text-4xl font-black mt-3">{valor}</p>
          <p className="text-sm text-gray-500 mt-2">{subtitulo}</p>
        </div>
        <div className="w-16 h-16 rounded-full bg-white/70 flex items-center justify-center text-3xl">{icone}</div>
      </div>
    </div>
  )
}

function ResumoCard({ titulo, quantidade, valor, ativo, onClick, cor }: any) {
  const cores: any = {
    yellow: 'bg-yellow-400',
    red: 'bg-red-500',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    orange: 'bg-orange-500',
  }

  return (
    <button type="button" onClick={onClick} className={`bg-white rounded-2xl shadow-sm border p-5 text-left hover:shadow-md ${ativo ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200'}`}>
      <div className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${cores[cor]}`} />
        <p className="font-black text-gray-900">{titulo}</p>
        <span className="ml-auto bg-gray-100 text-gray-700 text-xs font-black px-2 py-1 rounded-full">{quantidade}</span>
      </div>
      <p className="text-sm font-bold text-gray-600 mt-3">{valor}</p>
    </button>
  )
}

function TabButton({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-xl px-5 py-3 text-sm font-black border shadow-sm ${
        ativo
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}

function Badge({ texto, classe }: { texto: string; classe: string }) {
  return <span className={`inline-flex px-3 py-1 rounded-full border text-xs font-black whitespace-nowrap ${classe}`}>{texto}</span>
}

function Input({ label, value, onChange, type = 'text', placeholder = '' }: InputProps) {
  return (
    <div>
      <label className="text-sm font-semibold text-gray-600">{label}</label>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  )
}


function MultiSelect({ label, values, onChange, options, placeholder = 'Todos' }: {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  const selecionados = values.length === 0 ? placeholder : `${values.length} selecionado${values.length > 1 ? 's' : ''}`

  return (
    <div>
      <label className="text-sm font-semibold text-gray-600">{label}</label>
      <select
        multiple
        value={values}
        onChange={(e) => onChange(Array.from(e.currentTarget.selectedOptions as HTMLCollectionOf<HTMLOptionElement>, (option) => option.value))}
        className="mt-1 h-24 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>
      <p className="mt-1 text-[11px] font-bold text-gray-500">{selecionados}</p>
    </div>
  )
}

function InputMoney({ label, value, onChange }: InputProps) {
  function formatar(valor: string) {
    const apenasNumeros = String(valor || '').replace(/\D/g, '')
    if (!apenasNumeros) return ''

    const numeroFinal = Number(apenasNumeros) / 100

    return numeroFinal.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  return (
    <div>
      <label className="text-sm font-semibold text-gray-600">{label}</label>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(formatar(e.target.value))}
        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

function Paginacao({ pagina, totalPaginas, onAnterior, onProxima }: any) {
  return (
    <div className="mt-5 flex items-center justify-between gap-3">
      <p className="text-sm font-bold text-gray-500">
        Página {pagina} de {totalPaginas}
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onAnterior}
          disabled={pagina <= 1}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-black disabled:opacity-40 hover:bg-gray-50"
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={onProxima}
          disabled={pagina >= totalPaginas}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-black disabled:opacity-40 hover:bg-gray-50"
        >
          Próxima
        </button>
      </div>
    </div>
  )
}

function LinhaResultado({ label, valor, positivo, negativo, destaque }: any) {
  const numero = Number(valor || 0)
  const valorFormatado = numero.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 ${destaque ? 'bg-gray-50 border border-gray-200' : ''}`}>
      <p className={`font-bold ${destaque ? 'text-gray-950' : 'text-gray-600'}`}>{label}</p>
      <p className={`font-black ${positivo ? 'text-green-700' : negativo ? 'text-red-700' : numero >= 0 ? 'text-green-700' : 'text-red-700'}`}>
        {negativo && numero > 0 ? `- ${valorFormatado}` : positivo && numero > 0 ? `+ ${valorFormatado}` : valorFormatado}
      </p>
    </div>
  )
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-3 py-3 text-left font-black whitespace-nowrap">{children}</th>
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-3 py-3 whitespace-nowrap">{children}</td>
}
