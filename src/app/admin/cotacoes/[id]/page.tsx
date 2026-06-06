'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function DetalheCotacaoAdminPage() {
  const params = useParams()
  const [cotacao, setCotacao] = useState<any>(null)
  const [uploading, setUploading] = useState(false)

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
  }

  async function atualizarStatus(status: string) {
    const { error } = await supabase
      .from('cotacoes')
      .update({ status })
      .eq('id', params.id)

    if (error) {
      alert('Erro ao atualizar status')
      return
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

    const nomeArquivo = `${cotacao.id}-${Date.now()}-${file.name}`

    const { error } = await supabase.storage
      .from('cotacoes')
      .upload(nomeArquivo, file)

    if (error) {
  console.log(error)
  alert(JSON.stringify(error))
  return
}

    const { data } = supabase.storage
      .from('cotacoes')
      .getPublicUrl(nomeArquivo)

    await supabase
      .from('cotacoes')
      .update({
        pdf_cotacao_url: data.publicUrl,
        status: 'COTAÇÃO DISPONÍVEL',
      })
      .eq('id', cotacao.id)

    setUploading(false)
    await carregar()

    alert('PDF anexado e cotação disponibilizada ao cliente')
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
            <strong className="text-slate-400">Código vínculo</strong>
            <p>{cotacao.codigo_vinculo || '-'}</p>
          </div>

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
        </div>
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
              className="btn-secondary"
            >
              {cotacao?.pdf_cotacao_url && (
  <div className="mt-3 bg-green-900/30 border border-green-500 rounded-xl p-3">
    <p className="text-green-400 font-bold">
      PDF anexado
    </p>

    <a
      href={cotacao.pdf_cotacao_url}
      target="_blank"
      className="text-blue-400 underline"
    >
      Visualizar arquivo enviado
    </a>
  </div>
)}
              Abrir PDF anexado
            </a>
          )}
        </div>

        <p className="text-slate-400 mt-4">
          Ao anexar o PDF, o status muda automaticamente para COTAÇÃO DISPONÍVEL.
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