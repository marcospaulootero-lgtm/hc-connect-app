'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type FormState = {
  cliente: string
  despachante: string
  awb: string
  fatura: string
  transportadora: string
  servico: string
  valor_cobranca: string
  doc_dta: string
  debito_terceiro: string
  valor_compra: string
  vencimento_cobranca: string
  recebimento: string
  mes: string
  mes_profit: string
  observacoes: string
}

type InputProps = {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}

const formVazio: FormState = {
  cliente: '',
  despachante: '',
  awb: '',
  fatura: '',
  transportadora: '',
  servico: '',
  valor_cobranca: '',
  doc_dta: '',
  debito_terceiro: '',
  valor_compra: '',
  vencimento_cobranca: '',
  recebimento: '',
  mes: '',
  mes_profit: '',
  observacoes: '',
}

const PAGE_SIZE = 10
const LOTE_SUPABASE = 1000

export default function FinanceiroPage() {
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const [aba, setAba] = useState('EM ABERTO')
  const [pagina, setPagina] = useState(1)

  const [busca, setBusca] = useState('')
  const [filtroTransportadora, setFiltroTransportadora] = useState('')
  const [filtroDespachante, setFiltroDespachante] = useState('')
  const [filtroServico, setFiltroServico] = useState('')

  const [form, setForm] = useState<FormState>(formVazio)

  useEffect(() => {
    carregarFinanceiro()
  }, [])

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

  function normalizarTexto(valor: any) {
    if (valor === null || valor === undefined) return ''
    return String(valor).trim()
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

  function dataInput(valor: any) {
    if (!valor) return ''
    return String(valor).slice(0, 10)
  }

  function calcularCustos(item: any) {
    return (
      Number(item.doc_dta || 0) +
      Number(item.debito_terceiro || 0) +
      Number(item.valor_compra || 0)
    )
  }

  function calcularProfit(item: any) {
    return Number(item.valor_cobranca || 0) - calcularCustos(item)
  }

  function temDataValida(valor: any) {
    return !!normalizarData(valor)
  }

  function statusCobranca(item: any) {
    if (temDataValida(item.recebimento)) {
      return 'PAGO'
    }

    const vencimento = normalizarData(item.vencimento_cobranca)
    if (vencimento) {
      const hoje = new Date().toISOString().slice(0, 10)

      if (vencimento < hoje) {
        return 'ATRASADO'
      }
    }

    return 'EM ABERTO'
  }

  function badgeStatus(status: string) {
    if (status === 'PAGO') {
      return 'bg-green-100 text-green-700 border-green-300'
    }

    if (status === 'ATRASADO') {
      return 'bg-red-100 text-red-700 border-red-300'
    }

    return 'bg-yellow-100 text-yellow-700 border-yellow-300'
  }

  function limparFiltros() {
    setBusca('')
    setFiltroTransportadora('')
    setFiltroDespachante('')
    setFiltroServico('')
    setPagina(1)
  }

  async function carregarFinanceiro() {
    setLoading(true)

    const { count, error: countError } = await supabase
      .from('financeiro_embarques')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      alert('Erro ao contar financeiro: ' + countError.message)
      setLoading(false)
      return
    }

    const total = count || 0
    const paginas = Math.ceil(total / LOTE_SUPABASE)

    const consultas = Array.from({ length: paginas }, (_, index) => {
      const inicio = index * LOTE_SUPABASE
      const fim = inicio + LOTE_SUPABASE - 1

      return supabase
        .from('financeiro_embarques')
        .select('*')
        .range(inicio, fim)
    })

    const respostas = await Promise.all(consultas)
    const erro = respostas.find((res) => res.error)

    if (erro?.error) {
      alert('Erro ao carregar financeiro: ' + erro.error.message)
      setLoading(false)
      return
    }

    const todos = respostas.flatMap((res) => res.data || [])

    setLancamentos(
      todos.sort((a, b) => {
        const statusA = statusCobranca(a)
        const statusB = statusCobranca(b)

        if (statusA === 'ATRASADO' && statusB !== 'ATRASADO') return -1
        if (statusA !== 'ATRASADO' && statusB === 'ATRASADO') return 1

        const vencA = normalizarData(a.vencimento_cobranca) || '9999-99-99'
        const vencB = normalizarData(b.vencimento_cobranca) || '9999-99-99'
        return vencA.localeCompare(vencB)
      })
    )

    setPagina(1)
    setLoading(false)
  }

  function montarPayload() {
    return {
      cliente: form.cliente,
      despachante: form.despachante,
      awb: form.awb,
      fatura: form.fatura,
      transportadora: form.transportadora,
      servico: form.servico,
      valor_cobranca: numero(form.valor_cobranca),
      doc_dta: numero(form.doc_dta),
      debito_terceiro: numero(form.debito_terceiro),
      valor_compra: numero(form.valor_compra),
      vencimento_cobranca: form.vencimento_cobranca || null,
      recebimento: form.recebimento || null,
      mes: form.mes,
      mes_profit: form.mes_profit,
      observacoes: form.observacoes,
      atualizado_em: new Date().toISOString(),
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)

    const payload = montarPayload()

    if (editandoId) {
      const { error } = await supabase
        .from('financeiro_embarques')
        .update(payload)
        .eq('id', editandoId)

      if (error) {
        alert('Erro ao atualizar: ' + error.message)
        setSalvando(false)
        return
      }

      alert('Lançamento atualizado com sucesso.')
    } else {
      const { error } = await supabase.from('financeiro_embarques').insert(payload)

      if (error) {
        alert('Erro ao salvar: ' + error.message)
        setSalvando(false)
        return
      }

      alert('Lançamento salvo com sucesso.')
    }

    setForm(formVazio)
    setEditandoId(null)
    await carregarFinanceiro()
    setSalvando(false)
  }

  function editar(item: any) {
    setEditandoId(item.id)

    setForm({
      cliente: item.cliente || '',
      despachante: item.despachante || '',
      awb: item.awb || '',
      fatura: item.fatura || '',
      transportadora: item.transportadora || '',
      servico: item.servico || '',
      valor_cobranca: String(item.valor_cobranca || ''),
      doc_dta: String(item.doc_dta || ''),
      debito_terceiro: String(item.debito_terceiro || ''),
      valor_compra: String(item.valor_compra || ''),
      vencimento_cobranca: dataInput(item.vencimento_cobranca),
      recebimento: dataInput(item.recebimento),
      mes: item.mes || '',
      mes_profit: item.mes_profit || '',
      observacoes: item.observacoes || '',
    })

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setForm(formVazio)
  }

  async function importarExcel(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!confirm('Importar este Excel para o financeiro?')) return

    setImportando(true)

    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const linhas: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

      const registros = linhas
        .map((linha) => ({
          cliente: normalizarTexto(linha['CLIENTE']),
          despachante: normalizarTexto(linha['DESPACHANTE']),
          awb: normalizarTexto(linha['AWB']),
          fatura: normalizarTexto(
            linha['FATURA'] ||
              linha['Fatura'] ||
              linha['NUMERO_FATURA'] ||
              linha['Nº FATURA'] ||
              linha['N° FATURA'] ||
              linha['NUMERO DA FATURA'] ||
              linha['NÚMERO DA FATURA']
          ),
          transportadora: normalizarTexto(linha['EMPRESA PRESTADORA DE SERVIÇO']),
          servico: normalizarTexto(linha['SERVIÇO']),
          valor_cobranca: numero(linha['VALOR DO FATURAMENTO']),
          doc_dta: numero(linha['DELIVER FEE DOC / DTA / IMPOSTOS/ DUE']),
          debito_terceiro: numero(linha['PROFIT TERCEIROS']),
          valor_compra: numero(linha['VALOR DA COMPRA']),
          vencimento_cobranca: normalizarData(linha['VENCIMENTO_CLIENTE']),
          recebimento: normalizarData(linha['RECEBIMENTO_CLIENTE']),
          atualizado_em: new Date().toISOString(),
        }))
        .filter((item) => item.awb || item.cliente || item.valor_cobranca > 0)

      if (registros.length === 0) {
        alert('Nenhuma linha válida encontrada no Excel.')
        setImportando(false)
        return
      }

      for (let i = 0; i < registros.length; i += 500) {
        const lote = registros.slice(i, i + 500)

        const { error } = await supabase.from('financeiro_embarques').insert(lote)

        if (error) {
          alert('Erro ao importar lote: ' + error.message)
          setImportando(false)
          return
        }
      }

      alert(`Importação concluída: ${registros.length} lançamentos importados.`)
      await carregarFinanceiro()
    } catch (error: any) {
      alert('Erro ao importar Excel: ' + error.message)
    }

    setImportando(false)
    event.target.value = ''
  }

  async function excluir(id: string) {
    if (!confirm('Deseja excluir este lançamento financeiro?')) return

    const { error } = await supabase
      .from('financeiro_embarques')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erro ao excluir: ' + error.message)
      return
    }

    carregarFinanceiro()
  }

  const transportadoras = useMemo(() => {
    return [
      ...new Set(lancamentos.map((item) => item.transportadora).filter(Boolean)),
    ].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))
  }, [lancamentos])

  const despachantes = useMemo(() => {
    return [
      ...new Set(lancamentos.map((item) => item.despachante).filter(Boolean)),
    ].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))
  }, [lancamentos])

  const servicos = useMemo(() => {
    return [
      ...new Set(lancamentos.map((item) => item.servico).filter(Boolean)),
    ].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))
  }, [lancamentos])

  const resumo = useMemo(() => {
    const emAberto = lancamentos.filter((item) => statusCobranca(item) === 'EM ABERTO')
    const atrasado = lancamentos.filter((item) => statusCobranca(item) === 'ATRASADO')
    const pago = lancamentos.filter((item) => statusCobranca(item) === 'PAGO')

    function total(lista: any[]) {
      return lista.reduce((acc, item) => acc + Number(item.valor_cobranca || 0), 0)
    }

    return {
      emAberto: { qtd: emAberto.length, total: total(emAberto) },
      atrasado: { qtd: atrasado.length, total: total(atrasado) },
      pago: { qtd: pago.length, total: total(pago) },
      todos: { qtd: lancamentos.length, total: total(lancamentos) },
    }
  }, [lancamentos])

  const filtrados = useMemo(() => {
    const termo = busca.toLowerCase().trim()

    return lancamentos.filter((item) => {
      const texto = `
        ${item.cliente || ''}
        ${item.despachante || ''}
        ${item.awb || ''}
        ${item.fatura || ''}
        ${item.transportadora || ''}
        ${item.servico || ''}
      `.toLowerCase()

      const passaBusca = !termo || texto.includes(termo)
      const statusAtual = statusCobranca(item)
      const passaAba = aba === 'TODOS' ? true : statusAtual === aba

      const passaTransportadora =
        !filtroTransportadora || item.transportadora === filtroTransportadora

      const passaDespachante =
        !filtroDespachante || item.despachante === filtroDespachante

      const passaServico = !filtroServico || item.servico === filtroServico

      return (
        passaAba &&
        passaBusca &&
        passaTransportadora &&
        passaDespachante &&
        passaServico
      )
    })
  }, [
    lancamentos,
    aba,
    busca,
    filtroTransportadora,
    filtroDespachante,
    filtroServico,
  ])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))

  const filtradosPaginados = useMemo(() => {
    const inicio = (pagina - 1) * PAGE_SIZE
    return filtrados.slice(inicio, inicio + PAGE_SIZE)
  }, [filtrados, pagina])

  function mudarAba(novaAba: string) {
    setAba(novaAba)
    setPagina(1)
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-950">Financeiro</h1>
          <p className="text-sm text-gray-500">
            Controle financeiro dos embarques da HC Consultoria
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={carregarFinanceiro}
            className="bg-white border border-gray-200 text-gray-800 px-5 py-3 rounded-xl font-bold hover:bg-gray-100 shadow-sm"
          >
            ↻ Atualizar dados
          </button>

          <label className="bg-blue-600 text-white px-5 py-3 rounded-xl font-bold cursor-pointer hover:bg-blue-700 shadow-sm">
            ↓ Importar Excel
            <input
              type="file"
              accept=".xlsx,.xls,.xlsm"
              onChange={importarExcel}
              disabled={importando}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <BigCard
          titulo="VALOR EM ABERTO"
          valor={moeda(resumo.emAberto.total)}
          subtitulo="Valor pendente de recebimento"
          icone="📂"
          classe="bg-orange-50 border-orange-200 text-orange-600"
        />

        <BigCard
          titulo="VALOR EM ATRASO"
          valor={moeda(resumo.atrasado.total)}
          subtitulo="Valor vencido não recebido"
          icone="⏰"
          classe="bg-red-50 border-red-200 text-red-600"
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
        <ResumoCard
          ativo={aba === 'EM ABERTO'}
          titulo="Em aberto"
          quantidade={resumo.emAberto.qtd}
          valor={moeda(resumo.emAberto.total)}
          cor="yellow"
          onClick={() => mudarAba('EM ABERTO')}
        />

        <ResumoCard
          ativo={aba === 'ATRASADO'}
          titulo="Atrasados"
          quantidade={resumo.atrasado.qtd}
          valor={moeda(resumo.atrasado.total)}
          cor="red"
          onClick={() => mudarAba('ATRASADO')}
        />

        <ResumoCard
          ativo={aba === 'PAGO'}
          titulo="Pagos"
          quantidade={resumo.pago.qtd}
          valor={moeda(resumo.pago.total)}
          cor="green"
          onClick={() => mudarAba('PAGO')}
        />

        <ResumoCard
          ativo={aba === 'TODOS'}
          titulo="Todos"
          quantidade={resumo.todos.qtd}
          valor={moeda(resumo.todos.total)}
          cor="blue"
          onClick={() => mudarAba('TODOS')}
        />
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">
            {editandoId ? 'Editando lançamento' : 'Novo lançamento'}
          </h2>

          {editandoId && (
            <button
              type="button"
              onClick={cancelarEdicao}
              className="bg-gray-100 text-gray-800 px-4 py-2 rounded-xl font-bold hover:bg-gray-200"
            >
              Cancelar edição
            </button>
          )}
        </div>

        <form onSubmit={salvar} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input label="Cliente" value={form.cliente} onChange={(v) => setForm({ ...form, cliente: v })} />
          <Input label="Despachante" value={form.despachante} onChange={(v) => setForm({ ...form, despachante: v })} />
          <Input label="AWB" value={form.awb} onChange={(v) => setForm({ ...form, awb: v })} />
          <Input label="Número da Fatura" value={form.fatura} onChange={(v) => setForm({ ...form, fatura: v })} />

          <Input label="Transportadora" value={form.transportadora} onChange={(v) => setForm({ ...form, transportadora: v })} />
          <Input label="Serviço" value={form.servico} onChange={(v) => setForm({ ...form, servico: v })} />
          <Input label="Valor faturado ao cliente R$" value={form.valor_cobranca} onChange={(v) => setForm({ ...form, valor_cobranca: v })} />
          <Input label="DTA / DOC / Impostos R$" value={form.doc_dta} onChange={(v) => setForm({ ...form, doc_dta: v })} />

          <Input label="Custos terceiros R$" value={form.debito_terceiro} onChange={(v) => setForm({ ...form, debito_terceiro: v })} />
          <Input label="Valor compra R$" value={form.valor_compra} onChange={(v) => setForm({ ...form, valor_compra: v })} />
          <Input type="date" label="Vencimento cliente" value={form.vencimento_cobranca} onChange={(v) => setForm({ ...form, vencimento_cobranca: v })} />
          <Input type="date" label="Recebimento cliente" value={form.recebimento} onChange={(v) => setForm({ ...form, recebimento: v })} />

          <div className="md:col-span-4">
            <label className="text-sm font-semibold text-gray-600">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>

          <div className="md:col-span-4 flex gap-3">
            <button
              disabled={salvando}
              className="bg-blue-600 text-white px-5 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 font-bold"
            >
              {salvando
                ? 'Salvando...'
                : editandoId
                  ? 'Salvar alterações'
                  : 'Salvar lançamento'}
            </button>

            {editandoId && (
              <button
                type="button"
                onClick={cancelarEdicao}
                className="bg-gray-100 text-gray-800 px-5 py-3 rounded-xl hover:bg-gray-200 font-bold"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-5">
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value)
              setPagina(1)
            }}
            placeholder="Buscar por cliente, AWB, fatura, serviço..."
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={filtroTransportadora}
            onChange={(e) => {
              setFiltroTransportadora(e.target.value)
              setPagina(1)
            }}
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm"
          >
            <option value="">Todas transportadoras</option>
            {transportadoras.map((item: any) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={filtroDespachante}
            onChange={(e) => {
              setFiltroDespachante(e.target.value)
              setPagina(1)
            }}
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm"
          >
            <option value="">Todos despachantes</option>
            {despachantes.map((item: any) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={filtroServico}
            onChange={(e) => {
              setFiltroServico(e.target.value)
              setPagina(1)
            }}
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm"
          >
            <option value="">Todos serviços</option>
            {servicos.map((item: any) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={limparFiltros}
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold hover:bg-gray-50"
          >
            ⌁ Limpar filtros
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1750px] w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <Th>Cliente</Th>
                <Th>Despachante</Th>
                <Th>AWB</Th>
                <Th>Nº Fatura</Th>
                <Th>Transportadora</Th>
                <Th>Serviço</Th>
                <Th>Valor Faturado</Th>
                <Th>DTA/DOC/Impostos</Th>
                <Th>Terceiros</Th>
                <Th>Valor Compra</Th>
                <Th>Profit HC</Th>
                <Th>Venc. Cliente</Th>
                <Th>Recebimento</Th>
                <Th>Status</Th>
                <Th>Ações</Th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={15} className="p-6 text-center">
                    Carregando todos os registros...
                  </td>
                </tr>
              ) : filtradosPaginados.length === 0 ? (
                <tr>
                  <td colSpan={15} className="p-6 text-center text-gray-500">
                    Nenhum lançamento encontrado.
                  </td>
                </tr>
              ) : (
                filtradosPaginados.map((item) => {
                  const cobranca = statusCobranca(item)
                  const possuiCusto = Number(item.valor_compra || 0) > 0
                  const profit = possuiCusto ? calcularProfit(item) : null

                  return (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <Td>{item.cliente}</Td>
                      <Td>{item.despachante}</Td>
                      <Td>{item.awb}</Td>
                      <Td>{item.fatura || '-'}</Td>
                      <Td>{item.transportadora}</Td>
                      <Td>{item.servico}</Td>
                      <Td>{moeda(item.valor_cobranca)}</Td>
                      <Td>{moeda(item.doc_dta)}</Td>
                      <Td>{moeda(item.debito_terceiro)}</Td>
                      <Td>
                        {possuiCusto ? (
                          moeda(item.valor_compra)
                        ) : (
                          <span className="inline-flex rounded-lg bg-yellow-100 px-2 py-1 text-xs font-black text-yellow-700 border border-yellow-300">
                            ⚠ AGUARDANDO CUSTO
                          </span>
                        )}
                      </Td>
                      <Td>
                        {profit === null ? (
                          <span className="text-gray-400 font-black">
                            AGUARDANDO CUSTO
                          </span>
                        ) : (
                          <span
                            className={
                              profit >= 0
                                ? 'text-green-600 font-black'
                                : 'text-red-600 font-black'
                            }
                          >
                            {moeda(profit)}
                          </span>
                        )}
                      </Td>
                      <Td>{normalizarData(item.vencimento_cobranca) || '-'}</Td>
                      <Td>{normalizarData(item.recebimento) || '-'}</Td>
                      <Td>
                        <Badge texto={cobranca} classe={badgeStatus(cobranca)} />
                      </Td>
                      <Td>
                        <div className="flex gap-2">
                          <button
                            onClick={() => editar(item)}
                            className="bg-blue-50 text-blue-600 border border-blue-200 px-3 py-2 rounded-lg hover:bg-blue-100 font-bold"
                          >
                            ✎
                          </button>

                          <button
                            onClick={() => excluir(item.id)}
                            className="bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-100 font-bold"
                          >
                            🗑
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

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-5">
          <p className="text-sm text-gray-500">
            Mostrando {filtradosPaginados.length} de {filtrados.length} registros
          </p>

          <div className="flex gap-2 items-center">
            <button
              type="button"
              disabled={pagina <= 1}
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 font-bold disabled:opacity-50"
            >
              ‹
            </button>

            <span className="text-sm font-bold">
              Página {pagina} de {totalPaginas}
            </span>

            <button
              type="button"
              disabled={pagina >= totalPaginas}
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 font-bold disabled:opacity-50"
            >
              ›
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

function BigCard({
  titulo,
  valor,
  subtitulo,
  icone,
  classe,
}: {
  titulo: string
  valor: string
  subtitulo: string
  icone: string
  classe: string
}) {
  return (
    <div className={`rounded-2xl border p-8 shadow-sm ${classe}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black tracking-wide">{titulo}</p>
          <p className="text-4xl font-black mt-3">{valor}</p>
          <p className="text-sm text-gray-500 mt-2">{subtitulo}</p>
        </div>

        <div className="w-16 h-16 rounded-full bg-white/70 flex items-center justify-center text-3xl">
          {icone}
        </div>
      </div>
    </div>
  )
}

function ResumoCard({
  titulo,
  quantidade,
  valor,
  ativo,
  onClick,
  cor,
}: {
  titulo: string
  quantidade: number
  valor: string
  ativo: boolean
  onClick: () => void
  cor: 'yellow' | 'red' | 'green' | 'blue'
}) {
  const cores: any = {
    yellow: 'bg-yellow-400',
    red: 'bg-red-500',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`bg-white rounded-2xl shadow-sm border p-5 text-left hover:shadow-md ${
        ativo ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${cores[cor]}`} />
        <p className="font-black text-gray-900">{titulo}</p>
        <span className="ml-auto bg-gray-100 text-gray-700 text-xs font-black px-2 py-1 rounded-full">
          {quantidade}
        </span>
      </div>
      <p className="text-sm font-bold text-gray-600 mt-3">{valor}</p>
    </button>
  )
}

function Badge({ texto, classe }: { texto: string; classe: string }) {
  return (
    <span
      className={`inline-flex px-3 py-1 rounded-full border text-xs font-black whitespace-nowrap ${classe}`}
    >
      {texto}
    </span>
  )
}

function Input({ label, value, onChange, type = 'text' }: InputProps) {
  return (
    <div>
      <label className="text-sm font-semibold text-gray-600">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-3 text-left font-black whitespace-nowrap">
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-3 whitespace-nowrap">{children}</td>
}