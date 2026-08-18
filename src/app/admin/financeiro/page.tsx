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

const FUSO_FINANCEIRO = 'America/Sao_Paulo'

function dataHojeFinanceiro() {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_FINANCEIRO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const ano = partes.find((parte) => parte.type === 'year')?.value || ''
  const mes = partes.find((parte) => parte.type === 'month')?.value || ''
  const dia = partes.find((parte) => parte.type === 'day')?.value || ''

  return `${ano}-${mes}-${dia}`
}

function mesAtualFinanceiro() {
  return dataHojeFinanceiro().slice(0, 7)
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
  mes_referencia: mesAtualFinanceiro(),
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
const ANO_BASE_FINANCEIRO = 2022
const ANO_ATUAL_FINANCEIRO = Number(mesAtualFinanceiro().slice(0, 4))
const ANOS_FINANCEIRO_PERMITIDOS = Array.from(
  { length: Math.max(1, ANO_ATUAL_FINANCEIRO - ANO_BASE_FINANCEIRO + 1) },
  (_, index) => ANO_BASE_FINANCEIRO + index
).sort((a, b) => b - a)
const MES_MINIMO_FINANCEIRO = `${ANO_BASE_FINANCEIRO}-01`
const MES_MAXIMO_FINANCEIRO = `${ANO_ATUAL_FINANCEIRO}-12`

const DATA_BASE_CONCILIACAO = '2026-08-17'
const SALDO_BASE_CONCILIACAO = 12095.80
const TOLERANCIA_CONCILIACAO = 1

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
  { value: 'FUNDO_CAIXA_ENTRADA', label: 'Entrada extraordinária / reserva' },
  { value: 'FUNDO_CAIXA_SAIDA', label: 'Saída extraordinária / uso da reserva' },
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
  { value: 'FUNDO_CAIXA_ENTRADA', label: 'Entradas extraordinárias / reservas' },
  { value: 'FUNDO_CAIXA_SAIDA', label: 'Saídas extraordinárias / uso da reserva' },
  { value: 'AJUSTE_CAIXA', label: 'Ajustes de caixa' },
]


function textoMesAnoProcessos(valor: string) {
  if (!valor) return 'Todos os meses'

  const [ano, mes] = valor.split('-')
  const nomes = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ]

  const indice = Number(mes) - 1
  const nome = nomes[indice] || mes

  return `${nome}/${ano}`
}

export default function FinanceiroPage() {
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [movimentacoes, setMovimentacoes] = useState<any[]>([])
  const [contasBancarias, setContasBancarias] = useState<any[]>([])

  const [loadingContasBancarias, setLoadingContasBancarias] = useState(false)
  const [salvandoContaBancaria, setSalvandoContaBancaria] = useState(false)
  const [editandoContaBancariaId, setEditandoContaBancariaId] = useState<string | null>(null)
  const [erroContasBancarias, setErroContasBancarias] = useState('')
  const [formContaBancaria, setFormContaBancaria] = useState({ banco: '', nome_conta: '', saldo_atual: '' })

  const [loading, setLoading] = useState(false)
  const [loadingMovimentos, setLoadingMovimentos] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [salvandoMovimento, setSalvandoMovimento] = useState(false)
  const [importando, setImportando] = useState(false)
  const [gerandoFechamento, setGerandoFechamento] = useState(false)
  const [gerandoRetroativos, setGerandoRetroativos] = useState(false)
  const [revisandoCustos, setRevisandoCustos] = useState(false)
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
  const [filtroAnoProcessos, setFiltroAnoProcessos] = useState(String(new Date().getFullYear()))
  const [filtroMesProcessos, setFiltroMesProcessos] = useState('')

  const [buscaMovimento, setBuscaMovimento] = useState('')
  const [filtroMesMovimento, setFiltroMesMovimento] = useState<string[]>([])
  const [filtroStatusMovimento, setFiltroStatusMovimento] = useState<string[]>([])
  const [filtroSocioMovimento, setFiltroSocioMovimento] = useState<string[]>([])
  const [mesResultado, setMesResultado] = useState(mesAtualFinanceiro())

  const [anoExtrato, setAnoExtrato] = useState(String(new Date().getFullYear()))
  const [buscaExtrato, setBuscaExtrato] = useState('')
  const [tipoExtrato, setTipoExtrato] = useState<string[]>([])
  const [filtroStatusExtrato, setFiltroStatusExtrato] = useState<string[]>([])
  const [filtroSocioExtrato, setFiltroSocioExtrato] = useState<string[]>([])

  const [form, setForm] = useState<FormState>(formVazio)
  const [formMovimento, setFormMovimento] = useState<MovimentacaoFormState>(movimentacaoVazia)
  const [faturasTransportadorasCaixa, setFaturasTransportadorasCaixa] = useState<any[]>([])
  const [loadingCompromissosCaixa, setLoadingCompromissosCaixa] = useState(true)
  const [erroCompromissosCaixa, setErroCompromissosCaixa] = useState('')

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
    const anoUrl = params.get('ano') || params.get('year')

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
      const anoUrlLimpo = String(anoUrl || '').trim().toUpperCase()

      setAnoFinanceiro(
        anoUrlLimpo === 'TODOS' || !anoUrlLimpo
          ? 'TODOS'
          : anoFinanceiroPermitido(anoUrlLimpo)
            ? anoUrlLimpo.slice(0, 4)
            : 'TODOS'
      )

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

  function dataRecebimentoProcesso(item: any) {
    return (
      normalizarData(item.recebimento) ||
      normalizarData(item.recebimento_cliente) ||
      normalizarData(item.data_recebimento) ||
      normalizarData(item.data_pagamento) ||
      null
    )
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
      mesReferenciaFinanceira(dataRecebimentoProcesso(item)) ||
      mesReferenciaFinanceira(item.mes_profit) ||
      mesReferenciaFinanceira(item.mes) ||
      mesReferenciaFinanceira(item.vencimento_cobranca) ||
      mesReferenciaFinanceira(item.vencimento_cliente) ||
      mesReferenciaFinanceira(item.venc_cliente) ||
      mesReferenciaFinanceira(item.vencimento) ||
      mesReferenciaFinanceira(item.data_vencimento) ||
      ''
    )
  }

  function mesResultadoLancamento(item: any) {
    const recebimento = dataRecebimentoProcesso(item)

    // Resultado mensal pertence exclusivamente ao mês em que o cliente pagou.
    // Vencimento, mês importado e mês_profit não movem um processo pago para outro mês.
    return recebimento ? mesReferenciaFinanceira(recebimento) : ''
  }

  function mesBaseMovimento(item: any) {
    return (
      mesReferenciaFinanceira(item.mes_referencia) ||
      mesReferenciaFinanceira(item.data_pagamento) ||
      mesReferenciaFinanceira(item.data_vencimento) ||
      mesReferenciaFinanceira(item.vencimento) ||
      mesReferenciaFinanceira(item.pagamento) ||
      ''
    )
  }

  function lancamentoAnoPermitido(item: any) {
    return mesFinanceiroPermitido(mesBaseLancamento(item))
  }

  function movimentoAnoPermitido(item: any) {
    return mesFinanceiroPermitido(mesBaseMovimento(item))
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
      return mesAtualFinanceiro()
    }

    const anoAtivo = anoFinanceiroAtivo()
    const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0')
    const mesPadrao = anoAtivo === String(ANO_ATUAL_FINANCEIRO) ? mesAtual : '12'
    return `${anoAtivo}-${mesPadrao}`
  }

  function mesReferenciaFinanceira(valor: any) {
    const bruto = String(valor || '').trim()
    if (!bruto) return ''

    if (/^\d{4}-\d{2}/.test(bruto)) return bruto.slice(0, 7)

    if (/^\d{4}\/\d{2}/.test(bruto)) {
      return bruto.replace('/', '-').slice(0, 7)
    }

    if (/^\d{1,2}\/\d{4}$/.test(bruto)) {
      const [mes, ano] = bruto.split('/')
      return ano + '-' + mes.padStart(2, '0')
    }

    if (/^\d{1,2}-\d{4}$/.test(bruto)) {
      const [mes, ano] = bruto.split('-')
      return ano + '-' + mes.padStart(2, '0')
    }

    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(bruto)) {
      const [, mes, ano] = bruto.split('/')
      return ano + '-' + mes.padStart(2, '0')
    }

    const data = normalizarData(valor)
    return data ? data.slice(0, 7) : ''
  }

  function anoReferenciaFinanceira(valor: any) {
    const mes = mesReferenciaFinanceira(valor)
    return mes ? mes.slice(0, 4) : ''
  }

  function pertenceAoAnoFinanceiroSelecionado(valores: any[]) {
    if (todosAnosFinanceiroAtivo()) return true

    const anoAtivo = anoFinanceiroAtivo()

    return valores
      .map((valor) => anoReferenciaFinanceira(valor))
      .filter(Boolean)
      .includes(anoAtivo)
  }

  function mesDoAnoFinanceiroAtivo(mes: any) {
    return pertenceAoAnoFinanceiroSelecionado([mes])
  }

  function lancamentoAnoSelecionado(item: any) {
    return mesDoAnoFinanceiroAtivo(mesBaseLancamento(item))
  }

  function movimentoAnoSelecionado(item: any) {
    return mesDoAnoFinanceiroAtivo(mesBaseMovimento(item))
  }

  function textoAnosFinanceiroPermitidos() {
    const menorAno = Math.min(...ANOS_FINANCEIRO_PERMITIDOS)
    const maiorAno = Math.max(...ANOS_FINANCEIRO_PERMITIDOS)

    return `${menorAno} a ${maiorAno} ou todos`
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
    const reservasConstituidas = lista
      .filter(
        (item) =>
          statusMovimento(item) === 'PAGO' &&
          ehReservaOperacionalFundo(item)
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const usosDoFundo = lista
      .filter(
        (item) =>
          statusMovimento(item) === 'PAGO' &&
          item.tipo === 'FUNDO_CAIXA_SAIDA' &&
          item.impacta_caixa !== false
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    return Math.max(0, reservasConstituidas - usosDoFundo)
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
    if (dataRecebimentoProcesso(item)) return 'PAGO'

    const vencimento =
      normalizarData(item.vencimento_cobranca) ||
      normalizarData(item.vencimento_cliente) ||
      normalizarData(item.venc_cliente) ||
      normalizarData(item.vencimento) ||
      normalizarData(item.data_vencimento)

    if (vencimento) {
      const hoje = dataHojeFinanceiro()
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
      const hoje = dataHojeFinanceiro()
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
    if (todosAnosFinanceiroAtivo() && filtroMesMovimento.length === 0) return 'Todos os anos'
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
    if (todosAnosFinanceiroAtivo() && valores.length === 0) return 'Todos os meses de todos os anos'
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

  function ehFechamentoDoMes(item: any, mesRef: string) {
    const descricao = normalizarBusca(item.descricao || '')

    return (
      item.tipo === 'FUNDO_CAIXA_ENTRADA' &&
      item.mes_referencia === mesRef &&
      descricao.includes('FECHAMENTO MENSAL') &&
      descricao.includes('RESERVA 50')
    )
  }

  function dataEfetivaMovimentoCaixa(item: any) {
    return (
      normalizarData(item.data_pagamento) ||
      normalizarData(item.data_vencimento) ||
      normalizarData(item.criado_em) ||
      ''
    )
  }

  function ehEntradaRealMovimento(item: any) {
    if (ehReservaOperacionalFundo(item)) return false

    return (
      item.tipo === 'APORTE_SOCIO' ||
      item.tipo === 'FUNDO_CAIXA_ENTRADA' ||
      (item.tipo === 'AJUSTE_CAIXA' && Number(item.valor || 0) > 0)
    )
  }

  function ehSaidaRealMovimento(item: any) {
    if (ehReservaOperacionalFundo(item)) return false

    return (
      ['DESPESA', 'PAGAMENTO_EMPRESTIMO', 'RETIRADA_SOCIO', 'PAGAMENTO_SOCIO', 'REEMBOLSO_SOCIO', 'FUNDO_CAIXA_SAIDA'].includes(item.tipo) ||
      (item.tipo === 'AJUSTE_CAIXA' && Number(item.valor || 0) < 0)
    )
  }

  function saldoBancarioAtualInformado() {
    return contasBancarias.reduce(
      (acc, item) => acc + numero(item.saldo_atual || 0),
      0
    )
  }

  function faturaTransportadoraQuitada(item: any) {
    const situacao = normalizarBusca(item.situacao || '')

    return (
      !!normalizarData(item.data_pagamento) ||
      situacao.includes('PAGO') ||
      situacao.includes('PAGA') ||
      situacao.includes('BAIXADO')
    )
  }

  function faturaTransportadoraCancelada(item: any) {
    return normalizarBusca(item.situacao || '').includes('CANCEL')
  }

  function saldoPendenteFaturaTransportadora(item: any) {
    if (faturaTransportadoraQuitada(item) || faturaTransportadoraCancelada(item)) return 0

    const possuiSaldoInformado =
      item.saldo !== null &&
      item.saldo !== undefined &&
      String(item.saldo).trim() !== ''

    if (possuiSaldoInformado) return Math.max(0, numero(item.saldo))

    return Math.max(
      0,
      numero(item.total || 0) - numero(item.pago_ajustado || 0)
    )
  }

  function compromissosOperacionaisAtuais() {
    const faturasMoedaNaoBRL = faturasTransportadorasCaixa.filter((item) => {
      const moedaFatura = normalizarBusca(item.moeda || 'BRL')
      return (
        saldoPendenteFaturaTransportadora(item) > 0 &&
        moedaFatura !== 'BRL' &&
        moedaFatura !== 'R$' &&
        !moedaFatura.includes('REAL')
      )
    })

    const compromissoTransportadoras = faturasTransportadorasCaixa
      .filter((item) => !faturasMoedaNaoBRL.includes(item))
      .reduce(
        (acc, item) => acc + saldoPendenteFaturaTransportadora(item),
        0
      )

    const compromissoTerceiros = lancamentos
      .filter((item) => statusCobranca(item) === 'PAGO')
      .filter(
        (item) =>
          numero(item.debito_terceiro || 0) > 0 &&
          normalizarBusca(item.pgta_terceiros || '') !== 'PAGO'
      )
      .reduce((acc, item) => acc + numero(item.debito_terceiro || 0), 0)

    return {
      compromissoTransportadoras,
      compromissoTerceiros,
      total: compromissoTransportadoras + compromissoTerceiros,
      qtdFaturasMoedaNaoBRL: faturasMoedaNaoBRL.length,
      dadosConfiaveis:
        !loadingCompromissosCaixa &&
        !erroCompromissosCaixa &&
        faturasMoedaNaoBRL.length === 0,
    }
  }

  function reservaConstituidaAtual() {
    const reservasDepoisDaBase = movimentacoes
      .filter(
        (item) =>
          statusMovimento(item) === 'PAGO' &&
          ehReservaOperacionalFundo(item) &&
          dataEfetivaMovimentoCaixa(item) > DATA_BASE_CONCILIACAO
      )
      .reduce((acc, item) => acc + numero(item.valor || 0), 0)

    const usosDepoisDaBase = movimentacoes
      .filter(
        (item) =>
          statusMovimento(item) === 'PAGO' &&
          item.tipo === 'FUNDO_CAIXA_SAIDA' &&
          item.impacta_caixa !== false &&
          dataEfetivaMovimentoCaixa(item) > DATA_BASE_CONCILIACAO
      )
      .reduce((acc, item) => acc + numero(item.valor || 0), 0)

    // Em 17/08/2026 foi confirmado que o saldo bancário existente não
    // representava reserva física. A reserva protegida parte de R$ 0,00.
    return Math.max(0, reservasDepoisDaBase - usosDepoisDaBase)
  }

  function caixaLivreAtualInformado() {
    const saldoBancario = saldoBancarioAtualInformado()
    const compromissos = compromissosOperacionaisAtuais()

    // Se os compromissos não puderem ser lidos com segurança, não libera
    // dinheiro para constituir reserva.
    if (!compromissos.dadosConfiaveis) return 0

    const reservaConstituida = reservaConstituidaAtual()
    const saldoAposCompromissos = Math.max(
      0,
      saldoBancario - compromissos.total
    )
    const reservaProtegida = Math.min(
      saldoAposCompromissos,
      Math.max(reservaConstituida, 0)
    )

    return Math.max(0, saldoAposCompromissos - reservaProtegida)
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
    await Promise.all([
      carregarFinanceiro(),
      carregarMovimentacoes(),
      carregarContasBancarias(),
      carregarCompromissosCaixa(),
    ])
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

    setLancamentos(
      todos.sort((a, b) => {
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

    setMovimentacoes((data || []) as any[])
    setPaginaMovimentos(1)
    setLoadingMovimentos(false)
  }


  async function carregarContasBancarias() {
    setLoadingContasBancarias(true)
    setErroContasBancarias('')

    const { data, error } = await supabase
      .from('financeiro_contas_bancarias')
      .select('*')
      .eq('ativo', true)
      .order('banco', { ascending: true })
      .order('nome_conta', { ascending: true })

    if (error) {
      console.error('Erro ao carregar contas bancárias:', error)
      setContasBancarias([])
      setErroContasBancarias(error.message)
      setLoadingContasBancarias(false)
      return
    }

    setContasBancarias(data || [])
    setLoadingContasBancarias(false)
  }

  async function carregarCompromissosCaixa() {
    setLoadingCompromissosCaixa(true)
    setErroCompromissosCaixa('')

    const { data, error } = await supabase
      .from('faturas_transportadoras')
      .select(
        'id, transportadora, numero_fatura, vencimento, data_pagamento, situacao, total, pago_ajustado, saldo, moeda, arquivada'
      )
      .order('vencimento', { ascending: true, nullsFirst: false })

    if (error) {
      console.error('Erro ao carregar compromissos das transportadoras:', error)
      setFaturasTransportadorasCaixa([])
      setErroCompromissosCaixa(error.message)
      setLoadingCompromissosCaixa(false)
      return
    }

    setFaturasTransportadorasCaixa(data || [])
    setLoadingCompromissosCaixa(false)
  }

  function limparFormContaBancaria() {
    setFormContaBancaria({ banco: '', nome_conta: '', saldo_atual: '' })
    setEditandoContaBancariaId(null)
  }

  function editarContaBancaria(item: any) {
    setEditandoContaBancariaId(item.id)
    setFormContaBancaria({
      banco: item.banco || '',
      nome_conta: item.nome_conta || '',
      saldo_atual: formatarValorParaForm(item.saldo_atual),
    })
  }

  async function salvarContaBancaria() {
    const banco = String(formContaBancaria.banco || '').trim()
    const nomeConta = String(formContaBancaria.nome_conta || '').trim()
    const saldo = numero(formContaBancaria.saldo_atual)

    if (!banco) {
      alert('Informe o banco.')
      return
    }

    if (!nomeConta) {
      alert('Informe um nome para identificar a conta.')
      return
    }

    setSalvandoContaBancaria(true)

    const payload = {
      banco,
      nome_conta: nomeConta,
      saldo_atual: saldo,
      data_referencia: dataHojeFinanceiro(),
      ativo: true,
      atualizado_em: new Date().toISOString(),
    }

    const consulta = editandoContaBancariaId
      ? supabase.from('financeiro_contas_bancarias').update(payload).eq('id', editandoContaBancariaId)
      : supabase.from('financeiro_contas_bancarias').insert(payload)

    const { error } = await consulta

    if (error) {
      alert('Erro ao salvar saldo bancário: ' + error.message)
      setSalvandoContaBancaria(false)
      return
    }

    await carregarContasBancarias()
    limparFormContaBancaria()
    setSalvandoContaBancaria(false)
  }

  async function arquivarContaBancaria(item: any) {
    if (!confirm(`Remover ${item.banco} - ${item.nome_conta} da conciliação bancária?`)) return

    const { error } = await supabase
      .from('financeiro_contas_bancarias')
      .update({ ativo: false, atualizado_em: new Date().toISOString() })
      .eq('id', item.id)

    if (error) {
      alert('Erro ao remover conta bancária: ' + error.message)
      return
    }

    if (editandoContaBancariaId === item.id) limparFormContaBancaria()
    await carregarContasBancarias()
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
      mes_profit:
        mesReferenciaFinanceira(form.recebimento) ||
        mesReferenciaFinanceira(form.mes_profit) ||
        mesReferenciaFinanceira(form.mes),
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
      mes_referencia: item.mes_referencia || mesAtualFinanceiro(),
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

    return mesAtualFinanceiro()
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

  function chaveProcessoImportado(item: any) {
    const awb = normalizarBusca(item.awb || '')
    const fatura = normalizarBusca(item.fatura || '')

    if (awb) return `AWB|${awb}`
    if (fatura) return `FATURA|${fatura}`

    return [
      'SEM_REFERENCIA',
      normalizarBusca(item.cliente || ''),
      Number(item.valor_cobranca || 0).toFixed(2),
      normalizarData(item.vencimento_cobranca) || '',
      normalizarData(item.recebimento) || '',
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
          mes_profit: mesReferenciaFinanceira(linha['RECEBIMENTO_CLIENTE']),
          atualizado_em: new Date().toISOString(),
        }))
        .filter((item) => item.awb || item.cliente || item.valor_cobranca > 0)

      if (registros.length === 0) {
        alert('Nenhuma linha válida encontrada no Excel.')
        setImportando(false)
        return
      }

      const chaves = new Set(
        lancamentos.map((item) => chaveProcessoImportado(item))
      )
      const registrosUnicos: any[] = []
      let duplicados = 0

      registros.forEach((item) => {
        const chave = chaveProcessoImportado(item)

        if (chaves.has(chave)) {
          duplicados += 1
          return
        }

        chaves.add(chave)
        registrosUnicos.push(item)
      })

      if (registrosUnicos.length === 0) {
        alert(
          `Nenhum processo novo foi importado. ${duplicados} duplicados foram ignorados.`
        )
        setImportando(false)
        event.target.value = ''
        return
      }

      for (let i = 0; i < registrosUnicos.length; i += 500) {
        const lote = registrosUnicos.slice(i, i + 500)

        const { error } = await supabase.from('financeiro_embarques').insert(lote)

        if (error) {
          alert('Erro ao importar lote: ' + error.message)
          setImportando(false)
          return
        }
      }

      alert(
        `Importação concluída: ${registrosUnicos.length} lançamentos importados.` +
          (duplicados > 0 ? ` ${duplicados} duplicados foram ignorados.` : '')
      )
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
      categoria: tipo === 'FUNDO_CAIXA_ENTRADA' ? 'Entrada extraordinária' : 'Uso do fundo',
      impacta_resultado: false,
      impacta_caixa: true,
    })
    setEditandoMovimentoId(null)
  }




  function gerarPDFFechamentoMensal() {
    if (!mesResultado) {
      alert('Selecione o mês do resultado antes de gerar o relatório completo.')
      return
    }

    function textoPdf(valor: any) {
      return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
    }

    function numeroPdf(valor: any) {
      if (valor === null || valor === undefined || valor === '') return 0
      if (typeof valor === 'number') return valor

      const limpo = String(valor)
        .replace(/[R$USD\s]/gi, '')
        .replace(/\./g, '')
        .replace(',', '.')

      return Number(limpo) || 0
    }

    function dataPdf(valor: any) {
      const bruto = String(valor || '').trim()
      if (!bruto) return '-'

      if (/^\d{4}-\d{2}-\d{2}/.test(bruto)) {
        const [ano, mes, dia] = bruto.slice(0, 10).split('-')
        return dia + '/' + mes + '/' + ano
      }

      return bruto
    }

    function mesProcessoPdf(item: any) {
      return mesResultadoLancamento(item)
    }

    function mesMovimentoPdf(item: any) {
      return mesBaseMovimento(item)
    }

    function valorCobrancaPdf(item: any) {
      return numeroPdf(item.valor_cobranca || item.valor_faturado || item.valor_venda || item.valor)
    }

    function valorCompraPdf(item: any) {
      return numeroPdf(item.valor_compra || item.custo_compra || item.custo)
    }

    function docDtaPdf(item: any) {
      return numeroPdf(item.doc_dta || item.dta_doc || item.impostos || item.taxas)
    }

    function debitoTerceiroPdf(item: any) {
      return numeroPdf(item.debito_terceiro || item.terceiros || item.profit_terceiros || item.valor_terceiros)
    }

    function profitPdf(item: any) {
      if (valorCompraPdf(item) <= 0) return 0
      return valorCobrancaPdf(item) - docDtaPdf(item) - debitoTerceiroPdf(item) - valorCompraPdf(item)
    }

    function tipoMovimentoLabel(tipo: any) {
      const mapa: Record<string, string> = {
        DESPESA: 'Despesa',
        PAGAMENTO_EMPRESTIMO: 'Pagamento empréstimo',
        RETIRADA_SOCIO: 'Retirada sócio',
        PAGAMENTO_SOCIO: 'Pagamento sócio',
        REEMBOLSO_SOCIO: 'Reembolso sócio',
        APORTE_SOCIO: 'Aporte sócio',
        FUNDO_CAIXA_ENTRADA: 'Entrada extraordinária / reserva',
        FUNDO_CAIXA_SAIDA: 'Saída extraordinária / uso da reserva',
        AJUSTE_CAIXA: 'Ajuste caixa',
      }

      return mapa[String(tipo || '')] || String(tipo || '-')
    }

    function linhaResumo(label: string, valor: any) {
      return `
        <tr>
          <td>${textoPdf(label)}</td>
          <td class="valor">${textoPdf(valor)}</td>
        </tr>
      `
    }

    function tabela(headers: string[], rows: string[][], vazio: string) {
      if (rows.length === 0) {
        return `<p class="vazio">${textoPdf(vazio)}</p>`
      }

      return `
        <table>
          <thead>
            <tr>
              ${headers.map((h) => `<th>${textoPdf(h)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `
                  <tr>
                    ${row.map((cell) => `<td>${textoPdf(cell)}</td>`).join('')}
                  </tr>
                `
              )
              .join('')}
          </tbody>
        </table>
      `
    }

    const processosMes = lancamentos
      .filter((item) => mesProcessoPdf(item) === mesResultado)
      .sort((a, b) => {
        const clienteA = String(a.cliente || a.nome_cliente || '')
        const clienteB = String(b.cliente || b.nome_cliente || '')
        return clienteA.localeCompare(clienteB, 'pt-BR')
      })

    const processosPagosMes = processosMes.filter(
      (item) => statusCobranca(item) === 'PAGO'
    )

    const processosPendentesMes = processosMes.filter(
      (item) => statusCobranca(item) !== 'PAGO'
    )

    const processosSemCustoMes = processosMes.filter(aguardandoCustoProcesso)

    const movimentosMes = movimentacoes
      .filter((item) => mesMovimentoPdf(item) === mesResultado)
      .sort((a, b) =>
        String(a.data_pagamento || a.data_vencimento || '').localeCompare(
          String(b.data_pagamento || b.data_vencimento || '')
        )
      )

    const despesasMes = movimentosMes.filter((item) =>
      ['DESPESA', 'PAGAMENTO_EMPRESTIMO'].includes(item.tipo)
    )

    const retiradasMes = movimentosMes.filter((item) =>
      ['RETIRADA_SOCIO', 'PAGAMENTO_SOCIO', 'REEMBOLSO_SOCIO'].includes(item.tipo)
    )

    const reservasMes = movimentosMes.filter(
      (item) => ehReservaOperacionalFundo(item)
    )

    const entradasMes = movimentosMes.filter(
      (item) =>
        !ehReservaOperacionalFundo(item) &&
        (
          ['APORTE_SOCIO', 'FUNDO_CAIXA_ENTRADA'].includes(item.tipo) ||
          (item.tipo === 'AJUSTE_CAIXA' && numeroPdf(item.valor) >= 0)
        )
    )

    const saidasFundoMes = movimentosMes.filter(
      (item) =>
        item.tipo === 'FUNDO_CAIXA_SAIDA' ||
        (item.tipo === 'AJUSTE_CAIXA' && numeroPdf(item.valor) < 0)
    )

    const saldoFundoPrevisto = Number((resultadoGeral.saldoFundoMes || 0).toFixed(2))
    const caixaLivreAtual = Number(caixaLivreAtualInformado().toFixed(2))
    const valorReservaReal = Number(Math.min(Math.max(saldoFundoPrevisto, 0), caixaLivreAtual).toFixed(2))
    const saldoPendenteFundo = Number(Math.max(0, saldoFundoPrevisto - valorReservaReal).toFixed(2))

    const totalProcessos = processosMes.reduce((acc, item) => acc + valorCobrancaPdf(item), 0)
    const totalRecebido = processosPagosMes.reduce((acc, item) => acc + valorCobrancaPdf(item), 0)
    const totalPendenteReceber = processosPendentesMes.reduce((acc, item) => acc + valorCobrancaPdf(item), 0)
    const totalDocDta = processosMes.reduce((acc, item) => acc + docDtaPdf(item), 0)
    const totalTerceiros = processosMes.reduce((acc, item) => acc + debitoTerceiroPdf(item), 0)
    const totalCompra = processosMes.reduce((acc, item) => acc + valorCompraPdf(item), 0)
    const totalProfit = processosPagosMes.reduce((acc, item) => acc + profitPdf(item), 0)

    function valorMovimentoPdf(item: any) {
      return Math.abs(numeroPdf(item.valor))
    }

    function totalMovimentosPagos(lista: any[]) {
      return lista
        .filter((item) => statusMovimento(item) === 'PAGO')
        .reduce((acc, item) => acc + valorMovimentoPdf(item), 0)
    }

    function totalMovimentosPendentes(lista: any[]) {
      return lista
        .filter((item) => statusMovimento(item) !== 'PAGO')
        .reduce((acc, item) => acc + valorMovimentoPdf(item), 0)
    }

    const totalDespesasPagas = totalMovimentosPagos(despesasMes)
    const totalDespesasPendentes = totalMovimentosPendentes(despesasMes)
    const totalRetiradasPagas = totalMovimentosPagos(retiradasMes)
    const totalRetiradasPendentes = totalMovimentosPendentes(retiradasMes)
    const totalEntradasRealizadas = totalMovimentosPagos(entradasMes)
    const totalEntradasPendentes = totalMovimentosPendentes(entradasMes)
    const totalReservasConstituidas = totalMovimentosPagos(reservasMes)
    const totalSaidasFundoPagas = totalMovimentosPagos(saidasFundoMes)
    const totalSaidasFundoPendentes = totalMovimentosPendentes(saidasFundoMes)

    const linhasProcessos = processosMes.map((item) => [
      String(item.cliente || item.nome_cliente || item.razao_social || '-'),
      String(item.awb || item.numero_awb || '-'),
      String(item.fatura || item.numero_fatura || '-'),
      String(item.transportadora || '-'),
      String(item.servico || item.tipo_servico || '-'),
      moeda(valorCobrancaPdf(item)),
      moeda(docDtaPdf(item)),
      moeda(debitoTerceiroPdf(item)),
      valorCompraPdf(item) > 0 ? moeda(valorCompraPdf(item)) : 'Aguardando custo',
      statusCobranca(item) === 'PAGO'
        ? valorCompraPdf(item) > 0
          ? moeda(profitPdf(item))
          : 'Aguardando custo'
        : 'Não realizado',
      dataPdf(item.vencimento_cobranca || item.vencimento_cliente),
      dataPdf(dataRecebimentoProcesso(item) || item.vencimento_cobranca),
      statusCobranca(item),
    ])

    function linhaMovimento(item: any) {
      return [
        dataPdf(item.data_pagamento || item.data_vencimento),
        tipoMovimentoLabel(item.tipo),
        String(item.categoria || '-'),
        String(item.descricao || '-'),
        String(item.socio || '-'),
        moeda(valorMovimentoPdf(item)),
        statusMovimento(item),
        String(item.forma_pagamento || '-'),
        item.impacta_resultado !== false ? 'Sim' : 'Não',
        item.impacta_caixa !== false ? 'Sim' : 'Não',
      ]
    }

    const linhasDespesas = despesasMes.map(linhaMovimento)
    const linhasRetiradas = retiradasMes.map(linhaMovimento)
    const linhasEntradas = entradasMes.map(linhaMovimento)
    const linhasReservas = reservasMes.map(linhaMovimento)
    const linhasSaidasFundo = saidasFundoMes.map(linhaMovimento)

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Relatório financeiro completo - ${textoPdf(mesResultado)}</title>
          <style>
            @page { size: A4 landscape; margin: 12mm; }
            body {
              font-family: Arial, sans-serif;
              color: #111827;
              font-size: 11px;
              line-height: 1.35;
            }
            h1, h2, h3 { margin: 0; }
            h1 { font-size: 22px; }
            h2 {
              font-size: 15px;
              margin-top: 18px;
              margin-bottom: 8px;
              border-bottom: 2px solid #1d4ed8;
              padding-bottom: 5px;
              color: #1e3a8a;
            }
            .topo {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 3px solid #1d4ed8;
              padding-bottom: 12px;
              margin-bottom: 12px;
            }
            .empresa {
              font-size: 12px;
              color: #475569;
              margin-top: 4px;
            }
            .data {
              text-align: right;
              font-size: 11px;
              color: #475569;
            }
            .cards {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              margin: 12px 0;
            }
            .card {
              border: 1px solid #dbeafe;
              background: #eff6ff;
              border-radius: 8px;
              padding: 8px;
            }
            .card strong {
              display: block;
              color: #1e3a8a;
              font-size: 10px;
              text-transform: uppercase;
            }
            .card span {
              display: block;
              margin-top: 4px;
              font-size: 15px;
              font-weight: 800;
            }
            .negativo { color: #b91c1c; }
            .positivo { color: #047857; }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 6px;
              page-break-inside: auto;
            }
            th {
              background: #1e3a8a;
              color: white;
              text-align: left;
              padding: 6px;
              font-size: 9px;
            }
            td {
              border: 1px solid #e5e7eb;
              padding: 5px;
              vertical-align: top;
              font-size: 9px;
            }
            tbody tr:nth-child(even) { background: #f8fafc; }
            tr { page-break-inside: avoid; }
            h2 { page-break-after: avoid; }
            .valor { text-align: right; font-weight: 700; }
            .resumo td:first-child { font-weight: 700; color: #374151; }
            .resumo td:last-child { text-align: right; font-weight: 800; }
            .vazio {
              border: 1px dashed #cbd5e1;
              padding: 10px;
              border-radius: 8px;
              color: #64748b;
            }
            .alerta {
              background: #fff7ed;
              border: 1px solid #fed7aa;
              color: #9a3412;
              padding: 10px;
              border-radius: 8px;
              margin-top: 10px;
              font-weight: 700;
            }
            .assinatura {
              margin-top: 24px;
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
            }
            .linha-assinatura {
              border-top: 1px solid #111827;
              padding-top: 6px;
              text-align: center;
              color: #374151;
            }
          </style>
        </head>

        <body>
          <div class="topo">
            <div>
              <h1>Relatório financeiro mensal completo</h1>
              <p class="empresa">Couto e Otero Intermediação LTDA</p>
              <p class="empresa">Mês de referência: <strong>${textoPdf(mesResultado)}</strong></p>
            </div>
            <div class="data">
              Gerado em: ${new Date().toLocaleString('pt-BR', { timeZone: FUSO_FINANCEIRO })}<br/>
              Relatório financeiro interno
            </div>
          </div>

          <div class="cards">
            <div class="card"><strong>Valor recebido</strong><span>${moeda(resultadoGeral.valorRecebido)}</span></div>
            <div class="card"><strong>Profit HC recebido</strong><span>${moeda(resultadoGeral.profitRecebido)}</span></div>
            <div class="card"><strong>Resultado operacional</strong><span class="${resultadoGeral.resultadoOperacional >= 0 ? 'positivo' : 'negativo'}">${moeda(resultadoGeral.resultadoOperacional)}</span></div>
            <div class="card"><strong>Saldo líquido da competência</strong><span class="${resultadoGeral.saldoCaixaRealMes >= 0 ? 'positivo' : 'negativo'}">${moeda(resultadoGeral.saldoCaixaRealMes)}</span></div>
          </div>

          <h2>1. Resumo do fechamento</h2>
          <table class="resumo">
            <tbody>
              ${linhaResumo('Quantidade total de processos', processosMes.length)}
              ${linhaResumo('Processos pagos', processosPagosMes.length)}
              ${linhaResumo('Processos pendentes/atrasados', processosPendentesMes.length)}
              ${linhaResumo('Processos aguardando custo', processosSemCustoMes.length)}
              ${linhaResumo('Valor total faturado no período', moeda(totalProcessos))}
              ${linhaResumo('Valor recebido de clientes', moeda(resultadoGeral.valorRecebido))}
              ${linhaResumo('Valor pendente de recebimento', moeda(totalPendenteReceber))}
              ${linhaResumo('Profit HC recebido', moeda(resultadoGeral.profitRecebido))}
              ${linhaResumo('Despesas pagas', moeda(resultadoGeral.despesasPagas))}
              ${linhaResumo('Despesas/empréstimos pendentes', moeda(totalDespesasPendentes))}
              ${linhaResumo('Empréstimos pagos', moeda(resultadoGeral.emprestimosPagos))}
              ${linhaResumo('Resultado operacional', moeda(resultadoGeral.resultadoOperacional))}
              ${linhaResumo('Retiradas realizadas', moeda(totalRetiradasPagas))}
              ${linhaResumo('Retiradas pendentes', moeda(totalRetiradasPendentes))}
              ${linhaResumo('Entradas extras de caixa', moeda(resultadoGeral.entradasCaixaMes))}
              ${linhaResumo('Reservas constituídas na competência', moeda(totalReservasConstituidas))}
              ${linhaResumo('Ajustes negativos de caixa', moeda(resultadoGeral.ajustesNegativosMes))}
              ${linhaResumo('Saídas do fundo realizadas', moeda(totalSaidasFundoPagas))}
              ${linhaResumo('Saídas totais de caixa', moeda(resultadoGeral.saidasCaixaMes))}
              ${linhaResumo('Retiradas Marcos', moeda(resultadoGeral.retiradasMarcos))}
              ${linhaResumo('Retiradas Hérica', moeda(resultadoGeral.retiradasHerica))}
              ${linhaResumo('Total retirado pelos sócios', moeda(resultadoGeral.retiradasTotal))}
              ${linhaResumo('Saldo líquido da competência após entradas e saídas reais', moeda(resultadoGeral.saldoCaixaRealMes))}
              ${linhaResumo('Fundo previsto 50%', moeda(resultadoGeral.fundoPrevistoMes))}
              ${linhaResumo('Já reservado no fundo', moeda(resultadoGeral.reservasFundoMes))}
              ${linhaResumo('Caixa livre atual nos bancos', moeda(caixaLivreAtual))}
              ${linhaResumo('Reserva que pode ser constituída agora', moeda(valorReservaReal))}
              ${linhaResumo('Reserva pendente da competência', moeda(saldoPendenteFundo))}
              ${linhaResumo('Parte Marcos 25%', moeda(resultadoGeral.parteMarcos))}
              ${linhaResumo('Saldo Marcos', moeda(resultadoGeral.saldoMarcos))}
              ${linhaResumo('Parte Hérica 25%', moeda(resultadoGeral.parteHerica))}
              ${linhaResumo('Saldo Hérica', moeda(resultadoGeral.saldoHerica))}
            </tbody>
          </table>

          ${caixaLivreAtual <= 0 && saldoPendenteFundo > 0
            ? `<div class="alerta">Atenção: a competência possui reserva pendente, mas não há caixa livre atual disponível nos saldos bancários informados. O valor de ${moeda(saldoPendenteFundo)} permanece pendente e poderá ser constituído em outra data sem alterar a competência.</div>`
            : ''
          }

          <h2>2. Todos os processos do mês</h2>
          <p>
            <strong>Processos:</strong> ${processosMes.length} |
            <strong>Pagos:</strong> ${processosPagosMes.length} |
            <strong>Pendentes/atrasados:</strong> ${processosPendentesMes.length} |
            <strong>Aguardando custo:</strong> ${processosSemCustoMes.length}<br/>
            <strong>Total faturado:</strong> ${moeda(totalProcessos)} |
            <strong>Total recebido:</strong> ${moeda(totalRecebido)} |
            <strong>Pendente de recebimento:</strong> ${moeda(totalPendenteReceber)} |
            <strong>DOC/DTA/Impostos:</strong> ${moeda(totalDocDta)} |
            <strong>Terceiros:</strong> ${moeda(totalTerceiros)} |
            <strong>Valor compra:</strong> ${moeda(totalCompra)} |
            <strong>Profit realizado:</strong> ${moeda(totalProfit)}
          </p>
          ${tabela(
            ['Cliente', 'AWB', 'Fatura', 'Transp.', 'Serviço', 'Valor', 'DOC/DTA', 'Terceiros', 'Compra', 'Profit HC', 'Vencimento', 'Recebimento', 'Status'],
            linhasProcessos,
            'Nenhum processo encontrado para este mês.'
          )}

          <h2>3. Despesas e empréstimos</h2>
          <p><strong>Pagos:</strong> ${moeda(totalDespesasPagas)} | <strong>Pendentes/vencidos:</strong> ${moeda(totalDespesasPendentes)}</p>
          ${tabela(
            ['Data', 'Tipo', 'Categoria', 'Descrição', 'Sócio', 'Valor', 'Status', 'Forma', 'Resultado', 'Caixa'],
            linhasDespesas,
            'Nenhuma despesa ou empréstimo encontrado para este mês.'
          )}

          <h2>4. Retiradas e pagamentos dos sócios</h2>
          <p><strong>Realizados:</strong> ${moeda(totalRetiradasPagas)} | <strong>Pendentes/vencidos:</strong> ${moeda(totalRetiradasPendentes)}</p>
          ${tabela(
            ['Data', 'Tipo', 'Categoria', 'Descrição', 'Sócio', 'Valor', 'Status', 'Forma', 'Resultado', 'Caixa'],
            linhasRetiradas,
            'Nenhuma retirada ou pagamento de sócio encontrado para este mês.'
          )}

          <h2>5. Entradas e aportes reais</h2>
          <p><strong>Realizados:</strong> ${moeda(totalEntradasRealizadas)} | <strong>Pendentes/vencidos:</strong> ${moeda(totalEntradasPendentes)}</p>
          ${tabela(
            ['Data', 'Tipo', 'Categoria', 'Descrição', 'Sócio', 'Valor', 'Status', 'Forma', 'Resultado', 'Caixa'],
            linhasEntradas,
            'Nenhuma entrada real ou aporte encontrado para este mês.'
          )}

          <h2>6. Reservas da competência</h2>
          <p><strong>Reserva constituída:</strong> ${moeda(totalReservasConstituidas)}. Reserva é destinação do saldo existente e não entrada de caixa.</p>
          ${tabela(
            ['Data de constituição', 'Tipo', 'Categoria', 'Descrição', 'Sócio', 'Valor', 'Status', 'Forma', 'Resultado', 'Caixa'],
            linhasReservas,
            'Nenhuma reserva constituída encontrada para esta competência.'
          )}

          <h2>7. Saídas e ajustes do fundo/caixa</h2>
          <p><strong>Realizados:</strong> ${moeda(totalSaidasFundoPagas)} | <strong>Pendentes/vencidos:</strong> ${moeda(totalSaidasFundoPendentes)}</p>
          ${tabela(
            ['Data', 'Tipo', 'Categoria', 'Descrição', 'Sócio', 'Valor', 'Status', 'Forma', 'Resultado', 'Caixa'],
            linhasSaidasFundo,
            'Nenhuma saída ou ajuste negativo do fundo encontrado para este mês.'
          )}

          <h2>8. Conclusão</h2>
          <table class="resumo">
            <tbody>
              ${linhaResumo('Resultado operacional do mês', moeda(resultadoGeral.resultadoOperacional))}
              ${linhaResumo('Saldo líquido da competência', moeda(resultadoGeral.saldoCaixaRealMes))}
              ${linhaResumo('Caixa livre atual', moeda(caixaLivreAtual))}
              ${linhaResumo('Reserva recomendada para constituir agora', moeda(valorReservaReal))}
              ${linhaResumo('Reserva pendente da competência', moeda(saldoPendenteFundo))}
            </tbody>
          </table>

          <div class="assinatura">
            <div class="linha-assinatura">Marcos Paulo Otero<br/>Diretor Financeiro</div>
            <div class="linha-assinatura">Hérica Couto<br/>Diretora Operacional</div>
          </div>
        </body>
      </html>
    `

    const janela = window.open('', '_blank')

    if (!janela) {
      alert('O navegador bloqueou a janela do PDF. Libere pop-ups para o portal e tente novamente.')
      return
    }

    janela.document.open()
    janela.document.write(html)
    janela.document.close()

    setTimeout(() => {
      janela.focus()
      janela.print()
    }, 500)
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

    if (loadingCompromissosCaixa) {
      alert('Aguarde a leitura das obrigações atuais antes de constituir a reserva.')
      return
    }

    if (erroCompromissosCaixa) {
      alert(
        'Não foi possível validar as obrigações atuais da HC. A reserva não será constituída até a leitura das faturas DHL/FedEx voltar a funcionar.\n\n' +
          erroCompromissosCaixa
      )
      return
    }

    const compromissosAtuais = compromissosOperacionaisAtuais()

    if (compromissosAtuais.qtdFaturasMoedaNaoBRL > 0) {
      alert('Existem faturas de transportadora em moeda diferente de BRL. Converta/revise essas obrigações antes de constituir nova reserva.')
      return
    }

    const saldoFundoPrevisto = Number((resultadoGeral.saldoFundoMes || 0).toFixed(2))
    const caixaLivreAtual = Number(caixaLivreAtualInformado().toFixed(2))
    const valorReserva = Number(Math.min(Math.max(saldoFundoPrevisto, 0), caixaLivreAtual).toFixed(2))
    const saldoPendenteFundo = Number(Math.max(0, saldoFundoPrevisto - valorReserva).toFixed(2))

    if (saldoFundoPrevisto <= 0) {
      alert('O fundo de caixa deste mês já está reservado ou foi reservado acima dos 50%.')
      return
    }

    const fechamentoJaLancado = movimentacoes.find((item) =>
      ehFechamentoDoMes(item, mesResultado)
    )

    if (fechamentoJaLancado && valorReserva <= 0) {
      alert(
        'O mês já possui fechamento e não existe valor disponível para complementar agora. ' +
          `O saldo ainda pendente do fundo é ${moeda(saldoPendenteFundo)}.`
      )
      return
    }

    const fechamentoParcial = resultadoGeral.semCusto > 0

    const referenciasComCusto = resultadoGeral.processosComCustoDetalhados
      .map((item: any) => item.awb || item.fatura || item.id)
      .filter(Boolean)
      .join(', ')

    const referenciasSemCusto = resultadoGeral.processosSemCustoDetalhados
      .map((item: any) => item.awb || item.fatura || item.id)
      .filter(Boolean)
      .join(', ')

    const descricaoFechamento = fechamentoJaLancado
      ? `Complemento do fechamento mensal - reserva 50% ${mesResultado}`
      : `Fechamento mensal${fechamentoParcial ? ' parcial' : ''} - reserva 50% ${mesResultado}${valorReserva > 0 ? '' : ' - sem caixa para reserva real'}`

    const alertaCusto =
      fechamentoParcial
        ? `\n\nATENÇÃO: ${resultadoGeral.semCusto} processo(s) recebido(s) ainda estão sem valor de compra e NÃO entram no Profit agora. ` +
          `Este fechamento ficará parcial e poderá ser complementado quando os custos forem lançados.\n` +
          `Aguardando custo: ${referenciasSemCusto || 'sem referência'}.`
        : ''

    const mensagem =
      `${fechamentoJaLancado ? 'Complementar' : 'Gerar'} fechamento de ${formatarMesVisual(mesResultado)}?\n\n` +
      `Processos recebidos: ${resultadoGeral.processos}\n` +
      `Com custo: ${resultadoGeral.comCusto}\n` +
      `Aguardando custo: ${resultadoGeral.semCusto}\n` +
      `Valor recebido: ${moeda(resultadoGeral.valorRecebido)}\n` +
      `Profit apurado: ${moeda(resultadoGeral.profitRecebido)}\n` +
      `Despesas + empréstimos: ${moeda(resultadoGeral.despesasPagas + resultadoGeral.emprestimosPagos)}\n` +
      `Lucro líquido: ${moeda(resultadoGeral.resultadoOperacional)}\n` +
      alertaCusto +
      `\n\nRetiradas dos sócios: ${moeda(resultadoGeral.retiradasTotal)}\n` +
      `Saldo líquido da competência: ${moeda(resultadoGeral.saldoCaixaRealMes)}\n` +
      `Compromissos operacionais identificados: ${moeda(compromissosAtuais.total)}\n` +
      `Caixa livre atual após compromissos e reserva protegida: ${moeda(caixaLivreAtual)}\n\n` +
      `Fundo previsto 50%: ${moeda(resultadoGeral.fundoPrevistoMes)}\n` +
      `Já constituído para esta competência: ${moeda(resultadoGeral.reservasFundoMes)}\n` +
      `Reserva que será constituída agora: ${moeda(valorReserva)}\n` +
      `Reserva pendente da competência: ${moeda(saldoPendenteFundo)}\n\n` +
      (
        valorReserva <= 0
          ? 'ATENÇÃO: a competência ficará registrada sem nova reserva agora porque não existe caixa livre atual suficiente. A pendência poderá ser constituída em outra data, mantendo esta competência.\n\n'
          : ''
      ) +
      `Parte Marcos 25%: ${moeda(resultadoGeral.parteMarcos)}\n` +
      `Parte Hérica 25%: ${moeda(resultadoGeral.parteHerica)}`

    if (!confirm(mensagem)) return

    setGerandoFechamento(true)

    const hoje = dataHojeFinanceiro()

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
      forma_pagamento: fechamentoJaLancado
        ? 'Complemento automático'
        : fechamentoParcial
          ? 'Fechamento parcial automático'
          : 'Fechamento automático',
      impacta_resultado: false,
      impacta_caixa: false,
      observacoes:
        `${fechamentoJaLancado ? 'Complemento do fechamento' : fechamentoParcial ? 'Fechamento parcial' : 'Fechamento'} gerado pelo Resultado Mensal. ` +
        `Mês de competência pelo recebimento: ${mesResultado}. ` +
        `Processos recebidos: ${resultadoGeral.processos}. ` +
        `Com custo: ${resultadoGeral.comCusto}. ` +
        `Aguardando custo: ${resultadoGeral.semCusto}. ` +
        `Valor recebido: ${moeda(resultadoGeral.valorRecebido)}. ` +
        `Profit HC apurado: ${moeda(resultadoGeral.profitRecebido)}. ` +
        `Despesas pagas: ${moeda(resultadoGeral.despesasPagas)}. ` +
        `Empréstimos pagos: ${moeda(resultadoGeral.emprestimosPagos)}. ` +
        `Lucro líquido: ${moeda(resultadoGeral.resultadoOperacional)}. ` +
        `Fundo 50%: ${moeda(resultadoGeral.fundoPrevistoMes)}. ` +
        `Marcos 25%: ${moeda(resultadoGeral.parteMarcos)}. ` +
        `Hérica 25%: ${moeda(resultadoGeral.parteHerica)}. ` +
        `Retirado Marcos: ${moeda(resultadoGeral.retiradasMarcos)}. ` +
        `Retirado Hérica: ${moeda(resultadoGeral.retiradasHerica)}. ` +
        `Referências com custo: ${referenciasComCusto || 'nenhuma'}. ` +
        `Referências aguardando custo: ${referenciasSemCusto || 'nenhuma'}. ` +
        `Data de constituição da reserva: ${hoje}. A reserva é destinação do saldo existente e não representa entrada de caixa.`,
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

    alert(
      fechamentoJaLancado
        ? 'Complemento do fechamento gerado com sucesso. A reserva foi constituída sem criar entrada de caixa.'
        : fechamentoParcial
          ? 'Fechamento parcial gerado. Os processos sem custo ficaram registrados para complemento posterior.'
          : 'Fechamento mensal gerado com sucesso. A reserva foi constituída como destinação do saldo existente, sem criar entrada de caixa.'
    )
  }


  function ultimoDiaDoMes(mesRef: string) {
    const [ano, mes] = mesRef.split('-').map(Number)
    const ultimoDia = new Date(ano, mes, 0).getDate()
    return `${mesRef}-${String(ultimoDia).padStart(2, '0')}`
  }

  function calcularResultadoDoMes(mesRef: string) {
    const processosPagosMes = lancamentos
      .filter(
        (item) =>
          statusCobranca(item) === 'PAGO' &&
          mesResultadoLancamento(item) === mesRef
      )
      .sort((a, b) =>
        String(dataRecebimentoProcesso(a) || '').localeCompare(
          String(dataRecebimentoProcesso(b) || '')
        )
      )

    const processosComCusto = processosPagosMes.filter(
      (item) => Number(item.valor_compra || 0) > 0
    )

    const processosSemCusto = processosPagosMes.filter(aguardandoCustoProcesso)

    const valorRecebido = processosPagosMes.reduce(
      (acc, item) => acc + Number(item.valor_cobranca || 0),
      0
    )

    const valorRecebidoSemCusto = processosSemCusto.reduce(
      (acc, item) => acc + Number(item.valor_cobranca || 0),
      0
    )

    const profitRecebido = processosComCusto.reduce(
      (acc, item) => acc + calcularProfit(item),
      0
    )

    const movimentosMes = movimentacoes.filter(
      (item) => mesBaseMovimento(item) === mesRef
    )

    const despesasPagas = movimentosMes
      .filter(
        (item) =>
          item.tipo === 'DESPESA' &&
          statusMovimento(item) === 'PAGO' &&
          item.impacta_resultado !== false
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const emprestimosPagos = movimentosMes
      .filter(
        (item) =>
          item.tipo === 'PAGAMENTO_EMPRESTIMO' &&
          statusMovimento(item) === 'PAGO' &&
          item.impacta_resultado !== false
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const despesasCaixa = movimentosMes
      .filter(
        (item) =>
          item.tipo === 'DESPESA' &&
          statusMovimento(item) === 'PAGO' &&
          item.impacta_caixa !== false
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const emprestimosCaixa = movimentosMes
      .filter(
        (item) =>
          item.tipo === 'PAGAMENTO_EMPRESTIMO' &&
          statusMovimento(item) === 'PAGO' &&
          item.impacta_caixa !== false
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const reservasFundoMes = movimentosMes
      .filter(
        (item) =>
          ehReservaOperacionalFundo(item) &&
          statusMovimento(item) === 'PAGO'
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const retiradasMes = movimentosMes
      .filter((item) =>
        ['RETIRADA_SOCIO', 'PAGAMENTO_SOCIO', 'REEMBOLSO_SOCIO'].includes(item.tipo) &&
        statusMovimento(item) === 'PAGO' &&
        item.impacta_caixa !== false
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const aportesMes = movimentosMes
      .filter(
        (item) =>
          item.tipo === 'APORTE_SOCIO' &&
          statusMovimento(item) === 'PAGO' &&
          item.impacta_caixa !== false
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const entradasNaoOperacionaisMes = movimentosMes
      .filter((item) =>
        item.tipo === 'FUNDO_CAIXA_ENTRADA' &&
        statusMovimento(item) === 'PAGO' &&
        item.impacta_caixa !== false &&
        !ehReservaOperacionalFundo(item)
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const saidasFundoMes = movimentosMes
      .filter(
        (item) =>
          item.tipo === 'FUNDO_CAIXA_SAIDA' &&
          statusMovimento(item) === 'PAGO' &&
          item.impacta_caixa !== false
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const ajustesPositivosMes = movimentosMes
      .filter(
        (item) =>
          item.tipo === 'AJUSTE_CAIXA' &&
          statusMovimento(item) === 'PAGO' &&
          item.impacta_caixa !== false &&
          Number(item.valor || 0) > 0
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const ajustesNegativosMes = movimentosMes
      .filter(
        (item) =>
          item.tipo === 'AJUSTE_CAIXA' &&
          statusMovimento(item) === 'PAGO' &&
          item.impacta_caixa !== false &&
          Number(item.valor || 0) < 0
      )
      .reduce((acc, item) => acc + Math.abs(Number(item.valor || 0)), 0)

    const saidasResultado = despesasPagas + emprestimosPagos
    const resultadoOperacional = profitRecebido - saidasResultado
    const lucroDistribuivel = resultadoOperacional > 0 ? resultadoOperacional : 0
    const fundoPrevistoMes = lucroDistribuivel * 0.5
    const saldoFundoMes = fundoPrevistoMes - reservasFundoMes

    const entradasCaixaMes =
      entradasNaoOperacionaisMes + aportesMes + ajustesPositivosMes

    const saidasCaixaMes =
      despesasCaixa +
      emprestimosCaixa +
      retiradasMes +
      saidasFundoMes +
      ajustesNegativosMes

    const saldoCaixaRealMes =
      profitRecebido + entradasCaixaMes - saidasCaixaMes

    const caixaLivreAtual = caixaLivreAtualInformado()

    const valorReservaPossivelMes = Math.min(
      Math.max(saldoFundoMes, 0),
      Math.max(caixaLivreAtual, 0)
    )

    return {
      mesRef,
      processos: processosPagosMes.length,
      comCusto: processosComCusto.length,
      semCusto: processosSemCusto.length,
      processosDetalhados: processosPagosMes,
      processosComCustoDetalhados: processosComCusto,
      processosSemCustoDetalhados: processosSemCusto,
      valorRecebido,
      valorRecebidoSemCusto,
      profitRecebido,
      despesasPagas,
      emprestimosPagos,
      saidasResultado,
      retiradasMes,
      aportesMes,
      entradasNaoOperacionaisMes,
      saidasFundoMes,
      ajustesPositivosMes,
      ajustesNegativosMes,
      entradasCaixaMes,
      saidasCaixaMes,
      reservasFundoMes,
      resultadoOperacional,
      lucroDistribuivel,
      fundoPrevistoMes,
      saldoFundoMes,
      saldoCaixaRealMes,
      caixaLivreAtual,
      valorReservaPossivelMes,
    }
  }


  function deveRegistrarFechamentoRetroativo(item: any) {
    return (
      Number(item.resultadoOperacional || 0) > 0 &&
      Number(item.saldoFundoMes || 0) > 0.009
    )
  }

  async function gerarFechamentosRetroativos() {
    const mesAtual = mesAtualFinanceiro()

    const meses = Array.from(
      new Set([
        ...lancamentos
          .map((item) => mesResultadoLancamento(item))
          .filter(Boolean),
        ...movimentacoes
          .map((item) => mesBaseMovimento(item))
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

    const resultados = meses.map((mes) => {
      const mesRef = String(mes)

      return {
        ...calcularResultadoDoMes(mesRef),
        fechamentoExistente: movimentacoes.some((item) =>
          ehFechamentoDoMes(item, mesRef)
        ),
      }
    })

    const pendencias = resultados.filter(deveRegistrarFechamentoRetroativo)

    if (pendencias.length === 0) {
      alert(
        'Nenhuma reserva retroativa pendente encontrada.\n\n' +
          'Os meses anteriores não tiveram lucro positivo ou já possuem reserva suficiente para a competência.'
      )
      return
    }

    if (loadingCompromissosCaixa) {
      alert('Aguarde a leitura das obrigações atuais antes de constituir reservas retroativas.')
      return
    }

    if (erroCompromissosCaixa) {
      alert(
        'Não foi possível validar as obrigações atuais da HC. As reservas retroativas não serão constituídas até a leitura das faturas DHL/FedEx voltar a funcionar.\n\n' +
          erroCompromissosCaixa
      )
      return
    }

    const compromissosAtuais = compromissosOperacionaisAtuais()

    if (compromissosAtuais.qtdFaturasMoedaNaoBRL > 0) {
      alert(
        'Existem faturas de transportadora em moeda diferente de BRL. Converta/revise essas obrigações antes de constituir reservas retroativas.'
      )
      return
    }

    const caixaLivreAtual = Number(caixaLivreAtualInformado().toFixed(2))

    if (caixaLivreAtual <= 0) {
      alert(
        'Existem reservas retroativas pendentes, mas não há caixa livre atual disponível nos saldos bancários informados.\n\n' +
          'A competência continuará pendente até existir saldo livre para constituir a reserva.'
      )
      return
    }

    let saldoLivreParaDistribuir = caixaLivreAtual

    const candidatos = pendencias
      .map((item) => {
        const saldoPendenteCompetencia = Number(Math.max(0, item.saldoFundoMes || 0).toFixed(2))
        const valorReservaAgora = Number(
          Math.min(saldoPendenteCompetencia, Math.max(0, saldoLivreParaDistribuir)).toFixed(2)
        )

        saldoLivreParaDistribuir = Number(
          Math.max(0, saldoLivreParaDistribuir - valorReservaAgora).toFixed(2)
        )

        return {
          ...item,
          valorReservaAgora,
        }
      })
      .filter((item) => item.valorReservaAgora > 0.009)

    if (candidatos.length === 0) {
      alert('Não existe caixa livre atual suficiente para constituir reservas retroativas agora.')
      return
    }

    const totalReservar = candidatos.reduce(
      (acc, item) => acc + Number(item.valorReservaAgora || 0),
      0
    )

    const listaMeses = candidatos
      .map(
        (item) =>
          `${formatarMesVisual(item.mesRef)}${item.fechamentoExistente ? ' (complemento)' : ''}: ${moeda(item.valorReservaAgora || 0)}`
      )
      .join('\n')

    const avisoSaldoInicial = existeSaldoInicial
      ? '\n\nATENÇÃO: existe lançamento de saldo inicial/fundo inicial no caixa. Se esse valor já representa os meses antigos, gerar retroativos pode duplicar o fundo. Confirme somente se deseja detalhar mês a mês.'
      : ''

    const confirmar = confirm(
      `Constituir reservas retroativas de ${anoFinanceiroAtivo()}?\n\n` +
        `Compromissos operacionais identificados: ${moeda(compromissosAtuais.total)}\n` +
        `Caixa livre atual disponível: ${moeda(caixaLivreAtual)}\n` +
        `Competências que receberão reserva agora: ${candidatos.length}\n` +
        `Total que será destinado à reserva: ${moeda(totalReservar)}\n\n` +
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

    const hoje = dataHojeFinanceiro()

    const registros = candidatos.map((item) => {
      const saldoFundoPrevisto = Number((item.saldoFundoMes || 0).toFixed(2))
      const valorReserva = Number((item.valorReservaAgora || 0).toFixed(2))
      const saldoPendenteFundo = Number(Math.max(0, saldoFundoPrevisto - valorReserva).toFixed(2))

      return {
        tipo: 'FUNDO_CAIXA_ENTRADA',
        categoria: 'Fechamento mensal',
        descricao: item.fechamentoExistente
          ? `Complemento do fechamento mensal - reserva 50% ${item.mesRef} | pendente ${moeda(saldoPendenteFundo)}`
          : `Fechamento mensal - reserva 50% ${item.mesRef}${valorReserva > 0 ? '' : ' - sem caixa para reserva real'} | pendente ${moeda(saldoPendenteFundo)}`,
        valor: valorReserva,
        data_vencimento: hoje,
        data_pagamento: hoje,
        mes_referencia: item.mesRef,
        status: 'PAGO',
        socio: null,
        forma_pagamento: item.fechamentoExistente
          ? 'Complemento retroativo'
          : 'Fechamento retroativo',
        impacta_resultado: false,
        impacta_caixa: false,
        observacoes:
          `${item.fechamentoExistente ? 'Complemento retroativo' : 'Fechamento retroativo'} gerado pelo Resultado Mensal. ` +
          `Valor recebido: ${moeda(item.valorRecebido)}. ` +
          `Profit HC recebido: ${moeda(item.profitRecebido)}. ` +
          `Despesas pagas: ${moeda(item.despesasPagas)}. ` +
          `Empréstimos pagos: ${moeda(item.emprestimosPagos)}. ` +
          `Saldo líquido da competência: ${moeda(item.saldoCaixaRealMes)}. ` +
          `Fundo previsto 50%: ${moeda(item.fundoPrevistoMes)}. ` +
          `Já reservado anteriormente: ${moeda(item.reservasFundoMes)}. ` +
          `Valor constituído agora: ${moeda(valorReserva)}. ` +
          `Processos pagos sem custo no mês: ${item.semCusto}. ` +
          `Data de constituição da reserva: ${hoje}. Competência preservada em ${item.mesRef}; a reserva não representa entrada de caixa.`,
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
      `Reservas retroativas constituídas com sucesso.\n\n` +
        `Competências atendidas: ${registros.length}\n` +
        `Total destinado à reserva: ${moeda(totalReservar)}\n` +
        `A data da constituição é hoje; a competência original foi preservada.`
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

      const passaAno = termo ? true : lancamentoAnoSelecionado(item)
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

      const mesesProcessoFiltro = [mesBaseLancamento(item)].filter(Boolean)

      const anosProcessoFiltro = mesesProcessoFiltro
        .map((mes) => String(mes || '').slice(0, 4))
        .filter(Boolean)

      const passaAnoProcessos =
        !filtroAnoProcessos ||
        filtroAnoProcessos === 'TODOS' ||
        anosProcessoFiltro.includes(filtroAnoProcessos)

      const passaMesProcessos =
        !filtroMesProcessos || mesesProcessoFiltro.includes(filtroMesProcessos)

      if (!passaAnoProcessos || !passaMesProcessos) return false

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
    filtroAnoProcessos,
    filtroMesProcessos,
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
      const passaMes = filtraMultipla(filtroMesMovimento, mesBaseMovimento(item))
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
    const processosPagosMes = lancamentos
      .filter(
        (item) =>
          statusCobranca(item) === 'PAGO' &&
          mesResultadoLancamento(item) === mesResultado
      )
      .sort((a, b) =>
        String(dataRecebimentoProcesso(a) || '').localeCompare(
          String(dataRecebimentoProcesso(b) || '')
        )
      )

    const processosComCustoDetalhados = processosPagosMes.filter(
      (item) => Number(item.valor_compra || 0) > 0
    )

    const processosSemCustoDetalhados = processosPagosMes.filter(
      aguardandoCustoProcesso
    )

    const valorRecebido = processosPagosMes.reduce(
      (acc, item) => acc + Number(item.valor_cobranca || 0),
      0
    )

    const valorRecebidoSemCusto = processosSemCustoDetalhados.reduce(
      (acc, item) => acc + Number(item.valor_cobranca || 0),
      0
    )

    const profitRecebido = processosComCustoDetalhados.reduce(
      (acc, item) => acc + calcularProfit(item),
      0
    )

    const movimentosMes = movimentacoes.filter(
      (item) => mesBaseMovimento(item) === mesResultado
    )

    const despesasPagas = movimentosMes
      .filter(
        (item) =>
          item.tipo === 'DESPESA' &&
          statusMovimento(item) === 'PAGO' &&
          item.impacta_resultado !== false
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const emprestimosPagos = movimentosMes
      .filter(
        (item) =>
          item.tipo === 'PAGAMENTO_EMPRESTIMO' &&
          statusMovimento(item) === 'PAGO' &&
          item.impacta_resultado !== false
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const despesasCaixa = movimentosMes
      .filter(
        (item) =>
          item.tipo === 'DESPESA' &&
          statusMovimento(item) === 'PAGO' &&
          item.impacta_caixa !== false
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const emprestimosCaixa = movimentosMes
      .filter(
        (item) =>
          item.tipo === 'PAGAMENTO_EMPRESTIMO' &&
          statusMovimento(item) === 'PAGO' &&
          item.impacta_caixa !== false
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const despesasPendentes = movimentosMes
      .filter(
        (item) =>
          item.tipo === 'DESPESA' &&
          statusMovimento(item) !== 'PAGO' &&
          item.impacta_resultado !== false
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const emprestimosPendentes = movimentosMes
      .filter(
        (item) =>
          item.tipo === 'PAGAMENTO_EMPRESTIMO' &&
          statusMovimento(item) !== 'PAGO' &&
          item.impacta_resultado !== false
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const retiradasMarcos = movimentosMes
      .filter((item) =>
        ['RETIRADA_SOCIO', 'PAGAMENTO_SOCIO', 'REEMBOLSO_SOCIO'].includes(item.tipo) &&
        item.socio === 'MARCOS' &&
        statusMovimento(item) === 'PAGO' &&
        item.impacta_caixa !== false
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const retiradasHerica = movimentosMes
      .filter((item) =>
        ['RETIRADA_SOCIO', 'PAGAMENTO_SOCIO', 'REEMBOLSO_SOCIO'].includes(item.tipo) &&
        item.socio === 'HERICA' &&
        statusMovimento(item) === 'PAGO' &&
        item.impacta_caixa !== false
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const aportes = movimentosMes
      .filter(
        (item) =>
          item.tipo === 'APORTE_SOCIO' &&
          statusMovimento(item) === 'PAGO' &&
          item.impacta_caixa !== false
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const entradasFundoMes = movimentosMes
      .filter(
        (item) =>
          item.tipo === 'FUNDO_CAIXA_ENTRADA' &&
          statusMovimento(item) === 'PAGO' &&
          item.impacta_caixa !== false &&
          !ehReservaOperacionalFundo(item)
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const reservasFundoMes = movimentosMes
      .filter((item) => ehReservaOperacionalFundo(item) && statusMovimento(item) === 'PAGO')
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const entradasNaoOperacionaisMes = movimentosMes
      .filter((item) =>
        item.tipo === 'FUNDO_CAIXA_ENTRADA' &&
        statusMovimento(item) === 'PAGO' &&
        item.impacta_caixa !== false &&
        !ehReservaOperacionalFundo(item)
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const saidasFundoMes = movimentosMes
      .filter(
        (item) =>
          item.tipo === 'FUNDO_CAIXA_SAIDA' &&
          statusMovimento(item) === 'PAGO' &&
          item.impacta_caixa !== false
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const ajustesPositivosMes = movimentosMes
      .filter(
        (item) =>
          item.tipo === 'AJUSTE_CAIXA' &&
          statusMovimento(item) === 'PAGO' &&
          item.impacta_caixa !== false &&
          Number(item.valor || 0) > 0
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const ajustesNegativosMes = movimentosMes
      .filter(
        (item) =>
          item.tipo === 'AJUSTE_CAIXA' &&
          statusMovimento(item) === 'PAGO' &&
          item.impacta_caixa !== false &&
          Number(item.valor || 0) < 0
      )
      .reduce((acc, item) => acc + Math.abs(Number(item.valor || 0)), 0)

    const fundoAtual = calcularFundoAtualPermitido()

    const retiradasTotal = retiradasMarcos + retiradasHerica
    const saidasResultado = despesasPagas + emprestimosPagos
    const resultadoOperacional = profitRecebido - saidasResultado
    const lucroDistribuivel = resultadoOperacional > 0 ? resultadoOperacional : 0
    const fundoPrevistoMes = lucroDistribuivel * 0.5
    const parteMarcos = lucroDistribuivel * 0.25
    const parteHerica = lucroDistribuivel * 0.25
    const saldoMarcos = parteMarcos - retiradasMarcos
    const saldoHerica = parteHerica - retiradasHerica

    const saldoFundoMes = fundoPrevistoMes - reservasFundoMes

    const entradasCaixaMes =
      entradasNaoOperacionaisMes + aportes + ajustesPositivosMes

    const saidasCaixaMes =
      despesasCaixa +
      emprestimosCaixa +
      retiradasTotal +
      saidasFundoMes +
      ajustesNegativosMes

    const saldoCaixaRealMes =
      profitRecebido + entradasCaixaMes - saidasCaixaMes

    return {
      processos: processosPagosMes.length,
      comCusto: processosComCustoDetalhados.length,
      semCusto: processosSemCustoDetalhados.length,
      processosDetalhados: processosPagosMes,
      processosComCustoDetalhados,
      processosSemCustoDetalhados,
      valorRecebido,
      valorRecebidoSemCusto,
      profitRecebido,
      despesasPagas,
      emprestimosPagos,
      saidasResultado,
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
      ajustesPositivosMes,
      ajustesNegativosMes,
      entradasCaixaMes,
      saidasCaixaMes,
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

  const evolucaoResultadoAnual = useMemo(() => {
    const ano = String(mesResultado || mesAtualFinanceiro()).slice(0, 4)

    return Array.from({ length: 12 }, (_, index) => {
      const mesRef = `${ano}-${String(index + 1).padStart(2, '0')}`
      const resultado = calcularResultadoDoMes(mesRef)

      return {
        mesRef,
        valorRecebido: resultado.valorRecebido,
        profitRecebido: resultado.profitRecebido,
        saidasResultado: resultado.saidasResultado,
        resultadoOperacional: resultado.resultadoOperacional,
        retiradasTotal: resultado.retiradasMes,
        saidasCaixaMes: resultado.saidasCaixaMes,
        saldoCaixaRealMes: resultado.saldoCaixaRealMes,
        processos: resultado.processos,
        semCusto: resultado.semCusto,
      }
    })
  }, [lancamentos, movimentacoes, mesResultado, anoFinanceiro])


  const resumoFundoFiltro = useMemo(() => {
    const movimentosFundo = movimentacoes.filter((item) => {
      const tipoFundo = ['FUNDO_CAIXA_ENTRADA', 'FUNDO_CAIXA_SAIDA', 'AJUSTE_CAIXA'].includes(item.tipo)
      const passaAno = movimentoAnoSelecionado(item)
      const passaMes = filtraMultipla(filtroMesMovimento, mesBaseMovimento(item))
      return tipoFundo && passaAno && passaMes && statusMovimento(item) === 'PAGO'
    })

    const reservasConstituidas = movimentosFundo
      .filter((item) => ehReservaOperacionalFundo(item))
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const entradasExtraordinarias = movimentosFundo
      .filter(
        (item) =>
          item.impacta_caixa !== false &&
          item.tipo === 'FUNDO_CAIXA_ENTRADA' &&
          !ehReservaOperacionalFundo(item)
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const saidasExtraordinarias = movimentosFundo
      .filter(
        (item) =>
          item.impacta_caixa !== false &&
          item.tipo === 'FUNDO_CAIXA_SAIDA'
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const ajustesPositivos = movimentosFundo
      .filter(
        (item) =>
          item.impacta_caixa !== false &&
          item.tipo === 'AJUSTE_CAIXA' &&
          Number(item.valor || 0) > 0
      )
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const ajustesNegativos = movimentosFundo
      .filter(
        (item) =>
          item.impacta_caixa !== false &&
          item.tipo === 'AJUSTE_CAIXA' &&
          Number(item.valor || 0) < 0
      )
      .reduce((acc, item) => acc + Math.abs(Number(item.valor || 0)), 0)

    const mesesCompetencia = Array.from(
      new Set([
        ...lancamentos.map((item) => mesResultadoLancamento(item)).filter(Boolean),
        ...movimentacoes
          .filter((item) => ehReservaOperacionalFundo(item))
          .map((item) => mesBaseMovimento(item))
          .filter(Boolean),
      ])
    )
      .filter((mes: any) => mesFinanceiroPermitido(mes))
      .filter((mes: any) => mesDoAnoFinanceiroAtivo(mes))
      .filter((mes: any) => filtraMultipla(filtroMesMovimento, String(mes)))

    const reservaPrevista = mesesCompetencia.reduce(
      (acc, mes) => acc + Number(calcularResultadoDoMes(String(mes)).fundoPrevistoMes || 0),
      0
    )

    const reservaPendente = Math.max(0, reservaPrevista - reservasConstituidas)
    const entradasReais = entradasExtraordinarias + ajustesPositivos
    const saidasReais = saidasExtraordinarias + ajustesNegativos

    return {
      reservaPrevista,
      reservasConstituidas,
      reservaPendente,
      entradasExtraordinarias,
      saidasExtraordinarias,
      ajustesPositivos,
      ajustesNegativos,
      entradasReais,
      saidasReais,
      saldoMovimentacoesReais: entradasReais - saidasReais,
      // aliases mantidos para não quebrar usos antigos dentro da página
      entradas: entradasReais,
      saidas: saidasReais,
      ajustes: ajustesPositivos - ajustesNegativos,
      saldoPeriodo: entradasReais - saidasReais,
    }
  }, [movimentacoes, lancamentos, filtroMesMovimento, anoFinanceiro, contasBancarias])


  const resumoCaixaRealProfit = useMemo(() => {
    function mesesDoLancamento(item: any) {
      return [mesBaseLancamento(item)].filter(Boolean)
    }

    function mesesDoMovimento(item: any) {
      return [mesBaseMovimento(item)].filter(Boolean)
    }

    function passaMesSelecionado(meses: string[]) {
      if (filtroMesMovimento.length === 0) return true
      return meses.some((mes) => filtroMesMovimento.includes(mes))
    }

    const processosPagos = lancamentos
      .filter(lancamentoAnoSelecionado)
      .filter((item) => passaMesSelecionado(mesesDoLancamento(item)))
      .filter((item) => statusCobranca(item) === 'PAGO')

    const processosComCusto = processosPagos.filter((item) => !aguardandoCustoProcesso(item))
    const processosSemCusto = processosPagos.length - processosComCusto.length

    const valorRecebidoBruto = processosPagos.reduce(
      (acc, item) => acc + numero(item.valor_cobranca || item.valor_faturado || item.valor_venda || item.valor),
      0
    )

    const profitRecebido = processosComCusto.reduce(
      (acc, item) => acc + calcularProfit(item),
      0
    )

    const movimentosPagosTodos = movimentacoes
      .filter(movimentoAnoSelecionado)
      .filter((item) => passaMesSelecionado(mesesDoMovimento(item)))
      .filter((item) => statusMovimento(item) === 'PAGO')

    const movimentosPagos = movimentosPagosTodos
      .filter((item) => item.impacta_caixa !== false)
      .filter((item) => !ehReservaOperacionalFundo(item))

    const movimentosResultado = movimentacoes
      .filter(movimentoAnoSelecionado)
      .filter((item) => passaMesSelecionado(mesesDoMovimento(item)))
      .filter((item) => statusMovimento(item) === 'PAGO')
      .filter((item) => item.impacta_resultado !== false)

    const despesasPagas = movimentosPagos
      .filter((item) => item.tipo === 'DESPESA')
      .reduce((acc, item) => acc + numero(item.valor || 0), 0)

    const emprestimosPagos = movimentosPagos
      .filter((item) => item.tipo === 'PAGAMENTO_EMPRESTIMO')
      .reduce((acc, item) => acc + numero(item.valor || 0), 0)

    const despesasResultado = movimentosResultado
      .filter((item) => item.tipo === 'DESPESA')
      .reduce((acc, item) => acc + numero(item.valor || 0), 0)

    const emprestimosResultado = movimentosResultado
      .filter((item) => item.tipo === 'PAGAMENTO_EMPRESTIMO')
      .reduce((acc, item) => acc + numero(item.valor || 0), 0)

    const retiradasSocios = movimentosPagos
      .filter((item) => ['RETIRADA_SOCIO', 'PAGAMENTO_SOCIO', 'REEMBOLSO_SOCIO'].includes(item.tipo))
      .reduce((acc, item) => acc + numero(item.valor || 0), 0)

    const saidasFundoCaixa = movimentosPagos
      .filter((item) => item.tipo === 'FUNDO_CAIXA_SAIDA')
      .reduce((acc, item) => acc + numero(item.valor || 0), 0)

    const reservasLancadas = movimentosPagosTodos
      .filter((item) => ehReservaOperacionalFundo(item))
      .reduce((acc, item) => acc + numero(item.valor || 0), 0)

    const entradasExtraordinarias = movimentosPagos
      .filter((item) =>
        item.tipo === 'APORTE_SOCIO' ||
        (
          item.tipo === 'FUNDO_CAIXA_ENTRADA' &&
          !ehReservaOperacionalFundo(item)
        )
      )
      .reduce((acc, item) => acc + numero(item.valor || 0), 0)

    const ajustesPositivos = movimentosPagos
      .filter((item) => item.tipo === 'AJUSTE_CAIXA' && numero(item.valor || 0) > 0)
      .reduce((acc, item) => acc + numero(item.valor || 0), 0)

    const ajustesNegativos = movimentosPagos
      .filter((item) => item.tipo === 'AJUSTE_CAIXA' && numero(item.valor || 0) < 0)
      .reduce((acc, item) => acc + Math.abs(numero(item.valor || 0)), 0)

    const saidasOperacionais =
      despesasPagas +
      emprestimosPagos +
      retiradasSocios

    const saidasExtraordinarias =
      saidasFundoCaixa +
      ajustesNegativos

    const saidasReais =
      saidasOperacionais +
      saidasExtraordinarias

    const entradasNaoOperacionais =
      entradasExtraordinarias +
      ajustesPositivos

    const resultadoAntesRetiradas =
      profitRecebido -
      despesasResultado -
      emprestimosResultado

    const mesesResultadoPeriodo = Array.from(
      new Set(
        processosPagos
          .map((item) => mesResultadoLancamento(item))
          .filter(Boolean)
      )
    )

    const fundoPrevisto = mesesResultadoPeriodo.reduce(
      (acc, mes) => acc + Number(calcularResultadoDoMes(String(mes)).fundoPrevistoMes || 0),
      0
    )

    const caixaOperacionalDoProfit =
      profitRecebido -
      saidasOperacionais

    const caixaRealAjustado =
      caixaOperacionalDoProfit +
      entradasNaoOperacionais -
      saidasExtraordinarias

    const fundoPendente = Math.max(0, fundoPrevisto - reservasLancadas)

    const faltaRegularizarOperacional =
      Math.max(0, -caixaOperacionalDoProfit) +
      fundoPendente

    const faltaRegularizarReal =
      Math.max(0, -caixaRealAjustado) +
      fundoPendente

    return {
      processosPagos: processosPagos.length,
      processosSemCusto,
      valorRecebidoBruto,
      profitRecebido,
      despesasPagas,
      emprestimosPagos,
      despesasResultado,
      emprestimosResultado,
      retiradasSocios,
      saidasFundoCaixa,
      saidasOperacionais,
      saidasExtraordinarias,
      saidasReais,
      entradasExtraordinarias,
      ajustesPositivos,
      ajustesNegativos,
      entradasNaoOperacionais,
      resultadoAntesRetiradas,
      fundoPrevisto,
      reservasLancadas,
      fundoPendente,
      caixaOperacionalDoProfit,
      caixaRealAjustado,
      faltaRegularizarOperacional,
      faltaRegularizarReal,
    }
  }, [lancamentos, movimentacoes, filtroMesMovimento, anoFinanceiro])

  const resumoPosicaoAtual = useMemo(() => {
    const saldoBancarioReal = saldoBancarioAtualInformado()
    const compromissos = compromissosOperacionaisAtuais()

    const reservasRegistradas = movimentacoes
      .filter(
        (item) =>
          statusMovimento(item) === 'PAGO' &&
          ehReservaOperacionalFundo(item)
      )
      .reduce((acc, item) => acc + numero(item.valor || 0), 0)

    const usosDoFundo = movimentacoes
      .filter(
        (item) =>
          statusMovimento(item) === 'PAGO' &&
          item.tipo === 'FUNDO_CAIXA_SAIDA' &&
          item.impacta_caixa !== false
      )
      .reduce((acc, item) => acc + numero(item.valor || 0), 0)

    const reservaConstituida = reservaConstituidaAtual()

    const mesesComResultado = Array.from(
      new Set(
        lancamentos
          .filter((item) => statusCobranca(item) === 'PAGO')
          .map((item) => mesResultadoLancamento(item))
          .filter(Boolean)
      )
    )

    const reservaPrevistaAcumulada = mesesComResultado.reduce(
      (acc, mes) => acc + Number(calcularResultadoDoMes(String(mes)).fundoPrevistoMes || 0),
      0
    )

    const reservaPendente = mesesComResultado.reduce(
      (acc, mes) =>
        acc +
        Math.max(
          0,
          Number(calcularResultadoDoMes(String(mes)).saldoFundoMes || 0)
        ),
      0
    )

    const saldoAposCompromissos = Math.max(
      0,
      saldoBancarioReal - compromissos.total
    )

    const reservaProtegida = Math.min(
      saldoAposCompromissos,
      reservaConstituida
    )
    const reservaSemCobertura = Math.max(
      0,
      reservaConstituida - saldoAposCompromissos
    )
    const caixaLivreAtual = compromissos.dadosConfiaveis
      ? Math.max(0, saldoAposCompromissos - reservaProtegida)
      : 0

    return {
      saldoBancarioReal,
      possuiContas: contasBancarias.length > 0,
      reservasRegistradas,
      usosDoFundo,
      reservaPrevistaAcumulada,
      reservaConstituida,
      reservaProtegida,
      reservaSemCobertura,
      reservaPendente,
      caixaLivreAtual,
      compromissoTransportadoras: compromissos.compromissoTransportadoras,
      compromissoTerceiros: compromissos.compromissoTerceiros,
      compromissosOperacionais: compromissos.total,
      compromissosConfiaveis: compromissos.dadosConfiaveis,
      qtdFaturasMoedaNaoBRL: compromissos.qtdFaturasMoedaNaoBRL,
      dataBaseReserva: DATA_BASE_CONCILIACAO,
      reservaBaseProtegida: 0,
    }
  }, [contasBancarias, movimentacoes, lancamentos, faturasTransportadorasCaixa, loadingCompromissosCaixa, erroCompromissosCaixa])


  const resumoConciliacaoBancaria = useMemo(() => {
    const saldoBancarioReal = Number(resumoPosicaoAtual.saldoBancarioReal || 0)
    const possuiContas = resumoPosicaoAtual.possuiContas

    const processosAposBase = lancamentos
      .filter((item) => statusCobranca(item) === 'PAGO')
      .filter((item) => {
        const data = dataRecebimentoProcesso(item)
        return !!data && data > DATA_BASE_CONCILIACAO
      })

    const recebimentosClientesAposBase = processosAposBase.reduce(
      (acc, item) => acc + numero(item.valor_cobranca || 0),
      0
    )

    const processosSemCustoAposBase = processosAposBase.filter(
      aguardandoCustoProcesso
    )

    const pagamentosTransportadorasAposBase = faturasTransportadorasCaixa
      .filter((item) => {
        const dataPagamento = normalizarData(item.data_pagamento)
        return (
          faturaTransportadoraQuitada(item) &&
          !!dataPagamento &&
          dataPagamento > DATA_BASE_CONCILIACAO
        )
      })
      .reduce(
        (acc, item) =>
          acc +
          Math.max(
            numero(item.pago_ajustado || 0),
            numero(item.total || 0) - numero(item.saldo || 0)
          ),
      0
      )

    const movimentosReaisAposBase = movimentacoes
      .filter((item) => statusMovimento(item) === 'PAGO')
      .filter((item) => item.impacta_caixa !== false)
      .filter((item) => !ehReservaOperacionalFundo(item))
      .filter((item) => {
        const data = dataEfetivaMovimentoCaixa(item)
        return !!data && data > DATA_BASE_CONCILIACAO
      })

    const entradasReaisAposBase = movimentosReaisAposBase
      .filter(ehEntradaRealMovimento)
      .reduce((acc, item) => acc + Math.abs(numero(item.valor || 0)), 0)

    const saidasReaisAposBase = movimentosReaisAposBase
      .filter(ehSaidaRealMovimento)
      .reduce((acc, item) => acc + Math.abs(numero(item.valor || 0)), 0)

    const saldoEsperado =
      SALDO_BASE_CONCILIACAO +
      recebimentosClientesAposBase -
      pagamentosTransportadorasAposBase +
      entradasReaisAposBase -
      saidasReaisAposBase

    const diferenca = saldoBancarioReal - saldoEsperado

    const recebimentosAConferir = lancamentos.filter((item) => {
      const status = statusCobranca(item)
      return status === 'EM ABERTO' || status === 'ATRASADO'
    })

    const valorRecebimentosAConferir = recebimentosAConferir.reduce(
      (acc, item) => acc + numero(item.valor_cobranca || 0),
      0
    )

    const valorProcessosSemCustoAposBase = processosSemCustoAposBase.reduce(
      (acc, item) => acc + numero(item.valor_cobranca || 0),
      0
    )

    const possuiPendenciasClassificacao =
      recebimentosAConferir.length > 0 ||
      processosSemCustoAposBase.length > 0

    const ultimaAtualizacao = contasBancarias
      .map((item) => item.atualizado_em || item.data_referencia || item.criado_em)
      .filter(Boolean)
      .sort((a, b) => String(b).localeCompare(String(a)))[0] || ''

    const status = !possuiContas
      ? 'SEM CONCILIAÇÃO'
      : Math.abs(diferenca) <= TOLERANCIA_CONCILIACAO
        ? 'CONCILIADO'
        : possuiPendenciasClassificacao
          ? 'A CONFERIR'
          : 'A CONCILIAR'

    return {
      possuiContas,
      dataBase: DATA_BASE_CONCILIACAO,
      saldoBase: SALDO_BASE_CONCILIACAO,
      saldoBancarioReal,
      saldoEsperado,
      saldoCalculado: saldoEsperado,
      diferenca,
      status,
      ultimaAtualizacao,
      recebimentosClientesAposBase,
      pagamentosTransportadorasAposBase,
      efeitoOperacionalLiquidoAposBase:
        recebimentosClientesAposBase - pagamentosTransportadorasAposBase,
      entradasReaisAposBase,
      saidasReaisAposBase,
      extraordinarioLiquido: entradasReaisAposBase - saidasReaisAposBase,
      qtdRecebimentosAConferir: recebimentosAConferir.length,
      valorRecebimentosAConferir,
      qtdProcessosSemCustoAposBase: processosSemCustoAposBase.length,
      valorProcessosSemCustoAposBase,
      possuiPendenciasClassificacao,
    }
  }, [contasBancarias, lancamentos, movimentacoes, resumoPosicaoAtual, faturasTransportadorasCaixa])



  const extratoAnual = useMemo(() => {
    const todosAnos = String(anoExtrato || '').toUpperCase() === 'TODOS'
    const anoSelecionado = anoFinanceiroPermitido(anoExtrato)
      ? String(anoExtrato)
      : String(ANO_ATUAL_FINANCEIRO)
    const ano = anoSelecionado

    const linhasProcessos = lancamentos
      .filter((item) => {
        if (statusCobranca(item) !== 'PAGO') return false
        const mesBase = mesBaseLancamento(item)
        return todosAnos
          ? mesFinanceiroPermitido(mesBase)
          : String(mesBase || '').startsWith(ano)
      })
      .map((item) => {
        const data =
          dataRecebimentoProcesso(item) ||
          normalizarData(item.vencimento_cobranca) ||
          `${mesBaseLancamento(item) || ano + '-01'}-01`
        const possuiCusto = Number(item.valor_compra || 0) > 0
        const profit = possuiCusto ? calcularProfit(item) : 0

        return {
          id: `processo-${item.id}`,
          origem: 'PROCESSO',
          data,
          mes: mesBaseLancamento(item),
          tipo: 'RECEBIMENTO_PROCESSO',
          tipoLabel: 'Recebimento de processo',
          categoria: normalizarServicoFinanceiro(item.servico) || 'Processo faturado',
          descricao: `${item.cliente || 'Cliente'}${item.awb ? ` - AWB ${item.awb}` : ''}${item.fatura ? ` - Fatura ${item.fatura}` : ''}`,
          socio: '',
          natureza: 'ENTRADA',
          entrada: Number(item.valor_cobranca || 0),
          saida: 0,
          reserva: 0,
          profit,
          terceiros:
            String(item.pgta_terceiros || '').trim().toUpperCase() === 'PAGO'
              ? 0
              : Number(item.debito_terceiro || 0),
          custosProtegidos: Number(item.doc_dta || 0) + Number(item.valor_compra || 0),
          valorCompra: Number(item.valor_compra || 0),
          status: statusCobranca(item),
          forma_pagamento: '',
          impacta_resultado: true,
          impacta_caixa: true,
          naoOperacional: false,
        }
      })

    const linhasMovimentos = movimentacoes
      .filter((item) => {
        const mesBase = mesBaseMovimento(item)
        return todosAnos
          ? mesFinanceiroPermitido(mesBase)
          : mesBase.startsWith(ano)
      })
      .map((item) => {
        const valor = Number(item.valor || 0)
        const status = statusMovimento(item)
        const ehReserva = ehReservaOperacionalFundo(item)
        const impactaCaixa = item.impacta_caixa !== false
        let natureza = 'NEUTRO'
        let entrada = 0
        let saida = 0
        let reserva = 0

        if (ehReserva) {
          natureza = 'RESERVA'
          reserva = Math.abs(valor)
        } else if (impactaCaixa && ehEntradaRealMovimento(item)) {
          natureza = 'ENTRADA'
          entrada = Math.abs(valor)
        } else if (impactaCaixa && ehSaidaRealMovimento(item)) {
          natureza = 'SAÍDA'
          saida = Math.abs(valor)
        }

        return {
          id: `mov-${item.id}`,
          origem: 'MOVIMENTACAO',
          data: normalizarData(item.data_pagamento) || normalizarData(item.data_vencimento) || `${item.mes_referencia || ano + '-01'}-01`,
          mes: mesBaseMovimento(item),
          tipo: item.tipo,
          tipoLabel: labelTipo(item.tipo),
          categoria: item.categoria || '-',
          descricao: item.descricao || '-',
          socio: item.socio || '',
          natureza,
          entrada: status === 'PAGO' ? entrada : 0,
          saida: status === 'PAGO' ? saida : 0,
          reserva: status === 'PAGO' ? reserva : 0,
          profit: 0,
          terceiros: 0,
          custosProtegidos: 0,
          status,
          forma_pagamento: item.forma_pagamento || '',
          impacta_resultado: item.impacta_resultado ?? true,
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
        ${item.natureza || ''}
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
    const reservas = pagos.reduce((acc, item) => acc + Number(item.reserva || 0), 0)
    const valorRecebido = pagos
      .filter((item) => item.tipo === 'RECEBIMENTO_PROCESSO')
      .reduce((acc, item) => acc + Number(item.entrada || 0), 0)
    const profitHC = pagos
      .filter((item) => item.tipo === 'RECEBIMENTO_PROCESSO')
      .reduce((acc, item) => acc + Number(item.profit || 0), 0)
    const despesas = pagos
      .filter(
        (item) =>
          item.tipo === 'DESPESA' &&
          item.impacta_resultado !== false
      )
      .reduce((acc, item) => acc + Number(item.saida || 0), 0)
    const emprestimosPagos = pagos
      .filter(
        (item) =>
          item.tipo === 'PAGAMENTO_EMPRESTIMO' &&
          item.impacta_resultado !== false
      )
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
      reservas,
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

  async function revisarCustosFaturasTransportadoras() {
    if (revisandoCustos) return

    const normalizarAwbRevisao = (valor: any) => String(valor || '').replace(/\D/g, '')
    const normalizarTransportadoraRevisao = (valor: any) =>
      String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()

    const processosSemCusto = filtrados.filter((item) => {
      const transportadora = normalizarTransportadoraRevisao(item.transportadora)
      return (
        aguardandoCustoProcesso(item) &&
        !!normalizarAwbRevisao(item.awb) &&
        (transportadora.includes('DHL') || transportadora.includes('FEDEX'))
      )
    })

    if (processosSemCusto.length === 0) {
      alert('Nenhum processo DHL/FedEx aguardando custo foi encontrado no filtro atual.')
      return
    }

    setRevisandoCustos(true)

    try {
      const awbs = Array.from(
        new Set(processosSemCusto.map((item) => normalizarAwbRevisao(item.awb)).filter(Boolean))
      )

      const itensFaturas: any[] = []

      for (let inicio = 0; inicio < awbs.length; inicio += 200) {
        const lote = awbs.slice(inicio, inicio + 200)
        const { data, error } = await supabase
          .from('faturas_transportadoras_itens')
          .select('id, fatura_transportadora_id, transportadora, numero_fatura, awb, valor_compra, tipo_lancamento, status_lancamento, financeiro_embarque_id, observacao, atualizado_em')
          .in('awb', lote)
          .gt('valor_compra', 0)

        if (error) throw new Error('Erro ao consultar itens das faturas: ' + error.message)
        itensFaturas.push(...(data || []))
      }

      const itensPorAwb = new Map<string, any[]>()

      itensFaturas.forEach((item) => {
        const awb = normalizarAwbRevisao(item.awb)
        if (!awb) return
        const atuais = itensPorAwb.get(awb) || []
        atuais.push(item)
        itensPorAwb.set(awb, atuais)
      })

      const corrigiveis: any[] = []
      let semFatura = 0
      let ambiguos = 0
      let impostosNaoConfirmados = 0

      processosSemCusto.forEach((processo) => {
        const awb = normalizarAwbRevisao(processo.awb)
        const transportadoraProcesso = normalizarTransportadoraRevisao(processo.transportadora)
        const candidatos = (itensPorAwb.get(awb) || []).filter((item) => {
          const transportadoraItem = normalizarTransportadoraRevisao(item.transportadora)
          if (transportadoraProcesso.includes('DHL')) return transportadoraItem.includes('DHL')
          if (transportadoraProcesso.includes('FEDEX')) return transportadoraItem.includes('FEDEX')
          return false
        })

        if (candidatos.length === 0) {
          semFatura += 1
          return
        }

        const candidatosCompra = candidatos.filter(
          (item) => String(item.tipo_lancamento || 'COMPRA').toUpperCase() !== 'IMPOSTOS'
        )
        const base = candidatosCompra.length > 0 ? candidatosCompra : candidatos
        const valoresDistintos = Array.from(
          new Set(base.map((item) => Number(item.valor_compra || 0).toFixed(2)))
        )

        if (valoresDistintos.length !== 1) {
          ambiguos += 1
          return
        }

        const itemFatura = [...base].sort((a, b) =>
          String(b.atualizado_em || '').localeCompare(String(a.atualizado_em || ''))
        )[0]
        const valorEncontrado = Number(itemFatura.valor_compra || 0)
        const tipoLancamento = String(itemFatura.tipo_lancamento || 'COMPRA').toUpperCase()
        const valorImpostosAtual = Number(processo.doc_dta || 0)
        const moverDeImpostos =
          tipoLancamento === 'IMPOSTOS' &&
          valorImpostosAtual > 0 &&
          Math.abs(valorImpostosAtual - valorEncontrado) < 0.01

        if (tipoLancamento === 'IMPOSTOS' && !moverDeImpostos) {
          impostosNaoConfirmados += 1
          return
        }

        corrigiveis.push({
          processo,
          itemFatura,
          valorEncontrado,
          moverDeImpostos,
        })
      })

      if (corrigiveis.length === 0) {
        alert(
          'Nenhum custo pôde ser corrigido automaticamente.\n\n' +
            `Sem AWB nas faturas: ${semFatura}\n` +
            `Mais de um valor encontrado: ${ambiguos}\n` +
            `Itens de impostos sem correspondência exata: ${impostosNaoConfirmados}`
        )
        return
      }

      const linhas = corrigiveis.slice(0, 20).map(({ processo, itemFatura, valorEncontrado, moverDeImpostos }) =>
        `• ${normalizarAwbRevisao(processo.awb)} | ${itemFatura.transportadora || processo.transportadora} | ` +
        `Fatura ${itemFatura.numero_fatura || '-'} | ${moeda(valorEncontrado)}` +
        (moverDeImpostos ? ' | MOVER DE IMPOSTOS' : '')
      )
      const restantes = corrigiveis.length > 20 ? `\n... +${corrigiveis.length - 20} processo(s)` : ''

      const confirmar = confirm(
        'Revisão de custos DHL/FedEx\n\n' +
          `Processos analisados: ${processosSemCusto.length}\n` +
          `Prontos para corrigir: ${corrigiveis.length}\n` +
          `Sem AWB nas faturas: ${semFatura}\n` +
          `Com valores divergentes: ${ambiguos}\n` +
          `Impostos sem correspondência exata: ${impostosNaoConfirmados}\n\n` +
          linhas.join('\n') +
          restantes +
          '\n\nConfirmar atualização do Valor Compra?'
      )

      if (!confirmar) return

      let atualizados = 0
      const falhas: string[] = []
      const avisosItens: string[] = []
      const agora = new Date().toISOString()

      for (const correcao of corrigiveis) {
        const { processo, itemFatura, valorEncontrado, moverDeImpostos } = correcao
        const payloadProcesso: any = {
          valor_compra: valorEncontrado,
          atualizado_em: agora,
        }

        if (moverDeImpostos) payloadProcesso.doc_dta = 0

        const { data: processoAtualizado, error: erroProcesso } = await supabase
          .from('financeiro_embarques')
          .update(payloadProcesso)
          .eq('id', processo.id)
          .or('valor_compra.is.null,valor_compra.lte.0')
          .select('id')
          .maybeSingle()

        if (erroProcesso) {
          falhas.push(`${normalizarAwbRevisao(processo.awb)}: ${erroProcesso.message}`)
          continue
        }

        if (!processoAtualizado?.id) {
          falhas.push(`${normalizarAwbRevisao(processo.awb)}: o custo já foi atualizado por outra ação`)
          continue
        }

        const observacaoAnterior = String(itemFatura.observacao || '').trim()
        const observacaoRevisao = moverDeImpostos
          ? 'Revisado no Painel Financeiro: custo transferido de impostos para valor de compra.'
          : 'Revisado no Painel Financeiro: valor de compra confirmado por AWB.'

        const { error: erroItem } = await supabase
          .from('faturas_transportadoras_itens')
          .update({
            tipo_lancamento: 'COMPRA',
            financeiro_embarque_id: processo.id,
            valor_compra_anterior: Number(processo.valor_compra || 0),
            status_lancamento: 'LANCADO',
            observacao: [observacaoAnterior, observacaoRevisao].filter(Boolean).join(' | '),
            lancado_em: agora,
            atualizado_em: agora,
          })
          .eq('id', itemFatura.id)

        if (erroItem) {
          avisosItens.push(`${normalizarAwbRevisao(processo.awb)}: ${erroItem.message}`)
        }

        atualizados += 1
      }

      await carregarFinanceiro()

      alert(
        `Revisão concluída.\n\nProcessos atualizados: ${atualizados}` +
          (falhas.length > 0 ? `\nFalhas: ${falhas.length}\n${falhas.slice(0, 5).join('\n')}` : '') +
          (avisosItens.length > 0
            ? `\nAvisos ao atualizar os itens das faturas: ${avisosItens.length}`
            : '')
      )
    } catch (error: any) {
      alert('Erro ao revisar custos DHL/FedEx: ' + error.message)
    } finally {
      setRevisandoCustos(false)
    }
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
          { label: 'Ano processos faturados', valor: filtroAnoProcessos === 'TODOS' ? 'Todos os anos' : filtroAnoProcessos },
          { label: 'Mês processos faturados', valor: filtroMesProcessos ? textoMesAnoProcessos(filtroMesProcessos) : 'Todos os meses' },
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
            dataRecebimentoProcesso(item) || '-',
            statusCobranca(item),
          ]
        }),
      })

      return
    }

    if (abaPrincipal === 'EXTRATO') {
      abrirPdfDoFiltro({
        titulo: `Extrato geral ${anoExtrato}`,
        subtitulo: 'Visão anual das movimentações reais e das reservas. Reserva é destinação do saldo existente e não entra nos totais de entrada ou saída.',
        filtros: [
          { label: 'Ano', valor: anoExtrato },
          { label: 'Busca', valor: buscaExtrato || 'Todas' },
          { label: 'Tipo', valor: textoFiltroMultiplo(tipoExtrato, TIPOS_EXTRATO, 'Todos') },
          { label: 'Status', valor: textoFiltroMultiplo(filtroStatusExtrato, STATUS_MOVIMENTOS, 'Todos') },
          { label: 'Sócio', valor: textoFiltroMultiplo(filtroSocioExtrato, SOCIOS_OPCOES, 'Todos') },
        ],
        cards: [
          { label: 'Saldo bancário real', valor: resumoPosicaoAtual.possuiContas ? moeda(resumoPosicaoAtual.saldoBancarioReal) : 'Não informado', detalhe: 'Soma dos saldos bancários atuais cadastrados' },
          { label: 'Reserva protegida', valor: moeda(resumoPosicaoAtual.reservaProtegida), detalhe: 'Parte do saldo bancário destinada à Reserva HC' },
          { label: 'Caixa livre bancário', valor: moeda(resumoPosicaoAtual.caixaLivreAtual), detalhe: 'Saldo bancário real menos reserva protegida' },
          { label: 'Reservas no extrato', valor: moeda(resumoExtrato.reservas), detalhe: 'Não somam como entrada nem como saída' },
          { label: 'Caixa protegido operacional', valor: moeda(resumoExtratoGeralAno.caixaProtegido), detalhe: 'Terceiros + custos operacionais dos processos pagos' },
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
          'Natureza',
          'Entrada',
          'Saída',
          'Reserva',
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
          item.natureza || '-',
          item.entrada > 0 ? moeda(item.entrada) : '-',
          item.saida > 0 ? moeda(item.saida) : '-',
          item.reserva > 0 ? moeda(item.reserva) : '-',
          item.status || '-',
          item.forma_pagamento || '-',
        ]),
      })

      return
    }

    if (abaPrincipal === 'RESULTADO') {
      abrirPdfDoFiltro({
        titulo: `Resultado mensal - ${formatarMesVisual(mesResultado)}`,
        subtitulo: 'Competência definida exclusivamente pelo mês de recebimento do cliente. Processos sem valor de compra ficam identificados e não entram no Profit apurado.',
        filtros: [
          { label: 'Mês de recebimento', valor: formatarMesVisual(mesResultado) },
        ],
        cards: [
          { label: 'Processos recebidos', valor: String(resultadoGeral.processos), detalhe: `${resultadoGeral.comCusto} com custo` },
          { label: 'Aguardando custo', valor: String(resultadoGeral.semCusto), detalhe: moeda(resultadoGeral.valorRecebidoSemCusto) + ' recebidos' },
          { label: 'Valor recebido', valor: moeda(resultadoGeral.valorRecebido), detalhe: 'Recebimento dos clientes' },
          { label: 'Profit apurado', valor: moeda(resultadoGeral.profitRecebido), detalhe: 'Somente processos com custo' },
          { label: 'Despesas + empréstimos', valor: moeda(resultadoGeral.saidasResultado), detalhe: 'Saídas do resultado operacional' },
          { label: 'Resultado operacional', valor: moeda(resultadoGeral.resultadoOperacional), detalhe: 'Profit - despesas - empréstimos' },
          { label: 'Retiradas dos sócios', valor: moeda(resultadoGeral.retiradasTotal), detalhe: `Marcos ${moeda(resultadoGeral.retiradasMarcos)} | Hérica ${moeda(resultadoGeral.retiradasHerica)}` },
          { label: 'Saídas totais de caixa', valor: moeda(resultadoGeral.saidasCaixaMes), detalhe: 'Inclui retiradas, fundo e ajustes negativos' },
          { label: 'Saldo líquido da competência', valor: moeda(resultadoGeral.saldoCaixaRealMes), detalhe: 'Profit + entradas extras - todas as saídas' },
        ],
        cabecalhos: [
          'Cliente',
          'AWB / Processo',
          'Fatura',
          'Recebimento',
          'Valor faturado',
          'DOC/DTA',
          'Terceiros',
          'Valor compra',
          'Profit HC',
          'Situação',
        ],
        linhas: resultadoGeral.processosDetalhados.map((item: any) => {
          const possuiCusto = Number(item.valor_compra || 0) > 0

          return [
            item.cliente || item.cliente_final || '-',
            item.awb || '-',
            item.fatura || '-',
            normalizarData(dataRecebimentoProcesso(item)) || '-',
            moeda(item.valor_cobranca || 0),
            moeda(item.doc_dta || 0),
            moeda(item.debito_terceiro || 0),
            possuiCusto ? moeda(item.valor_compra || 0) : 'AGUARDANDO CUSTO',
            possuiCusto ? moeda(calcularProfit(item)) : '-',
            possuiCusto ? 'PROFIT APURADO' : 'AGUARDANDO CUSTO',
          ]
        }),
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
    const retiradaLiberada = Number(resumoDono.podeRetirarAgora || 0) > 0
    const caixaSaudavel = Number(resumoPosicaoAtual.caixaLivreAtual || 0) > 0
    const coberturaCaixa = Math.max(0, Math.min(100, Number(resumoDono.percentualCaixa || 0)))

    const statusClasse =
      resumoDono.statusDono === 'CRÍTICO'
        ? 'border-red-300 bg-red-50 text-red-700'
        : resumoDono.statusDono === 'ATENÇÃO'
          ? 'border-amber-300 bg-amber-50 text-amber-700'
          : resumoDono.statusDono === 'SAUDÁVEL'
            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
            : 'border-blue-300 bg-blue-50 text-blue-700'

    const barraCaixaClasse =
      coberturaCaixa >= 100
        ? 'bg-emerald-500'
        : coberturaCaixa >= 60
          ? 'bg-blue-500'
          : coberturaCaixa >= 30
            ? 'bg-amber-500'
            : 'bg-red-500'

    return (
      <section className="space-y-5">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white lg:p-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-200">
                  Visão executiva
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">Saúde financeira da HC</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
                  Uma leitura direta para decidir caixa, obrigações e retiradas sem repetir os mesmos números em vários blocos.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={anoExtrato}
                  onChange={(e) => {
                    setAnoFinanceiro(e.target.value)
                    setAnoExtrato(e.target.value)
                    setPaginaExtrato(1)
                  }}
                  className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-black text-white outline-none backdrop-blur focus:ring-2 focus:ring-blue-400"
                >
                  <option value="TODOS" className="text-slate-900">Todos</option>
                  {ANOS_FINANCEIRO_PERMITIDOS.map((ano) => (
                    <option key={ano} value={String(ano)} className="text-slate-900">
                      {ano}
                    </option>
                  ))}
                </select>

                <div className={`rounded-xl border px-4 py-3 text-sm font-black ${statusClasse}`}>
                  {resumoDono.statusDono}
                </div>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
              <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-6 backdrop-blur">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                      Caixa livre bancário atual
                    </p>
                    <p className={`mt-3 text-4xl font-black tracking-tight ${caixaSaudavel ? 'text-emerald-300' : 'text-red-300'}`}>
                      {moeda(resumoPosicaoAtual.caixaLivreAtual)}
                    </p>
                    <p className="mt-2 max-w-xl text-sm font-semibold text-slate-300">
                      Saldo bancário real menos a Reserva HC protegida. A reserva não cria uma nova entrada de dinheiro.
                    </p>
                  </div>

                  <div className={`rounded-2xl border px-4 py-3 text-center ${retiradaLiberada ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-red-400/30 bg-red-400/10'}`}>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-300">Retirada hoje</p>
                    <p className={`mt-1 text-xl font-black ${retiradaLiberada ? 'text-emerald-300' : 'text-red-300'}`}>
                      {retiradaLiberada ? 'LIBERADA' : 'BLOQUEADA'}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <p className="text-xs font-bold text-slate-400">Saldo bancário real</p>
                    <p className="mt-1 text-2xl font-black text-white">
                      {resumoPosicaoAtual.possuiContas ? moeda(resumoPosicaoAtual.saldoBancarioReal) : 'Não informado'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                    <p className="text-xs font-bold text-slate-400">Reserva protegida</p>
                    <p className="mt-1 text-2xl font-black text-blue-300">
                      {moeda(resumoPosicaoAtual.reservaProtegida)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-6 backdrop-blur">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Cobertura financeira</p>
                    <p className="mt-2 text-3xl font-black">{coberturaCaixa.toFixed(0)}%</p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-slate-200">
                    Meta 100%
                  </div>
                </div>

                <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full rounded-full ${barraCaixaClasse}`} style={{ width: `${coberturaCaixa}%` }} />
                </div>

                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                    <span className="font-semibold text-slate-400">Caixa mínimo recomendado</span>
                    <span className="font-black">{moeda(resumoDono.caixaMinimoRecomendado)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                    <span className="font-semibold text-slate-400">Empréstimos mensais</span>
                    <span className="font-black">{moeda(resumoDono.emprestimosMensaisHC)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-400">Terceiros protegidos</span>
                    <span className="font-black">{moeda(resumoDono.terceirosProtegidos)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-2 md:divide-y-0 xl:grid-cols-4 xl:divide-x">
            <div className="p-5">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Profit HC</p>
              <p className="mt-2 text-2xl font-black text-emerald-700">{moeda(resumoDono.profitHC)}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Entrada operacional apurada</p>
            </div>
            <div className="p-5">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Resultado operacional</p>
              <p className={`mt-2 text-2xl font-black ${resumoDono.resultadoOperacional >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {moeda(resumoDono.resultadoOperacional)}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Profit menos obrigações de resultado</p>
            </div>
            <div className="p-5">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Dívida dos empréstimos</p>
              <p className="mt-2 text-2xl font-black text-violet-700">{moeda(resumoDono.saldoDevedorEmprestimosHC)}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{resumoDono.qtdEmprestimosHC} contratos ativos</p>
            </div>
            <div className="p-5">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Processos sem custo</p>
              <p className={`mt-2 text-2xl font-black ${resumoDono.qtdProcessosSemCompra > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {resumoDono.qtdProcessosSemCompra}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {moeda(resumoDono.valorRecebidoSemCompra)} recebidos aguardando compra
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Prioridades</p>
                <h3 className="mt-1 text-xl font-black text-slate-950">O que precisa de atenção agora</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  A ordem abaixo evita misturar dívida, caixa, terceiros e retirada.
                </p>
              </div>
              <div className={`rounded-xl border px-3 py-2 text-xs font-black ${statusClasse}`}>
                {resumoDono.maiorErroFinanceiro}
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-white">01</div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-slate-900">Regularizar o caixa</p>
                  <p className="text-xs font-semibold text-slate-500">Primeiro elimina o déficit real antes de novas retiradas.</p>
                </div>
                <p className={`text-right font-black ${resumoDono.caixaNegativoRealRegularizar > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {moeda(resumoDono.caixaNegativoRealRegularizar)}
                </p>
              </div>

              <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-white">02</div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-slate-900">Proteger valores de terceiros</p>
                  <p className="text-xs font-semibold text-slate-500">Esse dinheiro não compõe lucro nem retirada da HC.</p>
                </div>
                <p className="text-right font-black text-amber-700">{moeda(resumoDono.terceirosProtegidos)}</p>
              </div>

              <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-white">03</div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-slate-900">Cobrir compromissos mensais</p>
                  <p className="text-xs font-semibold text-slate-500">Parcelas dos empréstimos entram antes da distribuição.</p>
                </div>
                <p className="text-right font-black text-violet-700">{moeda(resumoDono.emprestimosMensaisHC)}</p>
              </div>

              <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-white">04</div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-slate-900">Completar custos pendentes</p>
                  <p className="text-xs font-semibold text-slate-500">Processos recebidos sem compra deixam o resultado parcial.</p>
                </div>
                <p className={`text-right font-black ${resumoDono.qtdProcessosSemCompra > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {resumoDono.qtdProcessosSemCompra} processo(s)
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-blue-600">Próxima ação recomendada</p>
              <p className="mt-1 text-sm font-bold leading-6 text-blue-950">{resumoDono.acaoRecomendada}</p>
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Sócios</p>
              <h3 className="mt-1 text-xl font-black text-slate-950">Distribuição 25% / 25%</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Mostra direito acumulado, retiradas registradas e saldo individual.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-slate-950">Marcos</p>
                    <p className="text-xs font-semibold text-slate-500">25% do lucro distribuível</p>
                  </div>
                  <Badge
                    texto={resumoDono.saldoMarcos >= 0 ? 'DENTRO DA REGRA' : 'ADIANTADO'}
                    classe={resumoDono.saldoMarcos >= 0 ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300'}
                  />
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase text-slate-400">Direito</p>
                    <p className="mt-1 font-black text-slate-900">{moeda(resumoDono.direitoMarcos)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase text-slate-400">Retirado</p>
                    <p className="mt-1 font-black text-red-700">{moeda(resumoDono.retiradasMarcos)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase text-slate-400">Saldo</p>
                    <p className={`mt-1 font-black ${resumoDono.saldoMarcos >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {moeda(resumoDono.saldoMarcos)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-slate-950">Hérica</p>
                    <p className="text-xs font-semibold text-slate-500">25% do lucro distribuível</p>
                  </div>
                  <Badge
                    texto={resumoDono.saldoHerica >= 0 ? 'DENTRO DA REGRA' : 'ADIANTADO'}
                    classe={resumoDono.saldoHerica >= 0 ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300'}
                  />
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase text-slate-400">Direito</p>
                    <p className="mt-1 font-black text-slate-900">{moeda(resumoDono.direitoHerica)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase text-slate-400">Retirado</p>
                    <p className="mt-1 font-black text-red-700">{moeda(resumoDono.retiradasHerica)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase text-slate-400">Saldo</p>
                    <p className={`mt-1 font-black ${resumoDono.saldoHerica >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {moeda(resumoDono.saldoHerica)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-slate-500">Total retirado pelos sócios</span>
                <span className="text-lg font-black text-slate-950">{moeda(resumoDono.retiradasTotal)}</span>
              </div>
            </div>
          </section>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Extrato financeiro</p>
              <h3 className="mt-1 text-xl font-black text-slate-950">Entradas, saídas e reservas separadas</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Reserva aparece com natureza própria e não soma nos totais de entradas ou saídas reais.
              </p>
            </div>
            <button
              type="button"
              onClick={limparFiltrosExtrato}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              Limpar filtros
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              value={buscaExtrato}
              onChange={(e) => { setBuscaExtrato(e.target.value); setPaginaExtrato(1) }}
              placeholder="Buscar tipo, descrição, categoria..."
              className="rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <MultiSelect
              label="Tipo"
              values={tipoExtrato}
              onChange={(valores) => { setTipoExtrato(valores); setPaginaExtrato(1) }}
              options={TIPOS_EXTRATO}
              placeholder="Todos os tipos"
            />
            <MultiSelect
              label="Status"
              values={filtroStatusExtrato}
              onChange={(valores) => { setFiltroStatusExtrato(valores); setPaginaExtrato(1) }}
              options={STATUS_MOVIMENTOS}
              placeholder="Todos os status"
            />
            <MultiSelect
              label="Sócio"
              values={filtroSocioExtrato}
              onChange={(valores) => { setFiltroSocioExtrato(valores); setPaginaExtrato(1) }}
              options={SOCIOS_OPCOES}
              placeholder="Todos os sócios"
            />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <FiltroResumoCard titulo="Entradas reais" valor={moeda(resumoExtrato.entradas)} detalhe="Reserva não incluída" classe="bg-emerald-50 text-emerald-700 border-emerald-100" />
            <FiltroResumoCard titulo="Saídas reais" valor={moeda(resumoExtrato.saidas)} detalhe="Movimentações efetivas" classe="bg-red-50 text-red-700 border-red-100" />
            <FiltroResumoCard titulo="Reservas" valor={moeda(resumoExtrato.reservas)} detalhe="Destinação, sem movimento bancário" classe="bg-blue-50 text-blue-700 border-blue-100" />
            <FiltroResumoCard titulo="Saldo movimentado" valor={moeda(resumoExtrato.saldoMovimentado)} detalhe="Entradas reais - saídas reais" classe="bg-slate-50 text-slate-900 border-slate-200" />
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[1450px] w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <Th>Data</Th>
                  <Th>Mês</Th>
                  <Th>Natureza</Th>
                  <Th>Tipo</Th>
                  <Th>Categoria</Th>
                  <Th>Descrição</Th>
                  <Th>Sócio</Th>
                  <Th>Entrada</Th>
                  <Th>Saída</Th>
                  <Th>Reserva</Th>
                  <Th>Status</Th>
                  <Th>Forma</Th>
                </tr>
              </thead>
              <tbody>
                {extratoPaginado.length === 0 ? (
                  <tr><td colSpan={12} className="p-6 text-center text-gray-500">Nenhuma movimentação encontrada no extrato.</td></tr>
                ) : (
                  extratoPaginado.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <Td>{normalizarData(item.data) || '-'}</Td>
                      <Td>{item.mes || '-'}</Td>
                      <Td>
                        <Badge
                          texto={item.natureza || '-'}
                          classe={
                            item.natureza === 'RESERVA'
                              ? 'bg-blue-100 text-blue-700 border-blue-300'
                              : item.natureza === 'ENTRADA'
                                ? 'bg-green-100 text-green-700 border-green-300'
                                : item.natureza === 'SAÍDA'
                                  ? 'bg-red-100 text-red-700 border-red-300'
                                  : 'bg-gray-100 text-gray-700 border-gray-300'
                          }
                        />
                      </Td>
                      <Td>{item.tipoLabel || item.tipo}</Td>
                      <Td>{item.categoria || '-'}</Td>
                      <Td>{item.descricao || '-'}</Td>
                      <Td>{item.socio || '-'}</Td>
                      <Td>{item.entrada > 0 ? moeda(item.entrada) : '-'}</Td>
                      <Td>{item.saida > 0 ? moeda(item.saida) : '-'}</Td>
                      <Td>{item.reserva > 0 ? moeda(item.reserva) : '-'}</Td>
                      <Td><Badge texto={item.status || '-'} classe={badgeStatus(item.status || '')} /></Td>
                      <Td>{item.forma_pagamento || '-'}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Paginacao
            pagina={paginaExtrato}
            totalPaginas={totalPaginasExtrato}
            onAnterior={() => setPaginaExtrato((p) => Math.max(1, p - 1))}
            onProxima={() => setPaginaExtrato((p) => Math.min(totalPaginasExtrato, p + 1))}
          />
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
            Visão executiva, resultado mensal, processos faturados, despesas, sócios e conciliação bancária
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
                <option value="TODOS">Todos os anos</option>
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
        <TabButton ativo={abaPrincipal === 'EXTRATO'} onClick={() => mudarAbaPrincipal('EXTRATO')}>Visão Executiva</TabButton>
        <TabButton ativo={abaPrincipal === 'RESULTADO'} onClick={() => mudarAbaPrincipal('RESULTADO')}>Resultado Mensal</TabButton>
        <TabButton ativo={abaPrincipal === 'PROCESSOS'} onClick={() => mudarAbaPrincipal('PROCESSOS')}>Processos Faturados</TabButton>
        <TabButton ativo={abaPrincipal === 'DESPESAS'} onClick={() => mudarAbaPrincipal('DESPESAS')}>Despesas</TabButton>
        <TabButton ativo={abaPrincipal === 'SOCIOS'} onClick={() => mudarAbaPrincipal('SOCIOS')}>Retiradas / Sócios</TabButton>
        <TabButton ativo={abaPrincipal === 'FUNDO'} onClick={() => mudarAbaPrincipal('FUNDO')}>Caixa & Fundo</TabButton>
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


              <div className="rounded-2xl border border-blue-900 bg-[#020817] p-3">
                <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Ano do relatório
                </label>

                <select
                  value={filtroAnoProcessos}
                  onChange={(e) => {
                    const novoAno = e.target.value
                    setFiltroAnoProcessos(novoAno)

                    if (
                      filtroMesProcessos &&
                      novoAno !== 'TODOS' &&
                      !filtroMesProcessos.startsWith(novoAno)
                    ) {
                      setFiltroMesProcessos('')
                    }
                  }}
                  className="mt-2 w-full rounded-xl border border-blue-900 bg-[#071225] px-3 py-3 text-sm font-black text-white outline-none"
                >
                  <option value="TODOS">Todos os anos</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                  <option value="2023">2023</option>
                  <option value="2022">2022</option>
                </select>

                <p className="mt-2 text-[11px] font-bold text-slate-500">
                  {filtroAnoProcessos === 'TODOS' ? 'Todos os anos permitidos' : `Processos de ${filtroAnoProcessos}`}
                </p>
              </div>

              <div className="rounded-2xl border border-blue-900 bg-[#020817] p-3">
                <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Mês do relatório
                </label>

                <div className="mt-2 flex gap-2">
                  <input
                    type="month"
                    value={filtroMesProcessos}
                    onChange={(e) => setFiltroMesProcessos(e.target.value)}
                    className="w-full rounded-xl border border-blue-900 bg-[#071225] px-3 py-3 text-sm font-black text-white outline-none"
                  />

                  {filtroMesProcessos ? (
                    <button
                      type="button"
                      onClick={() => setFiltroMesProcessos('')}
                      className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-black hover:bg-slate-600"
                    >
                      Limpar
                    </button>
                  ) : null}
                </div>

                <p className="mt-2 text-[11px] font-bold text-slate-500">
                  {filtroMesProcessos ? textoMesAnoProcessos(filtroMesProcessos) : 'Todos os meses do ano selecionado'}
                </p>
              </div>

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

                {resumoFiltrado.aguardandoCusto > 0 && (
                  <button
                    type="button"
                    onClick={revisarCustosFaturasTransportadoras}
                    disabled={revisandoCustos || loading}
                    className="inline-flex w-fit rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-white hover:bg-orange-600 disabled:opacity-50"
                  >
                    {revisandoCustos ? 'Revisando custos...' : '↻ Revisar custos DHL/FedEx'}
                  </button>
                )}

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
                          <Td>{dataRecebimentoProcesso(item) || '-'}</Td>
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
        <section className="space-y-5">
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white lg:p-7">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-3xl">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-200">Caixa & conciliação</p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight">Caixa real, reserva e conciliação</h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
                    Reserva é destinação do dinheiro que já existe: não aumenta o saldo bancário. O caixa livre é o saldo real dos bancos menos obrigações identificadas e menos a reserva protegida.
                  </p>
                </div>

                <div className={`rounded-2xl border px-5 py-4 text-center ${
                  resumoConciliacaoBancaria.status === 'CONCILIADO'
                    ? 'border-emerald-400/30 bg-emerald-400/10'
                    : ['A CONFERIR', 'A CONCILIAR'].includes(resumoConciliacaoBancaria.status)
                      ? 'border-amber-400/30 bg-amber-400/10'
                      : 'border-blue-400/30 bg-blue-400/10'
                }`}>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">Status da conciliação</p>
                  <p className={`mt-1 text-xl font-black ${
                    resumoConciliacaoBancaria.status === 'CONCILIADO'
                      ? 'text-emerald-300'
                      : ['A CONFERIR', 'A CONCILIAR'].includes(resumoConciliacaoBancaria.status)
                        ? 'text-amber-300'
                        : 'text-blue-300'
                  }`}>
                    {resumoConciliacaoBancaria.status}
                  </p>
                </div>
              </div>

              <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl border border-blue-400/30 bg-blue-400/10 p-5 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-wide text-blue-200">Saldo bancário real</p>
                  <p className="mt-2 text-2xl font-black text-white">
                    {resumoPosicaoAtual.possuiContas ? moeda(resumoPosicaoAtual.saldoBancarioReal) : 'Não informado'}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-blue-200">Dinheiro efetivamente informado nas contas da HC</p>
                </div>

                <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-wide text-red-200">Compromissos operacionais</p>
                  <p className="mt-2 text-2xl font-black text-red-200">{moeda(resumoPosicaoAtual.compromissosOperacionais)}</p>
                  <p className="mt-1 text-xs font-semibold text-red-200">Faturas DHL/FedEx em aberto + terceiros ainda não pagos</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-5 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">Reserva protegida</p>
                  <p className="mt-2 text-2xl font-black text-blue-300">{moeda(resumoPosicaoAtual.reservaProtegida)}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">Reserva física constituída após a base de 17/08/2026</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-5 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">Caixa livre atual</p>
                  <p className={`mt-2 text-2xl font-black ${resumoPosicaoAtual.caixaLivreAtual > 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {moeda(resumoPosicaoAtual.caixaLivreAtual)}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">Saldo bancário - compromissos - reserva protegida</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-5 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">Saldo esperado desde a base</p>
                  <p className={`mt-2 text-2xl font-black ${resumoConciliacaoBancaria.saldoEsperado >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {moeda(resumoConciliacaoBancaria.saldoEsperado)}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">Base 17/08/2026 + movimentos reais posteriores</p>
                </div>
              </div>
            </div>

            {(erroCompromissosCaixa || resumoPosicaoAtual.qtdFaturasMoedaNaoBRL > 0) && (
              <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-amber-100">
                <p className="font-black">Caixa livre bloqueado para novas reservas</p>
                <p className="mt-1 text-sm font-semibold">
                  {erroCompromissosCaixa
                    ? `Não foi possível ler as obrigações DHL/FedEx: ${erroCompromissosCaixa}`
                    : `${resumoPosicaoAtual.qtdFaturasMoedaNaoBRL} fatura(s) de transportadora estão em moeda diferente de BRL e precisam ser revisadas antes de constituir reserva.`}
                </p>
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.08fr_0.92fr]">
            <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Conciliação bancária</p>
                  <h3 className="mt-1 text-xl font-black text-slate-950">Saldo atual x saldo esperado desde a data-base</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Data-base {normalizarData(resumoConciliacaoBancaria.dataBase)} com saldo-base de {moeda(resumoConciliacaoBancaria.saldoBase)}. A conciliação não depende do filtro de ano/mês e reserva não entra como movimentação de caixa.
                  </p>
                </div>

                {resumoConciliacaoBancaria.possuiContas && (
                  <div className={`rounded-xl border px-4 py-3 text-right ${
                    Math.abs(resumoConciliacaoBancaria.diferenca) <= 1
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-amber-200 bg-amber-50'
                  }`}>
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Diferença a conciliar</p>
                    <p className={`mt-1 text-xl font-black ${Math.abs(resumoConciliacaoBancaria.diferenca) <= 1 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {moeda(resumoConciliacaoBancaria.diferenca)}
                    </p>
                  </div>
                )}
              </div>

              {erroContasBancarias && (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="font-black text-amber-900">Conciliação bancária ainda não habilitada</p>
                  <p className="mt-1 text-sm font-semibold text-amber-700">
                    Rode o SQL da tabela financeiro_contas_bancarias no Supabase. Detalhe: {erroContasBancarias}
                  </p>
                </div>
              )}

              <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-[0.9fr_1.2fr_0.8fr_auto]">
                <div>
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500">Banco</label>
                  <input
                    value={formContaBancaria.banco}
                    onChange={(e) => setFormContaBancaria({ ...formContaBancaria, banco: e.target.value })}
                    placeholder="Ex.: Itaú"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500">Conta / identificação</label>
                  <input
                    value={formContaBancaria.nome_conta}
                    onChange={(e) => setFormContaBancaria({ ...formContaBancaria, nome_conta: e.target.value })}
                    placeholder="Ex.: Conta corrente HC"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-wide text-slate-500">Saldo atual R$</label>
                  <input
                    value={formContaBancaria.saldo_atual}
                    onChange={(e) => setFormContaBancaria({ ...formContaBancaria, saldo_atual: e.target.value })}
                    placeholder="0,00"
                    inputMode="decimal"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={salvarContaBancaria}
                    disabled={salvandoContaBancaria || loadingContasBancarias}
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {salvandoContaBancaria ? 'Salvando...' : editandoContaBancariaId ? 'Atualizar' : 'Adicionar'}
                  </button>
                  {editandoContaBancariaId && (
                    <button
                      type="button"
                      onClick={limparFormContaBancaria}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                {loadingContasBancarias ? (
                  <div className="p-5 text-sm font-bold text-slate-500">Carregando saldos bancários...</div>
                ) : contasBancarias.length === 0 ? (
                  <div className="p-5 text-sm font-bold text-slate-500">Nenhuma conta informada. Adicione os saldos atuais para iniciar a conciliação.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {contasBancarias.map((item) => (
                      <div key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-black text-slate-950">{item.banco} · {item.nome_conta}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            Referência {normalizarData(item.data_referencia) || '-'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-xl font-black text-slate-950">{moeda(item.saldo_atual)}</p>
                          <button type="button" onClick={() => editarContaBancaria(item)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-50">Editar</button>
                          <button type="button" onClick={() => arquivarContaBancaria(item)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-50">Remover</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {resumoConciliacaoBancaria.possuiContas && (
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-black uppercase text-slate-400">Total nos bancos</p>
                    <p className="mt-1 text-xl font-black text-slate-950">{moeda(resumoConciliacaoBancaria.saldoBancarioReal)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-black uppercase text-slate-400">Saldo esperado desde a base</p>
                    <p className="mt-1 text-xl font-black text-slate-950">{moeda(resumoConciliacaoBancaria.saldoEsperado)}</p>
                  </div>
                  <div className={`rounded-2xl border p-4 ${Math.abs(resumoConciliacaoBancaria.diferenca) <= 1 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                    <p className="text-[11px] font-black uppercase text-slate-500">Diferença a conciliar</p>
                    <p className={`mt-1 text-xl font-black ${Math.abs(resumoConciliacaoBancaria.diferenca) <= 1 ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {moeda(resumoConciliacaoBancaria.diferenca)}
                    </p>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Reserva e proteção</p>
                <h3 className="mt-1 text-xl font-black text-slate-950">Meta de reserva da HC</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Reserva é uma meta financeira. Ela não representa automaticamente dinheiro disponível em conta.
                </p>
              </div>

              <div className="mt-6 space-y-3">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-blue-500">Reserva prevista acumulada</p>
                  <p className="mt-1 text-2xl font-black text-blue-700">{moeda(resumoPosicaoAtual.reservaPrevistaAcumulada)}</p>
                  <p className="mt-1 text-xs font-semibold text-blue-600">Soma de 50% dos resultados positivos por competência.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-black uppercase text-slate-400">Reserva constituída</p>
                    <p className="mt-1 text-lg font-black text-slate-900">{moeda(resumoPosicaoAtual.reservaConstituida)}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Base física em 17/08/2026: R$ 0,00. Só entram reservas efetivamente constituídas depois dessa data.</p>
                  </div>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-[11px] font-black uppercase text-amber-500">Reserva pendente</p>
                    <p className="mt-1 text-lg font-black text-amber-700">{moeda(resumoPosicaoAtual.reservaPendente)}</p>
                    <p className="mt-1 text-xs font-semibold text-amber-600">Soma das competências que ainda não receberam os 50% previstos.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                    <p className="text-[11px] font-black uppercase text-red-500">Faturas transportadoras a pagar</p>
                    <p className="mt-1 text-lg font-black text-red-700">{moeda(resumoPosicaoAtual.compromissoTransportadoras)}</p>
                  </div>
                  <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                    <p className="text-[11px] font-black uppercase text-orange-500">Terceiros a pagar</p>
                    <p className="mt-1 text-lg font-black text-orange-700">{moeda(resumoPosicaoAtual.compromissoTerceiros)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-[11px] font-black uppercase text-emerald-600">Caixa livre para constituir reserva</p>
                    <p className="mt-1 text-lg font-black text-emerald-700">{moeda(resumoPosicaoAtual.caixaLivreAtual)}</p>
                    <p className="mt-1 text-xs font-semibold text-emerald-700">Pode atender competência antiga sem mudar a competência original.</p>
                  </div>
                  <div className={`rounded-2xl border p-4 ${resumoPosicaoAtual.reservaSemCobertura > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                    <p className={`text-[11px] font-black uppercase ${resumoPosicaoAtual.reservaSemCobertura > 0 ? 'text-red-600' : 'text-slate-400'}`}>Reserva sem cobertura bancária</p>
                    <p className={`mt-1 text-lg font-black ${resumoPosicaoAtual.reservaSemCobertura > 0 ? 'text-red-700' : 'text-slate-900'}`}>{moeda(resumoPosicaoAtual.reservaSemCobertura)}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Só existe quando a reserva física constituída supera o saldo bancário disponível depois das obrigações identificadas.</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-slate-500">Processos pagos sem custo</span>
                    <span className={`text-lg font-black ${resumoCaixaRealProfit.processosSemCusto > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {resumoCaixaRealProfit.processosSemCusto}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-500">Processos sem compra deixam o Profit parcial e podem alterar a reserva calculada.</p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">Receita bruta informativa</p>
                  <p className="mt-1 text-xl font-black text-slate-900">{moeda(resumoCaixaRealProfit.valorRecebidoBruto)}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Receita do cliente não é igual a dinheiro livre da HC.</p>
                </div>
              </div>
            </section>
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Formação do cálculo</p>
              <h3 className="mt-1 text-xl font-black text-slate-950">Como o HC Connect chega ao saldo esperado</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                A conciliação parte do saldo-base de 17/08/2026 e considera somente efeitos reais posteriores. Reserva não entra nesta conta porque não movimenta o banco.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3"><span className="font-bold text-slate-700">Saldo-base em 17/08/2026</span><strong className="text-blue-700">{moeda(resumoConciliacaoBancaria.saldoBase)}</strong></div>
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3"><span className="font-bold text-slate-700">Recebimentos de clientes após a base</span><strong className="text-emerald-700">+ {moeda(resumoConciliacaoBancaria.recebimentosClientesAposBase)}</strong></div>
                <div className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3"><span className="font-bold text-slate-700">Pagamentos DHL/FedEx após a base</span><strong className="text-red-700">- {moeda(resumoConciliacaoBancaria.pagamentosTransportadorasAposBase)}</strong></div>
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3"><span className="font-bold text-slate-700">Entradas reais após a base</span><strong className="text-emerald-700">+ {moeda(resumoConciliacaoBancaria.entradasReaisAposBase)}</strong></div>
                <div className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3"><span className="font-bold text-slate-700">Saídas reais após a base</span><strong className="text-red-700">- {moeda(resumoConciliacaoBancaria.saidasReaisAposBase)}</strong></div>
                <div className="flex items-center justify-between rounded-xl border border-slate-900 bg-slate-950 px-4 py-4 text-white"><span className="font-black">Saldo esperado HC Connect</span><strong className={`text-2xl ${resumoConciliacaoBancaria.saldoEsperado >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{moeda(resumoConciliacaoBancaria.saldoEsperado)}</strong></div>
              </div>

              <div className="space-y-2">
                <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-wide text-blue-600">Reserva fora do fluxo</p>
                  <p className="mt-1 text-sm font-bold text-blue-950">Reserva constituída: {moeda(resumoPosicaoAtual.reservaConstituida)}</p>
                  <p className="mt-1 text-xs font-semibold text-blue-700">Ela protege parte do saldo bancário, mas não é somada como entrada nem subtraída como saída.</p>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-wide text-amber-600">Recebimentos a conferir</p>
                  <p className="mt-1 text-sm font-bold text-amber-950">{resumoConciliacaoBancaria.qtdRecebimentosAConferir} processo(s) · {moeda(resumoConciliacaoBancaria.valorRecebimentosAConferir)}</p>
                  <p className="mt-1 text-xs font-semibold text-amber-700">Em aberto/atrasados podem já ter sido pagos no banco e ainda não classificados no Financeiro.</p>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-wide text-amber-600">Pagos sem custo após a base</p>
                  <p className="mt-1 text-sm font-bold text-amber-950">{resumoConciliacaoBancaria.qtdProcessosSemCustoAposBase} processo(s) · {moeda(resumoConciliacaoBancaria.valorProcessosSemCustoAposBase)}</p>
                  <p className="mt-1 text-xs font-semibold text-amber-700">Ainda não entram no efeito líquido até o valor de compra ser informado.</p>
                </div>
              </div>
            </div>

            {resumoConciliacaoBancaria.possuiContas && Math.abs(resumoConciliacaoBancaria.diferenca) > TOLERANCIA_CONCILIACAO && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="font-black text-amber-900">Existe diferença a conciliar — isso não significa automaticamente dinheiro faltando</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-amber-800">
                  A diferença atual é {moeda(resumoConciliacaoBancaria.diferenca)} entre o saldo bancário informado e o saldo esperado desde a data-base. Antes de tratar como desvio, confira pagamentos de clientes ainda marcados como em aberto/atrasados, processos pagos sem custo e movimentações reais ainda não classificadas. Reservas não participam dessa diferença.
                </p>
              </div>
            )}
          </section>

          {renderFormularioMovimento(
            'Nova movimentação / ajuste de caixa',
            'Registre aqui somente movimentações reais de caixa. Reservas são constituídas pelo fechamento mensal e não criam entrada financeira. Despesas e retiradas permanecem em suas abas específicas.'
          )}
          {renderTabelaMovimentos()}
        </section>
      )}

      {abaPrincipal === 'EXTRATO' && renderExtratoGeral()}

      {abaPrincipal === 'RESULTADO' && (
        <section className="space-y-5">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">Resultado por recebimento</p>
                <h2 className="mt-1 text-2xl font-black text-gray-950">Resultado Mensal</h2>
                <p className="mt-1 text-sm font-semibold text-gray-500">
                  Cada processo pertence ao mês em que o cliente pagou. Processo recebido sem valor de compra permanece no mês, mas fica fora do Profit até o custo ser lançado.
                </p>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-end">
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
                  className="whitespace-nowrap rounded-xl bg-green-600 px-5 py-3 font-bold text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {gerandoFechamento ? 'Gerando...' : resultadoGeral.semCusto > 0 ? 'Gerar fechamento parcial' : 'Gerar ou complementar fechamento'}
                </button>

                <button
                  type="button"
                  onClick={gerarFechamentosRetroativos}
                  disabled={gerandoRetroativos || loading || loadingMovimentos}
                  className="whitespace-nowrap rounded-xl bg-slate-900 px-5 py-3 font-bold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {gerandoRetroativos ? 'Gerando retroativos...' : 'Gerar retroativos'}
                </button>

                <button
                  type="button"
                  onClick={gerarPDFFechamentoMensal}
                  disabled={loading || loadingMovimentos || !mesResultado}
                  className="whitespace-nowrap rounded-xl bg-blue-600 px-5 py-3 font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Relatório completo PDF
                </button>
              </div>
            </div>
          </section>

          {resultadoGeral.semCusto > 0 && (
            <section className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-lg font-black text-orange-900">Resultado ainda parcial</h3>
                  <p className="mt-1 text-sm font-bold text-orange-800">
                    {resultadoGeral.semCusto} processo(s) recebido(s) em {formatarMesVisual(mesResultado)} ainda não possuem valor de compra.
                    Eles somam {moeda(resultadoGeral.valorRecebidoSemCusto)} em faturamento recebido e não entram no Profit apurado agora.
                  </p>
                </div>
                <span className="rounded-full border border-orange-300 bg-white px-4 py-2 text-xs font-black text-orange-800">
                  Complementar após lançar os custos
                </span>
              </div>

              <p className="mt-3 break-words text-xs font-bold text-orange-700">
                Referências: {resultadoGeral.processosSemCustoDetalhados
                  .map((item: any) => item.awb || item.fatura || item.id)
                  .filter(Boolean)
                  .join(', ') || 'sem referência'}
              </p>
            </section>
          )}

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <FiltroResumoCard titulo="Processos recebidos" valor={String(resultadoGeral.processos)} detalhe={`${resultadoGeral.comCusto} com custo`} classe="bg-white text-blue-700 border-blue-100" />
            <FiltroResumoCard titulo="Aguardando custo" valor={String(resultadoGeral.semCusto)} detalhe={moeda(resultadoGeral.valorRecebidoSemCusto) + ' recebidos'} classe={resultadoGeral.semCusto > 0 ? 'bg-white text-orange-700 border-orange-200' : 'bg-white text-green-700 border-green-100'} />
            <FiltroResumoCard titulo="Valor recebido" valor={moeda(resultadoGeral.valorRecebido)} detalhe="Receita recebida dos clientes" classe="bg-white text-blue-700 border-blue-100" />
            <FiltroResumoCard titulo="Profit apurado" valor={moeda(resultadoGeral.profitRecebido)} detalhe="Somente processos com custo" classe="bg-white text-green-700 border-green-100" />
            <FiltroResumoCard titulo="Despesas + empréstimos" valor={moeda(resultadoGeral.saidasResultado)} detalhe="Saídas do resultado operacional" classe="bg-white text-red-700 border-red-100" />
            <FiltroResumoCard titulo="Resultado operacional" valor={moeda(resultadoGeral.resultadoOperacional)} detalhe="Profit - despesas - empréstimos" classe={resultadoGeral.resultadoOperacional >= 0 ? 'bg-white text-green-700 border-green-100' : 'bg-white text-red-700 border-red-100'} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
            <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">Movimentação real do mês</p>
                <h3 className="mt-1 text-xl font-black">Todas as entradas e saídas de caixa</h3>
                <p className="mt-1 text-sm font-semibold text-slate-400">
                  Aqui entram retiradas dos sócios, despesas, empréstimos, saídas de fundo e ajustes de caixa.
                </p>
              </div>
              <div className={`rounded-2xl border px-4 py-3 text-right ${resultadoGeral.saldoCaixaRealMes >= 0 ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-red-400/30 bg-red-400/10'}`}>
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Saldo líquido da competência</p>
                <p className={`mt-1 text-2xl font-black ${resultadoGeral.saldoCaixaRealMes >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {moeda(resultadoGeral.saldoCaixaRealMes)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <p className="text-xs font-black uppercase text-slate-400">Retiradas dos sócios</p>
                <p className="mt-2 text-xl font-black text-red-300">{moeda(resultadoGeral.retiradasTotal)}</p>
                <p className="mt-1 text-xs font-semibold text-slate-400">Marcos {moeda(resultadoGeral.retiradasMarcos)} · Hérica {moeda(resultadoGeral.retiradasHerica)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <p className="text-xs font-black uppercase text-slate-400">Saídas de fundo / caixa</p>
                <p className="mt-2 text-xl font-black text-red-300">{moeda(resultadoGeral.saidasFundoMes)}</p>
                <p className="mt-1 text-xs font-semibold text-slate-400">Movimentações pagas com impacto no caixa</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <p className="text-xs font-black uppercase text-slate-400">Ajustes negativos</p>
                <p className="mt-2 text-xl font-black text-red-300">{moeda(resultadoGeral.ajustesNegativosMes)}</p>
                <p className="mt-1 text-xs font-semibold text-slate-400">Correções e abatimentos de caixa</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <p className="text-xs font-black uppercase text-slate-400">Entradas extras</p>
                <p className="mt-2 text-xl font-black text-emerald-300">{moeda(resultadoGeral.entradasCaixaMes)}</p>
                <p className="mt-1 text-xs font-semibold text-slate-400">Aportes + entradas extraordinárias + ajustes positivos</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <p className="text-xs font-black uppercase text-slate-400">Saídas totais de caixa</p>
                <p className="mt-2 text-xl font-black text-red-300">{moeda(resultadoGeral.saidasCaixaMes)}</p>
                <p className="mt-1 text-xs font-semibold text-slate-400">Inclui todas as saídas pagas do mês</p>
              </div>
            </div>
          </section>

          <GraficoEvolucaoMensal
            dados={evolucaoResultadoAnual}
            moeda={moeda}
            ano={String(mesResultado || '').slice(0, 4)}
          />

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="text-xl font-black text-gray-950">Processos que formam o resultado</h3>
                <p className="text-sm font-semibold text-gray-500">
                  Relação completa dos processos recebidos em {formatarMesVisual(mesResultado)}. Aqui você consegue conferir exatamente de onde saiu o Profit.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-black">
                <span className="rounded-full border border-green-200 bg-green-50 px-3 py-2 text-green-700">
                  {resultadoGeral.comCusto} com Profit apurado
                </span>
                <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-2 text-orange-700">
                  {resultadoGeral.semCusto} aguardando custo
                </span>
              </div>
            </div>

            {resultadoGeral.processosDetalhados.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm font-bold text-gray-500">
                Nenhum processo recebido neste mês.
              </div>
            ) : (
              <div className="max-h-[560px] overflow-auto rounded-xl border border-gray-200">
                <table className="w-full min-w-[1500px] border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-900 text-white">
                    <tr>
                      <th className="px-3 py-3 text-left">Cliente</th>
                      <th className="px-3 py-3 text-left">AWB / Processo</th>
                      <th className="px-3 py-3 text-left">Fatura</th>
                      <th className="px-3 py-3 text-left">Recebimento</th>
                      <th className="px-3 py-3 text-right">Faturado</th>
                      <th className="px-3 py-3 text-right">DOC/DTA</th>
                      <th className="px-3 py-3 text-right">Terceiros</th>
                      <th className="px-3 py-3 text-right">Compra</th>
                      <th className="px-3 py-3 text-right">Profit HC</th>
                      <th className="px-3 py-3 text-left">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultadoGeral.processosDetalhados.map((item: any) => {
                      const possuiCusto = Number(item.valor_compra || 0) > 0

                      return (
                        <tr key={item.id || `${item.awb}-${item.fatura}`} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-3 font-bold text-gray-900">{item.cliente || item.cliente_final || '-'}</td>
                          <td className="px-3 py-3 font-black text-blue-700">{item.awb || '-'}</td>
                          <td className="px-3 py-3 text-gray-700">{item.fatura || '-'}</td>
                          <td className="px-3 py-3 text-gray-700">{normalizarData(dataRecebimentoProcesso(item)) || '-'}</td>
                          <td className="px-3 py-3 text-right font-bold text-gray-900">{moeda(item.valor_cobranca || 0)}</td>
                          <td className="px-3 py-3 text-right text-gray-700">{moeda(item.doc_dta || 0)}</td>
                          <td className="px-3 py-3 text-right text-gray-700">{moeda(item.debito_terceiro || 0)}</td>
                          <td className={`px-3 py-3 text-right font-bold ${possuiCusto ? 'text-gray-900' : 'text-orange-700'}`}>
                            {possuiCusto ? moeda(item.valor_compra || 0) : 'Aguardando'}
                          </td>
                          <td className={`px-3 py-3 text-right font-black ${possuiCusto ? 'text-green-700' : 'text-gray-400'}`}>
                            {possuiCusto ? moeda(calcularProfit(item)) : '-'}
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${
                              possuiCusto
                                ? 'border-green-200 bg-green-50 text-green-700'
                                : 'border-orange-200 bg-orange-50 text-orange-700'
                            }`}>
                              {possuiCusto ? 'PROFIT APURADO' : 'AGUARDANDO CUSTO'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-black text-gray-950">Resultado operacional</h3>
              <p className="mt-1 text-sm font-semibold text-gray-500">
                Mede o desempenho da operação antes de retiradas e movimentações de caixa dos sócios.
              </p>

              <div className="mt-4 space-y-3 text-sm">
                <LinhaResultado label="Profit HC apurado" valor={resultadoGeral.profitRecebido} positivo />
                <LinhaResultado label="Despesas pagas" valor={resultadoGeral.despesasPagas} negativo />
                <LinhaResultado label="Empréstimos pagos" valor={resultadoGeral.emprestimosPagos} negativo />
                <LinhaResultado label="Resultado operacional" valor={resultadoGeral.resultadoOperacional} destaque />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-black text-gray-950">Caixa do mês</h3>
              <p className="mt-1 text-sm font-semibold text-gray-500">
                Mostra o que realmente sobrou depois de todas as movimentações pagas.
              </p>

              <div className="mt-4 space-y-3 text-sm">
                <LinhaResultado label="Resultado operacional" valor={resultadoGeral.resultadoOperacional} positivo={resultadoGeral.resultadoOperacional >= 0} />
                <LinhaResultado label="Retirada Marcos" valor={resultadoGeral.retiradasMarcos} negativo />
                <LinhaResultado label="Retirada Hérica" valor={resultadoGeral.retiradasHerica} negativo />
                <LinhaResultado label="Saídas fundo / caixa" valor={resultadoGeral.saidasFundoMes} negativo />
                <LinhaResultado label="Ajustes negativos" valor={resultadoGeral.ajustesNegativosMes} negativo />
                <LinhaResultado label="Entradas extras" valor={resultadoGeral.entradasCaixaMes} positivo />
                <LinhaResultado label="Saldo líquido da competência" valor={resultadoGeral.saldoCaixaRealMes} destaque />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-black text-gray-950">Distribuição do lucro</h3>
              <p className="mt-1 text-sm font-semibold text-gray-500">
                A regra 50% / 25% / 25% usa o resultado operacional positivo; retiradas são abatidas do saldo individual.
              </p>

              <div className="mt-4 space-y-3 text-sm">
                <LinhaResultado label="50% fundo previsto" valor={resultadoGeral.fundoPrevistoMes} />
                <LinhaResultado label="25% Marcos" valor={resultadoGeral.parteMarcos} />
                <LinhaResultado label="Já retirado Marcos" valor={resultadoGeral.retiradasMarcos} negativo />
                <LinhaResultado label="Saldo Marcos" valor={resultadoGeral.saldoMarcos} destaque />
                <LinhaResultado label="25% Hérica" valor={resultadoGeral.parteHerica} />
                <LinhaResultado label="Já retirado Hérica" valor={resultadoGeral.retiradasHerica} negativo />
                <LinhaResultado label="Saldo Hérica" valor={resultadoGeral.saldoHerica} destaque />
                <LinhaResultado label="Fundo ainda pendente" valor={resultadoGeral.saldoFundoMes} destaque />
              </div>
            </div>
          </section>
        </section>
      )}

    </main>
  )
}


function GraficoEvolucaoMensal({ dados, moeda, ano }: any) {
  const largura = 1200
  const altura = 360
  const margemEsquerda = 72
  const margemDireita = 24
  const margemTopo = 28
  const margemBaixo = 54
  const larguraGrafico = largura - margemEsquerda - margemDireita
  const alturaGrafico = altura - margemTopo - margemBaixo

  const series = [
    { chave: 'valorRecebido', label: 'Valor recebido', cor: '#2563eb' },
    { chave: 'profitRecebido', label: 'Profit HC', cor: '#16a34a' },
    { chave: 'saidasCaixaMes', label: 'Saídas totais de caixa', cor: '#dc2626' },
    { chave: 'saldoCaixaRealMes', label: 'Saldo líquido da competência', cor: '#7c3aed' },
  ]

  const valores = dados.flatMap((item: any) =>
    series.map((serie) => Number(item?.[serie.chave] || 0))
  )

  const minimoBruto = Math.min(0, ...valores)
  const maximoBruto = Math.max(0, ...valores)
  const intervaloBruto = Math.max(1, maximoBruto - minimoBruto)
  const folga = intervaloBruto * 0.08
  const minimo = minimoBruto < 0 ? minimoBruto - folga : 0
  const maximo = maximoBruto + folga
  const intervalo = Math.max(1, maximo - minimo)

  const x = (index: number) =>
    margemEsquerda +
    (dados.length <= 1 ? larguraGrafico / 2 : (index / (dados.length - 1)) * larguraGrafico)

  const y = (valor: number) =>
    margemTopo + ((maximo - valor) / intervalo) * alturaGrafico

  const linhaZero = y(0)
  const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

  const moedaCurta = (valor: number) =>
    Number(valor || 0).toLocaleString('pt-BR', {
      notation: 'compact',
      maximumFractionDigits: 1,
    })

  const grades = Array.from({ length: 5 }, (_, index) => {
    const proporcao = index / 4
    const valor = maximo - proporcao * intervalo
    return { valor, y: y(valor) }
  })

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-xl font-black text-gray-950">Evolução mensal de {ano}</h3>
          <p className="mt-1 text-sm font-semibold text-gray-500">
            Compare recebimento, Profit apurado, todas as saídas de caixa e o saldo final de cada mês.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {series.map((serie) => (
            <div key={serie.chave} className="flex items-center gap-2 text-xs font-black text-gray-700">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: serie.cor }}
              />
              {serie.label}
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${largura} ${altura}`}
          className="min-w-[900px] w-full"
          role="img"
          aria-label={`Gráfico de evolução mensal do financeiro de ${ano}`}
        >
          {grades.map((grade, index) => (
            <g key={index}>
              <line
                x1={margemEsquerda}
                x2={largura - margemDireita}
                y1={grade.y}
                y2={grade.y}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text
                x={margemEsquerda - 10}
                y={grade.y + 4}
                textAnchor="end"
                fontSize="11"
                fill="#64748b"
              >
                {moedaCurta(grade.valor)}
              </text>
            </g>
          ))}

          {minimo < 0 && maximo > 0 && (
            <line
              x1={margemEsquerda}
              x2={largura - margemDireita}
              y1={linhaZero}
              y2={linhaZero}
              stroke="#94a3b8"
              strokeWidth="1.5"
            />
          )}

          {series.map((serie) => {
            const pontos = dados
              .map((item: any, index: number) => `${x(index)},${y(Number(item?.[serie.chave] || 0))}`)
              .join(' ')

            return (
              <g key={serie.chave}>
                <polyline
                  fill="none"
                  stroke={serie.cor}
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={pontos}
                />

                {dados.map((item: any, index: number) => {
                  const valor = Number(item?.[serie.chave] || 0)

                  return (
                    <circle
                      key={`${serie.chave}-${item.mesRef}`}
                      cx={x(index)}
                      cy={y(valor)}
                      r="4"
                      fill={serie.cor}
                    >
                      <title>{`${serie.label} - ${nomesMeses[index]}: ${moeda(valor)}`}</title>
                    </circle>
                  )
                })}
              </g>
            )
          })}

          {dados.map((item: any, index: number) => (
            <g key={item.mesRef}>
              <text
                x={x(index)}
                y={altura - 28}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill="#475569"
              >
                {nomesMeses[index]}
              </text>
              <text
                x={x(index)}
                y={altura - 12}
                textAnchor="middle"
                fontSize="9"
                fill="#94a3b8"
              >
                {item.processos} proc.
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs md:grid-cols-4 xl:grid-cols-6">
        {dados.map((item: any, index: number) => (
          <div key={item.mesRef} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="font-black text-gray-900">{nomesMeses[index]}</p>
            <p className={`mt-1 font-black ${item.saldoCaixaRealMes >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {moeda(item.resultadoOperacional)}
            </p>
            <p className="mt-1 font-bold text-gray-500">
              {item.processos} proc. · {item.semCusto} sem custo
            </p>
          </div>
        ))}
      </div>
    </section>
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
