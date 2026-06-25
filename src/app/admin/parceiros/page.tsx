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
  const [parceiroUsuarioSelecionado, setParceiroUsuarioSelecionado] = useState('')
  const [salvandoPortal, setSalvandoPortal] = useState(false)

  const [busca, setBusca] = useState('')
  const [buscaParceiro, setBuscaParceiro] = useState('')
  const [parceiroSelecionado, setParceiroSelecionado] = useState('')
  const [aba, setAba] = useState('TODOS')
  const [pagina, setPagina] = useState(1)
  const [periodo, setPeriodo] = useState('TODOS')

  const [form, setForm] = useState({
    parceiro: '',
    debito_terceiro: '',
    pgta_terceiros: 'PENDENTE',
    mes_pgto: '',
    visivel_parceiro: false,
    observacao_parceiro: '',
  })

  useEffect(() => {
    carregar()
  }, [])

  useEffect(() => {
    const registrosDoParceiro = registros.filter((item) => nomeParceiroRegistro(item) === parceiroSelecionado)
    const usuarioVinculado = registrosDoParceiro.find((item) => item.parceiro_usuario_id)?.parceiro_usuario_id || ''

    setParceiroUsuarioSelecionado(usuarioVinculado)
  }, [parceiroSelecionado, registros])

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

  function normalizarBusca(valor: any) {
    return normalizarTexto(valor)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
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

    const todos = respostas.flatMap((res) => res.data || [])

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

  function editar(item: any) {
    setEditando(item)
    setForm({
      parceiro: item.parceiro || item.despachante || '',
      debito_terceiro: String(item.debito_terceiro || ''),
      pgta_terceiros: normalizarStatusParceiro(item.pgta_terceiros),
      mes_pgto: item.mes_pgto || '',
      visivel_parceiro: !!item.visivel_parceiro,
      observacao_parceiro: item.observacao_parceiro || '',
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
      visivel_parceiro: false,
      observacao_parceiro: '',
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
        visivel_parceiro: !!form.visivel_parceiro,
        observacao_parceiro: form.observacao_parceiro || null,
        liberado_parceiro_em: form.visivel_parceiro
          ? editando.liberado_parceiro_em || new Date().toISOString()
          : null,
        parceiro_usuario_id: form.visivel_parceiro
          ? editando.parceiro_usuario_id || parceiroUsuarioSelecionado || null
          : editando.parceiro_usuario_id || parceiroUsuarioSelecionado || null,
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

  async function vincularLoginParceiro() {
    if (!parceiroSelecionado) {
      alert('Selecione um parceiro antes de vincular o login.')
      return
    }

    if (!parceiroUsuarioSelecionado) {
      alert('Selecione o login que irá visualizar os repasses deste parceiro.')
      return
    }

    const registrosDoParceiro = registros.filter(
      (item) => nomeParceiroRegistro(item) === parceiroSelecionado
    )

    if (registrosDoParceiro.length === 0) {
      alert('Nenhum registro encontrado para este parceiro.')
      return
    }

    if (
      !confirm(
        `Vincular o login selecionado ao parceiro ${parceiroSelecionado}?\n\nTodos os processos atuais deste parceiro receberão este vínculo, mas só ficarão visíveis no portal quando você clicar em Liberar.`
      )
    ) {
      return
    }

    setSalvandoPortal(true)

    const lotes = dividirEmLotes(
      registrosDoParceiro.map((item) => item.id).filter(Boolean),
      200
    )

    for (const lote of lotes) {
      const { error } = await supabase
        .from('financeiro_embarques')
        .update({
          parceiro_usuario_id: parceiroUsuarioSelecionado,
          atualizado_em: new Date().toISOString(),
        })
        .in('id', lote)

      if (error) {
        alert('Erro ao vincular login ao parceiro: ' + error.message)
        setSalvandoPortal(false)
        return
      }
    }

    alert('Login vinculado ao parceiro com sucesso.')
    await carregar()
    setSalvandoPortal(false)
  }

  async function atualizarVisibilidadePortal(itens: any[], visivel: boolean) {
    if (!itens.length) {
      alert('Nenhum processo encontrado no filtro atual.')
      return
    }

    if (visivel && !parceiroUsuarioSelecionado) {
      alert('Selecione e vincule um login antes de liberar os repasses no portal.')
      return
    }

    const textoAcao = visivel ? 'liberar no portal' : 'ocultar do portal'

    if (
      !confirm(
        `Deseja ${textoAcao} ${itens.length} processo(s) do filtro atual?\n\nParceiro: ${
          parceiroSelecionado || 'Todos'
        }`
      )
    ) {
      return
    }

    setSalvandoPortal(true)

    const lotes = dividirEmLotes(
      itens.map((item) => item.id).filter(Boolean),
      200
    )

    for (const lote of lotes) {
      const payload: any = {
        visivel_parceiro: visivel,
        liberado_parceiro_em: visivel ? new Date().toISOString() : null,
        atualizado_em: new Date().toISOString(),
      }

      if (visivel && parceiroUsuarioSelecionado) {
        payload.parceiro_usuario_id = parceiroUsuarioSelecionado
      }

      const { error } = await supabase
        .from('financeiro_embarques')
        .update(payload)
        .in('id', lote)

      if (error) {
        alert(`Erro ao ${textoAcao}: ${error.message}`)
        setSalvandoPortal(false)
        return
      }
    }

    alert(visivel ? 'Repasses liberados no portal.' : 'Repasses ocultados do portal.')
    await carregar()
    setSalvandoPortal(false)
  }

  async function alternarVisibilidadePortal(item: any) {
    const novoStatus = !item.visivel_parceiro

    if (novoStatus && !item.parceiro_usuario_id && !parceiroUsuarioSelecionado) {
      alert('Selecione o login do parceiro antes de liberar este repasse.')
      return
    }

    const { error } = await supabase
      .from('financeiro_embarques')
      .update({
        visivel_parceiro: novoStatus,
        parceiro_usuario_id: novoStatus
          ? item.parceiro_usuario_id || parceiroUsuarioSelecionado || null
          : item.parceiro_usuario_id || parceiroUsuarioSelecionado || null,
        liberado_parceiro_em: novoStatus ? new Date().toISOString() : null,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', item.id)

    if (error) {
      alert('Erro ao atualizar visibilidade no portal: ' + error.message)
      return
    }

    await carregar()
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
      const nome = nomeParceiroRegistro(item)

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
        nomeParceiroRegistro(item) ===
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

  const totalVisiveisParceiro = dadosParceiroPeriodo.filter((item) => item.visivel_parceiro).length
  const totalOcultosParceiro = dadosParceiroPeriodo.filter((item) => !item.visivel_parceiro).length
  const usuarioParceiroAtual = usuariosPortal.find((usuario) => usuario.id === parceiroUsuarioSelecionado) || null

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
    <main className="min-h-screen bg-[#f5f7fb] p-6 text-slate-900">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">
            Profit Parceiros
          </h1>
          <p className="text-sm text-slate-500">
            Acompanhe os valores e pagamentos dos seus parceiros
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-blue-200 bg-white px-5 py-3 text-sm font-black text-blue-600 shadow-sm hover:bg-blue-50">
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
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
          >
            ⟳ {loading ? 'Atualizando...' : 'Atualizar dados'}
          </button>
        </div>
      </div>

      <section className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          titulo="PROFIT TOTAL"
          valor={moeda(resumoGeral.total)}
          subtitulo="Total gerado para parceiros"
          icone="🤝"
          cor="blue"
        />
        <KpiCard
          titulo="A PAGAR"
          valor={moeda(resumoGeral.aberto)}
          subtitulo="Valores pendentes"
          icone="💰"
          cor="orange"
        />
        <KpiCard
          titulo="PAGOS"
          valor={moeda(resumoGeral.pago)}
          subtitulo="Valores pagos"
          icone="✅"
          cor="green"
        />
        <KpiCard
          titulo="PARCEIROS"
          valor={String(resumoGeral.qtdParceiros)}
          subtitulo="Parceiros ativos"
          icone="👥"
          cor="purple"
        />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[330px_1fr]">
        <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <h2 className="text-base font-black">Selecione o parceiro</h2>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-1">
              <input
                value={buscaParceiro}
                onChange={(e) => setBuscaParceiro(e.target.value)}
                placeholder="Buscar parceiro..."
                className="w-full rounded-lg bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="max-h-[670px] overflow-y-auto">
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
                className={`group w-full border-b border-slate-100 p-4 text-left transition ${
                  parceiroSelecionado === item.nome
                    ? 'border-l-4 border-l-blue-600 bg-blue-50'
                    : 'bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{item.nome}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.qtd} processos
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-black text-slate-950">
                      {moeda(item.total)}
                    </p>
                    <span className="text-slate-300 group-hover:text-blue-500">›</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="border-t border-slate-100 p-4">
            <button
              type="button"
              onClick={() => {
                setParceiroSelecionado('')
                setPagina(1)
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-blue-600 hover:bg-blue-50"
            >
              ☰ Ver todos parceiros
            </button>
          </div>
        </aside>

        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 text-3xl font-black text-white shadow-sm">
                  {inicialParceiro.toUpperCase()}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-3xl font-black text-slate-950">
                      {parceiroSelecionado || 'Todos parceiros'}
                    </h2>

                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-black text-green-700">
                      Parceiro ativo
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    Painel consolidado de valores, pagamentos e processos
                  </p>
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
                  <option key={ano} value={ano}>
                    📅 Período: {ano}
                  </option>
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
              <div
                className="h-full rounded-full bg-green-500"
                style={{ width: `${percentualPago}%` }}
              />
            </div>

            <p className="mt-2 text-xs font-bold text-slate-500">
              {percentualPago}% pago · {100 - percentualPago}% pendente
            </p>
          </section>

          <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-xs font-black tracking-widest text-blue-600">
                  PORTAL DO PARCEIRO
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-950">
                  Disponibilizar repasses para visualização
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Escolha o login que representa este parceiro. Depois libere apenas os processos que devem aparecer no portal.
                </p>
              </div>

              <div className="grid w-full gap-3 xl:max-w-[680px]">
                <select
                  value={parceiroUsuarioSelecionado}
                  onChange={(e) => setParceiroUsuarioSelecionado(e.target.value)}
                  disabled={!parceiroSelecionado || parceiroSelecionado === 'Sem parceiro'}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"
                >
                  <option value="">Selecionar login do parceiro...</option>
                  {usuariosPortal.map((usuario) => (
                    <option key={usuario.id} value={usuario.id}>
                      {usuarioPortalLabel(usuario)}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <button
                    type="button"
                    onClick={vincularLoginParceiro}
                    disabled={salvandoPortal || !parceiroSelecionado || parceiroSelecionado === 'Sem parceiro'}
                    className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {salvandoPortal ? 'Salvando...' : 'Vincular login'}
                  </button>

                  <button
                    type="button"
                    onClick={() => atualizarVisibilidadePortal(filtrados, true)}
                    disabled={salvandoPortal || !parceiroSelecionado || parceiroSelecionado === 'Sem parceiro'}
                    className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-black text-green-700 hover:bg-green-100 disabled:opacity-50"
                  >
                    Liberar filtrados
                  </button>

                  <button
                    type="button"
                    onClick={() => atualizarVisibilidadePortal(filtrados, false)}
                    disabled={salvandoPortal || !parceiroSelecionado || parceiroSelecionado === 'Sem parceiro'}
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    Ocultar filtrados
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <ResumoFiltroCard
                titulo="Login vinculado"
                valor={usuarioParceiroAtual ? usuarioPortalLabel(usuarioParceiroAtual) : 'Não definido'}
              />
              <ResumoFiltroCard titulo="Liberados no portal" valor={String(totalVisiveisParceiro)} destaque="green" />
              <ResumoFiltroCard titulo="Ocultos" valor={String(totalOcultosParceiro)} destaque="orange" />
              <ResumoFiltroCard titulo="Filtro atual" valor={`${filtrados.length} processos`} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-black">
                  Ranking de parceiros
                  <span className="font-normal text-slate-500"> (por valor total)</span>
                </h3>
                <p className="text-sm text-slate-500">
                  Top 5 parceiros por valor total. O gráfico mensal foi removido para dar mais espaço aos processos.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setParceiroSelecionado('')
                  setPagina(1)
                }}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-blue-600 hover:bg-blue-50 md:w-auto"
              >
                Ver ranking completo
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              {ranking.map((item: any, index: number) => (
                <button
                  key={item.nome}
                  type="button"
                  onClick={() => {
                    setParceiroSelecionado(item.nome)
                    setPagina(1)
                    setBusca('')
                    setAba('TODOS')
                  }}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 px-4 py-3 text-left hover:border-blue-200 hover:bg-blue-50"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${
                        index === 0
                          ? 'bg-yellow-100 text-yellow-700'
                          : index === 1
                          ? 'bg-slate-100 text-slate-600'
                          : index === 2
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-slate-50 text-slate-600'
                      }`}
                    >
                      {index < 3 ? '🏅' : index + 1}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate font-black text-slate-900">{item.nome}</p>
                      <p className="text-xs text-slate-500">{item.qtd} processos</p>
                    </div>
                  </div>

                  <p className="whitespace-nowrap text-sm font-black text-slate-950">
                    {moeda(item.total)}
                  </p>
                </button>
              ))}
            </div>
          </section>

          {editando && (
            <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black">Editar pagamento parceiro</h2>
                  <p className="text-sm text-slate-500">
                    {editando.cliente} · AWB {editando.awb}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={cancelar}
                  className="rounded-xl bg-slate-100 px-4 py-2 font-bold text-slate-800 hover:bg-slate-200"
                >
                  Cancelar
                </button>
              </div>

              <form onSubmit={salvar} className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div>
                  <label className="text-sm font-semibold text-slate-600">Parceiro</label>
                  <input
                    value={form.parceiro}
                    onChange={(e) => setForm({ ...form, parceiro: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </div>

                <Info label="Cliente" value={editando.cliente || '-'} />
                <Info label="AWB" value={editando.awb || '-'} />

                <div>
                  <label className="text-sm font-semibold text-slate-600">
                    Valor parceiro
                  </label>
                  <input
                    value={form.debito_terceiro}
                    onChange={(e) =>
                      setForm({ ...form, debito_terceiro: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-600">
                    Status pagamento
                  </label>
                  <select
                    value={form.pgta_terceiros}
                    onChange={(e) =>
                      setForm({ ...form, pgta_terceiros: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  >
                    <option value="PENDENTE">PENDENTE</option>
                    <option value="PAGO">PAGO</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-600">
                    Mês do pagamento
                  </label>
                  <input
                    value={form.mes_pgto}
                    onChange={(e) => setForm({ ...form, mes_pgto: e.target.value })}
                    placeholder="Ex: junho"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-600">
                    Portal parceiro
                  </label>
                  <label className="mt-1 flex min-h-[42px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={form.visivel_parceiro}
                      onChange={(e) =>
                        setForm({ ...form, visivel_parceiro: e.target.checked })
                      }
                    />
                    Visível
                  </label>
                </div>

                <div className="md:col-span-4">
                  <label className="text-sm font-semibold text-slate-600">
                    Observação para o parceiro
                  </label>
                  <textarea
                    value={form.observacao_parceiro}
                    onChange={(e) =>
                      setForm({ ...form, observacao_parceiro: e.target.value })
                    }
                    placeholder="Ex: Repasse previsto para o fechamento do mês."
                    className="mt-1 min-h-[90px] w-full rounded-xl border border-slate-200 px-3 py-2"
                  />
                </div>

                <div className="md:col-span-4 flex gap-3">
                  <button
                    disabled={salvando}
                    className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {salvando ? 'Salvando...' : 'Salvar pagamento'}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h3 className="text-base font-black">
                  Processos do parceiro: {parceiroSelecionado || 'Todos'}
                  <span className="ml-2 rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-600">
                    {filtrados.length} registros
                  </span>
                </h3>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  Controle dos terceiros: valor = coluna I, status = coluna Q, mês do pagamento = coluna S.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  value={busca}
                  onChange={(e) => {
                    setBusca(e.target.value)
                    setPagina(1)
                  }}
                  placeholder="Buscar processo, cliente, AWB..."
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm xl:w-[340px]"
                />

                <button
                  type="button"
                  onClick={gerarPdfFiltro}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                >
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
                  ⌕
                </button>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {['TODOS', 'PAGO', 'PENDENTE'].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setAba(item)
                    setPagina(1)
                  }}
                  className={`rounded-xl border px-4 py-2 text-xs font-black ${
                    aba === item
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <section className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-950">
                    Resumo do filtro para enviar ao cliente
                  </h4>
                  <p className="text-xs font-bold text-slate-500">
                    Os valores abaixo mudam conforme parceiro, período, busca e status selecionados.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={gerarPdfFiltro}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700"
                >
                  Gerar PDF do filtro
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <ResumoFiltroCard titulo="Processos" valor={String(resumoFiltrado.qtd)} />
                <ResumoFiltroCard titulo="Total terceiro" valor={moeda(resumoFiltrado.total)} />
                <ResumoFiltroCard titulo="Pago terceiro" valor={moeda(resumoFiltrado.pago)} destaque="green" />
                <ResumoFiltroCard titulo="Pendente terceiro" valor={moeda(resumoFiltrado.pendente)} destaque="orange" />
                <ResumoFiltroCard titulo="Ticket médio" valor={moeda(resumoFiltrado.ticket)} />
              </div>
            </section>

            <div className="overflow-x-auto">
              <table className="min-w-[1680px] w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <Th>AWB</Th>
                    <Th>Cliente</Th>
                    <Th>Serviço</Th>
                    <Th>Valor Terceiro</Th>
                    <Th>Status Pgto Terceiro</Th>
                    <Th>Mês Pgto Terceiro</Th>
                    <Th>Portal parceiro</Th>
                    <Th>Observação parceiro</Th>
                    <Th>Ações</Th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center">
                        Carregando registros...
                      </td>
                    </tr>
                  ) : paginados.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        Nenhum profit de parceiro encontrado.
                      </td>
                    </tr>
                  ) : (
                    paginados.map((item) => {
                      const statusAtual = statusVisual(item)

                      return (
                        <tr
                          key={item.id}
                          className="border-b border-slate-100 hover:bg-slate-50"
                        >
                          <Td>{item.awb || '-'}</Td>
                          <Td>{item.cliente || '-'}</Td>
                          <Td>{item.servico || '-'}</Td>
                          <Td>
                            <span className="font-black text-slate-900">
                              {moeda(item.debito_terceiro)}
                            </span>
                          </Td>
                          <Td>
                            <Badge texto={statusAtual} classe={badge(statusAtual)} />
                          </Td>
                          <Td>{item.mes_pgto || '-'}</Td>
                          <Td>
                            <Badge
                              texto={item.visivel_parceiro ? 'VISÍVEL' : 'OCULTO'}
                              classe={
                                item.visivel_parceiro
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : 'bg-slate-50 text-slate-600 border-slate-200'
                              }
                            />
                          </Td>
                          <Td>{item.observacao_parceiro || '-'}</Td>
                          <Td>
                            <div className="flex gap-2">
                              {statusAtual === 'PAGO' ? (
                                <button
                                  onClick={() => reabrirPagamento(item)}
                                  className="min-w-[110px] rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2 font-black text-yellow-700 hover:bg-yellow-100"
                                >
                                  ↺ Reabrir
                                </button>
                              ) : (
                                <button
                                  onClick={() => marcarPago(item)}
                                  className="min-w-[110px] rounded-lg border border-green-200 bg-green-50 px-4 py-2 font-black text-green-700 hover:bg-green-100"
                                >
                                  ✓ Pago
                                </button>
                              )}

                              <button
                                onClick={() => editar(item)}
                                className="min-w-[90px] rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 font-black text-blue-600 hover:bg-blue-100"
                              >
                                Editar
                              </button>

                              <button
                                onClick={() => alternarVisibilidadePortal(item)}
                                className={`min-w-[120px] rounded-lg border px-4 py-2 font-black ${
                                  item.visivel_parceiro
                                    ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                                    : 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100'
                                }`}
                              >
                                {item.visivel_parceiro ? 'Ocultar' : 'Liberar'}
                              </button>
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
              <p className="text-sm text-slate-500">
                Mostrando {paginados.length} de {filtrados.length} registros
              </p>

              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  disabled={pagina <= 1}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  className="rounded-lg bg-slate-100 px-4 py-2 font-bold text-slate-800 disabled:opacity-50"
                >
                  Anterior
                </button>

                <span className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white">
                  {pagina}
                </span>

                <span className="text-sm font-bold text-slate-500">
                  de {totalPaginas}
                </span>

                <button
                  type="button"
                  disabled={pagina >= totalPaginas}
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                  className="rounded-lg bg-slate-100 px-4 py-2 font-bold text-slate-800 disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
            </div>
          </section>
        </div>
      </section>
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
    <div className="border-r border-slate-100 last:border-r-0">
      <p className="text-xs font-black text-slate-500">{titulo}</p>
      <p className={`mt-1 text-xl font-black ${cor}`}>{valor}</p>
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
    <th className="px-4 py-3 text-left font-black whitespace-nowrap">
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 whitespace-nowrap">{children}</td>
}
