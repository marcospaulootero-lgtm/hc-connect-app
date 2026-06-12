'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function FaturasClientePage() {
  const [faturas, setFaturas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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

    const { data: embarquesData, error: erroEmbarques } = await supabase
      .from('embarques')
      .select('id')
      .eq('usuario_id', usuarioId)

    if (erroEmbarques) {
      console.log(erroEmbarques)
      setLoading(false)
      return
    }

    const idsEmbarques = (embarquesData || []).map((item) => item.id)

    if (idsEmbarques.length === 0) {
      setFaturas([])
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('faturas')
      .select(`
        id,
        embarque_id,
        vencimento,
        arquivo_pdf,
        recibo_pdf,
        recibo_nome,
        data_pagamento,
        criado_em,
        visivel_cliente,
        embarques (
          id,
          awb,
          cliente_final,
          transportadora,
          status_operacional
        )
      `)
      .in('embarque_id', idsEmbarques)
      .eq('visivel_cliente', true)
      .order('criado_em', { ascending: false })

    if (error) {
      console.log(error)
      setLoading(false)
      return
    }

    setFaturas(data || [])
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-[#020817] text-white p-10">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex justify-between items-start gap-6">
          <div>
            <h1 className="text-5xl font-black mb-2">
              Minhas faturas
            </h1>

            <p className="text-slate-400 text-lg">
              Consulte e baixe suas faturas e recibos de pagamento.
            </p>
          </div>

          <a
            href="/cliente"
            className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl text-white font-bold"
          >
            Voltar ao portal
          </a>
        </div>

        <section className="card">
          {loading ? (
            <p className="text-slate-400">Carregando faturas...</p>
          ) : faturas.length === 0 ? (
            <p className="text-slate-400">
              Nenhuma fatura disponível.
            </p>
          ) : (
            <div className="space-y-4">
              {faturas.map((fatura) => {
                const embarque = Array.isArray(fatura.embarques)
                  ? fatura.embarques[0]
                  : fatura.embarques

                return (
                  <div
                    key={fatura.id}
                    className="border border-blue-900 rounded-2xl p-5 bg-[#071225] flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6"
                  >
                    <div>
                      <h2 className="text-2xl font-bold text-blue-400">
                        AWB {embarque?.awb || '-'}
                      </h2>

                      <p className="text-slate-400 mt-2">
                        {embarque?.transportadora || '-'} •{' '}
                        {embarque?.status_operacional || '-'}
                      </p>

                      <p className="text-slate-500 mt-2">
                        Cliente final: {embarque?.cliente_final || '-'}
                      </p>

                      <p className="text-slate-500 mt-2">
                        Vencimento:{' '}
                        {fatura.vencimento
                          ? new Date(fatura.vencimento).toLocaleDateString('pt-BR')
                          : '-'}
                      </p>

                      {fatura.data_pagamento && (
                        <p className="text-green-400 mt-2 font-bold">
                          Pago em:{' '}
                          {new Date(fatura.data_pagamento).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {fatura.arquivo_pdf ? (
                        <a
                          href={fatura.arquivo_pdf}
                          target="_blank"
                          className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl text-white font-bold whitespace-nowrap"
                        >
                          Baixar fatura
                        </a>
                      ) : (
                        <span className="text-slate-500">
                          Fatura indisponível
                        </span>
                      )}

                      {fatura.recibo_pdf && (
                        <a
                          href={fatura.recibo_pdf}
                          target="_blank"
                          className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl text-white font-bold whitespace-nowrap"
                        >
                          Baixar recibo
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}