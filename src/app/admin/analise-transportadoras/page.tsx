'use client'

// HC_ANALISE_TRANSPORTADORAS_V2

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'

const LOTE_SUPABASE = 1000
const ANO_ATUAL = new Date().getFullYear()

type Linha = Record<string, any>

const CORES = ['#2563eb', '#22c55e', '#a855f7', '#f59e0b', '#06b6d4', '#ef4444']

const MESES = [
  { valor: '1', label: 'Janeiro' },
  { valor: '2', label: 'Fevereiro' },
  { valor: '3', label: 'Março' },
  { valor: '4', label: 'Abril' },
  { valor: '5', label: 'Maio' },
  { valor: '6', label: 'Junho' },
  { valor: '7', label: 'Julho' },
  { valor: '8', label: 'Agosto' },
  { valor: '9', label: 'Setembro' },
  { valor: '10', label: 'Outubro' },
  { valor: '11', label: 'Novembro' },
  { valor: '12', label: 'Dezembro' },
]

function texto(valor: any) {
  return String(valor ?? '').trim()
}

function normalizar(valor: any) {
  return texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function numero(valor: any) {
  if (valor === null || valor === undefined || valor === '') return 0
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0

  const bruto = String(valor).trim()
  if (!bruto) return 0

  const limpo = bruto
    .replace(/[R$USD\s]/gi, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '')

  const n = Number(limpo)
  return Number.isFinite(n) ? n : 0
}

function moeda(valor: any) {
  return numero(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function numeroBR(valor: any, casas = 0) {
  return numero(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })
}

function moedaCompacta(valor: any) {
  const n = numero(valor)
  const abs = Math.abs(n)

  if (abs >= 1000000) {
    return `R$ ${(n / 1000000).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })} mi`
  }

  if (abs >= 1000) {
    return `R$ ${(n / 1000).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })} mil`
  }

  return moeda(n)
}

function percentual(valor: number) {
  return `${numeroBR(valor, 1)}%`
}

function normalizarAwb(valor: any) {
  return normalizar(valor).replace(/[^A-Z0-9]/g, '')
}

function dataISO(valor: any) {
  const s = texto(valor)
  if (!s) return ''

  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]

  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

function anoDaData(valor: any) {
  const d = dataISO(valor)
  return d ? Number(d.slice(0, 4)) : 0
}

function mesDaData(valor: any) {
  const d = dataISO(valor)
  return d ? Number(d.slice(5, 7)) : 0
}

function diaDaData(valor: any) {
  const d = dataISO(valor)
  return d ? Number(d.slice(8, 10)) : 0
}

function dataBR(valor: any) {
  const d = dataISO(valor)
  if (!d) return '-'
  const [ano, mes, dia] = d.split('-')
  return `${dia}/${mes}/${ano}`
}

function dataEmbarque(item: Linha) {
  return (
    item.data_envio ||
    item.data_coleta ||
    item.data_criacao ||
    item.criado_em ||
    item.ultima_atualizacao ||
    null
  )
}

function dataFatura(item: Linha) {
  return item.emissao || item.vencimento || item.data_pagamento || item.criado_em || null
}

function nomeTransportadora(valor: any) {
  const n = normalizar(valor)
  if (n.includes('FEDEX')) return 'FedEx'
  if (n.includes('DHL')) return 'DHL'
  if (n.includes('UPS')) return 'UPS'
  return texto(valor) || 'Outra'
}

function chaveFatura(transportadora: any, numeroFatura: any) {
  return `${normalizar(nomeTransportadora(transportadora))}|${normalizar(numeroFatura)}`
}

function nomeClienteEmbarque(item: Linha | null | undefined) {
  return texto(item?.cliente_final || item?.importador || item?.exportador)
}

function ehPago(item: Linha) {
  if (item.data_pagamento) return true

  const s = normalizar(
    `${item.situacao || ''} ${item.status_recebimento_fatura || ''} ${item.status_pagamento || ''}`
  )

  return (
    s.includes('PAGO') ||
    s.includes('PAGA') ||
    s.includes('QUITADO') ||
    s.includes('QUITADA') ||
    s.includes('BAIXADO') ||
    s.includes('BAIXADA')
  )
}

function statusFatura(item: Linha) {
  if (ehPago(item)) return 'Paga'

  const contestacao = normalizar(item.status_contestacao)
  if (contestacao && !contestacao.includes('NAO') && !contestacao.includes('SEM')) {
    return 'Contestada'
  }

  const venc = dataISO(item.vencimento)
  const hoje = dataISO(new Date())

  if (venc && hoje && venc < hoje) return 'Vencida'
  return 'Em aberto'
}

function valorPagoFatura(item: Linha) {
  const ajustado = numero(item.pago_ajustado)
  if (ajustado > 0) return ajustado
  return ehPago(item) ? numero(item.total) : 0
}

function saldoFatura(item: Linha) {
  if (ehPago(item)) return 0

  const saldoInformado = numero(item.saldo)
  if (saldoInformado > 0) return saldoInformado

  return Math.max(0, numero(item.total) - valorPagoFatura(item))
}

function KpiCard({
  titulo,
  valor,
  detalhe,
  icone,
  destaque = 'normal',
}: {
  titulo: string
  valor: string | number
  detalhe?: string
  icone: string
  destaque?: 'normal' | 'green' | 'orange'
}) {
  const borda =
    destaque === 'green'
      ? 'border-emerald-800/60'
      : destaque === 'orange'
        ? 'border-amber-800/60'
        : 'border-slate-800'

  const valorClasse =
    destaque === 'green'
      ? 'text-emerald-300'
      : destaque === 'orange'
        ? 'text-amber-300'
        : 'text-white'

  return (
    <div className={`rounded-2xl border ${borda} bg-[#071225] p-4 shadow-lg`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            {titulo}
          </p>
          <p className={`mt-2 truncate text-2xl font-black tracking-tight ${valorClasse}`}>
            {valor}
          </p>
          {detalhe ? <p className="mt-1.5 text-xs leading-snug text-slate-500">{detalhe}</p> : null}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-lg">
          {icone}
        </div>
      </div>
    </div>
  )
}

function MiniMetrica({
  titulo,
  valor,
  detalhe,
}: {
  titulo: string
  valor: string
  detalhe?: string
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#030b18] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{titulo}</p>
      <p className="mt-2 text-xl font-black text-white">{valor}</p>
      {detalhe ? <p className="mt-1 text-xs text-slate-500">{detalhe}</p> : null}
    </div>
  )
}

function BarraHorizontal({
  label,
  valor,
  maximo,
  detalhe,
  indice,
}: {
  label: string
  valor: number
  maximo: number
  detalhe?: string
  indice: number
}) {
  const largura = maximo > 0 ? Math.max(3, Math.round((valor / maximo) * 100)) : 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="truncate font-bold text-slate-300">{label}</span>
        <span className="shrink-0 font-black text-white">{detalhe || numeroBR(valor)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-900">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${largura}%`, backgroundColor: CORES[indice % CORES.length] }}
        />
      </div>
    </div>
  )
}

export default function AnaliseTransportadorasPage() {
  const [embarques, setEmbarques] = useState<Linha[]>([])
  const [faturas, setFaturas] = useState<Linha[]>([])
  const [itensFaturas, setItensFaturas] = useState<Linha[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const [transportadora, setTransportadora] = useState('TODAS')
  const [ano, setAno] = useState(String(ANO_ATUAL))
  const [mes, setMes] = useState('TODOS')
  const [status, setStatus] = useState('TODOS')

  // Estes dois filtros refinam somente a camada operacional por AWB.
  // Os valores das faturas continuam baseados na competência da própria fatura.
  const [cliente, setCliente] = useState('TODOS')
  const [servico, setServico] = useState('TODOS')

  const [modoApresentacao, setModoApresentacao] = useState(false)

  async function carregarTodos(tabela: string, colunaOrdem?: string, crescente = false) {
    const { count, error: countError } = await supabase
      .from(tabela)
      .select('*', { count: 'exact', head: true })

    if (countError) throw new Error(`Erro ao contar ${tabela}: ${countError.message}`)

    const total = count || 0
    const paginas = Math.max(1, Math.ceil(total / LOTE_SUPABASE))

    const consultas = Array.from({ length: paginas }, (_, index) => {
      const inicio = index * LOTE_SUPABASE
      const fim = inicio + LOTE_SUPABASE - 1

      let query = supabase.from(tabela).select('*').range(inicio, fim)
      if (colunaOrdem) query = query.order(colunaOrdem, { ascending: crescente })
      return query
    })

    const respostas = await Promise.all(consultas)
    const respostaComErro = respostas.find((item) => item.error)

    if (respostaComErro?.error) {
      throw new Error(`Erro ao carregar ${tabela}: ${respostaComErro.error.message}`)
    }

    return respostas.flatMap((item) => item.data || [])
  }

  async function carregar() {
    setCarregando(true)
    setErro('')

    try {
      const [embarquesData, faturasData, itensData] = await Promise.all([
        carregarTodos('embarques', 'criado_em', false),
        carregarTodos('faturas_transportadoras', 'criado_em', false),
        carregarTodos('faturas_transportadoras_itens', 'atualizado_em', false),
      ])

      setEmbarques(embarquesData)
      setFaturas(faturasData)
      setItensFaturas(itensData)
    } catch (e: any) {
      console.error(e)
      setErro(e?.message || 'Não foi possível carregar os dados.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const embarquesPorAwb = useMemo(() => {
    const mapa = new Map<string, Linha>()

    embarques.forEach((item) => {
      const awb = normalizarAwb(item.awb)
      if (!awb) return

      const atual = mapa.get(awb)

      if (!atual) {
        mapa.set(awb, item)
        return
      }

      const dataAtual = dataISO(dataEmbarque(atual))
      const dataNovo = dataISO(dataEmbarque(item))

      if (dataNovo > dataAtual) mapa.set(awb, item)
    })

    return mapa
  }, [embarques])

  const faturasPorId = useMemo(() => {
    const mapa = new Map<string, Linha>()
    faturas.forEach((item) => {
      if (item.id) mapa.set(String(item.id), item)
    })
    return mapa
  }, [faturas])

  const faturasPorChave = useMemo(() => {
    const mapa = new Map<string, Linha>()

    faturas.forEach((item) => {
      const chave = chaveFatura(item.transportadora, item.numero_fatura)
      if (chave !== '|') mapa.set(chave, item)
    })

    return mapa
  }, [faturas])

  const itensComContexto = useMemo(() => {
    return itensFaturas.map((item) => {
      const porId = item.fatura_transportadora_id
        ? faturasPorId.get(String(item.fatura_transportadora_id))
        : null

      const porChave = faturasPorChave.get(chaveFatura(item.transportadora, item.numero_fatura))
      const fatura = porId || porChave || null
      const awb = normalizarAwb(item.awb)
      const embarque = awb ? embarquesPorAwb.get(awb) || null : null

      return {
        item,
        fatura,
        embarque,
        awb,
        faturaId: texto(fatura?.id || item.fatura_transportadora_id),
        cliente: nomeClienteEmbarque(embarque),
        servico: texto(embarque?.servico),
      }
    })
  }, [itensFaturas, faturasPorId, faturasPorChave, embarquesPorAwb])

  const opcoes = useMemo(() => {
    const transportadoras = Array.from(
      new Set(faturas.map((x) => nomeTransportadora(x.transportadora)).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'))

    const anos = Array.from(
      new Set(faturas.map((x) => anoDaData(dataFatura(x))).filter((x) => x > 2000))
    ).sort((a, b) => b - a)

    return { transportadoras, anos }
  }, [faturas])

  const faturasPeriodo = useMemo(() => {
    return faturas.filter((item) => {
      if (
        transportadora !== 'TODAS' &&
        normalizar(nomeTransportadora(item.transportadora)) !== normalizar(transportadora)
      ) {
        return false
      }

      if (ano !== 'TODOS' && anoDaData(dataFatura(item)) !== Number(ano)) return false
      if (mes !== 'TODOS' && mesDaData(dataFatura(item)) !== Number(mes)) return false
      if (status !== 'TODOS' && statusFatura(item) !== status) return false

      return true
    })
  }, [faturas, transportadora, ano, mes, status])

  const idsFaturasPeriodo = useMemo(
    () => new Set(faturasPeriodo.map((item) => texto(item.id)).filter(Boolean)),
    [faturasPeriodo]
  )

  const itensPeriodo = useMemo(() => {
    return itensComContexto.filter((ctx) => {
      if (!ctx.faturaId || !idsFaturasPeriodo.has(ctx.faturaId)) return false
      return true
    })
  }, [itensComContexto, idsFaturasPeriodo])

  const opcoesOperacionais = useMemo(() => {
    const clientes = Array.from(
      new Set(itensPeriodo.map((ctx) => ctx.cliente).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'))

    const servicos = Array.from(
      new Set(itensPeriodo.map((ctx) => ctx.servico).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'))

    return { clientes, servicos }
  }, [itensPeriodo])

  const itensOperacionais = useMemo(() => {
    return itensPeriodo.filter((ctx) => {
      if (cliente !== 'TODOS' && normalizar(ctx.cliente) !== normalizar(cliente)) return false
      if (servico !== 'TODOS' && normalizar(ctx.servico) !== normalizar(servico)) return false
      return true
    })
  }, [itensPeriodo, cliente, servico])

  const resumoFinanceiro = useMemo(() => {
    const total = faturasPeriodo.reduce((acc, item) => acc + numero(item.total), 0)
    const pago = faturasPeriodo.reduce((acc, item) => acc + valorPagoFatura(item), 0)
    const aberto = faturasPeriodo.reduce((acc, item) => acc + saldoFatura(item), 0)

    return {
      faturas: faturasPeriodo.length,
      total,
      pago,
      aberto,
      ticket: faturasPeriodo.length ? total / faturasPeriodo.length : 0,
    }
  }, [faturasPeriodo])

  const qualidade = useMemo(() => {
    const faturasComItens = new Set(
      itensPeriodo.map((ctx) => ctx.faturaId).filter(Boolean)
    )

    const awbs = new Set(itensPeriodo.map((ctx) => ctx.awb).filter(Boolean))
    const awbsComEmbarque = new Set(
      itensPeriodo
        .filter((ctx) => !!ctx.embarque && !!ctx.awb)
        .map((ctx) => ctx.awb)
    )

    const faturasSemItens = Math.max(0, faturasPeriodo.length - faturasComItens.size)
    const awbsSemEmbarque = Math.max(0, awbs.size - awbsComEmbarque.size)

    return {
      faturasComItens: faturasComItens.size,
      faturasSemItens,
      awbs: awbs.size,
      awbsComEmbarque: awbsComEmbarque.size,
      awbsSemEmbarque,
      coberturaFaturas: faturasPeriodo.length
        ? (faturasComItens.size / faturasPeriodo.length) * 100
        : 0,
      coberturaAwbs: awbs.size ? (awbsComEmbarque.size / awbs.size) * 100 : 0,
    }
  }, [itensPeriodo, faturasPeriodo])

  const resumoOperacional = useMemo(() => {
    const awbs = new Set<string>()
    const awbsComEmbarque = new Set<string>()
    const clientes = new Set<string>()
    const embarquesUnicos = new Map<string, Linha>()
    let custoIdentificado = 0

    itensOperacionais.forEach((ctx) => {
      if (ctx.awb) awbs.add(ctx.awb)
      custoIdentificado += numero(ctx.item.valor_compra)

      if (!ctx.embarque) return

      if (ctx.awb) awbsComEmbarque.add(ctx.awb)

      const chaveEmbarque = texto(ctx.embarque.id) || ctx.awb
      if (chaveEmbarque) embarquesUnicos.set(chaveEmbarque, ctx.embarque)

      const clienteAtual = nomeClienteEmbarque(ctx.embarque)
      if (clienteAtual) clientes.add(clienteAtual)
    })

    const pesoTotal = Array.from(embarquesUnicos.values()).reduce(
      (acc, item) => acc + (numero(item.peso_taxado) || numero(item.peso_real)),
      0
    )

    return {
      awbs: awbs.size,
      embarques: embarquesUnicos.size,
      clientes: clientes.size,
      pesoTotal,
      custoIdentificado,
      awbsComEmbarque: awbsComEmbarque.size,
    }
  }, [itensOperacionais])

  const porServico = useMemo(() => {
    const mapa = new Map<string, Set<string>>()

    itensOperacionais.forEach((ctx) => {
      if (!ctx.embarque || !ctx.awb) return

      const chave = texto(ctx.embarque.servico) || 'Não informado'
      const awbs = mapa.get(chave) || new Set<string>()
      awbs.add(ctx.awb)
      mapa.set(chave, awbs)
    })

    return Array.from(mapa.entries())
      .map(([label, awbs]) => ({ label, valor: awbs.size }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8)
  }, [itensOperacionais])

  const topClientes = useMemo(() => {
    const mapa = new Map<string, { custo: number; awbs: Set<string> }>()

    itensOperacionais.forEach((ctx) => {
      const nome = ctx.cliente || 'Não identificado'
      const atual = mapa.get(nome) || { custo: 0, awbs: new Set<string>() }

      atual.custo += numero(ctx.item.valor_compra)
      if (ctx.awb) atual.awbs.add(ctx.awb)
      mapa.set(nome, atual)
    })

    return Array.from(mapa.entries())
      .map(([nome, dados]) => ({
        nome,
        custo: dados.custo,
        embarques: dados.awbs.size,
      }))
      .sort((a, b) => b.custo - a.custo)
      .slice(0, 8)
  }, [itensOperacionais])

  const evolucao = useMemo(() => {
    if (ano !== 'TODOS' && mes !== 'TODOS') {
      const totalDias = new Date(Number(ano), Number(mes), 0).getDate()

      return Array.from({ length: totalDias }, (_, index) => {
        const dia = index + 1
        const lista = faturasPeriodo.filter((x) => diaDaData(dataFatura(x)) === dia)

        return {
          label: String(dia).padStart(2, '0'),
          valor: lista.reduce((acc, x) => acc + numero(x.total), 0),
        }
      })
    }

    if (ano !== 'TODOS') {
      const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

      return nomesMeses.map((label, index) => {
        const numeroMes = index + 1
        const lista = faturasPeriodo.filter((x) => mesDaData(dataFatura(x)) === numeroMes)

        return {
          label,
          valor: lista.reduce((acc, x) => acc + numero(x.total), 0),
        }
      })
    }

    const mapa = new Map<number, number>()

    faturasPeriodo.forEach((item) => {
      const a = anoDaData(dataFatura(item))
      if (a) mapa.set(a, (mapa.get(a) || 0) + numero(item.total))
    })

    return Array.from(mapa.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([a, valor]) => ({ label: String(a), valor }))
  }, [faturasPeriodo, ano, mes])

  const comparativo = useMemo(() => {
    if (transportadora !== 'TODAS') return []

    const mapa = new Map<
      string,
      { faturas: number; total: number; pago: number; awbs: Set<string> }
    >()

    faturasPeriodo.forEach((item) => {
      const nome = nomeTransportadora(item.transportadora)
      const atual = mapa.get(nome) || { faturas: 0, total: 0, pago: 0, awbs: new Set<string>() }

      atual.faturas += 1
      atual.total += numero(item.total)
      atual.pago += valorPagoFatura(item)
      mapa.set(nome, atual)
    })

    itensPeriodo.forEach((ctx) => {
      const nome = nomeTransportadora(ctx.fatura?.transportadora || ctx.item.transportadora)
      const atual = mapa.get(nome)
      if (!atual) return
      if (ctx.awb) atual.awbs.add(ctx.awb)
    })

    return Array.from(mapa.entries())
      .map(([nome, dados]) => ({
        nome,
        faturas: dados.faturas,
        total: dados.total,
        pago: dados.pago,
        awbs: dados.awbs.size,
      }))
      .sort((a, b) => b.total - a.total)
  }, [transportadora, faturasPeriodo, itensPeriodo])

  const nomeMesSelecionado = MESES.find((x) => x.valor === mes)?.label || ''

  const tituloEvolucao =
    ano !== 'TODOS' && mes !== 'TODOS'
      ? `Evolução diária das faturas — ${nomeMesSelecionado}/${ano}`
      : ano !== 'TODOS'
        ? `Evolução mensal das faturas — ${ano}`
        : 'Evolução das faturas'

  const maxEvolucao = Math.max(1, ...evolucao.map((x) => x.valor))
  const maxCliente = Math.max(1, ...topClientes.map((x) => x.custo))
  const maxServico = Math.max(1, ...porServico.map((x) => x.valor))

  const faturasRecentes = [...faturasPeriodo]
    .sort((a, b) => dataISO(dataFatura(b)).localeCompare(dataISO(dataFatura(a))))
    .slice(0, modoApresentacao ? 6 : 10)

  function limparFiltros() {
    setTransportadora('TODAS')
    setAno(String(ANO_ATUAL))
    setMes('TODOS')
    setStatus('TODOS')
    setCliente('TODOS')
    setServico('TODOS')
  }

  if (carregando) {
    return (
      <main className="min-h-screen bg-[#020817] p-6 text-white">
        <div className="rounded-3xl border border-blue-900 bg-[#071225] p-8">
          <p className="text-xl font-black">Carregando Análise de Transportadoras...</p>
          <p className="mt-2 text-sm text-slate-400">
            Faturas de transportadoras, itens por AWB e embarques vinculados.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen w-full bg-[#020817] text-white">
      <style jsx global>{`
        @media print {
          aside, nav, .no-print { display: none !important; }
          body { background: #020817 !important; }
          main { padding: 0 !important; }
        }
      `}</style>

      <div className="w-full max-w-none space-y-5">
        <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-400">
              Intelligence
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight 2xl:text-4xl">
              Análise de Transportadoras
            </h1>
            <p className="mt-1.5 max-w-4xl text-sm leading-relaxed text-slate-400">
              Visão executiva das faturas pagas às transportadoras e dos AWBs identificados nelas.
              O período financeiro segue a data da fatura; os embarques são vinculados pelos AWBs das faturas.
            </p>
          </div>

          <div className="no-print flex flex-wrap gap-2">
            <button
              onClick={() => setModoApresentacao((v) => !v)}
              className={`rounded-xl border px-4 py-2.5 text-xs font-black ${
                modoApresentacao
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                  : 'border-slate-700 bg-slate-900 text-slate-300'
              }`}
            >
              🎤 Apresentação {modoApresentacao ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={() => window.print()}
              className="rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-black text-white hover:bg-violet-500"
            >
              📄 Gerar PDF
            </button>

            <button
              onClick={() => carregar()}
              className="rounded-xl border border-blue-800 bg-blue-950/40 px-4 py-2.5 text-xs font-black text-blue-300"
            >
              ↻ Atualizar
            </button>
          </div>
        </header>

        {erro ? (
          <div className="rounded-2xl border border-red-800 bg-red-950/30 p-4 text-sm font-bold text-red-300">
            {erro}
          </div>
        ) : null}

        <section className="no-print rounded-2xl border border-slate-800 bg-[#071225] p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Filtro label="Transportadora" valor={transportadora} setValor={setTransportadora}>
              <option value="TODAS">Todas</option>
              {opcoes.transportadoras.map((x) => <option key={x}>{x}</option>)}
            </Filtro>

            <Filtro label="Ano da fatura" valor={ano} setValor={setAno}>
              <option value="TODOS">Todos</option>
              {opcoes.anos.map((x) => <option key={x} value={x}>{x}</option>)}
            </Filtro>

            <Filtro label="Mês da fatura" valor={mes} setValor={setMes}>
              <option value="TODOS">Todos</option>
              {MESES.map((x) => <option key={x.valor} value={x.valor}>{x.label}</option>)}
            </Filtro>

            <Filtro label="Status da fatura" valor={status} setValor={setStatus}>
              <option value="TODOS">Todos</option>
              <option>Paga</option>
              <option>Em aberto</option>
              <option>Vencida</option>
              <option>Contestada</option>
            </Filtro>
          </div>

          <div className="mt-3 flex flex-col gap-3 border-t border-slate-800 pt-3 xl:flex-row xl:items-end xl:justify-between">
            <details className="group flex-1">
              <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.16em] text-blue-300">
                + Detalhamento operacional por cliente/serviço
              </summary>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <Filtro label="Cliente identificado no AWB" valor={cliente} setValor={setCliente}>
                  <option value="TODOS">Todos</option>
                  {opcoesOperacionais.clientes.map((x) => <option key={x}>{x}</option>)}
                </Filtro>

                <Filtro label="Serviço do embarque" valor={servico} setValor={setServico}>
                  <option value="TODOS">Todos</option>
                  {opcoesOperacionais.servicos.map((x) => <option key={x}>{x}</option>)}
                </Filtro>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Estes dois filtros refinam os indicadores por AWB. Os totais financeiros continuam
                representando as faturas do período selecionado para evitar atribuir o valor integral
                de uma fatura a apenas um cliente ou serviço.
              </p>
            </details>

            <button
              onClick={limparFiltros}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-black text-slate-300 hover:bg-slate-800"
            >
              Limpar filtros
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            titulo="Faturas"
            valor={numeroBR(resumoFinanceiro.faturas)}
            detalhe={`Ticket médio ${moeda(resumoFinanceiro.ticket)}`}
            icone="📄"
          />
          <KpiCard
            titulo="Valor faturado"
            valor={moeda(resumoFinanceiro.total)}
            detalhe="Total das faturas no período"
            icone="🧾"
          />
          <KpiCard
            titulo="Valor pago"
            valor={moeda(resumoFinanceiro.pago)}
            detalhe="PAGA/PAGO ou com data de pagamento"
            icone="✅"
            destaque="green"
          />
          <KpiCard
            titulo="Saldo em aberto"
            valor={moeda(resumoFinanceiro.aberto)}
            detalhe="Saldo ainda não quitado"
            icone="⏳"
            destaque="orange"
          />
        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#071225] p-4 shadow-lg">
          <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-400">
                Operação vinculada às faturas
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Calculada pelos AWBs cadastrados nos itens das faturas, sem filtrar pela data de criação do embarque.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500">
              Custo identificado por AWB: {moeda(resumoOperacional.custoIdentificado)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <MiniMetrica
              titulo="AWBs identificados"
              valor={numeroBR(resumoOperacional.awbs)}
              detalhe="AWBs nos itens das faturas"
            />
            <MiniMetrica
              titulo="Embarques encontrados"
              valor={numeroBR(resumoOperacional.embarques)}
              detalhe={`${numeroBR(resumoOperacional.awbsComEmbarque)} AWB(s) conciliado(s)`}
            />
            <MiniMetrica
              titulo="Clientes"
              valor={numeroBR(resumoOperacional.clientes)}
              detalhe="Clientes distintos identificados"
            />
            <MiniMetrica
              titulo="Peso identificado"
              valor={`${numeroBR(resumoOperacional.pesoTotal, 1)} kg`}
              detalhe="Taxado; peso real como fallback"
            />
            <MiniMetrica
              titulo="Cobertura AWB"
              valor={percentual(qualidade.coberturaAwbs)}
              detalhe={`${qualidade.awbsSemEmbarque} AWB(s) sem embarque localizado`}
            />
          </div>
        </section>

        <section
          className={`rounded-2xl border p-4 ${
            qualidade.faturasSemItens > 0 || qualidade.awbsSemEmbarque > 0
              ? 'border-amber-800/60 bg-amber-950/10'
              : 'border-emerald-900/60 bg-emerald-950/10'
          }`}
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Qualidade dos vínculos
              </p>
              <p className="mt-1 text-sm font-bold text-white">
                {qualidade.faturasComItens} de {faturasPeriodo.length} fatura(s) têm AWBs cadastrados
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-300">
                Cobertura das faturas: {percentual(qualidade.coberturaFaturas)}
              </span>
              <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-300">
                {qualidade.faturasSemItens} fatura(s) sem AWBs
              </span>
              <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-300">
                {qualidade.awbsSemEmbarque} AWB(s) sem embarque
              </span>
            </div>
          </div>
        </section>

        <Painel titulo={tituloEvolucao} subtitulo="Valor total das faturas de transportadora">
          <div className="overflow-x-auto pb-2">
            <div
              className={`flex h-[300px] items-end gap-3 pt-8 ${
                ano !== 'TODOS' && mes !== 'TODOS' ? 'min-w-[1300px]' : 'min-w-[820px]'
              }`}
            >
              {evolucao.map((x, i) => {
                const altura = x.valor ? Math.max(18, Math.round((x.valor / maxEvolucao) * 210)) : 3

                return (
                  <div
                    key={`${x.label}-${i}`}
                    className="flex min-w-[38px] flex-1 flex-col items-center justify-end gap-2"
                    title={`${x.label}: ${moeda(x.valor)}`}
                  >
                    <span className="min-h-[18px] whitespace-nowrap text-[11px] font-black text-slate-300">
                      {x.valor ? moedaCompacta(x.valor) : ''}
                    </span>
                    <div
                      className="w-full max-w-[64px] rounded-t-lg transition-all"
                      style={{
                        height: `${altura}px`,
                        backgroundColor: CORES[i % CORES.length],
                        opacity: x.valor ? 1 : 0.15,
                      }}
                    />
                    <span className="text-xs font-black text-slate-400">{x.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </Painel>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Painel
            titulo="Top clientes por custo identificado"
            subtitulo="Soma dos valores por AWB das faturas selecionadas"
          >
            <div className="space-y-4">
              {topClientes.map((x, i) => (
                <BarraHorizontal
                  key={x.nome}
                  label={`${i + 1}. ${x.nome}`}
                  valor={x.custo}
                  maximo={maxCliente}
                  detalhe={`${moeda(x.custo)} • ${x.embarques} AWB(s)`}
                  indice={i + 1}
                />
              ))}
              {!topClientes.length ? <Vazio texto="Nenhum cliente identificado nos AWBs deste filtro." /> : null}
            </div>
          </Painel>

          <Painel titulo="Serviços identificados" subtitulo="Quantidade de AWBs por serviço do embarque">
            <div className="space-y-4">
              {porServico.map((x, i) => (
                <BarraHorizontal
                  key={x.label}
                  label={x.label}
                  valor={x.valor}
                  maximo={maxServico}
                  indice={i + 2}
                />
              ))}
              {!porServico.length ? <Vazio texto="Nenhum serviço identificado nos AWBs deste filtro." /> : null}
            </div>
          </Painel>
        </section>

        {comparativo.length > 1 ? (
          <Painel titulo="Comparativo por transportadora" subtitulo="Mesma competência financeira selecionada acima">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {comparativo.map((x, i) => (
                <div
                  key={x.nome}
                  className="rounded-xl border border-slate-800 bg-[#030b18] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xl font-black text-white">{x.nome}</p>
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: CORES[i % CORES.length] }}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Faturas</p>
                      <p className="mt-1 font-black text-white">{numeroBR(x.faturas)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">AWBs</p>
                      <p className="mt-1 font-black text-white">{numeroBR(x.awbs)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Valor</p>
                      <p className="mt-1 font-black text-white">{moeda(x.total)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Pago</p>
                      <p className="mt-1 font-black text-emerald-300">{moeda(x.pago)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Painel>
        ) : null}

        {!modoApresentacao ? (
          <Painel
            titulo="Faturas recentes"
            subtitulo="Últimas faturas dentro da competência e status selecionados"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500">
                    <th className="px-3 py-3">Transportadora</th>
                    <th className="px-3 py-3">Nº fatura</th>
                    <th className="px-3 py-3">Emissão</th>
                    <th className="px-3 py-3">Vencimento</th>
                    <th className="px-3 py-3">Valor</th>
                    <th className="px-3 py-3">Pago</th>
                    <th className="px-3 py-3">Saldo</th>
                    <th className="px-3 py-3">Situação</th>
                  </tr>
                </thead>

                <tbody>
                  {faturasRecentes.map((item) => (
                    <tr key={item.id} className="border-b border-slate-900">
                      <td className="px-3 py-3 font-black">{nomeTransportadora(item.transportadora)}</td>
                      <td className="px-3 py-3 text-blue-300">{texto(item.numero_fatura) || '-'}</td>
                      <td className="px-3 py-3">{dataBR(item.emissao)}</td>
                      <td className="px-3 py-3">{dataBR(item.vencimento)}</td>
                      <td className="px-3 py-3 font-black">{moeda(item.total)}</td>
                      <td className="px-3 py-3 text-emerald-300">{moeda(valorPagoFatura(item))}</td>
                      <td className="px-3 py-3 text-amber-300">{moeda(saldoFatura(item))}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 font-bold">
                          {statusFatura(item)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!faturasRecentes.length ? <Vazio texto="Nenhuma fatura encontrada para os filtros atuais." /> : null}
            </div>
          </Painel>
        ) : null}

        <footer className="flex flex-col justify-between gap-2 border-t border-slate-900 py-5 text-xs text-slate-500 sm:flex-row">
          <span>
            Financeiro: faturas_transportadoras. Operação: AWBs de faturas_transportadoras_itens conciliados com embarques.
          </span>
          <span>
            Faturas sem AWBs permanecem no total financeiro e são sinalizadas em Qualidade dos vínculos.
          </span>
        </footer>
      </div>
    </main>
  )
}

function Filtro({
  label,
  valor,
  setValor,
  children,
}: {
  label: string
  valor: string
  setValor: (valor: string) => void
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <select
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-[#030b18] px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-blue-500"
      >
        {children}
      </select>
    </label>
  )
}

function Painel({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string
  subtitulo?: string
  children: ReactNode
}) {
  return (
    <section className="h-full rounded-2xl border border-slate-800 bg-[#071225] p-5 shadow-lg">
      <div className="mb-5">
        <h2 className="text-lg font-black text-white">{titulo}</h2>
        {subtitulo ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{subtitulo}</p> : null}
      </div>
      {children}
    </section>
  )
}

function Vazio({ texto: mensagem = 'Sem dados para os filtros selecionados.' }: { texto?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/30 p-5 text-center text-sm font-bold text-slate-500">
      {mensagem}
    </div>
  )
}
