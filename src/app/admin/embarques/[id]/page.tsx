'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import StatusBadge from '@/components/StatusBadge'

export default function DetalheEmbarquePage() {
  const params = useParams()

  const [embarque, setEmbarque] = useState<any>(null)
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [timeline, setTimeline] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    carregar()
    carregarUsuarios()
  }, [])

  async function carregar() {
    const { data, error } = await supabase
      .from('embarques')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      console.log(error)
      return
    }

    setEmbarque(data)

    const { data: timelineData } = await supabase
      .from('timeline_embarques')
      .select('*')
      .eq('embarque_id', params.id)
      .order('criado_em', { ascending: false })

    setTimeline(timelineData || [])
  }

  async function carregarUsuarios() {
    const { data } = await supabase
      .from('perfis')
      .select('*')
      .eq('tipo_acesso', 'cliente')
      .order('nome')

    setUsuarios(data || [])
  }

  function nomeUsuario(usuarioId: string) {
    const usuario = usuarios.find((item) => item.id === usuarioId)
    return usuario?.nome || usuario?.email || 'Não vinculado'
  }

  function linkRastreio() {
    if (!embarque?.awb || embarque.awb === 'AGUARDANDO AWB') return ''

    const transportadora = (embarque.transportadora || '').toUpperCase()

    if (transportadora.includes('DHL')) {
      return `https://mydhl.express.dhl/br/pt/tracking.html#/results?id=${embarque.awb}`
    }

    if (transportadora.includes('FEDEX')) {
      return `https://www.fedex.com/fedextrack/?trknbr=${embarque.awb}`
    }

    if (transportadora.includes('UPS')) {
      return `https://www.ups.com/track?tracknum=${embarque.awb}`
    }

    return ''
  }

  async function uploadArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]

    if (!file || !embarque) return

    setUploading(true)

    const nomeArquivo = `${embarque.id}-${Date.now()}-${file.name}`

    const { error } = await supabase.storage
      .from('documentos')
      .upload(nomeArquivo, file, {
        upsert: true,
      })

    if (error) {
      alert('Erro ao enviar arquivo')
      console.log(error)
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
        ultima_atualizacao: new Date().toISOString(),
      })
      .eq('id', embarque.id)

    await supabase.from('timeline_embarques').insert({
      embarque_id: embarque.id,
      status: 'DOCUMENTO',
      descricao: `Documento enviado: ${file.name}`,
    })

    setUploading(false)
    await carregar()

    alert('Arquivo enviado com sucesso')
  }

  function etapaConcluida(etapa: string) {
    const status = (embarque?.status_operacional || '').toLowerCase()

    if (etapa === 'coleta') {
      return (
        status.includes('colet') ||
        status.includes('trânsito') ||
        status.includes('fiscal') ||
        status.includes('liberado') ||
        status.includes('entregue')
      )
    }

    if (etapa === 'transito') {
      return (
        status.includes('trânsito') ||
        status.includes('fiscal') ||
        status.includes('liberado') ||
        status.includes('entregue')
      )
    }

    if (etapa === 'fiscalizacao') {
      return (
        status.includes('fiscal') ||
        status.includes('liberado') ||
        status.includes('entregue')
      )
    }

    if (etapa === 'liberado') {
      return status.includes('liberado') || status.includes('entregue')
    }

    if (etapa === 'entregue') {
      return status.includes('entregue')
    }

    return false
  }

  if (!embarque) {
    return <main className="p-10 text-white">Carregando embarque...</main>
  }
    return (
    <main className="max-w-7xl mx-auto p-8 text-white">
      <header className="border border-blue-900 rounded-3xl bg-[#071225] p-8 mb-8 shadow-[0_0_35px_rgba(37,99,235,0.12)]">
        <div className="flex flex-col lg:flex-row justify-between gap-8">
          <div>
            <p className="text-blue-400 font-bold mb-2">
              Detalhe do embarque
            </p>

            <h1 className="text-5xl font-black mb-3">
              AWB {embarque.awb || '-'}
            </h1>

            <div className="flex items-center gap-4 flex-wrap">
              <StatusBadge status={embarque.status_operacional} />

              <span className="text-slate-400">
                {embarque.transportadora || '-'} • {embarque.servico || '-'}
              </span>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap h-fit">
            <a
              href="/admin/embarques"
              className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold"
            >
              Voltar
            </a>

            {linkRastreio() && (
              <a
                href={linkRastreio()}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-yellow-500 hover:bg-yellow-400 px-5 py-3 rounded-xl text-black font-bold"
              >
                Rastrear
              </a>
            )}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <InfoCard
          titulo="Cliente vinculado"
          valor={nomeUsuario(embarque.usuario_id)}
          icone="👤"
        />

        <InfoCard
          titulo="Última atualização"
          valor={
            embarque.ultima_atualizacao
              ? new Date(embarque.ultima_atualizacao).toLocaleString('pt-BR')
              : '-'
          }
          icone="🕒"
        />

        <InfoCard
          titulo="Data de envio"
          valor={
            embarque.data_envio
              ? new Date(embarque.data_envio).toLocaleDateString('pt-BR')
              : '-'
          }
          icone="📤"
        />

        <InfoCard
          titulo="Previsão"
          valor={
            embarque.data_prevista
              ? new Date(embarque.data_prevista).toLocaleDateString('pt-BR')
              : '-'
          }
          icone="📅"
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="text-2xl font-black mb-6">
            Dados comerciais
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <CampoResumo titulo="Exportador" valor={embarque.exportador} />
            <CampoResumo titulo="Importador" valor={embarque.importador} />
            <CampoResumo titulo="Referência Cliente" valor={embarque.referencia_cliente} />
            <CampoResumo titulo="Referência HC Consultoria" valor={embarque.referencia_hc} />
          </div>
        </div>

        <div className="card">
          <h2 className="text-2xl font-black mb-6">
            Dados logísticos
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <CampoResumo titulo="Origem" valor={embarque.origem} />
            <CampoResumo titulo="Destino" valor={embarque.destino} />
            <CampoResumo titulo="Peso real" valor={embarque.peso_real ? `${embarque.peso_real} kg` : '-'} />
            <CampoResumo titulo="Peso taxado" valor={embarque.peso_taxado ? `${embarque.peso_taxado} kg` : '-'} />
          </div>
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-8">
          Progresso do embarque
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Etapa titulo="Coletado" ativo={etapaConcluida('coleta')} />
          <Etapa titulo="Em trânsito" ativo={etapaConcluida('transito')} />
          <Etapa titulo="Fiscalização" ativo={etapaConcluida('fiscalizacao')} />
          <Etapa titulo="Liberado" ativo={etapaConcluida('liberado')} />
          <Etapa titulo="Entregue" ativo={etapaConcluida('entregue')} />
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">
          Rastreio
        </h2>

        <div className="rounded-3xl border border-blue-900 bg-[#020817] p-6">
          <div className="flex flex-col md:flex-row justify-between gap-6 items-start md:items-center">
            <div>
              <p className="text-slate-400 mb-1">Origem</p>
              <h3 className="text-3xl font-black">
                {embarque.origem || '-'}
              </h3>
            </div>

            <div className="text-blue-400 text-4xl">
              ✈️
            </div>

            <div>
              <p className="text-slate-400 mb-1">Destino</p>
              <h3 className="text-3xl font-black">
                {embarque.destino || '-'}
              </h3>
            </div>
          </div>
        </div>

        {linkRastreio() && (
          <a
            href={linkRastreio()}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-yellow-500 hover:bg-yellow-400 px-5 py-3 rounded-xl text-black font-bold inline-block mt-6"
          >
            Abrir rastreio da transportadora
          </a>
        )}
      </section>
            <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">
          Documentos
        </h2>

        <div className="flex items-center gap-4 flex-wrap">
          <label className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl font-bold cursor-pointer">
            {uploading ? 'Enviando...' : 'Enviar documento'}

            <input
              type="file"
              className="hidden"
              onChange={uploadArquivo}
            />
          </label>

          {embarque.documento_url && (
            <a
              href={embarque.documento_url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-bold"
            >
              Abrir documento
            </a>
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="text-2xl font-black mb-8">
          Histórico operacional
        </h2>

        <div className="space-y-5">
          {timeline.length === 0 ? (
            <p className="text-slate-400">
              Nenhuma atualização encontrada.
            </p>
          ) : (
            timeline.map((item, index) => (
              <div
                key={item.id}
                className="relative pl-10"
              >
                <div className="absolute left-3 top-0 bottom-0 w-[2px] bg-blue-900" />

                <div className="absolute left-0 top-2 w-6 h-6 rounded-full bg-blue-600 border-4 border-[#071225]" />

                <div className="border border-blue-900 rounded-2xl bg-[#071225] p-5">
                  <div className="flex flex-col md:flex-row md:justify-between gap-2 mb-3">
                    <strong className="text-blue-400">
                      {item.status}
                    </strong>

                    <span className="text-slate-500 text-sm">
                      {item.criado_em
                        ? new Date(item.criado_em).toLocaleString('pt-BR')
                        : '-'}
                    </span>
                  </div>

                  <p className="text-slate-300">
                    {item.descricao}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  )
}

function InfoCard({
  titulo,
  valor,
  icone,
}: any) {
  return (
    <div className="border border-blue-900 rounded-3xl bg-[#071225] p-5">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-400 text-sm">
            {titulo}
          </p>

          <p className="font-bold mt-3 break-words">
            {valor || '-'}
          </p>
        </div>

        <div className="text-3xl">
          {icone}
        </div>
      </div>
    </div>
  )
}

function CampoResumo({
  titulo,
  valor,
}: any) {
  return (
    <div className="border border-blue-900 rounded-2xl p-4 bg-[#020817]">
      <p className="text-slate-500 text-sm mb-2">
        {titulo}
      </p>

      <p className="font-bold">
        {valor || '-'}
      </p>
    </div>
  )
}

function Etapa({
  titulo,
  ativo,
}: {
  titulo: string
  ativo: boolean
}) {
  return (
    <div
      className={`rounded-3xl p-5 border text-center transition ${
        ativo
          ? 'bg-green-600 border-green-500'
          : 'bg-[#071225] border-blue-900'
      }`}
    >
      <div className="text-3xl mb-3">
        {ativo ? '✔️' : '⏳'}
      </div>

      <p className="font-bold">
        {titulo}
      </p>
    </div>
  )
}