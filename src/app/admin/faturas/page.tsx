'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import StatusBadge from '@/components/StatusBadge'

type Embarque = {
  id: string
  awb: string
  usuario_id: string
  cliente_final: string | null
  transportadora: string | null
  status_operacional: string | null
}

type Fatura = {
  id: string
  vencimento: string | null
  arquivo_pdf: string | null
  recibo_pdf: string | null
  recibo_nome: string | null
  data_pagamento: string | null
  valor_pago: number | null
  criado_em: string
  visivel_cliente?: boolean | null
  embarques?: any
}

export default function FaturasPage() {
  const [embarques, setEmbarques] = useState<Embarque[]>([])
  const [faturas, setFaturas] = useState<Fatura[]>([])
  const [salvando, setSalvando] = useState(false)
  const [enviandoRecibo, setEnviandoRecibo] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  const [awbId, setAwbId] = useState('')
  const [vencimento, setVencimento] = useState('')
  const [arquivoPdf, setArquivoPdf] = useState<File | null>(null)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    const { data: embarquesData } = await supabase
      .from('embarques')
      .select('id, awb, usuario_id, cliente_final, transportadora, status_operacional')
      .order('criado_em', { ascending: false })

    const { data: faturasData, error } = await supabase
      .from('faturas')
      .select(`
        id,
        vencimento,
        arquivo_pdf,
        recibo_pdf,
        recibo_nome,
        data_pagamento,
        valor_pago,
        criado_em,
        visivel_cliente,
        embarques (
          awb,
          cliente_final,
          transportadora,
          status_operacional
        )
      `)
      .order('criado_em', { ascending: false })

    if (error) console.log(error)

    setEmbarques(embarquesData || [])
    setFaturas((faturasData as Fatura[]) || [])
  }

  function dadosEmbarque(fatura: Fatura) {
    if (Array.isArray(fatura.embarques)) return fatura.embarques[0] || {}
    return fatura.embarques || {}
  }

  async function salvarFatura() {
    if (!awbId) return alert('Selecione um AWB')
    if (!arquivoPdf) return alert('Selecione o PDF da fatura')
    if (arquivoPdf.type !== 'application/pdf') return alert('O arquivo precisa ser um PDF')

    setSalvando(true)

    const embarqueSelecionado = embarques.find((item) => item.id === awbId)
    const nomeArquivo = `${awbId}/${Date.now()}-${arquivoPdf.name.replaceAll(' ', '-')}`

    const { error: erroUpload } = await supabase.storage
      .from('faturas')
      .upload(nomeArquivo, arquivoPdf, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'application/pdf',
      })

    if (erroUpload) {
      setSalvando(false)
      alert(erroUpload.message)
      return
    }

    const { data: urlData } = supabase.storage.from('faturas').getPublicUrl(nomeArquivo)

    const { error } = await supabase.from('faturas').insert([
      {
        embarque_id: awbId,
        usuario_id: embarqueSelecionado?.usuario_id || null,
        vencimento: vencimento || null,
        arquivo_pdf: urlData.publicUrl,
        visivel_cliente: true,
      },
    ])

    setSalvando(false)

    if (error) {
      alert(error.message)
      console.log(error)
      return
    }

    alert('Fatura salva com sucesso')

    setAwbId('')
    setVencimento('')
    setArquivoPdf(null)

    const inputArquivo = document.getElementById('pdf_fatura') as HTMLInputElement | null
    if (inputArquivo) inputArquivo.value = ''

    carregar()
  }

  async function anexarRecibo(fatura: Fatura, arquivo: File | null) {
    if (!arquivo) return
    if (arquivo.type !== 'application/pdf') return alert('O recibo precisa ser um PDF')

    setEnviandoRecibo(fatura.id)

    const nomeArquivo = `recibos/${fatura.id}/${Date.now()}-${arquivo.name.replaceAll(' ', '-')}`

    const { error: erroUpload } = await supabase.storage
      .from('faturas')
      .upload(nomeArquivo, arquivo, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'application/pdf',
      })

    if (erroUpload) {
      setEnviandoRecibo(null)
      alert(erroUpload.message)
      return
    }

    const { data: urlData } = supabase.storage.from('faturas').getPublicUrl(nomeArquivo)

    const { error } = await supabase
      .from('faturas')
      .update({
        recibo_pdf: urlData.publicUrl,
        recibo_nome: arquivo.name,
        data_pagamento: new Date().toISOString().slice(0, 10),
      })
      .eq('id', fatura.id)

    setEnviandoRecibo(null)

    if (error) {
      alert(error.message)
      return
    }

    alert('Recibo anexado com sucesso')
    carregar()
  }

  async function removerRecibo(fatura: Fatura) {
    const confirmar = confirm('Deseja remover o recibo desta fatura?')
    if (!confirmar) return

    const { error } = await supabase
      .from('faturas')
      .update({
        recibo_pdf: null,
        recibo_nome: null,
        data_pagamento: null,
        valor_pago: null,
      })
      .eq('id', fatura.id)

    if (error) {
      alert(error.message)
      return
    }

    carregar()
  }

  async function alterarVisibilidade(fatura: Fatura) {
    const { error } = await supabase
      .from('faturas')
      .update({ visivel_cliente: !fatura.visivel_cliente })
      .eq('id', fatura.id)

    if (error) {
      alert(error.message)
      return
    }

    carregar()
  }

  async function excluirFatura(id: string) {
    const confirmar = confirm('Deseja realmente excluir esta fatura?')
    if (!confirmar) return

    const { error } = await supabase.from('faturas').delete().eq('id', id)

    if (error) {
      alert(error.message)
      return
    }

    carregar()
  }

  const faturasFiltradas = useMemo(() => {
    return faturas.filter((fatura) => {
      const emb = dadosEmbarque(fatura)

      const texto = `
        ${emb.awb}
        ${emb.cliente_final}
        ${emb.transportadora}
        ${emb.status_operacional}
        ${fatura.vencimento}
      `.toLowerCase()

      return texto.includes(busca.toLowerCase())
    })
  }, [faturas, busca])

  const totalVisiveis = faturas.filter((f) => f.visivel_cliente).length
  const totalOcultas = faturas.filter((f) => !f.visivel_cliente).length
  const totalPDF = faturas.filter((f) => f.arquivo_pdf).length
  const totalRecibos = faturas.filter((f) => f.recibo_pdf).length

  return (
    <main className="max-w-[1500px] mx-auto p-8 text-white">
      <div className="mb-8 flex flex-col lg:flex-row justify-between gap-6">
        <div>
          <p className="text-blue-400 font-bold mb-2">Financeiro</p>
          <h1 className="text-5xl font-black mb-2">Faturas</h1>
          <p className="text-slate-400 text-lg">
            Vincule faturas aos embarques, envie PDFs e anexe recibos de pagamento.
          </p>
        </div>

        <button
          onClick={() => window.scrollTo({ top: 250, behavior: 'smooth' })}
          className="bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold h-fit"
        >
          + Nova fatura
        </button>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <Card titulo="Total de faturas" valor={faturas.length} detalhe="Cadastradas no sistema" icone="💵" />
        <Card titulo="Visíveis ao cliente" valor={totalVisiveis} detalhe="Disponíveis no portal" icone="✅" />
        <Card titulo="PDFs anexados" valor={totalPDF} detalhe="Faturas disponíveis" icone="📄" />
        <Card titulo="Recibos anexados" valor={totalRecibos} detalhe="Pagamentos recebidos" icone="🧾" />
      </section>

      <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7 mb-8">
        <div className="flex items-center gap-3 mb-7">
          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-xl">
            📄
          </div>

          <div>
            <h2 className="text-2xl font-black">Cadastrar fatura</h2>
            <p className="text-slate-400 text-sm">
              Selecione o embarque, informe o vencimento e anexe o PDF.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <select value={awbId} onChange={(e) => setAwbId(e.target.value)}>
            <option value="">Selecione o AWB</option>

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
            className="bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold disabled:opacity-60"
          >
            {salvando ? 'Salvando...' : 'Salvar fatura'}
          </button>
        </div>
      </section>

      <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
        <div className="flex flex-col lg:flex-row justify-between gap-5 mb-7">
          <div>
            <h2 className="text-2xl font-black">Faturas cadastradas</h2>
            <p className="text-slate-400 text-sm">
              Controle faturas, recibos e visibilidade no portal do cliente.
            </p>
          </div>

          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por AWB, cliente, transportadora..."
            className="lg:max-w-md"
          />
        </div>

        <div className="overflow-auto">
          <table className="table">
            <thead>
              <tr>
                <th>AWB</th>
                <th>Cliente final</th>
                <th>Transportadora</th>
                <th>Status embarque</th>
                <th>Vencimento</th>
                <th>Disponível</th>
                <th>Fatura PDF</th>
                <th>Recibo</th>
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              {faturasFiltradas.map((item) => {
                const emb = dadosEmbarque(item)

                return (
                  <tr key={item.id}>
                    <td className="font-black text-blue-400">{emb.awb || '-'}</td>
                    <td>{emb.cliente_final || '-'}</td>
                    <td>{emb.transportadora || '-'}</td>

                    <td>
                      <StatusBadge status={emb.status_operacional || '-'} />
                    </td>

                    <td>
                      {item.vencimento
                        ? new Date(item.vencimento).toLocaleDateString('pt-BR')
                        : '-'}
                    </td>

                    <td>
                      <span
                        className={`px-3 py-2 rounded-xl text-xs font-black ${
                          item.visivel_cliente
                            ? 'bg-green-600 text-white'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {item.visivel_cliente ? 'VISÍVEL' : 'OCULTA'}
                      </span>
                    </td>

                    <td>
                      {item.arquivo_pdf ? (
                        <Link
                          href={item.arquivo_pdf}
                          target="_blank"
                          className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl text-white font-bold inline-block"
                        >
                          Abrir fatura
                        </Link>
                      ) : (
                        <span className="text-slate-500">Sem PDF</span>
                      )}
                    </td>

                    <td>
                      <div className="flex flex-col gap-2 min-w-[220px]">
                        {item.recibo_pdf ? (
                          <>
                            <Link
                              href={item.recibo_pdf}
                              target="_blank"
                              className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-xl text-white font-bold text-center"
                            >
                              Abrir recibo
                            </Link>

                            <p className="text-xs text-slate-400">
                              Pago em:{' '}
                              {item.data_pagamento
                                ? new Date(item.data_pagamento).toLocaleDateString('pt-BR')
                                : '-'}
                            </p>

                            <button
                              onClick={() => removerRecibo(item)}
                              className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded-xl font-bold"
                            >
                              Remover recibo
                            </button>
                          </>
                        ) : (
                          <>
                            <input
                              type="file"
                              accept="application/pdf"
                              disabled={enviandoRecibo === item.id}
                              onChange={(e) => anexarRecibo(item, e.target.files?.[0] || null)}
                              className="text-sm"
                            />

                            {enviandoRecibo === item.id && (
                              <span className="text-blue-400 text-xs font-bold">
                                Enviando recibo...
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </td>

                    <td>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => alterarVisibilidade(item)}
                          className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl font-bold"
                        >
                          {item.visivel_cliente ? 'Ocultar' : 'Mostrar'}
                        </button>

                        <button
                          onClick={() => excluirFatura(item.id)}
                          className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded-xl font-bold"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {faturasFiltradas.length === 0 && (
            <div className="border border-blue-900 bg-[#020817] rounded-2xl p-6 text-center text-slate-400 mt-6">
              Nenhuma fatura encontrada.
            </div>
          )}
        </div>
      </section>
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