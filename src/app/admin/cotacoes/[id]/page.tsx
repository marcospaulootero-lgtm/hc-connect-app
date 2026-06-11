'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function DetalheCotacaoAdminPage() {
  const params = useParams()
  const [cotacao, setCotacao] = useState<any>(null)
  const [uploading, setUploading] = useState(false)
  const [salvandoRef, setSalvandoRef] = useState(false)
  const [referenciaHC, setReferenciaHC] = useState('')

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    const { data } = await supabase
      .from('cotacoes')
      .select('*')
      .eq('id', params.id)
      .single()

    setCotacao(data)
    setReferenciaHC(data?.referencia_hc || '')
  }

  async function salvarReferenciaHC() {
    if (!cotacao) return

    setSalvandoRef(true)

    const { error } = await supabase
      .from('cotacoes')
      .update({ referencia_hc: referenciaHC || null })
      .eq('id', cotacao.id)

    setSalvandoRef(false)

    if (error) {
      alert('Erro ao salvar Referência HC')
      console.log(error)
      return
    }

    alert('Referência HC salva com sucesso')
    carregar()
  }

  async function enviarEmailCotacao(cotacaoAtualizada: any) {
    if (!cotacaoAtualizada?.solicitante_email) return

    try {
      await fetch('/api/enviar-email-cotacao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: cotacaoAtualizada.solicitante_email,
          nome: cotacaoAtualizada.cliente_final,
          referencia_hc: cotacaoAtualizada.referencia_hc,
          valor: cotacaoAtualizada.valor || cotacaoAtualizada.valor_total || '',
          validade: cotacaoAtualizada.validade || '',
          link: `${window.location.origin}/cliente/cotacoes`,
        }),
      })
    } catch (err) {
      console.error(err)
    }
  }

  async function atualizarStatus(status: string) {
    const { data, error } = await supabase
      .from('cotacoes')
      .update({ status, referencia_hc: referenciaHC || cotacao?.referencia_hc || null })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      alert('Erro ao atualizar status')
      return
    }

    if (status === 'COTAÇÃO DISPONÍVEL') {
      await enviarEmailCotacao(data)
    }

    carregar()
  }

  async function anexarPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]

    if (!file || !cotacao) return

    if (file.type !== 'application/pdf') {
      alert('Envie apenas arquivo PDF')
      return
    }

    setUploading(true)

    const nomeLimpo = file.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_+/g, '_')

    const nomeArquivo = `${cotacao.id}-${Date.now()}-${nomeLimpo}`

    const { error } = await supabase.storage
      .from('cotacoes')
      .upload(nomeArquivo, file, {
        upsert: true,
        contentType: 'application/pdf',
      })

    if (error) {
      console.log(error)
      alert(JSON.stringify(error))
      setUploading(false)
      return
    }

    const { data } = supabase.storage
      .from('cotacoes')
      .getPublicUrl(nomeArquivo)

    const { data: cotacaoAtualizada, error: erroUpdate } = await supabase
      .from('cotacoes')
      .update({
        pdf_cotacao_url: data.publicUrl,
        pdf_nome: file.name,
        referencia_hc: referenciaHC || cotacao.referencia_hc || null,
        status: 'COTAÇÃO DISPONÍVEL',
      })
      .eq('id', cotacao.id)
      .select()
      .single()

    setUploading(false)

    if (erroUpdate) {
      console.log(erroUpdate)
      alert('PDF enviado, mas houve erro ao atualizar a cotação.')
      return
    }

    await enviarEmailCotacao(cotacaoAtualizada)
    await carregar()

    alert('PDF anexado, cotação disponibilizada e e-mail enviado ao cliente')
  }

  if (!cotacao) {
    return <main className="p-10 text-white">Carregando cotação...</main>
  }

  return (
    <main className="max-w-7xl mx-auto p-8 text-white">
      <div className="mb-8">
        <h1 className="text-5xl font-black mb-2">Cotação</h1>
        <p className="text-slate-400 text-lg">
          Detalhes completos da solicitação.
        </p>
      </div>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">Resumo</h2>

        <div className="form-grid">
          <div>
            <strong className="text-slate-400">Solicitante</strong>
            <p>{cotacao.solicitante_email || '-'}</p>
          </div>

          <div>
            <strong className="text-slate-400">Cliente final</strong>
            <p>{cotacao.cliente_final || '-'}</p>
          </div>

          <div>
            <strong className="text-slate-400">Status</strong>
            <p>{cotacao.status}</p>
          </div>

          <div>
            <strong className="text-slate-400">Arquivo</strong>
            <p>{cotacao.pdf_nome || 'Nenhum PDF anexado'}</p>
          </div>
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">Referência HC</h2>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
          <div>
            <label className="block text-slate-400 font-bold mb-2">
              Número de referência da cotação
            </label>

            <input
              type="text"
              value={referenciaHC}
              onChange={(e) => setReferenciaHC(e.target.value)}
              placeholder="Ex: HC-2026-0001"
            />
          </div>

          <button
            onClick={salvarReferenciaHC}
            disabled={salvandoRef}
            className="bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold disabled:opacity-60"
          >
            {salvandoRef ? 'Salvando...' : 'Salvar referência'}
          </button>
        </div>

        <p className="text-slate-400 mt-4">
          Essa referência aparecerá no portal do cliente e no e-mail de aviso da cotação.
        </p>
      </section>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">Dados da cotação</h2>

        <div className="form-grid">
          <div>
            <strong className="text-slate-400">Operação</strong>
            <p>{cotacao.tipo_operacao || '-'}</p>
          </div>

          <div>
            <strong className="text-slate-400">Origem</strong>
            <p>{cotacao.origem || '-'}</p>
          </div>

          <div>
            <strong className="text-slate-400">Destino</strong>
            <p>{cotacao.destino || '-'}</p>
          </div>

          <div>
            <strong className="text-slate-400">Peso informado</strong>
            <p>{cotacao.peso || '-'} kg</p>
          </div>

          <div>
            <strong className="text-slate-400">Dimensões gerais</strong>
            <p>{cotacao.dimensoes || '-'}</p>
          </div>

          <div>
            <strong className="text-slate-400">Valor da mercadoria</strong>
            <p>
              {cotacao.moeda || ''} {cotacao.valor_mercadoria || '-'}
            </p>
          </div>
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">Mercadoria</h2>

        <p className="text-slate-300 leading-8">
          {cotacao.descricao_mercadoria || 'Sem descrição informada.'}
        </p>

        <h3 className="text-xl font-black mt-8 mb-3">Observações</h3>

        <p className="text-slate-300 leading-8">
          {cotacao.observacoes || 'Sem observações.'}
        </p>
      </section>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">Volumes</h2>

        {!cotacao.volumes || cotacao.volumes.length === 0 ? (
          <p className="text-slate-400">Nenhum volume informado.</p>
        ) : (
          <div className="overflow-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Qtd</th>
                  <th>Comprimento</th>
                  <th>Largura</th>
                  <th>Altura</th>
                  <th>Peso</th>
                </tr>
              </thead>

              <tbody>
                {cotacao.volumes.map((volume: any, index: number) => (
                  <tr key={index}>
                    <td>{volume.quantidade}</td>
                    <td>{volume.comprimento_cm} cm</td>
                    <td>{volume.largura_cm} cm</td>
                    <td>{volume.altura_cm} cm</td>
                    <td>{volume.peso_kg} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">Resposta da cotação</h2>

        <div className="flex gap-4 flex-wrap items-center">
          <label className="btn-primary cursor-pointer">
            {uploading ? 'Enviando PDF...' : 'Anexar PDF da cotação'}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={anexarPdf}
            />
          </label>

          {cotacao.pdf_cotacao_url && (
            <a
              href={cotacao.pdf_cotacao_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              Abrir PDF anexado
            </a>
          )}

          <button
            onClick={() => atualizarStatus('COTAÇÃO DISPONÍVEL')}
            className="bg-emerald-600 hover:bg-emerald-500 px-5 py-3 rounded-xl font-bold"
          >
            Disponibilizar e enviar e-mail
          </button>
        </div>

        {cotacao.pdf_cotacao_url && (
          <div className="mt-5 bg-green-900/30 border border-green-500 rounded-xl p-4">
            <p className="text-green-400 font-bold">
              PDF anexado com sucesso
            </p>

            <p className="text-slate-300 mt-2">
              Arquivo: {cotacao.pdf_nome || 'PDF da cotação'}
            </p>

            <a
              href={cotacao.pdf_cotacao_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline mt-2 inline-block"
            >
              Visualizar arquivo enviado
            </a>
          </div>
        )}

        <p className="text-slate-400 mt-4">
          Ao anexar o PDF ou disponibilizar a cotação, o status muda para COTAÇÃO DISPONÍVEL e o cliente recebe um e-mail.
        </p>
      </section>

      <section className="card">
        <h2 className="text-2xl font-black mb-6">Ações</h2>

        <div className="flex gap-4 flex-wrap">
          <button onClick={() => atualizarStatus('EM ANÁLISE')}>
            Marcar em análise
          </button>

          <button
            onClick={() => atualizarStatus('AGUARDANDO TRANSPORTADORA')}
            className="bg-purple-600 hover:bg-purple-500"
          >
            Aguardando transportadora
          </button>

          <button
            onClick={() => atualizarStatus('RECUSADA')}
            className="bg-red-600 hover:bg-red-500"
          >
            Recusar
          </button>
        </div>
      </section>
    </main>
  )
}