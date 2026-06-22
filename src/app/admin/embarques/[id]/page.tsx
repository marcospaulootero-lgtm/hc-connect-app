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
  const [rastreioReal, setRastreioReal] = useState<any[]>([])
  const [documentos, setDocumentos] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [atualizandoRastreio, setAtualizandoRastreio] = useState(false)

  const [editandoStatus, setEditandoStatus] = useState(false)
  const [novoStatus, setNovoStatus] = useState('')
  const [descricaoStatus, setDescricaoStatus] = useState('')
  const [salvandoStatus, setSalvandoStatus] = useState(false)

  const [masterNumero, setMasterNumero] = useState('')
  const [salvandoMaster, setSalvandoMaster] = useState(false)

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
    setMasterNumero(data.master || '')

    const { data: timelineData } = await supabase
      .from('timeline_embarques')
      .select('*')
      .eq('embarque_id', params.id)
      .order('criado_em', { ascending: false })

    setTimeline(timelineData || [])

    const { data: rastreioData } = await supabase
      .from('rastreios_embarques')
      .select('*')
      .eq('embarque_id', params.id)
      .order('data_evento', { ascending: false })

    setRastreioReal(rastreioData || [])

    const { data: documentosData, error: documentosError } = await supabase
      .from('documentos_embarques')
      .select('*')
      .eq('embarque_id', params.id)
      .order('criado_em', { ascending: false })

    if (documentosError) {
      console.log(documentosError)
    }

    setDocumentos(documentosData || [])
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

  async function atualizarStatus(statusManual?: string) {
    if (!embarque) return

    const statusFinal = statusManual || novoStatus

    if (!statusFinal) {
      alert('Selecione um status')
      return
    }

    setSalvandoStatus(true)

    const dadosAtualizar: any = {
      status_operacional: statusFinal,
      ultima_atualizacao: new Date().toISOString(),
    }

    if (statusFinal === 'Coletado' && !embarque.data_envio) {
      dadosAtualizar.data_envio = new Date().toISOString().split('T')[0]
    }

    if (statusFinal === 'Entregue') {
      dadosAtualizar.data_entrega = new Date().toISOString().split('T')[0]
    }

    const { error } = await supabase
      .from('embarques')
      .update(dadosAtualizar)
      .eq('id', embarque.id)

    if (error) {
      alert(`Erro ao atualizar status: ${error.message}`)
      console.log(error)
      setSalvandoStatus(false)
      return
    }

    const { error: erroTimeline } = await supabase.from('timeline_embarques').insert({
      embarque_id: embarque.id,
      status: statusFinal,
      descricao:
        descricaoStatus ||
        `Status atualizado para ${statusFinal} pela HC Consultoria.`,
    })

    if (erroTimeline) {
      alert(`Status atualizado, mas houve erro ao gravar timeline: ${erroTimeline.message}`)
      console.log(erroTimeline)
    }

    setNovoStatus('')
    setDescricaoStatus('')
    setEditandoStatus(false)
    setSalvandoStatus(false)

    await carregar()
  }

  async function salvarMaster() {
    if (!embarque) return

    const masterLimpo = masterNumero.trim()

    setSalvandoMaster(true)

    const dadosAtualizar: any = {
      master: masterLimpo || null,
      data_master: masterLimpo ? embarque.data_master || new Date().toISOString() : null,
      ultima_atualizacao: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('embarques')
      .update(dadosAtualizar)
      .eq('id', embarque.id)

    if (error) {
      alert(`Erro ao salvar master: ${error.message}`)
      console.log(error)
      setSalvandoMaster(false)
      return
    }

    await supabase.from('timeline_embarques').insert({
      embarque_id: embarque.id,
      status: 'MASTER',
      descricao: masterLimpo
        ? `Master informado: ${masterLimpo}`
        : 'Master removido do embarque.',
    })

    setSalvandoMaster(false)
    await carregar()
    alert(masterLimpo ? 'Master salvo com sucesso.' : 'Master removido com sucesso.')
  }

  async function atualizarRastreio() {
  if (!embarque?.id) {
    alert('Embarque não encontrado.')
    return
  }

  setAtualizandoRastreio(true)

  try {
    const response = await fetch('/api/rastreio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embarque_id: embarque.id,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      const detalhes = String(data.detalhes || '')

      if (
        detalhes.includes('Too Many Requests') ||
        detalhes.includes('429')
      ) {
        alert(
          'A DHL bloqueou temporariamente novas consultas por excesso de requisições.\n\nTente novamente em alguns minutos.'
        )
        return
      }

      alert(data.error || 'Erro ao atualizar rastreio.')
      return
    }

    alert(`Rastreio atualizado: ${data.status}`)

    await carregar()
  } catch (error) {
    alert('Erro ao atualizar rastreio.')
  } finally {
    setAtualizandoRastreio(false)
  }
}

  async function uploadArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]

    if (!file || !embarque) return

    setUploading(true)

    const nomeArquivo = `${embarque.id}/${Date.now()}-${file.name}`

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

    const { data } = supabase.storage.from('documentos').getPublicUrl(nomeArquivo)

    const { error: insertError } = await supabase
      .from('documentos_embarques')
      .insert({
        embarque_id: embarque.id,
        nome: file.name,
        url: data.publicUrl,
        caminho: nomeArquivo,
      })

    if (insertError) {
      console.log('ERRO DOCUMENTO:', insertError)

      alert(
        `${insertError.message}\n\n${insertError.details || ''}\n\n${insertError.hint || ''}`
      )

      setUploading(false)
      return
    }

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

    e.target.value = ''
    setUploading(false)
    await carregar()

    alert('Arquivo enviado com sucesso')
  }

  async function excluirDocumento(documento: any) {
    const confirmar = confirm(`Deseja excluir o documento "${documento.nome}"?`)
    if (!confirmar) return

    if (documento.caminho) {
      await supabase.storage.from('documentos').remove([documento.caminho])
    }

    const { error } = await supabase
      .from('documentos_embarques')
      .delete()
      .eq('id', documento.id)

    if (error) {
      alert('Erro ao excluir documento')
      console.log(error)
      return
    }

    await supabase.from('timeline_embarques').insert({
      embarque_id: embarque.id,
      status: 'DOCUMENTO',
      descricao: `Documento excluído: ${documento.nome}`,
    })

    await carregar()
  }

  function etapaConcluida(etapa: string) {
  const status = String(embarque?.status_operacional || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (etapa === 'aguardando_coleta') {
    return (
      status.includes('aguardando coleta') ||
      status.includes('etiqueta gerada') ||
      status.includes('coletado') ||
      status.includes('em transito') ||
      status.includes('fiscalizacao') ||
      status.includes('liberado') ||
      status.includes('entregue')
    )
  }

  if (etapa === 'coleta') {
    return (
      status.includes('coletado') ||
      status.includes('em transito') ||
      status.includes('fiscalizacao') ||
      status.includes('liberado') ||
      status.includes('entregue')
    )
  }

  if (etapa === 'transito') {
    return (
      status.includes('em transito') ||
      status.includes('fiscalizacao') ||
      status.includes('liberado') ||
      status.includes('entregue')
    )
  }

  if (etapa === 'fiscalizacao') {
    return (
      status.includes('fiscalizacao') ||
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
            <p className="text-blue-400 font-bold mb-2">Detalhe do embarque</p>

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

            <button
              onClick={atualizarRastreio}
              disabled={atualizandoRastreio}
              className="bg-purple-600 hover:bg-purple-500 px-5 py-3 rounded-xl font-bold disabled:opacity-60"
            >
              {atualizandoRastreio ? 'Atualizando...' : '🔄 Atualizar rastreio'}
            </button>

            <button
              onClick={() => {
                setNovoStatus(embarque.status_operacional || '')
                setEditandoStatus(!editandoStatus)
              }}
              className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl font-bold"
            >
              Alterar status
            </button>

            <button
              onClick={() => atualizarStatus('Entregue')}
              disabled={salvandoStatus}
              className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-bold disabled:opacity-60"
            >
              Finalizar
            </button>
          </div>
        </div>
      </header>

      {editandoStatus && (
        <section className="card mb-8">
          <h2 className="text-2xl font-black mb-6">Alterar status do embarque</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <select value={novoStatus} onChange={(e) => setNovoStatus(e.target.value)}>
              <option value="">Selecione o status</option>
              <option value="Aguardando coleta">Aguardando coleta</option>
              <option value="Coletado">Coletado</option>
              <option value="Em trânsito">Em trânsito</option>
              <option value="Fiscalização">Fiscalização</option>
              <option value="Liberado">Liberado</option>
              <option value="Entregue">Entregue</option>
              <option value="Atrasado">Atrasado</option>
              <option value="Aguardando AWB">Aguardando AWB</option>
            </select>

            <input
              placeholder="Observação opcional"
              value={descricaoStatus}
              onChange={(e) => setDescricaoStatus(e.target.value)}
            />

            <button
              onClick={() => atualizarStatus()}
              disabled={salvandoStatus}
              className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-bold disabled:opacity-60"
            >
              {salvandoStatus ? 'Salvando...' : 'Salvar status'}
            </button>
          </div>
        </section>
      )}

      <section className="card mb-8">
        <div className="flex flex-col lg:flex-row justify-between gap-6">
          <div>
            <p className="text-blue-400 font-bold mb-2">Master do processo</p>
            <h2 className="text-2xl font-black mb-2">Número master</h2>
            <p className="text-slate-400">
              Informe o master quando o processo formal sair da origem e o número for gerado.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-3 w-full lg:max-w-2xl">
            <input
              value={masterNumero}
              onChange={(e) => setMasterNumero(e.target.value)}
              placeholder="Digite o número master"
              className="flex-1"
            />

            <button
              onClick={salvarMaster}
              disabled={salvandoMaster}
              className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-bold disabled:opacity-60"
            >
              {salvandoMaster ? 'Salvando...' : 'Salvar master'}
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-8">
        <InfoCard titulo="Cliente vinculado" valor={nomeUsuario(embarque.usuario_id)} icone="👤" />

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
          titulo="Master"
          valor={embarque.master || 'Aguardando geração'}
          icone="🧾"
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
          <h2 className="text-2xl font-black mb-6">Dados comerciais</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <CampoResumo titulo="Exportador" valor={embarque.exportador} />
            <CampoResumo titulo="Importador" valor={embarque.importador} />
            <CampoResumo titulo="Referência Cliente" valor={embarque.referencia_cliente} />
            <CampoResumo titulo="Referência HC Consultoria" valor={embarque.referencia_hc} />
          </div>
        </div>

        <div className="card">
          <h2 className="text-2xl font-black mb-6">Dados logísticos</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <CampoResumo titulo="Origem" valor={embarque.origem} />
            <CampoResumo titulo="Destino" valor={embarque.destino} />
            <CampoResumo titulo="Master" valor={embarque.master || 'Aguardando geração'} />
            <CampoResumo titulo="Peso real" valor={embarque.peso_real ? `${embarque.peso_real} kg` : '-'} />
            <CampoResumo titulo="Peso taxado" valor={embarque.peso_taxado ? `${embarque.peso_taxado} kg` : '-'} />
          </div>
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-8">Progresso do embarque</h2>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
  <Etapa titulo="Aguardando coleta" ativo={etapaConcluida('aguardando_coleta')} />
  <Etapa titulo="Coletado" ativo={etapaConcluida('coleta')} />
  <Etapa titulo="Em trânsito" ativo={etapaConcluida('transito')} />
  <Etapa titulo="Fiscalização" ativo={etapaConcluida('fiscalizacao')} />
  <Etapa titulo="Liberado" ativo={etapaConcluida('liberado')} />
  <Etapa titulo="Entregue" ativo={etapaConcluida('entregue')} />
</div>
      </section>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">Rastreio</h2>

        <div className="rounded-3xl border border-blue-900 bg-[#020817] p-6">
          <div className="flex flex-col md:flex-row justify-between gap-6 items-start md:items-center">
            <div>
              <p className="text-slate-400 mb-1">Origem</p>
              <h3 className="text-3xl font-black">{embarque.origem || '-'}</h3>
            </div>

            <div className="text-blue-400 text-4xl">✈️</div>

            <div>
              <p className="text-slate-400 mb-1">Destino</p>
              <h3 className="text-3xl font-black">{embarque.destino || '-'}</h3>
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
        <div className="flex justify-between items-center gap-4 flex-wrap mb-8">
          <div>
            <h2 className="text-2xl font-black">🌍 Timeline da transportadora</h2>
            <p className="text-slate-400 mt-1">
              Eventos reais importados do rastreio FedEx, DHL ou UPS.
            </p>
          </div>

          <span className="bg-purple-600/20 border border-purple-500 text-purple-300 px-4 py-2 rounded-full text-sm font-bold">
            {rastreioReal.length} evento(s)
          </span>
        </div>

        {rastreioReal.length === 0 ? (
          <div className="border border-blue-900 bg-[#020817] rounded-2xl p-5 text-slate-400">
            Nenhum evento carregado ainda. Clique em “Atualizar rastreio”.
          </div>
        ) : (
          <div className="space-y-5">
            {rastreioReal.map((evento, index) => (
              <div key={evento.id} className="relative pl-10">
                <div className="absolute left-3 top-0 bottom-0 w-[2px] bg-blue-900" />

                <div
                  className={`absolute left-0 top-2 w-6 h-6 rounded-full border-4 border-[#071225] ${
                    index === 0 ? 'bg-green-600' : 'bg-blue-600'
                  }`}
                />

                <div className="border border-blue-900 rounded-2xl bg-[#020817] p-5">
                  <div className="flex flex-col md:flex-row md:justify-between gap-4 mb-3">
                    <div>
                      <strong className="text-blue-400 text-lg">
                        {evento.status || 'Evento'}
                      </strong>

                      <p className="text-slate-300 mt-2">
                        {evento.descricao || '-'}
                      </p>

                      <p className="text-slate-500 text-sm mt-2">
                        📍 {evento.localizacao || 'Localização não informada'}
                      </p>
                    </div>

                    <span className="text-slate-500 text-sm whitespace-nowrap">
                      {evento.data_evento
                        ? new Date(evento.data_evento).toLocaleString('pt-BR')
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card mb-8">
        <div className="flex justify-between items-center gap-4 flex-wrap mb-6">
          <div>
            <h2 className="text-2xl font-black">Documentos</h2>
            <p className="text-slate-400 mt-1">
              {documentos.length} documento(s) anexado(s)
            </p>
          </div>

          <label className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl font-bold cursor-pointer">
            {uploading ? 'Enviando...' : 'Enviar documento'}

            <input type="file" className="hidden" onChange={uploadArquivo} disabled={uploading} />
          </label>
        </div>

        {documentos.length === 0 ? (
          <div className="border border-blue-900 bg-[#020817] rounded-2xl p-5 text-slate-400">
            Nenhum documento anexado ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {documentos.map((documento) => (
              <div
                key={documento.id}
                className="border border-blue-900 bg-[#020817] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <p className="font-black text-white break-all">📎 {documento.nome}</p>
                  <p className="text-slate-500 text-sm mt-1">
                    Enviado em{' '}
                    {documento.criado_em
                      ? new Date(documento.criado_em).toLocaleString('pt-BR')
                      : '-'}
                  </p>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <a
                    href={documento.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-xl font-bold"
                  >
                    Abrir
                  </a>

                  <button
                    onClick={() => excluirDocumento(documento)}
                    className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded-xl font-bold"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="text-2xl font-black mb-8">Histórico operacional HC</h2>

        <div className="space-y-5">
          {timeline.length === 0 ? (
            <p className="text-slate-400">Nenhuma atualização encontrada.</p>
          ) : (
            timeline.map((item) => (
              <div key={item.id} className="relative pl-10">
                <div className="absolute left-3 top-0 bottom-0 w-[2px] bg-blue-900" />
                <div className="absolute left-0 top-2 w-6 h-6 rounded-full bg-blue-600 border-4 border-[#071225]" />

                <div className="border border-blue-900 rounded-2xl bg-[#071225] p-5">
                  <div className="flex flex-col md:flex-row md:justify-between gap-2 mb-3">
                    <strong className="text-blue-400">{item.status}</strong>

                    <span className="text-slate-500 text-sm">
                      {item.criado_em
                        ? new Date(item.criado_em).toLocaleString('pt-BR')
                        : '-'}
                    </span>
                  </div>

                  <p className="text-slate-300">{item.descricao}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  )
}

function InfoCard({ titulo, valor, icone }: any) {
  return (
    <div className="border border-blue-900 rounded-3xl bg-[#071225] p-5">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-400 text-sm">{titulo}</p>
          <p className="font-bold mt-3 break-words">{valor || '-'}</p>
        </div>

        <div className="text-3xl">{icone}</div>
      </div>
    </div>
  )
}

function CampoResumo({ titulo, valor }: any) {
  return (
    <div className="border border-blue-900 rounded-2xl p-4 bg-[#020817]">
      <p className="text-slate-500 text-sm mb-2">{titulo}</p>
      <p className="font-bold">{valor || '-'}</p>
    </div>
  )
}

function Etapa({ titulo, ativo }: { titulo: string; ativo: boolean }) {
  return (
    <div
      className={`rounded-3xl p-5 border text-center transition ${
        ativo ? 'bg-green-600 border-green-500' : 'bg-[#071225] border-blue-900'
      }`}
    >
      <div className="text-3xl mb-3">{ativo ? '✔️' : '⏳'}</div>
      <p className="font-bold">{titulo}</p>
    </div>
  )
}