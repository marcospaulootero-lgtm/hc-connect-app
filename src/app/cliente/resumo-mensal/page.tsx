'use client'

// HC_RESUMO_MENSAL_CLIENTE_V1
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Registro = Record<string, any>
const dataLocal = () => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(new Date())
  return /^\d{4}-\d{2}$/.test(p) ? p : new Date().toISOString().slice(0, 7)
}
const chaveData = (v: any) => String(v || '').slice(0, 7)
const dataBR = (v: any) => {
  if (!v) return '—'
  const d = String(v).slice(0, 10).split('-')
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : String(v)
}
const numero = (v: any): number | null => {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const t = String(v).replace(/[^\d,.-]/g, '')
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
  return Number.isFinite(n) ? n : null
}
const dinheiro = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const anterior = (m: string) => {
  const [ano, mes] = m.split('-').map(Number)
  const d = new Date(Date.UTC(ano, mes - 2, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
const anoMes = (m: string) => {
  const [ano, mes] = m.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(ano, mes - 1, 1)))
}
function valorFatura(f: Registro) {
  // Não usar custo de transportadora ou valor da mercadoria como faturamento ao cliente.
  for (const campo of ['valor_total', 'total', 'valor_fatura', 'valor_cobranca', 'valor']) {
    const v = numero(f[campo])
    if (v !== null) return v
  }
  return null
}
function tituloResumo(v: number, a: number) {
  if (a === 0) return v === 0 ? 'Sem variação' : 'Sem base no mês anterior'
  const n = ((v - a) / a) * 100
  return `${n >= 0 ? '+' : ''}${n.toFixed(1).replace('.', ',')}% versus mês anterior`
}
export default function ResumoMensalClientePage() {
  const [mes, setMes] = useState(dataLocal())
  const [usuario, setUsuario] = useState<Registro | null>(null)
  const [embarques, setEmbarques] = useState<Registro[]>([])
  const [faturas, setFaturas] = useState<Registro[]>([])
  const [cotacoes, setCotacoes] = useState<Registro[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [exportando, setExportando] = useState(false)
  const [tipoOperacao, setTipoOperacao] = useState('TODOS')
  const [comFaturas, setComFaturas] = useState(true)
  const [comCotacoes, setComCotacoes] = useState(true)

  useEffect(() => { void carregar() }, [])

  async function carregar() {
    setLoading(true)
    setErro('')
    try {
      const { data: auth, error: erroAuth } = await supabase.auth.getUser()
      if (erroAuth || !auth.user) throw new Error('Faça login para acessar o relatório.')
      const uid = auth.user.id
      const { data: perfil, error: erroPerfil } = await supabase.from('perfis').select('id, nome, tipo_acesso, ativo, empresa_id').eq('id', uid).single()
      if (erroPerfil || !perfil || perfil.ativo === false || perfil.tipo_acesso === 'admin') throw new Error('Acesso disponível somente para clientes ativos.')
      setUsuario(perfil)

      // Reutiliza os vínculos já adotados no dashboard e em Faturas do cliente.
      const [diretos, vinculos, vinculosFaturas, cotacoesRes] = await Promise.all([
        supabase.from('embarques').select('*').eq('usuario_id', uid),
        supabase.from('embarque_clientes').select('embarque_id').eq('cliente_id', uid),
        supabase.from('fatura_clientes').select('fatura_id').eq('cliente_id', uid),
        supabase.from('cotacoes').select('id, usuario_id, criado_em, referencia_hc, referencia_cliente, servico, tipo_operacao, status, origem, destino, transportadoras_consulta').eq('usuario_id', uid),
      ])
      for (const r of [diretos, vinculos, vinculosFaturas, cotacoesRes]) if (r.error) throw new Error(r.error.message)
      const idsVinculados = Array.from(new Set((vinculos.data || []).map((x: any) => x.embarque_id).filter(Boolean)))
      let outros: Registro[] = []
      if (idsVinculados.length) {
        const r = await supabase.from('embarques').select('*').in('id', idsVinculados)
        if (r.error) throw new Error(r.error.message)
        outros = r.data || []
      }
      const emb = Array.from(new Map([...(diretos.data || []), ...outros].map((x: any) => [x.id, x])).values())
      setEmbarques(emb)
      setCotacoes(cotacoesRes.data || [])

      const idsEmbarques = emb.map((x: any) => x.id).filter(Boolean)
      const idsFaturas = Array.from(new Set((vinculosFaturas.data || []).map((x: any) => x.fatura_id).filter(Boolean)))
      const consultas: any[] = []
      if (idsEmbarques.length) consultas.push(supabase.from('faturas').select('*').in('embarque_id', idsEmbarques).eq('visivel_cliente', true))
      if (idsFaturas.length) consultas.push(supabase.from('faturas').select('*').in('id', idsFaturas).eq('visivel_cliente', true))
      consultas.push(supabase.from('faturas').select('*').eq('usuario_id', uid).is('embarque_id', null).eq('visivel_cliente', true))
      const resultados = await Promise.all(consultas)
      for (const r of resultados) if (r.error) throw new Error(r.error.message)
      setFaturas(Array.from(new Map(resultados.flatMap(r => r.data || []).map((f: any) => [f.id, f])).values()))
    } catch (e: any) {
      setErro(e?.message || 'Falha ao consultar as operações.')
    } finally { setLoading(false) }
  }

  const filtrados = useMemo(() => {
    const embMes = embarques.filter(x => chaveData(x.criado_em || x.created_at) === mes)
    const prev = embarques.filter(x => chaveData(x.criado_em || x.created_at) === anterior(mes))
    const filtrarTipo = (list: Registro[]) => list.filter(x => {
      const servico = String(x.servico || x.tipo_operacao || '').toUpperCase()
      return tipoOperacao === 'TODOS' || (tipoOperacao === 'IMPORTACAO' ? servico.includes('IMPORT') : servico.includes('EXPORT'))
    })
    return {
      emb: filtrarTipo(embMes), prev: filtrarTipo(prev),
      cot: cotacoes.filter(x => chaveData(x.criado_em) === mes),
      fat: faturas.filter(x => chaveData(x.criado_em) === mes),
    }
  }, [embarques, faturas, cotacoes, mes, tipoOperacao])
  const valores = filtrados.fat.map(valorFatura)
  const cobertas = valores.filter((v): v is number => v !== null)
  const total = cobertas.reduce((n, x) => n + x, 0)
  const importacoes = filtrados.emb.filter(x => String(x.servico || '').toUpperCase().includes('IMPORT')).length
  const exportacoes = filtrados.emb.filter(x => String(x.servico || '').toUpperCase().includes('EXPORT')).length
  const nome = String(usuario?.nome || 'Cliente')

  async function gerarExcel() {
    setExportando(true)
    try {
      const XLSX = await import('xlsx')
      const livro = XLSX.utils.book_new()
      const resumo = [{ Cliente: nome, Competencia: mes, Embarques: filtrados.emb.length, Importacoes: importacoes, Exportacoes: exportacoes, Cotacoes: filtrados.cot.length, Faturas: filtrados.fat.length, Valor_faturas_identificado_BRL: cobertas.length ? total : '', Faturas_com_valor_identificado: cobertas.length }]
      XLSX.utils.book_append_sheet(livro, XLSX.utils.json_to_sheet(resumo), 'Resumo')
      XLSX.utils.book_append_sheet(livro, XLSX.utils.json_to_sheet(filtrados.emb.map(e => ({ Referencia_HC: e.referencia_hc || '', AWB: e.awb || '', Data: dataBR(e.criado_em), Servico: e.servico || '', Transportadora: e.transportadora || '', Origem: e.origem || '', Destino: e.destino || '', Peso_real_kg: e.peso_real ?? '', Peso_taxado_kg: e.peso_taxado ?? '', Status: e.status_operacional || '' }))), 'Embarques')
      if (comFaturas) XLSX.utils.book_append_sheet(livro, XLSX.utils.json_to_sheet(filtrados.fat.map(f => ({ Fatura_ID: f.id, Embarque_ID: f.embarque_id || '', Data: dataBR(f.criado_em), Tipo: f.tipo_fatura || '', Valor_BRL: valorFatura(f) ?? '', Situacao: f.status_pagamento || '', Pagamento: dataBR(f.data_pagamento), PDF: f.arquivo_pdf || '' }))), 'Faturas')
      if (comCotacoes) XLSX.utils.book_append_sheet(livro, XLSX.utils.json_to_sheet(filtrados.cot.map(c => ({ Referencia_HC: c.referencia_hc || '', Referencia_cliente: c.referencia_cliente || '', Data: dataBR(c.criado_em), Servico: c.servico || c.tipo_operacao || '', Origem: c.origem || '', Destino: c.destino || '', Status: c.status || '' }))), 'Cotacoes')
      XLSX.writeFile(livro, `HC-Resumo-Mensal-${mes}.xlsx`)
    } catch (e: any) { alert('Não foi possível gerar o Excel: ' + (e?.message || e)) }
    finally { setExportando(false) }
  }

  return (
    <main className="min-h-screen bg-[#020817] px-4 py-7 text-white md:px-8">
      <div className="mx-auto max-w-none space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
          <div><p className="text-xs font-bold uppercase tracking-widest text-blue-400">HC Connect · Portal do cliente</p><h1 className="mt-2 text-3xl font-black md:text-4xl">Resumo mensal de operações</h1><p className="mt-2 text-sm text-slate-400">Relatório consolidado do período, com embarques, cotações e faturas disponíveis.</p></div>
          <a href="/cliente" className="rounded-xl bg-slate-700 px-4 py-3 text-sm font-bold hover:bg-slate-600">Voltar ao portal</a>
        </div>
        <section className="rounded-2xl border border-blue-900 bg-[#071225] p-5 print:border-gray-300 print:bg-white print:text-black">
          <div className="flex flex-wrap items-end gap-4 print:hidden">
            <label className="flex flex-col gap-2 text-sm font-bold">Competência <input className="rounded-lg border border-blue-700 bg-[#020817] px-3 py-2" type="month" value={mes} onChange={e => setMes(e.target.value)} /></label>
            <label className="flex flex-col gap-2 text-sm font-bold">Tipo de operação <select className="rounded-lg border border-blue-700 bg-[#020817] px-3 py-2" value={tipoOperacao} onChange={e => setTipoOperacao(e.target.value)}><option value="TODOS">Todas</option><option value="IMPORTACAO">Importações</option><option value="EXPORTACAO">Exportações</option></select></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={comFaturas} onChange={e => setComFaturas(e.target.checked)} /> Faturamento</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={comCotacoes} onChange={e => setComCotacoes(e.target.checked)} /> Cotações</label>
            <button disabled={loading || !!erro} onClick={() => window.print()} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold disabled:opacity-50">Imprimir / Salvar PDF</button>
            <button disabled={loading || !!erro || exportando} onClick={gerarExcel} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold disabled:opacity-50">{exportando ? 'Gerando Excel...' : 'Baixar Excel'}</button>
          </div>
          {loading && <p className="mt-5 text-blue-300">Carregando dados do cliente...</p>}
          {erro && <p className="mt-5 rounded-xl border border-red-500 p-3 text-red-300">{erro}</p>}
          {!loading && !erro && <>
            <div className="mt-6 border-b border-blue-900 pb-4 print:mt-0"><h2 className="text-xl font-black">HC Consultoria — Resumo de {anoMes(mes)}</h2><p className="text-sm text-slate-400 print:text-gray-700">Cliente: {nome} • Gerado em {new Date().toLocaleDateString('pt-BR')}</p></div>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[["Embarques", filtrados.emb.length], ["Importações", importacoes], ["Exportações", exportacoes], ["Cotações", filtrados.cot.length], ["Faturas", filtrados.fat.length]].map(([t,v]) => <div key={String(t)} className="rounded-xl border border-blue-900 bg-[#020817] p-4 print:border-gray-300 print:bg-white"><p className="text-xs text-slate-400 print:text-gray-600">{t}</p><p className="mt-1 text-2xl font-black">{v}</p></div>)}
              <div className="col-span-2 rounded-xl border border-blue-900 bg-[#020817] p-4 print:border-gray-300 print:bg-white"><p className="text-xs text-slate-400 print:text-gray-600">Faturamento identificado (R$)</p><p className="mt-1 text-2xl font-black">{cobertas.length ? dinheiro(total) : 'Não disponível'}</p><p className="text-xs text-slate-400 print:text-gray-600">Valor disponível em {cobertas.length} de {filtrados.fat.length} faturas; não inclui custos da HC.</p></div>
            </div>
            <p className="mt-4 text-sm text-blue-300 print:text-black">{tituloResumo(filtrados.emb.length, filtrados.prev.length)} em quantidade de embarques, pela data de criação do processo.</p>
            <h3 className="mt-8 mb-3 text-lg font-black">Embarques do mês</h3>
            <div className="overflow-x-auto"><table className="w-full border-collapse text-left text-xs"><thead><tr className="border-b border-blue-700">{['Data','AWB','Referência','Serviço','Transportadora','Origem → Destino','Status'].map(x => <th key={x} className="p-2">{x}</th>)}</tr></thead><tbody>{filtrados.emb.map(e => <tr key={e.id} className="border-b border-blue-900 print:border-gray-300"><td className="p-2">{dataBR(e.criado_em || e.created_at)}</td><td className="p-2">{e.awb || '—'}</td><td className="p-2">{e.referencia_hc || e.referencia_cliente || '—'}</td><td className="p-2">{e.servico || '—'}</td><td className="p-2">{e.transportadora || '—'}</td><td className="p-2">{e.origem || '—'} → {e.destino || '—'}</td><td className="p-2">{e.status_operacional || '—'}</td></tr>)}</tbody></table>{!filtrados.emb.length && <p className="p-3 text-sm text-slate-400">Nenhum embarque para o período.</p>}</div>
            {comFaturas && <><h3 className="mt-8 mb-3 text-lg font-black">Faturamento do mês</h3><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-blue-700">{['Data','Fatura','Tipo','Valor (BRL)','Situação','Pagamento'].map(x => <th key={x} className="p-2">{x}</th>)}</tr></thead><tbody>{filtrados.fat.map(f => <tr key={f.id} className="border-b border-blue-900 print:border-gray-300"><td className="p-2">{dataBR(f.criado_em)}</td><td className="p-2">{String(f.id).slice(0, 8)}</td><td className="p-2">{f.tipo_fatura || '—'}</td><td className="p-2">{valorFatura(f) === null ? 'Não informado' : dinheiro(valorFatura(f)!)}</td><td className="p-2">{f.status_pagamento || '—'}</td><td className="p-2">{dataBR(f.data_pagamento)}</td></tr>)}</tbody></table>{!filtrados.fat.length && <p className="p-3 text-sm text-slate-400">Nenhuma fatura disponível nesse mês.</p>}</div></>}
            {comCotacoes && <><h3 className="mt-8 mb-3 text-lg font-black">Cotações solicitadas no mês</h3><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-blue-700">{['Data','Referência','Serviço','Rota','Status'].map(x => <th key={x} className="p-2">{x}</th>)}</tr></thead><tbody>{filtrados.cot.map(c => <tr key={c.id} className="border-b border-blue-900 print:border-gray-300"><td className="p-2">{dataBR(c.criado_em)}</td><td className="p-2">{c.referencia_hc || c.referencia_cliente || '—'}</td><td className="p-2">{c.servico || c.tipo_operacao || '—'}</td><td className="p-2">{c.origem || '—'} → {c.destino || '—'}</td><td className="p-2">{c.status || '—'}</td></tr>)}</tbody></table>{!filtrados.cot.length && <p className="p-3 text-sm text-slate-400">Nenhuma cotação solicitada no mês.</p>}</div></>}
            <p className="mt-7 text-xs text-slate-400 print:text-gray-600">Critério: embarques e cotações por criação; faturamento por emissão do registro. Apenas faturas disponibilizadas ao cliente e dados autorizados para o usuário conectado. Valores não identificados não são estimados. Para gerar PDF use a opção “Salvar como PDF” da impressão.</p>
          </>}
        </section>
      </div>
    </main>
  )
}
