'use client'

import { useEffect, useState } from 'react'
import DashboardCard from '@/components/DashboardCard'
import { supabase } from '@/lib/supabaseClient'

export default function DashboardPage() {
  const [clientes, setClientes] = useState(0)
  const [embarques, setEmbarques] = useState(0)
  const [faturas, setFaturas] = useState(0)
  const [suporte, setSuporte] = useState(0)

  useEffect(() => {
    buscarDados()
  }, [])

  async function buscarDados() {
    const { count: totalClientes } = await supabase
      .from('empresas')
      .select('*', { count: 'exact', head: true })

    const { count: totalEmbarques } = await supabase
      .from('embarques')
      .select('*', { count: 'exact', head: true })

    const { count: totalFaturas } = await supabase
      .from('faturas')
      .select('*', { count: 'exact', head: true })

    const { count: totalSuporte } = await supabase
      .from('suporte')
      .select('*', { count: 'exact', head: true })

    setClientes(totalClientes || 0)
    setEmbarques(totalEmbarques || 0)
    setFaturas(totalFaturas || 0)
    setSuporte(totalSuporte || 0)
  }

  return (
    <main className="p-10 w-full bg-[#020817] min-h-screen text-white">
      <div className="mb-10">
        <h1 className="text-5xl font-black">
          Dashboard
        </h1>

        <p className="text-slate-400 mt-2 text-lg">
          Painel administrativo HC Connect
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <DashboardCard
          titulo="Clientes"
          valor={String(clientes)}
          descricao="Clientes cadastrados"
        />

        <DashboardCard
          titulo="Embarques"
          valor={String(embarques)}
          descricao="Processos ativos"
        />

        <DashboardCard
          titulo="Faturas"
          valor={String(faturas)}
          descricao="Faturas cadastradas"
        />

        <DashboardCard
          titulo="Suporte"
          valor={String(suporte)}
          descricao="Chamados abertos"
        />
      </section>

      <section className="mt-10 border border-blue-900 rounded-3xl p-8 bg-[#071225]">
        <h2 className="text-3xl font-black mb-4">
          Bem-vindo ao HC Connect
        </h2>

        <p className="text-slate-400 text-lg leading-8">
          Plataforma operacional da HC Consultoria para controle de
          embarques, clientes, documentos, faturamento e suporte.
        </p>
      </section>
    </main>
  )
}