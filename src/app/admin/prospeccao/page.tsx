'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const STATUS = [
  'NOVO',
  'CONTATADO',
  'FOLLOW-UP',
  'RESPONDEU',
  'REUNIÃO',
  'PROPOSTA',
  'CONVERTIDO',
  'PERDIDO',
]

const PRIORIDADES = ['QUENTE', 'MORNO', 'FRIO']

const PERFIS = [
  'Importação courier',
  'Exportação courier',
  'Importação formal',
  'Exportação formal',
  'DHL/FedEx - conferência de faturas',
  'DUE / Export Declaration',
  'Acompanhamento operacional',
]

const formInicial = {
  empresa: '',
  cidade: '',
  uf: '',
  segmento: '',
  site: '',
  contato_nome: '',
  contato_cargo: '',
  email: '',
  telefone: '',
  perfil_operacional: '',
  dor_logistica: '',
  status: 'NOVO',
  prioridade: 'MORNO',
  ultimo_contato: '',
  proximo_followup: '',
  observacoes: '',
}

function gerarAnaliseIA(base: any) {
  const texto = [
    base.empresa,
    base.segmento,
    base.cidade,
    base.uf,
    base.site,
    base.perfil_operacional,
    base.dor_logistica,
    base.observacoes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  let perfil = base.perfil_operacional || 'Acompanhamento operacional'
  let dor = base.dor_logistica || ''
  let prioridade = base.prioridade || 'MORNO'

  const empresa = base.empresa || 'a empresa'
  const segmento = base.segmento || 'segmento informado'

  if (
    texto.includes('medic') ||
    texto.includes('hospital') ||
    texto.includes('laboratório') ||
    texto.includes('laboratorio') ||
    texto.includes('pharma') ||
    texto.includes('farm')
  ) {
    perfil = base.perfil_operacional || 'Importação courier'
    dor =
      base.dor_logistica ||
      'Possível demanda recorrente de importação de equipamentos, peças, amostras ou materiais sensíveis, com necessidade de controle de documentos, impostos, rastreio e faturas DHL/FedEx.'
    prioridade = 'QUENTE'
  } else if (
    texto.includes('máquina') ||
    texto.includes('maquina') ||
    texto.includes('industrial') ||
    texto.includes('autope') ||
    texto.includes('peças') ||
    texto.includes('pecas') ||
    texto.includes('metal') ||
    texto.includes('usinagem')
  ) {
    perfil = base.perfil_operacional || 'Importação formal'
    dor =
      base.dor_logistica ||
      'Possível demanda de importação de peças, máquinas ou componentes industriais, com risco de divergência de peso, cobrança adicional, documentação incompleta e necessidade de acompanhamento operacional.'
    prioridade = 'QUENTE'
  } else if (
    texto.includes('eletr') ||
    texto.includes('tecnologia') ||
    texto.includes('componentes') ||
    texto.includes('sensor') ||
    texto.includes('automação') ||
    texto.includes('automacao')
  ) {
    perfil = base.perfil_operacional || 'Importação courier'
    dor =
      base.dor_logistica ||
      'Possível demanda de importação de componentes eletrônicos e peças urgentes via courier, com necessidade de rastreio, conferência de faturas e suporte em eventuais retenções.'
    prioridade = 'MORNO'
  } else if (
    texto.includes('export') ||
    texto.includes('alimento') ||
    texto.includes('cosmet') ||
    texto.includes('amostra') ||
    texto.includes('moda') ||
    texto.includes('confecção') ||
    texto.includes('confeccao')
  ) {
    perfil = base.perfil_operacional || 'Exportação courier'
    dor =
      base.dor_logistica ||
      'Possível demanda de exportação courier, emissão de documentos, acompanhamento de coleta, rastreio e suporte com DUE/Export Declaration quando aplicável.'
    prioridade = 'MORNO'
  } else if (
    texto.includes('dhl') ||
    texto.includes('fedex') ||
    texto.includes('fatura') ||
    texto.includes('cobrança') ||
    texto.includes('cobranca')
  ) {
    perfil = base.perfil_operacional || 'DHL/FedEx - conferência de faturas'
    dor =
      base.dor_logistica ||
      'Possível dor com conferência de faturas DHL/FedEx, divergência de peso, cobrança duplicada, vencimentos e falta de visibilidade para o financeiro.'
    prioridade = 'QUENTE'
  }

  if (!base.email && !base.telefone) prioridade = prioridade === 'QUENTE' ? 'MORNO' : 'FRIO'

  const contato = base.contato_nome || 'tudo bem'
  const whatsapp = `Olá, ${contato}. Me chamo Marcos, da HC Consultoria.

Vi que a ${empresa} atua em ${segmento} e pode ter demanda relacionada a ${perfil}.

A HC apoia empresas no acompanhamento de processos DHL/FedEx, importação/exportação courier e formal, conferência de faturas, divergências de peso/cobrança, documentos, rastreio e suporte operacional.

Também disponibilizamos o portal HC Connect, onde o cliente acompanha processos, documentos, faturas e chamados em tempo real.

Com quem posso falar sobre logística ou comércio exterior?`

  const email = `Assunto: Apoio em logística internacional e processos DHL/FedEx

Olá, tudo bem?

Sou Marcos, da HC Consultoria. Identifiquei que a ${empresa} pode ter demanda em ${perfil}.

Atuamos com acompanhamento de processos DHL/FedEx, importação/exportação courier e formal, conferência de faturas, divergências de peso/cobrança, documentos e suporte operacional.

Também disponibilizamos o portal HC Connect, onde o cliente acompanha processos, documentos, faturas e chamados em tempo real.

Poderia me direcionar ao responsável por logística ou comércio exterior?`

  const plano = [
    '1. Enviar primeira abordagem por WhatsApp ou e-mail.',
    '2. Se não responder, fazer follow-up em 3 dias.',
    '3. Se responder, entender volume mensal, transportadoras utilizadas e dores atuais.',
    '4. Apresentar o portal HC Connect como diferencial de controle operacional e financeiro.',
    '5. Se houver processo ativo, pedir uma fatura ou AWB para análise inicial.',
  ].join('\n')

  return {
    perfil,
    dor,
    prioridade,
    whatsapp,
    email,
    plano,
    resumo: `Perfil sugerido: ${perfil}. Prioridade: ${prioridade}. Dor provável: ${dor}`,
  }
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

function addDias(dias: number) {
  const data = new Date()
  data.setDate(data.getDate() + dias)
  return data.toISOString().slice(0, 10)
}

export default function ProspeccaoPage() {
  const [lista, setLista] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<any>(formInicial)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [analiseIA, setAnaliseIA] = useState<any | null>(null)

  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroPrioridade, setFiltroPrioridade] = useState('')

  async function carregar() {
    setCarregando(true)

    const { data, error } = await supabase
      .from('prospects_comerciais')
      .select('*')
      .order('criado_em', { ascending: false })

    if (error) {
      console.error(error)
      alert(error.message)
    }

    setLista(data || [])
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return lista.filter((item) => {
      const texto = [
        item.empresa,
        item.cidade,
        item.uf,
        item.segmento,
        item.email,
        item.telefone,
        item.contato_nome,
        item.perfil_operacional,
        item.dor_logistica,
      ]
        .join(' ')
        .toLowerCase()

      const passaBusca = !termo || texto.includes(termo)
      const passaStatus = !filtroStatus || item.status === filtroStatus
      const passaPrioridade = !filtroPrioridade || item.prioridade === filtroPrioridade

      return passaBusca && passaStatus && passaPrioridade
    })
  }, [lista, busca, filtroStatus, filtroPrioridade])

  const resumo = useMemo(() => {
    return {
      total: lista.length,
      quente: lista.filter((i) => i.prioridade === 'QUENTE').length,
      followup: lista.filter((i) => i.status === 'FOLLOW-UP').length,
      respondeu: lista.filter((i) => i.status === 'RESPONDEU').length,
      convertido: lista.filter((i) => i.status === 'CONVERTIDO').length,
      vencidos: lista.filter((i) => i.proximo_followup && i.proximo_followup < hojeISO()).length,
    }
  }, [lista])

  function atualizarCampo(campo: string, valor: string) {
    setForm((atual: any) => ({ ...atual, [campo]: valor }))
  }

  async function salvarProspect() {
    if (!form.empresa.trim()) {
      alert('Informe a empresa.')
      return
    }

    setSalvando(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const payload = {
        ...form,
        empresa: form.empresa.trim(),
        atualizado_em: new Date().toISOString(),
        criado_por: user?.id || null,
      }

      if (editandoId) {
        const { error } = await supabase
          .from('prospects_comerciais')
          .update(payload)
          .eq('id', editandoId)

        if (error) throw error
      } else {
        const { error } = await supabase.from('prospects_comerciais').insert([payload])

        if (error) throw error
      }

      setForm(formInicial)
      setEditandoId(null)
      await carregar()
      alert(editandoId ? 'Prospect atualizado.' : 'Prospect cadastrado.')
    } catch (error: any) {
      console.error(error)
      alert(error?.message || 'Erro ao salvar prospect.')
    } finally {
      setSalvando(false)
    }
  }

  function editar(item: any) {
    setEditandoId(item.id)
    setForm({
      empresa: item.empresa || '',
      cidade: item.cidade || '',
      uf: item.uf || '',
      segmento: item.segmento || '',
      site: item.site || '',
      contato_nome: item.contato_nome || '',
      contato_cargo: item.contato_cargo || '',
      email: item.email || '',
      telefone: item.telefone || '',
      perfil_operacional: item.perfil_operacional || '',
      dor_logistica: item.dor_logistica || '',
      status: item.status || 'NOVO',
      prioridade: item.prioridade || 'MORNO',
      ultimo_contato: item.ultimo_contato || '',
      proximo_followup: item.proximo_followup || '',
      observacoes: item.observacoes || '',
    })

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function aplicarAnaliseNoFormulario() {
    if (!form.empresa.trim()) {
      alert('Informe a empresa antes de gerar a análise.')
      return
    }

    const ia = gerarAnaliseIA(form)

    setForm((atual: any) => ({
      ...atual,
      perfil_operacional: ia.perfil,
      dor_logistica: ia.dor,
      prioridade: ia.prioridade,
      proximo_followup: atual.proximo_followup || addDias(3),
      observacoes: atual.observacoes
        ? atual.observacoes + '\n\nAnálise IA:\n' + ia.plano
        : 'Análise IA:\n' + ia.plano,
    }))

    setAnaliseIA({
      empresa: form.empresa,
      ...ia,
    })
  }

  async function analisarProspectExistente(item: any) {
    const ia = gerarAnaliseIA(item)

    const { error } = await supabase
      .from('prospects_comerciais')
      .update({
        perfil_operacional: ia.perfil,
        dor_logistica: ia.dor,
        prioridade: ia.prioridade,
        proximo_followup: item.proximo_followup || addDias(3),
        observacoes: item.observacoes
          ? item.observacoes + '\n\nAnálise IA:\n' + ia.plano
          : 'Análise IA:\n' + ia.plano,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', item.id)

    if (error) {
      alert(error.message)
      return
    }

    setAnaliseIA({
      empresa: item.empresa,
      ...ia,
    })

    await carregar()
  }

  async function atualizarStatus(item: any, status: string) {
    const proximo =
      status === 'CONTATADO'
        ? addDias(3)
        : status === 'FOLLOW-UP'
          ? addDias(7)
          : item.proximo_followup || null

    const { error } = await supabase
      .from('prospects_comerciais')
      .update({
        status,
        ultimo_contato: ['CONTATADO', 'FOLLOW-UP', 'RESPONDEU'].includes(status)
          ? hojeISO()
          : item.ultimo_contato,
        proximo_followup: proximo,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', item.id)

    if (error) {
      alert(error.message)
      return
    }

    await carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este prospect?')) return

    const { error } = await supabase.from('prospects_comerciais').delete().eq('id', id)

    if (error) {
      alert(error.message)
      return
    }

    await carregar()
  }

  function mensagemWhatsApp(item: any) {
    const nome = item.contato_nome || 'tudo bem'
    const empresa = item.empresa || 'sua empresa'
    const perfil = item.perfil_operacional || 'processos DHL, FedEx, importação e exportação'

    return `Olá, ${nome}. Me chamo Marcos, da HC Consultoria.

Vi que a ${empresa} pode ter demanda em ${perfil}. A HC apoia empresas com acompanhamento operacional, conferência de faturas DHL/FedEx, divergências de cobrança, documentos, rastreio e suporte em importação/exportação.

Também temos um portal onde o cliente acompanha processos, faturas, documentos e chamados em tempo real.

Com quem posso falar sobre logística ou comércio exterior?`
  }

  function emailProspect(item: any) {
    const empresa = item.empresa || 'sua empresa'
    const perfil = item.perfil_operacional || 'processos DHL, FedEx, importação e exportação'

    return `Assunto: Apoio em logística internacional e processos DHL/FedEx

Olá, tudo bem?

Sou Marcos, da HC Consultoria. Atuamos no acompanhamento de ${perfil}, conferência de faturas, divergências de peso/cobrança, documentos e suporte operacional.

Também disponibilizamos um portal para o cliente acompanhar processos, documentos, faturas e chamados em tempo real.

Poderia me direcionar ao responsável por logística ou comércio exterior da ${empresa}?`
  }

  async function copiar(texto: string) {
    await navigator.clipboard.writeText(texto)
    alert('Mensagem copiada.')
  }

  return (
    <main className="p-6">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-widest text-blue-400">Comercial</p>
          <h1 className="text-4xl font-black">Prospecção IA</h1>
          <p className="mt-2 text-slate-400">
            Cadastre prospects, gere abordagem e acompanhe follow-ups comerciais.
          </p>
        </div>

        <button
          onClick={carregar}
          className="rounded-2xl bg-blue-600 px-6 py-4 font-black text-white hover:bg-blue-500"
        >
          Atualizar
        </button>
      </div>

      <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-6">
        <Card titulo="Total" valor={resumo.total} detalhe="prospects" />
        <Card titulo="Quentes" valor={resumo.quente} detalhe="alta chance" cor="green" />
        <Card titulo="Follow-up" valor={resumo.followup} detalhe="retomar contato" cor="yellow" />
        <Card titulo="Respondeu" valor={resumo.respondeu} detalhe="abrir conversa" cor="blue" />
        <Card titulo="Convertidos" valor={resumo.convertido} detalhe="viraram cliente" cor="green" />
        <Card titulo="Vencidos" valor={resumo.vencidos} detalhe="follow-up atrasado" cor="red" />
      </section>

      <section className="card mb-8">
        <div className="mb-6">
          <p className="text-sm font-black uppercase tracking-widest text-emerald-400">
            {editandoId ? 'Editando prospect' : 'Novo prospect'}
          </p>
          <h2 className="text-2xl font-black">Dados comerciais</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <Campo label="Empresa" value={form.empresa} onChange={(v) => atualizarCampo('empresa', v)} />
          <Campo label="Cidade" value={form.cidade} onChange={(v) => atualizarCampo('cidade', v)} />
          <Campo label="UF" value={form.uf} onChange={(v) => atualizarCampo('uf', v)} />
          <Campo label="Segmento" value={form.segmento} onChange={(v) => atualizarCampo('segmento', v)} />

          <Campo label="Site" value={form.site} onChange={(v) => atualizarCampo('site', v)} />
          <Campo label="Nome do contato" value={form.contato_nome} onChange={(v) => atualizarCampo('contato_nome', v)} />
          <Campo label="Cargo" value={form.contato_cargo} onChange={(v) => atualizarCampo('contato_cargo', v)} />
          <Campo label="Telefone / WhatsApp" value={form.telefone} onChange={(v) => atualizarCampo('telefone', v)} />

          <Campo label="E-mail" value={form.email} onChange={(v) => atualizarCampo('email', v)} />

          <div>
            <label>Perfil operacional</label>
            <select
              value={form.perfil_operacional}
              onChange={(e) => atualizarCampo('perfil_operacional', e.target.value)}
            >
              <option value="">Selecione</option>
              {PERFIS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div>
            <label>Status</label>
            <select value={form.status} onChange={(e) => atualizarCampo('status', e.target.value)}>
              {STATUS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div>
            <label>Prioridade</label>
            <select value={form.prioridade} onChange={(e) => atualizarCampo('prioridade', e.target.value)}>
              {PRIORIDADES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <Campo label="Último contato" type="date" value={form.ultimo_contato} onChange={(v) => atualizarCampo('ultimo_contato', v)} />
          <Campo label="Próximo follow-up" type="date" value={form.proximo_followup} onChange={(v) => atualizarCampo('proximo_followup', v)} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Area label="Dor logística" value={form.dor_logistica} onChange={(v) => atualizarCampo('dor_logistica', v)} />
          <Area label="Observações" value={form.observacoes} onChange={(v) => atualizarCampo('observacoes', v)} />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={salvarProspect}
            disabled={salvando}
            className="rounded-2xl bg-emerald-600 px-6 py-4 font-black text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Cadastrar prospect'}
          </button>

          <button
            type="button"
            onClick={aplicarAnaliseNoFormulario}
            className="rounded-2xl bg-purple-700 px-6 py-4 font-black text-white hover:bg-purple-600"
          >
            🤖 Gerar análise IA
          </button>

          {editandoId ? (
            <button
              onClick={() => {
                setEditandoId(null)
                setForm(formInicial)
              }}
              className="rounded-2xl bg-slate-700 px-6 py-4 font-black text-white hover:bg-slate-600"
            >
              Cancelar edição
            </button>
          ) : null}
        </div>
      </section>

      {analiseIA ? (
        <section className="card mb-8 border-purple-700/70 bg-purple-950/20">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-purple-300">
                Análise IA comercial
              </p>
              <h2 className="text-2xl font-black">{analiseIA.empresa}</h2>
              <p className="mt-2 text-sm text-slate-300">{analiseIA.resumo}</p>
            </div>

            <button
              onClick={() => setAnaliseIA(null)}
              className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-black text-white hover:bg-slate-600"
            >
              Fechar
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-blue-900 bg-[#020817] p-4">
              <p className="text-xs font-black uppercase tracking-widest text-blue-300">Perfil sugerido</p>
              <p className="mt-2 font-black">{analiseIA.perfil}</p>
            </div>

            <div className="rounded-2xl border border-green-900 bg-[#020817] p-4">
              <p className="text-xs font-black uppercase tracking-widest text-green-300">Prioridade</p>
              <p className="mt-2 font-black">{analiseIA.prioridade}</p>
            </div>

            <div className="rounded-2xl border border-yellow-900 bg-[#020817] p-4">
              <p className="text-xs font-black uppercase tracking-widest text-yellow-300">Próxima ação</p>
              <p className="mt-2 font-black">Contato inicial + follow-up em 3 dias</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-blue-900 bg-[#020817] p-4">
            <p className="text-xs font-black uppercase tracking-widest text-yellow-300">Dor provável</p>
            <p className="mt-2 text-sm text-slate-200">{analiseIA.dor}</p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <button
              onClick={() => copiar(analiseIA.whatsapp)}
              className="rounded-2xl bg-green-700 px-5 py-4 font-black text-white hover:bg-green-600"
            >
              Copiar WhatsApp IA
            </button>

            <button
              onClick={() => copiar(analiseIA.email)}
              className="rounded-2xl bg-blue-700 px-5 py-4 font-black text-white hover:bg-blue-600"
            >
              Copiar e-mail IA
            </button>

            <button
              onClick={() => copiar(analiseIA.plano)}
              className="rounded-2xl bg-purple-700 px-5 py-4 font-black text-white hover:bg-purple-600"
            >
              Copiar plano de abordagem
            </button>
          </div>
        </section>
      ) : null}

      <section className="card mb-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-black">Pipeline comercial</h2>
            <p className="mt-1 text-sm text-slate-400">
              Controle de abordagem, follow-up e conversão.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar empresa, segmento, contato..."
            />

            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Todos os status</option>
              {STATUS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>

            <select value={filtroPrioridade} onChange={(e) => setFiltroPrioridade(e.target.value)}>
              <option value="">Todas prioridades</option>
              {PRIORIDADES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>

            <div className="rounded-xl border border-blue-900 bg-[#020817] px-4 py-3 font-black">
              {filtrados.length} prospect(s)
            </div>
          </div>
        </div>

        {carregando ? (
          <div className="rounded-2xl border border-blue-900 p-6 text-slate-400">Carregando...</div>
        ) : (
          <div className="space-y-4">
            {filtrados.map((item) => (
              <div key={item.id} className="rounded-2xl border border-blue-900 bg-[#020817] p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-black">{item.empresa}</h3>
                      <Badge>{item.status}</Badge>
                      <Badge>{item.prioridade}</Badge>
                    </div>

                    <p className="mt-2 text-sm text-slate-400">
                      {[item.segmento, item.cidade, item.uf].filter(Boolean).join(' • ') || 'Sem segmento informado'}
                    </p>

                    <p className="mt-2 text-sm">
                      <b>Contato:</b> {item.contato_nome || '-'} {item.contato_cargo ? `• ${item.contato_cargo}` : ''}
                    </p>

                    <p className="text-sm">
                      <b>E-mail:</b> {item.email || '-'} • <b>WhatsApp:</b> {item.telefone || '-'}
                    </p>

                    <p className="mt-2 text-sm text-blue-300">
                      <b>Perfil:</b> {item.perfil_operacional || '-'}
                    </p>

                    {item.dor_logistica ? (
                      <p className="mt-2 text-sm text-yellow-200">
                        <b>Dor:</b> {item.dor_logistica}
                      </p>
                    ) : null}

                    <p className="mt-2 text-xs text-slate-500">
                      Próximo follow-up: {item.proximo_followup || '-'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => analisarProspectExistente(item)} className="rounded-xl bg-purple-700 px-4 py-2 text-sm font-black text-white hover:bg-purple-600">
                      Analisar IA
                    </button>

                    <button onClick={() => copiar(mensagemWhatsApp(item))} className="rounded-xl bg-green-700 px-4 py-2 text-sm font-black text-white hover:bg-green-600">
                      WhatsApp
                    </button>

                    <button onClick={() => copiar(emailProspect(item))} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-600">
                      E-mail
                    </button>

                    <button onClick={() => atualizarStatus(item, 'CONTATADO')} className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-black text-white hover:bg-slate-600">
                      Contatado
                    </button>

                    <button onClick={() => atualizarStatus(item, 'FOLLOW-UP')} className="rounded-xl bg-yellow-700 px-4 py-2 text-sm font-black text-white hover:bg-yellow-600">
                      Follow-up
                    </button>

                    <button onClick={() => atualizarStatus(item, 'RESPONDEU')} className="rounded-xl bg-purple-700 px-4 py-2 text-sm font-black text-white hover:bg-purple-600">
                      Respondeu
                    </button>

                    <button onClick={() => atualizarStatus(item, 'CONVERTIDO')} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-600">
                      Convertido
                    </button>

                    <button onClick={() => editar(item)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-500">
                      Editar
                    </button>

                    <button onClick={() => excluir(item.id)} className="rounded-xl bg-red-700 px-4 py-2 text-sm font-black text-white hover:bg-red-600">
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {filtrados.length === 0 ? (
              <div className="rounded-2xl border border-blue-900 p-8 text-center text-slate-400">
                Nenhum prospect encontrado.
              </div>
            ) : null}
          </div>
        )}
      </section>
    </main>
  )
}

function Campo({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (valor: string) => void
  type?: string
}) {
  return (
    <div>
      <label>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function Area({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (valor: string) => void
}) {
  return (
    <div>
      <label>{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} className="min-h-[120px]" />
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-blue-900 bg-blue-600/10 px-3 py-1 text-xs font-black text-blue-300">
      {children}
    </span>
  )
}

function Card({
  titulo,
  valor,
  detalhe,
  cor = 'blue',
}: {
  titulo: string
  valor: any
  detalhe: string
  cor?: string
}) {
  const cores: any = {
    blue: 'border-blue-800 bg-blue-600/10 text-blue-300',
    green: 'border-green-800 bg-green-600/10 text-green-300',
    red: 'border-red-800 bg-red-600/10 text-red-300',
    yellow: 'border-yellow-800 bg-yellow-600/10 text-yellow-300',
  }

  return (
    <div className={`rounded-2xl border p-5 ${cores[cor] || cores.blue}`}>
      <p className="text-xs font-black uppercase tracking-widest">{titulo}</p>
      <p className="mt-3 text-3xl font-black text-white">{valor}</p>
      <p className="mt-1 text-sm opacity-80">{detalhe}</p>
    </div>
  )
}
