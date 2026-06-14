'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import StatusBadge from '@/components/StatusBadge'

type Embarque = {
  id: string
  awb: string
  usuario_id: string | null
  cliente_final: string | null
  exportador?: string | null
  importador?: string | null
  transportadora: string | null
  status_operacional: string | null
  status_faturamento?: string | null
  peso_real?: number | null
  peso_taxado?: number | null
  valor_venda?: number | null
  data_entrega?: string | null
  data_fatura_enviada?: string | null
  data_pagamento?: string | null
  data_recibo_enviado?: string | null
  criado_em?: string | null
}

type Fatura = {
  id: string
  embarque_id: string | null
  usuario_id: string | null
  vencimento: string | null
  arquivo_pdf: string | null
  recibo_pdf: string | null
  recibo_nome: string | null
  data_pagamento: string | null
  valor_pago: number | null
  criado_em: string
  visivel_cliente?: boolean | null
  embarques?: any
}

const STATUS_A_FATURAR = 'A FATURAR'
const STATUS_FATURA_ENVIADA = 'FATURA ENVIADA'
const STATUS_PAGO = 'PAGO'
const STATUS_RECIBO_ENVIADO = 'RECIBO ENVIADO'
const STATUS_FINALIZADO = 'FINALIZADO'

export default function FaturasPage() {
  const [embarques, setEmbarques] = useState<Embarque[]>([])
  const [faturas, setFaturas] = useState<Fatura[]>([])
  const [salvando, setSalvando] = useState(false)
  const [enviandoRecibo, setEnviandoRecibo] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('TODOS')
  const [filtroOperacional, setFiltroOperacional] = useState('TODOS')

  const [embarqueSelecionado, setEmbarqueSelecionado] = useState<Embarque | null>(null)
  const [vencimento, setVencimento] = useState('')
  const [valorVenda, setValorVenda] = useState('')
  const [arquivoPdf, setArquivoPdf] = useState<File | null>(null)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    const { data: embarquesData, error: erroEmbarques } = await supabase
      .from('embarques')
      .select('*')
      .order('criado_em', { ascending: false })

    if (erroEmbarques) console.log(erroEmbarques)

    const { data: faturasData, error: erroFaturas } = await supabase
      .from('faturas')
      .select(`
        id,
        embarque_id,
        usuario_id,
        vencimento,
        arquivo_pdf,
        recibo_pdf,
        recibo_nome,
        data_pagamento,
        valor_pago,
        criado_em,
        visivel_cliente,
        embarques (
          awb,
          cliente_final,
          exportador,
          importador,
          transportadora,
          status_operacional,
          status_faturamento,
          peso_taxado,
          peso_real,
          valor_venda,
          data_entrega
        )
      `)
      .order('criado_em', { ascending: false })

    if (erroFaturas) console.log(erroFaturas)

    setEmbarques((embarquesData as Embarque[]) || [])
    setFaturas((faturasData as Fatura[]) || [])
  }

  function dadosEmbarque(fatura: Fatura) {
    if (Array.isArray(fatura.embarques)) return fatura.embarques[0] || {}
    return fatura.embarques || {}
  }

  function moeda(valor?: number | string | null) {
    const numero = Number(valor || 0)

    return numero.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  function dataBR(data?: string | null) {
    if (!data) return '-'
    return new Date(data).toLocaleDateString('pt-BR')
  }

  function statusFinanceiro(embarque: Embarque) {
    return embarque.status_faturamento || STATUS_A_FATURAR
  }

  function faturaDoEmbarque(embarqueId: string) {
    return faturas.find((f) => f.embarque_id === embarqueId) || null
  }

  const embarquesFinanceiros = useMemo(() => {
    return embarques.filter((e) => {
      const entregue = String(e.status_operacional || '').toLowerCase().includes('entregue')
      const temStatusFinanceiro = !!e.status_faturamento

      return entregue || temStatusFinanceiro
    })
  }, [embarques])

    const embarquesFiltrados = useMemo(() => {
    return embarquesFinanceiros.filter((e) => {
      const status = statusFinanceiro(e)
      const statusOperacional = String(e.status_operacional || '').toUpperCase()

      const texto = `
        ${e.awb || ''}
        ${e.cliente_final || ''}
        ${e.exportador || ''}
        ${e.importador || ''}
        ${e.transportadora || ''}
        ${e.status_operacional || ''}
        ${status}
      `.toLowerCase()

      const passaBusca = texto.includes(busca.toLowerCase())
      const passaStatus = filtroStatus === 'TODOS' || status === filtroStatus
      const passaOperacional =
        filtroOperacional === 'TODOS' ||
        statusOperacional.includes(filtroOperacional)

      return passaBusca && passaStatus && passaOperacional
    })
  }, [embarquesFinanceiros, busca, filtroStatus, filtroOperacional])

  const aFaturar = embarquesFinanceiros.filter((e) => statusFinanceiro(e) === STATUS_A_FATURAR)
  const faturaEnviada = embarquesFinanceiros.filter((e) => statusFinanceiro(e) === STATUS_FATURA_ENVIADA)
  const pagos = embarquesFinanceiros.filter((e) => statusFinanceiro(e) === STATUS_PAGO)
  const reciboEnviado = embarquesFinanceiros.filter((e) => statusFinanceiro(e) === STATUS_RECIBO_ENVIADO)
  const finalizados = embarquesFinanceiros.filter((e) => statusFinanceiro(e) === STATUS_FINALIZADO)

  const valorAFaturar = aFaturar.reduce((acc, e) => acc + Number(e.valor_venda || 0), 0)
  const valorFaturaEnviada = faturaEnviada.reduce((acc, e) => acc + Number(e.valor_venda || 0), 0)
  const valorPago = pagos.reduce((acc, e) => acc + Number(e.valor_venda || 0), 0)
  const valorRecibo = reciboEnviado.reduce((acc, e) => acc + Number(e.valor_venda || 0), 0)
  const valorFinalizado = finalizados.reduce((acc, e) => acc + Number(e.valor_venda || 0), 0)

  function abrirEnvioFatura(embarque: Embarque) {
    setEmbarqueSelecionado(embarque)
    setVencimento('')
    setValorVenda(embarque.valor_venda ? String(embarque.valor_venda) : '')
    setArquivoPdf(null)

    setTimeout(() => {
      document.getElementById('form_envio_fatura')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  async function salvarFatura() {
    if (!embarqueSelecionado) return alert('Selecione um embarque.')
    if (!arquivoPdf) return alert('Selecione o PDF da fatura.')
    if (arquivoPdf.type !== 'application/pdf') return alert('O arquivo precisa ser um PDF.')

    setSalvando(true)

    const nomeArquivo = `${embarqueSelecionado.id}/${Date.now()}-${arquivoPdf.name.replaceAll(' ', '-')}`

    const { error: erroUpload } = await supabase.storage
      .from('faturas')
      .upload(nomeArquivo, arquivoPdf, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'application/pdf',
      })

    if (erroUpload) {
      setSalvando(false)
      alert(erroUpload.message)
      return
    }

    const { data: urlData } = supabase.storage.from('faturas').getPublicUrl(nomeArquivo)

    const { error: erroInsert } = await supabase.from('faturas').insert([
      {
        embarque_id: embarqueSelecionado.id,
        usuario_id: embarqueSelecionado.usuario_id || null,
        vencimento: vencimento || null,
        arquivo_pdf: urlData.publicUrl,
        visivel_cliente: true,
        valor_pago: valorVenda ? Number(valorVenda) : null,
      },
    ])

    if (erroInsert) {
      setSalvando(false)
      alert(erroInsert.message)
      console.log(erroInsert)
      return
    }

    const { error: erroUpdate } = await supabase
      .from('embarques')
      .update({
        status_faturamento: STATUS_FATURA_ENVIADA,
        valor_venda: valorVenda ? Number(valorVenda) : null,
        data_fatura_enviada: new Date().toISOString(),
      })
      .eq('id', embarqueSelecionado.id)

    setSalvando(false)

    if (erroUpdate) {
      alert(erroUpdate.message)
      console.log(erroUpdate)
      return
    }

    alert('Fatura enviada e embarque marcado como FATURA ENVIADA.')

    setEmbarqueSelecionado(null)
    setVencimento('')
    setValorVenda('')
    setArquivoPdf(null)

    const inputArquivo = document.getElementById('pdf_fatura') as HTMLInputElement | null
    if (inputArquivo) inputArquivo.value = ''

    carregar()
  }

  async function marcarComoPago(embarque: Embarque) {
    const confirmar = confirm(`Confirmar pagamento do AWB ${embarque.awb}?`)
    if (!confirmar) return

    const fatura = faturaDoEmbarque(embarque.id)

    if (fatura) {
      await supabase
        .from('faturas')
        .update({
          data_pagamento: new Date().toISOString().slice(0, 10),
          valor_pago: embarque.valor_venda || fatura.valor_pago || null,
        })
        .eq('id', fatura.id)
    }

    const { error } = await supabase
      .from('embarques')
      .update({
        status_faturamento: STATUS_PAGO,
        data_pagamento: new Date().toISOString().slice(0, 10),
      })
      .eq('id', embarque.id)

    if (error) {
      alert(error.message)
      return
    }

    carregar()
  }

  async function anexarRecibo(embarque: Embarque, arquivo: File | null) {
    if (!arquivo) return
    if (arquivo.type !== 'application/pdf') return alert('O recibo precisa ser um PDF.')

    const fatura = faturaDoEmbarque(embarque.id)

    if (!fatura) {
      alert('Não encontrei a fatura vinculada a este embarque.')
      return
    }

    setEnviandoRecibo(embarque.id)

    const nomeArquivo = `recibos/${fatura.id}/${Date.now()}-${arquivo.name.replaceAll(' ', '-')}`

    const { error: erroUpload } = await supabase.storage
      .from('faturas')
      .upload(nomeArquivo, arquivo, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'application/pdf',
      })

    if (erroUpload) {
      setEnviandoRecibo(null)
      alert(erroUpload.message)
      return
    }

    const { data: urlData } = supabase.storage.from('faturas').getPublicUrl(nomeArquivo)

    const { error: erroFatura } = await supabase
      .from('faturas')
      .update({
        recibo_pdf: urlData.publicUrl,
        recibo_nome: arquivo.name,
        data_pagamento: new Date().toISOString().slice(0, 10),
      })
      .eq('id', fatura.id)

    if (erroFatura) {
      setEnviandoRecibo(null)
      alert(erroFatura.message)
      return
    }

    const { error: erroEmbarque } = await supabase
      .from('embarques')
      .update({
        status_faturamento: STATUS_RECIBO_ENVIADO,
        data_recibo_enviado: new Date().toISOString(),
      })
      .eq('id', embarque.id)

    setEnviandoRecibo(null)

    if (erroEmbarque) {
      alert(erroEmbarque.message)
      return
    }

    alert('Recibo anexado e status alterado para RECIBO ENVIADO.')
    carregar()
  }

  async function finalizarFinanceiro(embarque: Embarque) {
    const confirmar = confirm(`Finalizar ciclo financeiro do AWB ${embarque.awb}?`)
    if (!confirmar) return

    const { error } = await supabase
      .from('embarques')
      .update({
        status_faturamento: STATUS_FINALIZADO,
      })
      .eq('id', embarque.id)

    if (error) {
      alert(error.message)
      return
    }

    carregar()
  }

  async function voltarStatus(embarque: Embarque, status: string) {
    const confirmar = confirm(`Alterar status financeiro para ${status}?`)
    if (!confirmar) return

    const { error } = await supabase
      .from('embarques')
      .update({
        status_faturamento: status,
      })
      .eq('id', embarque.id)

    if (error) {
      alert(error.message)
      return
    }

    carregar()
  }

  return (
    <main className="max-w-[1600px] mx-auto p-8 text-white">
      <div className="mb-8 flex flex-col lg:flex-row justify-between gap-6">
        <div>
          <p className="text-blue-400 font-bold mb-2">Financeiro</p>
          <h1 className="text-5xl font-black mb-2">Faturas</h1>
          <p className="text-slate-400 text-lg">
            Gerencie o ciclo completo dos embarques: fatura, pagamento, recibo e finalização.
          </p>
        </div>

        <button
          onClick={() => document.getElementById('tabela_financeira')?.scrollIntoView({ behavior: 'smooth' })}
          className="bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold h-fit"
        >
          Ver embarques
        </button>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5 mb-8">
        <CardFinanceiro titulo="A faturar" valor={aFaturar.length} detalhe="Pendente de faturamento" total={moeda(valorAFaturar)} icone="🟡" cor="yellow" />
        <CardFinanceiro titulo="Fatura enviada" valor={faturaEnviada.length} detalhe="Aguardando pagamento" total={moeda(valorFaturaEnviada)} icone="📨" cor="blue" />
        <CardFinanceiro titulo="Pago / recibo pendente" valor={pagos.length} detalhe="Aguardando recibo" total={moeda(valorPago)} icone="💵" cor="green" />
        <CardFinanceiro titulo="Recibo enviado" valor={reciboEnviado.length} detalhe="Aguardando finalização" total={moeda(valorRecibo)} icone="🧾" cor="purple" />
        <CardFinanceiro titulo="Finalizados" valor={finalizados.length} detalhe="Ciclo concluído" total={moeda(valorFinalizado)} icone="✅" cor="green" />
      </section>

      {embarqueSelecionado && (
        <section id="form_envio_fatura" className="border border-blue-900 rounded-3xl bg-[#071225] p-7 mb-8">
          <div className="flex flex-col lg:flex-row justify-between gap-5 mb-7">
            <div>
              <p className="text-blue-400 font-bold mb-2">Enviar fatura</p>
              <h2 className="text-2xl font-black">
                AWB {embarqueSelecionado.awb}
              </h2>
              <p className="text-slate-400 text-sm">
                {embarqueSelecionado.cliente_final || embarqueSelecionado.importador || 'Cliente não informado'} • {embarqueSelecionado.transportadora || '-'}
              </p>
            </div>

            <button
              onClick={() => setEmbarqueSelecionado(null)}
              className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-2xl font-bold h-fit"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <input
              type="number"
              step="0.01"
              value={valorVenda}
              onChange={(e) => setValorVenda(e.target.value)}
              placeholder="Valor da venda"
            />

            <input
              type="date"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
            />

            <input
              id="pdf_fatura"
              type="file"
              accept="application/pdf"
              onChange={(e) => setArquivoPdf(e.target.files?.[0] || null)}
              className="cursor-pointer"
            />

            <button
              onClick={salvarFatura}
              disabled={salvando}
              className="bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold disabled:opacity-60"
            >
              {salvando ? 'Salvando...' : 'Salvar e enviar fatura'}
            </button>
          </div>
        </section>
      )}

      <section id="tabela_financeira" className="border border-blue-900 rounded-3xl bg-[#071225] p-7 mb-8">
        <div className="flex flex-col lg:flex-row justify-between gap-5 mb-7">
          <div>
            <h2 className="text-2xl font-black">Esteira financeira dos embarques</h2>
            <p className="text-slate-400 text-sm">
              Embarques entregues aparecem automaticamente para faturamento.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
  <select
    value={filtroOperacional}
    onChange={(e) => setFiltroOperacional(e.target.value)}
  >
    <option value="TODOS">Todos operacionais</option>
    <option value="AGUARDANDO COLETA">Aguardando coleta</option>
    <option value="COLETADO">Coletado</option>
    <option value="EM TRÂNSITO">Em trânsito</option>
    <option value="FISCALIZAÇÃO">Fiscalização</option>
    <option value="LIBERADO">Liberado</option>
    <option value="ENTREGUE">Entregue</option>
  </select>

  <select
    value={filtroStatus}
    onChange={(e) => setFiltroStatus(e.target.value)}
  >
    <option value="TODOS">Todos financeiros</option>
    <option value={STATUS_A_FATURAR}>A faturar</option>
    <option value={STATUS_FATURA_ENVIADA}>Fatura enviada</option>
    <option value={STATUS_PAGO}>Pago / recibo pendente</option>
    <option value={STATUS_RECIBO_ENVIADO}>Recibo enviado</option>
    <option value={STATUS_FINALIZADO}>Finalizado</option>
  </select>

  <input
    value={busca}
    onChange={(e) => setBusca(e.target.value)}
    placeholder="Buscar por AWB, cliente, transportadora..."
    className="min-w-[320px]"
  />
</div>
        </div>

        <div className="overflow-auto">
          <table className="table">
            <thead>
              <tr>
                <th>AWB</th>
                <th>Cliente</th>
                <th>Exportador</th>
                <th>Importador</th>
                <th>Transportadora</th>
                <th>Peso</th>
                <th>Entrega</th>
                <th>Valor venda</th>
                <th>Status operacional</th>
                <th>Status financeiro</th>
                <th>Fatura</th>
                <th>Recibo</th>
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              {embarquesFiltrados.map((embarque) => {
                const fatura = faturaDoEmbarque(embarque.id)
                const status = statusFinanceiro(embarque)

                return (
                  <tr key={embarque.id}>
                    <td className="font-black text-blue-400">{embarque.awb || '-'}</td>
                    <td>{embarque.cliente_final || embarque.importador || '-'}</td>
                    <td>{embarque.exportador || '-'}</td>
                    <td>{embarque.importador || '-'}</td>
                    <td>{embarque.transportadora || '-'}</td>
                    <td>{Number(embarque.peso_taxado || embarque.peso_real || 0).toFixed(2)} kg</td>
                    <td>{dataBR(embarque.data_entrega || null)}</td>
                    <td>{embarque.valor_venda ? moeda(embarque.valor_venda) : '-'}</td>

                    <td>
                      <StatusBadge status={embarque.status_operacional || '-'} />
                    </td>

                    <td>
                      <StatusFinanceiro status={status} />
                    </td>

                    <td>
                      {fatura?.arquivo_pdf ? (
                        <Link
                          href={fatura.arquivo_pdf}
                          target="_blank"
                          className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl text-white font-bold inline-block"
                        >
                          Abrir
                        </Link>
                      ) : (
                        <span className="text-slate-500">Sem fatura</span>
                      )}
                    </td>

                    <td>
                      {fatura?.recibo_pdf ? (
                        <Link
                          href={fatura.recibo_pdf}
                          target="_blank"
                          className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-xl text-white font-bold inline-block"
                        >
                          Abrir
                        </Link>
                      ) : status === STATUS_PAGO ? (
                        <div className="min-w-[180px]">
                          <input
                            type="file"
                            accept="application/pdf"
                            disabled={enviandoRecibo === embarque.id}
                            onChange={(e) => anexarRecibo(embarque, e.target.files?.[0] || null)}
                            className="text-sm"
                          />

                          {enviandoRecibo === embarque.id && (
                            <p className="text-blue-400 text-xs font-bold mt-1">
                              Enviando recibo...
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">Pendente</span>
                      )}
                    </td>

                    <td>
                      <div className="flex gap-2 flex-wrap min-w-[260px]">
                        {status === STATUS_A_FATURAR && (
                          <button
                            onClick={() => abrirEnvioFatura(embarque)}
                            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl font-bold"
                          >
                            Enviar fatura
                          </button>
                        )}

                        {status === STATUS_FATURA_ENVIADA && (
                          <button
                            onClick={() => marcarComoPago(embarque)}
                            className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-xl font-bold"
                          >
                            Marcar pago
                          </button>
                        )}

                        {status === STATUS_RECIBO_ENVIADO && (
                          <button
                            onClick={() => finalizarFinanceiro(embarque)}
                            className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-xl font-bold"
                          >
                            Finalizar
                          </button>
                        )}

                        {status === STATUS_FINALIZADO && (
                          <span className="bg-green-700 px-4 py-2 rounded-xl font-bold">
                            Concluído
                          </span>
                        )}

                        {status !== STATUS_A_FATURAR && (
                          <button
                            onClick={() => voltarStatus(embarque, STATUS_A_FATURAR)}
                            className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl font-bold"
                          >
                            Reabrir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {embarquesFiltrados.length === 0 && (
            <div className="border border-blue-900 bg-[#020817] rounded-2xl p-6 text-center text-slate-400 mt-6">
              Nenhum embarque encontrado na esteira financeira.
            </div>
          )}
        </div>
      </section>

      <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
        <h2 className="text-2xl font-black mb-6">Como funciona o ciclo financeiro</h2>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
          <FluxoCard numero="1" titulo="A faturar" texto="Embarque entregue entra automaticamente na lista para faturamento." icone="🟡" />
          <FluxoCard numero="2" titulo="Fatura enviada" texto="Você envia o PDF da fatura e o cliente visualiza no portal." icone="📨" />
          <FluxoCard numero="3" titulo="Pago" texto="Quando o cliente paga, marque como pago para liberar o recibo." icone="💵" />
          <FluxoCard numero="4" titulo="Recibo enviado" texto="Anexe o recibo em PDF para o cliente acessar." icone="🧾" />
          <FluxoCard numero="5" titulo="Finalizado" texto="Ciclo financeiro concluído para o embarque." icone="✅" />
        </div>
      </section>
    </main>
  )
}

function CardFinanceiro({ titulo, valor, detalhe, total, icone, cor }: any) {
  const corTexto =
    cor === 'yellow'
      ? 'text-yellow-400'
      : cor === 'green'
      ? 'text-green-400'
      : cor === 'purple'
      ? 'text-purple-400'
      : 'text-blue-400'

  return (
    <div className="border border-blue-900 rounded-3xl bg-[#071225] p-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <p className="text-slate-300 font-bold">{titulo}</p>
          <h2 className="text-5xl font-black mt-4 text-white">{valor}</h2>
          <p className="text-slate-400 mt-2">{detalhe}</p>
          <p className={`font-black mt-4 ${corTexto}`}>{total}</p>
        </div>

        <div className="text-4xl">{icone}</div>
      </div>
    </div>
  )
}

function StatusFinanceiro({ status }: any) {
  const s = String(status || '').toUpperCase()

  let classe = 'bg-slate-700 text-slate-200 border-slate-500'
  let icone = '⚪'

  if (s === 'A FATURAR') {
    classe = 'bg-yellow-500/20 text-yellow-300 border-yellow-500'
    icone = '🟡'
  } else if (s === 'FATURA ENVIADA') {
    classe = 'bg-blue-600/20 text-blue-300 border-blue-500'
    icone = '📨'
  } else if (s === 'PAGO') {
    classe = 'bg-green-600/20 text-green-300 border-green-500'
    icone = '💵'
  } else if (s === 'RECIBO ENVIADO') {
    classe = 'bg-purple-600/20 text-purple-300 border-purple-500'
    icone = '🧾'
  } else if (s === 'FINALIZADO') {
    classe = 'bg-emerald-600/20 text-emerald-300 border-emerald-500'
    icone = '✅'
  }

  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-black whitespace-nowrap ${classe}`}>
      <span>{icone}</span>
      {status || '-'}
    </span>
  )
}

function FluxoCard({ numero, titulo, texto, icone }: any) {
  return (
    <div className="border border-blue-900 bg-[#020817] rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-black">
          {numero}
        </span>
        <span className="text-2xl">{icone}</span>
      </div>

      <h3 className="font-black mb-2">{titulo}</h3>
      <p className="text-slate-400 text-sm">{texto}</p>
    </div>
  )
}