'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'

const LOTE_SUPABASE = 1000
const ANO_ATUAL = new Date().getFullYear()

type Linha = Record<string, any>

const CORES = ['#2563eb', '#22c55e', '#a855f7', '#f59e0b', '#06b6d4', '#ef4444', '#64748b']

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

function operacaoDoEmbarque(item: Linha) {
  const explicito = normalizar(item.tipo_operacao || item.operacao)
  if (explicito.includes('EXPORT')) return 'Exportação'
  if (explicito.includes('IMPORT')) return 'Importação'

  const base = normalizar(`${item.servico || ''} ${item.descricao || ''}`)
  if (base.includes('EXPORT')) return 'Exportação'
  if (base.includes('IMPORT')) return 'Importação'
  return 'Não informado'
}

function classificarRegiao(local: any) {
  const v = ` ${normalizar(local).replace(/[^A-Z0-9]+/g, ' ')} `
  if (!v.trim()) return 'Não classificada'

  const americaNorte = [
    ' EUA ', ' USA ', ' UNITED STATES ', ' ESTADOS UNIDOS ', ' CANADA ', ' MEXICO ',
    ' MIA ', ' JFK ', ' EWR ', ' LAX ', ' SFO ', ' ORD ', ' ATL ', ' DFW ', ' IAH ',
    ' BOS ', ' CLE ', ' ELP ', ' RNO ', ' SEA ', ' DEN ', ' LAS ', ' MCO ', ' TMB ',
  ]
  if (americaNorte.some((x) => v.includes(x))) return 'América do Norte'

  const americaSul = [
    ' BRASIL ', ' BRAZIL ', ' ARGENTINA ', ' CHILE ', ' COLOMBIA ', ' PERU ',
    ' URUGUAI ', ' URUGUAY ', ' PARAGUAI ', ' PARAGUAY ', ' BOLIVIA ', ' EQUADOR ',
    ' ECUADOR ', ' VENEZUELA ', ' GRU ', ' VCP ', ' CNF ', ' GIG ', ' POA ', ' CWB ',
  ]
  if (americaSul.some((x) => v.includes(x))) return 'América do Sul'

  const europa = [
    ' ALEMANHA ', ' GERMANY ', ' FRANCE ', ' FRANCA ', ' ITALIA ', ' ITALY ',
    ' SPAIN ', ' ESPANHA ', ' PORTUGAL ', ' UNITED KINGDOM ', ' REINO UNIDO ',
    ' ENGLAND ', ' NETHERLANDS ', ' HOLANDA ', ' BELGIUM ', ' BELGICA ', ' SWITZERLAND ',
    ' SUICA ', ' AUSTRIA ', ' POLAND ', ' POLONIA ', ' IRELAND ', ' IRLANDA ',
    ' CDG ', ' FRA ', ' AMS ', ' MAD ', ' LIS ', ' LHR ', ' MXP ', ' FCO ', ' ZRH ',
  ]
  if (europa.some((x) => v.includes(x))) return 'Europa'

  const asia = [
    ' CHINA ', ' JAPAN ', ' JAPAO ', ' INDIA ', ' SOUTH KOREA ', ' KOREA ',
    ' SINGAPORE ', ' HONG KONG ', ' TAIWAN ', ' THAILAND ', ' VIETNAM ', ' MALAYSIA ',
    ' PVG ', ' SHA ', ' PEK ', ' HKG ', ' NRT ', ' HND ', ' ICN ', ' SIN ', ' TPE ',
  ]
  if (asia.some((x) => v.includes(x))) return 'Ásia'

  const orienteMedio = [
    ' UNITED ARAB EMIRATES ', ' EMIRADOS ARABES ', ' UAE ', ' DUBAI ', ' QATAR ',
    ' SAUDI ARABIA ', ' ARABIA SAUDITA ', ' ISRAEL ', ' TURKEY ', ' TURQUIA ',
    ' DXB ', ' DOH ', ' IST ', ' TLV ',
  ]
  if (orienteMedio.some((x) => v.includes(x))) return 'Oriente Médio'

  const oceania = [' AUSTRALIA ', ' NEW ZEALAND ', ' NOVA ZELANDIA ', ' SYD ', ' MEL ', ' AKL ']
  if (oceania.some((x) => v.includes(x))) return 'Oceania'

  const africa = [
    ' SOUTH AFRICA ', ' AFRICA DO SUL ', ' EGYPT ', ' EGITO ', ' MOROCCO ', ' MARROCOS ',
    ' NIGERIA ', ' KENYA ', ' JNB ', ' CPT ', ' CAI ',
  ]
  if (africa.some((x) => v.includes(x))) return 'África'

  return 'Não classificada'
}

function regiaoComercial(item: Linha) {
  const op = operacaoDoEmbarque(item)

  if (op === 'Importação') {
    const origem = classificarRegiao(item.origem)
    if (origem !== 'Não classificada') return origem
  }

  if (op === 'Exportação') {
    const destino = classificarRegiao(item.destino)
    if (destino !== 'Não classificada') return destino
  }

  const destino = classificarRegiao(item.destino)
  if (destino !== 'Não classificada') return destino

  return classificarRegiao(item.origem)
}

function ehPago(item: Linha) {
  if (item.data_pagamento) return true
  const s = normalizar(`${item.situacao || ''} ${item.status_recebimento_fatura || ''}`)
  return s.includes('PAGO') || s.includes('QUITADO') || s.includes('BAIXADO')
}

function statusFatura(item: Linha) {
  if (ehPago(item)) return 'Paga'

  const contestacao = normalizar(item.status_contestacao)
  if (contestacao && !contestacao.includes('NAO') && !contestacao.includes('SEM')) return 'Contestada'

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

function faixaValor(valor: number) {
  if (valor < 500) return 'Até R$ 500'
  if (valor < 2000) return 'R$ 500 a R$ 2 mil'
  if (valor < 5000) return 'R$ 2 mil a R$ 5 mil'
  if (valor < 10000) return 'R$ 5 mil a R$ 10 mil'
  return 'Acima de R$ 10 mil'
}

function Card({
  titulo,
  valor,
  detalhe,
  icone,
}: {
  titulo: string
  valor: string | number
  detalhe?: string
  icone: string
}) {
  return (
    <div className="min-h-[132px] rounded-2xl border border-slate-800 bg-[#071225] p-5 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-slate-400">{titulo}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-white">{valor}</p>
          {detalhe ? <p className="mt-2 text-sm leading-snug text-slate-500">{detalhe}</p> : null}
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-2xl">
          {icone}
        </div>
      </div>
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
      <div className="h-3 overflow-hidden rounded-full bg-slate-900">
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
  const [cliente, setCliente] = useState('TODOS')
  const [servico, setServico] = useState('TODOS')
  const [operacao, setOperacao] = useState('TODAS')
  const [regiao, setRegiao] = useState('TODAS')
  const [faixa, setFaixa] = useState('TODAS')
  const [status, setStatus] = useState('TODOS')
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
      if (awb && !mapa.has(awb)) mapa.set(awb, item)
    })
    return mapa
  }, [embarques])

  const opcoes = useMemo(() => {
    const transportadoras = Array.from(
      new Set(
        [...embarques.map((x) => nomeTransportadora(x.transportadora)), ...faturas.map((x) => nomeTransportadora(x.transportadora))]
          .filter(Boolean)
      )
    ).sort()

    const anos = Array.from(
      new Set(
        [
          ...embarques.map((x) => anoDaData(dataEmbarque(x))),
          ...faturas.map((x) => anoDaData(dataFatura(x))),
          ...itensFaturas.map((x) => anoDaData(x.data_envio)),
        ].filter((x) => x > 2000)
      )
    ).sort((a, b) => b - a)

    const clientes = Array.from(
      new Set(
        embarques
          .map((x) => texto(x.cliente_final || x.importador || x.exportador))
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'))

    const servicos = Array.from(
      new Set(embarques.map((x) => texto(x.servico)).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'))

    const regioes = Array.from(
      new Set(embarques.map((x) => regiaoComercial(x)).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'))

    return { transportadoras, anos, clientes, servicos, regioes }
  }, [embarques, faturas, itensFaturas])

  const filtrosDeEmbarqueAtivos =
    cliente !== 'TODOS' ||
    servico !== 'TODOS' ||
    operacao !== 'TODAS' ||
    regiao !== 'TODAS'

  const embarquesFiltrados = useMemo(() => {
    return embarques.filter((item) => {
      if (
        transportadora !== 'TODAS' &&
        normalizar(nomeTransportadora(item.transportadora)) !== normalizar(transportadora)
      ) return false

      if (ano !== 'TODOS' && anoDaData(dataEmbarque(item)) !== Number(ano)) return false
      if (mes !== 'TODOS' && mesDaData(dataEmbarque(item)) !== Number(mes)) return false

      const nomeCliente = texto(item.cliente_final || item.importador || item.exportador)
      if (cliente !== 'TODOS' && normalizar(nomeCliente) !== normalizar(cliente)) return false

      if (servico !== 'TODOS' && normalizar(item.servico) !== normalizar(servico)) return false
      if (operacao !== 'TODAS' && operacaoDoEmbarque(item) !== operacao) return false
      if (regiao !== 'TODAS' && regiaoComercial(item) !== regiao) return false

      return true
    })
  }, [embarques, transportadora, ano, mes, cliente, servico, operacao, regiao])

  const awbsFiltrados = useMemo(
    () => new Set(embarquesFiltrados.map((x) => normalizarAwb(x.awb)).filter(Boolean)),
    [embarquesFiltrados]
  )

  const itensFiltrados = useMemo(() => {
    return itensFaturas.filter((item) => {
      if (
        transportadora !== 'TODAS' &&
        normalizar(nomeTransportadora(item.transportadora)) !== normalizar(transportadora)
      ) return false

      const awb = normalizarAwb(item.awb)
      const embarque = embarquesPorAwb.get(awb)

      if (filtrosDeEmbarqueAtivos && (!awb || !awbsFiltrados.has(awb))) return false

      const dataItem = item.data_envio || dataEmbarque(embarque || {})

      if (ano !== 'TODOS') {
        const anoItem = anoDaData(dataItem)
        if (anoItem !== Number(ano)) return false
      }

      if (mes !== 'TODOS' && mesDaData(dataItem) !== Number(mes)) return false

      return true
    })
  }, [
    itensFaturas,
    transportadora,
    ano,
    mes,
    filtrosDeEmbarqueAtivos,
    awbsFiltrados,
    embarquesPorAwb,
  ])

  const faturasIdsItensFiltrados = useMemo(
    () => new Set(itensFiltrados.map((x) => texto(x.fatura_transportadora_id)).filter(Boolean)),
    [itensFiltrados]
  )

  const faturasFiltradas = useMemo(() => {
    return faturas.filter((item) => {
      if (
        transportadora !== 'TODAS' &&
        normalizar(nomeTransportadora(item.transportadora)) !== normalizar(transportadora)
      ) return false

      if (ano !== 'TODOS' && anoDaData(dataFatura(item)) !== Number(ano)) return false
      if (mes !== 'TODOS' && mesDaData(dataFatura(item)) !== Number(mes)) return false
      if (status !== 'TODOS' && statusFatura(item) !== status) return false
      if (faixa !== 'TODAS' && faixaValor(numero(item.total)) !== faixa) return false

      if (filtrosDeEmbarqueAtivos && !faturasIdsItensFiltrados.has(texto(item.id))) return false

      return true
    })
  }, [
    faturas,
    transportadora,
    ano,
    mes,
    status,
    faixa,
    filtrosDeEmbarqueAtivos,
    faturasIdsItensFiltrados,
  ])

  const resumo = useMemo(() => {
    const pesoTotal = embarquesFiltrados.reduce(
      (acc, item) => acc + (numero(item.peso_taxado) || numero(item.peso_real)),
      0
    )

    const clientes = new Set(
      embarquesFiltrados
        .map((x) => texto(x.cliente_final || x.importador || x.exportador))
        .filter(Boolean)
    )

    const valorFaturas = faturasFiltradas.reduce((acc, item) => acc + numero(item.total), 0)
    const valorPago = faturasFiltradas.reduce((acc, item) => acc + valorPagoFatura(item), 0)
    const custoAwbs = itensFiltrados.reduce((acc, item) => acc + numero(item.valor_compra), 0)

    return {
      embarques: embarquesFiltrados.length,
      pesoTotal,
      clientes: clientes.size,
      faturas: faturasFiltradas.length,
      valorFaturas,
      valorPago,
      custoAwbs,
      ticketMedio: faturasFiltradas.length ? valorFaturas / faturasFiltradas.length : 0,
    }
  }, [embarquesFiltrados, faturasFiltradas, itensFiltrados])

  const porRegiao = useMemo(() => {
    const mapa = new Map<string, number>()
    embarquesFiltrados.forEach((item) => {
      const chave = regiaoComercial(item)
      mapa.set(chave, (mapa.get(chave) || 0) + 1)
    })
    return Array.from(mapa.entries())
      .map(([label, valor]) => ({ label, valor }))
      .sort((a, b) => b.valor - a.valor)
  }, [embarquesFiltrados])

  const porServico = useMemo(() => {
    const mapa = new Map<string, number>()
    embarquesFiltrados.forEach((item) => {
      const chave = texto(item.servico) || 'Não informado'
      mapa.set(chave, (mapa.get(chave) || 0) + 1)
    })
    return Array.from(mapa.entries())
      .map(([label, valor]) => ({ label, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8)
  }, [embarquesFiltrados])

  const evolucao = useMemo(() => {
    if (ano !== 'TODOS' && mes !== 'TODOS') {
      const totalDias = new Date(Number(ano), Number(mes), 0).getDate()

      return Array.from({ length: totalDias }, (_, index) => {
        const dia = index + 1
        const fatDia = faturasFiltradas.filter((x) => diaDaData(dataFatura(x)) === dia)

        return {
          label: String(dia).padStart(2, '0'),
          valor: fatDia.reduce((acc, x) => acc + numero(x.total), 0),
        }
      })
    }

    if (ano !== 'TODOS') {
      const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

      return nomesMeses.map((label, index) => {
        const numeroMes = index + 1
        const fatMes = faturasFiltradas.filter((x) => mesDaData(dataFatura(x)) === numeroMes)

        return {
          label,
          valor: fatMes.reduce((acc, x) => acc + numero(x.total), 0),
        }
      })
    }

    const mapa = new Map<number, number>()
    faturasFiltradas.forEach((item) => {
      const a = anoDaData(dataFatura(item))
      if (a) mapa.set(a, (mapa.get(a) || 0) + numero(item.total))
    })

    return Array.from(mapa.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([a, valor]) => ({ label: String(a), valor }))
  }, [faturasFiltradas, ano, mes])

  const topClientes = useMemo(() => {
    const mapa = new Map<string, { custo: number; embarques: Set<string> }>()

    itensFiltrados.forEach((item) => {
      const awb = normalizarAwb(item.awb)
      const emb = embarquesPorAwb.get(awb)
      const nome = texto(emb?.cliente_final || emb?.importador || emb?.exportador) || 'Não identificado'

      const atual = mapa.get(nome) || { custo: 0, embarques: new Set<string>() }
      atual.custo += numero(item.valor_compra)
      if (awb) atual.embarques.add(awb)
      mapa.set(nome, atual)
    })

    return Array.from(mapa.entries())
      .map(([nome, dados]) => ({
        nome,
        custo: dados.custo,
        embarques: dados.embarques.size,
      }))
      .sort((a, b) => b.custo - a.custo)
      .slice(0, 10)
  }, [itensFiltrados, embarquesPorAwb])

  const comparativo = useMemo(() => {
    const mapa = new Map<string, { embarques: Set<string>; custo: number; faturas: Set<string> }>()

    embarques.forEach((item) => {
      if (ano !== 'TODOS' && anoDaData(dataEmbarque(item)) !== Number(ano)) return false
      if (mes !== 'TODOS' && mesDaData(dataEmbarque(item)) !== Number(mes)) return false

      const nomeCliente = texto(item.cliente_final || item.importador || item.exportador)
      if (cliente !== 'TODOS' && normalizar(nomeCliente) !== normalizar(cliente)) return false
      if (servico !== 'TODOS' && normalizar(item.servico) !== normalizar(servico)) return false
      if (operacao !== 'TODAS' && operacaoDoEmbarque(item) !== operacao) return false
      if (regiao !== 'TODAS' && regiaoComercial(item) !== regiao) return false

      const t = nomeTransportadora(item.transportadora)
      const atual = mapa.get(t) || { embarques: new Set<string>(), custo: 0, faturas: new Set<string>() }
      const awb = normalizarAwb(item.awb)
      if (awb) atual.embarques.add(awb)
      mapa.set(t, atual)
    })

    itensFaturas.forEach((item) => {
      const emb = embarquesPorAwb.get(normalizarAwb(item.awb))
      const dataItem = item.data_envio || dataEmbarque(emb || {})

      if (ano !== 'TODOS' && anoDaData(dataItem) !== Number(ano)) return
      if (mes !== 'TODOS' && mesDaData(dataItem) !== Number(mes)) return

      if (cliente !== 'TODOS') {
        const nomeCliente = texto(emb?.cliente_final || emb?.importador || emb?.exportador)
        if (normalizar(nomeCliente) !== normalizar(cliente)) return
      }
      if (servico !== 'TODOS' && normalizar(emb?.servico) !== normalizar(servico)) return
      if (operacao !== 'TODAS' && operacaoDoEmbarque(emb || {}) !== operacao) return
      if (regiao !== 'TODAS' && regiaoComercial(emb || {}) !== regiao) return

      const t = nomeTransportadora(item.transportadora || emb?.transportadora)
      const atual = mapa.get(t) || { embarques: new Set<string>(), custo: 0, faturas: new Set<string>() }
      atual.custo += numero(item.valor_compra)
      const awb = normalizarAwb(item.awb)
      if (awb) atual.embarques.add(awb)
      const faturaId = texto(item.fatura_transportadora_id)
      if (faturaId) atual.faturas.add(faturaId)
      mapa.set(t, atual)
    })

    return Array.from(mapa.entries())
      .map(([nome, d]) => ({
        nome,
        embarques: d.embarques.size,
        custo: d.custo,
        faturas: d.faturas.size,
      }))
      .sort((a, b) => b.embarques - a.embarques)
  }, [embarques, itensFaturas, ano, mes, cliente, servico, operacao, regiao, embarquesPorAwb])

  const maxRegiao = Math.max(1, ...porRegiao.map((x) => x.valor))
  const maxServico = Math.max(1, ...porServico.map((x) => x.valor))
  const maxEvolucao = Math.max(1, ...evolucao.map((x) => x.valor))
  const maxCliente = Math.max(1, ...topClientes.map((x) => x.custo))
  const totalCustoComparativo = comparativo.reduce((acc, x) => acc + x.custo, 0)
  const nomeMesSelecionado = MESES.find((x) => x.valor === mes)?.label || ''

  const tituloEvolucao =
    ano !== 'TODOS' && mes !== 'TODOS'
      ? `Evolução diária das faturas — ${nomeMesSelecionado}/${ano}`
      : ano !== 'TODOS'
        ? `Evolução mensal das faturas — ${ano}`
        : mes !== 'TODOS'
          ? `Evolução anual das faturas — ${nomeMesSelecionado}`
          : 'Evolução anual das faturas'

  const faturasRecentes = [...faturasFiltradas]
    .sort((a, b) => dataISO(dataFatura(b)).localeCompare(dataISO(dataFatura(a))))
    .slice(0, modoApresentacao ? 6 : 12)

  function limparFiltros() {
    setTransportadora('TODAS')
    setAno(String(ANO_ATUAL))
    setMes('TODOS')
    setCliente('TODOS')
    setServico('TODOS')
    setOperacao('TODAS')
    setRegiao('TODAS')
    setFaixa('TODAS')
    setStatus('TODOS')
  }

  if (carregando) {
    return (
      <main className="min-h-screen bg-[#020817] p-6 text-white">
        <div className="rounded-3xl border border-blue-900 bg-[#071225] p-8">
          <p className="text-xl font-black">Carregando Análise de Transportadoras...</p>
          <p className="mt-2 text-sm text-slate-400">Embarques, faturas de transportadoras e custos por AWB.</p>
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

      <div className="w-full max-w-none space-y-6">
        <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-400">
              Intelligence
            </p>
            <h1 className="mt-1 text-4xl font-black tracking-tight 2xl:text-5xl">
              Análise de Transportadoras
            </h1>
            <p className="mt-2 max-w-4xl text-base leading-relaxed text-slate-400">
              Visão executiva de embarques, regiões, serviços, peso e faturas pagas às transportadoras.
              Não utiliza faturas emitidas contra clientes.
            </p>
          </div>

          <div className="no-print flex flex-wrap gap-2">
            <button
              onClick={() => setModoApresentacao((v) => !v)}
              className={`rounded-xl border px-5 py-3 text-sm font-black ${
                modoApresentacao
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                  : 'border-slate-700 bg-slate-900 text-slate-300'
              }`}
            >
              🎤 Modo apresentação {modoApresentacao ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white hover:bg-violet-500"
            >
              📄 Gerar PDF
            </button>
            <button
              onClick={() => carregar()}
              className="rounded-xl border border-blue-800 bg-blue-950/40 px-5 py-3 text-sm font-black text-blue-300"
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

        <section className="no-print rounded-2xl border border-slate-800 bg-[#071225] p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-9">
            <Filtro label="Transportadora" valor={transportadora} setValor={setTransportadora}>
              <option value="TODAS">Todas</option>
              {opcoes.transportadoras.map((x) => <option key={x}>{x}</option>)}
            </Filtro>

            <Filtro label="Ano" valor={ano} setValor={setAno}>
              <option value="TODOS">Todos</option>
              {opcoes.anos.map((x) => <option key={x} value={x}>{x}</option>)}
            </Filtro>

            <Filtro label="Mês" valor={mes} setValor={setMes}>
              <option value="TODOS">Todos</option>
              {MESES.map((x) => <option key={x.valor} value={x.valor}>{x.label}</option>)}
            </Filtro>

            <Filtro label="Cliente" valor={cliente} setValor={setCliente}>
              <option value="TODOS">Todos</option>
              {opcoes.clientes.map((x) => <option key={x}>{x}</option>)}
            </Filtro>

            <Filtro label="Serviço" valor={servico} setValor={setServico}>
              <option value="TODOS">Todos</option>
              {opcoes.servicos.map((x) => <option key={x}>{x}</option>)}
            </Filtro>

            <Filtro label="Operação" valor={operacao} setValor={setOperacao}>
              <option value="TODAS">Todas</option>
              <option>Importação</option>
              <option>Exportação</option>
              <option>Não informado</option>
            </Filtro>

            <Filtro label="Região comercial" valor={regiao} setValor={setRegiao}>
              <option value="TODAS">Todas</option>
              {opcoes.regioes.map((x) => <option key={x}>{x}</option>)}
            </Filtro>

            <Filtro label="Faixa da fatura" valor={faixa} setValor={setFaixa}>
              <option value="TODAS">Todas</option>
              <option>Até R$ 500</option>
              <option>R$ 500 a R$ 2 mil</option>
              <option>R$ 2 mil a R$ 5 mil</option>
              <option>R$ 5 mil a R$ 10 mil</option>
              <option>Acima de R$ 10 mil</option>
            </Filtro>

            <Filtro label="Status da fatura" valor={status} setValor={setStatus}>
              <option value="TODOS">Todos</option>
              <option>Paga</option>
              <option>Em aberto</option>
              <option>Vencida</option>
              <option>Contestada</option>
            </Filtro>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              onClick={limparFiltros}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-black text-slate-300 hover:bg-slate-800"
            >
              Limpar filtros
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <Card titulo="Total de embarques" valor={numeroBR(resumo.embarques)} detalhe="No período filtrado" icone="🚚" />
          <Card titulo="Valor das faturas" valor={moeda(resumo.valorFaturas)} detalhe="Cobrado pelas transportadoras" icone="🧾" />
          <Card titulo="Valor pago" valor={moeda(resumo.valorPago)} detalhe="Faturas identificadas como pagas" icone="💰" />
          <Card titulo="Nº de faturas" valor={numeroBR(resumo.faturas)} detalhe="Faturas de transportadoras" icone="📄" />
          <Card titulo="Ticket médio" valor={moeda(resumo.ticketMedio)} detalhe="Valor médio por fatura" icone="🎫" />
          <Card titulo="Peso movimentado" valor={`${numeroBR(resumo.pesoTotal, 1)} kg`} detalhe="Peso taxado; real como fallback" icone="⚖️" />
          <Card titulo="Clientes atendidos" valor={numeroBR(resumo.clientes)} detalhe="Clientes distintos" icone="👥" />
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Painel titulo="Embarques por região" subtitulo="Região comercial inferida pela origem/destino">
            <div className="space-y-4">
              {porRegiao.slice(0, 8).map((x, i) => (
                <BarraHorizontal key={x.label} label={x.label} valor={x.valor} maximo={maxRegiao} indice={i} />
              ))}
              {!porRegiao.length ? <Vazio /> : null}
            </div>
          </Painel>

          <Painel titulo="Distribuição por serviço" subtitulo="Top serviços no filtro atual">
            <div className="space-y-4">
              {porServico.map((x, i) => (
                <BarraHorizontal key={x.label} label={x.label} valor={x.valor} maximo={maxServico} indice={i + 1} />
              ))}
              {!porServico.length ? <Vazio /> : null}
            </div>
          </Painel>
        </section>

        <Painel titulo={tituloEvolucao} subtitulo="Valor total cobrado pelas transportadoras">
          <div className="overflow-x-auto pb-2">
            <div
              className={`flex h-[390px] items-end gap-3 pt-10 ${
                ano !== 'TODOS' && mes !== 'TODOS' ? 'min-w-[1450px]' : 'min-w-[920px]'
              }`}
            >
              {evolucao.map((x, i) => {
                const altura = x.valor
                  ? Math.max(22, Math.round((x.valor / maxEvolucao) * 280))
                  : 4

                return (
                  <div
                    key={`${x.label}-${i}`}
                    className="flex min-w-[42px] flex-1 flex-col items-center justify-end gap-3"
                    title={`${x.label}: ${moeda(x.valor)}`}
                  >
                    <span className="min-h-[20px] whitespace-nowrap text-xs font-black text-slate-200">
                      {x.valor ? moedaCompacta(x.valor) : ''}
                    </span>
                    <div
                      className="w-full max-w-[76px] rounded-t-xl shadow-lg transition-all"
                      style={{
                        height: `${altura}px`,
                        backgroundColor: CORES[i % CORES.length],
                        opacity: x.valor ? 1 : 0.18,
                      }}
                    />
                    <span className="text-sm font-black text-slate-300">{x.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </Painel>

        <Painel
          titulo="Top clientes por custo de transporte"
          subtitulo="Soma dos valores por AWB encontrados nas faturas das transportadoras"
        >
          <div className="space-y-4">
            {topClientes.map((x, i) => (
              <BarraHorizontal
                key={x.nome}
                label={`${i + 1}. ${modoApresentacao ? x.nome : x.nome}`}
                valor={x.custo}
                maximo={maxCliente}
                detalhe={`${moeda(x.custo)} • ${x.embarques} AWB(s)`}
                indice={i + 2}
              />
            ))}
            {!topClientes.length ? <Vazio texto="Ainda não há custos por AWB suficientes para este filtro." /> : null}
          </div>
        </Painel>

        <Painel titulo="Comparativo por transportadora" subtitulo="Mesmo período e filtros comerciais">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {comparativo.map((x, i) => {
              const participacao = totalCustoComparativo > 0 ? (x.custo / totalCustoComparativo) * 100 : 0
              const custoMedioAwb = x.embarques > 0 ? x.custo / x.embarques : 0

              return (
                <div
                  key={x.nome}
                  className="rounded-2xl border border-slate-700 bg-[#030b18] p-6 shadow-lg"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-2xl font-black text-white">{x.nome}</p>
                    <span
                      className="h-4 w-4 rounded-full"
                      style={{ backgroundColor: CORES[i % CORES.length] }}
                    />
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">Embarques</p>
                      <p className="mt-2 text-2xl font-black text-white">{numeroBR(x.embarques)}</p>
                    </div>

                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">Faturas vinculadas</p>
                      <p className="mt-2 text-2xl font-black text-white">{numeroBR(x.faturas)}</p>
                    </div>

                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">Valor identificado</p>
                      <p className="mt-2 text-xl font-black text-white">{moeda(x.custo)}</p>
                    </div>

                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">Custo médio / AWB</p>
                      <p className="mt-2 text-xl font-black text-white">{moeda(custoMedioAwb)}</p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="font-bold text-slate-400">Participação no valor identificado</span>
                      <span className="font-black text-white">{numeroBR(participacao, 1)}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-900">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(participacao > 0 ? 2 : 0, participacao)}%`,
                          backgroundColor: CORES[i % CORES.length],
                        }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
            {!comparativo.length ? <Vazio /> : null}
          </div>
        </Painel>

        <Painel titulo="Faturas das transportadoras" subtitulo="Últimas faturas dentro dos filtros selecionados">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500">
                    <th className="px-3 py-3">Transportadora</th>
                    <th className="px-3 py-3">Nº fatura</th>
                    <th className="px-3 py-3">Emissão</th>
                    <th className="px-3 py-3">Vencimento</th>
                    <th className="px-3 py-3">Valor</th>
                    <th className="px-3 py-3">Pago</th>
                    <th className="px-3 py-3">Situação</th>
                    <th className="px-3 py-3">Contestação</th>
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
                      <td className="px-3 py-3">
                        <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 font-bold">
                          {statusFatura(item)}
                        </span>
                      </td>
                      <td className="px-3 py-3">{texto(item.status_contestacao) || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!faturasRecentes.length ? <Vazio texto="Nenhuma fatura encontrada para os filtros atuais." /> : null}
            </div>
        </Painel>

        <footer className="flex flex-col justify-between gap-2 border-t border-slate-900 py-5 text-sm text-slate-500 sm:flex-row">
          <span>
            Dados: embarques + faturas_transportadoras + faturas_transportadoras_itens.
          </span>
          <span>
            Custos por cliente dependem do AWB estar identificado na fatura da transportadora.
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
      <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <select
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-[#030b18] px-4 py-3 text-sm font-bold text-white outline-none focus:border-blue-500"
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
    <section className="h-full rounded-2xl border border-slate-800 bg-[#071225] p-6 shadow-xl">
      <div className="mb-6">
        <h2 className="text-xl font-black text-white">{titulo}</h2>
        {subtitulo ? <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{subtitulo}</p> : null}
      </div>
      {children}
    </section>
  )
}

function Vazio({ texto: mensagem = 'Sem dados para os filtros selecionados.' }: { texto?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/30 p-6 text-center text-sm font-bold text-slate-500">
      {mensagem}
    </div>
  )
}
