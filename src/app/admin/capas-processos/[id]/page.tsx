'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type CampoProps = {
  label: string
  value: any
  onChange: (value: string) => void
  type?: string
}

type CheckProps = {
  label: string
  checked: any
  onChange: (value: boolean) => void
}

function texto(valor: any) {
  return String(valor || '')
}

function atualizarObjeto(obj: any, campo: string, valor: any) {
  return { ...(obj || {}), [campo]: valor }
}

function tipoLabel(tipo: string) {
  if (tipo === 'EXPORTACAO_COURIER') return 'Exportação Courier'
  return 'Importação Formal'
}

export default function EditarCapaProcessoPage() {
  const params = useParams()
  const router = useRouter()
  const id = String(params?.id || '')

  const [capa, setCapa] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    carregar()
  }, [id])

  async function carregar() {
    setCarregando(true)

    const { data, error } = await supabase
      .from('capas_processos')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      alert('Erro ao carregar capa: ' + error.message)
      router.push('/admin/capas-processos')
      return
    }

    setCapa(data)
    setCarregando(false)
  }

  function setCampo(campo: string, valor: any) {
    setCapa((atual: any) => ({ ...atual, [campo]: valor }))
  }

  function setJson(bloco: string, campo: string, valor: any) {
    setCapa((atual: any) => ({
      ...atual,
      [bloco]: atualizarObjeto(atual?.[bloco], campo, valor),
    }))
  }

  async function salvar() {
    setSalvando(true)

    const { error } = await supabase
      .from('capas_processos')
      .update({
        tipo: capa.tipo,
        codigo_hc: capa.codigo_hc || null,
        awb: capa.awb || null,
        cliente: capa.cliente || null,
        transportadora: capa.transportadora || null,
        status: capa.status || 'EM_ANDAMENTO',
        dados_gerais: capa.dados_gerais || {},
        carga: capa.carga || {},
        despesas: capa.despesas || {},
        instrucao_embarque: capa.instrucao_embarque || {},
        checklist: capa.checklist || {},
        anotacoes: capa.anotacoes || '',
        enviado_financeiro: Boolean(capa.enviado_financeiro),
        data_envio_financeiro: capa.data_envio_financeiro || null,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', id)

    setSalvando(false)

    if (error) {
      alert('Erro ao salvar capa: ' + error.message)
      return
    }

    alert('Capa salva com sucesso.')
    await carregar()
  }

  async function finalizarEArquivar() {
    const ok = window.confirm('Finalizar e arquivar esta capa?')
    if (!ok) return

    const { error } = await supabase
      .from('capas_processos')
      .update({
        status: 'FINALIZADO',
        finalizada: true,
        arquivada: true,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      alert('Erro ao finalizar capa: ' + error.message)
      return
    }

    router.push('/admin/capas-processos')
  }

  async function apagarCapa() {
    const ok = window.confirm('Tem certeza que deseja apagar esta capa? Esta ação não pode ser desfeita.')
    if (!ok) return

    const { error } = await supabase
      .from('capas_processos')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erro ao apagar capa: ' + error.message)
      return
    }

    router.push('/admin/capas-processos')
  }

  if (carregando) {
    return <main className="text-slate-400">Carregando capa...</main>
  }

  if (!capa) {
    return <main className="text-slate-400">Capa não encontrada.</main>
  }

  const dados = capa.dados_gerais || {}
  const carga = capa.carga || {}
  const despesas = capa.despesas || {}
  const instrucao = capa.instrucao_embarque || {}
  const checklist = capa.checklist || {}

  return (
    <main className="space-y-6 pb-10">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <Link href="/admin/capas-processos" className="text-sm font-bold text-blue-300 hover:text-blue-200">
            ← Voltar para capas
          </Link>

          <h1 className="mt-3 text-4xl font-black">Capa do Processo</h1>
          <p className="mt-1 text-lg text-slate-400">Controle operacional do embarque</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl border border-blue-800 bg-[#071225] px-5 py-3 font-black hover:bg-blue-950"
          >
            🖨️ Imprimir capa
          </button>

          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="rounded-xl border border-blue-800 bg-[#071225] px-5 py-3 font-black hover:bg-blue-950 disabled:opacity-50"
          >
            ✏️ {salvando ? 'Salvando...' : 'Salvar anotações'}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-blue-600 px-5 py-3 font-black hover:bg-blue-500"
          >
            📄 Gerar PDF
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <CardResumo icone="📄" label="AWB" valor={capa.awb} />
        <CardResumo icone="👤" label="Cliente" valor={capa.cliente} />
        <CardResumo icone="🚚" label="Status" valor={capa.status || 'EM_ANDAMENTO'} destaque="verde" />
        <CardResumo icone="🏢" label="Transportadora" valor={capa.transportadora} />
      </section>

      <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[1.45fr_0.8fr_1fr]">
        <Painel numero="1" titulo="Dados do embarque" className="2xl:col-span-1">
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
            <Campo label="Cliente" value={capa.cliente} onChange={(v) => setCampo('cliente', v)} />
            <Campo label="Serviço" value={dados.servico || dados.servico_porta_porta} onChange={(v) => setJson('dados_gerais', 'servico', v)} />

            <Campo label="Exportador" value={dados.exportador} onChange={(v) => setJson('dados_gerais', 'exportador', v)} />
            <Campo label="Incoterm" value={carga.incoterm || despesas.incoterm} onChange={(v) => setJson('carga', 'incoterm', v)} />

            <Campo label="Importador" value={dados.importador} onChange={(v) => setJson('dados_gerais', 'importador', v)} />
            <Campo label="Dimensões" value={carga.dimensoes} onChange={(v) => setJson('carga', 'dimensoes', v)} />

            <Campo label="AWB" value={capa.awb} onChange={(v) => setCampo('awb', v)} />
            <Campo label="Peso bruto" value={carga.peso_bruto} onChange={(v) => setJson('carga', 'peso_bruto', v)} />

            <Campo label="MAWB / Master" value={dados.mawb} onChange={(v) => setJson('dados_gerais', 'mawb', v)} />
            <Campo label="Peso taxado" value={carga.peso_taxado} onChange={(v) => setJson('carga', 'peso_taxado', v)} />

            <Campo label="Referência HC" value={capa.codigo_hc} onChange={(v) => setCampo('codigo_hc', v)} />
            <Campo label="Volumes" value={carga.volumes} onChange={(v) => setJson('carga', 'volumes', v)} />

            <Campo label="Referência cliente" value={dados.referencia_cliente} onChange={(v) => setJson('dados_gerais', 'referencia_cliente', v)} />
            <Campo label="Data de coleta" type="date" value={instrucao.data_coleta} onChange={(v) => setJson('instrucao_embarque', 'data_coleta', v)} />

            <Campo label="Origem" value={dados.origem || dados.pais_origem} onChange={(v) => setJson('dados_gerais', 'origem', v)} />
            <Campo label="Previsão de entrega" type="date" value={instrucao.data_prevista_chegada} onChange={(v) => setJson('instrucao_embarque', 'data_prevista_chegada', v)} />

            <Campo label="Destino" value={dados.destino || dados.destino_final} onChange={(v) => setJson('dados_gerais', 'destino', v)} />
            <Campo label="Responsável HC" value={dados.responsavel_hc} onChange={(v) => setJson('dados_gerais', 'responsavel_hc', v)} />
          </div>
        </Painel>

        <Painel numero="2" titulo="Controle operacional">
          <div className="space-y-3">
            <Check label="AWB conferido" checked={checklist.awb_conferido} onChange={(v) => setJson('checklist', 'awb_conferido', v)} />
            <Check label="Cliente vinculado" checked={checklist.cliente_vinculado} onChange={(v) => setJson('checklist', 'cliente_vinculado', v)} />
            <Check label="Documentos recebidos" checked={checklist.documentos_recebidos} onChange={(v) => setJson('checklist', 'documentos_recebidos', v)} />
            <Check label="DUE / impostos conferidos" checked={checklist.impostos_conferidos} onChange={(v) => setJson('checklist', 'impostos_conferidos', v)} />
            <Check label="Fatura transportadora recebida" checked={checklist.fatura_transportadora_recebida} onChange={(v) => setJson('checklist', 'fatura_transportadora_recebida', v)} />
            <Check label="Custo lançado" checked={checklist.custo_lancado} onChange={(v) => setJson('checklist', 'custo_lancado', v)} />
            <Check label="Fatura cliente emitida" checked={checklist.fatura_cliente_emitida} onChange={(v) => setJson('checklist', 'fatura_cliente_emitida', v)} />
            <Check label="Pagamento confirmado" checked={checklist.pagamento_confirmado} onChange={(v) => setJson('checklist', 'pagamento_confirmado', v)} />
            <Check label="Processo finalizado" checked={checklist.processo_finalizado} onChange={(v) => setJson('checklist', 'processo_finalizado', v)} />
          </div>
        </Painel>

        <Painel numero="3" titulo="Anotações operacionais">
          <textarea
            value={texto(capa.anotacoes)}
            onChange={(e) => setCampo('anotacoes', e.target.value)}
            placeholder="Cliente solicitou prioridade. Conferir peso taxado na chegada..."
            className="min-h-[310px] w-full resize-none rounded-2xl border border-blue-900 bg-[#020817] p-4 font-mono text-sm font-bold text-white outline-none"
          />
          <p className="mt-3 text-right text-xs font-bold text-slate-500">
            Salvo ao clicar em Salvar anotações
          </p>
        </Painel>
      </section>

      <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[1fr_1.6fr]">
        <Painel numero="4" titulo="Linha do processo">
          <div className="flex items-center justify-between gap-2 pt-4">
            <Etapa label="Aguardando coleta" ativo={capa.status === 'AGUARDANDO_COLETA'} icone="🕘" />
            <Linha />
            <Etapa label="Coletado" ativo={capa.status === 'COLETADO'} icone="📦" />
            <Linha />
            <Etapa label="Em trânsito" ativo={String(capa.status || '').includes('TRANSITO') || String(capa.status || '').includes('TRÂNSITO')} icone="🚚" />
            <Linha />
            <Etapa label="Fiscalização" ativo={String(capa.status || '').includes('FISCAL')} icone="📋" />
            <Linha />
            <Etapa label="Liberado" ativo={String(capa.status || '').includes('LIBERADO')} icone="✅" />
            <Linha />
            <Etapa label="Entregue" ativo={String(capa.status || '').includes('ENTREGUE')} icone="🏁" />
          </div>
        </Painel>

        <Painel numero="5" titulo="Documentos e financeiro">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <MiniCard titulo="Documentos recebidos" valor={checklist.documentos_recebidos ? 'Sim' : 'Pendente'} detalhe="Visualizar" cor="azul" />
            <MiniCard titulo="Fatura transportadora" valor={checklist.fatura_transportadora_recebida ? 'Recebida' : 'Pendente'} detalhe="Visualizar" cor="verde" />
            <MiniCard titulo="Fatura cliente" valor={checklist.fatura_cliente_emitida ? 'Emitida' : 'Pendente'} detalhe="Visualizar" cor="amarelo" />
            <MiniCard titulo="Pagamento" valor={checklist.pagamento_confirmado ? 'Confirmado' : 'Em aberto'} detalhe="Visualizar" cor="vermelho" />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
            <Campo label="Frete compra" value={despesas.frete_compra || despesas.frete} onChange={(v) => setJson('despesas', 'frete_compra', v)} />
            <Campo label="Frete venda" value={despesas.frete_venda} onChange={(v) => setJson('despesas', 'frete_venda', v)} />
            <Campo label="Seguro" value={despesas.seguro} onChange={(v) => setJson('despesas', 'seguro', v)} />
            <Campo label="Profit HC" value={despesas.profit_hc} onChange={(v) => setJson('despesas', 'profit_hc', v)} />
          </div>
        </Painel>
      </section>

      <section className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="rounded-xl bg-blue-600 px-6 py-4 font-black hover:bg-blue-500 disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : 'Salvar capa'}
        </button>

        <button
          type="button"
          onClick={finalizarEArquivar}
          className="rounded-xl bg-purple-700 px-6 py-4 font-black hover:bg-purple-600"
        >
          Finalizar e arquivar
        </button>

        <button
          type="button"
          onClick={apagarCapa}
          className="rounded-xl bg-red-700 px-6 py-4 font-black hover:bg-red-600"
        >
          Apagar capa
        </button>
      </section>
    </main>
  )
}

function CardResumo({ icone, label, valor, destaque }: { icone: string; label: string; valor: any; destaque?: string }) {
  return (
    <div className="flex min-h-[120px] items-center gap-5 rounded-3xl border border-blue-900 bg-[#071225] p-5 shadow-xl">
      <div className={`flex h-16 w-16 items-center justify-center rounded-full text-3xl ${destaque === 'verde' ? 'bg-green-600/20' : 'bg-blue-600/20'}`}>
        {icone}
      </div>
      <div>
        <p className="text-sm font-bold text-slate-400">{label}</p>
        <p className={`mt-1 text-2xl font-black ${destaque === 'verde' ? 'text-green-400' : 'text-white'}`}>
          {texto(valor) || '-'}
        </p>
      </div>
    </div>
  )
}

function Painel({ numero, titulo, children, className = '' }: { numero: string; titulo: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-blue-900 bg-[#071225] p-5 shadow-xl ${className}`}>
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-black">
          {numero}
        </span>
        <h2 className="text-xl font-black">{titulo}</h2>
      </div>
      {children}
    </section>
  )
}

function Campo({ label, value, onChange, type = 'text' }: CampoProps) {
  return (
    <label className="block border-b border-blue-950 pb-2">
      <span className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <input
        type={type}
        value={texto(value)}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-sm font-black text-white outline-none placeholder:text-slate-600"
      />
    </label>
  )
}

function Check({ label, checked, onChange }: CheckProps) {
  return (
    <label className="flex items-center gap-3 border-b border-blue-950 pb-2 text-sm font-bold">
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5"
      />
      <span>{label}</span>
    </label>
  )
}

function Etapa({ label, ativo, icone }: { label: string; ativo: boolean; icone: string }) {
  return (
    <div className="flex min-w-[86px] flex-col items-center gap-2 text-center">
      <div className={`flex h-14 w-14 items-center justify-center rounded-full border text-2xl ${
        ativo ? 'border-blue-400 bg-blue-600 shadow-lg shadow-blue-900/40' : 'border-slate-600 bg-slate-800'
      }`}>
        {icone}
      </div>
      <p className={`text-xs font-black ${ativo ? 'text-blue-300' : 'text-slate-400'}`}>{label}</p>
    </div>
  )
}

function Linha() {
  return <div className="h-[2px] flex-1 bg-slate-700" />
}

function MiniCard({ titulo, valor, detalhe, cor }: { titulo: string; valor: string; detalhe: string; cor: string }) {
  const cores: Record<string, string> = {
    azul: 'border-blue-700 text-blue-300',
    verde: 'border-green-700 text-green-300',
    amarelo: 'border-yellow-700 text-yellow-300',
    vermelho: 'border-red-700 text-red-300',
  }

  return (
    <div className={`rounded-2xl border bg-[#020817] p-4 ${cores[cor] || cores.azul}`}>
      <p className="text-sm font-black text-white">{titulo}</p>
      <p className="mt-5 text-2xl font-black">{valor}</p>
      <p className="mt-4 text-sm font-bold opacity-80">{detalhe} ›</p>
    </div>
  )
}
