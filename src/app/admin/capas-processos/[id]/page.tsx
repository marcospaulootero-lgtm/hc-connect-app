'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

function texto(valor: any) {
  return String(valor || '')
}

function atualizarObjeto(obj: any, campo: string, valor: any) {
  return { ...(obj || {}), [campo]: valor }
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

  if (carregando) {
    return <main className="text-slate-400">Carregando capa...</main>
  }

  if (!capa) {
    return <main className="text-slate-400">Capa não encontrada.</main>
  }

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link href="/admin/capas-processos" className="text-sm font-bold text-blue-300 hover:text-blue-200">
            ← Voltar para capas
          </Link>

          <h1 className="mt-3 text-3xl font-black">Capa do Processo</h1>
          <p className="mt-1 text-slate-400">
            Controle operacional e financeiro da capa da Hérica.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-slate-700 px-5 py-3 font-black hover:bg-slate-600"
          >
            Imprimir capa
          </button>

          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="rounded-xl bg-blue-600 px-5 py-3 font-black hover:bg-blue-500 disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Salvar capa'}
          </button>

          <button
            type="button"
            onClick={finalizarEArquivar}
            className="rounded-xl bg-purple-700 px-5 py-3 font-black hover:bg-purple-600"
          >
            Finalizar e arquivar
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <Resumo label="AWB" valor={capa.awb} />
        <Resumo label="Cliente" valor={capa.cliente} />
        <Resumo label="Status" valor={capa.status} />
        <Resumo label="Transportadora" valor={capa.transportadora} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Bloco titulo="Dados gerais">
          <Campo label="Cliente / Importador" value={capa.cliente} onChange={(v) => setCampo('cliente', v)} />
          <Campo label="CNPJ" value={capa.dados_gerais?.cnpj} onChange={(v) => setJson('dados_gerais', 'cnpj', v)} />
          <Campo label="Exportador" value={capa.dados_gerais?.exportador} onChange={(v) => setJson('dados_gerais', 'exportador', v)} />
          <Campo label="Importador" value={capa.dados_gerais?.importador} onChange={(v) => setJson('dados_gerais', 'importador', v)} />
          <Campo label="Referência cliente" value={capa.dados_gerais?.referencia_cliente} onChange={(v) => setJson('dados_gerais', 'referencia_cliente', v)} />
          <Campo label="Referência HC" value={capa.codigo_hc} onChange={(v) => setCampo('codigo_hc', v)} />
          <Campo label="MAWB" value={capa.dados_gerais?.mawb} onChange={(v) => setJson('dados_gerais', 'mawb', v)} />
          <Campo label="HAWB / AWB" value={capa.awb} onChange={(v) => setCampo('awb', v)} />
          <Campo label="Origem" value={capa.dados_gerais?.origem} onChange={(v) => setJson('dados_gerais', 'origem', v)} />
          <Campo label="Destino" value={capa.dados_gerais?.destino} onChange={(v) => setJson('dados_gerais', 'destino', v)} />
          <Campo label="Serviço" value={capa.dados_gerais?.servico} onChange={(v) => setJson('dados_gerais', 'servico', v)} />
          <Campo label="Aeroporto liberação" value={capa.dados_gerais?.aeroporto_liberacao} onChange={(v) => setJson('dados_gerais', 'aeroporto_liberacao', v)} />
        </Bloco>

        <Bloco titulo="Carga, peso e dimensões">
          <Campo label="Incoterm" value={capa.carga?.incoterm} onChange={(v) => setJson('carga', 'incoterm', v)} />
          <Campo label="Quantidade de volumes" value={capa.carga?.volumes} onChange={(v) => setJson('carga', 'volumes', v)} />
          <Campo label="Peso bruto" value={capa.carga?.peso_bruto} onChange={(v) => setJson('carga', 'peso_bruto', v)} />
          <Campo label="Peso taxado" value={capa.carga?.peso_taxado} onChange={(v) => setJson('carga', 'peso_taxado', v)} />
          <CampoArea label="Dimensões" value={capa.carga?.dimensoes} onChange={(v) => setJson('carga', 'dimensoes', v)} />
        </Bloco>

        <Bloco titulo="Checklist operacional">
          <Check label="AWB conferido" checked={capa.checklist?.awb_conferido} onChange={(v) => setJson('checklist', 'awb_conferido', v)} />
          <Check label="Cliente vinculado" checked={capa.checklist?.cliente_vinculado} onChange={(v) => setJson('checklist', 'cliente_vinculado', v)} />
          <Check label="Documentos recebidos" checked={capa.checklist?.documentos_recebidos} onChange={(v) => setJson('checklist', 'documentos_recebidos', v)} />
          <Check label="Impostos / DUE conferidos" checked={capa.checklist?.impostos_conferidos} onChange={(v) => setJson('checklist', 'impostos_conferidos', v)} />
          <Check label="Fatura transportadora recebida" checked={capa.checklist?.fatura_transportadora_recebida} onChange={(v) => setJson('checklist', 'fatura_transportadora_recebida', v)} />
          <Check label="Custo lançado" checked={capa.checklist?.custo_lancado} onChange={(v) => setJson('checklist', 'custo_lancado', v)} />
          <Check label="Fatura cliente emitida" checked={capa.checklist?.fatura_cliente_emitida} onChange={(v) => setJson('checklist', 'fatura_cliente_emitida', v)} />
          <Check label="Pagamento confirmado" checked={capa.checklist?.pagamento_confirmado} onChange={(v) => setJson('checklist', 'pagamento_confirmado', v)} />
          <Check label="Processo finalizado" checked={capa.checklist?.processo_finalizado} onChange={(v) => setJson('checklist', 'processo_finalizado', v)} />
        </Bloco>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Bloco titulo="Despesas do processo">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Campo label="Moeda" value={capa.despesas?.moeda} onChange={(v) => setJson('despesas', 'moeda', v)} />
            <Campo label="Taxa câmbio / PTAX" value={capa.despesas?.taxa_cambio} onChange={(v) => setJson('despesas', 'taxa_cambio', v)} />
            <Campo label="Frete compra" value={capa.despesas?.frete_compra || capa.despesas?.frete} onChange={(v) => setJson('despesas', 'frete_compra', v)} />
            <Campo label="Frete venda" value={capa.despesas?.frete_venda} onChange={(v) => setJson('despesas', 'frete_venda', v)} />
            <Campo label="Seguro" value={capa.despesas?.seguro} onChange={(v) => setJson('despesas', 'seguro', v)} />
            <Campo label="Delivery Fee / DOC" value={capa.despesas?.delivery_fee} onChange={(v) => setJson('despesas', 'delivery_fee', v)} />
            <Campo label="Handling" value={capa.despesas?.handling} onChange={(v) => setJson('despesas', 'handling', v)} />
            <Campo label="DGR" value={capa.despesas?.dgr} onChange={(v) => setJson('despesas', 'dgr', v)} />
            <Campo label="Outras taxas" value={capa.despesas?.outras_taxas} onChange={(v) => setJson('despesas', 'outras_taxas', v)} />
            <Campo label="Emissão DUE" value={capa.despesas?.due} onChange={(v) => setJson('despesas', 'due', v)} />
            <Campo label="Impostos destino" value={capa.despesas?.impostos_destino} onChange={(v) => setJson('despesas', 'impostos_destino', v)} />
            <Campo label="Profit HC" value={capa.despesas?.profit_hc} onChange={(v) => setJson('despesas', 'profit_hc', v)} />
          </div>
        </Bloco>

        <Bloco titulo="Instrução e financeiro">
          <Campo label="Data da instrução" type="date" value={capa.instrucao_embarque?.data_instrucao} onChange={(v) => setJson('instrucao_embarque', 'data_instrucao', v)} />
          <Campo label="Data da coleta / pickup" type="date" value={capa.instrucao_embarque?.data_coleta} onChange={(v) => setJson('instrucao_embarque', 'data_coleta', v)} />
          <Campo label="Data saída do Brasil" type="date" value={capa.instrucao_embarque?.data_saida_brasil} onChange={(v) => setJson('instrucao_embarque', 'data_saida_brasil', v)} />
          <Campo label="Data prevista de chegada" type="date" value={capa.instrucao_embarque?.data_prevista_chegada} onChange={(v) => setJson('instrucao_embarque', 'data_prevista_chegada', v)} />
          <Campo label="Referência da coleta" value={capa.instrucao_embarque?.referencia_coleta} onChange={(v) => setJson('instrucao_embarque', 'referencia_coleta', v)} />
          <Check label="Enviado ao financeiro" checked={capa.enviado_financeiro} onChange={(v) => setCampo('enviado_financeiro', v)} />
          <Campo label="Data envio financeiro" type="date" value={capa.data_envio_financeiro} onChange={(v) => setCampo('data_envio_financeiro', v)} />
        </Bloco>
      </section>

      <Bloco titulo="Anotações operacionais">
        <textarea
          value={texto(capa.anotacoes)}
          onChange={(e) => setCampo('anotacoes', e.target.value)}
          className="min-h-[180px] w-full rounded-xl border border-blue-900 bg-[#020817] px-4 py-3 font-bold outline-none"
          placeholder="Anotações da Hérica sobre o processo..."
        />
      </Bloco>
    </main>
  )
}

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

function Resumo({ label, valor }: { label: string; valor: any }) {
  return (
    <div className="rounded-3xl border border-blue-900 bg-[#071225] p-5">
      <p className="text-xs font-black uppercase tracking-widest text-blue-300">{label}</p>
      <p className="mt-2 text-2xl font-black">{texto(valor) || '-'}</p>
    </div>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: any }) {
  return (
    <section className="rounded-3xl border border-blue-900 bg-[#071225] p-5">
      <h2 className="mb-4 text-xl font-black">{titulo}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Campo({ label, value, onChange, type = 'text' }: CampoProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-black uppercase tracking-widest text-slate-500">
        {label}
      </span>
      <input
        type={type}
        value={texto(value)}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-blue-900 bg-[#020817] px-4 py-3 font-bold outline-none"
      />
    </label>
  )
}

function CampoArea({ label, value, onChange }: CampoProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-black uppercase tracking-widest text-slate-500">
        {label}
      </span>
      <textarea
        value={texto(value)}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[110px] w-full rounded-xl border border-blue-900 bg-[#020817] px-4 py-3 font-bold outline-none"
      />
    </label>
  )
}

function Check({ label, checked, onChange }: CheckProps) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-blue-950 bg-[#020817] px-4 py-3 font-bold">
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}
