'use client'

import Link from 'next/link'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { formatarEntradaValorBR, numeroValorBR } from '@/lib/valorContabil'

type FaturaTransportadora = {
  id: string
  transportadora: string
  conta: string | null
  numero_fatura: string | null
  emissao: string | null
  vencimento: string | null
  data_pagamento: string | null
  utilizado_para: string | null
  dias_restantes: string | null
  status_recebimento_fatura: string | null
  status_contestacao: string | null
  diferenca_fatura: number | null
  situacao: string | null
  total: number | null
  valor_contestado: number | null
  pago_ajustado: number | null
  saldo: number | null
  moeda: string | null
  arquivo_pdf: string | null
  observacoes: string | null
  arquivada: boolean | null
  criado_em: string | null
  atualizado_em: string | null
}

type ItemFaturaConciliacao = {
  id: string
  fatura_transportadora_id: string
  awb: string | null
  valor_compra: number | null
  financeiro_embarque_id: string | null
}

type ProcessoFinanceiroConciliacao = {
  id: string
  awb: string | null
  cliente: string | null
  valor_cobranca: number | null
  recebimento: string | null
}

type StatusConciliacao =
  | 'SEM_CONCILIACAO'
  | 'AGUARDANDO_RECEBIMENTO'
  | 'COBERTURA_INSUFICIENTE'
  | 'PRONTA_PARA_PAGAR'
  | 'PAGA_COM_PENDENCIA'
  | 'PAGA_COBERTA'

type ItemConciliado = {
  item: ItemFaturaConciliacao
  processo: ProcessoFinanceiroConciliacao | null
  recebido: boolean
}

type ResumoConciliacao = {
  status: StatusConciliacao
  itens: ItemConciliado[]
  totalItens: number
  recebidos: number
  pendentes: number
  naoLocalizados: number
  valorRecebido: number
  valorPendente: number
  cobertura: number
  todosRecebidos: boolean
  coberturaSuficiente: boolean
  liberadaPagamento: boolean
}

type ItemImportacaoPdf = {
  awb: string
  referencia: string | null
  data_envio: string | null
  valor_compra: number
  processo_encontrado?: boolean
  financeiro_id?: string | null
  valor_compra_atual?: number | null
  cliente?: string | null
}

type PreviewImportacaoPdf = {
  transportadora: string
  conta: string | null
  numero_fatura: string
  emissao: string | null
  vencimento: string | null
  valor_total: number
  itens: ItemImportacaoPdf[]
}

type FormState = {
  transportadora: string
  conta: string
  numero_fatura: string
  emissao: string
  vencimento: string
  data_pagamento: string
  utilizado_para: string
  situacao: string
  total: string
  valor_contestado: string
  pago_ajustado: string
  saldo: string
  moeda: string
  observacoes: string
}

const formVazio: FormState = {
  transportadora: 'DHL',
  conta: '',
  numero_fatura: '',
  emissao: '',
  vencimento: '',
  data_pagamento: '',
  utilizado_para: '',
  situacao: 'EM ABERTO',
  total: '',
  valor_contestado: '',
  pago_ajustado: '',
  saldo: '',
  moeda: 'BRL',
  observacoes: '',
}

const STORAGE_BUCKET = 'faturas'

export default function FaturasTransportadorasPage() {
  const [faturas, setFaturas] = useState<FaturaTransportadora[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [arquivoPdfImportacao, setArquivoPdfImportacao] = useState<File | null>(null)
  const [previewPdf, setPreviewPdf] = useState<PreviewImportacaoPdf | null>(null)
  const [importandoPdf, setImportandoPdf] = useState(false)
  const [confirmandoPdf, setConfirmandoPdf] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>(formVazio)
  const [busca, setBusca] = useState('')
  const [filtroTransportadoras, setFiltroTransportadoras] = useState<string[]>([])
  const [filtroSituacoes, setFiltroSituacoes] = useState<string[]>([])
  const [filtroArquivadas, setFiltroArquivadas] = useState('ATIVAS')
  const [filtroPrazo, setFiltroPrazo] = useState('')
  const [filtroDashboard, setFiltroDashboard] = useState('')
  const [ultimaAlteracao, setUltimaAlteracao] = useState('')
  const [selecionadas, setSelecionadas] = useState<string[]>([])
  const [itensConciliacao, setItensConciliacao] = useState<ItemFaturaConciliacao[]>([])
  const [financeirosConciliacao, setFinanceirosConciliacao] = useState<ProcessoFinanceiroConciliacao[]>([])
  const [filtroConciliacao, setFiltroConciliacao] = useState('TODAS')
  const [faturaConciliacaoAberta, setFaturaConciliacaoAberta] = useState<string | null>(null)

  useEffect(() => {
    const salvo = localStorage.getItem('hc_faturas_transportadoras_filtros')

    if (salvo) {
      try {
        const dados = JSON.parse(salvo)
        setBusca(dados.busca || '')

        const transportadorasSalvas = Array.isArray(dados.filtroTransportadoras)
          ? dados.filtroTransportadoras
          : dados.filtroTransportadora && dados.filtroTransportadora !== 'TODAS'
            ? [dados.filtroTransportadora]
            : []

        const situacoesSalvas = Array.isArray(dados.filtroSituacoes)
          ? dados.filtroSituacoes
          : dados.filtroSituacao && dados.filtroSituacao !== 'TODAS'
            ? [dados.filtroSituacao]
            : []

        setFiltroTransportadoras(transportadorasSalvas)
        setFiltroSituacoes(situacoesSalvas)
        setFiltroArquivadas(dados.filtroArquivadas || 'ATIVAS')
        setFiltroPrazo(dados.filtroPrazo || '')
        setFiltroConciliacao(dados.filtroConciliacao || 'TODAS')
        setUltimaAlteracao(dados.ultimaAlteracao || '')
      } catch (error) {
        console.log('Erro ao carregar filtros salvos:', error)
      }
    }

    aplicarFiltrosDaDashboard()
    carregar()
  }, [])

  useEffect(() => {
    const dados = {
      busca,
      filtroTransportadoras,
      filtroSituacoes,
      filtroArquivadas,
      filtroPrazo,
      filtroConciliacao,
      ultimaAlteracao: new Date().toLocaleString('pt-BR'),
    }

    localStorage.setItem('hc_faturas_transportadoras_filtros', JSON.stringify(dados))
    setUltimaAlteracao(dados.ultimaAlteracao)
  }, [busca, filtroTransportadoras, filtroSituacoes, filtroArquivadas, filtroPrazo, filtroConciliacao])


  function aplicarFiltrosDaDashboard() {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const origemDashboard = params.get('origem') === 'dashboard' || params.get('dash') === '1'

    if (!origemDashboard) return

    const buscaUrl = params.get('busca') || ''
    const transportadoraUrl = params.get('transportadora') || ''
    const situacaoUrl = params.get('situacao') || ''
    const arquivadasUrl = params.get('arquivadas') || ''
    const prazoUrl = params.get('prazo') || ''
    const conciliacaoUrl = params.get('conciliacao') || ''

    setBusca(buscaUrl)
    setFiltroTransportadoras(transportadoraUrl ? [transportadoraUrl] : [])
    setFiltroSituacoes(situacaoUrl ? [situacaoUrl] : [])
    setFiltroArquivadas(arquivadasUrl || 'ATIVAS')
    setFiltroPrazo(prazoUrl)
    setFiltroConciliacao(conciliacaoUrl || 'TODAS')

    const partes = [
      situacaoUrl ? `situação ${situacaoUrl}` : '',
      prazoUrl ? `prazo ${nomeFiltroPrazo(prazoUrl)}` : '',
      transportadoraUrl ? `transportadora ${transportadoraUrl}` : '',
      conciliacaoUrl ? `conciliação ${textoStatusConciliacao(conciliacaoUrl as StatusConciliacao)}` : '',
      buscaUrl ? `busca ${buscaUrl}` : '',
    ].filter(Boolean)

    setFiltroDashboard(partes.length ? `Dashboard: ${partes.join(' • ')}` : 'Dashboard: faturas filtradas')
  }

  function nomeFiltroPrazo(valor: string) {
    const nomes: Record<string, string> = {
      HOJE: 'vence hoje',
      AMANHA: 'vence amanhã',
      PROXIMOS_7_DIAS: 'próximos 7 dias',
      VENCIDAS: 'vencidas',
      SEM_DATA: 'sem vencimento',
    }

    return nomes[valor] || valor
  }

  function diasAteVencimento(item: FaturaTransportadora) {
    const vencimento = String(item.vencimento || '').slice(0, 10)
    if (!vencimento) return null

    const hoje = new Date(`${hojeISO()}T00:00:00`)
    const dataVencimento = new Date(`${vencimento}T00:00:00`)

    return Math.ceil((dataVencimento.getTime() - hoje.getTime()) / 86400000)
  }

  function passaFiltroPrazo(item: FaturaTransportadora) {
    if (!filtroPrazo) return true

    const vencimento = String(item.vencimento || '').slice(0, 10)
    const dias = diasAteVencimento(item)
    const status = situacaoAutomatica(item)

    if (filtroPrazo === 'SEM_DATA') return !vencimento

    if (dias === null) return false

    if (filtroPrazo === 'VENCIDAS') {
      return status === 'VENCIDA'
    }

    const podeVencer =
      status !== 'PAGA' &&
      status !== 'VENCIDA' &&
      status !== 'CONTESTADA' &&
      status !== 'FATURA CANCELADA'

    if (!podeVencer) return false

    if (filtroPrazo === 'HOJE') return dias === 0
    if (filtroPrazo === 'AMANHA') return dias === 1

    if (filtroPrazo === 'PROXIMOS_7_DIAS') {
      return dias >= 0 && dias <= 7
    }

    return true
  }

  function escolherArquivoPdfDhl() {
    return new Promise<File | null>((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'application/pdf'

      input.onchange = () => {
        resolve(input.files?.[0] || null)
      }

      input.click()
    })
  }

  function dinheiroPdfDhl(valor: any) {
    const numeroValor = Number(valor || 0)
    return numeroValor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  async function importarPdfDhlSeparado() {
    const arquivo = await escolherArquivoPdfDhl()
    if (!arquivo) return

    try {
      setImportandoPdf(true)

      const formData = new FormData()
      formData.append('arquivo', arquivo)
      formData.append('file', arquivo)
      formData.append('pdf', arquivo)

      const resposta = await fetch('/api/faturas-transportadoras/importar-pdf-dhl', {
        method: 'POST',
        body: formData,
      })

      const dados = await resposta.json().catch(() => ({}))

      if (!resposta.ok) {
        throw new Error(dados?.error || 'Erro ao importar PDF DHL.')
      }

      const itens = Array.isArray(dados?.itens)
        ? dados.itens
        : Array.isArray(dados?.resultado?.itens)
          ? dados.resultado.itens
          : Array.isArray(dados?.preview?.itens)
            ? dados.preview.itens
            : []

      const linhasItens = itens.slice(0, 12).map((item: any) => {
        return '• ' + (item.awb || '-') + ' - ' + dinheiroPdfDhl(item.valor_compra)
      })

      const linhasAlerta = [
        'Transportadora: ' + (dados?.transportadora || 'DHL'),
        'Fatura: ' + (dados?.numero_fatura || dados?.fatura || '-'),
        'Total da fatura: ' + dinheiroPdfDhl(dados?.valor_total || dados?.total_fatura),
        'AWBs encontrados no PDF: ' + (dados?.awbs_encontrados ?? itens.length),
        '',
        dados?.mensagem || 'PDF DHL importado.',
        '',
        'Itens salvos: ' + (dados?.itens_salvos ?? itens.length),
        'Custos lançados nos processos: ' + (dados?.custos_lancados ?? 0),
        'Aguardando criação do processo: ' + (dados?.aguardando_processo ?? 0),
        'Processos que já tinham custo: ' + (dados?.ja_tinham_custo ?? 0),
      ]

      if (linhasItens.length > 0) {
        linhasAlerta.push('')
        linhasAlerta.push('AWBs lidos:')
        linhasAlerta.push(...linhasItens)
      }

      alert(linhasAlerta.join('\n'))

      setArquivoPdfImportacao(null)
      setPreviewPdf(null)
      await carregar()
    } catch (error: any) {
      alert('Erro ao importar PDF DHL: ' + (error?.message || 'Erro desconhecido.'))
    } finally {
      setImportandoPdf(false)
    }
  }
  async function carregarItensConciliacao() {
    const resultado: ItemFaturaConciliacao[] = []
    const tamanhoPagina = 1000

    for (let inicio = 0; ; inicio += tamanhoPagina) {
      const { data, error } = await supabase
        .from('faturas_transportadoras_itens')
        .select('id, fatura_transportadora_id, awb, valor_compra, financeiro_embarque_id')
        .range(inicio, inicio + tamanhoPagina - 1)

      if (error) throw new Error('Erro ao carregar AWBs das faturas: ' + error.message)

      const pagina = (data as ItemFaturaConciliacao[]) || []
      resultado.push(...pagina)
      if (pagina.length < tamanhoPagina) break
    }

    return resultado
  }

  async function carregarFinanceirosConciliacao() {
    const resultado: ProcessoFinanceiroConciliacao[] = []
    const tamanhoPagina = 1000

    for (let inicio = 0; ; inicio += tamanhoPagina) {
      const { data, error } = await supabase
        .from('financeiro_embarques')
        .select('id, awb, cliente, valor_cobranca, recebimento')
        .range(inicio, inicio + tamanhoPagina - 1)

      if (error) throw new Error('Erro ao carregar recebimentos dos clientes: ' + error.message)

      const pagina = (data as ProcessoFinanceiroConciliacao[]) || []
      resultado.push(...pagina)
      if (pagina.length < tamanhoPagina) break
    }

    return resultado
  }

  async function carregar() {
    setLoading(true)

    try {
      const [respostaFaturas, itens, financeiros] = await Promise.all([
        supabase
          .from('faturas_transportadoras')
          .select('*')
          .order('vencimento', { ascending: true, nullsFirst: false })
          .order('criado_em', { ascending: false }),
        carregarItensConciliacao(),
        carregarFinanceirosConciliacao(),
      ])

      if (respostaFaturas.error) {
        throw new Error('Erro ao carregar faturas de transportadoras: ' + respostaFaturas.error.message)
      }

      setFaturas((respostaFaturas.data as FaturaTransportadora[]) || [])
      setItensConciliacao(itens)
      setFinanceirosConciliacao(financeiros)
    } catch (error: any) {
      alert(error?.message || 'Erro ao carregar a conciliação das faturas.')
    } finally {
      setLoading(false)
    }
  }

  function numero(valor: any) {
    return numeroValorBR(valor)
  }

  function moeda(valor: any, moedaBase = 'BRL') {
    const numeroValor = Number(valor || 0)

    return numeroValor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: moedaBase || 'BRL',
    })
  }

  function dataBR(data?: string | null) {
    if (!data) return '-'

    const texto = String(data).slice(0, 10)
    const [ano, mes, dia] = texto.split('-')

    if (ano && mes && dia) return `${dia}/${mes}/${ano}`

    return new Date(data).toLocaleDateString('pt-BR')
  }

  function hojeISO() {
    return new Date().toISOString().slice(0, 10)
  }

  function situacaoAutomatica(item: FaturaTransportadora) {
    const situacao = String(item.situacao || '').toUpperCase()

    if (item.data_pagamento) return 'PAGA'
    if (situacao.includes('PAGO') || situacao.includes('PAGA') || situacao.includes('BAIXADO')) return 'PAGA'
    if (situacao.includes('CANCEL')) return 'FATURA CANCELADA'
    if (situacao.includes('CONTEST')) return 'CONTESTADA'

    const vencimento = String(item.vencimento || '').slice(0, 10)

    if (vencimento && vencimento < hojeISO()) return 'VENCIDA'

    return situacao || 'EM ABERTO'
  }

  function classeSituacao(status: string) {
    if (status === 'PAGA') return 'bg-green-600/20 text-green-300 border-green-500'
    if (status === 'VENCIDA') return 'bg-red-600/20 text-red-300 border-red-500'
    if (status.includes('CANCEL')) return 'bg-slate-600/20 text-slate-300 border-slate-500'
    if (status.includes('CONTEST')) return 'bg-purple-600/20 text-purple-300 border-purple-500'
    return 'bg-yellow-500/20 text-yellow-300 border-yellow-500'
  }

  function textoStatusConciliacao(status: StatusConciliacao | string) {
    if (status === 'PRONTA_PARA_PAGAR') return 'Pronta para pagar'
    if (status === 'AGUARDANDO_RECEBIMENTO') return 'Aguardando recebimento'
    if (status === 'COBERTURA_INSUFICIENTE') return 'Cobertura insuficiente'
    if (status === 'PAGA_COM_PENDENCIA') return 'Paga com recebimento pendente'
    if (status === 'PAGA_COBERTA') return 'Paga e conciliada'
    return 'Sem conciliação'
  }

  function classeStatusConciliacao(status: StatusConciliacao) {
    if (status === 'PRONTA_PARA_PAGAR') return 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
    if (status === 'PAGA_COBERTA') return 'border-green-500 bg-green-500/15 text-green-300'
    if (status === 'PAGA_COM_PENDENCIA') return 'border-red-500 bg-red-500/15 text-red-300'
    if (status === 'AGUARDANDO_RECEBIMENTO') return 'border-amber-500 bg-amber-500/15 text-amber-300'
    if (status === 'COBERTURA_INSUFICIENTE') return 'border-orange-500 bg-orange-500/15 text-orange-300'
    return 'border-slate-600 bg-slate-700/30 text-slate-300'
  }

  function normalizarBusca(valor: any) {
    return String(valor || '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
  }

  function pegarCampoExcel(linha: any, nomes: string[]) {
    for (const nome of nomes) {
      if (linha[nome] !== undefined && linha[nome] !== null && linha[nome] !== '') {
        return linha[nome]
      }
    }

    const chaves = Object.keys(linha || {})

    for (const nome of nomes) {
      const nomeNormalizado = normalizarBusca(nome)
      const chaveEncontrada = chaves.find((chave) => normalizarBusca(chave) === nomeNormalizado)

      if (
        chaveEncontrada &&
        linha[chaveEncontrada] !== undefined &&
        linha[chaveEncontrada] !== null &&
        linha[chaveEncontrada] !== ''
      ) {
        return linha[chaveEncontrada]
      }
    }

    const nomesNormalizados = nomes.map(normalizarBusca)

    for (const chave of chaves) {
      const chaveNormalizada = normalizarBusca(chave)

      if (
        nomesNormalizados.some(
          (nome) => chaveNormalizada.includes(nome) || nome.includes(chaveNormalizada)
        ) &&
        linha[chave] !== undefined &&
        linha[chave] !== null &&
        linha[chave] !== ''
      ) {
        return linha[chave]
      }
    }

    return ''
  }

  function normalizarDataExcel(valor: any) {
    if (!valor) return null

    if (valor instanceof Date && !isNaN(valor.getTime())) {
      return valor.toISOString().slice(0, 10)
    }

    if (typeof valor === 'number') {
      const data = new Date((valor - 25569) * 86400 * 1000)
      if (!isNaN(data.getTime())) return data.toISOString().slice(0, 10)
    }

    const texto = String(valor).trim()
    if (!texto) return null
    if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10)

    const partesBarra = texto.split('/')
    if (partesBarra.length === 3) {
      const [dia, mes, ano] = partesBarra
      const anoFinal = ano.length === 2 ? `20${ano}` : ano
      return `${anoFinal.padStart(4, '20')}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
    }

    const dataTentativa = new Date(texto)
    if (!isNaN(dataTentativa.getTime())) {
      return dataTentativa.toISOString().slice(0, 10)
    }

    return null
  }


  function extrairDataPagamentoTexto(valor: any) {
    const texto = String(valor || '').trim()
    if (!texto) return null

    const match = texto.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
    if (!match) return null

    const dia = match[1].padStart(2, '0')
    const mes = match[2].padStart(2, '0')
    const ano = match[3].length === 2 ? `20${match[3]}` : match[3]

    return `${ano}-${mes}-${dia}`
  }

  function normalizarNumeroFaturaParaSistema(numeroFatura: any) {
    const textoOriginal = String(numeroFatura || '').trim()
    if (!textoOriginal) return ''

    const somenteDigitos = textoOriginal.replace(/\D/g, '')

    // DHL: usar o número da fatura/boleto com 10 dígitos. Ex.: 2542443959.
    // FedEx: usar o número da fatura sem pontos/traços. Ex.: 5-475-48028 vira 547548028.
    if (somenteDigitos.length === 10 || somenteDigitos.length === 9) {
      return somenteDigitos
    }

    return textoOriginal.toUpperCase()
  }

  function identificarTransportadoraPelaFatura(numeroFatura: any) {
    const textoOriginal = String(numeroFatura || '').trim()
    const texto = textoOriginal.toUpperCase()
    const somenteDigitos = textoOriginal.replace(/\D/g, '')

    // Regra oficial que vamos usar no portal:
    // DHL: número da fatura/boleto com 10 dígitos. Ex.: 2542443959.
    // FedEx: número da fatura sem pontos/traços com 9 dígitos. Ex.: 5-475-48028 => 547548028.
    // CLIPPER: contém "/" ou tem 6 dígitos.
    // KPM: contém "-", desde que não seja uma fatura FedEx de 9 dígitos.
    if (somenteDigitos.length === 10) return 'DHL'
    if (somenteDigitos.length === 9) return 'FedEx'
    if (texto.includes('/')) return 'CLIPPER'
    if (somenteDigitos.length === 6) return 'CLIPPER'
    if (texto.includes('-')) return 'KPM'

    return ''
  }

  function normalizarTransportadora(valor: any) {
    const texto = normalizarBusca(valor)

    if (texto.includes('FEDEX') || texto.includes('FED EX')) return 'FedEx'
    if (texto.includes('DHL')) return 'DHL'
    if (texto.includes('KPM')) return 'KPM'
    if (texto.includes('CLIPPER')) return 'CLIPPER'

    return ''
  }

  function normalizarSituacaoExcel(valor: any, vencimento?: string | null, dataPagamento?: string | null) {
    const texto = normalizarBusca(valor)

    if (dataPagamento) return 'PAGA'
    if (texto.includes('PAGO') || texto.includes('PAGA')) return 'PAGA'
    if (texto.includes('CANCEL')) return 'FATURA CANCELADA'
    if (texto.includes('CONTEST')) return 'CONTESTADA'
    if (texto.includes('ATRAS') || texto.includes('VENCIDA')) return 'VENCIDA'
    if (texto.includes('ABERTO') || texto.includes('OUTSTANDING')) return 'EM ABERTO'

    if (vencimento && vencimento < hojeISO()) return 'VENCIDA'

    return 'EM ABERTO'
  }

  function chaveFaturaTransportadora(transportadora: any, numeroFatura: any) {
    const transportadoraFinal = normalizarTransportadora(transportadora) || normalizarBusca(transportadora)
    const numeroFinal = normalizarNumeroFaturaParaSistema(numeroFatura)
    return `${transportadoraFinal}|${numeroFinal}`
  }

  function observacoesImportacao(linha: any) {
    const partes = [
      ['Dias restantes', pegarCampoExcel(linha, ['DIAS RESTANTES', 'DIAS_RESTANTES'])],
      ['Data pagamento', pegarCampoExcel(linha, ['DATA DE PAGAMENTO', 'DATA PAGAMENTO', 'PAGAMENTO'])],
      ['Banco / utilizado para', pegarCampoExcel(linha, ['UTILIZADO PARA', 'UTILIZADO_PARA', 'BANCO UTILIZADO PARA PAGAMENTO', 'BANCO UTILIZADO', 'BANCO'])],
      ['Status recebimento', pegarCampoExcel(linha, ['STATUS_RECEBIMENTO_FATURA', 'STATUS RECEBIMENTO FATURA', 'STATUS_RECEBIMENTO', 'STATUS RECEBIME'])],
      ['Status contestação', pegarCampoExcel(linha, ['STATUS DE CONTESTAÇÃO', 'STATUS CONTESTACAO', 'STATUS DE COR', 'STATUS_DE_CONTESTACAO'])],
      ['Observação', pegarCampoExcel(linha, ['OBSERVAÇÕES', 'OBSERVACOES', 'OBSERVAÇÃO', 'OBSERVACAO'])],
    ]
      .filter(([, valor]) => valor !== undefined && valor !== null && String(valor).trim() !== '')
      .map(([titulo, valor]) => `${titulo}: ${valor}`)

    return partes.join(' | ')
  }


  function normalizarAwb(valor: any) {
    return String(valor || '').replace(/\D/g, '')
  }

  function statusPreviaImportacao(item: ItemImportacaoPdf) {
    if (!item.processo_encontrado) return 'AGUARDANDO_PROCESSO'

    const valorAtual = Number(item.valor_compra_atual || 0)
    const valorPdf = Number(item.valor_compra || 0)

    if (valorAtual <= 0) return 'PRONTO_PARA_LANCAR'
    if (Math.abs(valorAtual - valorPdf) < 0.01) return 'JA_TEM_MESMO_VALOR'

    return 'CONFERIR_VALOR_EXISTENTE'
  }

  function classeStatusImportacao(status: string) {
    if (status === 'PRONTO_PARA_LANCAR') return 'bg-green-600/20 text-green-300 border-green-500'
    if (status === 'JA_TEM_MESMO_VALOR') return 'bg-blue-600/20 text-blue-300 border-blue-500'
    if (status === 'CONFERIR_VALOR_EXISTENTE') return 'bg-red-600/20 text-red-300 border-red-500'
    return 'bg-yellow-500/20 text-yellow-300 border-yellow-500'
  }

  function textoStatusImportacao(status: string) {
    if (status === 'PRONTO_PARA_LANCAR') return 'Pronto para lançar'
    if (status === 'JA_TEM_MESMO_VALOR') return 'Já tem mesmo valor'
    if (status === 'CONFERIR_VALOR_EXISTENTE') return 'Conferir valor existente'
    return 'Aguardando processo'
  }

  async function complementarPreviewComProcessos(preview: PreviewImportacaoPdf) {
    const awbs = Array.from(new Set(preview.itens.map((item) => normalizarAwb(item.awb)).filter(Boolean)))

    if (awbs.length === 0) return preview

    const { data, error } = await supabase
      .from('financeiro_embarques')
      .select('id, awb, cliente, valor_compra')
      .in('awb', awbs)

    if (error) {
      alert('PDF lido, mas houve erro ao conferir processos existentes: ' + error.message)
      return preview
    }

    const processosPorAwb = new Map(
      ((data as any[]) || []).map((item) => [normalizarAwb(item.awb), item])
    )

    return {
      ...preview,
      itens: preview.itens.map((item) => {
        const processo = processosPorAwb.get(normalizarAwb(item.awb))

        return {
          ...item,
          processo_encontrado: !!processo,
          financeiro_id: processo?.id || null,
          valor_compra_atual: processo?.valor_compra ?? null,
          cliente: processo?.cliente || null,
        }
      }),
    }
  }

  async function importarPdfTransportadora(event: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0]
    if (!arquivo) return

    if (arquivo.type !== 'application/pdf') {
      alert('Envie apenas arquivo PDF.')
      event.target.value = ''
      return
    }

    const confirmar = confirm(
      'Importar esta fatura PDF DHL/FedEx?\n\n' +
        'O sistema vai tentar identificar a fatura, os AWBs e lançar o valor de compra nos processos encontrados.'
    )

    if (!confirmar) {
      event.target.value = ''
      return
    }

    setImportandoPdf(true)

    try {
      const formData = new FormData()
      formData.append('arquivo', arquivo)

      const resposta = await fetch('/api/faturas-transportadoras/importar-pdf', {
        method: 'POST',
        body: formData,
      })

      const retorno = await resposta.json().catch(() => null)

      if (!resposta.ok) {
        throw new Error(retorno?.error || 'Erro ao importar PDF.')
      }

      const previews = Array.isArray(retorno?.previews)
        ? retorno.previews
        : retorno?.preview
          ? [retorno.preview]
          : []

      const importacoes = Array.isArray(retorno?.importacoes)
        ? retorno.importacoes
        : retorno?.importacao
          ? [retorno.importacao]
          : []

      if (previews.length > 1) {
        const linhasFaturas = previews.map((item: any, index: number) => {
          const importacaoItem = importacoes[index] || {}
          const itensItem = Array.isArray(item?.itens) ? item.itens : []

          return (
            `• ${item.numero_fatura || '-'} — ${moeda(item.valor_total || 0)}` +
            ` — ${itensItem.length} AWB(s)` +
            ` — ${importacaoItem.itens_salvos ?? 0} item(ns) salvo(s)`
          )
        })

        const totalDocumento = previews.reduce(
          (acc: number, item: any) => acc + Number(item?.valor_total || 0),
          0
        )

        const totalAwbs = previews.reduce(
          (acc: number, item: any) => acc + (Array.isArray(item?.itens) ? item.itens.length : 0),
          0
        )

        const custosLancados = importacoes.reduce(
          (acc: number, item: any) => acc + Number(item?.custos_lancados || 0),
          0
        )

        const aguardandoProcesso = importacoes.reduce(
          (acc: number, item: any) => acc + Number(item?.aguardando_processo || 0),
          0
        )

        const jaTinhamCusto = importacoes.reduce(
          (acc: number, item: any) => acc + Number(item?.ja_tinham_custo || 0),
          0
        )

        alert(
          'Importação do PDF consolidado concluída.\n\n' +
            `Faturas encontradas: ${previews.length}\n` +
            `Total do documento: ${moeda(totalDocumento)}\n` +
            `AWBs encontrados: ${totalAwbs}\n\n` +
            linhasFaturas.join('\n') +
            '\n\nO mesmo PDF consolidado foi vinculado a todas as faturas.\n\n' +
            `Custos lançados nos processos: ${custosLancados}\n` +
            `Aguardando criação do processo: ${aguardandoProcesso}\n` +
            `Processos que já tinham custo: ${jaTinhamCusto}`
        )

        await carregar()
        return
      }

      const preview = previews[0] || retorno?.preview || {}
      const importacao = importacoes[0] || retorno?.importacao || {}
      const itens = Array.isArray(preview.itens) ? preview.itens : []

      const awbsResumo = itens
        .slice(0, 12)
        .map((item: any) => `• ${item.awb} - ${moeda(item.valor_compra || 0)}`)
        .join('\n')

      const maisAwbs =
        itens.length > 12 ? `\n... +${itens.length - 12} AWB(s) no PDF` : ''

      const mensagem =
        (importacao.pendente_conferencia
          ? 'PDF cadastrado como pendente de conferência.\n\n'
          : 'Importação do PDF concluída.\n\n') +
        `Transportadora: ${preview.transportadora || '-'}\n` +
        `Fatura: ${preview.numero_fatura || importacao.numero_fatura || '-'}\n` +
        `Total da fatura: ${moeda(preview.valor_total || 0)}\n` +
        `AWBs encontrados no PDF: ${itens.length}\n` +
        (importacao.pendente_conferencia
          ? '\nAtenção: o PDF foi cadastrado, mas os AWBs/valores não foram identificados automaticamente. Confira manualmente.\n\n'
          : '\n') +
        `Itens salvos: ${importacao.itens_salvos ?? 'não informado'}\n` +
        `Custos lançados nos processos: ${importacao.custos_lancados ?? 0}\n` +
        `Aguardando criação do processo: ${importacao.aguardando_processo ?? 0}\n` +
        `Processos que já tinham custo: ${importacao.ja_tinham_custo ?? 0}\n` +
        (awbsResumo ? `\nAWBs lidos:\n${awbsResumo}${maisAwbs}` : '')

      alert(mensagem)

      await carregar()
    } catch (error: any) {
      alert('Erro ao importar PDF: ' + error.message)
    } finally {
      setImportandoPdf(false)
      event.target.value = ''
    }
  }

  function limparImportacaoPdf() {
    setPreviewPdf(null)
    setArquivoPdfImportacao(null)
  }

  async function subirPdfImportado(faturaId: string, preview: PreviewImportacaoPdf) {
    if (!arquivoPdfImportacao) return ''

    const nomeLimpo = arquivoPdfImportacao.name.replaceAll(' ', '-')
    const caminho = 'transportadoras/' + preview.transportadora + '/' + faturaId + '/' + Date.now() + '-' + nomeLimpo

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(caminho, arquivoPdfImportacao, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'application/pdf',
      })

    if (uploadError) throw new Error(uploadError.message)

    const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(caminho)

    return urlData.publicUrl
  }

  async function confirmarImportacaoPdf() {
    if (!previewPdf) return
    if (previewPdf.itens.length === 0) return alert('Nenhum item encontrado no PDF.')

    const numeroFatura = normalizarNumeroFaturaParaSistema(previewPdf.numero_fatura)
    const totalPdf = Number(previewPdf.valor_total || 0)

    const faturaMesmoNumero = faturas.find((item) => {
      return (
        String(item.transportadora || '') === previewPdf.transportadora &&
        normalizarNumeroFaturaParaSistema(item.numero_fatura) === numeroFatura
      )
    })

    const faturaMesmoValor = faturas.find((item) => {
      return (
        String(item.transportadora || '') === previewPdf.transportadora &&
        Number(item.total || 0).toFixed(2) === totalPdf.toFixed(2) &&
        String(item.vencimento || '').slice(0, 10) === String(previewPdf.vencimento || '').slice(0, 10)
      )
    })

    const faturaExistente = faturaMesmoNumero || faturaMesmoValor

    if (faturaExistente) {
      const motivo = faturaMesmoNumero
        ? 'mesmo número de fatura'
        : 'mesmo valor, transportadora e vencimento'

      const confirmar = confirm(
        'Atenção: já existe uma fatura registrada com ' + motivo + '.\n\n' +
          'Fatura existente: ' + faturaExistente.numero_fatura + '\n' +
          'Valor: ' + moeda(faturaExistente.total) + '\n\n' +
          'O sistema NÃO vai duplicar a fatura. Ele vai usar o registro existente e apenas vincular os AWBs/valores do PDF.\n\n' +
          'Deseja continuar?'
      )

      if (!confirmar) return
    }

    setConfirmandoPdf(true)

    try {
      let faturaId = faturaExistente?.id || ''

      if (!faturaId) {
        const payload = {
          transportadora: previewPdf.transportadora,
          conta: previewPdf.conta,
          numero_fatura: numeroFatura,
          emissao: previewPdf.emissao,
          vencimento: previewPdf.vencimento,
          data_pagamento: null,
          utilizado_para: null,
          situacao: 'EM ABERTO',
          total: totalPdf,
          valor_contestado: 0,
          pago_ajustado: 0,
          saldo: totalPdf,
          moeda: 'BRL',
          observacoes: 'Importada automaticamente por PDF. Os valores por AWB foram registrados para lançamento de valor_compra.',
          atualizado_em: new Date().toISOString(),
        }

        const { data, error } = await supabase
          .from('faturas_transportadoras')
          .insert([payload])
          .select('id')
          .single()

        if (error) throw new Error(error.message)
        faturaId = data.id
      }

      if (arquivoPdfImportacao) {
        const arquivoPdfUrl = await subirPdfImportado(faturaId, previewPdf)

        const { error: erroPdf } = await supabase
          .from('faturas_transportadoras')
          .update({
            arquivo_pdf: arquivoPdfUrl,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', faturaId)

        if (erroPdf) throw new Error(erroPdf.message)
      }

      const itensPayload = previewPdf.itens.map((item) => ({
        fatura_transportadora_id: faturaId,
        transportadora: previewPdf.transportadora,
        numero_fatura: numeroFatura,
        awb: normalizarAwb(item.awb),
        referencia: item.referencia,
        data_envio: item.data_envio,
        valor_compra: Number(item.valor_compra || 0),
        financeiro_embarque_id: item.financeiro_id || null,
        valor_compra_anterior: item.valor_compra_atual ?? null,
        status_lancamento: 'AGUARDANDO_PROCESSO',
        observacao: item.processo_encontrado
          ? 'Item importado por PDF. Processo encontrado na prévia.'
          : 'Item importado por PDF. Aguardando criação do processo financeiro.',
        atualizado_em: new Date().toISOString(),
      }))

      const { error: erroItens } = await supabase
        .from('faturas_transportadoras_itens')
        .upsert(itensPayload, {
          onConflict: 'transportadora,numero_fatura,awb',
        })

      if (erroItens) throw new Error(erroItens.message)

      const { data: sincronizacao, error: erroSync } = await supabase
        .rpc('hc_sincronizar_itens_faturas_transportadoras')

      if (erroSync) throw new Error(erroSync.message)

      const resultado = Array.isArray(sincronizacao) ? sincronizacao[0] : sincronizacao

      alert(
        'Importação confirmada com sucesso.\n\n' +
          'Fatura: ' + numeroFatura + '\n' +
          'AWBs no PDF: ' + previewPdf.itens.length + '\n' +
          'Lançados agora: ' + (resultado?.total_lancados ?? 0) + '\n' +
          'Aguardando processo: ' + (resultado?.total_aguardando ?? 0) + '\n' +
          'Para conferir valor existente: ' + (resultado?.total_conferir ?? 0)
      )

      limparImportacaoPdf()
      await carregar()
    } catch (error: any) {
      alert('Erro ao confirmar importação PDF: ' + error.message)
    }

    setConfirmandoPdf(false)
  }


  async function importarExcel(event: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0]
    if (!arquivo) return

    if (!confirm('Importar este Excel para Faturas DHL/FedEx?')) {
      event.target.value = ''
      return
    }

    setImportando(true)

    try {
      const XLSX = await import('xlsx')
      const buffer = await arquivo.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const linhas: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })

      const registros = linhas
        .map((linha) => {
          const numeroFaturaOriginal = String(
            pegarCampoExcel(linha, [
              'NUMERO DA FATURA',
              'NÚMERO DA FATURA',
              'NUMERO_FATURA',
              'Nº FATURA',
              'N° FATURA',
              'FATURA',
              'Fatura Fiscal Nº',
              'FATURA FISCAL Nº',
              'INVOICE',
            ]) || ''
          ).trim()

          const numeroFatura = normalizarNumeroFaturaParaSistema(numeroFaturaOriginal)

          const transportadoraPlanilha = normalizarTransportadora(
            pegarCampoExcel(linha, [
              'FEDEX / DHL',
              'FEDEX/DHL',
              'DHL / FEDEX',
              'TRANSPORTADORA',
              'EMPRESA',
              'CARRIER',
            ])
          )

          const transportadora =
            transportadoraPlanilha || identificarTransportadoraPelaFatura(numeroFatura) || 'DHL'

          const emissao = normalizarDataExcel(
            pegarCampoExcel(linha, [
              'EMISSÃO',
              'EMISSAO',
              'DATA DE EMISSÃO',
              'DATA DE EMISSAO',
              'DATA EMISSÃO',
              'DATA EMISSAO',
            ])
          )

          const vencimento = normalizarDataExcel(
            pegarCampoExcel(linha, [
              'DATA DE VENCIMENTO',
              'DATA VENCIMENTO',
              'DATA DE VENCIMEN',
              'VENCIMENTO',
              'VENCIMENTO_CLIENTE',
            ])
          )

          const diasRestantes = String(
            pegarCampoExcel(linha, ['DIAS RESTANTES', 'DIAS_RESTANTES']) || ''
          ).trim()

          const campoDataPagamento = pegarCampoExcel(linha, [
            'DATA DE PAGAMENTO',
            'DATA PAGAMENTO',
            'DATA_PAGAMENTO',
            'PAGAMENTO',
            'PAGO EM',
            'PAGA EM',
          ])

          const dataPagamento =
            normalizarDataExcel(campoDataPagamento) ||
            extrairDataPagamentoTexto(campoDataPagamento) ||
            extrairDataPagamentoTexto(diasRestantes) ||
            extrairDataPagamentoTexto(pegarCampoExcel(linha, ['STATUS DA FATURA', 'STATUS_DA_FATURA']))

          const utilizadoPara = String(
            pegarCampoExcel(linha, [
              'BANCO UTILIZADO PARA PAGAMENTO',
              'BANCO UTILIZADO PARA PAGTO',
              'UTILIZADO PARA',
              'UTILIZADO_PARA',
              'UTILIZADO',
              'BANCO UTILIZADO',
              'BANCO PAGAMENTO',
              'BANCO',
              'PAGO POR',
              'PAGAMENTO REALIZADO POR',
            ]) || ''
          ).trim()

          const valor = numero(
            pegarCampoExcel(linha, [
              'VALOR',
              'VALOR DA FATURA',
              'TOTAL',
              'TOTAL FATURA',
            ])
          )

          const totalAtualizado =
            numero(
              pegarCampoExcel(linha, [
                'TOTAL ATUALIZADO',
                'TOTAL_ATUALIZADO',
                'TOTAL AJUSTADO',
              ])
            ) || valor

          const valorContestado = numero(
            pegarCampoExcel(linha, [
              'VALOR CONTESTADO',
              'VALOR_CONTES',
              'VALOR CONTEST',
              'VALOR_CONTESTADO',
            ])
          )

          const pagoAjustado = numero(
            pegarCampoExcel(linha, [
              'PAGO / AJUST.',
              'PAGO/AJUST.',
              'PAGO AJUST.',
              'PAGO AJUSTADO',
              'PAGO_AJUSTADO',
              'PAGO AJUST',
            ])
          )

          const saldoInformado = numero(
            pegarCampoExcel(linha, [
              'SALDO',
              'DIFERENCA_FATURA',
              'DIFERENÇA_FATURA',
              'DIFERENCA_FA',
              'DIFERENÇA_FA',
            ])
          )

          const statusRecebimento = String(
            pegarCampoExcel(linha, [
              'STATUS_RECEBIMENTO_FATURA',
              'STATUS RECEBIMENTO FATURA',
              'STATUS_RECEBIMENTO',
              'STATUS RECEBIMENTO',
            ]) || ''
          ).trim()

          const statusContestacao = String(
            pegarCampoExcel(linha, [
              'STATUS DE CONTESTAÇÃO',
              'STATUS DE CONTESTACAO',
              'STATUS CONTESTACAO',
              'STATUS DE CORREÇÃO',
              'STATUS DE CORRECAO',
              'CONTESTAÇÃO',
              'CONTESTACAO',
            ]) || ''
          ).trim()

          const statusPlanilha = pegarCampoExcel(linha, [
            'STATUS DA FATURA',
            'STATUS_DA_FATURA',
            'SITUAÇÃO',
            'SITUACAO',
            'STATUS',
            'DIAS RESTANTES',
          ])

          const situacao = normalizarSituacaoExcel(statusPlanilha, vencimento, dataPagamento)
          const faturaPagaOuCancelada = situacao === 'PAGA' || situacao.includes('CANCEL')
          const saldo = faturaPagaOuCancelada
            ? 0
            : saldoInformado > 0
              ? saldoInformado
              : Math.max(totalAtualizado - pagoAjustado, 0)

          return {
            transportadora,
            conta: String(pegarCampoExcel(linha, ['CONTA', 'CONTA ENTIDADE', 'ACCOUNT']) || '').trim() || null,
            numero_fatura: numeroFatura || null,
            emissao,
            vencimento,
            data_pagamento: dataPagamento,
            utilizado_para: utilizadoPara || null,
            dias_restantes: diasRestantes || null,
            status_recebimento_fatura: statusRecebimento || null,
            status_contestacao: statusContestacao || null,
            diferenca_fatura: saldoInformado,
            situacao,
            total: totalAtualizado,
            valor_contestado: valorContestado,
            pago_ajustado: faturaPagaOuCancelada ? totalAtualizado : pagoAjustado,
            saldo,
            moeda: String(pegarCampoExcel(linha, ['MOEDA', 'CURRENCY']) || 'BRL').trim() || 'BRL',
            observacoes: observacoesImportacao(linha) || null,
            atualizado_em: new Date().toISOString(),
          }
        })
        .filter((item) => item.numero_fatura || item.total > 0)

      if (registros.length === 0) {
        alert('Nenhuma fatura válida encontrada no Excel.')
        setImportando(false)
        event.target.value = ''
        return
      }

      const { data: faturasExistentes, error: erroFaturasExistentes } = await supabase
        .from('faturas_transportadoras')
        .select('id, transportadora, numero_fatura')

      if (erroFaturasExistentes) {
        alert('Erro ao buscar faturas existentes: ' + erroFaturasExistentes.message)
        setImportando(false)
        return
      }

      const faturasAtuaisPorChave = new Map(
        ((faturasExistentes as any[]) || [])
          .filter((item) => item.numero_fatura && item.id)
          .map((item) => [chaveFaturaTransportadora(item.transportadora, item.numero_fatura), item])
      )

      const novosPorChave = new Map<string, any>()
      const atualizacoesPorChave = new Map<string, { id: string; payload: any }>()
      let duplicadasNoExcel = 0

      registros.forEach((registro) => {
        const chave = chaveFaturaTransportadora(registro.transportadora, registro.numero_fatura)
        const existenteNoBanco = faturasAtuaisPorChave.get(chave)

        if (existenteNoBanco?.id) {
          atualizacoesPorChave.set(chave, {
            id: existenteNoBanco.id,
            payload: registro,
          })
          return
        }

        if (novosPorChave.has(chave)) {
          duplicadasNoExcel += 1
        }

        // Se a mesma fatura vier repetida no Excel, mantém uma linha só.
        // A última ocorrência ganha, evitando tentar atualizar id "undefined".
        novosPorChave.set(chave, registro)
      })

      const novos = Array.from(novosPorChave.values())
      const atualizacoes = Array.from(atualizacoesPorChave.values())

      for (let i = 0; i < novos.length; i += 500) {
        const lote = novos.slice(i, i + 500)
        const { error } = await supabase.from('faturas_transportadoras').insert(lote)

        if (error) {
          alert('Erro ao importar lote: ' + error.message)
          setImportando(false)
          return
        }
      }

      for (const item of atualizacoes) {
        const { error } = await supabase
          .from('faturas_transportadoras')
          .update(item.payload)
          .eq('id', item.id)

        if (error) {
          alert('Erro ao atualizar fatura existente: ' + error.message)
          setImportando(false)
          return
        }
      }

      alert(
        `Importação concluída.\n\n` +
          `Novas faturas: ${novos.length}\n` +
          `Faturas atualizadas: ${atualizacoes.length}` +
          (duplicadasNoExcel > 0
            ? `\nDuplicadas no Excel ignoradas/mescladas: ${duplicadasNoExcel}`
            : '')
      )


      await carregar()
    } catch (error: any) {
      alert('Erro ao importar Excel: ' + error.message)
    }

    setImportando(false)
    event.target.value = ''
  }


  async function salvarFatura() {
    if (!form.transportadora) return alert('Selecione a transportadora.')
    if (!form.numero_fatura.trim()) return alert('Informe o número da fatura.')
    if (form.situacao === 'PAGA' && !form.data_pagamento) {
      return alert('Para marcar a fatura como paga, informe a data real do pagamento.')
    }

    if (form.data_pagamento && editandoId) {
      const faturaAtual = faturas.find((item) => item.id === editandoId)

      if (faturaAtual && !faturaAtual.data_pagamento) {
        const conciliacao = resumoConciliacao(faturaAtual)

        if (!conciliacao.liberadaPagamento) {
          const pendentes = conciliacao.itens
            .filter(({ processo, recebido }) => !processo || !recebido)
            .map(({ item, processo }) => `${item.awb || '-'}${processo?.cliente ? ` - ${processo.cliente}` : ''}`)
            .slice(0, 12)

          const linhasAlertaPagamento = [
            'ATENÇÃO — PAGAMENTO SEM COBERTURA COMPLETA',
            '',
            `Fatura: ${faturaAtual.numero_fatura || '-'}`,
            `Transportadora: ${faturaAtual.transportadora || '-'}`,
            `AWBs na fatura: ${conciliacao.totalItens}`,
            `Recebidos: ${conciliacao.recebidos}`,
            `Aguardando recebimento: ${conciliacao.pendentes}`,
            `Não localizados no Financeiro: ${conciliacao.naoLocalizados}`,
            `Valor pendente conhecido: ${moeda(conciliacao.valorPendente)}`,
            `Cobertura financeira: ${conciliacao.cobertura.toFixed(1)}%`,
            '',
          ]

          if (pendentes.length) {
            linhasAlertaPagamento.push('Pendências:', ...pendentes, '')
          }

          linhasAlertaPagamento.push(
            'Se continuar, a fatura ficará sinalizada em vermelho como PAGA COM RECEBIMENTO PENDENTE até a regularização.',
            '',
            'Deseja registrar o pagamento mesmo assim?'
          )

          const confirmarPagamento = confirm(linhasAlertaPagamento.join('\n'))

          if (!confirmarPagamento) return
        }
      }
    }

    setSalvando(true)

    const payload = {
      transportadora: form.transportadora,
      conta: form.conta || null,
      numero_fatura: normalizarNumeroFaturaParaSistema(form.numero_fatura) || null,
      emissao: form.emissao || null,
      vencimento: form.vencimento || null,
      data_pagamento: form.data_pagamento || null,
      utilizado_para: form.utilizado_para || null,
      situacao: form.data_pagamento ? 'PAGA' : form.situacao || 'EM ABERTO',
      total: numero(form.total),
      valor_contestado: numero(form.valor_contestado),
      pago_ajustado: form.data_pagamento ? numero(form.total) : numero(form.pago_ajustado),
      saldo: form.data_pagamento ? 0 : form.saldo ? numero(form.saldo) : numero(form.total) - numero(form.pago_ajustado),
      moeda: form.moeda || 'BRL',
      observacoes: form.observacoes || null,
      atualizado_em: new Date().toISOString(),
    }

    if (editandoId) {
      const { error } = await supabase
        .from('faturas_transportadoras')
        .update(payload)
        .eq('id', editandoId)

      setSalvando(false)

      if (error) {
        alert(error.message)
        return
      }

      alert('Fatura atualizada com sucesso.')
    } else {
      const { error } = await supabase
        .from('faturas_transportadoras')
        .insert([payload])

      setSalvando(false)

      if (error) {
        alert(error.message)
        return
      }

      alert('Fatura cadastrada com sucesso.')
    }

    limparFormulario()
    carregar()
  }

  function editar(item: FaturaTransportadora) {
    setEditandoId(item.id)

    setForm({
      transportadora: item.transportadora || 'DHL',
      conta: item.conta || '',
      numero_fatura: item.numero_fatura || '',
      emissao: item.emissao ? String(item.emissao).slice(0, 10) : '',
      vencimento: item.vencimento ? String(item.vencimento).slice(0, 10) : '',
      data_pagamento: item.data_pagamento ? String(item.data_pagamento).slice(0, 10) : '',
      utilizado_para: item.utilizado_para || '',
      situacao: item.situacao || 'EM ABERTO',
      total: item.total ? String(item.total).replace('.', ',') : '',
      valor_contestado: item.valor_contestado ? String(item.valor_contestado).replace('.', ',') : '',
      pago_ajustado: item.pago_ajustado ? String(item.pago_ajustado).replace('.', ',') : '',
      saldo: item.saldo ? String(item.saldo).replace('.', ',') : '',
      moeda: item.moeda || 'BRL',
      observacoes: item.observacoes || '',
    })

    setTimeout(() => {
      document.getElementById('form_fatura_transportadora')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  function limparFormulario() {
    setEditandoId(null)
    setForm(formVazio)
  }

  async function anexarPdf(item: FaturaTransportadora, arquivo: File | null) {
    if (!arquivo) return
    if (arquivo.type !== 'application/pdf') return alert('Anexe apenas PDF.')

    setUploadingId(item.id)

    const nomeLimpo = arquivo.name.replaceAll(' ', '-')
    const caminho = `transportadoras/${item.transportadora}/${item.id}/${Date.now()}-${nomeLimpo}`

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(caminho, arquivo, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'application/pdf',
      })

    if (uploadError) {
      setUploadingId(null)
      alert(uploadError.message)
      return
    }

    const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(caminho)

    const { error } = await supabase
      .from('faturas_transportadoras')
      .update({
        arquivo_pdf: urlData.publicUrl,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', item.id)

    setUploadingId(null)

    if (error) {
      alert(error.message)
      return
    }

    alert('PDF anexado com sucesso.')
    carregar()
  }

  async function alternarArquivada(item: FaturaTransportadora) {
    const arquivar = !item.arquivada
    const confirmar = confirm(
      arquivar
        ? `Arquivar a fatura ${item.numero_fatura}?`
        : `Restaurar a fatura ${item.numero_fatura}?`
    )

    if (!confirmar) return

    const { error } = await supabase
      .from('faturas_transportadoras')
      .update({
        arquivada: arquivar,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', item.id)

    if (error) {
      alert(error.message)
      return
    }

    carregar()
  }



  function alternarSelecao(id: string, marcado: boolean) {
    setSelecionadas((atual) =>
      marcado ? Array.from(new Set([...atual, id])) : atual.filter((item) => item !== id)
    )
  }

  function selecionarTodasFiltradas(marcado: boolean) {
    if (!marcado) {
      setSelecionadas([])
      return
    }

    setSelecionadas(filtradas.map((item) => item.id))
  }

  async function arquivarSelecionadas(arquivar: boolean) {
    if (selecionadas.length === 0) {
      alert('Selecione pelo menos uma fatura.')
      return
    }

    const acao = arquivar ? 'arquivar' : 'restaurar'
    const confirmar = confirm(`Deseja ${acao} ${selecionadas.length} fatura(s)?`)
    if (!confirmar) return

    const { error } = await supabase
      .from('faturas_transportadoras')
      .update({
        arquivada: arquivar,
        atualizado_em: new Date().toISOString(),
      })
      .in('id', selecionadas)

    if (error) {
      alert(error.message)
      return
    }

    setSelecionadas([])
    await carregar()
  }
  async function excluir(item: FaturaTransportadora) {
    const confirmar = confirm(`Excluir definitivamente a fatura ${item.numero_fatura}?`)
    if (!confirmar) return

    const { error } = await supabase
      .from('faturas_transportadoras')
      .delete()
      .eq('id', item.id)

    if (error) {
      alert(error.message)
      return
    }

    alert('Fatura excluída.')
    carregar()
  }

  function limparFiltros() {
    setBusca('')
    setFiltroTransportadoras([])
    setFiltroSituacoes([])
    setFiltroArquivadas('ATIVAS')
    setFiltroPrazo('')
    setFiltroConciliacao('TODAS')
    setFiltroDashboard('')
  }

  function filtroRapido(tipo: string) {
    setFiltroConciliacao('TODAS')

    if (tipo === 'DHL') {
      setFiltroTransportadoras(['DHL'])
      setFiltroSituacoes([])
      setFiltroArquivadas('ATIVAS')
      setFiltroPrazo('')
    }

    if (tipo === 'FEDEX') {
      setFiltroTransportadoras(['FedEx'])
      setFiltroSituacoes([])
      setFiltroArquivadas('ATIVAS')
      setFiltroPrazo('')
    }

    if (tipo === 'VENCENDO_HOJE') {
      setFiltroTransportadoras([])
      setFiltroSituacoes([])
      setFiltroArquivadas('ATIVAS')
      setFiltroPrazo('HOJE')
    }

    if (tipo === 'VENCIDAS') {
      setFiltroTransportadoras([])
      setFiltroSituacoes(['VENCIDA'])
      setFiltroArquivadas('ATIVAS')
      setFiltroPrazo('')
    }

    if (tipo === 'ABERTAS') {
      setFiltroTransportadoras([])
      setFiltroSituacoes(['EM ABERTO'])
      setFiltroArquivadas('ATIVAS')
      setFiltroPrazo('')
    }

    if (tipo === 'ARQUIVADAS') {
      setFiltroTransportadoras([])
      setFiltroSituacoes([])
      setFiltroArquivadas('ARQUIVADAS')
      setFiltroPrazo('')
    }

    if (tipo === 'PRONTAS_PAGAR') {
      setFiltroTransportadoras([])
      setFiltroSituacoes([])
      setFiltroArquivadas('ATIVAS')
      setFiltroPrazo('')
      setFiltroConciliacao('PRONTA_PARA_PAGAR')
    }

    if (tipo === 'PAGAS_PENDENTES') {
      setFiltroTransportadoras([])
      setFiltroSituacoes([])
      setFiltroArquivadas('TODAS')
      setFiltroPrazo('')
      setFiltroConciliacao('PAGA_COM_PENDENCIA')
    }
  }

  const itensPorFatura = useMemo(() => {
    const mapa = new Map<string, ItemFaturaConciliacao[]>()

    itensConciliacao.forEach((item) => {
      const lista = mapa.get(item.fatura_transportadora_id) || []
      lista.push(item)
      mapa.set(item.fatura_transportadora_id, lista)
    })

    return mapa
  }, [itensConciliacao])

  const financeirosPorId = useMemo(() => {
    return new Map(financeirosConciliacao.map((item) => [item.id, item]))
  }, [financeirosConciliacao])

  const financeirosPorAwb = useMemo(() => {
    const mapa = new Map<string, ProcessoFinanceiroConciliacao[]>()

    financeirosConciliacao.forEach((item) => {
      const awb = normalizarAwb(item.awb)
      if (!awb) return
      const lista = mapa.get(awb) || []
      lista.push(item)
      mapa.set(awb, lista)
    })

    return mapa
  }, [financeirosConciliacao])

  function resumoConciliacao(fatura: FaturaTransportadora): ResumoConciliacao {
    const itens = itensPorFatura.get(fatura.id) || []

    const detalhados: ItemConciliado[] = itens.map((item) => {
      const vinculado = item.financeiro_embarque_id
        ? financeirosPorId.get(item.financeiro_embarque_id) || null
        : null

      const candidatos = financeirosPorAwb.get(normalizarAwb(item.awb)) || []
      const processo = vinculado || candidatos.find((registro) => !!registro.recebimento) || candidatos[0] || null

      return {
        item,
        processo,
        recebido: !!processo?.recebimento,
      }
    })

    const recebidos = detalhados.filter((item) => item.recebido).length
    const naoLocalizados = detalhados.filter((item) => !item.processo).length
    const pendentes = detalhados.filter((item) => !!item.processo && !item.recebido).length
    const valorRecebido = detalhados.reduce(
      (acc, item) => acc + (item.recebido ? Number(item.processo?.valor_cobranca || 0) : 0),
      0
    )
    const valorPendente = detalhados.reduce(
      (acc, item) => acc + (item.processo && !item.recebido ? Number(item.processo.valor_cobranca || 0) : 0),
      0
    )
    const totalFatura = Number(fatura.total || 0)
    const cobertura = totalFatura > 0 ? (valorRecebido / totalFatura) * 100 : 0
    const todosRecebidos = detalhados.length > 0 && recebidos === detalhados.length && naoLocalizados === 0
    const coberturaSuficiente = totalFatura <= 0 || valorRecebido + 0.01 >= totalFatura
    const liberadaPagamento = todosRecebidos && coberturaSuficiente
    const paga = situacaoAutomatica(fatura) === 'PAGA'

    let status: StatusConciliacao = paga ? 'PAGA_COM_PENDENCIA' : 'SEM_CONCILIACAO'

    if (detalhados.length > 0) {
      if (paga) {
        status = liberadaPagamento ? 'PAGA_COBERTA' : 'PAGA_COM_PENDENCIA'
      } else if (!todosRecebidos) {
        status = 'AGUARDANDO_RECEBIMENTO'
      } else if (!coberturaSuficiente) {
        status = 'COBERTURA_INSUFICIENTE'
      } else {
        status = 'PRONTA_PARA_PAGAR'
      }
    }

    return {
      status,
      itens: detalhados,
      totalItens: detalhados.length,
      recebidos,
      pendentes,
      naoLocalizados,
      valorRecebido,
      valorPendente,
      cobertura,
      todosRecebidos,
      coberturaSuficiente,
      liberadaPagamento,
    }
  }

  const filtradas = useMemo(() => {
    const termo = busca.toLowerCase().trim()

    return faturas.filter((item) => {
      const statusAuto = situacaoAutomatica(item)

      const texto = `
        ${item.transportadora || ''}
        ${item.conta || ''}
        ${item.numero_fatura || ''}
        ${item.situacao || ''}
        ${item.utilizado_para || ''}
        ${item.status_recebimento_fatura || ''}
        ${item.status_contestacao || ''}
        ${item.moeda || ''}
        ${item.observacoes || ''}
      `.toLowerCase()

      const passaBusca = !termo || texto.includes(termo)
      const passaTransportadora =
        filtroTransportadoras.length === 0 ||
        filtroTransportadoras.includes(String(item.transportadora || ''))

      const situacaoManual = String(item.situacao || '').toUpperCase()
      const passaSituacao =
        filtroSituacoes.length === 0 ||
        filtroSituacoes.includes(statusAuto) ||
        filtroSituacoes.includes(situacaoManual)
      const passaArquivadas =
        filtroArquivadas === 'TODAS' ||
        (filtroArquivadas === 'ATIVAS' && !item.arquivada) ||
        (filtroArquivadas === 'ARQUIVADAS' && !!item.arquivada)

      const passaPrazo = passaFiltroPrazo(item)
      const conciliacao = resumoConciliacao(item)
      const passaConciliacao = filtroConciliacao === 'TODAS' || conciliacao.status === filtroConciliacao

      return passaBusca && passaTransportadora && passaSituacao && passaArquivadas && passaPrazo && passaConciliacao
    })
  }, [faturas, busca, filtroTransportadoras, filtroSituacoes, filtroArquivadas, filtroPrazo, filtroConciliacao, itensPorFatura, financeirosPorId, financeirosPorAwb])


  const todasFiltradasSelecionadas =
    filtradas.length > 0 && filtradas.every((item) => selecionadas.includes(item.id))

  const selecionadasAtivas = faturas.filter(
    (item) => selecionadas.includes(item.id) && !item.arquivada
  ).length

  const selecionadasArquivadas = faturas.filter(
    (item) => selecionadas.includes(item.id) && !!item.arquivada
  ).length

  const totais = useMemo(() => {
    const ativas = faturas.filter((item) => !item.arquivada)
    const dhl = ativas.filter((item) => item.transportadora === 'DHL')
    const fedex = ativas.filter((item) => item.transportadora === 'FedEx')

    const vencendoHoje = ativas.filter((item) => {
      const status = situacaoAutomatica(item)

      const podeVencer =
        status !== 'PAGA' &&
        status !== 'VENCIDA' &&
        status !== 'CONTESTADA' &&
        status !== 'FATURA CANCELADA'

      return podeVencer && diasAteVencimento(item) === 0
    })

    const vencidas = ativas.filter((item) => situacaoAutomatica(item) === 'VENCIDA')
    const abertas = ativas.filter((item) => situacaoAutomatica(item) === 'EM ABERTO')
    const arquivadas = faturas.filter((item) => item.arquivada)
    const prontasPagar = ativas.filter((item) => resumoConciliacao(item).status === 'PRONTA_PARA_PAGAR')
    const pagasPendentes = faturas.filter((item) => resumoConciliacao(item).status === 'PAGA_COM_PENDENCIA')

    function somarSaldo(lista: FaturaTransportadora[]) {
      return lista.reduce((acc, item) => acc + Number(item.saldo || 0), 0)
    }

    function somarTotal(lista: FaturaTransportadora[]) {
      return lista.reduce((acc, item) => acc + Number(item.total || 0), 0)
    }

    return {
      dhl: { qtd: dhl.length, saldo: somarSaldo(dhl), total: somarTotal(dhl) },
      fedex: { qtd: fedex.length, saldo: somarSaldo(fedex), total: somarTotal(fedex) },
      vencendoHoje: {
        qtd: vencendoHoje.length,
        saldo: somarSaldo(vencendoHoje),
      },
      vencidas: { qtd: vencidas.length, saldo: somarSaldo(vencidas) },
      abertas: { qtd: abertas.length, saldo: somarSaldo(abertas) },
      arquivadas: { qtd: arquivadas.length, saldo: somarSaldo(arquivadas) },
      prontasPagar: { qtd: prontasPagar.length },
      pagasPendentes: {
        qtd: pagasPendentes.length,
        processos: pagasPendentes.reduce((acc, item) => {
          const resumo = resumoConciliacao(item)
          return acc + resumo.pendentes + resumo.naoLocalizados
        }, 0),
        valorPendente: pagasPendentes.reduce((acc, item) => acc + resumoConciliacao(item).valorPendente, 0),
      },
      geral: { qtd: ativas.length, saldo: somarSaldo(ativas), total: somarTotal(ativas) },
    }
  }, [faturas, itensPorFatura, financeirosPorId, financeirosPorAwb])

  return (
    <main className="w-full max-w-none p-6 lg:p-8 text-white">
      <div className="mb-8 flex flex-col xl:flex-row justify-between gap-6">
        <div>
          <p className="text-blue-400 font-bold mb-2">Transportadoras</p>
          <h1 className="text-5xl font-black mb-2">Faturas DHL e FedEx</h1>
          <p className="text-slate-400 text-lg">
            Controle as faturas das transportadoras sem misturar com as faturas emitidas para clientes.
          </p>

          <p className="text-slate-500 text-sm mt-3">
            Última alteração dos filtros: {ultimaAlteracao || '-'}
          </p>
        </div>

        <div className="flex gap-3 flex-wrap h-fit">
          <Link
            href="/admin/faturas"
            className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold"
          >
            Faturas clientes
          </Link>

          <label className="bg-emerald-600 hover:bg-emerald-500 px-5 py-3 rounded-xl font-bold cursor-pointer">
            {importando ? 'Importando...' : 'Importar Excel'}
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              disabled={importando}
              onChange={importarExcel}
            />
          </label>


          <label className="bg-orange-600 hover:bg-orange-500 px-5 py-3 rounded-xl font-bold cursor-pointer">
            {importandoPdf ? 'Lendo PDF...' : 'Importar PDF FedEx'}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={importandoPdf}
              onChange={importarPdfTransportadora}
            />
          </label>

          <button
            onClick={carregar}
            className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl font-bold"
          >
            Atualizar
          </button>

        <button
          type="button"
          onClick={importarPdfDhlSeparado}
          disabled={importandoPdf}
          className="rounded-xl bg-orange-600 px-5 py-3 text-sm font-black text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {importandoPdf ? 'Lendo PDF...' : 'Importar PDF DHL'}
        </button>
        </div>
      </div>

      {filtroDashboard && (
        <section className="mb-6 rounded-2xl border border-blue-500/40 bg-blue-600/10 p-4 text-blue-100">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-blue-300">Filtro aplicado pela Dashboard</p>
              <p className="mt-1 font-bold">{filtroDashboard}</p>
            </div>

            <button
              type="button"
              onClick={limparFiltros}
              className="w-fit rounded-xl bg-slate-700 px-4 py-2 text-sm font-black text-white hover:bg-slate-600"
            >
              Limpar filtro
            </button>
          </div>
        </section>
      )}

      {filtroPrazo && (
        <section className="mb-6 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-yellow-100">
          <p className="text-sm font-black">Filtro de prazo ativo: {nomeFiltroPrazo(filtroPrazo)}</p>
        </section>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-9 gap-5 mb-8">
        <KpiCard titulo="DHL" valor={totais.dhl.qtd} detalhe={`Saldo ${moeda(totais.dhl.saldo)}`} icone="🟡" onClick={() => filtroRapido('DHL')} />
        <KpiCard titulo="FedEx" valor={totais.fedex.qtd} detalhe={`Saldo ${moeda(totais.fedex.saldo)}`} icone="🟣" onClick={() => filtroRapido('FEDEX')} />
        <KpiCard titulo="Vencendo hoje" valor={totais.vencendoHoje.qtd} detalhe={`Saldo ${moeda(totais.vencendoHoje.saldo)}`} icone="📅" onClick={() => filtroRapido('VENCENDO_HOJE')} />
        <KpiCard titulo="Vencidas" valor={totais.vencidas.qtd} detalhe={`Saldo ${moeda(totais.vencidas.saldo)}`} icone="🚨" onClick={() => filtroRapido('VENCIDAS')} />
        <KpiCard titulo="Em aberto" valor={totais.abertas.qtd} detalhe={`Saldo ${moeda(totais.abertas.saldo)}`} icone="⏳" onClick={() => filtroRapido('ABERTAS')} />
        <KpiCard titulo="Prontas para pagar" valor={totais.prontasPagar.qtd} detalhe="Todos os AWBs recebidos" icone="✅" onClick={() => filtroRapido('PRONTAS_PAGAR')} />
        <KpiCard titulo="Pagas c/ pendência" valor={totais.pagasPendentes.qtd} detalhe={`${totais.pagasPendentes.processos} processo(s) • ${moeda(totais.pagasPendentes.valorPendente)}`} icone="⚠️" onClick={() => filtroRapido('PAGAS_PENDENTES')} />
        <KpiCard titulo="Arquivadas" valor={totais.arquivadas.qtd} detalhe="Ocultas da visão principal" icone="🗄️" onClick={() => filtroRapido('ARQUIVADAS')} />
        <KpiCard titulo="Saldo ativo" valor={moeda(totais.geral.saldo)} detalhe={`${totais.geral.qtd} fatura(s)`} icone="💰" />
      </section>

      <section id="form_fatura_transportadora" className="border border-blue-900 rounded-3xl bg-[#071225] p-7 mb-8">
        <div className="flex flex-col lg:flex-row justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-black">
              {editandoId ? 'Editar fatura da transportadora' : 'Cadastrar fatura da transportadora'}
            </h2>
            <p className="text-slate-400 text-sm">
              Cadastre manualmente ou cole os dados principais da DHL/FedEx.
            </p>
          </div>

          {editandoId && (
            <button
              onClick={limparFormulario}
              className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold h-fit"
            >
              Cancelar edição
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-6 gap-4">
          <Campo label="Transportadora">
            <select
              value={form.transportadora}
              onChange={(e) => setForm({ ...form, transportadora: e.target.value })}
            >
              <option value="DHL">DHL</option>
              <option value="FedEx">FedEx</option>
              <option value="KPM">KPM</option>
              <option value="CLIPPER">CLIPPER</option>
            </select>
          </Campo>

          <Campo label="Conta">
            <input
              value={form.conta}
              onChange={(e) => setForm({ ...form, conta: e.target.value })}
              placeholder="Ex: 965847180"
            />
          </Campo>

          <Campo label="Nº fatura">
            <input
              value={form.numero_fatura}
              onChange={(e) => {
                const numeroDigitado = e.target.value
                const numeroNormalizado = normalizarNumeroFaturaParaSistema(numeroDigitado)
                const transportadoraDetectada = identificarTransportadoraPelaFatura(numeroDigitado)

                setForm({
                  ...form,
                  numero_fatura: numeroNormalizado,
                  transportadora: transportadoraDetectada || form.transportadora,
                })
              }}
              placeholder="DHL: 2542443959 | FedEx: 5-475-48028 ou 547548028"
            />
          </Campo>

          <Campo label="Emissão">
            <input
              type="date"
              value={form.emissao}
              onChange={(e) => setForm({ ...form, emissao: e.target.value })}
            />
          </Campo>

          <Campo label="Vencimento">
            <input
              type="date"
              value={form.vencimento}
              onChange={(e) => setForm({ ...form, vencimento: e.target.value })}
            />
          </Campo>

          <Campo label="Data de pagamento">
            <input
              type="date"
              value={form.data_pagamento}
              onChange={(e) => setForm({ ...form, data_pagamento: e.target.value })}
            />
            {editandoId && (() => {
              const faturaAtual = faturas.find((item) => item.id === editandoId)
              if (!faturaAtual) return null
              const conciliacao = resumoConciliacao(faturaAtual)

              return (
                <p className={`mt-2 rounded-lg border px-3 py-2 text-xs font-bold ${classeStatusConciliacao(conciliacao.status)}`}>
                  {textoStatusConciliacao(conciliacao.status)} • {conciliacao.recebidos}/{conciliacao.totalItens} AWB(s) recebidos
                </p>
              )
            })()}
          </Campo>

          <Campo label="Banco utilizado">
            <input
              list="bancos-pagamento"
              value={form.utilizado_para}
              onChange={(e) => setForm({ ...form, utilizado_para: e.target.value })}
              placeholder="Ex: ITAU, BS2 ou CONTABILIZEI BANK"
            />
            <datalist id="bancos-pagamento">
              <option value="ITAU" />
              <option value="BS2" />
              <option value="CONTABILIZEI BANK" />
            </datalist>
          </Campo>

          <Campo label="Situação">
            <select
              value={form.situacao}
              onChange={(e) => setForm({ ...form, situacao: e.target.value })}
            >
              <option value="EM ABERTO">Em aberto</option>
              <option value="VENCIDA">Vencida</option>
              <option value="PAGA">Paga</option>
              <option value="CONTESTADA">Contestada</option>
              <option value="FATURA CANCELADA">Fatura cancelada</option>
            </select>
          </Campo>

          <Campo label="Total">
            <input
              value={formatarEntradaValorBR(form.total)}
              inputMode="decimal"
              onChange={(e) => setForm({ ...form, total: formatarEntradaValorBR(e.target.value) })}
              placeholder="Ex: 3810,58"
            />
          </Campo>

          <Campo label="Valor contestado">
            <input
              value={formatarEntradaValorBR(form.valor_contestado)}
              inputMode="decimal"
              onChange={(e) => setForm({ ...form, valor_contestado: formatarEntradaValorBR(e.target.value) })}
              placeholder="Ex: 0,00"
            />
          </Campo>

          <Campo label="Pago / Ajustado">
            <input
              value={formatarEntradaValorBR(form.pago_ajustado)}
              inputMode="decimal"
              onChange={(e) => setForm({ ...form, pago_ajustado: formatarEntradaValorBR(e.target.value) })}
              placeholder="Ex: 0,00"
            />
          </Campo>

          <Campo label="Saldo">
            <input
              value={formatarEntradaValorBR(form.saldo)}
              inputMode="decimal"
              onChange={(e) => setForm({ ...form, saldo: formatarEntradaValorBR(e.target.value) })}
              placeholder="Se vazio, calcula automático"
            />
          </Campo>

          <Campo label="Moeda">
            <select
              value={form.moeda}
              onChange={(e) => setForm({ ...form, moeda: e.target.value })}
            >
              <option value="BRL">BRL</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </Campo>

          <div className="md:col-span-4 xl:col-span-6">
            <Campo label="Observações">
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                className="min-h-[80px]"
                placeholder="Observações internas"
              />
            </Campo>
          </div>

          <button
            onClick={salvarFatura}
            disabled={salvando}
            className="md:col-span-4 xl:col-span-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 px-5 py-4 rounded-2xl font-black"
          >
            {salvando ? 'Salvando...' : editandoId ? 'Salvar edição' : 'Cadastrar fatura'}
          </button>
        </div>
      </section>

      <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
        <div className="flex flex-col xl:flex-row justify-between gap-5 mb-6">
          <div>
            <h2 className="text-2xl font-black">Faturas cadastradas</h2>
            <p className="text-slate-400 text-sm">
              {filtradas.length} de {faturas.length} fatura(s) encontrada(s)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 w-full xl:max-w-[1320px]">
            <MultiFiltro
              titulo="Transportadora"
              opcoes={[
                { valor: 'DHL', label: 'DHL' },
                { valor: 'FedEx', label: 'FedEx' },
                { valor: 'KPM', label: 'KPM' },
                { valor: 'CLIPPER', label: 'CLIPPER' },
              ]}
              selecionados={filtroTransportadoras}
              onChange={setFiltroTransportadoras}
            />

            <MultiFiltro
              titulo="Situação"
              opcoes={[
                { valor: 'EM ABERTO', label: 'Em aberto' },
                { valor: 'VENCIDA', label: 'Vencida' },
                { valor: 'PAGA', label: 'Paga' },
                { valor: 'CONTESTADA', label: 'Contestada' },
                { valor: 'FATURA CANCELADA', label: 'Fatura cancelada' },
              ]}
              selecionados={filtroSituacoes}
              onChange={setFiltroSituacoes}
            />

            <select
              value={filtroArquivadas}
              onChange={(e) => setFiltroArquivadas(e.target.value)}
            >
              <option value="ATIVAS">Ativas</option>
              <option value="ARQUIVADAS">Arquivadas</option>
              <option value="TODAS">Todas</option>
            </select>

            <select
              value={filtroPrazo}
              onChange={(e) => setFiltroPrazo(e.target.value)}
            >
              <option value="">Vencimento: todos</option>
              <option value="HOJE">Vencendo hoje</option>
              <option value="AMANHA">Vencendo amanhã</option>
              <option value="PROXIMOS_7_DIAS">Próximos 7 dias</option>
              <option value="VENCIDAS">Vencidas</option>
              <option value="SEM_DATA">Sem vencimento</option>
            </select>

            <select
              value={filtroConciliacao}
              onChange={(e) => setFiltroConciliacao(e.target.value)}
            >
              <option value="TODAS">Recebimentos: todos</option>
              <option value="PRONTA_PARA_PAGAR">Prontas para pagar</option>
              <option value="AGUARDANDO_RECEBIMENTO">Aguardando recebimento</option>
              <option value="COBERTURA_INSUFICIENTE">Cobertura insuficiente</option>
              <option value="PAGA_COM_PENDENCIA">Pagas com pendência</option>
              <option value="PAGA_COBERTA">Pagas e conciliadas</option>
              <option value="SEM_CONCILIACAO">Sem conciliação</option>
            </select>

            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por conta, fatura, observação..."
            />

            <button
              onClick={limparFiltros}
              className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold"
            >
              Limpar filtros
            </button>
          </div>
        </div>

        {selecionadas.length > 0 && (
          <div className="mb-5 border border-blue-900 bg-[#020817] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="font-black text-blue-300">
                {selecionadas.length} fatura(s) selecionada(s)
              </p>
              <p className="text-slate-500 text-sm">
                {selecionadasAtivas} ativa(s) • {selecionadasArquivadas} arquivada(s)
              </p>
            </div>

            <div className="flex gap-3 flex-wrap">
              {selecionadasAtivas > 0 && (
                <button
                  onClick={() => arquivarSelecionadas(true)}
                  className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold"
                >
                  Arquivar selecionadas
                </button>
              )}

              {selecionadasArquivadas > 0 && (
                <button
                  onClick={() => arquivarSelecionadas(false)}
                  className="bg-green-700 hover:bg-green-600 px-5 py-3 rounded-xl font-bold"
                >
                  Restaurar selecionadas
                </button>
              )}

              <button
                onClick={() => setSelecionadas([])}
                className="bg-red-700 hover:bg-red-600 px-5 py-3 rounded-xl font-bold"
              >
                Limpar seleção
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="border border-blue-900 bg-[#020817] rounded-2xl p-6 text-slate-400">
            Carregando faturas...
          </div>
        ) : filtradas.length === 0 ? (
          <div className="border border-blue-900 bg-[#020817] rounded-2xl p-6 text-slate-400">
            Nenhuma fatura encontrada.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[2050px] border-collapse text-sm [&_th]:border-b [&_th]:border-blue-900 [&_th]:px-3 [&_th]:py-3 [&_th]:text-left [&_th]:font-black [&_th]:text-slate-300 [&_td]:px-3 [&_td]:py-4 [&_td]:align-middle">
              <thead>
                <tr>
                  <th className="w-[48px]">
                    <input
                      type="checkbox"
                      checked={todasFiltradasSelecionadas}
                      onChange={(e) => selecionarTodasFiltradas(e.target.checked)}
                    />
                  </th>
                  <th>Transportadora</th>
                  <th>Conta</th>
                  <th>Fatura</th>
                  <th>Emissão</th>
                  <th>Vencimento</th>
                  <th>Pagamento</th>
                  <th>Banco</th>
                  <th>Situação</th>
                  <th>Recebimentos</th>
                  <th>Total</th>
                  <th>Contestado</th>
                  <th>Pago/Ajust.</th>
                  <th>Saldo</th>
                  <th>PDF</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {filtradas.map((item) => {
                  const status = situacaoAutomatica(item)
                  const conciliacao = resumoConciliacao(item)
                  const detalhesAbertos = faturaConciliacaoAberta === item.id

                  return (
                    <Fragment key={item.id}>
                    <tr className="border-b border-blue-900/60 hover:bg-[#0b1730] transition">
                      <td>
                        <input
                          type="checkbox"
                          checked={selecionadas.includes(item.id)}
                          onChange={(e) => alternarSelecao(item.id, e.target.checked)}
                        />
                      </td>

                      <td className="font-black">
                        <span className={item.transportadora === 'DHL' ? 'text-yellow-300' : 'text-purple-300'}>
                          {item.transportadora}
                        </span>
                      </td>

                      <td>
                        <strong>{item.conta || '-'}</strong>
                      </td>

                      <td>
                        <strong className="text-blue-400">{item.numero_fatura || '-'}</strong>
                        {item.status_recebimento_fatura ? (
                          <p className="text-slate-500 text-xs mt-1 max-w-[240px] truncate">
                            {item.status_recebimento_fatura}
                          </p>
                        ) : item.dias_restantes ? (
                          <p className="text-slate-500 text-xs mt-1 max-w-[240px] truncate">
                            {item.dias_restantes}
                          </p>
                        ) : item.observacoes ? (
                          <p className="text-slate-500 text-xs mt-1 max-w-[240px] truncate">
                            {item.observacoes}
                          </p>
                        ) : null}
                      </td>

                      <td>{dataBR(item.emissao)}</td>
                      <td>{dataBR(item.vencimento)}</td>
                      <td>{dataBR(item.data_pagamento)}</td>
                      <td>
                        <span className="font-bold text-slate-300">
                          {item.utilizado_para || '-'}
                        </span>
                      </td>

                      <td>
                        <span className={`border px-3 py-1 rounded-full text-xs font-black ${classeSituacao(status)}`}>
                          {status}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          onClick={() => setFaturaConciliacaoAberta(detalhesAbertos ? null : item.id)}
                          className={`min-w-[190px] rounded-xl border px-3 py-2 text-left ${classeStatusConciliacao(conciliacao.status)}`}
                        >
                          <span className="block text-xs font-black">{textoStatusConciliacao(conciliacao.status)}</span>
                          <span className="mt-1 block text-[11px] opacity-90">
                            {conciliacao.totalItens > 0
                              ? `${conciliacao.recebidos}/${conciliacao.totalItens} recebidos • cobertura ${conciliacao.cobertura.toFixed(0)}%`
                              : 'Nenhum AWB vinculado para conferência'}
                          </span>
                        </button>
                      </td>

                      <td>{moeda(item.total, item.moeda || 'BRL')}</td>
                      <td>{moeda(item.valor_contestado, item.moeda || 'BRL')}</td>
                      <td>{moeda(item.pago_ajustado, item.moeda || 'BRL')}</td>
                      <td className="font-black">{moeda(item.saldo, item.moeda || 'BRL')}</td>

                      <td>
                        {item.arquivo_pdf ? (
                          <a
                            href={item.arquivo_pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-green-600 hover:bg-green-500 px-3 py-2 rounded-xl font-bold text-xs inline-block"
                          >
                            Abrir
                          </a>
                        ) : (
                          <span className="text-slate-500">Sem PDF</span>
                        )}
                      </td>

                      <td>
                        <div className="flex gap-2 flex-wrap">
                          <label className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-xl font-bold text-xs cursor-pointer">
                            {uploadingId === item.id ? 'Enviando...' : 'PDF'}
                            <input
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              disabled={uploadingId === item.id}
                              onChange={(e) => anexarPdf(item, e.target.files?.[0] || null)}
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() => setFaturaConciliacaoAberta(detalhesAbertos ? null : item.id)}
                            className="bg-emerald-700 hover:bg-emerald-600 px-3 py-2 rounded-xl font-bold text-xs"
                          >
                            {detalhesAbertos ? 'Fechar conciliação' : 'Conferir recebimentos'}
                          </button>

                          <button
                            onClick={() => editar(item)}
                            className="bg-purple-600 hover:bg-purple-500 px-3 py-2 rounded-xl font-bold text-xs"
                          >
                            Editar
                          </button>

                          <button
                            onClick={() => alternarArquivada(item)}
                            className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-xl font-bold text-xs"
                          >
                            {item.arquivada ? 'Restaurar' : 'Arquivar'}
                          </button>

                          <button
                            onClick={() => excluir(item)}
                            className="bg-red-700 hover:bg-red-600 px-3 py-2 rounded-xl font-bold text-xs"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>

                    {detalhesAbertos && (
                      <tr className="border-b border-blue-900/80 bg-[#020817]">
                        <td colSpan={16} className="px-4 py-5">
                          <div className="rounded-2xl border border-blue-900 bg-[#071225] p-5">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                              <div>
                                <p className="text-xs font-black uppercase tracking-wider text-blue-400">Conciliação de recebimentos</p>
                                <h3 className="mt-1 text-xl font-black">
                                  {item.transportadora} • Fatura {item.numero_fatura || '-'}
                                </h3>
                                <p className="mt-2 text-sm text-slate-400">
                                  O pagamento da transportadora fica seguro somente quando todos os AWBs abaixo possuem data de recebimento no Financeiro.
                                </p>
                              </div>

                              <span className={`w-fit rounded-full border px-4 py-2 text-xs font-black ${classeStatusConciliacao(conciliacao.status)}`}>
                                {textoStatusConciliacao(conciliacao.status)}
                              </span>
                            </div>

                            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
                              <MiniResumo titulo="AWBs na fatura" valor={conciliacao.totalItens} />
                              <MiniResumo titulo="Recebidos" valor={conciliacao.recebidos} destaque="verde" />
                              <MiniResumo titulo="Pendentes" valor={conciliacao.pendentes} destaque={conciliacao.pendentes > 0 ? 'vermelho' : 'verde'} />
                              <MiniResumo titulo="Não localizados" valor={conciliacao.naoLocalizados} destaque={conciliacao.naoLocalizados > 0 ? 'vermelho' : 'verde'} />
                              <MiniResumo titulo="Recebido clientes" valor={moeda(conciliacao.valorRecebido)} destaque="verde" />
                              <MiniResumo titulo="Ainda a receber" valor={moeda(conciliacao.valorPendente)} destaque={conciliacao.valorPendente > 0 ? 'vermelho' : 'verde'} />
                              <MiniResumo titulo="Cobertura da fatura" valor={`${conciliacao.cobertura.toFixed(1)}%`} destaque={conciliacao.coberturaSuficiente ? 'verde' : 'vermelho'} />
                            </div>

                            {conciliacao.totalItens === 0 ? (
                              <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm font-bold text-amber-200">
                                Esta fatura ainda não possui AWBs vinculados em faturas_transportadoras_itens. Não é possível validar se os clientes pagaram até os itens da fatura serem importados/vinculados.
                              </div>
                            ) : (
                              <div className="mt-5 overflow-x-auto rounded-xl border border-blue-900">
                                <table className="w-full min-w-[980px] text-xs">
                                  <thead className="bg-[#020817] text-slate-300">
                                    <tr>
                                      <th className="px-3 py-3 text-left">AWB / Processo</th>
                                      <th className="px-3 py-3 text-left">Cliente</th>
                                      <th className="px-3 py-3 text-right">Custo transportadora</th>
                                      <th className="px-3 py-3 text-right">Cobrança cliente</th>
                                      <th className="px-3 py-3 text-left">Recebimento</th>
                                      <th className="px-3 py-3 text-left">Situação</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {conciliacao.itens.map(({ item: itemFatura, processo, recebido }) => (
                                      <tr key={itemFatura.id} className="border-t border-blue-900/70">
                                        <td className="px-3 py-3 font-black text-blue-300">{itemFatura.awb || '-'}</td>
                                        <td className="px-3 py-3">{processo?.cliente || (processo ? '-' : 'Não localizado')}</td>
                                        <td className="px-3 py-3 text-right">{moeda(itemFatura.valor_compra)}</td>
                                        <td className="px-3 py-3 text-right">{processo ? moeda(processo.valor_cobranca) : '-'}</td>
                                        <td className="px-3 py-3">{processo ? dataBR(processo.recebimento) : '-'}</td>
                                        <td className="px-3 py-3">
                                          {!processo ? (
                                            <span className="rounded-full border border-red-500 bg-red-500/15 px-2 py-1 font-black text-red-300">NÃO LOCALIZADO</span>
                                          ) : recebido ? (
                                            <span className="rounded-full border border-green-500 bg-green-500/15 px-2 py-1 font-black text-green-300">RECEBIDO</span>
                                          ) : (
                                            <span className="rounded-full border border-amber-500 bg-amber-500/15 px-2 py-1 font-black text-amber-300">AGUARDANDO CLIENTE</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
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


function MultiFiltro({
  titulo,
  opcoes,
  selecionados,
  onChange,
}: {
  titulo: string
  opcoes: { valor: string; label: string }[]
  selecionados: string[]
  onChange: (valores: string[]) => void
}) {
  function alternar(valor: string) {
    if (selecionados.includes(valor)) {
      onChange(selecionados.filter((item) => item !== valor))
      return
    }

    onChange([...selecionados, valor])
  }

  const resumo =
    selecionados.length === 0
      ? `${titulo}: todos`
      : selecionados.length === 1
        ? `${titulo}: ${opcoes.find((opcao) => opcao.valor === selecionados[0])?.label || selecionados[0]}`
        : `${titulo}: ${selecionados.length} selecionados`

  return (
    <details className="relative group">
      <summary className="list-none cursor-pointer select-none border border-blue-900 bg-[#020817] rounded-xl px-4 py-3 font-bold text-white flex items-center justify-between gap-3">
        <span className="truncate">{resumo}</span>
        <span className="text-slate-400 group-open:rotate-180 transition">⌄</span>
      </summary>

      <div className="absolute z-30 mt-2 w-full min-w-[240px] rounded-2xl border border-blue-900 bg-[#020817] p-3 shadow-2xl">
        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
          {opcoes.map((opcao) => {
            const ativo = selecionados.includes(opcao.valor)

            return (
              <label
                key={opcao.valor}
                className={
                  ativo
                    ? 'flex items-center gap-3 rounded-xl border border-blue-500 bg-blue-600/20 px-3 py-2 font-bold text-white cursor-pointer'
                    : 'flex items-center gap-3 rounded-xl border border-blue-900 bg-[#071225] px-3 py-2 font-bold text-slate-300 hover:border-blue-500 cursor-pointer'
                }
              >
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={() => alternar(opcao.valor)}
                />
                {opcao.label}
              </label>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => onChange([])}
          className="mt-3 w-full bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-xl font-bold text-xs"
        >
          Limpar {titulo.toLowerCase()}
        </button>
      </div>
    </details>
  )
}

function MiniResumo({
  titulo,
  valor,
  destaque = 'padrao',
}: {
  titulo: string
  valor: any
  destaque?: 'padrao' | 'verde' | 'vermelho' | 'amarelo'
}) {
  const classe =
    destaque === 'verde'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
      : destaque === 'vermelho'
        ? 'border-red-500/40 bg-red-500/10 text-red-300'
        : destaque === 'amarelo'
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
          : 'border-blue-900 bg-[#020817] text-white'

  return (
    <div className={`rounded-xl border p-3 ${classe}`}>
      <p className="text-[10px] font-black uppercase tracking-wide opacity-75">{titulo}</p>
      <p className="mt-2 text-lg font-black">{valor}</p>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-slate-300 font-bold mb-2">{label}</label>
      {children}
    </div>
  )
}

function KpiCard({
  titulo,
  valor,
  detalhe,
  icone,
  onClick,
}: {
  titulo: string
  valor: any
  detalhe: string
  icone: string
  onClick?: () => void
}) {
  const conteudo = (
    <div className="flex justify-between items-start gap-4">
      <div>
        <p className="text-slate-300 font-bold">{titulo}</p>
        <h2 className="text-4xl font-black mt-4 text-white">{valor}</h2>
        <p className="text-slate-400 mt-2 text-sm">{detalhe}</p>
      </div>

      <div className="text-4xl">{icone}</div>
    </div>
  )

  if (!onClick) {
    return (
      <div className="border border-blue-900 rounded-3xl bg-[#071225] p-6">
        {conteudo}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-blue-900 rounded-3xl bg-[#071225] hover:border-blue-400 hover:bg-blue-600/10 transition p-6 text-left"
    >
      {conteudo}
    </button>
  )
}
