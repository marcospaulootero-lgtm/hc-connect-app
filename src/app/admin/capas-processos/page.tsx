'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const TIPOS = [
  { value: 'IMPORTACAO_FORMAL', label: 'Importação Formal' },
  { value: 'EXPORTACAO_COURIER', label: 'Exportação Courier' },
]

function texto(valor: any) {
  return String(valor || '').trim()
}

function labelTipo(tipo: string) {
  return TIPOS.find((item) => item.value === tipo)?.label || tipo || '-'
}

function formatarData(valor: any) {
  if (!valor) return '-'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return '-'
  return data.toLocaleString('pt-BR')
}

export default function CapasProcessosPage() {
  const [capas, setCapas] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const [aba, setAba] = useState<'ATIVAS' | 'ARQUIVADAS'>('ATIVAS')
  const [busca, setBusca] = useState('')
  const [tipoNova, setTipoNova] = useState('IMPORTACAO_FORMAL')
  const [awbNova, setAwbNova] = useState('')

  useEffect(() => {
    carregarCapas()
  }, [])

  async function carregarCapas() {
    setCarregando(true)

    const { data, error } = await supabase
      .from('capas_processos')
      .select('*')
      .order('atualizado_em', { ascending: false })

    if (error) {
      alert('Erro ao carregar capas: ' + error.message)
      setCarregando(false)
      return
    }

    setCapas(data || [])
    setCarregando(false)
  }

  const capasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return capas.filter((capa) => {
      const arquivada = Boolean(capa.arquivada)

      if (aba === 'ATIVAS' && arquivada) return false
      if (aba === 'ARQUIVADAS' && !arquivada) return false

      if (!termo) return true

      const base = [
        capa.codigo_hc,
        capa.awb,
        capa.cliente,
        capa.transportadora,
        capa.status,
        capa.tipo,
        capa.dados_gerais?.referencia_cliente,
        capa.dados_gerais?.referencia_hc,
        capa.dados_gerais?.exportador,
        capa.dados_gerais?.importador,
      ]
        .join(' ')
        .toLowerCase()

      return base.includes(termo)
    })
  }, [capas, aba, busca])

  async function criarCapa() {
    const awb = awbNova.trim()

    if (!awb) {
      alert('Informe o AWB para criar a capa.')
      return
    }

    setSalvando(true)

    const { data: capaExistente } = await supabase
      .from('capas_processos')
      .select('id, awb')
      .eq('awb', awb)
      .limit(1)
      .maybeSingle()

    if (capaExistente) {
      setSalvando(false)
      alert('Já existe uma capa criada para este AWB.')
      return
    }

    const { data: embarque } = await supabase
      .from('embarques')
      .select('*')
      .eq('awb', awb)
      .limit(1)
      .maybeSingle()

    const criarMesmoAssim = embarque
      ? true
      : window.confirm('AWB não encontrado em embarques. Deseja criar a capa mesmo assim?')

    if (!criarMesmoAssim) {
      setSalvando(false)
      return
    }

    const carga = {
      incoterm: '',
      volumes: embarque?.volumes || '',
      dimensoes: embarque?.dimensoes || '',
      peso_bruto: embarque?.peso_real || '',
      peso_taxado: embarque?.peso_taxado || '',
    }

    const dadosGerais = {
      cliente: embarque?.cliente_final || embarque?.importador || '',
      exportador: embarque?.exportador || '',
      importador: embarque?.importador || '',
      referencia_cliente: embarque?.referencia_cliente || '',
      referencia_hc: embarque?.referencia_hc || '',
      origem: embarque?.origem || '',
      destino: embarque?.destino || '',
      servico: embarque?.servico || '',
      status_operacional: embarque?.status_operacional || '',
      data_prevista: embarque?.data_prevista || '',
      observacoes_embarque: embarque?.observacoes || '',
    }

    const despesas = {
      frete_compra: '',
      frete_venda: '',
      frete: '',
      seguro: '',
      handling: '',
      due: '',
      delivery_fee: '',
      dgr: '',
      outras_taxas: '',
      impostos_destino: '',
      profit_hc: '',
      moeda: 'USD',
      taxa_cambio: '',
      total_custo: '',
      total_venda: '',
    }

    const checklist = {
      awb_conferido: false,
      cliente_vinculado: Boolean(embarque?.id),
      documentos_recebidos: false,
      impostos_conferidos: false,
      fatura_transportadora_recebida: false,
      custo_lancado: false,
      fatura_cliente_emitida: false,
      pagamento_confirmado: false,
      processo_finalizado: false,
    }

    const { error } = await supabase.from('capas_processos').insert({
      embarque_id: embarque?.id || null,
      tipo: tipoNova,
      codigo_hc: embarque?.referencia_hc || null,
      awb,
      cliente: dadosGerais.cliente || null,
      transportadora: embarque?.transportadora || null,
      status: 'EM_ANDAMENTO',
      arquivada: false,
      finalizada: false,
      dados_gerais: dadosGerais,
      carga,
      despesas,
      checklist,
      anotacoes: '',
    })

    setSalvando(false)

    if (error) {
      alert('Erro ao criar capa: ' + error.message)
      return
    }

    setAwbNova('')
    setAba('ATIVAS')
    await carregarCapas()
  }

  async function alterarArquivamento(capa: any, arquivar: boolean) {
    const { error } = await supabase
      .from('capas_processos')
      .update({
        arquivada: arquivar,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', capa.id)

    if (error) {
      alert('Erro ao atualizar capa: ' + error.message)
      return
    }

    await carregarCapas()
  }

  async function finalizarEArquivar(capa: any) {
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
      .eq('id', capa.id)

    if (error) {
      alert('Erro ao finalizar capa: ' + error.message)
      return
    }

    await carregarCapas()
  }

  async function apagarCapa(capa: any) {
    const ok = window.confirm('Tem certeza que deseja apagar esta capa? Esta ação não pode ser desfeita.')
    if (!ok) return

    const { error } = await supabase
      .from('capas_processos')
      .delete()
      .eq('id', capa.id)

    if (error) {
      alert('Erro ao apagar capa: ' + error.message)
      return
    }

    await carregarCapas()
  }

  return (
    <main className="space-y-8">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-black">Capas de Processo</h1>
          <p className="text-slate-400 mt-2">
            Lista das capas criadas. Abra uma capa para ver o modelo completo.
          </p>
        </div>

        <div className="rounded-3xl border border-blue-900 bg-[#071225] p-4">
          <div className="grid grid-cols-1 md:grid-cols-[220px_260px_160px] gap-3">
            <select
              value={tipoNova}
              onChange={(e) => setTipoNova(e.target.value)}
              className="rounded-xl border border-blue-900 bg-[#020817] px-4 py-3 font-bold"
            >
              {TIPOS.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </option>
              ))}
            </select>

            <input
              value={awbNova}
              onChange={(e) => setAwbNova(e.target.value)}
              placeholder="AWB para criar capa"
              className="rounded-xl border border-blue-900 bg-[#020817] px-4 py-3 font-bold"
            />

            <button
              type="button"
              onClick={criarCapa}
              disabled={salvando}
              className="rounded-xl bg-blue-600 px-5 py-3 font-black hover:bg-blue-500 disabled:opacity-50"
            >
              {salvando ? 'Criando...' : '+ Criar capa'}
            </button>
          </div>
        </div>
      </header>

      <section className="rounded-3xl border border-blue-900 bg-[#071225] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setAba('ATIVAS')}
              className={`rounded-xl px-5 py-3 font-black ${
                aba === 'ATIVAS' ? 'bg-blue-600' : 'bg-[#020817] border border-blue-900'
              }`}
            >
              Capas ativas
            </button>

            <button
              type="button"
              onClick={() => setAba('ARQUIVADAS')}
              className={`rounded-xl px-5 py-3 font-black ${
                aba === 'ARQUIVADAS' ? 'bg-blue-600' : 'bg-[#020817] border border-blue-900'
              }`}
            >
              Capas arquivadas
            </button>
          </div>

          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por AWB, cliente, referência HC..."
            className="w-full xl:w-[420px] rounded-xl border border-blue-900 bg-[#020817] px-4 py-3 font-bold"
          />
        </div>

        <div className="mt-4 text-sm font-bold text-slate-400">
          {capasFiltradas.length} capa(s) encontrada(s)
        </div>
      </section>

      <section className="rounded-3xl border border-blue-900 bg-[#071225] overflow-hidden">
        <div className="grid grid-cols-[1.1fr_1.4fr_1.1fr_1fr_1fr_1fr_1.2fr_220px] gap-3 border-b border-blue-900 bg-[#020817] px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-400">
          <span>Tipo</span>
          <span>Cliente</span>
          <span>AWB</span>
          <span>Ref. HC</span>
          <span>Transportadora</span>
          <span>Status</span>
          <span>Atualização</span>
          <span>Ações</span>
        </div>

        {carregando ? (
          <div className="p-6 text-slate-400">Carregando capas...</div>
        ) : capasFiltradas.length === 0 ? (
          <div className="p-6 text-slate-400">Nenhuma capa encontrada.</div>
        ) : (
          <div className="divide-y divide-blue-950">
            {capasFiltradas.map((capa) => (
              <div
                key={capa.id}
                className="grid grid-cols-[1.1fr_1.4fr_1.1fr_1fr_1fr_1fr_1.2fr_220px] gap-3 px-5 py-4 text-sm hover:bg-blue-950/30"
              >
                <div>
                  <p className="font-black text-white">{labelTipo(capa.tipo)}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {capa.finalizada ? 'Finalizada' : capa.arquivada ? 'Arquivada' : 'Ativa'}
                  </p>
                </div>

                <div>
                  <p className="font-black text-white">{texto(capa.cliente) || '-'}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {texto(capa.dados_gerais?.exportador) || texto(capa.dados_gerais?.importador) || '-'}
                  </p>
                </div>

                <div className="font-black text-white">{texto(capa.awb) || '-'}</div>
                <div className="font-black text-white">{texto(capa.codigo_hc) || '-'}</div>
                <div className="font-black text-white">{texto(capa.transportadora) || '-'}</div>

                <div>
                  <span className="rounded-full bg-blue-600/20 px-3 py-1 text-xs font-black text-blue-200">
                    {texto(capa.status) || 'EM_ANDAMENTO'}
                  </span>
                </div>

                <div className="text-slate-400">{formatarData(capa.atualizado_em)}</div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/capas-processos/${capa.id}`}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-black hover:bg-blue-500"
                  >
                    Abrir
                  </Link>

                  {capa.arquivada ? (
                    <button
                      type="button"
                      onClick={() => alterarArquivamento(capa, false)}
                      className="rounded-lg bg-green-700 px-3 py-2 text-xs font-black hover:bg-green-600"
                    >
                      Restaurar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => alterarArquivamento(capa, true)}
                      className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-black hover:bg-slate-600"
                    >
                      Arquivar
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => apagarCapa(capa)}
                    className="rounded-lg bg-red-700 px-3 py-2 text-xs font-black hover:bg-red-600"
                  >
                    Apagar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
