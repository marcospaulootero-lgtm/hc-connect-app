'use client'

'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AdminRealtimeAlerts from '@/components/AdminRealtimeAlerts'

type PeriodoGrafico = '7D' | '30D' | 'MES_ATUAL' | 'MES_ANTERIOR'

const LOTE_SUPABASE = 1000
const DIAS_ALERTA_FATURAS = 7

export default function DashboardPage() {
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [embarques, setEmbarques] = useState<any[]>([])
  const [cotacoes, setCotacoes] = useState<any[]>([])
  const [suporte, setSuporte] = useState<any[]>([])
  const [financeiro, setFinanceiro] = useState<any[]>([])
  const [movimentacoes, setMovimentacoes] = useState<any[]>([])
  const [faturasTransportadoras, setFaturasTransportadoras] = useState<any[]>([])
  const [ultimoRastreio, setUltimoRastreio] = useState<any>(null)

  const [modalErrosRastreio, setModalErrosRastreio] = useState(false)
  const [modalFaturas, setModalFaturas] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [rodandoRastreio, setRodandoRastreio] = useState(false)
  const [agora, setAgora] = useState(new Date())
  const [periodoGrafico, setPeriodoGrafico] = useState<PeriodoGrafico>('7D')
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null)

  useEffect(() => {
    const timer = setInterval(() => {
      setAgora(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    buscarDados()

    const intervaloDashboard = setInterval(() => {
      buscarDados(false)
    }, 60000)

    return () => clearInterval(intervaloDashboard)
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
      suporteCarregado,
      financeiroCarregado,
      movimentacoesCarregadas,
      faturasTransportadorasCarregadas,
      logRastreioRes,
    ] = await Promise.all([
      supabase.from('perfis').select('*').order('nome'),
      carregarTodos('embarques', 'criado_em', false),
      carregarTodos('cotacoes', 'criado_em', false),
      carregarTodos('suporte', 'criado_em', false),
      carregarTodos('financeiro_embarques', 'vencimento_cobranca', true),
      carregarTodos('financeiro_movimentacoes', 'data_vencimento', false),
      carregarTodos('faturas_transportadoras'),
      supabase
        .from('logs_rastreio')
        .select('id, criado_em, total_processado, total_sucesso, total_erro, detalhes')
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (perfisRes.error) console.error('Erro ao carregar perfis:', perfisRes.error.message)
    if (logRastreioRes.error) console.error('Erro ao carregar log de rastreio:', logRastreioRes.error.message)

    setUsuarios(perfisRes.data || [])
    setEmbarques(embarquesCarregados || [])
    setCotacoes(cotacoesCarregadas || [])
    setSuporte(suporteCarregado || [])
    setFinanceiro(financeiroCarregado || [])
    setMovimentacoes(movimentacoesCarregadas || [])
    setFaturasTransportadoras(faturasTransportadorasCarregadas || [])
    setUltimoRastreio(logRastreioRes.data || null)

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
    return (
      item.importador ||
      item.exportador ||
      item.cliente_final ||
      item.cliente_nome ||
      item.empresa_nome ||
      'Não informado'
    )
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
  const errosRastreio = Array.isArray(ultimoRastreio?.detalhes)
    ? ultimoRastreio.detalhes
    : []

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

  const clientesAtivos = usuarios.filter((u) => u.ativo !== false).length

  const pesoTotal = embarques.reduce(
    (acc, item) => acc + numero(item.peso_taxado || item.peso_real),
    0
  )

  const ultimosEmbarques = embarques.slice(0, 7)

  const alertasCriticos = useMemo(() => {
    const alertas: any[] = []

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

    if (Number(ultimoRastreio?.total_erro || 0) > 0) {
      alertas.push({
        titulo: 'Rastreios com erro',
        valor: Number(ultimoRastreio?.total_erro || 0),
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
      linha.clientes.add(cliente)
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

    const mapaClientes: Record<string, { nome: string; total: number; peso: number }> = {}

    dias.forEach((dia) => {
      dia.embarques.forEach((embarque: any) => {
        const nome = clienteDoEmbarque(embarque)
        if (!mapaClientes[nome]) mapaClientes[nome] = { nome, total: 0, peso: 0 }
        mapaClientes[nome].total += 1
        mapaClientes[nome].peso += numero(embarque.peso_taxado || embarque.peso_real)
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
          ? 'Operação concentrada em poucos clientes. Ação: recuperar clientes parados e aumentar recorrência.'
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

  return (
    <main className="min-h-screen bg-[#020817] text-white">
      <section className="p-5 xl:p-8 overflow-auto">
        <header className="mb-8 flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-blue-300">
                Dashboard Executivo
              </span>

              <span className="text-sm font-bold text-slate-400">
                🕒 {agora.toLocaleString('pt-BR')}
              </span>
            </div>

            <h1 className="text-4xl xl:text-6xl font-black tracking-tight">
              HC Connect
            </h1>

            <p className="mt-3 max-w-3xl text-base xl:text-lg font-semibold text-slate-400">
              Central de controle da operação, financeiro, faturas DHL/FedEx, rastreio automático e pendências críticas da HC.
            </p>
          </div>

          <div className="flex h-fit flex-wrap gap-3">
            <button
              type="button"
              onClick={atualizarDadosManual}
              disabled={carregando}
              className="rounded-2xl bg-blue-600 px-5 py-4 font-black text-white shadow-[0_0_24px_rgba(37,99,235,0.25)] hover:bg-blue-500 disabled:opacity-60"
            >
              {carregando ? 'Atualizando...' : '↻ Atualizar dashboard'}
            </button>

            <button
              type="button"
              onClick={atualizarTodosRastreios}
              disabled={rodandoRastreio}
              className="rounded-2xl border border-blue-800 bg-[#071225] px-5 py-4 font-black text-blue-100 hover:bg-blue-600/20 disabled:opacity-60"
            >
              {rodandoRastreio ? 'Rodando rastreio...' : '📡 Rodar rastreio'}
            </button>

            <a href="/admin/embarques" className="rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white hover:bg-emerald-500">
              + Novo embarque
            </a>

            <a href="/admin/financeiro" className="rounded-2xl border border-slate-700 bg-slate-800 px-5 py-4 font-black text-white hover:bg-slate-700">
              Financeiro
            </a>
          </div>
        </header>

        <section className="mb-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-5">
          <HeroCard
            titulo="A receber"
            valor={moeda(financeiroResumo.aReceber)}
            detalhe={`${financeiroResumo.emAberto.length} processos em aberto`}
            icone="💰"
            cor="blue"
            href="/admin/financeiro?aba=PROCESSOS&status=EM%20ABERTO"
          />

          <HeroCard
            titulo="Recebido de clientes"
            valor={moeda(financeiroResumo.valorRecebidoMes)}
            detalhe={`${financeiroResumo.pagosMes.length} processos pagos no mês`}
            icone="✅"
            cor="green"
            href="/admin/financeiro?aba=RESULTADO"
          />

          <HeroCard
            titulo="Profit bruto"
            valor={moeda(financeiroResumo.profitBrutoProcessosMes)}
            detalhe={
              financeiroResumo.processosPagosSemCusto.length > 0
                ? `${financeiroResumo.processosPagosSemCusto.length} pagos sem custo`
                : 'Antes das despesas da HC'
            }
            icone="📈"
            cor={financeiroResumo.profitBrutoProcessosMes >= 0 ? 'green' : 'red'}
            href="/admin/financeiro?aba=RESULTADO"
          />

          <HeroCard
            titulo="Lucro operacional"
            valor={moeda(financeiroResumo.lucroOperacionalMes)}
            detalhe="Profit bruto - despesas - empréstimos"
            icone={financeiroResumo.lucroOperacionalMes >= 0 ? '🏦' : '📉'}
            cor={financeiroResumo.lucroOperacionalMes >= 0 ? 'green' : 'red'}
            href="/admin/financeiro?aba=EXTRATO"
          />

          <HeroCard
            titulo="Após retiradas"
            valor={moeda(financeiroResumo.resultadoAposRetiradasMes)}
            detalhe={`Marcos ${moeda(financeiroResumo.retiradasMarcosMes)} • Hérica ${moeda(financeiroResumo.retiradasHericaMes)}`}
            icone={financeiroResumo.resultadoAposRetiradasMes >= 0 ? '💵' : '🚨'}
            cor={financeiroResumo.resultadoAposRetiradasMes >= 0 ? 'green' : 'red'}
            href="/admin/financeiro?aba=EXTRATO"
          />

          <HeroCard
            titulo="Faturas DHL/FedEx em aberto"
            valor={moeda(faturasResumo.totalAbertas)}
            detalhe={`Hoje ${moeda(faturasResumo.totalHoje)} • Amanhã ${moeda(faturasResumo.totalAmanha)} • ${faturasResumo.abertas.length} abertas`}
            icone="🚨"
            cor={
              faturasResumo.vencidas.length > 0 || faturasResumo.hojeVencem.length > 0
                ? 'red'
                : faturasResumo.amanhaVencem.length > 0 || faturasResumo.proximas.length > 0
                  ? 'orange'
                  : 'green'
            }
            onClick={() => setModalFaturas(true)}
          />
        </section>

        <section className="mb-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-8 gap-4">
          <KpiCard titulo="Aguardando custo" valor={financeiroResumo.aguardandoCusto.length} detalhe={moeda(financeiroResumo.totalAguardandoCusto)} icone="⚠️" cor="orange" href="/admin/financeiro?aba=PROCESSOS&status=AGUARDANDO_CUSTO" />
          <KpiCard titulo="Vencidos" valor={financeiroResumo.atrasado.length} detalhe={moeda(financeiroResumo.vencido)} icone="⏰" cor="red" href="/admin/financeiro?aba=PROCESSOS&status=ATRASADO" />
          <KpiCard titulo="Aguardando coleta" valor={operacionalResumo.aguardandoColeta} detalhe="Pré-coleta" icone="📦" cor="orange" href="/admin/embarques?status=Aguardando%20coleta" />
          <KpiCard titulo="Em trânsito" valor={operacionalResumo.transito} detalhe="Em andamento" icone="🚚" cor="blue" href="/admin/embarques?status=Em%20tr%C3%A2nsito" />
          <KpiCard titulo="Fiscalização" valor={operacionalResumo.fiscalizacao} detalhe="Aguardando liberação" icone="🛃" cor="yellow" href="/admin/embarques?status=Fiscaliza%C3%A7%C3%A3o" />
          <KpiCard titulo="Liberados" valor={operacionalResumo.liberados} detalhe="Prontos para seguir" icone="✅" cor="green" href="/admin/embarques?status=Liberado" />
          <KpiCard titulo="Clientes ativos" valor={clientesAtivos} detalhe="Base ativa" icone="👥" cor="blue" href="/admin/usuarios" />
          <KpiCard titulo="Peso total" valor={`${pesoTotal.toFixed(2)} kg`} detalhe="Movimentado" icone="⚖️" cor="green" href="/admin/embarques" />
        </section>

        <section className="mb-8 grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 card">
            <div className="mb-6 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🚨</span>
                  <h2 className="text-2xl font-black">Alertas críticos</h2>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-400">
                  Pendências que podem gerar atraso, perda de prazo ou distorção financeira.
                </p>
              </div>

              <span className={`w-fit rounded-full px-4 py-2 text-xs font-black ${
                alertasCriticos.length > 0
                  ? 'border border-red-500/40 bg-red-500/10 text-red-300'
                  : 'border border-green-500/40 bg-green-500/10 text-green-300'
              }`}>
                {alertasCriticos.length > 0 ? `${alertasCriticos.length} alerta(s)` : 'Sem alerta crítico'}
              </span>
            </div>

            {alertasCriticos.length === 0 ? (
              <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5 text-green-200">
                <p className="font-black">Tudo controlado agora.</p>
                <p className="mt-1 text-sm font-semibold opacity-80">
                  Sem faturas próximas, vencidos críticos, rastreios com erro ou chamados abertos.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {alertasCriticos.slice(0, 8).map((alerta, index) => (
                  <AlertaAcao key={index} alerta={alerta} />
                ))}
              </div>
            )}
          </div>

          <div className="xl:col-span-4 card">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">📄</span>
                  <h2 className="text-2xl font-black">DHL/FedEx</h2>
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  Valores em aberto, vencimentos de hoje e programação de amanhã.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalFaturas(true)}
                className="rounded-xl border border-blue-800 bg-blue-600/10 px-3 py-2 text-xs font-black text-blue-300 hover:bg-blue-600/20"
              >
                Ver
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <MiniBox titulo="A pagar hoje" valor={moeda(faturasResumo.totalHoje)} cor={faturasResumo.totalHoje > 0 ? 'red' : 'green'} />
              <MiniBox titulo="A pagar amanhã" valor={moeda(faturasResumo.totalAmanha)} cor={faturasResumo.totalAmanha > 0 ? 'orange' : 'green'} />
              <MiniBox titulo="Total em aberto" valor={moeda(faturasResumo.totalAbertas)} cor="blue" />
              <MiniBox titulo={`Próx. ${DIAS_ALERTA_FATURAS} dias`} valor={moeda(faturasResumo.totalProximas)} cor="yellow" />
            </div>

            <div className="space-y-3">
              {faturasResumo.proximas.slice(0, 4).map((item) => {
                const vencimento = vencimentoFaturaTransportadora(item)
                const dias = diasAte(vencimento)

                return (
                  <a
                    key={item.id}
                    href={`/admin/faturas-transportadoras?busca=${encodeURIComponent(numeroFaturaTransportadora(item) || contaFaturaTransportadora(item) || '')}`}
                    className="block rounded-2xl border border-blue-950 bg-[#020817] p-4 transition hover:border-blue-500 hover:bg-blue-600/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">{nomeTransportadoraFaturaCurto(item)}</p>
                        <p className="mt-1 font-black text-blue-300">Fatura {numeroFaturaTransportadora(item) || '-'}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">Conta {contaFaturaTransportadora(item) || '-'}</p>
                      </div>

                      <span className={`rounded-full px-3 py-1 text-xs font-black ${
                        Number(dias) <= 1
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-orange-500/20 text-orange-300'
                      }`}>
                        {dias === 0 ? 'Hoje' : dias === 1 ? 'Amanhã' : `${dias} dias`}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-xs font-bold text-slate-400">
                      <span>Vencimento: {dataBR(vencimento)}</span>
                      <span className="text-emerald-300">Saldo: {moeda(saldoFaturaTransportadora(item))}</span>
                    </div>
                  </a>
                )
              })}

              {faturasResumo.proximas.length === 0 && (
                <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4">
                  <p className="font-black text-green-300">Nenhuma fatura DHL/FedEx próxima.</p>
                  <p className="mt-1 text-xs font-semibold text-green-200/70">
                    Confira também as faturas sem data para evitar falha de controle.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mb-8 grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="card">
            <div className="mb-6 flex items-center gap-3">
              <span className="text-3xl">💳</span>
              <div>
                <h2 className="text-2xl font-black">Painel financeiro</h2>
                <p className="text-sm text-slate-400">Resultado rápido do mês atual.</p>
              </div>
            </div>

            <div className="space-y-3">
              <LinhaResumo titulo="Recebido de clientes" valor={moeda(financeiroResumo.valorRecebidoMes)} cor="green" />
              <LinhaResumo titulo="Profit bruto dos processos" valor={moeda(financeiroResumo.profitBrutoProcessosMes)} cor={financeiroResumo.profitBrutoProcessosMes >= 0 ? 'green' : 'red'} />
              <LinhaResumo titulo="Despesas + empréstimos pagos" valor={moeda(financeiroResumo.despesasEemprestimosPagosMes)} cor="red" />
              <LinhaResumo titulo="Lucro operacional" valor={moeda(financeiroResumo.lucroOperacionalMes)} cor={financeiroResumo.lucroOperacionalMes >= 0 ? 'green' : 'red'} />
              <LinhaResumo titulo="Retiradas Marcos" valor={moeda(financeiroResumo.retiradasMarcosMes)} cor="orange" />
              <LinhaResumo titulo="Retiradas Hérica" valor={moeda(financeiroResumo.retiradasHericaMes)} cor="orange" />
              <LinhaResumo titulo="Resultado após retiradas" valor={moeda(financeiroResumo.resultadoAposRetiradasMes)} cor={financeiroResumo.resultadoAposRetiradasMes >= 0 ? 'green' : 'red'} />
              <LinhaResumo titulo="Reserva 50% prevista" valor={moeda(financeiroResumo.reserva50PrevistaMes)} cor="blue" />
              <LinhaResumo titulo="Reserva 50% lançada" valor={moeda(financeiroResumo.reserva50LancadaMes)} cor="blue" />
              <LinhaResumo titulo="Fundo atual do ano" valor={moeda(financeiroResumo.fundoAtual)} cor="blue" />
            </div>

            <a href="/admin/financeiro" className="mt-6 block text-right font-black text-blue-400 hover:text-blue-300">
              Abrir financeiro →
            </a>
          </div>

          <div className="card">
            <div className="mb-6 flex items-center gap-3">
              <span className="text-3xl">📡</span>
              <div>
                <h2 className="text-2xl font-black">Rastreio automático</h2>
                <p className="text-sm text-slate-400">Última execução registrada.</p>
              </div>
            </div>

            <div className="mb-4 rounded-2xl border border-blue-950 bg-[#020817] p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Última execução</p>
              <p className="mt-1 text-lg font-black text-blue-300">{dataHoraBR(ultimoRastreio?.criado_em)}</p>
            </div>

            <div className="mb-4 rounded-2xl border border-blue-950 bg-[#020817] p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Próxima execução estimada</p>
              <p className="mt-1 text-lg font-black text-emerald-300">{proximaAtualizacao(ultimoRastreio?.criado_em)}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <AutoBox titulo="Processados" valor={ultimoRastreio?.total_processado || 0} cor="blue" href="/admin/intelligence" />
              <AutoBox titulo="Sucessos" valor={ultimoRastreio?.total_sucesso || 0} cor="green" href="/admin/intelligence?tipo=sucesso" />
              <AutoBox titulo="Erros" valor={ultimoRastreio?.total_erro || 0} cor="red" onClick={() => setModalErrosRastreio(true)} />
            </div>

            <p className="mt-4 text-xs font-semibold text-slate-500">
              Configuração exibida considerando execução a cada 30 minutos.
            </p>
          </div>

          <div className="card">
            <div className="mb-6 flex items-center gap-3">
              <span className="text-3xl">🎧</span>
              <div>
                <h2 className="text-2xl font-black">Suporte e cotações</h2>
                <p className="text-sm text-slate-400">Atendimento e demanda comercial.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MiniBox titulo="Chamados abertos" valor={suporteResumo.abertos} cor="red" href="/admin/suporte?status=ABERTO" />
              <MiniBox titulo="Em análise" valor={suporteResumo.analise} cor="yellow" href="/admin/suporte?status=EM%20AN%C3%81LISE" />
              <MiniBox titulo="Respondidos" valor={suporteResumo.respondidos} cor="blue" href="/admin/suporte?status=RESPONDIDO" />
              <MiniBox titulo="Cotações pendentes" valor={cotacoesPendentes} cor="purple" href="/admin/cotacoes?status=PENDENTES" />
            </div>

            <div className="mt-5 rounded-2xl border border-blue-950 bg-[#020817] p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Último chamado</p>

              {suporteResumo.ultimo ? (
                <>
                  <p className="mt-2 font-black text-blue-300">{suporteResumo.ultimo.assunto || 'Chamado sem assunto'}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{suporteResumo.ultimo.email || 'Cliente não informado'}</p>
                </>
              ) : (
                <p className="mt-2 text-sm font-semibold text-slate-500">Nenhum chamado recebido.</p>
              )}
            </div>
          </div>
        </section>

        <section className="mb-8 grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="card overflow-hidden bg-gradient-to-br from-[#071225] via-[#061126] to-[#020817] shadow-[0_0_28px_rgba(37,99,235,0.10)]">
            <div className="mb-4 flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-1 text-blue-500">
                  <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                    <rect x="4" y="17" width="4" height="10" rx="1" fill="currentColor" />
                    <rect x="11" y="10" width="4" height="17" rx="1" fill="currentColor" />
                    <rect x="18" y="5" width="4" height="22" rx="1" fill="currentColor" />
                    <rect x="25" y="14" width="4" height="13" rx="1" fill="currentColor" />
                  </svg>
                </div>

                <div>
                  <h2 className="text-2xl font-black tracking-tight">Ritmo da operação</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Volume por dia, concentração de clientes e pontos de ação.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <PeriodoButton ativo={periodoGrafico === '7D'} onClick={() => setPeriodoGrafico('7D')}>7 dias</PeriodoButton>
                <PeriodoButton ativo={periodoGrafico === '30D'} onClick={() => setPeriodoGrafico('30D')}>30 dias</PeriodoButton>
                <PeriodoButton ativo={periodoGrafico === 'MES_ATUAL'} onClick={() => setPeriodoGrafico('MES_ATUAL')}>Mês atual</PeriodoButton>
                <PeriodoButton ativo={periodoGrafico === 'MES_ANTERIOR'} onClick={() => setPeriodoGrafico('MES_ANTERIOR')}>Mês anterior</PeriodoButton>
              </div>
            </div>

            <div className="rounded-2xl border border-blue-950/70 bg-[#030b1d]/70 p-3 overflow-hidden">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-blue-200">Embarques</p>
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">{ritmoOperacao.label}</p>
              </div>

              <div className="relative h-[210px] overflow-hidden">
                <div className="absolute left-0 top-0 bottom-9 w-8 flex flex-col justify-between text-xs font-bold text-blue-200/70">
                  {ritmoOperacao.yTicks.map((tick) => (
                    <span key={tick}>{tick}</span>
                  ))}
                </div>

                <div className="absolute left-9 right-0 top-0 bottom-9 border-l border-b border-blue-900/80">
                  {ritmoOperacao.yTicks.map((tick) => (
                    <div
                      key={tick}
                      className="absolute left-0 right-0 border-t border-dashed border-blue-700/35"
                      style={{ top: `${((ritmoOperacao.yMax - tick) / ritmoOperacao.yMax) * 100}%` }}
                    />
                  ))}

                  <div
                    className="absolute inset-x-0 bottom-0 top-0 grid items-end gap-2 px-3"
                    style={{ gridTemplateColumns: `repeat(${Math.max(ritmoOperacao.dias.length, 1)}, minmax(0, 1fr))` }}
                  >
                    {ritmoOperacao.dias.map((item) => {
                      const altura = `${Math.max((item.total / ritmoOperacao.yMax) * 145, item.total > 0 ? 7 : 3)}px`
                      const ativo = diaSelecionado === item.key

                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setDiaSelecionado(ativo ? null : item.key)}
                          className="group relative flex h-full min-w-0 flex-col items-center justify-end"
                          title={`${item.diaSemana} ${item.diaLabel}: ${item.total} embarque(s) • ${item.peso.toFixed(2)} kg`}
                        >
                          <span className="mb-1 text-sm font-black text-white drop-shadow opacity-100">
                            {item.total}
                          </span>

                          <span
                            className={
                              ativo
                                ? 'w-full max-w-[44px] rounded-t-md bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.40)] ring-2 ring-emerald-300 transition'
                                : item.total > 0
                                  ? 'w-full max-w-[44px] rounded-t-md bg-gradient-to-t from-blue-700 to-blue-400 shadow-[0_0_18px_rgba(37,99,235,0.30)] transition hover:from-blue-600 hover:to-blue-300'
                                  : 'w-full max-w-[44px] rounded-t-md bg-blue-950/80 transition hover:bg-blue-900'
                            }
                            style={{ height: altura }}
                          />

                          <span className="pointer-events-none absolute -top-10 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-xl border border-blue-800 bg-[#071225] px-3 py-2 text-xs font-black text-blue-100 shadow-2xl group-hover:block">
                            {item.diaSemana} {item.diaLabel} • {item.total} embarque(s)
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div
                  className="absolute left-9 right-0 bottom-0 grid gap-2 px-3 text-center"
                  style={{ gridTemplateColumns: `repeat(${Math.max(ritmoOperacao.dias.length, 1)}, minmax(0, 1fr))` }}
                >
                  {ritmoOperacao.dias.map((item) => (
                    <div key={item.key} className="min-w-0">
                      <p className="truncate text-[10px] font-black text-blue-100/80">{item.diaSemana}</p>
                      <p className="truncate text-[10px] font-bold text-blue-200/60">{item.diaLabel}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-y border-blue-950 py-3">
              <MetricDashboard icone="🚚" valor={String(ritmoOperacao.totalPeriodo)} titulo="Total período" detalhe="Embarques" />
              <MetricDashboard icone="📈" valor={ritmoOperacao.mediaDiaria.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} titulo="Média diária" detalhe="Embarques/dia" />
              <MetricDashboard icone="🗓️" valor={String(ritmoOperacao.diasSemEmbarque)} titulo="Dias sem embarque" detalhe="No período" />
              <MetricDashboard icone="⚖️" valor={`${ritmoOperacao.pesoPeriodo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`} titulo="Peso período" detalhe="Total embarcado" />
            </div>

            <div className="mt-4 rounded-2xl border border-blue-900 bg-[#020817]/80 p-3 flex items-start gap-3">
              <div className="text-xl text-blue-400">✦</div>
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-blue-400">Análise automática</p>
                <p className="mt-1 text-xs font-semibold text-slate-200 leading-relaxed">{ritmoOperacao.analise}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="card">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black">Receita x Profit</h2>
                  <p className="mt-1 text-sm text-slate-400">Últimos 6 meses pagos.</p>
                </div>
                <a href="/admin/financeiro?aba=RESULTADO" className="text-sm font-black text-blue-400">Ver resultado</a>
              </div>

              <div className="space-y-4">
                {graficoFinanceiro.linhas.map((item) => (
                  <div key={item.mes}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-slate-200">{item.label}</p>
                      <p className="text-xs font-bold text-slate-400">
                        {moeda(item.recebido)} / {moeda(item.profit)}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="h-3 rounded-full bg-[#020817] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: `${Math.min((item.recebido / graficoFinanceiro.maior) * 100, 100)}%` }}
                        />
                      </div>

                      <div className="h-3 rounded-full bg-[#020817] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.profit >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min((Math.abs(item.profit) / graficoFinanceiro.maior) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex gap-4 text-xs font-black text-slate-400">
                <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-blue-600" /> Receita</span>
                <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" /> Profit</span>
              </div>
            </div>

            <div className="card">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black">Status operacional</h2>
                  <p className="mt-1 text-sm text-slate-400">Distribuição atual dos embarques.</p>
                </div>
                <a href="/admin/embarques" className="text-sm font-black text-blue-400">Ver embarques</a>
              </div>

              <div className="space-y-4">
                {statusOperacionais.lista.map((item) => (
                  <div key={item.nome}>
                    <div className="mb-2 flex justify-between">
                      <span className="text-sm font-bold text-slate-300">{item.nome}</span>
                      <span className="text-sm font-black text-white">{item.total}</span>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-[#020817]">
                      <div
                        className={`h-full rounded-full ${barraCor(item.cor)}`}
                        style={{ width: `${Math.min((item.total / statusOperacionais.maior) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8 grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="card">
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-2xl font-black">Últimos embarques</h2>
              <a href="/admin/embarques" className="text-blue-400 font-bold">
                Ver todos
              </a>
            </div>

            <div className="overflow-auto">
              <table className="w-full min-w-[860px]">
                <thead>
                  <tr className="border-b border-blue-950 text-left text-slate-400">
                    <th className="pb-4">AWB</th>
                    <th className="pb-4">Exportador</th>
                    <th className="pb-4">Importador</th>
                    <th className="pb-4">Transportadora</th>
                    <th className="pb-4">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {ultimosEmbarques.map((item) => (
                    <tr key={item.id} className="border-b border-blue-950">
                      <td className="py-4 font-bold text-blue-400">
                        <a href={`/admin/embarques/${item.id}`} className="hover:underline">
                          {item.awb || '-'}
                        </a>
                      </td>
                      <td className="py-4">{item.exportador || '-'}</td>
                      <td className="py-4">{item.importador || '-'}</td>
                      <td className="py-4">{item.transportadora || '-'}</td>
                      <td className="py-4">
                        <StatusPillDashboard status={item.status_operacional || '-'} />
                      </td>
                    </tr>
                  ))}

                  {ultimosEmbarques.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        Nenhum embarque encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-2xl font-black">Pendências financeiras recentes</h2>
              <a href="/admin/financeiro?aba=PROCESSOS" className="text-blue-400 font-bold">
                Ver financeiro
              </a>
            </div>

            <div className="space-y-3">
              {[
                ...faturasResumo.vencidas.map((item) => ({ tipo: 'FATURA_TRANSPORTADORA', item })),
                ...faturasResumo.proximas.map((item) => ({ tipo: 'FATURA_TRANSPORTADORA', item })),
                ...financeiroResumo.aguardandoCusto.map((item) => ({ tipo: 'PROCESSO_FINANCEIRO', item })),
              ].slice(0, 8).map(({ tipo, item }) => {
                const ehFaturaTransportadora = tipo === 'FATURA_TRANSPORTADORA'
                const vencimento = ehFaturaTransportadora
                  ? vencimentoFaturaTransportadora(item)
                  : normalizarData(item.vencimento_cobranca)
                const status = ehFaturaTransportadora
                  ? statusFaturaTransportadora(item)
                  : statusCobranca(item)
                const semCusto = !ehFaturaTransportadora && aguardandoCustoProcesso(item)
                const href = ehFaturaTransportadora
                  ? `/admin/faturas-transportadoras?busca=${encodeURIComponent(numeroFaturaTransportadora(item) || contaFaturaTransportadora(item) || '')}`
                  : `/admin/financeiro?aba=PROCESSOS&busca=${encodeURIComponent(item.fatura || item.awb || item.cliente || '')}`

                return (
                  <a
                    key={`${tipo}-${item.id}-${status}-${semCusto}`}
                    href={href}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border border-blue-950 bg-[#020817] p-4 transition hover:border-blue-500 hover:bg-blue-600/10"
                  >
                    <div>
                      <p className="font-black text-blue-300">
                        {ehFaturaTransportadora ? `Fatura ${numeroFaturaTransportadora(item) || '-'}` : item.cliente || 'Cliente não informado'}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {ehFaturaTransportadora
                          ? `${nomeTransportadoraFaturaCurto(item)} • Conta ${contaFaturaTransportadora(item) || '-'} • Saldo ${moeda(saldoFaturaTransportadora(item))}`
                          : `AWB ${item.awb || '-'} • Fatura ${item.fatura || '-'} • ${item.transportadora || '-'}`}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {semCusto && <span className="rounded-full bg-orange-500/20 px-3 py-1 text-xs font-black text-orange-300">Sem custo</span>}
                      {vencimento && <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-black text-blue-300">{dataBR(vencimento)}</span>}
                      <StatusPillDashboard status={status} />
                    </div>
                  </a>
                )
              })}

              {[...faturasResumo.vencidas, ...faturasResumo.proximas, ...financeiroResumo.aguardandoCusto].length === 0 && (
                <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5 text-green-300">
                  <p className="font-black">Sem pendência financeira crítica agora.</p>
                  <p className="mt-1 text-sm font-semibold opacity-80">
                    Nenhuma fatura vencida/próxima ou processo sem custo nos principais alertas.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <footer className="py-8 text-center text-sm font-semibold text-slate-500">
          HC Connect © 2026 • Sistema desenvolvido por Marcos Paulo Otero
        </footer>
      </section>

      {modalErrosRastreio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-red-500 bg-[#071225] p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-white">
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

            {errosRastreio.length > 0 ? (
              <div className="max-h-[60vh] space-y-4 overflow-auto">
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
              </div>
            ) : (
              <div className="rounded-2xl border border-blue-900 bg-[#020817] p-6 text-center">
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
          <div className="w-full max-w-5xl rounded-3xl border border-orange-500 bg-[#071225] p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-white">
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

            <div className="mb-5 grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniBox titulo="A pagar hoje" valor={moeda(faturasResumo.totalHoje)} cor={faturasResumo.totalHoje > 0 ? 'red' : 'green'} />
              <MiniBox titulo="A pagar amanhã" valor={moeda(faturasResumo.totalAmanha)} cor={faturasResumo.totalAmanha > 0 ? 'orange' : 'green'} />
              <MiniBox titulo="Total em aberto" valor={moeda(faturasResumo.totalAbertas)} cor="blue" />
              <MiniBox titulo="Vencidas" valor={moeda(faturasResumo.totalVencidas)} cor="red" />
            </div>

            <div className="max-h-[62vh] overflow-auto rounded-2xl border border-blue-950">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-[#020817] text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left font-black">Transportadora</th>
                    <th className="px-4 py-3 text-left font-black">Fatura</th>
                    <th className="px-4 py-3 text-left font-black">Conta</th>
                    <th className="px-4 py-3 text-left font-black">Banco</th>
                    <th className="px-4 py-3 text-left font-black">Saldo</th>
                    <th className="px-4 py-3 text-left font-black">Vencimento</th>
                    <th className="px-4 py-3 text-left font-black">Situação</th>
                    <th className="px-4 py-3 text-left font-black">Ação</th>
                  </tr>
                </thead>

                <tbody>
                  {[...faturasResumo.vencidas, ...faturasResumo.proximas, ...faturasResumo.semData].map((item) => {
                    const vencimento = vencimentoFaturaTransportadora(item)
                    const dias = diasAte(vencimento)
                    const status = statusFaturaTransportadora(item)

                    return (
                      <tr key={item.id} className="border-t border-blue-950">
                        <td className="px-4 py-3 font-bold">{nomeTransportadoraFaturaCurto(item)}</td>
                        <td className="px-4 py-3 font-black text-blue-300">{numeroFaturaTransportadora(item) || '-'}</td>
                        <td className="px-4 py-3">{contaFaturaTransportadora(item) || '-'}</td>
                        <td className="px-4 py-3">{bancoFaturaTransportadora(item) || '-'}</td>
                        <td className="px-4 py-3">{moeda(saldoFaturaTransportadora(item))}</td>
                        <td className="px-4 py-3">{dataBR(vencimento)}</td>
                        <td className="px-4 py-3">
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
                        <td className="px-4 py-3">
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
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
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

function HeroCard({ titulo, valor, detalhe, icone, cor, href, onClick }: any) {
  const classeCor =
    cor === 'green'
      ? 'from-emerald-500/20 to-emerald-900/10 border-emerald-500/40 text-emerald-300'
      : cor === 'red'
        ? 'from-red-500/20 to-red-900/10 border-red-500/40 text-red-300'
        : cor === 'orange'
          ? 'from-orange-500/20 to-orange-900/10 border-orange-500/40 text-orange-300'
          : 'from-blue-500/20 to-blue-900/10 border-blue-500/40 text-blue-300'

  const conteudo = (
    <div className={`h-full rounded-3xl border bg-gradient-to-br p-6 shadow-[0_0_35px_rgba(37,99,235,0.10)] ${classeCor}`}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] opacity-80">{titulo}</p>
          <h2 className="mt-3 text-3xl xl:text-4xl font-black tracking-tight text-white">{valor}</h2>
        </div>

        <span className="text-4xl">{icone}</span>
      </div>

      <p className="text-sm font-bold opacity-80">{detalhe}</p>
    </div>
  )

  if (href) return <a href={href} className="block h-full transition hover:scale-[1.01]">{conteudo}</a>
  if (onClick) return <button type="button" onClick={onClick} className="block h-full text-left transition hover:scale-[1.01]">{conteudo}</button>

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
        <h2 className={`mt-3 text-3xl font-black ${corNumero}`}>{valor}</h2>
        <p className="mt-2 truncate text-xs text-slate-500">{detalhe}</p>
      </div>

      <div className="text-3xl">{icone}</div>
    </div>
  )

  const classe =
    'block rounded-3xl border border-blue-900 bg-[#071225] p-5 shadow-[0_0_25px_rgba(37,99,235,0.08)] transition hover:border-blue-400 hover:bg-blue-600/10'

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
      <h3 className="break-words text-xl xl:text-2xl font-black">{valor}</h3>
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
      <h3 className={`text-2xl font-black ${classe}`}>{valor}</h3>
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
        <span className="text-2xl">{alerta.icone}</span>
        <div className="min-w-0">
          <p className="truncate font-black text-white">{alerta.titulo}</p>
          <p className="mt-1 text-xs font-semibold opacity-75">{alerta.detalhe}</p>
        </div>
      </div>

      <div className="text-right">
        <p className="text-2xl font-black">{alerta.valor}</p>
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
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-950 bg-[#020817] px-4 py-3">
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
