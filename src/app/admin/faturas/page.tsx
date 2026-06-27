'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import StatusBadge from '@/components/StatusBadge'

const LOTE_SUPABASE = 1000
const STORAGE_FILTROS_FATURAS_ADMIN = 'hc_admin_faturas_filtros_v1'

type Embarque = {
  id: string
  awb: string
  usuario_id: string | null
  cliente_final: string | null
  exportador?: string | null
  importador?: string | null
  transportadora: string | null
  status_operacional: string | null
  criado_em?: string | null
  servico?: string | null
  origem?: string | null
  destino?: string | null
  referencia_cliente?: string | null
  referencia_hc?: string | null
  valor_venda?: number | string | null
  valor_fechado?: number | string | null
  valor_cobrado_cliente?: number | string | null
  moeda?: string | null
  moeda_cobranca?: string | null
  taxa_conversao?: number | string | null
  spread?: number | string | null
  peso_real?: number | string | null
  peso_taxado?: number | string | null
  servicos_financeiros?: ServicoFinanceiroEmbarque[] | any[] | null
}

type Fatura = {
  id: string
  embarque_id: string | null
  usuario_id: string | null
  numero_fatura: string | null
  arquivo_pdf: string | null
  recibo_pdf: string | null
  recibo_nome: string | null
  comprovante_pagamento?: string | null
  data_comprovante?: string | null
  status_pagamento?: string | null
  observacao_pagamento?: string | null
  criado_em: string
  visivel_cliente?: boolean | null
  observacoes?: string | null
  valor_total?: number | string | null
  valor_usd?: number | string | null
  taxa_conversao?: number | string | null
  spread?: number | string | null
  vencimento?: string | null
  data_pagamento?: string | null
  valor_pago?: number | string | null
  recibo_emitido_em?: string | null
  recibo_observacoes?: string | null
  dados_cliente_faturamento?: any
  itens_fatura?: any
  arquivado_admin?: boolean | null
  arquivado_admin_em?: string | null
  arquivado_admin_por?: string | null
  embarques?: any
}



type FaturaArquivo = {
  id: string
  fatura_id: string
  embarque_id?: string | null
  usuario_id?: string | null
  tipo: string
  nome: string | null
  url: string
  caminho?: string | null
  visivel_cliente?: boolean | null
  criado_em?: string | null
}

type FinanceiroProcesso = {
  id?: string
  embarque_id?: string | null
  awb?: string | number | null
  numero_awb?: string | number | null
  hawb?: string | number | null
  h_awb?: string | number | null
  valor_cobranca?: number | string | null
  valor_faturado?: number | string | null
  valor_venda?: number | string | null
  valor?: number | string | null
  vencimento_cobranca?: string | null
  vencimento_cliente?: string | null
  vencimento?: string | null
  data_vencimento?: string | null
  recebimento?: string | null
  recebimento_cliente?: string | null
  data_recebimento?: string | null
  data_pagamento?: string | null
  cliente?: string | null
  cliente_final?: string | null
  fatura?: string | null
  numero_fatura?: string | null
  despachante?: string | null
  transportadora?: string | null
  servico?: string | null
  mes?: string | null
  mes_profit?: string | null
  observacoes?: string | null
  doc_dta?: number | string | null
  debito_terceiro?: number | string | null
  valor_compra?: number | string | null
}

type DocumentoEmbarque = {
  id: string
  embarque_id: string
  nome?: string | null
  nome_arquivo?: string | null
  filename?: string | null
  tipo?: string | null
  categoria?: string | null
  url?: string | null
  arquivo_url?: string | null
  arquivo_pdf?: string | null
  criado_em?: string | null
}

type StatusPagamentoFinanceiro = {
  status: 'PAGO' | 'ATRASADO' | 'EM_ABERTO' | 'SEM_FINANCEIRO'
  label: string
  detalhe: string
  classe: string
}

type AbaFaturasAdmin = 'FATURAS' | 'EMISSOR' | 'RECIBO'

type ServicoFinanceiroEmbarque = {
  nome?: string | null
  valor?: string | number | null
}


type ClienteFaturamento = {
  id: string
  codigo_hc?: string | null
  nome_empresa: string
  razao_social?: string | null
  nome?: string | null
  cliente?: string | null
  documento?: string | null
  nome_contato?: string | null
  endereco?: string | null
  cidade?: string | null
  estado?: string | null
  cep?: string | null
  cnpj?: string | null
  cpf?: string | null
  email?: string | null
  contato?: string | null
  inscricao_estadual?: string | null
  inscricao_municipal?: string | null
  observacoes?: string | null
  ativo?: boolean | null
}

type PerfilCliente = {
  id: string
  nome?: string | null
  email?: string | null
  tipo_acesso?: string | null
  ativo?: boolean | null
}

type ItemFaturaServico = {
  id: string
  descricao: string
  selecionado: boolean
  valor_usd: string
  valor_brl: string
  observacao: string
}

export default function FaturasPage() {
  const [embarques, setEmbarques] = useState<Embarque[]>([])
  const [faturas, setFaturas] = useState<Fatura[]>([])
  const [arquivosFaturas, setArquivosFaturas] = useState<FaturaArquivo[]>([])
  const [financeiros, setFinanceiros] = useState<FinanceiroProcesso[]>([])
  const [documentosPorEmbarque, setDocumentosPorEmbarque] = useState<Record<string, DocumentoEmbarque[]>>({})
  const [pacoteAbertoId, setPacoteAbertoId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [enviandoRecibo, setEnviandoRecibo] = useState<string | null>(null)
  const [removendoFatura, setRemovendoFatura] = useState<string | null>(null)
  const [enviandoArquivoExtra, setEnviandoArquivoExtra] = useState<string | null>(null)
  const [removendoArquivoExtra, setRemovendoArquivoExtra] = useState<string | null>(null)
  const [reciboSelecionado, setReciboSelecionado] = useState<Embarque | null>(null)
  const [dataRecebimentoRecibo, setDataRecebimentoRecibo] = useState('')
  const [valorRecebidoRecibo, setValorRecebidoRecibo] = useState('')
  const [formaRecebimentoRecibo, setFormaRecebimentoRecibo] = useState('PIX / Transferência bancária')
  const [observacoesRecibo, setObservacoesRecibo] = useState('')
  const [buscaClienteRecibo, setBuscaClienteRecibo] = useState('')
  const [reciboClienteId, setReciboClienteId] = useState('')
  const [emitindoRecibo, setEmitindoRecibo] = useState(false)

  const [busca, setBusca] = useState('')
  const [filtroDocumento, setFiltroDocumento] = useState('TODOS')
  const [filtroStatusEmbarque, setFiltroStatusEmbarque] = useState('TODOS')
  const [filtroPagamento, setFiltroPagamento] = useState('TODOS')
  const [filtroArquivamento, setFiltroArquivamento] = useState('ATIVAS')
  const [filtrosCarregados, setFiltrosCarregados] = useState(false)

  const [embarqueSelecionado, setEmbarqueSelecionado] = useState<Embarque | null>(null)
  const [numeroFatura, setNumeroFatura] = useState('')
  const [visivelCliente, setVisivelCliente] = useState(true)
  const [observacoes, setObservacoes] = useState('')
  const [arquivoPdf, setArquivoPdf] = useState<File | null>(null)


  const [abaAtiva, setAbaAtiva] = useState<AbaFaturasAdmin>('FATURAS')
  const [buscaRecibo, setBuscaRecibo] = useState('')
  const [clientesFaturamento, setClientesFaturamento] = useState<ClienteFaturamento[]>([])
  const [usuariosPortal, setUsuariosPortal] = useState<PerfilCliente[]>([])
  const [buscaEmissorAwb, setBuscaEmissorAwb] = useState('')
  const [filtroStatusEmissor, setFiltroStatusEmissor] = useState('TODOS')
  const [buscaClienteEmissor, setBuscaClienteEmissor] = useState('')
  const [buscandoClientesEmissor, setBuscandoClientesEmissor] = useState(false)
  const [buscaUsuarioEmissor, setBuscaUsuarioEmissor] = useState('')
  const [emissorEmbarqueId, setEmissorEmbarqueId] = useState('')
  const [emissorClienteId, setEmissorClienteId] = useState('')
  const [emissorUsuarioId, setEmissorUsuarioId] = useState('')
  const [emissorDespachante, setEmissorDespachante] = useState('')
  const [emissorNumeroFatura, setEmissorNumeroFatura] = useState('')
  const [emissorVencimento, setEmissorVencimento] = useState('')
  const [emissorTaxaConversao, setEmissorTaxaConversao] = useState('')
  const [emissorTipoCambio, setEmissorTipoCambio] = useState('DOLAR_VENDA_DIA')
  const [emissorDolarVendaDia, setEmissorDolarVendaDia] = useState('')
  const [emissorPtaxDhlMesAnterior, setEmissorPtaxDhlMesAnterior] = useState('')
  const [emissorDataPtaxDhlMesAnterior, setEmissorDataPtaxDhlMesAnterior] = useState('')
  const [emissorSpread, setEmissorSpread] = useState('3')
  const [emissorObservacoes, setEmissorObservacoes] = useState('')
  const [emissorVisivelCliente, setEmissorVisivelCliente] = useState(true)
  const [carregandoCambioEmissor, setCarregandoCambioEmissor] = useState(false)
  const [emissorAvisoCambio, setEmissorAvisoCambio] = useState('')
  const [salvandoEmissao, setSalvandoEmissao] = useState(false)
  const [itensFatura, setItensFatura] = useState<ItemFaturaServico[]>(itensPadraoFatura())

  useEffect(() => {
    carregar()
  }, [])

  useEffect(() => {
    const termo = buscaClienteEmissor.trim()

    if (termo.length < 2) return

    const timer = setTimeout(() => {
      buscarClientesFaturamentoEmissor(termo)
    }, 350)

    return () => clearTimeout(timer)
  }, [buscaClienteEmissor])

  useEffect(() => {
    const termo = buscaClienteRecibo.trim()

    if (termo.length < 2) return

    const timer = setTimeout(() => {
      buscarClientesFaturamentoEmissor(termo)
    }, 350)

    return () => clearTimeout(timer)
  }, [buscaClienteRecibo])

  useEffect(() => {
    try {
      const filtrosSalvos = localStorage.getItem(STORAGE_FILTROS_FATURAS_ADMIN)

      if (filtrosSalvos) {
        const filtros = JSON.parse(filtrosSalvos)

        setBusca(filtros.busca || '')
        setFiltroDocumento(filtros.filtroDocumento || 'TODOS')
        setFiltroStatusEmbarque(filtros.filtroStatusEmbarque || 'TODOS')
        setFiltroPagamento(filtros.filtroPagamento || 'TODOS')
        setFiltroArquivamento(filtros.filtroArquivamento || 'ATIVAS')
      }
    } catch (error) {
      console.log('Não foi possível carregar filtros salvos:', error)
    } finally {
      setFiltrosCarregados(true)
    }
  }, [])

  useEffect(() => {
    if (!filtrosCarregados) return

    try {
      localStorage.setItem(
        STORAGE_FILTROS_FATURAS_ADMIN,
        JSON.stringify({
          busca,
          filtroDocumento,
          filtroStatusEmbarque,
          filtroPagamento,
          filtroArquivamento,
        })
      )
    } catch (error) {
      console.log('Não foi possível salvar filtros:', error)
    }
  }, [
    busca,
    filtroDocumento,
    filtroStatusEmbarque,
    filtroPagamento,
    filtroArquivamento,
    filtrosCarregados,
  ])

  async function carregar() {
    const { data: embarquesData, error: erroEmbarques } = await supabase
      .from('embarques')
      .select('*')
      .order('criado_em', { ascending: false })

    if (erroEmbarques) console.log(erroEmbarques)

    const { data: faturasData, error: erroFaturas } = await supabase
      .from('faturas')
      .select(`
        id,
        embarque_id,
        usuario_id,
        numero_fatura,
        arquivo_pdf,
        recibo_pdf,
        recibo_nome,
        comprovante_pagamento,
        data_comprovante,
        status_pagamento,
        observacao_pagamento,
        criado_em,
        visivel_cliente,
        observacoes,
        valor_total,
        valor_usd,
        taxa_conversao,
        spread,
        vencimento,
        data_pagamento,
        valor_pago,
        recibo_emitido_em,
        recibo_observacoes,
        dados_cliente_faturamento,
        itens_fatura,
        arquivado_admin,
        arquivado_admin_em,
        arquivado_admin_por,
        embarques (
          awb,
          cliente_final,
          exportador,
          importador,
          transportadora,
          status_operacional
        )
      `)
      .order('criado_em', { ascending: false })

    if (erroFaturas) console.log(erroFaturas)

    const { count: totalFinanceiro, error: erroCountFinanceiro } = await supabase
      .from('financeiro_embarques')
      .select('*', { count: 'exact', head: true })

    if (erroCountFinanceiro) console.log('ERRO COUNT FINANCEIRO:', erroCountFinanceiro)

    let financeiroData: any[] = []

    const total = totalFinanceiro || 0
    const paginasFinanceiro = Math.max(1, Math.ceil(total / LOTE_SUPABASE))

    if (total > 0) {
      const consultasFinanceiro = Array.from({ length: paginasFinanceiro }, (_, index) => {
        const inicio = index * LOTE_SUPABASE
        const fim = inicio + LOTE_SUPABASE - 1

        return supabase
          .from('financeiro_embarques')
          .select('*')
          .range(inicio, fim)
      })

      const respostasFinanceiro = await Promise.all(consultasFinanceiro)
      const erroFinanceiro = respostasFinanceiro.find((res) => res.error)

      if (erroFinanceiro?.error) {
        console.log('ERRO FINANCEIRO:', erroFinanceiro.error)
      }

      financeiroData = respostasFinanceiro.flatMap((res) => res.data || [])
    }

    const idsEmbarques = ((embarquesData as Embarque[]) || []).map((item) => item.id)
    let documentosAgrupados: Record<string, DocumentoEmbarque[]> = {}

    if (idsEmbarques.length > 0) {
      const { data: documentosData, error: erroDocumentos } = await supabase
        .from('documentos_embarques')
        .select('*')
        .in('embarque_id', idsEmbarques)

      if (erroDocumentos) {
        console.log('ERRO DOCUMENTOS EMBARQUES:', erroDocumentos)
      }

      ;((documentosData as DocumentoEmbarque[]) || []).forEach((doc) => {
        if (!doc.embarque_id) return
        if (!documentosAgrupados[doc.embarque_id]) documentosAgrupados[doc.embarque_id] = []
        documentosAgrupados[doc.embarque_id].push(doc)
      })
    }


    const { data: clientesFaturamentoData, error: erroClientesFaturamento } = await supabase
      .from('clientes_faturamento')
      .select('*')
      .eq('ativo', true)
      .order('nome_empresa', { ascending: true })

    if (erroClientesFaturamento) {
      console.log('ERRO CLIENTES FATURAMENTO:', erroClientesFaturamento)
    }

    setClientesFaturamento((clientesFaturamentoData as ClienteFaturamento[]) || [])

    const { data: usuariosPortalData, error: erroUsuariosPortal } = await supabase
      .from('perfis')
      .select('id, nome, email, tipo_acesso, ativo')
      .neq('tipo_acesso', 'admin')
      .order('nome', { ascending: true })

    if (erroUsuariosPortal) {
      console.log('ERRO USUÁRIOS PORTAL:', erroUsuariosPortal)
    }

    setUsuariosPortal(((usuariosPortalData as PerfilCliente[]) || []).filter((item) => item.ativo !== false))


    let arquivosFaturasData: FaturaArquivo[] = []
    const idsFaturas = ((faturasData as Fatura[]) || []).map((item) => item.id).filter(Boolean)

    if (idsFaturas.length > 0) {
      const { data: arquivosData, error: erroArquivosFaturas } = await supabase
        .from('fatura_arquivos')
        .select('*')
        .in('fatura_id', idsFaturas)
        .order('criado_em', { ascending: false })

      if (erroArquivosFaturas) {
        console.log('ERRO ARQUIVOS EXTRAS DAS FATURAS:', erroArquivosFaturas)
      }

      arquivosFaturasData = (arquivosData as FaturaArquivo[]) || []
    }

    setEmbarques((embarquesData as Embarque[]) || [])
    setFaturas((faturasData as Fatura[]) || [])
    setArquivosFaturas(arquivosFaturasData)
    setFinanceiros((financeiroData as FinanceiroProcesso[]) || [])
    setDocumentosPorEmbarque(documentosAgrupados)
  }


  async function buscarClientesFaturamentoEmissor(termoBusca: string) {
    const termo = termoBusca.trim()
    if (termo.length < 2) return

    setBuscandoClientesEmissor(true)

    try {
      const termoSeguro = termo.replace(/[%_,]/g, ' ').trim()
      const termoNumerico = termo.replace(/\D/g, '')
      const filtros = [
        `nome_empresa.ilike.%${termoSeguro}%`,
        `nome_contato.ilike.%${termoSeguro}%`,
        `codigo_hc.ilike.%${termoSeguro}%`,
        `email.ilike.%${termoSeguro}%`,
        `cidade.ilike.%${termoSeguro}%`,
        `estado.ilike.%${termoSeguro}%`,
        `cnpj.ilike.%${termoSeguro}%`,
        `cpf.ilike.%${termoSeguro}%`,
      ]

      if (termoNumerico && termoNumerico !== termoSeguro) {
        filtros.push(`cnpj.ilike.%${termoNumerico}%`)
        filtros.push(`cpf.ilike.%${termoNumerico}%`)
        filtros.push(`contato.ilike.%${termoNumerico}%`)
      }

      const { data, error } = await supabase
        .from('clientes_faturamento')
        .select('*')
        .eq('ativo', true)
        .or(filtros.join(','))
        .order('nome_empresa', { ascending: true })
        .limit(120)

      if (error) {
        console.log('ERRO BUSCA CLIENTES FATURAMENTO:', error)
        return
      }

      const encontrados = (data as ClienteFaturamento[]) || []

      setClientesFaturamento((atuais) => {
        const mapa = new Map<string, ClienteFaturamento>()

        ;(atuais || []).forEach((item) => {
          if (item?.id) mapa.set(item.id, item)
        })

        encontrados.forEach((item) => {
          if (item?.id) mapa.set(item.id, item)
        })

        return Array.from(mapa.values()).sort((a, b) =>
          String(a.nome_empresa || '').localeCompare(String(b.nome_empresa || ''), 'pt-BR')
        )
      })
    } finally {
      setBuscandoClientesEmissor(false)
    }
  }

  function documentoFiscalClienteRecibo(cliente?: any) {
    const cnpj = String(cliente?.cnpj || '').trim()
    const cpf = String(cliente?.cpf || '').trim()
    const documento = String(cliente?.documento || '').trim()

    return cnpj || cpf || documento || '-'
  }

  function nomeFiscalClienteRecibo(cliente?: any) {
    return (
      cliente?.nome_empresa ||
      cliente?.razao_social ||
      cliente?.nome ||
      cliente?.cliente ||
      '-'
    )
  }

  function clienteFaturamentoReciboSelecionado() {
    if (!reciboClienteId) return null

    return clientesFaturamento.find((cliente: any) => String(cliente.id) === String(reciboClienteId)) || null
  }

  function clientesFaturamentoReciboFiltrados() {
    const termo = normalizarTexto(buscaClienteRecibo)

    const base = clientesFaturamento || []

    if (!termo) return base.slice(0, 120)

    return base
      .filter((cliente: any) => {
        const textoBusca = normalizarTexto([
          cliente.nome_empresa,
          cliente.razao_social,
          cliente.nome_contato,
          cliente.codigo_hc,
          cliente.email,
          cliente.cidade,
          cliente.estado,
          cliente.cnpj,
          cliente.cpf,
          cliente.contato,
        ].filter(Boolean).join(' '))

        return textoBusca.includes(termo)
      })
      .slice(0, 120)
  }

  function localizarClienteFaturamentoParaRecibo(embarque: any, fatura: any) {
    const dadosSalvos = fatura?.dados_cliente_faturamento || {}

    const documentoSalvo = String(
      dadosSalvos.cnpj ||
      dadosSalvos.cpf ||
      dadosSalvos.documento ||
      ''
    ).replace(/\D/g, '')

    const nomeSalvo = normalizarTexto(
      dadosSalvos.nome_empresa ||
      dadosSalvos.razao_social ||
      dadosSalvos.nome ||
      embarque?.cliente_final ||
      embarque?.importador ||
      ''
    )

    if (documentoSalvo) {
      const porDocumento = clientesFaturamento.find((cliente: any) => {
        const documentoCliente = String(cliente.cnpj || cliente.cpf || '').replace(/\D/g, '')
        return documentoCliente && documentoCliente === documentoSalvo
      })

      if (porDocumento) return porDocumento
    }

    if (nomeSalvo) {
      const porNome = clientesFaturamento.find((cliente: any) => {
        const nomeCliente = normalizarTexto(cliente.nome_empresa || cliente.razao_social || cliente.nome || '')
        return nomeCliente && (nomeCliente.includes(nomeSalvo) || nomeSalvo.includes(nomeCliente))
      })

      if (porNome) return porNome
    }

    return null
  }

  function dadosClienteFiscalRecibo(fatura: any, embarque: any) {
    const clienteSelecionado = clienteFaturamentoReciboSelecionado()
    const dadosSalvos = fatura?.dados_cliente_faturamento || {}
    const base = clienteSelecionado || dadosSalvos || {}

    const nome =
      nomeFiscalClienteRecibo(base) ||
      embarque?.cliente_final ||
      embarque?.importador ||
      '-'

    return {
      nome,
      nome_empresa: nome,
      documento: documentoFiscalClienteRecibo(base),
      cnpj: base?.cnpj || null,
      cpf: base?.cpf || null,
      endereco: base?.endereco || '-',
      cidade: base?.cidade || '-',
      estado: base?.estado || '-',
      cep: base?.cep || '-',
      email: base?.email || '-',
      contato: base?.nome_contato || base?.contato || '-',
      inscricao_estadual: base?.inscricao_estadual || '-',
      inscricao_municipal: base?.inscricao_municipal || '-',
      cliente_faturamento_id: clienteSelecionado?.id || null,
      codigo_hc: base?.codigo_hc || null,
    }
  }

  function normalizarAwb(valor?: any) {
    return String(valor || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
  }

  function awbsFinanceiro(item: FinanceiroProcesso) {
    return [
      item.awb,
      item.numero_awb,
      item.hawb,
      item.h_awb,
    ]
      .map((valor) => normalizarAwb(valor as any))
      .filter(Boolean)
  }

  function faturaDoEmbarque(embarqueId: string) {
    return faturas.find((f) => f.embarque_id === embarqueId) || null
  }

  function financeiroDoEmbarque(embarque: Embarque) {
    if (!embarque) return null

    // Regra principal correta: se existir embarque_id no financeiro, usa ele.
    const porEmbarqueId =
      financeiros.find((item) => String(item.embarque_id || '') === String(embarque.id || '')) ||
      null

    if (porEmbarqueId) return porEmbarqueId

    // Fallback: enquanto financeiro_embarques ainda não tiver embarque_id em todos os registros,
    // procura pelo AWB de forma forte, inclusive se vier com pontuação, texto, aspas ou outro nome de coluna.
    const awbLimpo = normalizarAwb(embarque.awb)
    if (!awbLimpo) return null

    return (
      financeiros.find((item) => {
        const awbsDiretos = awbsFinanceiro(item)

        if (awbsDiretos.includes(awbLimpo)) return true

        return Object.values(item || {}).some((valor) => {
          const valorNormalizado = normalizarAwb(valor as any)
          if (!valorNormalizado) return false

          if (valorNormalizado === awbLimpo) return true

          // Ex.: campo vindo como "AWB 9284060166" ou "9284060166 / 123".
          if (awbLimpo.length >= 8 && valorNormalizado.includes(awbLimpo)) return true
          if (valorNormalizado.length >= 8 && awbLimpo.includes(valorNormalizado)) return true

          return false
        })
      }) ||
      null
    )
  }

  function valorFinanceiro(item?: FinanceiroProcesso | null) {
    if (!item) return 0

    // Mesmo campo usado em Financeiro > Processos Faturados.
    return (
      numero(item.valor_cobranca) ||
      numero(item.valor_faturado) ||
      numero(item.valor_venda) ||
      numero(item.valor)
    )
  }

  function vencimentoFinanceiro(item?: FinanceiroProcesso | null) {
    if (!item) return null

    // No banco, o campo da coluna "Vencimento cliente" é vencimento_cobranca.
    return (
      item.vencimento_cobranca ||
      item.vencimento_cliente ||
      item.vencimento ||
      item.data_vencimento ||
      null
    )
  }

  function recebimentoFinanceiro(item?: FinanceiroProcesso | null) {
    if (!item) return null

    // Mesmo campo usado em Financeiro > Processos Faturados.
    return (
      item.recebimento ||
      item.recebimento_cliente ||
      item.data_recebimento ||
      item.data_pagamento ||
      null
    )
  }

  function statusOperacionaisDisponiveis() {
    return Array.from(
      new Set(
        embarques
          .map((item) => item.status_operacional)
          .filter(Boolean)
      )
    ).sort((a: any, b: any) => String(a).localeCompare(String(b), 'pt-BR'))
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

    if (valor instanceof Date && !isNaN(valor.getTime())) {
      return valor.toISOString().split('T')[0]
    }

    if (typeof valor === 'number') {
      const data = new Date((valor - 25569) * 86400 * 1000)
      return data.toISOString().split('T')[0]
    }

    const texto = String(valor).trim()
    if (!texto || texto === '0') return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto

    const partes = texto.split('/')
    if (partes.length === 3) {
      const [dia, mes, ano] = partes
      return `${ano.padStart(4, '20')}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
    }

    return null
  }

  function moeda(valor?: number | string | null) {
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
          .replace(/[R$USD\s]/gi, '')
          .replace(/\./g, '')
          .replace(',', '.')
      ) || 0
    )
  }

  function texto(valor: any) {
    return String(valor || '').trim()
  }

  function normalizarTexto(valor: any) {
    return texto(valor)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
  }

  function moedaFechada(embarque: Embarque, financeiro: FinanceiroProcesso | null) {
    const valorFin = valorFinanceiro(financeiro)

    if (valorFin > 0) return moeda(valorFin)

    const valor =
      numero(embarque.valor_fechado) ||
      numero(embarque.valor_cobrado_cliente) ||
      numero(embarque.valor_venda)

    if (!valor) return '-'

    const moedaBase = normalizarTexto(embarque.moeda_cobranca || embarque.moeda || 'BRL')

    if (moedaBase === 'BRL' || !moedaBase) return moeda(valor)

    return `${moedaBase} ${valor.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  function documentosDoEmbarque(embarqueId: string) {
    return documentosPorEmbarque[embarqueId] || []
  }


  function arquivosDaFatura(faturaId?: string | null) {
    if (!faturaId) return []
    return arquivosFaturas.filter((arquivo) => arquivo.fatura_id === faturaId)
  }

  function labelTipoArquivoFatura(tipo?: string | null) {
    const normalizado = normalizarTexto(tipo || 'OUTRO')
    if (normalizado.includes('BOLETO')) return 'Boleto'
    if (normalizado.includes('FATURA') && normalizado.includes('EXTRA')) return 'PDF faturamento'
    if (normalizado.includes('COMPLEMENTAR')) return 'Fatura complementar'
    if (normalizado.includes('RECIBO')) return 'Recibo'
    if (normalizado.includes('FATURA')) return 'Fatura'
    return 'Outro arquivo'
  }

  async function anexarArquivoExtraFatura(fatura: Fatura | null | undefined, tipo: string, arquivo: File | null) {
    if (!fatura?.id) return alert('Cadastre ou emita a fatura antes de anexar arquivos adicionais.')
    if (!arquivo) return

    const tiposPermitidos = ['application/pdf', 'image/png', 'image/jpeg']
    if (!tiposPermitidos.includes(arquivo.type)) {
      return alert('Arquivo inválido. Use PDF, JPG ou PNG.')
    }

    setEnviandoArquivoExtra(`${fatura.id}-${tipo}`)

    try {
      const nomeSeguro = arquivo.name.replace(/[^a-zA-Z0-9_.-]/g, '-')
      const caminho = `extras/${fatura.id}/${Date.now()}-${tipo.toLowerCase()}-${nomeSeguro}`

      const { error: erroUpload } = await supabase.storage
        .from('faturas')
        .upload(caminho, arquivo, {
          cacheControl: '3600',
          upsert: true,
          contentType: arquivo.type || 'application/octet-stream',
        })

      if (erroUpload) throw new Error(erroUpload.message)

      const { data: urlData } = supabase.storage.from('faturas').getPublicUrl(caminho)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { error } = await supabase.from('fatura_arquivos').insert([
        {
          fatura_id: fatura.id,
          embarque_id: fatura.embarque_id || null,
          usuario_id: fatura.usuario_id || null,
          tipo,
          nome: arquivo.name,
          url: urlData.publicUrl,
          caminho,
          visivel_cliente: true,
          criado_por: user?.id || null,
        },
      ])

      if (error) {
        throw new Error(`${error.message}. Rode o SQL da tabela fatura_arquivos antes de anexar boleto ou complementar.`)
      }

      alert(`${labelTipoArquivoFatura(tipo)} anexado com sucesso.`)
      carregar()
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Erro ao anexar arquivo adicional.')
    } finally {
      setEnviandoArquivoExtra(null)
    }
  }

  async function removerArquivoExtraFatura(arquivo: FaturaArquivo) {
    const confirmar = confirm(`Deseja remover ${arquivo.nome || labelTipoArquivoFatura(arquivo.tipo)}?`)
    if (!confirmar) return

    setRemovendoArquivoExtra(arquivo.id)

    try {
      if (arquivo.caminho) {
        await supabase.storage.from('faturas').remove([arquivo.caminho])
      }

      const { error } = await supabase.from('fatura_arquivos').delete().eq('id', arquivo.id)
      if (error) throw new Error(error.message)

      carregar()
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Erro ao remover arquivo adicional.')
    } finally {
      setRemovendoArquivoExtra(null)
    }
  }

  function nomeDocumento(doc: DocumentoEmbarque) {
    return texto(doc.nome || doc.nome_arquivo || doc.filename || doc.tipo || doc.categoria || 'Documento')
  }

  function urlDocumento(doc: DocumentoEmbarque) {
    return texto(doc.url || doc.arquivo_url || doc.arquivo_pdf)
  }

  function documentoEhCotacao(doc: DocumentoEmbarque) {
    const base = normalizarTexto(`${nomeDocumento(doc)} ${doc.tipo || ''} ${doc.categoria || ''}`)
    return (
      base.includes('COTACAO') ||
      base.includes('ORCAMENTO') ||
      base.includes('PROPOSTA') ||
      base.includes('QUOTE')
    )
  }

  function cotacoesDoEmbarque(embarqueId: string) {
    return documentosDoEmbarque(embarqueId).filter(documentoEhCotacao)
  }

  function hojeISO() {
    return new Date().toISOString().slice(0, 10)
  }

  function statusPagamentoFinanceiro(financeiro: FinanceiroProcesso | null): StatusPagamentoFinanceiro {
    if (!financeiro) {
      return {
        status: 'SEM_FINANCEIRO',
        label: 'Não lançado',
        detalhe: 'Sem registro em Processos Faturados',
        classe: 'border-slate-600 bg-slate-700/20 text-slate-300',
      }
    }

    const recebimento = normalizarData(recebimentoFinanceiro(financeiro))
    const vencimento = normalizarData(vencimentoFinanceiro(financeiro))
    const valor = valorFinanceiro(financeiro)

    // Igual ao Financeiro: se tem recebimento, é PAGO.
    if (recebimento) {
      return {
        status: 'PAGO',
        label: `Pago em ${dataBR(recebimento)}`,
        detalhe: moeda(valor),
        classe: 'border-green-500 bg-green-600/20 text-green-300',
      }
    }

    // Igual ao Financeiro: sem recebimento + vencido = ATRASADO.
    if (vencimento && vencimento < hojeISO()) {
      return {
        status: 'ATRASADO',
        label: `Vencido desde ${dataBR(vencimento)}`,
        detalhe: moeda(valor),
        classe: 'border-red-500 bg-red-600/20 text-red-300',
      }
    }

    if (vencimento) {
      return {
        status: 'EM_ABERTO',
        label: `Em aberto até ${dataBR(vencimento)}`,
        detalhe: moeda(valor),
        classe: 'border-yellow-500 bg-yellow-500/20 text-yellow-300',
      }
    }

    return {
      status: 'EM_ABERTO',
      label: 'Em aberto',
      detalhe: moeda(valor),
      classe: 'border-yellow-500 bg-yellow-500/20 text-yellow-300',
    }
  }


  function statusComprovanteFatura(fatura?: Fatura | null) {
    if (!fatura?.arquivo_pdf) {
      return {
        label: '-',
        detalhe: 'Sem fatura',
        classe: 'border-slate-600 bg-slate-700/20 text-slate-400',
      }
    }

    if (!fatura.comprovante_pagamento) {
      return {
        label: 'Não enviado',
        detalhe: 'Cliente ainda não anexou',
        classe: 'border-slate-600 bg-slate-700/20 text-slate-300',
      }
    }

    const status = String(fatura.status_pagamento || 'COMPROVANTE ENVIADO').toUpperCase()

    if (status === 'PAGO') {
      return {
        label: 'Aprovado',
        detalhe: fatura.data_comprovante ? `Enviado em ${dataBR(fatura.data_comprovante)}` : 'Comprovante aprovado',
        classe: 'border-green-500 bg-green-600/20 text-green-300',
      }
    }

    if (status === 'COMPROVANTE REJEITADO') {
      return {
        label: 'Rejeitado',
        detalhe: fatura.observacao_pagamento || 'Aguardando reenvio do cliente',
        classe: 'border-red-500 bg-red-600/20 text-red-300',
      }
    }

    return {
      label: 'Enviado pelo cliente',
      detalhe: fatura.data_comprovante ? `Enviado em ${dataBR(fatura.data_comprovante)}` : 'Aguardando análise',
      classe: 'border-yellow-500 bg-yellow-500/20 text-yellow-300',
    }
  }

  function extrairCaminhoStorage(url?: string | null) {
    if (!url) return null
    const marcador = '/storage/v1/object/public/faturas/'
    if (!url.includes(marcador)) return null
    return url.split(marcador)[1] || null
  }


  async function carregarImagemBase64(caminhos: string[]) {
    for (const caminho of caminhos) {
      try {
        const url = caminho.startsWith('http') ? caminho : `${window.location.origin}${caminho}`
        const resposta = await fetch(url, { cache: 'force-cache' })
        if (!resposta.ok) continue

        const blob = await resposta.blob()
        if (!blob.type.startsWith('image/')) continue

        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(String(reader.result || ''))
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })

        if (base64) return base64
      } catch (error) {
        console.log('Não foi possível carregar imagem para PDF:', caminho, error)
      }
    }

    return null
  }


  async function obterDimensoesImagemBase64(base64: string) {
    return await new Promise<{ width: number; height: number } | null>((resolve) => {
      try {
        const img = new Image()
        img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height })
        img.onerror = () => resolve(null)
        img.src = base64
      } catch (error) {
        console.log('Não foi possível medir a logo:', error)
        resolve(null)
      }
    })
  }

  function encaixarImagemSemDistorcer(
    larguraOriginal: number,
    alturaOriginal: number,
    larguraMaxima: number,
    alturaMaxima: number
  ) {
    if (!larguraOriginal || !alturaOriginal) {
      return {
        width: larguraMaxima,
        height: alturaMaxima,
      }
    }

    const escala = Math.min(larguraMaxima / larguraOriginal, alturaMaxima / alturaOriginal)

    return {
      width: larguraOriginal * escala,
      height: alturaOriginal * escala,
    }
  }

  function limparTextoPix(valor: string, limite: number) {
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9 $%*+\-./:]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase()
      .slice(0, limite)
  }

  function campoPix(id: string, valor: string) {
    const textoCampo = String(valor || '')
    return `${id}${String(textoCampo.length).padStart(2, '0')}${textoCampo}`
  }

  function crc16Pix(payload: string) {
    let crc = 0xffff

    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8

      for (let bit = 0; bit < 8; bit++) {
        if ((crc & 0x8000) !== 0) {
          crc = (crc << 1) ^ 0x1021
        } else {
          crc = crc << 1
        }

        crc &= 0xffff
      }
    }

    return crc.toString(16).toUpperCase().padStart(4, '0')
  }

  function gerarPixCopiaECola(valor: number, txid: string) {
    const chavePixCnpj = '41456630000152'
    const nomeRecebedor = limparTextoPix('COUTO E OTERO INTERMEDIACAO LTDA', 25)
    const cidadeRecebedor = limparTextoPix('BELO HORIZONTE', 15)
    const identificador = limparTextoPix(txid || 'HC', 25) || 'HC'
    const descricao = limparTextoPix(`FATURA ${txid || ''}`, 60)
    const valorFormatado = Math.max(0, Number(valor || 0)).toFixed(2)

    const merchantAccount =
      campoPix('00', 'br.gov.bcb.pix') +
      campoPix('01', chavePixCnpj) +
      campoPix('02', descricao)

    const payloadSemCRC =
      campoPix('00', '01') +
      campoPix('26', merchantAccount) +
      campoPix('52', '0000') +
      campoPix('53', '986') +
      campoPix('54', valorFormatado) +
      campoPix('58', 'BR') +
      campoPix('59', nomeRecebedor) +
      campoPix('60', cidadeRecebedor) +
      campoPix('62', campoPix('05', identificador)) +
      '6304'

    return `${payloadSemCRC}${crc16Pix(payloadSemCRC)}`
  }

  async function gerarQrCodePixBase64(valor: number, txid: string) {
    try {
      const qrcodeModule = await import('qrcode')
      const qrcode = (qrcodeModule as any).default || qrcodeModule
      const pixPayload = gerarPixCopiaECola(valor, txid)

      return await qrcode.toDataURL(pixPayload, {
        margin: 1,
        width: 190,
        errorCorrectionLevel: 'M',
      })
    } catch (error) {
      console.log('Não foi possível gerar QR Code PIX:', error)
      return null
    }
  }


  const embarquesFiltrados = useMemo(() => {
    if (abaAtiva !== 'FATURAS') return []

    return embarques.filter((e) => {
      const fatura = faturaDoEmbarque(e.id)
      const financeiro = financeiroDoEmbarque(e)
      const pagamento = statusPagamentoFinanceiro(financeiro)

      const texto = `
        ${e.awb || ''}
        ${e.cliente_final || ''}
        ${e.exportador || ''}
        ${e.importador || ''}
        ${e.transportadora || ''}
        ${e.servico || ''}
        ${e.referencia_cliente || ''}
        ${e.referencia_hc || ''}
        ${fatura?.numero_fatura || ''}
        ${fatura?.status_pagamento || ''}
        ${fatura?.observacao_pagamento || ''}
        ${fatura?.comprovante_pagamento ? 'comprovante enviado' : ''}
        ${documentosDoEmbarque(e.id).map(nomeDocumento).join(' ')}
      `.toLowerCase()

      const passaBusca = texto.includes(busca.toLowerCase())

      const passaDocumento =
        filtroDocumento === 'TODOS' ||
        (filtroDocumento === 'COM_FATURA' && !!fatura?.arquivo_pdf) ||
        (filtroDocumento === 'SEM_FATURA' && !fatura?.arquivo_pdf) ||
        (filtroDocumento === 'COM_RECIBO' && !!fatura?.recibo_pdf) ||
        (filtroDocumento === 'SEM_RECIBO' && !!fatura?.arquivo_pdf && !fatura?.recibo_pdf) ||
        (filtroDocumento === 'COM_COMPROVANTE' && !!fatura?.comprovante_pagamento) ||
        (filtroDocumento === 'SEM_COMPROVANTE' && !!fatura?.arquivo_pdf && !fatura?.comprovante_pagamento) ||
        (filtroDocumento === 'VISIVEL' && !!fatura?.visivel_cliente) ||
        (filtroDocumento === 'OCULTO' && fatura && !fatura?.visivel_cliente)

      const passaStatusEmbarque =
        filtroStatusEmbarque === 'TODOS' ||
        e.status_operacional === filtroStatusEmbarque

      const passaPagamento =
        filtroPagamento === 'TODOS' ||
        (filtroPagamento === 'PAGO' && pagamento.status === 'PAGO') ||
        (filtroPagamento === 'ATRASADO' && pagamento.status === 'ATRASADO') ||
        (filtroPagamento === 'EM_ABERTO' && pagamento.status === 'EM_ABERTO') ||
        (filtroPagamento === 'SEM_FINANCEIRO' && pagamento.status === 'SEM_FINANCEIRO') ||
        (filtroPagamento === 'SEM_FATURA' && !fatura)

      const passaArquivamento =
        filtroArquivamento === 'TODAS' ||
        (filtroArquivamento === 'ARQUIVADAS'
          ? !!fatura?.arquivado_admin
          : !fatura?.arquivado_admin)

      return (
        passaBusca &&
        passaDocumento &&
        passaStatusEmbarque &&
        passaPagamento &&
        passaArquivamento
      )
    })
  }, [
    abaAtiva,
    embarques,
    faturas,
    financeiros,
    documentosPorEmbarque,
    busca,
    filtroDocumento,
    filtroStatusEmbarque,
    filtroPagamento,
    filtroArquivamento,
  ])

  const resumoFaturasAdmin = useMemo(() => {
    if (abaAtiva !== 'FATURAS') {
      return {
        totalComFatura: 0,
        totalVisiveis: 0,
        totalRecibos: 0,
        totalSemFatura: 0,
        totalFaturasArquivadas: 0,
        totalPagos: 0,
        totalAtrasados: 0,
        totalEmAberto: 0,
        totalSemFinanceiro: 0,
        statusDisponiveis: [] as any[],
      }
    }

    const faturasAtivas = faturas.filter((f) => !f.arquivado_admin)
    const pagamentosFinanceiros = embarques.map((e) => {
      const financeiro = financeiroDoEmbarque(e)

      return {
        embarque: e,
        fatura: faturaDoEmbarque(e.id),
        financeiro,
        pagamento: statusPagamentoFinanceiro(financeiro),
      }
    })

    return {
      totalComFatura: faturasAtivas.filter((f) => f.arquivo_pdf).length,
      totalVisiveis: faturasAtivas.filter((f) => f.visivel_cliente).length,
      totalRecibos: faturasAtivas.filter((f) => f.recibo_pdf).length,
      totalSemFatura: embarques.filter((e) => !faturaDoEmbarque(e.id)?.arquivo_pdf).length,
      totalFaturasArquivadas: faturas.filter((f) => f.arquivado_admin).length,
      totalPagos: pagamentosFinanceiros.filter((item) => item.pagamento.status === 'PAGO').length,
      totalAtrasados: pagamentosFinanceiros.filter((item) => item.pagamento.status === 'ATRASADO').length,
      totalEmAberto: pagamentosFinanceiros.filter((item) => item.pagamento.status === 'EM_ABERTO').length,
      totalSemFinanceiro: pagamentosFinanceiros.filter((item) => item.pagamento.status === 'SEM_FINANCEIRO').length,
      statusDisponiveis: statusOperacionaisDisponiveis(),
    }
  }, [abaAtiva, embarques, faturas, financeiros])

  const {
    totalComFatura,
    totalVisiveis,
    totalRecibos,
    totalSemFatura,
    totalFaturasArquivadas,
    totalPagos,
    totalAtrasados,
    totalEmAberto,
    totalSemFinanceiro,
    statusDisponiveis,
  } = resumoFaturasAdmin

  function abrirFormulario(embarque: Embarque) {
    const fatura = faturaDoEmbarque(embarque.id)

    setEmbarqueSelecionado(embarque)
    setNumeroFatura(fatura?.numero_fatura || '')
    setVisivelCliente(fatura?.visivel_cliente ?? true)
    setObservacoes(fatura?.observacoes || '')
    setArquivoPdf(null)

    setTimeout(() => {
      document.getElementById('form_fatura')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  function limparFormulario() {
    setEmbarqueSelecionado(null)
    setNumeroFatura('')
    setVisivelCliente(true)
    setObservacoes('')
    setArquivoPdf(null)

    const inputArquivo = document.getElementById('pdf_fatura') as HTMLInputElement | null
    if (inputArquivo) inputArquivo.value = ''
  }

  function limparFiltros() {
    setBusca('')
    setFiltroDocumento('TODOS')
    setFiltroStatusEmbarque('TODOS')
    setFiltroPagamento('TODOS')
    setFiltroArquivamento('ATIVAS')
    setPacoteAbertoId(null)
  }

  function aplicarFiltroRapido(opcoes: {
    documento?: string
    statusEmbarque?: string
    pagamento?: string
    arquivamento?: string
  }) {
    setBusca('')
    setFiltroDocumento(opcoes.documento || 'TODOS')
    setFiltroStatusEmbarque(opcoes.statusEmbarque || 'TODOS')
    setFiltroPagamento(opcoes.pagamento || 'TODOS')
    setFiltroArquivamento(opcoes.arquivamento || 'ATIVAS')
    setPacoteAbertoId(null)

    setTimeout(() => {
      document.getElementById('tabela_faturas')?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }

  async function salvarFatura() {
    if (!embarqueSelecionado) return alert('Selecione um embarque.')

    const faturaExistente = faturaDoEmbarque(embarqueSelecionado.id)

    if (!faturaExistente && !arquivoPdf) {
      return alert('Selecione o PDF da fatura.')
    }

    if (arquivoPdf && arquivoPdf.type !== 'application/pdf') {
      return alert('O arquivo precisa ser um PDF.')
    }

    setSalvando(true)

    let urlPdf = faturaExistente?.arquivo_pdf || null

    if (arquivoPdf) {
      const nomeArquivo = `${embarqueSelecionado.id}/${Date.now()}-${arquivoPdf.name.replaceAll(' ', '-')}`

      const { error: erroUpload } = await supabase.storage
        .from('faturas')
        .upload(nomeArquivo, arquivoPdf, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'application/pdf',
        })

      if (erroUpload) {
        setSalvando(false)
        alert(erroUpload.message)
        return
      }

      const { data: urlData } = supabase.storage.from('faturas').getPublicUrl(nomeArquivo)
      urlPdf = urlData.publicUrl

      const caminhoAntigo = extrairCaminhoStorage(faturaExistente?.arquivo_pdf)
      if (caminhoAntigo) {
        await supabase.storage.from('faturas').remove([caminhoAntigo])
      }
    }

    const payload = {
      embarque_id: embarqueSelecionado.id,
      usuario_id: embarqueSelecionado.usuario_id || null,
      numero_fatura: numeroFatura || null,
      arquivo_pdf: urlPdf,
      visivel_cliente: visivelCliente,
      observacoes: observacoes || null,
    }

    if (faturaExistente) {
      const { error } = await supabase
        .from('faturas')
        .update(payload)
        .eq('id', faturaExistente.id)

      if (error) {
        setSalvando(false)
        alert(error.message)
        return
      }

      alert('Fatura atualizada com sucesso.')
    } else {
      const { error } = await supabase.from('faturas').insert([payload])

      if (error) {
        setSalvando(false)
        alert(error.message)
        return
      }

      alert('Fatura anexada com sucesso.')
    }

    setSalvando(false)
    limparFormulario()
    carregar()
  }

  async function removerFatura(embarque: Embarque) {
    const fatura = faturaDoEmbarque(embarque.id)

    if (!fatura) return alert('Fatura não encontrada.')

    const confirmar = confirm(`Deseja remover a fatura do AWB ${embarque.awb}?`)
    if (!confirmar) return

    setRemovendoFatura(embarque.id)

    const caminhoFatura = extrairCaminhoStorage(fatura.arquivo_pdf)
    const caminhoRecibo = extrairCaminhoStorage(fatura.recibo_pdf)
    const arquivosParaRemover = [caminhoFatura, caminhoRecibo].filter(Boolean) as string[]

    if (arquivosParaRemover.length > 0) {
      await supabase.storage.from('faturas').remove(arquivosParaRemover)
    }

    const { error } = await supabase.from('faturas').delete().eq('id', fatura.id)

    setRemovendoFatura(null)

    if (error) {
      alert(error.message)
      return
    }

    alert('Fatura removida com sucesso.')
    carregar()
  }

  async function anexarRecibo(embarque: Embarque, arquivo: File | null) {
    if (!arquivo) return
    if (arquivo.type !== 'application/pdf') return alert('O recibo precisa ser um PDF.')

    const fatura = faturaDoEmbarque(embarque.id)
    if (!fatura) return alert('Cadastre a fatura antes de anexar o recibo.')

    setEnviandoRecibo(embarque.id)

    const nomeArquivo = `recibos/${fatura.id}/${Date.now()}-${arquivo.name.replaceAll(' ', '-')}`

    const { error: erroUpload } = await supabase.storage
      .from('faturas')
      .upload(nomeArquivo, arquivo, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'application/pdf',
      })

    if (erroUpload) {
      setEnviandoRecibo(null)
      alert(erroUpload.message)
      return
    }

    const { data: urlData } = supabase.storage.from('faturas').getPublicUrl(nomeArquivo)

    const caminhoAntigo = extrairCaminhoStorage(fatura.recibo_pdf)
    if (caminhoAntigo) {
      await supabase.storage.from('faturas').remove([caminhoAntigo])
    }

    const { error } = await supabase
      .from('faturas')
      .update({
        recibo_pdf: urlData.publicUrl,
        recibo_nome: arquivo.name,
      })
      .eq('id', fatura.id)

    setEnviandoRecibo(null)

    if (error) {
      alert(error.message)
      return
    }

    alert('Recibo anexado com sucesso.')
    carregar()
  }


  function valorPadraoRecibo(embarque: Embarque) {
    const fatura = faturaDoEmbarque(embarque.id)
    const financeiro = financeiroDoEmbarque(embarque)

    return (
      numero(fatura?.valor_pago) ||
      numero(fatura?.valor_total) ||
      valorFinanceiro(financeiro) ||
      numero(embarque.valor_fechado) ||
      numero(embarque.valor_cobrado_cliente) ||
      numero(embarque.valor_venda)
    )
  }

  function abrirEmissaoRecibo(embarque: Embarque) {
    const fatura = faturaDoEmbarque(embarque.id)

    if (!fatura?.arquivo_pdf) {
      alert('Cadastre ou emita a fatura antes de emitir o recibo.')
      return
    }

    const financeiro = financeiroDoEmbarque(embarque)
    const dataRecebimento =
      normalizarData(recebimentoFinanceiro(financeiro)) ||
      normalizarData(fatura.data_pagamento) ||
      new Date().toISOString().slice(0, 10)

    const clienteFiscalRecibo = localizarClienteFaturamentoParaRecibo(embarque, fatura)

    setReciboSelecionado(embarque)
    setReciboClienteId(clienteFiscalRecibo?.id || '')

    // Importante: se não achou o cliente automaticamente, deixa a busca vazia
    // para o select mostrar todos os Clientes Faturamento, igual ao emissor de fatura.
    setBuscaClienteRecibo(
      clienteFiscalRecibo?.nome_empresa ||
        clienteFiscalRecibo?.razao_social ||
        ''
    )

    setDataRecebimentoRecibo(dataRecebimento)
    setValorRecebidoRecibo(formatarNumeroInput(valorPadraoRecibo(embarque)))
    setFormaRecebimentoRecibo('PIX / Transferência bancária')
    setObservacoesRecibo('')

    setTimeout(() => {
      document.getElementById('form_recibo')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  function limparRecibo() {
    setReciboSelecionado(null)
    setDataRecebimentoRecibo('')
    setValorRecebidoRecibo('')
    setFormaRecebimentoRecibo('PIX / Transferência bancária')
    setObservacoesRecibo('')
    setBuscaClienteRecibo('')
    setReciboClienteId('')
  }

  async function salvarFinanceiroDoRecibo(embarque: Embarque, fatura: Fatura, urlRecibo: string) {
    const financeiroAtual = financeiroDoEmbarque(embarque)
    const valorPago = numero(valorRecebidoRecibo)
    const dataRecebimento = normalizarData(dataRecebimentoRecibo)
    const dadosClienteRecibo = dadosClienteFiscalRecibo(fatura, embarque)

    if (!dataRecebimento) {
      throw new Error('Informe uma data de recebimento válida.')
    }

    const payloadBase: any = {
      cliente:
        financeiroAtual?.cliente ||
        dadosClienteRecibo.nome ||
        embarque.cliente_final ||
        embarque.importador ||
        null,
      awb: embarque.awb || null,
      fatura: fatura.numero_fatura || null,
      despachante: financeiroAtual?.despachante || null,
      transportadora: embarque.transportadora || financeiroAtual?.transportadora || null,
      servico: embarque.servico || financeiroAtual?.servico || null,
      valor_cobranca: valorPago || valorFinanceiro(financeiroAtual) || numero(fatura.valor_total),
      vencimento_cobranca: normalizarData(fatura.vencimento) || normalizarData(vencimentoFinanceiro(financeiroAtual)) || null,
      recebimento: dataRecebimento,
      mes: normalizarData(fatura.vencimento)?.slice(0, 7) || financeiroAtual?.mes || dataRecebimento.slice(0, 7),
      mes_profit: dataRecebimento.slice(0, 7),
      observacoes: [
        financeiroAtual?.observacoes || '',
        `Recibo emitido pelo HC Connect em ${dataBR(new Date().toISOString())}.`,
        `Recebimento em ${dataBR(dataRecebimento)}.`,
        `Valor recebido: ${moeda(valorPago)}.`,
        `Forma: ${formaRecebimentoRecibo || '-'}.`,
        `Recibo: ${urlRecibo}.`,
        observacoesRecibo ? `Obs recibo: ${observacoesRecibo}` : '',
      ]
        .filter(Boolean)
        .join(' | '),
    }

    if (financeiroAtual?.id) {
      const { error } = await supabase
        .from('financeiro_embarques')
        .update(payloadBase)
        .eq('id', financeiroAtual.id)

      if (error) throw new Error(`Recibo salvo, mas houve erro ao atualizar Processos Faturados: ${error.message}`)
      return
    }

    const payloadComEmbarqueId = {
      ...payloadBase,
      embarque_id: embarque.id,
      doc_dta: 0,
      debito_terceiro: 0,
      valor_compra: 0,
    }

    const { error } = await supabase.from('financeiro_embarques').insert([payloadComEmbarqueId])

    if (error) {
      const erroColunaEmbarque = String(error.message || '').toLowerCase().includes('embarque_id')

      if (erroColunaEmbarque) {
        const { embarque_id, ...payloadSemEmbarqueId } = payloadComEmbarqueId
        const { error: erroSemEmbarque } = await supabase.from('financeiro_embarques').insert([payloadSemEmbarqueId])
        if (erroSemEmbarque) throw new Error(`Recibo salvo, mas houve erro ao lançar em Processos Faturados: ${erroSemEmbarque.message}`)
        return
      }

      throw new Error(`Recibo salvo, mas houve erro ao lançar em Processos Faturados: ${error.message}`)
    }
  }

  async function gerarPdfReciboHC() {
    if (!reciboSelecionado) return alert('Selecione uma fatura para emitir o recibo.')
    if (!dataRecebimentoRecibo) return alert('Informe a data do recebimento.')

    const fatura = faturaDoEmbarque(reciboSelecionado.id)
    if (!fatura?.arquivo_pdf) return alert('Fatura não encontrada para este AWB.')

    const valorPago = numero(valorRecebidoRecibo)
    if (valorPago <= 0) return alert('Informe o valor recebido.')

    if (!clienteFaturamentoReciboSelecionado()) {
      return alert('Selecione o cliente fiscal cadastrado antes de emitir o recibo.')
    }

    setEmitindoRecibo(true)

    try {
      const jsPDFModule = await import('jspdf')
      const jsPDF = (jsPDFModule as any).jsPDF || (jsPDFModule as any).default

      if (!jsPDF) {
        throw new Error('Biblioteca de PDF não carregou corretamente. Rode npm install jspdf e publique novamente.')
      }

      const logoBase64 = await carregarImagemBase64(['/HC-CONSULTORIA-TRANSPARENTE.png', '/logo.png', '/logo-hc.png', '/hc-logo.png', '/icon-512.png', '/icon-192.png'])
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' }) as any
      const margem = 44
      const larguraPagina = pdf.internal.pageSize.getWidth()
      const dataRecebimento = normalizarData(dataRecebimentoRecibo) || dataRecebimentoRecibo
      const dadosCliente = dadosClienteFiscalRecibo(fatura, reciboSelecionado)

      pdf.setDrawColor(25, 25, 25)
      pdf.setLineWidth(1)

      if (logoBase64) {
        try {
          const formatoLogo = logoBase64.includes('image/jpeg') || logoBase64.includes('image/jpg')
            ? 'JPEG'
            : logoBase64.includes('image/webp')
              ? 'WEBP'
              : 'PNG'

          const dimensoesLogo = await obterDimensoesImagemBase64(logoBase64)
          const logoAjustada = encaixarImagemSemDistorcer(
            dimensoesLogo?.width || 86,
            dimensoesLogo?.height || 58,
            86,
            58
          )

          pdf.addImage(
            logoBase64,
            formatoLogo,
            larguraPagina - margem - logoAjustada.width,
            36 + (58 - logoAjustada.height) / 2,
            logoAjustada.width,
            logoAjustada.height
          )
        } catch (error) {
          console.log('Logo não pôde ser inserida no recibo:', error)
        }
      }

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(18)
      pdf.text('RECIBO DE PAGAMENTO', margem, 54)

      pdf.setFontSize(9)
      pdf.text('COUTO E OTERO INTERMEDIAÇÃO LTDA', margem, 82)
      pdf.setFont('helvetica', 'normal')
      pdf.text('CNPJ 41.456.630/0001-52', margem, 96)
      pdf.text('RUA DOS COMANCHES Nº 131 - BELO HORIZONTE/MG - CEP 31530250', margem, 110)
      pdf.text('E-MAIL: GRUPOHCCONSULTORIA@OUTLOOK.COM', margem, 124)

      pdf.setDrawColor(0, 0, 0)
      pdf.line(margem, 146, larguraPagina - margem, 146)

      pdf.setFillColor(238, 242, 255)
      pdf.rect(margem, 166, larguraPagina - margem * 2, 92, 'FD')

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.text('Recebemos de:', margem + 12, 188)
      pdf.text('CNPJ / CPF:', 370, 188)
      pdf.text('Referente à fatura:', margem + 12, 214)
      pdf.text('AWB / HAWB:', 370, 214)
      pdf.text('Data do recebimento:', margem + 12, 240)

      pdf.setFont('helvetica', 'normal')
      pdf.text(pdf.splitTextToSize(dadosCliente.nome || '-', 250), margem + 110, 188)
      pdf.text(dadosCliente.documento || '-', 440, 188)
      pdf.text(fatura.numero_fatura || '-', margem + 130, 214)
      pdf.text(reciboSelecionado.awb || '-', 440, 214)
      pdf.text(dataBR(dataRecebimento), margem + 140, 240)

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(13)
      pdf.text('Valor recebido:', margem, 300)
      pdf.setFontSize(24)
      pdf.text(moeda(valorPago), margem + 130, 304)

      pdf.setFontSize(10)
      pdf.text('Valor por extenso:', margem, 342)
      pdf.setFont('helvetica', 'normal')
      pdf.text(pdf.splitTextToSize(valorPorExtensoBRL(valorPago), larguraPagina - margem * 2 - 125), margem + 125, 342)

      pdf.setFont('helvetica', 'bold')
      pdf.text('Forma de recebimento:', margem, 386)
      pdf.setFont('helvetica', 'normal')
      pdf.text(formaRecebimentoRecibo || '-', margem + 130, 386)

      pdf.setFont('helvetica', 'bold')
      pdf.text('Descrição:', margem, 422)
      pdf.setFont('helvetica', 'normal')
      pdf.text(
        pdf.splitTextToSize(
          `Recebimento referente à fatura ${fatura.numero_fatura || '-'} vinculada ao AWB ${reciboSelecionado.awb || '-'}.`,
          larguraPagina - margem * 2
        ),
        margem,
        440
      )

      if (observacoesRecibo) {
        pdf.setFont('helvetica', 'bold')
        pdf.text('Observações:', margem, 486)
        pdf.setFont('helvetica', 'normal')
        pdf.text(pdf.splitTextToSize(observacoesRecibo, larguraPagina - margem * 2), margem, 504)
      }

      const yAssinatura = 640
      pdf.setDrawColor(70, 70, 70)
      pdf.setLineWidth(0.4)
      pdf.line(larguraPagina / 2 - 95, yAssinatura, larguraPagina / 2 + 95, yAssinatura)
      pdf.setFont('times', 'italic')
      pdf.setFontSize(11)
      pdf.text('Marcos Paulo Otero', larguraPagina / 2, yAssinatura - 8, { align: 'center' })
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.text('COUTO E OTERO INTERMEDIAÇÃO LTDA', larguraPagina / 2, yAssinatura + 16, { align: 'center' })
      pdf.text('CNPJ: 41.456.630/0001-52', larguraPagina / 2, yAssinatura + 30, { align: 'center' })

      pdf.setFontSize(7)
      pdf.text(`Recibo emitido pelo HC Connect em ${dataBR(new Date().toISOString())}`, margem, 780)

      const blob = pdf.output('blob') as Blob
      const nomeArquivo = `recibos/${fatura.id}/${Date.now()}-recibo-${String(fatura.numero_fatura || reciboSelecionado.awb || 'hc').replace(/[^A-Z0-9_-]/gi, '-')}.pdf`

      const { error: erroUpload } = await supabase.storage
        .from('faturas')
        .upload(nomeArquivo, blob, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'application/pdf',
        })

      if (erroUpload) throw new Error(erroUpload.message)

      const { data: urlData } = supabase.storage.from('faturas').getPublicUrl(nomeArquivo)
      const urlRecibo = urlData.publicUrl

      const caminhoAntigo = extrairCaminhoStorage(fatura.recibo_pdf)
      if (caminhoAntigo) {
        await supabase.storage.from('faturas').remove([caminhoAntigo])
      }

      const { error: erroFatura } = await supabase
        .from('faturas')
        .update({
          recibo_pdf: urlRecibo,
          recibo_nome: `Recibo ${fatura.numero_fatura || reciboSelecionado.awb || ''}`.trim(),
          data_pagamento: dataRecebimento,
          valor_pago: valorPago,
          recibo_emitido_em: new Date().toISOString(),
          recibo_observacoes: observacoesRecibo || null,
          dados_cliente_faturamento: dadosCliente,
          status_pagamento: 'PAGO',
          observacao_pagamento: `Recibo emitido em ${dataBR(new Date().toISOString())}. Recebido em ${dataBR(dataRecebimento)}.`,
        })
        .eq('id', fatura.id)

      if (erroFatura) throw new Error(erroFatura.message)

      await salvarFinanceiroDoRecibo(reciboSelecionado, fatura, urlRecibo)

      const desejaArquivar = confirm(
        `Recibo emitido com sucesso e pagamento registrado em Processos Faturados.\n\n` +
          `Faturamento finalizado para o AWB ${reciboSelecionado.awb || '-'}.\n` +
          `Deseja arquivar este processo na aba de faturas?`
      )

      if (desejaArquivar) {
        await arquivarFaturamentoFinalizado(fatura, false)
      }

      limparRecibo()
      carregar()
    } catch (error: any) {
      console.log(error)
      alert(`Erro ao emitir recibo: ${error.message || error}`)
    } finally {
      setEmitindoRecibo(false)
    }
  }


  async function alternarVisibilidade(fatura: Fatura) {
    const { error } = await supabase
      .from('faturas')
      .update({
        visivel_cliente: !fatura.visivel_cliente,
      })
      .eq('id', fatura.id)

    if (error) {
      alert(error.message)
      return
    }

    carregar()
  }


  async function alternarArquivamentoFatura(fatura: Fatura, arquivar: boolean) {
    const confirmar = confirm(
      arquivar
        ? `Deseja arquivar a fatura ${fatura.numero_fatura || ''} no painel admin?`
        : `Deseja restaurar a fatura ${fatura.numero_fatura || ''} para a lista principal?`
    )

    if (!confirmar) return

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('faturas')
      .update({
        arquivado_admin: arquivar,
        arquivado_admin_em: arquivar ? new Date().toISOString() : null,
        arquivado_admin_por: arquivar ? user?.id || null : null,
      })
      .eq('id', fatura.id)

    if (error) {
      alert(error.message)
      console.error('Erro arquivamento fatura admin:', error)
      return
    }

    alert(arquivar ? 'Fatura arquivada no admin.' : 'Fatura restaurada no admin.')
    carregar()
  }


  function faturamentoEstaFinalizado(fatura?: Fatura | null, financeiro?: FinanceiroProcesso | null) {
    if (!fatura?.arquivo_pdf) return false
    if (!fatura.recibo_pdf) return false

    const pagamento = statusPagamentoFinanceiro(financeiro || null)

    return pagamento.status === 'PAGO' || String(fatura.status_pagamento || '').toUpperCase() === 'PAGO'
  }

  async function arquivarFaturamentoFinalizado(fatura: Fatura, mostrarAlerta = true) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('faturas')
      .update({
        arquivado_admin: true,
        arquivado_admin_em: new Date().toISOString(),
        arquivado_admin_por: user?.id || null,
        observacoes: [fatura.observacoes || '', 'Faturamento finalizado: fatura, recibo e pagamento confirmados.']
          .filter(Boolean)
          .join(' | '),
      })
      .eq('id', fatura.id)

    if (error) {
      alert('Erro ao arquivar faturamento finalizado: ' + error.message)
      return false
    }

    if (mostrarAlerta) {
      alert('Faturamento finalizado e arquivado na aba de faturas.')
    }

    return true
  }

  async function finalizarFaturamentoDaTabela(embarque: Embarque, fatura: Fatura | null | undefined, financeiro: FinanceiroProcesso | null) {
    if (!fatura?.arquivo_pdf) {
      alert('Para finalizar, primeiro é necessário ter a fatura emitida/anexada.')
      return
    }

    if (!fatura.recibo_pdf) {
      alert('Para finalizar, primeiro é necessário emitir/anexar o recibo.')
      return
    }

    if (!faturamentoEstaFinalizado(fatura, financeiro)) {
      alert('Para finalizar, o pagamento precisa estar confirmado em Processos Faturados ou na fatura.')
      return
    }

    const confirmar = confirm(
      `Faturamento finalizado para o AWB ${embarque.awb || '-'}.\n\n` +
        `Fatura: ${fatura.numero_fatura || '-'}\n` +
        `Cliente: ${embarque.cliente_final || embarque.importador || '-'}\n\n` +
        `Deseja arquivar este processo na aba de faturas?`
    )

    if (!confirmar) return

    const arquivou = await arquivarFaturamentoFinalizado(fatura)

    if (arquivou) {
      carregar()
    }
  }


  const emissorEmbarqueSelecionado = useMemo(() => {
    return embarques.find((item) => item.id === emissorEmbarqueId) || null
  }, [embarques, emissorEmbarqueId])

  const emissorClienteSelecionado = useMemo(() => {
    return clientesFaturamento.find((item) => item.id === emissorClienteId) || null
  }, [clientesFaturamento, emissorClienteId])

  const emissorUsuarioSelecionado = useMemo(() => {
    return usuariosPortal.find((item) => item.id === emissorUsuarioId) || null
  }, [usuariosPortal, emissorUsuarioId])

  const statusDisponiveisEmissor = useMemo(() => {
    return Array.from(
      new Set(
        embarques
          .map((item) => String(item.status_operacional || '').trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [embarques])

  const embarquesDisponiveisEmissor = useMemo(() => {
    const termo = normalizarTexto(buscaEmissorAwb)
    const termoNumerico = buscaEmissorAwb.replace(/\D/g, '')
    const embarqueSelecionado = embarques.find((item) => item.id === emissorEmbarqueId) || null

    const filtrados = embarques
      .filter((embarque) => {
        const passaStatus =
          filtroStatusEmissor === 'TODOS' ||
          String(embarque.status_operacional || '') === filtroStatusEmissor

        if (!passaStatus) return false
        if (!termo && !termoNumerico) return true

        const base = normalizarTexto(`
          ${embarque.awb || ''}
          ${embarque.cliente_final || ''}
          ${embarque.importador || ''}
          ${embarque.exportador || ''}
          ${embarque.referencia_cliente || ''}
          ${embarque.referencia_hc || ''}
          ${embarque.transportadora || ''}
          ${embarque.servico || ''}
          ${embarque.status_operacional || ''}
        `)

        const numeros = `
          ${embarque.awb || ''}
          ${embarque.referencia_cliente || ''}
          ${embarque.referencia_hc || ''}
        `.replace(/\D/g, '')

        return (
          (!!termo && base.includes(termo)) ||
          (!!termoNumerico && numeros.includes(termoNumerico))
        )
      })
      .slice(0, 120)

    if (embarqueSelecionado && !filtrados.some((item) => item.id === embarqueSelecionado.id)) {
      return [embarqueSelecionado, ...filtrados.slice(0, 119)]
    }

    return filtrados
  }, [embarques, buscaEmissorAwb, filtroStatusEmissor, emissorEmbarqueId])

  const clientesFaturamentoEmissor = useMemo(() => {
    const termo = normalizarTexto(buscaClienteEmissor)
    const termoNumerico = buscaClienteEmissor.replace(/\D/g, '')
    const clienteSelecionado = clientesFaturamento.find((item) => item.id === emissorClienteId) || null

    const filtrados = clientesFaturamento
      .filter((cliente) => {
        if (!termo && !termoNumerico) return true

        const base = normalizarTexto(`
          ${cliente.codigo_hc || ''}
          ${cliente.nome_empresa || ''}
          ${cliente.nome_contato || ''}
          ${cliente.cnpj || ''}
          ${cliente.cpf || ''}
          ${cliente.cidade || ''}
          ${cliente.estado || ''}
          ${cliente.email || ''}
          ${cliente.contato || ''}
        `)

        const numeros = `
          ${cliente.cnpj || ''}
          ${cliente.cpf || ''}
          ${cliente.contato || ''}
          ${cliente.codigo_hc || ''}
        `.replace(/\D/g, '')

        return (
          (!!termo && base.includes(termo)) ||
          (!!termoNumerico && numeros.includes(termoNumerico))
        )
      })
      .slice(0, 120)

    if (clienteSelecionado && !filtrados.some((item) => item.id === clienteSelecionado.id)) {
      return [clienteSelecionado, ...filtrados.slice(0, 119)]
    }

    return filtrados
  }, [clientesFaturamento, buscaClienteEmissor, emissorClienteId])

  const usuariosPortalEmissor = useMemo(() => {
    const termo = normalizarTexto(buscaUsuarioEmissor)
    const usuarioSelecionado = usuariosPortal.find((item) => item.id === emissorUsuarioId) || null

    const filtrados = usuariosPortal
      .filter((usuario) => {
        if (!termo) return true

        const base = normalizarTexto(`
          ${usuario.nome || ''}
          ${usuario.email || ''}
          ${usuario.tipo_acesso || ''}
        `)

        return base.includes(termo)
      })
      .slice(0, 120)

    if (usuarioSelecionado && !filtrados.some((item) => item.id === usuarioSelecionado.id)) {
      return [usuarioSelecionado, ...filtrados.slice(0, 119)]
    }

    return filtrados
  }, [usuariosPortal, buscaUsuarioEmissor, emissorUsuarioId])

  const totaisEmissor = useMemo(() => {
    return itensFatura.reduce(
      (acc, item) => {
        if (!item.selecionado) return acc

        acc.totalUSD += numero(item.valor_usd)
        acc.totalBRL += numero(item.valor_brl)
        return acc
      },
      { totalUSD: 0, totalBRL: 0 }
    )
  }, [itensFatura])

  function taxaConversaoFinal(ptaxValor = emissorTaxaConversao, spreadValor = emissorSpread) {
    const ptax = numero(ptaxValor)
    const spread = numero(spreadValor)

    if (ptax <= 0) return 0

    return ptax * (1 + spread / 100)
  }

  function taxaConversaoFinalFormatada(ptaxValor = emissorTaxaConversao, spreadValor = emissorSpread) {
    const taxa = taxaConversaoFinal(ptaxValor, spreadValor)
    if (taxa <= 0) return '-'

    return taxa.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  }

  function gerarNumeroFaturaSugerido(embarque?: Embarque | null) {
    const data = new Date()
    const ano = String(data.getFullYear()).slice(2)
    const mes = String(data.getMonth() + 1).padStart(2, '0')
    const dia = String(data.getDate()).padStart(2, '0')
    const awbFinal = String(embarque?.awb || '').replace(/\D/g, '').slice(-4) || '0000'

    return `HC${ano}${mes}${dia}${awbFinal}`
  }

  function servicosFinanceirosDoEmbarque(lista: any): ServicoFinanceiroEmbarque[] {
    if (!Array.isArray(lista)) return []

    return lista
      .map((item) => ({
        nome: String(item?.nome || item?.descricao || item?.servico || '').trim(),
        valor: item?.valor ?? item?.valor_usd ?? item?.valor_brl ?? '',
      }))
      .filter((item) => item.nome)
  }

  function chaveServicoFatura(nome: any) {
    const base = normalizarTexto(nome)

    if (base.includes('PRESTACAO DE CONTAS') || base === 'CONTAS') return 'contas'
    if (base.includes('AREA REMOTA')) return 'area_remota'
    if (base.includes('MANUSEIO FORMAL')) return 'manuseio_formal'
    if (base.includes('DELIVER FEE DOC') || base.includes('DELIVERY FEE DOC')) return 'delivery_fee_doc'
    if (base.includes('DESCONTO')) return 'desconto'
    if (base.includes('DGR')) return 'dgr'
    if (base.includes('NAO EMPILHAVEL')) return 'tarifa_carga_nao_empilhavel'
    if (base === 'DTA' || base.includes(' DTA')) return 'dta'
    if (base.includes('OUTRAS TAXAS')) return 'outras_taxas'
    if (base.includes('DUE') || base.includes('DRE')) return 'due_dre'
    if (base.includes('FRETE FEDEX')) return 'frete_fedex'
    if (base === 'FRETE' || base.includes('FRETE ')) return 'frete'
    if (base.includes('HANDLING')) return 'handling'
    if (base === 'IMPOSTOS R$' || base.includes('IMPOSTOS R')) return 'impostos_brl'
    if (base.includes('IMPOSTOS')) return 'impostos'
    if (base.includes('DIVERGENCIA DE PESO')) return 'divergencia_peso'
    if (base.includes('OVERSIZE')) return 'oversize_piece'
    if (base.includes('SEGURO')) return 'seguro'
    if (base.includes('ALTA DEMANDA')) return 'taxa_alta_demanda'
    if (base.includes('ENTREGA FORA')) return 'entrega_fora_area'
    if (base.includes('COBERTA NIVEL B')) return 'coberta_nivel_b'

    return ''
  }

  function carregarItensSalvosDoEmbarque(embarque: Embarque, taxaFinal: number) {
    const servicosSalvos = servicosFinanceirosDoEmbarque((embarque as any).servicos_financeiros)

    if (servicosSalvos.length === 0) return false

    const moedaBase = normalizarTexto(embarque.moeda_cobranca || embarque.moeda || 'USD')
    const valoresPorServico = new Map<string, ServicoFinanceiroEmbarque>()

    servicosSalvos.forEach((servico) => {
      const chave = chaveServicoFatura(servico.nome)
      if (!chave) return
      valoresPorServico.set(chave, servico)
    })

    setItensFatura(
      itensPadraoFatura().map((item) => {
        const servicoSalvo = valoresPorServico.get(item.id)

        if (!servicoSalvo) {
          return {
            ...item,
            selecionado: false,
            valor_usd: '',
            valor_brl: '',
            observacao: '',
          }
        }

        let valor = numero(servicoSalvo.valor)

        // No cadastro do embarque o desconto entra como abatimento.
        // Na fatura ele precisa entrar negativo para manter o total correto.
        if (item.id === 'desconto' && valor > 0) valor = valor * -1

        const valorUsd =
          moedaBase === 'BRL' || moedaBase === 'R$'
            ? taxaFinal > 0
              ? valor / taxaFinal
              : 0
            : valor

        const valorBrl =
          moedaBase === 'BRL' || moedaBase === 'R$'
            ? valor
            : taxaFinal > 0
              ? valor * taxaFinal
              : 0

        return {
          ...item,
          selecionado: true,
          valor_usd: valorUsd ? formatarNumeroInput(valorUsd) : '',
          valor_brl: valorBrl ? formatarNumeroInput(valorBrl) : '',
          observacao: embarque.transportadora || '',
        }
      })
    )

    return true
  }

  function dataUltimoDiaMesAnterior() {
    const hoje = new Date()
    const ultimoDiaMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0)

    return ultimoDiaMesAnterior.toISOString().slice(0, 10)
  }

  function dataBRSimples(dataISO?: string | null) {
    const data = normalizarData(dataISO)
    if (!data) return '-'

    const [ano, mes, dia] = data.split('-')
    return `${dia}/${mes}/${ano}`
  }

  function sugestaoPtaxDhlMesAnterior() {
    const data = dataUltimoDiaMesAnterior()

    return {
      data,
      valor: '',
    }
  }

  function formatarTaxaCambioInput(valor: any) {
    const numeroValor = Number(valor || 0)

    if (!numeroValor) return ''

    return numeroValor.toLocaleString('pt-BR', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    })
  }

  function aplicarTaxaCambio(tipo: string, valor: string) {
    setEmissorTipoCambio(tipo)
    recalcularItensPorTaxa(valor)
  }

  async function carregarCambioAutomaticoEmissor(tipoPreferencial?: string, aplicarAutomaticamente = false) {
    setCarregandoCambioEmissor(true)

    try {
      const resposta = await fetch('/api/cambio-bacen', {
        cache: 'no-store',
      })

      const retorno = await resposta.json().catch(() => null)

      if (!resposta.ok) {
        throw new Error(retorno?.error || 'Erro ao consultar câmbio.')
      }

      const dolarVenda = formatarTaxaCambioInput(retorno?.dolar_venda_dia?.valor)
      const dataDolarVenda = retorno?.dolar_venda_dia?.data || ''
      const ptaxDhl = formatarTaxaCambioInput(retorno?.ptax_dhl_mes_anterior?.valor)
      const dataPtaxDhl = retorno?.ptax_dhl_mes_anterior?.data || ''

      setEmissorDolarVendaDia(dolarVenda)
      setEmissorPtaxDhlMesAnterior(ptaxDhl)
      setEmissorDataPtaxDhlMesAnterior(dataPtaxDhl || sugestaoPtaxDhlMesAnterior().data)

      setEmissorAvisoCambio(
        `Câmbio atualizado pelo Banco Central. Dólar venda: ${dolarVenda || '-'} (${dataBRSimples(dataDolarVenda)}). PTAX DHL mês anterior: ${ptaxDhl || '-'} (${dataBRSimples(dataPtaxDhl)}).`
      )

      if (aplicarAutomaticamente) {
        const tipoFinal = tipoPreferencial || emissorTipoCambio

        if (tipoFinal === 'PTAX_DHL_MES_ANTERIOR' && ptaxDhl) {
          aplicarTaxaCambio('PTAX_DHL_MES_ANTERIOR', ptaxDhl)
          return ptaxDhl
        }

        if (dolarVenda) {
          aplicarTaxaCambio('DOLAR_VENDA_DIA', dolarVenda)
          return dolarVenda
        }
      }

      return tipoPreferencial === 'PTAX_DHL_MES_ANTERIOR' ? ptaxDhl : dolarVenda
    } catch (error: any) {
      console.log('Erro ao buscar câmbio automático:', error)
      setEmissorAvisoCambio(
        `Não foi possível buscar o câmbio automático agora. Informe a taxa manualmente se precisar emitir a fatura. Motivo: ${error?.message || error}`
      )

      return ''
    } finally {
      setCarregandoCambioEmissor(false)
    }
  }

  function selecionarEmbarqueEmissor(embarqueId: string) {
    setEmissorEmbarqueId(embarqueId)

    const embarque = embarques.find((item) => item.id === embarqueId) || null
    if (!embarque) return

    const financeiro = financeiroDoEmbarque(embarque)
    const valor = valorFinanceiro(financeiro) || numero(embarque.valor_fechado) || numero(embarque.valor_cobrado_cliente) || numero(embarque.valor_venda)
    const vencimento = normalizarData(vencimentoFinanceiro(financeiro)) || ''
    const taxa = numero(embarque.taxa_conversao)
    const numeroAtual = faturaDoEmbarque(embarque.id)?.numero_fatura || gerarNumeroFaturaSugerido(embarque)
    const transportadoraDhl = normalizarTexto(embarque.transportadora || '').includes('DHL')
    const ptaxDhlSugerido = sugestaoPtaxDhlMesAnterior()
    const taxaBaseEmbarque = taxa ? String(taxa).replace('.', ',') : ''
    const taxaBaseInicial = transportadoraDhl && ptaxDhlSugerido.valor ? ptaxDhlSugerido.valor : taxaBaseEmbarque

    setEmissorNumeroFatura(numeroAtual)
    setEmissorVencimento(vencimento)
    setEmissorTaxaConversao(taxaBaseInicial)
    setEmissorTipoCambio(transportadoraDhl ? 'PTAX_DHL_MES_ANTERIOR' : 'DOLAR_VENDA_DIA')
    setEmissorDataPtaxDhlMesAnterior(ptaxDhlSugerido.data)
    setEmissorPtaxDhlMesAnterior(transportadoraDhl ? ptaxDhlSugerido.valor : '')
    setEmissorDolarVendaDia(!transportadoraDhl ? taxaBaseEmbarque : '')
    setEmissorUsuarioId(embarque.usuario_id || '')
    setEmissorDespachante(financeiro?.despachante || '')

    const taxaFinal = taxaConversaoFinal(taxaBaseInicial, emissorSpread)

    const carregouItensSalvos = carregarItensSalvosDoEmbarque(embarque, taxaFinal)

    if (!carregouItensSalvos) {
      setItensFatura((atuais) =>
        atuais.map((item) => {
          if (item.id !== 'frete') return { ...item, selecionado: false, valor_usd: '', valor_brl: '', observacao: '' }

          return {
            ...item,
            selecionado: valor > 0,
            valor_usd: taxaFinal > 0 && valor > 0 ? formatarNumeroInput(valor / taxaFinal) : '',
            valor_brl: valor > 0 ? formatarNumeroInput(valor) : '',
            observacao: embarque.transportadora || '',
          }
        })
      )
    }

    void carregarCambioAutomaticoEmissor(
      transportadoraDhl ? 'PTAX_DHL_MES_ANTERIOR' : 'DOLAR_VENDA_DIA',
      true
    )
  }

  function abrirEmissaoFaturaDireta(embarque: Embarque) {
    setAbaAtiva('EMISSOR')
    setBuscaEmissorAwb(String(embarque.awb || embarque.cliente_final || embarque.importador || ''))
    selecionarEmbarqueEmissor(embarque.id)

    setTimeout(() => {
      document.getElementById('emissor_fatura')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  function atualizarItemFatura(id: string, campo: keyof ItemFaturaServico, valor: string | boolean) {
    setItensFatura((atuais) =>
      atuais.map((item) => {
        if (item.id !== id) return item

        const atualizado: ItemFaturaServico = {
          ...item,
          [campo]: valor,
        } as ItemFaturaServico

        if (campo === 'valor_usd') {
          const taxa = taxaConversaoFinal()
          const valorUsd = numero(valor)
          if (taxa > 0 && valorUsd > 0) {
            atualizado.valor_brl = formatarNumeroInput(valorUsd * taxa)
          }
        }

        return atualizado
      })
    )
  }

  function recalcularItensPorTaxa(novaTaxa: string) {
    setEmissorTaxaConversao(novaTaxa)

    const taxa = taxaConversaoFinal(novaTaxa, emissorSpread)
    if (taxa <= 0) return

    setItensFatura((atuais) =>
      atuais.map((item) => {
        const valorUsd = numero(item.valor_usd)
        if (!item.selecionado || valorUsd <= 0) return item

        return {
          ...item,
          valor_brl: formatarNumeroInput(valorUsd * taxa),
        }
      })
    )
  }

  function recalcularItensPorSpread(novoSpread: string) {
    setEmissorSpread(novoSpread)

    const taxa = taxaConversaoFinal(emissorTaxaConversao, novoSpread)
    if (taxa <= 0) return

    setItensFatura((atuais) =>
      atuais.map((item) => {
        const valorUsd = numero(item.valor_usd)
        if (!item.selecionado || valorUsd <= 0) return item

        return {
          ...item,
          valor_brl: formatarNumeroInput(valorUsd * taxa),
        }
      })
    )
  }

  function limparEmissor() {
    setBuscaEmissorAwb('')
    setFiltroStatusEmissor('TODOS')
    setBuscaClienteEmissor('')
    setBuscaUsuarioEmissor('')
    setEmissorEmbarqueId('')
    setEmissorClienteId('')
    setEmissorUsuarioId('')
    setEmissorDespachante('')
    setEmissorNumeroFatura('')
    setEmissorVencimento('')
    setEmissorTaxaConversao('')
    setEmissorTipoCambio('DOLAR_VENDA_DIA')
    setEmissorDolarVendaDia('')
    setEmissorPtaxDhlMesAnterior('')
    setEmissorDataPtaxDhlMesAnterior('')
    setEmissorSpread('3')
    setEmissorObservacoes('')
    setEmissorVisivelCliente(true)
    setEmissorAvisoCambio('')
    setItensFatura(itensPadraoFatura())
  }

  function mesFinanceiroDaFatura() {
    return normalizarData(emissorVencimento)?.slice(0, 7) || new Date().toISOString().slice(0, 7)
  }

  function itensSelecionadosFatura() {
    return itensFatura
      .filter((item) => item.selecionado && (numero(item.valor_usd) > 0 || numero(item.valor_brl) > 0 || item.observacao.trim()))
      .map((item) => ({
        descricao: item.descricao,
        valor_usd: numero(item.valor_usd),
        valor_brl: numero(item.valor_brl),
        observacao: item.observacao || null,
      }))
  }

  async function salvarFinanceiroDaFatura(arquivoPdfUrl: string) {
    if (!emissorEmbarqueSelecionado || !emissorClienteSelecionado) return

    const financeiroAtual = financeiroDoEmbarque(emissorEmbarqueSelecionado)
    const itensSelecionados = itensSelecionadosFatura()

    const itensResumo = itensSelecionados
      .map((item) => `${item.descricao}: ${moeda(item.valor_brl)}`)
      .join(' | ')

    // Regra HC:
    // A fatura para o cliente continua com PTAX + spread.
    // Porém, o item HANDLING entra em Processos Faturados como débito de terceiro
    // SEM o spread, para que somente o spread do HANDLING fique como profit.
    const ptaxBase = numero(emissorTaxaConversao)
    const spreadPercentual = numero(emissorSpread)
    const fatorSpread = 1 + spreadPercentual / 100

    const itensHandling = itensSelecionados.filter((item) =>
      normalizarTexto(item.descricao).includes('HANDLING')
    )

    const handlingComSpread = itensHandling.reduce((total, item) => total + numero(item.valor_brl), 0)

    const handlingSemSpread = itensHandling.reduce((total, item) => {
      const valorUsd = numero(item.valor_usd)
      const valorBrl = numero(item.valor_brl)

      if (valorUsd > 0 && ptaxBase > 0) {
        return total + valorUsd * ptaxBase
      }

      if (valorBrl > 0 && fatorSpread > 0) {
        return total + valorBrl / fatorSpread
      }

      return total
    }, 0)

    const spreadHandling = Math.max(0, handlingComSpread - handlingSemSpread)
    const debitoTerceiroAtualizado =
      handlingSemSpread > 0
        ? Number(handlingSemSpread.toFixed(2))
        : numero(financeiroAtual?.debito_terceiro)

    const observacaoHandling =
      handlingSemSpread > 0
        ? `HANDLING sem spread lançado em débito terceiro${emissorDespachante ? ` para ${emissorDespachante}` : ''}: ${moeda(handlingSemSpread)}. Spread/Profit do HANDLING: ${moeda(spreadHandling)}.`
        : ''

    const payloadBase: any = {
      cliente: emissorClienteSelecionado.nome_empresa || emissorEmbarqueSelecionado.cliente_final || emissorEmbarqueSelecionado.importador || null,
      awb: emissorEmbarqueSelecionado.awb || null,
      fatura: emissorNumeroFatura || null,
      despachante: emissorDespachante || financeiroAtual?.despachante || null,
      transportadora: emissorEmbarqueSelecionado.transportadora || null,
      servico: emissorEmbarqueSelecionado.servico || null,
      valor_cobranca: totaisEmissor.totalBRL,
      doc_dta: numero(financeiroAtual?.doc_dta),
      debito_terceiro: debitoTerceiroAtualizado,
      valor_compra: numero(financeiroAtual?.valor_compra),
      vencimento_cobranca: emissorVencimento || null,
      recebimento: financeiroAtual?.recebimento || null,
      mes: mesFinanceiroDaFatura(),
      mes_profit: financeiroAtual?.mes_profit || '',
      observacoes: `Fatura emitida pelo HC Connect. PDF: ${arquivoPdfUrl}. Itens: ${itensResumo}${observacaoHandling ? ` | ${observacaoHandling}` : ''}${emissorObservacoes ? ` | Obs: ${emissorObservacoes}` : ''}`,
    }

    if (financeiroAtual?.id) {
      const { error } = await supabase
        .from('financeiro_embarques')
        .update(payloadBase)
        .eq('id', financeiroAtual.id)

      if (error) throw new Error(`Fatura salva, mas houve erro ao atualizar Processos Faturados: ${error.message}`)
      return
    }

    const payloadComEmbarqueId = {
      ...payloadBase,
      embarque_id: emissorEmbarqueSelecionado.id,
    }

    const { error } = await supabase.from('financeiro_embarques').insert([payloadComEmbarqueId])

    if (error) {
      const erroColunaEmbarque = String(error.message || '').toLowerCase().includes('embarque_id')

      if (erroColunaEmbarque) {
        const { error: erroSemEmbarque } = await supabase.from('financeiro_embarques').insert([payloadBase])
        if (erroSemEmbarque) throw new Error(`Fatura salva, mas houve erro ao lançar em Processos Faturados: ${erroSemEmbarque.message}`)
        return
      }

      throw new Error(`Fatura salva, mas houve erro ao lançar em Processos Faturados: ${error.message}`)
    }
  }

  async function garantirLoginVinculadoAoEmbarque() {
    if (!emissorEmbarqueSelecionado || !emissorUsuarioId) return

    if (!emissorEmbarqueSelecionado.usuario_id) {
      await supabase
        .from('embarques')
        .update({ usuario_id: emissorUsuarioId })
        .eq('id', emissorEmbarqueSelecionado.id)
    }

    const { data: vinculoExistente, error: erroConsultaVinculo } = await supabase
      .from('embarque_clientes')
      .select('*')
      .eq('embarque_id', emissorEmbarqueSelecionado.id)
      .eq('cliente_id', emissorUsuarioId)
      .limit(1)

    if (erroConsultaVinculo) {
      console.log('Não foi possível consultar vínculo do embarque com o login:', erroConsultaVinculo)
      return
    }

    if (vinculoExistente && vinculoExistente.length > 0) return

    const { error: erroInserirVinculo } = await supabase
      .from('embarque_clientes')
      .insert([{
        embarque_id: emissorEmbarqueSelecionado.id,
        cliente_id: emissorUsuarioId,
      }])

    if (erroInserirVinculo) {
      console.log('Não foi possível vincular embarque ao login do cliente:', erroInserirVinculo)
    }
  }

  async function gerarPdfFaturaHC() {
    if (!emissorEmbarqueSelecionado) return alert('Selecione o embarque/AWB primeiro.')
    if (!emissorClienteSelecionado) return alert('Selecione o cliente de faturamento.')
    if (!emissorNumeroFatura.trim()) return alert('Informe o número da fatura.')
    if (!emissorVencimento) return alert('Informe o vencimento da fatura.')
    if (itensSelecionadosFatura().length === 0 || totaisEmissor.totalBRL <= 0) {
      return alert('Selecione pelo menos um serviço com valor para emitir a fatura.')
    }

    setSalvandoEmissao(true)

    try {
      const jsPDFModule = await import('jspdf')
      const autoTableModule = await import('jspdf-autotable')

      const jsPDF = (jsPDFModule as any).jsPDF || (jsPDFModule as any).default
      const autoTable = (autoTableModule as any).default || (autoTableModule as any).autoTable

      if (!jsPDF || !autoTable) {
        throw new Error('Biblioteca de PDF não carregou corretamente. Rode npm install jspdf jspdf-autotable e publique novamente.')
      }

      const logoBase64 = await carregarImagemBase64(['/HC-CONSULTORIA-TRANSPARENTE.png', '/logo.png', '/logo-hc.png', '/hc-logo.png', '/icon-512.png', '/icon-192.png'])
      const qrPixBase64 = await gerarQrCodePixBase64(totaisEmissor.totalBRL, emissorNumeroFatura)

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' }) as any
      const margem = 32
      const larguraPagina = pdf.internal.pageSize.getWidth()
      const itens = itensSelecionadosFatura()
      const dadosCliente = dadosClienteFiscal(emissorClienteSelecionado)

      const codigoClientePdf = String(emissorClienteSelecionado.codigo_hc || '-').trim() || '-'
      const numeroFaturaPdf = String(emissorNumeroFatura || '-').trim() || '-'

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text('FATURA DE SERVIÇO', margem, 34)
      pdf.text(`CÓDIGO CLIENTE: ${codigoClientePdf}`, 210, 34)
      pdf.text(`FATURA Nº: ${numeroFaturaPdf}`, larguraPagina - margem, 34, { align: 'right' })

      pdf.setFontSize(10)
      pdf.text(`DATA DA FATURA: ${dataBR(new Date().toISOString())}`, 430, 56)
      pdf.text(`DATA DE VENC.: ${dataBR(emissorVencimento)}`, 430, 76)

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.text('COUTO E OTERO INTERMEDIAÇÃO LTDA', margem, 58)
      pdf.setFont('helvetica', 'normal')
      pdf.text('RUA DOS COMANCHES Nº 131', margem, 78)
      pdf.text('BELO HORIZONTE, MG', margem, 92)
      pdf.text('31530250', margem, 106)
      pdf.text('CNPJ 41.456.630/0001-52', margem, 120)
      pdf.text('TELEFONE: 55 (31) 3643-6175', 185, 78)
      pdf.text('E-MAIL: GRUPOHCCONSULTORIA@OUTLOOK.COM', 185, 106)
      pdf.text('INSCRIÇÃO ESTADUAL: ISENTO', 185, 128)
      pdf.text('INSCRIÇÃO MUNICIPAL: 1296606100', 350, 128)

      const larguraMaximaLogo = 88
      const alturaMaximaLogo = 58
      const xLogoBase = larguraPagina - margem - larguraMaximaLogo
      const yLogoBase = 74

      if (logoBase64) {
        try {
          const formatoLogo = logoBase64.includes('image/jpeg') || logoBase64.includes('image/jpg')
            ? 'JPEG'
            : logoBase64.includes('image/webp')
              ? 'WEBP'
              : 'PNG'

          const dimensoesLogo = await obterDimensoesImagemBase64(logoBase64)
          const logoAjustada = encaixarImagemSemDistorcer(
            dimensoesLogo?.width || larguraMaximaLogo,
            dimensoesLogo?.height || alturaMaximaLogo,
            larguraMaximaLogo,
            alturaMaximaLogo
          )

          const xLogo = xLogoBase + (larguraMaximaLogo - logoAjustada.width) / 2
          const yLogo = yLogoBase + (alturaMaximaLogo - logoAjustada.height) / 2

          // Sem fundo e sem distorção: mantém transparência e proporção original da logo.
          pdf.addImage(logoBase64, formatoLogo, xLogo, yLogo, logoAjustada.width, logoAjustada.height)
        } catch (error) {
          console.log('Logo não pôde ser inserida no PDF. Usando fallback em texto:', error)
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(22)
          pdf.text('HC', xLogoBase + larguraMaximaLogo / 2, yLogoBase + 32, { align: 'center' })
          pdf.setFontSize(7)
          pdf.text('CONSULTORIA', xLogoBase + larguraMaximaLogo / 2, yLogoBase + 44, { align: 'center' })
        }
      } else {
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(22)
        pdf.text('HC', xLogoBase + larguraMaximaLogo / 2, yLogoBase + 32, { align: 'center' })
        pdf.setFontSize(7)
        pdf.text('CONSULTORIA', xLogoBase + larguraMaximaLogo / 2, yLogoBase + 44, { align: 'center' })
      }

      pdf.setDrawColor(0, 0, 0)
      pdf.setFillColor(221, 229, 244)
      pdf.rect(margem, 140, larguraPagina - margem * 2, 104, 'FD')
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Cobrança para:', margem + 8, 160)
      pdf.text('CNPJ / CPF:', 382, 160)
      pdf.text('Endereço:', margem + 8, 190)

      pdf.setFont('helvetica', 'normal')
      const nomeClienteLinhas = pdf.splitTextToSize(dadosCliente.nome || '-', 215)
      const enderecoClienteLinhas = pdf.splitTextToSize(dadosCliente.endereco || '-', 320)
      pdf.text(nomeClienteLinhas, 150, 160)
      pdf.text(dadosCliente.documento || '-', 455, 160)
      pdf.text(enderecoClienteLinhas, 150, 190)
      pdf.text(`${dadosCliente.cidade || '-'} / ${dadosCliente.estado || '-'}`, 150, 216)
      pdf.text(`CEP: ${dadosCliente.cep || '-'}`, 150, 234)

      pdf.setFont('helvetica', 'bold')
      pdf.text('DISCRIMINAÇÃO DOS SERVIÇOS', margem, 264)
      pdf.text(`HAWB/AWB: ${emissorEmbarqueSelecionado.awb || '-'}`, 245, 264)

      const linhas = itens.map((item) => [
        item.descricao,
        item.observacao || '',
        item.valor_usd > 0 ? formatarValorSimples(item.valor_usd) : '-',
        item.valor_brl > 0 ? moeda(item.valor_brl) : '-',
      ])

      autoTable(pdf, {
        startY: 272,
        head: [['SERVIÇO', 'OBSERVAÇÃO', 'VALOR USD', 'VALOR R$']],
        body: linhas,
        theme: 'grid',
        margin: { left: margem, right: margem },
        styles: { fontSize: 8, cellPadding: 4, lineColor: [25, 25, 25], lineWidth: 0.4 },
        headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 190 },
          1: { cellWidth: 170 },
          2: { cellWidth: 80, halign: 'right' },
          3: { cellWidth: 90, halign: 'right' },
        },
      })

      const yFinal = (pdf as any).lastAutoTable.finalY + 14
      pdf.setFillColor(190, 190, 190)
      pdf.rect(margem, yFinal, larguraPagina - margem * 2, 18, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(8)
      pdf.text('TOTAL', margem + 6, yFinal + 12)
      pdf.text('USD', 390, yFinal + 12)
      pdf.text(formatarValorSimples(totaisEmissor.totalUSD), 435, yFinal + 12, { align: 'right' })
      pdf.text('R$', 470, yFinal + 12)
      pdf.text(moeda(totaisEmissor.totalBRL).replace('R$', '').trim(), larguraPagina - margem - 6, yFinal + 12, { align: 'right' })

      const yExtenso = yFinal + 42
      pdf.setDrawColor(0, 0, 0)
      pdf.rect(margem, yExtenso - 20, larguraPagina - margem * 2, 32)
      pdf.setFont('helvetica', 'bold')
      pdf.text('VALOR POR EXTENSO', margem + 8, yExtenso)
      pdf.setFont('helvetica', 'normal')
      pdf.text(valorPorExtensoBRL(totaisEmissor.totalBRL), 230, yExtenso)

      const yTaxa = yExtenso + 36
      pdf.rect(margem, yTaxa - 18, larguraPagina - margem * 2, 26)
      pdf.setFont('helvetica', 'bold')
      pdf.text('TAXA DE CONVERSÃO:', margem + 8, yTaxa)
      pdf.text(`SPREAD ${emissorSpread || '0'}%`, 240, yTaxa)
      pdf.text(`R$ ${taxaConversaoFinalFormatada()}`, larguraPagina - margem - 6, yTaxa, { align: 'right' })

      const yBanco = yTaxa + 30
      pdf.setFillColor(45, 119, 183)
      pdf.rect(margem, yBanco - 16, larguraPagina - margem * 2, 54, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'bold')
      pdf.text('BANCO BS2 - 218 - BS2 - AGÊNCIA 0001 CONTA: 8749272', larguraPagina / 2, yBanco, { align: 'center' })
      pdf.text('BANCO ITAÚ - AG. 4508 CONTA: 99842-6 CHAVE PIX E-MAIL: GRUPOHCCONSULTORIA@OUTLOOK.COM', larguraPagina / 2, yBanco + 15, { align: 'center' })
      pdf.text('BANCO CONTABILIZEI DOCK IP S.A. 301 - AG: 0001 CONTA 311413-7 CHAVE PIX CNPJ: 41.456.630/0001-52', larguraPagina / 2, yBanco + 30, { align: 'center' })
      pdf.setTextColor(0, 0, 0)

      const yAssinatura = yBanco + 68
      const xAssinaturaCentro = larguraPagina / 2 - 28
      pdf.setDrawColor(70, 70, 70)
      pdf.setLineWidth(0.4)
      pdf.line(xAssinaturaCentro - 68, yAssinatura - 5, xAssinaturaCentro + 68, yAssinatura - 5)
      pdf.setFont('times', 'italic')
      pdf.setFontSize(10)
      pdf.text('Marcos Paulo Otero', xAssinaturaCentro, yAssinatura - 10, { align: 'center' })
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      pdf.text('COUTO E OTERO INTERMEDIAÇÃO LTDA', xAssinaturaCentro, yAssinatura + 8, { align: 'center' })
      pdf.text('CNPJ: 41.456.630/0001-52', xAssinaturaCentro, yAssinatura + 19, { align: 'center' })

      const xQr = larguraPagina - margem - 92
      const yQr = yBanco + 48

      if (qrPixBase64) {
        try {
          pdf.addImage(qrPixBase64, xQr, yQr, 72, 72)
        } catch (error) {
          console.log('QR Code PIX não pôde ser inserido no PDF:', error)
          pdf.setDrawColor(0, 0, 0)
          pdf.rect(xQr, yQr, 72, 72)
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(7)
          pdf.text('PIX CNPJ', xQr + 36, yQr + 34, { align: 'center' })
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(5.5)
          pdf.text('41.456.630/0001-52', xQr + 36, yQr + 46, { align: 'center' })
        }
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(6)
        pdf.text('PIX CNPJ', xQr + 36, yQr + 82, { align: 'center' })
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(5.5)
        pdf.text('Escaneie para pagar', xQr + 36, yQr + 91, { align: 'center' })
      } else {
        pdf.setDrawColor(0, 0, 0)
        pdf.rect(xQr, yQr, 72, 72)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(7)
        pdf.text('PIX CNPJ', xQr + 36, yQr + 34, { align: 'center' })
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(5.5)
        pdf.text('41.456.630/0001-52', xQr + 36, yQr + 46, { align: 'center' })
      }

      if (emissorObservacoes) {
        pdf.setFontSize(7)
        pdf.text(`Observações: ${emissorObservacoes}`, margem, yAssinatura + 48, {
          maxWidth: larguraPagina - margem * 2 - 105,
        })
      }

      const blob = pdf.output('blob') as Blob
      const nomeArquivo = `${emissorEmbarqueSelecionado.id}/${Date.now()}-fatura-${emissorNumeroFatura.replace(/[^A-Z0-9_-]/gi, '-')}.pdf`

      const { error: erroUpload } = await supabase.storage
        .from('faturas')
        .upload(nomeArquivo, blob, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'application/pdf',
        })

      if (erroUpload) throw new Error(erroUpload.message)

      const { data: urlData } = supabase.storage.from('faturas').getPublicUrl(nomeArquivo)
      const urlPdf = urlData.publicUrl
      const faturaExistente = faturaDoEmbarque(emissorEmbarqueSelecionado.id)
      const caminhoAntigo = extrairCaminhoStorage(faturaExistente?.arquivo_pdf)

      if (caminhoAntigo) {
        await supabase.storage.from('faturas').remove([caminhoAntigo])
      }

      const payloadFatura: any = {
        embarque_id: emissorEmbarqueSelecionado.id,
        usuario_id: emissorUsuarioId || emissorEmbarqueSelecionado.usuario_id || null,
        numero_fatura: emissorNumeroFatura || null,
        arquivo_pdf: urlPdf,
        visivel_cliente: emissorVisivelCliente,
        observacoes: emissorObservacoes || null,
        cliente_faturamento_id: emissorClienteSelecionado.id,
        dados_cliente_faturamento: dadosCliente,
        itens_fatura: itensSelecionadosFatura(),
        valor_total: totaisEmissor.totalBRL,
        valor_usd: totaisEmissor.totalUSD,
        taxa_conversao: taxaConversaoFinal(),
        spread: numero(emissorSpread),
        vencimento: emissorVencimento || null,
      }

      if (faturaExistente) {
        const { error } = await supabase.from('faturas').update(payloadFatura).eq('id', faturaExistente.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase.from('faturas').insert([payloadFatura])
        if (error) throw new Error(error.message)
      }

      await garantirLoginVinculadoAoEmbarque()
      await salvarFinanceiroDaFatura(urlPdf)

      const mensagemSucesso = emissorUsuarioId
        ? 'Fatura emitida, salva, vinculada ao AWB/login e lançada em Processos Faturados.'
        : 'Fatura emitida, salva e lançada em Processos Faturados. Nenhum login foi vinculado agora; quando o cliente fizer cadastro, vincule o login ao AWB para liberar esta fatura no portal.'

      alert(mensagemSucesso)
      limparEmissor()
      setAbaAtiva('FATURAS')
      carregar()
    } catch (error: any) {
      console.error(error)
      alert(
        `Erro ao emitir fatura: ${error?.message || error}\n\nSe o erro mencionar uma coluna da tabela faturas, rode primeiro o SQL de atualização que eu enviei.`
      )
    } finally {
      setSalvandoEmissao(false)
    }
  }


  function renderFormularioRecibo() {
    if (!reciboSelecionado) return null

    const faturaReciboAtual = faturaDoEmbarque(reciboSelecionado.id)
    const clientesRecibo = clientesFaturamentoReciboFiltrados()
    const clienteReciboSelecionado = clienteFaturamentoReciboSelecionado()
    const dadosClienteRecibo = dadosClienteFiscalRecibo(faturaReciboAtual, reciboSelecionado)

    return (
<section id="form_recibo" className="border border-green-700 rounded-3xl bg-green-950/10 p-7 mb-8">
  <div className="flex flex-col lg:flex-row justify-between gap-5 mb-7">
    <div>
      <p className="text-green-400 font-bold mb-2">Emitir recibo</p>
      <h2 className="text-2xl font-black">Recibo do AWB {reciboSelecionado.awb}</h2>
      <p className="text-slate-400 text-sm">
        Informe a data em que o pagamento entrou no banco. O sistema vai gerar o PDF, liberar para o cliente e atualizar Processos Faturados.
      </p>
    </div>

    <button
      onClick={limparRecibo}
      className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-2xl font-bold h-fit"
    >
      Cancelar
    </button>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
    <InfoPacote label="Fatura" valor={faturaReciboAtual?.numero_fatura || '-'} />
    <InfoPacote label="Cliente do embarque" valor={reciboSelecionado.cliente_final || reciboSelecionado.importador || '-'} />
    <InfoPacote label="Valor base" valor={moeda(valorPadraoRecibo(reciboSelecionado))} destaque />
    <InfoPacote label="Status financeiro" valor={statusPagamentoFinanceiro(financeiroDoEmbarque(reciboSelecionado)).label} />

    <div className="md:col-span-4 rounded-2xl border border-blue-900 bg-[#071225] p-5">
      <div className="flex flex-col lg:flex-row justify-between gap-4 mb-4">
        <div>
          <h3 className="text-xl font-black text-white">Cliente fiscal do recibo</h3>
          <p className="text-slate-400 text-sm">
            O recibo usará os dados da lista de Clientes Faturamento, igual ao emissor de faturas.
          </p>
        </div>

        <Link
          href="/admin/clientes-faturamento"
          className="bg-purple-600 hover:bg-purple-500 px-4 py-3 rounded-xl font-bold h-fit text-center"
        >
          Clientes Faturamento
        </Link>
      </div>

      <input
        value={buscaClienteRecibo}
        onChange={(e) => setBuscaClienteRecibo(e.target.value)}
        placeholder="Buscar cliente fiscal por nome, CNPJ, CPF, e-mail ou código HC..."
        className="mb-3 w-full"
      />

      <select
        value={reciboClienteId}
        onChange={(e) => setReciboClienteId(e.target.value)}
        className="w-full"
      >
        <option value="">Selecione o cliente fiscal</option>
        {clientesRecibo.map((cliente: any) => (
          <option key={cliente.id} value={cliente.id}>
            {(cliente.codigo_hc ? String(cliente.codigo_hc) + ' - ' : '')}
            {cliente.nome_empresa || cliente.razao_social || 'Cliente sem nome'}
            {' - '}
            {cliente.cnpj || cliente.cpf || 'sem documento'}
          </option>
        ))}
      </select>

      {buscandoClientesEmissor && (
        <p className="mt-2 text-xs text-blue-300">
          Buscando clientes cadastrados...
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <InfoPacote label="Razão social / Nome" valor={dadosClienteRecibo.nome || '-'} destaque />
        <InfoPacote label="CNPJ / CPF" valor={dadosClienteRecibo.documento || '-'} destaque />
        <InfoPacote label="E-mail" valor={dadosClienteRecibo.email || '-'} />
        <InfoPacote label="Endereço" valor={dadosClienteRecibo.endereco || '-'} />
        <InfoPacote
          label="Cidade / UF / CEP"
          valor={[dadosClienteRecibo.cidade, dadosClienteRecibo.estado, dadosClienteRecibo.cep].filter(Boolean).join(' / ') || '-'}
        />
        <InfoPacote label="Contato" valor={dadosClienteRecibo.contato || '-'} />
      </div>

      {!clienteReciboSelecionado && (
        <p className="mt-3 text-xs text-yellow-300">
          Selecione o cliente fiscal cadastrado para emitir o recibo com os dados corretos da base Clientes Faturamento.
        </p>
      )}
    </div>

    <div>
      <label className="block text-sm font-black text-slate-300 mb-2">Data do recebimento</label>
      <input
        type="date"
        value={dataRecebimentoRecibo}
        onChange={(e) => setDataRecebimentoRecibo(e.target.value)}
      />
    </div>

    <div>
      <label className="block text-sm font-black text-slate-300 mb-2">Valor recebido</label>
      <input
        value={valorRecebidoRecibo}
        onChange={(e) => setValorRecebidoRecibo(e.target.value)}
        placeholder="Ex: 1.359,29"
      />
    </div>

    <div className="md:col-span-2">
      <label className="block text-sm font-black text-slate-300 mb-2">Forma de recebimento</label>
      <input
        value={formaRecebimentoRecibo}
        onChange={(e) => setFormaRecebimentoRecibo(e.target.value)}
        placeholder="PIX, boleto, transferência..."
      />
    </div>

    <textarea
      value={observacoesRecibo}
      onChange={(e) => setObservacoesRecibo(e.target.value)}
      placeholder="Observações que devem constar no recibo ou histórico financeiro"
      className="md:col-span-4 min-h-[90px]"
    />

    <div className="md:col-span-4 border border-green-500/40 bg-green-500/10 rounded-2xl p-4 text-green-200 text-sm">
      Ao emitir, o recibo será salvo em Faturas clientes, ficará disponível para o cliente no portal e o AWB será marcado como recebido em Financeiro &gt; Processos Faturados.
    </div>

    <button
      onClick={gerarPdfReciboHC}
      disabled={emitindoRecibo}
      className="md:col-span-4 bg-green-600 hover:bg-green-500 rounded-2xl font-bold disabled:opacity-60 py-4"
    >
      {emitindoRecibo ? 'Gerando recibo...' : 'Gerar recibo e registrar recebimento'}
    </button>
  </div>
</section>
    )
  }


  function renderAbaRecibos() {
    const termo = normalizarTexto(buscaRecibo)

    const faturasParaRecibo = faturas
      .filter((fatura) => !!fatura.arquivo_pdf && !fatura.arquivado_admin)
      .map((fatura) => {
        const embarque =
          embarques.find((item) => String(item.id) === String(fatura.embarque_id)) ||
          null

        return {
          fatura,
          embarque,
        }
      })
      .filter(({ fatura, embarque }) => {
        if (!embarque) return false
        if (!termo) return true

        const base = normalizarTexto(`
          ${fatura.numero_fatura || ''}
          ${embarque.awb || ''}
          ${embarque.cliente_final || ''}
          ${embarque.exportador || ''}
          ${embarque.importador || ''}
          ${embarque.transportadora || ''}
          ${fatura.status_pagamento || ''}
        `)

        return base.includes(termo)
      })
      .slice(0, 150)

    return (
      <section className="space-y-6">
        <div className="rounded-3xl border border-green-800 bg-green-950/10 p-6 lg:p-7">
          <div className="flex flex-col lg:flex-row justify-between gap-5 mb-6">
            <div>
              <p className="text-green-400 font-bold mb-2">Emissor de recibos</p>
              <h2 className="text-3xl font-black">Emitir recibo vinculado ao AWB</h2>
              <p className="text-slate-400 text-sm mt-2">
                Localize a fatura, informe a data real do recebimento e o sistema registra em Processos Faturados.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setBuscaRecibo('')
                limparRecibo()
              }}
              className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-2xl font-bold h-fit"
            >
              Limpar recibo
            </button>
          </div>

          <input
            value={buscaRecibo}
            onChange={(e) => setBuscaRecibo(e.target.value)}
            placeholder="Buscar por AWB, cliente, número da fatura ou transportadora..."
            className="w-full mb-5"
          />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {faturasParaRecibo.map(({ fatura, embarque }) => {
              if (!embarque) return null

              const financeiro = financeiroDoEmbarque(embarque)
              const pagamento = statusPagamentoFinanceiro(financeiro)

              return (
                <div
                  key={fatura.id}
                  className="rounded-3xl border border-blue-900 bg-[#020817] p-5"
                >
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500 font-black">AWB / Fatura</p>
                      <h3 className="mt-1 text-2xl font-black text-blue-300">{embarque.awb || '-'}</h3>
                      <p className="text-slate-300 font-bold mt-1">Fatura: {fatura.numero_fatura || '-'}</p>
                      <p className="text-slate-500 text-sm mt-1">
                        {embarque.cliente_final || embarque.importador || '-'} • {embarque.transportadora || '-'}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 min-w-[160px]">
                      {fatura.recibo_pdf ? (
                        <a
                          href={fatura.recibo_pdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xl bg-green-600 px-4 py-3 text-center text-sm font-black text-white hover:bg-green-500"
                        >
                          Abrir recibo
                        </a>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => abrirEmissaoRecibo(embarque)}
                        className="rounded-xl bg-green-600 px-4 py-3 text-sm font-black text-white hover:bg-green-500"
                      >
                        {fatura.recibo_pdf ? 'Reemitir recibo' : 'Emitir recibo'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-5">
                    <InfoPacote label="Valor fatura" valor={moeda(valorPadraoRecibo(embarque))} destaque />
                    <InfoPacote label="Vencimento" valor={dataBR(normalizarData(fatura.vencimento) || normalizarData(vencimentoFinanceiro(financeiro)))} />
                    <InfoPacote label="Recebimento" valor={dataBR(normalizarData(recebimentoFinanceiro(financeiro)) || fatura.data_pagamento)} />
                    <InfoPacote label="Status financeiro" valor={pagamento.label} />
                  </div>
                </div>
              )
            })}
          </div>

          {faturasParaRecibo.length === 0 && (
            <div className="mt-5 rounded-2xl border border-blue-900 bg-[#020817] p-6 text-center text-slate-400">
              Nenhuma fatura emitida encontrada para gerar recibo.
            </div>
          )}
        </div>

        {renderFormularioRecibo()}
      </section>
    )
  }

  function renderAbaEmissor() {
    const embarque = emissorEmbarqueSelecionado
    const cliente = emissorClienteSelecionado
    const financeiro = embarque ? financeiroDoEmbarque(embarque) : null
    const dadosCliente = cliente ? dadosClienteFiscal(cliente) : null
    const usuarioPortal = emissorUsuarioSelecionado

    return (
      <section id="emissor_fatura" className="space-y-6">
        <div className="rounded-3xl border border-blue-900 bg-[#071225] p-6 lg:p-7">
          <div className="mb-6 flex flex-col lg:flex-row justify-between gap-5">
            <div>
              <p className="text-blue-400 font-black mb-2">Emissor de faturas</p>
              <h2 className="text-3xl font-black">Emitir fatura vinculada ao AWB</h2>
              <p className="mt-2 text-slate-400">
                Primeiro selecione o embarque e o cliente fiscal. O login do cliente é opcional: você pode emitir agora e vincular depois.
              </p>
            </div>

            <button
              type="button"
              onClick={limparEmissor}
              className="h-fit rounded-2xl bg-slate-700 px-5 py-3 font-black hover:bg-slate-600"
            >
              Limpar emissão
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="rounded-2xl border border-blue-900 bg-[#020817] p-5">
              <h3 className="text-xl font-black mb-4">1. Puxar embarque</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <input
                  value={buscaEmissorAwb}
                  onChange={(e) => setBuscaEmissorAwb(e.target.value)}
                  placeholder="Buscar por AWB, cliente, referência..."
                  className="w-full"
                />

                <select
                  value={filtroStatusEmissor}
                  onChange={(e) => setFiltroStatusEmissor(e.target.value)}
                  className="w-full"
                >
                  <option value="TODOS">Status: todos</option>
                  {statusDisponiveisEmissor.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <select
                value={emissorEmbarqueId}
                onChange={(e) => selecionarEmbarqueEmissor(e.target.value)}
                className="w-full"
              >
                <option value="">
                  {embarquesDisponiveisEmissor.length === 0 ? 'Nenhum AWB encontrado' : 'Selecione o AWB'}
                </option>
                {embarquesDisponiveisEmissor.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.awb || 'Sem AWB'} - {item.status_operacional || 'Sem status'} - {item.cliente_final || item.importador || 'Cliente não informado'}
                  </option>
                ))}
              </select>

              <p className="mt-2 text-xs text-slate-500">
                Use o campo de busca e o filtro de status para localizar o embarque. Mostrando até 120 resultados.
              </p>

              {embarque ? (
                <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
                  <InfoPacote label="AWB / HAWB" valor={embarque.awb || '-'} destaque />
                  <InfoPacote label="Cliente embarque" valor={embarque.cliente_final || embarque.importador || '-'} />
                  <InfoPacote label="Exportador" valor={embarque.exportador || '-'} />
                  <InfoPacote label="Importador" valor={embarque.importador || '-'} />
                  <InfoPacote label="Serviço" valor={embarque.servico || '-'} />
                  <InfoPacote label="Transportadora" valor={embarque.transportadora || '-'} />
                  <InfoPacote label="Origem / destino" valor={`${embarque.origem || '-'} → ${embarque.destino || '-'}`} />
                  <InfoPacote label="Valor base encontrado" valor={moedaFechada(embarque, financeiro)} destaque />
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Selecione um embarque para carregar os dados.</p>
              )}
            </div>

            <div className="rounded-2xl border border-blue-900 bg-[#020817] p-5">
              <h3 className="text-xl font-black mb-4">2. Cliente para faturamento</h3>

              <input
                value={buscaClienteEmissor}
                onChange={(e) => setBuscaClienteEmissor(e.target.value)}
                placeholder="Buscar cliente fiscal por nome, CNPJ, CPF ou código..."
                className="mb-3 w-full"
              />

              <select
                value={emissorClienteId}
                onChange={(e) => setEmissorClienteId(e.target.value)}
                className="w-full"
              >
                <option value="">
                  {clientesFaturamentoEmissor.length === 0 ? 'Nenhum cliente encontrado' : 'Selecione o cliente fiscal'}
                </option>
                {clientesFaturamentoEmissor.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.codigo_hc ? `${item.codigo_hc} - ` : ''}{item.nome_empresa} - {item.cnpj || item.cpf || 'sem documento'}
                  </option>
                ))}
              </select>

              <p className="mt-2 text-xs text-slate-500">
                {buscandoClientesEmissor
                  ? 'Buscando no banco de dados...'
                  : clientesFaturamentoEmissor.length === 0
                    ? 'Nenhum cliente encontrado. Tente buscar pelo CNPJ somente com números ou pelo nome.'
                    : 'Mostrando até 120 cadastros. A busca agora consulta também o banco de dados.'}
              </p>

              <div className="mt-4 rounded-2xl border border-blue-900 bg-[#071225] p-4">
                <label className="text-sm font-black text-slate-300">
                  Login do cliente no portal (opcional)
                  <input
                    value={buscaUsuarioEmissor}
                    onChange={(e) => setBuscaUsuarioEmissor(e.target.value)}
                    placeholder="Buscar login por nome ou e-mail..."
                    className="mt-2 mb-3 w-full"
                  />

                  <select
                    value={emissorUsuarioId}
                    onChange={(e) => setEmissorUsuarioId(e.target.value)}
                    className="w-full"
                  >
                    <option value="">Sem login vinculado no momento</option>
                    {usuariosPortalEmissor.map((usuario) => (
                      <option key={usuario.id} value={usuario.id}>
                        {(usuario.nome || usuario.email || 'Cliente sem nome')} - {usuario.email || 'sem e-mail'}
                      </option>
                    ))}
                  </select>
                </label>

                {usuarioPortal ? (
                  <p className="mt-3 text-xs text-green-300">
                    Esta fatura ficará vinculada ao login: <strong>{usuarioPortal.email || usuarioPortal.nome}</strong>
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-yellow-300">
                    Login opcional. Se o cliente ainda não fez cadastro, emita a fatura normalmente. Depois, ao vincular o login ao AWB, esta fatura aparecerá no portal se estiver visível para o cliente.
                  </p>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-emerald-900 bg-emerald-950/10 p-4">
                <label className="text-sm font-black text-emerald-200">
                  Parceiro / Despachante do repasse
                  <input
                    value={emissorDespachante}
                    onChange={(e) => setEmissorDespachante(e.target.value)}
                    placeholder="Ex.: SKYSEA"
                    className="mt-2 w-full"
                  />
                </label>

                <p className="mt-2 text-xs text-emerald-300">
                  Campo interno. Não aparece no PDF da fatura. Será salvo em Processos Faturados para identificar quem recebe o repasse/profit de terceiros.
                </p>
              </div>

              {dadosCliente ? (
                <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
                  <InfoPacote label="Cobrança para" valor={dadosCliente.nome} destaque />
                  <InfoPacote label="CNPJ / CPF" valor={dadosCliente.documento} />
                  <InfoPacote label="Endereço" valor={dadosCliente.endereco} />
                  <InfoPacote label="Cidade / Estado" valor={`${dadosCliente.cidade || '-'} / ${dadosCliente.estado || '-'}`} />
                  <InfoPacote label="CEP" valor={dadosCliente.cep} />
                  <InfoPacote label="Inscrição estadual" valor={dadosCliente.inscricao_estadual || 'ISENTO'} />
                  <InfoPacote label="Inscrição municipal" valor={dadosCliente.inscricao_municipal || '-'} />
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Selecione o cadastro fiscal que sairá na fatura.</p>
              )}
            </div>

            <div className="rounded-2xl border border-blue-900 bg-[#020817] p-5">
              <h3 className="text-xl font-black mb-4">3. Dados da fatura</h3>

              <div className="grid grid-cols-1 gap-3">
                <input
                  value={emissorNumeroFatura}
                  onChange={(e) => setEmissorNumeroFatura(e.target.value)}
                  placeholder="Número da fatura"
                />

                <label className="text-sm font-bold text-slate-300">
                  Vencimento
                  <input
                    type="date"
                    value={emissorVencimento}
                    onChange={(e) => setEmissorVencimento(e.target.value)}
                    className="mt-2 w-full"
                  />
                </label>

                <div className="rounded-2xl border border-blue-900 bg-[#071225] p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-blue-300">Base cambial da fatura</p>

                  <select
                    value={emissorTipoCambio}
                    onChange={(e) => {
                      const tipo = e.target.value
                      const valor =
                        tipo === 'PTAX_DHL_MES_ANTERIOR'
                          ? emissorPtaxDhlMesAnterior
                          : tipo === 'DOLAR_VENDA_DIA'
                            ? emissorDolarVendaDia
                            : emissorTaxaConversao

                      setEmissorTipoCambio(tipo)
                      if (valor) recalcularItensPorTaxa(valor)
                    }}
                    className="mt-3 w-full"
                  >
                    <option value="DOLAR_VENDA_DIA">Dólar fechamento venda do dia</option>
                    <option value="PTAX_DHL_MES_ANTERIOR">DHL: último PTAX do mês anterior</option>
                    <option value="MANUAL">Taxa manual</option>
                  </select>

                  <div className="mt-3 grid grid-cols-1 gap-3">
                    <label className="text-sm font-bold text-slate-300">
                      Dólar fechamento venda do dia
                      <input
                        value={emissorDolarVendaDia}
                        onChange={(e) => {
                          setEmissorDolarVendaDia(e.target.value)
                          if (emissorTipoCambio === 'DOLAR_VENDA_DIA') recalcularItensPorTaxa(e.target.value)
                        }}
                        placeholder="Ex.: 5,1743"
                        className="mt-2 w-full"
                      />
                    </label>

                    <label className="text-sm font-bold text-slate-300">
                      PTAX DHL mês anterior
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-2">
                        <input
                          type="date"
                          value={emissorDataPtaxDhlMesAnterior || sugestaoPtaxDhlMesAnterior().data}
                          onChange={(e) => setEmissorDataPtaxDhlMesAnterior(e.target.value)}
                        />
                        <input
                          value={emissorPtaxDhlMesAnterior}
                          onChange={(e) => {
                            setEmissorPtaxDhlMesAnterior(e.target.value)
                            if (emissorTipoCambio === 'PTAX_DHL_MES_ANTERIOR') recalcularItensPorTaxa(e.target.value)
                          }}
                          placeholder="Ex.: 5,0569"
                        />
                      </div>
                    </label>

                    <label className="text-sm font-bold text-slate-300">
                      Taxa base usada na fatura
                      <input
                        value={emissorTaxaConversao}
                        onChange={(e) => {
                          setEmissorTipoCambio('MANUAL')
                          recalcularItensPorTaxa(e.target.value)
                        }}
                        placeholder="Ex.: 5,0569"
                        className="mt-2 w-full"
                      />
                    </label>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => aplicarTaxaCambio('DOLAR_VENDA_DIA', emissorDolarVendaDia)}
                      className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black hover:bg-blue-500"
                    >
                      Usar dólar venda dia
                    </button>

                    <button
                      type="button"
                      onClick={() => aplicarTaxaCambio('PTAX_DHL_MES_ANTERIOR', emissorPtaxDhlMesAnterior)}
                      className="rounded-xl bg-yellow-600 px-3 py-2 text-xs font-black hover:bg-yellow-500"
                    >
                      Usar PTAX DHL mês anterior
                    </button>

                    <button
                      type="button"
                      onClick={() => carregarCambioAutomaticoEmissor(emissorTipoCambio, true)}
                      disabled={carregandoCambioEmissor}
                      className="rounded-xl bg-green-600 px-3 py-2 text-xs font-black hover:bg-green-500 disabled:opacity-60"
                    >
                      {carregandoCambioEmissor ? 'Buscando câmbio...' : 'Atualizar câmbio BCB'}
                    </button>
                  </div>

                  {emissorAvisoCambio && (
                    <p className="mt-3 rounded-xl border border-blue-900 bg-[#020817] px-3 py-2 text-xs font-bold text-blue-200">
                      {emissorAvisoCambio}
                    </p>
                  )}

                  <p className="mt-3 text-xs text-slate-400">
                    Regra DHL: usar o último PTAX do mês anterior. Ex.: faturamento em junho usa 31/05, R$ 5,0569.
                  </p>
                </div>

                <label className="text-sm font-bold text-slate-300">
                  Spread %
                  <input
                    value={emissorSpread}
                    onChange={(e) => recalcularItensPorSpread(e.target.value)}
                    placeholder="3"
                    className="mt-2 w-full"
                  />
                </label>

                <div className="rounded-2xl border border-green-900 bg-green-950/20 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">Taxa final com spread</p>
                  <p className="mt-1 text-2xl font-black text-green-300">R$ {taxaConversaoFinalFormatada()}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Base: {emissorTipoCambio === 'PTAX_DHL_MES_ANTERIOR'
                      ? `PTAX DHL ${dataBRSimples(emissorDataPtaxDhlMesAnterior || sugestaoPtaxDhlMesAnterior().data)}`
                      : emissorTipoCambio === 'DOLAR_VENDA_DIA'
                        ? 'dólar fechamento venda do dia'
                        : 'taxa manual'} + spread.
                  </p>
                </div>

                <label className="flex items-center gap-2 rounded-2xl border border-blue-900 bg-[#071225] px-4 py-3 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={emissorVisivelCliente}
                    onChange={(e) => setEmissorVisivelCliente(e.target.checked)}
                  />
                  Disponibilizar para o cliente
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-blue-900 bg-[#071225] p-5 lg:p-7">
          <div className="mb-5 flex flex-col lg:flex-row justify-between gap-4">
            <div>
              <h3 className="text-2xl font-black">4. Serviços da cobrança</h3>
              <p className="text-slate-400 text-sm">
                Marque os serviços que entram na fatura. Ao selecionar o AWB, os itens salvos no embarque são carregados automaticamente; o total vai para Processos Faturados.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="rounded-2xl border border-blue-900 bg-[#020817] p-4">
                <p className="text-xs text-slate-500 font-black">TOTAL USD</p>
                <p className="text-2xl font-black text-blue-300">{formatarValorSimples(totaisEmissor.totalUSD)}</p>
              </div>
              <div className="rounded-2xl border border-green-900 bg-green-950/20 p-4">
                <p className="text-xs text-slate-500 font-black">TOTAL R$</p>
                <p className="text-2xl font-black text-green-300">{moeda(totaisEmissor.totalBRL)}</p>
              </div>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm [&_th]:border-b [&_th]:border-blue-900 [&_th]:px-3 [&_th]:py-3 [&_th]:text-left [&_th]:font-black [&_th]:text-slate-300 [&_td]:border-b [&_td]:border-blue-900/50 [&_td]:px-3 [&_td]:py-3">
              <thead>
                <tr>
                  <th className="w-[80px]">Usar</th>
                  <th>Serviço</th>
                  <th className="w-[160px]">Valor USD</th>
                  <th className="w-[180px]">Valor R$</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {itensFatura.map((item) => (
                  <tr key={item.id} className={item.selecionado ? 'bg-blue-600/10' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={item.selecionado}
                        onChange={(e) => atualizarItemFatura(item.id, 'selecionado', e.target.checked)}
                      />
                    </td>
                    <td className="font-black text-slate-200">{item.descricao}</td>
                    <td>
                      <input
                        value={item.valor_usd}
                        onChange={(e) => atualizarItemFatura(item.id, 'valor_usd', e.target.value)}
                        placeholder="0,00"
                        className="w-full"
                      />
                    </td>
                    <td>
                      <input
                        value={item.valor_brl}
                        onChange={(e) => atualizarItemFatura(item.id, 'valor_brl', e.target.value)}
                        placeholder="0,00"
                        className="w-full"
                      />
                    </td>
                    <td>
                      <input
                        value={item.observacao}
                        onChange={(e) => atualizarItemFatura(item.id, 'observacao', e.target.value)}
                        placeholder="Opcional"
                        className="w-full"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-blue-900 bg-[#071225] p-6 lg:p-7">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <h3 className="text-2xl font-black mb-3">5. Observações e emissão</h3>
              <textarea
                value={emissorObservacoes}
                onChange={(e) => setEmissorObservacoes(e.target.value)}
                placeholder="Observações internas ou detalhes que devem constar no histórico da fatura"
                className="min-h-[110px] w-full"
              />

              <div className="mt-4 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-yellow-100">
                Ao emitir, o sistema salva o PDF em Faturas clientes, vincula ao AWB e lança o total em Financeiro &gt; Processos Faturados. O login do cliente é opcional; se ainda não existir, vincule depois para a fatura aparecer no portal.
              </div>
            </div>

            <div className="rounded-2xl border border-green-900 bg-green-950/20 p-5">
              <p className="text-slate-400 text-sm font-black">Resumo final</p>
              <h3 className="mt-2 text-4xl font-black text-green-300">{moeda(totaisEmissor.totalBRL)}</h3>
              <p className="mt-2 text-sm text-slate-400">{valorPorExtensoBRL(totaisEmissor.totalBRL)}</p>

              <button
                type="button"
                onClick={gerarPdfFaturaHC}
                disabled={salvandoEmissao}
                className="mt-5 w-full rounded-2xl bg-blue-600 px-5 py-4 font-black hover:bg-blue-500 disabled:opacity-60"
              >
                {salvandoEmissao ? 'Gerando e salvando...' : 'Gerar PDF e lançar fatura'}
              </button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <main className="w-full max-w-none p-6 lg:p-8 text-white">
      <div className="mb-8 flex flex-col lg:flex-row justify-between gap-6">
        <div>
          <p className="text-blue-400 font-bold mb-2">Documentos do cliente</p>
          <h1 className="text-5xl font-black mb-2">Faturas</h1>
          <p className="text-slate-400 text-lg">
            Anexe faturas e recibos em PDF. Para faturar, consulte o valor fechado, cotação, documentos do embarque e status financeiro.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 h-fit">
          <button
            onClick={() => setAbaAtiva('EMISSOR')}
            className="bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold"
          >
            Emitir nova fatura
          </button>

          <button
            onClick={() => setAbaAtiva('RECIBO')}
            className="bg-green-600 hover:bg-green-500 px-6 py-4 rounded-2xl font-bold"
          >
            Emitir recibo
          </button>
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-3 rounded-3xl border border-blue-900 bg-[#071225] p-3">
        <button
          type="button"
          onClick={() => setAbaAtiva('FATURAS')}
          className={
            abaAtiva === 'FATURAS'
              ? 'rounded-2xl bg-blue-600 px-5 py-3 font-black text-white shadow-[0_0_25px_rgba(37,99,235,0.25)]'
              : 'rounded-2xl bg-[#020817] px-5 py-3 font-black text-slate-300 hover:bg-blue-600/20 hover:text-white'
          }
        >
          🧾 Faturas clientes
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('EMISSOR')}
          className={
            abaAtiva === 'EMISSOR'
              ? 'rounded-2xl bg-blue-600 px-5 py-3 font-black text-white shadow-[0_0_25px_rgba(37,99,235,0.25)]'
              : 'rounded-2xl bg-[#020817] px-5 py-3 font-black text-slate-300 hover:bg-blue-600/20 hover:text-white'
          }
        >
          🧮 Emitir nova fatura
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('RECIBO')}
          className={
            abaAtiva === 'RECIBO'
              ? 'rounded-2xl bg-green-600 px-5 py-3 font-black text-white shadow-[0_0_25px_rgba(22,163,74,0.25)]'
              : 'rounded-2xl bg-[#020817] px-5 py-3 font-black text-slate-300 hover:bg-green-600/20 hover:text-white'
          }
        >
          ✅ Emitir recibo
        </button>
      </div>

      {abaAtiva === 'EMISSOR' ? (
        renderAbaEmissor()
      ) : abaAtiva === 'RECIBO' ? (
        renderAbaRecibos()
      ) : (
        <>
      <section className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-8">
        <Card
          titulo="Com fatura"
          valor={totalComFatura}
          detalhe="PDF anexado"
          icone="🧾"
          ativo={filtroDocumento === 'COM_FATURA' && filtroArquivamento === 'ATIVAS'}
          onClick={() => aplicarFiltroRapido({ documento: 'COM_FATURA', arquivamento: 'ATIVAS' })}
        />

        <Card
          titulo="Sem fatura"
          valor={totalSemFatura}
          detalhe="Pendente de anexo"
          icone="📄"
          ativo={filtroDocumento === 'SEM_FATURA' && filtroArquivamento === 'ATIVAS'}
          onClick={() => aplicarFiltroRapido({ documento: 'SEM_FATURA', arquivamento: 'ATIVAS' })}
        />

        <Card
          titulo="Visíveis"
          valor={totalVisiveis}
          detalhe="Cliente pode acessar"
          icone="👁️"
          ativo={filtroDocumento === 'VISIVEL' && filtroArquivamento === 'ATIVAS'}
          onClick={() => aplicarFiltroRapido({ documento: 'VISIVEL', arquivamento: 'ATIVAS' })}
        />

        <Card
          titulo="Com recibo"
          valor={totalRecibos}
          detalhe="Recibo anexado"
          icone="✅"
          ativo={filtroDocumento === 'COM_RECIBO' && filtroArquivamento === 'ATIVAS'}
          onClick={() => aplicarFiltroRapido({ documento: 'COM_RECIBO', arquivamento: 'ATIVAS' })}
        />

        <Card
          titulo="Arquivadas"
          valor={totalFaturasArquivadas}
          detalhe="Ocultas do admin"
          icone="🗄️"
          ativo={filtroArquivamento === 'ARQUIVADAS'}
          onClick={() => aplicarFiltroRapido({ arquivamento: 'ARQUIVADAS' })}
        />
      </section>

      {embarqueSelecionado && (
        <section id="form_fatura" className="border border-blue-900 rounded-3xl bg-[#071225] p-7 mb-8">
          <div className="flex flex-col lg:flex-row justify-between gap-5 mb-7">
            <div>
              <p className="text-blue-400 font-bold mb-2">
                {faturaDoEmbarque(embarqueSelecionado.id) ? 'Editar fatura' : 'Anexar fatura'}
              </p>
              <h2 className="text-2xl font-black">AWB {embarqueSelecionado.awb}</h2>
              <p className="text-slate-400 text-sm">
                {embarqueSelecionado.cliente_final || embarqueSelecionado.importador || 'Cliente não informado'} • {embarqueSelecionado.transportadora || '-'}
              </p>
            </div>

            <button
              onClick={limparFormulario}
              className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-2xl font-bold h-fit"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <input
              value={numeroFatura}
              onChange={(e) => setNumeroFatura(e.target.value)}
              placeholder="Número da fatura"
            />

            <input
              id="pdf_fatura"
              type="file"
              accept="application/pdf"
              onChange={(e) => setArquivoPdf(e.target.files?.[0] || null)}
              className="cursor-pointer"
            />

            <label className="flex items-center gap-2 bg-[#020817] border border-blue-900 rounded-2xl px-4">
              <input
                type="checkbox"
                checked={visivelCliente}
                onChange={(e) => setVisivelCliente(e.target.checked)}
              />
              Visível para cliente
            </label>

            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações internas"
              className="md:col-span-3 min-h-[90px]"
            />

            <div className="md:col-span-3 border border-yellow-500/40 bg-yellow-500/10 rounded-2xl p-4 text-yellow-200 text-sm">
              Vencimento e pagamento não são editados aqui. Atualize essas informações em Financeiro &gt; Processos Faturados.
            </div>

            <button
              onClick={salvarFatura}
              disabled={salvando}
              className="md:col-span-3 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold disabled:opacity-60 py-4"
            >
              {salvando ? 'Salvando...' : 'Salvar fatura'}
            </button>
          </div>
        </section>
      )}


      {renderFormularioRecibo()}

      <section id="tabela_faturas" className="w-full border border-blue-900 rounded-3xl bg-[#071225] p-5 lg:p-7">
        <div className="flex flex-col lg:flex-row justify-between gap-5 mb-7">
          <div>
            <h2 className="text-2xl font-black">Faturas por embarque</h2>
            <p className="text-slate-400 text-sm">
              Esta tela mostra o pacote do embarque para faturamento e usa a mesma base de Financeiro &gt; Processos Faturados.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3 w-full lg:max-w-[1380px]">
            <select value={filtroDocumento} onChange={(e) => setFiltroDocumento(e.target.value)}>
              <option value="TODOS">Documentos: todos</option>
              <option value="COM_FATURA">Com fatura</option>
              <option value="SEM_FATURA">Sem fatura</option>
              <option value="COM_RECIBO">Com recibo</option>
              <option value="SEM_RECIBO">Com fatura sem recibo</option>
              <option value="COM_COMPROVANTE">Com comprovante</option>
              <option value="SEM_COMPROVANTE">Sem comprovante</option>
              <option value="VISIVEL">Visível para cliente</option>
              <option value="OCULTO">Oculto do cliente</option>
            </select>

            <select
              value={filtroStatusEmbarque}
              onChange={(e) => setFiltroStatusEmbarque(e.target.value)}
            >
              <option value="TODOS">Status embarque: todos</option>
              {statusDisponiveis.map((status) => (
                <option key={status} value={status || ''}>
                  {status}
                </option>
              ))}
            </select>

            <select value={filtroPagamento} onChange={(e) => setFiltroPagamento(e.target.value)}>
              <option value="TODOS">Pagamento: todos</option>
              <option value="PAGO">Pago no financeiro</option>
              <option value="ATRASADO">Vencido no financeiro</option>
              <option value="EM_ABERTO">Em aberto no financeiro</option>
              <option value="SEM_FINANCEIRO">Não lançado no financeiro</option>
              <option value="SEM_FATURA">Sem fatura</option>
            </select>

            <select value={filtroArquivamento} onChange={(e) => setFiltroArquivamento(e.target.value)}>
              <option value="ATIVAS">Arquivamento: ativas</option>
              <option value="ARQUIVADAS">Arquivamento: arquivadas</option>
              <option value="TODAS">Arquivamento: todas</option>
            </select>

            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por AWB, cliente, fatura..."
              className="w-full xl:col-span-2"
            />

            <button
              type="button"
              onClick={limparFiltros}
              className="bg-slate-700 hover:bg-slate-600 px-4 py-3 rounded-xl font-bold"
            >
              Limpar filtros
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <ResumoFiltro titulo="Filtrados" valor={embarquesFiltrados.length} detalhe="embarques na tela" />
          <ResumoFiltro titulo="Pagos" valor={totalPagos} detalhe="recebimento no financeiro" />
          <ResumoFiltro titulo="Vencidos" valor={totalAtrasados} detalhe="vencimento passou" />
          <ResumoFiltro titulo="Em aberto" valor={totalEmAberto} detalhe="sem recebimento" />
          <ResumoFiltro titulo="Sem financeiro" valor={totalSemFinanceiro} detalhe="AWB não lançado" />
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[1900px] border-collapse text-xs lg:text-sm [&_th]:border-b [&_th]:border-blue-900 [&_th]:px-3 [&_th]:py-3 [&_th]:text-left [&_th]:font-black [&_th]:text-slate-300 [&_td]:px-3 [&_td]:py-4 [&_td]:align-middle">
            <thead>
              <tr>
                <th>AWB</th>
                <th>Cliente</th>
                <th>Serviço</th>
                <th>Status</th>
                <th>Valor fechado</th>
                <th>Cotação / Docs</th>
                <th>Nº Fatura</th>
                <th>Vencimento</th>
                <th>Visível</th>
                <th>Fatura</th>
                <th>Recibo</th>
                <th>Comprovante</th>
                <th>Pagamento</th>
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              {embarquesFiltrados.map((embarque) => {
                const fatura = faturaDoEmbarque(embarque.id)
                const financeiro = financeiroDoEmbarque(embarque)
                const pagamento = statusPagamentoFinanceiro(financeiro)
                const comprovante = statusComprovanteFatura(fatura)
                const documentos = documentosDoEmbarque(embarque.id)
                const cotacoes = cotacoesDoEmbarque(embarque.id)
                const pacoteAberto = pacoteAbertoId === embarque.id

                return (
                  <Fragment key={embarque.id}>
                    <tr className="border-b border-blue-900/60 hover:bg-[#0b1730] transition">
                      <td className="font-black text-blue-400 whitespace-nowrap">{embarque.awb || '-'}</td>
                      <td>
                        <strong>{embarque.cliente_final || embarque.importador || '-'}</strong>
                        <p className="text-slate-500 text-xs mt-1">{embarque.transportadora || '-'}</p>
                      </td>
                      <td>
                        <strong>{embarque.servico || '-'}</strong>
                        <p className="text-slate-500 text-xs mt-1">
                          {embarque.origem || '-'} → {embarque.destino || '-'}
                        </p>
                      </td>
                      <td>
                        <StatusBadge status={embarque.status_operacional || '-'} />
                      </td>
                      <td>
                        <strong className="text-green-400">{moedaFechada(embarque, financeiro)}</strong>
                        <p className="text-slate-500 text-xs mt-1">
                          {embarque.moeda_cobranca || embarque.moeda || 'BRL'}
                          {embarque.taxa_conversao ? ` • tx ${embarque.taxa_conversao}` : ''}
                          {embarque.spread ? ` • spread ${embarque.spread}%` : ''}
                        </p>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <span className={cotacoes.length > 0 ? 'text-green-400 font-black' : 'text-yellow-400 font-black'}>
                            {cotacoes.length > 0 ? `${cotacoes.length} cotação(ões)` : 'Sem cotação'}
                          </span>
                          <span className="text-slate-400 text-xs">{documentos.length} documento(s)</span>
                        </div>
                      </td>
                      <td>
                        <strong>{fatura?.numero_fatura || '-'}</strong>
                        {fatura?.arquivado_admin && (
                          <p className="mt-1 inline-flex rounded-full border border-slate-500 bg-slate-600/20 px-2 py-1 text-[10px] font-black text-slate-300">
                            🗄️ Arquivada
                          </p>
                        )}
                      </td>
                      <td>{dataBR(normalizarData(vencimentoFinanceiro(financeiro)))}</td>
                      <td>{fatura?.visivel_cliente ? 'Sim' : 'Não'}</td>
                      <td>
                        {fatura?.arquivo_pdf ? (
                          <div className="flex flex-col gap-2">
                            <Link href={fatura.arquivo_pdf} target="_blank" className="inline-block rounded-lg bg-blue-600 px-3 py-2 text-center text-xs font-black text-white hover:bg-blue-500">
                              Abrir
                            </Link>

                            <label className="inline-block cursor-pointer rounded-lg bg-purple-600 px-3 py-2 text-center text-xs font-black text-white hover:bg-purple-500">
                              {enviandoArquivoExtra === `${fatura.id}-FATURA_EXTRA` ? 'Enviando...' : 'Anexar PDF'}
                              <input
                                type="file"
                                accept="application/pdf"
                                disabled={!!enviandoArquivoExtra}
                                onChange={(e) => anexarArquivoExtraFatura(fatura, 'FATURA_EXTRA', e.target.files?.[0] || null)}
                                className="hidden"
                              />
                            </label>

                            {arquivosDaFatura(fatura.id).length > 0 ? (
                              <span className="rounded-lg border border-purple-500/50 bg-purple-600/10 px-2 py-1 text-center text-[10px] font-black text-purple-200">
                                + {arquivosDaFatura(fatura.id).length} arquivo(s)
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => abrirEmissaoFaturaDireta(embarque)}
                              className="inline-flex rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-500"
                            >
                              Emitir fatura
                            </button>

                            <button
                              type="button"
                              onClick={() => abrirFormulario(embarque)}
                              className="inline-flex rounded-lg bg-purple-600 px-3 py-2 text-xs font-black text-white hover:bg-purple-500"
                            >
                              Anexar PDF pronto
                            </button>
                          </div>
                        )}
                      </td>
                      <td>
                        {fatura?.recibo_pdf ? (
                          <div className="flex flex-col gap-2">
                            <Link href={fatura.recibo_pdf} target="_blank" className="inline-block rounded-lg bg-green-600 px-3 py-2 text-center text-xs font-black text-white hover:bg-green-500">
                              Abrir
                            </Link>
                            <button
                              type="button"
                              onClick={() => abrirEmissaoRecibo(embarque)}
                              className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-black text-white hover:bg-slate-600"
                            >
                              Reemitir
                            </button>
                          </div>
                        ) : fatura?.arquivo_pdf ? (
                          <button
                            type="button"
                            onClick={() => abrirEmissaoRecibo(embarque)}
                            className="inline-flex rounded-lg bg-green-600 px-3 py-2 text-xs font-black text-white hover:bg-green-500"
                          >
                            Emitir
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => abrirEmissaoFaturaDireta(embarque)}
                            className="inline-flex rounded-lg bg-slate-700 px-3 py-2 text-xs font-black text-white hover:bg-slate-600"
                            title="Para emitir recibo, primeiro é necessário emitir a fatura deste AWB."
                          >
                            Emitir fatura
                          </button>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-col gap-2">
                          <span className={`inline-flex flex-col rounded-xl border px-2 py-1 text-[11px] font-black ${comprovante.classe}`}>
                            <span>{comprovante.label}</span>
                            <span className="opacity-80 font-bold">{comprovante.detalhe}</span>
                          </span>

                          {fatura?.comprovante_pagamento && (
                            <Link
                              href={fatura.comprovante_pagamento}
                              target="_blank"
                              className="inline-block rounded-lg bg-purple-600 px-3 py-2 text-center text-xs font-black text-white hover:bg-purple-500"
                            >
                              Abrir comprovante
                            </Link>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col gap-2">
                          <span className={`inline-flex flex-col rounded-xl border px-2 py-1 text-[11px] font-black ${pagamento.classe}`}>
                            <span>{pagamento.label}</span>
                            {financeiro ? (
                              <span className="opacity-80 font-bold">{pagamento.detalhe}</span>
                            ) : null}
                          </span>

                          {faturamentoEstaFinalizado(fatura, financeiro) ? (
                            <span className="inline-flex rounded-xl border border-green-500 bg-green-600/20 px-2 py-1 text-[10px] font-black text-green-300">
                              Faturamento finalizado
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <button
                            onClick={() => setPacoteAbertoId(pacoteAberto ? null : embarque.id)}
                            className="bg-purple-600 hover:bg-purple-500 px-3 py-2 rounded-lg text-xs font-black"
                          >
                            {pacoteAberto ? 'Fechar' : 'Pacote'}
                          </button>

                          <Link
                            href={`/admin/embarques/${embarque.id}`}
                            className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-xs font-black"
                          >
                            Ver embarque
                          </Link>

                          <button
                            onClick={() => (fatura ? abrirFormulario(embarque) : abrirEmissaoFaturaDireta(embarque))}
                            className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg text-xs font-black"
                          >
                            {fatura ? 'Editar' : 'Emitir fatura'}
                          </button>

                          {!fatura && (
                            <button
                              type="button"
                              onClick={() => abrirFormulario(embarque)}
                              className="bg-purple-600 hover:bg-purple-500 px-3 py-2 rounded-lg text-xs font-black"
                            >
                              Anexar PDF pronto
                            </button>
                          )}

                          {fatura?.arquivo_pdf && (
                            <button
                              type="button"
                              onClick={() => abrirEmissaoRecibo(embarque)}
                              className="bg-green-600 hover:bg-green-500 px-3 py-2 rounded-lg text-xs font-black"
                            >
                              {fatura?.recibo_pdf ? 'Reemitir recibo' : 'Emitir recibo'}
                            </button>
                          )}

                          {faturamentoEstaFinalizado(fatura, financeiro) && !fatura?.arquivado_admin && (
                            <button
                              type="button"
                              onClick={() => finalizarFaturamentoDaTabela(embarque, fatura, financeiro)}
                              className="bg-emerald-700 hover:bg-emerald-600 px-3 py-2 rounded-lg text-xs font-black"
                            >
                              Finalizar
                            </button>
                          )}

                          {fatura && (
                            <button onClick={() => alternarVisibilidade(fatura)} className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-xs font-black">
                              {fatura.visivel_cliente ? 'Ocultar' : 'Mostrar'}
                            </button>
                          )}

                          {fatura && (
                            <button
                              onClick={() => alternarArquivamentoFatura(fatura, !fatura.arquivado_admin)}
                              className={
                                fatura.arquivado_admin
                                  ? 'bg-green-700 hover:bg-green-600 px-3 py-2 rounded-lg text-xs font-black'
                                  : 'bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-xs font-black'
                              }
                            >
                              {fatura.arquivado_admin ? 'Restaurar' : 'Arquivar'}
                            </button>
                          )}

                          {fatura?.arquivo_pdf && (
                            <button
                              onClick={() => removerFatura(embarque)}
                              disabled={removendoFatura === embarque.id}
                              className="bg-red-600 hover:bg-red-500 px-3 py-2 rounded-lg text-xs font-black disabled:opacity-60"
                            >
                              {removendoFatura === embarque.id ? 'Removendo...' : 'Remover'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {pacoteAberto && (
                      <tr className="border-b border-blue-900/80 bg-[#020817]">
                        <td colSpan={14} className="p-5">
                          <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
                            <div className="rounded-2xl border border-blue-900 bg-[#071225] p-5">
                              <h3 className="text-xl font-black mb-4 text-blue-300">Dados para faturar</h3>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <InfoPacote label="Cliente" valor={embarque.cliente_final || embarque.importador || '-'} />
                                <InfoPacote label="Exportador" valor={embarque.exportador || '-'} />
                                <InfoPacote label="Importador" valor={embarque.importador || '-'} />
                                <InfoPacote label="Referência cliente" valor={embarque.referencia_cliente || '-'} />
                                <InfoPacote label="Referência HC" valor={embarque.referencia_hc || '-'} />
                                <InfoPacote label="Transportadora" valor={embarque.transportadora || '-'} />
                                <InfoPacote label="Serviço" valor={embarque.servico || '-'} />
                                <InfoPacote label="Peso taxado" valor={embarque.peso_taxado ? `${embarque.peso_taxado} kg` : '-'} />
                              </div>
                            </div>

                            <div className="rounded-2xl border border-green-900 bg-green-950/10 p-5">
                              <h3 className="text-xl font-black mb-4 text-green-300">Valor fechado / financeiro</h3>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <InfoPacote label="Valor fechado" valor={moedaFechada(embarque, financeiro)} destaque />
                                <InfoPacote label="Moeda" valor={embarque.moeda_cobranca || embarque.moeda || 'BRL'} />
                                <InfoPacote label="Taxa conversão" valor={embarque.taxa_conversao || '-'} />
                                <InfoPacote label="Spread" valor={embarque.spread ? `${embarque.spread}%` : '-'} />
                                <InfoPacote label="Vencimento financeiro" valor={dataBR(normalizarData(vencimentoFinanceiro(financeiro)))} />
                                <InfoPacote label="Recebimento" valor={dataBR(normalizarData(recebimentoFinanceiro(financeiro)))} />
                                <InfoPacote
                                  label="Ligação financeira"
                                  valor={financeiro ? 'Encontrado em Processos Faturados' : `Não encontrado para AWB ${embarque.awb || '-'}`}
                                />
                              </div>
                            </div>

                            <div className="rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-5">
                              <h3 className="text-xl font-black mb-4 text-yellow-300">Comprovante do cliente</h3>

                              {fatura?.comprovante_pagamento ? (
                                <div className="space-y-3 text-sm">
                                  <InfoPacote label="Status" valor={fatura.status_pagamento || 'COMPROVANTE ENVIADO'} destaque />
                                  <InfoPacote label="Enviado em" valor={dataBR(fatura.data_comprovante)} />
                                  <InfoPacote label="Observação HC" valor={fatura.observacao_pagamento || '-'} />

                                  <Link
                                    href={fatura.comprovante_pagamento}
                                    target="_blank"
                                    className="block rounded-xl bg-purple-600 px-4 py-3 text-center text-sm font-black text-white hover:bg-purple-500"
                                  >
                                    Abrir comprovante anexado
                                  </Link>
                                </div>
                              ) : (
                                <p className="text-slate-500">Nenhum comprovante enviado pelo cliente para esta fatura.</p>
                              )}
                            </div>

                            <div className="rounded-2xl border border-purple-900 bg-purple-950/10 p-5">
                              <h3 className="text-xl font-black mb-4 text-purple-300">Cotação e documentos</h3>

                              {documentos.length === 0 ? (
                                <p className="text-slate-500">Nenhum documento anexado neste embarque.</p>
                              ) : (
                                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                                  {documentos.map((doc) => {
                                    const url = urlDocumento(doc)
                                    const ehCotacao = documentoEhCotacao(doc)

                                    return url ? (
                                      <Link
                                        key={doc.id}
                                        href={url}
                                        target="_blank"
                                        className={
                                          ehCotacao
                                            ? 'block rounded-xl border border-green-700 bg-green-950/20 p-3 hover:bg-green-950/40'
                                            : 'block rounded-xl border border-blue-900 bg-[#020817] p-3 hover:bg-blue-950/30'
                                        }
                                      >
                                        <p className={ehCotacao ? 'font-black text-green-300' : 'font-black text-blue-300'}>
                                          {ehCotacao ? '💰 Cotação - ' : '📎 '}
                                          {nomeDocumento(doc)}
                                        </p>
                                        <p className="text-slate-500 text-xs mt-1">{dataBR(doc.criado_em)}</p>
                                      </Link>
                                    ) : (
                                      <div key={doc.id} className="rounded-xl border border-blue-900 bg-[#020817] p-3">
                                        <p className="font-black text-slate-300">📎 {nomeDocumento(doc)}</p>
                                        <p className="text-slate-500 text-xs mt-1">Documento sem URL pública</p>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

                          {fatura ? (
                            <div className="mt-5 rounded-2xl border border-purple-900 bg-purple-950/10 p-5">
                              <div className="mb-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                <div>
                                  <h3 className="text-xl font-black text-purple-300">Arquivos adicionais para o cliente</h3>
                                  <p className="text-sm text-slate-400">
                                    Use para anexar boleto, PDF de faturamento pronto, fatura complementar ou outros documentos relacionados a esta cobrança.
                                  </p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  {['BOLETO', 'FATURA_EXTRA', 'FATURA_COMPLEMENTAR', 'OUTRO'].map((tipo) => (
                                    <label key={tipo} className="cursor-pointer rounded-xl bg-purple-600 px-4 py-3 text-xs font-black text-white hover:bg-purple-500">
                                      {enviandoArquivoExtra === `${fatura.id}-${tipo}` ? 'Enviando...' : `Anexar ${labelTipoArquivoFatura(tipo)}`}
                                      <input
                                        type="file"
                                        accept="application/pdf,image/png,image/jpeg"
                                        disabled={!!enviandoArquivoExtra}
                                        onChange={(e) => anexarArquivoExtraFatura(fatura, tipo, e.target.files?.[0] || null)}
                                        className="hidden"
                                      />
                                    </label>
                                  ))}
                                </div>
                              </div>

                              {arquivosDaFatura(fatura.id).length === 0 ? (
                                <p className="text-sm text-slate-500">Nenhum arquivo adicional anexado.</p>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                  {arquivosDaFatura(fatura.id).map((arquivo) => (
                                    <div key={arquivo.id} className="rounded-xl border border-purple-900 bg-[#020817] p-4">
                                      <p className="text-xs font-black uppercase tracking-wide text-purple-300">{labelTipoArquivoFatura(arquivo.tipo)}</p>
                                      <p className="mt-1 truncate text-sm font-bold text-slate-200">{arquivo.nome || 'Arquivo'}</p>
                                      <p className="mt-1 text-xs text-slate-500">{dataBR(arquivo.criado_em)}</p>
                                      <div className="mt-3 flex gap-2">
                                        <Link href={arquivo.url} target="_blank" className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-500">
                                          Abrir
                                        </Link>
                                        <button
                                          type="button"
                                          onClick={() => removerArquivoExtraFatura(arquivo)}
                                          disabled={removendoArquivoExtra === arquivo.id}
                                          className="rounded-lg bg-red-600 px-3 py-2 text-xs font-black text-white hover:bg-red-500 disabled:opacity-60"
                                        >
                                          {removendoArquivoExtra === arquivo.id ? 'Removendo...' : 'Remover'}
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>

          {embarquesFiltrados.length === 0 && (
            <div className="border border-blue-900 bg-[#020817] rounded-2xl p-6 text-center text-slate-400 mt-6">
              Nenhum embarque encontrado.
            </div>
          )}
        </div>
      </section>
        </>
      )}
    </main>
  )
}

function itensPadraoFatura(): ItemFaturaServico[] {
  return [
    { id: 'contas', descricao: 'CONTAS', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'area_remota', descricao: 'ÁREA REMOTA', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'manuseio_formal', descricao: 'MANUSEIO FORMAL', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'delivery_fee_doc', descricao: 'DELIVERY FEE DOC', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'desconto', descricao: 'DESCONTO', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'dgr', descricao: 'DGR', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'tarifa_carga_nao_empilhavel', descricao: 'TARIFA ADICIONAL P/ CARGA NÃO EMPILHÁVEL', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'dta', descricao: 'DTA', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'outras_taxas', descricao: 'OUTRAS TAXAS', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'due_dre', descricao: 'DUE / DRE', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'frete', descricao: 'FRETE', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'frete_fedex', descricao: 'FRETE FEDEX', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'handling', descricao: 'HANDLING', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'impostos', descricao: 'IMPOSTOS', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'impostos_brl', descricao: 'IMPOSTOS R$', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'divergencia_peso', descricao: 'DIVERGÊNCIA DE PESO', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'oversize_piece', descricao: 'OVERSIZE PIECE', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'seguro', descricao: 'SEGURO', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'taxa_alta_demanda', descricao: 'TAXA DE ALTA DEMANDA', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'entrega_fora_area', descricao: 'ENTREGA FORA DA ÁREA', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
    { id: 'coberta_nivel_b', descricao: 'COBERTA NÍVEL B', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
  ]
}

function dadosClienteFiscal(cliente: ClienteFaturamento) {
  return {
    id: cliente.id,
    codigo_hc: cliente.codigo_hc || null,
    nome: cliente.nome_empresa || '',
    contato: cliente.nome_contato || cliente.contato || null,
    documento: cliente.cnpj || cliente.cpf || '',
    endereco: cliente.endereco || '',
    cidade: cliente.cidade || '',
    estado: cliente.estado || '',
    cep: cliente.cep || '',
    email: cliente.email || null,
    inscricao_estadual: cliente.inscricao_estadual || null,
    inscricao_municipal: cliente.inscricao_municipal || null,
  }
}

function formatarNumeroInput(valor: number) {
  if (!Number.isFinite(valor)) return ''
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatarValorSimples(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function valorPorExtensoBRL(valorOriginal: number) {
  const valor = Math.max(0, Math.round(Number(valorOriginal || 0) * 100) / 100)
  const reais = Math.floor(valor)
  const centavos = Math.round((valor - reais) * 100)

  const partes: string[] = []

  if (reais === 0) {
    partes.push('zero real')
  } else {
    partes.push(`${numeroPorExtenso(reais)} ${reais === 1 ? 'real' : 'reais'}`)
  }

  if (centavos > 0) {
    partes.push(`${numeroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`)
  }

  return partes.join(' e ')
}

function numeroPorExtenso(numero: number): string {
  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
  const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

  function ate999(n: number): string {
    if (n === 0) return ''
    if (n === 100) return 'cem'

    const c = Math.floor(n / 100)
    const d = Math.floor((n % 100) / 10)
    const u = n % 10
    const partes: string[] = []

    if (c > 0) partes.push(centenas[c])

    const resto = n % 100
    if (resto >= 10 && resto <= 19) {
      partes.push(especiais[resto - 10])
    } else {
      if (d > 1) partes.push(dezenas[d])
      if (u > 0) partes.push(unidades[u])
    }

    return partes.filter(Boolean).join(' e ')
  }

  if (numero === 0) return 'zero'
  if (numero < 1000) return ate999(numero)

  const milhoes = Math.floor(numero / 1000000)
  const milhares = Math.floor((numero % 1000000) / 1000)
  const resto = numero % 1000
  const partes: string[] = []

  if (milhoes > 0) {
    partes.push(`${numeroPorExtenso(milhoes)} ${milhoes === 1 ? 'milhão' : 'milhões'}`)
  }

  if (milhares > 0) {
    if (milhares === 1) partes.push('mil')
    else partes.push(`${ate999(milhares)} mil`)
  }

  if (resto > 0) {
    partes.push(ate999(resto))
  }

  return partes.join(resto > 0 && (resto < 100 || numero < 100000) ? ' e ' : ', ')
}

function ResumoFiltro({ titulo, valor, detalhe }: any) {
  return (
    <div className="rounded-2xl border border-blue-900 bg-[#020817] p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{titulo}</p>
      <p className="mt-2 text-2xl font-black text-white">{valor}</p>
      <p className="mt-1 text-xs text-slate-500">{detalhe}</p>
    </div>
  )
}

function InfoPacote({ label, valor, destaque = false }: any) {
  return (
    <div className="rounded-xl border border-blue-900 bg-[#020817] p-3">
      <p className="text-slate-500 text-xs mb-1">{label}</p>
      <p className={destaque ? 'font-black text-green-400 break-words' : 'font-bold text-slate-200 break-words'}>
        {valor || '-'}
      </p>
    </div>
  )
}

function Card({ titulo, valor, detalhe, icone, ativo = false, onClick }: any) {
  const classe = ativo
    ? 'border-blue-400 bg-blue-600/25 ring-2 ring-blue-500 shadow-[0_0_25px_rgba(37,99,235,0.25)]'
    : 'border-blue-900 bg-[#071225] hover:border-blue-400 hover:bg-blue-600/10'

  const conteudo = (
    <div className="flex justify-between items-start gap-4">
      <div>
        <p className={ativo ? 'text-white font-black' : 'text-slate-300 font-bold'}>{titulo}</p>
        <h2 className="text-5xl font-black mt-4 text-white">{valor}</h2>
        <p className={ativo ? 'text-blue-100 mt-2' : 'text-slate-400 mt-2'}>{detalhe}</p>
      </div>

      <div className="text-4xl">{icone}</div>
    </div>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`text-left w-full border rounded-3xl p-6 transition cursor-pointer ${classe}`}
      >
        {conteudo}
      </button>
    )
  }

  return <div className={`border rounded-3xl p-6 ${classe}`}>{conteudo}</div>
}
