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
  const [salvando, setSalvando] = useState(false)

  const [form, setForm] = useState<any>({
    usuario_id: '',
    cliente_final: '',
    awb: '',
    transportadora: '',
    servico: '',
    origem: '',
    destino: '',
    peso_real: '',
    peso_taxado: '',
    status_operacional: '',
    data_envio: '',
    data_prevista: '',
    observacoes: '',
  })

  const [novoStatus, setNovoStatus] = useState('')
  const [novaDescricao, setNovaDescricao] = useState('')

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

    setForm({
      usuario_id: data?.usuario_id || '',
      cliente_final: data?.cliente_final || '',
      awb: data?.awb || '',
      transportadora: data?.transportadora || '',
      servico: data?.servico || '',
      origem: data?.origem || '',
      destino: data?.destino || '',
      peso_real: data?.peso_real || '',
      peso_taxado: data?.peso_taxado || '',
      status_operacional: data?.status_operacional || '',
      data_envio: data?.data_envio || '',
      data_prevista: data?.data_prevista || '',
      observacoes: data?.observacoes || '',
    })

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
    if (!form.awb || form.awb === 'AGUARDANDO AWB') return ''

    if ((form.transportadora || '').toUpperCase().includes('DHL')) {
      return `https://mydhl.express.dhl/br/pt/tracking.html#/results?id=${form.awb}`
    }

    return ''
  }

  async function salvarAlteracoes() {
    if (!embarque) return

    if (!form.awb) {
      alert('Informe o AWB')
      return
    }

    setSalvando(true)

    const usuarioSelecionado = usuarios.find(
      (usuario) => usuario.id === form.usuario_id
    )

    const { error } = await supabase
      .from('embarques')
      .update({
        usuario_id: form.usuario_id || null,
        empresa_id: usuarioSelecionado?.empresa_id || null,
        cliente_final: form.cliente_final,
        awb: form.awb,
        transportadora: form.transportadora,
        servico: form.servico,
        origem: form.origem,
        destino: form.destino,
        peso_real: form.peso_real,
        peso_taxado: form.peso_taxado,
        status_operacional: form.status_operacional,
        data_envio: form.data_envio || null,
        data_prevista: form.data_prevista || null,
        observacoes: form.observacoes,
        ultima_atualizacao: new Date().toISOString(),
      })
      .eq('id', embarque.id)

    setSalvando(false)

    if (error) {
      alert('Erro ao salvar alterações')
      console.log(error)
      return
    }

    await supabase.from('timeline_embarques').insert({
      embarque_id: embarque.id,
      status: form.status_operacional,
      descricao: 'Dados do embarque atualizados pela HC Consultoria.',
    })

    alert('Embarque atualizado com sucesso')
    carregar()
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

  async function adicionarTimeline() {
    if (!novoStatus || !novaDescricao) {
      alert('Preencha status e descrição')
      return
    }

    const { error } = await supabase.from('timeline_embarques').insert({
      embarque_id: embarque.id,
      status: novoStatus,
      descricao: novaDescricao,
    })

    if (error) {
      alert('Erro ao adicionar atualização')
      console.log(error)
      return
    }

    await supabase
      .from('embarques')
      .update({
        status_operacional: novoStatus,
        ultima_atualizacao: new Date().toISOString(),
      })
      .eq('id', embarque.id)

    setNovoStatus('')
    setNovaDescricao('')

    carregar()
  }

  if (!embarque) {
    return <main className="p-10 text-white">Carregando embarque...</main>
  }

  return (
    <main className="max-w-7xl mx-auto p-8 text-white">
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold">
            AWB {embarque.awb}
          </h1>

          <p className="text-slate-400 mt-2">
            Gerenciamento completo do embarque.
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          {linkRastreio() && (
            <a
              href={linkRastreio()}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-yellow-500 hover:bg-yellow-400 px-5 py-3 rounded-xl text-black font-bold"
            >
              Rastrear na DHL
            </a>
          )}

          <button
            onClick={salvarAlteracoes}
            disabled={salvando}
            className="bg-green-600 hover:bg-green-500"
          >
            {salvando ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">
          Resumo operacional
        </h2>

        <div className="form-grid">
          <div>
            <strong className="text-slate-400">Cliente vinculado</strong>
            <p>{nomeUsuario(form.usuario_id)}</p>
          </div>

          <div>
            <strong className="text-slate-400">Status</strong>
            <div className="mt-2">
              <StatusBadge status={form.status_operacional} />
            </div>
          </div>

          <div>
            <strong className="text-slate-400">Última atualização</strong>
            <p>
              {embarque.ultima_atualizacao
                ? new Date(embarque.ultima_atualizacao).toLocaleString('pt-BR')
                : '-'}
            </p>
          </div>

          <div>
            <strong className="text-slate-400">Transportadora</strong>
            <p>{form.transportadora || '-'}</p>
          </div>
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">
          Editar embarque
        </h2>

        <div className="form-grid">
          <select
            value={form.usuario_id}
            onChange={(e) =>
              setForm({
                ...form,
                usuario_id: e.target.value,
              })
            }
          >
            <option value="">
              Sem cliente vinculado
            </option>

            {usuarios.map((usuario) => (
              <option
                key={usuario.id}
                value={usuario.id}
              >
                {usuario.nome || usuario.email}
              </option>
            ))}
          </select>

          <input
            placeholder="Cliente final"
            value={form.cliente_final}
            onChange={(e) =>
              setForm({
                ...form,
                cliente_final: e.target.value,
              })
            }
          />

          <input
            placeholder="AWB"
            value={form.awb}
            onChange={(e) =>
              setForm({
                ...form,
                awb: e.target.value,
              })
            }
          />

          <select
            value={form.transportadora}
            onChange={(e) =>
              setForm({
                ...form,
                transportadora: e.target.value,
              })
            }
          >
            <option value="">Transportadora</option>
            <option value="DHL">DHL</option>
            <option value="FedEx">FedEx</option>
            <option value="UPS">UPS</option>
            <option value="Outra">Outra</option>
          </select>

          <input
            placeholder="Serviço"
            value={form.servico}
            onChange={(e) =>
              setForm({
                ...form,
                servico: e.target.value,
              })
            }
          />

          <input
            placeholder="Origem"
            value={form.origem}
            onChange={(e) =>
              setForm({
                ...form,
                origem: e.target.value,
              })
            }
          />

          <input
            placeholder="Destino"
            value={form.destino}
            onChange={(e) =>
              setForm({
                ...form,
                destino: e.target.value,
              })
            }
          />

          <input
            placeholder="Peso real"
            value={form.peso_real}
            onChange={(e) =>
              setForm({
                ...form,
                peso_real: e.target.value,
              })
            }
          />

          <input
            placeholder="Peso taxado"
            value={form.peso_taxado}
            onChange={(e) =>
              setForm({
                ...form,
                peso_taxado: e.target.value,
              })
            }
          />

          <select
            value={form.status_operacional}
            onChange={(e) =>
              setForm({
                ...form,
                status_operacional: e.target.value,
              })
            }
          >
            <option value="">Status</option>
            <option value="Em trânsito">Em trânsito</option>
            <option value="Fiscalização">Fiscalização</option>
            <option value="Liberado">Liberado</option>
            <option value="Entregue">Entregue</option>
            <option value="Atrasado">Atrasado</option>
            <option value="Aguardando AWB">Aguardando AWB</option>
          </select>

          <input
            type="date"
            value={form.data_envio}
            onChange={(e) =>
              setForm({
                ...form,
                data_envio: e.target.value,
              })
            }
          />

          <input
            type="date"
            value={form.data_prevista}
            onChange={(e) =>
              setForm({
                ...form,
                data_prevista: e.target.value,
              })
            }
          />
        </div>

        <textarea
          placeholder="Observações do embarque"
          value={form.observacoes}
          onChange={(e) =>
            setForm({
              ...form,
              observacoes: e.target.value,
            })
          }
          className="mt-5 min-h-[120px]"
        />

        <button
          onClick={salvarAlteracoes}
          disabled={salvando}
          className="mt-6 bg-green-600 hover:bg-green-500"
        >
          {salvando ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </section>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">
          Rastreio
        </h2>

        <div className="form-grid">
          <div>
            <strong className="text-slate-400">AWB</strong>
            <p>{form.awb || '-'}</p>
          </div>

          <div>
            <strong className="text-slate-400">Transportadora</strong>
            <p>{form.transportadora || '-'}</p>
          </div>

          <div>
            <strong className="text-slate-400">Data envio</strong>
            <p>
              {form.data_envio
                ? new Date(form.data_envio).toLocaleDateString('pt-BR')
                : '-'}
            </p>
          </div>

          <div>
            <strong className="text-slate-400">Previsão</strong>
            <p>
              {form.data_prevista
                ? new Date(form.data_prevista).toLocaleDateString('pt-BR')
                : '-'}
            </p>
          </div>
        </div>

        {linkRastreio() && (
          <a
            href={linkRastreio()}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-yellow-500 hover:bg-yellow-400 px-5 py-3 rounded-xl text-black font-bold inline-block mt-6"
          >
            Rastrear na DHL
          </a>
        )}
      </section>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">
          Documentos
        </h2>

        <div className="flex items-center gap-4 flex-wrap">
          <label className="btn-primary cursor-pointer">
            {uploading ? 'Enviando...' : 'Enviar documento'}
            <input type="file" className="hidden" onChange={uploadArquivo} />
          </label>

          {embarque.documento_url && (
            <a
              href={embarque.documento_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              Abrir documento
            </a>
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="text-2xl font-black mb-6">
          Timeline operacional
        </h2>

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
          {timeline.length === 0 ? (
            <p className="text-slate-400">
              Nenhuma atualização na timeline.
            </p>
          ) : (
            timeline.map((item) => (
              <div
                key={item.id}
                className="border border-blue-900 rounded-2xl p-4 bg-[#071225]"
              >
                <div className="flex items-center justify-between mb-2">
                  <strong>{item.status}</strong>

                  <span className="text-slate-500 text-sm">
                    {new Date(item.criado_em).toLocaleString('pt-BR')}
                  </span>
                </div>

                <p className="text-slate-300">{item.descricao}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  )
}