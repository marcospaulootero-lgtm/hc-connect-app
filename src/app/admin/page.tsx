'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function DashboardPage() {
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [embarques, setEmbarques] = useState<any[]>([])
  const [cotacoes, setCotacoes] = useState<any[]>([])
  const [suporte, setSuporte] = useState<any[]>([])
  const [ultimoRastreio, setUltimoRastreio] = useState<any>(null)
  const [modalErrosRastreio, setModalErrosRastreio] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [agora, setAgora] = useState(new Date())
  const [periodoGrafico, setPeriodoGrafico] = useState<'7D' | '30D' | 'MES_ATUAL' | 'MES_ANTERIOR'>('7D')
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null)

  useEffect(() => {
  const timer = setInterval(() => {
    setAgora(new Date())
  }, 1000)

  return () => clearInterval(timer)
}, [])

useEffect(() => {
  buscarDados()

  const intervaloDashboard = setInterval(() => {
    buscarDados()
  }, 60000)

  return () => clearInterval(intervaloDashboard)
}, [])

useEffect(() => {
  setDiaSelecionado(null)
}, [periodoGrafico])

  async function atualizarTodosRastreios() {
    try {
      const { data: embarquesAtivos } = await supabase
        .from('embarques')
        .select('id,status_operacional')
        .neq('status_operacional', 'Entregue')

      if (!embarquesAtivos?.length) return

      for (const embarque of embarquesAtivos) {
        try {
          await fetch('/api/rastreio', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              embarque_id: embarque.id,
            }),
          })
        } catch (err) {
          console.error('Erro atualizando embarque:', embarque.id, err)
        }
      }
    } catch (err) {
      console.error('Erro geral atualização:', err)
    }
  }

  async function atualizarDadosManual() {
    setCarregando(true)

    try {
      await atualizarTodosRastreios()
      await buscarDados()
    } catch (error) {
      console.error(error)
    }

    setCarregando(false)
  }

  async function buscarDados() {
    setCarregando(true)

    const [perfisRes, embarquesRes, cotacoesRes, suporteRes, logRastreioRes] =
      await Promise.all([
        supabase.from('perfis').select('*').order('nome'),
        supabase
          .from('embarques')
          .select('*')
          .order('criado_em', { ascending: false }),
        supabase
          .from('cotacoes')
          .select('*')
          .order('criado_em', { ascending: false }),
        supabase
          .from('suporte')
          .select('*')
          .order('criado_em', { ascending: false }),
        supabase
  .from('logs_rastreio')
  .select('id, criado_em, total_processado, total_sucesso, total_erro, detalhes')
  .order('criado_em', { ascending: false })
  .limit(1)
  .maybeSingle(),
      ])

    setUsuarios(perfisRes.data || [])
    setEmbarques(embarquesRes.data || [])
    setCotacoes(cotacoesRes.data || [])
    setSuporte(suporteRes.data || [])
    setUltimoRastreio(logRastreioRes.data || null)

    setCarregando(false)
  }

  function dataBR(data?: string | null) {
    if (!data) return '-'
    return new Date(data).toLocaleDateString('pt-BR')
  }

  function dataHoraBR(data?: string | null) {
  if (!data) return '-'

  return new Date(data).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  })
}

  function proximaAtualizacao(data?: string | null) {
  if (!data) return '-'

  const proxima = new Date(data)
  proxima.setHours(proxima.getHours() + 1)

  return proxima.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  })
}

  function dataBaseEmbarque(item: any) {
    return item.data_coleta || item.data_envio || item.criado_em || item.ultima_atualizacao || null
  }

  function inicioDoDia(data: Date) {
    const d = new Date(data)
    d.setHours(0, 0, 0, 0)
    return d
  }

  function fimDoDia(data: Date) {
    const d = new Date(data)
    d.setHours(23, 59, 59, 999)
    return d
  }

  function chaveDia(data: Date) {
    const ano = data.getFullYear()
    const mes = String(data.getMonth() + 1).padStart(2, '0')
    const dia = String(data.getDate()).padStart(2, '0')
    return `${ano}-${mes}-${dia}`
  }

  function diaSemanaCurto(data: Date) {
    const dias = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
    return dias[data.getDay()] || '-'
  }

  function formatarDataGrafico(data: Date) {
    return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  function clienteDoEmbarque(item: any) {
    return (
      item.importador ||
      item.exportador ||
      item.cliente_final ||
      item.cliente_nome ||
      item.empresa_nome ||
      'Não informado'
    )
  }

  function faixaPeriodoGrafico() {
    const hojeBase = inicioDoDia(new Date())

    if (periodoGrafico === '30D') {
      const inicio = new Date(hojeBase)
      inicio.setDate(inicio.getDate() - 29)
      return { inicio, fim: fimDoDia(hojeBase), label: 'Últimos 30 dias' }
    }

    if (periodoGrafico === 'MES_ATUAL') {
      const inicio = new Date(hojeBase.getFullYear(), hojeBase.getMonth(), 1)
      return { inicio, fim: fimDoDia(hojeBase), label: 'Mês atual' }
    }

    if (periodoGrafico === 'MES_ANTERIOR') {
      const inicio = new Date(hojeBase.getFullYear(), hojeBase.getMonth() - 1, 1)
      const fim = new Date(hojeBase.getFullYear(), hojeBase.getMonth(), 0)
      return { inicio, fim: fimDoDia(fim), label: 'Mês anterior' }
    }

    const inicio = new Date(hojeBase)
    inicio.setDate(inicio.getDate() - 6)
    return { inicio, fim: fimDoDia(hojeBase), label: 'Últimos 7 dias' }
  }

  const errosRastreio = Array.isArray(ultimoRastreio?.detalhes)
    ? ultimoRastreio.detalhes
    : []

  const hoje = new Date()
  const mesAtual = hoje.getMonth()
  const anoAtual = hoje.getFullYear()

  const embarquesMes = embarques.filter((e) => {
    const dataBase = e.data_coleta || e.criado_em
    if (!dataBase) return false

    const data = new Date(dataBase)
    return data.getMonth() === mesAtual && data.getFullYear() === anoAtual
  })

  const ativos = embarques.filter((e) => e.status_operacional !== 'Entregue').length
  const transito = embarques.filter((e) => e.status_operacional === 'Em trânsito').length
  const fiscalizacao = embarques.filter((e) => e.status_operacional === 'Fiscalização').length
  const liberados = embarques.filter((e) => e.status_operacional === 'Liberado').length
  const entregues = embarques.filter((e) => e.status_operacional === 'Entregue').length

  const suporteAbertos = suporte.filter((s) => s.status === 'ABERTO').length
  const suporteAnalise = suporte.filter((s) => s.status === 'EM ANÁLISE').length
  const suporteRespondidos = suporte.filter((s) => s.status === 'RESPONDIDO').length
  const suporteResolvidos = suporte.filter((s) => s.status === 'RESOLVIDO').length
  const ultimoChamado = suporte[0]

  const cotacoesPendentes = cotacoes.filter(
    (c) =>
      c.status === 'AGUARDANDO ANÁLISE' ||
      c.status === 'EM ANÁLISE' ||
      c.status === 'AGUARDANDO TRANSPORTADORA'
  ).length

  const clientesAtivos = usuarios.filter((u) => u.ativo !== false).length

  const pesoTotal = embarques.reduce(
    (acc, item) => acc + Number(item.peso_taxado || item.peso_real || 0),
    0
  )

  const ultimosEmbarques = embarques.slice(0, 6)
  const ultimasCotacoes = cotacoes.slice(0, 5)

  const embarquesPorTransportadora = useMemo(() => {
    const mapa: any = {}

    embarques.forEach((e) => {
      const nome = e.transportadora || 'Não informado'
      mapa[nome] = (mapa[nome] || 0) + 1
    })

    return Object.entries(mapa)
      .map(([nome, total]) => ({ nome, total: Number(total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [embarques])

  const transportadorasAtivas = embarquesPorTransportadora.length

  const rankingClientes = useMemo(() => {
    const mapa: any = {}

    embarques.forEach((e) => {
      const cliente =
        e.importador ||
        e.exportador ||
        e.cliente_nome ||
        e.empresa_nome ||
        'Não informado'

      if (!mapa[cliente]) {
        mapa[cliente] = { nome: cliente, total: 0, peso: 0 }
      }

      mapa[cliente].total += 1
      mapa[cliente].peso += Number(e.peso_taxado || e.peso_real || 0)
    })

    return Object.values(mapa)
      .sort((a: any, b: any) => b.total - a.total)
      .slice(0, 5)
  }, [embarques])

  const atividadesRecentes = useMemo(() => {
    const atividades: any[] = []

    embarques.slice(0, 8).forEach((e) => {
      atividades.push({
        titulo: `Embarque ${e.awb || '-'} atualizado`,
        detalhe: `${e.transportadora || '-'} • ${e.status_operacional || '-'}`,
        data: e.ultima_atualizacao || e.criado_em,
        icone: '📦',
      })
    })

    cotacoes.slice(0, 5).forEach((c) => {
      atividades.push({
        titulo: 'Cotação recebida',
        detalhe: c.cliente_final || c.solicitante_email || 'Sem identificação',
        data: c.criado_em,
        icone: '📄',
      })
    })

    suporte.slice(0, 5).forEach((s) => {
      atividades.push({
        titulo: s.assunto || 'Chamado de suporte',
        detalhe: s.email || s.status || 'Cliente não informado',
        data: s.criado_em,
        icone: '🎧',
      })
    })

    return atividades
      .filter((a) => a.data)
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
      .slice(0, 8)
  }, [embarques, cotacoes, suporte])

  const embarquesPorTipo = useMemo(() => {
    const exportacao = embarques.filter((e) =>
      String(e.servico || '').toLowerCase().includes('export')
    ).length

    const importacao = embarques.filter((e) =>
      String(e.servico || '').toLowerCase().includes('import')
    ).length

    const outros = Math.max(embarques.length - exportacao - importacao, 0)

    return { exportacao, importacao, outros }
  }, [embarques])

  const ritmoOperacao = useMemo(() => {
    const { inicio, fim, label } = faixaPeriodoGrafico()
    const dias: any[] = []
    const mapaDias: Record<string, any> = {}

    const cursor = new Date(inicio)
    while (cursor <= fim) {
      const data = new Date(cursor)
      const key = chaveDia(data)

      const linha = {
        key,
        data,
        diaSemana: diaSemanaCurto(data),
        diaLabel: formatarDataGrafico(data),
        total: 0,
        peso: 0,
        clientes: new Set<string>(),
        embarques: [] as any[],
      }

      mapaDias[key] = linha
      dias.push(linha)
      cursor.setDate(cursor.getDate() + 1)
    }

    embarques.forEach((embarque) => {
      const base = dataBaseEmbarque(embarque)
      if (!base) return

      const data = new Date(base)
      if (isNaN(data.getTime())) return

      const dataDia = inicioDoDia(data)
      if (dataDia < inicio || dataDia > fim) return

      const key = chaveDia(dataDia)
      const linha = mapaDias[key]
      if (!linha) return

      const cliente = clienteDoEmbarque(embarque)
      linha.total += 1
      linha.peso += Number(embarque.peso_taxado || embarque.peso_real || 0)
      linha.clientes.add(cliente)
      linha.embarques.push(embarque)
    })

    const totalPeriodo = dias.reduce((acc, item) => acc + item.total, 0)
    const pesoPeriodo = dias.reduce((acc, item) => acc + item.peso, 0)
    const mediaDiaria = dias.length > 0 ? totalPeriodo / dias.length : 0
    const diasSemEmbarque = dias.filter((item) => item.total === 0).length
    const maiorDia = Math.max(...dias.map((item) => item.total), 1)
    const yMax = Math.max(5, Math.ceil(maiorDia / 5) * 5)
    const yTicks = Array.from({ length: Math.floor(yMax / 5) + 1 }, (_, index) => yMax - index * 5)
    const melhorDia = [...dias].sort((a, b) => b.total - a.total)[0] || null

    const mapaClientes: Record<string, { nome: string; total: number; peso: number }> = {}

    dias.forEach((dia) => {
      dia.embarques.forEach((embarque: any) => {
        const nome = clienteDoEmbarque(embarque)
        if (!mapaClientes[nome]) mapaClientes[nome] = { nome, total: 0, peso: 0 }
        mapaClientes[nome].total += 1
        mapaClientes[nome].peso += Number(embarque.peso_taxado || embarque.peso_real || 0)
      })
    })

    const clientesOrdenados = Object.values(mapaClientes).sort((a, b) => b.total - a.total)
    const clienteMaisAtivo = clientesOrdenados[0] || null
    const clientesPeriodo = clientesOrdenados.length
    const concentracaoTopCliente = totalPeriodo > 0 && clienteMaisAtivo
      ? (clienteMaisAtivo.total / totalPeriodo) * 100
      : 0

    const melhorDiaTexto = melhorDia && melhorDia.total > 0
      ? `${melhorDia.diaLabel} (${melhorDia.diaSemana})`
      : '-'

    const analise =
      totalPeriodo === 0
        ? 'Nenhum embarque no período. Ação: revisar clientes parados, cotações abertas e prospecção.'
        : clientesPeriodo <= 3
          ? 'Operação concentrada em poucos clientes. Ação: recuperar clientes parados e aumentar recorrência.'
          : concentracaoTopCliente >= 40
            ? `Atenção: ${clienteMaisAtivo?.nome} concentra ${concentracaoTopCliente.toFixed(0)}% dos embarques. Monitore dependência comercial.`
            : diasSemEmbarque > dias.length * 0.45
              ? 'Operação irregular: muitos dias sem embarque. Ação: aumentar recorrência dos clientes ativos.'
              : `Volume dentro da média esperada. Pico em ${melhorDiaTexto}. Monitore capacidade para manter SLA.`

    return {
      label,
      dias,
      totalPeriodo,
      pesoPeriodo,
      mediaDiaria,
      diasSemEmbarque,
      maiorDia,
      yMax,
      yTicks,
      melhorDia,
      melhorDiaTexto,
      clientesPeriodo,
      clienteMaisAtivo,
      concentracaoTopCliente,
      analise,
    }
  }, [embarques, periodoGrafico])

  return (
    <main className="min-h-screen bg-[#020817] text-white">
      <section className="p-6 xl:p-10 overflow-auto">
        <header className="flex flex-col xl:flex-row justify-between gap-6 mb-8">
          <div>
            <p className="text-blue-400 font-bold mb-2">Visão geral operacional</p>
            <p className="text-slate-400 text-sm mb-2">
  🕒 {agora.toLocaleString('pt-BR')}
</p>
            <h1 className="text-5xl font-black">Dashboard Executivo</h1>
            <p className="text-slate-400 mt-3 text-lg">
              Acompanhe em tempo real toda a operação logística da HC Connect.
            </p>
          </div>

          <div className="flex gap-4 flex-wrap h-fit">
            <button
              onClick={atualizarDadosManual}
              className="bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold"
            >
              {carregando ? 'Atualizando...' : '↻ Atualizar dados'}
            </button>

            <a href="/admin/embarques" className="bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold">
              + Novo embarque
            </a>

            <a href="/admin/cotacoes" className="bg-slate-700 hover:bg-slate-600 px-6 py-4 rounded-2xl font-bold">
              Ver cotações
            </a>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-8 gap-5 mb-8">
          <KpiCard titulo="Embarques no mês" valor={embarquesMes.length} detalhe="Total no período" icone="📦" cor="blue" href="/admin/embarques" />
          <KpiCard titulo="Em trânsito" valor={transito} detalhe="Em andamento" icone="🚚" cor="green" href="/admin/embarques?status=Em%20tr%C3%A2nsito" />
          <KpiCard titulo="Em fiscalização" valor={fiscalizacao} detalhe="Aguardando liberação" icone="🛃" cor="yellow" href="/admin/embarques?status=Fiscaliza%C3%A7%C3%A3o" />
          <KpiCard titulo="Liberados" valor={liberados} detalhe="Prontos para seguir" icone="✅" cor="green" href="/admin/embarques?status=Liberado" />
          <KpiCard titulo="Entregues" valor={entregues} detalhe="Concluídos" icone="📬" cor="blue" href="/admin/embarques?status=Entregue" />
          <KpiCard titulo="Clientes ativos" valor={clientesAtivos} detalhe="Base ativa" icone="👥" cor="blue" href="/admin/usuarios" />
          <KpiCard titulo="Peso movimentado" valor={`${pesoTotal.toFixed(2)} kg`} detalhe="Total apurado" icone="⚖️" cor="green" href="/admin/embarques" />
          <KpiCard titulo="Transportadoras" valor={transportadorasAtivas} detalhe="Em operação" icone="✈️" cor="blue" href="/admin/embarques" />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">🎧</span>
              <h2 className="text-2xl font-black">Central de Suporte</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-2 gap-3 mb-6">
              <MiniStatus titulo="Abertos" valor={suporteAbertos} cor="red" href="/admin/suporte?status=ABERTO" />
              <MiniStatus titulo="Em análise" valor={suporteAnalise} cor="yellow" href="/admin/suporte?status=EM%20AN%C3%81LISE" />
              <MiniStatus titulo="Respondidos" valor={suporteRespondidos} cor="purple" href="/admin/suporte?status=RESPONDIDO" />
              <MiniStatus titulo="Resolvidos" valor={suporteResolvidos} cor="green" href="/admin/suporte?status=RESOLVIDO" />
            </div>

            <div className="border border-blue-900 rounded-2xl bg-[#020817] p-5">
              <div className="flex justify-between mb-3">
                <p className="font-black">Último chamado recebido</p>
                <a href="/admin/suporte" className="text-blue-400 font-bold text-sm">
                  Ver todos
                </a>
              </div>

              {ultimoChamado ? (
                <>
                  <p className="text-blue-400 font-bold">
                    {ultimoChamado.assunto || 'Chamado sem assunto'}
                  </p>
                  <p className="text-slate-400 text-sm mt-2">
                    {ultimoChamado.email || 'Cliente não informado'}
                  </p>
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-slate-500 text-sm">
                      {dataBR(ultimoChamado.criado_em)}
                    </span>
                    <StatusPillDashboard status={ultimoChamado.status || 'ABERTO'} />
                  </div>
                </>
              ) : (
                <p className="text-slate-500">Nenhum chamado recebido.</p>
              )}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">📦</span>
              <h2 className="text-2xl font-black">Operação HC</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <OperationCard titulo="Embarques ativos" valor={String(ativos)} cor="blue" href="/admin/embarques?arquivamento=ATIVOS" />
              <OperationCard titulo="Em trânsito" valor={String(transito)} cor="green" href="/admin/embarques?status=Em%20tr%C3%A2nsito" />
              <OperationCard titulo="Fiscalização" valor={String(fiscalizacao)} cor="yellow" href="/admin/embarques?status=Fiscaliza%C3%A7%C3%A3o" />
              <OperationCard titulo="Entregues" valor={String(entregues)} cor="blue" href="/admin/embarques?status=Entregue" />
            </div>

            <a href="/admin/embarques" className="block text-blue-400 font-bold mt-6 text-right">
              Ver operação completa →
            </a>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">📡</span>
              <h2 className="text-2xl font-black">Rastreio Automático</h2>
            </div>

            <div className="border border-blue-900 rounded-2xl bg-[#020817] p-5 mb-4">
              <p className="text-slate-500 text-sm">Última execução</p>
              <h3 className="text-lg font-black text-blue-400 mt-1">
                {dataHoraBR(ultimoRastreio?.criado_em)}
              </h3>
            </div>

            <div className="border border-blue-900 rounded-2xl bg-[#020817] p-5 mb-4">
              <p className="text-slate-500 text-sm">Próxima execução estimada</p>
              <h3 className="text-lg font-black text-green-400 mt-1">
                {proximaAtualizacao(ultimoRastreio?.criado_em)}
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <AutoBox titulo="Processados" valor={ultimoRastreio?.total_processado || 0} cor="blue" href="/admin/intelligence" />
              <AutoBox titulo="Sucessos" valor={ultimoRastreio?.total_sucesso || 0} cor="green" href="/admin/intelligence?tipo=sucesso" />
              <AutoBox titulo="Erros" valor={ultimoRastreio?.total_erro || 0} cor="red" href="/admin/intelligence?tipo=erro" />
            </div>

            {Number(ultimoRastreio?.total_erro || 0) > 0 && (
              <button
                onClick={() => setModalErrosRastreio(true)}
                className="w-full mt-4 bg-red-600/20 hover:bg-red-600/30 border border-red-500 text-red-300 px-4 py-3 rounded-2xl font-black text-sm"
              >
                🔍 Ver erros ({ultimoRastreio?.total_erro || 0})
              </button>
            )}

            <p className="text-slate-500 text-xs mt-4">
              Atualização automática configurada para rodar a cada 30 minutos.
            </p>
          </div>

          <div className="card">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🚨</span>
                <h2 className="text-2xl font-black">Alertas Importantes</h2>
              </div>
              <span className="text-blue-400 font-bold text-sm">Hoje</span>
            </div>

            <div className="space-y-4">
              <AlertaPremium titulo="Embarques em fiscalização" valor={fiscalizacao} icone="⚠️" cor="yellow" href="/admin/embarques?status=Fiscaliza%C3%A7%C3%A3o" />
              <AlertaPremium titulo="Chamados aguardando resposta" valor={suporteAbertos} icone="💬" cor="purple" href="/admin/suporte?status=ABERTO" />
              <AlertaPremium titulo="Cotações pendentes" valor={cotacoesPendentes} icone="📄" cor="blue" href="/admin/cotacoes?status=PENDENTES" />
              <AlertaPremium titulo="Embarques ativos" valor={ativos} icone="📦" cor="green" href="/admin/embarques?arquivamento=ATIVOS" />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <div className="card overflow-hidden bg-gradient-to-br from-[#071225] via-[#061126] to-[#020817] shadow-[0_0_28px_rgba(37,99,235,0.10)]">
            <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3 mb-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 text-blue-500">
                  <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                    <rect x="4" y="17" width="4" height="10" rx="1" fill="currentColor" />
                    <rect x="11" y="10" width="4" height="17" rx="1" fill="currentColor" />
                    <rect x="18" y="5" width="4" height="22" rx="1" fill="currentColor" />
                    <rect x="25" y="14" width="4" height="13" rx="1" fill="currentColor" />
                  </svg>
                </div>

                <div>
                  <h2 className="text-2xl font-black tracking-tight">Ritmo da operação</h2>
                  <p className="text-slate-400 text-sm mt-1">
                    Volume por dia, concentração de clientes e pontos de ação.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <PeriodoButton ativo={periodoGrafico === '7D'} onClick={() => setPeriodoGrafico('7D')}>7 dias</PeriodoButton>
                <PeriodoButton ativo={periodoGrafico === '30D'} onClick={() => setPeriodoGrafico('30D')}>30 dias</PeriodoButton>
                <PeriodoButton ativo={periodoGrafico === 'MES_ATUAL'} onClick={() => setPeriodoGrafico('MES_ATUAL')}>Mês atual</PeriodoButton>
                <PeriodoButton ativo={periodoGrafico === 'MES_ANTERIOR'} onClick={() => setPeriodoGrafico('MES_ANTERIOR')}>Mês anterior</PeriodoButton>
              </div>
            </div>

            <div className="rounded-2xl border border-blue-950/70 bg-[#030b1d]/70 p-3 overflow-hidden">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-blue-200">Embarques</p>
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">{ritmoOperacao.label}</p>
              </div>

              <div className="relative h-[210px] overflow-hidden">
                <div className="absolute left-0 top-0 bottom-9 w-8 flex flex-col justify-between text-xs font-bold text-blue-200/70">
                  {ritmoOperacao.yTicks.map((tick) => (
                    <span key={tick}>{tick}</span>
                  ))}
                </div>

                <div className="absolute left-9 right-0 top-0 bottom-9 border-l border-b border-blue-900/80">
                  {ritmoOperacao.yTicks.map((tick) => (
                    <div
                      key={tick}
                      className="absolute left-0 right-0 border-t border-dashed border-blue-700/35"
                      style={{ top: `${((ritmoOperacao.yMax - tick) / ritmoOperacao.yMax) * 100}%` }}
                    />
                  ))}

                  <div
                    className="absolute inset-x-0 bottom-0 top-0 grid items-end gap-2 px-3"
                    style={{ gridTemplateColumns: `repeat(${Math.max(ritmoOperacao.dias.length, 1)}, minmax(0, 1fr))` }}
                  >
                    {ritmoOperacao.dias.map((item) => {
                      const altura = `${Math.max((item.total / ritmoOperacao.yMax) * 145, item.total > 0 ? 7 : 3)}px`
                      const ativo = diaSelecionado === item.key

                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setDiaSelecionado(ativo ? null : item.key)}
                          className="group relative flex h-full min-w-0 flex-col items-center justify-end"
                          title={`${item.diaSemana} ${item.diaLabel}: ${item.total} embarque(s) • ${item.peso.toFixed(2)} kg`}
                        >
                          <span className="mb-1 text-sm font-black text-white drop-shadow opacity-100">
                            {item.total}
                          </span>

                          <span
                            className={
                              ativo
                                ? 'w-full max-w-[44px] rounded-t-md bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.40)] ring-2 ring-emerald-300 transition'
                                : item.total > 0
                                  ? 'w-full max-w-[44px] rounded-t-md bg-gradient-to-t from-blue-700 to-blue-400 shadow-[0_0_18px_rgba(37,99,235,0.30)] transition hover:from-blue-600 hover:to-blue-300'
                                  : 'w-full max-w-[44px] rounded-t-md bg-blue-950/80 transition hover:bg-blue-900'
                            }
                            style={{ height: altura }}
                          />

                          <span className="pointer-events-none absolute -top-10 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-xl border border-blue-800 bg-[#071225] px-3 py-2 text-xs font-black text-blue-100 shadow-2xl group-hover:block">
                            {item.diaSemana} {item.diaLabel} • {item.total} embarque(s)
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div
                  className="absolute left-9 right-0 bottom-0 grid gap-2 px-3 text-center"
                  style={{ gridTemplateColumns: `repeat(${Math.max(ritmoOperacao.dias.length, 1)}, minmax(0, 1fr))` }}
                >
                  {ritmoOperacao.dias.map((item) => (
                    <div key={item.key} className="min-w-0">
                      <p className="text-[10px] font-black text-blue-100/80 truncate">{item.diaSemana}</p>
                      <p className="text-[10px] font-bold text-blue-200/60 truncate">{item.diaLabel}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-y border-blue-950 py-3">
              <MetricDashboard icone="🚚" valor={String(ritmoOperacao.totalPeriodo)} titulo="Total período" detalhe="Embarques" />
              <MetricDashboard icone="📈" valor={ritmoOperacao.mediaDiaria.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} titulo="Média diária" detalhe="Embarques/dia" />
              <MetricDashboard icone="🗓️" valor={String(ritmoOperacao.diasSemEmbarque)} titulo="Dias sem embarque" detalhe="No período" />
              <MetricDashboard icone="⚖️" valor={`${ritmoOperacao.pesoPeriodo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`} titulo="Peso período" detalhe="Total embarcado" />
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
              <InsightDashboard icone="🏅" titulo="Melhor dia" valor={ritmoOperacao.melhorDiaTexto} detalhe={`${ritmoOperacao.melhorDia?.total || 0} embarque(s)`} />
              <InsightDashboard icone="👤" titulo="Cliente mais ativo" valor={ritmoOperacao.clienteMaisAtivo?.nome || '-'} detalhe={ritmoOperacao.clienteMaisAtivo ? `${ritmoOperacao.clienteMaisAtivo.total} embarque(s)` : 'Sem cliente no período'} />
              <InsightDashboard icone="🎯" titulo="Concentração" valor={`${ritmoOperacao.concentracaoTopCliente.toFixed(0)}%`} detalhe={`${ritmoOperacao.clientesPeriodo} cliente(s) no período`} />
            </div>

            <div className="mt-4 rounded-2xl border border-blue-900 bg-[#020817]/80 p-3 flex items-start gap-3">
              <div className="text-xl text-blue-400">✦</div>
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-blue-400">Análise automática</p>
                <p className="mt-1 text-xs font-semibold text-slate-200 leading-relaxed">{ritmoOperacao.analise}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black">Últimos Embarques</h2>
              <a href="/admin/embarques" className="text-blue-400 font-bold">
                Ver todos
              </a>
            </div>

            <div className="overflow-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-blue-950">
                    <th className="pb-4">AWB</th>
                    <th className="pb-4">Exportador</th>
                    <th className="pb-4">Importador</th>
                    <th className="pb-4">Transportadora</th>
                    <th className="pb-4">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {ultimosEmbarques.map((item) => (
                    <tr key={item.id} className="border-b border-blue-950">
                      <td className="py-4 font-bold text-blue-400">
                        <a href={`/admin/embarques/${item.id}`} className="hover:underline">
                          {item.awb || '-'}
                        </a>
                      </td>
                      <td className="py-4">{item.exportador || '-'}</td>
                      <td className="py-4">{item.importador || '-'}</td>
                      <td className="py-4">{item.transportadora || '-'}</td>
                      <td className="py-4">
                        <StatusPillDashboard status={item.status_operacional || '-'} />
                      </td>
                    </tr>
                  ))}

                  {ultimosEmbarques.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        Nenhum embarque encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <h2 className="text-2xl font-black mb-6">Top Transportadoras</h2>

            <div className="space-y-5">
              {embarquesPorTransportadora.map((item: any) => (
                <div key={item.nome}>
                  <div className="flex justify-between mb-2">
                    <span>{item.nome}</span>
                    <span className="font-bold">{item.total}</span>
                  </div>

                  <div className="h-3 bg-[#020817] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600"
                      style={{
                        width: `${Math.min(
                          (item.total / Math.max(embarques.length, 1)) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="text-2xl font-black mb-6">Embarques por tipo</h2>

            <div className="space-y-4">
              <TipoLinha titulo="Exportação" valor={embarquesPorTipo.exportacao} total={embarques.length} />
              <TipoLinha titulo="Importação" valor={embarquesPorTipo.importacao} total={embarques.length} />
              <TipoLinha titulo="Outros" valor={embarquesPorTipo.outros} total={embarques.length} />
            </div>
          </div>

          <div className="card">
            <div className="flex justify-between mb-6">
              <h2 className="text-2xl font-black">Clientes</h2>
              <a href="/admin/usuarios" className="text-blue-400 font-bold text-sm">
                Ver todos
              </a>
            </div>

            <div className="space-y-5">
              <ClienteLinha titulo="Clientes ativos" valor={clientesAtivos} cor="blue" />
              <ClienteLinha titulo="Usuários admin" valor={usuarios.filter((u) => u.tipo_acesso === 'admin').length} cor="purple" />
              <ClienteLinha titulo="Clientes inativos" valor={usuarios.filter((u) => u.ativo === false).length} cor="red" />
            </div>
          </div>

          <div className="card">
            <div className="flex justify-between mb-6">
              <h2 className="text-2xl font-black">Peso movimentado</h2>
              <span className="text-blue-400 font-bold text-sm">Total</span>
            </div>

            <h3 className="text-4xl font-black text-blue-400 mb-3">
              {pesoTotal.toFixed(2)} kg
            </h3>

            <p className="text-slate-400 mb-6">
              Peso total apurado nos embarques cadastrados.
            </p>

            <div className="h-24 bg-blue-600/20 rounded-2xl overflow-hidden flex items-end">
              <div className="h-16 w-full bg-blue-600/50 rounded-t-[40%]" />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <div className="card">
            <h2 className="text-2xl font-black mb-6">🏆 Ranking de Clientes</h2>

            <div className="space-y-4">
              {rankingClientes.length === 0 ? (
                <p className="text-slate-500">Nenhum cliente no ranking ainda.</p>
              ) : (
                rankingClientes.map((cliente: any, index: number) => (
                  <div key={cliente.nome} className="flex justify-between items-center border-b border-blue-950 pb-4">
                    <div>
                      <p className="font-black">
                        {index + 1}º {cliente.nome}
                      </p>
                      <p className="text-slate-500 text-sm">
                        {cliente.peso.toFixed(2)} kg movimentados
                      </p>
                    </div>

                    <span className="bg-blue-600 px-4 py-2 rounded-full font-black">
                      {cliente.total}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="text-2xl font-black mb-6">⚡ Últimas Atividades HC</h2>

            <div className="space-y-4">
              {atividadesRecentes.length === 0 ? (
                <p className="text-slate-500">Nenhuma atividade recente.</p>
              ) : (
                atividadesRecentes.map((atividade, index) => (
                  <div key={index} className="flex gap-4 border-b border-blue-950 pb-4">
                    <div className="text-2xl">{atividade.icone}</div>

                    <div className="flex-1">
                      <p className="font-black">{atividade.titulo}</p>
                      <p className="text-slate-400 text-sm mt-1">
                        {atividade.detalhe}
                      </p>
                    </div>

                    <span className="text-slate-500 text-sm whitespace-nowrap">
                      {atividade.data
                        ? new Date(atividade.data).toLocaleString('pt-BR')
                        : '-'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <div className="card">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black">Últimas Cotações</h2>
              <a href="/admin/cotacoes" className="text-blue-400 font-bold">
                Ver todas
              </a>
            </div>

            <div className="space-y-4">
              {ultimasCotacoes.length === 0 ? (
                <p className="text-slate-500">Nenhuma cotação encontrada.</p>
              ) : (
                ultimasCotacoes.map((item) => (
                  <div key={item.id} className="flex justify-between items-center border-b border-blue-950 pb-4">
                    <div>
                      <p className="font-bold">
                        {item.cliente_final || item.solicitante_email || 'Sem identificação'}
                      </p>

                      <p className="text-slate-500 text-sm">
                        {item.criado_em ? new Date(item.criado_em).toLocaleString('pt-BR') : '-'}
                      </p>
                    </div>

                    <StatusPillDashboard status={item.status || '-'} />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="text-2xl font-black mb-6">Resumo operacional</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ResumoBox titulo="Embarques ativos" valor={String(ativos)} />
              <ResumoBox titulo="Cotações pendentes" valor={String(cotacoesPendentes)} />
              <ResumoBox titulo="Chamados suporte" valor={String(suporte.length)} />
              <ResumoBox titulo="Transportadoras ativas" valor={String(transportadorasAtivas)} />
            </div>
          </div>
        </section>

        <footer className="text-center text-slate-500 py-8">
          HC Connect © 2026 • Dashboard Executivo Operacional
        </footer>
      </section>

      {modalErrosRastreio && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#071225] border border-red-500 rounded-3xl w-full max-w-3xl p-6 shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-black text-white">
                  🔍 Erros do Rastreio Automático
                </h2>
                <p className="text-slate-400 text-sm mt-2">
                  Última execução: {dataHoraBR(ultimoRastreio?.criado_em)}
                </p>
              </div>

              <button
                onClick={() => setModalErrosRastreio(false)}
                className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl font-black"
              >
                ✕
              </button>
            </div>

            {errosRastreio.length > 0 ? (
              <div className="space-y-4 max-h-[60vh] overflow-auto">
                {errosRastreio.map((erro: any, index: number) => (
                  <div
                    key={index}
                    className="border border-red-900 bg-red-950/20 rounded-2xl p-4"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <p className="text-slate-500 text-xs font-bold">AWB</p>
                        <h3 className="text-xl font-black text-blue-400">
                          {erro.awb || '-'}
                        </h3>
                      </div>

                      <div>
                        <p className="text-slate-500 text-xs font-bold">
                          Transportadora
                        </p>
                        <p className="font-black text-white">
                          {erro.transportadora || '-'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-slate-500 text-xs font-bold">Motivo</p>
                      <p className="text-red-300 font-bold mt-1">
                        {erro.erro || 'Erro não informado.'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-blue-900 bg-[#020817] rounded-2xl p-6 text-center">
                <p className="text-slate-400">
                  Existem erros contabilizados, mas este log ainda não possui detalhes salvos.
                </p>
                <p className="text-slate-500 text-sm mt-2">
                  Rode novamente o rastreio automático para gravar os detalhes dos AWBs.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

function KpiCard({ titulo, valor, detalhe, icone, cor, href }: any) {
  const corNumero =
    cor === 'green'
      ? 'text-emerald-400'
      : cor === 'yellow'
      ? 'text-yellow-400'
      : 'text-blue-400'

  const conteudo = (
    <div className="flex justify-between items-start">
      <div>
        <p className="text-slate-400 text-sm">{titulo}</p>
        <h2 className={`text-4xl font-black mt-4 ${corNumero}`}>{valor}</h2>
        <p className="text-slate-500 text-sm mt-2">{detalhe}</p>
      </div>

      <div className="text-4xl">{icone}</div>
    </div>
  )

  const classe =
    'block bg-[#071225] border border-blue-900 rounded-3xl p-6 shadow-[0_0_25px_rgba(37,99,235,0.08)] transition hover:border-blue-400 hover:bg-blue-600/10'

  if (href) {
    return (
      <a href={href} className={classe}>
        {conteudo}
      </a>
    )
  }

  return <div className={classe}>{conteudo}</div>
}

function MiniStatus({ titulo, valor, cor, href }: any) {
  const classes =
    cor === 'red'
      ? 'bg-red-600/20 text-red-400'
      : cor === 'yellow'
      ? 'bg-yellow-500/20 text-yellow-400'
      : cor === 'purple'
      ? 'bg-purple-600/20 text-purple-400'
      : 'bg-green-600/20 text-green-400'

  const conteudo = (
    <>
      <h3 className="text-3xl font-black">{valor}</h3>
      <p className="font-bold mt-1">{titulo}</p>
    </>
  )

  const classe = `block rounded-2xl p-4 transition hover:ring-2 hover:ring-blue-400 ${classes}`

  if (href) {
    return (
      <a href={href} className={classe}>
        {conteudo}
      </a>
    )
  }

  return <div className={classe}>{conteudo}</div>
}

function OperationCard({ titulo, valor, cor, href }: any) {
  const classe =
    cor === 'green'
      ? 'text-green-400'
      : cor === 'yellow'
      ? 'text-yellow-400'
      : cor === 'red'
      ? 'text-red-400'
      : 'text-blue-400'

  const conteudo = (
    <>
      <h3 className={`text-2xl font-black ${classe}`}>{valor}</h3>
      <p className="text-slate-400 mt-2">{titulo}</p>
    </>
  )

  const cardClasse =
    'block border border-blue-900 bg-[#020817] rounded-2xl p-5 transition hover:border-blue-400 hover:bg-blue-600/10'

  if (href) {
    return (
      <a href={href} className={cardClasse}>
        {conteudo}
      </a>
    )
  }

  return <div className={cardClasse}>{conteudo}</div>
}

function AutoBox({ titulo, valor, cor, href }: any) {
  const classe =
    cor === 'green'
      ? 'text-green-400'
      : cor === 'red'
      ? 'text-red-400'
      : 'text-blue-400'

  const conteudo = (
    <>
      <h3 className={`text-2xl font-black ${classe}`}>{valor}</h3>
      <p className="text-slate-500 text-xs mt-1">{titulo}</p>
    </>
  )

  const cardClasse =
    'block border border-blue-900 bg-[#020817] rounded-2xl p-4 text-center transition hover:border-blue-400 hover:bg-blue-600/10'

  if (href) {
    return (
      <a href={href} className={cardClasse}>
        {conteudo}
      </a>
    )
  }

  return <div className={cardClasse}>{conteudo}</div>
}

function StatusPillDashboard({ status }: any) {
  const s = String(status || '').toLowerCase()

  let classe = 'bg-slate-700 text-slate-200 border-slate-500'
  let icone = '⚪'

  if (s.includes('entregue') || s.includes('delivered')) {
    classe = 'bg-green-600/20 text-green-300 border-green-500'
    icone = '✅'
  } else if (s.includes('trânsito') || s.includes('transito') || s.includes('transit')) {
    classe = 'bg-blue-600/20 text-blue-300 border-blue-500'
    icone = '🚚'
  } else if (s.includes('fiscal') || s.includes('liberação') || s.includes('liberacao') || s.includes('clearance')) {
    classe = 'bg-yellow-500/20 text-yellow-300 border-yellow-500'
    icone = '🛃'
  } else if (s.includes('liberado') || s.includes('released')) {
    classe = 'bg-emerald-600/20 text-emerald-300 border-emerald-500'
    icone = '🟢'
  } else if (s.includes('coletado') || s.includes('coleta') || s.includes('picked')) {
    classe = 'bg-purple-600/20 text-purple-300 border-purple-500'
    icone = '📦'
  } else if (s.includes('atrasado') || s.includes('vencido')) {
    classe = 'bg-red-600/20 text-red-300 border-red-500'
    icone = '🔴'
  } else if (s.includes('aguardando')) {
    classe = 'bg-orange-500/20 text-orange-300 border-orange-500'
    icone = '⏳'
  } else if (s.includes('análise') || s.includes('analise')) {
    classe = 'bg-yellow-500/20 text-yellow-300 border-yellow-500'
    icone = '🔎'
  } else if (s.includes('respondido')) {
    classe = 'bg-blue-600/20 text-blue-300 border-blue-500'
    icone = '💬'
  } else if (s.includes('resolvido')) {
    classe = 'bg-green-600/20 text-green-300 border-green-500'
    icone = '✅'
  } else if (s.includes('aberto')) {
    classe = 'bg-red-600/20 text-red-300 border-red-500'
    icone = '🔴'
  }

  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-black whitespace-nowrap ${classe}`}>
      <span>{icone}</span>
      {status || '-'}
    </span>
  )
}

function AlertaPremium({ titulo, valor, icone, cor, href }: any) {
  const classe =
    cor === 'red'
      ? 'bg-red-600'
      : cor === 'yellow'
      ? 'bg-yellow-500 text-black'
      : cor === 'purple'
      ? 'bg-purple-600'
      : cor === 'green'
      ? 'bg-green-600'
      : 'bg-blue-600'

  const conteudo = (
    <>
      <div className="flex items-center gap-3">
        <span>{icone}</span>
        <p className="text-slate-300">{titulo}</p>
      </div>

      <span className={`px-4 py-2 rounded-full font-black ${classe}`}>
        {valor}
      </span>
    </>
  )

  const cardClasse =
    'flex justify-between items-center border-b border-blue-950 pb-4 transition hover:bg-blue-600/10 rounded-xl px-2 py-2'

  if (href) {
    return (
      <a href={href} className={cardClasse}>
        {conteudo}
      </a>
    )
  }

  return <div className={cardClasse}>{conteudo}</div>
}

function ResumoMini({ titulo, valor }: any) {
  return (
    <div>
      <h3 className="text-2xl font-black">{valor}</h3>
      <p className="text-slate-500 text-sm">{titulo}</p>
    </div>
  )
}

function PeriodoButton({ ativo, onClick, children }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        ativo
          ? 'rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white shadow-[0_0_14px_rgba(37,99,235,0.30)]'
          : 'rounded-xl border border-blue-900 bg-[#071225] px-4 py-2 text-xs font-black text-slate-200 hover:bg-blue-600/20'
      }
    >
      {children}
    </button>
  )
}

function MetricDashboard({ icone, valor, titulo, detalhe }: any) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-800 bg-[#020817] text-lg text-blue-400">
        {icone}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xl font-black leading-tight text-white">{valor}</p>
        <p className="mt-0.5 text-xs font-bold text-slate-200">{titulo}</p>
        <p className="text-[11px] font-semibold text-blue-200/50">{detalhe}</p>
      </div>
    </div>
  )
}

function InsightDashboard({ icone, titulo, valor, detalhe }: any) {
  return (
    <div className="rounded-xl border border-blue-900 bg-[#020817]/70 p-3 flex items-center gap-3 min-w-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-800 bg-[#071225] text-base">
        {icone}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-wide text-blue-400">{titulo}</p>
        <p className="mt-0.5 truncate text-sm font-black text-white">{valor}</p>
        <p className="text-[11px] font-semibold text-slate-400">{detalhe}</p>
      </div>
    </div>
  )
}

function TipoLinha({ titulo, valor, total }: any) {
  const percentual = total > 0 ? Math.round((valor / total) * 100) : 0

  return (
    <div>
      <div className="flex justify-between mb-2">
        <span>{titulo}</span>
        <span className="font-bold">
          {percentual}% ({valor})
        </span>
      </div>

      <div className="h-3 bg-[#020817] rounded-full overflow-hidden">
        <div className="h-full bg-purple-600" style={{ width: `${percentual}%` }} />
      </div>
    </div>
  )
}

function ClienteLinha({ titulo, valor, cor }: any) {
  const classe =
    cor === 'red'
      ? 'text-red-400'
      : cor === 'purple'
      ? 'text-purple-400'
      : 'text-blue-400'

  return (
    <div className="flex justify-between border-b border-blue-950 pb-3">
      <span className="text-slate-400">{titulo}</span>
      <strong className={classe}>{valor}</strong>
    </div>
  )
}

function ResumoBox({ titulo, valor }: any) {
  return (
    <div className="border border-blue-900 bg-[#020817] rounded-2xl p-5">
      <p className="text-slate-400">{titulo}</p>
      <h3 className="text-3xl font-black mt-2 text-blue-400">{valor}</h3>
    </div>
  )
}