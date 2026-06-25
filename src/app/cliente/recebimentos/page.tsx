'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type RepasseParceiro = {
  id: string
  awb: string | null
  cliente: string | null
  servico: string | null
  parceiro: string | null
  debito_terceiro: number | string | null
  pgta_terceiros: string | null
  mes_pgto: string | null
  observacao_parceiro: string | null
  liberado_parceiro_em: string | null
  atualizado_em: string | null
}

type FiltroStatus = 'TODOS' | 'PENDENTE' | 'PAGO'

export default function RecebimentosParceiroPage() {
  const [repasses, setRepasses] = useState<RepasseParceiro[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<FiltroStatus>('TODOS')

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/login'
      return
    }

    const { data, error } = await supabase.rpc('get_meus_repasses_parceiro')

    if (error) {
      console.log('ERRO REPASSES PARCEIRO:', error)
      alert(
        'Não foi possível carregar seus recebimentos. Confira se o SQL do portal de parceiros foi executado.'
      )
      setRepasses([])
      setLoading(false)
      return
    }

    setRepasses((data as RepasseParceiro[]) || [])
    setLoading(false)
  }

  function numero(valor: any) {
    if (valor === null || valor === undefined || valor === '') return 0
    if (typeof valor === 'number') return valor

    return Number(
      String(valor)
        .replace(/[R$\s]/gi, '')
        .replace(/\./g, '')
        .replace(',', '.')
    ) || 0
  }

  function moeda(valor: any) {
    return numero(valor).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  function normalizarTexto(valor: any) {
    return String(valor || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  }

  function dataBR(data?: string | null) {
    if (!data) return '-'
    return new Date(data).toLocaleDateString('pt-BR')
  }

  async function gerarPdfCliente() {
    try {
      const { default: jsPDF } = await import('jspdf')
      const autoTableModule: any = await import('jspdf-autotable')
      const autoTable = autoTableModule.default || autoTableModule

      const dataGeracao = new Date().toLocaleString('pt-BR')
      const parceiroNome = filtrados.find((item) => item.parceiro)?.parceiro || 'Parceiro'
      const nomeArquivo = String(parceiroNome || 'recebimentos')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      doc.setFillColor(2, 12, 34)
      doc.rect(0, 0, pageWidth, 24, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.text('HC Consultoria', 14, 15)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text('Relatorio de Recebimentos', pageWidth - 14, 15, { align: 'right' })

      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.text('Recebimentos liberados pela HC', 14, 36)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(71, 85, 105)
      doc.text(`Parceiro: ${parceiroNome}`, 14, 44)
      doc.text(`Status: ${statusFiltro}`, 14, 50)
      doc.text(`Busca: ${busca || '-'}`, 14, 56)
      doc.text(`Gerado em: ${dataGeracao}`, pageWidth - 14, 44, { align: 'right' })
      doc.text('Este relatorio considera somente os repasses disponibilizados para este login.', pageWidth - 14, 50, {
        align: 'right',
      })

      autoTable(doc, {
        startY: 64,
        head: [['Total liberado', 'A receber', 'Recebido', 'Pendentes', 'Pagos', 'Processos no filtro']],
        body: [[
          moeda(resumo.total),
          moeda(resumo.aReceber),
          moeda(resumo.recebido),
          String(resumo.qtdPendentes),
          String(resumo.qtdPagos),
          String(filtrados.length),
        ]],
        theme: 'grid',
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: {
          halign: 'center',
          fontStyle: 'bold',
        },
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
      })

      const linhas = filtrados.map((item) => {
        const status = statusRepasse(item)

        return [
          item.awb || '-',
          item.cliente || '-',
          item.servico || '-',
          item.parceiro || '-',
          moeda(item.debito_terceiro),
          status === 'PAGO' ? 'PAGO' : 'A RECEBER',
          item.mes_pgto || '-',
          item.observacao_parceiro || '-',
          dataBR(item.liberado_parceiro_em),
        ]
      })

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['AWB', 'Cliente', 'Servico', 'Parceiro', 'Valor a receber', 'Status', 'Mes pagamento', 'Observacao HC', 'Liberado em']],
        body: linhas.length ? linhas : [['-', '-', '-', '-', '-', '-', '-', '-', '-']],
        theme: 'striped',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        styles: {
          fontSize: 8,
          cellPadding: 2.3,
          overflow: 'linebreak',
        },
        columnStyles: {
          0: { cellWidth: 26 },
          1: { cellWidth: 48 },
          2: { cellWidth: 32 },
          3: { cellWidth: 34 },
          4: { cellWidth: 32, halign: 'right' },
          5: { cellWidth: 26, halign: 'center' },
          6: { cellWidth: 28, halign: 'center' },
          7: { cellWidth: 48 },
          8: { cellWidth: 26, halign: 'center' },
        },
        didDrawPage: () => {
          doc.setFontSize(8)
          doc.setTextColor(100, 116, 139)
          doc.text('Relatorio gerado automaticamente pelo HC Connect', 14, pageHeight - 8)
          doc.text(`Pagina ${doc.getNumberOfPages()}`, pageWidth - 14, pageHeight - 8, { align: 'right' })
        },
      })

      doc.save(`recebimentos-hc-${nomeArquivo || 'parceiro'}.pdf`)
    } catch (error: any) {
      console.log('ERRO PDF RECEBIMENTOS:', error)
      alert(
        'Erro ao gerar PDF: ' +
          (error?.message || 'erro desconhecido') +
          '\n\nConfira se as dependências jspdf e jspdf-autotable estão instaladas.'
      )
    }
  }

  function statusRepasse(item: RepasseParceiro) {
    const status = normalizarTexto(item.pgta_terceiros).toUpperCase()
    return status.includes('PAGO') ? 'PAGO' : 'PENDENTE'
  }

  const filtrados = useMemo(() => {
    const termo = normalizarTexto(busca)

    return repasses.filter((item) => {
      const status = statusRepasse(item)

      if (statusFiltro === 'PAGO' && status !== 'PAGO') return false
      if (statusFiltro === 'PENDENTE' && status !== 'PENDENTE') return false

      const texto = normalizarTexto(`
        ${item.awb || ''}
        ${item.cliente || ''}
        ${item.servico || ''}
        ${item.parceiro || ''}
        ${item.pgta_terceiros || ''}
        ${item.mes_pgto || ''}
        ${item.observacao_parceiro || ''}
      `)

      return !termo || texto.includes(termo)
    })
  }, [repasses, busca, statusFiltro])

  const resumo = useMemo(() => {
    const pendentes = repasses.filter((item) => statusRepasse(item) !== 'PAGO')
    const pagos = repasses.filter((item) => statusRepasse(item) === 'PAGO')

    function total(lista: RepasseParceiro[]) {
      return lista.reduce((acc, item) => acc + numero(item.debito_terceiro), 0)
    }

    return {
      total: total(repasses),
      aReceber: total(pendentes),
      recebido: total(pagos),
      qtd: repasses.length,
      qtdPendentes: pendentes.length,
      qtdPagos: pagos.length,
    }
  }, [repasses])

  return (
    <main className="min-h-screen bg-[#020817] p-6 text-white lg:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-2 font-black text-blue-400">Financeiro</p>
            <h1 className="mb-2 text-4xl font-black lg:text-5xl">Recebimentos</h1>
            <p className="max-w-3xl text-lg text-slate-400">
              Acompanhe os repasses liberados pela HC para o seu login. Valores ocultos pela HC não aparecem nesta tela.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={carregar}
              className="rounded-xl bg-blue-600 px-5 py-3 font-black text-white hover:bg-blue-500"
            >
              Atualizar
            </button>

            <button
              type="button"
              onClick={gerarPdfCliente}
              disabled={loading || filtrados.length === 0}
              className="rounded-xl bg-green-600 px-5 py-3 font-black text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              📄 Gerar PDF
            </button>

            <Link
              href="/cliente"
              className="rounded-xl bg-slate-700 px-5 py-3 font-black text-white hover:bg-slate-600"
            >
              Voltar ao portal
            </Link>
          </div>
        </div>

        <section className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3 xl:grid-cols-5">
          <Card titulo="Total liberado" valor={moeda(resumo.total)} detalhe={`${resumo.qtd} processos`} icone="🤝" />
          <Card titulo="A receber" valor={moeda(resumo.aReceber)} detalhe={`${resumo.qtdPendentes} pendentes`} icone="💰" destaque="yellow" />
          <Card titulo="Recebido" valor={moeda(resumo.recebido)} detalhe={`${resumo.qtdPagos} pagos`} icone="✅" destaque="green" />
          <Card titulo="Pendentes" valor={String(resumo.qtdPendentes)} detalhe="Aguardando pagamento" icone="⏳" />
          <Card titulo="Histórico" valor={String(resumo.qtdPagos)} detalhe="Pagamentos concluídos" icone="🧾" />
        </section>

        <section className="rounded-3xl border border-blue-900 bg-[#071225] p-6">
          <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-2xl font-black">Repasses liberados</h2>
              <p className="text-sm text-slate-400">
                Lista de processos que a HC disponibilizou para visualização.
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row xl:min-w-[680px]">
              <div className="flex rounded-xl border border-blue-900 bg-[#020817] p-1">
                {(['TODOS', 'PENDENTE', 'PAGO'] as FiltroStatus[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setStatusFiltro(item)}
                    className={`rounded-lg px-4 py-2 text-sm font-black ${
                      statusFiltro === item
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por AWB, cliente, serviço..."
                className="w-full rounded-xl border border-blue-900 bg-[#020817] px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />

              <button
                type="button"
                onClick={gerarPdfCliente}
                disabled={loading || filtrados.length === 0}
                className="rounded-xl border border-green-500/40 bg-green-600/20 px-4 py-3 text-sm font-black text-green-300 hover:bg-green-600/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Gerar PDF do filtro
              </button>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-blue-900 bg-[#020817] p-6 text-slate-400">
              Carregando recebimentos...
            </div>
          ) : filtrados.length === 0 ? (
            <div className="rounded-2xl border border-blue-900 bg-[#020817] p-6 text-slate-400">
              Nenhum recebimento disponível para este filtro.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-[#020817] text-slate-400">
                  <tr>
                    <Th>AWB</Th>
                    <Th>Cliente</Th>
                    <Th>Serviço</Th>
                    <Th>Parceiro</Th>
                    <Th>Valor a receber</Th>
                    <Th>Status</Th>
                    <Th>Mês pagamento</Th>
                    <Th>Observação HC</Th>
                    <Th>Liberado em</Th>
                  </tr>
                </thead>

                <tbody>
                  {filtrados.map((item) => {
                    const status = statusRepasse(item)

                    return (
                      <tr key={item.id} className="border-b border-blue-950 hover:bg-[#0b1730]">
                        <Td>{item.awb || '-'}</Td>
                        <Td>{item.cliente || '-'}</Td>
                        <Td>{item.servico || '-'}</Td>
                        <Td>{item.parceiro || '-'}</Td>
                        <Td>
                          <span className="font-black text-white">
                            {moeda(item.debito_terceiro)}
                          </span>
                        </Td>
                        <Td>
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black ${
                              status === 'PAGO'
                                ? 'border-green-500 bg-green-600/20 text-green-300'
                                : 'border-yellow-500 bg-yellow-500/20 text-yellow-300'
                            }`}
                          >
                            {status === 'PAGO' ? 'PAGO' : 'A RECEBER'}
                          </span>
                        </Td>
                        <Td>{item.mes_pgto || '-'}</Td>
                        <Td>{item.observacao_parceiro || '-'}</Td>
                        <Td>{dataBR(item.liberado_parceiro_em)}</Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function Card({ titulo, valor, detalhe, icone, destaque }: any) {
  const cor =
    destaque === 'green'
      ? 'border-green-500/40 bg-green-600/10'
      : destaque === 'yellow'
      ? 'border-yellow-500/40 bg-yellow-500/10'
      : 'border-blue-900 bg-[#071225]'

  return (
    <div className={`rounded-3xl border ${cor} p-5`}>
      <div className="mb-4 text-3xl">{icone}</div>
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">
        {titulo}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{valor}</p>
      <p className="mt-2 text-sm text-slate-400">{detalhe}</p>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left font-black whitespace-nowrap">{children}</th>
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-4 text-slate-300 whitespace-nowrap">{children}</td>
}
