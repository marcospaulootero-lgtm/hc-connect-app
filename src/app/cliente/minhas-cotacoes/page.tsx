'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function MinhasCotacoesPage() {
  const [usuario, setUsuario] = useState<any>(null)
  const [cotacoes, setCotacoes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('TODOS')

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

    if (error || !perfil) {
      window.location.href = '/login'
      return
    }

    if (perfil.tipo_acesso === 'admin') {
      window.location.href = '/admin'
      return
    }

    const usuarioLogado = {
      ...perfil,
      id: user.id,
      email: user.email,
    }

    setUsuario(usuarioLogado)
    carregarCotacoes(user.id)
  }

  async function carregarCotacoes(usuarioId: string) {
    setLoading(true)

    const { data, error } = await supabase
      .from('cotacoes')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('criado_em', { ascending: false })

    if (error) {
      console.log(error)
      setLoading(false)
      return
    }

    setCotacoes(data || [])
    setLoading(false)
  }

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

  function dataHoraBR(data?: string | null) {
    if (!data) return '-'
    return new Date(data).toLocaleString('pt-BR')
  }

  function transportadorasTexto(item: any) {
    if (Array.isArray(item.transportadoras_consulta)) {
      return item.transportadoras_consulta.join(', ')
    }

    if (typeof item.transportadoras_consulta === 'string') {
      try {
        const lista = JSON.parse(item.transportadoras_consulta)
        if (Array.isArray(lista)) return lista.join(', ')
      } catch {}
      return item.transportadoras_consulta
    }

    return '-'
  }

  async function atualizarStatusCotacao(id: string, status: string) {
    const confirmar = confirm(
      status === 'APROVADA'
        ? 'Confirmar aprovação desta cotação?'
        : 'Confirmar recusa desta cotação?'
    )

    if (!confirmar) return

    const { error } = await supabase
      .from('cotacoes')
      .update({
        status,
        autorizada: status === 'APROVADA',
        data_autorizacao:
          status === 'APROVADA'
            ? new Date().toISOString()
            : null,
      })
      .eq('id', id)

    if (error) {
      alert('Erro ao atualizar cotação')
      console.log(error)
      return
    }

    alert(
      status === 'APROVADA'
        ? 'Cotação aprovada com sucesso'
        : 'Cotação recusada'
    )

    carregarCotacoes(usuario.id)
  }

  async function excluirCotacao(id: string) {
    if (!usuario?.id) return

    const confirmar = confirm('Deseja realmente excluir esta cotação do seu histórico?')
    if (!confirmar) return

    const { error } = await supabase
      .from('cotacoes')
      .delete()
      .eq('id', id)
      .eq('usuario_id', usuario.id)

    if (error) {
      alert('Erro ao excluir cotação')
      console.log(error)
      return
    }

    alert('Cotação excluída do histórico')
    carregarCotacoes(usuario.id)
  }

  const cotacoesFiltradas = useMemo(() => {
    return cotacoes.filter((item) => {
      const texto = `
        ${item.exportador || ''}
        ${item.importador || ''}
        ${item.referencia_cliente || ''}
        ${item.cliente_final || ''}
        ${item.servico || ''}
        ${item.tipo_operacao || ''}
        ${item.origem || ''}
        ${item.destino || ''}
        ${item.status || ''}
      `.toLowerCase()

      const passaBusca = texto.includes(busca.toLowerCase())
      const passaStatus = filtroStatus === 'TODOS' || item.status === filtroStatus

      return passaBusca && passaStatus
    })
  }, [cotacoes, busca, filtroStatus])

  const totalAguardando = cotacoes.filter((c) => c.status === 'AGUARDANDO ANÁLISE').length
  const totalAnalise = cotacoes.filter((c) => c.status === 'EM ANÁLISE').length
  const totalDisponiveis = cotacoes.filter((c) => c.status === 'COTAÇÃO DISPONÍVEL').length
  const totalAprovadas = cotacoes.filter((c) => c.status === 'APROVADA' || c.status === 'AUTORIZADA').length
  const totalRecusadas = cotacoes.filter((c) => c.status === 'RECUSADA').length

  return (
    <main className="min-h-screen bg-[#020817] text-white px-4 py-6 md:px-6 lg:px-8">
      <div className="w-full max-w-none mx-auto">
        <div className="mb-10 flex flex-col lg:flex-row justify-between items-start gap-6">
          <div>
            <h1 className="text-5xl font-black mb-2">
              Minhas cotações
            </h1>

            <p className="text-slate-400 text-lg">
              Acompanhe suas solicitações enviadas, respostas da HC e aprove ou recuse as cotações disponíveis.
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <a
              href="/cliente/cotacoes"
              className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl text-white font-bold"
            >
              Solicitar nova cotação
            </a>

            <a
              href="/cliente"
              className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl text-white font-bold"
            >
              Voltar ao portal
            </a>
          </div>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-6 gap-5 mb-8">
          <Card titulo="Total" valor={cotacoes.length} detalhe="Solicitações" icone="📨" />
          <Card titulo="Aguardando" valor={totalAguardando} detalhe="Nova análise" icone="⏳" />
          <Card titulo="Em análise" valor={totalAnalise} detalhe="Em tratamento" icone="🔎" />
          <Card titulo="Disponíveis" valor={totalDisponiveis} detalhe="Resposta enviada" icone="📄" />
          <Card titulo="Aprovadas" valor={totalAprovadas} detalhe="Autorizadas" icone="✅" />
          <Card titulo="Recusadas" valor={totalRecusadas} detalhe="Não aprovadas" icone="❌" />
        </section>

        <section className="card mb-8">
          <div className="flex flex-col lg:flex-row justify-between gap-5 mb-5">
            <div>
              <h2 className="text-2xl font-black">Filtros</h2>
              <p className="text-slate-400 text-sm">
                Busque por exportador, importador, referência, serviço, rota ou status.
              </p>
            </div>

            <button
              onClick={() => {
                setBusca('')
                setFiltroStatus('TODOS')
              }}
              className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold h-fit"
            >
              Limpar filtros
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cotação..."
            />

            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="TODOS">Todos os status</option>
              <option value="AGUARDANDO ANÁLISE">Aguardando análise</option>
              <option value="EM ANÁLISE">Em análise</option>
              <option value="AGUARDANDO TRANSPORTADORA">Aguardando transportadora</option>
              <option value="COTAÇÃO DISPONÍVEL">Cotação disponível</option>
              <option value="APROVADA">Aprovada</option>
              <option value="AUTORIZADA">Autorizada</option>
              <option value="RECUSADA">Recusada</option>
              <option value="CONVERTIDA EM EMBARQUE">Convertida em embarque</option>
            </select>

            <div className="border border-blue-900 rounded-2xl bg-[#020817] px-5 py-3 text-slate-300 font-bold flex items-center">
              {cotacoesFiltradas.length} cotação(ões) encontrada(s)
            </div>
          </div>
        </section>

        <section className="card">
          <h2 className="text-2xl font-black mb-6">
            Acompanhamento das cotações
          </h2>

          {loading ? (
            <div className="border border-blue-900 bg-[#020817] rounded-2xl p-6 text-slate-400">
              Carregando cotações...
            </div>
          ) : cotacoesFiltradas.length === 0 ? (
            <div className="border border-blue-900 bg-[#020817] rounded-2xl p-6 text-slate-400">
              Nenhuma cotação encontrada.
            </div>
          ) : (
            <div className="space-y-5">
              {cotacoesFiltradas.map((item, index) => (
                <article
                  key={item.id}
                  className="border border-blue-900 rounded-3xl p-6 bg-[#020817]"
                >
                  <div className="flex flex-col xl:flex-row justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-3 items-center mb-4">
                        <span className="bg-blue-600 px-3 py-2 rounded-xl text-sm font-black">
                          #{index + 1}
                        </span>

                        <span className={`px-3 py-2 rounded-xl text-xs font-black ${corStatus(item.status)}`}>
                          {item.status || 'AGUARDANDO ANÁLISE'}
                        </span>

                        <span className="text-slate-500 text-sm">
                          Enviada em {dataHoraBR(item.criado_em)}
                        </span>
                      </div>

                      <h3 className="text-2xl font-black text-blue-400 mb-4">
                        {item.servico || item.tipo_operacao || '-'}
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Info label="Exportador" valor={item.exportador || item.cliente_final || '-'} />
                        <Info label="Importador" valor={item.importador || '-'} />
                        <Info label="Referência" valor={item.referencia_cliente || '-'} />
                        <Info label="Transportadoras" valor={transportadorasTexto(item)} />
                        <Info label="Origem" valor={item.origem || '-'} />
                        <Info label="Destino" valor={item.destino || '-'} />
                        <Info label="Peso real" valor={item.peso_real ? `${item.peso_real} kg` : `${item.peso || '-'} kg`} />
                        <Info label="Peso taxado" valor={item.peso_taxado ? `${item.peso_taxado} kg` : `${item.peso || '-'} kg`} />
                        <Info label="Valor mercadoria" valor={`${item.moeda || ''} ${item.valor_mercadoria || '-'}`} />
                        <Info label="Referência HC" valor={item.referencia_hc || '-'} />
                      </div>

                      {item.observacoes && (
                        <div className="mt-5 border border-blue-900 rounded-2xl p-5 bg-[#071225]">
                          <p className="text-slate-400 font-bold mb-2">Observações</p>
                          <p className="text-slate-300 leading-7">{item.observacoes}</p>
                        </div>
                      )}
                    </div>

                    <div className="xl:w-[240px] flex flex-col gap-3">
                      {item.pdf_cotacao_url ? (
                        <a
                          href={item.pdf_cotacao_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl text-white font-bold text-center"
                        >
                          Abrir PDF
                        </a>
                      ) : (
                        <span className="bg-slate-800 px-5 py-3 rounded-xl text-slate-400 font-bold text-center">
                          PDF indisponível
                        </span>
                      )}

                      {item.status === 'COTAÇÃO DISPONÍVEL' && (
                        <>
                          <button
                            onClick={() => atualizarStatusCotacao(item.id, 'APROVADA')}
                            className="bg-green-700 hover:bg-green-600"
                          >
                            Aprovar
                          </button>

                          <button
                            onClick={() => atualizarStatusCotacao(item.id, 'RECUSADA')}
                            className="bg-red-600 hover:bg-red-500"
                          >
                            Recusar
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => excluirCotacao(item.id)}
                        className="bg-red-800 hover:bg-red-700"
                      >
                        Excluir histórico
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function Card({ titulo, valor, detalhe, icone }: any) {
  return (
    <div className="border border-blue-900 rounded-3xl bg-[#071225] p-5">
      <div className="flex justify-between items-start gap-4">
        <div>
          <p className="text-slate-300 font-bold">{titulo}</p>
          <h2 className="text-4xl font-black mt-4 text-white">{valor}</h2>
          <p className="text-slate-400 mt-2 text-sm">{detalhe}</p>
        </div>

        <div className="text-3xl">{icone}</div>
      </div>
    </div>
  )
}

function Info({ label, valor }: any) {
  return (
    <div className="border border-blue-900 bg-[#071225] rounded-2xl p-4">
      <p className="text-slate-500 text-sm mb-2">{label}</p>
      <p className="font-bold break-words">{valor || '-'}</p>
    </div>
  )
}
