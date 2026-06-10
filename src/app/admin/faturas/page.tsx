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
  vencimento: string
  arquivo_pdf: string
  criado_em: string
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
  const [salvando, setSalvando] = useState(false)

  const [awbId, setAwbId] = useState('')
  const [vencimento, setVencimento] = useState('')
  const [arquivoPdf, setArquivoPdf] = useState<File | null>(null)

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
        id,
        vencimento,
        arquivo_pdf,
        criado_em,
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

    if (!arquivoPdf) {
      alert('Selecione o PDF da fatura')
      return
    }

    if (arquivoPdf.type !== 'application/pdf') {
      alert('O arquivo precisa ser um PDF')
      return
    }

    setSalvando(true)

    const embarqueSelecionado = embarques.find((item) => item.id === awbId)

    const nomeLimpo = arquivoPdf.name
      .replaceAll(' ', '-')
      .replaceAll('/', '-')

    const nomeArquivo = `${awbId}/${Date.now()}-${nomeLimpo}`

    const { error: erroUpload } = await supabase.storage
      .from('faturas')
      .upload(nomeArquivo, arquivoPdf, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'application/pdf',
      })

    if (erroUpload) {
      setSalvando(false)
      alert(erroUpload.message || 'Erro ao enviar PDF')
      console.log(erroUpload)
      return
    }

    const { data: urlData } = supabase.storage
      .from('faturas')
      .getPublicUrl(nomeArquivo)

    const pdfUrl = urlData.publicUrl

    const { error } = await supabase
      .from('faturas')
      .insert([
        {
          embarque_id: awbId,
          usuario_id: embarqueSelecionado?.usuario_id || null,
          vencimento: vencimento || null,
          arquivo_pdf: pdfUrl,
          visivel_cliente: true,
        },
      ])

    setSalvando(false)

    if (error) {
      alert(error.message || 'Erro ao salvar fatura')
      console.log(error)
      return
    }

    alert('Fatura salva com sucesso e disponibilizada ao cliente')

    setAwbId('')
    setVencimento('')
    setArquivoPdf(null)

    const inputArquivo = document.getElementById('pdf_fatura') as HTMLInputElement | null

    if (inputArquivo) {
      inputArquivo.value = ''
    }

    carregar()
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
            type="date"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
          />

          <input
            id="pdf_fatura"
            type="file"
            accept="application/pdf"
            onChange={(e) => setArquivoPdf(e.target.files?.[0] || null)}
            className="cursor-pointer"
          />

          <button
            onClick={salvarFatura}
            disabled={salvando}
            className="bg-blue-600 hover:bg-blue-500 transition rounded-2xl font-bold disabled:opacity-60"
          >
            {salvando ? 'Salvando...' : 'Salvar fatura'}
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
                <th>Vencimento</th>
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

                  <td>
                    {item.vencimento
                      ? new Date(item.vencimento).toLocaleDateString('pt-BR')
                      : '-'}
                  </td>

                  <td>
                    {item.arquivo_pdf ? (
                      <Link
                        href={item.arquivo_pdf}
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