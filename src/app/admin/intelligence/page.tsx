'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

export default function IntelligencePage() {
  const [embarques, setEmbarques] = useState<any[]>([])
  const [cotacoes, setCotacoes] = useState<any[]>([])
  const [faturas, setFaturas] = useState<any[]>([])
  const [chamados, setChamados] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setLoading(true)

    const [{ data: emb }, { data: cot }, { data: fat }, { data: cha }] =
      await Promise.all([
        supabase.from('embarques').select('*'),
        supabase.from('cotacoes').select('*'),
        supabase.from('faturas').select('*'),
        supabase.from('chamados_suporte').select('*'),
      ])

    setEmbarques(emb || [])
    setCotacoes(cot || [])
    setFaturas(fat || [])
    setChamados(cha || [])
    setLoading(false)
  }

  function num(v: any) {
    return Number(v || 0)
  }

  function money(v: number) {
    return `USD ${v.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const dados = useMemo(() => {
    const receita = faturas.reduce((t, f) => t + num(f.valor_venda), 0)
    const compra = faturas.reduce((t, f) => t + num(f.valor_compra), 0)
    const profit = faturas.reduce(
      (t, f) => t + num(f.profit || num(f.valor_venda) - num(f.valor_compra)),
      0
    )

    const margem = receita > 0 ? (profit / receita) * 100 : 0
    const ticket = faturas.length > 0 ? receita / faturas.length : 0

    const faturasRecebidas = faturas.filter(
      (f) => f.recibo_pdf || f.data_pagamento
    ).length

    const faturasVencidas = faturas.filter((f) => {
      if (!f.vencimento || f.recibo_pdf || f.data_pagamento) return false
      return new Date(f.vencimento) < new Date()
    }).length

    const embarquesSemAwb = embarques.filter((e) => {
      const awb = String(e.awb || '').toLowerCase()
      return !awb || awb.includes('aguardando')
    }).length

    const cotacoesAprovadas = cotacoes.filter((c) => {
      const st = String(c.status_comercial || c.status || '').toLowerCase()
      return st.includes('aprov') || st.includes('fech')
    }).length

    const chamadosAbertos = chamados.filter((c) => {
      const st = String(c.status || '').toLowerCase()
      return !st.includes('fechado') && !st.includes('resolvido')
    }).length

    return {
      receita,
      compra,
      profit,
      margem,
      ticket,
      faturasRecebidas,
      faturasVencidas,
      embarquesSemAwb,
      cotacoesAprovadas,
      chamadosAbertos,
    }
  }, [embarques, cotacoes, faturas, chamados])

  const topClientes = useMemo(() => {
    const mapa: any = {}

    embarques.forEach((e) => {
      const nome = e.cliente_final || e.importador || e.exportador || 'Não informado'
      if (!mapa[nome]) mapa[nome] = { nome, total: 0, profit: 0 }
      mapa[nome].total += 1
    })

    faturas.forEach((f) => {
      const emb = embarques.find((e) => e.id === f.embarque_id)
      const nome = emb?.cliente_final || emb?.importador || emb?.exportador || 'Não informado'
      if (!mapa[nome]) mapa[nome] = { nome, total: 0, profit: 0 }
      mapa[nome].profit += num(f.profit || num(f.valor_venda) - num(f.valor_compra))
    })

    return Object.values(mapa)
      .sort((a: any, b: any) => b.profit - a.profit || b.total - a.total)
      .slice(0, 5) as any[]
  }, [embarques, faturas])

  const topTransportadoras = useMemo(() => {
    const mapa: any = {}

    embarques.forEach((e) => {
      const nome = e.transportadora || 'Não informado'
      if (!mapa[nome]) mapa[nome] = { nome, total: 0, profit: 0 }
      mapa[nome].total += 1
    })

    faturas.forEach((f) => {
      const emb = embarques.find((e) => e.id === f.embarque_id)
      const nome = emb?.transportadora || 'Não informado'
      if (!mapa[nome]) mapa[nome] = { nome, total: 0, profit: 0 }
      mapa[nome].profit += num(f.profit || num(f.valor_venda) - num(f.valor_compra))
    })

    return Object.values(mapa)
      .sort((a: any, b: any) => b.total - a.total)
      .slice(0, 5) as any[]
  }, [embarques, faturas])

  const porServico = useMemo(() => {
    const mapa: any = {}

    embarques.forEach((e) => {
      const nome = e.servico || 'Não informado'
      mapa[nome] = (mapa[nome] || 0) + 1
    })

    return Object.entries(mapa)
      .map(([nome, total]: any) => ({ nome, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [embarques])

  const porPais = useMemo(() => {
    const mapa: any = {}

    embarques.forEach((e) => {
      const pais = e.pais_origem || e.origem || e.destino || 'Não informado'
      mapa[pais] = (mapa[pais] || 0) + 1
    })

    return Object.entries(mapa)
      .map(([nome, total]: any) => ({ nome, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [embarques])

  if (loading) {
    return (
      <main className="max-w-[1600px] mx-auto p-8 text-white">
        Carregando Intelligence...
      </main>
    )
  }

  return (
    <main className="max-w-[1700px] mx-auto p-8 text-white">
      <div className="border border-blue-900 rounded-3xl bg-[#071225] p-5 mb-6 flex flex-col xl:flex-row justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-purple-600/20 text-purple-400 flex items-center justify-center text-3xl">
            📊
          </div>

          <div>
            <h1 className="text-4xl font-black">Intelligence</h1>
            <p className="text-slate-400">
              Análises completas do negócio em tempo real
            </p>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button className="border border-blue-900 bg-[#020817] px-5 py-3 rounded-xl font-bold">
            01/06/2026 - 30/06/2026
          </button>

          <button className="border border-blue-900 bg-[#020817] px-5 py-3 rounded-xl font-bold">
            ⚙️ Filtros
          </button>

          <Link
            href="/admin"
            className="bg-purple-600 hover:bg-purple-500 px-5 py-3 rounded-xl font-bold"
          >
            Voltar
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-6">
        <Kpi titulo="Receita total" valor={money(dados.receita)} detalhe="Valor vendido" icone="💰" cor="purple" />
        <Kpi titulo="Profit total" valor={money(dados.profit)} detalhe="Venda - compra" icone="📈" cor="green" />
        <Kpi titulo="Margem média" valor={`${dados.margem.toFixed(1)}%`} detalhe="Profit / receita" icone="🎯" cor="blue" />
        <Kpi titulo="Embarques" valor={embarques.length} detalhe="Total cadastrados" icone="🚚" cor="orange" />
        <Kpi titulo="Ticket médio" valor={money(dados.ticket)} detalhe="Média por fatura" icone="🧾" cor="purple" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-6">
        <Card>
          <h2 className="text-2xl font-black mb-6">Funil comercial</h2>
          <Funil valor={cotacoes.length} label="Cotações criadas" cor="from-purple-600 to-purple-500" largura="100%" />
          <Funil valor={cotacoes.length} label="Cotações enviadas" cor="from-indigo-600 to-blue-500" largura="88%" />
          <Funil valor={dados.cotacoesAprovadas} label="Cotações aprovadas" cor="from-blue-600 to-cyan-500" largura="76%" />
          <Funil valor={embarques.length} label="Embarques criados" cor="from-green-600 to-emerald-500" largura="64%" />
          <Funil valor={faturas.length} label="Faturas emitidas" cor="from-yellow-600 to-orange-500" largura="52%" />
          <Funil valor={dados.faturasRecebidas} label="Faturas recebidas" cor="from-orange-600 to-red-500" largura="40%" />

          <div className="mt-6 border border-blue-900 rounded-2xl p-4 bg-[#020817]">
            <p className="text-slate-400 text-sm">Taxa de conversão geral</p>
            <h3 className="text-3xl font-black text-blue-400">
              {cotacoes.length > 0
                ? `${((embarques.length / cotacoes.length) * 100).toFixed(1)}%`
                : '0%'}
            </h3>
          </div>
        </Card>

        <div className="xl:col-span-2">
          <Card>
            <div className="flex justify-between mb-6">
              <h2 className="text-2xl font-black">Profit por cliente</h2>
              <span className="text-blue-400 text-sm font-bold">Top 5</span>
            </div>

            <div className="space-y-4">
              {topClientes.length === 0 ? (
                <p className="text-slate-500">Nenhum cliente encontrado.</p>
              ) : (
                topClientes.map((item, index) => (
                  <RankingCliente
                    key={item.nome}
                    pos={index + 1}
                    nome={item.nome}
                    profit={money(item.profit)}
                    total={`${item.total} embarque(s)`}
                  />
                ))
              )}
            </div>
          </Card>
        </div>

        <Card>
          <h2 className="text-2xl font-black mb-6">Alertas inteligentes</h2>
          <Alerta texto="Faturas vencidas" valor={dados.faturasVencidas} cor="red" />
          <Alerta texto="Embarques sem AWB" valor={dados.embarquesSemAwb} cor="yellow" />
          <Alerta texto="Cotações sem fechamento" valor={Math.max(cotacoes.length - dados.cotacoesAprovadas, 0)} cor="orange" />
          <Alerta texto="Chamados abertos" valor={dados.chamadosAbertos} cor="red" />
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <Card>
          <h2 className="text-2xl font-black mb-6">Receita x Profit</h2>

          <div className="h-64 flex items-end gap-5 border-b border-blue-900 pb-4">
            {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'].map((mes, i) => (
              <div key={mes} className="flex-1 flex flex-col items-center gap-2">
                <div className="flex items-end gap-2 h-48">
                  <div
                    className="w-5 rounded-t-lg bg-blue-600"
                    style={{ height: `${35 + i * 8}%` }}
                  />
                  <div
                    className="w-5 rounded-t-lg bg-purple-600"
                    style={{ height: `${25 + i * 5}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400">{mes}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 mt-5">
            <MiniBox label="Receita" valor={money(dados.receita)} />
            <MiniBox label="Profit" valor={money(dados.profit)} />
            <MiniBox label="Margem" valor={`${dados.margem.toFixed(1)}%`} />
          </div>
        </Card>

        <Card>
          <h2 className="text-2xl font-black mb-6">Mapa operacional global</h2>

          <MapaOperacional porPais={porPais} />

          <div className="space-y-3 mt-5">
            {porPais.map((p) => (
              <LinhaBarra key={p.nome} nome={p.nome} valor={`${p.total} embarque(s)`} />
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-2xl font-black mb-6">Receita por serviço</h2>

          <div className="flex justify-center mb-6">
            <div className="w-44 h-44 rounded-full bg conic-gradient flex items-center justify-center">
              <div className="w-28 h-28 rounded-full bg-[#020817] flex flex-col items-center justify-center">
                <span className="text-slate-400 text-sm">Total</span>
                <strong className="text-xl">{money(dados.receita)}</strong>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {porServico.map((s) => (
              <LinhaBarra key={s.nome} nome={s.nome} valor={`${s.total} operação(ões)`} />
            ))}
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <Card>
          <h2 className="text-2xl font-black mb-6">Profit por transportadora</h2>

          <div className="space-y-5">
            {topTransportadoras.map((item) => (
              <div key={item.nome}>
                <div className="flex justify-between mb-2">
                  <span className="font-bold">{item.nome}</span>
                  <span className="text-blue-400 font-black">{item.total}</span>
                </div>

                <div className="h-4 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 rounded-full"
                    style={{
                      width: `${embarques.length ? (item.total / embarques.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-2xl font-black mb-6">Financeiro - resumo</h2>
          <Resumo label="A receber hoje" valor={money(0)} cor="green" />
          <Resumo label="A receber no mês" valor={money(dados.receita)} cor="green" />
          <Resumo label="A pagar transportadoras" valor={money(dados.compra)} cor="red" />
          <Resumo label="Profit estimado" valor={money(dados.profit)} cor="blue" />
          <Resumo label="Fluxo de caixa estimado" valor={money(dados.profit)} cor="purple" />
        </Card>

        <Card>
          <h2 className="text-2xl font-black mb-6">Performance geral</h2>
          <Resumo label="Clientes ativos" valor={topClientes.length} cor="blue" />
          <Resumo label="Novos clientes" valor={topClientes.length} cor="green" />
          <Resumo label="Cotações mês" valor={cotacoes.length} cor="purple" />
          <Resumo label="Embarques mês" valor={embarques.length} cor="yellow" />
          <Resumo label="Faturas emitidas" valor={faturas.length} cor="blue" />
          <Resumo label="Faturas recebidas" valor={dados.faturasRecebidas} cor="green" />
        </Card>
      </section>

      <style jsx>{`
        .bg.conic-gradient {
          background: conic-gradient(#7c3aed 0 45%, #2563eb 45% 70%, #06b6d4 70% 85%, #f97316 85% 100%);
        }
      `}</style>
    </main>
  )
}

function Card({ children }: any) {
  return (
    <div className="border border-blue-900 rounded-3xl bg-gradient-to-b from-[#071225] to-[#020817] p-6 shadow-[0_0_35px_rgba(37,99,235,0.10)]">
      {children}
    </div>
  )
}

function Kpi({ titulo, valor, detalhe, icone, cor }: any) {
  const cores: any = {
    purple: 'text-purple-400 bg-purple-600/20',
    green: 'text-green-400 bg-green-600/20',
    blue: 'text-blue-400 bg-blue-600/20',
    orange: 'text-orange-400 bg-orange-600/20',
  }

  return (
    <div className="border border-blue-900 rounded-3xl bg-gradient-to-b from-[#071225] to-[#020817] p-6">
      <div className="flex justify-between gap-4">
        <div>
          <p className="text-slate-400 text-sm font-bold uppercase">{titulo}</p>
          <h2 className="text-3xl font-black mt-3">{valor}</h2>
          <p className="text-green-400 text-sm mt-3">↑ {detalhe}</p>
        </div>

        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${cores[cor]}`}>
          {icone}
        </div>
      </div>
    </div>
  )
}

function Funil({ valor, label, cor, largura }: any) {
  return (
    <div className="flex justify-center">
      <div
        className={`mb-3 bg-gradient-to-r ${cor} rounded-xl px-5 py-3 flex justify-between font-black`}
        style={{ width: largura }}
      >
        <span>{valor}</span>
        <span>{label}</span>
      </div>
    </div>
  )
}

function RankingCliente({ pos, nome, profit, total }: any) {
  return (
    <div className="border border-blue-900 bg-[#020817] rounded-2xl p-4 grid grid-cols-12 gap-3 items-center">
      <div className="col-span-1 text-slate-500 font-black">{pos}</div>
      <div className="col-span-5 font-bold truncate">{nome}</div>
      <div className="col-span-3 text-slate-400 text-sm">{total}</div>
      <div className="col-span-3 text-blue-400 font-black text-right">{profit}</div>
    </div>
  )
}

function Alerta({ texto, valor, cor }: any) {
  const cores: any = {
    red: 'text-red-400 border-red-500',
    yellow: 'text-yellow-400 border-yellow-500',
    orange: 'text-orange-400 border-orange-500',
  }

  return (
    <div className="flex justify-between items-center border-b border-blue-900 py-4">
      <span>{texto}</span>
      <span className={`border rounded-full px-3 py-1 font-black ${cores[cor]}`}>
        {valor}
      </span>
    </div>
  )
}

function Resumo({ label, valor, cor }: any) {
  const cores: any = {
    green: 'text-green-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    yellow: 'text-yellow-400',
  }

  return (
    <div className="flex justify-between border-b border-blue-900 py-4 gap-4">
      <span className="text-slate-300">{label}</span>
      <strong className={cores[cor]}>{valor}</strong>
    </div>
  )
}

function MiniBox({ label, valor }: any) {
  return (
    <div className="border border-blue-900 rounded-2xl bg-[#020817] p-3">
      <p className="text-slate-500 text-xs">{label}</p>
      <strong>{valor}</strong>
    </div>
  )
}

function MapaOperacional({ porPais }: any) {
  const pontos: any = {
    'BELO HORIZONTE': { x: 48, y: 70 },
    BH: { x: 48, y: 70 },
    BRASIL: { x: 47, y: 72 },
    BRAZIL: { x: 47, y: 72 },
    ALEMANHA: { x: 50, y: 34 },
    GERMANY: { x: 50, y: 34 },
    CHINA: { x: 75, y: 46 },
    ITÁLIA: { x: 51, y: 41 },
    ITALIA: { x: 51, y: 41 },
    ITALY: { x: 51, y: 41 },
    EUA: { x: 23, y: 42 },
    USA: { x: 23, y: 42 },
    'ESTADOS UNIDOS': { x: 23, y: 42 },
    ESTADOS_UNIDOS: { x: 23, y: 42 },
    PORTUGAL: { x: 45, y: 42 },
    ESPANHA: { x: 46, y: 43 },
    SPAIN: { x: 46, y: 43 },
    FRANÇA: { x: 48, y: 39 },
    FRANCA: { x: 48, y: 39 },
    FRANCE: { x: 48, y: 39 },
    'REINO UNIDO': { x: 47, y: 35 },
    UK: { x: 47, y: 35 },
    JAPÃO: { x: 84, y: 44 },
    JAPAO: { x: 84, y: 44 },
    JAPAN: { x: 84, y: 44 },
    ÍNDIA: { x: 68, y: 52 },
    INDIA: { x: 68, y: 52 },
    MÉXICO: { x: 25, y: 50 },
    MEXICO: { x: 25, y: 50 },
    ARGENTINA: { x: 45, y: 82 },
    CHILE: { x: 40, y: 80 },
  }

  const origem = pontos.BRASIL

  const destinos = porPais
    .map((p: any) => {
      const nome = String(p.nome || '').toUpperCase().trim()
      const ponto = pontos[nome] || null
      return ponto ? { ...ponto, nome: p.nome, total: p.total } : null
    })
    .filter(Boolean)

  return (
    <div className="border border-blue-900 rounded-2xl bg-[#020817] h-64 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.22),transparent_45%)]" />

      <svg viewBox="0 0 100 60" className="absolute inset-0 w-full h-full opacity-90">
        <path d="M15 20 C20 12, 32 10, 39 16 C45 21, 38 28, 30 27 C22 26, 12 29, 15 20Z" fill="#0f2a4d" stroke="#1d4ed8" strokeWidth="0.25" />
        <path d="M43 16 C50 8, 62 11, 66 20 C70 28, 62 36, 53 33 C45 30, 38 24, 43 16Z" fill="#12365f" stroke="#1d4ed8" strokeWidth="0.25" />
        <path d="M67 24 C76 18, 89 22, 91 34 C93 45, 82 51, 72 47 C64 44, 60 31, 67 24Z" fill="#12365f" stroke="#1d4ed8" strokeWidth="0.25" />
        <path d="M42 40 C50 38, 57 45, 55 53 C53 60, 43 59, 39 52 C36 46, 36 42, 42 40Z" fill="#0f2a4d" stroke="#1d4ed8" strokeWidth="0.25" />
        <path d="M24 42 C32 41, 38 47, 36 55 C34 62, 24 60, 20 53 C16 47, 18 43, 24 42Z" fill="#0f2a4d" stroke="#1d4ed8" strokeWidth="0.25" />

        {destinos.map((d: any) => (
          <g key={d.nome}>
            <path
              d={`M${origem.x} ${origem.y} Q ${(origem.x + d.x) / 2} ${Math.min(origem.y, d.y) - 18}, ${d.x} ${d.y}`}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="0.35"
              strokeDasharray="1 1"
              opacity="0.75"
            />
            <circle cx={d.x} cy={d.y} r={Math.min(2.8 + Number(d.total || 0) * 0.35, 5)} fill="#a855f7" opacity="0.95" />
            <circle cx={d.x} cy={d.y} r={Math.min(4 + Number(d.total || 0) * 0.5, 8)} fill="none" stroke="#a855f7" strokeWidth="0.35" opacity="0.6" />
            <text x={d.x + 2} y={d.y - 1} fill="#cbd5e1" fontSize="2.6" fontWeight="700">
              {d.total}
            </text>
          </g>
        ))}

        <circle cx={origem.x} cy={origem.y} r="4" fill="#22c55e" />
        <circle cx={origem.x} cy={origem.y} r="7" fill="none" stroke="#22c55e" strokeWidth="0.4" opacity="0.7" />
      </svg>

      <div className="absolute bottom-4 left-4">
        <p className="text-slate-400 text-xs">Mapa operacional HC</p>
        <p className="text-white font-black">Rotas internacionais dos embarques</p>
      </div>

      <div className="absolute top-4 right-4 border border-blue-900 bg-[#071225]/90 rounded-xl px-4 py-3">
        <p className="text-slate-400 text-xs">Origem base</p>
        <p className="text-green-400 font-black">Brasil</p>
      </div>
    </div>
  )
}

function LinhaBarra({ nome, valor }: any) {
  return (
    <div className="flex justify-between gap-3 border-b border-blue-900 pb-2">
      <span className="font-bold truncate">{nome}</span>
      <span className="text-blue-400 font-black whitespace-nowrap">{valor}</span>
    </div>
  )
}