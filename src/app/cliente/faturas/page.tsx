'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type FiltroArquivamento = 'ATIVAS' | 'ARQUIVADAS'

export default function FaturasClientePage() {
  const [faturas, setFaturas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [usuarioId, setUsuarioId] = useState('')
  const [filtroArquivamento, setFiltroArquivamento] = useState<FiltroArquivamento>('ATIVAS')
  const [arquivoSelecionado, setArquivoSelecionado] = useState<Record<string, File | null>>({})
  const [enviando, setEnviando] = useState<Record<string, boolean>>({})
  const [arquivando, setArquivando] = useState<Record<string, boolean>>({})

  useEffect(() => {
    carregarUsuario()
  }, [])

  async function carregarUsuario() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/login'
      return
    }

    setUsuarioId(user.id)
    carregarFaturas(user.id)
  }

  async function carregarFaturas(usuarioId: string) {
    setLoading(true)

    const { data: diretos } = await supabase
      .from('embarques')
      .select('id')
      .eq('usuario_id', usuarioId)

    const { data: vinculos } = await supabase
      .from('embarque_clientes')
      .select('embarque_id')
      .eq('cliente_id', usuarioId)

    const idsDiretos = (diretos || []).map((e) => e.id)
    const idsVinculados = (vinculos || []).map((v) => v.embarque_id)
    const ids = Array.from(new Set([...idsDiretos, ...idsVinculados]))

    if (ids.length === 0) {
      setFaturas([])
      setLoading(false)
      return
    }

    const { data: arquivadasData, error: erroArquivadas } = await supabase
      .from('faturas_arquivadas_clientes')
      .select('fatura_id, arquivado_em')
      .eq('cliente_id', usuarioId)

    if (erroArquivadas) {
      console.log('ERRO FATURAS ARQUIVADAS:', erroArquivadas)
    }

    const mapaArquivadas = new Map(
      (arquivadasData || []).map((item: any) => [item.fatura_id, item.arquivado_em])
    )

    const { data, error } = await supabase
      .from('faturas')
      .select(`
        id,
        embarque_id,
        usuario_id,
        arquivo_pdf,
        recibo_pdf,
        recibo_nome,
        comprovante_pagamento,
        data_comprovante,
        status_pagamento,
        observacao_pagamento,
        criado_em,
        visivel_cliente,
        embarques (
          id,
          awb,
          cliente_final,
          exportador,
          importador,
          transportadora,
          status_operacional
        )
      `)
      .in('embarque_id', ids)
      .eq('visivel_cliente', true)
      .order('criado_em', { ascending: false })

    if (error) {
      console.log('ERRO FATURAS:', error)
    }

    const faturasComArquivamento = (data || []).map((fatura: any) => ({
      ...fatura,
      arquivada_cliente: mapaArquivadas.has(fatura.id),
      arquivado_em: mapaArquivadas.get(fatura.id) || null,
    }))

    setFaturas(faturasComArquivamento)
    setLoading(false)
  }

  async function enviarComprovante(fatura: any) {
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

    setEnviando((prev) => ({ ...prev, [fatura.id]: true }))

    const extensao = arquivo.name.split('.').pop()
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
      setEnviando((prev) => ({ ...prev, [fatura.id]: false }))
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
      setEnviando((prev) => ({ ...prev, [fatura.id]: false }))
      return
    }

    alert('Comprovante enviado com sucesso.')
    setArquivoSelecionado((prev) => ({ ...prev, [fatura.id]: null }))
    await carregarFaturas(usuarioId)

    setEnviando((prev) => ({ ...prev, [fatura.id]: false }))
  }

  async function arquivarFatura(fatura: any) {
    if (!usuarioId) return

    const confirmar = confirm(
      'Deseja arquivar esta fatura? Ela sairá da lista principal, mas continuará disponível em Arquivadas.'
    )

    if (!confirmar) return

    setArquivando((prev) => ({ ...prev, [fatura.id]: true }))

    const { error } = await supabase
      .from('faturas_arquivadas_clientes')
      .upsert(
        {
          fatura_id: fatura.id,
          cliente_id: usuarioId,
        },
        { onConflict: 'fatura_id,cliente_id' }
      )

    if (error) {
      console.log('ERRO ARQUIVAR FATURA:', error)
      alert(`Erro ao arquivar fatura: ${error.message}`)
      setArquivando((prev) => ({ ...prev, [fatura.id]: false }))
      return
    }

    await carregarFaturas(usuarioId)
    setArquivando((prev) => ({ ...prev, [fatura.id]: false }))
  }

  async function restaurarFatura(fatura: any) {
    if (!usuarioId) return

    const confirmar = confirm('Deseja restaurar esta fatura para a lista principal?')
    if (!confirmar) return

    setArquivando((prev) => ({ ...prev, [fatura.id]: true }))

    const { error } = await supabase
      .from('faturas_arquivadas_clientes')
      .delete()
      .eq('fatura_id', fatura.id)
      .eq('cliente_id', usuarioId)

    if (error) {
      console.log('ERRO RESTAURAR FATURA:', error)
      alert(`Erro ao restaurar fatura: ${error.message}`)
      setArquivando((prev) => ({ ...prev, [fatura.id]: false }))
      return
    }

    await carregarFaturas(usuarioId)
    setArquivando((prev) => ({ ...prev, [fatura.id]: false }))
  }

  function dadosEmbarque(fatura: any) {
    if (Array.isArray(fatura.embarques)) return fatura.embarques[0] || {}
    return fatura.embarques || {}
  }

  function dataBR(data?: string | null) {
    if (!data) return '-'
    return new Date(data).toLocaleDateString('pt-BR')
  }

  function dataHoraBR(data?: string | null) {
    if (!data) return '-'
    return new Date(data).toLocaleString('pt-BR')
  }

  const faturasFiltradas = useMemo(() => {
    return faturas.filter((fatura) => {
      const emb = dadosEmbarque(fatura)

      if (filtroArquivamento === 'ATIVAS' && fatura.arquivada_cliente) return false
      if (filtroArquivamento === 'ARQUIVADAS' && !fatura.arquivada_cliente) return false

      const texto = `
        ${emb.awb || ''}
        ${emb.cliente_final || ''}
        ${emb.exportador || ''}
        ${emb.importador || ''}
        ${emb.transportadora || ''}
        ${emb.status_operacional || ''}
        ${fatura.status_pagamento || ''}
      `.toLowerCase()

      return texto.includes(busca.toLowerCase())
    })
  }, [faturas, busca, filtroArquivamento])

  const faturasAtivas = faturas.filter((f) => !f.arquivada_cliente)
  const faturasArquivadas = faturas.filter((f) => f.arquivada_cliente)

  const totalFaturas = faturasAtivas.length
  const totalRecibos = faturasAtivas.filter((f) => f.recibo_pdf).length
  const totalSemRecibo = faturasAtivas.filter((f) => !f.recibo_pdf).length
  const totalComprovantes = faturasAtivas.filter((f) => f.comprovante_pagamento).length
  const totalArquivadas = faturasArquivadas.length

  return (
    <main className="min-h-screen bg-[#020817] text-white px-4 py-6 md:px-6 lg:px-8">
      <div className="w-full max-w-none mx-auto">
        <div className="mb-8 flex flex-col lg:flex-row justify-between gap-6">
          <div>
            <p className="text-blue-400 font-bold mb-2">Documentos</p>
            <h1 className="text-5xl font-black mb-2">Faturas e recibos</h1>
            <p className="text-slate-400 text-lg">
              Consulte os PDFs liberados pela HC, envie comprovantes e arquive faturas já conferidas.
            </p>
          </div>

          <a
            href="/cliente"
            className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl text-white font-bold h-fit"
          >
            Voltar ao portal
          </a>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-8">
          <Card titulo="Faturas ativas" valor={totalFaturas} detalhe="Na lista principal" icone="📄" />
          <Card titulo="Recibos disponíveis" valor={totalRecibos} detalhe="PDFs liberados" icone="🧾" />
          <Card titulo="Comprovantes enviados" valor={totalComprovantes} detalhe="Pagamentos informados" icone="📎" />
          <Card titulo="Aguardando recibo" valor={totalSemRecibo} detalhe="Documento ainda não anexado" icone="⏳" />
          <Card titulo="Arquivadas" valor={totalArquivadas} detalhe="Faturas ocultadas" icone="🗂️" />
        </section>

        <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
          <div className="flex flex-col lg:flex-row justify-between gap-5 mb-7">
            <div>
              <h2 className="text-2xl font-black">Documentos de faturamento</h2>
              <p className="text-slate-400 text-sm">
                Baixe sua fatura, consulte o recibo, envie o comprovante e arquive documentos já tratados.
              </p>
            </div>

            <div className="flex flex-col md:flex-row gap-3 lg:min-w-[620px]">
              <div className="flex bg-[#020817] border border-blue-900 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setFiltroArquivamento('ATIVAS')}
                  className={`px-4 py-2 rounded-lg font-black text-sm ${
                    filtroArquivamento === 'ATIVAS'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Ativas ({totalFaturas})
                </button>

                <button
                  type="button"
                  onClick={() => setFiltroArquivamento('ARQUIVADAS')}
                  className={`px-4 py-2 rounded-lg font-black text-sm ${
                    filtroArquivamento === 'ARQUIVADAS'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Arquivadas ({totalArquivadas})
                </button>
              </div>

              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por AWB, cliente, transportadora..."
                className="flex-1"
              />
            </div>
          </div>

          {loading ? (
            <div className="border border-blue-900 bg-[#020817] rounded-2xl p-6 text-slate-400">
              Carregando documentos...
            </div>
          ) : faturasFiltradas.length === 0 ? (
            <div className="border border-blue-900 bg-[#020817] rounded-2xl p-6 text-slate-400">
              {filtroArquivamento === 'ATIVAS'
                ? 'Nenhuma fatura ativa disponível.'
                : 'Nenhuma fatura arquivada.'}
            </div>
          ) : (
            <div className="space-y-5">
              {faturasFiltradas.map((fatura) => {
                const embarque = dadosEmbarque(fatura)
                const jaEnviado = !!fatura.comprovante_pagamento
                const statusPagamento = fatura.status_pagamento || 'AGUARDANDO PAGAMENTO'
                const arquivada = !!fatura.arquivada_cliente

                return (
                  <article
                    key={fatura.id}
                    className="border border-blue-900 rounded-3xl bg-[#020817] p-6"
                  >
                    <div className="flex flex-col xl:flex-row justify-between gap-6">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                          <h3 className="text-3xl font-black text-blue-400">
                            AWB {embarque?.awb || '-'}
                          </h3>

                          <StatusDocumento temRecibo={!!fatura.recibo_pdf} />
                          <StatusPagamento status={statusPagamento} />

                          {arquivada && (
                            <span className="bg-purple-600/20 text-purple-300 border border-purple-500 px-3 py-1 rounded-full text-xs font-black">
                              🗂️ Arquivada
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Info label="Transportadora" valor={embarque?.transportadora || '-'} />
                          <Info label="Status embarque" valor={embarque?.status_operacional || '-'} />
                          <Info label="Fatura publicada em" valor={dataBR(fatura.criado_em)} />
                          <Info label="Cliente final" valor={embarque?.cliente_final || '-'} />
                          <Info label="Exportador" valor={embarque?.exportador || '-'} />
                          <Info label="Importador" valor={embarque?.importador || '-'} />
                          <Info label="Fatura PDF" valor={fatura.arquivo_pdf ? 'Disponível' : 'Indisponível'} />
                          <Info label="Recibo PDF" valor={fatura.recibo_pdf ? 'Disponível' : 'Aguardando anexo'} />
                          <Info label="Pagamento" valor={statusPagamento} />
                          <Info label="Comprovante enviado em" valor={dataHoraBR(fatura.data_comprovante)} />
                          <Info label="Observação HC" valor={fatura.observacao_pagamento || '-'} />
                          <Info label="Arquivada em" valor={dataHoraBR(fatura.arquivado_em)} />
                        </div>

                        {!arquivada && (
                          <div className="mt-6 border border-blue-950 bg-[#071225] rounded-2xl p-5">
                            <h4 className="text-xl font-black mb-2">Comprovante de pagamento</h4>
                            <p className="text-slate-400 text-sm mb-4">
                              Envie aqui o comprovante referente a esta fatura. Formatos aceitos: PDF, JPG ou PNG.
                            </p>

                            {jaEnviado ? (
                              <div className="flex flex-col md:flex-row gap-3">
                                <a
                                  href={fatura.comprovante_pagamento}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bg-purple-600 hover:bg-purple-500 px-5 py-3 rounded-xl text-white font-bold text-center"
                                >
                                  Ver comprovante enviado
                                </a>

                                {statusPagamento === 'COMPROVANTE REJEITADO' && (
                                  <div className="flex flex-col md:flex-row gap-3 flex-1">
                                    <input
                                      type="file"
                                      accept=".pdf,.jpg,.jpeg,.png"
                                      onChange={(e) =>
                                        setArquivoSelecionado((prev) => ({
                                          ...prev,
                                          [fatura.id]: e.target.files?.[0] || null,
                                        }))
                                      }
                                      className="w-full"
                                    />

                                    <button
                                      onClick={() => enviarComprovante(fatura)}
                                      disabled={!!enviando[fatura.id]}
                                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-3 rounded-xl text-white font-bold"
                                    >
                                      {enviando[fatura.id] ? 'Enviando...' : 'Reenviar'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col md:flex-row gap-3">
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  onChange={(e) =>
                                    setArquivoSelecionado((prev) => ({
                                      ...prev,
                                      [fatura.id]: e.target.files?.[0] || null,
                                    }))
                                  }
                                  className="w-full"
                                />

                                <button
                                  onClick={() => enviarComprovante(fatura)}
                                  disabled={!!enviando[fatura.id]}
                                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-3 rounded-xl text-white font-bold"
                                >
                                  {enviando[fatura.id] ? 'Enviando...' : 'Enviar comprovante'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-3 min-w-[220px]">
                        {fatura.arquivo_pdf ? (
                          <a
                            href={fatura.arquivo_pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl text-white font-bold text-center"
                          >
                            Baixar fatura
                          </a>
                        ) : (
                          <span className="bg-slate-800 px-5 py-3 rounded-xl text-slate-400 font-bold text-center">
                            Fatura indisponível
                          </span>
                        )}

                        {fatura.recibo_pdf ? (
                          <a
                            href={fatura.recibo_pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl text-white font-bold text-center"
                          >
                            Baixar recibo
                          </a>
                        ) : (
                          <span className="bg-slate-800 px-5 py-3 rounded-xl text-slate-400 font-bold text-center">
                            Recibo ainda não anexado
                          </span>
                        )}

                        {arquivada ? (
                          <button
                            onClick={() => restaurarFatura(fatura)}
                            disabled={!!arquivando[fatura.id]}
                            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-5 py-3 rounded-xl text-white font-bold text-center"
                          >
                            {arquivando[fatura.id] ? 'Restaurando...' : 'Restaurar'}
                          </button>
                        ) : (
                          <button
                            onClick={() => arquivarFatura(fatura)}
                            disabled={!!arquivando[fatura.id]}
                            className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-5 py-3 rounded-xl text-white font-bold text-center"
                          >
                            {arquivando[fatura.id] ? 'Arquivando...' : 'Arquivar'}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
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

function Info({ label, valor }: any) {
  return (
    <div className="border border-blue-950 bg-[#071225] rounded-2xl p-4">
      <p className="text-slate-500 text-sm mb-2">{label}</p>
      <p className="font-bold break-words">{valor}</p>
    </div>
  )
}

function StatusDocumento({ temRecibo }: { temRecibo: boolean }) {
  return temRecibo ? (
    <span className="bg-green-600/20 text-green-300 border border-green-500 px-3 py-1 rounded-full text-xs font-black">
      🧾 Recibo disponível
    </span>
  ) : (
    <span className="bg-blue-600/20 text-blue-300 border border-blue-500 px-3 py-1 rounded-full text-xs font-black">
      📄 Fatura disponível
    </span>
  )
}

function StatusPagamento({ status }: { status: string }) {
  if (status === 'PAGO') {
    return (
      <span className="bg-green-600/20 text-green-300 border border-green-500 px-3 py-1 rounded-full text-xs font-black">
        🟢 Pago
      </span>
    )
  }

  if (status === 'COMPROVANTE ENVIADO') {
    return (
      <span className="bg-yellow-600/20 text-yellow-300 border border-yellow-500 px-3 py-1 rounded-full text-xs font-black">
        🟡 Comprovante enviado
      </span>
    )
  }

  if (status === 'COMPROVANTE REJEITADO') {
    return (
      <span className="bg-red-600/20 text-red-300 border border-red-500 px-3 py-1 rounded-full text-xs font-black">
        🔴 Comprovante rejeitado
      </span>
    )
  }

  return (
    <span className="bg-slate-600/20 text-slate-300 border border-slate-500 px-3 py-1 rounded-full text-xs font-black">
      ⚪ Aguardando pagamento
    </span>
  )
}
