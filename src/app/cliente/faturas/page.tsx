'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function FaturasClientePage() {
  const [usuario, setUsuario] = useState<any>(null)
  const [faturas, setFaturas] = useState<any[]>([])

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

    setUsuario(user)
    carregarFaturas(user.id)
  }

  async function carregarFaturas(usuarioId: string) {
    const { data, error } = await supabase
      .from('faturas')
      .select(`
        id,
        vencimento,
        arquivo_pdf,
        criado_em,
        embarques (
          id,
          awb,
          cliente_final,
          transportadora,
          status_operacional
        )
      `)
      .eq('usuario_id', usuarioId)
      .eq('visivel_cliente', true)
      .order('criado_em', { ascending: false })

    if (error) {
      console.log(error)
      return
    }

    setFaturas(data || [])
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
              Consulte e baixe as faturas vinculadas aos seus embarques.
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
          {faturas.length === 0 ? (
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
                    className="border border-blue-900 rounded-2xl p-5 bg-[#071225] flex justify-between items-center gap-6"
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
                    </div>

                    {fatura.arquivo_pdf ? (
                      <a
                        href={fatura.arquivo_pdf}
                        target="_blank"
                        className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl text-white font-bold whitespace-nowrap"
                      >
                        Baixar PDF
                      </a>
                    ) : (
                      <span className="text-slate-500">
                        PDF indisponível
                      </span>
                    )}
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