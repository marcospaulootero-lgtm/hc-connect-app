'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import StatusBadge from '@/components/StatusBadge'

export default function ClientePage() {
  const [usuario, setUsuario] = useState<any>(null)
  const [embarques, setEmbarques] = useState<any[]>([])
  const [cotacoes, setCotacoes] = useState<any[]>([])
  const [faturas, setFaturas] = useState<any[]>([])
  const [repassesParceiro, setRepassesParceiro] = useState<any[]>([])
  const [chamadosSuporte, setChamadosSuporte] = useState<any[]>([])
  const [documentosPorEmbarque, setDocumentosPorEmbarque] = useState<any>({})
  const [busca, setBusca] = useState('')
  const [filtroRapido, setFiltroRapido] = useState('NENHUM')

  useEffect(() => {
    carregarUsuario()
  }, [])

  useEffect(() => {
    if (!usuario?.id) return

    const channel = supabase
      .channel(`cliente-dashboard-suporte-${usuario.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'suporte',
          filter: `usuario_id=eq.${usuario.id}`,
        },
        () => carregarSuporte(usuario.id)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mensagens_suporte',
        },
        () => carregarSuporte(usuario.id)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [usuario?.id])

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

    setUsuario({
      id: user.id,
      nome: perfil?.nome || user.email,
      email: user.email,
      tipo: perfil?.tipo_acesso || 'CLIENTE',
    })

    carregarEmbarques(user.id)
    carregarCotacoes(user.id, user.email || '')
    carregarFaturas(user.id)
    carregarRepassesParceiro()
    carregarSuporte(user.id)
  }

  async function carregarSuporte(usuarioId: string) {
    const { data, error } = await supabase
      .from('suporte')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('criado_em', { ascending: false })

    if (error) {
      console.log('Erro ao carregar suporte do cliente:', error)
      return
    }

    setChamadosSuporte(data || [])
  }

  async function carregarEmbarques(usuarioId: string) {
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

    setEmbarques(unicos)

    const ids = unicos.map((e) => e.id)

    if (ids.length > 0) {
      const { data: docs } = await supabase
        .from('documentos_embarques')
        .select('*')
        .in('embarque_id', ids)

      const agrupado: any = {}

      docs?.forEach((doc) => {
        if (!agrupado[doc.embarque_id]) agrupado[doc.embarque_id] = []
        agrupado[doc.embarque_id].push(doc)
      })

      setDocumentosPorEmbarque(agrupado)
    } else {
      setDocumentosPorEmbarque({})
    }
  }

  async function carregarCotacoes(usuarioId: string, email: string) {
    const { data } = await supabase
      .from('cotacoes')
      .select('*')
      .or(`usuario_id.eq.${usuarioId},solicitante_email.eq.${email}`)
      .order('criado_em', { ascending: false })

    setCotacoes(data || [])
  }

  async function carregarFaturas(usuarioId: string) {
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
      return
    }

    const { data } = await supabase
      .from('faturas')
      .select('id, embarque_id, arquivo_pdf, recibo_pdf, criado_em, visivel_cliente')
      .in('embarque_id', ids)
      .eq('visivel_cliente', true)
      .order('criado_em', { ascending: false })

    setFaturas(data || [])
  }

  async function carregarRepassesParceiro() {
    try {
      const { data, error } = await supabase.rpc('get_meus_repasses_parceiro')

      if (error) {
        console.log('Recebimentos de parceiro ainda não disponíveis:', error)
        setRepassesParceiro([])
        return
      }

      setRepassesParceiro(data || [])
    } catch (error) {
      console.log('Erro ao carregar recebimentos de parceiro:', error)
      setRepassesParceiro([])
    }
  }

  async function sair() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function normalizarTexto(texto: string) {
    return String(texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  }

  function dataBR(data?: string | null) {
    if (!data) return '-'
    return new Date(data).toLocaleString('pt-BR')
  }


  function numero(valor: any) {
    if (valor === null || valor === undefined || valor === '') return 0
    if (typeof valor === 'number') return valor

    return (
      Number(
        String(valor)
          .replace(/[R$\s]/gi, '')
          .replace(/\./g, '')
          .replace(',', '.')
      ) || 0
    )
  }

  function moeda(valor: any) {
    return numero(valor).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
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
    if (s.includes('liberado')) return 85
    if (s.includes('fiscalizacao')) return 70
    if (s.includes('em transito')) return 55
    if (s.includes('coletado')) return 40
    if (s.includes('aguardando coleta') || s.includes('etiqueta gerada')) return 20

    return 0
  }

  function corCotacao(status: string) {
    if (status === 'COTAÇÃO DISPONÍVEL') return 'bg-emerald-600 text-white'
    if (status === 'APROVADA' || status === 'AUTORIZADA') return 'bg-green-700 text-white'
    if (status === 'RECUSADA') return 'bg-red-600 text-white'
    if (status === 'EM ANÁLISE') return 'bg-blue-600 text-white'
    if (status === 'AGUARDANDO TRANSPORTADORA') return 'bg-purple-600 text-white'
    return 'bg-yellow-400 text-black'
  }

  function whatsResponsavel(email?: string | null) {
    const e = String(email || '').toLowerCase()

    if (e.includes('herica')) return '5531999097666'
    if (e.includes('marcos')) return '5531988134482'

    return '553136436175'
  }

  function passaFiltroRapido(item: any) {
    const status = normalizarTexto(item.status_operacional)
    const documentos = documentosPorEmbarque[item.id] || []

    if (filtroRapido === 'NENHUM') return false
    if (filtroRapido === 'TODOS') return true

    if (filtroRapido === 'AGUARDANDO_COLETA') {
      return status.includes('aguardando coleta') || status.includes('etiqueta gerada')
    }

    if (filtroRapido === 'EM_TRANSITO') {
      return status.includes('em transito')
    }

    if (filtroRapido === 'FISCALIZACAO') {
      return status.includes('fiscalizacao')
    }

    if (filtroRapido === 'LIBERADOS') {
      return status.includes('liberado')
    }

    if (filtroRapido === 'ENTREGUES') {
      return status.includes('entregue')
    }

    if (filtroRapido === 'DOCUMENTOS') {
      return documentos.length > 0
    }

    return true
  }

  function nomeFiltroRapido() {
    const nomes: Record<string, string> = {
      NENHUM: 'Nenhum filtro selecionado',
      TODOS: 'Todos os embarques',
      AGUARDANDO_COLETA: 'Aguardando coleta',
      EM_TRANSITO: 'Em trânsito',
      FISCALIZACAO: 'Fiscalização',
      LIBERADOS: 'Liberados',
      ENTREGUES: 'Entregues',
      DOCUMENTOS: 'Com documentos',
    }

    return nomes[filtroRapido] || 'Nenhum filtro selecionado'
  }

  const temFiltroAtivo = filtroRapido !== 'NENHUM' || busca.trim().length > 0

  const filtrados = temFiltroAtivo ? embarques.filter((item) => {
    const texto = `
      ${item.awb}
      ${item.transportadora}
      ${item.origem}
      ${item.destino}
      ${item.status_operacional}
      ${item.exportador}
      ${item.importador}
      ${item.referencia_cliente}
      ${item.referencia_hc}
      ${item.master}
      ${item.responsavel_nome}
      ${item.responsavel_email}
    `.toLowerCase()

    const passaBusca = texto.includes(busca.toLowerCase())

    return passaBusca && passaFiltroRapido(item)
  }) : []

  const documentosTotal = Object.values(documentosPorEmbarque).reduce(
    (acc: number, lista: any) => acc + Number(lista?.length || 0),
    0
  )

  const aguardandoColeta = embarques.filter((e) => {
    const s = normalizarTexto(e.status_operacional)
    return s.includes('aguardando coleta') || s.includes('etiqueta gerada')
  }).length

  const emTransito = embarques.filter(
    (e) => normalizarTexto(e.status_operacional) === 'em transito'
  ).length

  const fiscalizacao = embarques.filter(
    (e) => normalizarTexto(e.status_operacional) === 'fiscalizacao'
  ).length

  const liberados = embarques.filter(
    (e) => normalizarTexto(e.status_operacional) === 'liberado'
  ).length

  const entregues = embarques.filter(
    (e) => normalizarTexto(e.status_operacional) === 'entregue'
  ).length

  const pesoTotal = embarques.reduce(
    (acc, e) => acc + Number(e.peso_taxado || e.peso_real || 0),
    0
  )

  const cotacoesDisponiveis = cotacoes.filter((c) => c.status === 'COTAÇÃO DISPONÍVEL').length
  const cotacoesAnalise = cotacoes.filter(
    (c) => c.status === 'EM ANÁLISE' || c.status === 'AGUARDANDO TRANSPORTADORA'
  ).length

  const ultimosEmbarques = embarques.slice(0, 5)
  const ultimasCotacoes = cotacoes.slice(0, 4)
  const faturasDisponiveis = faturas.length
  const recibosDisponiveis = faturas.filter((f) => f.recibo_pdf).length
  const repassesDisponiveis = repassesParceiro.length
  const repassesPendentes = repassesParceiro.filter((item) => String(item.status_pagamento || item.pgta_terceiros || '').toUpperCase() !== 'PAGO')
  const repassesPagos = repassesParceiro.filter((item) => String(item.status_pagamento || item.pgta_terceiros || '').toUpperCase() === 'PAGO')
  const totalRepassesAReceber = repassesPendentes.reduce((acc, item) => acc + numero(item.valor_receber || item.debito_terceiro || 0), 0)
  const suporteAbertos = chamadosSuporte.filter((c) => c.status === 'ABERTO').length
  const suporteAnalise = chamadosSuporte.filter((c) => c.status === 'EM ANÁLISE').length
  const suporteRespondidos = chamadosSuporte.filter((c) => c.status === 'RESPONDIDO').length
  const suporteResolvidos = chamadosSuporte.filter((c) => c.status === 'RESOLVIDO').length
  const suporteAtivos = chamadosSuporte.filter((c) => c.status !== 'RESOLVIDO').length

  return (
    <main className="min-h-screen bg-[#020817] text-white px-4 py-6 md:px-6 lg:px-8">
      <div className="w-full max-w-none mx-auto">
        <header className="flex flex-col xl:flex-row justify-between items-start gap-8 mb-10">
          <div>
            <div className="bg-white inline-block p-5 rounded-3xl shadow-lg mb-6">
              <Image
                src="/HC-CONSULTORIA-TRANSPARENTE.png"
                alt="HC Consultoria"
                width={260}
                height={140}
                priority
              />
            </div>

            <p className="text-blue-400 font-bold mb-2">Portal do cliente</p>

            <h1 className="text-5xl font-black mb-2">
              Olá, {usuario?.nome || 'cliente'}
            </h1>

            <p className="text-slate-400 text-lg mb-5">
              Acompanhe embarques, documentos, cotações, faturas e atualizações operacionais em tempo real.
            </p>

            <div className="flex gap-4 flex-wrap">
              <a href="/cliente/embarques" className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl font-bold">
                📦 Meus embarques
              </a>

              <a href="/cliente/cotacoes" className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl font-bold">
                Solicitar cotação
              </a>

              <a href="/cliente/minhas-cotacoes" className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold">
                Minhas cotações
              </a>

              <a href="/cliente/faturas" className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-bold">
                Faturas e recibos
              </a>

              <a href="/cliente/recebimentos" className="bg-yellow-500 hover:bg-yellow-400 px-5 py-3 rounded-xl font-bold text-black">
                💰 Recebimentos
              </a>

              <a href="/cliente/suporte" className="bg-purple-600 hover:bg-purple-500 px-5 py-3 rounded-xl font-bold">
                Suporte
              </a>

              <a href="/cliente/embarque-direto" className="bg-emerald-600 hover:bg-emerald-500 px-5 py-3 rounded-xl font-bold">
                🚚 Embarque direto
              </a>
            </div>
          </div>

          {usuario && (
            <div className="border border-blue-900 bg-[#071225] rounded-3xl px-6 py-5 min-w-[260px]">
              <p className="text-slate-400 text-sm">Logado como</p>
              <p className="font-black text-lg">{usuario.nome}</p>
              <p className="text-slate-400 text-sm mb-4">{usuario.email}</p>

              <button
                onClick={sair}
                className="bg-blue-600 hover:bg-blue-700 px-5 py-3 rounded-2xl font-bold w-full"
              >
                Sair
              </button>
            </div>
          )}
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-10 gap-5 mb-8">
          <Kpi
            titulo="Embarques"
            valor={embarques.length}
            detalhe="Ver todos"
            icone="📦"
            cor="blue"
            ativo={filtroRapido === 'TODOS'}
            onClick={() => setFiltroRapido('TODOS')}
          />
          <Kpi
            titulo="Aguardando coleta"
            valor={aguardandoColeta}
            detalhe="Filtrar etiqueta criada"
            icone="📄"
            cor="blue"
            ativo={filtroRapido === 'AGUARDANDO_COLETA'}
            onClick={() => setFiltroRapido('AGUARDANDO_COLETA')}
          />
          <Kpi
            titulo="Em trânsito"
            valor={emTransito}
            detalhe="Filtrar em andamento"
            icone="🚚"
            cor="green"
            ativo={filtroRapido === 'EM_TRANSITO'}
            onClick={() => setFiltroRapido('EM_TRANSITO')}
          />
          <Kpi
            titulo="Fiscalização"
            valor={fiscalizacao}
            detalhe="Filtrar fiscalização"
            icone="🛃"
            cor="yellow"
            ativo={filtroRapido === 'FISCALIZACAO'}
            onClick={() => setFiltroRapido('FISCALIZACAO')}
          />
          <Kpi
            titulo="Liberados"
            valor={liberados}
            detalhe="Filtrar liberados"
            icone="✅"
            cor="green"
            ativo={filtroRapido === 'LIBERADOS'}
            onClick={() => setFiltroRapido('LIBERADOS')}
          />
          <Kpi
            titulo="Entregues"
            valor={entregues}
            detalhe="Filtrar concluídos"
            icone="📬"
            cor="blue"
            ativo={filtroRapido === 'ENTREGUES'}
            onClick={() => setFiltroRapido('ENTREGUES')}
          />
          <Kpi
            titulo="Documentos"
            valor={documentosTotal}
            detalhe="Filtrar com documentos"
            icone="📎"
            cor="purple"
            ativo={filtroRapido === 'DOCUMENTOS'}
            onClick={() => setFiltroRapido('DOCUMENTOS')}
          />
          <Kpi
            titulo="Suporte"
            valor={suporteAtivos}
            detalhe={suporteRespondidos > 0 ? `${suporteRespondidos} respondido(s)` : 'Abrir chamados'}
            icone="🎧"
            cor="purple"
            onClick={() => {
              window.location.href = '/cliente/suporte'
            }}
          />
          <Kpi
            titulo="Recebimentos"
            valor={repassesDisponiveis}
            detalhe={totalRepassesAReceber > 0 ? `${moeda(totalRepassesAReceber)} a receber` : 'Ver repasses'}
            icone="💰"
            cor="yellow"
            onClick={() => {
              window.location.href = '/cliente/recebimentos'
            }}
          />
          <Kpi
            titulo="Peso total"
            valor={`${pesoTotal.toFixed(2)} kg`}
            detalhe="Movimentado"
            icone="⚖️"
            cor="green"
          />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <div className="card">
            <h2 className="text-2xl font-black mb-5">🚨 Alertas importantes</h2>

            <div className="space-y-4">
              <Alerta titulo="Aguardando coleta" valor={aguardandoColeta} icone="📄" cor="blue" />
              <Alerta titulo="Embarques em fiscalização" valor={fiscalizacao} icone="🛃" cor="yellow" />
              <Alerta titulo="Cotações disponíveis" valor={cotacoesDisponiveis} icone="📄" cor="green" />
              <Alerta titulo="Faturas disponíveis" valor={faturasDisponiveis} icone="🧾" cor="blue" />
              <Alerta titulo="Recebimentos liberados" valor={repassesDisponiveis} icone="💰" cor="yellow" />
              <Alerta titulo="Suporte ativo" valor={suporteAtivos} icone="🎧" cor="purple" />
              <Alerta titulo="Documentos disponíveis" valor={documentosTotal} icone="📎" cor="purple" />
            </div>
          </div>

          <div className="card">
            <h2 className="text-2xl font-black mb-5">📊 Resumo operacional</h2>

            <div className="grid grid-cols-2 gap-4">
              <Resumo titulo="Cotações" valor={cotacoes.length} />
              <Resumo titulo="Em análise" valor={cotacoesAnalise} />
              <Resumo titulo="Faturas liberadas" valor={faturasDisponiveis} />
              <Resumo titulo="Recibos liberados" valor={recibosDisponiveis} />
              <Resumo titulo="Repasses a receber" valor={moeda(totalRepassesAReceber)} />
              <Resumo titulo="Repasses pagos" valor={repassesPagos.length} />
              <Resumo titulo="Suporte aberto" valor={suporteAbertos + suporteAnalise} />
              <Resumo titulo="Suporte respondido" valor={suporteRespondidos} />
              <Resumo titulo="Embarques ativos" valor={embarques.length - entregues} />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <div className="card">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black">Últimos embarques</h2>
              <a href="/cliente/embarques" className="text-blue-400 font-bold">
                Ver todos
              </a>
            </div>

            {ultimosEmbarques.length === 0 ? (
              <p className="text-slate-400">Nenhum embarque encontrado.</p>
            ) : (
              <div className="space-y-4">
                {ultimosEmbarques.map((item) => (
                  <div key={item.id} className="border border-blue-900 bg-[#020817] rounded-2xl p-5">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div>
                        <a
                          href={`/cliente/embarques/${item.id}`}
                          className="text-2xl font-black text-blue-400 underline"
                        >
                          AWB {item.awb || '-'}
                        </a>

                        <p className="text-slate-400 mt-1">
                          {item.transportadora || '-'} • {item.origem || '-'} → {item.destino || '-'}
                        </p>

                        <p className="text-slate-500 text-sm mt-1">
                          Master: {item.master || 'Aguardando geração'}
                        </p>

                        <p className="text-slate-500 text-sm mt-2">
                          Atualizado: {dataBR(item.ultima_atualizacao)}
                        </p>
                      </div>

                      <div className="flex flex-col items-start md:items-end gap-2">
                        <StatusBadge status={item.status_operacional} />

                        <p className="text-slate-400 text-sm capitalize">
                          Resp.: {item.responsavel_nome || 'Equipe HC'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black">Minhas cotações</h2>
              <a href="/cliente/minhas-cotacoes" className="text-blue-400 font-bold">
                Ver todas
              </a>
            </div>

            {ultimasCotacoes.length === 0 ? (
              <p className="text-slate-400">Nenhuma cotação encontrada.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {ultimasCotacoes.map((cotacao) => (
                  <div key={cotacao.id} className="border border-blue-900 bg-[#020817] rounded-2xl p-5">
                    <div className="flex justify-between gap-3 mb-3">
                      <h3 className="font-black text-lg">
                        {cotacao.tipo_operacao || 'Cotação'}
                      </h3>

                      <span className={`px-3 py-1 rounded-xl text-xs font-black ${corCotacao(cotacao.status)}`}>
                        {cotacao.status || 'AGUARDANDO ANÁLISE'}
                      </span>
                    </div>

                    <p className="text-slate-400 text-sm">
                      Rota: {cotacao.origem || '-'} → {cotacao.destino || '-'}
                    </p>

                    <p className="text-slate-500 text-xs mt-3">
                      Criada em: {dataBR(cotacao.criado_em)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section id="meus-embarques" className="card mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-black">Resultados filtrados</h2>

            <p className="text-slate-400 mt-1 mb-4">
              Selecione um card acima ou use a busca para carregar somente os embarques filtrados.
            </p>

            <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border border-blue-900 bg-[#020817] rounded-2xl p-4">
              <div>
                <p className="text-slate-500 text-sm">Filtro ativo</p>
                <p className="font-black text-blue-400">{nomeFiltroRapido()}</p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-slate-400 text-sm">
                  {temFiltroAtivo ? `${filtrados.length} de ${embarques.length} embarque(s)` : `${embarques.length} embarque(s) disponíveis`}
                </span>

                {temFiltroAtivo && (
                  <button
                    onClick={() => {
                      setFiltroRapido('NENHUM')
                      setBusca('')
                    }}
                    className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl font-bold text-sm"
                  >
                    Limpar filtro
                  </button>
                )}
              </div>
            </div>

            <input
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white"
              placeholder="🔍 Buscar por AWB, destino, origem, transportadora, responsável ou status..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </section>

        <section className="grid gap-6">
          {!temFiltroAtivo ? (
            <div className="card text-center">
              <p className="text-slate-300 font-black text-lg">Selecione um filtro para visualizar os embarques.</p>
              <p className="text-slate-500 mt-2">A página inicial não lista mais todos os processos automaticamente para ficar mais leve e objetiva.</p>
            </div>
          ) : filtrados.length === 0 ? (
            <div className="card text-center">
              <p className="text-slate-400">Nenhum embarque encontrado para o filtro selecionado.</p>
            </div>
          ) : (
            filtrados.map((item) => {
              const documentos = documentosPorEmbarque[item.id] || []
              const link = linkRastreio(item)
              const percentual = progresso(item.status_operacional)

              return (
                <div key={item.id} className="card hover:border-blue-500 transition">
                  <div className="flex flex-col xl:flex-row justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap mb-4">
                        <h2 className="text-3xl font-black text-blue-400">
                          AWB {item.awb || '-'}
                        </h2>

                        <StatusBadge status={item.status_operacional} />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
                        <Info titulo="Transportadora" valor={item.transportadora} />
                        <Info titulo="Master" valor={item.master || 'Aguardando geração'} />
                        <Info titulo="Serviço" valor={item.servico} />
                        <Info titulo="Origem" valor={item.origem} />
                        <Info titulo="Destino" valor={item.destino} />
                        <Info titulo="Peso real" valor={item.peso_real ? `${item.peso_real} kg` : '-'} />
                        <Info titulo="Peso taxado" valor={item.peso_taxado ? `${item.peso_taxado} kg` : '-'} />
                        <Info titulo="Previsão" valor={item.data_prevista ? new Date(item.data_prevista).toLocaleDateString('pt-BR') : '-'} />
                        <Info titulo="Atualizado" valor={dataBR(item.ultima_atualizacao)} />
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

                      <Timeline status={item.status_operacional} />

                      <div className="flex gap-3 flex-wrap mt-5">
                        <a href={`/cliente/embarques/${item.id}`} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl font-bold">
                          Ver detalhes
                        </a>

                        {link && (
                          <a href={link} target="_blank" rel="noopener noreferrer" className="bg-yellow-500 hover:bg-yellow-400 px-4 py-2 rounded-xl text-black font-bold">
                            Rastrear
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="xl:w-[360px] space-y-5">
                      <div className="border border-blue-900 bg-[#020817] rounded-2xl p-5">
                        <h3 className="font-black mb-2">Responsável HC</h3>
                        <p className="text-2xl font-black capitalize">
                          {item.responsavel_nome || 'Equipe HC'}
                        </p>
                        <p className="text-slate-400 text-sm mb-4">
                          {item.responsavel_email || 'marcos@hcbhz.com'}
                        </p>

                        <div className="flex gap-2 flex-wrap">
                          <a
                            href={`mailto:${item.responsavel_email || 'marcos@hcbhz.com'}`}
                            className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-xl font-bold text-sm"
                          >
                            E-mail
                          </a>

                          <a
                            href={`https://wa.me/${whatsResponsavel(item.responsavel_email)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-green-600 hover:bg-green-500 px-3 py-2 rounded-xl font-bold text-sm"
                          >
                            WhatsApp
                          </a>

                          <a href="/cliente/suporte" className="bg-purple-600 hover:bg-purple-500 px-3 py-2 rounded-xl font-bold text-sm">
                            Suporte
                          </a>
                        </div>
                      </div>

                      <div className="border border-blue-900 bg-[#020817] rounded-2xl p-5">
                        <h3 className="font-black mb-3">Documentos</h3>

                        {documentos.length === 0 ? (
                          <p className="text-slate-500 text-sm">
                            Nenhum documento disponível.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {documentos.slice(0, 3).map((doc: any) => (
                              <a
                                key={doc.id}
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block border border-blue-900 rounded-xl p-3 hover:border-green-500 transition"
                              >
                                <p className="font-bold text-sm break-all">📎 {doc.nome}</p>
                                <p className="text-slate-500 text-xs mt-1">
                                  {dataBR(doc.criado_em)}
                                </p>
                              </a>
                            ))}

                            {documentos.length > 3 && (
                              <p className="text-slate-400 text-sm">
                                + {documentos.length - 3} documento(s) no detalhe
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </section>
      </div>
    </main>
  )
}

function Kpi({ titulo, valor, detalhe, icone, cor, ativo = false, onClick }: any) {
  const corNumero =
    cor === 'green'
      ? 'text-emerald-400'
      : cor === 'yellow'
      ? 'text-yellow-400'
      : cor === 'purple'
      ? 'text-purple-400'
      : 'text-blue-400'

  const conteudo = (
    <div className="flex justify-between items-start gap-4">
      <div>
        <p className={ativo ? 'text-white text-sm font-black' : 'text-slate-400 text-sm'}>
          {titulo}
        </p>
        <h2 className={`text-4xl font-black mt-4 ${ativo ? 'text-white' : corNumero}`}>
          {valor}
        </h2>
        <p className={ativo ? 'text-blue-100 text-sm mt-2' : 'text-slate-500 text-sm mt-2'}>
          {detalhe}
        </p>
      </div>

      <span className="text-3xl">{icone}</span>
    </div>
  )

  if (!onClick) {
    return <div className="card">{conteudo}</div>
  }

  return (
    <button
      type="button"
      onClick={() => {
        onClick()
        setTimeout(() => {
          document.getElementById('meus-embarques')?.scrollIntoView({ behavior: 'smooth' })
        }, 50)
      }}
      className={
        ativo
          ? 'card w-full text-left border-blue-400 bg-blue-600/30 cursor-pointer ring-2 ring-blue-500'
          : 'card w-full text-left cursor-pointer hover:border-blue-400 hover:bg-blue-600/10 transition'
      }
    >
      {conteudo}
    </button>
  )
}

function Alerta({ titulo, valor, icone, cor }: any) {
  const classe =
    cor === 'green'
      ? 'bg-green-600'
      : cor === 'yellow'
      ? 'bg-yellow-500 text-black'
      : cor === 'purple'
      ? 'bg-purple-600'
      : 'bg-blue-600'

  return (
    <div className="flex justify-between items-center border-b border-blue-950 pb-4">
      <div className="flex items-center gap-3">
        <span>{icone}</span>
        <p className="text-slate-300">{titulo}</p>
      </div>

      <span className={`px-4 py-2 rounded-full font-black ${classe}`}>
        {valor}
      </span>
    </div>
  )
}

function Resumo({ titulo, valor }: any) {
  return (
    <div className="border border-blue-900 bg-[#020817] rounded-2xl p-5">
      <p className="text-slate-400">{titulo}</p>
      <h3 className="text-3xl font-black mt-2 text-blue-400">{valor}</h3>
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

function Timeline({ status }: any) {
  const s = String(status || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const passos = [
    {
      nome: 'Aguardando coleta',
      ativo:
        s.includes('aguardando coleta') ||
        s.includes('etiqueta gerada') ||
        s.includes('coletado') ||
        s.includes('em transito') ||
        s.includes('fiscalizacao') ||
        s.includes('liberado') ||
        s.includes('entregue'),
    },
    {
      nome: 'Coletado',
      ativo:
        s.includes('coletado') ||
        s.includes('em transito') ||
        s.includes('fiscalizacao') ||
        s.includes('liberado') ||
        s.includes('entregue'),
    },
    {
      nome: 'Em trânsito',
      ativo:
        s.includes('em transito') ||
        s.includes('fiscalizacao') ||
        s.includes('liberado') ||
        s.includes('entregue'),
    },
    {
      nome: 'Fiscalização',
      ativo:
        s.includes('fiscalizacao') ||
        s.includes('liberado') ||
        s.includes('entregue'),
    },
    {
      nome: 'Liberado',
      ativo: s.includes('liberado') || s.includes('entregue'),
    },
    {
      nome: 'Entregue',
      ativo: s.includes('entregue'),
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      {passos.map((p) => (
        <div
          key={p.nome}
          className={`rounded-2xl p-4 text-center border ${
            p.ativo
              ? 'bg-green-600 border-green-500 text-white'
              : 'bg-[#020817] border-blue-900 text-slate-400'
          }`}
        >
          <div className="text-2xl mb-1">{p.ativo ? '✅' : '⏳'}</div>
          <p className="font-black text-sm">{p.nome}</p>
        </div>
      ))}
    </div>
  )
}
