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

const TIPOS_MOVIMENTACAO = [
  { value: 'DESPESA', label: 'Despesa da empresa' },
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

export default function FinanceiroPage() {
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [movimentacoes, setMovimentacoes] = useState<any[]>([])

  const [loading, setLoading] = useState(false)
  const [loadingMovimentos, setLoadingMovimentos] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [salvandoMovimento, setSalvandoMovimento] = useState(false)
  const [importando, setImportando] = useState(false)
  const [gerandoFechamento, setGerandoFechamento] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editandoMovimentoId, setEditandoMovimentoId] = useState<string | null>(null)

  const [abaPrincipal, setAbaPrincipal] = useState('PROCESSOS')
  const [aba, setAba] = useState('EM ABERTO')
  const [pagina, setPagina] = useState(1)
  const [paginaMovimentos, setPaginaMovimentos] = useState(1)

  const [busca, setBusca] = useState('')
  const [filtroTransportadora, setFiltroTransportadora] = useState('')
  const [filtroDespachante, setFiltroDespachante] = useState('')
  const [filtroServico, setFiltroServico] = useState('')

  const [buscaMovimento, setBuscaMovimento] = useState('')
  const [filtroMesMovimento, setFiltroMesMovimento] = useState(new Date().toISOString().slice(0, 7))
  const [filtroStatusMovimento, setFiltroStatusMovimento] = useState('')
  const [filtroSocioMovimento, setFiltroSocioMovimento] = useState('')
  const [mesResultado, setMesResultado] = useState(new Date().toISOString().slice(0, 7))

  const [form, setForm] = useState<FormState>(formVazio)
  const [formMovimento, setFormMovimento] = useState<MovimentacaoFormState>(movimentacaoVazia)

  useEffect(() => {
    carregarDados()
  }, [])

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
    return 'bg-yellow-100 text-yellow-700 border-yellow-300'
  }

  function labelTipo(tipo: string) {
    return TIPOS_MOVIMENTACAO.find((item) => item.value === tipo)?.label || tipo
  }

  function limparFiltros() {
    setBusca('')
    setFiltroTransportadora('')
    setFiltroDespachante('')
    setFiltroServico('')
    setPagina(1)
  }

  function limparFiltrosMovimentos() {
    setBuscaMovimento('')
    setFiltroStatusMovimento('')
    setFiltroSocioMovimento('')
    setPaginaMovimentos(1)
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

    setMovimentacoes(data || [])
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
      servico: form.servico,
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
      servico: item.servico || '',
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

    return {
      tipo: 'DESPESA',
      socio: null,
      categoria: categoriaDespesaExcel(descricaoOriginal),
      impacta_resultado: true,
      impacta_caixa: true,
    }
  }

  function categoriaDespesaExcel(descricaoOriginal: any) {
    const descricao = normalizarBusca(descricaoOriginal)

    if (descricao.includes('ALUGUEL')) return 'Aluguel'
    if (descricao.includes('CONTABILIDADE') || descricao.includes('CONTADOR')) return 'Contador'
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
          servico: normalizarTexto(linha['SERVIÇO']),
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
      impacta_resultado: true,
      impacta_caixa: true,
    })
    setEditandoMovimentoId(null)
  }

  function prepararSocio(tipo = 'RETIRADA_SOCIO') {
    setFormMovimento({
      ...movimentacaoVazia,
      tipo,
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
      `Já reservado no fundo: ${moeda(resultadoGeral.entradasFundoMes)}\n` +
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
        `Fechamento gerado pelo Resultado Geral. ` +
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
    setFiltroMesMovimento(mesResultado)
    setGerandoFechamento(false)

    alert('Fechamento mensal gerado com sucesso. A reserva de 50% foi lançada no Fundo de Caixa.')
  }

  const transportadoras = useMemo(() => {
    return [
      ...new Set(lancamentos.map((item) => item.transportadora).filter(Boolean)),
    ].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))
  }, [lancamentos])

  const despachantes = useMemo(() => {
    return [
      ...new Set(lancamentos.map((item) => item.despachante).filter(Boolean)),
    ].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))
  }, [lancamentos])

  const servicos = useMemo(() => {
    return [
      ...new Set(lancamentos.map((item) => item.servico).filter(Boolean)),
    ].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))
  }, [lancamentos])

  const resumo = useMemo(() => {
    const emAberto = lancamentos.filter((item) => statusCobranca(item) === 'EM ABERTO')
    const atrasado = lancamentos.filter((item) => statusCobranca(item) === 'ATRASADO')
    const pago = lancamentos.filter((item) => statusCobranca(item) === 'PAGO')

    function total(lista: any[]) {
      return lista.reduce((acc, item) => acc + Number(item.valor_cobranca || 0), 0)
    }

    return {
      emAberto: { qtd: emAberto.length, total: total(emAberto) },
      atrasado: { qtd: atrasado.length, total: total(atrasado) },
      pago: { qtd: pago.length, total: total(pago) },
      todos: { qtd: lancamentos.length, total: total(lancamentos) },
    }
  }, [lancamentos])

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

      const passaBusca = !termo || texto.includes(termo)
      const statusAtual = statusCobranca(item)
      const passaAba = aba === 'TODOS' ? true : statusAtual === aba

      const passaTransportadora =
        !filtroTransportadora || item.transportadora === filtroTransportadora

      const passaDespachante =
        !filtroDespachante || item.despachante === filtroDespachante

      const passaServico = !filtroServico || item.servico === filtroServico

      return (
        passaAba &&
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
    filtroTransportadora,
    filtroDespachante,
    filtroServico,
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

    const aguardandoCusto = filtrados.filter(
      (item) => Number(item.valor_compra || 0) <= 0
    ).length

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
    if (abaPrincipal === 'DESPESAS') {
      return movimentacoes.filter((item) => item.tipo === 'DESPESA')
    }

    if (abaPrincipal === 'SOCIOS') {
      return movimentacoes.filter((item) =>
        ['RETIRADA_SOCIO', 'PAGAMENTO_SOCIO', 'REEMBOLSO_SOCIO', 'APORTE_SOCIO'].includes(item.tipo)
      )
    }

    if (abaPrincipal === 'FUNDO') {
      return movimentacoes.filter((item) =>
        ['FUNDO_CAIXA_ENTRADA', 'FUNDO_CAIXA_SAIDA', 'AJUSTE_CAIXA'].includes(item.tipo)
      )
    }

    return movimentacoes
  }, [abaPrincipal, movimentacoes])

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
      const passaMes = !filtroMesMovimento || item.mes_referencia === filtroMesMovimento
      const statusAtual = statusMovimento(item)
      const passaStatus = !filtroStatusMovimento || statusAtual === filtroStatusMovimento
      const passaSocio = !filtroSocioMovimento || item.socio === filtroSocioMovimento

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

    const semCusto = processosPagosMes.filter((item) => Number(item.valor_compra || 0) <= 0).length

    const movimentosMes = movimentacoes.filter((item) => item.mes_referencia === mesResultado)

    const despesasPagas = movimentosMes
      .filter((item) => item.tipo === 'DESPESA' && statusMovimento(item) === 'PAGO')
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const despesasPendentes = movimentosMes
      .filter((item) => item.tipo === 'DESPESA' && statusMovimento(item) !== 'PAGO')
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

    const saidasFundoMes = movimentosMes
      .filter((item) => item.tipo === 'FUNDO_CAIXA_SAIDA' && statusMovimento(item) === 'PAGO')
      .reduce((acc, item) => acc + Number(item.valor || 0), 0)

    const fundoAtual = movimentacoes.reduce((acc, item) => {
      if (statusMovimento(item) !== 'PAGO') return acc
      if (item.tipo === 'FUNDO_CAIXA_ENTRADA') return acc + Number(item.valor || 0)
      if (item.tipo === 'FUNDO_CAIXA_SAIDA') return acc - Number(item.valor || 0)
      if (item.tipo === 'AJUSTE_CAIXA') return acc + Number(item.valor || 0)
      return acc
    }, 0)

    const retiradasTotal = retiradasMarcos + retiradasHerica
    const resultadoOperacional = profitRecebido - despesasPagas
    const lucroDistribuivel = resultadoOperacional > 0 ? resultadoOperacional : 0
    const fundoPrevistoMes = lucroDistribuivel * 0.5
    const parteMarcos = lucroDistribuivel * 0.25
    const parteHerica = lucroDistribuivel * 0.25
    const saldoMarcos = parteMarcos - retiradasMarcos
    const saldoHerica = parteHerica - retiradasHerica
    const saldoFundoMes = fundoPrevistoMes - entradasFundoMes
    const saldoCaixaRealMes = resultadoOperacional - retiradasTotal + aportes - entradasFundoMes + saidasFundoMes

    return {
      processos: processosPagosMes.length,
      valorRecebido,
      profitRecebido,
      semCusto,
      despesasPagas,
      despesasPendentes,
      retiradasMarcos,
      retiradasHerica,
      retiradasTotal,
      aportes,
      entradasFundoMes,
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
  }, [lancamentos, movimentacoes, mesResultado])

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

  function mudarAba(novaAba: string) {
    setAba(novaAba)
    setPagina(1)
  }

  function mudarAbaPrincipal(novaAba: string) {
    setAbaPrincipal(novaAba)
    setPaginaMovimentos(1)

    if (novaAba === 'DESPESAS') prepararDespesa()
    if (novaAba === 'SOCIOS') prepararSocio()
    if (novaAba === 'FUNDO') prepararFundo()
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
          <Input type="month" label="Mês referência" value={formMovimento.mes_referencia} onChange={(v) => setFormMovimento({ ...formMovimento, mes_referencia: v })} />

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

          <input
            type="month"
            value={filtroMesMovimento}
            onChange={(e) => { setFiltroMesMovimento(e.target.value); setPaginaMovimentos(1) }}
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={filtroStatusMovimento}
            onChange={(e) => { setFiltroStatusMovimento(e.target.value); setPaginaMovimentos(1) }}
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm"
          >
            <option value="">Todos status</option>
            <option value="PENDENTE">Pendente</option>
            <option value="VENCIDO">Vencido</option>
            <option value="PAGO">Pago</option>
          </select>

          <select
            value={filtroSocioMovimento}
            onChange={(e) => { setFiltroSocioMovimento(e.target.value); setPaginaMovimentos(1) }}
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm"
          >
            <option value="">Todos sócios</option>
            <option value="MARCOS">Marcos</option>
            <option value="HERICA">Hérica</option>
          </select>

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
                          <button onClick={() => excluirMovimentacao(item.id)} className="bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-100 font-bold">🗑</button>
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

  return (
    <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-950">Financeiro</h1>
          <p className="text-sm text-gray-500">
            Processos faturados, despesas, retiradas dos sócios e fundo de caixa
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={carregarDados}
            className="bg-white border border-gray-200 text-gray-800 px-5 py-3 rounded-xl font-bold hover:bg-gray-100 shadow-sm"
          >
            ↻ Atualizar dados
          </button>

          {abaPrincipal === 'PROCESSOS' && (
            <label className="bg-blue-600 text-white px-5 py-3 rounded-xl font-bold cursor-pointer hover:bg-blue-700 shadow-sm">
              ↓ Importar Excel
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
              ↓ Importar Despesas Excel
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
              ↓ Importar Retiradas Excel
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

      <section className="mb-6 flex gap-2 overflow-x-auto pb-1">
        <TabButton ativo={abaPrincipal === 'PROCESSOS'} onClick={() => mudarAbaPrincipal('PROCESSOS')}>Processos Faturados</TabButton>
        <TabButton ativo={abaPrincipal === 'DESPESAS'} onClick={() => mudarAbaPrincipal('DESPESAS')}>Despesas</TabButton>
        <TabButton ativo={abaPrincipal === 'SOCIOS'} onClick={() => mudarAbaPrincipal('SOCIOS')}>Sócios / Retiradas</TabButton>
        <TabButton ativo={abaPrincipal === 'FUNDO'} onClick={() => mudarAbaPrincipal('FUNDO')}>Fundo de Caixa</TabButton>
        <TabButton ativo={abaPrincipal === 'RESULTADO'} onClick={() => mudarAbaPrincipal('RESULTADO')}>Resultado Geral</TabButton>
      </section>

      {abaPrincipal === 'PROCESSOS' && (
        <>
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <BigCard
              titulo="VALOR EM ABERTO"
              valor={moeda(resumo.emAberto.total)}
              subtitulo="Valor pendente de recebimento"
              icone="📂"
              classe="bg-orange-50 border-orange-200 text-orange-600"
            />

            <BigCard
              titulo="VALOR EM ATRASO"
              valor={moeda(resumo.atrasado.total)}
              subtitulo="Valor vencido não recebido"
              icone="⏰"
              classe="bg-red-50 border-red-200 text-red-600"
            />
          </section>

          <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
            <ResumoCard ativo={aba === 'EM ABERTO'} titulo="Em aberto" quantidade={resumo.emAberto.qtd} valor={moeda(resumo.emAberto.total)} cor="yellow" onClick={() => mudarAba('EM ABERTO')} />
            <ResumoCard ativo={aba === 'ATRASADO'} titulo="Atrasados" quantidade={resumo.atrasado.qtd} valor={moeda(resumo.atrasado.total)} cor="red" onClick={() => mudarAba('ATRASADO')} />
            <ResumoCard ativo={aba === 'PAGO'} titulo="Pagos" quantidade={resumo.pago.qtd} valor={moeda(resumo.pago.total)} cor="green" onClick={() => mudarAba('PAGO')} />
            <ResumoCard ativo={aba === 'TODOS'} titulo="Todos" quantidade={resumo.todos.qtd} valor={moeda(resumo.todos.total)} cor="blue" onClick={() => mudarAba('TODOS')} />
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

              <InputMoney label="Custos terceiros R$" value={form.debito_terceiro} onChange={(v) => setForm({ ...form, debito_terceiro: v })} />
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

          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-5">
              <input value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1) }} placeholder="Buscar por cliente, AWB, fatura, serviço..." className="rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />

              <select value={filtroTransportadora} onChange={(e) => { setFiltroTransportadora(e.target.value); setPagina(1) }} className="rounded-xl border border-gray-200 px-4 py-3 text-sm">
                <option value="">Todas transportadoras</option>
                {transportadoras.map((item: any) => <option key={item} value={item}>{item}</option>)}
              </select>

              <select value={filtroDespachante} onChange={(e) => { setFiltroDespachante(e.target.value); setPagina(1) }} className="rounded-xl border border-gray-200 px-4 py-3 text-sm">
                <option value="">Todos despachantes</option>
                {despachantes.map((item: any) => <option key={item} value={item}>{item}</option>)}
              </select>

              <select value={filtroServico} onChange={(e) => { setFiltroServico(e.target.value); setPagina(1) }} className="rounded-xl border border-gray-200 px-4 py-3 text-sm">
                <option value="">Todos serviços</option>
                {servicos.map((item: any) => <option key={item} value={item}>{item}</option>)}
              </select>

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

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
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
                      const possuiCusto = Number(item.valor_compra || 0) > 0
                      const profit = possuiCusto ? calcularProfit(item) : null

                      return (
                        <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <Td>{item.cliente}</Td>
                          <Td>{item.despachante}</Td>
                          <Td>{item.awb}</Td>
                          <Td>{item.fatura || '-'}</Td>
                          <Td>{item.transportadora}</Td>
                          <Td>{item.servico}</Td>
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
                              <button onClick={() => excluir(item.id)} className="bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-100 font-bold">🗑</button>
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
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
            <BigCard
              titulo="FUNDO DE CAIXA ATUAL"
              valor={moeda(resultadoGeral.fundoAtual)}
              subtitulo="Entradas menos saídas pagas no fundo"
              icone="🏦"
              classe="bg-blue-50 border-blue-200 text-blue-700"
            />
            <BigCard
              titulo="ENTRADAS NO MÊS"
              valor={moeda(resultadoGeral.entradasFundoMes)}
              subtitulo={`Mês ${mesResultado}`}
              icone="⬆️"
              classe="bg-green-50 border-green-200 text-green-700"
            />
            <BigCard
              titulo="SAÍDAS NO MÊS"
              valor={moeda(resultadoGeral.saidasFundoMes)}
              subtitulo={`Mês ${mesResultado}`}
              icone="⬇️"
              classe="bg-red-50 border-red-200 text-red-700"
            />
          </section>

          {renderFormularioMovimento('Nova movimentação do fundo de caixa', 'Registre entradas, saídas e ajustes do fundo de caixa da empresa.')}
          {renderTabelaMovimentos()}
        </>
      )}

      {abaPrincipal === 'RESULTADO' && (
        <section className="space-y-5">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-gray-950">Resultado Geral</h2>
              <p className="text-sm text-gray-500">
                Visão do mês pela regra: lucro líquido = Profit HC - despesas; 50% fica no caixa, 25% Marcos e 25% Hérica.
              </p>
            </div>

            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div>
                <label className="text-sm font-semibold text-gray-600">Mês do resultado</label>
                <input
                  type="month"
                  value={mesResultado}
                  onChange={(e) => setMesResultado(e.target.value)}
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
            </div>
          </div>

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <FiltroResumoCard titulo="Valor recebido" valor={moeda(resultadoGeral.valorRecebido)} detalhe={`${resultadoGeral.processos} processos pagos`} classe="bg-white text-blue-700 border-blue-100" />
            <FiltroResumoCard titulo="Profit HC recebido" valor={moeda(resultadoGeral.profitRecebido)} detalhe={resultadoGeral.semCusto > 0 ? `${resultadoGeral.semCusto} sem custo` : 'Com custo lançado'} classe="bg-white text-green-700 border-green-100" />
            <FiltroResumoCard titulo="Despesas pagas" valor={moeda(resultadoGeral.despesasPagas)} detalhe={`${moeda(resultadoGeral.despesasPendentes)} pendente`} classe="bg-white text-red-700 border-red-100" />
            <FiltroResumoCard titulo="Lucro líquido" valor={moeda(resultadoGeral.resultadoOperacional)} detalhe="Profit - despesas pagas" classe={resultadoGeral.resultadoOperacional >= 0 ? 'bg-white text-green-700 border-green-100' : 'bg-white text-red-700 border-red-100'} />
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <FiltroResumoCard titulo="Fundo de caixa 50%" valor={moeda(resultadoGeral.fundoPrevistoMes)} detalhe={`${moeda(resultadoGeral.entradasFundoMes)} já lançado no fundo`} classe="bg-white text-blue-700 border-blue-100" />
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
                <LinhaResultado label="Reservado no fundo no mês" valor={resultadoGeral.entradasFundoMes} negativo />
                <LinhaResultado label="Saldo para reservar no fundo" valor={resultadoGeral.saldoFundoMes} destaque />
              </div>

              <div className="border-t border-gray-200 pt-4 mt-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-black text-gray-950">Saldo real do caixa no mês</p>
                  <p className="text-xs font-bold text-gray-500">Lucro líquido - retiradas - fundo reservado + aportes + saídas usadas do fundo</p>
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
