'use client'

// HC_ANALISE_CLIENTES_UNIFICADA_V2

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

const LOTE_SUPABASE = 1000

type Periodo =
  | 'MES_ATUAL'
  | 'MES_ANTERIOR'
  | 'ULTIMOS_90'
  | 'ANO_ATUAL'
  | 'TODOS'
  | 'PERSONALIZADO'

type Linha = Record<string, any>

type Cliente360 = {
  key: string
  nome: string
  razaoSocial: string
  fantasia: string
  documento: string
  email: string
  telefone: string
  codigo: string
  login: string
  criadoEm: string | null
  chaves: Set<string>
  emails: Set<string>
  documentos: Set<string>
  codigos: Set<string>
  usuarios: Set<string>
  nomes: Set<string>
  awbs: Set<string>
  refs: Set<string>
}

type RankingPor =
  | 'PROFIT'
  | 'FATURADOS'
  | 'TICKET'
  | 'MENOR_PROFIT'
  | 'MENOR_TICKET'
  | 'ATRASADOS'

type ClienteRanking = {
  clienteKey: string
  nome: string
  processosFaturados: number
  comProfitHC: number
  aguardandoCusto: number
  pagos: number
  emAberto: number
  atrasados: number
  profitTotal: number
  ticketMedioProfit: number
  valorFaturadoTotal: number
  custoTotal: number
  ultimoRegistro: Date | null
  ultimoAwb: string
  transportadoras: string[]
  faturas: string[]
  awbs: string[]
}

type SerieMensal = {
  chave: string
  rotulo: string
  faturamento: number
  custo: number
  profit: number
  embarques: number
  cotacoes: number
  convertidas: number
}

const STATUS_COTACAO_APROVADA = ['APROVADA', 'APROVADO', 'ACEITA', 'ACEITO']
const STATUS_COTACAO_PERDIDA = ['PERDIDA', 'PERDIDO', 'RECUSADA', 'RECUSADO']
const STATUS_COTACAO_CONVERTIDA = ['CONVERTIDA EM EMBARQUE', 'CONVERTIDA', 'CONVERTIDO']

function texto(v: any) {
  return String(v ?? '').trim()
}

function normalizar(v: any) {
  return texto(v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function soAlfaNum(v: any) {
  return texto(v).toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function soDigitos(v: any) {
  return texto(v).replace(/\D/g, '')
}

function numero(v: any) {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const s = String(v).trim().replace(/[R$\s]/gi, '')
  if (!s) return 0
  const n = s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s)
  return Number.isFinite(n) ? n : 0
}

function moeda(v: any) {
  return numero(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataValida(v: any): Date | null {
  if (!v) return null
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v
  if (typeof v === 'number') {
    const d = new Date((v - 25569) * 86400 * 1000)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const s = texto(v)
  if (!s || s === '-') return null
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    const [d, m, y] = s.slice(0, 10).split('/')
    const dt = new Date(`${y}-${m}-${d}T12:00:00`)
    return Number.isNaN(dt.getTime()) ? null : dt
  }
  const dt = new Date(s)
  return Number.isNaN(dt.getTime()) ? null : dt
}

function dataBR(v: any) {
  const d = dataValida(v)
  return d ? d.toLocaleDateString('pt-BR') : '-'
}

function diasEntre(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / 86400000)
}

function primeiro(...valores: any[]) {
  for (const v of valores) if (texto(v)) return texto(v)
  return ''
}

function dataLinha(l: Linha) {
  return (
    dataValida(l.data_entrega) ||
    dataValida(l.data_envio) ||
    dataValida(l.data_coleta) ||
    dataValida(l.data_emissao) ||
    dataValida(l.data) ||
    dataValida(l.criado_em) ||
    dataValida(l.created_at) ||
    dataValida(l.atualizado_em) ||
    dataValida(l.updated_at)
  )
}

function awbsLinha(l: Linha) {
  return [
    l.awb,
    l.numero_awb,
    l.hawb,
    l.h_awb,
    l.awb_original,
    l.numero_embarque,
    l.tracking_number,
    l.tracking,
    l.codigo_rastreio,
  ]
    .map(soAlfaNum)
    .filter(Boolean)
}

function awbLinha(l: Linha) {
  return awbsLinha(l)[0] || ''
}

function refHcLinha(l: Linha) {
  return primeiro(l.referencia_hc, l.ref_hc, l.codigo_hc)
}

function refClienteLinha(l: Linha) {
  return primeiro(l.referencia_cliente, l.ref_cliente, l.referencia)
}

function clienteNomeLinha(l: Linha) {
  return primeiro(
    l.cliente,
    l.cliente_final,
    l.cliente_nome,
    l.nome_cliente,
    l.importador,
    l.tomador,
    l.pagador,
    l.empresa,
    l.razao_social,
    l.nome_fantasia
  )
}

function emailLinha(l: Linha) {
  return primeiro(l.email, l.cliente_email, l.email_cliente, l.login)
}

function documentoLinha(l: Linha) {
  return primeiro(l.cnpj_cpf, l.cnpj, l.cpf, l.documento)
}

function codigoClienteLinha(l: Linha) {
  return primeiro(l.codigo_cliente, l.cliente_codigo, l.codigo)
}

function usuarioLinha(l: Linha) {
  return primeiro(l.usuario_id, l.user_id, l.perfil_id, l.login_id)
}

function clienteIdLinha(l: Linha) {
  return primeiro(l.cliente_id, l.empresa_id, l.cliente_faturamento_id)
}

function embarqueIdLinha(l: Linha) {
  return primeiro(l.embarque_id, l.id_embarque)
}

function financeiroIdLinha(l: Linha) {
  return primeiro(l.financeiro_embarque_id, l.financeiro_id, l.id_financeiro)
}

function statusLinha(l: Linha) {
  return primeiro(l.status_operacional, l.status, l.situacao)
}

function transportadoraLinha(l: Linha) {
  return primeiro(l.transportadora, l.carrier)
}

function servicoLinha(l: Linha) {
  return primeiro(l.servico, l.tipo_servico, l.modalidade, l.tipo_operacao, l.operacao)
}

function valorFaturado(l: Linha) {
  return numero(
    primeiro(
      l.valor_faturado,
      l.valor_cobranca,
      l.valor_venda,
      l.valor_total,
      l.valor,
      l.total
    )
  )
}

function valorCusto(l: Linha) {
  return numero(primeiro(l.valor_compra, l.custo, l.valor_custo))
}

function valorDta(l: Linha) {
  return numero(primeiro(l.doc_dta, l.valor_dta, l.dta))
}

function valorDebitoTerceiro(l: Linha) {
  return numero(primeiro(l.debito_terceiro, l.valor_debito_terceiro))
}

/*
  Regra do diagnóstico da tela de performance:
  Profit HC = faturado - compra - DTA - débito de terceiro.
  Se o registro já possuir profit_hc/profit/lucro, o valor persistido tem prioridade.
*/
function profitHC(l: Linha) {
  const persistido = primeiro(l.profit_hc, l.profit, l.lucro_hc, l.lucro)
  if (persistido !== '') return numero(persistido)
  return valorFaturado(l) - valorCusto(l) - valorDta(l) - valorDebitoTerceiro(l)
}

function pesoLinha(l: Linha) {
  return numero(primeiro(l.peso_taxado, l.peso_cobrado, l.peso, l.peso_real))
}

function statusFinanceiro(l: Linha) {
  return normalizar(primeiro(l.status_financeiro, l.status_pagamento, l.status))
}

function pagoLinha(l: Linha) {
  const s = statusFinanceiro(l)
  return (
    ['pago', 'paga', 'recebido', 'recebida', 'quitado', 'quitada'].includes(s) ||
    Boolean(l.data_recebimento || l.recebido_em || l.pago_em || l.data_pagamento)
  )
}

function vencimentoLinha(l: Linha) {
  return (
    dataValida(l.vencimento_cobranca) ||
    dataValida(l.vencimento) ||
    dataValida(l.data_vencimento)
  )
}

function recebimentoLinha(l: Linha) {
  return primeiro(l.data_recebimento, l.recebido_em, l.pago_em, l.data_pagamento)
}

function numeroFaturaLinha(l: Linha) {
  return primeiro(l.numero_fatura, l.fatura, l.numero, l.invoice)
}

function dentroPeriodo(d: Date | null, periodo: Periodo, ini: string, fim: string) {
  if (periodo === 'TODOS') return true
  if (!d) return false

  const agora = new Date()
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())

  if (periodo === 'MES_ATUAL') {
    return d >= new Date(agora.getFullYear(), agora.getMonth(), 1)
  }

  if (periodo === 'MES_ANTERIOR') {
    const a = new Date(agora.getFullYear(), agora.getMonth() - 1, 1)
    const b = new Date(agora.getFullYear(), agora.getMonth(), 1)
    return d >= a && d < b
  }

  if (periodo === 'ULTIMOS_90') {
    const a = new Date(inicioHoje)
    a.setDate(a.getDate() - 89)
    return d >= a
  }

  if (periodo === 'ANO_ATUAL') {
    return d >= new Date(agora.getFullYear(), 0, 1)
  }

  if (periodo === 'PERSONALIZADO') {
    const a = ini ? new Date(`${ini}T00:00:00`) : null
    const b = fim ? new Date(`${fim}T23:59:59`) : null
    if (a && d < a) return false
    if (b && d > b) return false
    return true
  }

  return true
}

async function carregarTabela(tabela: string) {
  const { count, error: countError } = await supabase
    .from(tabela)
    .select('*', { count: 'exact', head: true })

  if (countError) {
    console.warn(`[Análise de Clientes] ${tabela}:`, countError.message)
    return [] as Linha[]
  }

  const total = count || 0
  if (!total) return [] as Linha[]

  const paginas = Math.ceil(total / LOTE_SUPABASE)
  const respostas = await Promise.all(
    Array.from({ length: paginas }, (_, i) =>
      supabase
        .from(tabela)
        .select('*')
        .range(i * LOTE_SUPABASE, i * LOTE_SUPABASE + LOTE_SUPABASE - 1)
    )
  )

  const erro = respostas.find((r) => r.error)?.error
  if (erro) console.warn(`[Análise de Clientes] ${tabela}:`, erro.message)

  return respostas.flatMap((r) => (r.data || []) as Linha[])
}

function chaveForte(tipo: string, valor: any) {
  const v = tipo === 'doc' ? soDigitos(valor) : tipo === 'awb' ? soAlfaNum(valor) : normalizar(valor)
  return v ? `${tipo}:${v}` : ''
}

function adicionarChavesCliente(c: Cliente360, l: Linha) {
  const id = clienteIdLinha(l)
  const usuario = usuarioLinha(l)
  const doc = documentoLinha(l)
  const email = emailLinha(l)
  const codigo = codigoClienteLinha(l)
  const nome = clienteNomeLinha(l)
  const awb = awbLinha(l)
  const ref = refHcLinha(l)

  const pares: [string, any][] = [
    ['id', id],
    ['usuario', usuario],
    ['doc', doc],
    ['email', email],
    ['codigo', codigo],
    ['nome', nome],
    ['awb', awb],
    ['ref', ref],
  ]

  pares.forEach(([t, v]) => {
    const k = chaveForte(t, v)
    if (k) c.chaves.add(k)
  })

  if (usuario) c.usuarios.add(normalizar(usuario))
  if (doc) c.documentos.add(soDigitos(doc))
  if (email) c.emails.add(normalizar(email))
  if (codigo) c.codigos.add(normalizar(codigo))
  if (nome) c.nomes.add(normalizar(nome))
  if (awb) c.awbs.add(soAlfaNum(awb))
  if (ref) c.refs.add(normalizar(ref))
}

function linhaPertenceCliente(l: Linha, c: Cliente360, embarquesDoCliente: Set<string>) {
  const id = chaveForte('id', clienteIdLinha(l))
  const usuario = chaveForte('usuario', usuarioLinha(l))
  const doc = chaveForte('doc', documentoLinha(l))
  const email = chaveForte('email', emailLinha(l))
  const codigo = chaveForte('codigo', codigoClienteLinha(l))
  const awb = chaveForte('awb', awbLinha(l))
  const ref = chaveForte('ref', refHcLinha(l))
  const embId = texto(embarqueIdLinha(l))

  if (id && c.chaves.has(id)) return true
  if (embId && embarquesDoCliente.has(embId)) return true
  if (usuario && c.chaves.has(usuario)) return true
  if (doc && c.chaves.has(doc)) return true
  if (codigo && c.chaves.has(codigo)) return true
  if (email && c.chaves.has(email)) return true
  if (awb && c.chaves.has(awb)) return true
  if (ref && c.chaves.has(ref)) return true

  const nome = normalizar(clienteNomeLinha(l))
  return Boolean(nome && c.nomes.has(nome))
}

function mesChave(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function mesRotulo(chave: string) {
  const [a, m] = chave.split('-').map(Number)
  return new Date(a, m - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
    .replace('.', '')
}

function percent(atual: number, anterior: number) {
  if (!anterior) return atual ? 100 : 0
  return ((atual - anterior) / Math.abs(anterior)) * 100
}

export default function Clientes360Page() {
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [dados, setDados] = useState<Record<string, Linha[]>>({
    embarques: [],
    financeiro: [],
    cotacoes: [],
    faturas: [],
    clientes: [],
    perfis: [],
    suporte: [],
  })

  const [busca, setBusca] = useState('')
  const [clienteKey, setClienteKey] = useState('')
  const [periodo, setPeriodo] = useState<Periodo>('ANO_ATUAL')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [transportadora, setTransportadora] = useState('')
  const [servico, setServico] = useState('')
  const [aba, setAba] = useState<'EMBARQUES' | 'COTACOES' | 'FINANCEIRO' | 'TIMELINE'>('EMBARQUES')
  const [verMais, setVerMais] = useState(false)
  const [rankingPor, setRankingPor] = useState<RankingPor>('PROFIT')
  const [somenteComMovimento, setSomenteComMovimento] = useState(true)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setLoading(true)
    setErro('')

    try {
      const [
        embarques,
        financeiro,
        cotacoes,
        faturas,
        clientes,
        perfis,
        suporte,
      ] = await Promise.all([
        carregarTabela('embarques'),
        carregarTabela('financeiro_embarques'),
        carregarTabela('cotacoes'),
        carregarTabela('faturas'),
        carregarTabela('clientes_faturamento'),
        carregarTabela('perfis'),
        carregarTabela('suporte'),
      ])

      setDados({
        embarques,
        financeiro,
        cotacoes,
        faturas,
        clientes,
        perfis,
        suporte,
      })
    } catch (e: any) {
      setErro(e?.message || 'Erro ao carregar Análise de Clientes.')
    } finally {
      setLoading(false)
    }
  }

  const clientes = useMemo(() => {
    const mapa = new Map<string, Cliente360>()
    const embarquesPorId = new Map<string, Linha>()
    const embarquesPorAwb = new Map<string, Linha>()

    dados.embarques.forEach((embarque) => {
      if (embarque.id) embarquesPorId.set(String(embarque.id), embarque)

      awbsLinha(embarque).forEach((awb) => {
        if (!embarquesPorAwb.has(awb)) embarquesPorAwb.set(awb, embarque)
      })
    })

    function embarqueDoFinanceiro(financeiro: Linha) {
      const embarqueId = texto(embarqueIdLinha(financeiro))

      if (embarqueId && embarquesPorId.has(embarqueId)) {
        return embarquesPorId.get(embarqueId) || null
      }

      for (const awb of awbsLinha(financeiro)) {
        if (embarquesPorAwb.has(awb)) return embarquesPorAwb.get(awb) || null
      }

      return null
    }

    dados.financeiro.forEach((financeiro, index) => {
      const embarque = embarqueDoFinanceiro(financeiro)

      // Mesma prioridade usada pela lógica financeira/ranking:
      // cliente -> cliente_final -> importador -> tomador -> pagador.
      // Se o financeiro antigo não tiver nome, recupera pelo embarque vinculado.
      const nome = primeiro(
        financeiro.cliente,
        financeiro.cliente_final,
        financeiro.importador,
        financeiro.tomador,
        financeiro.pagador,
        embarque?.cliente,
        embarque?.cliente_final,
        embarque?.importador,
        embarque?.tomador,
        embarque?.pagador,
        embarque?.razao_social,
        embarque?.nome_fantasia
      )

      if (!nome || normalizar(nome) === 'cliente nao identificado') return

      // Agrupamento por nome exato normalizado, como a página de Ranking de Clientes.
      // Isso também preserva registros históricos que não possuem IDs modernos.
      const key = `financeiro:${normalizar(nome)}`

      const doc = primeiro(documentoLinha(financeiro), documentoLinha(embarque || {}))
      const email = primeiro(emailLinha(financeiro), emailLinha(embarque || {}))
      const codigo = primeiro(codigoClienteLinha(financeiro), codigoClienteLinha(embarque || {}))
      const usuario = primeiro(usuarioLinha(financeiro), usuarioLinha(embarque || {}))
      const id = primeiro(clienteIdLinha(financeiro), clienteIdLinha(embarque || {}))

      if (!mapa.has(key)) {
        mapa.set(key, {
          key,
          nome,
          razaoSocial: primeiro(
            financeiro.razao_social,
            embarque?.razao_social,
            nome
          ),
          fantasia: primeiro(
            financeiro.nome_fantasia,
            embarque?.nome_fantasia,
            nome
          ),
          documento: doc,
          email,
          telefone: primeiro(
            financeiro.telefone,
            financeiro.celular,
            financeiro.whatsapp,
            embarque?.telefone,
            embarque?.celular,
            embarque?.whatsapp
          ),
          codigo,
          login: primeiro(
            financeiro.login,
            financeiro.usuario_email,
            embarque?.login,
            embarque?.usuario_email,
            email
          ),
          criadoEm: primeiro(
            financeiro.criado_em,
            financeiro.created_at,
            embarque?.criado_em,
            embarque?.created_at
          ) || null,
          chaves: new Set<string>(),
          emails: new Set<string>(),
          documentos: new Set<string>(),
          codigos: new Set<string>(),
          usuarios: new Set<string>(),
          nomes: new Set<string>(),
          awbs: new Set<string>(),
          refs: new Set<string>(),
        })
      }

      const cliente = mapa.get(key)!

      // O nome financeiro é a identidade histórica principal.
      cliente.nomes.add(normalizar(nome))
      cliente.chaves.add(chaveForte('nome', nome))

      if (id) cliente.chaves.add(chaveForte('id', id))
      if (usuario) {
        cliente.usuarios.add(normalizar(usuario))
        cliente.chaves.add(chaveForte('usuario', usuario))
      }
      if (doc) {
        cliente.documentos.add(soDigitos(doc))
        cliente.chaves.add(chaveForte('doc', doc))
      }
      if (email) {
        cliente.emails.add(normalizar(email))
        cliente.chaves.add(chaveForte('email', email))
      }
      if (codigo) {
        cliente.codigos.add(normalizar(codigo))
        cliente.chaves.add(chaveForte('codigo', codigo))
      }

      adicionarChavesCliente(cliente, financeiro)
      if (embarque) adicionarChavesCliente(cliente, embarque)

      // Garante que todos os AWBs do registro financeiro e do embarque
      // participem da pesquisa e dos vínculos posteriores.
      ;[...awbsLinha(financeiro), ...awbsLinha(embarque || {})].forEach((awb) => {
        cliente.awbs.add(awb)
        cliente.chaves.add(chaveForte('awb', awb))
      })
    })

    // Cadastro e perfil NÃO criam clientes na lista.
    // Servem somente para completar dados de empresas já encontradas no financeiro.
    const fontesCadastro = [...dados.clientes, ...dados.perfis]

    for (const cliente of mapa.values()) {
      fontesCadastro.forEach((cadastro) => {
        const nome = normalizar(clienteNomeLinha(cadastro))
        const doc = soDigitos(documentoLinha(cadastro))
        const email = normalizar(emailLinha(cadastro))
        const codigo = normalizar(codigoClienteLinha(cadastro))
        const usuario = normalizar(usuarioLinha(cadastro))

        const corresponde =
          (doc && cliente.documentos.has(doc)) ||
          (email && cliente.emails.has(email)) ||
          (codigo && cliente.codigos.has(codigo)) ||
          (usuario && cliente.usuarios.has(usuario)) ||
          (nome && cliente.nomes.has(nome))

        if (!corresponde) return

        adicionarChavesCliente(cliente, cadastro)

        if (!cliente.documento) cliente.documento = documentoLinha(cadastro)
        if (!cliente.email) cliente.email = emailLinha(cadastro)
        if (!cliente.telefone) {
          cliente.telefone = primeiro(cadastro.telefone, cadastro.celular, cadastro.whatsapp)
        }
        if (!cliente.codigo) cliente.codigo = codigoClienteLinha(cadastro)
        if (!cliente.login) {
          cliente.login = primeiro(cadastro.login, cadastro.usuario_email, cadastro.email)
        }
        if (!cliente.razaoSocial) {
          cliente.razaoSocial = primeiro(cadastro.razao_social, cadastro.empresa, cliente.nome)
        }
        if (!cliente.fantasia) {
          cliente.fantasia = primeiro(cadastro.nome_fantasia, cadastro.fantasia, cadastro.nome)
        }
        if (!cliente.criadoEm) {
          cliente.criadoEm = primeiro(cadastro.criado_em, cadastro.created_at) || null
        }
      })
    }

    return Array.from(mapa.values())
      .filter((cliente) => cliente.nome)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [dados])


  const ranking = useMemo(() => {
    const mapaClientes = new Map(clientes.map((c) => [c.key, c]))
    const acumulado = new Map<string, ClienteRanking>()
    const agora = new Date()

    function registro(clienteKey: string, nome: string) {
      if (!acumulado.has(clienteKey)) {
        acumulado.set(clienteKey, {
          clienteKey,
          nome,
          processosFaturados: 0,
          comProfitHC: 0,
          aguardandoCusto: 0,
          pagos: 0,
          emAberto: 0,
          atrasados: 0,
          profitTotal: 0,
          ticketMedioProfit: 0,
          valorFaturadoTotal: 0,
          custoTotal: 0,
          ultimoRegistro: null,
          ultimoAwb: '-',
          transportadoras: [],
          faturas: [],
          awbs: [],
        })
      }

      return acumulado.get(clienteKey)!
    }

    dados.financeiro.forEach((financeiro) => {
      const nome = clienteNomeLinha(financeiro)
      if (!nome || normalizar(nome) === 'cliente nao identificado') return

      const clienteKeyFinanceiro = `financeiro:${normalizar(nome)}`
      const clienteEncontrado =
        mapaClientes.get(clienteKeyFinanceiro) ||
        clientes.find((c) => c.nomes.has(normalizar(nome)))

      if (!clienteEncontrado) return

      const dataReferencia =
        vencimentoLinha(financeiro) ||
        dataValida(recebimentoLinha(financeiro)) ||
        dataLinha(financeiro)

      if (!dentroPeriodo(dataReferencia, periodo, dataInicio, dataFim)) return

      const item = registro(clienteEncontrado.key, clienteEncontrado.nome)
      const faturado = valorFaturado(financeiro)
      const custoCompra = valorCusto(financeiro)
      const custoTotal = custoCompra + valorDta(financeiro) + valorDebitoTerceiro(financeiro)
      const temCusto = custoCompra > 0

      item.processosFaturados += 1
      item.valorFaturadoTotal += faturado

      if (temCusto) {
        item.comProfitHC += 1
        item.profitTotal += profitHC(financeiro)
        item.custoTotal += custoTotal
      } else {
        item.aguardandoCusto += 1
      }

      if (pagoLinha(financeiro)) {
        item.pagos += 1
      } else {
        const vencimento = vencimentoLinha(financeiro)
        if (vencimento && vencimento < agora) item.atrasados += 1
        else item.emAberto += 1
      }

      const awb = awbLinha(financeiro)
      const fatura = numeroFaturaLinha(financeiro)
      const transportadora = transportadoraLinha(financeiro)

      if (awb) item.awbs.push(awb)
      if (fatura) item.faturas.push(fatura)
      if (transportadora) item.transportadoras.push(transportadora)

      if (dataReferencia && (!item.ultimoRegistro || dataReferencia > item.ultimoRegistro)) {
        item.ultimoRegistro = dataReferencia
        item.ultimoAwb = awb || '-'
      }
    })

    let lista = Array.from(acumulado.values()).map((item) => ({
      ...item,
      awbs: Array.from(new Set(item.awbs)),
      faturas: Array.from(new Set(item.faturas)),
      transportadoras: Array.from(new Set(item.transportadoras)),
      ticketMedioProfit: item.comProfitHC > 0 ? item.profitTotal / item.comProfitHC : 0,
    }))

    if (somenteComMovimento) {
      lista = lista.filter((item) => item.processosFaturados > 0)
    }

    const q = normalizar(busca)
    const qa = soAlfaNum(busca)
    const qd = soDigitos(busca)

    if (q) {
      lista = lista.filter((item) => {
        const clienteRanking = mapaClientes.get(item.clienteKey)
        const campos = [
          item.nome,
          clienteRanking?.razaoSocial,
          clienteRanking?.fantasia,
          clienteRanking?.documento,
          clienteRanking?.email,
          clienteRanking?.codigo,
          ...item.awbs,
          ...item.faturas,
          ...item.transportadoras,
        ].filter(Boolean)

        return campos.some((valor) => {
          const n = normalizar(valor)
          const a = soAlfaNum(valor)
          const d = soDigitos(valor)
          return n.includes(q) || Boolean(qa && a.includes(qa)) || Boolean(qd && d.includes(qd))
        })
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
  }, [
    busca,
    clientes,
    dados.financeiro,
    dataFim,
    dataInicio,
    periodo,
    rankingPor,
    somenteComMovimento,
  ])

  const resumoRanking = useMemo(() => {
    const processos = ranking.reduce((acc, item) => acc + item.processosFaturados, 0)
    const comProfit = ranking.reduce((acc, item) => acc + item.comProfitHC, 0)
    const profit = ranking.reduce((acc, item) => acc + item.profitTotal, 0)
    const faturamento = ranking.reduce((acc, item) => acc + item.valorFaturadoTotal, 0)
    const custo = ranking.reduce((acc, item) => acc + item.custoTotal, 0)
    const pagos = ranking.reduce((acc, item) => acc + item.pagos, 0)
    const emAberto = ranking.reduce((acc, item) => acc + item.emAberto, 0)
    const atrasados = ranking.reduce((acc, item) => acc + item.atrasados, 0)
    const aguardandoCusto = ranking.reduce((acc, item) => acc + item.aguardandoCusto, 0)
    const comTicket = ranking.filter((item) => item.comProfitHC > 0)

    return {
      clientes: ranking.length,
      processos,
      profit,
      faturamento,
      custo,
      pagos,
      emAberto,
      atrasados,
      aguardandoCusto,
      ticket: comProfit > 0 ? profit / comProfit : 0,
      topProfit: [...ranking].sort((a, b) => b.profitTotal - a.profitTotal)[0] || null,
      topProcessos: [...ranking].sort((a, b) => b.processosFaturados - a.processosFaturados)[0] || null,
      topTicket: [...comTicket].sort((a, b) => b.ticketMedioProfit - a.ticketMedioProfit)[0] || null,
      menorProfit: [...ranking]
        .filter((item) => item.processosFaturados > 0)
        .sort((a, b) => a.profitTotal - b.profitTotal)[0] || null,
    }
  }, [ranking])

  function exportarRankingCSV() {
    const linhas = [
      [
        'Ranking',
        'Cliente',
        'Processos faturados',
        'Profit HC',
        'Ticket medio Profit',
        'Faturamento',
        'Custos considerados',
        'Aguardando custo',
        'Pagos',
        'Em aberto',
        'Atrasados',
        'Ultimo AWB',
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
        item.aguardandoCusto,
        item.pagos,
        item.emAberto,
        item.atrasados,
        item.ultimoAwb,
        dataBR(item.ultimoRegistro),
      ]),
    ]

    const csv = linhas
      .map((linha) =>
        linha
          .map((campo) => `"${String(campo ?? '').replaceAll('"', '""')}"`)
          .join(';')
      )
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `analise-clientes-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function selecionarClienteDoRanking(item: ClienteRanking) {
    setClienteKey(item.clienteKey)
    setBusca(item.nome)
    setVerMais(false)
    setAba('EMBARQUES')
  }

  function voltarAnaliseGeral() {
    setClienteKey('')
    setBusca('')
    setTransportadora('')
    setServico('')
    setVerMais(false)
  }

  const clientesFiltradosBusca = useMemo(() => {
    const q = normalizar(busca)
    const qa = soAlfaNum(busca)
    const qd = soDigitos(busca)

    if (!q) return clientes.slice(0, 30)

    return clientes
      .filter((c) => {
        const hay = [
          c.nome,
          c.razaoSocial,
          c.fantasia,
          c.documento,
          c.email,
          c.codigo,
          c.login,
          ...Array.from(c.refs),
          ...Array.from(c.awbs),
        ]

        return hay.some((v) => {
          const n = normalizar(v)
          const a = soAlfaNum(v)
          const d = soDigitos(v)
          return n.includes(q) || (qa && a.includes(qa)) || (qd && d.includes(qd))
        })
      })
      .slice(0, 40)
  }, [busca, clientes])

  const cliente = useMemo(
    () => clientes.find((c) => c.key === clienteKey) || null,
    [clientes, clienteKey]
  )

  const conjunto = useMemo(() => {
    if (!cliente) {
      return {
        embarques: [] as Linha[],
        financeiro: [] as Linha[],
        cotacoes: [] as Linha[],
        faturas: [] as Linha[],
        suporte: [] as Linha[],
      }
    }

    // 1. O financeiro é a base histórica mais estável da análise.
    const financeiroDireto = dados.financeiro.filter((financeiro) =>
      linhaPertenceCliente(financeiro, cliente, new Set())
    )

    const financeiroIdsDiretos = new Set(
      financeiroDireto.map((financeiro) => texto(financeiro.id)).filter(Boolean)
    )
    const embarqueIdsFinanceiro = new Set(
      financeiroDireto
        .map((financeiro) => texto(embarqueIdLinha(financeiro)))
        .filter(Boolean)
    )
    const awbsFinanceiro = new Set(
      financeiroDireto.flatMap((financeiro) => awbsLinha(financeiro))
    )
    const refsFinanceiro = new Set(
      financeiroDireto.map((financeiro) => normalizar(refHcLinha(financeiro))).filter(Boolean)
    )

    // 2. Localiza embarques atuais pelo ID estável, AWB ou pelas chaves fortes do cliente.
    const embarquesCliente = dados.embarques.filter((embarque) => {
      const id = texto(embarque.id)
      if (id && embarqueIdsFinanceiro.has(id)) return true
      if (awbsLinha(embarque).some((awb) => awbsFinanceiro.has(awb))) return true
      return linhaPertenceCliente(embarque, cliente, embarqueIdsFinanceiro)
    })

    const embarqueIdsLocalizados = new Set(
      embarquesCliente.map((embarque) => texto(embarque.id)).filter(Boolean)
    )
    const embarqueIdsRelacionados = new Set([
      ...Array.from(embarqueIdsFinanceiro),
      ...Array.from(embarqueIdsLocalizados),
    ])

    // 3. Repassa os vínculos localizados ao financeiro para recuperar históricos
    // cujo nome/cadastro já não esteja preenchido no mesmo formato.
    const financeiroCliente = dados.financeiro.filter((financeiro) => {
      if (financeiroIdsDiretos.has(texto(financeiro.id))) return true
      if (linhaPertenceCliente(financeiro, cliente, embarqueIdsRelacionados)) return true
      return awbsLinha(financeiro).some((awb) => awbsFinanceiro.has(awb))
    })

    const financeiroIdsCliente = new Set(
      financeiroCliente.map((financeiro) => texto(financeiro.id)).filter(Boolean)
    )
    const awbsCliente = new Set([
      ...Array.from(awbsFinanceiro),
      ...financeiroCliente.flatMap((financeiro) => awbsLinha(financeiro)),
      ...embarquesCliente.flatMap((embarque) => awbsLinha(embarque)),
    ])
    const refsCliente = new Set([
      ...Array.from(refsFinanceiro),
      ...financeiroCliente.map((financeiro) => normalizar(refHcLinha(financeiro))).filter(Boolean),
      ...embarquesCliente.map((embarque) => normalizar(refHcLinha(embarque))).filter(Boolean),
    ])

    // 4. Cotações/faturas/suporte podem sobreviver mesmo quando o embarque original
    // foi excluído. Por isso, além das chaves do cliente, aceitamos vínculos estáveis
    // por embarque_id, financeiro_embarque_id, AWB e referência HC.
    const filtraRelacionado = (arr: Linha[]) =>
      arr.filter((linha) => {
        if (linhaPertenceCliente(linha, cliente, embarqueIdsRelacionados)) return true

        const embarqueId = texto(embarqueIdLinha(linha))
        if (embarqueId && embarqueIdsRelacionados.has(embarqueId)) return true

        const financeiroId = texto(financeiroIdLinha(linha))
        if (financeiroId && financeiroIdsCliente.has(financeiroId)) return true

        if (awbsLinha(linha).some((awb) => awbsCliente.has(awb))) return true

        const refHc = normalizar(refHcLinha(linha))
        if (refHc && refsCliente.has(refHc)) return true

        return false
      })

    return {
      embarques: embarquesCliente,
      financeiro: financeiroCliente,
      cotacoes: filtraRelacionado(dados.cotacoes),
      faturas: filtraRelacionado(dados.faturas),
      suporte: filtraRelacionado(dados.suporte),
    }
  }, [cliente, dados])

  const opcoesFiltro = useMemo(() => {
    const base = [...conjunto.financeiro, ...conjunto.embarques]
    const t = Array.from(new Set(base.map(transportadoraLinha).filter(Boolean))).sort()
    const s = Array.from(new Set(base.map(servicoLinha).filter(Boolean))).sort()
    return { transportadoras: t, servicos: s }
  }, [conjunto.financeiro, conjunto.embarques])

  const filtrado = useMemo(() => {
    const financeiro = conjunto.financeiro.filter((linha) => {
      const dataReferencia =
        vencimentoLinha(linha) ||
        dataValida(recebimentoLinha(linha)) ||
        dataLinha(linha)

      if (!dentroPeriodo(dataReferencia, periodo, dataInicio, dataFim)) return false

      if (transportadora && normalizar(transportadoraLinha(linha)) !== normalizar(transportadora)) {
        return false
      }

      if (servico && normalizar(servicoLinha(linha)) !== normalizar(servico)) {
        return false
      }

      return true
    })

    const financeiroIds = new Set(financeiro.map((linha) => texto(linha.id)).filter(Boolean))
    const embarqueIds = new Set(
      financeiro.map((linha) => texto(embarqueIdLinha(linha))).filter(Boolean)
    )
    const awbs = new Set(financeiro.flatMap((linha) => awbsLinha(linha)))
    const refs = new Set(
      financeiro.map((linha) => normalizar(refHcLinha(linha))).filter(Boolean)
    )

    const filtrarRelacionadoAoPeriodo = (linha: Linha) => {
      const embarqueId = texto(embarqueIdLinha(linha))
      const financeiroId = texto(financeiroIdLinha(linha))
      const awbVinculado = awbsLinha(linha).some((awb) => awbs.has(awb))
      const refHc = normalizar(refHcLinha(linha))

      const vinculadoAoFinanceiro =
        (embarqueId && embarqueIds.has(embarqueId)) ||
        (financeiroId && financeiroIds.has(financeiroId)) ||
        awbVinculado ||
        Boolean(refHc && refs.has(refHc))

      // Um vínculo financeiro filtrado prevalece sobre a data do cadastro operacional.
      if (vinculadoAoFinanceiro) return true

      if (!dentroPeriodo(dataLinha(linha), periodo, dataInicio, dataFim)) return false

      const transportadoraLinhaAtual = normalizar(transportadoraLinha(linha))
      if (
        transportadora &&
        transportadoraLinhaAtual &&
        transportadoraLinhaAtual !== normalizar(transportadora)
      ) {
        return false
      }

      const servicoLinhaAtual = normalizar(servicoLinha(linha))
      if (servico && servicoLinhaAtual && servicoLinhaAtual !== normalizar(servico)) {
        return false
      }

      return true
    }

    return {
      embarques: conjunto.embarques.filter(filtrarRelacionadoAoPeriodo),
      financeiro,
      cotacoes: conjunto.cotacoes.filter(filtrarRelacionadoAoPeriodo),
      faturas: conjunto.faturas.filter(filtrarRelacionadoAoPeriodo),
      suporte: conjunto.suporte.filter(filtrarRelacionadoAoPeriodo),
    }
  }, [conjunto, periodo, dataInicio, dataFim, transportadora, servico])

  const diagnosticoVinculos = useMemo(() => {
    const processosFaturados = filtrado.financeiro.filter((linha) => valorFaturado(linha) !== 0)
    const awbsFinanceiros = new Set(
      processosFaturados.flatMap((linha) => awbsLinha(linha))
    )
    const awbsEmbarques = new Set(
      filtrado.embarques.flatMap((linha) => awbsLinha(linha))
    )
    const awbsLocalizados = Array.from(awbsFinanceiros).filter((awb) => awbsEmbarques.has(awb))
    const awbsSemEmbarque = Math.max(0, awbsFinanceiros.size - awbsLocalizados.length)
    const coberturaAwb = awbsFinanceiros.size
      ? (awbsLocalizados.length / awbsFinanceiros.size) * 100
      : 0

    return {
      processosFaturados: processosFaturados.length,
      awbsFinanceiros: awbsFinanceiros.size,
      awbsLocalizados: awbsLocalizados.length,
      awbsSemEmbarque,
      coberturaAwb,
      embarquesLocalizados: filtrado.embarques.length,
      cotacoesLocalizadas: filtrado.cotacoes.length,
      faturasLocalizadas: filtrado.faturas.length,
      chamadosLocalizados: filtrado.suporte.length,
    }
  }, [filtrado])

  const resumo = useMemo(() => {
    const agora = new Date()
    const emb = filtrado.embarques
    const fin = filtrado.financeiro
    const cot = filtrado.cotacoes
    const fat = filtrado.faturas
    const sup = filtrado.suporte

    const faturados = fin.filter((x) => valorFaturado(x) !== 0)
    const faturamento = faturados.reduce((a, x) => a + valorFaturado(x), 0)
    const custo = faturados.reduce(
      (a, x) => a + valorCusto(x) + valorDta(x) + valorDebitoTerceiro(x),
      0
    )
    const profit = faturados.reduce((a, x) => a + profitHC(x), 0)
    const pagos = fin.filter(pagoLinha)
    const recebido = pagos.reduce((a, x) => a + valorFaturado(x), 0)
    const abertos = fin.filter((x) => !pagoLinha(x) && valorFaturado(x) !== 0)
    const vencidos = abertos.filter((x) => {
      const v = vencimentoLinha(x)
      return Boolean(v && v < agora)
    })
    const aguardandoCusto = fin.filter(
      (x) => valorFaturado(x) !== 0 && valorCusto(x) === 0
    )

    const st = (s: string) => normalizar(s)
    const qtdStatus = (termos: string[]) =>
      emb.filter((e) => termos.some((t) => st(statusLinha(e)).includes(st(t)))).length

    const cotStatus = (termos: string[]) =>
      cot.filter((c) => termos.some((t) => st(statusLinha(c)).includes(st(t)))).length

    const convertidas = cotStatus(STATUS_COTACAO_CONVERTIDA)
    const aprovadas = cotStatus(STATUS_COTACAO_APROVADA)
    const perdidas = cotStatus(STATUS_COTACAO_PERDIDA)
    const taxaConversao = cot.length ? (convertidas / cot.length) * 100 : 0

    const peso = emb.reduce((a, x) => a + pesoLinha(x), 0)
    const margem = faturamento ? (profit / faturamento) * 100 : 0

    const pagasFaturas = fat.filter(pagoLinha).length
    const faturasVencidas = fat.filter((f) => {
      if (pagoLinha(f)) return false
      const v = vencimentoLinha(f)
      return Boolean(v && v < agora)
    }).length

    const suporteStatus = (termo: string) =>
      sup.filter((s) => normalizar(statusLinha(s)) === normalizar(termo)).length

    return {
      embTotal: emb.length,
      transito: qtdStatus(['em trânsito', 'em transito']),
      fiscalizacao: qtdStatus(['fiscalização', 'fiscalizacao']),
      liberados: qtdStatus(['liberado', 'liberada']),
      entregues: qtdStatus(['entregue']),
      arquivados: emb.filter((e) => Boolean(e.arquivado || e.arquivado_cliente)).length,
      peso,
      cotTotal: cot.length,
      cotAguardando: cotStatus(['aguardando']),
      cotAnalise: cotStatus(['análise', 'analise']),
      cotDisponiveis: cotStatus(['disponível', 'disponivel']),
      cotAprovadas: aprovadas,
      cotPerdidas: perdidas,
      cotSemRetorno: cot.filter((c) => {
        const d = dataLinha(c)
        const s = normalizar(statusLinha(c))
        return Boolean(d && diasEntre(agora, d) > 2 && !s.includes('convert') && !s.includes('perdid') && !s.includes('recus'))
      }).length,
      cotConvertidas: convertidas,
      taxaConversao,
      faturamento,
      recebido,
      emAberto: abertos.reduce((a, x) => a + valorFaturado(x), 0),
      atrasado: vencidos.reduce((a, x) => a + valorFaturado(x), 0),
      aguardandoCusto: aguardandoCusto.length,
      ticket: faturados.length ? faturamento / faturados.length : 0,
      custo,
      profit,
      margem,
      faturasTotal: fat.length,
      faturasPagas: pagasFaturas,
      faturasAberto: fat.length - pagasFaturas,
      faturasVencidas,
      faturasComRecibo: fat.filter((f) => Boolean(f.recibo_url || f.url_recibo || f.recibo)).length,
      faturasVisualizadas: fat.filter((f) => Boolean(f.visualizado_em || f.visualizada_em || f.visualizada)).length,
      faturasNaoVisualizadas: fat.filter((f) => !Boolean(f.visualizado_em || f.visualizada_em || f.visualizada)).length,
      suporteTotal: sup.length,
      suporteAbertos: suporteStatus('ABERTO'),
      suporteAnalise: suporteStatus('EM ANÁLISE'),
      suporteRespondidos: suporteStatus('RESPONDIDO'),
      suporteResolvidos: suporteStatus('RESOLVIDO'),
    }
  }, [filtrado])

  const serie = useMemo(() => {
    const mapa = new Map<string, SerieMensal>()

    function linhaMes(d: Date) {
      const chave = mesChave(d)
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          chave,
          rotulo: mesRotulo(chave),
          faturamento: 0,
          custo: 0,
          profit: 0,
          embarques: 0,
          cotacoes: 0,
          convertidas: 0,
        })
      }
      return mapa.get(chave)!
    }

    filtrado.financeiro.forEach((x) => {
      const d = dataLinha(x)
      if (!d) return
      const m = linhaMes(d)
      m.faturamento += valorFaturado(x)
      m.custo += valorCusto(x) + valorDta(x) + valorDebitoTerceiro(x)
      m.profit += profitHC(x)
    })

    filtrado.embarques.forEach((x) => {
      const d = dataLinha(x)
      if (d) linhaMes(d).embarques += 1
    })

    filtrado.cotacoes.forEach((x) => {
      const d = dataLinha(x)
      if (!d) return
      const m = linhaMes(d)
      m.cotacoes += 1
      if (normalizar(statusLinha(x)).includes('convert')) m.convertidas += 1
    })

    return Array.from(mapa.values()).sort((a, b) => a.chave.localeCompare(b.chave)).slice(-12)
  }, [filtrado])

  const distribuicoes = useMemo(() => {
    function agrupar(arr: Linha[], fn: (x: Linha) => string) {
      const m = new Map<string, number>()
      arr.forEach((x) => {
        const k = fn(x) || 'Não informado'
        m.set(k, (m.get(k) || 0) + 1)
      })
      return Array.from(m.entries())
        .map(([nome, valor]) => ({ nome, valor }))
        .sort((a, b) => b.valor - a.valor)
    }

    return {
      status: agrupar(filtrado.embarques, statusLinha),
      transportadora: agrupar(filtrado.embarques, transportadoraLinha),
      servico: agrupar(filtrado.embarques, servicoLinha),
    }
  }, [filtrado.embarques])

  const insights = useMemo(() => {
    if (!cliente) return [] as { tipo: string; texto: string }[]

    const itens: { tipo: string; texto: string }[] = []
    const agora = new Date()

    const datasEmb = conjunto.embarques.map(dataLinha).filter(Boolean) as Date[]
    const ultima = datasEmb.sort((a, b) => b.getTime() - a.getTime())[0]

    if (ultima) {
      const dias = diasEntre(agora, ultima)
      if (dias > 0) {
        itens.push({
          tipo: dias > 60 ? 'alerta' : 'info',
          texto: `Última operação identificada há ${dias} dia(s).`,
        })
      }
    }

    if (resumo.emAberto > 0) {
      itens.push({ tipo: 'alerta', texto: `Cliente possui ${moeda(resumo.emAberto)} em aberto.` })
    }

    if (resumo.faturasVencidas > 0) {
      itens.push({
        tipo: 'alerta',
        texto: `Cliente possui ${resumo.faturasVencidas} fatura(s) vencida(s).`,
      })
    }

    if (resumo.cotSemRetorno > 0) {
      itens.push({
        tipo: 'atencao',
        texto: `${resumo.cotSemRetorno} cotação(ões) estão há mais de 2 dias sem retorno.`,
      })
    }

    if (serie.length >= 2) {
      const atual = serie[serie.length - 1]
      const anterior = serie[serie.length - 2]
      const varFat = percent(atual.faturamento, anterior.faturamento)
      const varTicketAnterior =
        anterior.embarques > 0 ? anterior.faturamento / anterior.embarques : 0
      const varTicketAtual = atual.embarques > 0 ? atual.faturamento / atual.embarques : 0
      const varTicket = percent(varTicketAtual, varTicketAnterior)

      if (Math.abs(varFat) >= 10) {
        itens.push({
          tipo: varFat < 0 ? 'alerta' : 'positivo',
          texto: `Faturamento mensal ${varFat < 0 ? 'caiu' : 'subiu'} ${Math.abs(varFat).toFixed(1)}% em relação ao mês anterior disponível.`,
        })
      }

      if (Math.abs(varTicket) >= 10) {
        itens.push({
          tipo: varTicket < 0 ? 'atencao' : 'positivo',
          texto: `Ticket médio mensal ${varTicket < 0 ? 'caiu' : 'aumentou'} ${Math.abs(varTicket).toFixed(1)}%.`,
        })
      }
    }

    return itens
  }, [cliente, conjunto.embarques, resumo, serie])

  const timeline = useMemo(() => {
    const eventos: { data: Date; titulo: string; detalhe: string; tipo: string }[] = []

    filtrado.cotacoes.forEach((c) => {
      const d = dataLinha(c)
      if (!d) return
      eventos.push({
        data: d,
        titulo: `Cotação ${statusLinha(c) || 'registrada'}`,
        detalhe: `${refHcLinha(c) || 'Sem ref. HC'} • ${primeiro(c.origem, '')}${c.origem && c.destino ? ' → ' : ''}${primeiro(c.destino, '')}`,
        tipo: 'cotacao',
      })
    })

    filtrado.embarques.forEach((e) => {
      const d = dataLinha(e)
      if (!d) return
      eventos.push({
        data: d,
        titulo: `Embarque ${statusLinha(e) || 'registrado'}`,
        detalhe: `${awbLinha(e) || 'Sem AWB'} • ${refHcLinha(e) || 'Sem ref. HC'}`,
        tipo: 'embarque',
      })
    })

    filtrado.financeiro.forEach((f) => {
      const d = dataLinha(f)
      if (!d) return
      eventos.push({
        data: d,
        titulo: pagoLinha(f) ? 'Pagamento/recebimento registrado' : 'Movimentação financeira',
        detalhe: `${awbLinha(f) || 'Sem AWB'} • ${moeda(valorFaturado(f))}`,
        tipo: 'financeiro',
      })
    })

    filtrado.faturas.forEach((f) => {
      const d = dataLinha(f)
      if (!d) return
      eventos.push({
        data: d,
        titulo: 'Fatura registrada',
        detalhe: `${numeroFaturaLinha(f) || 'Sem número'} • ${moeda(valorFaturado(f))}`,
        tipo: 'fatura',
      })
    })

    filtrado.suporte.forEach((s) => {
      const d = dataLinha(s)
      if (!d) return
      eventos.push({
        data: d,
        titulo: `Suporte ${statusLinha(s) || 'registrado'}`,
        detalhe: primeiro(s.assunto, s.mensagem, 'Chamado de suporte'),
        tipo: 'suporte',
      })
    })

    return eventos.sort((a, b) => b.data.getTime() - a.data.getTime())
  }, [filtrado])

  const primeiraOperacao = useMemo(() => {
    const datas = [...conjunto.embarques, ...conjunto.financeiro]
      .map(dataLinha)
      .filter(Boolean) as Date[]
    return datas.length ? new Date(Math.min(...datas.map((d) => d.getTime()))) : null
  }, [conjunto.embarques, conjunto.financeiro])

  const ultimaOperacao = useMemo(() => {
    const datas = [...conjunto.embarques, ...conjunto.financeiro]
      .map(dataLinha)
      .filter(Boolean) as Date[]
    return datas.length ? new Date(Math.max(...datas.map((d) => d.getTime()))) : null
  }, [conjunto.embarques, conjunto.financeiro])

  const maxSerie = Math.max(
    1,
    ...serie.flatMap((s) => [s.faturamento, s.custo, Math.max(0, s.profit)])
  )

  if (loading) {
    return (
      <div className="min-h-[65vh] flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="mt-4 font-bold text-slate-300">Montando análise de clientes...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="space-y-6 pb-16">
      <section className="rounded-3xl border border-blue-500/30 bg-gradient-to-br from-slate-950 via-slate-950 to-blue-950/30 p-5 md:p-7 shadow-2xl">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-blue-300">
              <BarChart3 size={20} />
              <span className="text-sm font-black uppercase tracking-[0.22em]">Gestão de clientes</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white">Análise de Clientes</h1>
            <p className="mt-2 max-w-3xl text-sm md:text-base font-semibold text-slate-400">
              Ranking, histórico, evolução, operação, faturamento, Profit HC e atendimento em uma única tela.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {!cliente && (
              <>
                <Link
                  href="/admin/financeiro?aba=PROCESSOS&status=TODOS"
                  className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-3 text-sm font-black text-emerald-200 hover:bg-emerald-500/20"
                >
                  Ver financeiro
                </Link>
                <button
                  onClick={exportarRankingCSV}
                  className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-black text-slate-200 hover:bg-slate-800"
                >
                  Exportar CSV
                </button>
              </>
            )}
            {cliente && (
              <button
                onClick={voltarAnaliseGeral}
                className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-black text-slate-200 hover:bg-slate-800"
              >
                Voltar para clientes
              </button>
            )}
            <button
              onClick={carregar}
              className="rounded-2xl border border-blue-500/40 bg-blue-500/10 px-5 py-3 text-sm font-black text-blue-200 hover:bg-blue-500/20"
            >
              Atualizar dados
            </button>
          </div>
        </div>

        {erro && (
          <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
            {erro}
          </div>
        )}

        <div className="relative mt-7">
          <Search className="absolute left-4 top-4 text-slate-500" size={20} />
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value)
              setClienteKey('')
            }}
            placeholder="Buscar empresa, cliente, CNPJ/CPF, e-mail, código, login, referência HC ou AWB..."
            className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 py-4 pl-12 pr-4 font-bold text-white outline-none transition focus:border-blue-500"
          />

          {busca && !cliente && (
            <div className="absolute z-30 mt-2 max-h-96 w-full overflow-auto rounded-2xl border border-slate-700 bg-slate-950 p-2 shadow-2xl">
              {clientesFiltradosBusca.length ? (
                clientesFiltradosBusca.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => {
                      setClienteKey(c.key)
                      setBusca(c.nome)
                    }}
                    className="flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3 text-left hover:bg-slate-800"
                  >
                    <div>
                      <p className="font-black text-white">{c.nome}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {[c.documento, c.email, c.codigo].filter(Boolean).join(' • ') || 'Cadastro identificado por operações'}
                      </p>
                    </div>
                    <Building2 className="shrink-0 text-blue-400" size={18} />
                  </button>
                ))
              ) : (
                <p className="p-4 text-sm font-semibold text-slate-500">Nenhum cliente encontrado.</p>
              )}
            </div>
          )}
        </div>
      </section>

      {!cliente ? (
        <div className="space-y-5">
          <section className="rounded-3xl border border-slate-800 bg-slate-950 p-5 md:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-400">Visão geral</p>
                <h2 className="mt-1 text-2xl font-black text-white">Ranking e carteira de clientes</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  A lista já mostra os clientes identificados em Processos Faturados. Use a busca apenas para refinar.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <Select value={periodo} onChange={(v) => setPeriodo(v as Periodo)}>
                  <option value="MES_ATUAL">Este mês</option>
                  <option value="MES_ANTERIOR">Mês anterior</option>
                  <option value="ULTIMOS_90">Últimos 90 dias</option>
                  <option value="ANO_ATUAL">Ano atual</option>
                  <option value="TODOS">Todo o período</option>
                  <option value="PERSONALIZADO">Período personalizado</option>
                </Select>

                <Select value={rankingPor} onChange={(v) => setRankingPor(v as RankingPor)}>
                  <option value="PROFIT">Maior Profit HC</option>
                  <option value="FATURADOS">Mais processos faturados</option>
                  <option value="TICKET">Maior ticket Profit</option>
                  <option value="MENOR_PROFIT">Menor Profit HC</option>
                  <option value="MENOR_TICKET">Menor ticket Profit</option>
                  <option value="ATRASADOS">Mais atrasados</option>
                </Select>

                <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm font-bold text-slate-200">
                  <input
                    type="checkbox"
                    checked={somenteComMovimento}
                    onChange={(e) => setSomenteComMovimento(e.target.checked)}
                  />
                  Somente com movimento
                </label>
              </div>
            </div>

            {periodo === 'PERSONALIZADO' && (
              <div className="mt-3 grid max-w-xl grid-cols-2 gap-3">
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-bold text-white"
                />
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-bold text-white"
                />
              </div>
            )}
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <Card titulo="Clientes" valor={resumoRanking.clientes} detalhe="no filtro atual" />
            <Card titulo="Processos faturados" valor={resumoRanking.processos} detalhe="base do ranking" cor="blue" />
            <Card titulo="Profit HC" valor={moeda(resumoRanking.profit)} detalhe="processos com custo" cor={resumoRanking.profit >= 0 ? 'green' : 'red'} />
            <Card titulo="Ticket médio Profit" valor={moeda(resumoRanking.ticket)} detalhe="por processo com custo" />
            <Card titulo="Pagos" valor={resumoRanking.pagos} detalhe="recebimento identificado" cor="green" />
            <Card titulo="Aguardando custo" valor={resumoRanking.aguardandoCusto} detalhe="fora do Profit" cor="yellow" />
          </section>

          <section className="grid gap-3 md:grid-cols-3">
            <Card titulo="Em aberto" valor={resumoRanking.emAberto} detalhe="ainda não vencidos" cor="yellow" />
            <Card titulo="Atrasados" valor={resumoRanking.atrasados} detalhe="vencimento ultrapassado" cor="red" />
            <Card
              titulo="Faturamento bruto"
              valor={moeda(resumoRanking.faturamento)}
              detalhe={`Custos considerados: ${moeda(resumoRanking.custo)}`}
              cor="blue"
            />
          </section>

          <section className="grid gap-3 lg:grid-cols-4">
            <DestaqueRanking
              titulo="Maior Profit HC"
              item={resumoRanking.topProfit}
              valor={resumoRanking.topProfit ? moeda(resumoRanking.topProfit.profitTotal) : '-'}
              onAnalisar={selecionarClienteDoRanking}
            />
            <DestaqueRanking
              titulo="Mais processos"
              item={resumoRanking.topProcessos}
              valor={resumoRanking.topProcessos ? `${resumoRanking.topProcessos.processosFaturados} processo(s)` : '-'}
              onAnalisar={selecionarClienteDoRanking}
            />
            <DestaqueRanking
              titulo="Melhor ticket Profit"
              item={resumoRanking.topTicket}
              valor={resumoRanking.topTicket ? moeda(resumoRanking.topTicket.ticketMedioProfit) : '-'}
              onAnalisar={selecionarClienteDoRanking}
            />
            <DestaqueRanking
              titulo="Menor geração"
              item={resumoRanking.menorProfit}
              valor={resumoRanking.menorProfit ? moeda(resumoRanking.menorProfit.profitTotal) : '-'}
              onAnalisar={selecionarClienteDoRanking}
            />
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950">
            <div className="flex flex-col gap-2 border-b border-slate-800 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black text-white">Clientes</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {ranking.length} cliente(s). Clique em Analisar para abrir a visão 360 completa.
                </p>
              </div>
              {busca && (
                <button
                  onClick={() => setBusca('')}
                  className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-black text-slate-300 hover:bg-slate-800"
                >
                  Limpar busca
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1150px] w-full text-left">
                <thead className="border-b border-slate-800 bg-slate-900">
                  <tr>
                    {['#', 'Cliente', 'Processos', 'Profit HC', 'Ticket Profit', 'Financeiro', 'Sem custo', 'Último registro', 'Ações'].map((coluna) => (
                      <th key={coluna} className="whitespace-nowrap px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">
                        {coluna}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((item, index) => (
                    <tr key={item.clienteKey} className="border-b border-slate-900 hover:bg-slate-900/50">
                      <td className="px-4 py-3 text-xs font-black text-blue-400">{index + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-black text-white">{item.nome}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {item.transportadoras.join(', ') || 'Transportadora não informada'}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-black text-purple-300">{item.processosFaturados}</td>
                      <td className={`px-4 py-3 font-black ${item.profitTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {moeda(item.profitTotal)}
                      </td>
                      <td className="px-4 py-3 font-black text-amber-300">{moeda(item.ticketMedioProfit)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-300">
                            Pagos {item.pagos}
                          </span>
                          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-black text-amber-300">
                            Aberto {item.emAberto}
                          </span>
                          <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] font-black text-red-300">
                            Atrasados {item.atrasados}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-black text-slate-300">{item.aguardandoCusto}</td>
                      <td className="px-4 py-3">
                        <p className="font-black text-slate-200">{item.ultimoAwb}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{dataBR(item.ultimoRegistro)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => selecionarClienteDoRanking(item)}
                            className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-500"
                          >
                            Analisar
                          </button>
                          <Link
                            href={`/admin/financeiro?aba=PROCESSOS&status=TODOS&busca=${encodeURIComponent(item.ultimoAwb !== '-' ? item.ultimoAwb : item.nome)}`}
                            className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white hover:bg-emerald-600"
                          >
                            Financeiro
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!ranking.length && (
              <div className="p-10 text-center">
                <Building2 className="mx-auto text-slate-600" size={42} />
                <p className="mt-3 font-black text-white">Nenhum cliente encontrado</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">Ajuste o período ou limpe a busca.</p>
              </div>
            )}
          </section>
        </div>
      ) : (
        <>
          <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
            <div className="rounded-3xl border border-blue-500/25 bg-slate-950 p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-400">Cliente selecionado</p>
                  <h2 className="mt-2 text-2xl font-black text-white">{cliente.nome}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{cliente.razaoSocial || 'Razão social não identificada'}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Info label="CNPJ / CPF" value={cliente.documento || '-'} />
                <Info label="E-mail" value={cliente.email || '-'} />
                <Info label="Telefone" value={cliente.telefone || '-'} />
                <Info label="Código" value={cliente.codigo || '-'} />
                <Info label="Login vinculado" value={cliente.login || '-'} />
                <Info label="Cadastro" value={dataBR(cliente.criadoEm)} />
                <Info label="Primeiro movimento" value={dataBR(primeiraOperacao)} />
                <Info label="Último movimento" value={dataBR(ultimaOperacao)} />
                <Info label="Processos faturados" value={String(conjunto.financeiro.filter((x) => valorFaturado(x) !== 0).length)} />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 md:p-6">
              <div className="flex items-center gap-2">
                <Filter size={18} className="text-blue-400" />
                <h2 className="font-black text-white">Filtros</h2>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Select value={periodo} onChange={(v) => setPeriodo(v as Periodo)}>
                  <option value="MES_ATUAL">Este mês</option>
                  <option value="MES_ANTERIOR">Mês anterior</option>
                  <option value="ULTIMOS_90">Últimos 90 dias</option>
                  <option value="ANO_ATUAL">Ano atual</option>
                  <option value="TODOS">Todo o período</option>
                  <option value="PERSONALIZADO">Período personalizado</option>
                </Select>
                <Select value={transportadora} onChange={setTransportadora}>
                  <option value="">Todas transportadoras</option>
                  {opcoesFiltro.transportadoras.map((x) => <option key={x}>{x}</option>)}
                </Select>
                <Select value={servico} onChange={setServico}>
                  <option value="">Todos serviços</option>
                  {opcoesFiltro.servicos.map((x) => <option key={x}>{x}</option>)}
                </Select>
              </div>

              {periodo === 'PERSONALIZADO' && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-bold text-white"
                  />
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-bold text-white"
                  />
                </div>
              )}
            </div>
          </section>

          <section>
            <Titulo icone={<BarChart3 size={20} />} titulo="Resumo executivo" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Card
                titulo="Processos faturados"
                valor={diagnosticoVinculos.processosFaturados}
                detalhe={`${diagnosticoVinculos.awbsFinanceiros} AWB(s) identificado(s)`}
                cor="blue"
              />
              <Card titulo="Faturamento" valor={moeda(resumo.faturamento)} cor="blue" />
              <Card
                titulo="Profit HC"
                valor={moeda(resumo.profit)}
                cor={resumo.profit >= 0 ? 'green' : 'red'}
                detalhe={`${resumo.margem.toFixed(1)}% margem`}
              />
              <Card titulo="Recebido" valor={moeda(resumo.recebido)} cor="green" />
              <Card
                titulo="Em aberto"
                valor={moeda(resumo.emAberto)}
                cor={resumo.emAberto > 0 ? 'yellow' : 'slate'}
                detalhe={resumo.atrasado > 0 ? `Atrasado: ${moeda(resumo.atrasado)}` : 'Sem atraso identificado'}
              />
              <Card
                titulo="Custo HC"
                valor={moeda(resumo.custo)}
                detalhe={`Ticket faturado: ${moeda(resumo.ticket)}`}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-950 p-5 md:p-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-400">Qualidade dos vínculos</p>
                <h2 className="mt-1 text-xl font-black text-white">O que foi localizado nas demais bases</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Processo faturado e embarque localizado são indicadores diferentes. A ausência de um embarque não apaga o histórico financeiro.
                </p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Cobertura por AWB</p>
                <p className="mt-1 text-2xl font-black text-white">{diagnosticoVinculos.coberturaAwb.toFixed(1)}%</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Card titulo="AWBs financeiros" valor={diagnosticoVinculos.awbsFinanceiros} />
              <Card titulo="AWBs localizados" valor={diagnosticoVinculos.awbsLocalizados} cor="green" />
              <Card titulo="Embarques localizados" valor={diagnosticoVinculos.embarquesLocalizados} />
              <Card titulo="Cotações vinculadas" valor={diagnosticoVinculos.cotacoesLocalizadas} />
              <Card titulo="Faturas vinculadas" valor={diagnosticoVinculos.faturasLocalizadas} />
              <Card titulo="Peso identificado" valor={`${resumo.peso.toFixed(1)} kg`} />
            </div>

            {diagnosticoVinculos.awbsSemEmbarque > 0 && (
              <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-bold text-amber-200">
                {diagnosticoVinculos.awbsSemEmbarque} AWB(s) do financeiro não possuem embarque localizado no cadastro atual.
                Esses processos continuam contabilizados no financeiro e no Profit HC.
              </div>
            )}
          </section>

          <section>
            <Titulo icone={<BarChart3 size={20} />} titulo="Evolução mensal" />
            <div className="grid gap-4 xl:grid-cols-2">
              <Painel titulo="Faturamento x custo x Profit HC">
                {serie.length ? (
                  <div className="space-y-4">
                    {serie.map((s) => (
                      <div key={s.chave}>
                        <div className="mb-1 flex justify-between text-xs font-black text-slate-400">
                          <span>{s.rotulo}</span>
                          <span>{moeda(s.faturamento)} • Profit {moeda(s.profit)}</span>
                        </div>
                        <div className="space-y-1">
                          <Barra largura={(s.faturamento / maxSerie) * 100} classe="bg-blue-500" />
                          <Barra largura={(s.custo / maxSerie) * 100} classe="bg-amber-500" />
                          <Barra largura={(Math.max(0, s.profit) / maxSerie) * 100} classe="bg-emerald-500" />
                        </div>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-4 text-xs font-black text-slate-400">
                      <Legenda classe="bg-blue-500" texto="Faturamento" />
                      <Legenda classe="bg-amber-500" texto="Custo" />
                      <Legenda classe="bg-emerald-500" texto="Profit" />
                    </div>
                  </div>
                ) : <Vazio />}
              </Painel>

              <Painel titulo="Embarques e cotações por mês">
                {serie.length ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {serie.map((s) => (
                      <div key={s.chave} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                        <p className="text-xs font-black uppercase text-slate-500">{s.rotulo}</p>
                        <p className="mt-2 text-xl font-black text-white">{s.embarques} <span className="text-xs text-slate-500">embarques</span></p>
                        <p className="mt-1 text-sm font-black text-blue-300">{s.cotacoes} cotações</p>
                        <p className="text-xs font-bold text-emerald-400">{s.convertidas} convertidas</p>
                      </div>
                    ))}
                  </div>
                ) : <Vazio />}
              </Painel>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <Distribuicao titulo="Por status" itens={distribuicoes.status} />
              <Distribuicao titulo="Por transportadora" itens={distribuicoes.transportadora} />
              <Distribuicao titulo="Por serviço" itens={distribuicoes.servico} />
            </div>
          </section>

          <section>
            <Titulo icone={<AlertTriangle size={20} />} titulo="Alertas e insights objetivos" />
            <div className="grid gap-3 lg:grid-cols-2">
              {insights.length ? insights.map((i, idx) => (
                <div
                  key={idx}
                  className={`rounded-2xl border p-4 font-bold ${
                    i.tipo === 'alerta'
                      ? 'border-red-500/30 bg-red-500/10 text-red-200'
                      : i.tipo === 'positivo'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                      : i.tipo === 'atencao'
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                      : 'border-blue-500/30 bg-blue-500/10 text-blue-200'
                  }`}
                >
                  {i.texto}
                </div>
              )) : (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 font-bold text-emerald-200">
                  Nenhum alerta objetivo identificado para os filtros atuais.
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="mb-4 flex flex-wrap gap-2">
              <Tab ativo={aba === 'EMBARQUES'} onClick={() => setAba('EMBARQUES')} texto="Embarques" />
              <Tab ativo={aba === 'COTACOES'} onClick={() => setAba('COTACOES')} texto="Cotações" />
              <Tab ativo={aba === 'FINANCEIRO'} onClick={() => setAba('FINANCEIRO')} texto="Financeiro / Faturas" />
              <Tab ativo={aba === 'TIMELINE'} onClick={() => setAba('TIMELINE')} texto="Histórico completo" />
            </div>

            {aba === 'EMBARQUES' && (
              <Tabela
                colunas={['AWB', 'Ref. HC', 'Ref. cliente', 'Exportador', 'Importador', 'Serviço', 'Transportadora', 'Origem', 'Destino', 'Status', 'Peso', 'Data', 'Ação']}
                linhas={(verMais ? filtrado.embarques : filtrado.embarques.slice(0, 50)).map((e) => [
                  awbLinha(e) || '-',
                  refHcLinha(e) || '-',
                  refClienteLinha(e) || '-',
                  primeiro(e.exportador, '-'),
                  primeiro(e.importador, '-'),
                  servicoLinha(e) || '-',
                  transportadoraLinha(e) || '-',
                  primeiro(e.origem, '-'),
                  primeiro(e.destino, '-'),
                  statusLinha(e) || '-',
                  `${pesoLinha(e).toFixed(1)} kg`,
                  dataBR(dataLinha(e)),
                  e.id ? <Link className="font-black text-blue-400 hover:text-blue-300" href={`/admin/embarques/${e.id}`}>Abrir</Link> : '-',
                ])}
              />
            )}

            {aba === 'COTACOES' && (
              <Tabela
                colunas={['Ref. HC', 'Data', 'Operação', 'Rota', 'Valor', 'Status', 'Dias sem retorno', 'Virou embarque', 'AWB']}
                linhas={(verMais ? filtrado.cotacoes : filtrado.cotacoes.slice(0, 50)).map((c) => {
                  const d = dataLinha(c)
                  const s = normalizar(statusLinha(c))
                  return [
                    refHcLinha(c) || '-',
                    dataBR(d),
                    servicoLinha(c) || '-',
                    `${primeiro(c.origem, '-')} → ${primeiro(c.destino, '-')}`,
                    moeda(primeiro(c.valor_total, c.valor, c.valor_cotacao)),
                    statusLinha(c) || '-',
                    d ? Math.max(0, diasEntre(new Date(), d)) : '-',
                    s.includes('convert') || Boolean(c.embarque_id) ? 'Sim' : 'Não',
                    awbLinha(c) || '-',
                  ]
                })}
              />
            )}

            {aba === 'FINANCEIRO' && (
              <Tabela
                colunas={['AWB', 'Fatura', 'Faturado', 'Custo HC', 'Profit HC', 'Vencimento', 'Recebimento', 'Status', 'Dias de atraso']}
                linhas={(verMais ? filtrado.financeiro : filtrado.financeiro.slice(0, 50)).map((f) => {
                  const v = vencimentoLinha(f)
                  const atraso = !pagoLinha(f) && v && v < new Date() ? diasEntre(new Date(), v) : 0
                  return [
                    awbLinha(f) || '-',
                    numeroFaturaLinha(f) || '-',
                    moeda(valorFaturado(f)),
                    moeda(valorCusto(f) + valorDta(f) + valorDebitoTerceiro(f)),
                    moeda(profitHC(f)),
                    dataBR(v),
                    dataBR(recebimentoLinha(f)),
                    primeiro(f.status_financeiro, f.status_pagamento, f.status, pagoLinha(f) ? 'PAGO' : 'EM ABERTO'),
                    atraso,
                  ]
                })}
              />
            )}

            {aba === 'TIMELINE' && (
              <Painel titulo="Histórico consolidado">
                <div className="space-y-3">
                  {(verMais ? timeline : timeline.slice(0, 60)).map((e, i) => (
                    <div key={`${e.data.toISOString()}-${i}`} className="flex gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                      <div className="mt-1 h-3 w-3 shrink-0 rounded-full bg-blue-500" />
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">{e.data.toLocaleString('pt-BR')}</p>
                        <p className="mt-1 font-black text-white">{e.titulo}</p>
                        <p className="mt-1 truncate text-sm font-semibold text-slate-400">{e.detalhe}</p>
                      </div>
                    </div>
                  ))}
                  {!timeline.length && <Vazio />}
                </div>
              </Painel>
            )}

            {(
              (aba === 'EMBARQUES' && filtrado.embarques.length > 50) ||
              (aba === 'COTACOES' && filtrado.cotacoes.length > 50) ||
              (aba === 'FINANCEIRO' && filtrado.financeiro.length > 50) ||
              (aba === 'TIMELINE' && timeline.length > 60)
            ) && (
              <button
                onClick={() => setVerMais((v) => !v)}
                className="mt-4 flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-black text-slate-300 hover:bg-slate-800"
              >
                {verMais ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {verMais ? 'Mostrar menos' : 'Mostrar todos'}
              </button>
            )}
          </section>
        </>
      )}
    </main>
  )
}

function DestaqueRanking({
  titulo,
  item,
  valor,
  onAnalisar,
}: {
  titulo: string
  item: ClienteRanking | null
  valor: string
  onAnalisar: (item: ClienteRanking) => void
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="mt-3 min-h-[48px] text-lg font-black text-white">{item?.nome || '-'}</p>
      <p className="mt-2 text-xl font-black text-emerald-400">{valor}</p>
      {item && (
        <button
          onClick={() => onAnalisar(item)}
          className="mt-4 rounded-xl border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs font-black text-blue-200 hover:bg-blue-500/20"
        >
          Analisar cliente
        </button>
      )}
    </div>
  )
}

function Titulo({ icone, titulo }: { icone: React.ReactNode; titulo: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-blue-400">{icone}</span>
      <h2 className="text-lg font-black text-white">{titulo}</h2>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-slate-200">{value}</p>
    </div>
  )
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-blue-500"
    >
      {children}
    </select>
  )
}

function Card({
  titulo,
  valor,
  detalhe,
  cor = 'slate',
}: {
  titulo: string
  valor: React.ReactNode
  detalhe?: string
  cor?: 'slate' | 'blue' | 'green' | 'yellow' | 'red'
}) {
  const mapa = {
    slate: 'border-slate-800 bg-slate-950 text-white',
    blue: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
    green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    yellow: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    red: 'border-red-500/30 bg-red-500/10 text-red-200',
  }

  return (
    <div className={`rounded-2xl border p-4 ${mapa[cor]}`}>
      <p className="text-[10px] font-black uppercase tracking-wide opacity-60">{titulo}</p>
      <p className="mt-2 break-words text-xl font-black">{valor}</p>
      {detalhe && <p className="mt-1 text-xs font-bold opacity-70">{detalhe}</p>}
    </div>
  )
}

function Painel({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
      <h3 className="mb-4 font-black text-white">{titulo}</h3>
      {children}
    </div>
  )
}

function Barra({ largura, classe }: { largura: number; classe: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
      <div className={`h-full rounded-full ${classe}`} style={{ width: `${Math.max(0, Math.min(100, largura))}%` }} />
    </div>
  )
}

function Legenda({ classe, texto }: { classe: string; texto: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${classe}`} />
      {texto}
    </span>
  )
}

function Distribuicao({
  titulo,
  itens,
}: {
  titulo: string
  itens: { nome: string; valor: number }[]
}) {
  const max = Math.max(1, ...itens.map((x) => x.valor))
  return (
    <Painel titulo={titulo}>
      <div className="space-y-3">
        {itens.slice(0, 8).map((x) => (
          <div key={x.nome}>
            <div className="mb-1 flex justify-between gap-3 text-xs font-black text-slate-400">
              <span className="truncate">{x.nome}</span>
              <span>{x.valor}</span>
            </div>
            <Barra largura={(x.valor / max) * 100} classe="bg-blue-500" />
          </div>
        ))}
        {!itens.length && <Vazio />}
      </div>
    </Painel>
  )
}

function Tab({
  ativo,
  onClick,
  texto,
}: {
  ativo: boolean
  onClick: () => void
  texto: string
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-4 py-2 text-sm font-black transition ${
        ativo
          ? 'border-blue-500 bg-blue-500/15 text-blue-200'
          : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-900'
      }`}
    >
      {texto}
    </button>
  )
}

function Tabela({
  colunas,
  linhas,
}: {
  colunas: string[]
  linhas: React.ReactNode[][]
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead className="border-b border-slate-800 bg-slate-900">
            <tr>
              {colunas.map((c) => (
                <th key={c} className="whitespace-nowrap px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i} className="border-b border-slate-900 hover:bg-slate-900/50">
                {l.map((v, j) => (
                  <td key={j} className="whitespace-nowrap px-4 py-3 text-xs font-bold text-slate-300">
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!linhas.length && <div className="p-10"><Vazio /></div>}
    </div>
  )
}

function Vazio() {
  return <p className="text-sm font-semibold text-slate-600">Sem dados para os filtros atuais.</p>
}