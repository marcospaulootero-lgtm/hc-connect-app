'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function FaturasClientePage() {
  const [faturas, setFaturas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    carregarUsuario()
  }, [])

  async function carregarUsuario() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/login'
      return
    }

    carregarFaturas(user.id)
  }

  async function carregarFaturas(usuarioId: string) {
    setLoading(true)

    const { data: diretos } = await supabase
      .from('embarques')
      .select('id')
      .eq('usuario_id', usuarioId)

    const { data: vinculos } = await supabase
      .from('embarque_clientes')
      .select('embarque_id')
      .eq('cliente_id', usuarioId)

    const idsDiretos = (diretos || []).map((e) => e.id)
    const idsVinculados = (vinculos || []).map((v) => v.embarque_id)
    const ids = Array.from(new Set([...idsDiretos, ...idsVinculados]))

    if (ids.length === 0) {
      setFaturas([])
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('faturas')
      .select(`
        id,
        embarque_id,
        usuario_id,
        arquivo_pdf,
        recibo_pdf,
        recibo_nome,
        criado_em,
        visivel_cliente,
        embarques (
          id,
          awb,
          cliente_final,
          exportador,
          importador,
          transportadora,
          status_operacional
        )
      `)
      .in('embarque_id', ids)
      .eq('visivel_cliente', true)
      .order('criado_em', { ascending: false })

    if (error) {
      console.log('ERRO FATURAS:', error)
    }

    setFaturas(data || [])
    setLoading(false)
  }

  function dadosEmbarque(fatura: any) {
    if (Array.isArray(fatura.embarques)) return fatura.embarques[0] || {}
    return fatura.embarques || {}
  }

  function dataBR(data?: string | null) {
    if (!data) return '-'
    return new Date(data).toLocaleDateString('pt-BR')
  }

  const faturasFiltradas = useMemo(() => {
    return faturas.filter((fatura) => {
      const emb = dadosEmbarque(fatura)

      const texto = `
        ${emb.awb || ''}
        ${emb.cliente_final || ''}
        ${emb.exportador || ''}
        ${emb.importador || ''}
        ${emb.transportadora || ''}
        ${emb.status_operacional || ''}
      `.toLowerCase()

      return texto.includes(busca.toLowerCase())
    })
  }, [faturas, busca])

  const totalFaturas = faturas.length
  const totalRecibos = faturas.filter((f) => f.recibo_pdf).length
  const totalSemRecibo = faturas.filter((f) => !f.recibo_pdf).length
  const embarquesComFatura = new Set(faturas.map((f) => f.embarque_id).filter(Boolean)).size

  return (
    <main className="min-h-screen bg-[#020817] text-white p-6 lg:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col lg:flex-row justify-between gap-6">
          <div>
            <p className="text-blue-400 font-bold mb-2">Documentos</p>
            <h1 className="text-5xl font-black mb-2">Faturas e recibos</h1>
            <p className="text-slate-400 text-lg">
              Consulte os PDFs liberados pela HC para os seus embarques.
            </p>
          </div>

          <a
            href="/cliente"
            className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl text-white font-bold h-fit"
          >
            Voltar ao portal
          </a>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
          <Card titulo="Faturas disponíveis" valor={totalFaturas} detalhe="PDFs liberados" icone="📄" />
          <Card titulo="Recibos disponíveis" valor={totalRecibos} detalhe="PDFs liberados" icone="🧾" />
          <Card titulo="Aguardando recibo" valor={totalSemRecibo} detalhe="Documento ainda não anexado" icone="⏳" />
          <Card titulo="Embarques com fatura" valor={embarquesComFatura} detalhe="Processos relacionados" icone="📦" />
        </section>

        <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
          <div className="flex flex-col lg:flex-row justify-between gap-5 mb-7">
            <div>
              <h2 className="text-2xl font-black">Documentos de faturamento</h2>
              <p className="text-slate-400 text-sm">
                Esta tela mostra somente faturas e recibos anexados. Valores, vencimentos e pagamentos são controlados pela HC no Financeiro.
              </p>
            </div>

            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por AWB, cliente, transportadora..."
              className="lg:max-w-md"
            />
          </div>

          {loading ? (
            <div className="border border-blue-900 bg-[#020817] rounded-2xl p-6 text-slate-400">
              Carregando documentos...
            </div>
          ) : faturasFiltradas.length === 0 ? (
            <div className="border border-blue-900 bg-[#020817] rounded-2xl p-6 text-slate-400">
              Nenhuma fatura disponível.
            </div>
          ) : (
            <div className="space-y-5">
              {faturasFiltradas.map((fatura) => {
                const embarque = dadosEmbarque(fatura)

                return (
                  <article
                    key={fatura.id}
                    className="border border-blue-900 rounded-3xl bg-[#020817] p-6"
                  >
                    <div className="flex flex-col xl:flex-row justify-between gap-6">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                          <h3 className="text-3xl font-black text-blue-400">
                            AWB {embarque?.awb || '-'}
                          </h3>

                          <StatusDocumento temRecibo={!!fatura.recibo_pdf} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Info label="Transportadora" valor={embarque?.transportadora || '-'} />
                          <Info label="Status embarque" valor={embarque?.status_operacional || '-'} />
                          <Info label="Fatura publicada em" valor={dataBR(fatura.criado_em)} />
                          <Info label="Cliente final" valor={embarque?.cliente_final || '-'} />
                          <Info label="Exportador" valor={embarque?.exportador || '-'} />
                          <Info label="Importador" valor={embarque?.importador || '-'} />
                          <Info
                            label="Fatura PDF"
                            valor={fatura.arquivo_pdf ? 'Disponível' : 'Indisponível'}
                          />
                          <Info
                            label="Recibo PDF"
                            valor={fatura.recibo_pdf ? 'Disponível' : 'Aguardando anexo'}
                          />
                          <Info
                            label="Tipo de tela"
                            valor="Documentos para visualização"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 min-w-[220px]">
                        {fatura.arquivo_pdf ? (
                          <a
                            href={fatura.arquivo_pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl text-white font-bold text-center"
                          >
                            Baixar fatura
                          </a>
                        ) : (
                          <span className="bg-slate-800 px-5 py-3 rounded-xl text-slate-400 font-bold text-center">
                            Fatura indisponível
                          </span>
                        )}

                        {fatura.recibo_pdf ? (
                          <a
                            href={fatura.recibo_pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl text-white font-bold text-center"
                          >
                            Baixar recibo
                          </a>
                        ) : (
                          <span className="bg-slate-800 px-5 py-3 rounded-xl text-slate-400 font-bold text-center">
                            Recibo ainda não anexado
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function Card({ titulo, valor, detalhe, icone }: any) {
  return (
    <div className="border border-blue-900 rounded-3xl bg-[#071225] p-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <p className="text-slate-300 font-bold">{titulo}</p>
          <h2 className="text-5xl font-black mt-4 text-white">{valor}</h2>
          <p className="text-slate-400 mt-2">{detalhe}</p>
        </div>

        <div className="text-4xl">{icone}</div>
      </div>
    </div>
  )
}

function Info({ label, valor }: any) {
  return (
    <div className="border border-blue-950 bg-[#071225] rounded-2xl p-4">
      <p className="text-slate-500 text-sm mb-2">{label}</p>
      <p className="font-bold break-words">{valor}</p>
    </div>
  )
}

function StatusDocumento({ temRecibo }: { temRecibo: boolean }) {
  return temRecibo ? (
    <span className="bg-green-600/20 text-green-300 border border-green-500 px-3 py-1 rounded-full text-xs font-black">
      🧾 Recibo disponível
    </span>
  ) : (
    <span className="bg-blue-600/20 text-blue-300 border border-blue-500 px-3 py-1 rounded-full text-xs font-black">
      📄 Fatura disponível
    </span>
  )
}
