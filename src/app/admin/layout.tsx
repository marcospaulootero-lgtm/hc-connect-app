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
  vencimento_fornecedor: string
  pagamento_fornecedor: string
  status: string
  status_caixa: string
  mes: string
  mes_profit: string
  observacoes: string
}

export default function FinanceiroPage() {
  const [lancamentos, setLancamentos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [importando, setImportando] = useState(false)

  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroCaixa, setFiltroCaixa] = useState('')

  const [form, setForm] = useState<FormState>({
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
    vencimento_fornecedor: '',
    pagamento_fornecedor: '',
    status: 'EM ABERTO',
    status_caixa: 'EM ABERTO',
    mes: '',
    mes_profit: '',
    observacoes: '',
  })

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
    return Number(String(valor).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0
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

  function calcularProfit(item: any) {
    return (
      Number(item.valor_cobranca || 0) -
      Number(item.doc_dta || 0) -
      Number(item.debito_terceiro || 0) -
      Number(item.valor_compra || 0)
    )
  }

  async function carregarFinanceiro() {
    setLoading(true)

    const { data, error } = await supabase
      .from('financeiro_embarques')
      .select('*')
      .order('criado_em', { ascending: false })

    if (error) {
      alert('Erro ao carregar financeiro: ' + error.message)
      setLoading(false)
      return
    }

    setLancamentos(data || [])
    setLoading(false)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)

    const payload = {
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
      vencimento_fornecedor: form.vencimento_fornecedor || null,
      pagamento_fornecedor: form.pagamento_fornecedor || null,
      status: form.status,
      status_caixa: form.status_caixa,
      mes: form.mes,
      mes_profit: form.mes_profit,
      observacoes: form.observacoes,
    }

    const { error } = await supabase.from('financeiro_embarques').insert(payload)

    if (error) {
      alert('Erro ao salvar: ' + error.message)
      setSalvando(false)
      return
    }

    setForm({
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
      vencimento_fornecedor: '',
      pagamento_fornecedor: '',
      status: 'EM ABERTO',
      status_caixa: 'EM ABERTO',
      mes: '',
      mes_profit: '',
      observacoes: '',
    })

    await carregarFinanceiro()
    setSalvando(false)
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
          fatura: normalizarTexto(linha['FATURA']),
          transportadora: normalizarTexto(linha['EMPRESA PRESTADORA DE SERVIÇO']),
          servico: normalizarTexto(linha['SERVIÇO']),
          valor_cobranca: numero(linha['VALOR DO FATURAMENTO']),
          doc_dta: numero(linha['DELIVER FEE DOC / DTA / IMPOSTOS/ DUE']),
          debito_terceiro: numero(linha['PROFIT TERCEIROS']),
          valor_compra: numero(linha['VALOR DA COMPRA']),
          vencimento_cobranca: normalizarData(linha['VENCIMENTO_CLIENTE']),
          recebimento: normalizarData(linha['RECEBIMENTO_CLIENTE']),
          status: normalizarTexto(linha['STATUS']) || 'EM ABERTO',
          vencimento_fornecedor: normalizarData(linha['VENCIMENTO_FORNECEDOR']),
          pagamento_fornecedor: normalizarData(linha['PAGAMENTO_FORNECEDOR']),
          status_caixa: normalizarTexto(linha['STATUS DO CAIXA']) || 'EM ABERTO',
        }))
        .filter((item) => item.awb || item.cliente || item.valor_cobranca > 0)

      if (registros.length === 0) {
        alert('Nenhuma linha válida encontrada no Excel.')
        setImportando(false)
        return
      }

      for (let i = 0; i < registros.length; i += 500) {
        const lote = registros.slice(i, i + 500)

        const { error } = await supabase
          .from('financeiro_embarques')
          .insert(lote)

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

  const filtrados = useMemo(() => {
    return lancamentos.filter((item) => {
      const texto = `${item.cliente || ''} ${item.awb || ''} ${item.transportadora || ''} ${item.servico || ''}`.toLowerCase()
      const passaBusca = texto.includes(busca.toLowerCase())
      const passaStatus = filtroStatus ? item.status === filtroStatus : true
      const passaCaixa = filtroCaixa ? item.status_caixa === filtroCaixa : true
      return passaBusca && passaStatus && passaCaixa
    })
  }, [lancamentos, busca, filtroStatus, filtroCaixa])

  const totais = useMemo(() => {
    const faturamento = filtrados.reduce((acc, item) => acc + Number(item.valor_cobranca || 0), 0)

    const custos = filtrados.reduce(
      (acc, item) =>
        acc +
        Number(item.doc_dta || 0) +
        Number(item.debito_terceiro || 0) +
        Number(item.valor_compra || 0),
      0
    )

    const profit = faturamento - custos

    const aReceber = filtrados
      .filter((item) => !item.recebimento)
      .reduce((acc, item) => acc + Number(item.valor_cobranca || 0), 0)

    const aPagar = filtrados
      .filter((item) => !item.pagamento_fornecedor)
      .reduce(
        (acc, item) =>
          acc +
          Number(item.doc_dta || 0) +
          Number(item.debito_terceiro || 0) +
          Number(item.valor_compra || 0),
        0
      )

    return { faturamento, custos, profit, aReceber, aPagar }
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

      <section className="grid grid-cols-1 gap-4 md:grid-cols-5 mb-6">
        <Card titulo="Faturamento" valor={moeda(totais.faturamento)} />
        <Card titulo="Custos" valor={moeda(totais.custos)} />
        <Card titulo="Profit" valor={moeda(totais.profit)} />
        <Card titulo="A receber" valor={moeda(totais.aReceber)} />
        <Card titulo="A pagar" valor={moeda(totais.aPagar)} />
      </section>

      <section className="bg-white rounded-xl shadow p-5 mb-6">
        <h2 className="text-lg font-semibold mb-4">Novo lançamento</h2>

        <form onSubmit={salvar} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input label="Cliente" value={form.cliente} onChange={(v) => setForm({ ...form, cliente: v })} />
          <Input label="Despachante" value={form.despachante} onChange={(v) => setForm({ ...form, despachante: v })} />
          <Input label="AWB" value={form.awb} onChange={(v) => setForm({ ...form, awb: v })} />
          <Input label="Fatura" value={form.fatura} onChange={(v) => setForm({ ...form, fatura: v })} />

          <Input label="Transportadora" value={form.transportadora} onChange={(v) => setForm({ ...form, transportadora: v })} />
          <Input label="Serviço" value={form.servico} onChange={(v) => setForm({ ...form, servico: v })} />
          <Input label="Valor faturado ao cliente R$" value={form.valor_cobranca} onChange={(v) => setForm({ ...form, valor_cobranca: v })} />
          <Input label="DTA / DOC / Impostos R$" value={form.doc_dta} onChange={(v) => setForm({ ...form, doc_dta: v })} />

          <Input label="Custos terceiros R$" value={form.debito_terceiro} onChange={(v) => setForm({ ...form, debito_terceiro: v })} />
          <Input label="Valor compra R$" value={form.valor_compra} onChange={(v) => setForm({ ...form, valor_compra: v })} />
          <Input type="date" label="Vencimento cliente" value={form.vencimento_cobranca} onChange={(v) => setForm({ ...form, vencimento_cobranca: v })} />
          <Input type="date" label="Recebimento cliente" value={form.recebimento} onChange={(v) => setForm({ ...form, recebimento: v })} />

          <Input type="date" label="Vencimento fornecedor" value={form.vencimento_fornecedor} onChange={(v) => setForm({ ...form, vencimento_fornecedor: v })} />
          <Input type="date" label="Pagamento fornecedor" value={form.pagamento_fornecedor} onChange={(v) => setForm({ ...form, pagamento_fornecedor: v })} />

          <Select label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })}>
            <option>EM ABERTO</option>
            <option>PAGO</option>
            <option>VENCIDO</option>
            <option>FINALIZADO</option>
          </Select>

          <Select label="Status do caixa" value={form.status_caixa} onChange={(v) => setForm({ ...form, status_caixa: v })}>
            <option>EM ABERTO</option>
            <option>OK</option>
            <option>PAGOU E NÃO RECEBEU</option>
            <option>RECEBEU E NÃO PAGOU</option>
          </Select>

          <div className="md:col-span-4">
            <label className="text-sm font-medium text-gray-700">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              rows={2}
            />
          </div>

          <div className="md:col-span-4">
            <button
              disabled={salvando}
              className="bg-blue-600 text-white px-5 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 font-bold"
            >
              {salvando ? 'Salvando...' : 'Salvar lançamento'}
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white rounded-xl shadow p-5">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-4">
          <h2 className="text-lg font-semibold">Lançamentos financeiros</h2>

          <div className="flex flex-col md:flex-row gap-2">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente, AWB, serviço..."
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />

            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Todos status</option>
              <option>EM ABERTO</option>
              <option>PAGO</option>
              <option>VENCIDO</option>
              <option>FINALIZADO</option>
            </select>

            <select
              value={filtroCaixa}
              onChange={(e) => setFiltroCaixa(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Todos caixa</option>
              <option>EM ABERTO</option>
              <option>OK</option>
              <option>PAGOU E NÃO RECEBEU</option>
              <option>RECEBEU E NÃO PAGOU</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1700px] w-full text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <Th>Cliente</Th>
                <Th>Despachante</Th>
                <Th>AWB</Th>
                <Th>Fatura</Th>
                <Th>Transportadora</Th>
                <Th>Serviço</Th>
                <Th>Valor faturado</Th>
                <Th>DTA/DOC/Impostos</Th>
                <Th>Terceiros</Th>
                <Th>Valor compra</Th>
                <Th>Profit</Th>
                <Th>Venc. Cliente</Th>
                <Th>Recebimento</Th>
                <Th>Status</Th>
                <Th>Venc. Fornecedor</Th>
                <Th>Pgto. Fornecedor</Th>
                <Th>Status caixa</Th>
                <Th>Ações</Th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={18} className="p-4 text-center">Carregando...</td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={18} className="p-4 text-center text-gray-500">
                    Nenhum lançamento encontrado.
                  </td>
                </tr>
              ) : (
                filtrados.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <Td>{item.cliente}</Td>
                    <Td>{item.despachante}</Td>
                    <Td>{item.awb}</Td>
                    <Td>{item.fatura}</Td>
                    <Td>{item.transportadora}</Td>
                    <Td>{item.servico}</Td>
                    <Td>{moeda(item.valor_cobranca)}</Td>
                    <Td>{moeda(item.doc_dta)}</Td>
                    <Td>{moeda(item.debito_terceiro)}</Td>
                    <Td>{moeda(item.valor_compra)}</Td>
                    <Td>
                      <span className={calcularProfit(item) >= 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                        {moeda(calcularProfit(item))}
                      </span>
                    </Td>
                    <Td>{item.vencimento_cobranca || '-'}</Td>
                    <Td>{item.recebimento || '-'}</Td>
                    <Td>{item.status}</Td>
                    <Td>{item.vencimento_fornecedor || '-'}</Td>
                    <Td>{item.pagamento_fornecedor || '-'}</Td>
                    <Td>{item.status_caixa}</Td>
                    <Td>
                      <button onClick={() => excluir(item.id)} className="text-red-600 hover:underline">
                        Excluir
                      </button>
                    </Td>
                  </tr>
                ))
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

function Input({ label, value, onChange, type = 'text' }: any) {
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

function Select({ label, value, onChange, children }: any) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
      >
        {children}
      </select>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">{children}</th>
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 whitespace-nowrap">{children}</td>
}