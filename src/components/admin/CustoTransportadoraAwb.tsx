'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { numeroValorBR } from '@/lib/valorContabil'

type Item = {
  id: string
  fatura_transportadora_id: string
  awb: string | null
  valor_compra: number | string | null
}
type Fatura = {
  id: string
  numero_fatura: string | null
  transportadora: string | null
  moeda: string | null
  situacao: string | null
  vencimento: string | null
  data_pagamento: string | null
}
type Linha = { item: Item; fatura: Fatura | null }
type Consulta = { chave: string; carregando: boolean; erro: boolean; linhas: Linha[] }

function normalizarAwbCusto(awb: string) {
  return awb.trim().toUpperCase().replace(/[\s.\-/]/g, '')
}

function hojeBrasil() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value || ''
  return `${valor('year')}-${valor('month')}-${valor('day')}`
}

function statusFaturaCusto(fatura: Fatura, hoje: string) {
  const situacao = String(fatura.situacao || '').trim().toUpperCase()
  if (situacao.includes('CANCEL')) return 'Cancelada'
  if (fatura.data_pagamento || ['PAGO', 'PAGA', 'BAIXADO', 'BAIXADA', 'QUITADO', 'QUITADA'].includes(situacao)) return 'Pago'
  if (situacao.includes('CONTEST')) return 'Contestada'
  const vencimento = String(fatura.vencimento || '').slice(0, 10)
  if ((/^\d{4}-\d{2}-\d{2}$/.test(vencimento) && vencimento < hoje) || /VENCID/.test(situacao)) return 'Vencido'
  return 'Em aberto'
}

function dinheiroCusto(valor: Item['valor_compra'], codigo: string | null) {
  if (valor === null || valor === undefined || valor === '') return 'Valor não informado'
  const numero = numeroValorBR(valor)
  if (!Number.isFinite(numero)) return 'Valor não informado'
  const moeda = String(codigo || 'BRL').trim().toUpperCase()
  try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda }).format(numero) }
  catch { return `${moeda} ${numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
}

export default function CustoTransportadoraAwb({ awb }: { awb?: string | null }) {
  const original = String(awb || '').trim()
  const chave = normalizarAwbCusto(original)
  const valido = !!chave && !chave.startsWith('AGUARDANDOAWB')
  const [versao, setVersao] = useState(0)
  const [consulta, setConsulta] = useState<Consulta>({ chave: '', carregando: false, erro: false, linhas: [] })

  useEffect(() => {
    let ativo = true
    if (!valido) return () => { ativo = false }
    setConsulta({ chave, carregando: true, erro: false, linhas: [] })
    async function consultar() {
      try {
        const variantes = Array.from(new Set([original, original.toUpperCase(), chave]))
        const itens: Item[] = []
        for (let inicio = 0; ; inicio += 500) {
          const { data, error } = await supabase.from('faturas_transportadoras_itens')
            .select('id, fatura_transportadora_id, awb, valor_compra')
            .in('awb', variantes).order('id').range(inicio, inicio + 499)
          if (!ativo) return
          if (error) throw error
          const pagina = (data || []) as Item[]
          itens.push(...pagina.filter((item) => normalizarAwbCusto(String(item.awb || '')) === chave))
          if (pagina.length < 500) break
        }
        const ids = Array.from(new Set(itens.map((item) => item.fatura_transportadora_id).filter(Boolean)))
        const faturas = new Map<string, Fatura>()
        for (let i = 0; i < ids.length; i += 100) {
          const { data, error } = await supabase.from('faturas_transportadoras')
            .select('id, numero_fatura, transportadora, moeda, situacao, vencimento, data_pagamento')
            .in('id', ids.slice(i, i + 100))
          if (!ativo) return
          if (error) throw error
          for (const fatura of (data || []) as Fatura[]) faturas.set(fatura.id, fatura)
        }
        if (ativo) setConsulta({ chave, carregando: false, erro: false,
          linhas: itens.map((item) => ({ item, fatura: faturas.get(item.fatura_transportadora_id) || null })) })
      } catch {
        if (ativo) setConsulta({ chave, carregando: false, erro: true, linhas: [] })
      }
    }
    void consultar()
    return () => { ativo = false }
  }, [chave, original, valido, versao])

  if (!valido) return null
  const carregando = consulta.chave !== chave || consulta.carregando
  const hoje = hojeBrasil()
  return (
    <section className="my-4 rounded-2xl border border-cyan-700/60 bg-cyan-950/20 p-4" aria-label="Custo da transportadora por AWB">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-black text-cyan-300">Custo da transportadora</h3>
          <p className="mt-1 text-sm text-slate-300">AWB {original}</p>
        </div>
        <button type="button" disabled={carregando} onClick={() => {
          setConsulta({ chave, carregando: true, erro: false, linhas: [] })
          setVersao((valor) => valor + 1)
        }} className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Atualizar consulta</button>
      </div>
      <div aria-live="polite" className="mt-3">
        {carregando ? <p className="text-sm text-slate-300">Consultando faturas da transportadora…</p>
          : consulta.erro ? <p role="alert" className="text-sm text-amber-300">Não foi possível consultar o custo. Clique em Atualizar consulta para tentar novamente.</p>
          : consulta.linhas.length === 0 ? <p className="text-sm text-amber-200">Nenhuma fatura de transportadora localizada para este AWB.</p>
          : <div className="space-y-3">
            <p className="text-sm font-bold text-green-300">Já consta cobrança da transportadora para este AWB.</p>
            {consulta.linhas.map(({ item, fatura }) => {
              const status = fatura ? statusFaturaCusto(fatura, hoje) : 'Não disponível'
              return <div key={item.id} className="rounded-xl border border-slate-700 bg-[#020817] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-white">{fatura?.transportadora || 'Transportadora não disponível'} • Fatura {fatura?.numero_fatura || 'não disponível'}</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${status === 'Pago' ? 'bg-green-500/20 text-green-300' : status === 'Vencido' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-200'}`}>{status}</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">Custo deste AWB</p>
                <p className="mt-1 text-xl font-black text-white">{fatura ? dinheiroCusto(item.valor_compra, fatura.moeda) : 'Fatura vinculada indisponível'}</p>
                {fatura?.vencimento && <p className="mt-2 text-xs text-slate-400">Vencimento: {fatura.vencimento.slice(0, 10).split('-').reverse().join('/')}</p>}
                {fatura?.numero_fatura && <a className="mt-2 inline-block text-sm font-bold text-cyan-300 underline" target="_blank" rel="noopener noreferrer"
                  href={`/admin/faturas-transportadoras?origem=dashboard&arquivadas=TODAS&busca=${encodeURIComponent(fatura.numero_fatura)}`}>Consultar fatura da transportadora</a>}
              </div>
            })}
            <p className="text-xs text-slate-400">Valor referente ao AWB, não ao total da fatura da transportadora. O status indica o pagamento à transportadora.</p>
          </div>}
      </div>
    </section>
  )
}
