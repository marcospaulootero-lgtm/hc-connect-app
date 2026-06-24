'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function AdminEmbarqueDiretoPage() {
  const [solicitacoes, setSolicitacoes] = useState<any[]>([])
  const [documentos, setDocumentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('TODOS')
  const [arquivamentoFiltro, setArquivamentoFiltro] = useState('ATIVAS')
  const [convertendo, setConvertendo] = useState<string | number | null>(null)
  const [removendo, setRemovendo] = useState<string | number | null>(null)
  const [restaurando, setRestaurando] = useState<string | number | null>(null)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setLoading(true)

    const { data: solicitacoesData, error } = await supabase
      .from('embarque_direto')
      .select('*')
      .order('id', { ascending: false })

    if (error) {
      console.log(error)
      alert('Erro ao carregar solicitações: ' + error.message)
      setLoading(false)
      return
    }

    const ids = (solicitacoesData || []).map((s) => s.id)

    let docs: any[] = []

    if (ids.length > 0) {
      const { data: docsData } = await supabase
        .from('embarque_direto_documentos')
        .select('*')
        .in('embarque_direto_id', ids)

      docs = docsData || []
    }

    setSolicitacoes(solicitacoesData || [])
    setDocumentos(docs)
    setLoading(false)
  }

  function docsDaSolicitacao(id: string | number) {
    return documentos.filter((doc) => String(doc.embarque_direto_id) === String(id))
  }

  function dataBR(data?: string | null) {
    if (!data) return '-'
    return new Date(data).toLocaleString('pt-BR')
  }

  function arquivada(item: any) {
    return !!item.arquivado_admin || String(item.status || '').toUpperCase() === 'EXCLUIDO'
  }

  function statusVisual(item: any) {
    if (String(item.status || '').toUpperCase() === 'EXCLUIDO') return 'ARQUIVADO'
    return item.status || 'AGUARDANDO ANÁLISE'
  }

  const filtradas = useMemo(() => {
    return solicitacoes.filter((item) => {
      const itemArquivado = arquivada(item)

      const texto = `
        ${item.cliente_final || ''}
        ${item.solicitante_email || ''}
        ${item.tipo_operacao || ''}
        ${item.origem || ''}
        ${item.destino || ''}
        ${item.transportadora || ''}
        ${item.awb || ''}
        ${item.status || ''}
      `.toLowerCase()

      const passaBusca = texto.includes(busca.toLowerCase())
      const passaStatus =
        statusFiltro === 'TODOS' ||
        (statusFiltro === 'ARQUIVADO'
          ? itemArquivado
          : String(item.status || '') === statusFiltro)

      const passaArquivamento =
        arquivamentoFiltro === 'TODAS' ||
        (arquivamentoFiltro === 'ARQUIVADAS' ? itemArquivado : !itemArquivado)

      return passaBusca && passaStatus && passaArquivamento
    })
  }, [solicitacoes, busca, statusFiltro, arquivamentoFiltro])

  const solicitacoesAtivas = solicitacoes.filter((s) => !arquivada(s))
  const solicitacoesArquivadas = solicitacoes.filter((s) => arquivada(s))

  const aguardando = solicitacoesAtivas.filter((s) => s.status === 'AGUARDANDO ANÁLISE' || !s.status).length
  const emAnalise = solicitacoesAtivas.filter((s) => s.status === 'EM ANÁLISE').length
  const convertidas = solicitacoesAtivas.filter((s) => s.status === 'CONVERTIDO EM EMBARQUE').length
  const recusadas = solicitacoesAtivas.filter((s) => s.status === 'RECUSADO').length
  const arquivadas = solicitacoesArquivadas.length

  async function atualizarStatus(id: string | number, status: string) {
    const { error } = await supabase
      .from('embarque_direto')
      .update({ status })
      .eq('id', id)

    if (error) {
      alert(error.message)
      return
    }

    carregar()
  }

  async function removerDaLista(item: any) {
    const confirmar = confirm(
      `Remover esta solicitação da lista principal?\n\n` +
        `Cliente: ${item.cliente_final || '-'}\n` +
        `Solicitante: ${item.solicitante_email || '-'}\n` +
        `AWB/Referência: ${item.awb || '-'}\n\n` +
        `Ela ficará arquivada e poderá ser restaurada pelo filtro "Arquivadas".`
    )

    if (!confirmar) return

    setRemovendo(item.id)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('embarque_direto')
      .update({
        arquivado_admin: true,
        arquivado_admin_em: new Date().toISOString(),
        arquivado_admin_por: user?.id || null,
      })
      .eq('id', item.id)

    if (error) {
      setRemovendo(null)
      alert('Erro ao remover solicitação da lista: ' + error.message)
      return
    }

    setSolicitacoes((lista) =>
      lista.map((s) =>
        String(s.id) === String(item.id)
          ? {
              ...s,
              arquivado_admin: true,
              arquivado_admin_em: new Date().toISOString(),
              arquivado_admin_por: user?.id || null,
            }
          : s
      )
    )

    setRemovendo(null)
  }

  async function restaurarDaLista(item: any) {
    const confirmar = confirm(
      `Restaurar esta solicitação para a lista principal?\n\n` +
        `Cliente: ${item.cliente_final || '-'}\n` +
        `AWB/Referência: ${item.awb || '-'}`
    )

    if (!confirmar) return

    setRestaurando(item.id)

    const payload: any = {
      arquivado_admin: false,
      arquivado_admin_em: null,
      arquivado_admin_por: null,
    }

    if (String(item.status || '').toUpperCase() === 'EXCLUIDO') {
      payload.status = 'AGUARDANDO ANÁLISE'
    }

    const { error } = await supabase
      .from('embarque_direto')
      .update(payload)
      .eq('id', item.id)

    if (error) {
      setRestaurando(null)
      alert('Erro ao restaurar solicitação: ' + error.message)
      return
    }

    setRestaurando(null)
    carregar()
  }

  async function converterEmEmbarque(item: any) {
    const confirmar = confirm(`Converter a solicitação de ${item.cliente_final || item.solicitante_email} em embarque?`)
    if (!confirmar) return

    setConvertendo(item.id)

    const { data: novoEmbarque, error } = await supabase
      .from('embarques')
      .insert([
        {
          usuario_id: item.usuario_id || null,
          cliente_final: item.cliente_final || null,
          exportador: item.tipo_operacao === 'Exportação' ? item.cliente_final : null,
          importador: item.tipo_operacao === 'Importação' ? item.cliente_final : null,
          awb: item.awb || 'AGUARDANDO AWB',
          transportadora: item.transportadora || null,
          servico: item.tipo_operacao || null,
          origem: item.origem || null,
          destino: item.destino || null,
          peso_real: item.peso ? Number(String(item.peso).replace(',', '.')) : null,
          peso_taxado: item.peso ? Number(String(item.peso).replace(',', '.')) : null,
          status_operacional: 'Aguardando coleta',
          observacoes: `
Solicitação criada via Embarque Direto.

Solicitante: ${item.solicitante_email || '-'}
Volumes: ${item.volumes || '-'}
Descrição da mercadoria: ${item.descricao_mercadoria || '-'}
Instruções: ${item.instrucoes || '-'}
          `.trim(),
        },
      ])
      .select()
      .single()

    if (error) {
      setConvertendo(null)
      console.log(error)
      alert(error.message)
      return
    }

    const docs = docsDaSolicitacao(item.id)

    for (const doc of docs) {
      await supabase.from('documentos_embarques').insert([
        {
          embarque_id: novoEmbarque.id,
          nome: doc.nome,
          url: doc.url,
          caminho: doc.caminho || null,
        },
      ])
    }

    const { error: erroUpdate } = await supabase
      .from('embarque_direto')
      .update({
        status: 'CONVERTIDO EM EMBARQUE',
        embarque_id: novoEmbarque.id,
      })
      .eq('id', item.id)

    setConvertendo(null)

    if (erroUpdate) {
      alert(erroUpdate.message)
      return
    }

    alert('Solicitação convertida em embarque com sucesso.')
    carregar()
  }

  function aplicarFiltroArquivadas() {
    setArquivamentoFiltro('ARQUIVADAS')
    setStatusFiltro('TODOS')
  }

  return (
    <main className="w-full max-w-none p-8 text-white">
      <div className="mb-8 flex flex-col xl:flex-row justify-between gap-6">
        <div>
          <p className="text-blue-400 font-bold mb-2">Operação</p>
          <h1 className="text-5xl font-black mb-2">Embarque Direto</h1>
          <p className="text-slate-400 text-lg">
            Solicitações enviadas pelos clientes para abertura de embarques sem cotação.
          </p>
        </div>

        <button
          onClick={carregar}
          className="bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold h-fit"
        >
          Atualizar
        </button>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-8">
        <Card titulo="Aguardando" valor={aguardando} detalhe="Novas solicitações" icone="🟡" />
        <Card titulo="Em análise" valor={emAnalise} detalhe="Em tratamento" icone="🔎" />
        <Card titulo="Convertidas" valor={convertidas} detalhe="Viraram embarque" icone="✅" />
        <Card titulo="Recusadas" valor={recusadas} detalhe="Não seguiram" icone="❌" />
        <Card
          titulo="Arquivadas"
          valor={arquivadas}
          detalhe="Removidas da lista"
          icone="🗄️"
          onClick={aplicarFiltroArquivadas}
        />
      </section>

      <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
        <div className="flex flex-col xl:flex-row justify-between gap-5 mb-7">
          <div>
            <h2 className="text-2xl font-black">Solicitações recebidas</h2>
            <p className="text-slate-400 text-sm">
              Analise os dados, veja os anexos e converta em embarque quando necessário.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full xl:max-w-[880px]">
            <select
              value={arquivamentoFiltro}
              onChange={(e) => setArquivamentoFiltro(e.target.value)}
            >
              <option value="ATIVAS">Lista: ativas</option>
              <option value="ARQUIVADAS">Lista: arquivadas</option>
              <option value="TODAS">Lista: todas</option>
            </select>

            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
            >
              <option value="TODOS">Todos os status</option>
              <option value="AGUARDANDO ANÁLISE">Aguardando análise</option>
              <option value="EM ANÁLISE">Em análise</option>
              <option value="CONVERTIDO EM EMBARQUE">Convertido em embarque</option>
              <option value="RECUSADO">Recusado</option>
              <option value="ARQUIVADO">Arquivado</option>
            </select>

            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por cliente, e-mail, origem, destino..."
              className="min-w-[320px]"
            />
          </div>
        </div>

        {loading ? (
          <div className="border border-blue-900 bg-[#020817] rounded-2xl p-6 text-slate-400">
            Carregando solicitações...
          </div>
        ) : filtradas.length === 0 ? (
          <div className="border border-blue-900 bg-[#020817] rounded-2xl p-6 text-slate-400">
            Nenhuma solicitação encontrada.
          </div>
        ) : (
          <div className="space-y-6">
            {filtradas.map((item) => {
              const docs = docsDaSolicitacao(item.id)
              const itemArquivado = arquivada(item)

              return (
                <article
                  key={item.id}
                  className={
                    itemArquivado
                      ? 'border border-slate-700 bg-[#020817] rounded-3xl p-6 opacity-80'
                      : 'border border-blue-900 bg-[#020817] rounded-3xl p-6'
                  }
                >
                  <div className="flex flex-col xl:flex-row justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-4">
                        <h3 className="text-2xl font-black text-blue-400">
                          {item.cliente_final || 'Cliente não informado'}
                        </h3>

                        <Status status={statusVisual(item)} />

                        {itemArquivado && (
                          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-500 bg-slate-700/20 text-slate-300 text-xs font-black">
                            🗄️ Arquivada
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
                        <Info label="Solicitante" valor={item.solicitante_email} />
                        <Info label="Operação" valor={item.tipo_operacao} />
                        <Info label="Origem" valor={item.origem} />
                        <Info label="Destino" valor={item.destino} />
                        <Info label="Transportadora" valor={item.transportadora} />
                        <Info label="AWB / Referência" valor={item.awb} />
                        <Info label="Peso" valor={item.peso} />
                        <Info label="Volumes" valor={item.volumes} />
                        <Info label="Criado em" valor={dataBR(item.created_at)} />
                        {itemArquivado && <Info label="Arquivado em" valor={dataBR(item.arquivado_admin_em)} />}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                        <TextoBox titulo="Mercadoria" texto={item.descricao_mercadoria} />
                        <TextoBox titulo="Instruções" texto={item.instrucoes} />
                      </div>

                      <div className="border border-blue-900 rounded-2xl p-5 bg-[#071225]">
                        <h4 className="font-black mb-3">Documentos anexados</h4>

                        {docs.length === 0 ? (
                          <p className="text-slate-500">Nenhum documento anexado.</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {docs.map((doc) => (
                              <a
                                key={doc.id}
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="border border-blue-900 rounded-xl p-3 hover:border-green-500 transition"
                              >
                                <p className="font-bold break-all">📎 {doc.nome}</p>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="xl:w-[260px] flex flex-col gap-3">
                      {itemArquivado ? (
                        <button
                          onClick={() => restaurarDaLista(item)}
                          disabled={restaurando === item.id}
                          className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-bold disabled:opacity-60"
                        >
                          {restaurando === item.id ? 'Restaurando...' : 'Restaurar para lista'}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => atualizarStatus(item.id, 'EM ANÁLISE')}
                            className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl font-bold"
                          >
                            Marcar em análise
                          </button>

                          <button
                            onClick={() => converterEmEmbarque(item)}
                            disabled={convertendo === item.id}
                            className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-bold disabled:opacity-60"
                          >
                            {convertendo === item.id ? 'Convertendo...' : 'Converter em embarque'}
                          </button>

                          <button
                            onClick={() => atualizarStatus(item.id, 'RECUSADO')}
                            className="bg-red-600 hover:bg-red-500 px-5 py-3 rounded-xl font-bold"
                          >
                            Recusar
                          </button>

                          <button
                            onClick={() => removerDaLista(item)}
                            disabled={removendo === item.id}
                            className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold disabled:opacity-60"
                          >
                            {removendo === item.id ? 'Removendo...' : 'Remover da lista'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

function Card({ titulo, valor, detalhe, icone, onClick }: any) {
  const conteudo = (
    <div className="flex justify-between items-start gap-4">
      <div>
        <p className="text-slate-300 font-bold">{titulo}</p>
        <h2 className="text-5xl font-black mt-4 text-white">{valor}</h2>
        <p className="text-slate-400 mt-2">{detalhe}</p>
      </div>

      <div className="text-4xl">{icone}</div>
    </div>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="text-left w-full border border-blue-900 rounded-3xl bg-[#071225] p-6 hover:border-blue-400 hover:bg-blue-600/10 transition"
      >
        {conteudo}
      </button>
    )
  }

  return (
    <div className="border border-blue-900 rounded-3xl bg-[#071225] p-6">
      {conteudo}
    </div>
  )
}

function Info({ label, valor }: any) {
  return (
    <div className="border border-blue-900 bg-[#071225] rounded-2xl p-4">
      <p className="text-slate-500 text-sm mb-1">{label}</p>
      <p className="font-bold break-words">{valor || '-'}</p>
    </div>
  )
}

function TextoBox({ titulo, texto }: any) {
  return (
    <div className="border border-blue-900 bg-[#071225] rounded-2xl p-4">
      <p className="text-slate-500 text-sm mb-2">{titulo}</p>
      <p className="text-slate-300 whitespace-pre-wrap">{texto || '-'}</p>
    </div>
  )
}

function Status({ status }: any) {
  const s = String(status || '').toUpperCase()

  let classe = 'bg-yellow-500/20 text-yellow-300 border-yellow-500'
  let icone = '🟡'

  if (s === 'EM ANÁLISE') {
    classe = 'bg-blue-600/20 text-blue-300 border-blue-500'
    icone = '🔎'
  } else if (s === 'CONVERTIDO EM EMBARQUE') {
    classe = 'bg-green-600/20 text-green-300 border-green-500'
    icone = '✅'
  } else if (s === 'RECUSADO') {
    classe = 'bg-red-600/20 text-red-300 border-red-500'
    icone = '❌'
  } else if (s === 'ARQUIVADO' || s === 'EXCLUIDO') {
    classe = 'bg-slate-700/30 text-slate-300 border-slate-500'
    icone = '🗄️'
  }

  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-black ${classe}`}>
      <span>{icone}</span>
      {status || 'AGUARDANDO ANÁLISE'}
    </span>
  )
}
