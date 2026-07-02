'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
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

  const carga = capa.carga || {}
  const despesas = capa.despesas || {}
  const dados = capa.dados_gerais || {}
  const instrucao = capa.instrucao_embarque || {}

  return (
    <main className="space-y-5 pb-8">
      <header className="flex flex-col gap-4 border-b border-blue-950 pb-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <Link href="/admin/capas-processos" className="text-sm font-bold text-blue-300 hover:text-blue-200">
            ← Voltar para capas
          </Link>

          <h1 className="mt-3 text-3xl font-black">Capa do Processo</h1>
          <p className="mt-1 text-slate-400">
            Digitalize, organize e acompanhe todos os dados operacionais do processo.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => router.push('/admin/capas-processos')}
            className="rounded-xl bg-blue-600 px-5 py-3 font-black hover:bg-blue-500"
          >
            + Novo Processo
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl border border-blue-700 bg-[#071225] px-5 py-3 font-black text-blue-200 hover:bg-blue-950"
          >
            🖨️ Visualizar / Imprimir Capa
          </button>

          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="rounded-xl bg-green-700 px-5 py-3 font-black hover:bg-green-600 disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </header>

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setCampo('tipo', 'IMPORTACAO_FORMAL')}
            className={`rounded-xl px-5 py-3 font-black ${
              capa.tipo !== 'EXPORTACAO_COURIER'
                ? 'border-b-2 border-blue-400 bg-blue-600/20 text-blue-200'
                : 'bg-[#071225] text-slate-400'
            }`}
          >
            Importação Formal
          </button>

          <button
            type="button"
            onClick={() => setCampo('tipo', 'EXPORTACAO_COURIER')}
            className={`rounded-xl px-5 py-3 font-black ${
              capa.tipo === 'EXPORTACAO_COURIER'
                ? 'border-b-2 border-blue-400 bg-blue-600/20 text-blue-200'
                : 'bg-[#071225] text-slate-400'
            }`}
          >
            Exportação Courier
          </button>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={finalizarEArquivar}
            className="rounded-xl bg-purple-700 px-4 py-3 text-sm font-black hover:bg-purple-600"
          >
            Finalizar e arquivar
          </button>

          <button
            type="button"
            onClick={apagarCapa}
            className="rounded-xl bg-red-700 px-4 py-3 text-sm font-black hover:bg-red-600"
          >
            Apagar capa
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[1fr_430px]">
        <div className="space-y-4">
          <Painel titulo="Dados gerais">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Campo label="Cliente / Importador" value={capa.cliente} onChange={(v) => setCampo('cliente', v)} />
              <Campo label="CNPJ" value={dados.cnpj} onChange={(v) => setJson('dados_gerais', 'cnpj', v)} />
              <Campo label="MAWB" value={dados.mawb} onChange={(v) => setJson('dados_gerais', 'mawb', v)} />
              <Campo label="Transportadora" value={capa.transportadora} onChange={(v) => setCampo('transportadora', v)} />

              <Campo label="Exportador" value={dados.exportador} onChange={(v) => setJson('dados_gerais', 'exportador', v)} />
              <Campo label="Referência do importador/exportador" value={dados.referencia_cliente} onChange={(v) => setJson('dados_gerais', 'referencia_cliente', v)} />
              <Campo label="Fatura original" value={dados.fatura_original || ''} onChange={(v) => setJson('dados_gerais', 'fatura_original', v)} />
              <Campo label="País de origem" value={dados.pais_origem} onChange={(v) => setJson('dados_gerais', 'pais_origem', v)} />

              <Campo label="Referência da HC" value={capa.codigo_hc} onChange={(v) => setCampo('codigo_hc', v)} />
              <Campo label="HAWB / AWB" value={capa.awb} onChange={(v) => setCampo('awb', v)} />
              <Campo label="Serviço porta x porta" value={dados.servico_porta_porta || dados.servico} onChange={(v) => setJson('dados_gerais', 'servico_porta_porta', v)} />
              <Campo label="Aeroporto de liberação" value={dados.aeroporto_liberacao} onChange={(v) => setJson('dados_gerais', 'aeroporto_liberacao', v)} />

              <Campo label="Processo com DTA?" value={dados.processo_dta} onChange={(v) => setJson('dados_gerais', 'processo_dta', v)} />
              <Campo label="Destino final da remessa" value={dados.destino || dados.destino_final} onChange={(v) => setJson('dados_gerais', 'destino', v)} />
              <Campo label="Porta x aeroporto" value={dados.porta_aeroporto} onChange={(v) => setJson('dados_gerais', 'porta_aeroporto', v)} />
              <Campo label="Status do processo" value={capa.status} onChange={(v) => setCampo('status', v)} />
            </div>
          </Painel>

          <Painel titulo="Carga">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Campo label="Quantidade de volumes" value={carga.volumes} onChange={(v) => setJson('carga', 'volumes', v)} />
              <Campo label="Peso bruto total (kg)" value={carga.peso_bruto} onChange={(v) => setJson('carga', 'peso_bruto', v)} />
              <Campo label="Peso taxado total (kg)" value={carga.peso_taxado} onChange={(v) => setJson('carga', 'peso_taxado', v)} />
              <Campo label="Dimensões (cm)" value={carga.dimensoes} onChange={(v) => setJson('carga', 'dimensoes', v)} />
            </div>
          </Painel>

          <Painel titulo="Despesas do processo">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Campo label="Frete compra" value={despesas.frete_compra || despesas.frete} onChange={(v) => setJson('despesas', 'frete_compra', v)} />
              <Campo label="Frete venda" value={despesas.frete_venda} onChange={(v) => setJson('despesas', 'frete_venda', v)} />
              <Campo label="Seguro" value={despesas.seguro} onChange={(v) => setJson('despesas', 'seguro', v)} />
              <Campo label="Handling" value={despesas.handling} onChange={(v) => setJson('despesas', 'handling', v)} />

              <Campo label="DGR" value={despesas.dgr} onChange={(v) => setJson('despesas', 'dgr', v)} />
              <Campo label="Delivery Fee / DOC" value={despesas.delivery_fee} onChange={(v) => setJson('despesas', 'delivery_fee', v)} />
              <Campo label="Outras taxas" value={despesas.outras_taxas} onChange={(v) => setJson('despesas', 'outras_taxas', v)} />
              <Campo label="Emissão DUE" value={despesas.due} onChange={(v) => setJson('despesas', 'due', v)} />

              <Campo label="Impostos destino" value={despesas.impostos_destino} onChange={(v) => setJson('despesas', 'impostos_destino', v)} />
              <Campo label="Incoterm" value={carga.incoterm || despesas.incoterm} onChange={(v) => setJson('carga', 'incoterm', v)} />
              <Campo label="Profit HC" value={despesas.profit_hc} onChange={(v) => setJson('despesas', 'profit_hc', v)} />
              <Campo label="Moeda" value={despesas.moeda || 'USD'} onChange={(v) => setJson('despesas', 'moeda', v)} />
            </div>
          </Painel>

          <Painel titulo="Instrução de embarque">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Campo label="Data da instrução" type="date" value={instrucao.data_instrucao} onChange={(v) => setJson('instrucao_embarque', 'data_instrucao', v)} />
              <Campo label="Data da coleta / pick up" type="date" value={instrucao.data_coleta} onChange={(v) => setJson('instrucao_embarque', 'data_coleta', v)} />
              <Campo label="Data saída do Brasil" type="date" value={instrucao.data_saida_brasil} onChange={(v) => setJson('instrucao_embarque', 'data_saida_brasil', v)} />
              <Campo label="Data prevista de chegada" type="date" value={instrucao.data_prevista_chegada} onChange={(v) => setJson('instrucao_embarque', 'data_prevista_chegada', v)} />

              <Campo label="Data chegada efetiva no aeroporto" type="date" value={instrucao.data_chegada_aeroporto} onChange={(v) => setJson('instrucao_embarque', 'data_chegada_aeroporto', v)} />
              <Campo label="Referência coleta" value={instrucao.referencia_coleta} onChange={(v) => setJson('instrucao_embarque', 'referencia_coleta', v)} />
              <Campo label="Follow up do processo" value={instrucao.follow_up} onChange={(v) => setJson('instrucao_embarque', 'follow_up', v)} />
              <Campo label="Data embarque" type="date" value={instrucao.data_embarque} onChange={(v) => setJson('instrucao_embarque', 'data_embarque', v)} />
            </div>
          </Painel>

          <Painel titulo="Enviado ao financeiro">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Check label="Enviado ao financeiro?" checked={capa.enviado_financeiro} onChange={(v) => setCampo('enviado_financeiro', v)} />
              <Campo label="Data" type="date" value={capa.data_envio_financeiro} onChange={(v) => setCampo('data_envio_financeiro', v)} />
              <Campo label="Status do processo" value={capa.status} onChange={(v) => setCampo('status', v)} />
            </div>
          </Painel>
        </div>

        <aside className="space-y-4">
          <Painel titulo="Resumo do processo">
            <div className="space-y-3">
              <LinhaResumo label="Tipo" valor={tipoLabel(capa.tipo)} />
              <LinhaResumo label="Código HC" valor={capa.codigo_hc} />
              <LinhaResumo label="Cliente / Importador" valor={capa.cliente} />
              <LinhaResumo label="Transportadora" valor={capa.transportadora} />
              <LinhaResumo label="Origem" valor={dados.pais_origem || dados.origem} />
              <LinhaResumo label="Destino" valor={dados.destino || dados.destino_final} />
              <hr className="border-blue-950" />
              <LinhaResumo label="Quantidade de volumes" valor={carga.volumes} />
              <LinhaResumo label="Peso bruto (kg)" valor={carga.peso_bruto} />
              <LinhaResumo label="Peso taxado (kg)" valor={carga.peso_taxado} />
              <LinhaResumo label="Dimensões (cm)" valor={carga.dimensoes} />
              <LinhaResumo label="Incoterm" valor={carga.incoterm || despesas.incoterm} />
              <LinhaResumo label="Frete" valor={despesas.frete_compra || despesas.frete} />
              <LinhaResumo label="Seguro" valor={despesas.seguro} />
              <LinhaResumo label="Outras taxas" valor={despesas.outras_taxas} />
              <LinhaResumo label="Profit HC" valor={despesas.profit_hc} />
              <LinhaResumo label="Follow up" valor={instrucao.follow_up} />
            </div>
          </Painel>

          <Painel titulo="Documentos">
            <div className="rounded-2xl border border-dashed border-blue-700 bg-[#020817] p-5 text-center">
              <p className="text-lg font-black text-blue-300">+ Anexar documento</p>
              <p className="mt-1 text-sm text-slate-400">Arraste e solte ou selecione</p>
            </div>

            <div className="rounded-2xl border border-blue-950 bg-[#020817] p-4">
              <p className="font-black">Fatura Original.pdf</p>
              <p className="text-sm text-slate-400">PDF • exemplo visual</p>
            </div>
          </Painel>

          <Painel titulo="Anotações">
            <textarea
              value={texto(capa.anotacoes)}
              onChange={(e) => setCampo('anotacoes', e.target.value)}
              placeholder="Anotações da Hérica sobre o processo..."
              className="min-h-[170px] w-full rounded-xl border border-blue-900 bg-[#020817] px-4 py-3 font-bold outline-none"
            />
          </Painel>
        </aside>
      </section>
    </main>
  )
}

function Painel({ titulo, children }: { titulo: string; children: any }) {
  return (
    <section className="rounded-2xl border border-blue-900 bg-[#071225] p-5 shadow-xl">
      <h2 className="mb-4 text-sm font-black uppercase tracking-wide text-white">{titulo}</h2>
      {children}
    </section>
  )
}

function Campo({ label, value, onChange, type = 'text' }: CampoProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-black uppercase tracking-widest text-slate-400">
        {label}
      </span>
      <input
        type={type}
        value={texto(value)}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-blue-900 bg-[#020817] px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-blue-500"
      />
    </label>
  )
}

function Check({ label, checked, onChange }: CheckProps) {
  return (
    <label className="flex h-full items-center gap-3 rounded-lg border border-blue-900 bg-[#020817] px-3 py-2.5 text-sm font-bold">
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

function LinhaResumo({ label, valor }: { label: string; valor: any }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="font-bold uppercase text-slate-400">{label}</span>
      <span className="max-w-[210px] text-right font-black text-white">{texto(valor) || '-'}</span>
    </div>
  )
}
