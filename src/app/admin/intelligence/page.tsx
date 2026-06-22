'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

const TABELAS_OPCIONAIS = ['chamados_suporte', 'suporte']

export default function IntelligencePage() {
  const [embarques, setEmbarques] = useState<any[]>([])
  const [cotacoes, setCotacoes] = useState<any[]>([])
  const [faturas, setFaturas] = useState<any[]>([])
  const [chamados, setChamados] = useState<any[]>([])
  const [financeiroEmbarques, setFinanceiroEmbarques] = useState<any[]>([])
  const [financeiroMovimentacoes, setFinanceiroMovimentacoes] = useState<any[]>([])
  const [avisos, setAvisos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [periodoTipo, setPeriodoTipo] = useState<'MES' | 'ANO' | 'TUDO'>('MES')
  const [mesFiltro, setMesFiltro] = useState(new Date().toISOString().slice(0, 7))

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

    let chamadosEncontrados: any[] = []

    for (const tabela of TABELAS_OPCIONAIS) {
      const dados = await buscarTabela(tabela, true)
      if (dados.length > 0) {
        chamadosEncontrados = dados
        break
      }
    }

    setEmbarques(emb)
    setCotacoes(cot)
    setFaturas(fat)
    setFinanceiroEmbarques(fin)
    setFinanceiroMovimentacoes(mov)
    setChamados(chamadosEncontrados)
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

  function normalizarTexto(valor: any) {
    return String(valor || '').trim()
  }

  function normalizarBusca(valor: any) {
    return normalizarTexto(valor)
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

    const texto = String(valor).trim()
    if (!texto || texto === '0') return ''
    if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10)

    const partes = texto.split('/')
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

  function datasPeriodo() {
    const ano = mesFiltro.slice(0, 4)
    const mes = mesFiltro.slice(5, 7)
    const ultimoDiaMes = new Date(Number(ano), Number(mes), 0).getDate()

    if (periodoTipo === 'ANO') {
      return {
        inicio: `${ano}-01-01`,
        fim: `${ano}-12-31`,
        label: `Ano ${ano}`,
      }
    }

    if (periodoTipo === 'TUDO') {
      return {
        inicio: '',
        fim: '',
        label: 'Todo o histórico',
      }
    }

    return {
      inicio: `${ano}-${mes}-01`,
      fim: `${ano}-${mes}-${String(ultimoDiaMes).padStart(2, '0')}`,
      label: `${formatarMes(mesFiltro)}`,
    }
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

  function mesFinanceiro(item: any) {
    return (
      item.mes_profit ||
      item.mes ||
      mesDaData(item.recebimento) ||
      mesDaData(item.vencimento_cobranca) ||
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

  function statusCobranca(item: any) {
    if (normalizarData(item.recebimento) || normalizarData(item.data_pagamento)) return 'PAGO'

    const vencimento = normalizarData(item.vencimento_cobranca || item.vencimento)
    const hoje = new Date().toISOString().slice(0, 10)

    if (vencimento && vencimento < hoje) return 'ATRASADO'
    return 'EM ABERTO'
  }

  function statusMovimento(item: any) {
    if (item.status === 'PAGO' || normalizarData(item.data_pagamento)) return 'PAGO'

    const vencimento = normalizarData(item.data_vencimento)
    const hoje = new Date().toISOString().slice(0, 10)

    if (vencimento && vencimento < hoje) return 'VENCIDO'
    return item.status || 'PENDENTE'
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

  function statusFatura(item: any) {
    if (item.recibo_pdf || item.data_pagamento || item.recebimento) return 'PAGO'

    const vencimento = normalizarData(item.vencimento || item.vencimento_cobranca)
    const hoje = new Date().toISOString().slice(0, 10)

    if (vencimento && vencimento < hoje) return 'VENCIDO'
    return 'PENDENTE'
  }

  function custosProcesso(item: any) {
    return numero(item.doc_dta) + numero(item.debito_terceiro) + numero(item.valor_compra)
  }

  function temCusto(item: any) {
    return numero(item.valor_compra) > 0
  }

  function profitProcesso(item: any) {
    if (!temCusto(item)) return 0
    return numero(item.valor_cobranca) - custosProcesso(item)
  }

  function clienteDoProcesso(item: any) {
    return normalizarTexto(item.cliente || item.cliente_final || item.importador || item.exportador || 'Não informado')
  }

  function transportadoraDoProcesso(item: any) {
    return normalizarTexto(item.transportadora || item.empresa_prestadora || 'Não informado')
  }

  function servicoDoProcesso(item: any) {
    return normalizarTexto(item.servico || item.tipo_servico || 'Não informado')
  }

  function awbDoProcesso(item: any) {
    return normalizarTexto(item.awb || item.numero_awb || '-')
  }

  function faturaDoProcesso(item: any) {
    return normalizarTexto(item.fatura || item.numero_fatura || '')
  }

  function diasEntre(dataA: string, dataB: string) {
    const a = new Date(`${dataA}T00:00:00`)
    const b = new Date(`${dataB}T00:00:00`)
    return Math.round((b.getTime() - a.getTime()) / 86400000)
  }

  function formatarMes(valor: any) {
    const texto = String(valor || '')
    if (!/^\d{4}-\d{2}$/.test(texto)) return texto || '-'

    const [ano, mes] = texto.split('-')
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

    return `${nomes[mes] || mes}/${ano}`
  }

  const periodo = datasPeriodo()
  const hoje = new Date().toISOString().slice(0, 10)
  const em7Dias = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const em15Dias = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)
  const em30Dias = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  const dadosPeriodo = useMemo(() => {
    const fin = financeiroEmbarques.filter((item) => estaNoPeriodoPorMes(mesFinanceiro(item)))
    const mov = financeiroMovimentacoes.filter((item) => estaNoPeriodoPorMes(mesMovimento(item)))
    const fat = faturas.filter((item) => estaNoPeriodoPorMes(mesFatura(item)))
    const emb = embarques.filter((item) => estaNoPeriodoPorMes(mesEmbarque(item)))
    const cot = cotacoes.filter((item) => estaNoPeriodoPorMes(mesCotacao(item)))

    return { fin, mov, fat, emb, cot }
  }, [financeiroEmbarques, financeiroMovimentacoes, faturas, embarques, cotacoes, periodoTipo, mesFiltro])

  const inteligencia = useMemo(() => {
    const processos = dadosPeriodo.fin
    const movimentos = dadosPeriodo.mov
    const faturasPeriodo = dadosPeriodo.fat
    const embarquesPeriodo = dadosPeriodo.emb
    const cotacoesPeriodo = dadosPeriodo.cot

    const pagos = processos.filter((item) => statusCobranca(item) === 'PAGO')
    const abertos = processos.filter((item) => statusCobranca(item) === 'EM ABERTO')
    const atrasados = processos.filter((item) => statusCobranca(item) === 'ATRASADO')
    const pagosComCusto = pagos.filter((item) => temCusto(item))
    const pagosSemCusto = pagos.filter((item) => !temCusto(item) && numero(item.valor_cobranca) > 0)

    const receitaConfirmada = pagos.reduce((acc, item) => acc + numero(item.valor_cobranca), 0)
    const custoConfirmado = pagosComCusto.reduce((acc, item) => acc + custosProcesso(item), 0)
    const profitConfirmado = pagosComCusto.reduce((acc, item) => acc + profitProcesso(item), 0)
    const margemConfirmada = receitaConfirmada > 0 ? (profitConfirmado / receitaConfirmada) * 100 : 0
    const ticketMedio = pagos.length > 0 ? receitaConfirmada / pagos.length : 0

    const despesasPagas = movimentos
      .filter((item) => item.tipo === 'DESPESA' && statusMovimento(item) === 'PAGO')
      .reduce((acc, item) => acc + numero(item.valor), 0)

    const despesasPendentes = movimentos
      .filter((item) => item.tipo === 'DESPESA' && statusMovimento(item) !== 'PAGO')
      .reduce((acc, item) => acc + numero(item.valor), 0)

    const retiradasSocios = movimentos
      .filter((item) => ['RETIRADA_SOCIO', 'PAGAMENTO_SOCIO', 'REEMBOLSO_SOCIO'].includes(item.tipo) && statusMovimento(item) === 'PAGO')
      .reduce((acc, item) => acc + numero(item.valor), 0)

    const aportes = movimentos
      .filter((item) => item.tipo === 'APORTE_SOCIO' && statusMovimento(item) === 'PAGO')
      .reduce((acc, item) => acc + numero(item.valor), 0)

    const reservasFundo = movimentos
      .filter((item) => ehReservaOperacionalFundo(item) && statusMovimento(item) === 'PAGO')
      .reduce((acc, item) => acc + numero(item.valor), 0)

    const entradasNaoOperacionais = movimentos
      .filter((item) => item.tipo === 'FUNDO_CAIXA_ENTRADA' && statusMovimento(item) === 'PAGO' && !ehReservaOperacionalFundo(item))
      .reduce((acc, item) => acc + numero(item.valor), 0)

    const saidasFundo = movimentos
      .filter((item) => item.tipo === 'FUNDO_CAIXA_SAIDA' && statusMovimento(item) === 'PAGO')
      .reduce((acc, item) => acc + numero(item.valor), 0)

    const terceirosProtegidos = pagos.reduce((acc, item) => acc + numero(item.debito_terceiro), 0)
    const custosOperacionaisProtegidos = pagos.reduce((acc, item) => acc + numero(item.doc_dta) + numero(item.valor_compra), 0)
    const caixaProtegido = terceirosProtegidos + custosOperacionaisProtegidos

    const resultadoOperacional = profitConfirmado - despesasPagas
    const lucroDistribuivel = Math.max(resultadoOperacional, 0)
    const fundoMinimoRegra = lucroDistribuivel * 0.5
    const parteSocio = lucroDistribuivel * 0.25
    const saldoGerencial = resultadoOperacional + aportes + entradasNaoOperacionais - retiradasSocios - saidasFundo
    const caixaLivreHC = saldoGerencial
    const usoCaixaProtegido = Math.max(caixaLivreHC * -1, 0)
    const faltaReservaHC = Math.max(fundoMinimoRegra - Math.max(caixaLivreHC, 0), 0)
    const precisaRepor = usoCaixaProtegido + faltaReservaHC
    const podeGastar = precisaRepor > 0 ? 0 : Math.max(caixaLivreHC - fundoMinimoRegra, 0)

    const totalVencido = atrasados.reduce((acc, item) => acc + numero(item.valor_cobranca), 0)
    const totalAberto = abertos.reduce((acc, item) => acc + numero(item.valor_cobranca), 0)

    function totalAReceberAte(dataLimite: string) {
      return processos
        .filter((item) => statusCobranca(item) !== 'PAGO')
        .filter((item) => {
          const vencimento = normalizarData(item.vencimento_cobranca)
          return vencimento && vencimento >= hoje && vencimento <= dataLimite
        })
        .reduce((acc, item) => acc + numero(item.valor_cobranca), 0)
    }

    const aReceberHoje = processos
      .filter((item) => statusCobranca(item) !== 'PAGO')
      .filter((item) => normalizarData(item.vencimento_cobranca) === hoje)
      .reduce((acc, item) => acc + numero(item.valor_cobranca), 0)

    const aReceber7 = totalAReceberAte(em7Dias)
    const aReceber15 = totalAReceberAte(em15Dias)
    const aReceber30 = totalAReceberAte(em30Dias)

    const faturasVencidas = faturasPeriodo.filter((item) => statusFatura(item) === 'VENCIDO')
    const faturasPendentes = faturasPeriodo.filter((item) => statusFatura(item) !== 'PAGO')

    const embarquesSemAwb = embarquesPeriodo.filter((item) => {
      const awb = normalizarBusca(item.awb)
      return !awb || awb.includes('AGUARDANDO') || awb === '-'
    })

    const cotacoesAprovadas = cotacoesPeriodo.filter((item) => {
      const status = normalizarBusca(item.status_comercial || item.status)
      return status.includes('APROV') || status.includes('FECH') || status.includes('CONVERT')
    })

    const cotacoesSemFechamento = cotacoesPeriodo.filter((item) => {
      const status = normalizarBusca(item.status_comercial || item.status)
      return !status.includes('APROV') && !status.includes('FECH') && !status.includes('CONVERT')
    })

    const chamadosAbertos = chamados.filter((item) => {
      if (!estaNoPeriodoPorData(item.created_at || item.data_abertura || item.updated_at)) return false
      const status = normalizarBusca(item.status)
      return !status.includes('FECHADO') && !status.includes('RESOLVIDO') && !status.includes('FINALIZADO')
    })

    return {
      processos,
      movimentos,
      faturasPeriodo,
      embarquesPeriodo,
      cotacoesPeriodo,
      pagos,
      abertos,
      atrasados,
      pagosComCusto,
      pagosSemCusto,
      receitaConfirmada,
      custoConfirmado,
      profitConfirmado,
      margemConfirmada,
      ticketMedio,
      despesasPagas,
      despesasPendentes,
      resultadoOperacional,
      lucroDistribuivel,
      fundoMinimoRegra,
      parteSocio,
      reservasFundo,
      entradasNaoOperacionais,
      terceirosProtegidos,
      custosOperacionaisProtegidos,
      caixaProtegido,
      caixaLivreHC,
      usoCaixaProtegido,
      faltaReservaHC,
      precisaRepor,
      saldoGerencial,
      podeGastar,
      totalVencido,
      totalAberto,
      aReceberHoje,
      aReceber7,
      aReceber15,
      aReceber30,
      faturasVencidas,
      faturasPendentes,
      embarquesSemAwb,
      cotacoesAprovadas,
      cotacoesSemFechamento,
      chamadosAbertos,
    }
  }, [dadosPeriodo, chamados, periodoTipo, mesFiltro])

  const rankingClientes = useMemo(() => {
    const mapa: Record<string, any> = {}

    inteligencia.processos.forEach((item) => {
      const nome = clienteDoProcesso(item)

      if (!mapa[nome]) {
        mapa[nome] = {
          nome,
          processos: 0,
          pagos: 0,
          receita: 0,
          custo: 0,
          profit: 0,
          vencido: 0,
          emAberto: 0,
          semCusto: 0,
        }
      }

      mapa[nome].processos += 1

      const status = statusCobranca(item)

      if (status === 'PAGO') {
        mapa[nome].pagos += 1
        mapa[nome].receita += numero(item.valor_cobranca)

        if (temCusto(item)) {
          mapa[nome].custo += custosProcesso(item)
          mapa[nome].profit += profitProcesso(item)
        } else if (numero(item.valor_cobranca) > 0) {
          mapa[nome].semCusto += 1
        }
      }

      if (status === 'ATRASADO') mapa[nome].vencido += numero(item.valor_cobranca)
      if (status === 'EM ABERTO') mapa[nome].emAberto += numero(item.valor_cobranca)
    })

    return Object.values(mapa)
      .map((item: any) => ({
        ...item,
        margem: item.receita > 0 ? (item.profit / item.receita) * 100 : 0,
      }))
      .sort((a: any, b: any) => b.profit - a.profit || b.receita - a.receita || b.processos - a.processos)
      .slice(0, 10)
  }, [inteligencia.processos])

  const problemasFinanceiros = useMemo(() => {
    const itens: any[] = []

    if (inteligencia.usoCaixaProtegido > 0) {
      itens.push({
        prioridade: 'Alta',
        tipo: 'Caixa protegido usado',
        descricao: 'Retiradas/gastos passaram do caixa livre da HC. O dinheiro de terceiros/custos pode ter sido usado.',
        valor: inteligencia.usoCaixaProtegido,
        acao: 'Bloquear retiradas',
        link: '/admin/financeiro',
      })
    }

    inteligencia.atrasados.forEach((item) => {
      const vencimento = normalizarData(item.vencimento_cobranca)
      const dias = vencimento ? Math.max(diasEntre(vencimento, hoje), 0) : 0

      itens.push({
        prioridade: 'Alta',
        tipo: 'Cobrança vencida',
        descricao: `${clienteDoProcesso(item)} • AWB ${awbDoProcesso(item)} • ${dias} dia(s) vencido`,
        valor: numero(item.valor_cobranca),
        acao: 'Cobrar cliente',
        link: '/admin/financeiro',
      })
    })

    inteligencia.pagosSemCusto.forEach((item) => {
      itens.push({
        prioridade: 'Alta',
        tipo: 'Profit incompleto',
        descricao: `${clienteDoProcesso(item)} • AWB ${awbDoProcesso(item)} • venda paga sem custo`,
        valor: numero(item.valor_cobranca),
        acao: 'Preencher valor de compra',
        link: '/admin/financeiro',
      })
    })

    inteligencia.processos
      .filter((item) => numero(item.valor_cobranca) <= 0)
      .forEach((item) => {
        itens.push({
          prioridade: 'Média',
          tipo: 'Sem valor de cobrança',
          descricao: `${clienteDoProcesso(item)} • AWB ${awbDoProcesso(item)}`,
          valor: 0,
          acao: 'Conferir faturamento',
          link: '/admin/financeiro',
        })
      })

    inteligencia.pagos
      .filter((item) => !faturaDoProcesso(item))
      .forEach((item) => {
        itens.push({
          prioridade: 'Média',
          tipo: 'Pago sem fatura informada',
          descricao: `${clienteDoProcesso(item)} • AWB ${awbDoProcesso(item)}`,
          valor: numero(item.valor_cobranca),
          acao: 'Informar fatura',
          link: '/admin/financeiro',
        })
      })

    inteligencia.pagos
      .filter((item) => statusCobranca(item) === 'PAGO' && !item.mes_profit)
      .forEach((item) => {
        itens.push({
          prioridade: 'Baixa',
          tipo: 'Sem mês de profit',
          descricao: `${clienteDoProcesso(item)} • AWB ${awbDoProcesso(item)}`,
          valor: numero(item.valor_cobranca),
          acao: 'Definir mês do profit',
          link: '/admin/financeiro',
        })
      })

    inteligencia.embarquesSemAwb.slice(0, 10).forEach((item) => {
      itens.push({
        prioridade: 'Média',
        tipo: 'Embarque sem AWB',
        descricao: `${item.cliente_final || item.importador || item.exportador || 'Cliente não informado'} • ${item.referencia_hc || item.referencia_cliente || 'sem referência'}`,
        valor: 0,
        acao: 'Atualizar embarque',
        link: '/admin/embarques',
      })
    })

    return itens
      .sort((a, b) => {
        const peso: Record<string, number> = { Alta: 3, Média: 2, Baixa: 1 }
        return (peso[b.prioridade] || 0) - (peso[a.prioridade] || 0) || b.valor - a.valor
      })
      .slice(0, 15)
  }, [inteligencia, hoje])

  const previsaoRecebimento = useMemo(() => {
    const linhas = [
      { periodo: 'Vencido', valor: inteligencia.totalVencido, detalhe: `${inteligencia.atrasados.length} processo(s)`, cor: 'red' },
      { periodo: 'Hoje', valor: inteligencia.aReceberHoje, detalhe: 'vence hoje', cor: 'yellow' },
      { periodo: 'Próximos 7 dias', valor: inteligencia.aReceber7, detalhe: 'inclui hoje', cor: 'blue' },
      { periodo: 'Próximos 15 dias', valor: inteligencia.aReceber15, detalhe: 'curto prazo', cor: 'purple' },
      { periodo: 'Próximos 30 dias', valor: inteligencia.aReceber30, detalhe: 'previsão mensal', cor: 'green' },
      { periodo: 'Total em aberto', valor: inteligencia.totalAberto + inteligencia.totalVencido, detalhe: `${inteligencia.abertos.length + inteligencia.atrasados.length} processo(s)`, cor: 'blue' },
    ]

    return linhas
  }, [inteligencia])

  const profitTransportadora = useMemo(() => {
    const mapa: Record<string, any> = {}

    inteligencia.pagos.forEach((item) => {
      const nome = transportadoraDoProcesso(item)
      if (!mapa[nome]) mapa[nome] = { nome, processos: 0, receita: 0, profit: 0, semCusto: 0 }

      mapa[nome].processos += 1
      mapa[nome].receita += numero(item.valor_cobranca)

      if (temCusto(item)) mapa[nome].profit += profitProcesso(item)
      else if (numero(item.valor_cobranca) > 0) mapa[nome].semCusto += 1
    })

    return Object.values(mapa)
      .map((item: any) => ({ ...item, margem: item.receita > 0 ? (item.profit / item.receita) * 100 : 0 }))
      .sort((a: any, b: any) => b.profit - a.profit || b.processos - a.processos)
      .slice(0, 8)
  }, [inteligencia.pagos])

  const profitServico = useMemo(() => {
    const mapa: Record<string, any> = {}

    inteligencia.pagos.forEach((item) => {
      const nome = servicoDoProcesso(item)
      if (!mapa[nome]) mapa[nome] = { nome, processos: 0, receita: 0, profit: 0, semCusto: 0 }

      mapa[nome].processos += 1
      mapa[nome].receita += numero(item.valor_cobranca)

      if (temCusto(item)) mapa[nome].profit += profitProcesso(item)
      else if (numero(item.valor_cobranca) > 0) mapa[nome].semCusto += 1
    })

    return Object.values(mapa)
      .map((item: any) => ({ ...item, margem: item.receita > 0 ? (item.profit / item.receita) * 100 : 0 }))
      .sort((a: any, b: any) => b.profit - a.profit || b.processos - a.processos)
      .slice(0, 8)
  }, [inteligencia.pagos])

  const funil = useMemo(() => {
    const cotacoesCriadas = inteligencia.cotacoesPeriodo.length
    const cotacoesAprovadas = inteligencia.cotacoesAprovadas.length
    const embarquesCriados = inteligencia.embarquesPeriodo.length
    const processosFinanceiros = inteligencia.processos.length
    const processosPagos = inteligencia.pagos.length

    return {
      cotacoesCriadas,
      cotacoesAprovadas,
      embarquesCriados,
      processosFinanceiros,
      processosPagos,
      conversaoCotacaoEmbarque: cotacoesCriadas > 0 ? (embarquesCriados / cotacoesCriadas) * 100 : 0,
      conversaoFinanceiroPago: processosFinanceiros > 0 ? (processosPagos / processosFinanceiros) * 100 : 0,
    }
  }, [inteligencia])

  const capacidadeDecisao = useMemo(() => {
    if (inteligencia.usoCaixaProtegido > 0) {
      return {
        status: 'Crítico',
        texto: `O caixa livre da HC ficou negativo. Você precisa repor ${moeda(inteligencia.usoCaixaProtegido)} de caixa protegido antes de qualquer retirada.`,
        cor: 'red',
      }
    }

    if (inteligencia.faltaReservaHC > 0) {
      return {
        status: 'Atenção',
        texto: `Falta ${moeda(inteligencia.faltaReservaHC)} para completar o caixa mínimo pela regra 50/25/25.`,
        cor: 'yellow',
      }
    }

    if (inteligencia.pagosSemCusto.length > 0) {
      return {
        status: 'Conferir profit',
        texto: `${inteligencia.pagosSemCusto.length} processo(s) pagos estão sem custo. O profit pode estar incompleto.`,
        cor: 'blue',
      }
    }

    return {
      status: 'Saudável',
      texto: 'Caixa livre da HC acima do mínimo, sem uso de dinheiro protegido no período.',
      cor: 'green',
    }
  }, [inteligencia])

  if (loading) {
    return (
      <main className="max-w-[1700px] mx-auto p-8 text-white">
        <div className="rounded-3xl border border-blue-900 bg-[#071225] p-8">
          <h1 className="text-3xl font-black">Carregando Intelligence...</h1>
          <p className="text-slate-400 mt-2">Buscando financeiro, embarques, faturas, cotações e chamados.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-[1700px] mx-auto p-8 text-white">
      <div className="border border-blue-900 rounded-3xl bg-[#071225] p-5 mb-6 flex flex-col xl:flex-row justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-purple-600/20 text-purple-400 flex items-center justify-center text-3xl">
            🧠
          </div>

          <div>
            <h1 className="text-4xl font-black">Intelligence HC</h1>
            <p className="text-slate-400">
              Central de decisão com caixa livre, caixa protegido, cobrança e profit real
            </p>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap items-center">
          <select
            value={periodoTipo}
            onChange={(e) => setPeriodoTipo(e.target.value as 'MES' | 'ANO' | 'TUDO')}
            className="border border-blue-900 bg-[#020817] px-4 py-3 rounded-xl font-bold outline-none"
          >
            <option value="MES">Mês</option>
            <option value="ANO">Ano</option>
            <option value="TUDO">Todo histórico</option>
          </select>

          <input
            type="month"
            value={mesFiltro}
            onChange={(e) => setMesFiltro(e.target.value)}
            className="border border-blue-900 bg-[#020817] px-4 py-3 rounded-xl font-bold outline-none"
          />

          <button
            onClick={carregar}
            className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl font-bold"
          >
            ↻ Atualizar
          </button>

          <Link
            href="/admin"
            className="bg-purple-600 hover:bg-purple-500 px-5 py-3 rounded-xl font-bold"
          >
            Voltar
          </Link>
        </div>
      </div>

      {avisos.length > 0 && (
        <div className="border border-yellow-700 bg-yellow-900/20 rounded-2xl p-4 mb-6 text-yellow-200">
          <strong>Atenção:</strong> algumas fontes não carregaram. A tela continua funcionando com as tabelas disponíveis.
          <ul className="list-disc ml-5 mt-2 text-sm">
            {avisos.map((aviso) => (
              <li key={aviso}>{aviso}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-5 gap-5 mb-6">
        <Kpi titulo="A receber vencido" valor={moeda(inteligencia.totalVencido)} detalhe={`${inteligencia.atrasados.length} processo(s)`} icone="🚨" cor="red" />
        <Kpi titulo="Terceiros protegidos" valor={moeda(inteligencia.terceirosProtegidos)} detalhe="não pertence à HC" icone="🔒" cor="orange" />
        <Kpi titulo="Profit confirmado" valor={moeda(inteligencia.profitConfirmado)} detalhe="pago e com custo" icone="📈" cor="green" />
        <Kpi titulo="Uso caixa protegido" valor={moeda(inteligencia.usoCaixaProtegido)} detalhe="deve repor primeiro" icone="⛔" cor="red" />
        <Kpi titulo="Caixa livre HC" valor={moeda(inteligencia.caixaLivreHC)} detalhe="após retiradas" icone="💰" cor={inteligencia.caixaLivreHC >= 0 ? 'purple' : 'red'} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <Card className="xl:col-span-2">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-black">Ação urgente hoje</h2>
              <p className="text-slate-400 text-sm">{periodo.label} • financeiro, faturas, embarques e suporte</p>
            </div>

            <Badge cor={capacidadeDecisao.cor}>{capacidadeDecisao.status}</Badge>
          </div>

          <div className="rounded-2xl border border-blue-900 bg-[#020817] p-5 mb-5">
            <p className="text-lg font-bold">{capacidadeDecisao.texto}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MiniDecisao label="Caixa livre HC" valor={moeda(inteligencia.caixaLivreHC)} detalhe="dinheiro realmente da empresa" cor={inteligencia.caixaLivreHC >= 0 ? 'green' : 'red'} />
            <MiniDecisao label="Terceiros protegidos" valor={moeda(inteligencia.terceirosProtegidos)} detalhe="não pode retirar" cor="yellow" />
            <MiniDecisao label="Precisa repor" valor={moeda(inteligencia.precisaRepor)} detalhe="protegido + caixa mínimo" cor={inteligencia.precisaRepor > 0 ? 'red' : 'green'} />
            <MiniDecisao label="Pode gastar livre" valor={moeda(inteligencia.podeGastar)} detalhe="após protegido e caixa mínimo" cor={inteligencia.podeGastar > 0 ? 'green' : 'red'} />
          </div>
        </Card>

        <Card>
          <h2 className="text-2xl font-black mb-5">Alertas inteligentes</h2>
          <Resumo label="Cobranças vencidas" valor={`${inteligencia.atrasados.length} • ${moeda(inteligencia.totalVencido)}`} cor="red" />
          <Resumo label="Uso de caixa protegido" valor={moeda(inteligencia.usoCaixaProtegido)} cor={inteligencia.usoCaixaProtegido > 0 ? 'red' : 'green'} />
          <Resumo label="Pagos sem custo" valor={inteligencia.pagosSemCusto.length} cor="yellow" />
          <Resumo label="Faturas pendentes" valor={inteligencia.faturasPendentes.length} cor="orange" />
          <Resumo label="Embarques sem AWB" valor={inteligencia.embarquesSemAwb.length} cor="yellow" />
          <Resumo label="Cotações sem fechamento" valor={inteligencia.cotacoesSemFechamento.length} cor="purple" />
          <Resumo label="Chamados abertos" valor={inteligencia.chamadosAbertos.length} cor="red" />
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <Card>
          <h2 className="text-2xl font-black mb-5">Previsão de recebimento</h2>
          <div className="space-y-3">
            {previsaoRecebimento.map((item) => (
              <Previsao key={item.periodo} item={item} moeda={moeda} />
            ))}
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <div className="flex justify-between gap-4 mb-5">
            <div>
              <h2 className="text-2xl font-black">Processos que precisam de correção</h2>
              <p className="text-slate-400 text-sm">Lista priorizada para limpar gargalos do financeiro</p>
            </div>
            <Link href="/admin/financeiro" className="text-blue-400 font-bold hover:text-blue-300 whitespace-nowrap">
              Abrir financeiro →
            </Link>
          </div>

          {problemasFinanceiros.length === 0 ? (
            <div className="rounded-2xl border border-green-900 bg-green-900/10 p-6 text-green-300 font-bold">
              Nenhuma pendência crítica encontrada no período.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-blue-900">
                    <Th>Prioridade</Th>
                    <Th>Problema</Th>
                    <Th>Descrição</Th>
                    <Th>Valor</Th>
                    <Th>Ação</Th>
                  </tr>
                </thead>
                <tbody>
                  {problemasFinanceiros.map((item, index) => (
                    <tr key={`${item.tipo}-${index}`} className="border-b border-blue-950 hover:bg-blue-950/20">
                      <Td><Badge cor={item.prioridade === 'Alta' ? 'red' : item.prioridade === 'Média' ? 'yellow' : 'blue'}>{item.prioridade}</Badge></Td>
                      <Td><strong>{item.tipo}</strong></Td>
                      <Td>{item.descricao}</Td>
                      <Td><strong className={item.valor > 0 ? 'text-blue-400' : 'text-slate-500'}>{moeda(item.valor)}</strong></Td>
                      <Td><Link href={item.link} className="text-blue-400 font-bold hover:text-blue-300">{item.acao}</Link></Td>
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
          <div className="flex justify-between mb-5 gap-4">
            <div>
              <h2 className="text-2xl font-black">Ranking real por cliente</h2>
              <p className="text-slate-400 text-sm">Ordenado por profit confirmado, não apenas por quantidade</p>
            </div>
            <span className="text-blue-400 text-sm font-bold">Top 10</span>
          </div>

          {rankingClientes.length === 0 ? (
            <p className="text-slate-500">Nenhum processo financeiro encontrado no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-blue-900">
                    <Th>Cliente</Th>
                    <Th>Receita</Th>
                    <Th>Custo</Th>
                    <Th>Profit</Th>
                    <Th>Margem</Th>
                    <Th>Processos</Th>
                    <Th>Vencido</Th>
                  </tr>
                </thead>
                <tbody>
                  {rankingClientes.map((item) => (
                    <tr key={item.nome} className="border-b border-blue-950 hover:bg-blue-950/20">
                      <Td><strong>{item.nome}</strong></Td>
                      <Td>{moeda(item.receita)}</Td>
                      <Td>{moeda(item.custo)}</Td>
                      <Td><strong className={item.profit >= 0 ? 'text-green-400' : 'text-red-400'}>{moeda(item.profit)}</strong></Td>
                      <Td>{percentual(item.margem)}</Td>
                      <Td>{item.processos}</Td>
                      <Td><strong className={item.vencido > 0 ? 'text-red-400' : 'text-slate-500'}>{moeda(item.vencido)}</strong></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-2xl font-black mb-5">Resumo financeiro real</h2>
          <Resumo label="Receita confirmada" valor={moeda(inteligencia.receitaConfirmada)} cor="green" />
          <Resumo label="Terceiros a pagar/proteger" valor={moeda(inteligencia.terceirosProtegidos)} cor="orange" />
          <Resumo label="Caixa protegido total" valor={moeda(inteligencia.caixaProtegido)} cor="yellow" />
          <Resumo label="Custo confirmado" valor={moeda(inteligencia.custoConfirmado)} cor="red" />
          <Resumo label="Profit HC" valor={moeda(inteligencia.profitConfirmado)} cor="blue" />
          <Resumo label="Caixa livre HC" valor={moeda(inteligencia.caixaLivreHC)} cor={inteligencia.caixaLivreHC >= 0 ? 'green' : 'red'} />
          <Resumo label="Precisa repor" valor={moeda(inteligencia.precisaRepor)} cor={inteligencia.precisaRepor > 0 ? 'red' : 'green'} />
          <Resumo label="Margem média" valor={percentual(inteligencia.margemConfirmada)} cor="purple" />
          <Resumo label="Ticket médio" valor={moeda(inteligencia.ticketMedio)} cor="blue" />
          <Resumo label="Despesas pagas" valor={moeda(inteligencia.despesasPagas)} cor="red" />
          <Resumo label="Despesas pendentes" valor={moeda(inteligencia.despesasPendentes)} cor="yellow" />
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <Card>
          <h2 className="text-2xl font-black mb-5">Profit por transportadora</h2>
          <RankingOperacional lista={profitTransportadora} moeda={moeda} percentual={percentual} vazio="Nenhuma transportadora com processo pago no período." />
        </Card>

        <Card>
          <h2 className="text-2xl font-black mb-5">Profit por serviço</h2>
          <RankingOperacional lista={profitServico} moeda={moeda} percentual={percentual} vazio="Nenhum serviço com processo pago no período." />
        </Card>

        <Card>
          <h2 className="text-2xl font-black mb-5">Funil comercial real</h2>
          <FunilLinha label="Cotações criadas" valor={funil.cotacoesCriadas} cor="purple" total={Math.max(funil.cotacoesCriadas, 1)} />
          <FunilLinha label="Cotações aprovadas" valor={funil.cotacoesAprovadas} cor="blue" total={Math.max(funil.cotacoesCriadas, 1)} />
          <FunilLinha label="Embarques criados" valor={funil.embarquesCriados} cor="green" total={Math.max(funil.cotacoesCriadas, funil.embarquesCriados, 1)} />
          <FunilLinha label="Processos no financeiro" valor={funil.processosFinanceiros} cor="yellow" total={Math.max(funil.embarquesCriados, funil.processosFinanceiros, 1)} />
          <FunilLinha label="Processos pagos" valor={funil.processosPagos} cor="orange" total={Math.max(funil.processosFinanceiros, 1)} />

          <div className="grid grid-cols-2 gap-3 mt-5">
            <MiniDecisao label="Cotação → embarque" valor={percentual(funil.conversaoCotacaoEmbarque)} detalhe="conversão" cor="blue" />
            <MiniDecisao label="Financeiro pago" valor={percentual(funil.conversaoFinanceiroPago)} detalhe="recebimento" cor="green" />
          </div>
        </Card>
      </section>
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

        <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-2xl ${cores[cor]}`}>
          {icone}
        </div>
      </div>
    </div>
  )
}

function MiniDecisao({ label, valor, detalhe, cor }: any) {
  const cores: any = {
    green: 'text-green-400 border-green-900 bg-green-900/10',
    red: 'text-red-400 border-red-900 bg-red-900/10',
    blue: 'text-blue-400 border-blue-900 bg-blue-900/10',
    purple: 'text-purple-400 border-purple-900 bg-purple-900/10',
    yellow: 'text-yellow-400 border-yellow-900 bg-yellow-900/10',
  }

  return (
    <div className={`rounded-2xl border p-4 ${cores[cor] || cores.blue}`}>
      <p className="text-slate-400 text-xs font-bold uppercase">{label}</p>
      <h3 className="text-2xl font-black mt-2">{valor}</h3>
      <p className="text-slate-500 text-xs mt-2">{detalhe}</p>
    </div>
  )
}

function Badge({ children, cor }: any) {
  const cores: any = {
    green: 'text-green-300 border-green-700 bg-green-900/30',
    red: 'text-red-300 border-red-700 bg-red-900/30',
    yellow: 'text-yellow-300 border-yellow-700 bg-yellow-900/30',
    blue: 'text-blue-300 border-blue-700 bg-blue-900/30',
    purple: 'text-purple-300 border-purple-700 bg-purple-900/30',
  }

  return (
    <span className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-black whitespace-nowrap ${cores[cor] || cores.blue}`}>
      {children}
    </span>
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
      <strong className={`${cores[cor] || cores.blue} text-right`}>{valor}</strong>
    </div>
  )
}

function Previsao({ item, moeda }: any) {
  const cores: any = {
    red: 'border-red-900 bg-red-900/10 text-red-300',
    yellow: 'border-yellow-900 bg-yellow-900/10 text-yellow-300',
    blue: 'border-blue-900 bg-blue-900/10 text-blue-300',
    purple: 'border-purple-900 bg-purple-900/10 text-purple-300',
    green: 'border-green-900 bg-green-900/10 text-green-300',
  }

  return (
    <div className={`rounded-2xl border p-4 flex justify-between gap-4 ${cores[item.cor] || cores.blue}`}>
      <div>
        <p className="font-black">{item.periodo}</p>
        <p className="text-slate-500 text-xs mt-1">{item.detalhe}</p>
      </div>
      <strong className="text-right text-lg">{moeda(item.valor)}</strong>
    </div>
  )
}

function FunilLinha({ label, valor, cor, total }: any) {
  const cores: any = {
    purple: 'bg-purple-600',
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    yellow: 'bg-yellow-600',
    orange: 'bg-orange-600',
  }

  const width = total > 0 ? Math.max(8, Math.min(100, (Number(valor || 0) / total) * 100)) : 0

  return (
    <div className="mb-4">
      <div className="flex justify-between gap-4 mb-2">
        <span className="font-bold text-slate-300">{label}</span>
        <strong>{valor}</strong>
      </div>
      <div className="h-3 rounded-full bg-slate-900 overflow-hidden">
        <div className={`h-full rounded-full ${cores[cor] || cores.blue}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function RankingOperacional({ lista, moeda, percentual, vazio }: any) {
  if (!lista || lista.length === 0) {
    return <p className="text-slate-500">{vazio}</p>
  }

  const maiorProfit = Math.max(...lista.map((item: any) => Math.abs(Number(item.profit || 0))), 1)

  return (
    <div className="space-y-5">
      {lista.map((item: any) => {
        const width = Math.max(5, Math.min(100, (Math.abs(Number(item.profit || 0)) / maiorProfit) * 100))

        return (
          <div key={item.nome}>
            <div className="flex justify-between gap-4 mb-2">
              <div className="min-w-0">
                <p className="font-black truncate">{item.nome}</p>
                <p className="text-slate-500 text-xs">
                  {item.processos} processo(s) • margem {percentual(item.margem)}
                  {item.semCusto > 0 ? ` • ${item.semCusto} sem custo` : ''}
                </p>
              </div>
              <strong className={item.profit >= 0 ? 'text-green-400' : 'text-red-400'}>{moeda(item.profit)}</strong>
            </div>
            <div className="h-3 rounded-full bg-slate-900 overflow-hidden">
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${width}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Th({ children }: any) {
  return <th className="px-3 py-3 text-left font-black whitespace-nowrap">{children}</th>
}

function Td({ children }: any) {
  return <td className="px-3 py-3 align-top whitespace-nowrap">{children}</td>
}
