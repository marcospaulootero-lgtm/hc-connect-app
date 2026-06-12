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

  async function buscarDados() {
    setCarregando(true)

    const [perfisRes, embarquesRes, cotacoesRes, suporteRes] =
      await Promise.all([
        supabase.from('perfis').select('*').order('nome'),
        supabase.from('embarques').select('*').order('criado_em', { ascending: false }),
        supabase.from('cotacoes').select('*').order('criado_em', { ascending: false }),
        supabase.from('suporte').select('*').order('criado_em', { ascending: false }),
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
    if (!e.criado_em) return false
    const data = new Date(e.criado_em)
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
        mapa[cliente] = {
          nome: cliente,
          total: 0,
          peso: 0,
        }
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
        data: e.ultima_atualizacao || e.criado_em,
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
      data.setDate(data.getDate() - (29 - index))

      const total = embarques.filter((e) => {
        if (!e.criado_em) return false
        const criado = new Date(e.criado_em)
        return criado.toDateString() === data.toDateString()
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
              onClick={buscarDados}
              className="bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold"
            >
              {carregando ? 'Atualizando...' : '↻ Atualizar dados'}
            </button>

            <a
              href="/admin/embarques"
              className="bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold"
            >
              + Novo embarque
            </a>

            <a
              href="/admin/cotacoes"
              className="bg-slate-700 hover:bg-slate-600 px-6 py-4 rounded-2xl font-bold"
            >
              Ver cotações
            </a>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-8 gap-5 mb-8">
          <KpiCard titulo="Embarques no mês" valor={embarquesMes.length} detalhe="Total no período" icone="📦" cor="blue" />
          <KpiCard titulo="Em trânsito" valor={transito} detalhe="Em andamento" icone="🚚" cor="green" />
          <KpiCard titulo="Em fiscalização" valor={fiscalizacao} detalhe="Aguardando liberação" icone="🛃" cor="yellow" />
          <KpiCard titulo="Liberados" valor={liberados} detalhe="Prontos para seguir" icone="✅" cor="green" />
          <KpiCard titulo="Entregues" valor={entregues} detalhe="Concluídos" icone="📬" cor="blue" />
          <KpiCard titulo="Clientes ativos" valor={clientesAtivos} detalhe="Base ativa" icone="👥" cor="blue" />
          <KpiCard titulo="Peso movimentado" valor={`${pesoTotal.toFixed(2)} kg`} detalhe="Total apurado" icone="⚖️" cor="green" />
          <KpiCard titulo="Transportadoras" valor={transportadorasAtivas} detalhe="Em operação" icone="✈️" cor="blue" />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">🎧</span>
              <h2 className="text-2xl font-black">Central de Suporte</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-2 gap-3 mb-6">
              <MiniStatus titulo="Abertos" valor={suporteAbertos} cor="red" />
              <MiniStatus titulo="Em análise" valor={suporteAnalise} cor="yellow" />
              <MiniStatus titulo="Respondidos" valor={suporteRespondidos} cor="purple" />
              <MiniStatus titulo="Resolvidos" valor={suporteResolvidos} cor="green" />
            </div>

            <div className="border border-blue-900 rounded-2xl bg-[#020817] p-5">
              <div className="flex justify-between mb-3">
                <p className="font-black">Último chamado recebido</p>
                <a href="/admin/suporte" className="text-blue-400 font-bold text-sm">
                  Ver todos
                </a>
              </div>

              {ultimoChamado ? (
                <>
                  <p className="text-blue-400 font-bold">
                    {ultimoChamado.assunto || 'Chamado sem assunto'}
                  </p>
                  <p className="text-slate-400 text-sm mt-2">
                    {ultimoChamado.email || 'Cliente não informado'}
                  </p>
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-slate-500 text-sm">
                      {dataBR(ultimoChamado.criado_em)}
                    </span>
                    <span className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                      {ultimoChamado.status || 'ABERTO'}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-slate-500">Nenhum chamado recebido.</p>
              )}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">📦</span>
              <h2 className="text-2xl font-black">Operação HC</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <OperationCard titulo="Embarques ativos" valor={String(ativos)} cor="blue" />
              <OperationCard titulo="Em trânsito" valor={String(transito)} cor="green" />
              <OperationCard titulo="Fiscalização" valor={String(fiscalizacao)} cor="yellow" />
              <OperationCard titulo="Entregues" valor={String(entregues)} cor="blue" />
            </div>

            <a href="/admin/embarques" className="block text-blue-400 font-bold mt-6 text-right">
              Ver operação completa →
            </a>
          </div>

          <div className="card">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🚨</span>
                <h2 className="text-2xl font-black">Alertas Importantes</h2>
              </div>
              <span className="text-blue-400 font-bold text-sm">Hoje</span>
            </div>

            <div className="space-y-4">
              <AlertaPremium titulo="Embarques em fiscalização" valor={fiscalizacao} icone="⚠️" cor="yellow" />
              <AlertaPremium titulo="Chamados aguardando resposta" valor={suporteAbertos} icone="💬" cor="purple" />
              <AlertaPremium titulo="Cotações pendentes" valor={cotacoesPendentes} icone="📄" cor="blue" />
              <AlertaPremium titulo="Embarques ativos" valor={ativos} icone="📦" cor="green" />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <div className="card">
            <div className="flex justify-between mb-6">
              <h2 className="text-2xl font-black">Embarques por dia</h2>
              <span className="text-slate-400 text-sm">Últimos 30 dias</span>
            </div>

            <div className="h-72 flex items-end gap-2 border-b border-blue-900 pb-4">
              {graficoDias.map((item, index) => (
                <div key={index} className="flex-1 flex flex-col items-center justify-end gap-2">
                  <div
                    className="w-full bg-blue-600 rounded-t-lg min-h-[6px]"
                    style={{ height: `${Math.max((item.total / maiorDia) * 220, 6)}px` }}
                    title={`${item.dia}: ${item.total}`}
                  />
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
                        <span className="bg-blue-600 px-3 py-1 rounded-full text-xs font-bold">
                          {item.status_operacional || '-'}
                        </span>
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

        <section className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <h2 className="text-2xl font-black mb-6">Top Transportadoras</h2>

            <div className="space-y-5">
              {embarquesPorTransportadora.map((item: any) => (
                <div key={item.nome}>
                  <div className="flex justify-between mb-2">
                    <span>{item.nome}</span>
                    <span className="font-bold">{item.total}</span>
                  </div>

                  <div className="h-3 bg-[#020817] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600"
                      style={{
                        width: `${Math.min(
                          (item.total / Math.max(embarques.length, 1)) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="text-2xl font-black mb-6">Embarques por tipo</h2>

            <div className="space-y-4">
              <TipoLinha titulo="Exportação" valor={embarquesPorTipo.exportacao} total={embarques.length} />
              <TipoLinha titulo="Importação" valor={embarquesPorTipo.importacao} total={embarques.length} />
              <TipoLinha titulo="Outros" valor={embarquesPorTipo.outros} total={embarques.length} />
            </div>
          </div>

          <div className="card">
            <div className="flex justify-between mb-6">
              <h2 className="text-2xl font-black">Clientes</h2>
              <a href="/admin/usuarios" className="text-blue-400 font-bold text-sm">
                Ver todos
              </a>
            </div>

            <div className="space-y-5">
              <ClienteLinha titulo="Clientes ativos" valor={clientesAtivos} cor="blue" />
              <ClienteLinha titulo="Usuários admin" valor={usuarios.filter((u) => u.tipo_acesso === 'admin').length} cor="purple" />
              <ClienteLinha titulo="Clientes inativos" valor={usuarios.filter((u) => u.ativo === false).length} cor="red" />
            </div>
          </div>

          <div className="card">
            <div className="flex justify-between mb-6">
              <h2 className="text-2xl font-black">Peso movimentado</h2>
              <span className="text-blue-400 font-bold text-sm">Total</span>
            </div>

            <h3 className="text-4xl font-black text-blue-400 mb-3">
              {pesoTotal.toFixed(2)} kg
            </h3>

            <p className="text-slate-400 mb-6">
              Peso total apurado nos embarques cadastrados.
            </p>

            <div className="h-24 bg-blue-600/20 rounded-2xl overflow-hidden flex items-end">
              <div className="h-16 w-full bg-blue-600/50 rounded-t-[40%]" />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <div className="card">
            <h2 className="text-2xl font-black mb-6">🏆 Ranking de Clientes</h2>

            <div className="space-y-4">
              {rankingClientes.length === 0 ? (
                <p className="text-slate-500">Nenhum cliente no ranking ainda.</p>
              ) : (
                rankingClientes.map((cliente: any, index: number) => (
                  <div key={cliente.nome} className="flex justify-between items-center border-b border-blue-950 pb-4">
                    <div>
                      <p className="font-black">
                        {index + 1}º {cliente.nome}
                      </p>
                      <p className="text-slate-500 text-sm">
                        {cliente.peso.toFixed(2)} kg movimentados
                      </p>
                    </div>

                    <span className="bg-blue-600 px-4 py-2 rounded-full font-black">
                      {cliente.total}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="text-2xl font-black mb-6">⚡ Últimas Atividades HC</h2>

            <div className="space-y-4">
              {atividadesRecentes.length === 0 ? (
                <p className="text-slate-500">Nenhuma atividade recente.</p>
              ) : (
                atividadesRecentes.map((atividade, index) => (
                  <div key={index} className="flex gap-4 border-b border-blue-950 pb-4">
                    <div className="text-2xl">{atividade.icone}</div>

                    <div className="flex-1">
                      <p className="font-black">{atividade.titulo}</p>
                      <p className="text-slate-400 text-sm mt-1">
                        {atividade.detalhe}
                      </p>
                    </div>

                    <span className="text-slate-500 text-sm whitespace-nowrap">
                      {atividade.data
                        ? new Date(atividade.data).toLocaleString('pt-BR')
                        : '-'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <div className="card">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black">Últimas Cotações</h2>
              <a href="/admin/cotacoes" className="text-blue-400 font-bold">
                Ver todas
              </a>
            </div>

            <div className="space-y-4">
              {ultimasCotacoes.length === 0 ? (
                <p className="text-slate-500">Nenhuma cotação encontrada.</p>
              ) : (
                ultimasCotacoes.map((item) => (
                  <div key={item.id} className="flex justify-between items-center border-b border-blue-950 pb-4">
                    <div>
                      <p className="font-bold">
                        {item.cliente_final || item.solicitante_email || 'Sem identificação'}
                      </p>

                      <p className="text-slate-500 text-sm">
                        {item.criado_em ? new Date(item.criado_em).toLocaleString('pt-BR') : '-'}
                      </p>
                    </div>

                    <span className="bg-green-700 px-3 py-1 rounded-full text-xs font-bold">
                      {item.status || '-'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="text-2xl font-black mb-6">Resumo operacional</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ResumoBox titulo="Embarques ativos" valor={String(ativos)} />
              <ResumoBox titulo="Cotações pendentes" valor={String(cotacoesPendentes)} />
              <ResumoBox titulo="Chamados suporte" valor={String(suporte.length)} />
              <ResumoBox titulo="Transportadoras ativas" valor={String(transportadorasAtivas)} />
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

function MiniStatus({ titulo, valor, cor }: any) {
  const classes =
    cor === 'red'
      ? 'bg-red-600/20 text-red-400'
      : cor === 'yellow'
      ? 'bg-yellow-500/20 text-yellow-400'
      : cor === 'purple'
      ? 'bg-purple-600/20 text-purple-400'
      : 'bg-green-600/20 text-green-400'

  return (
    <div className={`rounded-2xl p-4 ${classes}`}>
      <h3 className="text-3xl font-black">{valor}</h3>
      <p className="font-bold mt-1">{titulo}</p>
    </div>
  )
}

function OperationCard({ titulo, valor, cor }: any) {
  const classe =
    cor === 'red'
      ? 'text-red-400'
      : cor === 'green'
      ? 'text-green-400'
      : cor === 'yellow'
      ? 'text-yellow-400'
      : 'text-blue-400'

  return (
    <div className="border border-blue-900 bg-[#020817] rounded-2xl p-5">
      <h3 className={`text-2xl font-black ${classe}`}>{valor}</h3>
      <p className="text-slate-400 mt-2">{titulo}</p>
    </div>
  )
}

function AlertaPremium({ titulo, valor, icone, cor }: any) {
  const classe =
    cor === 'red'
      ? 'bg-red-600'
      : cor === 'yellow'
      ? 'bg-yellow-500 text-black'
      : cor === 'purple'
      ? 'bg-purple-600'
      : cor === 'green'
      ? 'bg-green-600'
      : 'bg-blue-600'

  return (
    <div className="flex justify-between items-center border-b border-blue-950 pb-4">
      <div className="flex items-center gap-3">
        <span>{icone}</span>
        <p className="text-slate-300">{titulo}</p>
      </div>

      <span className={`px-4 py-2 rounded-full font-black ${classe}`}>
        {valor}
      </span>
    </div>
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

function TipoLinha({ titulo, valor, total }: any) {
  const percentual = total > 0 ? Math.round((valor / total) * 100) : 0

  return (
    <div>
      <div className="flex justify-between mb-2">
        <span>{titulo}</span>
        <span className="font-bold">
          {percentual}% ({valor})
        </span>
      </div>

      <div className="h-3 bg-[#020817] rounded-full overflow-hidden">
        <div className="h-full bg-purple-600" style={{ width: `${percentual}%` }} />
      </div>
    </div>
  )
}

function ClienteLinha({ titulo, valor, cor }: any) {
  const classe =
    cor === 'red'
      ? 'text-red-400'
      : cor === 'purple'
      ? 'text-purple-400'
      : 'text-blue-400'

  return (
    <div className="flex justify-between border-b border-blue-950 pb-3">
      <span className="text-slate-400">{titulo}</span>
      <strong className={classe}>{valor}</strong>
    </div>
  )
}

function ResumoBox({ titulo, valor }: any) {
  return (
    <div className="border border-blue-900 bg-[#020817] rounded-2xl p-5">
      <p className="text-slate-400">{titulo}</p>
      <h3 className="text-3xl font-black mt-2 text-blue-400">{valor}</h3>
    </div>
  )
}