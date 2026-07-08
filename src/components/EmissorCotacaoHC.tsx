'use client'

import { useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import { supabase } from '@/lib/supabaseClient'

type ModeloCotacao = 'DHL_IMPORTACAO_FORMAL' | 'FEDEX_EXPORTACAO'

type Props = {
  cotacao: any
  referenciaHC: string
  onPdfSalvo: () => Promise<void> | void
  enviarEmailCotacao: (cotacaoAtualizada: any) => Promise<boolean>
}

type VolumeCalculado = {
  index: number
  quantidade: number
  comprimento: number
  largura: number
  altura: number
  pesoRealUnitario: number
  pesoDimensionalUnitario: number
  maiorPesoUnitario: number
  pesoRealTotal: number
  pesoDimensionalTotal: number
  maiorPesoTotal: number
}

type FormEmissor = {
  cliente: string
  contato: string
  origem: string
  destino: string
  aod: string
  transito: string
  validade: string
  moedaMercadoria: string
  valorMercadoria: string
  percentualSeguro: string
  seguroMinimo: string
  usarSeguroManual: boolean
  seguroManual: string
  semSeguro: boolean
  frete: string
  sobretaxa: string
  areaRemota: string
  dta: string
  deliveryDocFee: string
  dimensaoExcedente: string
  pesoExcedente: string
  volumeExcedente: string
  emissaoDue: string
  impostosDestino: string
  descricaoMercadoria: string
  observacoesComerciais: string
}

function numero(valor: any) {
  if (valor === null || valor === undefined || valor === '') return 0

  const texto = String(valor).trim()

  if (texto.includes(',') && texto.includes('.')) {
    return Number(texto.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')) || 0
  }

  if (texto.includes(',')) {
    return Number(texto.replace(',', '.').replace(/[^0-9.-]/g, '')) || 0
  }

  return Number(texto.replace(/[^0-9.-]/g, '')) || 0
}

function dinheiro(valor: any) {
  return `USD ${numero(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function kg(valor: any) {
  return `${numero(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kg`
}

function arredondarMeioKg(valor: number) {
  return Math.ceil((Number(valor) || 0) / 0.5) * 0.5
}

function modeloInicial(cotacao: any): ModeloCotacao {
  const texto = JSON.stringify({
    transportadoras: cotacao?.transportadoras_consulta,
    servico: cotacao?.servico,
    tipo: cotacao?.tipo_operacao,
  }).toUpperCase()

  if (texto.includes('FEDEX') || texto.includes('EXPORT')) return 'FEDEX_EXPORTACAO'

  return 'DHL_IMPORTACAO_FORMAL'
}

function nomeModelo(modelo: ModeloCotacao) {
  if (modelo === 'FEDEX_EXPORTACAO') return 'FedEx - Exportação'
  return 'DHL - Importação Formal'
}

export default function EmissorCotacaoHC({
  cotacao,
  referenciaHC,
  onPdfSalvo,
  enviarEmailCotacao,
}: Props) {
  const [modelo, setModelo] = useState<ModeloCotacao>(() => modeloInicial(cotacao))
  const [gerando, setGerando] = useState(false)

  const [form, setForm] = useState<FormEmissor>({
    cliente: cotacao?.importador || cotacao?.exportador || cotacao?.cliente_final || '',
    contato: cotacao?.solicitante_email || '',
    origem: cotacao?.origem || '',
    destino: cotacao?.destino || '',
    aod: '',
    transito: '',
    validade: '7 dias',
    moedaMercadoria: cotacao?.moeda || 'USD',
    valorMercadoria: cotacao?.valor_mercadoria ? String(cotacao.valor_mercadoria) : '',
    percentualSeguro: '0.60',
    seguroMinimo: '13.20',
    usarSeguroManual: false,
    seguroManual: '',
    semSeguro: false,
    frete: '',
    sobretaxa: '',
    areaRemota: '',
    dta: '',
    deliveryDocFee: '',
    dimensaoExcedente: '',
    pesoExcedente: '',
    volumeExcedente: '',
    emissaoDue: '',
    impostosDestino: '',
    descricaoMercadoria: cotacao?.descricao_mercadoria || '',
    observacoesComerciais: cotacao?.observacoes || '',
  })

  function atualizar(campo: keyof FormEmissor, valor: string | boolean) {
    setForm((atual) => ({
      ...atual,
      [campo]: valor,
    }))
  }

  const volumes = useMemo(() => {
    const lista = Array.isArray(cotacao?.volumes) ? cotacao.volumes : []

    return lista.map((volume: any, index: number): VolumeCalculado => {
      const quantidade = Math.max(numero(volume.quantidade || volume.qtd || 1), 1)
      const comprimento = numero(volume.comprimento_cm || volume.comprimento || volume.comp)
      const largura = numero(volume.largura_cm || volume.largura || volume.larg)
      const altura = numero(volume.altura_cm || volume.altura || volume.alt)
      const pesoRealUnitario = numero(volume.peso_kg || volume.peso || volume.peso_real)

      const pesoDimensionalUnitario = (comprimento * largura * altura) / 5000
      const maiorPesoUnitario = Math.max(pesoRealUnitario, pesoDimensionalUnitario)

      return {
        index,
        quantidade,
        comprimento,
        largura,
        altura,
        pesoRealUnitario,
        pesoDimensionalUnitario,
        maiorPesoUnitario,
        pesoRealTotal: pesoRealUnitario * quantidade,
        pesoDimensionalTotal: pesoDimensionalUnitario * quantidade,
        maiorPesoTotal: maiorPesoUnitario * quantidade,
      }
    })
  }, [cotacao?.volumes])

  const resumoPesos = useMemo(() => {
    const volumesTotal = volumes.reduce((acc: number, item: VolumeCalculado) => acc + item.quantidade, 0)
    const pesoBruto = volumes.reduce((acc: number, item: VolumeCalculado) => acc + item.pesoRealTotal, 0)
    const pesoDimensional = volumes.reduce((acc: number, item: VolumeCalculado) => acc + item.pesoDimensionalTotal, 0)
    const pesoTaxado = volumes.reduce((acc: number, item: VolumeCalculado) => acc + item.maiorPesoTotal, 0)

    return {
      volumesTotal,
      pesoBruto: arredondarMeioKg(pesoBruto),
      pesoDimensional: arredondarMeioKg(pesoDimensional),
      pesoTaxado: arredondarMeioKg(pesoTaxado),
    }
  }, [volumes])

  const valores = useMemo(() => {
    const valorMercadoria = numero(form.valorMercadoria)
    const percentualSeguro = numero(form.percentualSeguro)
    const seguroMinimo = numero(form.seguroMinimo)
    const seguroManual = numero(form.seguroManual)

    const seguro = form.semSeguro
      ? 0
      : form.usarSeguroManual
        ? seguroManual
        : Math.max(valorMercadoria * (percentualSeguro / 100), seguroMinimo)

    const frete = numero(form.frete)
    const sobretaxa = numero(form.sobretaxa)
    const areaRemota = numero(form.areaRemota)
    const dta = numero(form.dta)
    const deliveryDocFee = numero(form.deliveryDocFee)
    const dimensaoExcedente = numero(form.dimensaoExcedente)
    const pesoExcedente = numero(form.pesoExcedente)
    const volumeExcedente = numero(form.volumeExcedente)
    const emissaoDue = numero(form.emissaoDue)
    const impostosDestino = numero(form.impostosDestino)

    const totalDhl =
      frete +
      sobretaxa +
      seguro +
      areaRemota +
      dta +
      deliveryDocFee +
      dimensaoExcedente +
      pesoExcedente

    const totalFedex =
      frete +
      sobretaxa +
      seguro +
      emissaoDue +
      areaRemota +
      volumeExcedente +
      pesoExcedente +
      impostosDestino

    return {
      seguro,
      frete,
      sobretaxa,
      areaRemota,
      dta,
      deliveryDocFee,
      dimensaoExcedente,
      pesoExcedente,
      volumeExcedente,
      emissaoDue,
      impostosDestino,
      total: modelo === 'DHL_IMPORTACAO_FORMAL' ? totalDhl : totalFedex,
    }
  }, [form, modelo])

  function nomeArquivoPdf() {
    const base = referenciaHC || cotacao?.referencia_hc || cotacao?.referencia_cliente || cotacao?.id || 'cotacao-hc'
    const sufixo = modelo === 'DHL_IMPORTACAO_FORMAL' ? 'dhl-importacao-formal' : 'fedex-exportacao'

    return `${base}-${sufixo}.pdf`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_+/g, '_')
  }

  function montarPdf() {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    let y = 12

    function novaPagina(altura = 8) {
      if (y + altura > 282) {
        doc.addPage()
        y = 14
      }
    }

    function secao(titulo: string) {
      novaPagina(14)
      doc.setFillColor(7, 18, 37)
      doc.rect(14, y, 182, 9, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(titulo, 17, y + 6)
      y += 13
    }

    function info(label: string, valor: any) {
      novaPagina(8)
      doc.setTextColor(71, 85, 105)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text(label, 14, y)

      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      const linhas = doc.splitTextToSize(String(valor || '-'), 120)
      doc.text(linhas, 68, y)
      y += Math.max(6, linhas.length * 5)
    }

    function valor(label: string, numeroValor: any) {
      novaPagina(7)
      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(label, 118, y)

      doc.setFont('helvetica', 'bold')
      doc.text(dinheiro(numeroValor), 190, y, { align: 'right' })
      y += 6
    }

    doc.setFillColor(2, 8, 23)
    doc.rect(0, 0, 210, 28, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('HC CONSULTORIA', 14, 13)

    doc.setFontSize(10)
    doc.text('COTAÇÃO COMERCIAL', 14, 21)

    doc.setFontSize(12)
    doc.text(nomeModelo(modelo).toUpperCase(), 196, 15, { align: 'right' })
    doc.setFontSize(9)
    doc.text(new Date().toLocaleDateString('pt-BR'), 196, 22, { align: 'right' })

    y = 38

    secao('DADOS DA COTAÇÃO')
    info('Referência HC', referenciaHC || cotacao?.referencia_hc || '-')
    info('Cliente', form.cliente || '-')
    info('Contato', form.contato || '-')
    info('Origem', form.origem || '-')
    info('Destino', form.destino || '-')
    info('AOD / Formalização', form.aod || '-')
    info('Trânsito estimado', form.transito || '-')
    info('Validade', form.validade || '-')

    secao('PESOS E VOLUMES')
    info('Quantidade de volumes', resumoPesos.volumesTotal || '-')
    info('Peso bruto', kg(resumoPesos.pesoBruto))
    info('Peso dimensional', kg(resumoPesos.pesoDimensional))
    info('Peso taxado', kg(resumoPesos.pesoTaxado))

    if (volumes.length > 0) {
      novaPagina(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 23, 42)
      doc.setFontSize(8)
      doc.text('Qtd', 14, y)
      doc.text('Comp.', 30, y)
      doc.text('Larg.', 50, y)
      doc.text('Alt.', 70, y)
      doc.text('Peso real', 90, y)
      doc.text('Peso dim.', 120, y)
      doc.text('Maior peso', 150, y)
      y += 5
      doc.line(14, y, 196, y)
      y += 5

      volumes.forEach((volume: VolumeCalculado) => {
        novaPagina(7)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(String(volume.quantidade), 14, y)
        doc.text(`${volume.comprimento} cm`, 30, y)
        doc.text(`${volume.largura} cm`, 50, y)
        doc.text(`${volume.altura} cm`, 70, y)
        doc.text(kg(volume.pesoRealUnitario), 90, y)
        doc.text(kg(volume.pesoDimensionalUnitario), 120, y)
        doc.text(kg(volume.maiorPesoUnitario), 150, y)
        y += 6
      })
    }

    secao('VALORES DO ENVIO')
    info(
      'Valor mercadoria',
      `${form.moedaMercadoria || 'USD'} ${numero(form.valorMercadoria).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    )

    valor('Frete', valores.frete)
    valor('Sobretaxa emergencial', valores.sobretaxa)
    valor('Seguro', valores.seguro)

    if (modelo === 'DHL_IMPORTACAO_FORMAL') {
      valor('Área remota', valores.areaRemota)
      valor('DTA', valores.dta)
      valor('Delivery doc fee', valores.deliveryDocFee)
      valor('Dimensão excedente', valores.dimensaoExcedente)
      valor('Peso excedente', valores.pesoExcedente)
    } else {
      valor('Emissão de DUE', valores.emissaoDue)
      valor('Área remota', valores.areaRemota)
      valor('Volume excedente', valores.volumeExcedente)
      valor('Peso excedente', valores.pesoExcedente)
      valor('Impostos no destino', valores.impostosDestino)
    }

    novaPagina(16)
    doc.setFillColor(219, 234, 254)
    doc.rect(114, y, 82, 12, 'F')
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('TOTAL ALL IN USD', 118, y + 8)
    doc.text(dinheiro(valores.total), 192, y + 8, { align: 'right' })
    y += 18

    secao('MERCADORIA E OBSERVAÇÕES')
    info('Descrição', form.descricaoMercadoria || '-')
    info('Observações comerciais', form.observacoesComerciais || '-')

    doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('Cotação sujeita à confirmação de peso, dimensões, documentos, disponibilidade de rota e regras da transportadora.', 14, 286)
    doc.text('HC Consultoria - portal.hcbhz.com', 196, 286, { align: 'right' })

    return doc
  }

  function baixarPdf() {
    montarPdf().save(nomeArquivoPdf())
  }

  async function salvarPdf(enviarEmail: boolean) {
    if (!cotacao?.id) return

    setGerando(true)

    try {
      const doc = montarPdf()
      const blob = doc.output('blob') as Blob
      const arquivo = new File([blob], nomeArquivoPdf(), { type: 'application/pdf' })
      const nomeStorage = `${cotacao.id}-${Date.now()}-${arquivo.name}`

      const { error: erroUpload } = await supabase.storage
        .from('cotacoes')
        .upload(nomeStorage, arquivo, {
          upsert: true,
          contentType: 'application/pdf',
        })

      if (erroUpload) {
        console.log(erroUpload)
        alert('Erro ao salvar PDF gerado.')
        setGerando(false)
        return
      }

      const { data: publicUrl } = supabase.storage
        .from('cotacoes')
        .getPublicUrl(nomeStorage)

      const { data: cotacaoAtualizada, error: erroUpdate } = await supabase
        .from('cotacoes')
        .update({
          pdf_cotacao_url: publicUrl.publicUrl,
          pdf_nome: arquivo.name,
          referencia_hc: referenciaHC || cotacao.referencia_hc || null,
          status: 'COTAÇÃO DISPONÍVEL',
        })
        .eq('id', cotacao.id)
        .select()
        .single()

      if (erroUpdate) {
        console.log(erroUpdate)
        alert('PDF salvo, mas houve erro ao atualizar a cotação.')
        setGerando(false)
        return
      }

      if (enviarEmail) {
        await enviarEmailCotacao(cotacaoAtualizada)
      }

      await onPdfSalvo()
      alert(enviarEmail ? 'PDF gerado, salvo e enviado ao cliente.' : 'PDF gerado e salvo na cotação.')
    } catch (error) {
      console.log(error)
      alert('Erro ao gerar PDF da cotação.')
    } finally {
      setGerando(false)
    }
  }

  return (
    <section className="card mb-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-blue-400">
            Emissor de Cotação HC
          </p>

          <h2 className="mt-2 text-3xl font-black">
            Gerar resposta em PDF
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Escolha o modelo DHL ou FedEx, calcule peso dimensional e gere o PDF da resposta.
          </p>
        </div>

        <div className="rounded-2xl border border-blue-900 bg-[#020817] p-4 text-right">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">
            Total all in
          </p>
          <p className="mt-1 text-3xl font-black text-green-400">
            {dinheiro(valores.total)}
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <ResumoCotacao titulo="Volumes" valor={resumoPesos.volumesTotal || '-'} detalhe="Informados pelo cliente" />
        <ResumoCotacao titulo="Peso bruto" valor={kg(resumoPesos.pesoBruto)} detalhe="Arredondado 0,5 kg" />
        <ResumoCotacao titulo="Peso dimensional" valor={kg(resumoPesos.pesoDimensional)} detalhe="C x L x A / 5000" />
        <ResumoCotacao titulo="Peso taxado" valor={kg(resumoPesos.pesoTaxado)} detalhe="Maior peso" />
      </div>

      <div className="mb-6 rounded-3xl border border-blue-900 bg-[#020817] p-5">
        <h3 className="mb-4 text-xl font-black">Modelo e dados da cotação</h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">
              Modelo
            </span>

            <select
              value={modelo}
              onChange={(e) => setModelo(e.target.value as ModeloCotacao)}
              className="w-full rounded-xl border border-blue-900 bg-[#071225] px-4 py-3 font-bold text-white outline-none"
            >
              <option value="DHL_IMPORTACAO_FORMAL">DHL - Importação Formal</option>
              <option value="FEDEX_EXPORTACAO">FedEx - Exportação</option>
            </select>
          </label>

          <CampoCotacao label="Cliente" value={form.cliente} onChange={(v) => atualizar('cliente', v)} />
          <CampoCotacao label="Contato / e-mail" value={form.contato} onChange={(v) => atualizar('contato', v)} />
          <CampoCotacao label="Origem" value={form.origem} onChange={(v) => atualizar('origem', v)} />
          <CampoCotacao label="Destino" value={form.destino} onChange={(v) => atualizar('destino', v)} />
          <CampoCotacao label="AOD / Formalização" value={form.aod} onChange={(v) => atualizar('aod', v)} />
          <CampoCotacao label="Trânsito estimado" value={form.transito} onChange={(v) => atualizar('transito', v)} />
          <CampoCotacao label="Validade" value={form.validade} onChange={(v) => atualizar('validade', v)} />
        </div>
      </div>

      <div className="mb-6 rounded-3xl border border-blue-900 bg-[#020817] p-5">
        <h3 className="mb-4 text-xl font-black">Seguro da carga</h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <CampoCotacao label="Moeda mercadoria" value={form.moedaMercadoria} onChange={(v) => atualizar('moedaMercadoria', v)} />
          <CampoCotacao label="Valor mercadoria" type="number" value={form.valorMercadoria} onChange={(v) => atualizar('valorMercadoria', v)} />
          <CampoCotacao label="Percentual seguro %" type="number" value={form.percentualSeguro} onChange={(v) => atualizar('percentualSeguro', v)} />
          <CampoCotacao label="Mínimo seguro USD" type="number" value={form.seguroMinimo} onChange={(v) => atualizar('seguroMinimo', v)} />
          <CampoCotacao label="Seguro manual USD" type="number" value={form.seguroManual} onChange={(v) => atualizar('seguroManual', v)} />

          <CheckboxCotacao label="Usar seguro manual" checked={form.usarSeguroManual} onChange={(v) => atualizar('usarSeguroManual', v)} />
          <CheckboxCotacao label="Sem seguro" checked={form.semSeguro} onChange={(v) => atualizar('semSeguro', v)} />
          <ResumoCotacao titulo="Seguro final" valor={dinheiro(valores.seguro)} detalhe="Calculado/editável" />
        </div>
      </div>

      <div className="mb-6 rounded-3xl border border-blue-900 bg-[#020817] p-5">
        <h3 className="mb-4 text-xl font-black">Valores do envio</h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <CampoCotacao label="Frete USD" type="number" value={form.frete} onChange={(v) => atualizar('frete', v)} />
          <CampoCotacao label="Sobretaxa emergencial USD" type="number" value={form.sobretaxa} onChange={(v) => atualizar('sobretaxa', v)} />
          <CampoCotacao label="Área remota USD" type="number" value={form.areaRemota} onChange={(v) => atualizar('areaRemota', v)} />
          <CampoCotacao label="Peso excedente USD" type="number" value={form.pesoExcedente} onChange={(v) => atualizar('pesoExcedente', v)} />

          {modelo === 'DHL_IMPORTACAO_FORMAL' ? (
            <>
              <CampoCotacao label="DTA USD" type="number" value={form.dta} onChange={(v) => atualizar('dta', v)} />
              <CampoCotacao label="Delivery doc fee USD" type="number" value={form.deliveryDocFee} onChange={(v) => atualizar('deliveryDocFee', v)} />
              <CampoCotacao label="Dimensão excedente USD" type="number" value={form.dimensaoExcedente} onChange={(v) => atualizar('dimensaoExcedente', v)} />
            </>
          ) : (
            <>
              <CampoCotacao label="Emissão de DUE USD" type="number" value={form.emissaoDue} onChange={(v) => atualizar('emissaoDue', v)} />
              <CampoCotacao label="Volume excedente USD" type="number" value={form.volumeExcedente} onChange={(v) => atualizar('volumeExcedente', v)} />
              <CampoCotacao label="Impostos no destino USD" type="number" value={form.impostosDestino} onChange={(v) => atualizar('impostosDestino', v)} />
            </>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-3xl border border-blue-900 bg-[#020817] p-5">
        <h3 className="mb-4 text-xl font-black">Observações no PDF</h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CampoTextoCotacao label="Descrição da mercadoria" value={form.descricaoMercadoria} onChange={(v) => atualizar('descricaoMercadoria', v)} />
          <CampoTextoCotacao label="Observações comerciais" value={form.observacoesComerciais} onChange={(v) => atualizar('observacoesComerciais', v)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <button type="button" onClick={baixarPdf} className="rounded-xl bg-slate-700 px-5 py-3 font-bold hover:bg-slate-600">
          Baixar prévia PDF
        </button>

        <button
          type="button"
          onClick={() => salvarPdf(false)}
          disabled={gerando}
          className="rounded-xl bg-blue-600 px-5 py-3 font-bold hover:bg-blue-500 disabled:opacity-60"
        >
          {gerando ? 'Gerando PDF...' : 'Salvar PDF na cotação'}
        </button>

        <button
          type="button"
          onClick={() => salvarPdf(true)}
          disabled={gerando}
          className="rounded-xl bg-green-700 px-5 py-3 font-bold hover:bg-green-600 disabled:opacity-60"
        >
          {gerando ? 'Enviando...' : 'Salvar PDF e enviar ao cliente'}
        </button>
      </div>
    </section>
  )
}

function CampoCotacao({
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
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">{label}</span>
      <input
        type={type}
        step={type === 'number' ? '0.01' : undefined}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-blue-900 bg-[#071225] px-4 py-3 font-bold text-white outline-none focus:border-blue-500"
      />
    </label>
  )
}

function CampoTextoCotacao({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (valor: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">{label}</span>
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[110px] w-full rounded-xl border border-blue-900 bg-[#071225] px-4 py-3 font-bold text-white outline-none focus:border-blue-500"
      />
    </label>
  )
}

function CheckboxCotacao({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (valor: boolean) => void
}) {
  return (
    <label className="flex min-h-[76px] items-center gap-3 rounded-xl border border-blue-900 bg-[#071225] px-4 py-3">
      <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5" />
      <span className="text-sm font-black text-white">{label}</span>
    </label>
  )
}

function ResumoCotacao({
  titulo,
  valor,
  detalhe,
}: {
  titulo: string
  valor: any
  detalhe: string
}) {
  return (
    <div className="rounded-2xl border border-blue-900 bg-[#071225] p-4">
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">{titulo}</p>
      <p className="mt-2 text-2xl font-black text-white">{valor}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{detalhe}</p>
    </div>
  )
}
