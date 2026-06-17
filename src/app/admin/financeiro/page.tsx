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

const STATUS_OPCOES = ['EM ABERTO', 'VENCIDO', 'PAGO']

export default function FinanceiroPage() {
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const [busca, setBusca] = useState('')
  const [filtrosStatus, setFiltrosStatus] = useState<string[]>([])
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

  function normalizarOpcao(valor: any) {
    return String(valor || '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
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
        return 'VENCIDO'
      }
    }

    return 'EM ABERTO'
  }

  function badgeStatus(status: string) {
    if (status === 'PAGO') {
      return 'bg-green-100 text-green-800 border-green-300'
    }

    if (status === 'VENCIDO') {
      return 'bg-red-100 text-red-800 border-red-300'
    }

    return 'bg-yellow-100 text-yellow-800 border-yellow-300'
  }

  function alternarFiltroStatus(status: string) {
    setFiltrosStatus((atual) => {
      if (atual.includes(status)) {
        return atual.filter((s) => s !== status)
      }

      return [...atual, status]
    })
  }

  function limparFiltros() {
    setBusca('')
    setFiltrosStatus([])
    setFiltroTransportadora('')
    setFiltroDespachante('')
    setFiltroServico('')
  }

  async function carregarFinanceiro() {
    setLoading(true)

    let todos: any[] = []
    let inicio = 0
    const limite = 1000

    while (true) {
      const { data, error } = await supabase
        .from('financeiro_embarques')
        .select('*')
        .order('cliente', { ascending: true })
        .range(inicio, inicio + limite - 1)

      if (error) {
        alert('Erro ao carregar financeiro: ' + error.message)
        setLoading(false)
        return
      }

      todos = [...todos, ...(data || [])]

      if (!data || data.length < limite) break

      inicio += limite
    }

    setLancamentos(
      todos.sort((a, b) =>
        String(a.cliente || '').localeCompare(String(b.cliente || ''), 'pt-BR')
      )
    )

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
      ...new Set(
        lancamentos
          .map((item) => item.transportadora)
          .filter(Boolean)
      ),
    ].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))
  }, [lancamentos])

  const despachantes = useMemo(() => {
    return [
      ...new Set(
        lancamentos
          .map((item) => item.despachante)
          .filter(Boolean)
      ),
    ].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))
  }, [lancamentos])

  const servicos = useMemo(() => {
    return [
      ...new Set(
        lancamentos
          .map((item) => item.servico)
          .filter(Boolean)
      ),
    ].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))
  }, [lancamentos])

  const filtrados = useMemo(() => {
    return lancamentos.filter((item) => {
      const texto = `
        ${item.cliente || ''}
        ${item.despachante || ''}
        ${item.awb || ''}
        ${item.fatura || ''}
        ${item.transportadora || ''}
        ${item.servico || ''}
      `.toLowerCase()

      const passaBusca = texto.includes(busca.toLowerCase())
      const status = statusCobranca(item)

      const passaStatus =
        filtrosStatus.length === 0 ||
        filtrosStatus.map(normalizarOpcao).includes(normalizarOpcao(status))

      const passaTransportadora =
        !filtroTransportadora || item.transportadora === filtroTransportadora

      const passaDespachante =
        !filtroDespachante || item.despachante === filtroDespachante

      const passaServico =
        !filtroServico || item.servico === filtroServico

      return (
        passaBusca &&
        passaStatus &&
        passaTransportadora &&
        passaDespachante &&
        passaServico
      )
    })
  }, [
    lancamentos,
    busca,
    filtrosStatus,
    filtroTransportadora,
    filtroDespachante,
    filtroServico,
  ])

  const totais = useMemo(() => {
    const faturamento = filtrados.reduce(
      (acc, item) => acc + Number(item.valor_cobranca || 0),
      0
    )

    const custos = filtrados.reduce((acc, item) => acc + calcularCustos(item), 0)
    const profit = faturamento - custos

    const aReceber = filtrados
      .filter((item) => !item.recebimento)
      .reduce((acc, item) => acc + Number(item.valor_cobranca || 0), 0)

    const margem = faturamento > 0 ? (profit / faturamento) * 100 : 0

    return { faturamento, custos, profit, aReceber, margem }
  }, [filtrados])

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-gray-900">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-sm text-gray-600">
            Controle financeiro dos embarques da HC Consultoria
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={carregarFinanceiro}
            className="bg-blue-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-blue-700"
          >
            {loading ? 'Atualizando...' : 'Atualizar dados'}
          </button>

          <label className="bg-green-600 text-white px-5 py-3 rounded-xl font-bold cursor-pointer hover:bg-green-700">
            {importando ? 'Importando...' : 'Importar Excel'}
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

      <section className="grid grid-cols-1 gap-4 md:grid-cols-5 mb-6">
        <Card titulo="Faturamento" valor={moeda(totais.faturamento)} />
        <Card titulo="Custos" valor={moeda(totais.custos)} />
        <Card titulo="Profit HC" valor={moeda(totais.profit)} />
        <Card titulo="A receber" valor={moeda(totais.aReceber)} />
        <Card titulo="Margem" valor={`${totais.margem.toFixed(2)}%`} />
      </section>

      <section className="bg-white rounded-xl shadow p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {editandoId ? 'Editando lançamento' : 'Novo lançamento'}
          </h2>

          {editandoId && (
            <button
              type="button"
              onClick={cancelarEdicao}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-xl font-bold hover:bg-gray-300"
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
            <label className="text-sm font-medium text-gray-700">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
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
                className="bg-gray-200 text-gray-800 px-5 py-3 rounded-xl hover:bg-gray-300 font-bold"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="bg-white rounded-xl shadow p-5">
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex flex-col xl:flex-row gap-4 xl:items-center xl:justify-between">
            <h2 className="text-lg font-semibold">
              Lançamentos financeiros ({
  filtrados.filter((item) => {
    const status = statusCobranca(item)
    return filtrosStatus.length === 0 || filtrosStatus.includes(status)
  }).length
})
            </h2>

            <button
              type="button"
              onClick={limparFiltros}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-xl font-bold hover:bg-gray-300 w-fit"
            >
              Limpar filtros
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente, AWB, fatura, serviço..."
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />

            <select
              value={filtroTransportadora}
              onChange={(e) => setFiltroTransportadora(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
              onChange={(e) => setFiltroDespachante(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
              onChange={(e) => setFiltroServico(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Todos serviços</option>
              {servicos.map((item: any) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap gap-2 items-center rounded-lg border border-gray-300 px-3 py-2">
              <span className="text-sm font-semibold text-gray-600">Status:</span>

              {STATUS_OPCOES.map((status) => (
                <label key={status} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={filtrosStatus.includes(status)}
                    onChange={() => alternarFiltroStatus(status)}
                  />
                  {status}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1550px] w-full text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <Th>Cliente</Th>
                <Th>Despachante</Th>
                <Th>AWB</Th>
                <Th>Nº Fatura</Th>
                <Th>Transportadora</Th>
                <Th>Serviço</Th>
                <Th>Valor faturado</Th>
                <Th>DTA/DOC/Impostos</Th>
                <Th>Terceiros</Th>
                <Th>Valor compra</Th>
                <Th>Profit HC</Th>
                <Th>Venc. Cliente</Th>
                <Th>Recebimento</Th>
                <Th>Status cobrança</Th>
                <Th>Ações</Th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={15} className="p-4 text-center">
                    Carregando...
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={15} className="p-4 text-center text-gray-500">
                    Nenhum lançamento encontrado.
                  </td>
                </tr>
              ) : (
                filtrados
  .filter((item) => {
    const status = statusCobranca(item)
    return filtrosStatus.length === 0 || filtrosStatus.includes(status)
  })
  .map((item) => {
                  const cobranca = statusCobranca(item)

                  return (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <Td>{item.cliente}</Td>
                      <Td>{item.despachante}</Td>
                      <Td>{item.awb}</Td>
                      <Td>{item.fatura || '-'}</Td>
                      <Td>{item.transportadora}</Td>
                      <Td>{item.servico}</Td>
                      <Td>{moeda(item.valor_cobranca)}</Td>
                      <Td>{moeda(item.doc_dta)}</Td>
                      <Td>{moeda(item.debito_terceiro)}</Td>
                      <Td>{moeda(item.valor_compra)}</Td>
                      <Td>
                        <span
                          className={
                            calcularProfit(item) >= 0
                              ? 'text-green-700 font-semibold'
                              : 'text-red-700 font-semibold'
                          }
                        >
                          {moeda(calcularProfit(item))}
                        </span>
                      </Td>
                      <Td>{item.vencimento_cobranca || '-'}</Td>
                      <Td>{normalizarData(item.recebimento) || '-'}</Td>
                      <Td>
                        <Badge texto={cobranca} classe={badgeStatus(cobranca)} />
                      </Td>
                      <Td>
                        <div className="flex gap-3">
                          <button
                            onClick={() => editar(item)}
                            className="text-blue-600 hover:underline font-semibold"
                          >
                            Editar
                          </button>

                          <button
                            onClick={() => excluir(item.id)}
                            className="text-red-600 hover:underline font-semibold"
                          >
                            Excluir
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
      </section>
    </main>
  )
}

function Card({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <p className="text-sm text-gray-500">{titulo}</p>
      <p className="text-xl font-bold text-gray-900">{valor}</p>
    </div>
  )
}

function Badge({ texto, classe }: { texto: string; classe: string }) {
  return (
    <span className={`inline-flex px-3 py-1 rounded-full border text-xs font-bold whitespace-nowrap ${classe}`}>
      {texto}
    </span>
  )
}

function Input({ label, value, onChange, type = 'text' }: InputProps) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
      />
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">{children}</th>
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 whitespace-nowrap">{children}</td>
}