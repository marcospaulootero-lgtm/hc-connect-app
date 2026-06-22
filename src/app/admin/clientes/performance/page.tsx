'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const LOTE_SUPABASE = 1000
const STORAGE_KEY = 'hc_admin_clientes_performance_filtros_v1'

type FiltroRanking = 'VALOR' | 'EMBARQUES' | 'TICKET' | 'PESO' | 'PARADOS'
type FiltroPeriodo = 'TODOS' | 'MES_ATUAL' | 'MES_ANTERIOR' | 'ULTIMOS_90' | 'ANO_ATUAL'

type ClienteRanking = {
  clienteId: string
  nome: string
  email: string
  embarques: number
  embarquesComValor: number
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
  transportadoras: string[]
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

  function dataInicioPeriodo() {
    const agora = new Date()
    const ano = agora.getFullYear()
    const mes = agora.getMonth()

    if (periodo === 'MES_ATUAL') {
      return new Date(ano, mes, 1)
    }

    if (periodo === 'MES_ANTERIOR') {
      return new Date(ano, mes - 1, 1)
    }

    if (periodo === 'ULTIMOS_90') {
      const data = new Date()
      data.setDate(data.getDate() - 90)
      return data
    }

    if (periodo === 'ANO_ATUAL') {
      return new Date(ano, 0, 1)
    }

    return null
  }

  function dataFimPeriodo() {
    const agora = new Date()
    const ano = agora.getFullYear()
    const mes = agora.getMonth()

    if (periodo === 'MES_ANTERIOR') {
      return new Date(ano, mes, 1)
    }

    return null
  }

  function embarqueDentroPeriodo(embarque: any) {
    if (periodo === 'TODOS') return true

    const criado = embarque?.criado_em ? new Date(embarque.criado_em) : null
    if (!criado || Number.isNaN(criado.getTime())) return false

    const inicio = dataInicioPeriodo()
    const fim = dataFimPeriodo()

    if (inicio && criado < inicio) return false
    if (fim && criado >= fim) return false

    return true
  }

  function financeiroDoEmbarque(embarque: any) {
    if (!embarque) return null

    const porId = financeiros.find(
      (item) => String(item.embarque_id || '') === String(embarque.id || '')
    )

    if (porId) return porId

    const awb = normalizarAwb(embarque.awb)
    if (!awb) return null

    return (
      financeiros.find((item) => {
        const possiveisAwbs = [item.awb, item.numero_awb, item.hawb, item.h_awb]
          .map(normalizarAwb)
          .filter(Boolean)

        if (possiveisAwbs.includes(awb)) return true

        return Object.values(item || {}).some((valor) => {
          const normalizado = normalizarAwb(valor)
          if (!normalizado) return false
          if (normalizado === awb) return true
          if (awb.length >= 8 && normalizado.includes(awb)) return true
          if (normalizado.length >= 8 && awb.includes(normalizado)) return true
          return false
        })
      }) || null
    )
  }

  function valorFinanceiro(item: any) {
    if (!item) return 0

    return (
      numero(item.valor_cobranca) ||
      numero(item.valor_faturado) ||
      numero(item.valor_venda) ||
      numero(item.valor) ||
      0
    )
  }

  function valorEmbarque(embarque: any) {
    const financeiro = financeiroDoEmbarque(embarque)
    const valorFin = valorFinanceiro(financeiro)

    if (valorFin > 0) return valorFin

    const valor =
      numero(embarque.valor_cobrado_cliente) ||
      numero(embarque.valor_fechado) ||
      numero(embarque.valor_venda) ||
      0

    if (!valor) return 0

    const moedaBase = String(embarque.moeda_cobranca || embarque.moeda || 'BRL').toUpperCase()

    if (moedaBase === 'BRL') return valor

    const taxa = numero(embarque.taxa_conversao)
    const spread = numero(embarque.spread_percentual || embarque.spread)

    if (taxa > 0) {
      return valor * taxa * (1 + spread / 100)
    }

    return 0
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
      embarque.cliente_final ||
      embarque.importador ||
      embarque.exportador ||
      'Sem cliente vinculado'
    )
  }

  const ranking = useMemo(() => {
    const mapaClientes = new Map<string, any>()

    clientes.forEach((cliente) => {
      mapaClientes.set(cliente.id, cliente)
    })

    const acumulado = new Map<string, ClienteRanking>()

    clientes.forEach((cliente) => {
      acumulado.set(cliente.id, {
        clienteId: cliente.id,
        nome: cliente.nome || cliente.email || 'Cliente',
        email: cliente.email || '',
        embarques: 0,
        embarquesComValor: 0,
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
        transportadoras: [],
      })
    })

    embarques.filter(embarqueDentroPeriodo).forEach((embarque) => {
      const clienteIds = clienteIdsDoEmbarque(embarque)
      const valor = valorEmbarque(embarque)
      const peso = numero(embarque.peso_taxado) || numero(embarque.peso_real)
      const status = normalizarTexto(embarque.status_operacional)
      const data = embarque.criado_em || embarque.ultima_atualizacao || null

      clienteIds.forEach((clienteId) => {
        const cliente = mapaClientes.get(clienteId)
        const chave = cliente?.id || clienteId

        if (!acumulado.has(chave)) {
          acumulado.set(chave, {
            clienteId: chave,
            nome: cliente?.nome || cliente?.email || nomeClienteFallback(embarque),
            email: cliente?.email || '',
            embarques: 0,
            embarquesComValor: 0,
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
            transportadoras: [],
          })
        }

        const item = acumulado.get(chave)!

        item.embarques += 1
        item.valorTotal += valor
        item.pesoTotal += peso

        if (valor > 0) item.embarquesComValor += 1
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

    let lista = Array.from(acumulado.values()).map((item) => ({
      ...item,
      awbs: Array.from(new Set(item.awbs)),
      transportadoras: Array.from(new Set(item.transportadoras)),
      ticketMedio: item.embarquesComValor > 0 ? item.valorTotal / item.embarquesComValor : 0,
    }))

    if (somenteComEmbarque) {
      lista = lista.filter((item) => item.embarques > 0)
    }

    if (busca.trim()) {
      const termo = normalizarTexto(busca)
      lista = lista.filter((item) => {
        const texto = normalizarTexto(`
          ${item.nome}
          ${item.email}
          ${item.awbs.join(' ')}
          ${item.transportadoras.join(' ')}
        `)

        return texto.includes(termo)
      })
    }

    lista.sort((a, b) => {
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
    const valorTotal = ranking.reduce((acc, item) => acc + item.valorTotal, 0)
    const embarquesComValor = ranking.reduce((acc, item) => acc + item.embarquesComValor, 0)
    const pesoTotal = ranking.reduce((acc, item) => acc + item.pesoTotal, 0)
    const ticketMedio = embarquesComValor > 0 ? valorTotal / embarquesComValor : 0

    return {
      totalClientes,
      totalEmbarques,
      valorTotal,
      embarquesComValor,
      pesoTotal,
      ticketMedio,
      topValor: ranking[0] || null,
      topEmbarques: [...ranking].sort((a, b) => b.embarques - a.embarques)[0] || null,
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
        'Embarques',
        'Valor total BRL',
        'Ticket medio BRL',
        'Peso total kg',
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
        item.valorTotal.toFixed(2).replace('.', ','),
        item.ticketMedio.toFixed(2).replace('.', ','),
        item.pesoTotal.toFixed(2).replace('.', ','),
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
    link.download = `ranking-clientes-${new Date().toISOString().slice(0, 10)}.csv`
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
        </div>

        <div className="flex gap-3 flex-wrap h-fit">
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

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5 mb-8">
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
          detalhe={`${resumo.embarquesComValor} embarque(s) com valor`}
          icone="💰"
          ativo={rankingPor === 'VALOR'}
          onClick={() => setRankingPor('VALOR')}
        />

        <KpiCard
          titulo="Total embarques"
          valor={resumo.totalEmbarques}
          detalhe="processos no período"
          icone="📦"
          ativo={rankingPor === 'EMBARQUES'}
          onClick={() => setRankingPor('EMBARQUES')}
        />

        <KpiCard
          titulo="Ticket médio"
          valor={moeda(resumo.ticketMedio)}
          detalhe="média por embarque com valor"
          icone="🎯"
          ativo={rankingPor === 'TICKET'}
          onClick={() => setRankingPor('TICKET')}
        />

        <KpiCard
          titulo="Peso total"
          valor={`${resumo.pesoTotal.toFixed(2)} kg`}
          detalhe="peso real/taxado movimentado"
          icone="⚖️"
          ativo={rankingPor === 'PESO'}
          onClick={() => setRankingPor('PESO')}
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-8">
        <Destaque
          titulo="Maior faturamento"
          cliente={resumo.topValor}
          valor={resumo.topValor ? moeda(resumo.topValor.valorTotal) : '-'}
          detalhe="Cliente com maior valor total"
        />

        <Destaque
          titulo="Mais embarques"
          cliente={resumo.topEmbarques}
          valor={resumo.topEmbarques ? `${resumo.topEmbarques.embarques} processo(s)` : '-'}
          detalhe="Cliente com maior volume"
        />

        <Destaque
          titulo="Melhor ticket"
          cliente={resumo.topTicket}
          valor={resumo.topTicket ? moeda(resumo.topTicket.ticketMedio) : '-'}
          detalhe="Ticket médio por embarque com valor"
        />
      </section>

      <section className="border border-blue-900 rounded-3xl bg-[#071225] p-5 lg:p-7 mb-8">
        <div className="flex flex-col lg:flex-row justify-between gap-5 mb-6">
          <div>
            <h2 className="text-2xl font-black">Filtros e ranking</h2>
            <p className="text-slate-400 text-sm">
              Os filtros ficam salvos no navegador para manter sua última visualização.
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
            placeholder="Buscar cliente, e-mail, AWB ou transportadora..."
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
            <span className="font-bold text-sm">Somente com embarque</span>
          </label>
        </div>
      </section>

      <section className="border border-blue-900 rounded-3xl bg-[#071225] p-5 lg:p-7">
        <div className="flex flex-col lg:flex-row justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-black">Resultado</h2>
            <p className="text-slate-400 text-sm">
              {ranking.length} cliente(s) encontrado(s). Ticket médio usa apenas embarques com valor financeiro identificado.
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
            <table className="w-full min-w-[1300px] border-collapse text-xs lg:text-sm [&_th]:border-b [&_th]:border-blue-900 [&_th]:px-3 [&_th]:py-3 [&_th]:text-left [&_th]:font-black [&_th]:text-slate-300 [&_td]:px-3 [&_td]:py-4 [&_td]:align-middle">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cliente</th>
                  <th>Embarques</th>
                  <th>Total faturado</th>
                  <th>Ticket médio</th>
                  <th>Peso</th>
                  <th>Ativos</th>
                  <th>Entregues</th>
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
                        <p className="text-slate-500 text-xs">processo(s)</p>
                      </td>

                      <td>
                        <strong className="text-green-400">{moeda(item.valorTotal)}</strong>
                        <p className="text-slate-500 text-xs">
                          {item.embarquesComValor} com valor
                        </p>
                      </td>

                      <td>
                        <strong className="text-yellow-300">{moeda(item.ticketMedio)}</strong>
                        <p className="text-slate-500 text-xs">média por processo</p>
                      </td>

                      <td>
                        <strong>{item.pesoTotal.toFixed(2)} kg</strong>
                      </td>

                      <td>
                        <span className="bg-blue-600/20 border border-blue-500 text-blue-300 px-3 py-1 rounded-full font-black">
                          {item.ativos}
                        </span>
                      </td>

                      <td>
                        <span className="bg-green-600/20 border border-green-500 text-green-300 px-3 py-1 rounded-full font-black">
                          {item.entregues}
                        </span>
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
                            href="/admin/embarques"
                            className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl font-bold"
                          >
                            Embarques
                          </a>
                        </div>

                        {aberto && (
                          <div className="mt-4 border border-blue-900 bg-[#020817] rounded-2xl p-4 min-w-[360px]">
                            <p className="text-slate-400 text-xs mb-2">AWBs do cliente</p>
                            <p className="text-white font-bold break-words">
                              {item.awbs.length > 0 ? item.awbs.slice(0, 30).join(', ') : '-'}
                            </p>

                            {item.awbs.length > 30 && (
                              <p className="text-slate-500 text-xs mt-2">
                                + {item.awbs.length - 30} AWB(s)
                              </p>
                            )}
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
