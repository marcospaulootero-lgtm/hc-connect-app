'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const LOTE_SUPABASE = 1000
const STORAGE_KEY = 'hc_admin_ranking_clientes_profit_hc_v3'

type FiltroRanking =
  | 'PROFIT'
  | 'FATURADOS'
  | 'TICKET'
  | 'MENOR_PROFIT'
  | 'MENOR_TICKET'
  | 'ATRASADOS'

type FiltroPeriodo = 'TODOS' | 'MES_ATUAL' | 'MES_ANTERIOR' | 'ULTIMOS_90' | 'ANO_ATUAL'

type ClienteRanking = {
  clienteKey: string
  nome: string
  processosFaturados: number
  comProfitHC: number
  aguardandoCusto: number
  pagos: number
  emAberto: number
  atrasados: number
  semDataFinanceira: number
  profitTotal: number
  ticketMedioProfit: number
  valorFaturadoTotal: number
  custoTotal: number
  pesoTotal: number
  ultimoRegistroData: string | null
  ultimoAwb: string
  ultimoStatus: string
  awbsFaturados: string[]
  transportadoras: string[]
  faturas: string[]
}

export default function ClientesPerformancePage() {
  const [financeiros, setFinanceiros] = useState<any[]>([])
  const [embarques, setEmbarques] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [busca, setBusca] = useState('')
  const [periodo, setPeriodo] = useState<FiltroPeriodo>('TODOS')
  const [rankingPor, setRankingPor] = useState<FiltroRanking>('PROFIT')
  const [somenteComMovimento, setSomenteComMovimento] = useState(true)
  const [clienteAbertoId, setClienteAbertoId] = useState<string | null>(null)

  useEffect(() => {
    const salvo = localStorage.getItem(STORAGE_KEY)

    if (salvo) {
      try {
        const dados = JSON.parse(salvo)
        if (dados.busca !== undefined) setBusca(dados.busca)
        if (dados.periodo) setPeriodo(dados.periodo)
        if (dados.rankingPor) setRankingPor(normalizarRankingSalvo(dados.rankingPor))
        if (dados.somenteComMovimento !== undefined) setSomenteComMovimento(dados.somenteComMovimento)
        if (dados.somenteComEmbarque !== undefined) setSomenteComMovimento(dados.somenteComEmbarque)
      } catch (error) {
        console.log('Erro ao carregar filtros salvos:', error)
      }
    }

    carregar()
  }, [])

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ busca, periodo, rankingPor, somenteComMovimento })
    )
  }, [busca, periodo, rankingPor, somenteComMovimento])

  function normalizarRankingSalvo(valor: any): FiltroRanking {
    const textoValor = String(valor || '').toUpperCase()

    if (textoValor === 'VALOR') return 'PROFIT'
    if (textoValor === 'EMBARQUES') return 'FATURADOS'
    if (textoValor === 'PESO') return 'FATURADOS'
    if (textoValor === 'PARADOS') return 'FATURADOS'

    if (
      textoValor === 'PROFIT' ||
      textoValor === 'FATURADOS' ||
      textoValor === 'TICKET' ||
      textoValor === 'MENOR_PROFIT' ||
      textoValor === 'MENOR_TICKET' ||
      textoValor === 'ATRASADOS'
    ) {
      return textoValor as FiltroRanking
    }

    return 'PROFIT'
  }

  async function carregar() {
    setLoading(true)

    const { data: embarquesData, error: erroEmbarques } = await supabase
      .from('embarques')
      .select('*')
      .order('criado_em', { ascending: false })

    if (erroEmbarques) console.log('ERRO EMBARQUES:', erroEmbarques)

    let financeiroData: any[] = []

    const { count, error: erroCount } = await supabase
      .from('financeiro_embarques')
      .select('*', { count: 'exact', head: true })

    if (erroCount) {
      console.log('ERRO COUNT FINANCEIRO:', erroCount)
    }

    const total = count || 0

    if (total > 0) {
      const paginas = Math.ceil(total / LOTE_SUPABASE)

      const consultas = Array.from({ length: paginas }, (_, index) => {
        const inicio = index * LOTE_SUPABASE
        const fim = inicio + LOTE_SUPABASE - 1

        return supabase
          .from('financeiro_embarques')
          .select('*')
          .range(inicio, fim)
      })

      const respostas = await Promise.all(consultas)
      const erroFinanceiro = respostas.find((res) => res.error)

      if (erroFinanceiro?.error) {
        console.log('ERRO FINANCEIRO:', erroFinanceiro.error)
      }

      financeiroData = respostas.flatMap((res) => res.data || [])
    }

    setEmbarques(embarquesData || [])
    setFinanceiros(financeiroData || [])
    setLoading(false)
  }

  function texto(valor: any) {
    return String(valor || '').trim()
  }

  function normalizarTexto(valor: any) {
    return texto(valor)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  }

  function normalizarAwb(valor: any) {
    return String(valor || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
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

  function dataBR(data?: string | null) {
    if (!data) return '-'

    const textoData = String(data).slice(0, 10)
    const [ano, mes, dia] = textoData.split('-')

    if (ano && mes && dia) return `${dia}/${mes}/${ano}`

    return new Date(data).toLocaleDateString('pt-BR')
  }

  function normalizarData(valor: any) {
    if (!valor) return null

    if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
      return valor.toISOString().slice(0, 10)
    }

    if (typeof valor === 'number') {
      const data = new Date((valor - 25569) * 86400 * 1000)
      return data.toISOString().slice(0, 10)
    }

    const textoData = String(valor).trim()
    if (!textoData || textoData === '0' || textoData === '-') return null

    if (/^\d{4}-\d{2}-\d{2}/.test(textoData)) return textoData.slice(0, 10)

    const partes = textoData.split('/')
    if (partes.length === 3) {
      const [dia, mes, ano] = partes
      return `${ano.padStart(4, '20')}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
    }

    const data = new Date(textoData)
    if (!Number.isNaN(data.getTime())) return data.toISOString().slice(0, 10)

    return null
  }

  function hojeISO() {
    return new Date().toISOString().slice(0, 10)
  }

  function dataInicioPeriodo() {
    const agora = new Date()
    const ano = agora.getFullYear()
    const mes = agora.getMonth()

    if (periodo === 'MES_ATUAL') return new Date(ano, mes, 1)
    if (periodo === 'MES_ANTERIOR') return new Date(ano, mes - 1, 1)

    if (periodo === 'ULTIMOS_90') {
      const data = new Date()
      data.setDate(data.getDate() - 90)
      return data
    }

    if (periodo === 'ANO_ATUAL') return new Date(ano, 0, 1)

    return null
  }

  function dataFimPeriodo() {
    const agora = new Date()
    const ano = agora.getFullYear()
    const mes = agora.getMonth()

    if (periodo === 'MES_ANTERIOR') return new Date(ano, mes, 1)

    return null
  }

  function dentroPeriodoPorISO(dataISO?: string | null) {
    if (periodo === 'TODOS') return true
    if (!dataISO) return false

    const data = new Date(`${dataISO}T00:00:00`)
    if (Number.isNaN(data.getTime())) return false

    const inicio = dataInicioPeriodo()
    const fim = dataFimPeriodo()

    if (inicio && data < inicio) return false
    if (fim && data >= fim) return false

    return true
  }

  function vencimentoFinanceiro(item: any) {
    return (
      item?.vencimento_cobranca ||
      item?.vencimento_cliente ||
      item?.vencimento ||
      item?.data_vencimento ||
      null
    )
  }

  function recebimentoFinanceiro(item: any) {
    return (
      item?.recebimento ||
      item?.recebimento_cliente ||
      item?.data_recebimento ||
      item?.data_pagamento ||
      null
    )
  }

  function dataReferenciaFinanceiro(item: any) {
    return normalizarData(
      vencimentoFinanceiro(item) ||
        recebimentoFinanceiro(item) ||
        item?.criado_em ||
        item?.created_at ||
        item?.data_importacao
    )
  }

  function financeiroDentroPeriodo(item: any) {
    return dentroPeriodoPorISO(dataReferenciaFinanceiro(item))
  }

  function statusPagamentoFinanceiro(item: any) {
    const recebimento = normalizarData(recebimentoFinanceiro(item))
    const vencimento = normalizarData(vencimentoFinanceiro(item))
    const hoje = hojeISO()

    if (recebimento) return 'PAGO'
    if (vencimento && vencimento < hoje) return 'ATRASADO'
    if (vencimento) return 'EM_ABERTO'
    return 'SEM_DATA'
  }

  function awbsFinanceiro(item: any) {
    return [
      item?.awb,
      item?.numero_awb,
      item?.hawb,
      item?.h_awb,
      item?.awb_original,
      item?.numero_embarque,
    ]
      .map(normalizarAwb)
      .filter(Boolean)
  }

  function clienteFinanceiro(item: any) {
    return (
      texto(item?.cliente) ||
      texto(item?.cliente_final) ||
      texto(item?.importador) ||
      texto(item?.tomador) ||
      texto(item?.pagador) ||
      'Cliente não identificado'
    )
  }

  function chaveClienteFinanceiro(item: any) {
    const nome = clienteFinanceiro(item)
    const chave = normalizarTexto(nome)

    return chave || `sem-cliente-${item?.id || Math.random().toString(36).slice(2)}`
  }

  function embarqueDoFinanceiro(item: any, embarquesPorId: Map<string, any>, embarquesPorAwb: Map<string, any>) {
    const embarqueId = String(item?.embarque_id || '')
    if (embarqueId && embarquesPorId.has(embarqueId)) return embarquesPorId.get(embarqueId)

    const awbs = awbsFinanceiro(item)

    for (const awb of awbs) {
      if (embarquesPorAwb.has(awb)) return embarquesPorAwb.get(awb)
    }

    return null
  }

  function valorFaturadoFinanceiro(item: any) {
    return (
      numero(item?.valor_cobranca) ||
      numero(item?.valor_faturado) ||
      numero(item?.valor_venda) ||
      numero(item?.valor) ||
      0
    )
  }

  function custoFinanceiro(item: any) {
    return numero(item?.doc_dta) + numero(item?.debito_terceiro) + numero(item?.valor_compra)
  }

  function possuiCustoFinanceiro(item: any) {
    return numero(item?.valor_compra) > 0
  }

  function profitHCFinanceiro(item: any) {
    if (!possuiCustoFinanceiro(item)) return null
    return valorFaturadoFinanceiro(item) - custoFinanceiro(item)
  }

  function criarRegistroCliente(clienteKey: string, nome: string): ClienteRanking {
    return {
      clienteKey,
      nome,
      processosFaturados: 0,
      comProfitHC: 0,
      aguardandoCusto: 0,
      pagos: 0,
      emAberto: 0,
      atrasados: 0,
      semDataFinanceira: 0,
      profitTotal: 0,
      ticketMedioProfit: 0,
      valorFaturadoTotal: 0,
      custoTotal: 0,
      pesoTotal: 0,
      ultimoRegistroData: null,
      ultimoAwb: '-',
      ultimoStatus: '-',
      awbsFaturados: [],
      transportadoras: [],
      faturas: [],
    }
  }

  const ranking = useMemo(() => {
    const embarquesPorId = new Map<string, any>()
    const embarquesPorAwb = new Map<string, any>()

    embarques.forEach((embarque) => {
      if (embarque.id) embarquesPorId.set(String(embarque.id), embarque)
      const awb = normalizarAwb(embarque.awb)
      if (awb) embarquesPorAwb.set(awb, embarque)
    })

    const acumulado = new Map<string, ClienteRanking>()

    function garantirCliente(clienteKey: string, nome: string) {
      if (!acumulado.has(clienteKey)) {
        acumulado.set(clienteKey, criarRegistroCliente(clienteKey, nome))
      }

      return acumulado.get(clienteKey)!
    }

    financeiros.filter(financeiroDentroPeriodo).forEach((financeiro) => {
      const nome = clienteFinanceiro(financeiro)
      const clienteKey = chaveClienteFinanceiro(financeiro)
      const item = garantirCliente(clienteKey, nome)

      const embarque = embarqueDoFinanceiro(financeiro, embarquesPorId, embarquesPorAwb)
      const statusPagamento = statusPagamentoFinanceiro(financeiro)
      const valorFaturado = valorFaturadoFinanceiro(financeiro)
      const custo = custoFinanceiro(financeiro)
      const profit = profitHCFinanceiro(financeiro)
      const awbFinanceiro = awbsFinanceiro(financeiro)[0] || normalizarAwb(embarque?.awb) || '-'
      const numeroFatura = financeiro?.fatura || financeiro?.numero_fatura || financeiro?.invoice || ''
      const dataReferencia = dataReferenciaFinanceiro(financeiro)
      const peso = numero(embarque?.peso_taxado) || numero(embarque?.peso_real)

      item.processosFaturados += 1
      item.valorFaturadoTotal += valorFaturado
      item.pesoTotal += peso

      if (profit === null) {
        item.aguardandoCusto += 1
      } else {
        item.comProfitHC += 1
        item.profitTotal += profit
        item.custoTotal += custo
      }

      if (statusPagamento === 'PAGO') item.pagos += 1
      else if (statusPagamento === 'ATRASADO') item.atrasados += 1
      else if (statusPagamento === 'EM_ABERTO') item.emAberto += 1
      else item.semDataFinanceira += 1

      if (awbFinanceiro && awbFinanceiro !== '-') item.awbsFaturados.push(String(awbFinanceiro))
      if (numeroFatura) item.faturas.push(String(numeroFatura))
      if (financeiro?.transportadora) item.transportadoras.push(String(financeiro.transportadora))
      if (embarque?.transportadora) item.transportadoras.push(String(embarque.transportadora))

      if (
        dataReferencia &&
        (!item.ultimoRegistroData || new Date(dataReferencia) > new Date(item.ultimoRegistroData))
      ) {
        item.ultimoRegistroData = dataReferencia
        item.ultimoAwb = awbFinanceiro || '-'
        item.ultimoStatus = embarque?.status_operacional || statusPagamento || '-'
      }
    })

    let lista = Array.from(acumulado.values()).map((item) => ({
      ...item,
      awbsFaturados: Array.from(new Set(item.awbsFaturados)),
      transportadoras: Array.from(new Set(item.transportadoras)),
      faturas: Array.from(new Set(item.faturas)),
      ticketMedioProfit: item.comProfitHC > 0 ? item.profitTotal / item.comProfitHC : 0,
    }))

    if (somenteComMovimento) {
      lista = lista.filter((item) => item.processosFaturados > 0)
    }

    if (busca.trim()) {
      const termo = normalizarTexto(busca)
      lista = lista.filter((item) => {
        const textoBusca = normalizarTexto(`
          ${item.nome}
          ${item.awbsFaturados.join(' ')}
          ${item.transportadoras.join(' ')}
          ${item.faturas.join(' ')}
        `)

        return textoBusca.includes(termo)
      })
    }

    lista.sort((a, b) => {
      if (rankingPor === 'FATURADOS') return b.processosFaturados - a.processosFaturados
      if (rankingPor === 'TICKET') return b.ticketMedioProfit - a.ticketMedioProfit
      if (rankingPor === 'MENOR_PROFIT') return a.profitTotal - b.profitTotal
      if (rankingPor === 'MENOR_TICKET') return a.ticketMedioProfit - b.ticketMedioProfit
      if (rankingPor === 'ATRASADOS') return b.atrasados - a.atrasados

      return b.profitTotal - a.profitTotal
    })

    return lista
  }, [embarques, financeiros, busca, periodo, rankingPor, somenteComMovimento])

  const resumo = useMemo(() => {
    const totalClientes = ranking.length
    const processosFaturados = ranking.reduce((acc, item) => acc + item.processosFaturados, 0)
    const comProfitHC = ranking.reduce((acc, item) => acc + item.comProfitHC, 0)
    const aguardandoCusto = ranking.reduce((acc, item) => acc + item.aguardandoCusto, 0)
    const profitTotal = ranking.reduce((acc, item) => acc + item.profitTotal, 0)
    const valorFaturadoTotal = ranking.reduce((acc, item) => acc + item.valorFaturadoTotal, 0)
    const custoTotal = ranking.reduce((acc, item) => acc + item.custoTotal, 0)
    const pesoTotal = ranking.reduce((acc, item) => acc + item.pesoTotal, 0)
    const ticketMedioProfit = comProfitHC > 0 ? profitTotal / comProfitHC : 0
    const pagos = ranking.reduce((acc, item) => acc + item.pagos, 0)
    const emAberto = ranking.reduce((acc, item) => acc + item.emAberto, 0)
    const atrasados = ranking.reduce((acc, item) => acc + item.atrasados, 0)

    const comMovimento = ranking.filter((item) => item.processosFaturados > 0)
    const comTicket = ranking.filter((item) => item.comProfitHC > 0)

    return {
      totalClientes,
      processosFaturados,
      comProfitHC,
      aguardandoCusto,
      profitTotal,
      valorFaturadoTotal,
      custoTotal,
      pesoTotal,
      ticketMedioProfit,
      pagos,
      emAberto,
      atrasados,
      topProfit: [...ranking].sort((a, b) => b.profitTotal - a.profitTotal)[0] || null,
      topFaturados: [...ranking].sort((a, b) => b.processosFaturados - a.processosFaturados)[0] || null,
      topTicket: [...comTicket].sort((a, b) => b.ticketMedioProfit - a.ticketMedioProfit)[0] || null,
      menorProfit: [...comMovimento].sort((a, b) => a.profitTotal - b.profitTotal)[0] || null,
      menorTicket: [...comTicket].sort((a, b) => a.ticketMedioProfit - b.ticketMedioProfit)[0] || null,
    }
  }, [ranking])

  function limparFiltros() {
    setBusca('')
    setPeriodo('TODOS')
    setRankingPor('PROFIT')
    setSomenteComMovimento(true)
    setClienteAbertoId(null)
  }

  function exportarCSV() {
    const linhas = [
      [
        'Ranking',
        'Cliente',
        'Processos faturados',
        'Profit HC total',
        'Ticket medio Profit HC',
        'Valor faturado bruto',
        'Custos considerados',
        'Com Profit HC',
        'Aguardando custo',
        'Pagos',
        'Em aberto',
        'Atrasados',
        'Peso total kg',
        'Ultimo AWB',
        'Ultimo status',
        'Ultimo registro',
      ],
      ...ranking.map((item, index) => [
        index + 1,
        item.nome,
        item.processosFaturados,
        item.profitTotal.toFixed(2).replace('.', ','),
        item.ticketMedioProfit.toFixed(2).replace('.', ','),
        item.valorFaturadoTotal.toFixed(2).replace('.', ','),
        item.custoTotal.toFixed(2).replace('.', ','),
        item.comProfitHC,
        item.aguardandoCusto,
        item.pagos,
        item.emAberto,
        item.atrasados,
        item.pesoTotal.toFixed(2).replace('.', ','),
        item.ultimoAwb,
        item.ultimoStatus,
        dataBR(item.ultimoRegistroData),
      ]),
    ]

    const csv = linhas
      .map((linha) =>
        linha
          .map((campo) => `"${String(campo).replaceAll('"', '""')}"`)
          .join(';')
      )
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ranking-clientes-profit-hc-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="w-full max-w-none p-6 lg:p-8 text-white">
      <div className="mb-8 flex flex-col lg:flex-row justify-between gap-6">
        <div>
          <p className="text-blue-400 font-bold mb-2">Ranking de clientes</p>
          <h1 className="text-5xl font-black mb-2">Ranking de clientes</h1>
          <p className="text-slate-400 text-lg">
            Veja quais clientes mais geram Profit HC, maior ticket médio, mais processos faturados e menor geração.
          </p>
          <div className="mt-4 border border-green-500/40 bg-green-500/10 text-green-200 rounded-2xl px-5 py-4 max-w-6xl">
            <strong>Regra desta tela:</strong> agrupamento por <strong>nome do cliente em Financeiro &gt; Processos Faturados</strong>. Valores, ranking e ticket médio usam <strong>Profit HC</strong>, não o valor bruto faturado e nem o login do portal.
          </div>
        </div>

        <div className="flex gap-3 flex-wrap h-fit">
          <a
            href="/admin/financeiro"
            className="bg-emerald-700 hover:bg-emerald-600 px-5 py-3 rounded-xl font-bold"
          >
            Ver financeiro
          </a>

          <a
            href="/admin/embarques"
            className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold"
          >
            Ver embarques
          </a>

          <button
            onClick={exportarCSV}
            className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-bold"
          >
            Exportar CSV
          </button>

          <button
            onClick={carregar}
            className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl font-bold"
          >
            Atualizar
          </button>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-5 mb-8">
        <KpiCard
          titulo="Clientes analisados"
          valor={resumo.totalClientes}
          detalhe="pela coluna cliente"
          icone="👥"
          ativo={rankingPor === 'PROFIT'}
          onClick={() => setRankingPor('PROFIT')}
        />

        <KpiCard
          titulo="Profit HC total"
          valor={moeda(resumo.profitTotal)}
          detalhe="Processos Faturados"
          icone="💰"
          ativo={rankingPor === 'PROFIT'}
          onClick={() => setRankingPor('PROFIT')}
        />

        <KpiCard
          titulo="Processos faturados"
          valor={resumo.processosFaturados}
          detalhe="base do ranking"
          icone="🧾"
          ativo={rankingPor === 'FATURADOS'}
          onClick={() => setRankingPor('FATURADOS')}
        />

        <KpiCard
          titulo="Ticket médio Profit"
          valor={moeda(resumo.ticketMedioProfit)}
          detalhe="média por processo com custo"
          icone="🎯"
          ativo={rankingPor === 'TICKET'}
          onClick={() => setRankingPor('TICKET')}
        />

        <KpiCard
          titulo="Com Profit HC"
          valor={resumo.comProfitHC}
          detalhe="valor compra preenchido"
          icone="✅"
          ativo={rankingPor === 'PROFIT'}
          onClick={() => setRankingPor('PROFIT')}
        />

        <KpiCard
          titulo="Aguardando custo"
          valor={resumo.aguardandoCusto}
          detalhe="não entra no Profit"
          icone="⏳"
          ativo={rankingPor === 'MENOR_PROFIT'}
          onClick={() => setRankingPor('MENOR_PROFIT')}
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <ResumoFinanceiro titulo="Pagos" valor={resumo.pagos} detalhe="com recebimento no financeiro" classe="border-green-500 bg-green-600/20 text-green-300" />
        <ResumoFinanceiro titulo="Em aberto" valor={resumo.emAberto} detalhe="sem recebimento e não vencido" classe="border-yellow-500 bg-yellow-500/20 text-yellow-300" />
        <ResumoFinanceiro titulo="Atrasados" valor={resumo.atrasados} detalhe="vencimento passou" classe="border-red-500 bg-red-600/20 text-red-300" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-4 gap-5 mb-8">
        <Destaque
          titulo="Maior Profit HC"
          cliente={resumo.topProfit}
          valor={resumo.topProfit ? moeda(resumo.topProfit.profitTotal) : '-'}
          detalhe="Pelo Financeiro &gt; Processos Faturados"
        />

        <Destaque
          titulo="Mais processos faturados"
          cliente={resumo.topFaturados}
          valor={resumo.topFaturados ? `${resumo.topFaturados.processosFaturados} processo(s)` : '-'}
          detalhe="Conta pela coluna cliente do financeiro"
        />

        <Destaque
          titulo="Melhor ticket Profit"
          cliente={resumo.topTicket}
          valor={resumo.topTicket ? moeda(resumo.topTicket.ticketMedioProfit) : '-'}
          detalhe="Profit médio por processo com custo"
        />

        <Destaque
          titulo="Menor geração"
          cliente={resumo.menorProfit}
          valor={resumo.menorProfit ? moeda(resumo.menorProfit.profitTotal) : '-'}
          detalhe="Menor Profit HC no filtro atual"
        />
      </section>

      <section className="border border-blue-900 rounded-3xl bg-[#071225] p-5 lg:p-7 mb-8">
        <div className="flex flex-col lg:flex-row justify-between gap-5 mb-6">
          <div>
            <h2 className="text-2xl font-black">Filtros e ranking</h2>
            <p className="text-slate-400 text-sm">
              Período usa vencimento, recebimento ou data de criação dos registros em Processos Faturados.
            </p>
          </div>

          <button
            onClick={limparFiltros}
            className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold h-fit"
          >
            Limpar filtros
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente, AWB, fatura ou transportadora..."
            className="xl:col-span-2"
          />

          <select value={periodo} onChange={(e) => setPeriodo(e.target.value as FiltroPeriodo)}>
            <option value="TODOS">Período: todos</option>
            <option value="MES_ATUAL">Período: mês atual</option>
            <option value="MES_ANTERIOR">Período: mês anterior</option>
            <option value="ULTIMOS_90">Período: últimos 90 dias</option>
            <option value="ANO_ATUAL">Período: ano atual</option>
          </select>

          <select value={rankingPor} onChange={(e) => setRankingPor(e.target.value as FiltroRanking)}>
            <option value="PROFIT">Ordenar: maior Profit HC</option>
            <option value="FATURADOS">Ordenar: mais processos faturados</option>
            <option value="TICKET">Ordenar: maior ticket Profit</option>
            <option value="MENOR_PROFIT">Ordenar: menor Profit HC</option>
            <option value="MENOR_TICKET">Ordenar: menor ticket Profit</option>
            <option value="ATRASADOS">Ordenar: mais atrasados</option>
          </select>

          <label className="flex items-center gap-3 border border-blue-900 bg-[#020817] rounded-2xl px-4 py-3">
            <input
              type="checkbox"
              checked={somenteComMovimento}
              onChange={(e) => setSomenteComMovimento(e.target.checked)}
            />
            <span className="font-bold text-sm">Somente com movimento</span>
          </label>
        </div>
      </section>

      <section className="border border-blue-900 rounded-3xl bg-[#071225] p-5 lg:p-7">
        <div className="flex flex-col lg:flex-row justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-black">Resultado</h2>
            <p className="text-slate-400 text-sm">
              {ranking.length} cliente(s) encontrado(s). Ticket médio usa Profit HC e apenas processos com valor compra preenchido.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="border border-blue-900 bg-[#020817] rounded-2xl p-6 text-slate-400">
            Carregando ranking de clientes...
          </div>
        ) : ranking.length === 0 ? (
          <div className="border border-blue-900 bg-[#020817] rounded-2xl p-6 text-slate-400">
            Nenhum cliente encontrado com os filtros atuais.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1500px] border-collapse text-xs lg:text-sm [&_th]:border-b [&_th]:border-blue-900 [&_th]:px-3 [&_th]:py-3 [&_th]:text-left [&_th]:font-black [&_th]:text-slate-300 [&_td]:px-3 [&_td]:py-4 [&_td]:align-middle">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cliente</th>
                  <th>Processos faturados</th>
                  <th>Profit HC</th>
                  <th>Ticket médio</th>
                  <th>Status financeiro</th>
                  <th>Aguardando custo</th>
                  <th>Último registro</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {ranking.map((item, index) => {
                  const aberto = clienteAbertoId === item.clienteKey

                  return (
                    <tr key={item.clienteKey} className="border-b border-blue-900/70 hover:bg-[#0b1730] transition">
                      <td className="font-black text-blue-400">{index + 1}</td>

                      <td>
                        <strong className="text-white">{item.nome}</strong>
                        {item.transportadoras.length > 0 && (
                          <p className="text-slate-500 text-xs mt-1">
                            {item.transportadoras.join(', ')}
                          </p>
                        )}
                      </td>

                      <td>
                        <strong className="text-2xl text-purple-300">{item.processosFaturados}</strong>
                        <p className="text-slate-500 text-xs">Processos Faturados</p>
                      </td>

                      <td>
                        <strong className={item.profitTotal >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {moeda(item.profitTotal)}
                        </strong>
                        <p className="text-slate-500 text-xs">
                          {item.comProfitHC} com custo
                        </p>
                      </td>

                      <td>
                        <strong className="text-yellow-300">{moeda(item.ticketMedioProfit)}</strong>
                        <p className="text-slate-500 text-xs">Profit médio</p>
                      </td>

                      <td>
                        <div className="flex flex-wrap gap-2">
                          <span className="border border-green-500 bg-green-600/20 text-green-300 px-3 py-1 rounded-full font-black text-xs">
                            Pagos {item.pagos}
                          </span>
                          <span className="border border-yellow-500 bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full font-black text-xs">
                            Aberto {item.emAberto}
                          </span>
                          <span className="border border-red-500 bg-red-600/20 text-red-300 px-3 py-1 rounded-full font-black text-xs">
                            Atrasados {item.atrasados}
                          </span>
                        </div>
                      </td>

                      <td>
                        <strong className={item.aguardandoCusto > 0 ? 'text-yellow-300' : 'text-slate-300'}>
                          {item.aguardandoCusto}
                        </strong>
                        <p className="text-slate-500 text-xs">não entra no Profit</p>
                      </td>

                      <td>
                        <strong>{item.ultimoAwb}</strong>
                        <p className="text-slate-500 text-xs mt-1">{item.ultimoStatus}</p>
                        <p className="text-slate-500 text-xs mt-1">{dataBR(item.ultimoRegistroData)}</p>
                      </td>

                      <td>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => setClienteAbertoId(aberto ? null : item.clienteKey)}
                            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl font-bold"
                          >
                            {aberto ? 'Fechar' : 'Detalhes'}
                          </button>

                          <a
                            href="/admin/financeiro"
                            className="bg-emerald-700 hover:bg-emerald-600 px-4 py-2 rounded-xl font-bold"
                          >
                            Financeiro
                          </a>
                        </div>

                        {aberto && (
                          <div className="mt-4 border border-blue-900 bg-[#020817] rounded-2xl p-4 min-w-[420px] space-y-4">
                            <div>
                              <p className="text-slate-400 text-xs mb-2">AWBs em Processos Faturados</p>
                              <p className="text-green-300 font-bold break-words">
                                {item.awbsFaturados.length > 0 ? item.awbsFaturados.slice(0, 40).join(', ') : '-'}
                              </p>
                              {item.awbsFaturados.length > 40 && (
                                <p className="text-slate-500 text-xs mt-2">
                                  + {item.awbsFaturados.length - 40} AWB(s) faturado(s)
                                </p>
                              )}
                            </div>

                            <div>
                              <p className="text-slate-400 text-xs mb-2">Nº de fatura no financeiro</p>
                              <p className="text-blue-300 font-bold break-words">
                                {item.faturas.length > 0 ? item.faturas.slice(0, 40).join(', ') : '-'}
                              </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              <div className="border border-blue-900 rounded-xl p-3">
                                <p className="text-slate-500 text-xs">Valor faturado bruto</p>
                                <strong>{moeda(item.valorFaturadoTotal)}</strong>
                              </div>

                              <div className="border border-blue-900 rounded-xl p-3">
                                <p className="text-slate-500 text-xs">Custos considerados</p>
                                <strong>{moeda(item.custoTotal)}</strong>
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

function KpiCard({ titulo, valor, detalhe, icone, ativo, onClick }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        ativo
          ? 'border border-blue-400 rounded-3xl bg-blue-600/25 p-6 text-left ring-2 ring-blue-500 transition'
          : 'border border-blue-900 rounded-3xl bg-[#071225] p-6 text-left hover:border-blue-400 hover:bg-blue-600/10 transition'
      }
    >
      <div className="flex justify-between items-start gap-4">
        <div>
          <p className="text-slate-300 font-bold">{titulo}</p>
          <h2 className="text-3xl xl:text-4xl font-black mt-4 text-white break-words">{valor}</h2>
          <p className="text-slate-400 mt-2 text-sm">{detalhe}</p>
        </div>

        <div className="text-4xl">{icone}</div>
      </div>
    </button>
  )
}

function ResumoFinanceiro({ titulo, valor, detalhe, classe }: any) {
  return (
    <div className={`border rounded-3xl p-6 ${classe}`}>
      <p className="font-black">{titulo}</p>
      <h2 className="text-4xl font-black mt-3 text-white">{valor}</h2>
      <p className="text-sm mt-2 opacity-80">{detalhe}</p>
    </div>
  )
}

function Destaque({ titulo, cliente, valor, detalhe }: any) {
  return (
    <div className="border border-blue-900 rounded-3xl bg-[#071225] p-6">
      <p className="text-slate-400 text-sm font-bold">{titulo}</p>
      <h3 className="text-2xl font-black mt-3 text-white">{cliente?.nome || '-'}</h3>
      <p className="text-green-400 text-3xl font-black mt-3">{valor}</p>
      <p className="text-slate-500 text-sm mt-2">{detalhe}</p>
    </div>
  )
}
