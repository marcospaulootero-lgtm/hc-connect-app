'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import StatusBadge from '@/components/StatusBadge'

export default function DetalheEmbarquePage() {
  const params = useParams()

  const [embarque, setEmbarque] = useState<any>(null)
  const [timeline, setTimeline] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)

  const [novoStatus, setNovoStatus] = useState('')
  const [novaDescricao, setNovaDescricao] = useState('')

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    const { data } = await supabase
      .from('embarques')
      .select(`
        *,
        empresas (
          razao_social,
          nome_fantasia,
          contato_principal,
          email_principal,
          telefone
        )
      `)
      .eq('id', params.id)
      .single()

    setEmbarque(data)

    const { data: timelineData } = await supabase
      .from('timeline_embarques')
      .select('*')
      .eq('embarque_id', params.id)
      .order('criado_em', { ascending: false })

    setTimeline(timelineData || [])
  }

  async function uploadArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]

    if (!file || !embarque) return

    setUploading(true)

    const nomeArquivo = `${embarque.id}-${Date.now()}-${file.name}`

    const { error } = await supabase.storage
      .from('documentos')
      .upload(nomeArquivo, file)

    if (error) {
      alert('Erro ao enviar arquivo')
      setUploading(false)
      return
    }

    const { data } = supabase.storage
      .from('documentos')
      .getPublicUrl(nomeArquivo)

    await supabase
      .from('embarques')
      .update({
        documento_url: data.publicUrl,
      })
      .eq('id', embarque.id)

    await carregar()

    setUploading(false)

    alert('Arquivo enviado com sucesso')
  }

  async function adicionarTimeline() {
    if (!novoStatus || !novaDescricao) {
      alert('Preencha status e descrição')
      return
    }

    await supabase.from('timeline_embarques').insert({
      embarque_id: embarque.id,
      status: novoStatus,
      descricao: novaDescricao,
    })

    setNovoStatus('')
    setNovaDescricao('')

    carregar()
  }

  if (!embarque) {
    return <main className="p-10 text-white">Carregando embarque...</main>
  }

  return (
    <main className="max-w-7xl mx-auto p-8 text-white">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">AWB {embarque.awb}</h1>
        <p className="text-slate-400 mt-2">Detalhes completos do embarque</p>
      </div>

      <section className="card mb-8">
        <h2>Resumo operacional</h2>

        <div className="form-grid">
          <div>
            <strong className="text-slate-400">Cliente</strong>
            <p>{embarque.empresas?.razao_social}</p>
          </div>

          <div>
            <strong className="text-slate-400">Transportadora</strong>
            <p>{embarque.transportadora}</p>
          </div>

          <div>
            <strong className="text-slate-400">Serviço</strong>
            <p>{embarque.servico}</p>
          </div>

          <div>
            <strong className="text-slate-400">Status</strong>
            <div className="mt-2">
              <StatusBadge status={embarque.status_operacional} />
            </div>
          </div>
        </div>
      </section>

      <section className="card mb-8">
        <h2>Dados do cliente</h2>

        <div className="form-grid">
          <div>
            <strong className="text-slate-400">Empresa</strong>
            <p>{embarque.empresas?.razao_social}</p>
          </div>

          <div>
            <strong className="text-slate-400">Contato</strong>
            <p>{embarque.empresas?.contato_principal}</p>
          </div>

          <div>
            <strong className="text-slate-400">E-mail</strong>
            <p>{embarque.empresas?.email_principal}</p>
          </div>

          <div>
            <strong className="text-slate-400">Telefone</strong>
            <p>{embarque.empresas?.telefone}</p>
          </div>
        </div>
      </section>

      <section className="card mb-8">
        <h2>Dados do embarque</h2>

        <div className="form-grid">
          <div>
            <strong className="text-slate-400">Origem</strong>
            <p>{embarque.origem}</p>
          </div>

          <div>
            <strong className="text-slate-400">Destino</strong>
            <p>{embarque.destino}</p>
          </div>

          <div>
            <strong className="text-slate-400">Peso real</strong>
            <p>{embarque.peso_real} kg</p>
          </div>

          <div>
            <strong className="text-slate-400">Peso taxado</strong>
            <p>{embarque.peso_taxado} kg</p>
          </div>
        </div>
      </section>

      <section className="card mb-8">
        <h2>Documentos</h2>

        <div className="flex items-center gap-4 flex-wrap">
          <label className="btn-primary cursor-pointer">
            {uploading ? 'Enviando...' : 'Enviar documento'}
            <input type="file" className="hidden" onChange={uploadArquivo} />
          </label>

          {embarque.documento_url && (
            <a
              href={embarque.documento_url}
              target="_blank"
              className="btn-secondary"
            >
              Abrir documento
            </a>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Timeline operacional</h2>

        <div className="form-grid mb-6">
          <input
            placeholder="Status"
            value={novoStatus}
            onChange={(e) => setNovoStatus(e.target.value)}
          />

          <input
            placeholder="Descrição operacional"
            value={novaDescricao}
            onChange={(e) => setNovaDescricao(e.target.value)}
          />
        </div>

        <button className="mb-8" onClick={adicionarTimeline}>
          Adicionar atualização
        </button>

        <div className="space-y-4">
          {timeline.map((item) => (
            <div
              key={item.id}
              className="border border-blue-900 rounded-2xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <strong>{item.status}</strong>

                <span className="text-slate-500 text-sm">
                  {new Date(item.criado_em).toLocaleString('pt-BR')}
                </span>
              </div>

              <p className="text-slate-300">{item.descricao}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}