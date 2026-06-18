'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const PAGE_SIZE = 15
const LOTE_SUPABASE = 1000

export default function ParceirosPage() {
  const [registros, setRegistros] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [importando, setImportando] = useState(false)
  const [parceiroSelecionado, setParceiroSelecionado] = useState('')
  const [buscaParceiro, setBuscaParceiro] = useState('')
  const [aba, setAba] = useState('TODOS')
  const [pagina, setPagina] = useState(1)

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
    if (!valor) return ''
    return String(valor).trim()
  }

  function normalizarStatusParceiro(valor: any) {
    const texto = normalizarTexto(valor)
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

    if (texto.includes('PAGO')) return 'PAGO'

    return 'PENDENTE'
  }

  function status(item: any) {
    return normalizarStatusParceiro(item.pgta_terceiros)
  }

  async function carregar() {
    setLoading(true)

    const { count } = await supabase
      .from('financeiro_embarques')
      .select('*', { count: 'exact', head: true })
      .gt('debito_terceiro', 0)

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

    const todos = respostas.flatMap((r) => r.data || [])

    setRegistros(todos)

    if (!parceiroSelecionado && todos.length > 0) {
      const primeiro =
        todos.find((i) => i.parceiro)?.parceiro ||
        todos.find((i) => i.despachante)?.despachante

      if (primeiro) {
        setParceiroSelecionado(primeiro)
      }
    }

    setLoading(false)
  }

  const parceiros = useMemo(() => {
    const lista = [
      ...new Set(
        registros
          .map((i) => i.parceiro || i.despachante)
          .filter(Boolean)
      ),
    ]

    return lista.sort((a, b) =>
      String(a).localeCompare(String(b), 'pt-BR')
    )
  }, [registros])

  const parceirosFiltrados = useMemo(() => {
    const termo = buscaParceiro.toLowerCase()

    return parceiros.filter((p: any) =>
      String(p).toLowerCase().includes(termo)
    )
  }, [parceiros, buscaParceiro])

  const dadosParceiro = useMemo(() => {
    return registros.filter(
      (item) =>
        (item.parceiro || item.despachante) === parceiroSelecionado
    )
  }, [registros, parceiroSelecionado])

  const resumoParceiro = useMemo(() => {
    const pagos = dadosParceiro.filter(
      (i) => status(i) === 'PAGO'
    )

    const pendentes = dadosParceiro.filter(
      (i) => status(i) !== 'PAGO'
    )

    const total = dadosParceiro.reduce(
      (acc, item) => acc + Number(item.debito_terceiro || 0),
      0
    )

    const totalPago = pagos.reduce(
      (acc, item) => acc + Number(item.debito_terceiro || 0),
      0
    )

    const totalPendente = pendentes.reduce(
      (acc, item) => acc + Number(item.debito_terceiro || 0),
      0
    )

    return {
      total,
      pago: totalPago,
      pendente: totalPendente,
      processos: dadosParceiro.length,
      ticket:
        dadosParceiro.length > 0
          ? total / dadosParceiro.length
          : 0,
    }
  }, [dadosParceiro])

  const rankingParceiros = useMemo(() => {
    const agrupado: any = {}

    registros.forEach((item) => {
      const parceiro =
        item.parceiro || item.despachante || 'Sem parceiro'

      if (!agrupado[parceiro]) {
        agrupado[parceiro] = 0
      }

      agrupado[parceiro] += Number(
        item.debito_terceiro || 0
      )
    })

    return Object.entries(agrupado)
      .map(([nome, valor]) => ({
        nome,
        valor,
      }))
      .sort((a: any, b: any) => b.valor - a.valor)
      .slice(0, 5)
  }, [registros])

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="flex">

        {/* SIDEBAR */}
        <aside className="w-[320px] min-h-screen bg-slate-900 text-white border-r border-slate-800">

          <div className="p-6 border-b border-slate-800">
            <h1 className="text-2xl font-black">
              Profit Parceiros
            </h1>

            <p className="text-slate-400 text-sm mt-1">
              Gestão Financeira
            </p>
          </div>

          <div className="p-4">
            <input
              value={buscaParceiro}
              onChange={(e) =>
                setBuscaParceiro(e.target.value)
              }
              placeholder="Buscar parceiro..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm"
            />
          </div>

          <div className="px-3 pb-6 overflow-y-auto">
            {parceirosFiltrados.map((parceiro: any) => {
              const total = registros
                .filter(
                  (i) =>
                    (i.parceiro || i.despachante) === parceiro
                )
                .reduce(
                  (acc, item) =>
                    acc +
                    Number(item.debito_terceiro || 0),
                  0
                )

              return (
                <button
                  key={parceiro}
                  onClick={() =>
                    setParceiroSelecionado(parceiro)
                  }
                  className={`w-full text-left p-4 rounded-xl mb-2 transition ${
                    parceiroSelecionado === parceiro
                      ? 'bg-blue-600'
                      : 'bg-slate-800 hover:bg-slate-700'
                  }`}
                >
                  <div className="font-bold">
                    {parceiro}
                  </div>

                  <div className="text-xs opacity-70 mt-1">
                    {moeda(total)}
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* CONTEÚDO */}
        <div className="flex-1 p-8">

          <div className="flex items-center justify-between mb-8">

            <div>
              <h2 className="text-3xl font-black text-slate-900">
                {parceiroSelecionado || 'Selecione um parceiro'}
              </h2>

              <p className="text-slate-500 mt-1">
                Dashboard Financeiro do Parceiro
              </p>
            </div>

            <button
              onClick={carregar}
              className="bg-white border border-slate-200 px-5 py-3 rounded-xl font-bold shadow-sm"
            >
              ↻ Atualizar
            </button>
          </div>

          {/* CARDS */}

          <div className="grid grid-cols-4 gap-5 mb-8">

            <CardResumo
              titulo="PROFIT TOTAL"
              valor={moeda(resumoParceiro.total)}
              cor="blue"
            />

            <CardResumo
              titulo="A PAGAR"
              valor={moeda(resumoParceiro.pendente)}
              cor="orange"
            />

            <CardResumo
              titulo="PAGO"
              valor={moeda(resumoParceiro.pago)}
              cor="green"
            />

            <CardResumo
              titulo="PROCESSOS"
              valor={String(resumoParceiro.processos)}
              cor="purple"
            />

          </div>

          {/* SEGUNDA LINHA */}

          <div className="grid grid-cols-3 gap-6 mb-8">

            <div className="bg-white rounded-3xl p-6 shadow-sm border">

              <h3 className="font-black text-lg mb-4">
                Resumo do Parceiro
              </h3>

              <div className="space-y-4">

                <LinhaInfo
                  label="Ticket Médio"
                  valor={moeda(resumoParceiro.ticket)}
                />

                <LinhaInfo
                  label="Total Processos"
                  valor={String(
                    resumoParceiro.processos
                  )}
                />

                <LinhaInfo
                  label="Valor Pago"
                  valor={moeda(resumoParceiro.pago)}
                />

                <LinhaInfo
                  label="Valor Pendente"
                  valor={moeda(
                    resumoParceiro.pendente
                  )}
                />

              </div>

            </div>

            <div className="col-span-2 bg-white rounded-3xl p-6 shadow-sm border">

              <h3 className="font-black text-lg mb-4">
                Ranking Parceiros
              </h3>

              {rankingParceiros.map(
                (item: any, index: number) => (
                  <div
                    key={item.nome}
                    className="flex items-center justify-between py-3 border-b"
                  >
                    <div className="flex gap-3">

                      <span className="font-black text-blue-600">
                        #{index + 1}
                      </span>

                      <span>
                        {item.nome}
                      </span>

                    </div>

                    <span className="font-black">
                      {moeda(item.valor)}
                    </span>
                  </div>
                )
              )}
            </div>

          </div>
                    {/* AÇÕES E FILTROS */}

          <div className="bg-white rounded-3xl p-6 shadow-sm border mb-8">

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">

              <div>
                <h3 className="font-black text-lg">
                  Processos do Parceiro
                </h3>

                <p className="text-sm text-slate-500">
                  Lista de AWBs vinculadas ao parceiro selecionado
                </p>
              </div>

              <div className="flex flex-wrap gap-2">

                {['TODOS', 'PAGO', 'PENDENTE'].map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      setAba(item)
                      setPagina(1)
                    }}
                    className={`px-4 py-2 rounded-xl text-sm font-black border ${
                      aba === item
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {item}
                  </button>
                ))}

              </div>
            </div>

            <TabelaProcessos
              dados={dadosParceiro}
              aba={aba}
              pagina={pagina}
              setPagina={setPagina}
              moeda={moeda}
              status={status}
              loading={loading}
            />

          </div>

        </div>
      </div>
    </main>
  )
}

function TabelaProcessos({
  dados,
  aba,
  pagina,
  setPagina,
  moeda,
  status,
  loading,
}: any) {
  const filtrados = useMemo(() => {
    return dados.filter((item: any) => {
      if (aba === 'TODOS') return true
      return status(item) === aba
    })
  }, [dados, aba, status])

  const totalPaginas = Math.max(
    1,
    Math.ceil(filtrados.length / PAGE_SIZE)
  )

  const paginados = useMemo(() => {
    const inicio = (pagina - 1) * PAGE_SIZE
    return filtrados.slice(inicio, inicio + PAGE_SIZE)
  }, [filtrados, pagina])

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <Th>AWB</Th>
              <Th>Cliente</Th>
              <Th>Serviço</Th>
              <Th>Valor Parceiro</Th>
              <Th>Mês Pgto</Th>
              <Th>Status</Th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center">
                  Carregando processos...
                </td>
              </tr>
            ) : paginados.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="p-8 text-center text-slate-500"
                >
                  Nenhum processo encontrado para este parceiro.
                </td>
              </tr>
            ) : (
              paginados.map((item: any) => {
                const statusAtual = status(item)

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
                      <Badge
                        texto={statusAtual}
                        classe={
                          statusAtual === 'PAGO'
                            ? 'bg-green-100 text-green-700 border-green-300'
                            : 'bg-yellow-100 text-yellow-700 border-yellow-300'
                        }
                      />
                    </Td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-5">
        <p className="text-sm text-slate-500">
          Mostrando {paginados.length} de {filtrados.length} processos
        </p>

        <div className="flex gap-2 items-center">
          <button
            type="button"
            disabled={pagina <= 1}
            onClick={() => setPagina((p: number) => Math.max(1, p - 1))}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-800 font-bold disabled:opacity-50"
          >
            ‹
          </button>

          <span className="text-sm font-bold">
            Página {pagina} de {totalPaginas}
          </span>

          <button
            type="button"
            disabled={pagina >= totalPaginas}
            onClick={() =>
              setPagina((p: number) => Math.min(totalPaginas, p + 1))
            }
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-800 font-bold disabled:opacity-50"
          >
            ›
          </button>
        </div>
      </div>
    </>
  )
}

function CardResumo({ titulo, valor, cor }: any) {
  const cores: any = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  }

  return (
    <div className={`rounded-3xl border p-6 shadow-sm ${cores[cor]}`}>
      <p className="text-xs font-black tracking-widest opacity-80">
        {titulo}
      </p>

      <p className="text-3xl font-black mt-3">
        {valor}
      </p>
    </div>
  )
}

function LinhaInfo({ label, valor }: any) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
      <span className="text-sm text-slate-500">
        {label}
      </span>

      <span className="font-black text-slate-900">
        {valor}
      </span>
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
    <th className="px-4 py-3 text-left font-black whitespace-nowrap">
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-4 py-4 whitespace-nowrap">
      {children}
    </td>
  )
}