'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const LOTE_SUPABASE = 1000
const STORAGE_KEY = 'hc_admin_clientes_performance_filtros_v2'

type FiltroRanking = 'VALOR' | 'FATURADOS' | 'EMBARQUES' | 'TICKET' | 'PESO' | 'PARADOS'
type FiltroPeriodo = 'TODOS' | 'MES_ATUAL' | 'MES_ANTERIOR' | 'ULTIMOS_90' | 'ANO_ATUAL'

type ClienteRanking = {
  clienteId: string
  nome: string
  email: string
  embarques: number
  processosFaturados: number
  financeirosComValor: number
  pagos: number
  emAberto: number
  atrasados: number
  semDataFinanceira: number
  entregues: number
  ativos: number
  fiscalizacao: number
  valorTotal: number
  ticketMedio: number
  pesoTotal: number
  ultimoEmbarqueData: string | null
  ultimoAwb: string
  ultimoStatus: string
  awbs: string[]
  awbsFaturados: string[]
  transportadoras: string[]
  faturas: string[]
}

export default function ClientesPerformancePage() {
  const [clientes, setClientes] = useState<any[]>([])
  const [embarques, setEmbarques] = useState<any[]>([])
  const [vinculos, setVinculos] = useState<any[]>([])
  const [financeiros, setFinanceiros] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [busca, setBusca] = useState('')
  const [periodo, setPeriodo] = useState<FiltroPeriodo>('TODOS')
  const [rankingPor, setRankingPor] = useState<FiltroRanking>('VALOR')
  const [somenteComEmbarque, setSomenteComEmbarque] = useState(true)
  const [clienteAbertoId, setClienteAbertoId] = useState<string | null>(null)

  useEffect(() => {
    const salvo = localStorage.getItem(STORAGE_KEY)

    if (salvo) {
      try {
        const dados = JSON.parse(salvo)
        if (dados.busca !== undefined) setBusca(dados.busca)
        if (dados.periodo) setPeriodo(dados.periodo)
        if (dados.rankingPor) setRankingPor(dados.rankingPor)
        if (dados.somenteComEmbarque !== undefined) setSomenteComEmbarque(dados.somenteComEmbarque)
      } catch (error) {
        console.log('Erro ao carregar filtros salvos:', error)
      }
    }

    carregar()
  }, [])

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ busca, periodo, rankingPor, somenteComEmbarque })
    )
  }, [busca, periodo, rankingPor, somenteComEmbarque])

  async function carregar() {
    setLoading(true)

    const { data: clientesData, error: erroClientes } = await supabase
      .from('perfis')
      .select('*')
      .eq('tipo_acesso', 'cliente')
      .order('nome')

    if (erroClientes) console.log('ERRO CLIENTES:', erroClientes)

    const { data: embarquesData, error: erroEmbarques } = await supabase
      .from('embarques')
      .select('*')
      .order('criado_em', { ascending: false })

    if (erroEmbarques) console.log('ERRO EMBARQUES:', erroEmbarques)

    const { data: vinculosData, error: erroVinculos } = await supabase
      .from('embarque_clientes')
      .select('*')

    if (erroVinculos) console.log('ERRO VÍNCULOS:', erroVinculos)

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

    setClientes(clientesData || [])
    setEmbarques(embarquesData || [])
    setVinculos(vinculosData || [])
    setFinanceiros(financeiroData || [])
    setLoading(false)
  }

  function normalizarTexto(valor: any) {
    return String(valor || '')
      .trim()
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

    const texto = String(data).slice(0, 10)
    const [ano, mes, dia] = texto.split('-')

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

    const texto = String(valor).trim()
    if (!texto || texto === '0' || texto === '-') return null

    if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10)

    const partes = texto.split('/')
    if (partes.length === 3) {
      const [dia, mes, ano] = partes
      return `${ano.padStart(4, '20')}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
    }

    const data = new Date(texto)
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

  function dataReferenciaEmbarque(embarque: any) {
    return normalizarData(embarque?.criado_em || embarque?.data_envio || embarque?.ultima_atualizacao)
  }

  function embarqueDentroPeriodo(embarque: any) {
    return dentroPeriodoPorISO(dataReferenciaEmbarque(embarque))
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
    // Para informações financeiras, a base é sempre Processos Faturados.
    // Prioridade: vencimento do cliente, recebimento e, por último, data de criação/importação.
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

  function embarqueDoFinanceiro(item: any, embarquesPorId: Map<string, any>, embarquesPorAwb: Map<string, any>) {
    const embarqueId = String(item?.embarque_id || '')
    if (embarqueId && embarquesPorId.has(embarqueId)) return embarquesPorId.get(embarqueId)

    const awbs = awbsFinanceiro(item)

    for (const awb of awbs) {
      if (embarquesPorAwb.has(awb)) return embarquesPorAwb.get(awb)
    }

    return null
  }

  function valorFinanceiro(item: any) {
    if (!item) return 0

    // Regra desta tela: dinheiro SEMPRE vem de Financeiro > Processos Faturados.
    return (
      numero(item.valor_cobranca) ||
      numero(item.valor_faturado) ||
      numero(item.valor_venda) ||
      numero(item.valor) ||
      0
    )
  }

  function clienteIdsDoEmbarque(embarque: any) {
    const idsVinculados = vinculos
      .filter((v) => String(v.embarque_id) === String(embarque.id))
      .map((v) => v.cliente_id)
      .filter(Boolean)

    if (idsVinculados.length > 0) return Array.from(new Set(idsVinculados))
    if (embarque.usuario_id) return [embarque.usuario_id]

    return [`sem-vinculo-${embarque.id}`]
  }

  function nomeClienteFallback(embarque: any) {
    return (
      embarque?.cliente_final ||
      embarque?.importador ||
      embarque?.exportador ||
      'Sem cliente vinculado'
    )
  }

  function clienteFinanceiroFallback(financeiro: any) {
    return (
      financeiro?.cliente ||
      financeiro?.cliente_final ||
      financeiro?.importador ||
      financeiro?.exportador ||
      financeiro?.tomador ||
      'Cliente não identificado no financeiro'
    )
  }

  function clienteIdsDoFinanceiro(financeiro: any, embarque: any, mapaClientesPorNome: Map<string, any>) {
    if (embarque) return clienteIdsDoEmbarque(embarque)

    const nome = clienteFinanceiroFallback(financeiro)
    const chaveNome = normalizarTexto(nome)
    const cliente = mapaClientesPorNome.get(chaveNome)

    if (cliente?.id) return [cliente.id]

    return [`financeiro-${chaveNome || financeiro?.id || Math.random().toString(36).slice(2)}`]
  }

  function criarRegistroCliente(clienteId: string, nome: string, email = ''): ClienteRanking {
    return {
      clienteId,
      nome,
      email,
      embarques: 0,
      processosFaturados: 0,
      financeirosComValor: 0,
      pagos: 0,
      emAberto: 0,
      atrasados: 0,
      semDataFinanceira: 0,
      entregues: 0,
      ativos: 0,
      fiscalizacao: 0,
      valorTotal: 0,
      ticketMedio: 0,
      pesoTotal: 0,
      ultimoEmbarqueData: null,
      ultimoAwb: '-',
      ultimoStatus: '-',
      awbs: [],
      awbsFaturados: [],
      transportadoras: [],
      faturas: [],
    }
  }

  const ranking = useMemo(() => {
    const mapaClientes = new Map<string, any>()
    const mapaClientesPorNome = new Map<string, any>()

    clientes.forEach((cliente) => {
      mapaClientes.set(cliente.id, cliente)
      if (cliente.nome) mapaClientesPorNome.set(normalizarTexto(cliente.nome), cliente)
      if (cliente.email) mapaClientesPorNome.set(normalizarTexto(cliente.email), cliente)
    })

    const embarquesPorId = new Map<string, any>()
    const embarquesPorAwb = new Map<string, any>()

    embarques.forEach((embarque) => {
      if (embarque.id) embarquesPorId.set(String(embarque.id), embarque)
      const awb = normalizarAwb(embarque.awb)
      if (awb) embarquesPorAwb.set(awb, embarque)
    })

    const acumulado = new Map<string, ClienteRanking>()

    clientes.forEach((cliente) => {
      acumulado.set(
        cliente.id,
        criarRegistroCliente(cliente.id, cliente.nome || cliente.email || 'Cliente', cliente.email || '')
      )
    })

    function garantirCliente(clienteId: string, nome: string, email = '') {
      if (!acumulado.has(clienteId)) {
        acumulado.set(clienteId, criarRegistroCliente(clienteId, nome, email))
      }

      return acumulado.get(clienteId)!
    }

    // Métricas operacionais: quantidade de embarques, peso, status e último embarque.
    // Métricas de dinheiro NÃO são calculadas aqui.
    embarques.filter(embarqueDentroPeriodo).forEach((embarque) => {
      const clienteIds = clienteIdsDoEmbarque(embarque)
      const peso = numero(embarque.peso_taxado) || numero(embarque.peso_real)
      const status = normalizarTexto(embarque.status_operacional)
      const data = embarque.criado_em || embarque.ultima_atualizacao || embarque.data_envio || null

      clienteIds.forEach((clienteId) => {
        const cliente = mapaClientes.get(clienteId)
        const item = garantirCliente(
          cliente?.id || clienteId,
          cliente?.nome || cliente?.email || nomeClienteFallback(embarque),
          cliente?.email || ''
        )

        item.embarques += 1
        item.pesoTotal += peso

        if (status.includes('entregue') || status.includes('concluido') || status.includes('finalizado')) item.entregues += 1
        else item.ativos += 1
        if (status.includes('fiscalizacao')) item.fiscalizacao += 1

        if (embarque.awb) item.awbs.push(String(embarque.awb))
        if (embarque.transportadora) item.transportadoras.push(String(embarque.transportadora))

        if (
          data &&
          (!item.ultimoEmbarqueData || new Date(data) > new Date(item.ultimoEmbarqueData))
        ) {
          item.ultimoEmbarqueData = data
          item.ultimoAwb = embarque.awb || '-'
          item.ultimoStatus = embarque.status_operacional || '-'
        }
      })
    })

    // Métricas financeiras: SEMPRE de financeiro_embarques / Processos Faturados.
    financeiros.filter(financeiroDentroPeriodo).forEach((financeiro) => {
      const embarque = embarqueDoFinanceiro(financeiro, embarquesPorId, embarquesPorAwb)
      const clienteIds = clienteIdsDoFinanceiro(financeiro, embarque, mapaClientesPorNome)
      const valor = valorFinanceiro(financeiro)
      const statusPagamento = statusPagamentoFinanceiro(financeiro)
      const awbFinanceiro = awbsFinanceiro(financeiro)[0] || normalizarAwb(embarque?.awb) || '-'
      const numeroFatura = financeiro?.fatura || financeiro?.numero_fatura || financeiro?.invoice || ''

      clienteIds.forEach((clienteId) => {
        const cliente = mapaClientes.get(clienteId)
        const item = garantirCliente(
          cliente?.id || clienteId,
          cliente?.nome || cliente?.email || embarque?.cliente_final || clienteFinanceiroFallback(financeiro),
          cliente?.email || ''
        )

        item.processosFaturados += 1
        item.valorTotal += valor

        if (valor > 0) item.financeirosComValor += 1
        if (statusPagamento === 'PAGO') item.pagos += 1
        else if (statusPagamento === 'ATRASADO') item.atrasados += 1
        else if (statusPagamento === 'EM_ABERTO') item.emAberto += 1
        else item.semDataFinanceira += 1

        if (awbFinanceiro && awbFinanceiro !== '-') item.awbsFaturados.push(String(awbFinanceiro))
        if (numeroFatura) item.faturas.push(String(numeroFatura))
        if (embarque?.transportadora) item.transportadoras.push(String(embarque.transportadora))
      })
    })

    let lista = Array.from(acumulado.values()).map((item) => ({
      ...item,
      awbs: Array.from(new Set(item.awbs)),
      awbsFaturados: Array.from(new Set(item.awbsFaturados)),
      transportadoras: Array.from(new Set(item.transportadoras)),
      faturas: Array.from(new Set(item.faturas)),
      ticketMedio: item.financeirosComValor > 0 ? item.valorTotal / item.financeirosComValor : 0,
    }))

    if (somenteComEmbarque) {
      lista = lista.filter((item) => item.embarques > 0 || item.processosFaturados > 0)
    }

    if (busca.trim()) {
      const termo = normalizarTexto(busca)
      lista = lista.filter((item) => {
        const texto = normalizarTexto(`
          ${item.nome}
          ${item.email}
          ${item.awbs.join(' ')}
          ${item.awbsFaturados.join(' ')}
          ${item.transportadoras.join(' ')}
          ${item.faturas.join(' ')}
        `)

        return texto.includes(termo)
      })
    }

    lista.sort((a, b) => {
      if (rankingPor === 'FATURADOS') return b.processosFaturados - a.processosFaturados
      if (rankingPor === 'EMBARQUES') return b.embarques - a.embarques
      if (rankingPor === 'TICKET') return b.ticketMedio - a.ticketMedio
      if (rankingPor === 'PESO') return b.pesoTotal - a.pesoTotal
      if (rankingPor === 'PARADOS') {
        const dataA = a.ultimoEmbarqueData ? new Date(a.ultimoEmbarqueData).getTime() : 0
        const dataB = b.ultimoEmbarqueData ? new Date(b.ultimoEmbarqueData).getTime() : 0
        return dataA - dataB
      }

      return b.valorTotal - a.valorTotal
    })

    return lista
  }, [clientes, embarques, vinculos, financeiros, busca, periodo, rankingPor, somenteComEmbarque])

  const resumo = useMemo(() => {
    const totalClientes = ranking.length
    const totalEmbarques = ranking.reduce((acc, item) => acc + item.embarques, 0)
    const processosFaturados = ranking.reduce((acc, item) => acc + item.processosFaturados, 0)
    const valorTotal = ranking.reduce((acc, item) => acc + item.valorTotal, 0)
    const financeirosComValor = ranking.reduce((acc, item) => acc + item.financeirosComValor, 0)
    const pesoTotal = ranking.reduce((acc, item) => acc + item.pesoTotal, 0)
    const ticketMedio = financeirosComValor > 0 ? valorTotal / financeirosComValor : 0
    const pagos = ranking.reduce((acc, item) => acc + item.pagos, 0)
    const emAberto = ranking.reduce((acc, item) => acc + item.emAberto, 0)
    const atrasados = ranking.reduce((acc, item) => acc + item.atrasados, 0)

    return {
      totalClientes,
      totalEmbarques,
      processosFaturados,
      valorTotal,
      financeirosComValor,
      pesoTotal,
      ticketMedio,
      pagos,
      emAberto,
      atrasados,
      topValor: [...ranking].sort((a, b) => b.valorTotal - a.valorTotal)[0] || null,
      topEmbarques: [...ranking].sort((a, b) => b.embarques - a.embarques)[0] || null,
      topFaturados: [...ranking].sort((a, b) => b.processosFaturados - a.processosFaturados)[0] || null,
      topTicket: [...ranking].sort((a, b) => b.ticketMedio - a.ticketMedio)[0] || null,
    }
  }, [ranking])

  function limparFiltros() {
    setBusca('')
    setPeriodo('TODOS')
    setRankingPor('VALOR')
    setSomenteComEmbarque(true)
    setClienteAbertoId(null)
  }

  function exportarCSV() {
    const linhas = [
      [
        'Ranking',
        'Cliente',
        'Email',
        'Embarques operacionais',
        'Processos faturados',
        'Valor total BRL - Processos Faturados',
        'Ticket medio BRL - Processos Faturados',
        'Peso total kg',
        'Pagos',
        'Em aberto',
        'Atrasados',
        'Ativos',
        'Entregues',
        'Ultimo AWB',
        'Ultimo status',
        'Ultimo embarque',
      ],
      ...ranking.map((item, index) => [
        index + 1,
        item.nome,
        item.email,
        item.embarques,
        item.processosFaturados,
        item.valorTotal.toFixed(2).replace('.', ','),
        item.ticketMedio.toFixed(2).replace('.', ','),
        item.pesoTotal.toFixed(2).replace('.', ','),
        item.pagos,
        item.emAberto,
        item.atrasados,
        item.ativos,
        item.entregues,
        item.ultimoAwb,
        item.ultimoStatus,
        dataBR(item.ultimoEmbarqueData),
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
    link.download = `ranking-clientes-financeiro-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="w-full max-w-none p-6 lg:p-8 text-white">
      <div className="mb-8 flex flex-col lg:flex-row justify-between gap-6">
        <div>
          <p className="text-blue-400 font-bold mb-2">Clientes / Performance</p>
          <h1 className="text-5xl font-black mb-2">Ranking de clientes</h1>
          <p className="text-slate-400 text-lg">
            Veja quem mais embarca, quem mais fatura, ticket médio, peso movimentado e clientes parados.
          </p>
          <div className="mt-4 border border-green-500/40 bg-green-500/10 text-green-200 rounded-2xl px-5 py-4 max-w-5xl">
            <strong>Fonte financeira oficial:</strong> Total faturado, ticket médio, pagos, em aberto e atrasados vêm sempre de <strong>Financeiro &gt; Processos Faturados</strong>. Valores preenchidos diretamente no embarque não entram nas métricas financeiras desta tela.
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
          detalhe="com filtros atuais"
          icone="👥"
          ativo={rankingPor === 'VALOR'}
          onClick={() => setRankingPor('VALOR')}
        />

        <KpiCard
          titulo="Total faturado"
          valor={moeda(resumo.valorTotal)}
          detalhe="Processos Faturados"
          icone="💰"
          ativo={rankingPor === 'VALOR'}
          onClick={() => setRankingPor('VALOR')}
        />

        <KpiCard
          titulo="Processos faturados"
          valor={resumo.processosFaturados}
          detalhe={`${resumo.financeirosComValor} com valor`}
          icone="🧾"
          ativo={rankingPor === 'FATURADOS'}
          onClick={() => setRankingPor('FATURADOS')}
        />

        <KpiCard
          titulo="Ticket médio"
          valor={moeda(resumo.ticketMedio)}
          detalhe="média por faturado com valor"
          icone="🎯"
          ativo={rankingPor === 'TICKET'}
          onClick={() => setRankingPor('TICKET')}
        />

        <KpiCard
          titulo="Total embarques"
          valor={resumo.totalEmbarques}
          detalhe="base operacional"
          icone="📦"
          ativo={rankingPor === 'EMBARQUES'}
          onClick={() => setRankingPor('EMBARQUES')}
        />

        <KpiCard
          titulo="Peso total"
          valor={`${resumo.pesoTotal.toFixed(2)} kg`}
          detalhe="base operacional"
          icone="⚖️"
          ativo={rankingPor === 'PESO'}
          onClick={() => setRankingPor('PESO')}
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <ResumoFinanceiro titulo="Pagos" valor={resumo.pagos} detalhe="com recebimento no financeiro" classe="border-green-500 bg-green-600/20 text-green-300" />
        <ResumoFinanceiro titulo="Em aberto" valor={resumo.emAberto} detalhe="sem recebimento e não vencido" classe="border-yellow-500 bg-yellow-500/20 text-yellow-300" />
        <ResumoFinanceiro titulo="Atrasados" valor={resumo.atrasados} detalhe="vencimento passou" classe="border-red-500 bg-red-600/20 text-red-300" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-4 gap-5 mb-8">
        <Destaque
          titulo="Maior faturamento"
          cliente={resumo.topValor}
          valor={resumo.topValor ? moeda(resumo.topValor.valorTotal) : '-'}
          detalhe="Pelo Financeiro &gt; Processos Faturados"
        />

        <Destaque
          titulo="Mais processos faturados"
          cliente={resumo.topFaturados}
          valor={resumo.topFaturados ? `${resumo.topFaturados.processosFaturados} processo(s)` : '-'}
          detalhe="Volume financeiro"
        />

        <Destaque
          titulo="Mais embarques"
          cliente={resumo.topEmbarques}
          valor={resumo.topEmbarques ? `${resumo.topEmbarques.embarques} processo(s)` : '-'}
          detalhe="Volume operacional"
        />

        <Destaque
          titulo="Melhor ticket"
          cliente={resumo.topTicket}
          valor={resumo.topTicket ? moeda(resumo.topTicket.ticketMedio) : '-'}
          detalhe="Ticket médio do financeiro"
        />
      </section>

      <section className="border border-blue-900 rounded-3xl bg-[#071225] p-5 lg:p-7 mb-8">
        <div className="flex flex-col lg:flex-row justify-between gap-5 mb-6">
          <div>
            <h2 className="text-2xl font-black">Filtros e ranking</h2>
            <p className="text-slate-400 text-sm">
              Período financeiro usa vencimento, recebimento ou data de criação dos registros em Processos Faturados.
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
            placeholder="Buscar cliente, e-mail, AWB, fatura ou transportadora..."
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
            <option value="VALOR">Ordenar: maior faturamento</option>
            <option value="FATURADOS">Ordenar: mais processos faturados</option>
            <option value="EMBARQUES">Ordenar: mais embarques</option>
            <option value="TICKET">Ordenar: maior ticket médio</option>
            <option value="PESO">Ordenar: maior peso</option>
            <option value="PARADOS">Ordenar: clientes parados</option>
          </select>

          <label className="flex items-center gap-3 border border-blue-900 bg-[#020817] rounded-2xl px-4 py-3">
            <input
              type="checkbox"
              checked={somenteComEmbarque}
              onChange={(e) => setSomenteComEmbarque(e.target.checked)}
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
              {ranking.length} cliente(s) encontrado(s). Ticket médio usa apenas registros com valor em Processos Faturados.
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
                  <th>Embarques</th>
                  <th>Processos faturados</th>
                  <th>Total faturado</th>
                  <th>Ticket médio</th>
                  <th>Status financeiro</th>
                  <th>Peso</th>
                  <th>Último embarque</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {ranking.map((item, index) => {
                  const aberto = clienteAbertoId === item.clienteId

                  return (
                    <tr key={item.clienteId} className="border-b border-blue-900/70 hover:bg-[#0b1730] transition">
                      <td className="font-black text-blue-400">{index + 1}</td>

                      <td>
                        <strong className="text-white">{item.nome}</strong>
                        <p className="text-slate-500 text-xs mt-1">{item.email || '-'}</p>
                        {item.transportadoras.length > 0 && (
                          <p className="text-slate-500 text-xs mt-1">
                            {item.transportadoras.join(', ')}
                          </p>
                        )}
                      </td>

                      <td>
                        <strong className="text-2xl text-blue-400">{item.embarques}</strong>
                        <p className="text-slate-500 text-xs">operacional</p>
                      </td>

                      <td>
                        <strong className="text-2xl text-purple-300">{item.processosFaturados}</strong>
                        <p className="text-slate-500 text-xs">Processos Faturados</p>
                      </td>

                      <td>
                        <strong className="text-green-400">{moeda(item.valorTotal)}</strong>
                        <p className="text-slate-500 text-xs">
                          {item.financeirosComValor} com valor
                        </p>
                      </td>

                      <td>
                        <strong className="text-yellow-300">{moeda(item.ticketMedio)}</strong>
                        <p className="text-slate-500 text-xs">média financeira</p>
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
                        <strong>{item.pesoTotal.toFixed(2)} kg</strong>
                        <p className="text-slate-500 text-xs">operacional</p>
                      </td>

                      <td>
                        <strong>{item.ultimoAwb}</strong>
                        <p className="text-slate-500 text-xs mt-1">{item.ultimoStatus}</p>
                        <p className="text-slate-500 text-xs mt-1">{dataBR(item.ultimoEmbarqueData)}</p>
                      </td>

                      <td>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => setClienteAbertoId(aberto ? null : item.clienteId)}
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

                          <a
                            href="/admin/embarques"
                            className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl font-bold"
                          >
                            Embarques
                          </a>
                        </div>

                        {aberto && (
                          <div className="mt-4 border border-blue-900 bg-[#020817] rounded-2xl p-4 min-w-[420px] space-y-4">
                            <div>
                              <p className="text-slate-400 text-xs mb-2">AWBs operacionais</p>
                              <p className="text-white font-bold break-words">
                                {item.awbs.length > 0 ? item.awbs.slice(0, 30).join(', ') : '-'}
                              </p>
                              {item.awbs.length > 30 && (
                                <p className="text-slate-500 text-xs mt-2">
                                  + {item.awbs.length - 30} AWB(s)
                                </p>
                              )}
                            </div>

                            <div>
                              <p className="text-slate-400 text-xs mb-2">AWBs em Processos Faturados</p>
                              <p className="text-green-300 font-bold break-words">
                                {item.awbsFaturados.length > 0 ? item.awbsFaturados.slice(0, 30).join(', ') : '-'}
                              </p>
                              {item.awbsFaturados.length > 30 && (
                                <p className="text-slate-500 text-xs mt-2">
                                  + {item.awbsFaturados.length - 30} AWB(s) faturado(s)
                                </p>
                              )}
                            </div>

                            <div>
                              <p className="text-slate-400 text-xs mb-2">Nº de fatura no financeiro</p>
                              <p className="text-blue-300 font-bold break-words">
                                {item.faturas.length > 0 ? item.faturas.slice(0, 30).join(', ') : '-'}
                              </p>
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
