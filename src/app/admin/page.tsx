'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function DashboardPage() {
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [embarques, setEmbarques] = useState<any[]>([])
  const [cotacoes, setCotacoes] = useState<any[]>([])
  const [faturas, setFaturas] = useState<any[]>([])
  const [suporte, setSuporte] = useState<any[]>([])
  const [usuarioLogado, setUsuarioLogado] = useState<any>(null)

  useEffect(() => {
    buscarDados()
  }, [])

  async function buscarDados() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      setUsuarioLogado(user)
    }

    const { data: perfis } = await supabase
      .from('perfis')
      .select('*')
      .order('nome')

    const { data: listaEmbarques } = await supabase
      .from('embarques')
      .select('*')
      .order('criado_em', { ascending: false })

    const { data: listaCotacoes } = await supabase
      .from('cotacoes')
      .select('*')
      .order('criado_em', { ascending: false })

    const { data: listaFaturas } = await supabase
      .from('faturas')
      .select('*')
      .order('criado_em', { ascending: false })

    const { data: listaSuporte } = await supabase
      .from('suporte')
      .select('*')
      .order('criado_em', { ascending: false })

    setUsuarios(perfis || [])
    setEmbarques(listaEmbarques || [])
    setCotacoes(listaCotacoes || [])
    setFaturas(listaFaturas || [])
    setSuporte(listaSuporte || [])
  }

  const cotacoesPendentes = cotacoes.filter(
    (c) =>
      c.status === 'AGUARDANDO ANÁLISE' ||
      c.status === 'EM ANÁLISE' ||
      c.status === 'AGUARDANDO TRANSPORTADORA'
  ).length

  const cotacoesRespondidas = cotacoes.filter(
    (c) =>
      c.status === 'COTAÇÃO DISPONÍVEL' ||
      c.status === 'APROVADA' ||
      c.status === 'CONVERTIDA EM EMBARQUE'
  ).length

  const cotacoesAprovadas = cotacoes.filter(
    (c) =>
      c.status === 'APROVADA' ||
      c.status === 'CONVERTIDA EM EMBARQUE'
  ).length

  const embarquesEmTransito = embarques.filter(
    (e) =>
      e.status_operacional === 'Em trânsito' ||
      e.status_operacional === 'EM TRÂNSITO'
  ).length

  const embarquesEntregues = embarques.filter(
    (e) =>
      e.status_operacional === 'Entregue' ||
      e.status_operacional === 'ENTREGUE'
  ).length

  const pdfsEnviados = cotacoes.filter((c) => c.pdf_cotacao_url).length

  const ultimasCotacoes = cotacoes.slice(0, 5)
  const ultimosEmbarques = embarques.slice(0, 5)

  const topClientes = useMemo(() => {
    const mapa: any = {}

    cotacoes.forEach((c) => {
      const nome = c.cliente_final || c.solicitante_email || 'Sem identificação'
      mapa[nome] = (mapa[nome] || 0) + 1
    })

    return Object.entries(mapa)
      .map(([nome, total]) => ({ nome, total }))
      .sort((a: any, b: any) => b.total - a.total)
      .slice(0, 5)
  }, [cotacoes])

  const cotacoesPorMes = useMemo(() => {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const atual = new Date().getMonth()

    return meses.map((mes, index) => {
      const total = cotacoes.filter((c) => {
        if (!c.criado_em) return false
        const data = new Date(c.criado_em)
        return data.getMonth() === index
      }).length

      return {
        mes,
        total,
        ativo: index <= atual,
      }
    })
  }, [cotacoes])

  function statusClasse(status: string) {
    if (status === 'AGUARDANDO ANÁLISE') return 'bg-yellow-400 text-black'
    if (status === 'EM ANÁLISE') return 'bg-blue-600 text-white'
    if (status === 'AGUARDANDO TRANSPORTADORA') return 'bg-purple-600 text-white'
    if (status === 'COTAÇÃO DISPONÍVEL') return 'bg-emerald-600 text-white'
    if (status === 'APROVADA') return 'bg-green-700 text-white'
    if (status === 'RECUSADA') return 'bg-red-600 text-white'
    if (status === 'CONVERTIDA EM EMBARQUE') return 'bg-slate-700 text-white'

    return 'bg-slate-600 text-white'
  }

  function maiorValorGrafico() {
    const maior = Math.max(...cotacoesPorMes.map((m) => m.total))
    return maior || 1
  }

  return (
    <main className="p-8 w-full bg-[#020817] min-h-screen text-white">
      <div className="max-w-[1600px] mx-auto">

        <header className="flex justify-between items-start gap-6 mb-8">
          <div>
            <h1 className="text-5xl font-black">
              Dashboard
            </h1>

            <p className="text-slate-400 mt-2 text-lg">
              Visão geral do sistema
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:block border border-blue-900 bg-[#071225] rounded-2xl px-5 py-3 text-slate-300">
              01/05/2026 - 07/06/2026
            </div>

            <div className="flex items-center gap-3 border border-blue-900 bg-[#071225] rounded-2xl px-5 py-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-black">
                {usuarioLogado?.email?.charAt(0) || 'A'}
              </div>

              <div>
                <p className="font-bold">
                  {usuarioLogado?.email || 'Admin'}
                </p>

                <span className="text-xs bg-blue-600 px-2 py-1 rounded-full font-bold">
                  ADMIN
                </span>
              </div>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-5 mb-6">
          <KpiCard titulo="Usuários" valor={usuarios.length} descricao="Total cadastrados" icone="👥" cor="blue" />
          <KpiCard titulo="Embarques" valor={embarques.length} descricao="Total cadastrados" icone="📦" cor="blue" />
          <KpiCard titulo="Em trânsito" valor={embarquesEmTransito} descricao="Em andamento" icone="🚚" cor="blue" />
          <KpiCard titulo="Cotações pendentes" valor={cotacoesPendentes} descricao="Aguardando análise" icone="📄" cor="yellow" />
          <KpiCard titulo="Cotações respondidas" valor={cotacoesRespondidas} descricao="Com resposta" icone="✅" cor="green" />
          <KpiCard titulo="Cotações aprovadas" valor={cotacoesAprovadas} descricao="Aprovadas pelos clientes" icone="👍" cor="green" />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          <div className="card">
            <h2 className="text-2xl font-black mb-6">
              Cotações por status
            </h2>

            <div className="flex flex-col lg:flex-row items-center gap-8">
              <Donut total={cotacoes.length} />

              <div className="space-y-3 w-full">
                <Legenda cor="bg-yellow-400" texto="Aguardando análise" valor={cotacoes.filter((c) => c.status === 'AGUARDANDO ANÁLISE').length} total={cotacoes.length} />
                <Legenda cor="bg-blue-600" texto="Em análise" valor={cotacoes.filter((c) => c.status === 'EM ANÁLISE').length} total={cotacoes.length} />
                <Legenda cor="bg-purple-600" texto="Aguardando transportadora" valor={cotacoes.filter((c) => c.status === 'AGUARDANDO TRANSPORTADORA').length} total={cotacoes.length} />
                <Legenda cor="bg-emerald-600" texto="Disponível" valor={cotacoes.filter((c) => c.status === 'COTAÇÃO DISPONÍVEL').length} total={cotacoes.length} />
                <Legenda cor="bg-green-700" texto="Aprovada" valor={cotacoesAprovadas} total={cotacoes.length} />
                <Legenda cor="bg-red-600" texto="Recusada" valor={cotacoes.filter((c) => c.status === 'RECUSADA').length} total={cotacoes.length} />
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-2xl font-black mb-6">
              Embarques por status
            </h2>

            <div className="flex flex-col lg:flex-row items-center gap-8">
              <Donut total={embarques.length} />

              <div className="space-y-3 w-full">
                <Legenda cor="bg-blue-600" texto="Em trânsito" valor={embarquesEmTransito} total={embarques.length} />
                <Legenda cor="bg-emerald-600" texto="Entregue" valor={embarquesEntregues} total={embarques.length} />
                <Legenda cor="bg-yellow-400" texto="Aguardando AWB" valor={embarques.filter((e) => e.status_operacional === 'Aguardando AWB').length} total={embarques.length} />
                <Legenda cor="bg-red-600" texto="Cancelado" valor={embarques.filter((e) => e.status_operacional === 'Cancelado').length} total={embarques.length} />
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-2xl font-black mb-6">
              Cotações por mês
            </h2>

            <div className="h-64 flex items-end gap-4 border-l border-b border-blue-900 px-5 pt-6">
              {cotacoesPorMes.slice(0, 6).map((item) => (
                <div key={item.mes} className="flex-1 flex flex-col items-center gap-3">
                  <div
                    className="w-full rounded-t-xl bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.45)]"
                    style={{
                      height: `${Math.max((item.total / maiorValorGrafico()) * 190, item.total > 0 ? 18 : 4)}px`,
                    }}
                  />
                  <span className="text-slate-400 text-sm">
                    {item.mes}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          <div className="card">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-2xl font-black">
                Últimas cotações recebidas
              </h2>

              <a href="/admin/cotacoes" className="text-blue-400 font-bold">
                Ver todas
              </a>
            </div>

            <div className="space-y-4">
              {ultimasCotacoes.length === 0 ? (
                <p className="text-slate-500">Nenhuma cotação cadastrada.</p>
              ) : (
                ultimasCotacoes.map((item) => (
                  <div key={item.id} className="flex justify-between gap-4 border-b border-blue-950 pb-4">
                    <div>
                      <p className="font-bold">
                        {item.cliente_final || item.solicitante_email || 'Sem cliente'}
                      </p>

                      <p className="text-slate-400 text-sm">
                        {item.criado_em ? new Date(item.criado_em).toLocaleString('pt-BR') : '-'}
                      </p>
                    </div>

                    <span className={`px-3 py-1 h-fit rounded-lg text-xs font-black ${statusClasse(item.status)}`}>
                      {item.status || '-'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-2xl font-black">
                Últimos embarques
              </h2>

              <a href="/admin/embarques" className="text-blue-400 font-bold">
                Ver todos
              </a>
            </div>

            <div className="space-y-4">
              {ultimosEmbarques.length === 0 ? (
                <p className="text-slate-500">Nenhum embarque cadastrado.</p>
              ) : (
                ultimosEmbarques.map((item) => (
                  <div key={item.id} className="flex justify-between gap-4 border-b border-blue-950 pb-4">
                    <div>
                      <p className="font-bold">
                        AWB {item.awb || 'AGUARDANDO'}
                      </p>

                      <p className="text-slate-400 text-sm">
                        {item.origem || '-'} → {item.destino || '-'}
                      </p>
                    </div>

                    <span className="px-3 py-1 h-fit rounded-lg text-xs font-black bg-emerald-700 text-white">
                      {item.status_operacional || '-'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-2xl font-black">
                Top clientes
              </h2>

              <a href="/admin/usuarios" className="text-blue-400 font-bold">
                Ver todos
              </a>
            </div>

            <div className="space-y-4">
              {topClientes.length === 0 ? (
                <p className="text-slate-500">Nenhum cliente encontrado.</p>
              ) : (
                topClientes.map((item: any, index) => (
                  <div key={item.nome} className="flex justify-between items-center border-b border-blue-950 pb-4">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-[#0f1b34] border border-blue-900 flex items-center justify-center font-black">
                        {index + 1}
                      </span>

                      <p className="font-bold">
                        {item.nome}
                      </p>
                    </div>

                    <p className="text-blue-400 text-2xl font-black">
                      {String(item.total)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5">
          <MiniCard titulo="Cotações aguardando análise" valor={cotacoes.filter((c) => c.status === 'AGUARDANDO ANÁLISE').length} descricao="Solicitações na fila" cor="red" />
          <MiniCard titulo="Aprovações de hoje" valor={cotacoesAprovadas} descricao="Cotações aprovadas" cor="green" />
          <MiniCard titulo="Embarques em atraso" valor={0} descricao="Requer atenção" cor="yellow" />
          <MiniCard titulo="PDFs enviados" valor={pdfsEnviados} descricao="Arquivos de cotação" cor="purple" />
          <MiniCard titulo="Chamados suporte" valor={suporte.length} descricao="Total cadastrados" cor="blue" />
        </section>

        <footer className="text-center text-slate-500 mt-10">
          HC Connect © 2026 - Todos os direitos reservados.
        </footer>
      </div>
    </main>
  )
}

function KpiCard({ titulo, valor, descricao, icone, cor }: any) {
  const corTexto =
    cor === 'green'
      ? 'text-emerald-400'
      : cor === 'yellow'
        ? 'text-yellow-400'
        : 'text-blue-400'

  return (
    <div className="border border-blue-900 rounded-3xl bg-[#071225] p-6 shadow-[0_0_30px_rgba(37,99,235,0.08)]">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-300 text-lg">
            {titulo}
          </p>

          <h2 className={`text-5xl font-black mt-4 ${corTexto}`}>
            {valor}
          </h2>

          <p className="text-slate-400 mt-2">
            {descricao}
          </p>
        </div>

        <div className="text-4xl">
          {icone}
        </div>
      </div>
    </div>
  )
}

function Donut({ total }: any) {
  return (
    <div className="w-52 h-52 rounded-full flex items-center justify-center bg-[conic-gradient(#facc15_0_8%,#2563eb_8%_25%,#7c3aed_25%_38%,#10b981_38%_78%,#ef4444_78%_84%,#14b8a6_84%_100%)]">
      <div className="w-32 h-32 rounded-full bg-[#071225] flex flex-col items-center justify-center">
        <p className="text-4xl font-black">
          {total}
        </p>
        <p className="text-slate-300">
          Total
        </p>
      </div>
    </div>
  )
}

function Legenda({ cor, texto, valor, total }: any) {
  const percentual = total > 0 ? ((valor / total) * 100).toFixed(1) : '0'

  return (
    <div className="flex justify-between gap-4 text-sm">
      <div className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${cor}`} />
        <span className="text-slate-300">
          {texto}
        </span>
      </div>

      <span className="text-slate-400">
        {valor} ({percentual}%)
      </span>
    </div>
  )
}

function MiniCard({ titulo, valor, descricao, cor }: any) {
  const barra =
    cor === 'red'
      ? 'bg-red-500'
      : cor === 'green'
        ? 'bg-emerald-500'
        : cor === 'yellow'
          ? 'bg-yellow-500'
          : cor === 'purple'
            ? 'bg-purple-500'
            : 'bg-blue-500'

  return (
    <div className="border border-blue-900 rounded-3xl bg-[#071225] p-6">
      <p className="text-slate-300">
        {titulo}
      </p>

      <h2 className="text-4xl font-black mt-3">
        {valor}
      </h2>

      <p className="text-slate-400 mt-2">
        {descricao}
      </p>

      <div className="h-2 bg-[#020817] rounded-full mt-5 overflow-hidden">
        <div className={`h-full w-4/5 ${barra}`} />
      </div>
    </div>
  )
}