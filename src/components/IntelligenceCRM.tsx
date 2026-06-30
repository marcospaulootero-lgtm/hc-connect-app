'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type ClienteCRM = {
  nome: string
  processos: number
  pagos: number
  receita: number
  custo: number
  profit: number
  margem: number
  ticketMedio: number
  ultimoProcesso: string
  diasSemEmbarque: number
  servicoPrincipal: string
  recomendacao: string
  motivo: string
  acaoSugerida: string
  prioridade: number
}

type ContatoCliente = {
  id: string
  cliente_nome: string
  cliente_chave: string
  canal: string | null
  status_retorno: string | null
  feedback: string | null
  proxima_acao: string | null
  proxima_data: string | null
  responsavel_nome: string | null
  criado_em: string | null
}

export default function IntelligenceCRM() {
  const [financeiro, setFinanceiro] = useState<any[]>([])
  const [contatos, setContatos] = useState<ContatoCliente[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('TODOS')

  const [clienteAberto, setClienteAberto] = useState<ClienteCRM | null>(null)
  const [canal, setCanal] = useState('WhatsApp')
  const [statusRetorno, setStatusRetorno] = useState('TENTOU_CONTATO')
  const [feedback, setFeedback] = useState('')
  const [proximaAcao, setProximaAcao] = useState('')
  const [proximaData, setProximaData] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setLoading(true)

    const [{ data: fin }, { data: hist }] = await Promise.all([
      supabase.from('financeiro_embarques').select('*'),
      supabase
        .from('intelligence_contatos_clientes')
        .select('*')
        .order('criado_em', { ascending: false }),
    ])

    setFinanceiro(fin || [])
    setContatos((hist || []) as ContatoCliente[])
    setLoading(false)
  }

  function texto(valor: any) {
    return String(valor || '').trim()
  }

  function numero(valor: any) {
    if (valor === null || valor === undefined || valor === '') return 0
    if (typeof valor === 'number') return valor

    return (
      Number(
        String(valor)
          .replace(/[R$USD\s]/gi, '')
          .replace(/\./g, '')
          .replace(',', '.')
      ) || 0
    )
  }

  function normalizar(valor: any) {
    return texto(valor)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
  }

  function chaveCliente(valor: any) {
    return normalizar(valor).replace(/[^A-Z0-9]/g, '_') || 'CLIENTE_SEM_NOME'
  }

  function normalizarData(valor: any) {
    if (!valor) return ''

    if (valor instanceof Date && !isNaN(valor.getTime())) {
      return valor.toISOString().slice(0, 10)
    }

    if (typeof valor === 'number') {
      const data = new Date((valor - 25569) * 86400 * 1000)
      return data.toISOString().slice(0, 10)
    }

    const bruto = String(valor).trim()
    if (!bruto || bruto === '0') return ''

    if (/^\d{4}-\d{2}-\d{2}/.test(bruto)) return bruto.slice(0, 10)
    if (/^\d{4}-\d{2}$/.test(bruto)) return `${bruto}-01`

    if (/^\d{1,2}\/\d{4}$/.test(bruto)) {
      const [mes, ano] = bruto.split('/')
      return `${ano}-${mes.padStart(2, '0')}-01`
    }

    const partes = bruto.split('/')
    if (partes.length === 3) {
      const [dia, mes, ano] = partes
      return `${ano.padStart(4, '20')}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
    }

    return ''
  }

  function dataBR(valor: any) {
    const data = normalizarData(valor)
    if (!data) return '-'
    const [ano, mes, dia] = data.split('-')
    return `${dia}/${mes}/${ano}`
  }

  function moeda(valor: any) {
    return Number(valor || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  function percentual(valor: any) {
    return `${Number(valor || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`
  }

  function diasDesde(valor: any) {
    const data = normalizarData(valor)
    if (!data) return 9999

    const inicio = new Date(`${data}T00:00:00`)
    const hoje = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00`)
    const diff = hoje.getTime() - inicio.getTime()

    return Math.max(0, Math.floor(diff / 86400000))
  }

  function ultimoDiaDoMes(valor: any) {
    const bruto = String(valor || '').trim()

    if (/^\d{4}-\d{2}$/.test(bruto)) {
      const [ano, mes] = bruto.split('-').map(Number)
      return new Date(ano, mes, 0).toISOString().slice(0, 10)
    }

    if (/^\d{1,2}\/\d{4}$/.test(bruto)) {
      const [mes, ano] = bruto.split('/').map(Number)
      return new Date(ano, mes, 0).toISOString().slice(0, 10)
    }

    return normalizarData(valor)
  }

  function clienteProcesso(item: any) {
    return texto(
      item.cliente ||
      item.nome_cliente ||
      item.razao_social ||
      item.cliente_final ||
      item.importador ||
      item.exportador ||
      'Não informado'
    )
  }

  function servicoProcesso(item: any) {
    return texto(item.servico || item.tipo_servico || item.serviço || item.categoria || 'Não informado')
  }

  function valorCobranca(item: any) {
    return numero(item.valor_cobranca || item.valor_faturado || item.valor_venda || item.valor)
  }

  function temCusto(item: any) {
    return numero(item.valor_compra || item.custo_compra || item.custo) > 0
  }

  function custos(item: any) {
    return (
      numero(item.valor_compra || item.custo_compra || item.custo) +
      numero(item.doc_dta || item.dta_doc || item.impostos || item.taxas) +
      numero(item.debito_terceiro || item.terceiros || item.profit_terceiros || item.valor_terceiros)
    )
  }

  function profit(item: any) {
    const salvo = numero(item.profit_hc || item.profit)
    if (temCusto(item) && salvo !== 0) return salvo
    if (!temCusto(item)) return 0
    return valorCobranca(item) - custos(item)
  }

  function statusCobranca(item: any) {
    const status = normalizar(item.status_pagamento || item.status || item.pgta_terceiros)

    if (
      normalizarData(item.recebimento) ||
      normalizarData(item.recebimento_cliente) ||
      normalizarData(item.data_pagamento) ||
      status.includes('PAGO')
    ) {
      return 'PAGO'
    }

    if (status.includes('VENCIDO') || status.includes('ATRASADO')) return 'ATRASADO'

    const vencimento = normalizarData(item.vencimento_cobranca || item.vencimento || item.data_vencimento)
    const hoje = new Date().toISOString().slice(0, 10)

    if (vencimento && vencimento < hoje) return 'ATRASADO'
    return 'EM ABERTO'
  }

  function dataProcesso(item: any) {
  // Regra HC:
  // Para Processos Faturados importados do Excel, a recência comercial deve vir das datas financeiras.
  // Nunca usar created_at/criado_em do financeiro, porque isso é data de importação no portal.
  const datas = [
    normalizarData(item.recebimento),
    normalizarData(item.recebimento_cliente),
    normalizarData(item.data_recebimento),
    normalizarData(item.data_pagamento),

    normalizarData(item.vencimento_cobranca),
    normalizarData(item.vencimento_cliente),
    normalizarData(item.venc_cliente),
    normalizarData(item.vencimento),
    normalizarData(item.data_vencimento),

    ultimoDiaDoMes(item.mes_profit),
    ultimoDiaDoMes(item.mes),
  ].filter(Boolean)

  if (datas.length === 0) return ''

  return datas.sort().reverse()[0]
}

  function dataPortalEmbarque(item: any) {
    // Embarques criados no portal representam operação real recente.
    // Aqui created_at pode contar, porque é criação do embarque no portal, não importação antiga do Excel.
    const datas = [
      normalizarData(item.data_entrega),
      normalizarData(item.data_envio),
      normalizarData(item.data_embarque),
      normalizarData(item.data_coleta),
      normalizarData(item.data_prevista),
      normalizarData(item.ultima_atualizacao),
      normalizarData(item.atualizado_em),
      normalizarData(item.created_at),
      normalizarData(item.criado_em),
    ].filter(Boolean)

    if (datas.length === 0) return ''

    return datas.sort().reverse()[0]
  }


  function maiorData(a: any, b: any) {
  const dataA = normalizarData(a)
  const dataB = normalizarData(b)

  if (!dataA) return dataB || ''
  if (!dataB) return dataA || ''

  return dataB > dataA ? dataB : dataA
}

  function ultimoContato(nome: string) {
    const chave = chaveCliente(nome)

    return contatos
      .filter((item) => item.cliente_chave === chave)
      .sort((a, b) => String(b.criado_em || '').localeCompare(String(a.criado_em || '')))[0] || null
  }

  const clientes = useMemo(() => {
    const mapa: Record<string, any> = {}

    financeiro.forEach((item) => {
      const nome = clienteProcesso(item)
      if (!nome || nome === 'Não informado') return

      if (!mapa[nome]) {
        mapa[nome] = {
          nome,
          processos: 0,
          pagos: 0,
          receita: 0,
          custo: 0,
          profit: 0,
          vencido: 0,
          atrasados: 0,
          semCusto: 0,
          ultimoProcesso: '',
          servicos: {},
        }
      }

      const status = statusCobranca(item)
      const data = dataProcesso(item)
      const servico = servicoProcesso(item)

      mapa[nome].processos += 1
      mapa[nome].servicos[servico] = (mapa[nome].servicos[servico] || 0) + 1

      if (data) mapa[nome].ultimoProcesso = maiorData(mapa[nome].ultimoProcesso, data)

      if (status === 'PAGO') {
        mapa[nome].pagos += 1
        mapa[nome].receita += valorCobranca(item)

        if (temCusto(item)) {
          mapa[nome].custo += custos(item)
          mapa[nome].profit += profit(item)
        } else {
          mapa[nome].semCusto += 1
        }
      }

      if (status === 'ATRASADO') {
        mapa[nome].atrasados += 1
        mapa[nome].vencido += valorCobranca(item)
      }
    })

    return Object.values(mapa)
      .map((item: any) => {
        const margem = item.receita > 0 ? (item.profit / item.receita) * 100 : 0
        const ticketMedio = item.pagos > 0 ? item.receita / item.pagos : 0
        const diasSemEmbarque = diasDesde(item.ultimoProcesso)
        const servicoPrincipal =
          Object.entries(item.servicos || {}).sort((a: any, b: any) => Number(b[1]) - Number(a[1]))[0]?.[0] || '-'

        let recomendacao = 'ANALISAR'
        let motivo = 'Pouco dado confiável para decidir.'
        let acaoSugerida = 'Conferir histórico, margem e próximos embarques.'
        let prioridade = 1

        if (item.vencido > 0) {
          recomendacao = 'COBRAR / SEGURAR'
          motivo = 'Tem cobrança vencida. Antes de vender mais, proteger caixa.'
          acaoSugerida = 'Cobrar pendência antes de nova venda.'
          prioridade = 8
        } else if (item.semCusto > 0) {
          recomendacao = 'CORRIGIR CUSTO'
          motivo = 'Tem processo pago sem custo. Margem não é confiável.'
          acaoSugerida = 'Corrigir custo antes de reajustar ou recuperar.'
          prioridade = 7
        } else if (diasSemEmbarque >= 90 && diasSemEmbarque < 9999) {
          recomendacao = 'REATIVAR AGORA'
          motivo = `Cliente parado há ${diasSemEmbarque} dias.`
          acaoSugerida = 'Chamar agora com proposta de retomada.'
          prioridade = 6
        } else if (diasSemEmbarque >= 45 && diasSemEmbarque < 9999) {
          recomendacao = 'REATIVAR'
          motivo = `Cliente parado há ${diasSemEmbarque} dias.`
          acaoSugerida = 'Fazer follow-up perguntando próximos embarques.'
          prioridade = 5
        } else if (item.processos >= 4 && margem > 0 && margem < 15) {
          recomendacao = 'REAJUSTAR'
          motivo = 'Cliente com volume, mas margem baixa.'
          acaoSugerida = 'Rever tabela, taxa mínima ou escopo do serviço.'
          prioridade = 4
        } else if (item.pagos >= 3 && ticketMedio > 0 && ticketMedio < 1500) {
          recomendacao = 'AUMENTAR TICKET'
          motivo = 'Ticket médio baixo.'
          acaoSugerida = 'Oferecer pacote, taxa mínima ou serviço adicional.'
          prioridade = 3
        } else if (item.profit > 0) {
          recomendacao = 'FOCAR'
          motivo = 'Cliente positivo para manter e crescer.'
          acaoSugerida = 'Oferecer novo serviço ou pacote de acompanhamento.'
          prioridade = 2
        }

        return {
          nome: item.nome,
          processos: item.processos,
          pagos: item.pagos,
          receita: item.receita,
          custo: item.custo,
          profit: item.profit,
          margem,
          ticketMedio,
          ultimoProcesso: item.ultimoProcesso,
          diasSemEmbarque,
          servicoPrincipal,
          recomendacao,
          motivo,
          acaoSugerida,
          prioridade,
        } as ClienteCRM
      })
      .sort((a: ClienteCRM, b: ClienteCRM) => b.prioridade - a.prioridade || b.profit - a.profit)
  }, [financeiro])

  const clientesFiltrados = useMemo(() => {
    const termo = normalizar(busca)
    const hoje = new Date().toISOString().slice(0, 10)

    return clientes.filter((cliente) => {
      const contato = ultimoContato(cliente.nome)
      const status = String(contato?.status_retorno || 'NAO_CONTATADO')
      const proxima = normalizarData(contato?.proxima_data)

      const passaBusca =
        !termo ||
        normalizar(`${cliente.nome} ${cliente.recomendacao} ${cliente.motivo} ${cliente.servicoPrincipal}`).includes(termo)

      const passaFiltro =
        filtro === 'TODOS' ||
        (filtro === 'NAO_CONTATADO' && !contato) ||
        (filtro === 'CONTATO_FEITO' && !!contato) ||
        (filtro === 'SEM_RESPOSTA' && status === 'SEM_RESPOSTA') ||
        (filtro === 'RESPONDEU' && ['RESPONDEU', 'PEDIU_COTACAO', 'EM_NEGOCIACAO', 'REATIVADO'].includes(status)) ||
        (filtro === 'AGENDADO' && !!proxima) ||
        (filtro === 'VENCIDO' && !!proxima && proxima < hoje) ||
        (filtro === 'REATIVADO' && status === 'REATIVADO') ||
        (filtro === 'PERDIDO' && ['SEM_INTERESSE', 'PERDIDO'].includes(status))

      return passaBusca && passaFiltro
    })
  }, [clientes, contatos, busca, filtro])

  function abrirModal(cliente: ClienteCRM) {
    setClienteAberto(cliente)
    setCanal('WhatsApp')
    setStatusRetorno('TENTOU_CONTATO')
    setFeedback('')
    setProximaAcao(cliente.acaoSugerida)
    setProximaData('')
  }

  async function salvarContato() {
    if (!clienteAberto) return

    if (!feedback.trim()) {
      alert('Informe o feedback do contato.')
      return
    }

    setSalvando(true)

    try {
      const { data: authData } = await supabase.auth.getUser()
      const usuario = authData?.user

      const payload = {
        cliente_nome: clienteAberto.nome,
        cliente_chave: chaveCliente(clienteAberto.nome),
        acao: 'CONTATO_REALIZADO',
        canal,
        status_retorno: statusRetorno,
        feedback: feedback.trim(),
        proxima_acao: proximaAcao.trim() || null,
        proxima_data: proximaData || null,
        responsavel_id: usuario?.id || null,
        responsavel_nome: usuario?.email || 'Marcos Paulo Otero',
        atualizado_em: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('intelligence_contatos_clientes')
        .insert([payload])
        .select('*')
        .single()

      if (error) throw new Error(error.message)

      setContatos((atual) => [data as ContatoCliente, ...atual])
      setClienteAberto(null)
      alert('Contato registrado com sucesso.')
    } catch (error: any) {
      alert('Erro ao registrar contato: ' + error.message)
    } finally {
      setSalvando(false)
    }
  }

  if (loading) {
    return (
      <section className="mb-6 rounded-3xl border border-cyan-800 bg-cyan-950/10 p-6 text-cyan-200">
        Carregando acompanhamento comercial...
      </section>
    )
  }

  return (
    <section className="mb-6 rounded-3xl border border-cyan-800 bg-gradient-to-b from-[#071225] to-[#020817] p-6 shadow-[0_0_35px_rgba(6,182,212,0.10)]">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-cyan-300">CRM / Recuperação de Clientes</p>
          <h2 className="text-3xl font-black text-white">Acompanhamento comercial</h2>
          <p className="mt-1 text-sm text-slate-400">
            Registre tentativas de contato, feedback do cliente, próxima ação e data de retorno dentro da própria aba Intelligence.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniResumo label="Clientes" valor={clientes.length} />
          <MiniResumo label="Contatos" valor={contatos.length} />
          <MiniResumo label="Não contatados" valor={clientes.filter((c) => !ultimoContato(c.nome)).length} />
          <MiniResumo label="Reativar" valor={clientes.filter((c) => c.recomendacao.includes('REATIVAR')).length} />
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar cliente, recomendação ou serviço..."
          className="rounded-xl border border-blue-900 bg-[#020817] px-4 py-3 text-white outline-none"
        />

        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="rounded-xl border border-blue-900 bg-[#020817] px-4 py-3 text-white outline-none"
        >
          <option value="TODOS">Todos os clientes</option>
          <option value="NAO_CONTATADO">Não contatados</option>
          <option value="CONTATO_FEITO">Contato feito</option>
          <option value="SEM_RESPOSTA">Sem resposta</option>
          <option value="RESPONDEU">Responderam</option>
          <option value="AGENDADO">Com próxima ação</option>
          <option value="VENCIDO">Próxima ação vencida</option>
          <option value="REATIVADO">Reativados</option>
          <option value="PERDIDO">Perdidos / sem interesse</option>
        </select>

        <button
          type="button"
          onClick={carregar}
          className="rounded-xl bg-cyan-600 px-4 py-3 font-black text-white hover:bg-cyan-500"
        >
          Atualizar lista
        </button>
      </div>

      <div className="max-h-[620px] overflow-auto rounded-2xl border border-blue-900">
        <table className="w-full min-w-[1450px] text-sm">
          <thead className="sticky top-0 bg-[#071225] text-slate-400">
            <tr className="border-b border-blue-900">
              <Th>Cliente</Th>
              <Th>Recomendação</Th>
              <Th>Último contato</Th>
              <Th>Feedback</Th>
              <Th>Próxima ação</Th>
              <Th>Último processo</Th>
              <Th>Sem embarcar</Th>
              <Th>Profit</Th>
              <Th>Ticket</Th>
              <Th>Ação</Th>
            </tr>
          </thead>

          <tbody>
            {clientesFiltrados.slice(0, 80).map((cliente) => {
              const contato = ultimoContato(cliente.nome)
              const proxima = normalizarData(contato?.proxima_data)
              const vencida = proxima && proxima < new Date().toISOString().slice(0, 10)

              return (
                <tr key={cliente.nome} className="border-b border-blue-950 hover:bg-blue-950/20">
                  <Td>
                    <strong>{cliente.nome}</strong>
                    <p className="mt-1 text-xs text-slate-500">{cliente.motivo}</p>
                    <p className="mt-1 text-xs text-blue-300">{cliente.servicoPrincipal}</p>
                  </Td>

                  <Td>
                    <Badge status={cliente.recomendacao} />
                  </Td>

                  <Td>
                    {contato ? (
                      <div>
                        <strong>{contato.status_retorno || '-'}</strong>
                        <p className="mt-1 text-xs text-slate-500">{contato.canal || '-'}</p>
                        <p className="mt-1 text-xs text-slate-500">{dataBR(contato.criado_em)}</p>
                      </div>
                    ) : (
                      <span className="text-orange-300">Não contatado</span>
                    )}
                  </Td>

                  <Td>
                    <p className="max-w-[280px] text-xs text-slate-300">
                      {contato?.feedback || 'Sem feedback registrado.'}
                    </p>
                  </Td>

                  <Td>
                    <p className="max-w-[260px] font-bold text-slate-200">
                      {contato?.proxima_acao || cliente.acaoSugerida}
                    </p>
                    <p className={vencida ? 'mt-1 text-xs text-red-400' : 'mt-1 text-xs text-slate-500'}>
                      {contato?.proxima_data ? dataBR(contato.proxima_data) : 'Sem data'}
                    </p>
                  </Td>

                  <Td>{dataBR(cliente.ultimoProcesso)}</Td>
                  <Td>
                    <strong className={cliente.diasSemEmbarque >= 90 ? 'text-red-400' : cliente.diasSemEmbarque >= 45 ? 'text-orange-400' : 'text-green-400'}>
                      {cliente.diasSemEmbarque === 9999 ? '-' : `${cliente.diasSemEmbarque} dias`}
                    </strong>
                  </Td>
                  <Td><strong className={cliente.profit >= 0 ? 'text-green-400' : 'text-red-400'}>{moeda(cliente.profit)}</strong></Td>
                  <Td><strong>{moeda(cliente.ticketMedio)}</strong></Td>
                  <Td>
                    <button
                      type="button"
                      onClick={() => abrirModal(cliente)}
                      className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-500"
                    >
                      Registrar contato
                    </button>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {clientesFiltrados.length === 0 && (
        <p className="mt-4 text-slate-500">Nenhum cliente encontrado com os filtros atuais.</p>
      )}

      {clienteAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-blue-900 bg-[#071225] p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-cyan-300">Registrar contato comercial</p>
                <h2 className="mt-1 text-2xl font-black">{clienteAberto.nome}</h2>
                <p className="mt-1 text-sm text-slate-400">{clienteAberto.motivo}</p>
              </div>

              <button
                type="button"
                onClick={() => setClienteAberto(null)}
                className="rounded-xl bg-slate-700 px-4 py-2 font-black hover:bg-slate-600"
              >
                Fechar
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm font-black text-slate-300">
                Canal
                <select value={canal} onChange={(e) => setCanal(e.target.value)} className="mt-2 w-full rounded-xl border border-blue-900 bg-[#020817] px-4 py-3 text-white">
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="E-mail">E-mail</option>
                  <option value="Telefone">Telefone</option>
                  <option value="Presencial">Presencial</option>
                  <option value="Outro">Outro</option>
                </select>
              </label>

              <label className="text-sm font-black text-slate-300">
                Retorno
                <select value={statusRetorno} onChange={(e) => setStatusRetorno(e.target.value)} className="mt-2 w-full rounded-xl border border-blue-900 bg-[#020817] px-4 py-3 text-white">
                  <option value="TENTOU_CONTATO">Tentei contato</option>
                  <option value="SEM_RESPOSTA">Sem resposta</option>
                  <option value="RESPONDEU">Respondeu</option>
                  <option value="PEDIU_COTACAO">Pediu cotação</option>
                  <option value="EM_NEGOCIACAO">Em negociação</option>
                  <option value="REATIVADO">Reativado</option>
                  <option value="SEM_INTERESSE">Sem interesse</option>
                  <option value="PERDIDO">Perdido</option>
                </select>
              </label>

              <label className="md:col-span-2 text-sm font-black text-slate-300">
                Feedback do contato
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="mt-2 min-h-[120px] w-full rounded-xl border border-blue-900 bg-[#020817] px-4 py-3 text-white"
                  placeholder="Ex: Cliente respondeu que terá nova importação na próxima semana. Pediu atualização de tabela."
                />
              </label>

              <label className="text-sm font-black text-slate-300">
                Próxima ação
                <input
                  value={proximaAcao}
                  onChange={(e) => setProximaAcao(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-blue-900 bg-[#020817] px-4 py-3 text-white"
                  placeholder="Ex: Enviar proposta / ligar novamente"
                />
              </label>

              <label className="text-sm font-black text-slate-300">
                Data da próxima ação
                <input
                  type="date"
                  value={proximaData}
                  onChange={(e) => setProximaData(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-blue-900 bg-[#020817] px-4 py-3 text-white"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setClienteAberto(null)}
                className="rounded-xl bg-slate-700 px-5 py-3 font-black hover:bg-slate-600"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={salvarContato}
                disabled={salvando}
                className="rounded-xl bg-green-600 px-5 py-3 font-black text-white hover:bg-green-500 disabled:opacity-60"
              >
                {salvando ? 'Salvando...' : 'Salvar contato'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function MiniResumo({ label, valor }: any) {
  return (
    <div className="rounded-2xl border border-blue-900 bg-[#020817] p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <strong className="text-xl text-cyan-300">{valor}</strong>
    </div>
  )
}

function Badge({ status }: any) {
  const s = String(status || '')
  const cor =
    s.includes('COBRAR') || s.includes('CUSTO')
      ? 'border-red-500 text-red-400 bg-red-950/30'
      : s.includes('REATIVAR')
        ? 'border-orange-500 text-orange-300 bg-orange-950/30'
        : s.includes('REAJUSTAR') || s.includes('TICKET')
          ? 'border-yellow-500 text-yellow-300 bg-yellow-950/30'
          : 'border-green-500 text-green-300 bg-green-950/30'

  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${cor}`}>{s}</span>
}

function Th({ children }: any) {
  return <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide">{children}</th>
}

function Td({ children }: any) {
  return <td className="px-4 py-3 align-top">{children}</td>
}
