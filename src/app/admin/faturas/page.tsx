'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import StatusBadge from '@/components/StatusBadge'

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
}

type Fatura = {
  id: string
  embarque_id: string | null
  usuario_id: string | null
  numero_fatura: string | null
  arquivo_pdf: string | null
  recibo_pdf: string | null
  recibo_nome: string | null
  criado_em: string
  visivel_cliente?: boolean | null
  observacoes?: string | null
  embarques?: any
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

export default function FaturasPage() {
  const [embarques, setEmbarques] = useState<Embarque[]>([])
  const [faturas, setFaturas] = useState<Fatura[]>([])
  const [financeiros, setFinanceiros] = useState<FinanceiroProcesso[]>([])
  const [documentosPorEmbarque, setDocumentosPorEmbarque] = useState<Record<string, DocumentoEmbarque[]>>({})
  const [pacoteAbertoId, setPacoteAbertoId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [enviandoRecibo, setEnviandoRecibo] = useState<string | null>(null)
  const [removendoFatura, setRemovendoFatura] = useState<string | null>(null)

  const [busca, setBusca] = useState('')
  const [filtroDocumento, setFiltroDocumento] = useState('TODOS')
  const [filtroStatusEmbarque, setFiltroStatusEmbarque] = useState('TODOS')
  const [filtroPagamento, setFiltroPagamento] = useState('TODOS')

  const [embarqueSelecionado, setEmbarqueSelecionado] = useState<Embarque | null>(null)
  const [numeroFatura, setNumeroFatura] = useState('')
  const [visivelCliente, setVisivelCliente] = useState(true)
  const [observacoes, setObservacoes] = useState('')
  const [arquivoPdf, setArquivoPdf] = useState<File | null>(null)

  useEffect(() => {
    carregar()
  }, [])

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
        criado_em,
        visivel_cliente,
        observacoes,
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

    const { data: financeiroData, error: erroFinanceiro } = await supabase
      .from('financeiro_embarques')
      .select('*')

    if (erroFinanceiro) console.log(erroFinanceiro)

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

    setEmbarques((embarquesData as Embarque[]) || [])
    setFaturas((faturasData as Fatura[]) || [])
    setFinanceiros((financeiroData as FinanceiroProcesso[]) || [])
    setDocumentosPorEmbarque(documentosAgrupados)
  }

  function normalizarAwb(valor?: string | null) {
    return String(valor || '')
      .replace(/\s/g, '')
      .replace(/[.-]/g, '')
      .toUpperCase()
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

    const porEmbarqueId =
      financeiros.find((item) => String(item.embarque_id || '') === String(embarque.id || '')) ||
      null

    if (porEmbarqueId) return porEmbarqueId

    const awbLimpo = normalizarAwb(embarque.awb)
    if (!awbLimpo) return null

    return (
      financeiros.find((item) => {
        const awbsDiretos = awbsFinanceiro(item)
        if (awbsDiretos.includes(awbLimpo)) return true

        // Fallback: se a tabela tiver outro nome de coluna para AWB,
        // procura um valor exatamente igual ao AWB em qualquer campo simples da linha.
        return Object.values(item || {}).some((valor) => normalizarAwb(valor as any) === awbLimpo)
      }) ||
      null
    )
  }

  function valorFinanceiro(item?: FinanceiroProcesso | null) {
    if (!item) return 0

    return (
      numero(item.valor_cobranca) ||
      numero(item.valor_faturado) ||
      numero(item.valor_venda) ||
      numero(item.valor)
    )
  }

  function vencimentoFinanceiro(item?: FinanceiroProcesso | null) {
    if (!item) return null

    // Em Financeiro > Processos Faturados, o campo correto é "vencimento_cliente".
    return (
      item.vencimento_cliente ||
      item.vencimento_cobranca ||
      item.vencimento ||
      item.data_vencimento ||
      null
    )
  }

  function recebimentoFinanceiro(item?: FinanceiroProcesso | null) {
    if (!item) return null

    // Em Financeiro > Processos Faturados, o campo correto é "recebimento".
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

    const recebimento = recebimentoFinanceiro(financeiro)
    const vencimento = vencimentoFinanceiro(financeiro)
    const valor = valorFinanceiro(financeiro)

    if (recebimento) {
      return {
        status: 'PAGO',
        label: `Pago em ${dataBR(recebimento)}`,
        detalhe: moeda(valor),
        classe: 'border-green-500 bg-green-600/20 text-green-300',
      }
    }

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

  function extrairCaminhoStorage(url?: string | null) {
    if (!url) return null
    const marcador = '/storage/v1/object/public/faturas/'
    if (!url.includes(marcador)) return null
    return url.split(marcador)[1] || null
  }

  const embarquesFiltrados = useMemo(() => {
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
        ${documentosDoEmbarque(e.id).map(nomeDocumento).join(' ')}
      `.toLowerCase()

      const passaBusca = texto.includes(busca.toLowerCase())

      const passaDocumento =
        filtroDocumento === 'TODOS' ||
        (filtroDocumento === 'COM_FATURA' && !!fatura?.arquivo_pdf) ||
        (filtroDocumento === 'SEM_FATURA' && !fatura?.arquivo_pdf) ||
        (filtroDocumento === 'COM_RECIBO' && !!fatura?.recibo_pdf) ||
        (filtroDocumento === 'SEM_RECIBO' && !!fatura?.arquivo_pdf && !fatura?.recibo_pdf) ||
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

      return passaBusca && passaDocumento && passaStatusEmbarque && passaPagamento
    })
  }, [
    embarques,
    faturas,
    financeiros,
    documentosPorEmbarque,
    busca,
    filtroDocumento,
    filtroStatusEmbarque,
    filtroPagamento,
  ])

  const totalComFatura = faturas.filter((f) => f.arquivo_pdf).length
  const totalVisiveis = faturas.filter((f) => f.visivel_cliente).length
  const totalRecibos = faturas.filter((f) => f.recibo_pdf).length
  const totalSemFatura = embarques.filter((e) => !faturaDoEmbarque(e.id)?.arquivo_pdf).length

  const pagamentosFinanceiros = embarques.map((e) => ({
    embarque: e,
    fatura: faturaDoEmbarque(e.id),
    financeiro: financeiroDoEmbarque(e),
    pagamento: statusPagamentoFinanceiro(financeiroDoEmbarque(e)),
  }))

  const totalPagos = pagamentosFinanceiros.filter((item) => item.pagamento.status === 'PAGO').length
  const totalAtrasados = pagamentosFinanceiros.filter((item) => item.pagamento.status === 'ATRASADO').length
  const totalEmAberto = pagamentosFinanceiros.filter((item) => item.pagamento.status === 'EM_ABERTO').length
  const totalSemFinanceiro = pagamentosFinanceiros.filter((item) => item.pagamento.status === 'SEM_FINANCEIRO').length
  const statusDisponiveis = statusOperacionaisDisponiveis()

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

        <button
          onClick={() => document.getElementById('tabela_faturas')?.scrollIntoView({ behavior: 'smooth' })}
          className="bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold h-fit"
        >
          Ver embarques
        </button>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <Card titulo="Com fatura" valor={totalComFatura} detalhe="PDF anexado" icone="🧾" />
        <Card titulo="Sem fatura" valor={totalSemFatura} detalhe="Pendente de anexo" icone="📄" />
        <Card titulo="Visíveis" valor={totalVisiveis} detalhe="Cliente pode acessar" icone="👁️" />
        <Card titulo="Com recibo" valor={totalRecibos} detalhe="Recibo anexado" icone="✅" />
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

      <section id="tabela_faturas" className="w-full border border-blue-900 rounded-3xl bg-[#071225] p-5 lg:p-7">
        <div className="flex flex-col lg:flex-row justify-between gap-5 mb-7">
          <div>
            <h2 className="text-2xl font-black">Faturas por embarque</h2>
            <p className="text-slate-400 text-sm">
              Esta tela mostra o pacote do embarque para faturamento: valor fechado, cotação, documentos, fatura, recibo e status financeiro.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 w-full lg:max-w-[1150px]">
            <select value={filtroDocumento} onChange={(e) => setFiltroDocumento(e.target.value)}>
              <option value="TODOS">Documentos: todos</option>
              <option value="COM_FATURA">Com fatura</option>
              <option value="SEM_FATURA">Sem fatura</option>
              <option value="COM_RECIBO">Com recibo</option>
              <option value="SEM_RECIBO">Com fatura sem recibo</option>
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

            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por AWB, cliente, fatura..."
              className="w-full xl:col-span-2"
            />
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
          <table className="w-full min-w-[1720px] border-collapse text-xs lg:text-sm [&_th]:border-b [&_th]:border-blue-900 [&_th]:px-3 [&_th]:py-3 [&_th]:text-left [&_th]:font-black [&_th]:text-slate-300 [&_td]:px-3 [&_td]:py-4 [&_td]:align-middle">
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
                <th>Pagamento</th>
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              {embarquesFiltrados.map((embarque) => {
                const fatura = faturaDoEmbarque(embarque.id)
                const financeiro = financeiroDoEmbarque(embarque)
                const pagamento = statusPagamentoFinanceiro(financeiro)
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
                      <td>{fatura?.numero_fatura || '-'}</td>
                      <td>{dataBR(vencimentoFinanceiro(financeiro))}</td>
                      <td>{fatura?.visivel_cliente ? 'Sim' : 'Não'}</td>
                      <td>
                        {fatura?.arquivo_pdf ? (
                          <Link href={fatura.arquivo_pdf} target="_blank" className="inline-block rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-500">
                            Abrir
                          </Link>
                        ) : (
                          <span className="text-slate-500">Sem fatura</span>
                        )}
                      </td>
                      <td>
                        {fatura?.recibo_pdf ? (
                          <Link href={fatura.recibo_pdf} target="_blank" className="inline-block rounded-lg bg-green-600 px-3 py-2 text-xs font-black text-white hover:bg-green-500">
                            Abrir
                          </Link>
                        ) : fatura?.arquivo_pdf ? (
                          <label className="inline-flex cursor-pointer rounded-lg bg-green-600 px-3 py-2 text-xs font-black text-white hover:bg-green-500">
                            {enviandoRecibo === embarque.id ? 'Enviando...' : 'Anexar'}
                            <input
                              type="file"
                              accept="application/pdf"
                              disabled={enviandoRecibo === embarque.id}
                              onChange={(e) => anexarRecibo(embarque, e.target.files?.[0] || null)}
                              className="hidden"
                            />
                          </label>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td>
                        <span className={`inline-flex flex-col rounded-xl border px-2 py-1 text-[11px] font-black ${pagamento.classe}`}>
                          <span>{pagamento.label}</span>
                          {financeiro ? (
                            <span className="opacity-80 font-bold">{pagamento.detalhe}</span>
                          ) : null}
                        </span>
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

                          <button onClick={() => abrirFormulario(embarque)} className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg text-xs font-black">
                            {fatura ? 'Editar' : 'Anexar'}
                          </button>

                          {fatura && (
                            <button onClick={() => alternarVisibilidade(fatura)} className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-xs font-black">
                              {fatura.visivel_cliente ? 'Ocultar' : 'Mostrar'}
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
                        <td colSpan={13} className="p-5">
                          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
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
                                <InfoPacote label="Vencimento financeiro" valor={dataBR(vencimentoFinanceiro(financeiro))} />
                                <InfoPacote label="Recebimento" valor={dataBR(recebimentoFinanceiro(financeiro))} />
                              </div>
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
    </main>
  )
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

function Card({ titulo, valor, detalhe, icone }: any) {
  return (
    <div className="border border-blue-900 rounded-3xl bg-[#071225] p-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <p className="text-slate-300 font-bold">{titulo}</p>
          <h2 className="text-5xl font-black mt-4 text-white">{valor}</h2>
          <p className="text-slate-400 mt-2">{detalhe}</p>
        </div>

        <div className="text-4xl">{icone}</div>
      </div>
    </div>
  )
}
