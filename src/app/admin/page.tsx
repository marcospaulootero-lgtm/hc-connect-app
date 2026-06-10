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

    setUsuarioLogado(user)

    const { data: perfis } = await supabase.from('perfis').select('*').order('nome')
    const { data: listaEmbarques } = await supabase.from('embarques').select('*').order('criado_em', { ascending: false })
    const { data: listaCotacoes } = await supabase.from('cotacoes').select('*').order('criado_em', { ascending: false })
    const { data: listaFaturas } = await supabase.from('faturas').select('*').order('criado_em', { ascending: false })
    const { data: listaSuporte } = await supabase.from('suporte').select('*').order('criado_em', { ascending: false })

    setUsuarios(perfis || [])
    setEmbarques(listaEmbarques || [])
    setCotacoes(listaCotacoes || [])
    setFaturas(listaFaturas || [])
    setSuporte(listaSuporte || [])
  }

  const ativos = embarques.filter((e) => e.status_operacional !== 'Entregue').length
  const transito = embarques.filter((e) => e.status_operacional === 'Em trânsito').length
  const fiscalizacao = embarques.filter((e) => e.status_operacional === 'Fiscalização').length
  const liberados = embarques.filter((e) => e.status_operacional === 'Liberado').length
  const entregues = embarques.filter((e) => e.status_operacional === 'Entregue').length

  const cotacoesPendentes = cotacoes.filter(
    (c) =>
      c.status === 'AGUARDANDO ANÁLISE' ||
      c.status === 'EM ANÁLISE' ||
      c.status === 'AGUARDANDO TRANSPORTADORA'
  ).length

  const faturasVisiveis = faturas.filter((f) => f.visivel_cliente === true).length

  const ultimosEmbarques = embarques.slice(0, 8)
  const ultimasCotacoes = cotacoes.slice(0, 6)

  const embarquesPorTransportadora = useMemo(() => {
    const mapa: any = {}

    embarques.forEach((e) => {
      const nome = e.transportadora || 'Não informado'
      mapa[nome] = (mapa[nome] || 0) + 1
    })

    return Object.entries(mapa)
      .map(([nome, total]) => ({ nome, total }))
      .sort((a: any, b: any) => b.total - a.total)
      .slice(0, 5)
  }, [embarques])

  return (
    <main className="min-h-screen bg-[#020817] text-white">
     

      <section className="p-6 xl:p-10 overflow-auto">
        <header className="flex flex-col lg:flex-row justify-between gap-6 mb-8">
          <div>
            <p className="text-blue-400 font-bold mb-2">Visão operacional</p>
            <h1 className="text-5xl font-black">Dashboard</h1>
            <p className="text-slate-400 mt-3 text-lg">
              Controle central de embarques, cotações, faturas e clientes.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <a href="/admin/embarques" className="bg-blue-600 hover:bg-blue-500 px-5 py-4 rounded-2xl font-bold text-center">
              + Novo embarque
            </a>

            <a href="/admin/cotacoes" className="bg-slate-700 hover:bg-slate-600 px-5 py-4 rounded-2xl font-bold text-center">
              Ver cotações
            </a>
          </div>
        </header>
                <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5 mb-8">
          <DashboardCard
            titulo="Embarques Ativos"
            valor={ativos}
            icone="📦"
            cor="blue"
          />

          <DashboardCard
            titulo="Em Trânsito"
            valor={transito}
            icone="🚚"
            cor="green"
          />

          <DashboardCard
            titulo="Fiscalização"
            valor={fiscalizacao}
            icone="🛃"
            cor="yellow"
          />

          <DashboardCard
            titulo="Liberados"
            valor={liberados}
            icone="✅"
            cor="green"
          />

          <DashboardCard
            titulo="Entregues"
            valor={entregues}
            icone="📬"
            cor="blue"
          />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <h2 className="text-2xl font-black mb-6">
              Alertas Operacionais
            </h2>

            <div className="space-y-4">

              <Alerta
                cor="yellow"
                titulo="Cotações Pendentes"
                valor={cotacoesPendentes}
              />

              <Alerta
                cor="green"
                titulo="Faturas Disponíveis"
                valor={faturasVisiveis}
              />

              <Alerta
                cor="blue"
                titulo="Chamados de Suporte"
                valor={suporte.length}
              />

            </div>
          </div>

          <div className="card xl:col-span-2">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black">
                Últimos Embarques
              </h2>

              <a
                href="/admin/embarques"
                className="text-blue-400 font-bold"
              >
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
                    <tr
                      key={item.id}
                      className="border-b border-blue-950"
                    >
                      <td className="py-4 font-bold">
                        {item.awb || '-'}
                      </td>

                      <td className="py-4">
                        {item.exportador || '-'}
                      </td>

                      <td className="py-4">
                        {item.importador || '-'}
                      </td>

                      <td className="py-4">
                        {item.transportadora || '-'}
                      </td>

                      <td className="py-4">
                        <span className="bg-blue-600 px-3 py-1 rounded-full text-xs font-bold">
                          {item.status_operacional || '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">

          <div className="card">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black">
                Últimas Cotações
              </h2>

              <a
                href="/admin/cotacoes"
                className="text-blue-400 font-bold"
              >
                Ver todas
              </a>
            </div>

            <div className="space-y-4">

              {ultimasCotacoes.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center border-b border-blue-950 pb-4"
                >
                  <div>
                    <p className="font-bold">
                      {item.cliente_final ||
                        item.solicitante_email ||
                        'Sem identificação'}
                    </p>

                    <p className="text-slate-500 text-sm">
                      {item.criado_em
                        ? new Date(
                            item.criado_em
                          ).toLocaleString('pt-BR')
                        : '-'}
                    </p>
                  </div>

                  <span className="bg-green-700 px-3 py-1 rounded-full text-xs font-bold">
                    {item.status || '-'}
                  </span>
                </div>
              ))}

            </div>
          </div>

          <div className="card">
            <h2 className="text-2xl font-black mb-6">
              Top Transportadoras
            </h2>

            <div className="space-y-5">

              {embarquesPorTransportadora.map((item: any) => (
                <div key={item.nome}>
                  <div className="flex justify-between mb-2">
                    <span>{item.nome}</span>

                    <span className="font-bold">
                      {String(item.total)}
                    </span>
                  </div>

                  <div className="h-3 bg-[#020817] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600"
                      style={{
                        width: `${Math.min(
                          (item.total / embarques.length) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}

            </div>
          </div>

        </section>
                <footer className="text-center text-slate-500 py-8">
          HC Connect © 2026 • Dashboard Operacional
        </footer>
      </section>
    </main>
  )
}



function DashboardCard({
  titulo,
  valor,
  icone,
  cor,
}: any) {
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
          <p className="text-slate-400 text-sm">
            {titulo}
          </p>

          <h2
            className={`text-5xl font-black mt-4 ${corNumero}`}
          >
            {valor}
          </h2>
        </div>

        <div className="text-4xl">
          {icone}
        </div>
      </div>
    </div>
  )
}

function Alerta({
  titulo,
  valor,
  cor,
}: any) {
  const classe =
    cor === 'green'
      ? 'bg-emerald-600'
      : cor === 'yellow'
      ? 'bg-yellow-500 text-black'
      : 'bg-blue-600'

  return (
    <div className="flex justify-between items-center border border-blue-900 rounded-2xl p-4">
      <div>
        <p className="text-slate-300">
          {titulo}
        </p>
      </div>

      <span
        className={`px-4 py-2 rounded-full font-black ${classe}`}
      >
        {valor}
      </span>
    </div>
  )
}