'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const PAGE_SIZE = 10
const LOTE_SUPABASE = 1000

export default function ParceirosPage() {
  const [registros, setRegistros] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [editando, setEditando] = useState<any>(null)

  const [busca, setBusca] = useState('')
  const [filtroParceiro, setFiltroParceiro] = useState('')
  const [filtroServico, setFiltroServico] = useState('')
  const [aba, setAba] = useState('EM ABERTO')
  const [pagina, setPagina] = useState(1)

  const [form, setForm] = useState({
    parceiro: '',
    pagamento_parceiro: '',
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

  function data(valor: any) {
    if (!valor) return ''
    return String(valor).slice(0, 10)
  }

  function status(item: any) {
    return item.pagamento_parceiro ? 'PAGO' : 'EM ABERTO'
  }

  function badge(statusAtual: string) {
    if (statusAtual === 'PAGO') {
      return 'bg-green-100 text-green-700 border-green-300'
    }

    return 'bg-yellow-100 text-yellow-700 border-yellow-300'
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

    setRegistros(
      todos.sort((a, b) =>
        String(a.parceiro || a.despachante || '').localeCompare(
          String(b.parceiro || b.despachante || ''),
          'pt-BR'
        )
      )
    )

    setPagina(1)
    setLoading(false)
  }

  function editar(item: any) {
    setEditando(item)
    setForm({
      parceiro: item.parceiro || item.despachante || '',
      pagamento_parceiro: data(item.pagamento_parceiro),
    })

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelar() {
    setEditando(null)
    setForm({
      parceiro: '',
      pagamento_parceiro: '',
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
        pagamento_parceiro: form.pagamento_parceiro || null,
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

  const parceiros = useMemo(() => {
    return [
      ...new Set(
        registros
          .map((item) => item.parceiro || item.despachante)
          .filter(Boolean)
      ),
    ].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))
  }, [registros])

  const servicos = useMemo(() => {
    return [
      ...new Set(registros.map((item) => item.servico).filter(Boolean)),
    ].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))
  }, [registros])

  const resumo = useMemo(() => {
    const emAberto = registros.filter((item) => status(item) === 'EM ABERTO')
    const pagos = registros.filter((item) => status(item) === 'PAGO')

    function total(lista: any[]) {
      return lista.reduce((acc, item) => acc + Number(item.debito_terceiro || 0), 0)
    }

    return {
      total: total(registros),
      aberto: total(emAberto),
      pago: total(pagos),
      qtd: registros.length,
      qtdParceiros: parceiros.length,
    }
  }, [registros, parceiros.length])

  const filtrados = useMemo(() => {
    const termo = busca.toLowerCase().trim()

    return registros.filter((item) => {
      const nomeParceiro = item.parceiro || item.despachante || ''

      const texto = `
        ${nomeParceiro}
        ${item.cliente || ''}
        ${item.awb || ''}
        ${item.servico || ''}
      `.toLowerCase()

      const passaBusca = !termo || texto.includes(termo)
      const passaAba = aba === 'TODOS' ? true : status(item) === aba
      const passaParceiro = !filtroParceiro || nomeParceiro === filtroParceiro
      const passaServico = !filtroServico || item.servico === filtroServico

      return passaBusca && passaAba && passaParceiro && passaServico
    })
  }, [registros, busca, aba, filtroParceiro, filtroServico])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))

  const paginados = useMemo(() => {
    const inicio = (pagina - 1) * PAGE_SIZE
    return filtrados.slice(inicio, inicio + PAGE_SIZE)
  }, [filtrados, pagina])

  function limparFiltros() {
    setBusca('')
    setFiltroParceiro('')
    setFiltroServico('')
    setAba('EM ABERTO')
    setPagina(1)
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-950">Profit Parceiros</h1>
          <p className="text-sm text-gray-500">
            Controle de valores e pagamentos dos parceiros
          </p>
        </div>

        <button
          type="button"
          onClick={carregar}
          className="bg-white border border-gray-200 text-gray-800 px-5 py-3 rounded-xl font-bold hover:bg-gray-100 shadow-sm"
        >
          ↻ Atualizar dados
        </button>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <BigCard
          titulo="PROFIT PARCEIROS TOTAL"
          valor={moeda(resumo.total)}
          subtitulo="Total gerado para parceiros"
          icone="🤝"
          classe="bg-blue-50 border-blue-200 text-blue-600"
        />

        <BigCard
          titulo="EM ABERTO"
          valor={moeda(resumo.aberto)}
          subtitulo="Aguardando pagamento"
          icone="💰"
          classe="bg-orange-50 border-orange-200 text-orange-600"
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
        <ResumoCard
          ativo={aba === 'EM ABERTO'}
          titulo="Em aberto"
          quantidade={registros.filter((i) => status(i) === 'EM ABERTO').length}
          valor={moeda(resumo.aberto)}
          cor="yellow"
          onClick={() => {
            setAba('EM ABERTO')
            setPagina(1)
          }}
        />

        <ResumoCard
          ativo={aba === 'PAGO'}
          titulo="Pagos"
          quantidade={registros.filter((i) => status(i) === 'PAGO').length}
          valor={moeda(resumo.pago)}
          cor="green"
          onClick={() => {
            setAba('PAGO')
            setPagina(1)
          }}
        />

        <ResumoCard
          ativo={aba === 'TODOS'}
          titulo="Todos"
          quantidade={resumo.qtd}
          valor={moeda(resumo.total)}
          cor="blue"
          onClick={() => {
            setAba('TODOS')
            setPagina(1)
          }}
        />

        <ResumoCard
          ativo={false}
          titulo="Parceiros"
          quantidade={resumo.qtdParceiros}
          valor="Parceiros únicos"
          cor="blue"
          onClick={() => {}}
        />
      </section>

      {editando && (
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-black">Editar pagamento parceiro</h2>
              <p className="text-sm text-gray-500">
                {editando.cliente} · AWB {editando.awb}
              </p>
            </div>

            <button
              type="button"
              onClick={cancelar}
              className="bg-gray-100 text-gray-800 px-4 py-2 rounded-xl font-bold hover:bg-gray-200"
            >
              Cancelar
            </button>
          </div>

          <form onSubmit={salvar} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-600">Parceiro</label>
              <input
                value={form.parceiro}
                onChange={(e) => setForm({ ...form, parceiro: e.target.value })}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <Info label="Cliente" value={editando.cliente || '-'} />
            <Info label="AWB" value={editando.awb || '-'} />
            <Info label="Valor Parceiro" value={moeda(editando.debito_terceiro)} />

            <div>
              <label className="text-sm font-semibold text-gray-600">
                Data pagamento parceiro
              </label>
              <input
                type="date"
                value={form.pagamento_parceiro}
                onChange={(e) =>
                  setForm({ ...form, pagamento_parceiro: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-4 flex gap-3">
              <button
                disabled={salvando}
                className="bg-blue-600 text-white px-5 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 font-bold"
              >
                {salvando ? 'Salvando...' : 'Salvar pagamento'}
              </button>

              {form.pagamento_parceiro && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, pagamento_parceiro: '' })}
                  className="bg-yellow-100 text-yellow-700 border border-yellow-300 px-5 py-3 rounded-xl hover:bg-yellow-200 font-bold"
                >
                  Remover pagamento
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value)
              setPagina(1)
            }}
            placeholder="Buscar parceiro, cliente, AWB ou serviço..."
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={filtroParceiro}
            onChange={(e) => {
              setFiltroParceiro(e.target.value)
              setPagina(1)
            }}
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm"
          >
            <option value="">Todos parceiros</option>
            {parceiros.map((item: any) => (
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

        <div className="flex flex-wrap gap-2 mb-4">
          {['EM ABERTO', 'PAGO', 'TODOS'].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setAba(item)
                setPagina(1)
              }}
              className={`px-4 py-2 rounded-xl text-sm font-black border ${
                aba === item
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1250px] w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <Th>Parceiro</Th>
                <Th>Cliente</Th>
                <Th>AWB</Th>
                <Th>Serviço</Th>
                <Th>Valor Parceiro</Th>
                <Th>Pagamento Parceiro</Th>
                <Th>Status</Th>
                <Th>Ações</Th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center">
                    Carregando registros...
                  </td>
                </tr>
              ) : paginados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-500">
                    Nenhum profit de parceiro encontrado.
                  </td>
                </tr>
              ) : (
                paginados.map((item) => {
                  const statusAtual = status(item)
                  const nomeParceiro = item.parceiro || item.despachante || '-'

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <Td>{nomeParceiro}</Td>
                      <Td>{item.cliente}</Td>
                      <Td>{item.awb}</Td>
                      <Td>{item.servico}</Td>
                      <Td>
                        <span className="font-black text-gray-900">
                          {moeda(item.debito_terceiro)}
                        </span>
                      </Td>
                      <Td>{data(item.pagamento_parceiro) || '-'}</Td>
                      <Td>
                        <Badge texto={statusAtual} classe={badge(statusAtual)} />
                      </Td>
                      <Td>
                        <button
                          onClick={() => editar(item)}
                          className="bg-blue-50 text-blue-600 border border-blue-200 px-3 py-2 rounded-lg hover:bg-blue-100 font-bold"
                        >
                          ✎ Editar
                        </button>
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
            Mostrando {paginados.length} de {filtrados.length} registros
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

function BigCard({ titulo, valor, subtitulo, icone, classe }: any) {
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

function ResumoCard({ titulo, quantidade, valor, ativo, onClick, cor }: any) {
  const cores: any = {
    yellow: 'bg-yellow-400',
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-gray-600">{label}</p>
      <p className="mt-1 rounded-xl border border-gray-200 px-3 py-2 bg-gray-50 font-bold text-gray-800">
        {value}
      </p>
    </div>
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