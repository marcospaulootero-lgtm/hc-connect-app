'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const PAGE_SIZE = 10
const LOTE_SUPABASE = 1000


export default function ParceirosPage() {
  const [registros, setRegistros] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [usuariosPortal, setUsuariosPortal] = useState<any[]>([])
  const [acessosPortal, setAcessosPortal] = useState<any[]>([])
  const [solicitacoesProfit, setSolicitacoesProfit] = useState<any[]>([])
  const [usuariosSelecionadosPortal, setUsuariosSelecionadosPortal] = useState<string[]>([])
  const [observacaoLiberacaoPortal, setObservacaoLiberacaoPortal] = useState('')
  const [salvandoPortal, setSalvandoPortal] = useState(false)

  const [busca, setBusca] = useState('')
  const [buscaParceiro, setBuscaParceiro] = useState('')
  const [parceiroSelecionado, setParceiroSelecionado] = useState('')
  const [aba, setAba] = useState('TODOS')
  const [pagina, setPagina] = useState(1)
  const [periodo, setPeriodo] = useState('TODOS')
  const [selecionadosPdf, setSelecionadosPdf] = useState<string[]>([])
  const [valorAlvoPdf, setValorAlvoPdf] = useState('')
  const [quantidadePdf, setQuantidadePdf] = useState('10')

  const [form, setForm] = useState({
    parceiro: '',
    debito_terceiro: '',
    pgta_terceiros: 'PENDENTE',
    mes_pgto: '',
  })

  useEffect(() => {
    carregar()
  }, [])

  useEffect(() => {
    if (!parceiroSelecionado || parceiroSelecionado === 'Sem parceiro') {
      setUsuariosSelecionadosPortal([])
      return
    }

    setUsuariosSelecionadosPortal(usuariosComAcessoDoParceiro(parceiroSelecionado))
  }, [parceiroSelecionado, acessosPortal, registros])

  function moeda(valor: any) {
    return Number(valor || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  function normalizarTexto(valor: any) {
    if (valor === null || valor === undefined) return ''
    return String(valor).trim()
  }

  function nomeParceiroRegistro(item: any) {
    return item?.parceiro || item?.despachante || 'Sem parceiro'
  }

  function usuarioPortalLabel(usuario: any) {
    const nome = normalizarTexto(usuario?.nome)
    const email = normalizarTexto(usuario?.email)

    if (nome && email) return `${nome} - ${email}`
    return nome || email || usuario?.id || 'Usuário sem identificação'
  }

  function usuarioDoAcesso(acesso: any) {
    return acesso?.perfis || usuariosPortal.find((usuario) => usuario.id === acesso?.usuario_id) || null
  }

  function dataHoraBR(data?: string | null) {
    if (!data) return '-'
    return new Date(data).toLocaleString('pt-BR')
  }


  function solicitacoesDoItem(item: any) {
    if (!item?.id) return []
    return solicitacoesProfit.filter((solicitacao) => solicitacao.financeiro_embarque_id === item.id)
  }

  function solicitacoesAbertasDoItem(item: any) {
    return solicitacoesDoItem(item).filter((solicitacao) =>
      ['SOLICITADO', 'EM_ANALISE', 'APROVADO'].includes(String(solicitacao.status || '').toUpperCase())
    )
  }

  function usuarioDaSolicitacao(solicitacao: any) {
    return solicitacao?.perfis || usuariosPortal.find((usuario) => usuario.id === solicitacao?.usuario_id) || null
  }

  function labelStatusSolicitacao(status: any) {
    const s = String(status || '').toUpperCase()
    if (s === 'SOLICITADO') return 'Solicitado'
    if (s === 'EM_ANALISE') return 'Em análise'
    if (s === 'APROVADO') return 'Aprovado'
    if (s === 'RECUSADO') return 'Recusado'
    if (s === 'PAGO') return 'Pago'
    if (s === 'CANCELADO') return 'Cancelado'
    return s || '-'
  }

  function classeSolicitacaoAdmin(status: any) {
    const s = String(status || '').toUpperCase()
    if (s === 'PAGO' || s === 'APROVADO') return 'bg-green-50 text-green-700 border-green-200'
    if (s === 'RECUSADO' || s === 'CANCELADO') return 'bg-red-50 text-red-700 border-red-200'
    if (s === 'SOLICITADO' || s === 'EM_ANALISE') return 'bg-yellow-50 text-yellow-700 border-yellow-200'
    return 'bg-slate-50 text-slate-600 border-slate-200'
  }

  function acessosDoItem(item: any) {
    if (!item?.id) return []
    return acessosPortal.filter((acesso) => acesso.financeiro_embarque_id === item.id)
  }

  function acessosAtivosDoItem(item: any) {
    return acessosDoItem(item).filter((acesso) => acesso.ativo !== false)
  }

  function usuariosComAcessoDoParceiro(parceiro: string) {
    if (!parceiro) return []

    const idsFinanceiros = new Set(
      registros
        .filter((item) => nomeParceiroRegistro(item) === parceiro)
        .map((item) => item.id)
        .filter(Boolean)
    )

    return Array.from(
      new Set(
        acessosPortal
          .filter((acesso) => acesso.ativo !== false && idsFinanceiros.has(acesso.financeiro_embarque_id))
          .map((acesso) => acesso.usuario_id)
          .filter(Boolean)
      )
    )
  }

  function alternarUsuarioSelecionado(usuarioId: string) {
    setUsuariosSelecionadosPortal((atuais) => {
      if (atuais.includes(usuarioId)) {
        return atuais.filter((id) => id !== usuarioId)
      }

      return [...atuais, usuarioId]
    })
  }

  function selecionarTodosUsuariosDoParceiro() {
    if (!parceiroSelecionado || parceiroSelecionado === 'Sem parceiro') return
    setUsuariosSelecionadosPortal(usuariosComAcessoDoParceiro(parceiroSelecionado))
  }

  function limparUsuariosSelecionados() {
    setUsuariosSelecionadosPortal([])
  }

  function normalizarBusca(valor: any) {
    return normalizarTexto(valor)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  }

  function ehServicoOperacionalParceiro(item: any) {
    const servico = normalizarBusca(item?.servico)
    const transportadora = normalizarBusca(item?.transportadora)

    const bloqueados = [
      'reajuste',
      'imposto',
      'taxa',
      'doc',
      'dta',
      'hc consultoria',
      'consultoria',
    ]

    const textoBloqueio = `${servico} ${transportadora}`

    if (bloqueados.some((palavra) => textoBloqueio.includes(palavra))) {
      return false
    }

    const permitidos = [
      'import',
      'export',
      'formal',
      'maritim',
      'marítim',
      'courier',
    ]

    return permitidos.some((palavra) => servico.includes(palavra))
  }

  function normalizarStatusParceiro(valor: any) {
    const texto = normalizarBusca(valor).toUpperCase()

    if (texto.includes('PAGO')) return 'PAGO'
    return 'PENDENTE'
  }

  function normalizarMes(valor: any) {
    const texto = normalizarBusca(valor)

    if (texto === 'marco') return 'março'

    return texto
  }

  function normalizarNumero(valor: any) {
    if (valor === null || valor === undefined || valor === '') return 0
    if (typeof valor === 'number') return valor

    const texto = String(valor)
      .replace(/\s/g, '')
      .replace('R$', '')
      .replace(/\./g, '')
      .replace(',', '.')

    const numero = Number(texto)
    return isNaN(numero) ? 0 : numero
  }

  function mesAtual() {
    return new Date()
      .toLocaleDateString('pt-BR', { month: 'long' })
      .toLowerCase()
  }

  function anoRegistro(item: any) {
    const direto = normalizarTexto(
      item.ano ||
        item.ano_pgto ||
        item.ano_pagamento ||
        item.ano_referencia ||
        item.competencia_ano ||
        item.mes_ano ||
        item.mes_profit ||
        ''
    )

    const anoDireto = direto.match(/20\d{2}/)?.[0]
    if (anoDireto) return anoDireto

    const datas = [
      item.recebimento,
      item.recebimento_cliente,
      item.vencimento_cobranca,
      item.vencimento_cliente,
      item.atualizado_em,
      item.created_at,
      item.criado_em,
    ]

    for (const data of datas) {
      const texto = normalizarTexto(data)
      const ano = texto.match(/20\d{2}/)?.[0]
      if (ano) return ano
    }

    return ''
  }

  function status(item: any) {
    return normalizarStatusParceiro(item.pgta_terceiros) === 'PAGO'
      ? 'PAGO'
      : 'PENDENTE'
  }

  function statusVisual(item: any) {
    return status(item) === 'PAGO' ? 'PAGO' : 'PENDENTE'
  }

  function badge(statusAtual: string) {
    if (statusAtual === 'PAGO') {
      return 'bg-green-50 text-green-700 border-green-200'
    }

    return 'bg-yellow-50 text-yellow-700 border-yellow-200'
  }

  async function carregar() {
    setLoading(true)

    const { count, error: countError } = await supabase
      .from('financeiro_embarques')
      .select('*', { count: 'exact', head: true })
      .gt('debito_terceiro', 0)

    if (countError) {
      alert('Erro ao contar parceiros: ' + countError.message)
      setLoading(false)
      return
    }

    const total = count || 0
    const paginas = Math.ceil(total / LOTE_SUPABASE)

    const consultas = Array.from({ length: paginas || 1 }, (_, index) => {
      const inicio = index * LOTE_SUPABASE
      const fim = inicio + LOTE_SUPABASE - 1

      return supabase
        .from('financeiro_embarques')
        .select('*')
        .gt('debito_terceiro', 0)
        .range(inicio, fim)
    })

    const respostas = await Promise.all(consultas)
    const erro = respostas.find((res) => res.error)

    if (erro?.error) {
      alert('Erro ao carregar parceiros: ' + erro.error.message)
      setLoading(false)
      return
    }

    const todos = respostas
      .flatMap((res) => res.data || [])
      .filter((item) => ehServicoOperacionalParceiro(item))

    const ordenados = todos.sort((a, b) =>
      String(a.parceiro || a.despachante || '').localeCompare(
        String(b.parceiro || b.despachante || ''),
        'pt-BR'
      )
    )

    const { data: usuariosData, error: usuariosError } = await supabase
      .from('perfis')
      .select('id, nome, email, tipo_acesso, ativo')
      .neq('tipo_acesso', 'admin')
      .order('nome', { ascending: true })

    if (usuariosError) {
      console.log('Erro ao carregar usuários do portal:', usuariosError)
    } else {
      setUsuariosPortal((usuariosData || []).filter((usuario: any) => usuario.ativo !== false))
    }

    const idsFinanceiros = ordenados.map((item) => item.id).filter(Boolean)
    let acessosData: any[] = []

    if (idsFinanceiros.length > 0) {
      const lotesIds = dividirEmLotes(idsFinanceiros, 500)

      for (const lote of lotesIds) {
        const { data: acessosLote, error: acessosError } = await supabase
          .from('financeiro_parceiro_acessos')
          .select(`
            id,
            financeiro_embarque_id,
            usuario_id,
            ativo,
            observacao_parceiro,
            liberado_em,
            liberado_por,
            ocultado_em,
            ultimo_visualizado_em,
            visualizacoes,
            criado_em,
            atualizado_em,
            perfis:usuario_id (
              id,
              nome,
              email,
              tipo_acesso,
              ativo
            )
          `)
          .in('financeiro_embarque_id', lote)
          .order('liberado_em', { ascending: false })

        if (acessosError) {
          console.log('Erro ao carregar acessos do portal parceiro:', acessosError)
          break
        }

        acessosData = [...acessosData, ...(acessosLote || [])]
      }
    }

    let solicitacoesData: any[] = []

    if (idsFinanceiros.length > 0) {
      const lotesIds = dividirEmLotes(idsFinanceiros, 500)

      for (const lote of lotesIds) {
        const { data: solicitacoesLote, error: solicitacoesError } = await supabase
          .from('financeiro_parceiro_solicitacoes')
          .select(`
            id,
            financeiro_embarque_id,
            usuario_id,
            status,
            mensagem,
            observacao_admin,
            solicitado_em,
            respondido_em,
            respondido_por,
            criado_em,
            atualizado_em,
            perfis:usuario_id (
              id,
              nome,
              email,
              tipo_acesso,
              ativo
            )
          `)
          .in('financeiro_embarque_id', lote)
          .order('solicitado_em', { ascending: false })

        if (solicitacoesError) {
          console.log('Erro ao carregar solicitações de profit:', solicitacoesError)
          break
        }

        solicitacoesData = [...solicitacoesData, ...(solicitacoesLote || [])]
      }
    }

    setSolicitacoesProfit(solicitacoesData)
    setAcessosPortal(acessosData)
    setRegistros(ordenados)

    if (!parceiroSelecionado && ordenados.length > 0) {
      const primeiro = ordenados.find((i) => i.parceiro || i.despachante)
      if (primeiro) {
        setParceiroSelecionado(primeiro.parceiro || primeiro.despachante)
      }
    }

    setPagina(1)
    setLoading(false)
  }

  function dividirEmLotes<T>(lista: T[], tamanho = 25) {
    const lotes: T[][] = []

    for (let i = 0; i < lista.length; i += tamanho) {
      lotes.push(lista.slice(i, i + tamanho))
    }

    return lotes
  }

  async function importarPagamentosExcel(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (
      !confirm(
        'Importar dados dos parceiros?\n\nEsta ação vai atualizar SOMENTE:\n\nColuna I = Valor do parceiro\nColuna Q = Pago/Pendente\nColuna S = Mês do pagamento\n\nUsando a AWB como chave.'
      )
    ) {
      event.target.value = ''
      return
    }

    setImportando(true)

    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const linhas: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
      })

      const atualizacoes: any[] = []
      let ignorados = 0
      let atualizados = 0
      let erros = 0

      for (let i = 1; i < linhas.length; i++) {
        const linha = linhas[i]

        const awb = normalizarTexto(linha[2])
        const valorParceiro = normalizarNumero(linha[8])
        const pgtaTerceiros = normalizarStatusParceiro(linha[16])
        const mesPgto = normalizarMes(linha[18])

        if (!awb) {
          ignorados++
          continue
        }

        atualizacoes.push({
          awb,
          debito_terceiro: valorParceiro,
          pgta_terceiros: pgtaTerceiros,
          mes_pgto: mesPgto || null,
        })
      }

      const lotes = dividirEmLotes(atualizacoes, 25)

      for (const lote of lotes) {
        const respostas = await Promise.all(
          lote.map((item) =>
            supabase
              .from('financeiro_embarques')
              .update({
                debito_terceiro: item.debito_terceiro,
                pgta_terceiros: item.pgta_terceiros,
                mes_pgto: item.mes_pgto,
                atualizado_em: new Date().toISOString(),
              })
              .eq('awb', item.awb)
              .select('id')
          )
        )

        for (const resposta of respostas) {
          if (resposta.error) {
            erros++
          } else {
            atualizados += resposta.data?.length || 0
          }
        }
      }

      alert(
        `Importação concluída.\n\nAtualizados: ${atualizados}\nIgnorados sem AWB: ${ignorados}\nErros: ${erros}`
      )

      await carregar()
    } catch (error: any) {
      alert('Erro ao importar pagamentos: ' + error.message)
    }

    setImportando(false)
    event.target.value = ''
  }

  async function marcarPago(item: any) {
    if (
      !confirm(
        `Confirmar pagamento do parceiro?\n\nParceiro: ${
          item.parceiro || item.despachante || '-'
        }\nAWB: ${item.awb || '-'}\nValor: ${moeda(item.debito_terceiro)}`
      )
    ) {
      return
    }

    const { error } = await supabase
      .from('financeiro_embarques')
      .update({
        pgta_terceiros: 'PAGO',
        mes_pgto: mesAtual(),
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', item.id)

    if (error) {
      alert('Erro ao marcar como pago: ' + error.message)
      return
    }

    await supabase
      .from('financeiro_parceiro_solicitacoes')
      .update({
        status: 'PAGO',
        respondido_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      })
      .eq('financeiro_embarque_id', item.id)
      .in('status', ['SOLICITADO', 'EM_ANALISE', 'APROVADO'])

    await carregar()
  }

  async function reabrirPagamento(item: any) {
    if (
      !confirm(
        `Reabrir pagamento do parceiro?\n\nParceiro: ${
          item.parceiro || item.despachante || '-'
        }\nAWB: ${item.awb || '-'}\nValor: ${moeda(item.debito_terceiro)}`
      )
    ) {
      return
    }

    const { error } = await supabase
      .from('financeiro_embarques')
      .update({
        pgta_terceiros: 'PENDENTE',
        mes_pgto: null,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', item.id)

    if (error) {
      alert('Erro ao reabrir pagamento: ' + error.message)
      return
    }

    await carregar()
  }



  async function atualizarSolicitacaoProfit(solicitacao: any, novoStatus: string) {
    if (!solicitacao?.id) return

    const confirmar = confirm(
      `Atualizar solicitação para ${labelStatusSolicitacao(novoStatus)}?\n\nLogin: ${usuarioPortalLabel(usuarioDaSolicitacao(solicitacao))}`
    )

    if (!confirmar) return

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('financeiro_parceiro_solicitacoes')
      .update({
        status: novoStatus,
        respondido_em: new Date().toISOString(),
        respondido_por: user?.id || null,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', solicitacao.id)

    if (error) {
      alert('Erro ao atualizar solicitação: ' + error.message)
      return
    }

    await carregar()
  }

  function editar(item: any) {
    setEditando(item)
    setForm({
      parceiro: item.parceiro || item.despachante || '',
      debito_terceiro: String(item.debito_terceiro || ''),
      pgta_terceiros: normalizarStatusParceiro(item.pgta_terceiros),
      mes_pgto: item.mes_pgto || '',
    })

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelar() {
    setEditando(null)
    setForm({
      parceiro: '',
      debito_terceiro: '',
      pgta_terceiros: 'PENDENTE',
      mes_pgto: '',
    })
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()

    if (!editando?.id) return

    setSalvando(true)

    const { error } = await supabase
      .from('financeiro_embarques')
      .update({
        parceiro: form.parceiro,
        debito_terceiro: normalizarNumero(form.debito_terceiro),
        pgta_terceiros: normalizarStatusParceiro(form.pgta_terceiros),
        mes_pgto: form.mes_pgto || null,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', editando.id)

    if (error) {
      alert('Erro ao salvar pagamento do parceiro: ' + error.message)
      setSalvando(false)
      return
    }

    alert('Pagamento do parceiro atualizado com sucesso.')
    cancelar()
    await carregar()
    setSalvando(false)
  }


  async function liberarPortalParceiro(itens: any[]) {
    if (!itens.length) {
      alert('Nenhum processo encontrado no filtro atual.')
      return
    }

    if (!usuariosSelecionadosPortal.length) {
      alert('Selecione um ou mais logins para liberar os repasses.')
      return
    }

    if (
      !confirm(
        `Liberar ${itens.length} processo(s) para ${usuariosSelecionadosPortal.length} login(s)?\n\nParceiro: ${
          parceiroSelecionado || 'Todos'
        }\n\nCada login selecionado passará a visualizar estes repasses no portal.`
      )
    ) {
      return
    }

    setSalvandoPortal(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const agora = new Date().toISOString()
    const linhas = itens.flatMap((item) =>
      usuariosSelecionadosPortal.map((usuarioId) => ({
        financeiro_embarque_id: item.id,
        usuario_id: usuarioId,
        ativo: true,
        observacao_parceiro: observacaoLiberacaoPortal || null,
        liberado_em: agora,
        liberado_por: user?.id || null,
        atualizado_em: agora,
      }))
    )

    const lotes = dividirEmLotes(linhas, 250)

    for (const lote of lotes) {
      const { error } = await supabase
        .from('financeiro_parceiro_acessos')
        .upsert(lote, { onConflict: 'financeiro_embarque_id,usuario_id' })

      if (error) {
        alert('Erro ao liberar repasses no portal: ' + error.message)
        setSalvandoPortal(false)
        return
      }
    }

    alert('Repasses liberados para os logins selecionados.')
    await carregar()
    setSalvandoPortal(false)
  }

  async function ocultarPortalParceiro(itens: any[], somenteSelecionados = false) {
    if (!itens.length) {
      alert('Nenhum processo encontrado no filtro atual.')
      return
    }

    const ids = itens.map((item) => item.id).filter(Boolean)
    const aplicarSelecionados = somenteSelecionados && usuariosSelecionadosPortal.length > 0
    const textoLogins = aplicarSelecionados
      ? `${usuariosSelecionadosPortal.length} login(s) selecionado(s)`
      : 'todos os logins vinculados nestes processos'

    if (
      !confirm(
        `Ocultar ${itens.length} processo(s) para ${textoLogins}?\n\nParceiro: ${parceiroSelecionado || 'Todos'}`
      )
    ) {
      return
    }

    setSalvandoPortal(true)

    const lotes = dividirEmLotes(ids, 250)

    for (const lote of lotes) {
      let query = supabase
        .from('financeiro_parceiro_acessos')
        .update({
          ativo: false,
          ocultado_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString(),
        })
        .in('financeiro_embarque_id', lote)

      if (aplicarSelecionados) {
        query = query.in('usuario_id', usuariosSelecionadosPortal)
      }

      const { error } = await query

      if (error) {
        alert('Erro ao ocultar repasses no portal: ' + error.message)
        setSalvandoPortal(false)
        return
      }
    }

    alert('Repasses ocultados no portal.')
    await carregar()
    setSalvandoPortal(false)
  }

  async function gerarPdfFiltro() {
    try {
      const { default: jsPDF } = await import('jspdf')
      const autoTableModule: any = await import('jspdf-autotable')
      const autoTable = autoTableModule.default || autoTableModule

      const nomeParceiro = parceiroSelecionado || 'Todos parceiros'
      const dataGeracao = new Date().toLocaleString('pt-BR')

      const nomeArquivo = String(nomeParceiro)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth = doc.internal.pageSize.getWidth()

      doc.setFillColor(2, 12, 34)
      doc.rect(0, 0, pageWidth, 22, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('HC Connect', 14, 14)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('Relatório de Profit Parceiros', pageWidth - 14, 14, {
        align: 'right',
      })

      doc.setTextColor(15, 23, 42)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('Resumo do filtro - Profit Parceiros', 14, 34)

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(71, 85, 105)
      doc.text(`Parceiro: ${nomeParceiro}`, 14, 41)
      doc.text(
        `Período: ${periodo === 'TODOS' ? 'Todos os períodos' : periodo}`,
        14,
        47
      )
      doc.text(`Status: ${aba}`, 14, 53)
      doc.text(`Busca: ${busca || '-'}`, 14, 59)
      doc.text(`Gerado em: ${dataGeracao}`, pageWidth - 14, 41, {
        align: 'right',
      })

      autoTable(doc, {
        startY: 66,
        head: [['Processos', 'Total terceiro', 'Pago terceiro', 'Pendente terceiro', 'Ticket médio']],
        body: [[
          String(resumoFiltrado.qtd),
          moeda(resumoFiltrado.total),
          moeda(resumoFiltrado.pago),
          moeda(resumoFiltrado.pendente),
          moeda(resumoFiltrado.ticket),
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
          fontSize: 9,
          cellPadding: 3,
        },
      })

      const tabela = filtrados.map((item) => [
        item.awb || '-',
        item.cliente || '-',
        item.servico || '-',
        moeda(item.debito_terceiro),
        statusVisual(item),
        item.mes_pgto || '-',
      ])

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['AWB', 'Cliente', 'Serviço', 'Valor terceiro', 'Status pgto terceiro', 'Mês pgto terceiro']],
        body: tabela.length ? tabela : [['-', '-', '-', '-', '-', '-']],
        theme: 'striped',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          overflow: 'linebreak',
        },
        columnStyles: {
          0: { cellWidth: 28 },
          1: { cellWidth: 58 },
          2: { cellWidth: 38 },
          3: { cellWidth: 34, halign: 'right' },
          4: { cellWidth: 38, halign: 'center' },
          5: { cellWidth: 35, halign: 'center' },
        },
        didDrawPage: () => {
          const pageHeight = doc.internal.pageSize.getHeight()
          doc.setFontSize(8)
          doc.setTextColor(100, 116, 139)
          doc.text(
            'Relatório gerado automaticamente pelo HC Connect',
            14,
            pageHeight - 8
          )
          doc.text(
            `Página ${doc.getNumberOfPages()}`,
            pageWidth - 14,
            pageHeight - 8,
            { align: 'right' }
          )
        },
      })

      doc.save(`profit-parceiros-${nomeArquivo || 'todos'}.pdf`)
    } catch (error: any) {
      alert(
        'Erro ao gerar PDF: ' +
          error.message +
          '\n\nConfira se você instalou: npm install jspdf jspdf-autotable'
      )
    }
  }

  const parceirosResumo = useMemo(() => {
    const mapa: any = {}

    registros.forEach((item) => {
      const nome = item.parceiro || item.despachante || 'Sem parceiro'

      if (!mapa[nome]) {
        mapa[nome] = {
          nome,
          total: 0,
          pago: 0,
          aberto: 0,
          qtd: 0,
        }
      }

      const valor = Number(item.debito_terceiro || 0)

      mapa[nome].total += valor
      mapa[nome].qtd += 1

      if (status(item) === 'PAGO') {
        mapa[nome].pago += valor
      } else {
        mapa[nome].aberto += valor
      }
    })

    return Object.values(mapa).sort((a: any, b: any) => b.total - a.total)
  }, [registros])

  const parceirosFiltrados = useMemo(() => {
    const termo = normalizarBusca(buscaParceiro)

    return parceirosResumo.filter((item: any) =>
      normalizarBusca(item.nome).includes(termo)
    )
  }, [parceirosResumo, buscaParceiro])

  const dadosParceiro = useMemo(() => {
    if (!parceiroSelecionado) return registros

    return registros.filter(
      (item) =>
        (item.parceiro || item.despachante || 'Sem parceiro') ===
        parceiroSelecionado
    )
  }, [registros, parceiroSelecionado])

  const anosDisponiveis = useMemo(() => {
    const anos = [
      ...new Set(
        dadosParceiro
          .map((item) => anoRegistro(item))
          .filter(Boolean)
      ),
    ].sort((a: any, b: any) => String(b).localeCompare(String(a)))

    return anos
  }, [dadosParceiro])

  const dadosParceiroPeriodo = useMemo(() => {
    if (periodo === 'TODOS') return dadosParceiro

    return dadosParceiro.filter((item) => {
      const ano = anoRegistro(item)

      if (!ano) return false

      return ano === periodo
    })
  }, [dadosParceiro, periodo])

  const resumoGeral = useMemo(() => {
    const emAberto = registros.filter((item) => status(item) !== 'PAGO')
    const pagos = registros.filter((item) => status(item) === 'PAGO')

    function total(lista: any[]) {
      return lista.reduce((acc, item) => acc + Number(item.debito_terceiro || 0), 0)
    }

    return {
      total: total(registros),
      aberto: total(emAberto),
      pago: total(pagos),
      qtd: registros.length,
      qtdParceiros: parceirosResumo.length,
    }
  }, [registros, parceirosResumo.length])

  const resumoParceiro = useMemo(() => {
    const emAberto = dadosParceiroPeriodo.filter((item) => status(item) !== 'PAGO')
    const pagos = dadosParceiroPeriodo.filter((item) => status(item) === 'PAGO')

    function total(lista: any[]) {
      return lista.reduce((acc, item) => acc + Number(item.debito_terceiro || 0), 0)
    }

    const totalParceiro = total(dadosParceiroPeriodo)

    return {
      total: totalParceiro,
      aberto: total(emAberto),
      pago: total(pagos),
      qtd: dadosParceiroPeriodo.length,
      ticket: dadosParceiroPeriodo.length ? totalParceiro / dadosParceiroPeriodo.length : 0,
    }
  }, [dadosParceiroPeriodo])

  const ranking = useMemo(() => {
    return [...parceirosResumo].slice(0, 5)
  }, [parceirosResumo])

  const filtrados = useMemo(() => {
    const termo = normalizarBusca(busca)

    return dadosParceiroPeriodo.filter((item) => {
      const texto = normalizarBusca(`
        ${item.parceiro || item.despachante || ''}
        ${item.cliente || ''}
        ${item.awb || ''}
        ${item.servico || ''}
        ${item.pgta_terceiros || ''}
        ${item.mes_pgto || ''}
      `)

      const passaBusca = !termo || texto.includes(termo)

      let passaAba = true

      if (aba === 'PAGO') {
        passaAba = status(item) === 'PAGO'
      }

      if (aba === 'PENDENTE') {
        passaAba = status(item) !== 'PAGO'
      }

      return passaBusca && passaAba
    })
  }, [dadosParceiroPeriodo, busca, aba])

  const resumoFiltrado = useMemo(() => {
    const pagos = filtrados.filter((item) => status(item) === 'PAGO')
    const pendentes = filtrados.filter((item) => status(item) !== 'PAGO')

    function total(lista: any[]) {
      return lista.reduce((acc, item) => acc + Number(item.debito_terceiro || 0), 0)
    }

    const totalFiltrado = total(filtrados)

    return {
      qtd: filtrados.length,
      total: totalFiltrado,
      pago: total(pagos),
      pendente: total(pendentes),
      ticket: filtrados.length ? totalFiltrado / filtrados.length : 0,
    }
  }, [filtrados])


  const awbsDuplicados = useMemo(() => {
    const mapa = new Map<string, any[]>()

    filtrados.forEach((item) => {
      const awb = normalizarTexto(item.awb)
        .toUpperCase()
        .replace(/\s/g, '')
        .replace(/[^A-Z0-9]/g, '')

      if (
        !awb ||
        awb === '-' ||
        awb === 'NA' ||
        awb === 'N/A' ||
        awb === 'SEMAWB' ||
        awb === 'AGUARDANDOAWB'
      ) {
        return
      }

      const atuais = mapa.get(awb) || []
      atuais.push(item)
      mapa.set(awb, atuais)
    })

    return Array.from(mapa.entries())
      .filter(([, itens]) => itens.length > 1)
      .map(([awb, itens]) => ({
        awb,
        qtd: itens.length,
        total: itens.reduce((acc, item) => acc + Number(item.debito_terceiro || 0), 0),
        clientes: Array.from(new Set(itens.map((item) => item.cliente || '-'))).slice(0, 4),
      }))
      .sort((a, b) => b.qtd - a.qtd || b.total - a.total)
  }, [filtrados])

  const resumoPortalParceiro = useMemo(() => {
    const idsPeriodo = new Set(dadosParceiroPeriodo.map((item) => item.id).filter(Boolean))
    const acessosPeriodo = acessosPortal.filter(
      (acesso) => acesso.ativo !== false && idsPeriodo.has(acesso.financeiro_embarque_id)
    )
    const processosComAcesso = new Set(acessosPeriodo.map((acesso) => acesso.financeiro_embarque_id))
    const loginsComAcesso = new Set(acessosPeriodo.map((acesso) => acesso.usuario_id))
    const visualizados = acessosPeriodo.filter((acesso) => !!acesso.ultimo_visualizado_em)
    const solicitacoesPeriodo = solicitacoesProfit.filter((solicitacao) => idsPeriodo.has(solicitacao.financeiro_embarque_id))
    const solicitacoesAbertas = solicitacoesPeriodo.filter((solicitacao) =>
      ['SOLICITADO', 'EM_ANALISE', 'APROVADO'].includes(String(solicitacao.status || '').toUpperCase())
    )

    return {
      processosLiberados: processosComAcesso.size,
      processosOcultos: Math.max(0, dadosParceiroPeriodo.length - processosComAcesso.size),
      loginsLiberados: loginsComAcesso.size,
      acessosLiberados: acessosPeriodo.length,
      acessosVisualizados: visualizados.length,
      solicitacoesAbertas: solicitacoesAbertas.length,
      solicitacoesTotal: solicitacoesPeriodo.length,
    }
  }, [dadosParceiroPeriodo, acessosPortal, solicitacoesProfit])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))

  const paginados = useMemo(() => {
    const inicio = (pagina - 1) * PAGE_SIZE
    return filtrados.slice(inicio, inicio + PAGE_SIZE)
  }, [filtrados, pagina])

  const percentualPago = resumoParceiro.total
    ? Math.round((resumoParceiro.pago / resumoParceiro.total) * 100)
    : 0

  const inicialParceiro = normalizarTexto(parceiroSelecionado).slice(0, 1) || 'P'

  return (
    <main className="min-h-screen bg-[#f5f7fb] p-4 text-slate-900 lg:p-6">
      <div className="mx-auto w-full max-w-none space-y-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-600">Financeiro</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Profit Parceiros</h1>
            <p className="mt-1 text-sm text-slate-500">
              Controle de repasses, pagamentos, liberação no portal e solicitações dos parceiros.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 shadow-sm hover:bg-blue-100">
              ☁ Importar Excel
              <input
                type="file"
                accept=".xlsx,.xls,.xlsm"
                onChange={importarPagamentosExcel}
                disabled={importando}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={carregar}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
            >
              ⟳ {loading ? 'Atualizando...' : 'Atualizar dados'}
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard titulo="PROFIT TOTAL" valor={moeda(resumoGeral.total)} subtitulo="Total gerado para parceiros" icone="🤝" cor="blue" />
          <KpiCard titulo="A PAGAR" valor={moeda(resumoGeral.aberto)} subtitulo="Valores pendentes" icone="💰" cor="orange" />
          <KpiCard titulo="PAGOS" valor={moeda(resumoGeral.pago)} subtitulo="Valores pagos" icone="✅" cor="green" />
          <KpiCard titulo="PARCEIROS" valor={String(resumoGeral.qtdParceiros)} subtitulo="Parceiros ativos" icone="👥" cor="purple" />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">Parceiros</h2>
              <p className="text-sm text-slate-500">
                A seleção agora fica em cards horizontais para evitar a barra lateral apertada.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 xl:w-[520px] xl:flex-row">
              <input
                value={buscaParceiro}
                onChange={(e) => setBuscaParceiro(e.target.value)}
                placeholder="Buscar parceiro..."
                className="w-full rounded-xl border border-slate-200 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-400"
              />

              <button
                type="button"
                onClick={() => {
                  setParceiroSelecionado('')
                  setPagina(1)
                  setBusca('')
                  setAba('TODOS')
                }}
                className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 hover:bg-blue-100"
              >
                Ver todos
              </button>
            </div>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2">
            {parceirosFiltrados.map((item: any) => (
              <button
                key={item.nome}
                type="button"
                onClick={() => {
                  setParceiroSelecionado(item.nome)
                  setPagina(1)
                  setBusca('')
                  setAba('TODOS')
                }}
                className={`min-w-[220px] rounded-2xl border p-4 text-left transition ${
                  parceiroSelecionado === item.nome
                    ? 'border-blue-500 bg-blue-600 text-white shadow-md'
                    : 'border-slate-200 bg-slate-50 text-slate-900 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-black">{item.nome}</p>
                    <p className={parceiroSelecionado === item.nome ? 'mt-1 text-xs text-blue-100' : 'mt-1 text-xs text-slate-500'}>
                      {item.qtd} processo(s)
                    </p>
                  </div>
                  <span className="rounded-full bg-white/20 px-2 py-1 text-xs font-black">›</span>
                </div>

                <p className="mt-3 text-lg font-black">{moeda(item.total)}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-2xl font-black text-white shadow-sm">
                    {inicialParceiro.toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="truncate text-2xl font-black text-slate-950">
                        {parceiroSelecionado || 'Todos parceiros'}
                      </h2>
                      <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-black text-green-700">Parceiro ativo</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">Resumo financeiro do parceiro selecionado.</p>
                  </div>
                </div>

                <select
                  value={periodo}
                  onChange={(e) => {
                    setPeriodo(e.target.value)
                    setPagina(1)
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"
                >
                  <option value="TODOS">📅 Todos os períodos</option>
                  {anosDisponiveis.map((ano: any) => (
                    <option key={ano} value={ano}>📅 Período: {ano}</option>
                  ))}
                </select>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 md:grid-cols-5">
                <MiniInfo titulo="TOTAL PROFIT" valor={moeda(resumoParceiro.total)} />
                <MiniInfo titulo="A PAGAR" valor={moeda(resumoParceiro.aberto)} destaque="orange" />
                <MiniInfo titulo="PAGO" valor={moeda(resumoParceiro.pago)} destaque="green" />
                <MiniInfo titulo="PROCESSOS" valor={String(resumoParceiro.qtd)} />
                <MiniInfo titulo="TICKET MÉDIO" valor={moeda(resumoParceiro.ticket)} />
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-green-500" style={{ width: `${percentualPago}%` }} />
              </div>

              <p className="mt-2 text-xs font-bold text-slate-500">
                {percentualPago}% pago · {100 - percentualPago}% pendente
              </p>
            </section>

            {editando && (
              <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black">Editar pagamento parceiro</h2>
                    <p className="text-sm text-slate-500">{editando.cliente} · AWB {editando.awb}</p>
                  </div>

                  <button type="button" onClick={cancelar} className="rounded-xl bg-slate-100 px-4 py-2 font-bold text-slate-800 hover:bg-slate-200">
                    Cancelar
                  </button>
                </div>

                <form onSubmit={salvar} className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-600">Parceiro</label>
                    <input value={form.parceiro} onChange={(e) => setForm({ ...form, parceiro: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
                  </div>

                  <Info label="Cliente" value={editando.cliente || '-'} />
                  <Info label="AWB" value={editando.awb || '-'} />

                  <div>
                    <label className="text-sm font-semibold text-slate-600">Valor parceiro</label>
                    <input value={form.debito_terceiro} onChange={(e) => setForm({ ...form, debito_terceiro: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-600">Status pagamento</label>
                    <select value={form.pgta_terceiros} onChange={(e) => setForm({ ...form, pgta_terceiros: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">
                      <option value="PENDENTE">PENDENTE</option>
                      <option value="PAGO">PAGO</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-600">Mês do pagamento</label>
                    <input value={form.mes_pgto} onChange={(e) => setForm({ ...form, mes_pgto: e.target.value })} placeholder="Ex: junho" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
                  </div>

                  <div className="md:col-span-4 flex gap-3">
                    <button disabled={salvando} className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                      {salvando ? 'Salvando...' : 'Salvar pagamento'}
                    </button>
                  </div>
                </form>
              </section>
            )}
          </div>

          <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">Portal do parceiro</p>
              <h3 className="mt-1 text-xl font-black text-slate-950">Liberar repasses por login</h3>
              <p className="mt-1 text-sm text-slate-500">
                Escolha os logins que podem visualizar os processos filtrados. Abaixo você acompanha quem viu e quem solicitou.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <ResumoFiltroCard titulo="Liberados" valor={String(resumoPortalParceiro.processosLiberados)} destaque="green" />
              <ResumoFiltroCard titulo="Ocultos" valor={String(resumoPortalParceiro.processosOcultos)} destaque="orange" />
              <ResumoFiltroCard titulo="Visualizados" valor={String(resumoPortalParceiro.acessosVisualizados)} destaque="green" />
              <ResumoFiltroCard titulo="Solicitações" valor={String(resumoPortalParceiro.solicitacoesAbertas)} destaque="orange" />
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black text-slate-950">Logins com acesso</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={selecionarTodosUsuariosDoParceiro} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-50">
                    Selecionar vinculados
                  </button>
                  <button type="button" onClick={limparUsuariosSelecionados} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-100">
                    Limpar
                  </button>
                </div>
              </div>

              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {usuariosPortal.length === 0 ? (
                  <p className="rounded-xl bg-white p-3 text-sm font-bold text-slate-500">Nenhum login de cliente/parceiro encontrado.</p>
                ) : (
                  usuariosPortal.map((usuario) => (
                    <label
                      key={usuario.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm font-bold ${
                        usuariosSelecionadosPortal.includes(usuario.id)
                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input type="checkbox" checked={usuariosSelecionadosPortal.includes(usuario.id)} onChange={() => alternarUsuarioSelecionado(usuario.id)} />
                      <span className="min-w-0 truncate">{usuarioPortalLabel(usuario)}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <input
              value={observacaoLiberacaoPortal}
              onChange={(e) => setObservacaoLiberacaoPortal(e.target.value)}
              placeholder="Observação para o parceiro, ex: Repasse previsto para 30/06"
              className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"
            />

            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
              <button
                type="button"
                onClick={() => liberarPortalParceiro(filtrados)}
                disabled={salvandoPortal || usuariosSelecionadosPortal.length === 0}
                className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-black text-green-700 hover:bg-green-100 disabled:opacity-50"
              >
                {salvandoPortal ? 'Salvando...' : 'Liberar filtrados'}
              </button>
              <button
                type="button"
                onClick={() => ocultarPortalParceiro(filtrados, true)}
                disabled={salvandoPortal || usuariosSelecionadosPortal.length === 0}
                className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-black text-yellow-700 hover:bg-yellow-100 disabled:opacity-50"
              >
                Ocultar selecionados
              </button>
              <button
                type="button"
                onClick={() => ocultarPortalParceiro(filtrados, false)}
                disabled={salvandoPortal}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                Ocultar todos
              </button>
            </div>
          </section>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-950">
                Processos do parceiro: {parceiroSelecionado || 'Todos'}
                <span className="ml-2 rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-600">{filtrados.length} registros</span>
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Colunas reorganizadas para leitura sem diminuir o zoom. As informações de portal e solicitação ficam agrupadas.
              </p>
            </div>

            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                {['TODOS', 'PAGO', 'PENDENTE'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setAba(item)
                      setPagina(1)
                    }}
                    className={`rounded-lg px-4 py-2 text-xs font-black ${
                      aba === item ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-white'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <input
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value)
                  setPagina(1)
                }}
                placeholder="Buscar processo, cliente, AWB..."
                className="min-w-[280px] rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />

              <button type="button" onClick={gerarPdfFiltro} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">
                📄 Gerar PDF
              </button>

              <button
                type="button"
                onClick={() => {
                  setBusca('')
                  setAba('TODOS')
                  setPagina(1)
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                Limpar
              </button>
            </div>
          </div>

          <section className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <ResumoFiltroCard titulo="Processos" valor={String(resumoFiltrado.qtd)} />
              <ResumoFiltroCard titulo="Total terceiro" valor={moeda(resumoFiltrado.total)} />
              <ResumoFiltroCard titulo="Pago terceiro" valor={moeda(resumoFiltrado.pago)} destaque="green" />
              <ResumoFiltroCard titulo="Pendente terceiro" valor={moeda(resumoFiltrado.pendente)} destaque="orange" />
              <ResumoFiltroCard titulo="Ticket médio" valor={moeda(resumoFiltrado.ticket)} />
            </div>
          </section>

          {awbsDuplicados.length > 0 && (
            <section className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h4 className="text-base font-black text-red-700">
                    🚨 AWB duplicado encontrado
                  </h4>
                  <p className="text-sm font-bold text-red-600">
                    Revise antes de gerar PDF ou marcar pagamento. Pode existir processo lançado em duplicidade.
                  </p>
                </div>

                <span className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-black text-red-700">
                  {awbsDuplicados.length} AWB(s) duplicado(s)
                </span>
              </div>

              <div className="space-y-2">
                {awbsDuplicados.slice(0, 8).map((item) => (
                  <div
                    key={item.awb}
                    className="flex flex-col gap-3 rounded-xl border border-red-200 bg-white p-3 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div>
                      <p className="font-black text-slate-950">AWB {item.awb}</p>
                      <p className="text-sm font-bold text-slate-600">
                        {item.qtd} registros · Total {moeda(item.total)}
                      </p>
                      <p className="text-xs font-bold text-slate-500">
                        Clientes: {item.clientes.join(', ')}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setBusca(item.awb)
                        setPagina(1)
                      }}
                      className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-black text-red-700 hover:bg-red-100"
                    >
                      Filtrar este AWB
                    </button>
                  </div>
                ))}

                {awbsDuplicados.length > 8 && (
                  <p className="text-sm font-bold text-red-600">
                    +{awbsDuplicados.length - 8} duplicidade(s) adicional(is). Use a busca para conferir.
                  </p>
                )}
              </div>
            </section>
          )}

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[1180px] text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <Th>Processo</Th>
                  <Th>Cliente / Serviço</Th>
                  <Th>Valor</Th>
                  <Th>Pagamento</Th>
                  <Th>Portal parceiro</Th>
                  <Th>Solicitação</Th>
                  <Th>Ações</Th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center">Carregando registros...</td>
                  </tr>
                ) : paginados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">Nenhum profit de parceiro encontrado.</td>
                  </tr>
                ) : (
                  paginados.map((item) => {
                    const statusAtual = statusVisual(item)
                    const acessosAtivos = acessosAtivosDoItem(item)
                    const acessosItem = acessosDoItem(item)
                    const ultimoAcesso = [...acessosAtivos]
                      .filter((acesso) => !!acesso.ultimo_visualizado_em)
                      .sort((a, b) => String(b.ultimo_visualizado_em).localeCompare(String(a.ultimo_visualizado_em)))[0]
                    const solicitacoesItem = solicitacoesDoItem(item)
                    const solicitacoesAbertas = solicitacoesAbertasDoItem(item)

                    return (
                      <tr key={item.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                        <Td>
                          <div className="space-y-1">
                            <p className="font-black text-slate-950">AWB {item.awb || '-'}</p>
                            <p className="text-xs font-bold text-slate-500">Parceiro: {nomeParceiroRegistro(item)}</p>
                          </div>
                        </Td>

                        <Td>
                          <div className="max-w-[360px] space-y-1">
                            <p className="font-bold text-slate-900">{item.cliente || '-'}</p>
                            <p className="text-xs font-bold text-slate-500">{item.servico || '-'}</p>
                          </div>
                        </Td>

                        <Td>
                          <p className="font-black text-slate-950">{moeda(item.debito_terceiro)}</p>
                        </Td>

                        <Td>
                          <div className="space-y-2">
                            <Badge texto={statusAtual} classe={badge(statusAtual)} />
                            <p className="text-xs font-bold text-slate-500">Mês: {item.mes_pgto || '-'}</p>
                          </div>
                        </Td>

                        <Td>
                          <div className="max-w-[340px] space-y-2">
                            {acessosAtivos.length > 0 ? (
                              <>
                                <Badge texto="LIBERADO" classe="bg-green-50 text-green-700 border-green-200" />
                                <div className="flex flex-wrap gap-1">
                                  {acessosAtivos.slice(0, 3).map((acesso) => (
                                    <span key={acesso.id} className="rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">
                                      {usuarioPortalLabel(usuarioDoAcesso(acesso))}
                                    </span>
                                  ))}
                                  {acessosAtivos.length > 3 && (
                                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600">+{acessosAtivos.length - 3}</span>
                                  )}
                                </div>
                                <p className="text-xs font-bold text-slate-500">
                                  Última visualização: {ultimoAcesso ? dataHoraBR(ultimoAcesso.ultimo_visualizado_em) : 'ainda não visualizado'}
                                </p>
                              </>
                            ) : (
                              <Badge texto="OCULTO" classe="bg-slate-50 text-slate-600 border-slate-200" />
                            )}
                            {acessosItem.length > acessosAtivos.length && (
                              <p className="text-xs font-bold text-slate-400">{acessosItem.length - acessosAtivos.length} acesso(s) oculto(s)</p>
                            )}
                          </div>
                        </Td>

                        <Td>
                          <div className="max-w-[280px] space-y-2">
                            {solicitacoesItem.length === 0 ? (
                              <span className="text-sm font-bold text-slate-400">Sem solicitação</span>
                            ) : (
                              solicitacoesItem.slice(0, 2).map((solicitacao) => (
                                <div key={solicitacao.id} className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                                  <div className="mb-1 flex flex-wrap items-center gap-2">
                                    <Badge texto={labelStatusSolicitacao(solicitacao.status)} classe={classeSolicitacaoAdmin(solicitacao.status)} />
                                    <span className="text-[10px] font-bold text-slate-500">{dataHoraBR(solicitacao.solicitado_em)}</span>
                                  </div>
                                  <p className="text-xs font-black text-slate-800">{usuarioPortalLabel(usuarioDaSolicitacao(solicitacao))}</p>
                                  {['SOLICITADO', 'EM_ANALISE'].includes(String(solicitacao.status || '').toUpperCase()) && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      <button type="button" onClick={() => atualizarSolicitacaoProfit(solicitacao, 'EM_ANALISE')} className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-700 hover:bg-blue-100">Em análise</button>
                                      <button type="button" onClick={() => atualizarSolicitacaoProfit(solicitacao, 'APROVADO')} className="rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-[10px] font-black text-green-700 hover:bg-green-100">Aprovar</button>
                                      <button type="button" onClick={() => atualizarSolicitacaoProfit(solicitacao, 'RECUSADO')} className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-black text-red-700 hover:bg-red-100">Recusar</button>
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                            {solicitacoesAbertas.length > 0 && <p className="text-xs font-black text-orange-600">{solicitacoesAbertas.length} aberta(s)</p>}
                          </div>
                        </Td>

                        <Td>
                          <div className="flex flex-wrap gap-2">
                            {statusAtual === 'PAGO' ? (
                              <button onClick={() => reabrirPagamento(item)} className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs font-black text-yellow-700 hover:bg-yellow-100">↺ Reabrir</button>
                            ) : (
                              <button onClick={() => marcarPago(item)} className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-black text-green-700 hover:bg-green-100">✓ Pago</button>
                            )}
                            <button onClick={() => editar(item)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-600 hover:bg-blue-100">Editar</button>
                            <button onClick={() => liberarPortalParceiro([item])} disabled={usuariosSelecionadosPortal.length === 0} className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-black text-purple-700 hover:bg-purple-100 disabled:opacity-50">Liberar</button>
                            <button onClick={() => ocultarPortalParceiro([item], usuariosSelecionadosPortal.length > 0)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100">Ocultar</button>
                          </div>
                        </Td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-slate-500">Mostrando {paginados.length} de {filtrados.length} registros</p>

            <div className="flex items-center gap-2">
              <button type="button" disabled={pagina <= 1} onClick={() => setPagina((p) => Math.max(1, p - 1))} className="rounded-lg bg-slate-100 px-4 py-2 font-bold text-slate-800 disabled:opacity-50">Anterior</button>
              <span className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white">{pagina}</span>
              <span className="text-sm font-bold text-slate-500">de {totalPaginas}</span>
              <button type="button" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} className="rounded-lg bg-slate-100 px-4 py-2 font-bold text-slate-800 disabled:opacity-50">Próxima</button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )

}

function KpiCard({ titulo, valor, subtitulo, icone, cor }: any) {
  const cores: any = {
    blue: {
      box: 'border-blue-100',
      icon: 'bg-blue-600 text-white',
      text: 'text-blue-600',
      line: 'stroke-blue-500',
    },
    orange: {
      box: 'border-orange-100',
      icon: 'bg-yellow-400 text-white',
      text: 'text-orange-500',
      line: 'stroke-yellow-500',
    },
    green: {
      box: 'border-green-100',
      icon: 'bg-green-500 text-white',
      text: 'text-green-600',
      line: 'stroke-green-500',
    },
    purple: {
      box: 'border-purple-100',
      icon: 'bg-purple-600 text-white',
      text: 'text-purple-600',
      line: 'stroke-purple-500',
    },
  }

  const cfg = cores[cor] || cores.blue

  return (
    <div className={`rounded-2xl border ${cfg.box} bg-white p-5 shadow-sm`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl ${cfg.icon}`}>
            {icone}
          </div>

          <div>
            <p className={`text-xs font-black tracking-widest ${cfg.text}`}>
              {titulo}
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">{valor}</p>
            <p className="mt-2 text-sm text-slate-500">{subtitulo}</p>
          </div>
        </div>

        <svg width="70" height="42" viewBox="0 0 70 42" className="mt-8 hidden md:block">
          <path
            d="M2 32 C10 26, 16 30, 23 22 C30 14, 35 31, 42 20 C49 10, 55 18, 68 5"
            fill="none"
            strokeWidth="3"
            className={cfg.line}
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  )
}

function MiniInfo({ titulo, valor, destaque }: any) {
  const cor =
    destaque === 'green'
      ? 'text-green-600'
      : destaque === 'orange'
      ? 'text-orange-500'
      : 'text-slate-950'

  return (
    <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="truncate text-[11px] font-black uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className={`mt-1 truncate text-lg font-black ${cor}`}>{valor}</p>
    </div>
  )
}

function ResumoFiltroCard({ titulo, valor, destaque }: any) {
  const cor =
    destaque === 'green'
      ? 'text-green-600'
      : destaque === 'orange'
      ? 'text-orange-600'
      : 'text-slate-950'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
        {titulo}
      </p>
      <p className={`mt-1 text-lg font-black ${cor}`}>{valor}</p>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-800">
        {value}
      </p>
    </div>
  )
}

function Badge({ texto, classe }: { texto: string; classe: string }) {
  return (
    <span
      className={`inline-flex rounded-lg border px-3 py-1 text-xs font-black whitespace-nowrap ${classe}`}
    >
      {texto}
    </span>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-3 text-left text-[11px] font-black uppercase tracking-wide text-slate-500 whitespace-nowrap">
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-3 align-top text-sm text-slate-700">{children}</td>
}
