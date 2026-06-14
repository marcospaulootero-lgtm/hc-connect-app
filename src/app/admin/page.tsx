'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function DashboardPage() {
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [embarques, setEmbarques] = useState<any[]>([])
  const [cotacoes, setCotacoes] = useState<any[]>([])
  const [suporte, setSuporte] = useState<any[]>([])
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    buscarDados()
  }, [])

  async function atualizarTodosRastreios() {
    try {
      const { data: embarquesAtivos } = await supabase
        .from('embarques')
        .select('id,status_operacional')
        .neq('status_operacional', 'Entregue')

      if (!embarquesAtivos?.length) return

      for (const embarque of embarquesAtivos) {
        try {
          await fetch('/api/rastreio', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              embarque_id: embarque.id,
            }),
          })
        } catch (err) {
          console.error('Erro atualizando embarque:', embarque.id, err)
        }
      }
    } catch (err) {
      console.error('Erro geral atualização:', err)
    }
  }

  async function atualizarDadosManual() {
    setCarregando(true)

    try {
      await atualizarTodosRastreios()
      await buscarDados()
    } catch (error) {
      console.error(error)
    }

    setCarregando(false)
  }

  async function buscarDados() {
    setCarregando(true)

    const [perfisRes, embarquesRes, cotacoesRes, suporteRes] =
      await Promise.all([
        supabase.from('perfis').select('*').order('nome'),
        supabase
          .from('embarques')
          .select('*')
          .order('criado_em', { ascending: false }),
        supabase
          .from('cotacoes')
          .select('*')
          .order('criado_em', { ascending: false }),
        supabase
          .from('suporte')
          .select('*')
          .order('criado_em', { ascending: false }),
      ])

    setUsuarios(perfisRes.data || [])
    setEmbarques(embarquesRes.data || [])
    setCotacoes(cotacoesRes.data || [])
    setSuporte(suporteRes.data || [])

    setCarregando(false)
  }

  function dataBR(data?: string | null) {
    if (!data) return '-'
    return new Date(data).toLocaleDateString('pt-BR')
  }

  const hoje = new Date()
  const mesAtual = hoje.getMonth()
  const anoAtual = hoje.getFullYear()

  const embarquesMes = embarques.filter((e) => {
    const dataBase = e.data_coleta || e.criado_em
    if (!dataBase) return false

    const data = new Date(dataBase)
    return data.getMonth() === mesAtual && data.getFullYear() === anoAtual
  })

  const ativos = embarques.filter((e) => e.status_operacional !== 'Entregue').length
  const transito = embarques.filter((e) => e.status_operacional === 'Em trânsito').length
  const fiscalizacao = embarques.filter((e) => e.status_operacional === 'Fiscalização').length
  const liberados = embarques.filter((e) => e.status_operacional === 'Liberado').length
  const entregues = embarques.filter((e) => e.status_operacional === 'Entregue').length

  const suporteAbertos = suporte.filter((s) => s.status === 'ABERTO').length
  const suporteAnalise = suporte.filter((s) => s.status === 'EM ANÁLISE').length
  const suporteRespondidos = suporte.filter((s) => s.status === 'RESPONDIDO').length
  const suporteResolvidos = suporte.filter((s) => s.status === 'RESOLVIDO').length
  const ultimoChamado = suporte[0]

  const cotacoesPendentes = cotacoes.filter(
    (c) =>
      c.status === 'AGUARDANDO ANÁLISE' ||
      c.status === 'EM ANÁLISE' ||
      c.status === 'AGUARDANDO TRANSPORTADORA'
  ).length

  const clientesAtivos = usuarios.filter((u) => u.ativo !== false).length

  const pesoTotal = embarques.reduce(
    (acc, item) => acc + Number(item.peso_taxado || item.peso_real || 0),
    0
  )

  const ultimosEmbarques = embarques.slice(0, 6)
  const ultimasCotacoes = cotacoes.slice(0, 5)

  const embarquesPorTransportadora = useMemo(() => {
    const mapa: any = {}

    embarques.forEach((e) => {
      const nome = e.transportadora || 'Não informado'
      mapa[nome] = (mapa[nome] || 0) + 1
    })

    return Object.entries(mapa)
      .map(([nome, total]) => ({ nome, total: Number(total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [embarques])

  const transportadorasAtivas = embarquesPorTransportadora.length

  const rankingClientes = useMemo(() => {
    const mapa: any = {}

    embarques.forEach((e) => {
      const cliente =
        e.importador ||
        e.exportador ||
        e.cliente_nome ||
        e.empresa_nome ||
        'Não informado'

      if (!mapa[cliente]) {
        mapa[cliente] = { nome: cliente, total: 0, peso: 0 }
      }

      mapa[cliente].total += 1
      mapa[cliente].peso += Number(e.peso_taxado || e.peso_real || 0)
    })

    return Object.values(mapa)
      .sort((a: any, b: any) => b.total - a.total)
      .slice(0, 5)
  }, [embarques])

  const atividadesRecentes = useMemo(() => {
    const atividades: any[] = []

    embarques.slice(0, 8).forEach((e) => {
      atividades.push({
        titulo: `Embarque ${e.awb || '-'} atualizado`,
        detalhe: `${e.transportadora || '-'} • ${e.status_operacional || '-'}`,
        data: e.ultima_atualizacao || e.data_coleta || e.criado_em,
        icone: '📦',
      })
    })

    cotacoes.slice(0, 5).forEach((c) => {
      atividades.push({
        titulo: 'Cotação recebida',
        detalhe: c.cliente_final || c.solicitante_email || 'Sem identificação',
        data: c.criado_em,
        icone: '📄',
      })
    })

    suporte.slice(0, 5).forEach((s) => {
      atividades.push({
        titulo: s.assunto || 'Chamado de suporte',
        detalhe: s.email || s.status || 'Cliente não informado',
        data: s.criado_em,
        icone: '🎧',
      })
    })

    return atividades
      .filter((a) => a.data)
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
      .slice(0, 8)
  }, [embarques, cotacoes, suporte])

  const embarquesPorTipo = useMemo(() => {
    const exportacao = embarques.filter((e) =>
      String(e.servico || '').toLowerCase().includes('export')
    ).length

    const importacao = embarques.filter((e) =>
      String(e.servico || '').toLowerCase().includes('import')
    ).length

    const outros = Math.max(embarques.length - exportacao - importacao, 0)

    return { exportacao, importacao, outros }
  }, [embarques])

  const graficoDias = useMemo(() => {
    const dias = Array.from({ length: 30 }).map((_, index) => {
      const data = new Date()
      data.setHours(0, 0, 0, 0)
      data.setDate(data.getDate() - (29 - index))

      const total = embarques.filter((e) => {
        const dataBase = e.data_coleta || e.criado_em
        if (!dataBase) return false

        const dataEmbarque = new Date(dataBase)
        dataEmbarque.setHours(0, 0, 0, 0)

        return dataEmbarque.getTime() === data.getTime()
      }).length

      return {
        dia: data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        total,
      }
    })

    return dias
  }, [embarques])

  const maiorDia = Math.max(...graficoDias.map((d) => d.total), 1)

  return (
    <main className="min-h-screen bg-[#020817] text-white">
      <section className="p-6 xl:p-10 overflow-auto">
        <header className="flex flex-col xl:flex-row justify-between gap-6 mb-8">
          <div>
            <p className="text-blue-400 font-bold mb-2">Visão geral operacional</p>
            <h1 className="text-5xl font-black">Dashboard Executivo</h1>
            <p className="text-slate-400 mt-3 text-lg">
              Acompanhe em tempo real toda a operação logística da HC Connect.
            </p>
          </div>

          <div className="flex gap-4 flex-wrap h-fit">
            <button
              onClick={atualizarDadosManual}
              className="bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold"
            >
              {carregando ? 'Atualizando...' : '↻ Atualizar dados'}
            </button>

            <a href="/admin/embarques" className="bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold">
              + Novo embarque
            </a>

            <a href="/admin/cotacoes" className="bg-slate-700 hover:bg-slate-600 px-6 py-4 rounded-2xl font-bold">
              Ver cotações
            </a>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-8 gap-5 mb-8">
          <KpiCard titulo="Embarques no mês" valor={embarquesMes.length} detalhe="Por coleta ou criação" icone="📦" cor="blue" />
          <KpiCard titulo="Em trânsito" valor={transito} detalhe="Em andamento" icone="🚚" cor="green" />
          <KpiCard titulo="Em fiscalização" valor={fiscalizacao} detalhe="Aguardando liberação" icone="🛃" cor="yellow" />
          <KpiCard titulo="Liberados" valor={liberados} detalhe="Prontos para seguir" icone="✅" cor="green" />
          <KpiCard titulo="Entregues" valor={entregues} detalhe="Concluídos" icone="📬" cor="blue" />
          <KpiCard titulo="Clientes ativos" valor={clientesAtivos} detalhe="Base ativa" icone="👥" cor="blue" />
          <KpiCard titulo="Peso movimentado" valor={`${pesoTotal.toFixed(2)} kg`} detalhe="Total apurado" icone="⚖️" cor="green" />
          <KpiCard titulo="Transportadoras" valor={transportadorasAtivas} detalhe="Em operação" icone="✈️" cor="blue" />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <div className="card">
            <div className="flex justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black">Embarques por dia</h2>
                <p className="text-slate-500 text-sm mt-1">Usando data de coleta real do rastreio</p>
              </div>
              <span className="text-slate-400 text-sm">Últimos 30 dias</span>
            </div>

            <div className="h-72 flex items-end gap-2 border-b border-blue-900 pb-4">
              {graficoDias.map((item, index) => (
                <div key={index} className="flex-1 flex flex-col items-center justify-end gap-2">
                  <div
                    className="w-full bg-blue-600 rounded-t-lg min-h-[6px]"
                    style={{ height: `${Math.max((item.total / maiorDia) * 220, 6)}px` }}
                    title={`${item.dia}: ${item.total} embarque(s)`}
                  />
                  {(index % 5 === 0 || index === graficoDias.length - 1) && (
                    <span className="text-[10px] text-slate-500 rotate-[-35deg] mt-2">
                      {item.dia}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-4 mt-6 text-center">
              <ResumoMini titulo="Total" valor={String(embarques.length)} />
              <ResumoMini titulo="Mês" valor={String(embarquesMes.length)} />
              <ResumoMini titulo="Peso total" valor={`${pesoTotal.toFixed(2)} kg`} />
              <ResumoMini titulo="Clientes" valor={String(clientesAtivos)} />
            </div>
          </div>

          <div className="card">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black">Últimos Embarques</h2>
              <a href="/admin/embarques" className="text-blue-400 font-bold">
                Ver todos
              </a>
            </div>

            <div className="overflow-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-blue-950">
                    <th className="pb-4">AWB</th>
                    <th className="pb-4">Exportador</th>
                    <th className="pb-4">Importador</th>
                    <th className="pb-4">Transportadora</th>
                    <th className="pb-4">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {ultimosEmbarques.map((item) => (
                    <tr key={item.id} className="border-b border-blue-950">
                      <td className="py-4 font-bold text-blue-400">{item.awb || '-'}</td>
                      <td className="py-4">{item.exportador || '-'}</td>
                      <td className="py-4">{item.importador || '-'}</td>
                      <td className="py-4">{item.transportadora || '-'}</td>
                      <td className="py-4">
                        <StatusPillDashboard status={item.status_operacional || '-'} />
                      </td>
                    </tr>
                  ))}

                  {ultimosEmbarques.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        Nenhum embarque encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <footer className="text-center text-slate-500 py-8">
          HC Connect © 2026 • Dashboard Executivo Operacional
        </footer>
      </section>
    </main>
  )
}

function KpiCard({ titulo, valor, detalhe, icone, cor }: any) {
  const corNumero =
    cor === 'green'
      ? 'text-emerald-400'
      : cor === 'yellow'
      ? 'text-yellow-400'
      : 'text-blue-400'

  return (
    <div className="bg-[#071225] border border-blue-900 rounded-3xl p-6 shadow-[0_0_25px_rgba(37,99,235,0.08)]">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-400 text-sm">{titulo}</p>
          <h2 className={`text-4xl font-black mt-4 ${corNumero}`}>{valor}</h2>
          <p className="text-slate-500 text-sm mt-2">{detalhe}</p>
        </div>

        <div className="text-4xl">{icone}</div>
      </div>
    </div>
  )
}

function StatusPillDashboard({ status }: any) {
  const s = String(status || '').toLowerCase()

  let classe = 'bg-slate-700 text-slate-200 border-slate-500'
  let icone = '⚪'

  if (s.includes('entregue') || s.includes('delivered')) {
    classe = 'bg-green-600/20 text-green-300 border-green-500'
    icone = '✅'
  } else if (s.includes('trânsito') || s.includes('transito') || s.includes('transit')) {
    classe = 'bg-blue-600/20 text-blue-300 border-blue-500'
    icone = '🚚'
  } else if (s.includes('fiscal') || s.includes('liberação') || s.includes('liberacao') || s.includes('clearance')) {
    classe = 'bg-yellow-500/20 text-yellow-300 border-yellow-500'
    icone = '🛃'
  } else if (s.includes('liberado') || s.includes('released')) {
    classe = 'bg-emerald-600/20 text-emerald-300 border-emerald-500'
    icone = '🟢'
  } else if (s.includes('coletado') || s.includes('coleta') || s.includes('picked')) {
    classe = 'bg-purple-600/20 text-purple-300 border-purple-500'
    icone = '📦'
  }

  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-black whitespace-nowrap ${classe}`}>
      <span>{icone}</span>
      {status || '-'}
    </span>
  )
}

function ResumoMini({ titulo, valor }: any) {
  return (
    <div>
      <h3 className="text-2xl font-black">{valor}</h3>
      <p className="text-slate-500 text-sm">{titulo}</p>
    </div>
  )
}