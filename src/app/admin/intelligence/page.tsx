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

  function dinheiro(v: number) {
    return v.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    })
  }

  const dados = useMemo(() => {
    const receita = faturas.reduce((t, f) => t + num(f.valor_venda), 0)
    const compra = faturas.reduce((t, f) => t + num(f.valor_compra), 0)
    const profit = faturas.reduce((t, f) => t + num(f.profit || num(f.valor_venda) - num(f.valor_compra)), 0)
    const margem = receita > 0 ? (profit / receita) * 100 : 0
    const ticket = embarques.length > 0 ? receita / embarques.length : 0

    const faturasVencidas = faturas.filter((f) => {
      if (!f.vencimento || f.data_pagamento || f.recibo_pdf) return false
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
      faturasVencidas,
      embarquesSemAwb,
      cotacoesAprovadas,
      chamadosAbertos,
    }
  }, [embarques, cotacoes, faturas, chamados])

  const topTransportadoras = useMemo(() => {
    const mapa: any = {}

    embarques.forEach((e) => {
      const nome = e.transportadora || 'Não informado'
      mapa[nome] = (mapa[nome] || 0) + 1
    })

    return Object.entries(mapa)
      .map(([nome, total]: any) => ({ nome, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [embarques])

  const topClientes = useMemo(() => {
    const mapa: any = {}

    embarques.forEach((e) => {
      const nome = e.cliente_final || e.importador || e.exportador || 'Não informado'
      mapa[nome] = (mapa[nome] || 0) + 1
    })

    return Object.entries(mapa)
      .map(([nome, total]: any) => ({ nome, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [embarques])

  if (loading) {
    return (
      <main className="max-w-[1500px] mx-auto p-8 text-white">
        Carregando Intelligence...
      </main>
    )
  }

  return (
    <main className="max-w-[1600px] mx-auto p-8 text-white">
      <div className="flex justify-between items-start gap-6 mb-8">
        <div>
          <p className="text-purple-400 font-bold mb-2">Business Intelligence</p>
          <h1 className="text-5xl font-black mb-2">Intelligence</h1>
          <p className="text-slate-400 text-lg">
            Análise completa de embarques, cotações, financeiro e performance da HC.
          </p>
        </div>

        <Link
          href="/admin"
          className="bg-slate-800 hover:bg-slate-700 px-5 py-3 rounded-xl font-bold"
        >
          Voltar
        </Link>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-6">
        <Kpi titulo="Receita total" valor={dinheiro(dados.receita)} detalhe="Valor vendido" icone="💰" cor="purple" />
        <Kpi titulo="Profit total" valor={dinheiro(dados.profit)} detalhe="Venda - compra" icone="📈" cor="green" />
        <Kpi titulo="Margem média" valor={`${dados.margem.toFixed(1)}%`} detalhe="Profit / receita" icone="🎯" cor="blue" />
        <Kpi titulo="Embarques" valor={embarques.length} detalhe="Total cadastrados" icone="🚚" cor="orange" />
        <Kpi titulo="Ticket médio" valor={dinheiro(dados.ticket)} detalhe="Receita / embarques" icone="🧾" cor="purple" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-6">
        <div className="xl:col-span-1 card-premium">
          <h2 className="text-2xl font-black mb-6">Funil comercial</h2>

          <Funil valor={cotacoes.length} label="Cotações criadas" cor="bg-purple-600" />
          <Funil valor={dados.cotacoesAprovadas} label="Cotações aprovadas" cor="bg-blue-600" />
          <Funil valor={embarques.length} label="Embarques criados" cor="bg-green-600" />
          <Funil valor={faturas.length} label="Faturas emitidas" cor="bg-yellow-600" />
          <Funil valor={faturas.filter((f) => f.recibo_pdf || f.data_pagamento).length} label="Faturas recebidas" cor="bg-orange-600" />

          <div className="mt-6 border border-blue-900 rounded-2xl p-4 bg-[#020817]">
            <p className="text-slate-400 text-sm">Taxa de conversão</p>
            <h3 className="text-3xl font-black text-blue-400">
              {cotacoes.length > 0
                ? `${((embarques.length / cotacoes.length) * 100).toFixed(1)}%`
                : '0%'}
            </h3>
          </div>
        </div>

        <div className="xl:col-span-2 card-premium">
          <h2 className="text-2xl font-black mb-6">Top clientes</h2>

          <div className="space-y-4">
            {topClientes.map((item, index) => (
              <Ranking key={item.nome} pos={index + 1} nome={item.nome} valor={`${item.total} embarque(s)`} />
            ))}
          </div>
        </div>

        <div className="card-premium">
          <h2 className="text-2xl font-black mb-6">Alertas inteligentes</h2>

          <Alerta texto="Faturas vencidas" valor={dados.faturasVencidas} cor="red" />
          <Alerta texto="Embarques sem AWB" valor={dados.embarquesSemAwb} cor="yellow" />
          <Alerta texto="Cotações sem fechamento" valor={Math.max(cotacoes.length - dados.cotacoesAprovadas, 0)} cor="orange" />
          <Alerta texto="Chamados abertos" valor={dados.chamadosAbertos} cor="red" />
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <div className="card-premium">
          <h2 className="text-2xl font-black mb-6">Transportadoras</h2>

          <div className="space-y-4">
            {topTransportadoras.map((item) => (
              <div key={item.nome}>
                <div className="flex justify-between mb-2">
                  <span className="font-bold">{item.nome}</span>
                  <span className="text-blue-400 font-black">{item.total}</span>
                </div>

                <div className="h-3 rounded-full bg-slate-900 overflow-hidden">
                  <div
                    className="h-full bg-purple-600 rounded-full"
                    style={{ width: `${embarques.length ? (item.total / embarques.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-premium">
          <h2 className="text-2xl font-black mb-6">Financeiro - resumo</h2>

          <Resumo label="Receita total" valor={dinheiro(dados.receita)} cor="green" />
          <Resumo label="Custo transportadoras" valor={dinheiro(dados.compra)} cor="red" />
          <Resumo label="Profit líquido" valor={dinheiro(dados.profit)} cor="blue" />
          <Resumo label="Margem média" valor={`${dados.margem.toFixed(1)}%`} cor="purple" />
        </div>

        <div className="card-premium">
          <h2 className="text-2xl font-black mb-6">Performance geral</h2>

          <Resumo label="Clientes ativos" valor={topClientes.length} cor="blue" />
          <Resumo label="Cotações" valor={cotacoes.length} cor="purple" />
          <Resumo label="Embarques" valor={embarques.length} cor="green" />
          <Resumo label="Faturas" valor={faturas.length} cor="yellow" />
        </div>
      </section>

      <style jsx>{`
        .card-premium {
          border: 1px solid #1e3a8a;
          background: linear-gradient(180deg, #071225, #020817);
          border-radius: 24px;
          padding: 24px;
          box-shadow: 0 0 30px rgba(37, 99, 235, 0.08);
        }
      `}</style>
    </main>
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
    <div className="border border-blue-900 rounded-3xl bg-[#071225] p-6">
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

function Funil({ valor, label, cor }: any) {
  return (
    <div className={`mb-3 ${cor} rounded-xl px-5 py-3 flex justify-between font-black`}>
      <span>{valor}</span>
      <span>{label}</span>
    </div>
  )
}

function Ranking({ pos, nome, valor }: any) {
  return (
    <div className="border border-blue-900 bg-[#020817] rounded-2xl p-4 flex justify-between gap-4">
      <div className="flex gap-4">
        <span className="text-slate-500 font-black">{pos}</span>
        <span className="font-bold">{nome}</span>
      </div>

      <span className="text-blue-400 font-black">{valor}</span>
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
    <div className="flex justify-between border-b border-blue-900 py-4">
      <span className="text-slate-300">{label}</span>
      <strong className={cores[cor]}>{valor}</strong>
    </div>
  )
}