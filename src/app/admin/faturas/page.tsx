'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type Embarque = {
  id: string
  awb: string
}

type Fatura = {
  id: string
  numero_fatura: string
  valor: number
  moeda: string
  vencimento: string
  status: string
  pdf_url: string
  embarques?: {
    awb: string
  }
}

export default function FaturasPage() {
  const [embarques, setEmbarques] = useState<Embarque[]>([])
  const [faturas, setFaturas] = useState<Fatura[]>([])

  const [awbId, setAwbId] = useState('')
  const [numeroFatura, setNumeroFatura] = useState('')
  const [valor, setValor] = useState('')
  const [moeda, setMoeda] = useState('USD')
  const [vencimento, setVencimento] = useState('')
  const [status, setStatus] = useState('EM ABERTO')
  const [pdfUrl, setPdfUrl] = useState('')

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    const { data: embarquesData } = await supabase
      .from('embarques')
      .select('id, awb')
      .order('created_at', { ascending: false })

    const { data: faturasData } = await supabase
      .from('faturas')
      .select(`
        *,
        embarques (
          awb
        )
      `)
      .order('created_at', { ascending: false })

    setEmbarques(embarquesData || [])
    setFaturas(faturasData || [])
  }

  async function salvarFatura() {
    if (!awbId) {
      alert('Selecione um AWB')
      return
    }

    if (!numeroFatura) {
      alert('Digite o número da fatura')
      return
    }

    const { error } = await supabase
      .from('faturas')
      .insert([
        {
          embarque_id: awbId,
          numero_fatura: numeroFatura,
          valor: Number(valor),
          moeda,
          vencimento,
          status,
          pdf_url: pdfUrl
        }
      ])

    if (error) {
      alert('Erro ao salvar')
      return
    }

    alert('Fatura salva com sucesso')

    setAwbId('')
    setNumeroFatura('')
    setValor('')
    setMoeda('USD')
    setVencimento('')
    setStatus('EM ABERTO')
    setPdfUrl('')

    carregar()
  }

  return (
    <main className="min-h-screen bg-[#020b3a] text-white p-10">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-5xl font-bold mb-2">
          Faturas
        </h1>

        <p className="text-slate-400 mb-10">
          Controle financeiro dos embarques
        </p>

        <section className="bg-[#08142c] border border-blue-900 rounded-3xl p-8 mb-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">

            <select
              value={awbId}
              onChange={(e) => setAwbId(e.target.value)}
              className="input"
            >
              <option value="">
                Selecione o AWB
              </option>

              {embarques.map((item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.awb}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Nº da fatura"
              value={numeroFatura}
              onChange={(e) => setNumeroFatura(e.target.value)}
              className="input"
            />

            <input
              type="number"
              placeholder="Valor"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="input"
            />

            <select
              value={moeda}
              onChange={(e) => setMoeda(e.target.value)}
              className="input"
            >
              <option>USD</option>
              <option>BRL</option>
              <option>EUR</option>
            </select>

            <input
              type="date"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
              className="input"
            />

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input"
            >
              <option>EM ABERTO</option>
              <option>PAGO</option>
              <option>VENCIDO</option>
            </select>

            <input
              type="text"
              placeholder="Link PDF"
              value={pdfUrl}
              onChange={(e) => setPdfUrl(e.target.value)}
              className="input"
            />

            <button
              onClick={salvarFatura}
              className="bg-blue-600 hover:bg-blue-500 transition rounded-2xl font-bold"
            >
              Salvar fatura
            </button>
          </div>
        </section>

        <section className="bg-[#08142c] border border-blue-900 rounded-3xl overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full">
              <thead className="border-b border-blue-900">
                <tr className="text-left">
                  <th className="p-5">AWB</th>
                  <th className="p-5">Fatura</th>
                  <th className="p-5">Valor</th>
                  <th className="p-5">Vencimento</th>
                  <th className="p-5">Status</th>
                  <th className="p-5">PDF</th>
                </tr>
              </thead>

              <tbody>
                {faturas.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-blue-950 hover:bg-[#0d1d44]"
                  >
                    <td className="p-5 font-semibold text-blue-400">
                      {item.embarques?.awb}
                    </td>

                    <td className="p-5">
                      {item.numero_fatura}
                    </td>

                    <td className="p-5">
                      {item.moeda} {item.valor}
                    </td>

                    <td className="p-5">
                      {item.vencimento}
                    </td>

                    <td className="p-5">
                      <span
                        className={`
                          px-4 py-2 rounded-full text-sm font-bold
                          ${
                            item.status === 'PAGO'
                              ? 'bg-green-500 text-black'
                              : item.status === 'VENCIDO'
                              ? 'bg-red-500 text-white'
                              : 'bg-yellow-400 text-black'
                          }
                        `}
                      >
                        {item.status}
                      </span>
                    </td>

                    <td className="p-5">
                      {item.pdf_url ? (
                        <Link
                          href={item.pdf_url}
                          target="_blank"
                          className="text-blue-400 hover:text-blue-300"
                        >
                          Abrir PDF
                        </Link>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}