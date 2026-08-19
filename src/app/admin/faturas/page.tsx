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
  data_envio?: string | null
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
  cliente_faturamento_id?: string | null
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
  tipo_fatura?: string | null
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

type AbaFaturasAdmin = 'FATURAS' | 'EMISSOR' | 'AGENTE_CARGA' | 'RECIBO'

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

type MoedaFaturaAgente = 'BRL' | 'USD' | 'EUR'

type ItemFaturaAgente = {
  id: string
  descricao: string
  moeda: MoedaFaturaAgente
  valor_original: string
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
  const [reciboComplementarSelecionado, setReciboComplementarSelecionado] =
    useState<any | null>(null)

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
  const [emissorTipoFatura, setEmissorTipoFatura] = useState<'FRETE' | 'IMPOSTOS'>('FRETE')
  const [emissorNumeroFatura, setEmissorNumeroFatura] = useState('')
  const [emissorVencimento, setEmissorVencimento] = useState('')
  const [emissorDataEmbarque, setEmissorDataEmbarque] = useState('')
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

  const [agenteProcesso, setAgenteProcesso] = useState('')
  const [agenteClienteId, setAgenteClienteId] = useState('')
  const [agenteUsuarioIds, setAgenteUsuarioIds] = useState<string[]>([])
  const [agenteNumeroFatura, setAgenteNumeroFatura] = useState('')
  const [agenteDataFatura, setAgenteDataFatura] = useState(() => new Date().toISOString().slice(0, 10))
  const [agenteVencimento, setAgenteVencimento] = useState('')
  const [agenteSpread, setAgenteSpread] = useState('3')
  const [agenteTaxaBaseUsd, setAgenteTaxaBaseUsd] = useState('')
  const [agenteTaxaBaseEur, setAgenteTaxaBaseEur] = useState('')
  const [agenteObservacoes, setAgenteObservacoes] = useState('')
  const [agenteVisivelCliente, setAgenteVisivelCliente] = useState(true)
  const [salvandoFaturaAgente, setSalvandoFaturaAgente] = useState(false)
  const [itensFaturaAgente, setItensFaturaAgente] = useState<ItemFaturaAgente[]>([
    novoItemFaturaAgente(),
  ])
  const [faturaAgenteEditando, setFaturaAgenteEditando] = useState<Fatura | null>(null)
  const [reciboAgenteSelecionado, setReciboAgenteSelecionado] = useState<Fatura | null>(null)
  const [reciboAgenteData, setReciboAgenteData] = useState('')
  const [reciboAgenteValor, setReciboAgenteValor] = useState('')
  const [reciboAgenteForma, setReciboAgenteForma] = useState('PIX / Transferência bancária')
  const [reciboAgenteObservacoes, setReciboAgenteObservacoes] = useState('')
  const [emitindoReciboAgente, setEmitindoReciboAgente] = useState(false)
  const [excluindoFaturaAgenteId, setExcluindoFaturaAgenteId] = useState<string | null>(null)

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
        cliente_faturamento_id,
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
        tipo_fatura,
        fatura_complementar,
        fatura_principal_id,
        valor_impostos,
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
    const faturasDoEmbarque = faturas.filter((f) => f.embarque_id === embarqueId)

    return (
      faturasDoEmbarque.find((f) => {
        const item: any = f
        const tipo = String((item as any).tipo_fatura || 'FRETE').toUpperCase()
        return item.fatura_complementar !== true && !['IMPOSTOS', 'AGENTE_CARGA'].includes(tipo)
      }) ||
      faturasDoEmbarque[0] ||
      null
    )
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

  async function buscarPerfilClienteNotificacao(usuarioId?: string | null) {
    const id = String(usuarioId || '').trim()
    if (!id) return null

    try {
      const { data } = await supabase
        .from('perfis')
        .select('id, nome, email, nome_empresa, razao_social')
        .eq('id', id)
        .maybeSingle()

      if (data?.email) return data
    } catch (error) {
      console.warn('Não foi possível buscar perfil por id:', error)
    }

    try {
      const { data } = await supabase
        .from('perfis')
        .select('id, user_id, nome, email, nome_empresa, razao_social')
        .eq('user_id', id)
        .maybeSingle()

      if (data?.email) return data
    } catch (error) {
      console.warn('Não foi possível buscar perfil por user_id:', error)
    }

    return null
  }

  async function enviarEmailClienteFatura(params: {
    tipo: string
    fatura: any
    embarque?: any
    mensagem?: string
    dados?: Record<string, any>
  }) {
    try {
      const faturaBase = params.fatura || {}
      const tipoEmail = String(params.tipo || '').trim()

      if (!tipoEmail) return

      if (tipoEmail !== 'FATURA_VENCIDA' && faturaBase.visivel_cliente === false) {
        console.warn('E-mail não enviado: fatura/documento não está visível para o cliente.')
        return
      }

      const embarqueBase =
        params.embarque ||
        embarques.find((embarque: any) => {
          return String(embarque.id) === String(faturaBase.embarque_id)
        })

      const perfil = await buscarPerfilClienteNotificacao(faturaBase.usuario_id || embarqueBase?.usuario_id)

      const emailCliente = String(
        faturaBase.email_cliente ||
          faturaBase.cliente_email ||
          faturaBase.email ||
          perfil?.email ||
          ''
      )
        .trim()
        .toLowerCase()

      if (!emailCliente) {
        console.warn('E-mail não enviado: cliente sem e-mail vinculado.', {
          fatura_id: faturaBase.id,
          usuario_id: faturaBase.usuario_id,
          embarque_id: faturaBase.embarque_id,
        })
        return
      }

      const nomeCliente =
        perfil?.nome ||
        perfil?.nome_empresa ||
        perfil?.razao_social ||
        faturaBase.cliente_nome ||
        faturaBase.nome_cliente ||
        emailCliente

      const resposta = await fetch('/api/email-cliente-notificacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: tipoEmail,
          email: emailCliente,
          nome: nomeCliente,
          awb: embarqueBase?.awb || faturaBase.awb || '',
          referencia:
            embarqueBase?.referencia_cliente ||
            embarqueBase?.referencia_hc ||
            faturaBase.numero_fatura ||
            '',
          referencia_tipo: 'faturas',
          referencia_id: faturaBase.id || faturaBase.embarque_id || '',
          link: `${window.location.origin}/cliente/faturas`,
          mensagem: params.mensagem || '',
          dados: {
            Fatura: faturaBase.numero_fatura || '-',
            AWB: embarqueBase?.awb || '-',
            Vencimento: dataBR(normalizarData(faturaBase.vencimento) || normalizarData(faturaBase.vencimento_cobranca)),
            Valor: numero(faturaBase.valor_total) > 0 ? moeda(faturaBase.valor_total) : '',
            ...(params.dados || {}),
          },
        }),
      })

      if (!resposta.ok) {
        const textoErro = await resposta.text()
        console.warn('E-mail de fatura não enviado:', textoErro)
      }
    } catch (error) {
      console.warn('Falha ao enviar e-mail de fatura ao cliente:', error)
    }
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


  function labelDocumentoPacoteFatura(item: any) {
    const texto = String(`${item?.tipo || ''} ${item?.nome || ''} ${item?.tipo_fatura || ''}`)
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

    if (texto.includes('BOLETO')) return 'Boleto'
    if (
      texto.includes('RECIBO') &&
      (texto.includes('COMPLEMENTAR') || texto.includes('IMPOSTOS'))
    ) {
      return 'Recibo complementar'
    }
    if (texto.includes('RECIBO')) return 'Recibo'
    if (texto.includes('COMPLEMENTAR') || texto.includes('IMPOSTOS')) {
      return 'Fatura complementar / impostos'
    }
    if (texto.includes('FRETE')) return 'Fatura principal / frete'
    if (texto.includes('FATURA')) return 'Fatura'
    return item?.nome || item?.tipo || 'Documento'
  }

  function origemDocumentoPacoteFatura(item: any) {
    if (item?.origem) return item.origem
    if (item?.fatura_complementar !== undefined || item?.tipo_fatura) return 'faturas'
    return 'fatura_arquivos'
  }

  function dataDocumentoPacoteFatura(item: any) {
    return item?.criado_em ? dataBR(item.criado_em) : '-'
  }

  function valorDocumentoPacoteFatura(item: any) {
    return numero(item?.valor_total) > 0 ? moeda(item.valor_total) : '-'
  }

  async function removerAnexoPacoteFatura(item: any) {
    const origem = origemDocumentoPacoteFatura(item)

    if (origem !== 'fatura_arquivos') {
      alert('Este item é uma fatura lançada no financeiro. Para remover, primeiro precisa cancelar/ajustar o lançamento financeiro.')
      return
    }

    const confirmar = confirm(
      `Deseja remover este anexo?\n\n${labelDocumentoPacoteFatura(item)}\n${item?.nome || ''}`
    )

    if (!confirmar) return

    const { error } = await supabase
      .from('fatura_arquivos')
      .delete()
      .eq('id', item.id)

    if (error) {
      alert(error.message)
      return
    }

    alert('Anexo removido.')
    await carregar()
  }

  function documentosPacoteAdmin(embarque: any, faturaPrincipal?: any | null) {
    const embarqueId = embarque?.id
    if (!embarqueId) return []

    const docs: any[] = []

    const faturaPrincipalAny: any = faturaPrincipal

    if (faturaPrincipalAny?.arquivo_pdf) {
      docs.push({
        id: String(faturaPrincipal.id || '') + '-fatura-principal',
        origem: 'faturas',
        tipo: 'FATURA_PRINCIPAL',
        nome: faturaPrincipalAny.numero_fatura
          ? 'Fatura principal ' + faturaPrincipalAny.numero_fatura
          : 'Fatura principal',
        url: faturaPrincipalAny.arquivo_pdf,
        valor_total: faturaPrincipalAny.valor_total,
        criado_em: faturaPrincipalAny.criado_em,
        bloqueado_financeiro: true,
      })
    }

    const faturasDoEmbarque = faturas.filter((item: any) => item.embarque_id === embarqueId)

    for (const item of faturasDoEmbarque) {
      if (!item?.arquivo_pdf) continue
      if (faturaPrincipal?.id && item.id === faturaPrincipal.id) continue

      const itemFatura: any = item
      const tipo = String(itemFatura.tipo_fatura || '').toUpperCase()
      const complementar =
        itemFatura.fatura_complementar === true ||
        tipo.includes('IMPOSTOS') ||
        tipo.includes('COMPLEMENTAR')

      docs.push({
        id: item.id,
        origem: 'faturas',
        tipo: complementar ? 'FATURA_COMPLEMENTAR_IMPOSTOS' : itemFatura.tipo_fatura || 'FATURA',
        nome: complementar
          ? 'Fatura complementar / impostos ' + (item.numero_fatura || '')
          : 'Fatura adicional ' + (item.numero_fatura || ''),
        url: item.arquivo_pdf,
        valor_total: itemFatura.valor_total,
        criado_em: item.criado_em,
        fatura_complementar: itemFatura.fatura_complementar,
        bloqueado_financeiro: true,
      })
    }

    const idsFaturasDoEmbarque = new Set(
      faturasDoEmbarque.map((item: any) => item.id).filter(Boolean)
    )

    if (faturaPrincipal?.id) idsFaturasDoEmbarque.add(faturaPrincipal.id)

    for (const arquivo of arquivosFaturas || []) {
      if (!arquivo?.url) continue

      const pertenceAoEmbarque =
        arquivo.embarque_id === embarqueId ||
        idsFaturasDoEmbarque.has(arquivo.fatura_id)

      if (!pertenceAoEmbarque) continue

      docs.push({
        ...arquivo,
        origem: 'fatura_arquivos',
        bloqueado_financeiro: false,
      })
    }

    if (faturaPrincipal?.recibo_pdf) {
      docs.push({
        id: String(faturaPrincipal.id || '') + '-recibo',
        origem: 'faturas',
        tipo: 'RECIBO',
        nome: faturaPrincipalAny.recibo_nome || 'Recibo',
        url: faturaPrincipalAny.recibo_pdf,
        criado_em: faturaPrincipalAny.data_pagamento || faturaPrincipalAny.criado_em,
        bloqueado_financeiro: true,
      })
    }

    if (faturaPrincipal?.comprovante_pagamento) {
      docs.push({
        id: String(faturaPrincipal.id || '') + '-comprovante',
        origem: 'faturas',
        tipo: 'COMPROVANTE',
        nome: 'Comprovante de pagamento',
        url: faturaPrincipalAny.comprovante_pagamento,
        criado_em: faturaPrincipalAny.data_comprovante || faturaPrincipalAny.criado_em,
        bloqueado_financeiro: true,
      })
    }

    const mapa = new Map<string, any>()

    for (const doc of docs) {
      if (!doc?.url) continue
      mapa.set(doc.url, doc)
    }

    return Array.from(mapa.values()).sort((a: any, b: any) => {
      const dataA = new Date(a.criado_em || 0).getTime()
      const dataB = new Date(b.criado_em || 0).getTime()
      return dataB - dataA
    })
  }

  function arquivosDaFatura(faturaId?: string | null) {
    if (!faturaId) return []
    return arquivosFaturas.filter((arquivo) => arquivo.fatura_id === faturaId)
  }

  function documentosComplementaresDoEmbarque(embarque: Embarque, faturaPrincipal?: Fatura | null) {
    const embarqueId = embarque?.id

    if (!embarqueId) return []

    const complementaresFaturas = faturas
      .filter((f: any) => {
        if (f.embarque_id !== embarqueId) return false
        if (!f.arquivo_pdf) return false

        const tipo = String(f.tipo_fatura || '').toUpperCase()

        return f.fatura_complementar === true || tipo.includes('IMPOSTOS') || tipo.includes('COMPLEMENTAR')
      })
      .map((f: any) => ({
        id: f.id,
        nome: f.numero_fatura ? `Complementar ${f.numero_fatura}` : 'Fatura complementar',
        url: f.arquivo_pdf,
        origem: 'faturas',
        tipo: f.tipo_fatura || 'IMPOSTOS',
        valor_total: f.valor_total,
        criado_em: f.criado_em,
        fatura_complementar: f.fatura_complementar,
      }))

    const idsFaturasDoEmbarque = new Set(
      faturas
        .filter((f: any) => f.embarque_id === embarqueId)
        .map((f: any) => f.id)
        .filter(Boolean)
    )

    if (faturaPrincipal?.id) {
      idsFaturasDoEmbarque.add(faturaPrincipal.id)
    }

    const complementaresArquivos = arquivosFaturas
      .filter((arquivo: any) => {
        const tipo = String(arquivo.tipo || arquivo.nome || '').toUpperCase()

        return (
          arquivo.url &&
          (
            arquivo.embarque_id === embarqueId ||
            idsFaturasDoEmbarque.has(arquivo.fatura_id)
          ) &&
          (
            tipo.includes('COMPLEMENTAR') ||
            tipo.includes('IMPOSTOS') ||
            tipo.includes('FATURA_EXTRA') ||
            tipo.includes('FATURA')
          )
        )
      })
      .map((arquivo: any) => ({
        id: arquivo.id,
        nome: arquivo.nome || arquivo.tipo || 'Anexo complementar',
        url: arquivo.url,
        origem: 'fatura_arquivos',
      }))

    const mapa = new Map()

    for (const doc of [...complementaresFaturas, ...complementaresArquivos]) {
      if (!doc.url) continue
      mapa.set(doc.url, doc)
    }

    return Array.from(mapa.values())
  }

  function labelTipoArquivoFatura(tipo?: string | null) {
    const normalizado = normalizarTexto(tipo || 'OUTRO')
    if (normalizado.includes('BOLETO')) return 'Boleto'
    if (
      normalizado.includes('RECIBO') &&
      (normalizado.includes('COMPLEMENTAR') || normalizado.includes('IMPOSTOS'))
    ) {
      return 'Recibo complementar'
    }
    if (normalizado.includes('RECIBO')) return 'Recibo'
    if (normalizado.includes('FATURA') && normalizado.includes('EXTRA')) return 'PDF faturamento'
    if (normalizado.includes('COMPLEMENTAR')) return 'Fatura complementar'
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

      await enviarEmailClienteFatura({
        tipo: normalizarTexto(tipo).includes('BOLETO') ? 'BOLETO_DISPONIVEL' : 'DOCUMENTO_DISPONIVEL',
        fatura,
        mensagem: `${labelTipoArquivoFatura(tipo)} disponível no Portal HC Connect.`,
        dados: {
          Documento: labelTipoArquivoFatura(tipo),
          Arquivo: arquivo.name,
        },
      })

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
    const confirmar = confirm(
      `Deseja remover ${arquivo.nome || labelTipoArquivoFatura(arquivo.tipo)}?`
    )

    if (!confirmar) return

    setRemovendoArquivoExtra(arquivo.id)

    try {
      const idArquivo = String(arquivo.id || '').trim()
      const tipoArquivo = normalizarTexto(arquivo.tipo || '')

      const regexUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

      const idEhUuid = regexUuid.test(idArquivo)

      const ehReciboPrincipal =
        tipoArquivo.includes('RECIBO') &&
        (!idEhUuid || idArquivo.toLowerCase().endsWith('-recibo'))

      const caminhoArquivo =
        arquivo.caminho || extrairCaminhoStorage(arquivo.url)

      /*
        O recibo principal não é um registro de fatura_arquivos.

        Ele fica salvo diretamente na tabela faturas, nos campos:
        recibo_pdf, recibo_nome, recibo_emitido_em e recibo_observacoes.
      */
      if (ehReciboPrincipal) {
        const faturaId = String(
          arquivo.fatura_id ||
            idArquivo.replace(/-recibo$/i, '')
        ).trim()

        if (!regexUuid.test(faturaId)) {
          throw new Error(
            'Não foi possível identificar a fatura vinculada ao recibo.'
          )
        }

        if (caminhoArquivo) {
          const { error: erroStorage } = await supabase.storage
            .from('faturas')
            .remove([caminhoArquivo])

          if (erroStorage) {
            console.log(
              'Não foi possível remover o PDF antigo do Storage:',
              erroStorage
            )
          }
        }

        const { error: erroFatura } = await supabase
          .from('faturas')
          .update({
            recibo_pdf: null,
            recibo_nome: null,
            recibo_emitido_em: null,
            recibo_observacoes: null,
          })
          .eq('id', faturaId)

        if (erroFatura) {
          throw new Error(erroFatura.message)
        }

        alert(
          'Recibo removido com sucesso. O pagamento registrado no Financeiro foi mantido.'
        )

        await carregar()
        return
      }

      /*
        Boleto, fatura complementar e outros arquivos realmente pertencem
        à tabela fatura_arquivos e precisam possuir um UUID válido.
      */
      if (!idEhUuid) {
        throw new Error(
          'O documento não possui um identificador válido para exclusão.'
        )
      }

      if (caminhoArquivo) {
        const { error: erroStorage } = await supabase.storage
          .from('faturas')
          .remove([caminhoArquivo])

        if (erroStorage) {
          console.log(
            'Não foi possível remover o arquivo antigo do Storage:',
            erroStorage
          )
        }
      }

      const { error } = await supabase
        .from('fatura_arquivos')
        .delete()
        .eq('id', idArquivo)

      if (error) {
        throw new Error(error.message)
      }

      alert('Documento removido com sucesso.')
      await carregar()
    } catch (error: any) {
      console.error('Erro ao remover documento da fatura:', error)

      alert(
        error?.message ||
          'Erro ao remover o documento da fatura.'
      )
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

  function nomeSeguroPdf(valor: any) {
    return String(valor || 'documento')
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  function nomeArquivoPdf(prefixo: string, identificador: any) {
    const base = nomeSeguroPdf(identificador || 'documento')
    return `${nomeSeguroPdf(prefixo)}-${base}.pdf`
  }

  async function salvarPdf(url?: string | null, nomeArquivo = 'documento.pdf') {
    if (!url) {
      alert('PDF não disponível.')
      return
    }

    try {
      const resposta = await fetch(url, { cache: 'no-store' })
      if (!resposta.ok) {
        throw new Error(`Falha ao carregar PDF (${resposta.status}).`)
      }

      const blobOriginal = await resposta.blob()
      const blob = blobOriginal.type === 'application/pdf'
        ? blobOriginal
        : new Blob([blobOriginal], { type: 'application/pdf' })
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = blobUrl
      link.download = nomeArquivo.toLowerCase().endsWith('.pdf')
        ? nomeArquivo
        : `${nomeArquivo}.pdf`
      link.style.display = 'none'

      document.body.appendChild(link)
      link.click()
      link.remove()

      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 3000)
    } catch (error) {
      console.error('Erro ao salvar PDF:', error)
      window.open(url, '_blank', 'noopener,noreferrer')
      alert('Não foi possível iniciar o download automático. O PDF foi aberto em nova aba para você salvar pelo navegador.')
    }
  }

  async function imprimirPdf(url?: string | null) {
    if (!url) {
      alert('PDF não disponível.')
      return
    }

    const janela = window.open('', '_blank')

    if (!janela) {
      alert('O navegador bloqueou a janela de impressão. Libere pop-ups para o HC Connect e tente novamente.')
      return
    }

    try {
      janela.opener = null
      janela.document.write(
        '<!doctype html><html><head><title>Preparando impressão...</title></head><body style="font-family:Arial;padding:24px">Preparando PDF para impressão...</body></html>'
      )
      janela.document.close()

      const resposta = await fetch(url, { cache: 'no-store' })
      if (!resposta.ok) {
        throw new Error(`Falha ao carregar PDF (${resposta.status}).`)
      }

      const blobOriginal = await resposta.blob()
      const blob = blobOriginal.type === 'application/pdf'
        ? blobOriginal
        : new Blob([blobOriginal], { type: 'application/pdf' })
      const blobUrl = URL.createObjectURL(blob)

      janela.location.href = blobUrl

      window.setTimeout(() => {
        try {
          janela.focus()
          janela.print()
        } catch (error) {
          console.error('Erro ao abrir impressão do PDF:', error)
        }

        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
      }, 1800)
    } catch (error) {
      console.error('Erro ao preparar impressão do PDF:', error)
      janela.location.href = url
      alert('Não foi possível abrir a impressão automaticamente. O PDF foi aberto em nova aba; use Ctrl+P para imprimir.')
    }
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

  function documentoEhFaturaComplementar(documento: any) {
    const base = normalizarTexto(
      String(documento?.tipo || '') +
        ' ' +
        String(documento?.nome || '') +
        ' ' +
        String(documento?.tipo_fatura || '')
    )

    if (!documento?.url) return false
    if (base.includes('RECIBO')) return false

    return (
      base.includes('COMPLEMENTAR') ||
      base.includes('IMPOSTOS') ||
      base.includes('FATURA_EXTRA')
    )
  }

  function tipoReciboComplementarDocumento(documento: any) {
    return 'RECIBO_COMPLEMENTAR__' + String(documento?.id || '').trim()
  }

  function reciboComplementarDoDocumento(documento: any) {
    if (!documento?.id) return null

    const tipoRecibo = tipoReciboComplementarDocumento(documento)

    return (
      arquivosFaturas.find(
        (arquivo: any) => String(arquivo?.tipo || '') === tipoRecibo
      ) || null
    )
  }

  function abrirEmissaoReciboComplementar(
    embarque: Embarque,
    documento: any
  ) {
    const faturaPrincipal = faturaDoEmbarque(embarque.id)

    if (!faturaPrincipal?.id) {
      alert('Não encontrei a fatura principal vinculada a este AWB.')
      return
    }

    if (!documentoEhFaturaComplementar(documento)) {
      alert('O documento selecionado não é uma fatura complementar.')
      return
    }

    if (!documento?.url) {
      alert('A fatura complementar não possui um PDF disponível.')
      return
    }

    const clienteFiscalRecibo = localizarClienteFaturamentoParaRecibo(
      embarque,
      faturaPrincipal
    )

    const valorDocumento = numero(documento?.valor_total)

    setReciboSelecionado(embarque)
    setReciboComplementarSelecionado(documento)
    setReciboClienteId(clienteFiscalRecibo?.id || '')

    setBuscaClienteRecibo(
      clienteFiscalRecibo?.nome_empresa ||
        clienteFiscalRecibo?.razao_social ||
        ''
    )

    setDataRecebimentoRecibo(new Date().toISOString().slice(0, 10))

    setValorRecebidoRecibo(
      valorDocumento > 0
        ? formatarNumeroInput(valorDocumento)
        : ''
    )

    setFormaRecebimentoRecibo('PIX / Transferência bancária')

    setObservacoesRecibo(
      'Recebimento referente a ' +
        String(
          documento?.nome ||
            documento?.tipo ||
            'fatura complementar'
        )
    )

    setTimeout(() => {
      document
        .getElementById('form_recibo')
        ?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
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

    setReciboComplementarSelecionado(null)
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
    setReciboComplementarSelecionado(null)
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

    const ehFaturaImpostos = emissorTipoFatura === 'IMPOSTOS'
    const valorAnteriorCobranca = numero(financeiroAtual?.valor_cobranca)
    const valorAnteriorDocDta = numero(financeiroAtual?.doc_dta)

    const totalClienteEmissorBRL = numero(totaisEmissor.totalBRL)
    const valorCompraFinanceiroFinal = numero(financeiroAtual?.valor_compra)
    const numeroFaturaFinanceiro = ehFaturaImpostos && financeiroAtual?.fatura
      ? [financeiroAtual.fatura, emissorNumeroFatura].filter(Boolean).join(' + ')
      : emissorNumeroFatura || null

    const observacaoTipoFatura = ehFaturaImpostos
      ? `Fatura complementar de impostos/DOC/DTA lançada em ${dataBR(new Date().toISOString())}: ${moeda(totaisEmissor.totalBRL)}.`
      : 'Fatura principal de frete/serviços emitida pelo HC Connect.'

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
    const documentoComplementar = reciboComplementarSelecionado
    const ehReciboComplementar = !!documentoComplementar

    if (!fatura?.arquivo_pdf) {
      return alert('Fatura principal não encontrada para este AWB.')
    }

    if (ehReciboComplementar && !documentoComplementar?.url) {
      return alert('Fatura complementar não encontrada ou sem PDF.')
    }

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

      const referenciaFaturaRecibo = ehReciboComplementar
        ? String(
            documentoComplementar?.nome ||
              documentoComplementar?.tipo ||
              'Fatura complementar'
          ).trim()
        : String(fatura.numero_fatura || '-').trim()

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
      pdf.text(
        ehReciboComplementar
          ? 'RECIBO COMPLEMENTAR DE PAGAMENTO'
          : 'RECIBO DE PAGAMENTO',
        margem,
        54
      )

      pdf.setFontSize(9)
      pdf.text('COUTO E OTERO INTERMEDIAÇÃO LTDA', margem, 82)
      pdf.setFont('helvetica', 'normal')
      pdf.text('CNPJ 41.456.630/0001-52', margem, 96)
      pdf.text('RUA DOS COMANCHES Nº 131 - BELO HORIZONTE/MG - CEP 31530250', margem, 110)
      pdf.text('E-MAIL: GRUPOHCCONSULTORIA@OUTLOOK.COM', margem, 124)

      pdf.setDrawColor(0, 0, 0)
      pdf.line(margem, 146, larguraPagina - margem, 146)

      const caixaDadosY = 166
      const caixaDadosAltura = 126
      const caixaDadosLargura = larguraPagina - margem * 2
      const colunaEsquerdaX = margem + 12
      const colunaDireitaX = margem + 320
      const larguraColunaEsquerda = 275
      const larguraColunaDireita = caixaDadosLargura - 340

      pdf.setFillColor(238, 242, 255)
      pdf.rect(margem, caixaDadosY, caixaDadosLargura, caixaDadosAltura, 'FD')

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(8.5)

      pdf.text('Recebemos de:', colunaEsquerdaX, caixaDadosY + 24)
      pdf.text('CNPJ / CPF:', colunaDireitaX, caixaDadosY + 24)

      pdf.text('Referente à fatura:', colunaEsquerdaX, caixaDadosY + 68)
      pdf.text('AWB / HAWB:', colunaDireitaX, caixaDadosY + 68)

      pdf.text('Data do recebimento:', colunaEsquerdaX, caixaDadosY + 104)

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)

      pdf.text(
        pdf.splitTextToSize(dadosCliente.nome || '-', larguraColunaEsquerda),
        colunaEsquerdaX,
        caixaDadosY + 39
      )

      pdf.text(
        pdf.splitTextToSize(dadosCliente.documento || '-', larguraColunaDireita),
        colunaDireitaX,
        caixaDadosY + 39
      )

      pdf.text(
        pdf.splitTextToSize(referenciaFaturaRecibo, larguraColunaEsquerda),
        colunaEsquerdaX,
        caixaDadosY + 83
      )

      pdf.text(
        pdf.splitTextToSize(reciboSelecionado.awb || '-', larguraColunaDireita),
        colunaDireitaX,
        caixaDadosY + 83
      )

      pdf.text(dataBR(dataRecebimento), colunaEsquerdaX, caixaDadosY + 119)

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(13)
      pdf.text('Valor recebido:', margem, 330)
      pdf.setFontSize(24)
      pdf.text(moeda(valorPago), margem + 130, 334)

      pdf.setFontSize(10)
      pdf.text('Valor por extenso:', margem, 376)
      pdf.setFont('helvetica', 'normal')
      pdf.text(pdf.splitTextToSize(valorPorExtensoBRL(valorPago), larguraPagina - margem * 2 - 125), margem + 125, 376)

      pdf.setFont('helvetica', 'bold')
      pdf.text('Forma de recebimento:', margem, 420)
      pdf.setFont('helvetica', 'normal')
      pdf.text(formaRecebimentoRecibo || '-', margem + 130, 420)

      pdf.setFont('helvetica', 'bold')
      pdf.text('Descrição:', margem, 456)
      pdf.setFont('helvetica', 'normal')
      pdf.text(
        pdf.splitTextToSize(
          `Recebimento referente à fatura ${fatura.numero_fatura || '-'} vinculada ao AWB ${reciboSelecionado.awb || '-'}.`,
          larguraPagina - margem * 2
        ),
        margem,
        474
      )

      if (observacoesRecibo) {
        pdf.setFont('helvetica', 'bold')
        pdf.text('Observações:', margem, 522)
        pdf.setFont('helvetica', 'normal')
        pdf.text(pdf.splitTextToSize(observacoesRecibo, larguraPagina - margem * 2), margem, 540)
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
      const pastaRecibo = ehReciboComplementar
        ? 'recibos-complementares'
        : 'recibos'

      const identificadorRecibo = String(
        referenciaFaturaRecibo ||
          fatura.numero_fatura ||
          reciboSelecionado.awb ||
          'hc'
      ).replace(/[^A-Z0-9_-]/gi, '-')

      const nomeArquivo =
        pastaRecibo +
        '/' +
        fatura.id +
        '/' +
        Date.now() +
        '-' +
        (ehReciboComplementar
          ? 'recibo-complementar-'
          : 'recibo-') +
        identificadorRecibo +
        '.pdf'

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

      const abrirPdfReciboGerado = window.open(urlRecibo, '_blank', 'noopener,noreferrer')

      if (!abrirPdfReciboGerado) {
        alert('Recibo gerado, mas o navegador bloqueou a abertura automática. Use o botão Abrir/Recibo na tabela.')
      }

      if (ehReciboComplementar && documentoComplementar) {
        const reciboExistente =
          reciboComplementarDoDocumento(documentoComplementar)

        const caminhoReciboAnterior =
          reciboExistente?.caminho ||
          extrairCaminhoStorage(reciboExistente?.url)

        if (
          caminhoReciboAnterior &&
          caminhoReciboAnterior !== nomeArquivo
        ) {
          const { error: erroStorageAnterior } = await supabase.storage
            .from('faturas')
            .remove([caminhoReciboAnterior])

          if (erroStorageAnterior) {
            console.log(
              'Não foi possível remover o recibo complementar anterior:',
              erroStorageAnterior
            )
          }
        }

        const {
          data: { user },
        } = await supabase.auth.getUser()

        const tipoReciboComplementar =
          tipoReciboComplementarDocumento(documentoComplementar)

        const nomeReciboComplementar =
          'Recibo complementar - ' + referenciaFaturaRecibo

        const payloadReciboComplementar: any = {
          fatura_id: fatura.id,
          embarque_id: reciboSelecionado.id,
          usuario_id:
            fatura.usuario_id ||
            reciboSelecionado.usuario_id ||
            null,
          tipo: tipoReciboComplementar,
          nome: nomeReciboComplementar,
          url: urlRecibo,
          caminho: nomeArquivo,
          visivel_cliente: true,
        }

        if (reciboExistente?.id) {
          const { error: erroAtualizacaoRecibo } = await supabase
            .from('fatura_arquivos')
            .update(payloadReciboComplementar)
            .eq('id', reciboExistente.id)

          if (erroAtualizacaoRecibo) {
            throw new Error(
              'Erro ao atualizar recibo complementar: ' +
                erroAtualizacaoRecibo.message
            )
          }
        } else {
          const { error: erroInsercaoRecibo } = await supabase
            .from('fatura_arquivos')
            .insert([
              {
                ...payloadReciboComplementar,
                criado_por: user?.id || null,
              },
            ])

          if (erroInsercaoRecibo) {
            throw new Error(
              'Erro ao salvar recibo complementar: ' +
                erroInsercaoRecibo.message
            )
          }
        }

        /*
          O valor da fatura complementar já foi somado quando ela foi
          emitida. Aqui registramos somente o histórico do recebimento,
          sem aumentar novamente valor_cobranca, DOC/DTA ou Profit.
        */
        const financeiroAtual =
          financeiroDoEmbarque(reciboSelecionado)

        if (financeiroAtual?.id) {
          const observacoesFinanceiro = [
            financeiroAtual.observacoes || '',
            'Recibo complementar emitido em ' +
              dataBR(new Date().toISOString()) +
              '.',
            'Documento: ' + referenciaFaturaRecibo + '.',
            'Recebimento em ' +
              dataBR(dataRecebimento) +
              '.',
            'Valor recebido: ' + moeda(valorPago) + '.',
            'Forma: ' +
              (formaRecebimentoRecibo || '-') +
              '.',
            'Recibo complementar: ' + urlRecibo + '.',
            observacoesRecibo
              ? 'Obs recibo complementar: ' +
                observacoesRecibo
              : '',
          ]
            .filter(Boolean)
            .join(' | ')

          const { error: erroHistoricoFinanceiro } = await supabase
            .from('financeiro_embarques')
            .update({
              observacoes: observacoesFinanceiro,
            })
            .eq('id', financeiroAtual.id)

          if (erroHistoricoFinanceiro) {
            throw new Error(
              'Recibo complementar salvo, mas houve erro ao registrar o histórico financeiro: ' +
                erroHistoricoFinanceiro.message
            )
          }
        }

        await enviarEmailClienteFatura({
          tipo: 'RECIBO_DISPONIVEL',
          fatura,
          embarque: reciboSelecionado,
          mensagem:
            'Recibo complementar disponível no Portal HC Connect.',
          dados: {
            Documento: 'Recibo complementar',
            Referência: referenciaFaturaRecibo,
            Recebimento: dataBR(dataRecebimento),
            Valor: moeda(valorPago),
          },
        })

        alert(
          'Recibo complementar emitido com sucesso.\n\n' +
            'O recibo principal não foi substituído e o valor não foi somado novamente no Financeiro.'
        )

        limparRecibo()
        await carregar()
        return
      }

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

      await enviarEmailClienteFatura({
        tipo: 'RECIBO_DISPONIVEL',
        fatura,
        embarque: reciboSelecionado,
        mensagem: 'Recibo emitido e disponível no Portal HC Connect.',
        dados: {
          Documento: 'Recibo',
          Recebimento: dataBR(dataRecebimento),
          Valor: moeda(valorPago),
        },
      })

      const desejaArquivar = confirm(
        `Recibo emitido com sucesso, PDF aberto em nova aba e pagamento registrado em Processos Faturados.\n\n` +
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

  async function alternarArquivamentoFaturamento(embarque: Embarque, fatura: Fatura | null | undefined) {
    if (fatura?.id) {
      await alternarArquivamentoFatura(fatura, !fatura.arquivado_admin)
      return
    }

    const confirmar = confirm(
      `Este embarque ainda não tem fatura emitida. Deseja arquivar mesmo assim da aba de faturas?`
    )

    if (!confirmar) return

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { error } = await supabase.from('faturas').insert([
        {
          embarque_id: embarque.id,
          arquivo_pdf: null,
          visivel_cliente: false,
          arquivado_admin: true,
          arquivado_admin_em: new Date().toISOString(),
          arquivado_admin_por: user?.id || null,
        },
      ])

      if (error) throw error

      await carregar()
      alert('Embarque sem fatura arquivado na aba de faturas.')
    } catch (error: any) {
      console.error('Erro ao arquivar embarque sem fatura:', error)
      alert(error?.message || 'Erro ao arquivar embarque sem fatura.')
    }
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

  const agenteClienteSelecionado = useMemo(() => {
    return clientesFaturamento.find((item) => item.id === agenteClienteId) || null
  }, [clientesFaturamento, agenteClienteId])

  const faturasAgenteCarga = useMemo(() => {
    return faturas.filter((item) => String(item.tipo_fatura || '').toUpperCase() === 'AGENTE_CARGA')
  }, [faturas])

  const totaisFaturaAgente = useMemo(() => {
    return itensFaturaAgente.reduce(
      (acc, item) => {
        const valorOriginal = numero(item.valor_original)
        const valorBrl = numero(item.valor_brl)

        if (item.moeda === 'USD') acc.usd += valorOriginal
        if (item.moeda === 'EUR') acc.eur += valorOriginal
        if (item.moeda === 'BRL') acc.brlOriginal += valorOriginal
        acc.totalBrl += valorBrl
        return acc
      },
      { usd: 0, eur: 0, brlOriginal: 0, totalBrl: 0 }
    )
  }, [itensFaturaAgente])

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

    if (base.includes('PRESTACAO DE CONTAS') || base === 'VALOR DE COMPRA') return 'valor_compra'
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

  function dataLocalISO(data: Date) {
    const ano = data.getFullYear()
    const mes = String(data.getMonth() + 1).padStart(2, '0')
    const dia = String(data.getDate()).padStart(2, '0')
    return `${ano}-${mes}-${dia}`
  }

  function hojeLocalISO() {
    return dataLocalISO(new Date())
  }

  function somarDiasISO(dataISO: string, dias: number) {
    const dataNormalizada = normalizarData(dataISO) || hojeLocalISO()
    const [ano, mes, dia] = dataNormalizada.split('-').map(Number)
    const data = new Date(ano, mes - 1, dia, 12, 0, 0)
    data.setDate(data.getDate() + dias)
    return dataLocalISO(data)
  }

  function ehClienteDorfKetal(cliente?: ClienteFaturamento | null) {
    const nome = normalizarTexto(
      [
        cliente?.nome_empresa,
        cliente?.razao_social,
        cliente?.nome,
        cliente?.cliente,
      ]
        .filter(Boolean)
        .join(' ')
    )

    return nome.includes('DORF') && nome.includes('KETAL')
  }

  function vencimentoPadraoCliente(cliente?: ClienteFaturamento | null) {
    return somarDiasISO(hojeLocalISO(), ehClienteDorfKetal(cliente) ? 21 : 7)
  }

  function dataUltimoDiaMesAnterior(dataBaseISO?: string | null) {
    const base = normalizarData(dataBaseISO) || hojeLocalISO()
    const [ano, mes] = base.split('-').map(Number)
    const ultimoDiaMesAnterior = new Date(ano, mes - 1, 0, 12, 0, 0)

    return dataLocalISO(ultimoDiaMesAnterior)
  }

  function dataBRSimples(dataISO?: string | null) {
    const data = normalizarData(dataISO)
    if (!data) return '-'

    const [ano, mes, dia] = data.split('-')
    return `${dia}/${mes}/${ano}`
  }

  function sugestaoPtaxDhlMesAnterior(dataBaseISO?: string | null) {
    const data = dataUltimoDiaMesAnterior(dataBaseISO)

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

  async function carregarCambioAutomaticoEmissor(
    tipoPreferencial?: string,
    aplicarAutomaticamente = true,
    dataBasePtax?: string
  ) {
    const tipoFinal = tipoPreferencial || emissorTipoCambio
    const usandoPtaxDhl = tipoFinal === 'PTAX_DHL_MES_ANTERIOR'
    const dataConsultaPtax = normalizarData(dataBasePtax || emissorDataEmbarque) || ''

    if (usandoPtaxDhl && !dataConsultaPtax) {
      setEmissorAvisoCambio(
        'DHL selecionada: informe a Data do embarque. A PTAX será buscada pelo último valor válido do mês anterior ao envio.'
      )
      return ''
    }

    setCarregandoCambioEmissor(true)

    try {
      const endpoint = usandoPtaxDhl
        ? `/api/cambio-bacen?data=${encodeURIComponent(dataConsultaPtax)}`
        : '/api/cambio-bacen'

      const resposta = await fetch(endpoint, {
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

      if (usandoPtaxDhl) {
        setEmissorPtaxDhlMesAnterior(ptaxDhl)
        setEmissorDataPtaxDhlMesAnterior(dataPtaxDhl || sugestaoPtaxDhlMesAnterior(dataConsultaPtax).data)

        setEmissorAvisoCambio(
          `DHL: embarque em ${dataBRSimples(dataConsultaPtax)}. PTAX aplicada: ${ptaxDhl || '-'} (${dataBRSimples(dataPtaxDhl)}), último valor válido do mês anterior.`
        )
      } else {
        setEmissorDolarVendaDia(dolarVenda)
        setEmissorAvisoCambio(
          `Câmbio atualizado pelo Banco Central. Dólar venda: ${dolarVenda || '-'} (${dataBRSimples(dataDolarVenda)}).`
        )
      }

      if (aplicarAutomaticamente) {
        if (usandoPtaxDhl && ptaxDhl) {
          aplicarTaxaCambio('PTAX_DHL_MES_ANTERIOR', ptaxDhl)
          return ptaxDhl
        }

        if (!usandoPtaxDhl && dolarVenda) {
          aplicarTaxaCambio('DOLAR_VENDA_DIA', dolarVenda)
          return dolarVenda
        }
      }

      return usandoPtaxDhl ? ptaxDhl : dolarVenda
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

  function chaveClienteFaturamentoEmbarque(valor: any) {
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
  }

  function localizarClienteFaturamentoDoEmbarque(embarque: any) {
    if (!embarque) return null

    const idsPossiveis = [
      embarque.cliente_faturamento_id,
      embarque.importador_cliente_faturamento_id,
      embarque.exportador_cliente_faturamento_id,
    ]
      .map((valor: any) => String(valor || '').trim())
      .filter(Boolean)

    for (const id of idsPossiveis) {
      const clientePorId = clientesFaturamento.find(
        (cliente: any) => String(cliente.id) === id
      )

      if (clientePorId) return clientePorId
    }

    const nomesEmbarque = [
      embarque.cliente_final,
      embarque.importador,
      embarque.exportador,
    ]
      .map(chaveClienteFaturamentoEmbarque)
      .filter(Boolean)

    if (nomesEmbarque.length === 0) return null

    const candidatosExatos = clientesFaturamento.filter((cliente: any) => {
      const nomesCliente = [
        cliente.nome_empresa,
        cliente.razao_social,
        cliente.nome_fantasia,
        cliente.nome,
      ]
        .map(chaveClienteFaturamentoEmbarque)
        .filter(Boolean)

      return nomesEmbarque.some((nomeEmbarque) =>
        nomesCliente.includes(nomeEmbarque)
      )
    })

    if (candidatosExatos.length === 1) {
      return candidatosExatos[0]
    }

    const candidatosAproximados = clientesFaturamento.filter((cliente: any) => {
      const nomesCliente = [
        cliente.nome_empresa,
        cliente.razao_social,
        cliente.nome_fantasia,
        cliente.nome,
      ]
        .map(chaveClienteFaturamentoEmbarque)
        .filter(Boolean)

      return nomesEmbarque.some((nomeEmbarque) =>
        nomesCliente.some((nomeCliente) => {
          if (nomeEmbarque.length < 8 || nomeCliente.length < 8) return false

          return (
            nomeCliente.includes(nomeEmbarque) ||
            nomeEmbarque.includes(nomeCliente)
          )
        })
      )
    })

    return candidatosAproximados.length === 1
      ? candidatosAproximados[0]
      : null
  }

  function selecionarClienteFaturamentoEmissor(clienteId: string) {
    setEmissorClienteId(clienteId)

    const cliente =
      clientesFaturamento.find((item) => String(item.id) === String(clienteId)) ||
      null

    setEmissorVencimento(vencimentoPadraoCliente(cliente))
  }

  function selecionarEmbarqueEmissor(embarqueId: string) {
    setEmissorEmbarqueId(embarqueId)

    const embarque = embarques.find((item) => item.id === embarqueId) || null
    if (!embarque) return

    const nomeBuscaCliente = String(
      embarque.cliente_final ||
        embarque.importador ||
        embarque.exportador ||
        ''
    ).trim()

    const clienteFaturamentoAutomatico =
      localizarClienteFaturamentoDoEmbarque(embarque)

    if (clienteFaturamentoAutomatico?.id) {
      setEmissorClienteId(String(clienteFaturamentoAutomatico.id))
      setBuscaClienteEmissor('')
    } else {
      // Evita manter o cliente do embarque anteriormente selecionado.
      setEmissorClienteId('')

      // Filtra a lista para facilitar a escolha manual quando não houver
      // uma correspondência única e segura.
      setBuscaClienteEmissor(nomeBuscaCliente)
    }

    const financeiro = financeiroDoEmbarque(embarque)
    const valor = valorFinanceiro(financeiro) || numero(embarque.valor_fechado) || numero(embarque.valor_cobrado_cliente) || numero(embarque.valor_venda)
    const vencimentoExistente = normalizarData(vencimentoFinanceiro(financeiro)) || ''
    const vencimento = vencimentoExistente || vencimentoPadraoCliente(clienteFaturamentoAutomatico)
    const dataEmbarque = normalizarData(embarque.data_envio) || ''
    const taxa = numero(embarque.taxa_conversao)
    const numeroAtual = faturaDoEmbarque(embarque.id)?.numero_fatura || gerarNumeroFaturaSugerido(embarque)
    const transportadoraDhl = normalizarTexto(embarque.transportadora || '').includes('DHL')
    const ptaxDhlSugerido = sugestaoPtaxDhlMesAnterior(dataEmbarque)
    const taxaBaseEmbarque = taxa ? String(taxa).replace('.', ',') : ''
    const taxaBaseInicial = transportadoraDhl ? '' : taxaBaseEmbarque

    setEmissorNumeroFatura(numeroAtual)
    setEmissorVencimento(vencimento)
    setEmissorDataEmbarque(dataEmbarque)
    setEmissorTaxaConversao(taxaBaseInicial)
    setEmissorTipoCambio(transportadoraDhl ? 'PTAX_DHL_MES_ANTERIOR' : 'DOLAR_VENDA_DIA')
    setEmissorDataPtaxDhlMesAnterior(transportadoraDhl && dataEmbarque ? ptaxDhlSugerido.data : '')
    setEmissorPtaxDhlMesAnterior('')
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

    if (transportadoraDhl) {
      if (dataEmbarque) {
        void carregarCambioAutomaticoEmissor('PTAX_DHL_MES_ANTERIOR', true, dataEmbarque)
      } else {
        setEmissorAvisoCambio(
          'DHL selecionada: informe a Data do embarque para buscar automaticamente a PTAX correta do mês anterior.'
        )
      }
    } else {
      void carregarCambioAutomaticoEmissor('DOLAR_VENDA_DIA', true)
    }
  }

  function abrirEmissaoFaturaDireta(embarque: Embarque) {
    setAbaAtiva('EMISSOR')
    setBuscaEmissorAwb(String(embarque.awb || embarque.cliente_final || embarque.importador || ''))
    selecionarEmbarqueEmissor(embarque.id)

    setTimeout(() => {
      document.getElementById('emissor_fatura')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }


  function abrirEmissaoFaturaComplementar(embarque: Embarque) {
    setAbaAtiva('EMISSOR')
    setEmissorTipoFatura('IMPOSTOS')
    setBuscaEmissorAwb(String(embarque.awb || embarque.cliente_final || embarque.importador || ''))
    selecionarEmbarqueEmissor(embarque.id)

    setTimeout(() => {
      setEmissorTipoFatura('IMPOSTOS')
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
    setEmissorTipoFatura('FRETE')
    setEmissorNumeroFatura('')
    setEmissorVencimento('')
    setEmissorDataEmbarque('')
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

    const ehFaturaImpostos = emissorTipoFatura === 'IMPOSTOS'
    const valorAnteriorCobranca = numero(financeiroAtual?.valor_cobranca)
    const valorAnteriorDocDta = numero(financeiroAtual?.doc_dta)

    const numeroFaturaFinanceiro =
      ehFaturaImpostos && financeiroAtual?.fatura
        ? [financeiroAtual.fatura, emissorNumeroFatura].filter(Boolean).join(' + ')
        : emissorNumeroFatura || null

    const observacaoTipoFatura = ehFaturaImpostos
      ? `Fatura complementar de impostos/DOC/DTA lançada em ${dataBR(new Date().toISOString())}: ${moeda(totaisEmissor.totalBRL)}.`
      : 'Fatura principal de frete/serviços emitida pelo HC Connect.'

    const itensValorCompraEmissor = itensSelecionados.filter((item) => {
      return normalizarTexto(item.descricao).includes('VALOR DE COMPRA')
    })

    const valorCompraManualEmissor = itensValorCompraEmissor.reduce((total, item) => {
      const valorBrl = numero(item.valor_brl)
      const valorUsd = numero(item.valor_usd)

      if (valorBrl > 0) return total + valorBrl
      if (valorUsd > 0 && ptaxBase > 0) return total + valorUsd * ptaxBase

      return total
    }, 0)

    const totalClienteEmissorBRL = Math.max(0, numero(totaisEmissor.totalBRL) - valorCompraManualEmissor)

    const valorCompraFinanceiroFinal = numero(financeiroAtual?.valor_compra)

    const payloadBase: any = {
      cliente: emissorClienteSelecionado.nome_empresa || emissorEmbarqueSelecionado.cliente_final || emissorEmbarqueSelecionado.importador || null,
      awb: emissorEmbarqueSelecionado.awb || null,
      fatura: numeroFaturaFinanceiro,
      despachante: emissorDespachante || financeiroAtual?.despachante || null,
      transportadora: emissorEmbarqueSelecionado.transportadora || null,
      servico: emissorEmbarqueSelecionado.servico || null,
      valor_cobranca: ehFaturaImpostos ? valorAnteriorCobranca + totalClienteEmissorBRL : totalClienteEmissorBRL,
      doc_dta: ehFaturaImpostos ? valorAnteriorDocDta + totalClienteEmissorBRL : valorAnteriorDocDta,
      debito_terceiro: debitoTerceiroAtualizado,
      valor_compra: valorCompraFinanceiroFinal,
      vencimento_cobranca: emissorVencimento || null,
      recebimento: financeiroAtual?.recebimento || null,
      mes: mesFinanceiroDaFatura(),
      mes_profit: financeiroAtual?.mes_profit || '',
      observacoes: [
        financeiroAtual?.observacoes || '',
        `${observacaoTipoFatura} PDF: ${arquivoPdfUrl}. Itens: ${itensResumo}${observacaoHandling ? ` | ${observacaoHandling}` : ''}${emissorObservacoes ? ` | Obs: ${emissorObservacoes}` : ''}`,
      ].filter(Boolean).join(' | '),
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
    if (!emissorDataEmbarque) return alert('Informe a data do embarque.')
    if (!emissorVencimento) return alert('Informe o vencimento da fatura.')

    const embarqueEhDhl = normalizarTexto(emissorEmbarqueSelecionado.transportadora || '').includes('DHL')
    if (embarqueEhDhl && numero(emissorTaxaConversao) <= 0) {
      return alert('Informe a data do embarque e aguarde a busca da PTAX DHL antes de emitir a fatura.')
    }

    if (itensSelecionadosFatura().length === 0 || totaisEmissor.totalBRL <= 0) {
      return alert('Selecione pelo menos um serviço com valor para emitir a fatura.')
    }

    const ehFaturaImpostos = emissorTipoFatura === 'IMPOSTOS'

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
      const itensClientePdf = itensSelecionadosFatura().filter((item) => {
        return !normalizarTexto(item.descricao).includes('VALOR DE COMPRA')
      })

      const totalClientePdfUSD = itensClientePdf.reduce((total, item) => {
        return total + numero(item.valor_usd)
      }, 0)

      const totalClientePdfBRL = itensClientePdf.reduce((total, item) => {
        return total + numero(item.valor_brl)
      }, 0)

      if (itensClientePdf.length === 0 || totalClientePdfBRL <= 0) {
        alert('Selecione pelo menos um serviço cobrado do cliente. VALOR DE COMPRA é interno e não aparece na fatura.')
        return
      }

      const qrPixBase64 = await gerarQrCodePixBase64(totalClientePdfBRL, emissorNumeroFatura)

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' }) as any
      const margem = 32
      const larguraPagina = pdf.internal.pageSize.getWidth()
      const itens = itensSelecionadosFatura()
      const dadosCliente = dadosClienteFiscal(emissorClienteSelecionado)

      const codigoClientePdf = String(emissorClienteSelecionado.codigo_hc || '-').trim() || '-'
      const numeroFaturaPdf = String(emissorNumeroFatura || '-').trim() || '-'

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text(ehFaturaImpostos ? 'FATURA COMPLEMENTAR - IMPOSTOS' : 'FATURA DE SERVIÇO', margem, 34)
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
      const faturaPrincipal = faturaDoEmbarque(emissorEmbarqueSelecionado.id)
      const faturaExistente = ehFaturaImpostos ? null : faturaPrincipal
      const caminhoAntigo = ehFaturaImpostos ? null : extrairCaminhoStorage(faturaExistente?.arquivo_pdf)

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
        itens_fatura: itensClientePdf,
        valor_total: totalClientePdfBRL,
        valor_usd: totalClientePdfUSD,
        taxa_conversao: taxaConversaoFinal(),
        spread: numero(emissorSpread),
        vencimento: emissorVencimento || null,
        tipo_fatura: ehFaturaImpostos ? 'IMPOSTOS' : 'FRETE',
        fatura_complementar: ehFaturaImpostos,
        fatura_principal_id: ehFaturaImpostos ? faturaPrincipal?.id || null : null,
        valor_impostos: ehFaturaImpostos ? totalClientePdfBRL : 0,
      }

      if (ehFaturaImpostos && faturaPrincipal?.id) {
        const { error } = await supabase.from('fatura_arquivos').insert([
          {
            fatura_id: faturaPrincipal.id,
            embarque_id: emissorEmbarqueSelecionado.id,
            usuario_id: emissorUsuarioId || emissorEmbarqueSelecionado.usuario_id || null,
            tipo: 'FATURA_COMPLEMENTAR_IMPOSTOS',
            nome: `Fatura complementar impostos ${emissorNumeroFatura || emissorEmbarqueSelecionado.awb || ''}`.trim(),
            url: urlPdf,
            caminho: nomeArquivo,
          },
        ])

        if (error) {
          throw new Error('Fatura complementar gerada, mas houve erro ao salvar como anexo extra: ' + error.message)
        }
      } else if (faturaExistente) {
        const { error } = await supabase.from('faturas').update(payloadFatura).eq('id', faturaExistente.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase.from('faturas').insert([payloadFatura])
        if (error) throw new Error(error.message)
      }

      await garantirLoginVinculadoAoEmbarque()
      await salvarFinanceiroDaFatura(urlPdf)

      await enviarEmailClienteFatura({
        tipo: 'FATURA_DISPONIVEL',
        fatura: payloadFatura,
        mensagem: 'Nova fatura disponível no Portal HC Connect.',
        dados: {
          Documento: ehFaturaImpostos ? 'Fatura de impostos/taxas' : 'Fatura',
          Vencimento: dataBR(emissorVencimento),
          Valor: moeda(payloadFatura.valor_total),
        },
      })

      const mensagemSucesso = ehFaturaImpostos
        ? 'Fatura complementar de impostos emitida como anexo extra. O PDF principal não foi substituído e o valor foi somado ao processo.'
        : emissorUsuarioId
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
    const ehReciboComplementar = !!reciboComplementarSelecionado

    const referenciaDocumentoRecibo = ehReciboComplementar
      ? String(
          reciboComplementarSelecionado?.nome ||
            reciboComplementarSelecionado?.tipo ||
            'Fatura complementar'
        )
      : faturaReciboAtual?.numero_fatura || '-'

    const valorBaseRecibo = ehReciboComplementar
      ? numero(reciboComplementarSelecionado?.valor_total)
      : valorPadraoRecibo(reciboSelecionado)

    return (
<section id="form_recibo" className="border border-green-700 rounded-3xl bg-green-950/10 p-7 mb-8">
  <div className="flex flex-col lg:flex-row justify-between gap-5 mb-7">
    <div>
      <p className="text-green-400 font-bold mb-2">
        {ehReciboComplementar
          ? 'Emitir recibo complementar'
          : 'Emitir recibo'}
      </p>
      <h2 className="text-2xl font-black">
        {ehReciboComplementar
          ? 'Recibo complementar do AWB '
          : 'Recibo do AWB '}
        {reciboSelecionado.awb}
      </h2>
      <p className="text-slate-400 text-sm">
        {ehReciboComplementar
          ? 'O PDF será vinculado à fatura complementar selecionada, sem substituir o recibo principal e sem duplicar valores no Financeiro.'
          : 'Informe a data em que o pagamento entrou no banco. O sistema vai gerar o PDF, liberar para o cliente e atualizar Processos Faturados.'}
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
    <InfoPacote
      label={ehReciboComplementar ? 'Fatura complementar' : 'Fatura'}
      valor={referenciaDocumentoRecibo}
    />
    <InfoPacote label="Cliente do embarque" valor={reciboSelecionado.cliente_final || reciboSelecionado.importador || '-'} />
    <InfoPacote
      label={ehReciboComplementar ? 'Valor complementar' : 'Valor base'}
      valor={
        valorBaseRecibo > 0
          ? moeda(valorBaseRecibo)
          : 'Informe o valor recebido'
      }
      destaque
    />
    <InfoPacote
      label="Status financeiro"
      valor={
        ehReciboComplementar
          ? 'Histórico complementar'
          : statusPagamentoFinanceiro(
              financeiroDoEmbarque(reciboSelecionado)
            ).label
      }
    />

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
      {ehReciboComplementar
        ? 'O recibo complementar será salvo como documento adicional, vinculado à complementar selecionada. O recibo principal e os totais financeiros serão mantidos.'
        : 'Ao emitir, o recibo será salvo em Faturas clientes, ficará disponível para o cliente no portal e o AWB será marcado como recebido em Financeiro > Processos Faturados.'}
    </div>

    <button
      onClick={gerarPdfReciboHC}
      disabled={emitindoRecibo}
      className="md:col-span-4 bg-green-600 hover:bg-green-500 rounded-2xl font-bold disabled:opacity-60 py-4"
    >
      {emitindoRecibo
        ? 'Gerando recibo...'
        : ehReciboComplementar
          ? 'Gerar recibo complementar'
          : 'Gerar recibo e registrar recebimento'}
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

              const faturasComplementares =
                documentosPacoteAdmin(embarque, fatura).filter(
                  documentoEhFaturaComplementar
                )

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

                  <div className="mt-5 rounded-2xl border border-yellow-700 bg-yellow-950/10 p-4">
                      <div className="mb-3">
                        <p className="font-black text-yellow-300">
                          Faturas complementares
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Emita o recibo específico de cada cobrança complementar.
                        </p>
                      </div>

                      {faturasComplementares.length === 0 ? (
                        <div className="rounded-xl border border-yellow-900 bg-[#071225] p-4">
                          <p className="font-black text-yellow-200">
                            Nenhuma fatura complementar vinculada a este AWB
                          </p>

                          <p className="mt-2 text-xs leading-5 text-slate-400">
                            Emita uma fatura do tipo Complementar — Impostos /
                            DOC / DTA ou anexe o PDF complementar no pacote de
                            documentos deste processo.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {faturasComplementares.map((documento: any) => {
                          const reciboComplementar =
                            reciboComplementarDoDocumento(documento)

                          return (
                            <div
                              key={
                                String(documento.id || '') +
                                '-complementar'
                              }
                              className="flex flex-col gap-3 rounded-xl border border-yellow-900 bg-[#071225] p-4 md:flex-row md:items-center md:justify-between"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-black text-yellow-100">
                                  {documento.nome ||
                                    'Fatura complementar'}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  {numero(documento.valor_total) > 0
                                    ? moeda(documento.valor_total)
                                    : 'Valor será informado na emissão do recibo'}
                                </p>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <Link
                                  href={documento.url}
                                  target="_blank"
                                  className="rounded-lg bg-yellow-600 px-3 py-2 text-xs font-black text-white hover:bg-yellow-500"
                                >
                                  Abrir fatura
                                </Link>

                                {reciboComplementar?.url && (
                                  <Link
                                    href={reciboComplementar.url}
                                    target="_blank"
                                    className="rounded-lg bg-green-700 px-3 py-2 text-xs font-black text-white hover:bg-green-600"
                                  >
                                    Abrir recibo
                                  </Link>
                                )}

                                <button
                                  type="button"
                                  onClick={() =>
                                    abrirEmissaoReciboComplementar(
                                      embarque,
                                      documento
                                    )
                                  }
                                  className="rounded-lg bg-green-600 px-3 py-2 text-xs font-black text-white hover:bg-green-500"
                                >
                                  {reciboComplementar
                                    ? 'Reemitir recibo complementar'
                                    : 'Emitir recibo complementar'}
                                </button>
                              </div>
                            </div>
                          )
                          })}
                        </div>
                      )}
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

  function taxaFinalFaturaAgente(
    moedaItem: MoedaFaturaAgente,
    baseUsd = agenteTaxaBaseUsd,
    baseEur = agenteTaxaBaseEur,
    spread = agenteSpread
  ) {
    if (moedaItem === 'BRL') return 1

    const base = moedaItem === 'USD' ? numero(baseUsd) : numero(baseEur)
    if (base <= 0) return 0

    return base * (1 + numero(spread) / 100)
  }

  function taxaFinalFaturaAgenteFormatada(moedaItem: MoedaFaturaAgente) {
    const taxa = taxaFinalFaturaAgente(moedaItem)
    if (taxa <= 0) return '-'
    return taxa.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  }

  function recalcularItensFaturaAgente(
    baseUsd = agenteTaxaBaseUsd,
    baseEur = agenteTaxaBaseEur,
    spread = agenteSpread
  ) {
    setItensFaturaAgente((atuais) =>
      atuais.map((item) => {
        const valorOriginal = numero(item.valor_original)
        const taxa = taxaFinalFaturaAgente(item.moeda, baseUsd, baseEur, spread)

        return {
          ...item,
          valor_brl: valorOriginal > 0 && taxa > 0 ? formatarNumeroInput(valorOriginal * taxa) : '',
        }
      })
    )
  }

  function atualizarItemFaturaAgente(
    id: string,
    campo: keyof ItemFaturaAgente,
    valor: string
  ) {
    setItensFaturaAgente((atuais) =>
      atuais.map((item) => {
        if (item.id !== id) return item

        const atualizado = { ...item, [campo]: valor } as ItemFaturaAgente

        if (campo === 'valor_original' || campo === 'moeda') {
          const taxa = taxaFinalFaturaAgente(atualizado.moeda)
          const valorOriginal = numero(atualizado.valor_original)
          atualizado.valor_brl = valorOriginal > 0 && taxa > 0
            ? formatarNumeroInput(valorOriginal * taxa)
            : ''
        }

        return atualizado
      })
    )
  }

  function adicionarItemFaturaAgente() {
    setItensFaturaAgente((atuais) => [...atuais, novoItemFaturaAgente()])
  }

  function removerItemFaturaAgente(id: string) {
    setItensFaturaAgente((atuais) => {
      if (atuais.length === 1) return [novoItemFaturaAgente()]
      return atuais.filter((item) => item.id !== id)
    })
  }

  function sugerirNumeroFaturaAgente() {
    const data = agenteDataFatura || new Date().toISOString().slice(0, 10)
    const [ano, mes, dia] = data.split('-')
    const processo = String(agenteProcesso || '').replace(/\D/g, '').slice(-6).padStart(6, '0')
    return `HC${ano}${mes}${dia}${processo}-26`
  }

  function limparFaturaAgente() {
    setFaturaAgenteEditando(null)
    setAgenteProcesso('')
    setAgenteClienteId('')
    setAgenteUsuarioIds([])
    setAgenteNumeroFatura('')
    setAgenteDataFatura(new Date().toISOString().slice(0, 10))
    setAgenteVencimento('')
    setAgenteSpread('3')
    setAgenteTaxaBaseUsd('')
    setAgenteTaxaBaseEur('')
    setAgenteObservacoes('')
    setAgenteVisivelCliente(true)
    setItensFaturaAgente([novoItemFaturaAgente()])
  }

  async function editarFaturaAgente(fatura: Fatura) {
    if (fatura.recibo_pdf) {
      const continuar = confirm(
        'Esta fatura já possui recibo emitido.\n\n' +
          'A edição atualizará a fatura e o lançamento financeiro, mas não modificará o recibo existente. ' +
          'Depois de salvar, reemita o recibo se os valores tiverem sido alterados.\n\n' +
          'Deseja continuar?'
      )

      if (!continuar) return
    }

    const dados = fatura.dados_cliente_faturamento || {}
    const processo = String(dados.processo || '').trim()
    const documentoCliente = normalizarAwb(dados.documento || dados.cnpj || dados.cpf)
    const codigoCliente = normalizarTexto(dados.codigo_hc)
    const nomeCliente = normalizarTexto(dados.nome)

    const clienteCorrespondente = clientesFaturamento.find((cliente) => {
      if (fatura.cliente_faturamento_id && String(cliente.id) === String(fatura.cliente_faturamento_id)) {
        return true
      }

      const documentoCandidato = normalizarAwb(cliente.documento || cliente.cnpj || cliente.cpf)
      if (documentoCliente && documentoCandidato === documentoCliente) return true

      if (codigoCliente && normalizarTexto(cliente.codigo_hc) === codigoCliente) return true

      return nomeCliente && normalizarTexto(cliente.nome_empresa) === nomeCliente
    }) || null

    let itensSalvos: any[] = []

    if (Array.isArray(fatura.itens_fatura)) {
      itensSalvos = fatura.itens_fatura
    } else if (typeof fatura.itens_fatura === 'string') {
      try {
        const itensConvertidos = JSON.parse(fatura.itens_fatura)
        itensSalvos = Array.isArray(itensConvertidos) ? itensConvertidos : []
      } catch (error) {
        console.log('Não foi possível converter os itens da fatura de agente:', error)
      }
    }

    const itensCarregados: ItemFaturaAgente[] = itensSalvos.map((item: any) => {
      const moedaItem = String(item?.moeda || 'USD').toUpperCase()
      const moedaValida: MoedaFaturaAgente = ['BRL', 'USD', 'EUR'].includes(moedaItem)
        ? moedaItem as MoedaFaturaAgente
        : 'USD'

      return {
        id: `agente-edicao-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        descricao: String(item?.descricao || ''),
        moeda: moedaValida,
        valor_original: formatarNumeroInput(numero(item?.valor_original)),
        valor_brl: formatarNumeroInput(numero(item?.valor_brl)),
        observacao: String(item?.observacao || ''),
      }
    })

    const observacoesSalvas = String(
      dados.observacoes_agente ?? fatura.observacoes ?? ''
    )
      .replace(`Fatura de agente de carga - processo ${processo}.`, '')
      .trim()

    const formatarTaxaInput = (valor: any) => {
      const taxa = numero(valor)
      if (taxa <= 0) return ''
      return String(taxa).replace('.', ',')
    }

    const { data: vinculosClientes, error: erroVinculosClientes } = await supabase
      .from('fatura_clientes')
      .select('cliente_id')
      .eq('fatura_id', fatura.id)

    if (erroVinculosClientes) {
      console.log('Não foi possível carregar os clientes vinculados à fatura:', erroVinculosClientes)
    }

    const clientesVinculados = Array.from(
      new Set(
        [
          ...((vinculosClientes || []).map((item: any) => String(item.cliente_id || ''))),
          String(fatura.usuario_id || ''),
        ].filter(Boolean)
      )
    )

    setFaturaAgenteEditando(fatura)
    setAgenteProcesso(processo)
    setAgenteClienteId(clienteCorrespondente?.id || String(fatura.cliente_faturamento_id || ''))
    setAgenteUsuarioIds(clientesVinculados)
    setAgenteNumeroFatura(String(fatura.numero_fatura || ''))
    setAgenteDataFatura(
      normalizarData(dados.data_fatura) ||
        normalizarData(String(fatura.criado_em || '').slice(0, 10)) ||
        new Date().toISOString().slice(0, 10)
    )
    setAgenteVencimento(normalizarData(fatura.vencimento) || '')
    setAgenteSpread(formatarTaxaInput(fatura.spread) || '0')
    setAgenteTaxaBaseUsd(formatarTaxaInput(dados.taxa_base_usd))
    setAgenteTaxaBaseEur(formatarTaxaInput(dados.taxa_base_eur))
    setAgenteObservacoes(observacoesSalvas)
    setAgenteVisivelCliente(fatura.visivel_cliente !== false)
    setItensFaturaAgente(itensCarregados.length > 0 ? itensCarregados : [novoItemFaturaAgente()])
    setReciboAgenteSelecionado(null)

    setTimeout(() => {
      document.getElementById('form_fatura_agente')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  async function salvarFinanceiroFaturaAgente(arquivoPdfUrl: string) {
    if (!agenteClienteSelecionado) return

    const processoNormalizado = normalizarAwb(agenteProcesso)
    const processoAnterior = normalizarAwb(
      faturaAgenteEditando?.dados_cliente_faturamento?.processo
    )
    const numeroFaturaAnterior = normalizarTexto(faturaAgenteEditando?.numero_fatura)

    const financeiroAtual = financeiros.find((item) => {
      const awbs = awbsFinanceiro(item)

      if (faturaAgenteEditando) {
        if (processoAnterior && awbs.includes(processoAnterior)) return true

        return numeroFaturaAnterior && normalizarTexto(item.fatura || item.numero_fatura) === numeroFaturaAnterior
      }

      return processoNormalizado && awbs.includes(processoNormalizado)
    }) || null

    const itensResumo = itensFaturaAgente
      .filter((item) => item.descricao.trim() && numero(item.valor_brl) > 0)
      .map((item) => `${item.descricao}: ${item.moeda} ${formatarValorSimples(numero(item.valor_original))} = ${moeda(numero(item.valor_brl))}`)
      .join(' | ')

    const observacaoNova = [
      financeiroAtual?.observacoes || '',
      `Fatura de agente de carga ${agenteNumeroFatura}, processo ${agenteProcesso}. PDF: ${arquivoPdfUrl}. Itens: ${itensResumo}`,
      agenteObservacoes || '',
    ].filter(Boolean).join(' | ')

    const payload: any = {
      cliente: agenteClienteSelecionado.nome_empresa || null,
      awb: agenteProcesso || null,
      fatura: agenteNumeroFatura || null,
      servico: 'AGENTE DE CARGA',
      valor_cobranca: totaisFaturaAgente.totalBrl,
      doc_dta: numero(financeiroAtual?.doc_dta),
      debito_terceiro: numero(financeiroAtual?.debito_terceiro),
      valor_compra: numero(financeiroAtual?.valor_compra),
      vencimento_cobranca: agenteVencimento || null,
      recebimento: financeiroAtual?.recebimento || null,
      mes: normalizarData(agenteVencimento)?.slice(0, 7) || agenteDataFatura.slice(0, 7),
      mes_profit: financeiroAtual?.mes_profit || '',
      observacoes: observacaoNova,
    }

    if (financeiroAtual?.id) {
      const { error } = await supabase
        .from('financeiro_embarques')
        .update(payload)
        .eq('id', financeiroAtual.id)

      if (error) throw new Error(`Fatura salva, mas houve erro ao atualizar Processos Faturados: ${error.message}`)
      return
    }

    const { error } = await supabase.from('financeiro_embarques').insert([payload])
    if (error) throw new Error(`Fatura salva, mas houve erro ao lançar em Processos Faturados: ${error.message}`)
  }

  async function salvarClientesVinculadosFaturaAgente(faturaId: string) {
    const clientesUnicos = Array.from(new Set(agenteUsuarioIds.filter(Boolean)))

    const { error: erroExclusao } = await supabase
      .from('fatura_clientes')
      .delete()
      .eq('fatura_id', faturaId)

    if (erroExclusao) {
      throw new Error(`Erro ao atualizar os clientes da fatura: ${erroExclusao.message}`)
    }

    if (clientesUnicos.length === 0) return

    const { error: erroInclusao } = await supabase
      .from('fatura_clientes')
      .insert(
        clientesUnicos.map((clienteId) => ({
          fatura_id: faturaId,
          cliente_id: clienteId,
        }))
      )

    if (erroInclusao) {
      throw new Error(`Erro ao vincular os clientes à fatura: ${erroInclusao.message}`)
    }
  }

  async function gerarPdfFaturaAgenteCarga() {
    if (!agenteProcesso.trim()) return alert('Informe o número do processo.')
    if (!agenteClienteSelecionado) return alert('Selecione o cliente de faturamento.')
    if (!agenteNumeroFatura.trim()) return alert('Informe o número da fatura.')
    if (!agenteDataFatura) return alert('Informe a data da fatura.')
    if (!agenteVencimento) return alert('Informe o vencimento.')
    if (agenteVisivelCliente && agenteUsuarioIds.length === 0) {
      return alert('Selecione pelo menos um login do portal ou desmarque a opção de disponibilizar para o cliente.')
    }

    const itensValidos = itensFaturaAgente.filter(
      (item) => item.descricao.trim() && numero(item.valor_original) > 0 && numero(item.valor_brl) > 0
    )

    if (itensValidos.length === 0 || totaisFaturaAgente.totalBrl <= 0) {
      return alert('Adicione pelo menos um serviço com descrição, moeda e valor.')
    }

    if (itensValidos.some((item) => item.moeda === 'USD') && taxaFinalFaturaAgente('USD') <= 0) {
      return alert('Informe a taxa base do USD.')
    }

    if (itensValidos.some((item) => item.moeda === 'EUR') && taxaFinalFaturaAgente('EUR') <= 0) {
      return alert('Informe a taxa base do EUR.')
    }

    setSalvandoFaturaAgente(true)

    try {
      const jsPDFModule = await import('jspdf')
      const autoTableModule = await import('jspdf-autotable')
      const jsPDF = (jsPDFModule as any).jsPDF || (jsPDFModule as any).default
      const autoTable = (autoTableModule as any).default || (autoTableModule as any).autoTable

      if (!jsPDF || !autoTable) {
        throw new Error('Bibliotecas de PDF não carregadas corretamente.')
      }

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' }) as any
      const margem = 34
      const larguraPagina = pdf.internal.pageSize.getWidth()
      const alturaPagina = pdf.internal.pageSize.getHeight()
      const dadosCliente = dadosClienteFiscal(agenteClienteSelecionado)
      const logoBase64 = await carregarImagemBase64(['/HC-CONSULTORIA-TRANSPARENTE.png', '/logo.png', '/logo-hc.png', '/hc-logo.png', '/icon-512.png', '/icon-192.png'])
      const qrPixBase64 = await gerarQrCodePixBase64(totaisFaturaAgente.totalBrl, agenteNumeroFatura)

      pdf.setDrawColor(0, 0, 0)
      pdf.setLineWidth(0.7)
      pdf.rect(28, 28, larguraPagina - 56, alturaPagina - 56)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.text('FATURA DE SERVIÇO', margem + 8, 48)
      pdf.text(`CÓDIGO CLIENTE: ${agenteClienteSelecionado.codigo_hc || '-'}`, 225, 48)
      pdf.text(`FATURA Nº: ${agenteNumeroFatura}`, larguraPagina - margem - 8, 48, { align: 'right' })
      pdf.text(`DATA DA FATURA: ${dataBR(agenteDataFatura)}`, larguraPagina - margem - 8, 70, { align: 'right' })
      pdf.text(`DATA DE VENC.: ${dataBR(agenteVencimento)}`, larguraPagina - margem - 8, 91, { align: 'right' })

      pdf.setFontSize(9)
      pdf.text('COUTO E OTERO INTERMEDIAÇÃO LTDA', margem + 8, 70)
      pdf.setFont('helvetica', 'normal')
      pdf.text('RUA DOS COMANCHES Nº 131', margem + 8, 92)
      pdf.text('BELO HORIZONTE, MG - 31530250', margem + 8, 108)
      pdf.text('CNPJ 41.456.630/0001-52', margem + 8, 124)
      pdf.text('TELEFONE: 55 (31) 3643-6175', 218, 92)
      pdf.text('E-MAIL: GRUPOHCCONSULTORIA@OUTLOOK.COM', 218, 108)
      pdf.text('INSCRIÇÃO ESTADUAL: ISENTO', 218, 124)

      if (logoBase64) {
        try {
          const formatoLogo = logoBase64.includes('image/jpeg') ? 'JPEG' : 'PNG'
          pdf.addImage(logoBase64, formatoLogo, larguraPagina - 126, 95, 78, 48)
        } catch (error) {
          console.log('Logo não pôde ser inserida na fatura de agente:', error)
        }
      }

      pdf.setFillColor(221, 229, 244)
      pdf.rect(margem, 148, larguraPagina - margem * 2, 104, 'FD')
      pdf.setFont('helvetica', 'bold')
      pdf.text('Cobrança para:', margem + 8, 168)
      pdf.text('CNPJ / CPF:', 395, 168)
      pdf.text('Endereço:', margem + 8, 196)
      pdf.setFont('helvetica', 'normal')
      pdf.text(pdf.splitTextToSize(dadosCliente.nome || '-', 230), 150, 168)
      pdf.text(dadosCliente.documento || '-', 466, 168)
      pdf.text(pdf.splitTextToSize(dadosCliente.endereco || '-', 315), 150, 196)
      pdf.text(`${dadosCliente.cidade || '-'} / ${dadosCliente.estado || '-'}`, 150, 224)
      pdf.text(`CEP: ${dadosCliente.cep || '-'}`, 395, 224)

      pdf.setFont('helvetica', 'bold')
      pdf.text('DISCRIMINAÇÃO DOS SERVIÇOS', margem, 270)
      pdf.text('PRESTAÇÃO DE CONTAS', margem, 286)
      pdf.text(`PROCESSO: ${agenteProcesso}`, 260, 286)

      const linhasPdf = itensValidos.map((item) => [
        item.descricao,
        item.observacao || '',
        item.moeda,
        formatarValorSimples(numero(item.valor_original)),
        moeda(numero(item.valor_brl)),
      ])

      autoTable(pdf, {
        startY: 294,
        head: [['SERVIÇO', 'OBSERVAÇÃO', 'MOEDA', 'VALOR ORIGINAL', 'VALOR R$']],
        body: linhasPdf,
        theme: 'grid',
        margin: { left: margem, right: margem },
        styles: { fontSize: 7.5, cellPadding: 3, lineColor: [45, 95, 210], lineWidth: 0.35 },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 175 },
          1: { cellWidth: 135 },
          2: { cellWidth: 50, halign: 'center' },
          3: { cellWidth: 80, halign: 'right' },
          4: { cellWidth: 90, halign: 'right' },
        },
      })

      let yFinal = (pdf as any).lastAutoTable.finalY + 14
      if (yFinal > 560) {
        pdf.addPage('letter', 'portrait')
        yFinal = 56
      }

      pdf.setFillColor(190, 190, 190)
      pdf.rect(margem, yFinal, larguraPagina - margem * 2, 22, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(8)
      pdf.text('TOTAL', margem + 8, yFinal + 15)

      const totaisMoedas = [
        totaisFaturaAgente.eur > 0 ? `EUR ${formatarValorSimples(totaisFaturaAgente.eur)}` : '',
        totaisFaturaAgente.usd > 0 ? `USD ${formatarValorSimples(totaisFaturaAgente.usd)}` : '',
        totaisFaturaAgente.brlOriginal > 0 ? `BRL ${formatarValorSimples(totaisFaturaAgente.brlOriginal)}` : '',
      ].filter(Boolean).join('   ')

      pdf.text(totaisMoedas || 'BRL 0,00', 270, yFinal + 15)
      pdf.text(moeda(totaisFaturaAgente.totalBrl), larguraPagina - margem - 8, yFinal + 15, { align: 'right' })

      const yExtenso = yFinal + 48
      pdf.rect(margem, yExtenso - 18, larguraPagina - margem * 2, 34)
      pdf.text('VALOR POR EXTENSO:', margem + 8, yExtenso)
      pdf.setFont('helvetica', 'normal')
      pdf.text(pdf.splitTextToSize(valorPorExtensoBRL(totaisFaturaAgente.totalBrl), 365), 175, yExtenso)

      const yTaxa = yExtenso + 42
      pdf.rect(margem, yTaxa - 18, larguraPagina - margem * 2, 28)
      pdf.setFont('helvetica', 'bold')
      pdf.text('TAXA DE CONVERSÃO:', margem + 8, yTaxa)
      pdf.text(`SPREAD ${agenteSpread || '0'}%`, 235, yTaxa)
      if (totaisFaturaAgente.eur > 0) pdf.text(`EUR ${taxaFinalFaturaAgenteFormatada('EUR')}`, 345, yTaxa)
      if (totaisFaturaAgente.usd > 0) pdf.text(`USD ${taxaFinalFaturaAgenteFormatada('USD')}`, larguraPagina - margem - 8, yTaxa, { align: 'right' })

      const yBanco = yTaxa + 34
      pdf.setFillColor(45, 119, 183)
      pdf.rect(margem, yBanco - 16, larguraPagina - margem * 2, 54, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(8)
      pdf.text('BANCO BS2 - 218 - BS2 - AGÊNCIA 0001 CONTA: 8749272', larguraPagina / 2, yBanco, { align: 'center' })
      pdf.text('BANCO ITAÚ - AG. 4508 CONTA: 99842-6 CHAVE PIX E-MAIL: GRUPOHCCONSULTORIA@OUTLOOK.COM', larguraPagina / 2, yBanco + 15, { align: 'center' })
      pdf.text('BANCO CONTABILIZEI DOCK IP S.A. 301 - AG: 0001 CONTA 311413-7 CHAVE PIX CNPJ: 41.456.630/0001-52', larguraPagina / 2, yBanco + 30, { align: 'center' })
      pdf.setTextColor(0, 0, 0)

      const yAssinatura = yBanco + 78
      pdf.setFont('times', 'italic')
      pdf.setFontSize(11)
      pdf.text('Marcos Paulo Otero', larguraPagina / 2 - 24, yAssinatura, { align: 'center' })
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      pdf.text('COUTO E OTERO INTERMEDIAÇÃO LTDA', larguraPagina / 2 - 24, yAssinatura + 14, { align: 'center' })
      pdf.text('CNPJ: 41.456.630/0001-52', larguraPagina / 2 - 24, yAssinatura + 27, { align: 'center' })

      if (qrPixBase64) {
        try {
          pdf.addImage(qrPixBase64, larguraPagina - margem - 88, yBanco + 45, 70, 70)
        } catch (error) {
          console.log('QR Code não pôde ser inserido na fatura de agente:', error)
        }
      }

      if (agenteObservacoes) {
        pdf.setFontSize(7)
        pdf.text(`Observações: ${agenteObservacoes}`, margem, yAssinatura + 48, { maxWidth: 390 })
      }

      const blob = pdf.output('blob') as Blob
      const nomeSeguro = agenteNumeroFatura.replace(/[^A-Z0-9_-]/gi, '-')
      const nomeArquivo = `agente-carga/${Date.now()}-fatura-${nomeSeguro}.pdf`

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
      const dadosClienteSalvos = {
        ...dadosClienteFiscal(agenteClienteSelecionado),
        processo: agenteProcesso,
        data_fatura: agenteDataFatura,
        observacoes_agente: agenteObservacoes || '',
        taxa_base_usd: numero(agenteTaxaBaseUsd),
        taxa_base_eur: numero(agenteTaxaBaseEur),
        taxa_final_usd: taxaFinalFaturaAgente('USD'),
        taxa_final_eur: taxaFinalFaturaAgente('EUR'),
      }

      const payloadFatura: any = {
        embarque_id: null,
        usuario_id: agenteUsuarioIds[0] || null,
        numero_fatura: agenteNumeroFatura,
        arquivo_pdf: urlPdf,
        visivel_cliente: agenteVisivelCliente,
        observacoes: [
          `Fatura de agente de carga - processo ${agenteProcesso}.`,
          agenteObservacoes || '',
        ].filter(Boolean).join(' '),
        cliente_faturamento_id: agenteClienteSelecionado.id,
        dados_cliente_faturamento: dadosClienteSalvos,
        itens_fatura: itensValidos.map((item) => ({
          ...item,
          valor_original: numero(item.valor_original),
          valor_brl: numero(item.valor_brl),
          taxa_conversao: taxaFinalFaturaAgente(item.moeda),
        })),
        valor_total: totaisFaturaAgente.totalBrl,
        valor_usd: totaisFaturaAgente.usd,
        taxa_conversao: taxaFinalFaturaAgente('USD'),
        spread: numero(agenteSpread),
        vencimento: agenteVencimento,
        tipo_fatura: 'AGENTE_CARGA',
        fatura_complementar: false,
      }

      let faturaSalva: { id: string } | null = null
      let erroFatura: any = null

      if (faturaAgenteEditando?.id) {
        const resultado = await supabase
          .from('faturas')
          .update(payloadFatura)
          .eq('id', faturaAgenteEditando.id)
          .select('id')
          .single()

        faturaSalva = resultado.data
        erroFatura = resultado.error
      } else {
        const resultado = await supabase
          .from('faturas')
          .insert([payloadFatura])
          .select('id')
          .single()

        faturaSalva = resultado.data
        erroFatura = resultado.error
      }

      if (erroFatura) throw new Error(erroFatura.message)

      if (!faturaSalva?.id) throw new Error('A fatura foi salva sem retornar o identificador.')

      await salvarClientesVinculadosFaturaAgente(faturaSalva.id)

      await salvarFinanceiroFaturaAgente(urlPdf)

      if (!faturaAgenteEditando) {
        for (const clienteId of agenteUsuarioIds) {
          await enviarEmailClienteFatura({
            tipo: 'FATURA_DISPONIVEL',
            fatura: { ...payloadFatura, id: faturaSalva.id, usuario_id: clienteId },
            mensagem: `Nova fatura de agente de carga do processo ${agenteProcesso} disponível no Portal HC Connect.`,
            dados: {
              Documento: 'Fatura de agente de carga',
              Processo: agenteProcesso,
              Vencimento: dataBR(agenteVencimento),
              Valor: moeda(totaisFaturaAgente.totalBrl),
            },
          })
        }
      }

      window.open(urlPdf, '_blank')
      alert(
        faturaAgenteEditando
          ? 'Fatura de agente atualizada, PDF regenerado e Processos Faturados corrigido no mesmo registro.'
          : 'Fatura de agente de carga emitida, salva e lançada em Processos Faturados.'
      )
      limparFaturaAgente()
      await carregar()
    } catch (error: any) {
      console.error(error)
      alert(`Erro ao emitir fatura de agente de carga: ${error?.message || error}`)
    } finally {
      setSalvandoFaturaAgente(false)
    }
  }

  function abrirReciboFaturaAgente(fatura: Fatura) {
    setReciboAgenteSelecionado(fatura)
    setReciboAgenteData(
      normalizarData(fatura.data_pagamento) || new Date().toISOString().slice(0, 10)
    )
    setReciboAgenteValor(formatarNumeroInput(numero(fatura.valor_total)))
    setReciboAgenteForma('PIX / Transferência bancária')
    setReciboAgenteObservacoes('')

    setTimeout(() => {
      document.getElementById('recibo_agente_carga')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  function limparReciboFaturaAgente() {
    setReciboAgenteSelecionado(null)
    setReciboAgenteData('')
    setReciboAgenteValor('')
    setReciboAgenteForma('PIX / Transferência bancária')
    setReciboAgenteObservacoes('')
  }

  async function salvarFinanceiroReciboAgente(
    fatura: Fatura,
    processo: string,
    urlRecibo: string
  ) {
    const processoNormalizado = normalizarAwb(processo)
    const financeiroAtual = financeiros.find((item) =>
      awbsFinanceiro(item).includes(processoNormalizado)
    ) || null
    const dataRecebimento = normalizarData(reciboAgenteData)
    const valorPago = numero(reciboAgenteValor)

    if (!dataRecebimento) throw new Error('Informe uma data de recebimento válida.')

    const observacoesFinanceiro = [
      financeiroAtual?.observacoes || '',
      `Recibo da fatura de agente ${fatura.numero_fatura || '-'} emitido em ${dataBR(new Date().toISOString())}.`,
      `Recebimento em ${dataBR(dataRecebimento)} no valor de ${moeda(valorPago)}.`,
      `Forma: ${reciboAgenteForma || '-'}.`,
      `Recibo: ${urlRecibo}.`,
      reciboAgenteObservacoes ? `Obs recibo: ${reciboAgenteObservacoes}` : '',
    ].filter(Boolean).join(' | ')

    const payload: any = {
      cliente:
        financeiroAtual?.cliente ||
        fatura.dados_cliente_faturamento?.nome ||
        fatura.dados_cliente_faturamento?.nome_empresa ||
        null,
      awb: processo || null,
      fatura: fatura.numero_fatura || null,
      servico: financeiroAtual?.servico || 'AGENTE DE CARGA',
      valor_cobranca: numero(fatura.valor_total),
      doc_dta: numero(financeiroAtual?.doc_dta),
      debito_terceiro: numero(financeiroAtual?.debito_terceiro),
      valor_compra: numero(financeiroAtual?.valor_compra),
      vencimento_cobranca: normalizarData(fatura.vencimento) || financeiroAtual?.vencimento_cobranca || null,
      recebimento: dataRecebimento,
      mes: financeiroAtual?.mes || normalizarData(fatura.vencimento)?.slice(0, 7) || dataRecebimento.slice(0, 7),
      mes_profit: dataRecebimento.slice(0, 7),
      observacoes: observacoesFinanceiro,
    }

    if (financeiroAtual?.id) {
      const { error } = await supabase
        .from('financeiro_embarques')
        .update(payload)
        .eq('id', financeiroAtual.id)

      if (error) throw new Error(`Recibo salvo, mas houve erro ao atualizar Processos Faturados: ${error.message}`)
      return
    }

    const { error } = await supabase.from('financeiro_embarques').insert([payload])
    if (error) throw new Error(`Recibo salvo, mas houve erro ao lançar em Processos Faturados: ${error.message}`)
  }

  async function idsClientesVinculadosFatura(fatura: Fatura) {
    const { data, error } = await supabase
      .from('fatura_clientes')
      .select('cliente_id')
      .eq('fatura_id', fatura.id)

    if (error) {
      console.log('Não foi possível carregar os clientes vinculados:', error)
    }

    return Array.from(
      new Set(
        [
          ...((data || []).map((item: any) => String(item.cliente_id || ''))),
          String(fatura.usuario_id || ''),
        ].filter(Boolean)
      )
    )
  }

  async function gerarReciboFaturaAgente() {
    if (!reciboAgenteSelecionado) return alert('Selecione uma fatura de agente.')

    const dataRecebimento = normalizarData(reciboAgenteData)
    const valorPago = numero(reciboAgenteValor)
    const processo = String(reciboAgenteSelecionado.dados_cliente_faturamento?.processo || '').trim()

    if (!dataRecebimento) return alert('Informe a data do recebimento.')
    if (valorPago <= 0) return alert('Informe o valor recebido.')
    if (!processo) return alert('A fatura não possui número de processo salvo.')

    setEmitindoReciboAgente(true)

    try {
      const jsPDFModule = await import('jspdf')
      const jsPDF = (jsPDFModule as any).jsPDF || (jsPDFModule as any).default
      if (!jsPDF) throw new Error('Biblioteca de PDF não carregada corretamente.')

      const fatura = reciboAgenteSelecionado
      const dadosCliente = fatura.dados_cliente_faturamento || {}
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' }) as any
      const margem = 42
      const larguraPagina = pdf.internal.pageSize.getWidth()
      const logoBase64 = await carregarImagemBase64(['/HC-CONSULTORIA-TRANSPARENTE.png', '/logo.png', '/logo-hc.png', '/hc-logo.png', '/icon-512.png', '/icon-192.png'])

      pdf.setDrawColor(25, 25, 25)
      pdf.setLineWidth(1)
      pdf.rect(24, 24, larguraPagina - 48, 748)

      if (logoBase64) {
        try {
          const formatoLogo = logoBase64.includes('image/jpeg') ? 'JPEG' : 'PNG'
          pdf.addImage(logoBase64, formatoLogo, larguraPagina - 142, 48, 88, 58)
        } catch (error) {
          console.log('Logo não pôde ser inserida no recibo de agente:', error)
        }
      }

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(18)
      pdf.text('RECIBO', margem, 62)
      pdf.setFontSize(9)
      pdf.text('COUTO E OTERO INTERMEDIAÇÃO LTDA', margem, 88)
      pdf.setFont('helvetica', 'normal')
      pdf.text('CNPJ 41.456.630/0001-52', margem, 102)
      pdf.text('RUA DOS COMANCHES Nº 131 - BELO HORIZONTE/MG - CEP 31530250', margem, 116)
      pdf.text('E-MAIL: GRUPOHCCONSULTORIA@OUTLOOK.COM', margem, 130)
      pdf.line(margem, 148, larguraPagina - margem, 148)

      pdf.setFillColor(238, 242, 255)
      pdf.rect(margem, 170, larguraPagina - margem * 2, 138, 'FD')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.text('Recebemos de:', margem + 12, 194)
      pdf.text('CNPJ / CPF:', 350, 194)
      pdf.text('Referente à fatura:', margem + 12, 238)
      pdf.text('Processo formal:', 350, 238)
      pdf.text('Data do recebimento:', margem + 12, 282)

      pdf.setFont('helvetica', 'normal')
      pdf.text(pdf.splitTextToSize(String(dadosCliente.nome || dadosCliente.nome_empresa || '-'), 220), 142, 194)
      pdf.text(String(dadosCliente.documento || '-'), 430, 194)
      pdf.text(String(fatura.numero_fatura || '-'), 142, 238)
      pdf.text(processo, 430, 238)
      pdf.text(dataBR(dataRecebimento), 160, 282)

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(13)
      pdf.text('Valor recebido:', margem, 348)
      pdf.setFontSize(24)
      pdf.text(moeda(valorPago), margem + 130, 352)

      pdf.setFontSize(10)
      pdf.text('Valor por extenso:', margem, 394)
      pdf.setFont('helvetica', 'normal')
      pdf.text(pdf.splitTextToSize(valorPorExtensoBRL(valorPago), larguraPagina - margem * 2 - 125), margem + 125, 394)

      pdf.setFont('helvetica', 'bold')
      pdf.text('Forma de recebimento:', margem, 438)
      pdf.setFont('helvetica', 'normal')
      pdf.text(reciboAgenteForma || '-', margem + 130, 438)

      pdf.setFont('helvetica', 'bold')
      pdf.text('Descrição:', margem, 478)
      pdf.setFont('helvetica', 'normal')
      pdf.text(
        pdf.splitTextToSize(
          `Recebimento referente à fatura de agente de carga ${fatura.numero_fatura || '-'}, processo formal ${processo}.`,
          larguraPagina - margem * 2
        ),
        margem,
        496
      )

      if (reciboAgenteObservacoes) {
        pdf.setFont('helvetica', 'bold')
        pdf.text('Observações:', margem, 546)
        pdf.setFont('helvetica', 'normal')
        pdf.text(pdf.splitTextToSize(reciboAgenteObservacoes, larguraPagina - margem * 2), margem, 564)
      }

      const yAssinatura = 660
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
      pdf.text(`Recibo emitido pelo HC Connect em ${dataBR(new Date().toISOString())}`, margem, 744)

      const blob = pdf.output('blob') as Blob
      const identificador = String(fatura.numero_fatura || processo).replace(/[^A-Z0-9_-]/gi, '-')
      const nomeArquivo = `agente-carga/recibos/${fatura.id}/${Date.now()}-recibo-${identificador}.pdf`

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
      const caminhoAnterior = extrairCaminhoStorage(fatura.recibo_pdf)

      if (caminhoAnterior && caminhoAnterior !== nomeArquivo) {
        await supabase.storage.from('faturas').remove([caminhoAnterior])
      }

      const { error: erroAtualizacao } = await supabase
        .from('faturas')
        .update({
          recibo_pdf: urlRecibo,
          recibo_nome: `Recibo ${fatura.numero_fatura || processo}`,
          data_pagamento: dataRecebimento,
          valor_pago: valorPago,
          recibo_emitido_em: new Date().toISOString(),
          recibo_observacoes: reciboAgenteObservacoes || null,
          status_pagamento: 'PAGO',
          observacao_pagamento: `Recibo de agente emitido em ${dataBR(new Date().toISOString())}. Recebido em ${dataBR(dataRecebimento)}.`,
        })
        .eq('id', fatura.id)

      if (erroAtualizacao) throw new Error(erroAtualizacao.message)

      await salvarFinanceiroReciboAgente(fatura, processo, urlRecibo)

      const clientesDoRecibo = await idsClientesVinculadosFatura(fatura)

      for (const clienteId of clientesDoRecibo) {
        await enviarEmailClienteFatura({
          tipo: 'RECIBO_DISPONIVEL',
          fatura: { ...fatura, recibo_pdf: urlRecibo, usuario_id: clienteId },
          mensagem: `Recibo da fatura de agente de carga do processo ${processo} disponível no Portal HC Connect.`,
          dados: {
            Documento: 'Recibo de agente de carga',
            Processo: processo,
            Recebimento: dataBR(dataRecebimento),
            Valor: moeda(valorPago),
          },
        })
      }

      window.open(urlRecibo, '_blank')
      alert('Recibo da fatura de agente emitido e recebimento registrado no Financeiro.')
      limparReciboFaturaAgente()
      await carregar()
    } catch (error: any) {
      console.error(error)
      alert(`Erro ao emitir recibo da fatura de agente: ${error?.message || error}`)
    } finally {
      setEmitindoReciboAgente(false)
    }
  }

  async function excluirFaturaAgente(fatura: Fatura) {
    const numeroFatura = String(fatura.numero_fatura || 'Sem número')
    const processo = String(fatura.dados_cliente_faturamento?.processo || '').trim()
    const possuiRecibo = !!fatura.recibo_pdf

    const confirmar = confirm(
      `Excluir definitivamente a fatura ${numeroFatura}${processo ? ` do processo ${processo}` : ''}?\n\n` +
        'Esta ação removerá a fatura do portal, os clientes vinculados, o PDF e o lançamento correspondente em Processos Faturados.' +
        (possuiRecibo ? '\nO recibo e o registro de recebimento também serão removidos.' : '') +
        '\n\nEsta ação não pode ser desfeita.'
    )

    if (!confirmar) return

    setExcluindoFaturaAgenteId(fatura.id)

    try {
      const numeroNormalizado = normalizarTexto(fatura.numero_fatura)
      const processoNormalizado = normalizarAwb(processo)

      const idsFinanceiros = financeiros
        .filter((item) => {
          const servico = normalizarTexto(item.servico)
          const pertenceAgente = servico.includes('AGENTE DE CARGA')
          const mesmaFatura =
            !!numeroNormalizado &&
            normalizarTexto(item.fatura || item.numero_fatura) === numeroNormalizado
          const mesmoProcesso =
            !!processoNormalizado && awbsFinanceiro(item).includes(processoNormalizado)

          return pertenceAgente && (mesmaFatura || (!numeroNormalizado && mesmoProcesso))
        })
        .map((item) => item.id)
        .filter(Boolean) as string[]

      if (idsFinanceiros.length > 0) {
        const { error: erroFinanceiro } = await supabase
          .from('financeiro_embarques')
          .delete()
          .in('id', idsFinanceiros)

        if (erroFinanceiro) {
          throw new Error(`Erro ao excluir o lançamento financeiro: ${erroFinanceiro.message}`)
        }
      }

      const { error: erroVinculos } = await supabase
        .from('fatura_clientes')
        .delete()
        .eq('fatura_id', fatura.id)

      if (erroVinculos) {
        throw new Error(`Erro ao excluir os vínculos da fatura: ${erroVinculos.message}`)
      }

      const { error: erroFatura } = await supabase
        .from('faturas')
        .delete()
        .eq('id', fatura.id)

      if (erroFatura) throw new Error(`Erro ao excluir a fatura: ${erroFatura.message}`)

      const caminhos = [
        extrairCaminhoStorage(fatura.arquivo_pdf),
        extrairCaminhoStorage(fatura.recibo_pdf),
      ].filter(Boolean) as string[]

      if (caminhos.length > 0) {
        const { error: erroArquivos } = await supabase.storage.from('faturas').remove(caminhos)
        if (erroArquivos) console.log('Fatura excluída, mas houve erro ao limpar PDFs:', erroArquivos)
      }

      if (faturaAgenteEditando?.id === fatura.id) limparFaturaAgente()
      if (reciboAgenteSelecionado?.id === fatura.id) limparReciboFaturaAgente()

      await carregar()
      alert('Fatura de agente, recibo, vínculos e lançamento financeiro excluídos com sucesso.')
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Erro ao excluir a fatura de agente.')
      await carregar()
    } finally {
      setExcluindoFaturaAgenteId(null)
    }
  }

  function renderAbaAgenteCarga() {
    return (
      <section className="space-y-6">
        <div id="form_fatura_agente" className="rounded-3xl border border-cyan-800 bg-[#071225] p-6 lg:p-7">
          {faturaAgenteEditando && (
            <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-yellow-500/60 bg-yellow-500/10 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-yellow-300">Editando fatura existente</p>
                <p className="mt-1 font-bold text-white">
                  {faturaAgenteEditando.numero_fatura || 'Sem número'} — Processo {faturaAgenteEditando.dados_cliente_faturamento?.processo || '-'}
                </p>
                {faturaAgenteEditando.recibo_pdf && (
                  <p className="mt-1 text-sm text-yellow-200">Esta fatura possui recibo. Reemita-o depois se alterar os valores.</p>
                )}
              </div>
              <button type="button" onClick={limparFaturaAgente} className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-black hover:bg-slate-600">
                Cancelar edição
              </button>
            </div>
          )}
          <p className="text-cyan-400 text-sm font-black uppercase tracking-wide">Emissão multimoeda</p>
          <h2 className="mt-2 text-3xl font-black">Fatura Agente de Carga</h2>
          <p className="mt-2 text-slate-400">Uma fatura por processo, com itens em BRL, USD ou EUR e conversão automática.</p>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <label className="text-sm font-bold text-slate-300">
              Processo
              <input
                value={agenteProcesso}
                onChange={(e) => setAgenteProcesso(e.target.value)}
                placeholder="Ex.: 080201/26"
                className="mt-2 w-full"
              />
            </label>

            <label className="text-sm font-bold text-slate-300">
              Número da fatura
              <div className="mt-2 flex gap-2">
                <input
                  value={agenteNumeroFatura}
                  onChange={(e) => setAgenteNumeroFatura(e.target.value)}
                  placeholder="HC2026080201-26"
                  className="w-full"
                />
                <button
                  type="button"
                  onClick={() => setAgenteNumeroFatura(sugerirNumeroFaturaAgente())}
                  className="rounded-xl bg-slate-700 px-3 text-xs font-black hover:bg-slate-600"
                >
                  Sugerir
                </button>
              </div>
            </label>

            <label className="text-sm font-bold text-slate-300">
              Data da fatura
              <input type="date" value={agenteDataFatura} onChange={(e) => setAgenteDataFatura(e.target.value)} className="mt-2 w-full" />
            </label>

            <label className="text-sm font-bold text-slate-300">
              Vencimento
              <input type="date" value={agenteVencimento} onChange={(e) => setAgenteVencimento(e.target.value)} className="mt-2 w-full" />
            </label>
          </div>

          <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <label className="text-sm font-bold text-slate-300">
              Cliente de faturamento
              <select value={agenteClienteId} onChange={(e) => setAgenteClienteId(e.target.value)} className="mt-2 w-full">
                <option value="">Selecione o cliente fiscal</option>
                {clientesFaturamento.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.codigo_hc ? `${cliente.codigo_hc} - ` : ''}{cliente.nome_empresa}
                  </option>
                ))}
              </select>
            </label>

            <div className="text-sm font-bold text-slate-300">
              <p>Logins do portal que receberão a fatura (opcional)</p>
              <div className="mt-2 max-h-52 space-y-2 overflow-y-auto rounded-xl border border-blue-900 bg-[#020817] p-3">
                {usuariosPortal.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum login de cliente disponível.</p>
                ) : usuariosPortal.map((usuario) => {
                  const selecionado = agenteUsuarioIds.includes(usuario.id)

                  return (
                    <label key={usuario.id} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-blue-950/60">
                      <input
                        type="checkbox"
                        checked={selecionado}
                        onChange={(e) => {
                          setAgenteUsuarioIds((atuais) =>
                            e.target.checked
                              ? Array.from(new Set([...atuais, usuario.id]))
                              : atuais.filter((id) => id !== usuario.id)
                          )
                        }}
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-white">{usuario.nome || usuario.email}</span>
                        <span className="block text-xs font-semibold text-slate-500">{usuario.email || 'Sem e-mail'}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
              <p className="mt-2 text-xs font-bold text-blue-300">
                {agenteUsuarioIds.length === 0
                  ? 'Nenhum portal vinculado'
                  : `${agenteUsuarioIds.length} cliente${agenteUsuarioIds.length > 1 ? 's' : ''} vinculado${agenteUsuarioIds.length > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-blue-900 bg-[#071225] p-6 lg:p-7">
          <h3 className="text-2xl font-black">Câmbio da fatura</h3>
          <p className="mt-1 text-sm text-slate-400">Informe as taxas base. O portal aplicará o spread e usará a taxa final em cada item.</p>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="text-sm font-bold text-slate-300">
              Taxa base USD
              <input
                value={agenteTaxaBaseUsd}
                onChange={(e) => {
                  setAgenteTaxaBaseUsd(e.target.value)
                  recalcularItensFaturaAgente(e.target.value, agenteTaxaBaseEur, agenteSpread)
                }}
                placeholder="Ex.: 5,1005"
                className="mt-2 w-full"
              />
              <span className="mt-1 block text-xs text-green-300">Final: R$ {taxaFinalFaturaAgenteFormatada('USD')}</span>
            </label>

            <label className="text-sm font-bold text-slate-300">
              Taxa base EUR
              <input
                value={agenteTaxaBaseEur}
                onChange={(e) => {
                  setAgenteTaxaBaseEur(e.target.value)
                  recalcularItensFaturaAgente(agenteTaxaBaseUsd, e.target.value, agenteSpread)
                }}
                placeholder="Ex.: 5,8023"
                className="mt-2 w-full"
              />
              <span className="mt-1 block text-xs text-green-300">Final: R$ {taxaFinalFaturaAgenteFormatada('EUR')}</span>
            </label>

            <label className="text-sm font-bold text-slate-300">
              Spread %
              <input
                value={agenteSpread}
                onChange={(e) => {
                  setAgenteSpread(e.target.value)
                  recalcularItensFaturaAgente(agenteTaxaBaseUsd, agenteTaxaBaseEur, e.target.value)
                }}
                placeholder="3"
                className="mt-2 w-full"
              />
            </label>
          </div>
        </div>

        <div className="rounded-3xl border border-blue-900 bg-[#071225] p-5 lg:p-7">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-black">Serviços da prestação de contas</h3>
              <p className="mt-1 text-sm text-slate-400">Adicione livremente cada cobrança da fatura.</p>
            </div>
            <button type="button" onClick={adicionarItemFaturaAgente} className="rounded-xl bg-cyan-600 px-4 py-3 font-black hover:bg-cyan-500">+ Adicionar serviço</button>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm [&_th]:border-b [&_th]:border-blue-900 [&_th]:p-3 [&_th]:text-left [&_td]:border-b [&_td]:border-blue-900/50 [&_td]:p-3">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th className="w-[110px]">Moeda</th>
                  <th className="w-[150px]">Valor original</th>
                  <th className="w-[120px]">Taxa final</th>
                  <th className="w-[160px]">Valor R$</th>
                  <th>Observação</th>
                  <th className="w-[80px]">Ação</th>
                </tr>
              </thead>
              <tbody>
                {itensFaturaAgente.map((item) => (
                  <tr key={item.id}>
                    <td><input value={item.descricao} onChange={(e) => atualizarItemFaturaAgente(item.id, 'descricao', e.target.value)} placeholder="Ex.: Frete Internacional" className="w-full" /></td>
                    <td>
                      <select value={item.moeda} onChange={(e) => atualizarItemFaturaAgente(item.id, 'moeda', e.target.value)} className="w-full">
                        <option value="BRL">BRL</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </td>
                    <td><input value={item.valor_original} onChange={(e) => atualizarItemFaturaAgente(item.id, 'valor_original', e.target.value)} placeholder="0,00" className="w-full" /></td>
                    <td className="font-black text-green-300">{item.moeda === 'BRL' ? '1,0000' : taxaFinalFaturaAgenteFormatada(item.moeda)}</td>
                    <td className="font-black text-green-300">{numero(item.valor_brl) > 0 ? moeda(numero(item.valor_brl)) : '-'}</td>
                    <td><input value={item.observacao} onChange={(e) => atualizarItemFaturaAgente(item.id, 'observacao', e.target.value)} placeholder="Opcional" className="w-full" /></td>
                    <td><button type="button" onClick={() => removerItemFaturaAgente(item.id)} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-black hover:bg-red-500">Excluir</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <ResumoFiltro titulo="Total EUR" valor={`EUR ${formatarValorSimples(totaisFaturaAgente.eur)}`} detalhe="Moeda original" />
            <ResumoFiltro titulo="Total USD" valor={`USD ${formatarValorSimples(totaisFaturaAgente.usd)}`} detalhe="Moeda original" />
            <ResumoFiltro titulo="Itens BRL" valor={moeda(totaisFaturaAgente.brlOriginal)} detalhe="Sem conversão" />
            <ResumoFiltro titulo="Total da fatura" valor={moeda(totaisFaturaAgente.totalBrl)} detalhe="Cobrança final" />
          </div>
        </div>

        <div className="rounded-3xl border border-green-900 bg-green-950/20 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
            <div>
              <label className="text-sm font-bold text-slate-300">
                Observações
                <textarea value={agenteObservacoes} onChange={(e) => setAgenteObservacoes(e.target.value)} className="mt-2 min-h-[100px] w-full" placeholder="Opcional" />
              </label>
              <label className="mt-4 flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" checked={agenteVisivelCliente} onChange={(e) => setAgenteVisivelCliente(e.target.checked)} />
                Disponibilizar no portal do cliente
              </label>
            </div>

            <div className="rounded-2xl border border-green-700 bg-[#071225] p-5">
              <p className="text-sm font-black text-slate-400">TOTAL A FATURAR</p>
              <p className="mt-2 text-3xl font-black text-green-300">{moeda(totaisFaturaAgente.totalBrl)}</p>
              <button type="button" onClick={gerarPdfFaturaAgenteCarga} disabled={salvandoFaturaAgente} className="mt-5 w-full rounded-xl bg-green-600 px-4 py-4 font-black hover:bg-green-500 disabled:opacity-60">
                {salvandoFaturaAgente
                  ? faturaAgenteEditando
                    ? 'Salvando alterações...'
                    : 'Gerando e salvando...'
                  : faturaAgenteEditando
                    ? 'Salvar alterações e gerar novo PDF'
                    : 'Gerar PDF e lançar fatura'}
              </button>
            </div>
          </div>
        </div>

        {reciboAgenteSelecionado && (
          <div id="recibo_agente_carga" className="rounded-3xl border border-green-700 bg-green-950/20 p-6 lg:p-7">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <p className="text-green-400 text-sm font-black uppercase tracking-wide">Recibo sem embarque</p>
                <h3 className="mt-2 text-2xl font-black">Recibo da fatura {reciboAgenteSelecionado.numero_fatura || '-'}</h3>
                <p className="mt-1 text-slate-400">Processo formal: {reciboAgenteSelecionado.dados_cliente_faturamento?.processo || '-'}</p>
              </div>
              <button type="button" onClick={limparReciboFaturaAgente} className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-black hover:bg-slate-600">Cancelar</button>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="text-sm font-bold text-slate-300">
                Data do recebimento
                <input type="date" value={reciboAgenteData} onChange={(e) => setReciboAgenteData(e.target.value)} className="mt-2 w-full" />
              </label>
              <label className="text-sm font-bold text-slate-300">
                Valor recebido
                <input value={reciboAgenteValor} onChange={(e) => setReciboAgenteValor(e.target.value)} placeholder="0,00" className="mt-2 w-full" />
              </label>
              <label className="text-sm font-bold text-slate-300">
                Forma de recebimento
                <input value={reciboAgenteForma} onChange={(e) => setReciboAgenteForma(e.target.value)} className="mt-2 w-full" />
              </label>
            </div>

            <label className="mt-4 block text-sm font-bold text-slate-300">
              Observações
              <textarea value={reciboAgenteObservacoes} onChange={(e) => setReciboAgenteObservacoes(e.target.value)} className="mt-2 min-h-[90px] w-full" placeholder="Opcional" />
            </label>

            <div className="mt-5 flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-green-800 bg-[#071225] p-4">
              <div>
                <p className="text-xs font-black uppercase text-slate-400">Valor do recibo</p>
                <p className="mt-1 text-2xl font-black text-green-300">{moeda(numero(reciboAgenteValor))}</p>
              </div>
              <button type="button" onClick={gerarReciboFaturaAgente} disabled={emitindoReciboAgente} className="rounded-xl bg-green-600 px-6 py-4 font-black hover:bg-green-500 disabled:opacity-60">
                {emitindoReciboAgente ? 'Gerando recibo...' : 'Gerar PDF do recibo'}
              </button>
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-blue-900 bg-[#071225] p-6">
          <h3 className="text-2xl font-black">Histórico de faturas de agente</h3>
          <div className="mt-4 space-y-3">
            {faturasAgenteCarga.length === 0 ? (
              <p className="text-slate-400">Nenhuma fatura de agente de carga emitida.</p>
            ) : faturasAgenteCarga.map((fatura) => (
              <div key={fatura.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border border-blue-900 bg-[#020817] p-4">
                <div>
                  <p className="font-black">{fatura.numero_fatura || 'Sem número'} - Processo {fatura.dados_cliente_faturamento?.processo || '-'}</p>
                  <p className="text-sm text-slate-400">{fatura.dados_cliente_faturamento?.nome || '-'} • {moeda(fatura.valor_total)} • Venc. {dataBR(fatura.vencimento)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => editarFaturaAgente(fatura)} className="rounded-xl bg-yellow-600 px-4 py-2 text-sm font-black hover:bg-yellow-500">
                    Editar
                  </button>
                  {fatura.arquivo_pdf && <Link href={fatura.arquivo_pdf} target="_blank" className="rounded-xl bg-blue-600 px-4 py-2 text-center text-sm font-black hover:bg-blue-500">Abrir fatura</Link>}
                  {fatura.recibo_pdf && <Link href={fatura.recibo_pdf} target="_blank" className="rounded-xl bg-green-700 px-4 py-2 text-center text-sm font-black hover:bg-green-600">Abrir recibo</Link>}
                  <button type="button" onClick={() => abrirReciboFaturaAgente(fatura)} className="rounded-xl bg-green-600 px-4 py-2 text-sm font-black hover:bg-green-500">
                    {fatura.recibo_pdf ? 'Reemitir recibo' : 'Emitir recibo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => excluirFaturaAgente(fatura)}
                    disabled={excluindoFaturaAgenteId === fatura.id}
                    className="rounded-xl bg-red-700 px-4 py-2 text-sm font-black hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {excluindoFaturaAgenteId === fatura.id ? 'Excluindo...' : 'Excluir'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
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

      <div data-tipo-fatura-emissor="true" className="mb-6 rounded-3xl border border-yellow-700 bg-yellow-950/20 p-5">
        <p className="text-sm font-black uppercase tracking-widest text-yellow-300">
          Tipo da emissão
        </p>

        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <label>Tipo da fatura</label>
            <select
              value={emissorTipoFatura}
              onChange={(e) => setEmissorTipoFatura(e.target.value as 'FRETE' | 'IMPOSTOS')}
            >
              <option value="FRETE">Fatura principal - Frete / serviços</option>
              <option value="IMPOSTOS">Complementar - Impostos / DOC / DTA</option>
            </select>
          </div>

          <div className="rounded-2xl border border-yellow-800 bg-[#020817] p-4 text-sm text-yellow-100">
            {emissorTipoFatura === 'IMPOSTOS'
              ? 'A fatura complementar será salva como ANEXO EXTRA. O PDF principal não será substituído.'
              : 'A fatura principal atualiza o PDF principal do embarque.'}
          </div>
        </div>
      </div>

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
                onChange={(e) => selecionarClienteFaturamentoEmissor(e.target.value)}
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
                <div className="rounded-2xl border border-blue-900 bg-[#071225] p-4">
                  <label className="text-sm font-black text-slate-300">
                    Tipo da fatura
                    <select
                      value={emissorTipoFatura}
                      onChange={(e) => setEmissorTipoFatura(e.target.value as 'FRETE' | 'IMPOSTOS')}
                      className="mt-2 w-full"
                    >
                      <option value="FRETE">Frete / serviços</option>
                      <option value="IMPOSTOS">Impostos / DOC / DTA - complementar</option>
                    </select>
                  </label>

                  {emissorTipoFatura === 'IMPOSTOS' ? (
                    <p className="mt-2 rounded-xl border border-yellow-700 bg-yellow-950/20 px-3 py-2 text-xs font-bold text-yellow-200">
                      Esta opção cria uma NOVA fatura complementar, não substitui a fatura de frete existente e soma o valor em Processos Faturados + DOC/DTA/Impostos.
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">
                      Fatura principal de frete/serviços do processo.
                    </p>
                  )}
                </div>

                <input
                  value={emissorNumeroFatura}
                  onChange={(e) => setEmissorNumeroFatura(e.target.value)}
                  placeholder="Número da fatura"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="text-sm font-bold text-slate-300">
                    Data do embarque
                    <input
                      type="date"
                      value={emissorDataEmbarque}
                      onChange={(e) => {
                        const data = e.target.value
                        setEmissorDataEmbarque(data)

                        const ehDhl = normalizarTexto(
                          emissorEmbarqueSelecionado?.transportadora || ''
                        ).includes('DHL')

                        if (!ehDhl) return

                        if (!data) {
                          setEmissorPtaxDhlMesAnterior('')
                          setEmissorDataPtaxDhlMesAnterior('')
                          setEmissorTaxaConversao('')
                          setEmissorAvisoCambio(
                            'Informe a Data do embarque para buscar a PTAX DHL do mês anterior.'
                          )
                          return
                        }

                        setEmissorDataPtaxDhlMesAnterior(
                          sugestaoPtaxDhlMesAnterior(data).data
                        )
                        void carregarCambioAutomaticoEmissor(
                          'PTAX_DHL_MES_ANTERIOR',
                          true,
                          data
                        )
                      }}
                      className="mt-2 w-full"
                    />
                    <span className="mt-2 block text-xs font-normal text-slate-500">
                      Na DHL, esta data define automaticamente qual mês de PTAX deve ser usado.
                    </span>
                  </label>

                  <label className="text-sm font-bold text-slate-300">
                    Vencimento
                    <input
                      type="date"
                      value={emissorVencimento}
                      onChange={(e) => setEmissorVencimento(e.target.value)}
                      className="mt-2 w-full"
                    />
                    <span className="mt-2 block text-xs font-normal text-slate-500">
                      {ehClienteDorfKetal(emissorClienteSelecionado)
                        ? 'Dorf Ketal: padrão de 21 dias. A data continua editável.'
                        : 'Padrão HC: 7 dias. A data continua editável para prazo menor ou diferente.'}
                    </span>
                  </label>
                </div>

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
                          value={emissorDataPtaxDhlMesAnterior}
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
                      onClick={() =>
                        carregarCambioAutomaticoEmissor(
                          emissorTipoCambio,
                          true,
                          emissorDataEmbarque
                        )
                      }
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
                    Regra DHL: a Data do embarque define a referência. O sistema consulta o Banco Central e aplica o último PTAX válido do mês imediatamente anterior ao envio.
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
                      ? `PTAX DHL ${dataBRSimples(emissorDataPtaxDhlMesAnterior)}`
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
            onClick={() => setAbaAtiva('AGENTE_CARGA')}
            className="bg-cyan-600 hover:bg-cyan-500 px-6 py-4 rounded-2xl font-bold"
          >
            Fatura agente de carga
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
          onClick={() => setAbaAtiva('AGENTE_CARGA')}
          className={
            abaAtiva === 'AGENTE_CARGA'
              ? 'rounded-2xl bg-cyan-600 px-5 py-3 font-black text-white shadow-[0_0_25px_rgba(8,145,178,0.25)]'
              : 'rounded-2xl bg-[#020817] px-5 py-3 font-black text-slate-300 hover:bg-cyan-600/20 hover:text-white'
          }
        >
          ✈️ Fatura agente de carga
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
      ) : abaAtiva === 'AGENTE_CARGA' ? (
        renderAbaAgenteCarga()
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
                            <Link
                              href={fatura.arquivo_pdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block rounded-lg bg-blue-600 px-3 py-2 text-center text-xs font-black text-white hover:bg-blue-500"
                            >
                              Abrir
                            </Link>

                            <button
                              type="button"
                              onClick={() => imprimirPdf(fatura.arquivo_pdf)}
                              className="rounded-lg bg-slate-700 px-3 py-2 text-center text-xs font-black text-white hover:bg-slate-600"
                            >
                              Imprimir
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                salvarPdf(
                                  fatura.arquivo_pdf,
                                  nomeArquivoPdf('Fatura', fatura.numero_fatura || embarque.awb)
                                )
                              }
                              className="rounded-lg bg-emerald-700 px-3 py-2 text-center text-xs font-black text-white hover:bg-emerald-600"
                            >
                              Salvar PDF
                            </button>

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

                            {documentosPacoteAdmin(embarque, fatura).length > 0 ? (
                              <span className="rounded-lg border border-purple-500/50 bg-purple-600/10 px-2 py-1 text-center text-[10px] font-black text-purple-200">
                                + {documentosPacoteAdmin(embarque, fatura).length} documento(s)
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

                                {documentosComplementaresDoEmbarque(embarque, fatura).length > 0 ? (
                                  <div className="mt-2 flex flex-col gap-1">
                                    {documentosComplementaresDoEmbarque(embarque, fatura).map((doc: any) => (
                                      <div
                                        key={doc.id || doc.url}
                                        className="rounded-2xl border border-yellow-700 bg-yellow-950/20 p-3"
                                      >
                                        <div className="mb-3">
                                          <p className="text-xs font-black uppercase tracking-widest text-yellow-300">
                                            {labelDocumentoPacoteFatura(doc)}
                                          </p>
                                          <p className="mt-1 text-xs text-slate-300">
                                            Origem: {origemDocumentoPacoteFatura(doc)} • Data: {dataDocumentoPacoteFatura(doc)} • Valor: {valorDocumentoPacoteFatura(doc)}
                                          </p>
                                          {doc.nome ? (
                                            <p className="mt-1 text-xs text-slate-400">{doc.nome}</p>
                                          ) : null}
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                          <a
                                            href={doc.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="rounded-lg bg-blue-600 px-3 py-2 text-center text-[11px] font-black text-white hover:bg-blue-500"
                                          >
                                            Abrir
                                          </a>

                                          {origemDocumentoPacoteFatura(doc) === 'fatura_arquivos' ? (
                                            <button
                                              type="button"
                                              onClick={() => removerAnexoPacoteFatura(doc)}
                                              className="rounded-lg bg-red-600 px-3 py-2 text-center text-[11px] font-black text-white hover:bg-red-500"
                                            >
                                              Remover
                                            </button>
                                          ) : (
                                            <span className="rounded-lg border border-yellow-700 px-3 py-2 text-[11px] font-black text-yellow-200">
                                              Lançada no financeiro
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}

                                  <button
                                    onClick={() => abrirEmissaoFaturaComplementar(embarque)}
                                    className="rounded-xl bg-yellow-600 px-4 py-3 text-xs font-black text-white hover:bg-yellow-500"
                                  >
                                    Emitir complementar
                                  </button>

                            <button
                              type="button"
                              onClick={() => abrirFormulario(embarque)}
                              className="inline-flex rounded-lg bg-purple-600 px-3 py-2 text-xs font-black text-white hover:bg-purple-500"
                            >
                              Anexar PDF pronto
                            </button>

                            {(!fatura?.arquivo_pdf || fatura?.arquivado_admin) ? (
                              <button
                                type="button"
                                data-acao="arquivar-sem-fatura"
                                onClick={() => alternarArquivamentoFaturamento(embarque, fatura)}
                                className={
                                  fatura?.arquivado_admin
                                    ? 'rounded-lg bg-slate-700 px-3 py-2 text-xs font-black text-white hover:bg-slate-600'
                                    : 'rounded-lg bg-yellow-600 px-3 py-2 text-xs font-black text-white hover:bg-yellow-500'
                                }
                              >
                                {fatura?.arquivado_admin ? 'Restaurar' : 'Arquivar'}
                              </button>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td>
                        {fatura?.recibo_pdf ? (
                          <div className="flex flex-col gap-2">
                            <Link
                              href={fatura.recibo_pdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block rounded-lg bg-green-600 px-3 py-2 text-center text-xs font-black text-white hover:bg-green-500"
                            >
                              Abrir
                            </Link>

                            <button
                              type="button"
                              onClick={() => imprimirPdf(fatura.recibo_pdf)}
                              className="rounded-lg bg-slate-700 px-3 py-2 text-center text-xs font-black text-white hover:bg-slate-600"
                            >
                              Imprimir
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                salvarPdf(
                                  fatura.recibo_pdf,
                                  nomeArquivoPdf('Recibo', fatura.numero_fatura || embarque.awb)
                                )
                              }
                              className="rounded-lg bg-emerald-700 px-3 py-2 text-center text-xs font-black text-white hover:bg-emerald-600"
                            >
                              Salvar PDF
                            </button>

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
                              onClick={() => alternarArquivamentoFaturamento(embarque, fatura)}
                              className={
                                fatura.arquivado_admin
                                  ? 'bg-green-700 hover:bg-green-600 px-3 py-2 rounded-lg text-xs font-black'
                                  : 'bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-xs font-black'
                              }
                            >
                              {fatura?.arquivado_admin ? 'Restaurar' : 'Arquivar'}
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
                                  <h3 className="text-xl font-black text-purple-300">Pacote de documentos do AWB</h3>
                                  <p className="text-sm text-slate-400">
                                    Mostra tudo que o cliente enxerga: fatura principal, fatura complementar, boleto, recibo, comprovante e demais anexos.
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

                              {documentosPacoteAdmin(embarque, fatura).length === 0 ? (
                                <p className="text-sm text-slate-500">Nenhum arquivo adicional anexado.</p>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                  {documentosPacoteAdmin(embarque, fatura).map((arquivo) => (
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

function novoItemFaturaAgente(): ItemFaturaAgente {
  return {
    id: `agente-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    descricao: '',
    moeda: 'USD',
    valor_original: '',
    valor_brl: '',
    observacao: '',
  }
}

function itensPadraoFatura(): ItemFaturaServico[] {
  return [
    { id: 'valor_compra', descricao: 'VALOR DE COMPRA', selecionado: false, valor_usd: '', valor_brl: '', observacao: '' },
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
