'use client'

// HC_CARDS_CLAROS_V1

'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { itemCanceladoNaFatura } from '@/lib/itemFaturaTransportadora'
import AdminRealtimeAlerts from '@/components/AdminRealtimeAlerts'
import AdminUsuariosOnline from '@/components/AdminUsuariosOnline'
import { carregarAliasesClientes, mapaAliasesClientes, nomeCanonicoCliente, normalizarIdentidade, nomeExibicaoPreferido } from '@/lib/identidade'

type PeriodoGrafico = '7D' | '30D' | 'MES_ATUAL' | 'MES_ANTERIOR'

const LOTE_SUPABASE = 1000
const DIAS_ALERTA_FATURAS = 7

export default function DashboardPage() {
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [embarques, setEmbarques] = useState<any[]>([])
  const [cotacoes, setCotacoes] = useState<any[]>([])
  const [embarquesDiretos, setEmbarquesDiretos] = useState<any[]>([])
  const [suporte, setSuporte] = useState<any[]>([])
  const [financeiro, setFinanceiro] = useState<any[]>([])
  const [movimentacoes, setMovimentacoes] = useState<any[]>([])
  const [faturasTransportadoras, setFaturasTransportadoras] = useState<any[]>([])
  const [itensFaturasTransportadoras, setItensFaturasTransportadoras] = useState<any[]>([])
  const [ultimoRastreio, setUltimoRastreio] = useState<any>(null)
  const [aliasesClientes, setAliasesClientes] = useState<any[]>([])

  const [modalErrosRastreio, setModalErrosRastreio] = useState(false)
  const [modalFaturas, setModalFaturas] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [rodandoRastreio, setRodandoRastreio] = useState(false)
  const [agora, setAgora] = useState(new Date())
  const [periodoGrafico, setPeriodoGrafico] = useState<PeriodoGrafico>('7D')
  // HC_DASHBOARD_FOCO_V1
  const [ocultarValores, setOcultarValores] = useState(false)
  const [mostrarTodasAcoes, setMostrarTodasAcoes] = useState(false)

  useEffect(() => {
    try {
      setOcultarValores(localStorage.getItem('hc_dashboard_ocultar_valores') === '1')
    } catch {}
  }, [])

  function alternarOcultarValores() {
    setOcultarValores((atual) => {
      const novo = !atual
      try { localStorage.setItem('hc_dashboard_ocultar_valores', novo ? '1' : '0') } catch {}
      return novo
    })
  }

  function exibirValor(texto: string) {
    if (!ocultarValores) return texto
    return texto.includes('R$') ? 'R$ ••••' : texto
  }
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null)
  const mapaAliases = useMemo(() => mapaAliasesClientes(aliasesClientes), [aliasesClientes])

  useEffect(() => {
    const timer = setInterval(() => {
      setAgora(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    buscarDados()
    // PERFORMANCE GLOBAL V2: o Dashboard deixa de baixar todo o histórico a cada 60s.
    // Atualizações passam pelo realtime (com throttle) e pelo botão Atualizar dados.
  }, [])

  useEffect(() => {
    setDiaSelecionado(null)
  }, [periodoGrafico])

  async function carregarTodos(tabela: string, colunaOrdem?: string, crescente = false) {
    const { count, error: countError } = await supabase
      .from(tabela)
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error(`Erro ao contar ${tabela}:`, countError.message)
      return []
    }

    const total = count || 0
    const paginas = Math.max(1, Math.ceil(total / LOTE_SUPABASE))

    const consultas = Array.from({ length: paginas }, (_, index) => {
      const inicio = index * LOTE_SUPABASE
      const fim = inicio + LOTE_SUPABASE - 1

      let query = supabase.from(tabela).select('*').range(inicio, fim)

      if (colunaOrdem) {
        query = query.order(colunaOrdem, { ascending: crescente })
      }

      return query
    })

    const respostas = await Promise.all(consultas)
    const erro = respostas.find((res) => res.error)

    if (erro?.error) {
      console.error(`Erro ao carregar ${tabela}:`, erro.error.message)
      return []
    }

    return respostas.flatMap((res) => res.data || [])
  }

  async function buscarDados(mostrarLoading = true) {
    if (mostrarLoading) setCarregando(true)

    const [
      perfisRes,
      embarquesCarregados,
      cotacoesCarregadas,
      embarquesDiretosCarregados,
      suporteCarregado,
      financeiroCarregado,
      movimentacoesCarregadas,
      faturasTransportadorasCarregadas,
      itensFaturasTransportadorasCarregados,
      logRastreioRes,
      aliasesClientesCarregados,
    ] = await Promise.all([
      supabase.from('perfis').select('*').order('nome'),
      carregarTodos('embarques', 'criado_em', false),
      carregarTodos('cotacoes', 'criado_em', false),
      carregarTodos('embarque_direto', 'criado_em', false),
      carregarTodos('suporte', 'criado_em', false),
      carregarTodos('financeiro_embarques', 'vencimento_cobranca', true),
      carregarTodos('financeiro_movimentacoes', 'data_vencimento', false),
      carregarTodos('faturas_transportadoras'),
      carregarTodos('faturas_transportadoras_itens'),
      supabase
        .from('logs_rastreio')
        .select('id, criado_em, total_processado, total_sucesso, total_erro, detalhes')
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle(),
      carregarAliasesClientes(supabase),
    ])

    if (perfisRes.error) console.error('Erro ao carregar perfis:', perfisRes.error.message)
    if (logRastreioRes.error) console.error('Erro ao carregar log de rastreio:', logRastreioRes.error.message)

    setUsuarios(perfisRes.data || [])
    setEmbarques(embarquesCarregados || [])
    setCotacoes(cotacoesCarregadas || [])
    setEmbarquesDiretos(embarquesDiretosCarregados || [])
    setSuporte(suporteCarregado || [])
    setFinanceiro(financeiroCarregado || [])
    setMovimentacoes(movimentacoesCarregadas || [])
    setFaturasTransportadoras(faturasTransportadorasCarregadas || [])
    setItensFaturasTransportadoras(itensFaturasTransportadorasCarregados || [])
    setUltimoRastreio(logRastreioRes.data || null)
    setAliasesClientes(aliasesClientesCarregados || [])

    if (mostrarLoading) setCarregando(false)
  }

  async function atualizarDadosManual() {
    setCarregando(true)

    try {
      await buscarDados(false)
    } catch (error) {
      console.error(error)
    }

    setCarregando(false)
  }

  async function atualizarTodosRastreios() {
    const {
      data: { session: sessaoRastreio },
    } = await supabase.auth.getSession()

    const accessTokenRastreio = sessaoRastreio?.access_token

    if (!accessTokenRastreio) {
      alert('Sessão administrativa expirada. Entre novamente.')
      return
    }

    setRodandoRastreio(true)

    try {
      const embarquesAtivos = embarques.filter((item) => {
        const status = normalizarBusca(item.status_operacional)
        return !status.includes('ENTREGUE')
      })

      for (const embarque of embarquesAtivos) {
        try {
          await fetch('/api/rastreio', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessTokenRastreio}`,
            },
            body: JSON.stringify({
              embarque_id: embarque.id,
            }),
          })
        } catch (err) {
          console.error('Erro atualizando embarque:', embarque.id, err)
        }
      }

      await buscarDados(false)
    } catch (err) {
      console.error('Erro geral atualização:', err)
    }

    setRodandoRastreio(false)
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

  function normalizarBusca(valor: any) {
    return String(valor ?? '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
  }

  function normalizarAwbConciliacao(valor: any) {
    return String(valor || '').replace(/\D/g, '')
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
    if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10)

    const partes = texto.split('/')
    if (partes.length === 3) {
      const [dia, mes, ano] = partes
      return `${ano.padStart(4, '20')}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
    }

    return null
  }

  function dataBR(data?: string | null) {
    const dataNormalizada = normalizarData(data)
    if (!dataNormalizada) return '-'

    const [ano, mes, dia] = dataNormalizada.split('-')
    return `${dia}/${mes}/${ano}`
  }

  function dataHoraBR(data?: string | null) {
    if (!data) return '-'

    return new Date(data).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    })
  }

  function proximaAtualizacao(data?: string | null) {
    if (!data) return '-'

    const proxima = new Date(data)
    proxima.setMinutes(proxima.getMinutes() + 30)

    return proxima.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    })
  }

  function hojeIso() {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    return hoje.toISOString().slice(0, 10)
  }

  function diasAte(dataIso: string | null) {
    if (!dataIso) return null

    const hoje = new Date(hojeIso() + 'T00:00:00')
    const vencimento = new Date(dataIso + 'T00:00:00')

    return Math.ceil((vencimento.getTime() - hoje.getTime()) / 86400000)
  }

  function mesDaData(valor: any) {
    const data = normalizarData(valor)
    if (!data) return ''
    return data.slice(0, 7)
  }

  function calcularCustos(item: any) {
    return numero(item.doc_dta) + numero(item.debito_terceiro) + numero(item.valor_compra)
  }

  function calcularProfit(item: any) {
    return numero(item.valor_cobranca) - calcularCustos(item)
  }

  function temDataValida(valor: any) {
    return !!normalizarData(valor)
  }

  function statusCobranca(item: any) {
    if (temDataValida(item.recebimento)) return 'PAGO'

    const vencimento = normalizarData(item.vencimento_cobranca)
    if (vencimento && vencimento < hojeIso()) return 'ATRASADO'

    return 'EM ABERTO'
  }

  function statusMovimento(item: any) {
    if (item.status === 'PAGO' || temDataValida(item.data_pagamento)) return 'PAGO'

    const vencimento = normalizarData(item.data_vencimento)
    if (vencimento && vencimento < hojeIso()) return 'VENCIDO'

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

  function aguardandoCustoProcesso(item: any) {
    return numero(item.valor_compra) <= 0
  }

  function ehDhlFedex(item: any) {
    const transportadora = normalizarBusca(item.transportadora)

    return transportadora.includes('DHL') || transportadora.includes('FEDEX') || transportadora.includes('FED EX')
  }

  function nomeTransportadoraCurto(item: any) {
    const transportadora = normalizarBusca(item.transportadora)

    if (transportadora.includes('DHL')) return 'DHL'
    if (transportadora.includes('FEDEX') || transportadora.includes('FED EX')) return 'FedEx'

    return item.transportadora || 'Outra'
  }

  function temFatura(item: any) {
    return String(item.fatura || '').trim() !== ''
  }


  function campoFaturaTransportadora(item: any, nomes: string[]) {
    for (const nome of nomes) {
      const valor = item?.[nome]
      if (valor !== undefined && valor !== null && valor !== '') return valor
    }

    return ''
  }

  function numeroFaturaTransportadora(item: any) {
    return campoFaturaTransportadora(item, [
      'numero_fatura',
      'n_fatura',
      'nº_fatura',
      'nro_fatura',
      'fatura',
      'invoice',
    ])
  }

  function contaFaturaTransportadora(item: any) {
    return campoFaturaTransportadora(item, ['conta', 'account', 'conta_transportadora'])
  }

  function bancoFaturaTransportadora(item: any) {
    return campoFaturaTransportadora(item, ['banco_utilizado', 'banco', 'conta_bancaria'])
  }

  function vencimentoFaturaTransportadora(item: any) {
    return normalizarData(
      campoFaturaTransportadora(item, [
        'vencimento',
        'data_vencimento',
        'vencimento_fatura',
        'data_vencimento_fatura',
      ])
    )
  }

  function pagamentoFaturaTransportadora(item: any) {
    return normalizarData(
      campoFaturaTransportadora(item, [
        'data_pagamento',
        'pagamento',
        'data_pago',
        'pago_em',
      ])
    )
  }

  function totalFaturaTransportadora(item: any) {
    return numero(campoFaturaTransportadora(item, ['total', 'valor_total', 'valor', 'valor_fatura']))
  }

  function valorContestadoFaturaTransportadora(item: any) {
    return numero(campoFaturaTransportadora(item, ['valor_contestado', 'contestado', 'valor_contestacao']))
  }

  function pagoAjustadoFaturaTransportadora(item: any) {
    return numero(campoFaturaTransportadora(item, ['pago_ajustado', 'pago_ajuste', 'valor_pago', 'pago', 'ajustado']))
  }

  function saldoFaturaTransportadora(item: any) {
    const saldoManual = campoFaturaTransportadora(item, ['saldo', 'saldo_aberto', 'valor_saldo'])

    if (saldoManual !== '') return numero(saldoManual)

    return Math.max(
      totalFaturaTransportadora(item) -
        valorContestadoFaturaTransportadora(item) -
        pagoAjustadoFaturaTransportadora(item),
      0
    )
  }

  function transportadoraFaturaTransportadora(item: any) {
    return campoFaturaTransportadora(item, ['transportadora', 'empresa', 'carrier']) || 'Não informado'
  }

  function nomeTransportadoraFaturaCurto(item: any) {
    const transportadora = normalizarBusca(transportadoraFaturaTransportadora(item))

    if (transportadora.includes('DHL')) return 'DHL'
    if (transportadora.includes('FEDEX') || transportadora.includes('FED EX')) return 'FedEx'

    return transportadoraFaturaTransportadora(item)
  }

  function ehDhlFedexFaturaTransportadora(item: any) {
    const transportadora = normalizarBusca(transportadoraFaturaTransportadora(item))

    return transportadora.includes('DHL') || transportadora.includes('FEDEX') || transportadora.includes('FED EX')
  }

  function faturaTransportadoraArquivada(item: any) {
    const flagArquivada = campoFaturaTransportadora(item, ['arquivada', 'arquivado', 'oculta', 'oculto'])
    return flagArquivada === true || ['TRUE', 'SIM', '1'].includes(normalizarBusca(flagArquivada))
  }

  function statusFaturaTransportadora(item: any) {
    // Mesma regra usada em /admin/faturas-transportadoras:
    // pagamento/situação paga primeiro, depois cancelada, contestada e só então vencida pela data.
    const situacao = normalizarBusca(campoFaturaTransportadora(item, ['situacao', 'situação', 'status']))

    if (pagamentoFaturaTransportadora(item)) return 'PAGA'
    if (situacao.includes('PAGO') || situacao.includes('PAGA') || situacao.includes('BAIXADO')) return 'PAGA'
    if (situacao.includes('CANCEL')) return 'FATURA CANCELADA'
    if (situacao.includes('CONTEST')) return 'CONTESTADA'

    const vencimento = vencimentoFaturaTransportadora(item)
    if (vencimento && vencimento < hojeIso()) return 'VENCIDA'

    return situacao || 'EM ABERTO'
  }

  function faturaTransportadoraAtiva(item: any) {
    return !faturaTransportadoraArquivada(item)
  }


  function dataBaseEmbarque(item: any) {
    return item.data_coleta || item.data_envio || item.criado_em || item.ultima_atualizacao || null
  }

  function clienteDoEmbarque(item: any) {
    const nome =
      item.importador ||
      item.exportador ||
      item.cliente_final ||
      item.cliente_nome ||
      item.empresa_nome ||
      'Não informado'

    return nomeCanonicoCliente(nome, mapaAliases) || 'Não informado'
  }

  function inicioDoDia(data: Date) {
    const d = new Date(data)
    d.setHours(0, 0, 0, 0)
    return d
  }

  function fimDoDia(data: Date) {
    const d = new Date(data)
    d.setHours(23, 59, 59, 999)
    return d
  }

  function chaveDia(data: Date) {
    const ano = data.getFullYear()
    const mes = String(data.getMonth() + 1).padStart(2, '0')
    const dia = String(data.getDate()).padStart(2, '0')
    return `${ano}-${mes}-${dia}`
  }

  function diaSemanaCurto(data: Date) {
    const dias = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
    return dias[data.getDay()] || '-'
  }

  function formatarDataGrafico(data: Date) {
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  function faixaPeriodoGrafico() {
    const hojeBase = inicioDoDia(new Date())

    if (periodoGrafico === '30D') {
      const inicio = new Date(hojeBase)
      inicio.setDate(inicio.getDate() - 29)
      return { inicio, fim: fimDoDia(hojeBase), label: 'Últimos 30 dias' }
    }

    if (periodoGrafico === 'MES_ATUAL') {
      const inicio = new Date(hojeBase.getFullYear(), hojeBase.getMonth(), 1)
      return { inicio, fim: fimDoDia(hojeBase), label: 'Mês atual' }
    }

    if (periodoGrafico === 'MES_ANTERIOR') {
      const inicio = new Date(hojeBase.getFullYear(), hojeBase.getMonth() - 1, 1)
      const fim = new Date(hojeBase.getFullYear(), hojeBase.getMonth(), 0)
      return { inicio, fim: fimDoDia(fim), label: 'Mês anterior' }
    }

    const inicio = new Date(hojeBase)
    inicio.setDate(inicio.getDate() - 6)
    return { inicio, fim: fimDoDia(hojeBase), label: 'Últimos 7 dias' }
  }

  const hoje = new Date()
  const anoAtual = String(hoje.getFullYear())
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const periodoCards = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(hoje)
  const detalhesRastreio: any[] = Array.isArray(ultimoRastreio?.detalhes)
    ? ultimoRastreio.detalhes
    : []
  // HC_RASTREIO_MANUAL_SEM_ERRO_V1: transportadora sem integração (agente de carga etc.) é rastreio manual, não erro.
  const rastreioManual = (erro: any) => /n[aã]o suportada/i.test(String(erro?.erro || ''))
  // HC_RASTREIO_EXPIRADO_V1: a DHL só consulta envios recentes (~90 dias). AWB antigo que volta "não encontrado"
  // não é erro real: vai para uma lista separada.
  const DIAS_RASTREIO_EXPIRADO = 90
  const dataEmbarquePorAwb = new Map<string, string>()
  for (const item of [...embarques, ...embarquesDiretos]) {
    const awb = String(item?.awb || '').replace(/\D/g, '')
    const data = dataBaseEmbarque(item)
    if (awb && data && !dataEmbarquePorAwb.has(awb)) dataEmbarquePorAwb.set(awb, String(data))
  }
  const diasDoEmbarqueRastreio = (erro: any) => {
    const data = dataEmbarquePorAwb.get(String(erro?.awb || '').replace(/\D/g, ''))
    if (!data) return null
    const tempo = new Date(data).getTime()
    return Number.isFinite(tempo) ? Math.floor((Date.now() - tempo) / 86400000) : null
  }
  const rastreioExpirado = (erro: any) => {
    if (rastreioManual(erro)) return false
    if (!/no shipment|not found|no result|"status":\s*404/i.test(String(erro?.erro || ''))) return false
    const dias = diasDoEmbarqueRastreio(erro)
    return dias !== null && dias > DIAS_RASTREIO_EXPIRADO
  }
  const errosRastreio = detalhesRastreio.filter((erro) => !rastreioManual(erro) && !rastreioExpirado(erro))
  const rastreiosManuais = detalhesRastreio.filter(rastreioManual)
  const rastreiosExpirados = detalhesRastreio.filter(rastreioExpirado)
  const totalErrosRastreio = detalhesRastreio.length > 0
    ? errosRastreio.length
    : Number(ultimoRastreio?.total_erro || 0)

  const financeiroResumo = useMemo(() => {
    const emAberto = financeiro.filter((item) => statusCobranca(item) === 'EM ABERTO')
    const atrasado = financeiro.filter((item) => statusCobranca(item) === 'ATRASADO')
    const pago = financeiro.filter((item) => statusCobranca(item) === 'PAGO')
    const aguardandoCusto = financeiro.filter((item) => aguardandoCustoProcesso(item))

    const pagosMes = financeiro.filter((item) => {
      if (statusCobranca(item) !== 'PAGO') return false

      const mesBase = item.mes_profit || mesDaData(item.recebimento) || mesDaData(item.vencimento_cobranca)
      return mesBase === mesAtual
    })

    // Entrada bruta de clientes. Não representa lucro nem caixa livre.
    const valorRecebidoMes = pagosMes.reduce((acc, item) => acc + numero(item.valor_cobranca), 0)

    // Profit bruto dos processos: recebido do cliente menos custos diretos do processo.
    const profitBrutoProcessosMes = pagosMes.reduce((acc, item) => {
      if (aguardandoCustoProcesso(item)) return acc
      return acc + calcularProfit(item)
    }, 0)

    const processosPagosSemCusto = pagosMes.filter((item) => aguardandoCustoProcesso(item))
    const movimentosMes = movimentacoes.filter((item) => item.mes_referencia === mesAtual)

    const despesasPagasMes = movimentosMes
      .filter((item) => item.tipo === 'DESPESA' && statusMovimento(item) === 'PAGO')
      .reduce((acc, item) => acc + numero(item.valor), 0)

    const emprestimosPagosMes = movimentosMes
      .filter((item) => item.tipo === 'PAGAMENTO_EMPRESTIMO' && statusMovimento(item) === 'PAGO')
      .reduce((acc, item) => acc + numero(item.valor), 0)

    const despesasEemprestimosPagosMes = despesasPagasMes + emprestimosPagosMes

    const despesasPendentesMes = movimentosMes
      .filter((item) => ['DESPESA', 'PAGAMENTO_EMPRESTIMO'].includes(item.tipo) && statusMovimento(item) !== 'PAGO')
      .reduce((acc, item) => acc + numero(item.valor), 0)

    const retiradasMarcosMes = movimentosMes
      .filter((item) =>
        ['RETIRADA_SOCIO', 'PAGAMENTO_SOCIO', 'REEMBOLSO_SOCIO'].includes(item.tipo) &&
        item.socio === 'MARCOS' &&
        statusMovimento(item) === 'PAGO'
      )
      .reduce((acc, item) => acc + numero(item.valor), 0)

    const retiradasHericaMes = movimentosMes
      .filter((item) =>
        ['RETIRADA_SOCIO', 'PAGAMENTO_SOCIO', 'REEMBOLSO_SOCIO'].includes(item.tipo) &&
        item.socio === 'HERICA' &&
        statusMovimento(item) === 'PAGO'
      )
      .reduce((acc, item) => acc + numero(item.valor), 0)

    const retiradasTotalMes = retiradasMarcosMes + retiradasHericaMes
    const lucroOperacionalMes = profitBrutoProcessosMes - despesasEemprestimosPagosMes
    const resultadoAposRetiradasMes = lucroOperacionalMes - retiradasTotalMes
    const reserva50PrevistaMes = lucroOperacionalMes > 0 ? lucroOperacionalMes * 0.5 : 0

    const reserva50LancadaMes = movimentosMes
      .filter((item) => ehReservaOperacionalFundo(item) && statusMovimento(item) === 'PAGO')
      .reduce((acc, item) => acc + numero(item.valor), 0)

    const reserva50PendenteMes = reserva50PrevistaMes - reserva50LancadaMes

    const movimentosFundoAnoAtual = movimentacoes.filter((item) => {
      if (statusMovimento(item) !== 'PAGO') return false
      if (!['FUNDO_CAIXA_ENTRADA', 'FUNDO_CAIXA_SAIDA', 'AJUSTE_CAIXA'].includes(item.tipo)) return false

      const mesReferencia = String(item.mes_referencia || '')
      if (/^\d{4}-\d{2}$/.test(mesReferencia)) return mesReferencia.startsWith(anoAtual)

      const dataBase =
        normalizarData(item.data_pagamento) ||
        normalizarData(item.data_vencimento) ||
        normalizarData(item.created_at)

      return String(dataBase || '').startsWith(anoAtual)
    })

    const fundoAtual = movimentosFundoAnoAtual.reduce((acc, item) => {
      if (item.tipo === 'FUNDO_CAIXA_ENTRADA') return acc + numero(item.valor)
      if (item.tipo === 'FUNDO_CAIXA_SAIDA') return acc - numero(item.valor)
      if (item.tipo === 'AJUSTE_CAIXA') return acc + numero(item.valor)
      return acc
    }, 0)

    const aReceber = emAberto.reduce((acc, item) => acc + numero(item.valor_cobranca), 0)
    const vencido = atrasado.reduce((acc, item) => acc + numero(item.valor_cobranca), 0)
    const totalAguardandoCusto = aguardandoCusto.reduce((acc, item) => acc + numero(item.valor_cobranca), 0)

    return {
      emAberto,
      atrasado,
      pago,
      aguardandoCusto,
      pagosMes,
      processosPagosSemCusto,
      valorRecebidoMes,
      profitRecebidoMes: profitBrutoProcessosMes,
      profitBrutoProcessosMes,
      despesasPagasMes,
      emprestimosPagosMes,
      despesasEemprestimosPagosMes,
      despesasPendentesMes,
      retiradasMarcosMes,
      retiradasHericaMes,
      retiradasTotalMes,
      lucroOperacionalMes,
      resultadoAposRetiradasMes,
      reserva50PrevistaMes,
      reserva50LancadaMes,
      reserva50PendenteMes,
      fundoAtual,
      aReceber,
      vencido,
      totalAguardandoCusto,
    }
  }, [financeiro, movimentacoes, mesAtual, anoAtual])

  const metaHc = useMemo(() => {
    const tiposRetirada = ['RETIRADA_SOCIO', 'PAGAMENTO_SOCIO', 'REEMBOLSO_SOCIO']
    const tiposBase = ['DESPESA', 'PAGAMENTO_EMPRESTIMO', ...tiposRetirada]
    const mesValido = (mes: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(mes)
    const registros = movimentacoes.filter((item) =>
      tiposBase.includes(item.tipo) &&
      !['CANCELADO', 'CANCELADA', 'EXCLUIDO', 'EXCLUIDA'].includes(String(item.status || '').toUpperCase())
    )
    const somar = (lista: any[], tipos: string[]) => lista
      .filter((item) => tipos.includes(item.tipo))
      .reduce((total, item) => total + numero(item.valor), 0)
    const meses = Array.from(new Set<string>(registros
      .filter((item) => statusMovimento(item) === 'PAGO')
      .map((item) => String(item.mes_referencia || ''))
      .filter((mes) => mesValido(mes) && mes < mesAtual))).sort()
    const anos = Array.from(new Set(meses.map((mes) => mes.slice(0, 4)))).sort().reverse()
    const historico = anos.map((ano) => {
      const mesesAno = meses.filter((mes) => mes.startsWith(ano + '-'))
      const pagos = registros.filter((item) => mesesAno.includes(String(item.mes_referencia || '')) && statusMovimento(item) === 'PAGO')
      const despesas = somar(pagos, ['DESPESA'])
      const emprestimos = somar(pagos, ['PAGAMENTO_EMPRESTIMO'])
      const retiradas = somar(pagos, tiposRetirada)
      const profit = financeiro.filter((item) => {
        const mes = item.mes_profit || mesDaData(item.recebimento) || mesDaData(item.vencimento_cobranca)
        return mesesAno.includes(mes) && statusCobranca(item) === 'PAGO' && !aguardandoCustoProcesso(item)
      }).reduce((total, item) => total + calcularProfit(item), 0)
      return { ano, meses: mesesAno.length, despesas, emprestimos, retiradas, profit,
        mediaDespesas: despesas / mesesAno.length,
        mediaEmprestimos: emprestimos / mesesAno.length,
        mediaRetiradas: retiradas / mesesAno.length }
    })
    // Usa o ano mais recente com meses anteriores registrados, sem incluir o mês em andamento.
    const base = historico[0]
    const atuais = registros.filter((item) => item.mes_referencia === mesAtual)
    const despesas = Math.max(base?.mediaDespesas || 0, somar(atuais, ['DESPESA']))
    const emprestimos = Math.max(base?.mediaEmprestimos || 0, somar(atuais, ['PAGAMENTO_EMPRESTIMO']))
    const retiradas = Math.max(base?.mediaRetiradas || 0, somar(atuais, tiposRetirada))
    // Regra já utilizada na dashboard: 50% do lucro operacional fica para reserva.
    // Para cobrir R de retiradas com os outros 50%, é necessário gerar 2R após as despesas.
    const reserva = retiradas
    const meta = Math.ceil((despesas + emprestimos + retiradas + reserva) * 100) / 100
    const realizado = financeiroResumo.profitBrutoProcessosMes
    const falta = Math.max(0, meta - realizado)
    const percentual = meta > 0 ? Math.max(0, realizado / meta * 100) : 0
    return { historico, base, despesas, emprestimos, retiradas, reserva, meta, realizado, falta, percentual }
  }, [movimentacoes, financeiro, financeiroResumo.profitBrutoProcessosMes, mesAtual])

  const faturasResumo = useMemo(() => {
    const limite = new Date(hojeIso() + 'T00:00:00')
    limite.setDate(limite.getDate() + DIAS_ALERTA_FATURAS)

    // Usa a mesma origem e a mesma lógica da aba /admin/faturas-transportadoras.
    // Não usa financeiro_embarques, porque ali ficam faturas/recebimentos de clientes.
    const todasDhlFedex = faturasTransportadoras.filter((item) => ehDhlFedexFaturaTransportadora(item))
    const ativas = todasDhlFedex.filter((item) => faturaTransportadoraAtiva(item))
    const abertas = ativas.filter((item) => statusFaturaTransportadora(item) === 'EM ABERTO')

    const proximas = abertas
      .filter((item) => {
        const vencimentoIso = vencimentoFaturaTransportadora(item)
        if (!vencimentoIso) return false

        const vencimento = new Date(vencimentoIso + 'T00:00:00')
        return vencimento >= new Date(hojeIso() + 'T00:00:00') && vencimento <= limite
      })
      .sort((a, b) => {
        const dataA = vencimentoFaturaTransportadora(a) || '9999-99-99'
        const dataB = vencimentoFaturaTransportadora(b) || '9999-99-99'
        return dataA.localeCompare(dataB)
      })

    // Espelha a tela Faturas DHL/FedEx: contestadas/canceladas/pagas não viram vencidas.
    const vencidas = ativas
      .filter((item) => statusFaturaTransportadora(item) === 'VENCIDA')
      .sort((a, b) => {
        const dataA = vencimentoFaturaTransportadora(a) || '9999-99-99'
        const dataB = vencimentoFaturaTransportadora(b) || '9999-99-99'
        return dataA.localeCompare(dataB)
      })

    const semData = abertas.filter((item) => !vencimentoFaturaTransportadora(item))
    const dhlProximas = proximas.filter((item) => nomeTransportadoraFaturaCurto(item) === 'DHL')
    const fedexProximas = proximas.filter((item) => nomeTransportadoraFaturaCurto(item) === 'FedEx')

    const hoje = hojeIso()
    const amanhaData = new Date(hoje + 'T00:00:00')
    amanhaData.setDate(amanhaData.getDate() + 1)
    const amanha = amanhaData.toISOString().slice(0, 10)

    const hojeVencem = abertas
      .filter((item) => vencimentoFaturaTransportadora(item) === hoje)
      .sort((a, b) => nomeTransportadoraFaturaCurto(a).localeCompare(nomeTransportadoraFaturaCurto(b), 'pt-BR'))

    const amanhaVencem = abertas
      .filter((item) => vencimentoFaturaTransportadora(item) === amanha)
      .sort((a, b) => nomeTransportadoraFaturaCurto(a).localeCompare(nomeTransportadoraFaturaCurto(b), 'pt-BR'))

    const totalAbertas = abertas.reduce((acc, item) => acc + saldoFaturaTransportadora(item), 0)
    const totalProximas = proximas.reduce((acc, item) => acc + saldoFaturaTransportadora(item), 0)
    const totalVencidas = vencidas.reduce((acc, item) => acc + saldoFaturaTransportadora(item), 0)
    const totalHoje = hojeVencem.reduce((acc, item) => acc + saldoFaturaTransportadora(item), 0)
    const totalAmanha = amanhaVencem.reduce((acc, item) => acc + saldoFaturaTransportadora(item), 0)

    return {
      todasDhlFedex,
      ativas,
      abertas,
      proximas,
      vencidas,
      semData,
      dhlProximas,
      fedexProximas,
      hojeVencem,
      amanhaVencem,
      totalAbertas,
      totalProximas,
      totalVencidas,
      totalHoje,
      totalAmanha,
    }
  }, [faturasTransportadoras])

  const conciliacaoTransportadoras = useMemo(() => {
    const financeirosPorId = new Map<string, any>()
    const financeirosPorAwb = new Map<string, any[]>()

    financeiro.forEach((processo: any) => {
      if (processo?.id) financeirosPorId.set(String(processo.id), processo)

      const awb = normalizarAwbConciliacao(processo?.awb)
      if (!awb) return

      const lista = financeirosPorAwb.get(awb) || []
      lista.push(processo)
      financeirosPorAwb.set(awb, lista)
    })

    const itensPorFatura = new Map<string, any[]>()

    itensFaturasTransportadoras.forEach((item: any) => {
      const faturaId = String(item?.fatura_transportadora_id || '')
      if (!faturaId) return
      if (itemCanceladoNaFatura(item)) return // HC_AWB_CANCELADO_FATURA_V1

      const lista = itensPorFatura.get(faturaId) || []
      lista.push(item)
      itensPorFatura.set(faturaId, lista)
    })

    function resumoDaFatura(fatura: any) {
      const itens = itensPorFatura.get(String(fatura?.id || '')) || []

      const detalhes = itens.map((item: any) => {
        const vinculado = item?.financeiro_embarque_id
          ? financeirosPorId.get(String(item.financeiro_embarque_id)) || null
          : null

        const candidatos = financeirosPorAwb.get(normalizarAwbConciliacao(item?.awb)) || []
        const processo =
          vinculado ||
          candidatos.find((registro: any) => !!registro?.recebimento) ||
          candidatos[0] ||
          null

        return {
          item,
          processo,
          recebido: !!processo?.recebimento,
        }
      })

      const recebidos = detalhes.filter((item: any) => item.recebido).length
      const naoLocalizados = detalhes.filter((item: any) => !item.processo).length
      const pendentes = detalhes.filter((item: any) => !!item.processo && !item.recebido).length

      const valorRecebido = detalhes.reduce(
        (acc: number, item: any) =>
          acc + (item.recebido ? numero(item.processo?.valor_cobranca) : 0),
        0
      )

      const valorPendente = detalhes.reduce(
        (acc: number, item: any) =>
          acc + (item.processo && !item.recebido ? numero(item.processo?.valor_cobranca) : 0),
        0
      )

      const totalFatura = totalFaturaTransportadora(fatura)
      const cobertura = totalFatura > 0 ? (valorRecebido / totalFatura) * 100 : 0
      const todosRecebidos =
        detalhes.length > 0 &&
        recebidos === detalhes.length &&
        naoLocalizados === 0
      const coberturaSuficiente =
        totalFatura <= 0 || valorRecebido + 0.01 >= totalFatura
      const prontaParaPagar =
        statusFaturaTransportadora(fatura) !== 'PAGA' &&
        todosRecebidos &&
        coberturaSuficiente
      // HC_PAGA_SEM_CONFERENCIA_V1: paga sem nenhum AWB (sem PDF importado) não é pendência.
      const pagaComPendencia =
        statusFaturaTransportadora(fatura) === 'PAGA' &&
        detalhes.length > 0 &&
        (!todosRecebidos || !coberturaSuficiente)

      return {
        fatura,
        totalItens: detalhes.length,
        recebidos,
        pendentes,
        naoLocalizados,
        valorRecebido,
        valorPendente,
        cobertura,
        prontaParaPagar,
        pagaComPendencia,
      }
    }

    const faturasDhlFedex = faturasTransportadoras.filter((item) =>
      ehDhlFedexFaturaTransportadora(item)
    )

    const resumos = faturasDhlFedex.map(resumoDaFatura)

    const prontasParaPagar = resumos.filter(
      (item) => item.prontaParaPagar && faturaTransportadoraAtiva(item.fatura)
    )

    /*
      Risco de capital de giro:
      considerar somente faturas cujo vencimento pertence
      ao ano corrente. Faturas de anos anteriores não devem
      contaminar o indicador "Pagas antes de receber".
    */
    const anoAtualConciliacao = String(
      new Date().getFullYear()
    )

    const pagasComPendencia = resumos.filter(
      (item) => {
        if (!item.pagaComPendencia) {
          return false
        }

        const vencimento =
          vencimentoFaturaTransportadora(
            item.fatura
          )

        if (!vencimento) {
          return false
        }

        return vencimento.startsWith(
          anoAtualConciliacao
        )
      }
    )

    const awbsPendentesPagos = pagasComPendencia.reduce(
      (acc, item) => acc + item.pendentes + item.naoLocalizados,
      0
    )

    const naoLocalizadosPagos = pagasComPendencia.reduce(
      (acc, item) => acc + item.naoLocalizados,
      0
    )

    const valorPendentePagos = pagasComPendencia.reduce(
      (acc, item) => acc + item.valorPendente,
      0
    )

    const totalProntasParaPagar = prontasParaPagar.reduce(
      (acc, item) => acc + saldoFaturaTransportadora(item.fatura),
      0
    )

    return {
      prontasParaPagar,
      pagasComPendencia,
      awbsPendentesPagos,
      naoLocalizadosPagos,
      valorPendentePagos,
      totalProntasParaPagar,
    }
  }, [faturasTransportadoras, itensFaturasTransportadoras, financeiro])


  const operacionalResumo = useMemo(() => {
    const statusEh = (item: any, termos: string[]) => {
      const status = normalizarBusca(item.status_operacional)
      return termos.some((termo) => status.includes(normalizarBusca(termo)))
    }

    const mes = new Date().getMonth()
    const ano = new Date().getFullYear()

    const embarquesMes = embarques.filter((e) => {
      const base = e.data_coleta || e.data_envio || e.criado_em
      if (!base) return false

      const data = new Date(base)
      return data.getMonth() === mes && data.getFullYear() === ano
    })

    const aguardandoColeta = embarques.filter((e) => statusEh(e, ['Aguardando coleta'])).length
    const coletados = embarques.filter((e) => statusEh(e, ['Coletado'])).length
    const transito = embarques.filter((e) => statusEh(e, ['Em trânsito', 'Em transito'])).length
    const fiscalizacao = embarques.filter((e) => statusEh(e, ['Fiscalização', 'Fiscalizacao'])).length
    const liberados = embarques.filter((e) => statusEh(e, ['Liberado'])).length
    const entregues = embarques.filter((e) => statusEh(e, ['Entregue'])).length
    const ativos = embarques.filter((e) => !statusEh(e, ['Entregue'])).length

    return {
      embarquesMes,
      aguardandoColeta,
      coletados,
      transito,
      fiscalizacao,
      liberados,
      entregues,
      ativos,
    }
  }, [embarques])

  const suporteResumo = useMemo(() => {
    return {
      abertos: suporte.filter((s) => s.status === 'ABERTO').length,
      analise: suporte.filter((s) => s.status === 'EM ANÁLISE').length,
      respondidos: suporte.filter((s) => s.status === 'RESPONDIDO').length,
      resolvidos: suporte.filter((s) => s.status === 'RESOLVIDO').length,
      ultimo: suporte[0],
    }
  }, [suporte])

  const cotacoesPendentes = useMemo(() => {
    return cotacoes.filter(
      (c) =>
        c.status === 'AGUARDANDO ANÁLISE' ||
        c.status === 'EM ANÁLISE' ||
        c.status === 'AGUARDANDO TRANSPORTADORA'
    ).length
  }, [cotacoes])

  const embarquesDiretosPendentes = useMemo(() => {
    return embarquesDiretos.filter((item) => {
      const status = normalizarBusca(
        item.status ||
          item.status_solicitacao ||
          item.status_operacional ||
          item.situacao ||
          ''
      )

      const flagArquivado = normalizarBusca(
        item.arquivado || item.arquivada || item.oculto || item.oculta || ''
      )

      const arquivado =
        item.arquivado === true ||
        item.arquivada === true ||
        item.oculto === true ||
        item.oculta === true ||
        ['SIM', 'TRUE', '1', 'ARQUIVADO', 'ARQUIVADA'].includes(flagArquivado) ||
        status.includes('ARQUIVAD')

      const convertido =
        status.includes('CONVERTID') ||
        status.includes('EMBARQUE CRIADO') ||
        status.includes('VIROU EMBARQUE') ||
        Boolean(
          item.embarque_id ||
            item.id_embarque ||
            item.embarque_convertido_id ||
            item.convertido_em_embarque_id
        )

      const recusado =
        status.includes('RECUSAD') ||
        status.includes('CANCELAD') ||
        status.includes('EXCLUID')

      return !arquivado && !convertido && !recusado
    })
  }, [embarquesDiretos])

  const clientesAtivos = usuarios.filter((u) => u.ativo !== false).length

  const pesoTotal = embarques.reduce(
    (acc, item) => acc + numero(item.peso_taxado || item.peso_real),
    0
  )

  const ultimosEmbarques = embarques.slice(0, 16)

  const alertasCriticos = useMemo(() => {
    const alertas: any[] = []

    if (embarquesDiretosPendentes.length > 0) {
      alertas.push({
        titulo: 'Embarque direto pendente',
        valor: embarquesDiretosPendentes.length,
        detalhe:
          embarquesDiretosPendentes.length === 1
            ? 'Aguardando converter em embarque ou arquivar'
            : 'Solicitações aguardando converter em embarque ou arquivar',
        icone: '🚚',
        cor: 'blue',
        href: '/admin/embarque-direto',
        acao: 'Ver solicitação',
      })
    }

    if (conciliacaoTransportadoras.pagasComPendencia.length > 0) {
      alertas.push({
        titulo: 'Pagamos antes de receber',
        valor: conciliacaoTransportadoras.pagasComPendencia.length,
        detalhe:
          `${conciliacaoTransportadoras.awbsPendentesPagos} AWB(s) pendente(s)` +
          ` • ${moeda(conciliacaoTransportadoras.valorPendentePagos)} ainda a receber` +
          (conciliacaoTransportadoras.naoLocalizadosPagos > 0
            ? ` • ${conciliacaoTransportadoras.naoLocalizadosPagos} não localizado(s)`
            : ''),
        icone: '🚨',
        cor: 'red',
        href: '/admin/faturas-transportadoras?origem=dashboard&conciliacao=PAGA_COM_PENDENCIA',
        acao: 'Cobrar recebimentos',
      })
    }

    if (faturasResumo.vencidas.length > 0) {
      alertas.push({
        titulo: 'Faturas DHL/FedEx vencidas',
        valor: faturasResumo.vencidas.length,
        detalhe: `${moeda(faturasResumo.totalVencidas)} em aberto`,
        icone: '🔴',
        cor: 'red',
        href: '/admin/faturas-transportadoras',
        acao: 'Regularizar agora',
      })
    }

    if (faturasResumo.hojeVencem.length > 0) {
      alertas.push({
        titulo: 'Faturas para pagar hoje',
        valor: moeda(faturasResumo.totalHoje),
        detalhe: `${faturasResumo.hojeVencem.length} fatura(s) DHL/FedEx vencem hoje`,
        icone: '🚨',
        cor: 'red',
        onClick: () => setModalFaturas(true),
        acao: 'Pagar hoje',
      })
    }

    if (faturasResumo.amanhaVencem.length > 0) {
      alertas.push({
        titulo: 'Faturas para pagar amanhã',
        valor: moeda(faturasResumo.totalAmanha),
        detalhe: `${faturasResumo.amanhaVencem.length} fatura(s) para se programar`,
        icone: '📅',
        cor: 'orange',
        onClick: () => setModalFaturas(true),
        acao: 'Programar',
      })
    }

    if (faturasResumo.proximas.length > 0) {
      alertas.push({
        titulo: 'Faturas DHL/FedEx próximas',
        valor: faturasResumo.proximas.length,
        detalhe: `Vencem em até ${DIAS_ALERTA_FATURAS} dias`,
        icone: '🟠',
        cor: 'orange',
        onClick: () => setModalFaturas(true),
        acao: 'Ver faturas',
      })
    }

    if (faturasResumo.semData.length > 0) {
      alertas.push({
        titulo: 'Faturas sem vencimento',
        valor: faturasResumo.semData.length,
        detalhe: 'DHL/FedEx sem data informada',
        icone: '⚪',
        cor: 'slate',
        onClick: () => setModalFaturas(true),
        acao: 'Conferir',
      })
    }

    if (financeiroResumo.lucroOperacionalMes < 0) {
      alertas.push({
        titulo: 'Mês negativo na operação',
        valor: moeda(financeiroResumo.lucroOperacionalMes),
        detalhe: 'Profit bruto menor que despesas e empréstimos',
        icone: '📉',
        cor: 'red',
        href: '/admin/financeiro?aba=RESULTADO',
        acao: 'Ver resultado',
      })
    }

    if (financeiroResumo.resultadoAposRetiradasMes < 0) {
      alertas.push({
        titulo: 'Negativo após retiradas',
        valor: moeda(financeiroResumo.resultadoAposRetiradasMes),
        detalhe: 'Mês ficou negativo depois das retiradas dos sócios',
        icone: '🚨',
        cor: 'red',
        href: '/admin/financeiro?aba=EXTRATO',
        acao: 'Ver sócios',
      })
    }

    const terceirosPendentesDashboard = (financeiro || []).filter((item: any) => {
      const valorTerceiro = numero(
        item.debito_terceiro ||
        item.terceiros ||
        item.profit_terceiros ||
        item.valor_terceiros
      )

      const statusTerceiro = String(
        item.pgta_terceiros ||
        item.pago_terceiros ||
        item.status_terceiro ||
        item.status_terceiros ||
        ''
      )
        .trim()
        .toUpperCase()

      return valorTerceiro > 0 && !statusTerceiro.includes('PAGO')
    })

    const totalTerceirosPendentesDashboard = terceirosPendentesDashboard.reduce(
      (total: number, item: any) =>
        total +
        numero(
          item.debito_terceiro ||
          item.terceiros ||
          item.profit_terceiros ||
          item.valor_terceiros
        ),
      0
    )

    if (totalTerceirosPendentesDashboard > 0) {
      alertas.push({
        titulo: 'Terceiros a pagar',
        valor: moeda(totalTerceirosPendentesDashboard),
        detalhe: `${terceirosPendentesDashboard.length} processo(s) com profit/parceiro pendente`,
        icone: '🤝',
        cor: 'orange',
        href: '/admin/parceiros',
        acao: 'Ver terceiros',
      })
    }

    if (financeiroResumo.aguardandoCusto.length > 0) {
      alertas.push({
        titulo: 'Processos aguardando custo',
        valor: financeiroResumo.aguardandoCusto.length,
        detalhe: `${moeda(financeiroResumo.totalAguardandoCusto)} sem compra`,
        icone: '⚠️',
        cor: 'yellow',
        href: '/admin/financeiro?aba=PROCESSOS&status=AGUARDANDO_CUSTO',
        acao: 'Lançar custo',
      })
    }

    if (financeiroResumo.atrasado.length > 0) {
      alertas.push({
        titulo: 'Clientes vencidos',
        valor: financeiroResumo.atrasado.length,
        detalhe: `${moeda(financeiroResumo.vencido)} a receber`,
        icone: '⏰',
        cor: 'red',
        href: '/admin/financeiro?aba=PROCESSOS&status=ATRASADO',
        acao: 'Cobrar',
      })
    }

    if (totalErrosRastreio > 0) {
      alertas.push({
        titulo: 'Rastreios com erro',
        valor: totalErrosRastreio,
        detalhe: 'Última execução',
        icone: '📡',
        cor: 'red',
        onClick: () => setModalErrosRastreio(true),
        acao: 'Ver erros',
      })
    }

    if (suporteResumo.abertos > 0) {
      alertas.push({
        titulo: 'Chamados abertos',
        valor: suporteResumo.abertos,
        detalhe: 'Aguardando resposta',
        icone: '💬',
        cor: 'purple',
        href: '/admin/suporte?status=ABERTO',
        acao: 'Responder',
      })
    }

    if (cotacoesPendentes > 0) {
      alertas.push({
        titulo: 'Cotações pendentes',
        valor: cotacoesPendentes,
        detalhe: 'Aguardando ação',
        icone: '📄',
        cor: 'blue',
        href: '/admin/cotacoes?status=PENDENTES',
        acao: 'Analisar',
      })
    }

    return alertas
  }, [
    faturasResumo,
    financeiroResumo,
    ultimoRastreio,
    suporteResumo.abertos,
    cotacoesPendentes,
    embarquesDiretosPendentes,
    conciliacaoTransportadoras,
  ])

  const ritmoOperacao = useMemo(() => {
    const { inicio, fim, label } = faixaPeriodoGrafico()
    const dias: any[] = []
    const mapaDias: Record<string, any> = {}

    const cursor = new Date(inicio)
    while (cursor <= fim) {
      const data = new Date(cursor)
      const key = chaveDia(data)

      const linha = {
        key,
        data,
        diaSemana: diaSemanaCurto(data),
        diaLabel: formatarDataGrafico(data),
        total: 0,
        peso: 0,
        clientes: new Set<string>(),
        embarques: [] as any[],
      }

      mapaDias[key] = linha
      dias.push(linha)
      cursor.setDate(cursor.getDate() + 1)
    }

    embarques.forEach((embarque) => {
      const base = dataBaseEmbarque(embarque)
      if (!base) return

      const data = new Date(base)
      if (isNaN(data.getTime())) return

      const dataDia = inicioDoDia(data)
      if (dataDia < inicio || dataDia > fim) return

      const key = chaveDia(dataDia)
      const linha = mapaDias[key]
      if (!linha) return

      const cliente = clienteDoEmbarque(embarque)
      linha.total += 1
      linha.peso += numero(embarque.peso_taxado || embarque.peso_real)
      linha.clientes.add(normalizarIdentidade(cliente) || cliente)
      linha.embarques.push(embarque)
    })

    const totalPeriodo = dias.reduce((acc, item) => acc + item.total, 0)
    const pesoPeriodo = dias.reduce((acc, item) => acc + item.peso, 0)
    const mediaDiaria = dias.length > 0 ? totalPeriodo / dias.length : 0
    const diasSemEmbarque = dias.filter((item) => item.total === 0).length
    const maiorDia = Math.max(...dias.map((item) => item.total), 1)
    const yMax = Math.max(5, Math.ceil(maiorDia / 5) * 5)
    const yTicks = Array.from({ length: Math.floor(yMax / 5) + 1 }, (_, index) => yMax - index * 5)
    const melhorDia = [...dias].sort((a, b) => b.total - a.total)[0] || null

    const mapaClientes: Record<string, { nome: string; nomes: string[]; total: number; peso: number }> = {}

    dias.forEach((dia) => {
      dia.embarques.forEach((embarque: any) => {
        const nome = clienteDoEmbarque(embarque)
        const chave = normalizarIdentidade(nome) || nome
        if (!mapaClientes[chave]) mapaClientes[chave] = { nome, nomes: [] as string[], total: 0, peso: 0 }
        mapaClientes[chave].nomes.push(nome)
        mapaClientes[chave].nome = nomeExibicaoPreferido(mapaClientes[chave].nomes) || nome
        mapaClientes[chave].total += 1
        mapaClientes[chave].peso += numero(embarque.peso_taxado || embarque.peso_real)
      })
    })

    const clientesOrdenados = Object.values(mapaClientes).sort((a, b) => b.total - a.total)
    const clienteMaisAtivo = clientesOrdenados[0] || null
    const clientesPeriodo = clientesOrdenados.length
    const concentracaoTopCliente =
      totalPeriodo > 0 && clienteMaisAtivo
        ? (clienteMaisAtivo.total / totalPeriodo) * 100
        : 0

    const melhorDiaTexto =
      melhorDia && melhorDia.total > 0
        ? `${melhorDia.diaLabel} (${melhorDia.diaSemana})`
        : '-'

    const analise =
      totalPeriodo === 0
        ? 'Nenhum embarque no período. Ação: revisar clientes parados, cotações abertas e prospecção.'
        : clientesPeriodo <= 3
          ? 'Pouco movimento no período. Ação: revisar clientes parados, cobrar follow-up e recuperar recorrência.'
          : concentracaoTopCliente >= 40
            ? `Atenção: ${clienteMaisAtivo?.nome} concentra ${concentracaoTopCliente.toFixed(0)}% dos embarques.`
            : diasSemEmbarque > dias.length * 0.45
              ? 'Operação irregular: muitos dias sem embarque. Ação: aumentar recorrência dos clientes ativos.'
              : `Volume dentro da média esperada. Pico em ${melhorDiaTexto}.`

    return {
      label,
      dias,
      totalPeriodo,
      pesoPeriodo,
      mediaDiaria,
      diasSemEmbarque,
      yMax,
      yTicks,
      melhorDia,
      melhorDiaTexto,
      clientesPeriodo,
      clienteMaisAtivo,
      concentracaoTopCliente,
      analise,
    }
  }, [embarques, periodoGrafico])

  const graficoFinanceiro = useMemo(() => {
    const meses: string[] = []

    for (let i = 5; i >= 0; i--) {
      const data = new Date()
      data.setMonth(data.getMonth() - i)
      meses.push(data.toISOString().slice(0, 7))
    }

    const linhas = meses.map((mes) => {
      const pagos = financeiro.filter((item) => {
        if (statusCobranca(item) !== 'PAGO') return false

        const mesBase = item.mes_profit || mesDaData(item.recebimento) || mesDaData(item.vencimento_cobranca)
        return mesBase === mes
      })

      const recebido = pagos.reduce((acc, item) => acc + numero(item.valor_cobranca), 0)
      const profit = pagos.reduce((acc, item) => {
        if (aguardandoCustoProcesso(item)) return acc
        return acc + calcularProfit(item)
      }, 0)

      return {
        mes,
        label: formatarMesCurto(mes),
        recebido,
        profit,
      }
    })

    const maior = Math.max(...linhas.map((item) => Math.max(item.recebido, item.profit)), 1)

    return {
      linhas,
      maior,
    }
  }, [financeiro])

  const statusOperacionais = useMemo(() => {
    const lista = [
      { nome: 'Aguardando coleta', total: operacionalResumo.aguardandoColeta, cor: 'orange' },
      { nome: 'Coletados', total: operacionalResumo.coletados, cor: 'purple' },
      { nome: 'Em trânsito', total: operacionalResumo.transito, cor: 'blue' },
      { nome: 'Fiscalização', total: operacionalResumo.fiscalizacao, cor: 'yellow' },
      { nome: 'Liberados', total: operacionalResumo.liberados, cor: 'green' },
      { nome: 'Entregues', total: operacionalResumo.entregues, cor: 'green' },
    ]

    const maior = Math.max(...lista.map((item) => item.total), 1)

    return { lista, maior }
  }, [operacionalResumo])

  function formatarMesCurto(valor: string) {
    if (!/^\d{4}-\d{2}$/.test(valor)) return valor

    const [, mes] = valor.split('-')
    const nomes: Record<string, string> = {
      '01': 'Jan',
      '02': 'Fev',
      '03': 'Mar',
      '04': 'Abr',
      '05': 'Mai',
      '06': 'Jun',
      '07': 'Jul',
      '08': 'Ago',
      '09': 'Set',
      '10': 'Out',
      '11': 'Nov',
      '12': 'Dez',
    }

    return nomes[mes] || mes
  }

  // HC_DASHBOARD_FOCO_V1: uma lista única de ações, ordenada por urgência.
  const acoesHoje = useMemo(() => {
    const prioridade: Record<string, number> = { red: 0, orange: 1, yellow: 1, purple: 2, blue: 2, green: 3, slate: 4 }
    const lista: any[] = [...alertasCriticos]
    if (conciliacaoTransportadoras.prontasParaPagar.length > 0) {
      lista.push({
        titulo: 'Faturas DHL/FedEx prontas para pagar',
        valor: moeda(conciliacaoTransportadoras.totalProntasParaPagar),
        detalhe: `${conciliacaoTransportadoras.prontasParaPagar.length} fatura(s) com todos os AWBs recebidos`,
        cor: 'green',
        href: '/admin/faturas-transportadoras?origem=dashboard&conciliacao=PRONTA_PARA_PAGAR',
        acao: 'Pagar',
      })
    }
    return lista
      .map((item, ordem) => ({ item, ordem }))
      .sort((a, b) => (prioridade[a.item.cor] ?? 5) - (prioridade[b.item.cor] ?? 5) || a.ordem - b.ordem)
      .map(({ item }) => item)
  }, [alertasCriticos, conciliacaoTransportadoras])

  return (
    <main className="min-h-screen bg-[#020817] text-white">
      <AdminUsuariosOnline />
      <section className="p-5 xl:p-5 overflow-auto">
        {/* HC_DASHBOARD_FOCO_V1: layout de uma tela. Cálculos e consultas inalterados. */}
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-2xl font-black tracking-tight">Dashboard</h1>
            <span className="text-sm font-semibold capitalize text-slate-400">{periodoCards}</span>
            <span className="text-xs text-slate-500">Atualizado {agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={alternarOcultarValores}
              aria-pressed={ocultarValores}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800"
            >
              {ocultarValores ? 'Mostrar valores' : 'Ocultar valores'}
            </button>
            <button
              type="button"
              onClick={atualizarTodosRastreios}
              disabled={rodandoRastreio}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-60"
            >
              {rodandoRastreio ? 'Rodando rastreio...' : 'Rodar rastreio'}
            </button>
            <button
              type="button"
              onClick={atualizarDadosManual}
              disabled={carregando}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-60"
            >
              {carregando ? 'Atualizando...' : 'Atualizar'}
            </button>
            <a href="/admin/embarques" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-500">
              Novo embarque
            </a>
          </div>
        </header>

        <section aria-label="Indicadores do mês" className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <IndicadorFoco
            titulo="A receber"
            valor={exibirValor(moeda(financeiroResumo.aReceber))}
            detalhe={financeiroResumo.vencido > 0 ? `${exibirValor(moeda(financeiroResumo.vencido))} vencido` : `${financeiroResumo.emAberto.length} processos em aberto`}
            tom={financeiroResumo.vencido > 0 ? 'perigo' : 'neutro'}
            href="/admin/financeiro?aba=PROCESSOS&status=EM%20ABERTO"
          />
          <IndicadorFoco
            titulo="Recebido no mês"
            valor={exibirValor(moeda(financeiroResumo.valorRecebidoMes))}
            detalhe={`${financeiroResumo.pagosMes.length} processos pagos`}
            href="/admin/financeiro?aba=RESULTADO"
          />
          <IndicadorFoco
            titulo="Profit bruto"
            valor={exibirValor(moeda(financeiroResumo.profitBrutoProcessosMes))}
            valorTom={financeiroResumo.profitBrutoProcessosMes < 0 ? 'perigo' : undefined}
            detalhe={metaHc.meta > 0 ? `${metaHc.percentual.toFixed(0)}% da meta de ${exibirValor(moeda(metaHc.meta))}` : 'Meta sem base suficiente'}
            progresso={metaHc.meta > 0 ? metaHc.percentual : undefined}
            href="#detalhes-meta-hc"
          />
          <IndicadorFoco
            titulo="Resultado após retiradas"
            valor={exibirValor(moeda(financeiroResumo.resultadoAposRetiradasMes))}
            valorTom={financeiroResumo.resultadoAposRetiradasMes >= 0 ? 'sucesso' : 'perigo'}
            detalhe={`Antes das retiradas: ${exibirValor(moeda(financeiroResumo.lucroOperacionalMes))}`}
            dica={ocultarValores ? undefined : `Profit bruto ${moeda(financeiroResumo.profitBrutoProcessosMes)} − saídas da HC ${moeda(financeiroResumo.despesasEemprestimosPagosMes)} − retiradas ${moeda(financeiroResumo.retiradasTotalMes)} (Marcos ${moeda(financeiroResumo.retiradasMarcosMes)}, Hérica ${moeda(financeiroResumo.retiradasHericaMes)})`}
            href="/admin/financeiro?aba=EXTRATO"
          />
          <IndicadorFoco
            titulo="DHL/FedEx a pagar"
            valor={exibirValor(moeda(faturasResumo.totalAbertas))}
            detalhe={`Hoje ${exibirValor(moeda(faturasResumo.totalHoje))} · amanhã ${exibirValor(moeda(faturasResumo.totalAmanha))}`}
            tom={faturasResumo.vencidas.length > 0 || faturasResumo.hojeVencem.length > 0 ? 'perigo' : faturasResumo.amanhaVencem.length > 0 ? 'alerta' : 'neutro'}
            onClick={() => setModalFaturas(true)}
          />
        </section>

        <section className="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-[#071225] p-4 xl:col-span-2">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-base font-black">Precisa de ação hoje</h2>
              <span className="text-xs font-bold text-slate-400">
                {acoesHoje.length === 0 ? 'Nada pendente' : `${acoesHoje.length} item(ns)`}
              </span>
            </div>

            {acoesHoje.length === 0 ? (
              <p className="rounded-lg border border-emerald-900 bg-emerald-950/40 px-3 py-4 text-sm font-semibold text-emerald-300">
                Tudo em dia. Nenhuma pendência crítica agora.
              </p>
            ) : (
              <ul className="divide-y divide-slate-800">
                {(mostrarTodasAcoes ? acoesHoje : acoesHoje.slice(0, 6)).map((acao: any, index: number) => (
                  <li key={`${acao.titulo}-${index}`}>
                    <LinhaAcao acao={acao} valor={exibirValor(String(acao.valor ?? ''))} />
                  </li>
                ))}
              </ul>
            )}

            {acoesHoje.length > 6 && (
              <button
                type="button"
                onClick={() => setMostrarTodasAcoes((v) => !v)}
                className="mt-2 text-sm font-bold text-blue-400 hover:text-blue-300"
              >
                {mostrarTodasAcoes ? 'Mostrar menos' : `Ver todos (${acoesHoje.length})`}
              </button>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#071225] p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-base font-black">Operação agora</h2>
              <a href="/admin/embarques" className="text-xs font-bold text-blue-400 hover:text-blue-300">Embarques</a>
            </div>
            <ul className="divide-y divide-slate-800 text-sm">
              {statusOperacionais.lista.map((item) => (
                <li key={item.nome}>
                  <a
                    href={`/admin/embarques?origem=dashboard&status=${STATUS_EMBARQUE_URL[item.nome] || ''}`}
                    className="flex items-center justify-between py-2 hover:text-white"
                  >
                    <span className="text-slate-400">{item.nome}</span>
                    <span className={`font-black ${item.nome === 'Fiscalização' && item.total > 0 ? 'text-amber-300' : 'text-white'}`}>{item.total}</span>
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-2 border-t border-slate-800 pt-2 text-xs text-slate-400">
              Rastreio: {dataHoraBR(ultimoRastreio?.criado_em)} · {Number(ultimoRastreio?.total_sucesso || 0)} ok ·{' '}
              {totalErrosRastreio > 0 ? (
                <button type="button" onClick={() => setModalErrosRastreio(true)} className="font-bold text-red-300 hover:text-red-200">
                  {totalErrosRastreio} erro(s)
                </button>
              ) : (
                <span>0 erros</span>
              )}
              {rastreiosManuais.length > 0 && (
                <>
                  {' · '}
                  <button type="button" onClick={() => setModalErrosRastreio(true)} className="font-bold text-slate-300 hover:text-white">
                    {rastreiosManuais.length} manual(is)
                  </button>
                </>
              )}
              {rastreiosExpirados.length > 0 && (
                <>
                  {' · '}
                  <button type="button" onClick={() => setModalErrosRastreio(true)} className="font-bold text-slate-400 hover:text-white" title="Mais de 90 dias: a transportadora não retorna mais o rastreio">
                    {rastreiosExpirados.length} expirado(s)
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="mb-4 rounded-xl border border-slate-800 bg-[#071225] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-black">Receita x profit · últimos 6 meses</h2>
            <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> Receita</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Profit</span>
              <a href="/admin/financeiro?aba=RESULTADO" className="text-blue-400 hover:text-blue-300">Ver resultado</a>
            </div>
          </div>
          <div className="grid grid-cols-6 gap-3">
            {graficoFinanceiro.linhas.map((item) => (
              <div
                key={item.mes}
                className="flex flex-col items-center"
                title={ocultarValores ? item.label : `${item.label}: receita ${moeda(item.recebido)} · profit ${moeda(item.profit)}`}
              >
                <div className="flex h-24 w-full items-end justify-center gap-1">
                  <div className="w-1/3 max-w-6 rounded-t bg-blue-500" style={{ height: `${Math.max(2, Math.min((item.recebido / graficoFinanceiro.maior) * 100, 100))}%` }} />
                  <div
                    className={`w-1/3 max-w-6 rounded-t ${item.profit >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                    style={{ height: `${Math.max(2, Math.min((Math.abs(item.profit) / graficoFinanceiro.maior) * 100, 100))}%` }}
                  />
                </div>
                <p className="mt-1 text-xs font-bold text-slate-300">{item.label}</p>
                <p className="text-[11px] text-slate-500">{exibirValor(moeda(item.recebido))}</p>
              </div>
            ))}
          </div>
        </section>

        <details id="detalhes-meta-hc" className="mb-5 scroll-mt-6 rounded-2xl border border-violet-500/30 bg-[#071225] p-5 text-slate-200">
          <summary className="cursor-pointer font-black text-violet-200">Como a meta foi calculada • Histórico por ano</summary>
          <p className="mt-4 text-sm text-slate-400">
            Mês da meta: {mesAtual.slice(5)}/{mesAtual.slice(0, 4)}. {metaHc.base
              ? `Base: média de ${metaHc.base.meses} mês(es) com pagamentos registrados em ${metaHc.base.ano}, anteriores ao mês atual.`
              : 'Sem histórico de meses anteriores: estimativa provisória pelos compromissos lançados no mês.'}
            {' '}Para cada grupo, usamos o maior valor entre a média histórica e os lançamentos do mês, pagos ou pendentes.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-5">
            <div>Despesas previstas<strong className="mt-1 block">{moeda(metaHc.despesas)}</strong></div>
            <div>Empréstimos previstos<strong className="mt-1 block">{moeda(metaHc.emprestimos)}</strong></div>
            <div>Retiradas previstas<strong className="mt-1 block">{moeda(metaHc.retiradas)}</strong></div>
            <div>Reserva planejada<strong className="mt-1 block">{moeda(metaHc.reserva)}</strong></div>
            <div>Meta de profit<strong className="mt-1 block text-violet-300">{moeda(metaHc.meta)}</strong></div>
          </div>
          <p className="mt-4 text-sm">Profit realizado: <strong>{moeda(metaHc.realizado)}</strong>. A reserva segue a regra existente de 50% do lucro operacional: a outra metade cobre as retiradas previstas.</p>
          <p className="mt-2 text-xs text-amber-200">Estimativa baseada nos registros disponíveis. Meses sem pagamentos registrados não entram na média; meses incompletos podem reduzir a sugestão. Reserva planejada não representa saldo bancário nem transferência realizada.</p>
          {financeiroResumo.processosPagosSemCusto.length > 0 && <p className="mt-2 text-xs text-amber-200">Há processos pagos sem custo informado. Eles não entram no profit realizado até a conciliação.</p>}
          {metaHc.historico.length > 0 && <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="mb-3 text-left text-xs text-slate-400">Resumo gerencial dos meses da amostra. Valores pagos e classificados por mês de referência.</caption>
              <thead className="text-slate-400"><tr>
                {['Ano', 'Meses', 'Profit', 'Despesas', 'Empréstimos', 'Retiradas', 'Média mensal de saídas'].map((titulo) => <th key={titulo} className="whitespace-nowrap p-2">{titulo}</th>)}
              </tr></thead>
              <tbody>{metaHc.historico.map((ano) => <tr key={ano.ano} className="border-t border-slate-800">
                <td className="p-2">{ano.ano}{ano.ano === metaHc.base?.ano ? ' (base)' : ''}</td>
                <td className="p-2">{ano.meses}</td>
                <td className="whitespace-nowrap p-2">{moeda(ano.profit)}</td>
                <td className="whitespace-nowrap p-2">{moeda(ano.despesas)}</td>
                <td className="whitespace-nowrap p-2">{moeda(ano.emprestimos)}</td>
                <td className="whitespace-nowrap p-2">{moeda(ano.retiradas)}</td>
                <td className="whitespace-nowrap p-2">{moeda(ano.mediaDespesas + ano.mediaEmprestimos + ano.mediaRetiradas)}</td>
              </tr>)}</tbody>
            </table>
          </div>}
        </details>

        <footer className="py-5 text-center text-sm font-semibold text-slate-500">
          HC Connect © 2026 • Sistema desenvolvido por Marcos Paulo Otero
        </footer>
      </section>

      {modalErrosRastreio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-red-500 bg-[#071225] p-4 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-white">
                  🔍 Erros do Rastreio Automático
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Última execução: {dataHoraBR(ultimoRastreio?.criado_em)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalErrosRastreio(false)}
                className="rounded-xl bg-slate-800 px-4 py-2 font-black hover:bg-slate-700"
              >
                ✕
              </button>
            </div>

            {errosRastreio.length > 0 || rastreiosManuais.length > 0 || rastreiosExpirados.length > 0 ? (
              <div className="max-h-[60vh] space-y-4 overflow-auto">
                {errosRastreio.length === 0 && (
                  <p className="rounded-xl border border-green-800 bg-green-950/20 p-3 text-sm font-bold text-green-300">
                    Nenhum erro real na última execução.
                  </p>
                )}
                {errosRastreio.map((erro: any, index: number) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-red-900 bg-red-950/20 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-500">AWB</p>
                        <h3 className="text-xl font-black text-blue-400">
                          {erro.awb || '-'}
                        </h3>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-slate-500">
                          Transportadora
                        </p>
                        <p className="font-black text-white">
                          {erro.transportadora || '-'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs font-bold text-slate-500">Motivo</p>
                      <p className="mt-1 font-bold text-red-300">
                        {erro.erro || 'Erro não informado.'}
                      </p>
                    </div>
                  </div>
                ))}
                {rastreiosExpirados.length > 0 && (
                  <details className="rounded-2xl border border-slate-700 bg-slate-900/40 p-4">
                    <summary className="cursor-pointer font-black text-slate-200">
                      Rastreio expirado · {rastreiosExpirados.length} AWB(s) com mais de {DIAS_RASTREIO_EXPIRADO} dias (a transportadora não retorna mais)
                    </summary>
                    <p className="mt-2 text-xs text-slate-400">Atualize o status desses embarques manualmente (ex.: Entregue) para saírem do rastreio automático.</p>
                    <ul className="mt-3 space-y-1 text-sm text-slate-300">
                      {rastreiosExpirados.map((erro: any, index: number) => (
                        <li key={index} className="flex justify-between gap-3 border-b border-slate-800 py-1">
                          <span className="font-bold text-blue-300">{erro.awb || '-'}</span>
                          <span className="text-slate-400">{erro.transportadora || '-'} · {diasDoEmbarqueRastreio(erro)} dias</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {rastreiosManuais.length > 0 && (
                  <details className="rounded-2xl border border-slate-700 bg-slate-900/40 p-4">
                    <summary className="cursor-pointer font-black text-slate-200">
                      Rastreio manual · {rastreiosManuais.length} AWB(s) sem integração automática (agente de carga / outras)
                    </summary>
                    <ul className="mt-3 space-y-1 text-sm text-slate-300">
                      {rastreiosManuais.map((erro: any, index: number) => (
                        <li key={index} className="flex justify-between gap-3 border-b border-slate-800 py-1">
                          <span className="font-bold text-blue-300">{erro.awb || '-'}</span>
                          <span className="text-slate-400">{erro.transportadora || '-'}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-blue-900 bg-[#020817] p-4 text-center">
                <p className="text-slate-400">
                  Existem erros contabilizados, mas este log ainda não possui detalhes salvos.
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Rode novamente o rastreio automático para gravar os detalhes dos AWBs.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {modalFaturas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-5xl rounded-2xl border border-orange-500 bg-[#071225] p-4 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-white">
                  🚨 Faturas DHL/FedEx
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Controle de faturas próximas do vencimento para não perder prazo de pagamento.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalFaturas(false)}
                className="rounded-xl bg-slate-800 px-4 py-2 font-black hover:bg-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniBox titulo="A pagar hoje" valor={moeda(faturasResumo.totalHoje)} cor={faturasResumo.totalHoje > 0 ? 'red' : 'green'} />
              <MiniBox titulo="A pagar amanhã" valor={moeda(faturasResumo.totalAmanha)} cor={faturasResumo.totalAmanha > 0 ? 'orange' : 'green'} />
              <MiniBox titulo="Total em aberto" valor={moeda(faturasResumo.totalAbertas)} cor="blue" />
              <MiniBox titulo="Vencidas" valor={moeda(faturasResumo.totalVencidas)} cor="red" />
            </div>

            <div className="max-h-[62vh] overflow-auto rounded-2xl border border-blue-950">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-[#020817] text-slate-400">
                  <tr>
                    <th className="px-4 py-2 text-left font-black">Transportadora</th>
                    <th className="px-4 py-2 text-left font-black">Fatura</th>
                    <th className="px-4 py-2 text-left font-black">Conta</th>
                    <th className="px-4 py-2 text-left font-black">Banco</th>
                    <th className="px-4 py-2 text-left font-black">Saldo</th>
                    <th className="px-4 py-2 text-left font-black">Vencimento</th>
                    <th className="px-4 py-2 text-left font-black">Situação</th>
                    <th className="px-4 py-2 text-left font-black">Ação</th>
                  </tr>
                </thead>

                <tbody>
                  {[...faturasResumo.vencidas, ...faturasResumo.proximas, ...faturasResumo.semData].map((item) => {
                    const vencimento = vencimentoFaturaTransportadora(item)
                    const dias = diasAte(vencimento)
                    const status = statusFaturaTransportadora(item)

                    return (
                      <tr key={item.id} className="border-t border-blue-950">
                        <td className="px-4 py-2 font-bold">{nomeTransportadoraFaturaCurto(item)}</td>
                        <td className="px-4 py-2 font-black text-blue-300">{numeroFaturaTransportadora(item) || '-'}</td>
                        <td className="px-4 py-2">{contaFaturaTransportadora(item) || '-'}</td>
                        <td className="px-4 py-2">{bancoFaturaTransportadora(item) || '-'}</td>
                        <td className="px-4 py-2">{moeda(saldoFaturaTransportadora(item))}</td>
                        <td className="px-4 py-2">{dataBR(vencimento)}</td>
                        <td className="px-4 py-2">
                          {!vencimento ? (
                            <span className="rounded-full bg-slate-500/20 px-3 py-1 text-xs font-black text-slate-300">Sem data</span>
                          ) : status === 'VENCIDA' ? (
                            <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-black text-red-300">Vencida</span>
                          ) : (
                            <span className="rounded-full bg-orange-500/20 px-3 py-1 text-xs font-black text-orange-300">
                              {dias === 0 ? 'Vence hoje' : dias === 1 ? 'Vence amanhã' : `${dias} dias`}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <a
                            href={`/admin/faturas-transportadoras?busca=${encodeURIComponent(numeroFaturaTransportadora(item) || contaFaturaTransportadora(item) || '')}`}
                            className="font-black text-blue-400 hover:text-blue-300"
                          >
                            Abrir →
                          </a>
                        </td>
                      </tr>
                    )
                  })}

                  {[...faturasResumo.vencidas, ...faturasResumo.proximas, ...faturasResumo.semData].length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-5 text-center text-slate-500">
                        Nenhuma fatura DHL/FedEx vencida, próxima ou sem data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      <AdminRealtimeAlerts onRefresh={() => buscarDados(false)} />
    </main>
  )
}

function barraCor(cor: string) {
  if (cor === 'green') return 'bg-emerald-500'
  if (cor === 'yellow') return 'bg-yellow-500'
  if (cor === 'orange') return 'bg-orange-500'
  if (cor === 'purple') return 'bg-purple-500'
  if (cor === 'red') return 'bg-red-500'
  return 'bg-blue-600'
}

function HeroCard({ titulo, valor, detalhe, icone, cor, href, onClick, periodo, linhas }: any) {
  const classeCor =
    cor === 'green'
      ? 'from-emerald-500/20 to-emerald-900/10 border-emerald-500/40 text-emerald-300'
      : cor === 'red'
        ? 'from-red-500/20 to-red-900/10 border-red-500/40 text-red-300'
        : cor === 'orange'
          ? 'from-orange-500/20 to-orange-900/10 border-orange-500/40 text-orange-300'
          : 'from-blue-500/20 to-blue-900/10 border-blue-500/40 text-blue-300'

  const conteudo = (
    <div className={`h-full rounded-2xl border bg-gradient-to-br p-4 shadow-[0_0_35px_rgba(37,99,235,0.10)] ${classeCor}`}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] opacity-80">{titulo}</p>
          {periodo && <p className="mt-2 text-xs capitalize opacity-80">{periodo}</p>}
          <h2 className="mt-3 text-2xl font-black tracking-tight text-white">{valor}</h2>
        </div>

        <span className="text-xl">{icone}</span>
      </div>

      <p className="text-sm font-bold opacity-80">{detalhe}</p>
      {linhas?.length > 0 && (
        <dl className="mt-4 space-y-2 border-t border-white/10 pt-3 text-sm">
          {linhas.map((linha: { titulo: string; valor: string }) => (
            <div key={linha.titulo} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <dt className="opacity-80">{linha.titulo}</dt>
              <dd className="font-bold tabular-nums text-white">{linha.valor}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )

  if (href) return <a href={href} className="block h-full transition hover:scale-[1.01]">{conteudo}</a>
  if (onClick) return <button type="button" onClick={onClick} className="block h-full w-full bg-transparent p-0 text-left transition hover:scale-[1.01]">{conteudo}</button>

  return conteudo
}

function KpiCard({ titulo, valor, detalhe, icone, cor, href }: any) {
  const corNumero =
    cor === 'green'
      ? 'text-emerald-400'
      : cor === 'yellow'
        ? 'text-yellow-400'
        : cor === 'orange'
          ? 'text-orange-400'
          : cor === 'red'
            ? 'text-red-400'
            : 'text-blue-400'

  const conteudo = (
    <div className="flex justify-between items-start gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-400">{titulo}</p>
        <h2 className={`mt-3 text-xl font-black ${corNumero}`}>{valor}</h2>
        <p className="mt-2 truncate text-xs text-slate-500">{detalhe}</p>
      </div>

      <div className="text-xl">{icone}</div>
    </div>
  )

  const classe =
    'block rounded-2xl border border-blue-900 bg-[#071225] p-5 shadow-[0_0_25px_rgba(37,99,235,0.08)] transition hover:border-blue-400 hover:bg-blue-600/10'

  if (href) {
    return (
      <a href={href} className={classe}>
        {conteudo}
      </a>
    )
  }

  return <div className={classe}>{conteudo}</div>
}

function MiniBox({ titulo, valor, cor, href }: any) {
  const classes =
    cor === 'red'
      ? 'border-red-500/30 bg-red-500/10 text-red-300'
      : cor === 'yellow'
        ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
        : cor === 'orange'
          ? 'border-orange-500/30 bg-orange-500/10 text-orange-300'
          : cor === 'purple'
            ? 'border-purple-500/30 bg-purple-500/10 text-purple-300'
            : cor === 'green'
              ? 'border-green-500/30 bg-green-500/10 text-green-300'
              : cor === 'slate'
                ? 'border-slate-500/30 bg-slate-500/10 text-slate-300'
                : 'border-blue-500/30 bg-blue-500/10 text-blue-300'

  const conteudo = (
    <div className={`rounded-2xl border p-4 ${classes}`}>
      <h3 className="break-words text-xl xl:text-xl font-black">{valor}</h3>
      <p className="mt-1 text-xs font-bold opacity-80">{titulo}</p>
    </div>
  )

  if (href) return <a href={href} className="block transition hover:scale-[1.01]">{conteudo}</a>
  return conteudo
}

function AutoBox({ titulo, valor, cor, href, onClick }: any) {
  const classe =
    cor === 'green'
      ? 'text-green-400'
      : cor === 'red'
        ? 'text-red-400'
        : 'text-blue-400'

  const conteudo = (
    <div className="block rounded-2xl border border-blue-900 bg-[#020817] p-4 text-center transition hover:border-blue-400 hover:bg-blue-600/10">
      <h3 className={`text-xl font-black ${classe}`}>{valor}</h3>
      <p className="mt-1 text-xs text-slate-500">{titulo}</p>
    </div>
  )

  if (href) return <a href={href}>{conteudo}</a>
  if (onClick) return <button type="button" onClick={onClick} className="text-left">{conteudo}</button>
  return conteudo
}

function StatusPillDashboard({ status }: any) {
  const s = String(status || '').toLowerCase()

  let classe = 'bg-slate-700 text-slate-200 border-slate-500'
  let icone = '⚪'

  if (s.includes('entregue') || s.includes('delivered')) {
    classe = 'bg-green-600/20 text-green-300 border-green-500'
    icone = '✅'
  } else if (s.includes('trânsito') || s.includes('transito') || s.includes('transit')) {
    classe = 'bg-blue-600/20 text-blue-300 border-blue-500'
    icone = '🚚'
  } else if (s.includes('fiscal') || s.includes('liberação') || s.includes('liberacao') || s.includes('clearance')) {
    classe = 'bg-yellow-500/20 text-yellow-300 border-yellow-500'
    icone = '🛃'
  } else if (s.includes('liberado') || s.includes('released')) {
    classe = 'bg-emerald-600/20 text-emerald-300 border-emerald-500'
    icone = '🟢'
  } else if (s.includes('coletado') || s.includes('coleta') || s.includes('picked')) {
    classe = 'bg-purple-600/20 text-purple-300 border-purple-500'
    icone = '📦'
  } else if (s.includes('atrasado') || s.includes('vencido')) {
    classe = 'bg-red-600/20 text-red-300 border-red-500'
    icone = '🔴'
  } else if (s.includes('aguardando')) {
    classe = 'bg-orange-500/20 text-orange-300 border-orange-500'
    icone = '⏳'
  } else if (s.includes('análise') || s.includes('analise')) {
    classe = 'bg-yellow-500/20 text-yellow-300 border-yellow-500'
    icone = '🔎'
  } else if (s.includes('respondido')) {
    classe = 'bg-blue-600/20 text-blue-300 border-blue-500'
    icone = '💬'
  } else if (s.includes('resolvido')) {
    classe = 'bg-green-600/20 text-green-300 border-green-500'
    icone = '✅'
  } else if (s.includes('aberto')) {
    classe = 'bg-red-600/20 text-red-300 border-red-500'
    icone = '🔴'
  }

  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-black ${classe}`}>
      <span>{icone}</span>
      {status || '-'}
    </span>
  )
}

function AlertaAcao({ alerta }: any) {
  const cor =
    alerta.cor === 'red'
      ? 'border-red-500/30 bg-red-500/10 text-red-300'
      : alerta.cor === 'orange'
        ? 'border-orange-500/30 bg-orange-500/10 text-orange-300'
        : alerta.cor === 'yellow'
          ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
          : alerta.cor === 'purple'
            ? 'border-purple-500/30 bg-purple-500/10 text-purple-300'
            : alerta.cor === 'slate'
              ? 'border-slate-500/30 bg-slate-500/10 text-slate-300'
              : 'border-blue-500/30 bg-blue-500/10 text-blue-300'

  const conteudo = (
    <div className={`flex items-center justify-between gap-4 rounded-2xl border p-4 transition hover:bg-blue-600/10 ${cor}`}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-xl">{alerta.icone}</span>
        <div className="min-w-0">
          <p className="truncate font-black text-white">{alerta.titulo}</p>
          <p className="mt-1 text-xs font-semibold opacity-75">{alerta.detalhe}</p>
        </div>
      </div>

      <div className="text-right">
        <p className="text-xl font-black">{alerta.valor}</p>
        <p className="text-xs font-black opacity-75">{alerta.acao}</p>
      </div>
    </div>
  )

  if (alerta.href) return <a href={alerta.href}>{conteudo}</a>
  if (alerta.onClick) return <button type="button" onClick={alerta.onClick} className="text-left">{conteudo}</button>
  return conteudo
}

function LinhaResumo({ titulo, valor, cor }: any) {
  const classe =
    cor === 'green'
      ? 'text-emerald-400'
      : cor === 'red'
        ? 'text-red-400'
        : cor === 'yellow'
          ? 'text-yellow-400'
          : cor === 'orange'
            ? 'text-orange-400'
            : 'text-blue-400'

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-950 bg-[#020817] px-4 py-2">
      <p className="text-sm font-bold text-slate-400">{titulo}</p>
      <p className={`text-right text-sm font-black ${classe}`}>{valor}</p>
    </div>
  )
}

function PeriodoButton({ ativo, onClick, children }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        ativo
          ? 'rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white shadow-[0_0_14px_rgba(37,99,235,0.30)]'
          : 'rounded-xl border border-blue-900 bg-[#071225] px-4 py-2 text-xs font-black text-slate-200 hover:bg-blue-600/20'
      }
    >
      {children}
    </button>
  )
}

function MetricDashboard({ icone, valor, titulo, detalhe }: any) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-800 bg-[#020817] text-lg text-blue-400">
        {icone}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xl font-black leading-tight text-white">{valor}</p>
        <p className="mt-0.5 text-xs font-bold text-slate-200">{titulo}</p>
        <p className="text-[11px] font-semibold text-blue-200/50">{detalhe}</p>
      </div>
    </div>
  )
}

// HC_DASHBOARD_FOCO_V1: componentes do layout focado.
const STATUS_EMBARQUE_URL: Record<string, string> = {
  'Aguardando coleta': 'AGUARDANDO_COLETA',
  Coletados: 'COLETADO',
  'Em trânsito': 'EM_TRANSITO',
  Fiscalização: 'FISCALIZACAO',
  Liberados: 'LIBERADO',
  Entregues: 'ENTREGUE',
}

type TomFoco = 'neutro' | 'perigo' | 'alerta' | 'sucesso'

function corTomFoco(tom?: TomFoco) {
  if (tom === 'perigo') return 'text-red-300'
  if (tom === 'alerta') return 'text-amber-300'
  if (tom === 'sucesso') return 'text-emerald-300'
  return 'text-slate-400'
}

function IndicadorFoco({ titulo, valor, detalhe, tom, valorTom, progresso, dica, href, onClick }: {
  titulo: string
  valor: string
  detalhe?: string
  tom?: TomFoco
  valorTom?: TomFoco
  progresso?: number
  dica?: string
  href?: string
  onClick?: () => void
}) {
  const conteudo = (
    <>
      <p className="text-xs font-bold text-slate-400">{titulo}</p>
      <p className={`mt-1 truncate text-xl font-black tabular-nums ${valorTom && valorTom !== 'neutro' ? corTomFoco(valorTom) : 'text-white'}`}>{valor}</p>
      {typeof progresso === 'number' && (
        <div role="progressbar" aria-label={`${titulo}: progresso da meta`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, progresso))} className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, Math.max(0, progresso))}%` }} />
        </div>
      )}
      {detalhe && <p className={`mt-1 truncate text-xs font-semibold ${corTomFoco(tom)}`}>{detalhe}</p>}
    </>
  )
  const classe = 'block h-full rounded-xl border border-slate-800 bg-[#071225] p-4 text-left transition hover:border-slate-600'
  if (onClick) return <button type="button" onClick={onClick} title={dica} className={`${classe} w-full`}>{conteudo}</button>
  return <a href={href || '#'} title={dica} className={classe}>{conteudo}</a>
}

function LinhaAcao({ acao, valor }: { acao: any; valor: string }) {
  const ponto =
    acao.cor === 'red' ? 'bg-red-400'
      : acao.cor === 'orange' || acao.cor === 'yellow' ? 'bg-amber-400'
        : acao.cor === 'green' ? 'bg-emerald-400'
          : acao.cor === 'slate' ? 'bg-slate-500'
            : 'bg-blue-400'
  const conteudo = (
    <>
      <span className={`h-2 w-2 shrink-0 rounded-full ${ponto}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-white">{acao.titulo}</span>
        {acao.detalhe && <span className="block truncate text-xs text-slate-400">{acao.detalhe}</span>}
      </span>
      {valor && <span className="shrink-0 text-sm font-black tabular-nums text-slate-200">{valor}</span>}
      <span className="shrink-0 text-xs font-bold text-blue-400">{acao.acao || 'Abrir'} →</span>
    </>
  )
  const classe = 'flex w-full items-center gap-3 py-2 text-left hover:bg-slate-900/60'
  if (acao.onClick) return <button type="button" onClick={acao.onClick} className={classe}>{conteudo}</button>
  return <a href={acao.href || '#'} className={classe}>{conteudo}</a>
}
