'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import StatusBadge from '@/components/StatusBadge'

type ModoLista = 'ATIVOS' | 'ARQUIVADOS'

export default function ClienteEmbarquesPage() {
  const [usuario, setUsuario] = useState<any>(null)
  const [embarques, setEmbarques] = useState<any[]>([])
  const [arquivadosIds, setArquivadosIds] = useState<string[]>([])
  const [documentosPorEmbarque, setDocumentosPorEmbarque] = useState<Record<string, any[]>>({})
  const [faturasPorEmbarque, setFaturasPorEmbarque] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)

  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroTransportadora, setFiltroTransportadora] = useState('')
  const [modo, setModo] = useState<ModoLista>('ATIVOS')
  const [processandoId, setProcessandoId] = useState<string | null>(null)

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

    const { data: perfil, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error || !perfil || perfil.ativo === false) {
      await supabase.auth.signOut()
      window.location.href = '/login'
      return
    }

    if (perfil.tipo_acesso === 'admin') {
      window.location.href = '/admin'
      return
    }

    const dadosUsuario = {
      id: user.id,
      nome: perfil?.nome || user.email,
      email: user.email,
      tipo: perfil?.tipo_acesso || 'CLIENTE',
    }

    setUsuario(dadosUsuario)
    await carregarEmbarques(dadosUsuario.id)
  }

  async function carregarEmbarques(usuarioId: string) {
    setLoading(true)

    const { data: diretos } = await supabase
      .from('embarques')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('criado_em', { ascending: false })

    const { data: vinculos } = await supabase
      .from('embarque_clientes')
      .select('embarque_id')
      .eq('cliente_id', usuarioId)

    const idsVinculados = (vinculos || []).map((v) => v.embarque_id)

    let vinculados: any[] = []

    if (idsVinculados.length > 0) {
      const { data } = await supabase
        .from('embarques')
        .select('*')
        .in('id', idsVinculados)
        .order('criado_em', { ascending: false })

      vinculados = data || []
    }

    const todos = [...(diretos || []), ...vinculados]
    const unicos = Array.from(new Map(todos.map((e) => [e.id, e])).values())

    const ids = unicos.map((e) => e.id)

    let idsArquivados: string[] = []

    const { data: arquivados, error: erroArquivados } = await supabase
      .from('embarques_arquivados_clientes')
      .select('embarque_id')
      .eq('cliente_id', usuarioId)

    if (erroArquivados) {
      console.log('ERRO ARQUIVADOS:', erroArquivados)
    } else {
      idsArquivados = (arquivados || []).map((a) => a.embarque_id)
    }

    if (ids.length > 0) {
      const { data: docs } = await supabase
        .from('documentos_embarques')
        .select('*')
        .in('embarque_id', ids)

      const docsAgrupados: Record<string, any[]> = {}

      docs?.forEach((doc) => {
        if (!docsAgrupados[doc.embarque_id]) docsAgrupados[doc.embarque_id] = []
        docsAgrupados[doc.embarque_id].push(doc)
      })

      setDocumentosPorEmbarque(docsAgrupados)

      const { data: faturas } = await supabase
        .from('faturas')
        .select('id, embarque_id, arquivo_pdf, recibo_pdf, comprovante_pagamento, status_pagamento, visivel_cliente')
        .in('embarque_id', ids)
        .eq('visivel_cliente', true)

      const faturasAgrupadas: Record<string, any[]> = {}

      faturas?.forEach((fatura) => {
        if (!faturasAgrupadas[fatura.embarque_id]) faturasAgrupadas[fatura.embarque_id] = []
        faturasAgrupadas[fatura.embarque_id].push(fatura)
      })

      setFaturasPorEmbarque(faturasAgrupadas)
    } else {
      setDocumentosPorEmbarque({})
      setFaturasPorEmbarque({})
    }

    setEmbarques(unicos)
    setArquivadosIds(idsArquivados)
    setLoading(false)
  }

  async function arquivarEmbarque(embarqueId: string) {
    if (!usuario?.id) return

    const confirmar = confirm('Arquivar este embarque? Ele sairá da lista principal, mas continuará disponível em Arquivados.')
    if (!confirmar) return

    setProcessandoId(embarqueId)

    const { error } = await supabase
      .from('embarques_arquivados_clientes')
      .upsert(
        {
          embarque_id: embarqueId,
          cliente_id: usuario.id,
          arquivado_em: new Date().toISOString(),
        },
        { onConflict: 'embarque_id,cliente_id' }
      )

    if (error) {
      alert(`Erro ao arquivar: ${error.message}`)
      console.log(error)
      setProcessandoId(null)
      return
    }

    setArquivadosIds((atual) => Array.from(new Set([...atual, embarqueId])))
    setProcessandoId(null)
  }

  async function restaurarEmbarque(embarqueId: string) {
    if (!usuario?.id) return

    setProcessandoId(embarqueId)

    const { error } = await supabase
      .from('embarques_arquivados_clientes')
      .delete()
      .eq('embarque_id', embarqueId)
      .eq('cliente_id', usuario.id)

    if (error) {
      alert(`Erro ao restaurar: ${error.message}`)
      console.log(error)
      setProcessandoId(null)
      return
    }

    setArquivadosIds((atual) => atual.filter((id) => id !== embarqueId))
    setProcessandoId(null)
  }

  function normalizarTexto(texto: string) {
    return String(texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  }

  function dataBR(data?: string | null) {
    if (!data) return '-'
    return new Date(data).toLocaleDateString('pt-BR')
  }

  function dataHoraBR(data?: string | null) {
    if (!data) return '-'
    return new Date(data).toLocaleString('pt-BR')
  }

  function linkRastreio(item: any) {
    const awb = item.awb || ''
    const transportadora = (item.transportadora || '').toUpperCase()

    if (!awb || awb === 'AGUARDANDO AWB') return ''

    if (transportadora.includes('DHL')) {
      return `https://mydhl.express.dhl/br/pt/tracking.html#/results?id=${awb}`
    }

    if (transportadora.includes('FEDEX')) {
      return `https://www.fedex.com/fedextrack/?trknbr=${awb}`
    }

    if (transportadora.includes('UPS')) {
      return `https://www.ups.com/track?tracknum=${awb}`
    }

    return ''
  }

  function progresso(status: string) {
    const s = normalizarTexto(status)

    if (s.includes('entregue')) return 100
    if (s.includes('saiu para entrega')) return 92
    if (s.includes('liberado')) return 85
    if (s.includes('fiscalizacao')) return 70
    if (s.includes('em transito')) return 55
    if (s.includes('coletado')) return 40
    if (s.includes('aguardando coleta') || s.includes('etiqueta gerada')) return 20

    return 0
  }

  function podeArquivar(status: string) {
    const s = normalizarTexto(status)

    return (
      s.includes('entregue') ||
      s.includes('finalizado') ||
      s.includes('concluido')
    )
  }

  const ativos = embarques.filter((item) => !arquivadosIds.includes(item.id))
  const arquivados = embarques.filter((item) => arquivadosIds.includes(item.id))

  const embarquesFiltrados = useMemo(() => {
    const listaBase = modo === 'ARQUIVADOS' ? arquivados : ativos

    return listaBase.filter((item) => {
      const texto = `
        ${item.awb || ''}
        ${item.master || ''}
        ${item.exportador || ''}
        ${item.importador || ''}
        ${item.referencia_cliente || ''}
        ${item.referencia_hc || ''}
        ${item.transportadora || ''}
        ${item.servico || ''}
        ${item.origem || ''}
        ${item.destino || ''}
        ${item.status_operacional || ''}
        ${item.responsavel_nome || ''}
        ${item.responsavel_email || ''}
      `

      const passaBusca = normalizarTexto(texto).includes(normalizarTexto(busca))
      const passaStatus = !filtroStatus || item.status_operacional === filtroStatus
      const passaTransportadora = !filtroTransportadora || item.transportadora === filtroTransportadora

      return passaBusca && passaStatus && passaTransportadora
    })
  }, [ativos, arquivados, modo, busca, filtroStatus, filtroTransportadora])

  const totalAtivos = ativos.length
  const totalArquivados = arquivados.length
  const totalEntreguesAtivos = ativos.filter((e) => normalizarTexto(e.status_operacional).includes('entregue')).length
  const totalFiscalizacao = ativos.filter((e) => normalizarTexto(e.status_operacional).includes('fiscalizacao')).length
  const totalLiberados = ativos.filter((e) => normalizarTexto(e.status_operacional).includes('liberado')).length

  return (
    <main className="min-h-screen bg-[#020817] text-white px-4 py-6 md:px-6 lg:px-8">
      <div className="w-full max-w-none mx-auto">
        <header className="flex flex-col xl:flex-row justify-between items-start gap-8 mb-8">
          <div>
            <p className="text-blue-400 font-bold mb-2">Portal do cliente</p>
            <h1 className="text-5xl font-black mb-2">Meus embarques</h1>
            <p className="text-slate-400 text-lg">
              Consulte processos ativos, filtre por status e arquive embarques concluídos.
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <a href="/cliente" className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold">
              ← Voltar ao portal
            </a>

            <a href="/cliente/embarque-direto" className="bg-emerald-600 hover:bg-emerald-500 px-5 py-3 rounded-xl font-bold">
              🚚 Embarque direto
            </a>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-8">
          <ResumoCard titulo="Ativos" valor={totalAtivos} detalhe="Lista principal" icone="📦" />
          <ResumoCard titulo="Arquivados" valor={totalArquivados} detalhe="Histórico oculto" icone="🗄️" />
          <ResumoCard titulo="Entregues" valor={totalEntreguesAtivos} detalhe="Podem ser arquivados" icone="📬" />
          <ResumoCard titulo="Fiscalização" valor={totalFiscalizacao} detalhe="Atenção operacional" icone="🛃" />
          <ResumoCard titulo="Liberados" valor={totalLiberados} detalhe="Liberados para seguir" icone="✅" />
        </section>

        <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7 mb-8">
          <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-5">
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => setModo('ATIVOS')}
                className={
                  modo === 'ATIVOS'
                    ? 'bg-blue-600 px-5 py-3 rounded-xl font-bold'
                    : 'bg-slate-800 hover:bg-slate-700 px-5 py-3 rounded-xl font-bold'
                }
              >
                Ativos ({totalAtivos})
              </button>

              <button
                onClick={() => setModo('ARQUIVADOS')}
                className={
                  modo === 'ARQUIVADOS'
                    ? 'bg-purple-600 px-5 py-3 rounded-xl font-bold'
                    : 'bg-slate-800 hover:bg-slate-700 px-5 py-3 rounded-xl font-bold'
                }
              >
                Arquivados ({totalArquivados})
              </button>
            </div>

            <button
              onClick={() => {
                setBusca('')
                setFiltroStatus('')
                setFiltroTransportadora('')
              }}
              className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold"
            >
              Limpar filtros
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por AWB, Master, referência, exportador..."
            />

            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Todos os status</option>
              <option value="Aguardando coleta">Aguardando coleta</option>
              <option value="Etiqueta gerada">Etiqueta gerada</option>
              <option value="Coletado">Coletado</option>
              <option value="Em trânsito">Em trânsito</option>
              <option value="Fiscalização">Fiscalização</option>
              <option value="Liberado">Liberado</option>
              <option value="Saiu para entrega">Saiu para entrega</option>
              <option value="Entregue">Entregue</option>
              <option value="Atrasado">Atrasado</option>
            </select>

            <select value={filtroTransportadora} onChange={(e) => setFiltroTransportadora(e.target.value)}>
              <option value="">Todas transportadoras</option>
              <option value="DHL">DHL</option>
              <option value="FedEx">FedEx</option>
              <option value="UPS">UPS</option>
              <option value="Outra">Outra</option>
            </select>

            <div className="border border-blue-900 bg-[#020817] rounded-xl px-4 py-3 text-slate-300 font-bold">
              {embarquesFiltrados.length} embarque(s)
            </div>
          </div>
        </section>

        {loading ? (
          <section className="card text-slate-400">Carregando embarques...</section>
        ) : embarquesFiltrados.length === 0 ? (
          <section className="card text-center">
            <p className="text-slate-400">
              Nenhum embarque encontrado em {modo === 'ARQUIVADOS' ? 'Arquivados' : 'Ativos'}.
            </p>
          </section>
        ) : (
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {embarquesFiltrados.map((item) => {
              const documentos = documentosPorEmbarque[item.id] || []
              const faturas = faturasPorEmbarque[item.id] || []
              const link = linkRastreio(item)
              const percentual = progresso(item.status_operacional)
              const arquivado = arquivadosIds.includes(item.id)
              const permiteArquivar = podeArquivar(item.status_operacional)

              return (
                <article key={item.id} className="card hover:border-blue-500 transition">
                  <div className="flex flex-col lg:flex-row justify-between gap-5 mb-5">
                    <div>
                      <p className="text-slate-500 text-sm">AWB</p>
                      <a
                        href={`/cliente/embarques/${item.id}`}
                        className="text-3xl font-black text-blue-400 underline break-all"
                      >
                        {item.awb || '-'}
                      </a>

                      <div className="mt-3 flex gap-2 flex-wrap items-center">
                        <StatusBadge status={item.status_operacional} />

                        <span className="bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-xs font-black text-slate-300">
                          {item.transportadora || '-'} • {item.servico || '-'}
                        </span>

                        {arquivado && (
                          <span className="bg-purple-600/20 border border-purple-500 px-3 py-1 rounded-full text-xs font-black text-purple-300">
                            Arquivado
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap h-fit">
                      <a
                        href={`/cliente/embarques/${item.id}`}
                        className="bg-blue-600 hover:bg-blue-500 px-4 py-3 rounded-xl font-bold"
                      >
                        Ver detalhes
                      </a>

                      {link && (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-yellow-500 hover:bg-yellow-400 px-4 py-3 rounded-xl text-black font-black"
                        >
                          Rastrear
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                    <Info titulo="Master" valor={item.master || 'Aguardando geração'} />
                    <Info titulo="Origem → Destino" valor={`${item.origem || '-'} → ${item.destino || '-'}`} />
                    <Info titulo="Previsão" valor={dataBR(item.data_prevista)} />
                    <Info titulo="Exportador" valor={item.exportador || '-'} />
                    <Info titulo="Importador" valor={item.importador || '-'} />
                    <Info titulo="Ref. cliente" valor={item.referencia_cliente || '-'} />
                    <Info titulo="Ref. HC" valor={item.referencia_hc || '-'} />
                    <Info titulo="Documentos" valor={`${documentos.length} arquivo(s)`} />
                    <Info titulo="Faturas" valor={`${faturas.length} fatura(s)`} />
                  </div>

                  <div className="mb-5">
                    <div className="flex justify-between text-sm text-slate-400 mb-2">
                      <span>Progresso do embarque</span>
                      <span>{percentual}%</span>
                    </div>

                    <div className="w-full h-3 bg-[#020817] rounded-full overflow-hidden border border-blue-900">
                      <div className="h-full bg-green-600 rounded-full" style={{ width: `${percentual}%` }} />
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-blue-950 pt-5">
                    <div>
                      <p className="text-slate-500 text-sm">Responsável HC</p>
                      <p className="font-black">{item.responsavel_nome || 'Equipe HC'}</p>
                      <p className="text-slate-500 text-sm">{item.responsavel_email || 'marcos@hcbhz.com'}</p>
                    </div>

                    {arquivado ? (
                      <button
                        onClick={() => restaurarEmbarque(item.id)}
                        disabled={processandoId === item.id}
                        className="bg-purple-600 hover:bg-purple-500 disabled:opacity-60 px-5 py-3 rounded-xl font-bold"
                      >
                        {processandoId === item.id ? 'Restaurando...' : 'Restaurar'}
                      </button>
                    ) : permiteArquivar ? (
                      <button
                        onClick={() => arquivarEmbarque(item.id)}
                        disabled={processandoId === item.id}
                        className="bg-slate-700 hover:bg-slate-600 disabled:opacity-60 px-5 py-3 rounded-xl font-bold"
                      >
                        {processandoId === item.id ? 'Arquivando...' : 'Arquivar'}
                      </button>
                    ) : (
                      <span className="bg-slate-900 border border-slate-700 text-slate-500 px-5 py-3 rounded-xl font-bold">
                        Arquivar ao concluir
                      </span>
                    )}
                  </div>
                </article>
              )
            })}
          </section>
        )}
      </div>
    </main>
  )
}

function ResumoCard({ titulo, valor, detalhe, icone }: any) {
  return (
    <div className="card">
      <div className="flex justify-between items-start gap-4">
        <div>
          <p className="text-slate-400 text-sm font-bold">{titulo}</p>
          <h2 className="text-4xl font-black mt-4 text-blue-400">{valor}</h2>
          <p className="text-slate-500 text-sm mt-2">{detalhe}</p>
        </div>

        <span className="text-3xl">{icone}</span>
      </div>
    </div>
  )
}

function Info({ titulo, valor }: any) {
  return (
    <div className="border border-blue-900 bg-[#020817] rounded-2xl p-4">
      <p className="text-slate-500 text-sm mb-1">{titulo}</p>
      <p className="font-bold break-words">{valor || '-'}</p>
    </div>
  )
}
