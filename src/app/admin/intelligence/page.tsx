'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import IntelligenceCRM from '@/components/IntelligenceCRM'

const TABELAS_SUPORTE = ['chamados_suporte', 'suporte']

type PeriodoTipo = 'MES' | 'ANO' | 'TUDO'

type Problema = {
  prioridade: 'Alta' | 'Média' | 'Baixa'
  tipo: string
  descricao: string
  valor: number
  acao: string
  link: string
}

type ClienteCarteira = {
  nome: string
  processos: number
  pagos: number
  receita: number
  custo: number
  profit: number
  margem: number
  ticketMedio: number
  vencido: number
  semCusto: number
  ultimoProcesso: string
  servicoPrincipal: string
  recomendacao: string
  motivo: string
  prioridade: number
  score: number
  diasSemEmbarque: number
  mesesSemEmbarque: number
  potencialAumento: string
  periodoAumento: string
  acaoTicket: string
  recuperar: boolean
}

export default function IntelligencePage() {
  const [clienteDetalheAberto, setClienteDetalheAberto] = useState<any | null>(null)
  const [embarques, setEmbarques] = useState<any[]>([])
  const [cotacoes, setCotacoes] = useState<any[]>([])
  const [faturas, setFaturas] = useState<any[]>([])
  const [financeiroEmbarques, setFinanceiroEmbarques] = useState<any[]>([])
  const [financeiroMovimentacoes, setFinanceiroMovimentacoes] = useState<any[]>([])
  const [chamados, setChamados] = useState<any[]>([])
  const [avisos, setAvisos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>('TUDO')
  const [mesFiltro, setMesFiltro] = useState(new Date().toISOString().slice(0, 7))

  const [buscaCliente, setBuscaCliente] = useState('')
  const [filtroRecomendacao, setFiltroRecomendacao] = useState('TODOS')
  const [filtroServicoCliente, setFiltroServicoCliente] = useState('TODOS')
  const [filtroAcaoCliente, setFiltroAcaoCliente] = useState('TODOS')
  const [filtroRecenciaCliente, setFiltroRecenciaCliente] = useState('TODOS')

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setLoading(true)
    const erros: string[] = []

    async function buscarTabela(tabela: string, silenciosa = false) {
      const { data, error } = await supabase.from(tabela).select('*')

      if (error) {
        if (!silenciosa) erros.push(`${tabela}: ${error.message}`)
        return []
      }

      return data || []
    }

    const [emb, cot, fat, fin, mov] = await Promise.all([
      buscarTabela('embarques'),
      buscarTabela('cotacoes'),
      buscarTabela('faturas'),
      buscarTabela('financeiro_embarques'),
      buscarTabela('financeiro_movimentacoes'),
    ])

    let suporteEncontrado: any[] = []

    for (const tabela of TABELAS_SUPORTE) {
      const dados = await buscarTabela(tabela, true)
      if (dados.length > 0) {
        suporteEncontrado = dados
        break
      }
    }

    setEmbarques(emb)
    setCotacoes(cot)
    setFaturas(fat)
    setFinanceiroEmbarques(fin)
    setFinanceiroMovimentacoes(mov)
    setChamados(suporteEncontrado)
    setAvisos(erros)
    setLoading(false)
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

  function moeda(valor: any) {
    return Number(valor || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  function percentual(valor: any) {
    return `${Number(valor || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`
  }

  function texto(valor: any) {
    return String(valor || '').trim()
  }

  function normalizarBusca(valor: any) {
    return texto(valor)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
  }

  function normalizarData(valor: any) {
    if (!valor) return ''

    if (valor instanceof Date && !isNaN(valor.getTime())) {
      return valor.toISOString().slice(0, 10)
    }

    if (typeof valor === 'number') {
      const data = new Date((valor - 25569) * 86400 * 1000)
      return data.toISOString().slice(0, 10)
    }

    const bruto = String(valor).trim()
    if (!bruto || bruto === '0') return ''

    // yyyy-mm-dd ou ISO completo
    if (/^\d{4}-\d{2}-\d{2}/.test(bruto)) return bruto.slice(0, 10)

    // yyyy-mm vindo de campos como mes ou mes_profit
    if (/^\d{4}-\d{2}$/.test(bruto)) return `${bruto}-01`

    // mm/yyyy ou m/yyyy
    if (/^\d{1,2}\/\d{4}$/.test(bruto)) {
      const [mes, ano] = bruto.split('/')
      return `${ano}-${mes.padStart(2, '0')}-01`
    }

    // dd/mm/yyyy
    const partes = bruto.split('/')
    if (partes.length === 3) {
      const [dia, mes, ano] = partes
      return `${ano.padStart(4, '20')}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
    }

    return ''
  }

  function mesDaData(valor: any) {
    const data = normalizarData(valor)
    return data ? data.slice(0, 7) : ''
  }

  function formatarMes(valor: any) {
    const mes = String(valor || '')
    if (!/^\d{4}-\d{2}$/.test(mes)) return mes || '-'

    const [ano, numeroMes] = mes.split('-')
    const nomes: Record<string, string> = {
      '01': 'Janeiro',
      '02': 'Fevereiro',
      '03': 'Março',
      '04': 'Abril',
      '05': 'Maio',
      '06': 'Junho',
      '07': 'Julho',
      '08': 'Agosto',
      '09': 'Setembro',
      '10': 'Outubro',
      '11': 'Novembro',
      '12': 'Dezembro',
    }

    return `${nomes[numeroMes] || numeroMes}/${ano}`
  }


  function dataBR(valor: any) {
    const data = normalizarData(valor)
    if (!data) return '-'

    const [ano, mes, dia] = data.split('-')
    return `${dia}/${mes}/${ano}`
  }

  function diasDesde(valor: any) {
    const data = normalizarData(valor)
    if (!data) return 9999

    const inicio = new Date(`${data}T00:00:00`)
    const hoje = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00`)
    const diff = hoje.getTime() - inicio.getTime()

    return Math.max(0, Math.floor(diff / 86400000))
  }

  function mesesDesde(valor: any) {
    const dias = diasDesde(valor)
    if (dias === 9999) return 999
    return Math.floor(dias / 30)
  }

  function maiorData(a: any, b: any) {
    const dataA = normalizarData(a)
    const dataB = normalizarData(b)

    if (!dataA) return dataB
    if (!dataB) return dataA

    return dataA > dataB ? dataA : dataB
  }

  function mesFinanceiro(item: any) {
    // Para alertas financeiros, a fonte correta é a data financeira real.
    // Prioriza recebimento/vencimento. Campos mes/mes_profit entram apenas como fallback.
    return (
      mesDaData(item.recebimento) ||
      mesDaData(item.vencimento_cobranca) ||
      item.mes_profit ||
      item.mes ||
      mesDaData(item.created_at) ||
      ''
    )
  }

  function mesMovimento(item: any) {
    return item.mes_referencia || mesDaData(item.data_pagamento) || mesDaData(item.data_vencimento) || mesDaData(item.created_at) || ''
  }

  function mesFatura(item: any) {
    return mesDaData(item.data_pagamento) || mesDaData(item.recebimento) || mesDaData(item.vencimento) || mesDaData(item.created_at) || ''
  }

  function mesEmbarque(item: any) {
    return mesDaData(item.created_at) || mesDaData(item.data_envio) || mesDaData(item.ultima_atualizacao) || mesDaData(item.data_prevista) || ''
  }

  function mesCotacao(item: any) {
    return mesDaData(item.created_at) || mesDaData(item.atualizado_em) || mesDaData(item.data_cotacao) || ''
  }

  function estaNoPeriodoPorMes(mesBase: any) {
    const mes = String(mesBase || '')
    if (periodoTipo === 'TUDO') return true
    if (!mes) return true
    if (periodoTipo === 'ANO') return mes.startsWith(mesFiltro.slice(0, 4))
    return mes === mesFiltro
  }

  function estaNoPeriodoPorData(dataBase: any) {
    const data = normalizarData(dataBase)
    if (periodoTipo === 'TUDO') return true
    if (!data) return true
    if (periodoTipo === 'ANO') return data.startsWith(mesFiltro.slice(0, 4))
    return data.startsWith(mesFiltro)
  }

  function periodoLabel() {
    if (periodoTipo === 'TUDO') return 'todo o histórico'
    if (periodoTipo === 'ANO') return `ano ${mesFiltro.slice(0, 4)}`
    return formatarMes(mesFiltro)
  }

  function statusCobranca(item: any) {
    const statusTexto = normalizarBusca(item.status_pagamento || item.status || item.pgta_terceiros)

    if (
      normalizarData(item.recebimento) ||
      normalizarData(item.recebimento_cliente) ||
      normalizarData(item.data_pagamento) ||
      statusTexto.includes('PAGO')
    ) {
      return 'PAGO'
    }

    if (statusTexto.includes('VENCIDO') || statusTexto.includes('ATRASADO')) return 'ATRASADO'

    const vencimento = normalizarData(item.vencimento_cobranca || item.vencimento || item.data_vencimento)
    const hoje = new Date().toISOString().slice(0, 10)

    if (vencimento && vencimento < hoje) return 'ATRASADO'
    return 'EM ABERTO'
  }

  function statusFatura(item: any) {
    if (item.recibo_pdf || item.data_pagamento || item.recebimento) return 'PAGO'

    const vencimento = normalizarData(item.vencimento || item.vencimento_cobranca)
    const hoje = new Date().toISOString().slice(0, 10)

    if (vencimento && vencimento < hoje) return 'VENCIDO'
    return 'PENDENTE'
  }

  function valorCobrancaProcesso(item: any) {
    return numero(item.valor_cobranca || item.valor_faturado || item.valor_venda || item.valor)
  }

  function temCusto(item: any) {
    return numero(item.valor_compra || item.custo_compra || item.custo) > 0
  }

  function custosProcesso(item: any) {
    return (
      numero(item.valor_compra || item.custo_compra || item.custo) +
      numero(item.doc_dta || item.dta_doc || item.impostos || item.taxas) +
      numero(item.debito_terceiro || item.terceiros || item.profit_terceiros || item.valor_terceiros)
    )
  }

  function profitProcesso(item: any) {
    const profitSalvo = numero(item.profit_hc || item.profit)
    if (temCusto(item) && profitSalvo !== 0) return profitSalvo
    if (!temCusto(item)) return 0
    return valorCobrancaProcesso(item) - custosProcesso(item)
  }

  function clienteProcesso(item: any) {
    return texto(
      item.cliente ||
      item.nome_cliente ||
      item.razao_social ||
      item.cliente_final ||
      item.importador ||
      item.exportador ||
      'Não informado'
    )
  }

  function transportadoraProcesso(item: any) {
    return texto(item.transportadora || item.empresa_prestadora || item.carrier || 'Não informado')
  }

  function servicoProcesso(item: any) {
    return texto(item.servico || item.tipo_servico || item.serviço || item.categoria || 'Não informado')
  }

  function ultimoDiaDoMes(valor: any) {
    const bruto = String(valor || '').trim()

    if (/^\d{4}-\d{2}$/.test(bruto)) {
      const [ano, mes] = bruto.split('-').map(Number)
      return new Date(ano, mes, 0).toISOString().slice(0, 10)
    }

    if (/^\d{1,2}\/\d{4}$/.test(bruto)) {
      const [mes, ano] = bruto.split('/').map(Number)
      return new Date(ano, mes, 0).toISOString().slice(0, 10)
    }

    return normalizarData(valor)
  }

  function dataProcessoCarteira(item: any) {
    // Recência comercial precisa olhar a data real do PROCESSO.
    // Para os processos antigos importados, a data mais confiável costuma ser o vencimento do cliente.
    // created_at/criado_em são só a data em que o dado entrou no sistema e ficam por último.
    return (
      normalizarData(item.data_embarque) ||
      normalizarData(item.data_envio) ||
      normalizarData(item.data_processo) ||
      normalizarData(item.data_faturamento) ||
      normalizarData(item.vencimento_cobranca) ||
      normalizarData(item.vencimento_cliente) ||
      normalizarData(item.venc_cliente) ||
      normalizarData(item.recebimento) ||
      normalizarData(item.data_pagamento) ||
      ultimoDiaDoMes(item.mes_profit) ||
      ultimoDiaDoMes(item.mes) ||
      normalizarData(item.competencia) ||
      normalizarData(item.mes_referencia) ||
      normalizarData(item.criado_em) ||
      normalizarData(item.created_at) ||
      ''
    )
  }

  function awbProcesso(item: any) {
    return texto(item.awb || item.numero_awb || '-')
  }

  function faturaProcesso(item: any) {
    return texto(item.fatura || item.numero_fatura || '')
  }

  function diasAtraso(data: any) {
    const vencimento = normalizarData(data)
    if (!vencimento) return 0
    const hoje = new Date().toISOString().slice(0, 10)
    const a = new Date(`${vencimento}T00:00:00`)
    const b = new Date(`${hoje}T00:00:00`)
    return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
  }

  const hoje = new Date().toISOString().slice(0, 10)
  const em7Dias = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  const dadosPeriodo = useMemo(() => {
    const fin = financeiroEmbarques.filter((item) => estaNoPeriodoPorMes(mesFinanceiro(item)))
    const mov = financeiroMovimentacoes.filter((item) => estaNoPeriodoPorMes(mesMovimento(item)))
    const fat = faturas.filter((item) => estaNoPeriodoPorMes(mesFatura(item)))
    const emb = embarques.filter((item) => estaNoPeriodoPorMes(mesEmbarque(item)))
    const cot = cotacoes.filter((item) => estaNoPeriodoPorMes(mesCotacao(item)))

    return { fin, mov, fat, emb, cot }
  }, [financeiroEmbarques, financeiroMovimentacoes, faturas, embarques, cotacoes, periodoTipo, mesFiltro])

  const inteligencia = useMemo(() => {
    const pagos = dadosPeriodo.fin.filter((item) => statusCobranca(item) === 'PAGO')
    const emAberto = dadosPeriodo.fin.filter((item) => statusCobranca(item) === 'EM ABERTO')
    const atrasados = dadosPeriodo.fin.filter((item) => statusCobranca(item) === 'ATRASADO')

    const pagosComCusto = pagos.filter((item) => temCusto(item))
    const pagosSemCusto = pagos.filter((item) => !temCusto(item))
    const semValorCobranca = dadosPeriodo.fin.filter((item) => valorCobrancaProcesso(item) <= 0)

    // Regra HC:
    // A tabela faturas é apenas para anexar PDF/recibo e exibir documentos ao cliente.
    // Vencido/pendente financeiro deve vir somente da aba Financeiro,
    // ou seja, da tabela financeiro_embarques.
    const cobrancasVencidasFinanceiro = atrasados
    const cobrancasEmAbertoFinanceiro = emAberto

    const embarquesSemAwb = dadosPeriodo.emb.filter((item) => {
      const awb = normalizarBusca(item.awb || item.numero_awb)
      return !awb || awb.includes('AGUARDANDO') || awb.includes('PENDENTE')
    })

    const cotacoesSemFechamento = dadosPeriodo.cot.filter((item) => {
      const status = normalizarBusca(item.status_comercial || item.status)
      return !status.includes('APROV') && !status.includes('FECH') && !status.includes('CONVERT')
    })

    const chamadosAbertos = chamados.filter((item) => {
      if (!estaNoPeriodoPorData(item.created_at || item.data_abertura || item.atualizado_em)) return false
      const status = normalizarBusca(item.status)
      return !status.includes('FECHADO') && !status.includes('RESOLVIDO')
    })

    const totalVencido = atrasados.reduce((acc, item) => acc + valorCobrancaProcesso(item), 0)
    const receber7Dias = emAberto
      .filter((item) => {
        const vencimento = normalizarData(item.vencimento_cobranca)
        return vencimento && vencimento >= hoje && vencimento <= em7Dias
      })
      .reduce((acc, item) => acc + valorCobrancaProcesso(item), 0)

    const receitaConfirmada = pagos.reduce((acc, item) => acc + valorCobrancaProcesso(item), 0)
    const profitConfirmado = pagosComCusto.reduce((acc, item) => acc + profitProcesso(item), 0)
    const terceirosParaConferir = pagos.reduce((acc, item) => acc + numero(item.debito_terceiro), 0)
    const custoConfirmado = pagosComCusto.reduce((acc, item) => acc + custosProcesso(item), 0)
    const margemConfirmada = receitaConfirmada > 0 ? (profitConfirmado / receitaConfirmada) * 100 : 0

    const totalPendencias =
      atrasados.length +
      pagosSemCusto.length +
      semValorCobranca.length +
      embarquesSemAwb.length +
      chamadosAbertos.length

    return {
      pagos,
      pagosComCusto,
      pagosSemCusto,
      emAberto,
      atrasados,
      totalVencido,
      receber7Dias,
      receitaConfirmada,
      profitConfirmado,
      terceirosParaConferir,
      custoConfirmado,
      margemConfirmada,
      semValorCobranca,
      cobrancasVencidasFinanceiro,
      cobrancasEmAbertoFinanceiro,
      embarquesSemAwb,
      cotacoesSemFechamento,
      chamadosAbertos,
      totalPendencias,
    }
  }, [dadosPeriodo, chamados, periodoTipo, mesFiltro])

  const problemasFinanceiros = useMemo(() => {
    const lista: Problema[] = []

    inteligencia.atrasados.forEach((item) => {
      lista.push({
        prioridade: 'Alta',
        tipo: 'Cobrança vencida',
        descricao: `${clienteProcesso(item)}${awbProcesso(item) !== '-' ? ` • AWB ${awbProcesso(item)}` : ''} • ${diasAtraso(item.vencimento_cobranca)} dia(s) em atraso`,
        valor: valorCobrancaProcesso(item),
        acao: 'Abrir financeiro',
        link: '/admin/financeiro',
      })
    })

    inteligencia.pagosSemCusto.forEach((item) => {
      lista.push({
        prioridade: 'Alta',
        tipo: 'Pago sem custo',
        descricao: `${clienteProcesso(item)}${awbProcesso(item) !== '-' ? ` • AWB ${awbProcesso(item)}` : ''}. Profit HC não pode ser confiável.`,
        valor: valorCobrancaProcesso(item),
        acao: 'Corrigir custo',
        link: '/admin/financeiro',
      })
    })

    inteligencia.semValorCobranca.forEach((item) => {
      lista.push({
        prioridade: 'Média',
        tipo: 'Sem valor de cobrança',
        descricao: `${clienteProcesso(item)}${awbProcesso(item) !== '-' ? ` • AWB ${awbProcesso(item)}` : ''}. Processo sem faturamento preenchido.`,
        valor: 0,
        acao: 'Preencher valor',
        link: '/admin/financeiro',
      })
    })

    inteligencia.embarquesSemAwb.slice(0, 15).forEach((item) => {
      lista.push({
        prioridade: 'Média',
        tipo: 'Embarque sem AWB',
        descricao: `${texto(item.cliente_final || item.importador || item.exportador || 'Cliente não informado')}. Pode travar rastreio e faturamento.`,
        valor: 0,
        acao: 'Abrir embarques',
        link: '/admin/embarques',
      })
    })

    inteligencia.chamadosAbertos.slice(0, 10).forEach((item) => {
      lista.push({
        prioridade: 'Média',
        tipo: 'Chamado aberto',
        descricao: texto(item.assunto || item.titulo || item.mensagem || 'Chamado pendente'),
        valor: 0,
        acao: 'Abrir suporte',
        link: '/admin/suporte',
      })
    })

    const peso: Record<string, number> = { Alta: 3, Média: 2, Baixa: 1 }

    return lista
      .sort((a, b) => (peso[b.prioridade] || 0) - (peso[a.prioridade] || 0) || b.valor - a.valor)
      .slice(0, 25)
  }, [inteligencia])

  const rankingClientes = useMemo(() => {
    const mapa: Record<string, any> = {}

    dadosPeriodo.fin.forEach((item) => {
      const nome = clienteProcesso(item)
      if (!mapa[nome]) {
        mapa[nome] = {
          nome,
          processos: 0,
          receita: 0,
          custo: 0,
          profit: 0,
          vencido: 0,
          semCusto: 0,
        }
      }

      mapa[nome].processos += 1

      if (statusCobranca(item) === 'PAGO') {
        mapa[nome].receita += valorCobrancaProcesso(item)
        mapa[nome].custo += temCusto(item) ? custosProcesso(item) : 0
        mapa[nome].profit += profitProcesso(item)
        if (!temCusto(item)) mapa[nome].semCusto += 1
      }

      if (statusCobranca(item) === 'ATRASADO') {
        mapa[nome].vencido += valorCobrancaProcesso(item)
      }
    })

    return Object.values(mapa)
      .map((item: any) => ({
        ...item,
        margem: item.receita > 0 ? (item.profit / item.receita) * 100 : 0,
      }))
      .sort((a: any, b: any) => b.vencido - a.vencido || b.semCusto - a.semCusto || b.profit - a.profit)
      .slice(0, 10)
  }, [dadosPeriodo])


  const carteiraClientes = useMemo(() => {
    const mapa: Record<string, any> = {}

    // A carteira comercial SEMPRE usa o histórico completo de Processos Faturados.
    // O filtro de mês/ano do topo serve para alertas financeiros, não para recuperar cliente parado.
    financeiroEmbarques.forEach((item) => {
      const nome = clienteProcesso(item)
      if (!nome || nome === 'Não informado') return

      const status = statusCobranca(item)
      const dataBase = dataProcessoCarteira(item)
      const servico = servicoProcesso(item)

      if (!mapa[nome]) {
        mapa[nome] = {
          nome,
          processos: 0,
          pagos: 0,
          receita: 0,
          custo: 0,
          profit: 0,
          vencido: 0,
          atrasados: 0,
          semCusto: 0,
          ultimoProcesso: '',
          servicos: {},
        }
      }

      mapa[nome].processos += 1
      mapa[nome].servicos[servico] = (mapa[nome].servicos[servico] || 0) + 1

      if (dataBase) {
        mapa[nome].ultimoProcesso = maiorData(mapa[nome].ultimoProcesso, dataBase)
      }

      if (status === 'PAGO') {
        mapa[nome].pagos += 1
        mapa[nome].receita += valorCobrancaProcesso(item)

        if (temCusto(item)) {
          mapa[nome].custo += custosProcesso(item)
          mapa[nome].profit += profitProcesso(item)
        } else {
          mapa[nome].semCusto += 1
        }
      }

      if (status === 'ATRASADO') {
        mapa[nome].atrasados += 1
        mapa[nome].vencido += valorCobrancaProcesso(item)
      }
    })

    return Object.values(mapa)
      .map((item: any) => {
        const margem = item.receita > 0 ? (item.profit / item.receita) * 100 : 0
        const ticketMedio = item.pagos > 0 ? item.receita / item.pagos : 0
        const diasSemEmbarque = diasDesde(item.ultimoProcesso)
        const mesesSemEmbarque = mesesDesde(item.ultimoProcesso)
        const servicoPrincipal = Object.entries(item.servicos || {})
          .sort((a: any, b: any) => Number(b[1]) - Number(a[1]))[0]?.[0] || '-'

        let recomendacao = 'ANALISAR'
        let motivo = 'Pouco dado financeiro confiável para decidir.'
        let prioridade = 1
        let potencialAumento = 'Analisar'
        let periodoAumento = 'Depois de conferir dados'
        let acaoTicket = 'Conferir custos, margem e histórico antes de propor aumento.'

        const recuperar = diasSemEmbarque >= 45 && item.processos > 0 && diasSemEmbarque < 9999

        if (item.vencido > 0) {
          recomendacao = 'COBRAR / SEGURAR'
          motivo = 'Tem cobrança vencida. Antes de vender mais, proteger caixa.'
          prioridade = 8
          potencialAumento = 'Não aumentar agora'
          periodoAumento = 'Depois do pagamento'
          acaoTicket = 'Cobrar pendência e só voltar a vender com condição mais segura.'
        } else if (item.semCusto > 0) {
          recomendacao = 'CORRIGIR CUSTO'
          motivo = 'Existem processos pagos sem custo. Profit e margem não são confiáveis.'
          prioridade = 7
          potencialAumento = 'Indefinido'
          periodoAumento = 'Após corrigir custos'
          acaoTicket = 'Corrigir custo para saber se precisa reajustar ou manter tabela.'
        } else if (recuperar) {
          recomendacao = 'REATIVAR'
          motivo = `Cliente parado há ${diasSemEmbarque} dias. Chamar antes de tentar reajustar.`
          prioridade = diasSemEmbarque >= 90 ? 6 : 4
          potencialAumento = 'Retomar primeiro'
          periodoAumento = diasSemEmbarque >= 90 ? 'Chamar agora' : 'Chamar este mês'
          acaoTicket = 'Contato de recuperação: perguntar próximos embarques e oferecer revisão de tabela/serviço.'
        } else if (item.processos >= 4 && margem > 0 && margem < 10) {
          recomendacao = 'REAJUSTAR'
          motivo = 'Volume bom, mas margem crítica. A tabela está apertada.'
          prioridade = 5
          potencialAumento = '15% a 25%'
          periodoAumento = 'Na próxima cotação'
          acaoTicket = 'Aplicar taxa mínima e rever tabela do serviço principal.'
        } else if (item.processos >= 4 && margem >= 10 && margem < 15) {
          recomendacao = 'REAJUSTAR'
          motivo = 'Tem volume, mas margem baixa. Revisar tabela ou taxa mínima.'
          prioridade = 4
          potencialAumento = '10% a 15%'
          periodoAumento = 'Próximos 30 dias'
          acaoTicket = 'Avisar reajuste por aumento de custo operacional e suporte.'
        } else if (item.pagos >= 3 && ticketMedio > 0 && ticketMedio < 1500) {
          recomendacao = 'AUMENTAR TICKET'
          motivo = 'Ticket médio baixo. Oferecer pacote, taxa mínima ou serviço adicional.'
          prioridade = 3
          potencialAumento = 'R$ 150 a R$ 350 por processo'
          periodoAumento = 'Próxima cotação pequena'
          acaoTicket = 'Cobrar taxa mínima ou vender acompanhamento/documentação.'
        } else if (item.profit > 0 && margem >= 25) {
          recomendacao = 'FOCAR'
          motivo = 'Cliente saudável: bom profit e boa margem.'
          prioridade = 2
          potencialAumento = 'Upsell, não reajuste seco'
          periodoAumento = 'Próximo contato comercial'
          acaoTicket = 'Oferecer formal, relatório, gestão documental ou pacote mensal.'
        } else if (item.profit > 0) {
          recomendacao = 'MANTER / CRESCER'
          motivo = 'Cliente positivo. Buscar mais serviços sem reduzir margem.'
          prioridade = 2
          potencialAumento = '5% a 10% ou serviço adicional'
          periodoAumento = 'Próxima renovação de tabela'
          acaoTicket = 'Aumentar escopo, não apenas preço.'
        }

        const score =
          item.profit / 1000 +
          margem * 1.5 +
          item.pagos * 4 -
          item.vencido / 500 -
          item.semCusto * 20 -
          item.atrasados * 15 -
          Math.min(diasSemEmbarque / 10, 20)

        return {
          nome: item.nome,
          processos: item.processos,
          pagos: item.pagos,
          receita: item.receita,
          custo: item.custo,
          profit: item.profit,
          margem,
          ticketMedio,
          vencido: item.vencido,
          semCusto: item.semCusto,
          ultimoProcesso: item.ultimoProcesso,
          servicoPrincipal,
          recomendacao,
          motivo,
          prioridade,
          score,
          diasSemEmbarque,
          mesesSemEmbarque,
          potencialAumento,
          periodoAumento,
          acaoTicket,
          recuperar,
        } as ClienteCarteira
      })
      .sort((a: ClienteCarteira, b: ClienteCarteira) => b.prioridade - a.prioridade || b.profit - a.profit || b.processos - a.processos)
      .slice(0, 120)
  }, [financeiroEmbarques])

  const clientesParaAumentarTicket = useMemo(() => {
    return carteiraClientes
      .filter((item) =>
        ['REAJUSTAR', 'AUMENTAR TICKET', 'MANTER / CRESCER', 'FOCAR'].includes(item.recomendacao) &&
        item.vencido <= 0 &&
        item.semCusto <= 0 &&
        item.receita > 0
      )
      .sort((a, b) => {
        const prioridadeA = a.recomendacao === 'REAJUSTAR' ? 4 : a.recomendacao === 'AUMENTAR TICKET' ? 3 : a.recomendacao === 'MANTER / CRESCER' ? 2 : 1
        const prioridadeB = b.recomendacao === 'REAJUSTAR' ? 4 : b.recomendacao === 'AUMENTAR TICKET' ? 3 : b.recomendacao === 'MANTER / CRESCER' ? 2 : 1
        return prioridadeB - prioridadeA || b.processos - a.processos || b.profit - a.profit
      })
      .slice(0, 12)
  }, [carteiraClientes])

  const clientesParaRecuperar = useMemo(() => {
    return carteiraClientes
      .filter((item) => item.recuperar)
      .sort((a, b) => b.diasSemEmbarque - a.diasSemEmbarque || b.profit - a.profit)
      .slice(0, 12)
  }, [carteiraClientes])

  const resumoCarteira = useMemo(() => {
    const receita = carteiraClientes.reduce((acc, item) => acc + item.receita, 0)
    const pagos = carteiraClientes.reduce((acc, item) => acc + item.pagos, 0)
    const ticketMedio = pagos > 0 ? receita / pagos : 0

    return {
      focar: carteiraClientes.filter((item) => ['FOCAR', 'MANTER / CRESCER'].includes(item.recomendacao)).length,
      reajustar: clientesParaAumentarTicket.length,
      recuperar: clientesParaRecuperar.length,
      risco: carteiraClientes.filter((item) => ['COBRAR / SEGURAR', 'CORRIGIR CUSTO'].includes(item.recomendacao)).length,
      ticketMedio,
    }
  }, [carteiraClientes, clientesParaAumentarTicket, clientesParaRecuperar])

  const servicosCarteira = useMemo(() => {
    return Array.from(
      new Set(
        carteiraClientes
          .map((item) => item.servicoPrincipal)
          .filter((item) => item && item !== '-')
      )
    ).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))
  }, [carteiraClientes])

  const carteiraClientesFiltrada = useMemo(() => {
    const termo = normalizarBusca(buscaCliente)

    return carteiraClientes.filter((item) => {
      const textoCliente = normalizarBusca(`
        ${item.nome}
        ${item.recomendacao}
        ${item.motivo}
        ${item.servicoPrincipal}
        ${item.periodoAumento}
        ${item.acaoTicket}
      `)

      const passaBusca = !termo || textoCliente.includes(termo)

      const passaRecomendacao =
        filtroRecomendacao === 'TODOS' || item.recomendacao === filtroRecomendacao

      const passaServico =
        filtroServicoCliente === 'TODOS' || item.servicoPrincipal === filtroServicoCliente

      const passaAcao =
        filtroAcaoCliente === 'TODOS' ||
        (filtroAcaoCliente === 'FOCAR' && ['FOCAR', 'MANTER / CRESCER'].includes(item.recomendacao)) ||
        (filtroAcaoCliente === 'AUMENTAR_TICKET' && ['REAJUSTAR', 'AUMENTAR TICKET'].includes(item.recomendacao)) ||
        (filtroAcaoCliente === 'RECUPERAR' && item.recuperar) ||
        (filtroAcaoCliente === 'RISCO' && ['COBRAR / SEGURAR', 'CORRIGIR CUSTO'].includes(item.recomendacao)) ||
        (filtroAcaoCliente === 'SEM_CUSTO' && item.semCusto > 0) ||
        (filtroAcaoCliente === 'COBRANCA' && item.vencido > 0)

      const passaRecencia =
        filtroRecenciaCliente === 'TODOS' ||
        (filtroRecenciaCliente === 'ATIVOS' && item.diasSemEmbarque < 45) ||
        (filtroRecenciaCliente === 'PARADOS_45' && item.diasSemEmbarque >= 45) ||
        (filtroRecenciaCliente === 'PARADOS_90' && item.diasSemEmbarque >= 90)

      return passaBusca && passaRecomendacao && passaServico && passaAcao && passaRecencia
    })
  }, [
    carteiraClientes,
    buscaCliente,
    filtroRecomendacao,
    filtroServicoCliente,
    filtroAcaoCliente,
    filtroRecenciaCliente,
  ])

  function processosDoClienteCarteira(nomeCliente: any) {
    const chave = normalizarBusca(nomeCliente)

    return financeiroEmbarques
      .filter((item) => normalizarBusca(clienteProcesso(item)) === chave)
      .sort((a, b) => {
        const dataA = dataProcessoCarteira(a)
        const dataB = dataProcessoCarteira(b)

        return String(dataB || '').localeCompare(String(dataA || ''))
      })
  }

  function abrirDetalheCliente(cliente: any) {
    setClienteDetalheAberto(cliente)
  }

  function limparFiltrosCarteira() {
    setBuscaCliente('')
    setFiltroRecomendacao('TODOS')
    setFiltroServicoCliente('TODOS')
    setFiltroAcaoCliente('TODOS')
    setFiltroRecenciaCliente('TODOS')
  }

  const rankingTransportadoras = useMemo(() => {
    const mapa: Record<string, any> = {}

    dadosPeriodo.fin.forEach((item) => {
      const nome = transportadoraProcesso(item)
      if (!mapa[nome]) mapa[nome] = { nome, processos: 0, profit: 0, vencido: 0, semCusto: 0 }
      mapa[nome].processos += 1

      if (statusCobranca(item) === 'PAGO') {
        mapa[nome].profit += profitProcesso(item)
        if (!temCusto(item)) mapa[nome].semCusto += 1
      }

      if (statusCobranca(item) === 'ATRASADO') {
        mapa[nome].vencido += valorCobrancaProcesso(item)
      }
    })

    return Object.values(mapa)
      .sort((a: any, b: any) => b.vencido - a.vencido || b.semCusto - a.semCusto || b.profit - a.profit)
      .slice(0, 8)
  }, [dadosPeriodo])

  const rankingServicos = useMemo(() => {
    const mapa: Record<string, any> = {}

    dadosPeriodo.fin.forEach((item) => {
      const nome = servicoProcesso(item)
      if (!mapa[nome]) mapa[nome] = { nome, processos: 0, profit: 0, vencido: 0, semCusto: 0 }
      mapa[nome].processos += 1

      if (statusCobranca(item) === 'PAGO') {
        mapa[nome].profit += profitProcesso(item)
        if (!temCusto(item)) mapa[nome].semCusto += 1
      }

      if (statusCobranca(item) === 'ATRASADO') {
        mapa[nome].vencido += valorCobrancaProcesso(item)
      }
    })

    return Object.values(mapa)
      .sort((a: any, b: any) => b.vencido - a.vencido || b.semCusto - a.semCusto || b.profit - a.profit)
      .slice(0, 8)
  }, [dadosPeriodo])

  const funil = useMemo(() => {
    const cotacoesAprovadas = dadosPeriodo.cot.filter((item) => {
      const status = normalizarBusca(item.status_comercial || item.status)
      return status.includes('APROV') || status.includes('FECH') || status.includes('CONVERT')
    }).length

    const processosPagos = dadosPeriodo.fin.filter((item) => statusCobranca(item) === 'PAGO').length

    return {
      cotacoesCriadas: dadosPeriodo.cot.length,
      cotacoesAprovadas,
      embarquesCriados: dadosPeriodo.emb.length,
      processosFinanceiros: dadosPeriodo.fin.length,
      processosPagos,
      conversaoCotacao: dadosPeriodo.cot.length > 0 ? (cotacoesAprovadas / dadosPeriodo.cot.length) * 100 : 0,
      conversaoFinanceiro: dadosPeriodo.fin.length > 0 ? (processosPagos / dadosPeriodo.fin.length) * 100 : 0,
    }
  }, [dadosPeriodo])

  if (loading) {
    return (
      <main className="min-h-screen bg-[#020817] p-8 text-white">
        Carregando Intelligence...
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#020817] p-6 text-white">
      <div className="w-full max-w-none">
        <section className="border border-blue-900 rounded-3xl bg-[#071225] p-5 mb-6 flex flex-col xl:flex-row justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center text-3xl">
              🚨
            </div>

            <div>
              <h1 className="text-4xl font-black">Intelligence</h1>
              <p className="text-slate-400">
                Alertas baseados no Financeiro. Por padrão mostra todo o histórico para bater com a aba Financeiro.
              </p>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <input
              type="month"
              value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}
              className="border border-blue-900 bg-[#020817] px-5 py-3 rounded-xl font-bold text-white"
            />

            <select
              value={periodoTipo}
              onChange={(e) => setPeriodoTipo(e.target.value as PeriodoTipo)}
              className="border border-blue-900 bg-[#020817] px-5 py-3 rounded-xl font-bold text-white"
            >
              <option value="TUDO">Todo histórico</option>
              <option value="MES">Mês selecionado</option>
              <option value="ANO">Ano selecionado</option>
            </select>

            <button
              type="button"
              onClick={carregar}
              className="border border-blue-900 bg-[#020817] px-5 py-3 rounded-xl font-bold hover:bg-blue-950"
            >
              ↻ Atualizar
            </button>

            <Link
              href="/admin/financeiro"
              className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl font-bold"
            >
              Abrir Financeiro
            </Link>

            <Link
              href="/admin"
              className="bg-purple-600 hover:bg-purple-500 px-5 py-3 rounded-xl font-bold"
            >
              Voltar
            </Link>
          </div>
        </section>

        {avisos.length > 0 && (
          <section className="mb-6 rounded-2xl border border-yellow-700 bg-yellow-900/20 p-4 text-yellow-200">
            <strong>Aviso:</strong> algumas tabelas não carregaram. {avisos.join(' | ')}
          </section>
        )}

        <section className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-6">
          <Kpi titulo="Ações urgentes" valor={inteligencia.totalPendencias} detalhe={`Pendências em ${periodoLabel()}`} icone="🚨" cor={inteligencia.totalPendencias > 0 ? 'red' : 'green'} />
          <Kpi titulo="Cobranças vencidas" valor={moeda(inteligencia.totalVencido)} detalhe={`${inteligencia.atrasados.length} processo(s)`} icone="⏰" cor={inteligencia.totalVencido > 0 ? 'red' : 'green'} />
          <Kpi titulo="A receber 7 dias" valor={moeda(inteligencia.receber7Dias)} detalhe="Previsão curta" icone="📅" cor="blue" />
          <Kpi titulo="Pagos sem custo" valor={inteligencia.pagosSemCusto.length} detalhe="Profit não confiável" icone="🧩" cor={inteligencia.pagosSemCusto.length > 0 ? 'yellow' : 'green'} />
          <Kpi titulo="Chamados abertos" valor={inteligencia.chamadosAbertos.length} detalhe="Suporte pendente" icone="💬" cor={inteligencia.chamadosAbertos.length > 0 ? 'orange' : 'green'} />
        </section>

        <section className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-6">
          <Kpi titulo="Clientes para focar" valor={resumoCarteira.focar} detalhe="Bom profit ou crescimento" icone="🎯" cor="green" />
          <Kpi titulo="Aumentar ticket" valor={resumoCarteira.reajustar} detalhe="Cliente com margem/ticket para mexer" icone="📈" cor={resumoCarteira.reajustar > 0 ? 'yellow' : 'green'} />
          <Kpi titulo="Recuperar clientes" valor={resumoCarteira.recuperar} detalhe="Sem embarcar há muito tempo" icone="📞" cor={resumoCarteira.recuperar > 0 ? 'orange' : 'green'} />
          <Kpi titulo="Clientes com risco" valor={resumoCarteira.risco} detalhe="Cobrança ou custo pendente" icone="⚠️" cor={resumoCarteira.risco > 0 ? 'red' : 'green'} />
          <Kpi titulo="Ticket médio" valor={moeda(resumoCarteira.ticketMedio)} detalhe="Receita / processos pagos" icone="🧾" cor="blue" />
        </section>

        <IntelligenceCRM />

        <section className="grid grid-cols-1 2xl:grid-cols-5 gap-6 mb-6">
          <Card className="2xl:col-span-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
              <div>
                <h2 className="text-2xl font-black">Carteira de Clientes</h2>
                <p className="text-slate-400 text-sm">
                  Carteira montada pelo histórico completo de Financeiro &gt; Processos Faturados.
                </p>
              </div>
              <span className="text-blue-400 text-sm font-bold">
                {carteiraClientesFiltrada.length} de {carteiraClientes.length} cliente(s)
              </span>
            </div>

            <div className="mb-5 rounded-2xl border border-blue-900 bg-[#020817] p-4">
              <div className="mb-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <p className="font-black text-white">Filtros da carteira</p>
                  <p className="text-slate-500 text-sm">Filtre por ação comercial, recomendação, serviço, recência ou nome do cliente.</p>
                </div>

                <button
                  type="button"
                  onClick={limparFiltrosCarteira}
                  className="bg-slate-700 hover:bg-slate-600 px-4 py-3 rounded-xl font-bold text-sm"
                >
                  Limpar filtros
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
                <input
                  value={buscaCliente}
                  onChange={(e) => setBuscaCliente(e.target.value)}
                  placeholder="Buscar cliente, serviço ou motivo..."
                  className="w-full"
                />

                <select value={filtroAcaoCliente} onChange={(e) => setFiltroAcaoCliente(e.target.value)}>
                  <option value="TODOS">Ação: todas</option>
                  <option value="FOCAR">Focar / crescer</option>
                  <option value="AUMENTAR_TICKET">Aumentar ticket</option>
                  <option value="RECUPERAR">Recuperar cliente</option>
                  <option value="RISCO">Risco / corrigir</option>
                  <option value="SEM_CUSTO">Com custo pendente</option>
                  <option value="COBRANCA">Com cobrança vencida</option>
                </select>

                <select value={filtroRecomendacao} onChange={(e) => setFiltroRecomendacao(e.target.value)}>
                  <option value="TODOS">Recomendação: todas</option>
                  <option value="FOCAR">FOCAR</option>
                  <option value="MANTER / CRESCER">MANTER / CRESCER</option>
                  <option value="REAJUSTAR">REAJUSTAR</option>
                  <option value="AUMENTAR TICKET">AUMENTAR TICKET</option>
                  <option value="COBRAR / SEGURAR">COBRAR / SEGURAR</option>
                  <option value="CORRIGIR CUSTO">CORRIGIR CUSTO</option>
                  <option value="REATIVAR">REATIVAR</option>
                  <option value="ANALISAR">ANALISAR</option>
                </select>

                <select value={filtroRecenciaCliente} onChange={(e) => setFiltroRecenciaCliente(e.target.value)}>
                  <option value="TODOS">Recência: todos</option>
                  <option value="ATIVOS">Ativos (&lt; 45 dias)</option>
                  <option value="PARADOS_45">Parados +45 dias</option>
                  <option value="PARADOS_90">Parados +90 dias</option>
                </select>

                <select value={filtroServicoCliente} onChange={(e) => setFiltroServicoCliente(e.target.value)}>
                  <option value="TODOS">Serviço: todos</option>
                  {servicosCarteira.map((servico) => (
                    <option key={servico} value={servico}>
                      {servico}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => setFiltroAcaoCliente('AUMENTAR_TICKET')} className="rounded-full border border-yellow-600 px-3 py-2 text-xs font-black text-yellow-300 hover:bg-yellow-600/10">Aumentar ticket</button>
                <button type="button" onClick={() => setFiltroAcaoCliente('RECUPERAR')} className="rounded-full border border-cyan-600 px-3 py-2 text-xs font-black text-cyan-300 hover:bg-cyan-600/10">Recuperar</button>
                <button type="button" onClick={() => setFiltroAcaoCliente('FOCAR')} className="rounded-full border border-green-600 px-3 py-2 text-xs font-black text-green-300 hover:bg-green-600/10">Focar</button>
                <button type="button" onClick={() => setFiltroAcaoCliente('RISCO')} className="rounded-full border border-red-600 px-3 py-2 text-xs font-black text-red-300 hover:bg-red-600/10">Corrigir risco</button>
                <button type="button" onClick={() => setFiltroRecenciaCliente('PARADOS_45')} className="rounded-full border border-orange-600 px-3 py-2 text-xs font-black text-orange-300 hover:bg-orange-600/10">Parados +45 dias</button>
              </div>
            </div>

            {carteiraClientesFiltrada.length === 0 ? (
              <p className="text-slate-500">Nenhum cliente encontrado com os filtros atuais. Verifique se o filtro de recência está ativo ou limpe os filtros.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1900px] text-sm">
                  <thead>
                    <tr className="text-slate-400 border-b border-blue-900">
                      <Th>Cliente</Th>
                      <Th>Recomendação</Th>
                      <Th>Processos</Th>
                      <Th>Receita</Th>
                      <Th>Profit HC</Th>
                      <Th>Margem</Th>
                      <Th>Ticket médio</Th>
                      <Th>Último processo</Th>
                      <Th>Sem embarcar</Th>
                      <Th>Quando agir</Th>
                      <Th>Status comercial</Th>
                      <Th>Último contato</Th>
                      <Th>Próxima ação</Th>
                      <Th>Ação</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {carteiraClientesFiltrada.map((item) => (
                      <tr
                        key={item.nome}
                        onClick={() => abrirDetalheCliente(item)}
                        className="border-b border-blue-950 hover:bg-blue-950/20 cursor-pointer"
                      >
                        <Td>
                          <strong>{item.nome}</strong>
                          <p className="text-xs text-slate-500 mt-1">{item.motivo}</p>
                        </Td>
                        <Td><BadgeRecomendacao recomendacao={item.recomendacao} /></Td>
                        <Td>{item.processos}</Td>
                        <Td><strong className="text-blue-400">{moeda(item.receita)}</strong></Td>
                        <Td><strong className={item.profit >= 0 ? 'text-green-400' : 'text-red-400'}>{moeda(item.profit)}</strong></Td>
                        <Td><strong className={item.margem >= 15 ? 'text-green-400' : item.margem > 0 ? 'text-yellow-400' : 'text-red-400'}>{percentual(item.margem)}</strong></Td>
                        <Td><strong>{moeda(item.ticketMedio)}</strong></Td>
                        <Td>{dataBR(item.ultimoProcesso)}</Td>
                        <Td><strong className={item.diasSemEmbarque >= 60 ? 'text-orange-400' : 'text-slate-300'}>{item.diasSemEmbarque === 9999 ? '-' : `${item.diasSemEmbarque} dias`}</strong></Td>
                        <Td>{item.periodoAumento}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="2xl:col-span-2">
            <h2 className="text-2xl font-black mb-2">Assistente para aumentar ticket</h2>
            <p className="text-slate-400 text-sm mb-5">
              Priorize cliente com volume, margem baixa ou ticket pequeno. Não aumente quem está vencido ou com custo pendente.
            </p>

            <div className="space-y-4">
              <div className="rounded-2xl border border-yellow-700/60 bg-yellow-950/20 p-4">
                <p className="text-yellow-300 font-black">Regra de reajuste</p>
                <p className="text-slate-300 text-sm mt-2">
                  Margem abaixo de 10%: reajuste na próxima cotação. Margem entre 10% e 15%: reajuste nos próximos 30 dias. Ticket abaixo de R$ 1.500: aplicar taxa mínima ou vender serviço adicional.
                </p>
              </div>

              <Resumo label="1. Reajuste imediato" valor="Margem < 10%" cor="red" />
              <Resumo label="2. Reajuste programado" valor="Margem 10% a 15%" cor="yellow" />
              <Resumo label="3. Taxa mínima" valor="Ticket baixo" cor="blue" />
              <Resumo label="4. Upsell" valor="Cliente saudável" cor="green" />
              <Resumo label="5. Recuperação" valor="Sem embarcar +45 dias" cor="orange" />
            </div>
          </Card>
        </section>

        <section className="grid grid-cols-1 2xl:grid-cols-2 gap-6 mb-6">
          <Card>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
              <div>
                <h2 className="text-2xl font-black">Clientes para aumentar ticket</h2>
                <p className="text-slate-400 text-sm">
                  Lista prática de quem pode receber taxa mínima, reajuste ou venda adicional.
                </p>
              </div>
              <span className="text-yellow-400 text-sm font-bold">Quando aumentar e como abordar</span>
            </div>

            {clientesParaAumentarTicket.length === 0 ? (
              <p className="text-slate-500">Nenhum cliente pronto para aumento de ticket sem risco financeiro.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] text-sm">
                  <thead>
                    <tr className="text-slate-400 border-b border-blue-900">
                      <Th>Cliente</Th>
                      <Th>Motivo</Th>
                      <Th>Ticket</Th>
                      <Th>Margem</Th>
                      <Th>Potencial</Th>
                      <Th>Período</Th>
                      <Th>Ação sugerida</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesParaAumentarTicket.map((item) => (
                      <tr
                        key={item.nome}
                        onClick={() => abrirDetalheCliente(item)}
                        className="border-b border-blue-950 hover:bg-blue-950/20 cursor-pointer"
                      >
                        <Td><strong>{item.nome}</strong><p className="text-xs text-slate-500 mt-1">{item.servicoPrincipal}</p></Td>
                        <Td>{item.motivo}</Td>
                        <Td><strong>{moeda(item.ticketMedio)}</strong></Td>
                        <Td><strong className={item.margem >= 15 ? 'text-green-400' : item.margem > 0 ? 'text-yellow-400' : 'text-red-400'}>{percentual(item.margem)}</strong></Td>
                        <Td><strong className="text-blue-400">{item.potencialAumento}</strong></Td>
                        <Td><strong className="text-yellow-400">{item.periodoAumento}</strong></Td>
                        <Td>{item.acaoTicket}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
              <div>
                <h2 className="text-2xl font-black">Clientes para recuperar</h2>
                <p className="text-slate-400 text-sm">
                  Clientes que ficaram muito tempo sem embarcar e merecem contato comercial.
                </p>
              </div>
              <span className="text-cyan-400 text-sm font-bold">Reativação da carteira</span>
            </div>

            {clientesParaRecuperar.length === 0 ? (
              <p className="text-slate-500">Nenhum cliente parado há mais de 45 dias no histórico financeiro.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-sm">
                  <thead>
                    <tr className="text-slate-400 border-b border-blue-900">
                      <Th>Cliente</Th>
                      <Th>Último embarque</Th>
                      <Th>Tempo parado</Th>
                      <Th>Profit histórico</Th>
                      <Th>Serviço</Th>
                      <Th>Ação para chamar de volta</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesParaRecuperar.map((item) => (
                      <tr
                        key={item.nome}
                        onClick={() => abrirDetalheCliente(item)}
                        className="border-b border-blue-950 hover:bg-blue-950/20 cursor-pointer"
                      >
                        <Td><strong>{item.nome}</strong><p className="text-xs text-slate-500 mt-1">{item.processos} processo(s) no histórico</p></Td>
                        <Td>{dataBR(item.ultimoProcesso)}</Td>
                        <Td><strong className={item.diasSemEmbarque >= 90 ? 'text-red-400' : 'text-orange-400'}>{item.diasSemEmbarque} dias</strong></Td>
                        <Td><strong className={item.profit >= 0 ? 'text-green-400' : 'text-red-400'}>{moeda(item.profit)}</strong></Td>
                        <Td>{item.servicoPrincipal}</Td>
                        <Td>{item.diasSemEmbarque >= 90 ? 'Chamar agora com proposta de retomada e atualização de tabela.' : 'Enviar follow-up este mês perguntando próximos embarques.'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          <Card className="xl:col-span-2">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
              <div>
                <h2 className="text-2xl font-black">Lista de ação</h2>
                <p className="text-slate-400 text-sm">
                  O que precisa ser corrigido agora. Não é tela de caixa nem fechamento.
                </p>
              </div>
              <Link href="/admin/financeiro" className="text-blue-400 font-bold hover:text-blue-300 whitespace-nowrap">
                Corrigir no financeiro →
              </Link>
            </div>

            {problemasFinanceiros.length === 0 ? (
              <div className="rounded-2xl border border-green-900 bg-green-900/10 p-6 text-green-300 font-bold">
                Nenhuma pendência crítica encontrada para {periodoLabel()}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead>
                    <tr className="text-slate-400 border-b border-blue-900">
                      <Th>Prioridade</Th>
                      <Th>Problema</Th>
                      <Th>Descrição</Th>
                      <Th>Valor envolvido</Th>
                      <Th>Ação</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {problemasFinanceiros.map((item, index) => (
                      <tr key={`${item.tipo}-${index}`} className="border-b border-blue-950 hover:bg-blue-950/20">
                        <Td><Badge cor={item.prioridade === 'Alta' ? 'red' : item.prioridade === 'Média' ? 'yellow' : 'blue'}>{item.prioridade}</Badge></Td>
                        <Td><strong>{item.tipo}</strong></Td>
                        <Td>{item.descricao}</Td>
                        <Td><strong className={item.valor > 0 ? 'text-blue-400' : 'text-slate-500'}>{item.valor > 0 ? moeda(item.valor) : '-'}</strong></Td>
                        <Td><Link href={item.link} className="text-blue-400 font-bold hover:text-blue-300">{item.acao}</Link></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-2xl font-black mb-5">Alertas rápidos</h2>
            <Resumo label="Cobranças vencidas" valor={inteligencia.cobrancasVencidasFinanceiro.length} cor={inteligencia.cobrancasVencidasFinanceiro.length > 0 ? 'red' : 'green'} />
            <Resumo label="Cobranças em aberto" valor={inteligencia.cobrancasEmAbertoFinanceiro.length} cor={inteligencia.cobrancasEmAbertoFinanceiro.length > 0 ? 'orange' : 'green'} />
            <Resumo label="Embarques sem AWB" valor={inteligencia.embarquesSemAwb.length} cor={inteligencia.embarquesSemAwb.length > 0 ? 'yellow' : 'green'} />
            <Resumo label="Cotações sem fechamento" valor={inteligencia.cotacoesSemFechamento.length} cor={inteligencia.cotacoesSemFechamento.length > 0 ? 'purple' : 'green'} />
            <Resumo label="Processos sem cobrança" valor={inteligencia.semValorCobranca.length} cor={inteligencia.semValorCobranca.length > 0 ? 'yellow' : 'green'} />
            <Resumo label="Terceiros para conferir" valor={moeda(inteligencia.terceirosParaConferir)} cor="blue" />
          </Card>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          <Card className="xl:col-span-2">
            <div className="flex justify-between mb-5 gap-4">
              <div>
                <h2 className="text-2xl font-black">Clientes que precisam de atenção</h2>
                <p className="text-slate-400 text-sm">Ordenado por vencidos, processos sem custo e profit confirmado.</p>
              </div>
              <span className="text-blue-400 text-sm font-bold">Top 10</span>
            </div>

            {rankingClientes.length === 0 ? (
              <p className="text-slate-500">Nenhum processo financeiro encontrado no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="text-slate-400 border-b border-blue-900">
                      <Th>Cliente</Th>
                      <Th>Processos</Th>
                      <Th>Vencido</Th>
                      <Th>Sem custo</Th>
                      <Th>Profit confirmado</Th>
                      <Th>Margem</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingClientes.map((item) => (
                      <tr
                        key={item.nome}
                        onClick={() => abrirDetalheCliente(item)}
                        className="border-b border-blue-950 hover:bg-blue-950/20 cursor-pointer"
                      >
                        <Td><strong>{item.nome}</strong></Td>
                        <Td>{item.processos}</Td>
                        <Td><strong className={item.vencido > 0 ? 'text-red-400' : 'text-slate-500'}>{moeda(item.vencido)}</strong></Td>
                        <Td><strong className={item.semCusto > 0 ? 'text-yellow-400' : 'text-slate-500'}>{item.semCusto}</strong></Td>
                        <Td><strong className={item.profit >= 0 ? 'text-green-400' : 'text-red-400'}>{moeda(item.profit)}</strong></Td>
                        <Td>{percentual(item.margem)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-2xl font-black mb-5">Funil operacional</h2>
            <FunilLinha label="Cotações criadas" valor={funil.cotacoesCriadas} cor="purple" total={Math.max(funil.cotacoesCriadas, 1)} />
            <FunilLinha label="Cotações aprovadas" valor={funil.cotacoesAprovadas} cor="blue" total={Math.max(funil.cotacoesCriadas, 1)} />
            <FunilLinha label="Embarques criados" valor={funil.embarquesCriados} cor="green" total={Math.max(funil.embarquesCriados, funil.cotacoesCriadas, 1)} />
            <FunilLinha label="Processos no financeiro" valor={funil.processosFinanceiros} cor="yellow" total={Math.max(funil.processosFinanceiros, funil.embarquesCriados, 1)} />
            <FunilLinha label="Processos pagos" valor={funil.processosPagos} cor="orange" total={Math.max(funil.processosFinanceiros, 1)} />

            <div className="grid grid-cols-2 gap-3 mt-5">
              <MiniBox label="Cotação aprovada" valor={percentual(funil.conversaoCotacao)} />
              <MiniBox label="Financeiro pago" valor={percentual(funil.conversaoFinanceiro)} />
            </div>
          </Card>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          <Card>
            <h2 className="text-2xl font-black mb-5">Transportadoras para atenção</h2>
            <RankingOperacional lista={rankingTransportadoras} moeda={moeda} vazio="Nenhuma transportadora com alerta no período." />
          </Card>

          <Card>
            <h2 className="text-2xl font-black mb-5">Serviços para atenção</h2>
            <RankingOperacional lista={rankingServicos} moeda={moeda} vazio="Nenhum serviço com alerta no período." />
          </Card>
        </section>
      </div>
    </main>
  )
}

function Card({ children, className = '' }: any) {
  return (
    <div className={`border border-blue-900 rounded-3xl bg-gradient-to-b from-[#071225] to-[#020817] p-6 shadow-[0_0_35px_rgba(37,99,235,0.10)] ${className}`}>
      {children}
    </div>
  )
}

function Kpi({ titulo, valor, detalhe, icone, cor }: any) {
  const cores: any = {
    purple: 'text-purple-400 bg-purple-600/20 border-purple-700',
    green: 'text-green-400 bg-green-600/20 border-green-700',
    blue: 'text-blue-400 bg-blue-600/20 border-blue-700',
    orange: 'text-orange-400 bg-orange-600/20 border-orange-700',
    yellow: 'text-yellow-400 bg-yellow-600/20 border-yellow-700',
    red: 'text-red-400 bg-red-600/20 border-red-700',
  }

  return (
    <div className="border border-blue-900 rounded-3xl bg-gradient-to-b from-[#071225] to-[#020817] p-6">
      <div className="flex justify-between gap-4">
        <div>
          <p className="text-slate-400 text-sm font-bold uppercase">{titulo}</p>
          <h2 className="text-3xl font-black mt-3">{valor}</h2>
          <p className="text-slate-400 text-sm mt-3">{detalhe}</p>
        </div>

        <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-2xl ${cores[cor] || cores.blue}`}>
          {icone}
        </div>
      </div>
    </div>
  )
}

function Resumo({ label, valor, cor }: any) {
  const cores: any = {
    green: 'text-green-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    yellow: 'text-yellow-400',
    orange: 'text-orange-400',
  }

  return (
    <div className="flex justify-between border-b border-blue-900 py-4 gap-4">
      <span className="text-slate-300">{label}</span>
      <strong className={cores[cor] || 'text-blue-400'}>{valor}</strong>
    </div>
  )
}

function BadgeContato({ status }: any) {
  const labels: Record<string, string> = {
    NAO_CONTATADO: 'Não contatado',
    TENTOU_CONTATO: 'Tentou contato',
    SEM_RESPOSTA: 'Sem resposta',
    RESPONDEU: 'Respondeu',
    PEDIU_COTACAO: 'Pediu cotação',
    EM_NEGOCIACAO: 'Em negociação',
    REATIVADO: 'Reativado',
    SEM_INTERESSE: 'Sem interesse',
    PERDIDO: 'Perdido',
  }

  const cores: Record<string, string> = {
    NAO_CONTATADO: 'border-slate-600 text-slate-400 bg-slate-900/40',
    TENTOU_CONTATO: 'border-blue-500 text-blue-400 bg-blue-950/30',
    SEM_RESPOSTA: 'border-yellow-500 text-yellow-400 bg-yellow-950/30',
    RESPONDEU: 'border-green-500 text-green-400 bg-green-950/30',
    PEDIU_COTACAO: 'border-cyan-500 text-cyan-300 bg-cyan-950/30',
    EM_NEGOCIACAO: 'border-purple-500 text-purple-300 bg-purple-950/30',
    REATIVADO: 'border-green-500 text-green-300 bg-green-950/30',
    SEM_INTERESSE: 'border-orange-500 text-orange-300 bg-orange-950/30',
    PERDIDO: 'border-red-500 text-red-400 bg-red-950/30',
  }

  const chave = String(status || 'NAO_CONTATADO').toUpperCase()

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black whitespace-nowrap ${cores[chave] || cores.NAO_CONTATADO}`}>
      {labels[chave] || chave}
    </span>
  )
}

function Badge({ children, cor }: any) {
  const cores: any = {
    red: 'border-red-500 text-red-400 bg-red-950/30',
    yellow: 'border-yellow-500 text-yellow-400 bg-yellow-950/30',
    blue: 'border-blue-500 text-blue-400 bg-blue-950/30',
  }

  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${cores[cor] || cores.blue}`}>{children}</span>
}


function BadgeRecomendacao({ recomendacao }: any) {
  const cores: Record<string, string> = {
    'FOCAR': 'border-green-500 text-green-400 bg-green-950/30',
    'MANTER / CRESCER': 'border-blue-500 text-blue-400 bg-blue-950/30',
    'AUMENTAR TICKET': 'border-yellow-500 text-yellow-400 bg-yellow-950/30',
    'REAJUSTAR': 'border-orange-500 text-orange-400 bg-orange-950/30',
    'COBRAR / SEGURAR': 'border-red-500 text-red-400 bg-red-950/30',
    'CORRIGIR CUSTO': 'border-red-500 text-red-400 bg-red-950/30',
    'REATIVAR': 'border-cyan-500 text-cyan-300 bg-cyan-950/30',
    'ANALISAR': 'border-slate-500 text-slate-300 bg-slate-900/50',
  }

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black whitespace-nowrap ${cores[recomendacao] || cores.ANALISAR}`}>
      {recomendacao}
    </span>
  )
}

function Th({ children }: any) {
  return <th className="py-3 pr-4 text-left text-xs font-black uppercase tracking-wide">{children}</th>
}

function Td({ children }: any) {
  return <td className="py-4 pr-4 align-top text-slate-200">{children}</td>
}

function FunilLinha({ label, valor, cor, total }: any) {
  const cores: any = {
    purple: 'bg-purple-600',
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    yellow: 'bg-yellow-500',
    orange: 'bg-orange-500',
  }

  const largura = total > 0 ? Math.max(8, Math.min(100, (Number(valor || 0) / Number(total || 1)) * 100)) : 0

  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-slate-300 font-bold">{label}</span>
        <span className="text-white font-black">{valor}</span>
      </div>
      <div className="h-3 bg-slate-900 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${cores[cor] || cores.blue}`} style={{ width: `${largura}%` }} />
      </div>
    </div>
  )
}

function MiniBox({ label, valor }: any) {
  return (
    <div className="border border-blue-900 rounded-2xl bg-[#020817] p-3">
      <p className="text-slate-500 text-xs">{label}</p>
      <strong>{valor}</strong>
    </div>
  )
}

function RankingOperacional({ lista, moeda, vazio }: any) {
  if (!lista || lista.length === 0) {
    return <p className="text-slate-500">{vazio}</p>
  }

  return (
    <div className="space-y-4">
      {lista.map((item: any) => (
        <div key={item.nome} className="border border-blue-900 bg-[#020817] rounded-2xl p-4">
          <div className="flex justify-between gap-3 mb-3">
            <strong className="truncate">{item.nome}</strong>
            <span className="text-blue-400 font-black">{item.processos} proc.</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-slate-500 text-xs">Vencido</p>
              <strong className={item.vencido > 0 ? 'text-red-400' : 'text-slate-500'}>{moeda(item.vencido)}</strong>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Sem custo</p>
              <strong className={item.semCusto > 0 ? 'text-yellow-400' : 'text-slate-500'}>{item.semCusto}</strong>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Profit</p>
              <strong className={item.profit >= 0 ? 'text-green-400' : 'text-red-400'}>{moeda(item.profit)}</strong>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
