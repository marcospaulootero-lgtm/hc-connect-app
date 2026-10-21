// HC_RECEBIMENTOS_FILTROS_V1
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type RepasseParceiro = {
  id: string
  awb: string | null
  cliente: string | null
  servico: string | null
  parceiro: string | null
  debito_terceiro: number | string | null
  pgta_terceiros: string | null
  mes_pgto: string | null
  observacao_parceiro: string | null
  liberado_parceiro_em: string | null
  atualizado_em: string | null
  processo_pago?: boolean | null
  data_recebimento?: string | null
  solicitacao_id?: string | null
  solicitacao_status?: string | null
  solicitado_em?: string | null
  observacao_solicitacao?: string | null
}

type FiltroStatus = 'TODOS' | 'PENDENTE' | 'PAGO'
type FiltroArquivamento = 'ATIVOS' | 'ARQUIVADOS' | 'TODOS'

const MESES = [
  { valor: '01', label: 'Janeiro', aliases: ['jan', 'janeiro', 'january'] },
  { valor: '02', label: 'Fevereiro', aliases: ['fev', 'fevereiro', 'feb', 'february'] },
  { valor: '03', label: 'Março', aliases: ['mar', 'marco', 'march'] },
  { valor: '04', label: 'Abril', aliases: ['abr', 'abril', 'apr', 'april'] },
  { valor: '05', label: 'Maio', aliases: ['mai', 'maio', 'may'] },
  { valor: '06', label: 'Junho', aliases: ['jun', 'junho', 'june'] },
  { valor: '07', label: 'Julho', aliases: ['jul', 'julho', 'july'] },
  { valor: '08', label: 'Agosto', aliases: ['ago', 'agosto', 'aug', 'august'] },
  { valor: '09', label: 'Setembro', aliases: ['set', 'setembro', 'sep', 'sept', 'september'] },
  { valor: '10', label: 'Outubro', aliases: ['out', 'outubro', 'oct', 'october'] },
  { valor: '11', label: 'Novembro', aliases: ['nov', 'novembro', 'november'] },
  { valor: '12', label: 'Dezembro', aliases: ['dez', 'dezembro', 'dec', 'december'] },
] as const

export default function RecebimentosParceiroPage() {
  const [repasses, setRepasses] = useState<RepasseParceiro[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<FiltroStatus>('TODOS')
  const [mesFiltro, setMesFiltro] = useState('TODOS')
  const [anoFiltro, setAnoFiltro] = useState('TODOS')
  const [filtroArquivamento, setFiltroArquivamento] = useState<FiltroArquivamento>('ATIVOS')
  const [solicitandoId, setSolicitandoId] = useState<string | null>(null)
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [arquivados, setArquivados] = useState<Record<string, string>>({})
  const [arquivamentoDisponivel, setArquivamentoDisponivel] = useState(true)
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [processandoArquivamento, setProcessandoArquivamento] = useState(false)

  useEffect(() => {
    carregar()
  }, [])

  useEffect(() => {
    setSelecionados([])
  }, [busca, statusFiltro, mesFiltro, anoFiltro, filtroArquivamento])

  async function carregar() {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.replace('/')
      return
    }

    setUsuarioId(user.id)

    const [repassesResultado, arquivadosResultado] = await Promise.all([
      supabase.rpc('get_meus_repasses_parceiro'),
      supabase
        .from('repasses_arquivados_clientes')
        .select('financeiro_id, arquivado_em')
        .eq('cliente_id', user.id),
    ])

    const { data, error } = repassesResultado

    if (error) {
      console.log('ERRO REPASSES PARCEIRO:', error)
      alert(
        'Não foi possível carregar seus recebimentos. Confira se o SQL do portal de parceiros foi executado.'
      )
      setRepasses([])
      setLoading(false)
      return
    }

    setRepasses((data as RepasseParceiro[]) || [])

    if (arquivadosResultado.error) {
      console.log('ERRO ARQUIVAMENTO DE RECEBIMENTOS:', arquivadosResultado.error)
      setArquivados({})
      setArquivamentoDisponivel(false)
      setFiltroArquivamento('ATIVOS')
    } else {
      const mapa: Record<string, string> = {}

      for (const item of arquivadosResultado.data || []) {
        if (!item?.financeiro_id) continue
        mapa[String(item.financeiro_id)] = String(item.arquivado_em || '')
      }

      setArquivados(mapa)
      setArquivamentoDisponivel(true)
    }

    setSelecionados([])
    setLoading(false)
  }

  async function solicitarProfit(item: RepasseParceiro) {
    if (!item?.id) return

    if (!item.processo_pago) {
      alert('Este profit ainda não pode ser solicitado porque o processo ainda não consta como pago pela HC.')
      return
    }

    if (statusRepasse(item) === 'PAGO') {
      alert('Este profit já consta como pago no portal.')
      return
    }

    if (
      item.solicitacao_status &&
      !['RECUSADO', 'CANCELADO'].includes(String(item.solicitacao_status).toUpperCase())
    ) {
      alert('Este profit já possui uma solicitação em andamento.')
      return
    }

    const confirmar = confirm(
      `Solicitar pagamento deste profit?\n\nAWB: ${item.awb || '-'}\nValor: ${moeda(item.debito_terceiro)}\n\nA HC receberá sua solicitação para análise.`
    )

    if (!confirmar) return

    setSolicitandoId(item.id)

    const { data, error } = await supabase.rpc('solicitar_repasse_parceiro', {
      financeiro_id: item.id,
      mensagem: null,
    })

    if (error) {
      console.log('ERRO SOLICITAR PROFIT:', error)
      alert('Erro ao solicitar profit: ' + error.message)
      setSolicitandoId(null)
      return
    }

    const retorno = Array.isArray(data) ? data[0] : data

    if (retorno?.ok === false) {
      alert(retorno?.mensagem || 'Não foi possível solicitar este profit.')
      setSolicitandoId(null)
      return
    }

    alert(retorno?.mensagem || 'Solicitação enviada para a HC.')
    await carregar()
    setSolicitandoId(null)
  }

  function numero(valor: any) {
    if (valor === null || valor === undefined || valor === '') return 0
    if (typeof valor === 'number') return valor

    return (
      Number(
        String(valor)
          .replace(/[R$\s]/gi, '')
          .replace(/\./g, '')
          .replace(',', '.')
      ) || 0
    )
  }

  function moeda(valor: any) {
    return numero(valor).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  function normalizarTexto(valor: any) {
    return String(valor || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  }

  function dataBR(data?: string | null) {
    if (!data) return '-'
    const valor = new Date(data)
    if (Number.isNaN(valor.getTime())) return '-'
    return valor.toLocaleDateString('pt-BR')
  }

  function dataReferenciaRepasse(item: RepasseParceiro) {
    const candidatos = [
      item.data_recebimento,
      item.liberado_parceiro_em,
      item.atualizado_em,
    ]

    for (const candidato of candidatos) {
      if (!candidato) continue
      const data = new Date(candidato)
      if (!Number.isNaN(data.getTime())) return data
    }

    return null
  }

  function mesRepasse(item: RepasseParceiro) {
    const texto = normalizarTexto(item.mes_pgto)

    if (texto) {
      for (const mes of MESES) {
        if (mes.aliases.some((alias) => texto.includes(alias))) return mes.valor
      }

      const numerico = texto.match(/(?:^|[^0-9])(0?[1-9]|1[0-2])(?:[^0-9]|$)/)
      if (numerico?.[1]) return String(Number(numerico[1])).padStart(2, '0')
    }

    const data = dataReferenciaRepasse(item)
    if (!data) return ''
    return String(data.getMonth() + 1).padStart(2, '0')
  }

  function anoRepasse(item: RepasseParceiro) {
    const texto = String(item.mes_pgto || '')
    const anoNoMes = texto.match(/\b(19\d{2}|20\d{2}|21\d{2})\b/)
    if (anoNoMes?.[1]) return anoNoMes[1]

    const data = dataReferenciaRepasse(item)
    if (!data) return ''
    return String(data.getFullYear())
  }

  function statusRepasse(item: RepasseParceiro) {
    const status = normalizarTexto(item.pgta_terceiros).toUpperCase()
    return status.includes('PAGO') ? 'PAGO' : 'PENDENTE'
  }

  function labelSolicitacao(item: RepasseParceiro) {
    const status = String(item.solicitacao_status || '').toUpperCase()

    if (!status) return '-'
    if (status === 'SOLICITADO') return 'Solicitado'
    if (status === 'EM_ANALISE') return 'Em análise'
    if (status === 'APROVADO') return 'Aprovado'
    if (status === 'RECUSADO') return 'Recusado'
    if (status === 'PAGO') return 'Pago'
    if (status === 'CANCELADO') return 'Cancelado'

    return status
  }

  function classeSolicitacao(item: RepasseParceiro) {
    const status = String(item.solicitacao_status || '').toUpperCase()

    if (status === 'PAGO' || status === 'APROVADO') {
      return 'border-green-500 bg-green-600/20 text-green-300'
    }
    if (status === 'RECUSADO' || status === 'CANCELADO') {
      return 'border-red-500 bg-red-600/20 text-red-300'
    }
    if (status === 'SOLICITADO' || status === 'EM_ANALISE') {
      return 'border-yellow-500 bg-yellow-500/20 text-yellow-300'
    }

    return 'border-slate-600 bg-slate-700/20 text-slate-300'
  }

  function podeSolicitarProfit(item: RepasseParceiro) {
    if (!item.processo_pago) return false
    if (statusRepasse(item) === 'PAGO') return false

    const status = String(item.solicitacao_status || '').toUpperCase()
    if (['SOLICITADO', 'EM_ANALISE', 'APROVADO'].includes(status)) return false

    return true
  }

  function estaArquivado(item: RepasseParceiro) {
    return !!arquivados[String(item.id)]
  }

  function totalLista(lista: RepasseParceiro[]) {
    return lista.reduce((acc, item) => acc + numero(item.debito_terceiro), 0)
  }

  function resumoLista(lista: RepasseParceiro[]) {
    const pendentes = lista.filter((item) => statusRepasse(item) !== 'PAGO')
    const pagos = lista.filter((item) => statusRepasse(item) === 'PAGO')

    return {
      total: totalLista(lista),
      aReceber: totalLista(pendentes),
      recebido: totalLista(pagos),
      qtd: lista.length,
      qtdPendentes: pendentes.length,
      qtdPagos: pagos.length,
    }
  }

  const anosDisponiveis = useMemo(() => {
    return Array.from(
      new Set(repasses.map((item) => anoRepasse(item)).filter(Boolean))
    ).sort((a, b) => Number(b) - Number(a))
  }, [repasses])

  const filtrados = useMemo(() => {
    const termo = normalizarTexto(busca)

    return repasses.filter((item) => {
      const status = statusRepasse(item)
      const arquivado = estaArquivado(item)

      if (statusFiltro === 'PAGO' && status !== 'PAGO') return false
      if (statusFiltro === 'PENDENTE' && status !== 'PENDENTE') return false

      if (mesFiltro !== 'TODOS' && mesRepasse(item) !== mesFiltro) return false
      if (anoFiltro !== 'TODOS' && anoRepasse(item) !== anoFiltro) return false

      if (filtroArquivamento === 'ATIVOS' && arquivado) return false
      if (filtroArquivamento === 'ARQUIVADOS' && !arquivado) return false

      const texto = normalizarTexto(`
        ${item.awb || ''}
        ${item.cliente || ''}
        ${item.servico || ''}
        ${item.parceiro || ''}
        ${item.pgta_terceiros || ''}
        ${item.mes_pgto || ''}
        ${item.observacao_parceiro || ''}
      `)

      return !termo || texto.includes(termo)
    })
  }, [repasses, arquivados, busca, statusFiltro, mesFiltro, anoFiltro, filtroArquivamento])

  const resumo = useMemo(() => {
    const base = resumoLista(repasses)

    return {
      ...base,
      qtdSolicitados: repasses.filter(
        (item) =>
          !!item.solicitacao_status &&
          !['RECUSADO', 'CANCELADO'].includes(
            String(item.solicitacao_status).toUpperCase()
          )
      ).length,
    }
  }, [repasses])

  const resumoFiltrado = useMemo(() => resumoLista(filtrados), [filtrados])

  const selecionadosItens = useMemo(() => {
    const ids = new Set(selecionados)
    return filtrados.filter((item) => ids.has(String(item.id)))
  }, [filtrados, selecionados])

  const totalSelecionado = useMemo(
    () => totalLista(selecionadosItens),
    [selecionadosItens]
  )

  const todosFiltradosSelecionados =
    filtrados.length > 0 && filtrados.every((item) => selecionados.includes(String(item.id)))

  function alternarSelecionado(id: string) {
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]
    )
  }

  function alternarTodosFiltrados() {
    if (todosFiltradosSelecionados) {
      const idsFiltrados = new Set(filtrados.map((item) => String(item.id)))
      setSelecionados((atual) => atual.filter((id) => !idsFiltrados.has(id)))
      return
    }

    setSelecionados((atual) =>
      Array.from(new Set([...atual, ...filtrados.map((item) => String(item.id))]))
    )
  }

  function grupos<T>(lista: T[], tamanho = 100) {
    const resultado: T[][] = []
    for (let i = 0; i < lista.length; i += tamanho) {
      resultado.push(lista.slice(i, i + tamanho))
    }
    return resultado
  }

  async function arquivarLista(lista: RepasseParceiro[], origem: string) {
    if (!usuarioId || processandoArquivamento) return

    if (!arquivamentoDisponivel) {
      alert('O arquivamento ainda não está disponível. Execute primeiro o SQL de arquivamento no Supabase.')
      return
    }

    const itens = lista.filter((item) => !estaArquivado(item))
    if (itens.length === 0) {
      alert('Nenhum recebimento ativo foi selecionado para arquivar.')
      return
    }

    const total = totalLista(itens)
    const confirmar = confirm(
      `Arquivar ${itens.length} recebimento(s) ${origem}?\n\nTotal: ${moeda(total)}\n\nEles sairão da visão Ativos, mas continuarão disponíveis em Arquivados.`
    )

    if (!confirmar) return

    setProcessandoArquivamento(true)
    const agora = new Date().toISOString()

    for (const grupo of grupos(itens, 100)) {
      const { error } = await supabase
        .from('repasses_arquivados_clientes')
        .upsert(
          grupo.map((item) => ({
            financeiro_id: String(item.id),
            cliente_id: usuarioId,
            arquivado_em: agora,
          })),
          { onConflict: 'financeiro_id,cliente_id' }
        )

      if (error) {
        console.log('ERRO ARQUIVAR RECEBIMENTOS:', error)
        alert(`Erro ao arquivar recebimentos: ${error.message}`)
        setProcessandoArquivamento(false)
        return
      }
    }

    setArquivados((atual) => {
      const proximo = { ...atual }
      for (const item of itens) proximo[String(item.id)] = agora
      return proximo
    })
    setSelecionados([])
    setProcessandoArquivamento(false)
  }

  async function restaurarLista(lista: RepasseParceiro[], origem: string) {
    if (!usuarioId || processandoArquivamento) return

    if (!arquivamentoDisponivel) {
      alert('O arquivamento ainda não está disponível. Execute primeiro o SQL de arquivamento no Supabase.')
      return
    }

    const itens = lista.filter((item) => estaArquivado(item))
    if (itens.length === 0) {
      alert('Nenhum recebimento arquivado foi selecionado para restaurar.')
      return
    }

    const total = totalLista(itens)
    const confirmar = confirm(
      `Restaurar ${itens.length} recebimento(s) ${origem}?\n\nTotal: ${moeda(total)}\n\nEles voltarão para a visão Ativos.`
    )

    if (!confirmar) return

    setProcessandoArquivamento(true)

    for (const grupo of grupos(itens.map((item) => String(item.id)), 100)) {
      const { error } = await supabase
        .from('repasses_arquivados_clientes')
        .delete()
        .eq('cliente_id', usuarioId)
        .in('financeiro_id', grupo)

      if (error) {
        console.log('ERRO RESTAURAR RECEBIMENTOS:', error)
        alert(`Erro ao restaurar recebimentos: ${error.message}`)
        setProcessandoArquivamento(false)
        return
      }
    }

    setArquivados((atual) => {
      const proximo = { ...atual }
      for (const item of itens) delete proximo[String(item.id)]
      return proximo
    })
    setSelecionados([])
    setProcessandoArquivamento(false)
  }

  function limparFiltros() {
    setBusca('')
    setStatusFiltro('TODOS')
    setMesFiltro('TODOS')
    setAnoFiltro('TODOS')
    setFiltroArquivamento('ATIVOS')
    setSelecionados([])
  }

  async function gerarPdfCliente(
    lista: RepasseParceiro[],
    origem: 'FILTRO' | 'SELECIONADOS' = 'FILTRO'
  ) {
    if (lista.length === 0) return

    try {
      const { default: jsPDF } = await import('jspdf')
      const autoTableModule: any = await import('jspdf-autotable')
      const autoTable = autoTableModule.default || autoTableModule

      const dataGeracao = new Date().toLocaleString('pt-BR')
      const parceiroNome = lista.find((item) => item.parceiro)?.parceiro || 'Parceiro'
      const nomeArquivo = String(parceiroNome || 'recebimentos')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      const resumoPdf = resumoLista(lista)
      const mesLabel =
        mesFiltro === 'TODOS'
          ? 'Todos'
          : MESES.find((item) => item.valor === mesFiltro)?.label || mesFiltro
      const arquivamentoLabel =
        filtroArquivamento === 'ATIVOS'
          ? 'Ativos'
          : filtroArquivamento === 'ARQUIVADOS'
          ? 'Arquivados'
          : 'Todos'

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margem = 12

      doc.setFillColor(2, 12, 34)
      doc.rect(0, 0, pageWidth, 24, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.text('HC Consultoria', margem, 15)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text('Relatorio de Recebimentos', pageWidth - margem, 15, { align: 'right' })

      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(17)
      doc.text(
        origem === 'SELECIONADOS'
          ? 'Recebimentos selecionados'
          : 'Recebimentos liberados pela HC',
        margem,
        36
      )

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(71, 85, 105)
      doc.text(`Parceiro: ${parceiroNome}`, margem, 44)
      doc.text(`Status: ${statusFiltro} | Mes: ${mesLabel} | Ano: ${anoFiltro}`, margem, 50)
      doc.text(`Exibicao: ${arquivamentoLabel} | Busca: ${busca || '-'}`, margem, 56)
      doc.text(`Gerado em: ${dataGeracao}`, pageWidth - margem, 44, { align: 'right' })
      doc.text(`Origem: ${origem === 'SELECIONADOS' ? 'selecionados' : 'filtro atual'}`, pageWidth - margem, 50, {
        align: 'right',
      })

      autoTable(doc, {
        startY: 64,
        margin: { left: margem, right: margem },
        head: [['Total', 'A receber', 'Recebido', 'Pendentes', 'Pagos', 'Processos']],
        body: [[
          moeda(resumoPdf.total),
          moeda(resumoPdf.aReceber),
          moeda(resumoPdf.recebido),
          String(resumoPdf.qtdPendentes),
          String(resumoPdf.qtdPagos),
          String(resumoPdf.qtd),
        ]],
        theme: 'grid',
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: {
          halign: 'center',
          fontStyle: 'bold',
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 2.6,
          overflow: 'linebreak',
        },
      })

      const linhas = lista.map((item) => {
        const status = statusRepasse(item)

        return [
          item.awb || '-',
          item.cliente || '-',
          item.servico || '-',
          moeda(item.debito_terceiro),
          status === 'PAGO' ? 'PAGO' : 'A RECEBER',
          item.mes_pgto || '-',
          anoRepasse(item) || '-',
          item.processo_pago ? 'SIM' : 'NAO',
          labelSolicitacao(item),
          item.observacao_parceiro || '-',
        ]
      })

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        margin: { left: margem, right: margem },
        head: [[
          'AWB',
          'Cliente',
          'Servico',
          'Valor',
          'Status',
          'Mes pgto',
          'Ano',
          'Processo pago',
          'Solicitacao',
          'Observacao HC',
        ]],
        body: linhas,
        theme: 'striped',
        tableWidth: pageWidth - margem * 2,
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'left',
        },
        styles: {
          fontSize: 6.8,
          cellPadding: 1.9,
          overflow: 'linebreak',
          minCellHeight: 7,
        },
        didDrawPage: () => {
          doc.setFontSize(8)
          doc.setTextColor(100, 116, 139)
          doc.text('Relatorio gerado automaticamente pelo HC Connect', margem, pageHeight - 8)
          doc.text(`Pagina ${doc.getNumberOfPages()}`, pageWidth - margem, pageHeight - 8, {
            align: 'right',
          })
        },
      })

      const sufixo = origem === 'SELECIONADOS' ? '-selecionados' : '-filtro'
      doc.save(`recebimentos-hc-${nomeArquivo || 'parceiro'}${sufixo}.pdf`)
    } catch (error: any) {
      console.log('ERRO PDF RECEBIMENTOS:', error)
      alert(
        'Erro ao gerar PDF: ' +
          (error?.message || 'erro desconhecido') +
          '\n\nConfira se as dependências jspdf e jspdf-autotable estão instaladas.'
      )
    }
  }

  const qtdArquivados = Object.keys(arquivados).length

  return (
    <main className="min-h-screen bg-[#020817] p-4 text-white sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-none">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-2 font-black text-blue-400">Financeiro</p>
            <h1 className="mb-2 text-4xl font-black lg:text-5xl">Recebimentos</h1>
            <p className="max-w-3xl text-lg text-slate-400">
              Acompanhe os repasses liberados pela HC para o seu login. Valores ocultos pela HC não aparecem nesta tela.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={carregar}
              className="rounded-xl bg-blue-600 px-5 py-3 font-black text-white hover:bg-blue-500"
            >
              Atualizar
            </button>

            <button
              type="button"
              onClick={() => gerarPdfCliente(filtrados, 'FILTRO')}
              disabled={loading || filtrados.length === 0}
              className="rounded-xl bg-green-600 px-5 py-3 font-black text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              📄 Gerar PDF
            </button>

            <Link
              href="/cliente"
              className="rounded-xl bg-slate-700 px-5 py-3 font-black text-white hover:bg-slate-600"
            >
              Voltar ao portal
            </Link>
          </div>
        </div>

        <section className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3 xl:grid-cols-6">
          <Card titulo="Total liberado" valor={moeda(resumo.total)} detalhe={`${resumo.qtd} processos`} icone="🤝" />
          <Card titulo="A receber" valor={moeda(resumo.aReceber)} detalhe={`${resumo.qtdPendentes} pendentes`} icone="💰" destaque="yellow" />
          <Card titulo="Recebido" valor={moeda(resumo.recebido)} detalhe={`${resumo.qtdPagos} pagos`} icone="✅" destaque="green" />
          <Card titulo="Pendentes" valor={String(resumo.qtdPendentes)} detalhe="Aguardando pagamento" icone="⏳" />
          <Card titulo="Histórico" valor={String(resumo.qtdPagos)} detalhe="Pagamentos concluídos" icone="🧾" />
          <Card titulo="Solicitados" valor={String(resumo.qtdSolicitados)} detalhe="Pedidos enviados" icone="📨" destaque="yellow" />
        </section>

        <section className="w-full rounded-3xl border border-blue-900 bg-[#071225] p-4 sm:p-5 lg:p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-black">Repasses liberados</h2>
            <p className="text-sm text-slate-400">
              Filtre por período, status e arquivamento. A solicitação de profit só fica disponível quando o processo consta como pago.
            </p>
          </div>

          {!arquivamentoDisponivel && (
            <div className="mb-5 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm font-bold text-yellow-200">
              ⚠️ O histórico de arquivamento ainda não está disponível neste banco. Execute o SQL entregue com este patch no Supabase. Os recebimentos continuam visíveis normalmente.
            </div>
          )}

          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_2fr_auto]">
            <select
              value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}
              className="rounded-xl border border-blue-900 bg-[#020817] px-4 py-3 font-bold text-white outline-none"
            >
              <option value="TODOS">Mês: todos</option>
              {MESES.map((mes) => (
                <option key={mes.valor} value={mes.valor}>
                  {mes.label}
                </option>
              ))}
            </select>

            <select
              value={anoFiltro}
              onChange={(e) => setAnoFiltro(e.target.value)}
              className="rounded-xl border border-blue-900 bg-[#020817] px-4 py-3 font-bold text-white outline-none"
            >
              <option value="TODOS">Ano: todos</option>
              {anosDisponiveis.map((ano) => (
                <option key={ano} value={ano}>
                  {ano}
                </option>
              ))}
            </select>

            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value as FiltroStatus)}
              className="rounded-xl border border-blue-900 bg-[#020817] px-4 py-3 font-bold text-white outline-none"
            >
              <option value="TODOS">Status: todos</option>
              <option value="PENDENTE">Status: pendente</option>
              <option value="PAGO">Status: pago</option>
            </select>

            <select
              value={filtroArquivamento}
              onChange={(e) => setFiltroArquivamento(e.target.value as FiltroArquivamento)}
              disabled={!arquivamentoDisponivel}
              className="rounded-xl border border-blue-900 bg-[#020817] px-4 py-3 font-bold text-white outline-none disabled:opacity-50"
            >
              <option value="ATIVOS">Exibição: ativos</option>
              <option value="ARQUIVADOS">Exibição: arquivados</option>
              <option value="TODOS">Exibição: todos</option>
            </select>

            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por AWB, cliente, serviço, parceiro..."
              className="w-full rounded-xl border border-blue-900 bg-[#020817] px-4 py-3 text-white outline-none placeholder:text-slate-500"
            />

            <button
              type="button"
              onClick={limparFiltros}
              className="rounded-xl border border-blue-700 bg-blue-600/10 px-4 py-3 text-sm font-black text-blue-300 hover:bg-blue-600/20"
            >
              Limpar filtros
            </button>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <ResumoFiltro
              titulo="Filtrados"
              valor={moeda(resumoFiltrado.total)}
              detalhe={`${resumoFiltrado.qtd} processo(s)`}
            />
            <ResumoFiltro
              titulo="Selecionados"
              valor={moeda(totalSelecionado)}
              detalhe={`${selecionadosItens.length} processo(s)`}
              destaque={selecionadosItens.length > 0}
            />
            <ResumoFiltro
              titulo="Arquivados"
              valor={String(qtdArquivados)}
              detalhe="ocultos da visão Ativos"
            />
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-blue-900 bg-[#020817] p-3">
            <button
              type="button"
              onClick={alternarTodosFiltrados}
              disabled={filtrados.length === 0}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {todosFiltradosSelecionados ? 'Desmarcar filtrados' : 'Selecionar filtrados'}
            </button>

            <button
              type="button"
              onClick={() => setSelecionados([])}
              disabled={selecionadosItens.length === 0}
              className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-black text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              Limpar seleção
            </button>

            <button
              type="button"
              onClick={() => gerarPdfCliente(filtrados, 'FILTRO')}
              disabled={filtrados.length === 0}
              className="rounded-xl border border-green-500/40 bg-green-600/20 px-4 py-2 text-sm font-black text-green-300 hover:bg-green-600/30 disabled:opacity-50"
            >
              PDF do filtro
            </button>

            <button
              type="button"
              onClick={() => gerarPdfCliente(selecionadosItens, 'SELECIONADOS')}
              disabled={selecionadosItens.length === 0}
              className="rounded-xl border border-green-500/40 bg-green-600/20 px-4 py-2 text-sm font-black text-green-300 hover:bg-green-600/30 disabled:opacity-50"
            >
              PDF selecionados
            </button>

            {filtroArquivamento !== 'ARQUIVADOS' && (
              <>
                <button
                  type="button"
                  onClick={() => arquivarLista(selecionadosItens, 'selecionado(s)')}
                  disabled={!arquivamentoDisponivel || processandoArquivamento || selecionadosItens.length === 0}
                  className="rounded-xl border border-purple-500/40 bg-purple-600/20 px-4 py-2 text-sm font-black text-purple-300 hover:bg-purple-600/30 disabled:opacity-50"
                >
                  Arquivar selecionados
                </button>

                <button
                  type="button"
                  onClick={() => arquivarLista(filtrados, 'do filtro atual')}
                  disabled={!arquivamentoDisponivel || processandoArquivamento || filtrados.length === 0}
                  className="rounded-xl border border-purple-500/40 px-4 py-2 text-sm font-black text-purple-300 hover:bg-purple-600/10 disabled:opacity-50"
                >
                  Arquivar filtrados
                </button>
              </>
            )}

            {filtroArquivamento !== 'ATIVOS' && (
              <>
                <button
                  type="button"
                  onClick={() => restaurarLista(selecionadosItens, 'selecionado(s)')}
                  disabled={!arquivamentoDisponivel || processandoArquivamento || selecionadosItens.length === 0}
                  className="rounded-xl border border-cyan-500/40 bg-cyan-600/20 px-4 py-2 text-sm font-black text-cyan-300 hover:bg-cyan-600/30 disabled:opacity-50"
                >
                  Restaurar selecionados
                </button>

                {filtroArquivamento === 'ARQUIVADOS' && (
                  <button
                    type="button"
                    onClick={() => restaurarLista(filtrados, 'do filtro atual')}
                    disabled={!arquivamentoDisponivel || processandoArquivamento || filtrados.length === 0}
                    className="rounded-xl border border-cyan-500/40 px-4 py-2 text-sm font-black text-cyan-300 hover:bg-cyan-600/10 disabled:opacity-50"
                  >
                    Restaurar filtrados
                  </button>
                )}
              </>
            )}

            {processandoArquivamento && (
              <span className="text-sm font-bold text-yellow-300">Processando...</span>
            )}
          </div>

          <p className="mb-5 text-xs text-slate-500">
            O mês usa “Mês pagamento”. Quando esse campo não traz o ano, o filtro de ano usa a data disponível do repasse retornada pelo portal.
          </p>

          {loading ? (
            <div className="rounded-2xl border border-blue-900 bg-[#020817] p-6 text-slate-400">
              Carregando recebimentos...
            </div>
          ) : filtrados.length === 0 ? (
            <div className="rounded-2xl border border-blue-900 bg-[#020817] p-6 text-slate-400">
              Nenhum recebimento disponível para este filtro.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px] text-sm">
                <thead className="bg-[#020817] text-slate-400">
                  <tr>
                    <Th>
                      <input
                        type="checkbox"
                        checked={todosFiltradosSelecionados}
                        onChange={alternarTodosFiltrados}
                        aria-label="Selecionar todos os recebimentos filtrados"
                        className="h-4 w-4 accent-blue-600"
                      />
                    </Th>
                    <Th>AWB</Th>
                    <Th>Cliente</Th>
                    <Th>Serviço</Th>
                    <Th>Parceiro</Th>
                    <Th>Valor a receber</Th>
                    <Th>Status</Th>
                    <Th>Processo pago</Th>
                    <Th>Solicitação</Th>
                    <Th>Mês pagamento</Th>
                    <Th>Ano</Th>
                    <Th>Observação HC</Th>
                    <Th>Ação</Th>
                  </tr>
                </thead>

                <tbody>
                  {filtrados.map((item) => {
                    const status = statusRepasse(item)
                    const itemArquivado = estaArquivado(item)
                    const itemSelecionado = selecionados.includes(String(item.id))

                    return (
                      <tr
                        key={item.id}
                        className={`border-b border-blue-950 hover:bg-[#0b1730] ${
                          itemSelecionado ? 'bg-blue-950/40' : ''
                        }`}
                      >
                        <Td>
                          <input
                            type="checkbox"
                            checked={itemSelecionado}
                            onChange={() => alternarSelecionado(String(item.id))}
                            aria-label={`Selecionar recebimento ${item.awb || item.id}`}
                            className="h-4 w-4 accent-blue-600"
                          />
                        </Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <span>{item.awb || '-'}</span>
                            {itemArquivado && (
                              <span className="rounded-full border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 text-[10px] font-black text-purple-300">
                                ARQUIVADO
                              </span>
                            )}
                          </div>
                        </Td>
                        <Td>{item.cliente || '-'}</Td>
                        <Td>{item.servico || '-'}</Td>
                        <Td>{item.parceiro || '-'}</Td>
                        <Td>
                          <span className="font-black text-white">
                            {moeda(item.debito_terceiro)}
                          </span>
                        </Td>
                        <Td>
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black ${
                              status === 'PAGO'
                                ? 'border-green-500 bg-green-600/20 text-green-300'
                                : 'border-yellow-500 bg-yellow-500/20 text-yellow-300'
                            }`}
                          >
                            {status === 'PAGO' ? 'PAGO' : 'A RECEBER'}
                          </span>
                        </Td>
                        <Td>
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black ${
                              item.processo_pago
                                ? 'border-green-500 bg-green-600/20 text-green-300'
                                : 'border-slate-600 bg-slate-700/20 text-slate-300'
                            }`}
                            title={item.data_recebimento || ''}
                          >
                            {item.processo_pago ? 'SIM' : 'NÃO'}
                          </span>
                        </Td>
                        <Td>
                          {item.solicitacao_status ? (
                            <div className="space-y-1">
                              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${classeSolicitacao(item)}`}>
                                {labelSolicitacao(item)}
                              </span>
                              <p className="text-xs text-slate-500">{dataBR(item.solicitado_em)}</p>
                            </div>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </Td>
                        <Td>{item.mes_pgto || '-'}</Td>
                        <Td>{anoRepasse(item) || '-'}</Td>
                        <Td>{item.observacao_parceiro || '-'}</Td>
                        <Td>
                          <div className="flex flex-wrap items-center gap-2">
                            {status === 'PAGO' ? (
                              <span className="text-xs font-bold text-green-300">Profit pago</span>
                            ) : podeSolicitarProfit(item) ? (
                              <button
                                type="button"
                                onClick={() => solicitarProfit(item)}
                                disabled={solicitandoId === item.id}
                                className="rounded-xl bg-yellow-500 px-4 py-2 text-xs font-black text-black hover:bg-yellow-400 disabled:opacity-50"
                              >
                                {solicitandoId === item.id ? 'Solicitando...' : 'Solicitar profit'}
                              </button>
                            ) : item.processo_pago ? (
                              <span className="text-xs font-bold text-yellow-300">Já solicitado</span>
                            ) : (
                              <span className="text-xs font-bold text-slate-500">Aguardando pagamento</span>
                            )}

                            {arquivamentoDisponivel && (
                              itemArquivado ? (
                                <button
                                  type="button"
                                  onClick={() => restaurarLista([item], '')}
                                  disabled={processandoArquivamento}
                                  className="rounded-xl border border-cyan-500/40 px-3 py-2 text-xs font-black text-cyan-300 hover:bg-cyan-600/10 disabled:opacity-50"
                                >
                                  Restaurar
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => arquivarLista([item], '')}
                                  disabled={processandoArquivamento}
                                  className="rounded-xl border border-purple-500/40 px-3 py-2 text-xs font-black text-purple-300 hover:bg-purple-600/10 disabled:opacity-50"
                                >
                                  Arquivar
                                </button>
                              )
                            )}
                          </div>
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function Card({ titulo, valor, detalhe, icone, destaque }: any) {
  const cor =
    destaque === 'green'
      ? 'border-green-500/40 bg-green-600/10'
      : destaque === 'yellow'
      ? 'border-yellow-500/40 bg-yellow-500/10'
      : 'border-blue-900 bg-[#071225]'

  return (
    <div className={`rounded-3xl border ${cor} p-5`}>
      <div className="mb-4 text-3xl">{icone}</div>
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">
        {titulo}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{valor}</p>
      <p className="mt-2 text-sm text-slate-400">{detalhe}</p>
    </div>
  )
}

function ResumoFiltro({ titulo, valor, detalhe, destaque = false }: any) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        destaque
          ? 'border-green-500/40 bg-green-600/10'
          : 'border-blue-900 bg-[#020817]'
      }`}
    >
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">{titulo}</p>
      <p className="mt-1 text-xl font-black text-white">{valor}</p>
      <p className="mt-1 text-xs font-bold text-slate-400">{detalhe}</p>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-3 text-left font-black whitespace-nowrap">{children}</th>
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-4 text-slate-300 whitespace-nowrap">{children}</td>
}
