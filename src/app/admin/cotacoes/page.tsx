'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function CotacoesAdminPage() {
  const [cotacoes, setCotacoes] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroArquivamento, setFiltroArquivamento] = useState<'ATIVAS' | 'ARQUIVADAS' | 'TODAS'>('ATIVAS')
  const [awbsPorEmbarque, setAwbsPorEmbarque] = useState<Record<string, string>>({})

  useEffect(() => {
    carregar()
    carregarUsuarios()
  }, [])

  async function carregar() {
    const { data, error } = await supabase
      .from('cotacoes')
      .select('*')
      .order('criado_em', { ascending: false })

    if (error) {
      console.error('Erro ao carregar cotações:', error)
      return
    }

    const lista = data || []
    setCotacoes(lista)

    const idsEmbarques = Array.from(
      new Set(
        lista
          .map((item: any) => String(item.embarque_id || '').trim())
          .filter(Boolean)
      )
    )

    if (idsEmbarques.length === 0) {
      setAwbsPorEmbarque({})
      return
    }

    const { data: embarquesData, error: erroEmbarques } = await supabase
      .from('embarques')
      .select('id, awb')
      .in('id', idsEmbarques)

    if (erroEmbarques) {
      console.error('Erro ao carregar AWBs das cotações convertidas:', erroEmbarques)
      setAwbsPorEmbarque({})
      return
    }

    setAwbsPorEmbarque(
      Object.fromEntries(
        (embarquesData || []).map((item: any) => [
          String(item.id),
          String(item.awb || ''),
        ])
      )
    )
  }

  async function carregarUsuarios() {
    const { data } = await supabase
      .from('perfis')
      .select('*')
      .order('nome')

    setUsuarios(data || [])
  }

  function nomeUsuario(usuarioId: string) {
    const usuario = usuarios.find((item) => item.id === usuarioId)
    return usuario?.nome || usuario?.email || '-'
  }

  function emailUsuario(usuarioId: string) {
    const usuario = usuarios.find((item) => item.id === usuarioId)
    return usuario?.email || '-'
  }

  function dataHoraBR(data?: string | null) {
    if (!data) return '-'

    return new Date(data).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function tempoNaFila(data?: string | null) {
    if (!data) return '-'

    const inicio = new Date(data).getTime()
    const agora = Date.now()
    const diff = Math.max(0, agora - inicio)

    const minutos = Math.floor(diff / 60000)
    const horas = Math.floor(minutos / 60)
    const dias = Math.floor(horas / 24)

    if (dias > 0) return `${dias}d ${horas % 24}h`
    if (horas > 0) return `${horas}h ${minutos % 60}min`
    return `${minutos}min`
  }

  function dadosEmissorObjeto(item: any) {
    const dados = item?.dados_emissor

    if (dados && typeof dados === 'object' && !Array.isArray(dados)) {
      return dados
    }

    if (typeof dados === 'string') {
      try {
        const convertido = JSON.parse(dados)
        if (convertido && typeof convertido === 'object' && !Array.isArray(convertido)) {
          return convertido
        }
      } catch {}
    }

    return {}
  }

  function cotacaoArquivada(item: any) {
    return dadosEmissorObjeto(item)?.arquivada_admin === true
  }

  function awbCotacao(item: any) {
    if (!item?.embarque_id) return ''
    return awbsPorEmbarque[String(item.embarque_id)] || ''
  }

  async function alterarArquivamento(item: any, arquivar: boolean) {
    const confirmar = confirm(
      arquivar
        ? 'Arquivar esta cotação da fila principal? Ela continuará salva e poderá ser restaurada.'
        : 'Restaurar esta cotação para a fila principal?'
    )

    if (!confirmar) return

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const dadosAtuais = dadosEmissorObjeto(item)

    const { error } = await supabase
      .from('cotacoes')
      .update({
        dados_emissor: {
          ...dadosAtuais,
          arquivada_admin: arquivar,
          arquivada_admin_em: arquivar ? new Date().toISOString() : null,
          arquivada_admin_por: arquivar ? user?.id || null : null,
        },
      })
      .eq('id', item.id)

    if (error) {
      console.error('Erro ao alterar arquivamento da cotação:', error)
      alert(error.message)
      return
    }

    await carregar()
  }

  async function atualizarStatus(id: string, status: string) {
  const cotacao = cotacoes.find((c) => c.id === id)

  const { error } = await supabase
    .from('cotacoes')
    .update({ status })
    .eq('id', id)

  if (error) {
    alert('Erro ao atualizar status')
    console.log(error)
    return
  }

  if (
    status === 'COTAÇÃO DISPONÍVEL' &&
    cotacao?.solicitante_email
  ) {
    try {
      await fetch('/api/enviar-email-cotacao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          referencia_hc: cotacao.referencia_hc, 
          email: cotacao.solicitante_email,
          cliente: cotacao.cliente_final,
          origem: cotacao.origem,
          destino: cotacao.destino,
          tipo_operacao: cotacao.tipo_operacao,
        }),
      })
    } catch (err) {
      console.error(err)
    }
  }

  carregar()
}

  async function excluirCotacao(id: string) {
    const confirmar = confirm('Deseja realmente excluir esta cotação?')
    if (!confirmar) return

    const { error } = await supabase.from('cotacoes').delete().eq('id', id)

    if (error) {
      alert('Erro ao excluir cotação')
      console.log(error)
      return
    }

    carregar()
  }

  const cotacoesFiltradas = useMemo(() => {
    return cotacoes
      .filter((item) => {
        const arquivada = cotacaoArquivada(item)
        const texto = `
          ${nomeUsuario(item.usuario_id)}
          ${emailUsuario(item.usuario_id)}
          ${item.solicitante_email}
          ${item.cliente_final}
          ${item.referencia_hc}
          ${item.referencia_cliente}
          ${awbCotacao(item)}
          ${item.tipo_operacao}
          ${item.origem}
          ${item.destino}
          ${item.status}
        `.toLowerCase()

        const matchBusca = texto.includes(busca.toLowerCase())
        const matchStatus = !filtroStatus || item.status === filtroStatus
        const matchArquivamento =
          filtroArquivamento === 'TODAS' ||
          (filtroArquivamento === 'ARQUIVADAS' ? arquivada : !arquivada)

        return matchBusca && matchStatus && matchArquivamento
      })
      .sort((a, b) => {
        const dataA = a.criado_em ? new Date(a.criado_em).getTime() : 0
        const dataB = b.criado_em ? new Date(b.criado_em).getTime() : 0

        return dataA - dataB
      })
  }, [cotacoes, usuarios, busca, filtroStatus, filtroArquivamento, awbsPorEmbarque])

  function corStatus(status: string) {
    if (status === 'AGUARDANDO ANÁLISE') return 'bg-yellow-400 text-black'
    if (status === 'EM ANÁLISE') return 'bg-blue-600 text-white'
    if (status === 'AGUARDANDO TRANSPORTADORA') return 'bg-purple-600 text-white'
    if (status === 'COTAÇÃO DISPONÍVEL') return 'bg-emerald-600 text-white'
    if (status === 'APROVADA') return 'bg-green-700 text-white'
    if (status === 'AUTORIZADA') return 'bg-green-700 text-white'
    if (status === 'RECUSADA') return 'bg-red-600 text-white'
    if (status === 'CONVERTIDA EM EMBARQUE') return 'bg-slate-700 text-white'
    return 'bg-slate-600 text-white'
  }

  const cotacoesAtivas = cotacoes.filter((c) => !cotacaoArquivada(c))
  const totalAguardando = cotacoesAtivas.filter((c) => c.status === 'AGUARDANDO ANÁLISE').length
  const totalAnalise = cotacoesAtivas.filter((c) => c.status === 'EM ANÁLISE').length
  const totalDisponiveis = cotacoesAtivas.filter((c) => c.status === 'COTAÇÃO DISPONÍVEL').length
  const totalAprovadas = cotacoesAtivas.filter((c) => c.status === 'APROVADA' || c.status === 'AUTORIZADA').length
  const totalRecusadas = cotacoesAtivas.filter((c) => c.status === 'RECUSADA').length

  const proximaCotacao = cotacoesFiltradas[0]
  const ultimaCotacao = cotacoesFiltradas[cotacoesFiltradas.length - 1]

  return (
    <main className="w-full max-w-none p-8 text-white">
      <div className="mb-8 flex flex-col lg:flex-row justify-between gap-6">
        <div>
          <p className="text-blue-400 font-bold mb-2">Comercial</p>

          <h1 className="text-5xl font-black mb-2">
            Cotações
          </h1>

          <p className="text-slate-400 text-lg">
            Gerencie solicitações recebidas, acompanhe status e envie respostas ao cliente.
          </p>
        </div>

                <a
          href="/admin/cotacoes/nova"
          className="rounded-xl bg-green-700 px-5 py-3 font-black text-white hover:bg-green-600"
        >
          + Cotação manual
        </a>

<button
          onClick={carregar}
          className="bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold h-fit"
        >
          Atualizar fila
        </button>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-6 gap-5 mb-8">
        <Card titulo="Total" valor={cotacoesAtivas.length} detalhe="Cotações ativas" icone="📨" />
        <Card titulo="Aguardando" valor={totalAguardando} detalhe="Nova análise" icone="⏳" />
        <Card titulo="Em análise" valor={totalAnalise} detalhe="Em tratamento" icone="🔎" />
        <Card titulo="Disponíveis" valor={totalDisponiveis} detalhe="Resposta enviada" icone="📄" />
        <Card titulo="Aprovadas" valor={totalAprovadas} detalhe="Cliente aprovou" icone="✅" />
        <Card titulo="Recusadas" valor={totalRecusadas} detalhe="Não aprovadas" icone="❌" />
      </section>

      <section className="border border-blue-900 rounded-3xl bg-[#071225] p-6 mb-8">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
          <div>
            <p className="text-blue-400 font-bold mb-1">Fila virtual</p>
            <h2 className="text-2xl font-black">Ordem de chegada das cotações</h2>
            <p className="text-slate-400 text-sm mt-1">
              A sequência abaixo é ordenada pela data e hora em que a cotação entrou no portal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 xl:min-w-[760px]">
            <FilaCard
              titulo="Na fila filtrada"
              valor={cotacoesFiltradas.length}
              detalhe="cotações na sequência"
            />

            <FilaCard
              titulo="Próxima da fila"
              valor={proximaCotacao ? '#1' : '-'}
              detalhe={proximaCotacao ? `${proximaCotacao.cliente_final || proximaCotacao.solicitante_email || 'Cliente'} · ${dataHoraBR(proximaCotacao.criado_em)}` : 'Sem cotação'}
            />

            <FilaCard
              titulo="Última entrada"
              valor={ultimaCotacao ? dataHoraBR(ultimaCotacao.criado_em) : '-'}
              detalhe={ultimaCotacao ? ultimaCotacao.cliente_final || ultimaCotacao.solicitante_email || 'Cliente' : 'Sem cotação'}
            />
          </div>
        </div>
      </section>

      <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7 mb-8">
        <div className="flex flex-col lg:flex-row justify-between gap-5 mb-7">
          <div>
            <h2 className="text-2xl font-black">
              Filtros da fila comercial
            </h2>

            <p className="text-slate-400 text-sm mt-1">
              Busque por referência, cliente, e-mail, operação, origem, destino ou status.
            </p>
          </div>

          <button
            onClick={() => {
              setBusca('')
              setFiltroStatus('')
              setFiltroArquivamento('ATIVAS')
            }}
            className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold h-fit"
          >
            Limpar filtros
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            placeholder="Buscar por referência, usuário, e-mail, cliente, origem, destino..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />

          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="AGUARDANDO ANÁLISE">Aguardando análise</option>
            <option value="EM ANÁLISE">Em análise</option>
            <option value="AGUARDANDO TRANSPORTADORA">Aguardando transportadora</option>
            <option value="COTAÇÃO DISPONÍVEL">Cotação disponível</option>
            <option value="APROVADA">Aprovada</option>
            <option value="AUTORIZADA">Autorizada</option>
            <option value="RECUSADA">Recusada</option>
            <option value="CONVERTIDA EM EMBARQUE">Convertida em embarque</option>
          </select>

          <select
            value={filtroArquivamento}
            onChange={(e) =>
              setFiltroArquivamento(
                e.target.value as 'ATIVAS' | 'ARQUIVADAS' | 'TODAS'
              )
            }
          >
            <option value="ATIVAS">Somente ativas</option>
            <option value="ARQUIVADAS">Somente arquivadas</option>
            <option value="TODAS">Ativas e arquivadas</option>
          </select>

          <div className="border border-blue-900 rounded-2xl bg-[#020817] px-5 py-3 text-slate-300 font-bold flex items-center">
            {cotacoesFiltradas.length} cotação(ões) encontrada(s)
          </div>
        </div>
      </section>

      <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
        <div className="flex flex-col lg:flex-row justify-between gap-5 mb-7">
          <div>
            <h2 className="text-2xl font-black">
              Solicitações recebidas
            </h2>

            <p className="text-slate-400 text-sm">
              Acompanhe os pedidos e atualize o status da cotação.
            </p>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="table w-full border-collapse">
            <thead>
              <tr>
                <th>Fila</th>
                <th>Chegou em</th>
                <th>Tempo</th>
                <th>Solicitante</th>
                <th>Referência</th>
                <th>AWB</th>
                <th>E-mail</th>
                <th>Cliente final</th>
                <th>Operação</th>
                <th>Rota</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              {cotacoesFiltradas.map((item, index) => (
                <tr key={item.id} className="border-b border-blue-900/60 hover:bg-[#0b1730] transition">
                  <td>
                    <span className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-3 py-2 text-sm font-black text-white">
                      #{index + 1}
                    </span>
                  </td>

                  <td>
                    <div>
                      <p className="font-bold">
                        {dataHoraBR(item.criado_em)}
                      </p>

                      <p className="text-slate-500 text-xs">
                        Entrada registrada
                      </p>
                    </div>
                  </td>

                  <td>
                    <span className="inline-flex rounded-xl border border-blue-900 bg-[#020817] px-3 py-2 text-xs font-black text-blue-300">
                      {tempoNaFila(item.criado_em)}
                    </span>
                  </td>

                  <td>
                    <div>
                      <p className="font-black">
                        {nomeUsuario(item.usuario_id)}
                      </p>

                      <p className="text-slate-500 text-xs">
                        ID: {item.id?.slice(0, 8)}
                      </p>
                    </div>
                  </td>

                  <td>
                    <div className="min-w-[150px]">
                      <p className="font-black text-blue-300">
                        {item.referencia_hc || item.referencia_cliente || '-'}
                      </p>
                      {item.referencia_hc && item.referencia_cliente && (
                        <p className="mt-1 text-xs text-slate-500">
                          Cliente: {item.referencia_cliente}
                        </p>
                      )}
                    </div>
                  </td>

                  <td>
                    {item.embarque_id ? (
                      <a
                        href={`/admin/embarques/${item.embarque_id}`}
                        className="inline-flex min-w-[145px] items-center justify-center rounded-xl border border-cyan-700 bg-cyan-950/40 px-3 py-2 text-xs font-black text-cyan-300 hover:bg-cyan-900/50"
                      >
                        {awbCotacao(item) || 'Abrir embarque'}
                      </a>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>

                  <td>{item.solicitante_email || emailUsuario(item.usuario_id)}</td>

                  <td>{item.cliente_final || '-'}</td>

                  <td>
                    <span className="bg-slate-800 border border-blue-900 px-3 py-2 rounded-xl font-bold">
                      {item.tipo_operacao || '-'}
                    </span>
                  </td>

                  <td>
                    <div>
                      <p className="font-bold">{item.origem || '-'}</p>
                      <p className="text-slate-500 text-sm">→ {item.destino || '-'}</p>
                    </div>
                  </td>

                  <td>
                    <div className="flex min-w-[170px] flex-col items-start gap-2">
                      <span className={`px-3 py-2 rounded-xl text-xs font-black ${corStatus(item.status)}`}>
                        {item.status || 'AGUARDANDO ANÁLISE'}
                      </span>

                      {cotacaoArquivada(item) ? (
                        <span className="rounded-full border border-amber-600/60 bg-amber-600/10 px-3 py-1 text-[10px] font-black uppercase text-amber-300">
                          Arquivada
                        </span>
                      ) : null}
                    </div>
                  </td>

                  <td>
                    <div className="flex gap-2 flex-wrap">
                                            <a
                        href={item.pdf_cotacao_url || item.arquivo_resposta_url || `/admin/cotacoes/${item.id}`}
                        target={item.pdf_cotacao_url || item.arquivo_resposta_url ? '_blank' : undefined}
                        rel={item.pdf_cotacao_url || item.arquivo_resposta_url ? 'noreferrer' : undefined}
                        className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl text-white font-bold"
                      >
                        Ver PDF
                      </a>

                      <a
                        href={`/admin/cotacoes/nova?editar=${item.id}`}
                        className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl text-white font-bold"
                      >
                        Editar
                      </a>

                      <button
                        onClick={() => atualizarStatus(item.id, 'EM ANÁLISE')}
                        className="bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded-xl font-bold"
                      >
                        Análise
                      </button>

                      <button
                        onClick={() => atualizarStatus(item.id, 'AGUARDANDO TRANSPORTADORA')}
                        className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-xl font-bold"
                      >
                        Aguardando
                      </button>

                      <button
                        onClick={() => atualizarStatus(item.id, 'COTAÇÃO DISPONÍVEL')}
                        className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-xl font-bold"
                      >
                        Disponível
                      </button>

                      {item.status === 'COTAÇÃO DISPONÍVEL' && (
                        <button
                          onClick={() => atualizarStatus(item.id, 'APROVADA')}
                          className="bg-green-700 hover:bg-green-600 px-4 py-2 rounded-xl font-bold"
                          title="Use quando o cliente aprovar a cotação por e-mail, WhatsApp ou outro canal externo."
                        >
                          Aprovar
                        </button>
                      )}

                      {(item.status === 'APROVADA' || item.status === 'AUTORIZADA') && (
                        <a
                          href={`/admin/cotacoes/${item.id}`}
                          className="bg-cyan-700 hover:bg-cyan-600 px-4 py-2 rounded-xl font-bold text-white"
                        >
                          Converter em embarque
                        </a>
                      )}

                      <button
                        onClick={() => atualizarStatus(item.id, 'RECUSADA')}
                        className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-xl font-bold"
                      >
                        Recusar
                      </button>

                      <button
                        onClick={() => alterarArquivamento(item, !cotacaoArquivada(item))}
                        className={
                          cotacaoArquivada(item)
                            ? 'bg-emerald-700 hover:bg-emerald-600 px-4 py-2 rounded-xl font-bold'
                            : 'bg-amber-700 hover:bg-amber-600 px-4 py-2 rounded-xl font-bold'
                        }
                      >
                        {cotacaoArquivada(item) ? 'Restaurar' : 'Arquivar'}
                      </button>

                      <button
                        onClick={() => excluirCotacao(item.id)}
                        className="bg-red-800 hover:bg-red-700 px-4 py-2 rounded-xl font-bold"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {cotacoesFiltradas.length === 0 && (
            <div className="border border-blue-900 bg-[#020817] rounded-2xl p-8 text-center text-slate-400 mt-6">
              Nenhuma cotação encontrada.
            </div>
          )}
        </div>
      </section>
    </main>
  )
}


function FilaCard({ titulo, valor, detalhe }: any) {
  return (
    <div className="rounded-2xl border border-blue-900 bg-[#020817] p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {titulo}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{valor}</p>
      <p className="mt-1 text-xs text-slate-500 line-clamp-2">{detalhe}</p>
    </div>
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