'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useParams } from 'next/navigation'
import StatusBadge from '@/components/StatusBadge'

type Documento = {
  id: string
  nome: string
  url: string
  caminho?: string | null
  criado_em?: string | null
}

type TimelineItem = {
  id: string
  status: string
  descricao: string
  criado_em: string
}

type Fatura = {
  id: string
  vencimento: string | null
  arquivo_pdf: string | null
  recibo_pdf: string | null
  recibo_nome?: string | null
  data_pagamento?: string | null
  comprovante_pagamento?: string | null
  data_comprovante?: string | null
  status_pagamento?: string | null
  observacao_pagamento?: string | null
  criado_em: string
}

export default function DetalheCliente() {
  const params = useParams()

  const [embarque, setEmbarque] = useState<any>(null)
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [faturas, setFaturas] = useState<Fatura[]>([])
  const [arquivoSelecionado, setArquivoSelecionado] = useState<Record<string, File | null>>({})
  const [enviandoComprovante, setEnviandoComprovante] = useState<Record<string, boolean>>({})

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    const { data, error } = await supabase
      .from('embarques')
      .select(`
        *,
        empresas (
          razao_social
        )
      `)
      .eq('id', params.id)
      .single()

    if (error) {
      console.log(error)
      return
    }

    setEmbarque(data)

    const { data: docs, error: docsError } = await supabase
      .from('documentos_embarques')
      .select('*')
      .eq('embarque_id', params.id)
      .order('criado_em', { ascending: false })

    if (docsError) {
      console.log(docsError)
    }

    const documentosOrdenados = [...(docs || [])].sort((a, b) => {
      const aConhecimento = documentoEhConhecimento(a) ? 1 : 0
      const bConhecimento = documentoEhConhecimento(b) ? 1 : 0

      if (aConhecimento !== bConhecimento) {
        return bConhecimento - aConhecimento
      }

      const dataA = new Date(a.criado_em || 0).getTime()
      const dataB = new Date(b.criado_em || 0).getTime()

      return dataB - dataA
    })

    setDocumentos(documentosOrdenados)

    const { data: timelineData, error: timelineError } = await supabase
      .from('timeline_embarques')
      .select('*')
      .eq('embarque_id', params.id)
      .order('criado_em', { ascending: false })

    if (timelineError) {
      console.log(timelineError)
    }

    setTimeline(timelineData || [])

    const { data: faturasData, error: erroFaturas } = await supabase
      .from('faturas')
      .select(`
        id,
        vencimento,
        arquivo_pdf,
        recibo_pdf,
        recibo_nome,
        data_pagamento,
        comprovante_pagamento,
        data_comprovante,
        status_pagamento,
        observacao_pagamento,
        criado_em
      `)
      .eq('embarque_id', params.id)
      .eq('visivel_cliente', true)
      .order('criado_em', { ascending: false })

    if (erroFaturas) {
      console.log(erroFaturas)
    }

    setFaturas(faturasData || [])
  }

  async function enviarComprovante(fatura: Fatura) {
    const arquivo = arquivoSelecionado[fatura.id]

    if (!arquivo) {
      alert('Selecione o comprovante de pagamento.')
      return
    }

    const tiposPermitidos = ['application/pdf', 'image/jpeg', 'image/png']

    if (!tiposPermitidos.includes(arquivo.type)) {
      alert('Envie apenas PDF, JPG ou PNG.')
      return
    }

    setEnviandoComprovante((prev) => ({ ...prev, [fatura.id]: true }))

    try {
      const extensao = arquivo.name.split('.').pop() || 'pdf'
      const nomeArquivo = `comprovantes/${fatura.id}/${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${extensao}`

      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(nomeArquivo, arquivo, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError) {
        console.log('ERRO UPLOAD COMPROVANTE:', uploadError)
        alert('Erro ao enviar comprovante.')
        return
      }

      const { data: publicUrl } = supabase.storage
        .from('documentos')
        .getPublicUrl(nomeArquivo)

      const { error: updateError } = await supabase
        .from('faturas')
        .update({
          comprovante_pagamento: publicUrl.publicUrl,
          data_comprovante: new Date().toISOString(),
          status_pagamento: 'COMPROVANTE ENVIADO',
          observacao_pagamento: null,
        })
        .eq('id', fatura.id)

      if (updateError) {
        console.log('ERRO SALVAR COMPROVANTE:', updateError)
        alert('Comprovante enviado, mas houve erro ao salvar na fatura.')
        return
      }

      alert('Comprovante enviado com sucesso.')
      setArquivoSelecionado((prev) => ({ ...prev, [fatura.id]: null }))
      await carregar()
    } finally {
      setEnviandoComprovante((prev) => ({ ...prev, [fatura.id]: false }))
    }
  }

  function normalizarDocumento(valor: any) {
    return String(valor || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  }

  function documentoEhConhecimento(documento: any) {
    const texto = normalizarDocumento(`${documento?.nome || ''} ${documento?.url || ''} ${documento?.caminho || ''}`)

    return (
      texto.includes('conhecimento') ||
      texto.includes('bill-of-lading') ||
      texto.includes('waybill') ||
      texto.includes('awb')
    )
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

  function statusAtual() {
    return String(embarque?.status_operacional || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  }

  function etapaConcluida(etapa: string) {
    const status = statusAtual()

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

    if (etapa === 'coletado') {
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

  function percentualProgresso() {
    const status = statusAtual()

    if (status.includes('entregue')) return 100
    if (status.includes('liberado')) return 85
    if (status.includes('fiscalizacao')) return 70
    if (status.includes('em transito')) return 55
    if (status.includes('coletado')) return 40

    if (
      status.includes('aguardando coleta') ||
      status.includes('etiqueta gerada')
    ) {
      return 20
    }

    return 0
  }

  function dataBR(data?: string | null) {
    if (!data) return '-'
    return new Date(data).toLocaleDateString('pt-BR')
  }

  function dataHoraBR(data?: string | null) {
    if (!data) return '-'
    return new Date(data).toLocaleString('pt-BR')
  }

  function statusPagamentoTexto(fatura: Fatura) {
    if (fatura.data_pagamento) return `Pago em ${dataBR(fatura.data_pagamento)}`
    if (fatura.status_pagamento) return fatura.status_pagamento
    if (fatura.comprovante_pagamento) return 'COMPROVANTE ENVIADO'
    return 'Pendente'
  }

  function podeEnviarComprovante(fatura: Fatura) {
    const status = String(fatura.status_pagamento || '').toUpperCase()

    return !fatura.comprovante_pagamento || status === 'COMPROVANTE REJEITADO'
  }

  if (!embarque) {
    return (
      <main className="min-h-screen bg-[#020817] text-white px-4 py-6 md:px-6 lg:px-8">
        Carregando embarque...
      </main>
    )
  }

  const link = linkRastreio()
  const progresso = percentualProgresso()

  return (
    <main className="min-h-screen bg-[#020817] text-white">
      <div className="border-b border-blue-950 bg-[#06111f]/95 sticky top-0 z-40 backdrop-blur">
        <div className="max-w-7xl mx-auto px-8 py-4 flex justify-between items-center gap-6">
          <div className="flex items-center gap-10">
            <a href="/cliente" className="text-2xl font-black leading-none">
              HC
              <span className="block text-blue-400 text-sm tracking-widest">
                CONNECT
              </span>
            </a>

            <nav className="hidden md:flex items-center gap-6 text-slate-300 font-bold">
              <a href="/cliente" className="hover:text-blue-400">🏠 Portal</a>
              <a href="/cliente/cotacoes" className="hover:text-blue-400">🧾 Cotações</a>
              <a href="/cliente/faturas" className="hover:text-blue-400">💵 Faturas</a>
              <a href="/cliente/suporte" className="hover:text-blue-400">🎧 Suporte</a>
            </nav>
          </div>

          <a href="/cliente" className="bg-slate-800 hover:bg-slate-700 px-5 py-3 rounded-xl font-bold">
            ← Voltar ao portal
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8">
        <section className="mb-8">
          <div className="flex flex-col lg:flex-row justify-between gap-8 items-start">
            <div>
              <div className="flex gap-3 flex-wrap mb-5">
                <span className="border border-purple-500 bg-purple-600/10 text-purple-300 px-4 py-2 rounded-xl text-sm font-bold uppercase">
                  {embarque.servico || 'Serviço'}
                </span>

                <span className="border border-blue-900 bg-[#071225] text-slate-300 px-4 py-2 rounded-xl text-sm font-bold">
                  Criado em {dataBR(embarque.criado_em)}
                </span>
              </div>

              <h1 className="text-5xl md:text-6xl font-black text-blue-400 tracking-tight">
                AWB {embarque.awb || '-'}
              </h1>

              <p className="text-slate-400 mt-3 text-lg">
                Acompanhamento operacional do embarque
              </p>
            </div>

            <div className="border border-blue-900 bg-[#071225] rounded-3xl p-6 min-w-[280px]">
              <p className="text-slate-400 text-sm mb-3">Status operacional</p>
              <StatusBadge status={embarque.status_operacional} />

              <p className="text-slate-500 text-sm mt-4">
                Atualizado em {dataHoraBR(embarque.ultima_atualizacao)}
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
          <ResumoCard icone="📅" titulo="Última atualização" valor={dataHoraBR(embarque.ultima_atualizacao)} detalhe="Status mais recente" />
          <ResumoCard icone="🚚" titulo="Data de envio" valor={dataBR(embarque.data_envio)} detalhe="Início do transporte" />
          <ResumoCard icone="🗓️" titulo="Previsão de entrega" valor={dataBR(embarque.data_prevista)} detalhe="Estimativa operacional" />
          <ResumoCard icone="✈️" titulo="Transportadora" valor={embarque.transportadora || '-'} detalhe={embarque.servico || '-'} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 border border-blue-900 rounded-3xl bg-[#071225] p-7">
            <h2 className="text-2xl font-black mb-8">Progresso do embarque</h2>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
              <EtapaPremium titulo="Aguardando coleta" ativo={etapaConcluida('aguardando_coleta')} />
              <EtapaPremium titulo="Coletado" ativo={etapaConcluida('coletado')} />
              <EtapaPremium titulo="Em trânsito" ativo={etapaConcluida('transito')} />
              <EtapaPremium titulo="Fiscalização" ativo={etapaConcluida('fiscalizacao')} />
              <EtapaPremium titulo="Liberado" ativo={etapaConcluida('liberado')} />
              <EtapaPremium titulo="Entregue" ativo={etapaConcluida('entregue')} />
            </div>

            <div className="rounded-2xl border border-blue-900 bg-[#020817] p-4">
              <div className="flex justify-between text-sm text-slate-400 mb-3">
                <span>Progresso geral</span>
                <span>{progresso}%</span>
              </div>

              <div className="w-full h-4 bg-slate-900 rounded-full overflow-hidden">
                <div className="h-full bg-purple-600 rounded-full" style={{ width: `${progresso}%` }} />
              </div>
            </div>
          </div>

          <div className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
            <h2 className="text-2xl font-black mb-5">Rastreie seu embarque</h2>

            <p className="text-slate-400 mb-6">
              Acompanhe diretamente no site da transportadora.
            </p>

            {link ? (
              <a href={link} target="_blank" rel="noopener noreferrer" className="block text-center bg-yellow-500 hover:bg-yellow-400 text-black px-5 py-4 rounded-xl font-black">
                Rastrear na {embarque.transportadora || 'transportadora'} ↗
              </a>
            ) : (
              <div className="text-slate-500 border border-blue-900 rounded-xl p-4">
                Rastreio ainda não disponível.
              </div>
            )}
          </div>
        </section>

        <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7 mb-8">
          <h2 className="text-2xl font-black mb-6">Rastreio da carga</h2>

          <div className="border border-blue-900 rounded-3xl bg-[#020817] p-7">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
              <div>
                <p className="text-slate-400 text-sm mb-2">Origem</p>
                <h3 className="text-3xl font-black">{embarque.origem || '-'}</h3>
              </div>

              <div className="text-center">
                <div className="text-5xl text-purple-500 mb-2">✈️</div>
                <div className="border-t border-dashed border-slate-600" />
              </div>

              <div className="md:text-right">
                <p className="text-slate-400 text-sm mb-2">Destino</p>
                <h3 className="text-3xl font-black">{embarque.destino || '-'}</h3>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
            <h2 className="text-2xl font-black mb-6">📋 Dados comerciais</h2>

            <div className="space-y-4">
              <LinhaInfo titulo="Exportador" valor={embarque.exportador || '-'} />
              <LinhaInfo titulo="Importador" valor={embarque.importador || '-'} />
              <LinhaInfo titulo="Cliente final" valor={embarque.cliente_final || embarque.empresas?.razao_social || '-'} />
              <LinhaInfo titulo="Referência do cliente" valor={embarque.referencia_cliente || '-'} />
              <LinhaInfo titulo="Referência HC" valor={embarque.referencia_hc || '-'} />
            </div>
          </div>

          <div className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
            <h2 className="text-2xl font-black mb-6">📦 Dados logísticos</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MiniInfo titulo="Serviço" valor={embarque.servico || '-'} />
              <MiniInfo titulo="Transportadora" valor={embarque.transportadora || '-'} />
              <MiniInfo titulo="Origem" valor={embarque.origem || '-'} />
              <MiniInfo titulo="Destino" valor={embarque.destino || '-'} />
              <MiniInfo titulo="Peso real" valor={embarque.peso_real ? `${embarque.peso_real} kg` : '-'} />
              <MiniInfo titulo="Peso taxado" valor={embarque.peso_taxado ? `${embarque.peso_taxado} kg` : '-'} />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
            <div className="flex justify-between items-center gap-4 mb-8">
              <h2 className="text-2xl font-black">🛡️ Timeline operacional</h2>

              <span className="bg-purple-600/20 border border-purple-500 text-purple-300 px-4 py-2 rounded-full text-sm font-bold">
                {timeline.length} atualização(ões)
              </span>
            </div>

            <div className="space-y-5">
              {timeline.length === 0 ? (
                <p className="text-slate-500">Nenhuma atualização disponível.</p>
              ) : (
                timeline.map((item, index) => (
                  <div key={item.id} className="relative pl-10">
                    <div className="absolute left-3 top-0 bottom-0 w-[2px] bg-blue-900" />

                    <div className={`absolute left-0 top-2 w-6 h-6 rounded-full border-4 border-[#071225] ${index === 0 ? 'bg-purple-600' : 'bg-blue-600'}`} />

                    <div className="border border-blue-900 rounded-2xl bg-[#020817] p-5">
                      <div className="flex justify-between items-start gap-4 mb-3">
                        <strong className="text-blue-400">{item.status || 'Atualização'}</strong>

                        {index === 0 && (
                          <span className="bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                            Atual
                          </span>
                        )}
                      </div>

                      <p className="text-slate-300 mb-3">{item.descricao || '-'}</p>
                      <p className="text-slate-500 text-sm">{dataHoraBR(item.criado_em)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-6">
            <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
              <div className="flex justify-between items-center gap-4 mb-8">
                <h2 className="text-2xl font-black">📎 Documentos</h2>

                <span className="bg-blue-600/20 border border-blue-500 text-blue-300 px-4 py-2 rounded-full text-sm font-bold">
                  {documentos.length} arquivo(s)
                </span>
              </div>

              <div className="space-y-4">
                {documentos.length === 0 ? (
                  <p className="text-slate-500">Nenhum documento disponível.</p>
                ) : (
                  documentos.map((doc) => (
                    <a key={doc.id} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-4 border border-blue-900 rounded-2xl p-5 bg-[#020817] hover:border-blue-500 transition">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold break-all">
                            {documentoEhConhecimento(doc) ? '📄 Conhecimento de Embarque' : doc.nome}
                          </h3>

                          {documentoEhConhecimento(doc) && (
                            <span className="rounded-full border border-green-500 bg-green-500/10 px-3 py-1 text-xs font-black text-green-300">
                              Documento principal
                            </span>
                          )}
                        </div>
                        <p className="text-slate-500 text-sm mt-1">Enviado em {dataHoraBR(doc.criado_em)}</p>
                      </div>

                      <span className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl text-white text-sm font-bold whitespace-nowrap">
                        {documentoEhConhecimento(doc) ? 'Abrir conhecimento' : 'Abrir'}
                      </span>
                    </a>
                  ))
                )}
              </div>
            </section>

            <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
              <div className="flex justify-between items-center gap-4 mb-8">
                <h2 className="text-2xl font-black">💵 Faturas vinculadas</h2>

                <span className="bg-green-600/20 border border-green-500 text-green-300 px-4 py-2 rounded-full text-sm font-bold">
                  {faturas.length} fatura(s)
                </span>
              </div>

              <div className="space-y-4">
                {faturas.length === 0 ? (
                  <p className="text-slate-500">Nenhuma fatura disponível.</p>
                ) : (
                  faturas.map((fatura) => {
                    const comprovanteEnviado = !!fatura.comprovante_pagamento
                    const podeEnviar = podeEnviarComprovante(fatura)

                    return (
                      <div key={fatura.id} className="border border-blue-900 rounded-2xl p-5 bg-[#020817]">
                        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
                          <div>
                            <h3 className="font-bold">Fatura vinculada ao AWB {embarque.awb || '-'}</h3>
                            <p className="text-slate-500 text-sm mt-1">Vencimento: {dataBR(fatura.vencimento)}</p>
                            <p className="text-slate-500 text-sm mt-1">
                              Pagamento: {statusPagamentoTexto(fatura)}
                            </p>
                            <p className="text-slate-500 text-sm mt-1">
                              Comprovante enviado em: {dataHoraBR(fatura.data_comprovante)}
                            </p>

                            {fatura.observacao_pagamento && (
                              <p className="text-yellow-300 text-sm mt-2">
                                Observação HC: {fatura.observacao_pagamento}
                              </p>
                            )}
                          </div>

                          <div className="flex gap-2 flex-wrap justify-end">
                            {fatura.arquivo_pdf ? (
                              <a href={fatura.arquivo_pdf} target="_blank" rel="noopener noreferrer" className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl text-white text-sm font-bold whitespace-nowrap">
                                Baixar fatura
                              </a>
                            ) : (
                              <span className="text-slate-500 text-sm">PDF indisponível</span>
                            )}

                            {fatura.recibo_pdf ? (
                              <a href={fatura.recibo_pdf} target="_blank" rel="noopener noreferrer" className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-xl text-white text-sm font-bold whitespace-nowrap">
                                Baixar recibo
                              </a>
                            ) : (
                              <span className="text-slate-500 text-sm">Recibo indisponível</span>
                            )}

                            {fatura.comprovante_pagamento && (
                              <a href={fatura.comprovante_pagamento} target="_blank" rel="noopener noreferrer" className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-xl text-white text-sm font-bold whitespace-nowrap">
                                Ver comprovante
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="mt-5 border border-blue-950 bg-[#071225] rounded-2xl p-5">
                          <h4 className="font-black mb-2">Comprovante de pagamento</h4>
                          <p className="text-slate-400 text-sm mb-4">
                            Envie aqui o comprovante referente a esta fatura. Formatos aceitos: PDF, JPG ou PNG.
                          </p>

                          {podeEnviar ? (
                            <div className="space-y-3">
                              <div className="flex flex-col md:flex-row gap-3">
                                <input
                                  id={`comprovante-${fatura.id}`}
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  className="hidden"
                                  onChange={(e) =>
                                    setArquivoSelecionado((prev) => ({
                                      ...prev,
                                      [fatura.id]: e.target.files?.[0] || null,
                                    }))
                                  }
                                />

                                <label
                                  htmlFor={`comprovante-${fatura.id}`}
                                  className="flex-1 cursor-pointer border border-blue-900 bg-[#020817] hover:border-blue-500 px-5 py-3 rounded-xl text-white font-bold text-center transition"
                                >
                                  {arquivoSelecionado[fatura.id]?.name || 'Escolher comprovante'}
                                </label>

                                <button
                                  onClick={() => enviarComprovante(fatura)}
                                  disabled={!!enviandoComprovante[fatura.id]}
                                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-3 rounded-xl text-white font-bold whitespace-nowrap"
                                >
                                  {enviandoComprovante[fatura.id]
                                    ? 'Enviando...'
                                    : comprovanteEnviado
                                      ? 'Reenviar comprovante'
                                      : 'Enviar comprovante'}
                                </button>
                              </div>

                              <p className="text-slate-500 text-xs">
                                Clique em “Escolher comprovante” para abrir o explorador de arquivos. Não precisa arrastar o arquivo para a tela.
                              </p>
                            </div>
                          ) : (
                            <div className="flex flex-col md:flex-row gap-3 md:items-center">
                              <span className="bg-yellow-600/20 border border-yellow-500 text-yellow-300 px-4 py-3 rounded-xl text-sm font-bold">
                                Comprovante enviado para análise da HC.
                              </span>

                              {fatura.comprovante_pagamento && (
                                <a href={fatura.comprovante_pagamento} target="_blank" rel="noopener noreferrer" className="bg-purple-600 hover:bg-purple-500 px-5 py-3 rounded-xl text-white text-sm font-bold text-center">
                                  Ver comprovante enviado
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </section>
          </div>
        </section>

        <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h2 className="text-2xl font-black mb-2">Precisa de ajuda com este embarque?</h2>

              <p className="text-slate-400">
                Entre em contato com a HC Consultoria informando o AWB {embarque.awb || '-'}.
              </p>
            </div>

            <div className="flex gap-3 flex-wrap">
              <a href={`/cliente/suporte?embarque_id=${encodeURIComponent(embarque.id)}&awb=${encodeURIComponent(embarque.awb || '')}`} className="bg-purple-600 hover:bg-purple-500 px-5 py-3 rounded-xl font-bold">
                Abrir chamado
              </a>

              {link && (
                <a href={link} target="_blank" rel="noopener noreferrer" className="bg-yellow-500 hover:bg-yellow-400 px-5 py-3 rounded-xl text-black font-black">
                  Rastrear agora
                </a>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function ResumoCard({
  icone,
  titulo,
  valor,
  detalhe,
}: {
  icone: string
  titulo: string
  valor: string
  detalhe: string
}) {
  return (
    <div className="border border-blue-900 rounded-3xl bg-[#071225] p-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <p className="text-slate-400 text-sm">{titulo}</p>
          <h3 className="text-xl font-black mt-3 break-words">{valor || '-'}</h3>
          <p className="text-slate-500 text-sm mt-2">{detalhe}</p>
        </div>

        <div className="text-3xl">{icone}</div>
      </div>
    </div>
  )
}

function EtapaPremium({
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
          ? 'bg-purple-600 border-purple-500 shadow-[0_0_20px_rgba(147,51,234,0.35)]'
          : 'bg-[#020817] border-blue-900'
      }`}
    >
      <div className="text-3xl mb-3">{ativo ? '✔️' : '⏳'}</div>
      <p className="font-bold">{titulo}</p>
    </div>
  )
}

function LinhaInfo({
  titulo,
  valor,
}: {
  titulo: string
  valor: string
}) {
  return (
    <div className="border border-blue-900 bg-[#020817] rounded-2xl p-4">
      <p className="text-slate-500 text-sm mb-1">{titulo}</p>
      <p className="font-bold break-words">{valor || '-'}</p>
    </div>
  )
}

function MiniInfo({
  titulo,
  valor,
}: {
  titulo: string
  valor: string
}) {
  return (
    <div className="border border-blue-900 bg-[#020817] rounded-2xl p-4">
      <p className="text-slate-500 text-sm mb-1">{titulo}</p>
      <p className="font-bold break-words">{valor || '-'}</p>
    </div>
  )
}
