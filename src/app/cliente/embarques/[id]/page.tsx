'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useParams } from 'next/navigation'
import Header from '@/components/Header'
import StatusBadge from '@/components/StatusBadge'

type Documento = {
  id: string
  nome: string
  url: string
}

type TimelineItem = {
  id: string
  titulo: string
  descricao: string
  created_at: string
}

export default function DetalheCliente() {
  const params = useParams()

  const [embarque, setEmbarque] = useState<any>(null)
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [timeline, setTimeline] = useState<TimelineItem[]>([])

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    const { data } = await supabase
      .from('embarques')
      .select(`
        *,
        empresas (
          razao_social
        )
      `)
      .eq('id', params.id)
      .single()

    setEmbarque(data)

    const { data: docs } = await supabase
      .from('documentos_embarque')
      .select('*')
      .eq('embarque_id', params.id)
      .order('created_at', { ascending: false })

    setDocumentos(docs || [])

    const { data: timelineData } = await supabase
      .from('timeline_embarques')
      .select('*')
      .eq('embarque_id', params.id)
      .order('created_at', { ascending: false })

    setTimeline(timelineData || [])
  }

  if (!embarque) {
    return (
      <main className="min-h-screen bg-[#020817] text-white p-10">
        Carregando...
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#020817] text-white">
      <Header area="cliente" />

      <div className="max-w-7xl mx-auto p-8">

        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="text-5xl font-black text-blue-400">
              AWB {embarque.awb}
            </h1>

            <p className="text-slate-400 mt-3 text-lg">
              Acompanhamento operacional do embarque
            </p>
          </div>

          <StatusBadge status={embarque.status_operacional} />
        </div>

        <section className="card mb-8">
          <h2 className="text-2xl font-black mb-8">
            Dados do embarque
          </h2>

          <div className="grid md:grid-cols-3 gap-6">

            <div>
              <p className="text-slate-500 text-sm">
                Cliente
              </p>

              <p className="text-xl font-semibold mt-1">
                {embarque.empresas?.razao_social}
              </p>
            </div>

            <div>
              <p className="text-slate-500 text-sm">
                Transportadora
              </p>

              <p className="text-xl font-semibold mt-1">
                {embarque.transportadora}
              </p>
            </div>

            <div>
              <p className="text-slate-500 text-sm">
                Serviço
              </p>

              <p className="text-xl font-semibold mt-1">
                {embarque.servico}
              </p>
            </div>

            <div>
              <p className="text-slate-500 text-sm">
                Origem
              </p>

              <p className="text-xl font-semibold mt-1">
                {embarque.origem}
              </p>
            </div>

            <div>
              <p className="text-slate-500 text-sm">
                Destino
              </p>

              <p className="text-xl font-semibold mt-1">
                {embarque.destino}
              </p>
            </div>

            <div>
              <p className="text-slate-500 text-sm">
                Peso taxado
              </p>

              <p className="text-xl font-semibold mt-1">
                {embarque.peso_taxado} kg
              </p>
            </div>

          </div>
        </section>

        <section className="card mb-8">
          <h2 className="text-2xl font-black mb-8">
            Timeline operacional
          </h2>

          <div className="space-y-4">

            {timeline.length === 0 && (
              <p className="text-slate-500">
                Nenhuma atualização disponível.
              </p>
            )}

            {timeline.map((item) => (
              <div
                key={item.id}
                className="border border-blue-900 rounded-2xl p-5 bg-[#020f2c]"
              >
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="font-bold text-lg">
                      {item.titulo}
                    </h3>

                    <p className="text-slate-400 mt-2">
                      {item.descricao}
                    </p>
                  </div>

                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {new Date(item.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            ))}

          </div>
        </section>

        <section className="card">
          <h2 className="text-2xl font-black mb-8">
            Documentos
          </h2>

          <div className="space-y-4">

            {documentos.length === 0 && (
              <p className="text-slate-500">
                Nenhum documento disponível.
              </p>
            )}

            {documentos.map((doc) => (
              <a
                key={doc.id}
                href={doc.url}
                target="_blank"
                className="flex items-center justify-between border border-blue-900 rounded-2xl p-5 hover:border-blue-500 transition"
              >
                <div>
                  <h3 className="font-bold">
                    {doc.nome}
                  </h3>

                  <p className="text-slate-500 text-sm mt-1">
                    Clique para visualizar
                  </p>
                </div>

                <span className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-bold">
                  DISPONÍVEL
                </span>
              </a>
            ))}

          </div>
        </section>

      </div>
    </main>
  )
}