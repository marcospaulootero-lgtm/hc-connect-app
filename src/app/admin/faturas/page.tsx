'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type Embarque = {
  id: string
  awb: string
  usuario_id: string
  cliente_final: string
  transportadora: string
  status_operacional: string
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
    cliente_final: string
    transportadora: string
    status_operacional: string
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
    const { data: embarquesData, error: erroEmbarques } = await supabase
  .from('embarques')
  .select('id, awb, usuario_id, cliente_final, transportadora, status_operacional')
  .in('status_operacional', [
    'Em trânsito',
    'Fiscalização',
    'Liberado',
    'Entregue',
    'Finalizado',
  ])
  .order('criado_em', { ascending: false })

    if (erroEmbarques) {
      console.log(erroEmbarques)
    }

    const { data: faturasData, error: erroFaturas } = await supabase
      .from('faturas')
      .select(`
        *,
        embarques (
          awb,
          cliente_final,
          transportadora,
          status_operacional
        )
      `)
      .order('criado_em', { ascending: false })

    if (erroFaturas) {
      console.log(erroFaturas)
    }

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

    const embarqueSelecionado = embarques.find((item) => item.id === awbId)

    const { error } = await supabase
      .from('faturas')
      .insert([
        {
          embarque_id: awbId,
          usuario_id: embarqueSelecionado?.usuario_id || null,
          numero_fatura: numeroFatura,
          valor: Number(valor),
          moeda,
          vencimento: vencimento || null,
          status,
          pdf_url: pdfUrl,
        },
      ])

    if (error) {
      alert('Erro ao salvar fatura')
      console.log(error)
      return
    }

    alert('Fatura salva com sucesso e disponibilizada ao cliente')

    setAwbId('')
    setNumeroFatura('')
    setValor('')
    setMoeda('USD')
    setVencimento('')
    setStatus('EM ABERTO')
    setPdfUrl('')

    carregar()
  }

  function corStatus(statusFatura: string) {
    if (statusFatura === 'PAGO') return 'bg-green-500 text-black'
    if (statusFatura === 'VENCIDO') return 'bg-red-500 text-white'
    return 'bg-yellow-400 text-black'
  }

  return (
    <main className="max-w-7xl mx-auto p-8 text-white">
      <div className="mb-8">
        <h1 className="text-5xl font-black mb-2">
          Faturas
        </h1>

        <p className="text-slate-400 text-lg">
          Vincule faturas aos embarques e disponibilize para o cliente.
        </p>
      </div>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">
          Cadastrar fatura
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <select
            value={awbId}
            onChange={(e) => setAwbId(e.target.value)}
          >
            <option value="">
              Selecione o AWB
            </option>

            {embarques.map((item) => (
              <option key={item.id} value={item.id}>
                {item.awb} - {item.cliente_final || 'Sem cliente final'} - {item.status_operacional}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Nº da fatura"
            value={numeroFatura}
            onChange={(e) => setNumeroFatura(e.target.value)}
          />

          <input
            type="number"
            placeholder="Valor"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />

          <select
            value={moeda}
            onChange={(e) => setMoeda(e.target.value)}
          >
            <option>USD</option>
            <option>BRL</option>
            <option>EUR</option>
          </select>

          <input
            type="date"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option>EM ABERTO</option>
            <option>PAGO</option>
            <option>VENCIDO</option>
          </select>

          <input
            type="text"
            placeholder="Link do PDF da fatura"
            value={pdfUrl}
            onChange={(e) => setPdfUrl(e.target.value)}
          />

          <button
            onClick={salvarFatura}
            className="bg-blue-600 hover:bg-blue-500 transition rounded-2xl font-bold"
          >
            Salvar fatura
          </button>
        </div>
      </section>

      <section className="card">
        <h2 className="text-2xl font-black mb-6">
          Faturas cadastradas
        </h2>

        <div className="overflow-auto">
          <table className="table">
            <thead>
              <tr>
                <th>AWB</th>
                <th>Cliente final</th>
                <th>Transportadora</th>
                <th>Fatura</th>
                <th>Valor</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th>PDF</th>
              </tr>
            </thead>

            <tbody>
              {faturas.map((item) => (
                <tr key={item.id}>
                  <td className="font-bold text-blue-400">
                    {item.embarques?.awb || '-'}
                  </td>

                  <td>{item.embarques?.cliente_final || '-'}</td>
                  <td>{item.embarques?.transportadora || '-'}</td>
                  <td>{item.numero_fatura}</td>

                  <td>
                    {item.moeda} {item.valor}
                  </td>

                  <td>
                    {item.vencimento
                      ? new Date(item.vencimento).toLocaleDateString('pt-BR')
                      : '-'}
                  </td>

                  <td>
                    <span className={`px-4 py-2 rounded-full text-sm font-bold ${corStatus(item.status)}`}>
                      {item.status}
                    </span>
                  </td>

                  <td>
                    {item.pdf_url ? (
                      <Link
                        href={item.pdf_url}
                        target="_blank"
                        className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl text-white font-bold inline-block"
                      >
                        Abrir PDF
                      </Link>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {faturas.length === 0 && (
            <p className="text-slate-400 mt-6">
              Nenhuma fatura cadastrada.
            </p>
          )}
        </div>
      </section>
    </main>
  )
}