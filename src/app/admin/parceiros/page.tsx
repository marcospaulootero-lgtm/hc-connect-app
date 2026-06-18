'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const PAGE_SIZE = 10
const LOTE_SUPABASE = 1000

const MESES = [
  { key: 'janeiro', label: 'Jan' },
  { key: 'fevereiro', label: 'Fev' },
  { key: 'marco', label: 'Mar' },
  { key: 'março', label: 'Mar' },
  { key: 'abril', label: 'Abr' },
  { key: 'maio', label: 'Mai' },
  { key: 'junho', label: 'Jun' },
  { key: 'julho', label: 'Jul' },
  { key: 'agosto', label: 'Ago' },
  { key: 'setembro', label: 'Set' },
  { key: 'outubro', label: 'Out' },
  { key: 'novembro', label: 'Nov' },
  { key: 'dezembro', label: 'Dez' },
]

const MESES_UNICOS = [
  { key: 'janeiro', label: 'Jan' },
  { key: 'fevereiro', label: 'Fev' },
  { key: 'março', label: 'Mar' },
  { key: 'abril', label: 'Abr' },
  { key: 'maio', label: 'Mai' },
  { key: 'junho', label: 'Jun' },
  { key: 'julho', label: 'Jul' },
  { key: 'agosto', label: 'Ago' },
  { key: 'setembro', label: 'Set' },
  { key: 'outubro', label: 'Out' },
  { key: 'novembro', label: 'Nov' },
  { key: 'dezembro', label: 'Dez' },
]

export default function ParceirosPage() {
  const [registros, setRegistros] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [editando, setEditando] = useState<any>(null)

  const [busca, setBusca] = useState('')
  const [buscaParceiro, setBuscaParceiro] = useState('')
  const [parceiroSelecionado, setParceiroSelecionado] = useState('')
  const [aba, setAba] = useState('TODOS')
  const [pagina, setPagina] = useState(1)
  const [periodo, setPeriodo] = useState('2024')

  const [form, setForm] = useState({
    parceiro: '',
    debito_terceiro: '',
    pgta_terceiros: 'PENDENTE',
    mes_pgto: '',
  })

  useEffect(() => {
    carregar()
  }, [])

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

  function exportarParceiro() {
    const cabecalho = [
      'Parceiro',
      'Cliente',
      'AWB',
      'Serviço',
      'Valor Parceiro',
      'Mês Pgto',
      'Status',
    ]

    const linhas = filtrados.map((item) => [
      item.parceiro || item.despachante || '',
      item.cliente || '',
      item.awb || '',
      item.servico || '',
      Number(item.debito_terceiro || 0).toFixed(2).replace('.', ','),
      item.mes_pgto || '',
      statusVisual(item),
    ])

    const csv = [cabecalho, ...linhas]
      .map((linha) => linha.map((campo) => `"${String(campo).replace(/"/g, '""')}"`).join(';'))
      .join('\n')

    const blob = new Blob([`\uFEFF${csv}`], {
      type: 'text/csv;charset=utf-8;',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `profit-parceiro-${parceiroSelecionado || 'todos'}.csv`
    link.click()
    URL.revokeObjectURL(url)
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
    const emAberto = dadosParceiro.filter((item) => status(item) !== 'PAGO')
    const pagos = dadosParceiro.filter((item) => status(item) === 'PAGO')

    function total(lista: any[]) {
      return lista.reduce((acc, item) => acc + Number(item.debito_terceiro || 0), 0)
    }

    const totalParceiro = total(dadosParceiro)

    return {
      total: totalParceiro,
      aberto: total(emAberto),
      pago: total(pagos),
      qtd: dadosParceiro.length,
      ticket: dadosParceiro.length ? totalParceiro / dadosParceiro.length : 0,
    }
  }, [dadosParceiro])

  const ranking = useMemo(() => {
    return [...parceirosResumo].slice(0, 5)
  }, [parceirosResumo])

  const graficoMensal = useMemo(() => {
    const mapa: Record<string, number> = {}

    MESES_UNICOS.forEach((mes) => {
      mapa[mes.key] = 0
    })

    dadosParceiro.forEach((item) => {
      if (status(item) !== 'PAGO') return

      const mes = normalizarMes(item.mes_pgto)
      if (!mes) return

      mapa[mes] = (mapa[mes] || 0) + Number(item.debito_terceiro || 0)
    })

    const lista = MESES_UNICOS.map((mes) => ({
      ...mes,
      valor: mapa[mes.key] || 0,
    }))

    const maior = Math.max(...lista.map((item) => item.valor), 1)

    return lista.map((item) => ({
      ...item,
      altura: Math.max(8, (item.valor / maior) * 150),
    }))
  }, [dadosParceiro])

  const filtrados = useMemo(() => {
    const termo = normalizarBusca(busca)

    return dadosParceiro.filter((item) => {
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
  }, [dadosParceiro, busca, aba])

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

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[290px_1fr]">
        <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <h2 className="text-base font-black">Selecione o parceiro</h2>

            <div className="mt-4 flex items-center rounded-xl border border-slate-200 bg-white px-3">
              <input
                value={buscaParceiro}
                onChange={(e) => setBuscaParceiro(e.target.value)}
                placeholder="Buscar parceiro..."
                className="w-full py-3 text-sm outline-none"
              />
              <span className="text-slate-400">⌕</span>
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
                    : 'hover:bg-slate-50'
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
                    <p className="text-xs font-black text-slate-900">
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
                onChange={(e) => setPeriodo(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"
              >
                <option value="2024">📅 Período: 2024</option>
                <option value="2025">📅 Período: 2025</option>
                <option value="2026">📅 Período: 2026</option>
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

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_330px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black">
                    Evolução de pagamentos (por mês)
                  </h3>
                  <p className="text-sm text-slate-500">
                    Valores pagos por mês
                  </p>
                </div>

                <select className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">
                  <option>Exibir: Pagos</option>
                </select>
              </div>

              <div className="flex h-[245px] items-end gap-3 border-t border-slate-100 pt-6">
                {graficoMensal.map((item) => (
                  <div key={item.key} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-[10px] font-black text-slate-700">
                      {item.valor > 0 ? moeda(item.valor).replace('R$', '').trim() : ''}
                    </span>
                    <div
                      className="w-full max-w-[34px] rounded-t-lg bg-blue-500 shadow-sm"
                      style={{ height: `${item.altura}px` }}
                      title={`${item.label}: ${moeda(item.valor)}`}
                    />
                    <span className="text-xs font-bold text-slate-500">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-black">
                Ranking de parceiros
                <span className="font-normal text-slate-500"> (por valor total)</span>
              </h3>
              <p className="mb-4 text-sm text-slate-500">
                Top 5 parceiros por valor total
              </p>

              <div className="space-y-3">
                {ranking.map((item: any, index: number) => (
                  <div
                    key={item.nome}
                    className="flex items-center justify-between border-b border-slate-100 pb-3"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
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

                      <div>
                        <p className="font-black text-slate-900">{item.nome}</p>
                        <p className="text-xs text-slate-500">{item.qtd} processos</p>
                      </div>
                    </div>

                    <p className="text-sm font-black text-slate-950">
                      {moeda(item.total)}
                    </p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  setParceiroSelecionado('')
                  setPagina(1)
                }}
                className="mt-4 w-full rounded-xl border border-slate-200 py-3 text-sm font-black text-blue-600 hover:bg-blue-50"
              >
                Ver ranking completo
              </button>
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
                  onClick={exportarParceiro}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                >
                  ⇩ Exportar
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

            <div className="overflow-x-auto">
              <table className="min-w-[1250px] w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <Th>AWB</Th>
                    <Th>Cliente</Th>
                    <Th>Serviço</Th>
                    <Th>Valor Parceiro</Th>
                    <Th>Mês Pgto</Th>
                    <Th>Status</Th>
                    <Th>Pagamento</Th>
                    <Th>Ações</Th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center">
                        Carregando registros...
                      </td>
                    </tr>
                  ) : paginados.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
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
                          <Td>{item.mes_pgto || '-'}</Td>
                          <Td>
                            <Badge texto={statusAtual} classe={badge(statusAtual)} />
                          </Td>
                          <Td>{statusAtual === 'PAGO' ? item.mes_pgto || '-' : '-'}</Td>
                          <Td>
                            <div className="flex gap-2">
                              {statusAtual === 'PAGO' ? (
                                <button
                                  onClick={() => reabrirPagamento(item)}
                                  className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 font-bold text-yellow-700 hover:bg-yellow-100"
                                >
                                  ↺
                                </button>
                              ) : (
                                <button
                                  onClick={() => marcarPago(item)}
                                  className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 font-bold text-green-700 hover:bg-green-100"
                                >
                                  ✓
                                </button>
                              )}

                              <button
                                onClick={() => editar(item)}
                                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 font-bold text-blue-600 hover:bg-blue-100"
                              >
                                ›
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
