'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function DetalheCotacaoAdminPage() {
  const params = useParams()
  const [cotacao, setCotacao] = useState<any>(null)
  const [documentosCliente, setDocumentosCliente] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [salvandoRef, setSalvandoRef] = useState(false)
  const [referenciaHC, setReferenciaHC] = useState('')
  const [emailEnviado, setEmailEnviado] = useState(false)
  const [enviandoEmail, setEnviandoEmail] = useState(false)
  const [convertendo, setConvertendo] = useState(false)

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

    const { data: docs, error: erroDocs } = await supabase
      .from('cotacao_documentos')
      .select('*')
      .eq('cotacao_id', params.id)
      .order('criado_em', { ascending: false })

    if (erroDocs) {
      console.log(erroDocs)
      setDocumentosCliente([])
      return
    }

    setDocumentosCliente(docs || [])
  }

  function servicoCotacao() {
    return cotacao?.servico || cotacao?.tipo_operacao || '-'
  }

  function transportadorasTexto() {
    const valor = cotacao?.transportadoras_consulta

    if (Array.isArray(valor)) return valor.join(', ')

    if (typeof valor === 'string') {
      try {
        const lista = JSON.parse(valor)
        if (Array.isArray(lista)) return lista.join(', ')
      } catch {}
      return valor
    }

    return '-'
  }

  function pesoRealCotacao() {
    return cotacao?.peso_real || cotacao?.peso || null
  }

  function pesoTaxadoCotacao() {
    return cotacao?.peso_taxado || cotacao?.peso || null
  }

  function numero(valor: any) {
    if (valor === null || valor === undefined || valor === '') return null
    return Number(String(valor).replace(',', '.'))
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
    if (!cotacaoAtualizada?.solicitante_email) {
      alert('E-mail do solicitante não encontrado.')
      return false
    }

    try {
      setEnviandoEmail(true)

      const response = await fetch('/api/enviar-email-cotacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cotacaoAtualizada.solicitante_email,
          nome: cotacaoAtualizada.importador || cotacaoAtualizada.exportador || cotacaoAtualizada.cliente_final,
          referencia_hc: cotacaoAtualizada.referencia_hc,
          link: `${window.location.origin}/cliente/minhas-cotacoes`,
        }),
      })

      const resultado = await response.json().catch(() => null)

      if (!response.ok) {
        console.error(resultado)
        alert('A cotação foi disponibilizada, mas houve erro ao enviar o e-mail.')
        return false
      }

      setEmailEnviado(true)
      return true
    } catch (err) {
      console.error(err)
      alert('A cotação foi disponibilizada, mas houve erro ao enviar o e-mail.')
      return false
    } finally {
      setEnviandoEmail(false)
    }
  }

  async function atualizarStatus(status: string) {
    setEmailEnviado(false)

    const { data, error } = await supabase
      .from('cotacoes')
      .update({
        status,
        referencia_hc: referenciaHC || cotacao?.referencia_hc || null,
      })
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

    setEmailEnviado(false)
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
  }

  async function converterEmEmbarque() {
    if (!cotacao) return

    const confirmar = confirm(
      'Converter esta cotação em embarque?\n\nO embarque será criado com AWB AGUARDANDO AWB e o responsável será o admin logado.'
    )

    if (!confirmar) return

    setConvertendo(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      alert('Admin não identificado. Faça login novamente.')
      setConvertendo(false)
      return
    }

    const { data: perfilAdmin } = await supabase
      .from('perfis')
      .select('nome, email')
      .eq('id', user.id)
      .single()

    const exportador = cotacao.exportador || cotacao.cliente_final || null
    const importador = cotacao.importador || null
    const servico = cotacao.servico || cotacao.tipo_operacao || null
    const pesoReal = numero(cotacao.peso_real || cotacao.peso)
    const pesoTaxado = numero(cotacao.peso_taxado || cotacao.peso)

    const transportadoraSelecionada =
      transportadorasTexto() !== '-'
        ? transportadorasTexto()
        : 'AGENTE DE CARGA'

    const { data: novoEmbarque, error } = await supabase
      .from('embarques')
      .insert([
        {
          usuario_id: cotacao.usuario_id || null,
          cliente_final: importador || exportador || null,

          criado_por_admin_id: user.id,
          criado_por_admin_nome: perfilAdmin?.nome || user.email || null,
          criado_por_admin_email: perfilAdmin?.email || user.email || null,

          responsavel_id: user.id,
          responsavel_nome: perfilAdmin?.nome || user.email || null,
          responsavel_email: perfilAdmin?.email || user.email || null,

          exportador,
          importador,
          referencia_cliente: cotacao.referencia_cliente || null,
          referencia_hc: referenciaHC || cotacao.referencia_hc || null,

          awb: 'AGUARDANDO AWB',
          transportadora: transportadoraSelecionada,
          servico,
          origem: cotacao.origem || null,
          destino: cotacao.destino || null,

          peso_real: pesoReal,
          peso_taxado: pesoTaxado,

          status_operacional: 'COTAÇÃO APROVADA',
          data_envio: null,
          data_prevista: null,
          ultima_atualizacao: new Date().toISOString(),
          observacoes: `
Embarque criado a partir da cotação.

Serviço: ${servico || '-'}
Transportadoras consultadas: ${transportadorasTexto()}
Valor mercadoria: ${cotacao.moeda || ''} ${cotacao.valor_mercadoria || '-'}
Descrição: ${cotacao.descricao_mercadoria || '-'}
Observações do cliente: ${cotacao.observacoes || '-'}
          `.trim(),
        },
      ])
      .select()
      .single()

    if (error) {
      setConvertendo(false)
      console.log(error)
      alert(error.message)
      return
    }

    for (const doc of documentosCliente) {
      await supabase.from('documentos_embarques').insert([
        {
          embarque_id: novoEmbarque.id,
          nome: doc.nome,
          url: doc.url,
          caminho: doc.caminho || null,
        },
      ])
    }

    await supabase
      .from('cotacoes')
      .update({
        status: 'CONVERTIDA EM EMBARQUE',
        embarque_id: novoEmbarque.id,
        referencia_hc: referenciaHC || cotacao.referencia_hc || null,
      })
      .eq('id', cotacao.id)

    await supabase.from('timeline_embarques').insert([
      {
        embarque_id: novoEmbarque.id,
        status: 'CRIADO POR COTAÇÃO',
        descricao: 'Embarque criado automaticamente a partir de uma cotação aprovada.',
      },
    ])

    setConvertendo(false)

    alert('Embarque criado com sucesso. Agora informe AWB, transportadora vencedora e previsão no cadastro de embarques.')
    window.location.href = `/admin/embarques/${novoEmbarque.id}`
  }

  function formatarTamanho(bytes?: number) {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  if (!cotacao) {
    return <main className="p-10 text-white">Carregando cotação...</main>
  }

  return (
    <main className="w-full max-w-none p-8 text-white">
      <div className="mb-8 flex flex-col lg:flex-row justify-between gap-5">
        <div>
          <h1 className="text-5xl font-black mb-2">Cotação</h1>
          <p className="text-slate-400 text-lg">
            Detalhes completos da solicitação.
          </p>
        </div>

        <a
          href="/admin/cotacoes"
          className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold h-fit"
        >
          Voltar para fila
        </a>
      </div>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">Resumo</h2>

        <div className="form-grid">
          <div>
            <strong className="text-slate-400">Solicitante</strong>
            <p>{cotacao.solicitante_email || '-'}</p>
          </div>

          <div>
            <strong className="text-slate-400">Referência cliente</strong>
            <p>{cotacao.referencia_cliente || '-'}</p>
          </div>

          <div>
            <strong className="text-slate-400">Status</strong>
            <p>{cotacao.status}</p>
          </div>

          <div>
            <strong className="text-slate-400">Arquivo resposta HC</strong>
            <p>{cotacao.pdf_nome || 'Nenhum PDF anexado'}</p>
          </div>
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">Dados da operação</h2>

        <div className="form-grid">
          <Info titulo="Exportador" valor={cotacao.exportador || cotacao.cliente_final || '-'} />
          <Info titulo="Importador" valor={cotacao.importador || '-'} />
          <Info titulo="Serviço" valor={servicoCotacao()} />
          <Info titulo="Transportadoras consultadas" valor={transportadorasTexto()} />
          <Info titulo="Origem" valor={cotacao.origem || '-'} />
          <Info titulo="Destino" valor={cotacao.destino || '-'} />
          <Info titulo="Peso real" valor={pesoRealCotacao() ? `${pesoRealCotacao()} kg` : '-'} />
          <Info titulo="Peso taxado" valor={pesoTaxadoCotacao() ? `${pesoTaxadoCotacao()} kg` : '-'} />
          <Info titulo="Dimensões gerais" valor={cotacao.dimensoes || '-'} />
          <Info titulo="Valor da mercadoria" valor={`${cotacao.moeda || ''} ${cotacao.valor_mercadoria || '-'}`} />
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">
          Documentos enviados pelo cliente
        </h2>

        {documentosCliente.length === 0 ? (
          <p className="text-slate-400">
            Nenhum documento enviado pelo cliente.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {documentosCliente.map((doc) => (
              <div
                key={doc.id}
                className="border border-blue-900 rounded-2xl p-5 bg-[#071225]"
              >
                <p className="font-black text-white mb-2">
                  📎 {doc.nome || 'Documento'}
                </p>

                <p className="text-slate-400 text-sm mb-4">
                  {formatarTamanho(doc.tamanho)}
                </p>

                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-xl text-white font-bold inline-block"
                >
                  Abrir documento
                </a>
              </div>
            ))}
          </div>
        )}
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
            disabled={enviandoEmail}
            className="bg-emerald-600 hover:bg-emerald-500 px-5 py-3 rounded-xl font-bold disabled:opacity-60"
          >
            {enviandoEmail
              ? 'Enviando e-mail...'
              : 'Disponibilizar cotação e notificar cliente'}
          </button>
        </div>

        {emailEnviado && (
          <div className="mt-4 bg-blue-900/30 border border-blue-500 rounded-xl p-4">
            <p className="text-blue-400 font-bold">
              E-mail enviado com sucesso
            </p>
          </div>
        )}
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

          {(cotacao.status === 'APROVADA' || cotacao.status === 'AUTORIZADA') && (
            <button
              onClick={converterEmEmbarque}
              disabled={convertendo}
              className="bg-green-700 hover:bg-green-600 disabled:opacity-60"
            >
              {convertendo ? 'Convertendo...' : '🚚 Converter em embarque'}
            </button>
          )}
        </div>
      </section>
    </main>
  )
}

function Info({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <strong className="text-slate-400">{titulo}</strong>
      <p>{valor || '-'}</p>
    </div>
  )
}
