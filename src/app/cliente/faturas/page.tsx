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
      vencimento,
      arquivo_pdf,
      recibo_pdf,
      recibo_nome,
      data_pagamento,
      valor_pago,
      criado_em,
      visivel_cliente,
      embarques (
        id,
        awb,
        cliente_final,
        exportador,
        importador,
        transportadora,
        status_operacional,
        valor_venda
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

  function moeda(valor?: number | string | null, moedaBase = 'USD') {
    if (valor === null || valor === undefined || valor === '') return '-'
    const numero = Number(valor || 0)

    if (moedaBase === 'BRL') {
      return numero.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })
    }

    return `${moedaBase} ${numero.toFixed(2)}`
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
  const totalPendentes = faturas.filter((f) => !f.data_pagamento).length
  const totalPagas = faturas.filter((f) => f.data_pagamento).length

  return (
    <main className="min-h-screen bg-[#020817] text-white p-6 lg:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col lg:flex-row justify-between gap-6">
          <div>
            <p className="text-blue-400 font-bold mb-2">Financeiro</p>
            <h1 className="text-5xl font-black mb-2">Faturamento</h1>
            <p className="text-slate-400 text-lg">
              Consulte suas faturas, recibos e pagamentos dos embarques.
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
          <Card titulo="Faturas disponíveis" valor={totalFaturas} detalhe="No portal" icone="📄" />
          <Card titulo="Pendentes" valor={totalPendentes} detalhe="Aguardando pagamento" icone="⏳" />
          <Card titulo="Pagas" valor={totalPagas} detalhe="Pagamento identificado" icone="✅" />
          <Card titulo="Recibos" valor={totalRecibos} detalhe="Disponíveis para baixar" icone="🧾" />
        </section>

        <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
          <div className="flex flex-col lg:flex-row justify-between gap-5 mb-7">
            <div>
              <h2 className="text-2xl font-black">Faturas dos embarques</h2>
              <p className="text-slate-400 text-sm">
                Baixe sua fatura e acompanhe o recibo quando o pagamento for confirmado.
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
              Carregando faturas...
            </div>
          ) : faturasFiltradas.length === 0 ? (
            <div className="border border-blue-900 bg-[#020817] rounded-2xl p-6 text-slate-400">
              Nenhuma fatura disponível.
            </div>
          ) : (
            <div className="space-y-5">
              {faturasFiltradas.map((fatura) => {
                const embarque = dadosEmbarque(fatura)
                const moedaBase = embarque?.moeda_cobranca || 'USD'

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

                          <StatusFinanceiro pago={!!fatura.data_pagamento} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Info label="Transportadora" valor={embarque?.transportadora || '-'} />
                          <Info label="Status embarque" valor={embarque?.status_operacional || '-'} />
                          <Info label="Vencimento" valor={dataBR(fatura.vencimento)} />
                          <Info label="Cliente final" valor={embarque?.cliente_final || '-'} />
                          <Info label="Exportador" valor={embarque?.exportador || '-'} />
                          <Info label="Importador" valor={embarque?.importador || '-'} />
                          <Info
                            label="Valor cobrado"
                            valor={moeda(embarque?.valor_venda || fatura.valor_pago, 'BRL')}
                          />
                          <Info
                            label="Pagamento"
                            valor={fatura.data_pagamento ? `Pago em ${dataBR(fatura.data_pagamento)}` : 'Pendente'}
                          />
                          <Info
                            label="Recibo"
                            valor={fatura.recibo_pdf ? 'Disponível' : 'Aguardando'}
                          />
                        </div>

                        {embarque?.valor_adicional_peso && (
                          <div className="mt-5 border border-yellow-500/60 bg-yellow-500/10 rounded-2xl p-4">
                            <p className="font-black text-yellow-300 mb-2">
                              ⚠️ Divergência de peso informada
                            </p>

                            <p className="text-slate-300 text-sm">
                              Peso alterado de {embarque.peso_inicial_taxado || '-'} kg para{' '}
                              {embarque.peso_final_taxado || '-'} kg. Valor adicional:{' '}
                              <strong>{moeda(embarque.valor_adicional_peso, moedaBase)}</strong>.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-3 min-w-[220px]">
                        {fatura.arquivo_pdf ? (
                          <a
                            href={fatura.arquivo_pdf}
                            target="_blank"
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
                            className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl text-white font-bold text-center"
                          >
                            Baixar recibo
                          </a>
                        ) : (
                          <span className="bg-slate-800 px-5 py-3 rounded-xl text-slate-400 font-bold text-center">
                            Recibo pendente
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

function StatusFinanceiro({ pago }: any) {
  return pago ? (
    <span className="bg-green-600/20 text-green-300 border border-green-500 px-3 py-1 rounded-full text-xs font-black">
      ✅ Pago
    </span>
  ) : (
    <span className="bg-yellow-500/20 text-yellow-300 border border-yellow-500 px-3 py-1 rounded-full text-xs font-black">
      ⏳ Pendente
    </span>
  )
}