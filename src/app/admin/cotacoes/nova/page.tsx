'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { jsPDF } from 'jspdf'
import { supabase } from '@/lib/supabaseClient'
import { AEROPORTOS_BRASIL } from '@/lib/aeroportos-brasil'

type ModeloCotacao = 'DHL_IMPORTACAO_FORMAL' | 'FEDEX_EXPORTACAO'

type VolumeCotacao = {
  quantidade: string
  comprimento_cm: string
  largura_cm: string
  altura_cm: string
  peso_kg: string
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

function arredondarMeioKg(valor: number) {
  return Math.ceil((Number(valor) || 0) / 0.5) * 0.5
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

function nomeModelo(modelo: ModeloCotacao) {
  return modelo === 'FEDEX_EXPORTACAO' ? 'FedEx - Exportação' : 'DHL - Importação Formal'
}

async function imagemBase64(url: string) {
  try {
    const resposta = await fetch(url)

    if (!resposta.ok) return null

    const blob = await resposta.blob()

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

async function buscarLogoHC() {
  const caminhos = [
    '/HC-CONSULTORIA-TRANSPARENTE.png',
    '/logo-hc.png',
    '/logo-hc.jpg',
    '/logo.png',
    '/hc-logo.png',
    '/logo.jpg',
    '/images/logo.png',
    '/assets/logo.png',
  ]

  for (const caminho of caminhos) {
    const imagem = await imagemBase64(caminho)
    if (imagem) return imagem
  }

  return null
}

export default function NovaCotacaoManualPage() {
  const [salvando, setSalvando] = useState(false)
  const [modelo, setModelo] = useState<ModeloCotacao>('DHL_IMPORTACAO_FORMAL')

  const [form, setForm] = useState({
    origem_solicitacao: 'EMAIL',
    solicitante_email: '',
    empresa_solicitante: '',
    solicitante_nome: '',
    responsavel_solicitante: '',
    telefone_solicitante: '',
    referencia_cliente: '',
    referencia_hc: '',
    servico: 'IMPORTAÇÃO FORMAL',
    transportadora: 'DHL',
    origem: '',
    destino: '',
    aod: '',
    transito: '',
    validade: '7 dias',
    moeda: 'USD',
    valor_mercadoria: '',
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
    descricao_mercadoria: '',
    observacoes: '',
  })

  const [volumes, setVolumes] = useState<VolumeCotacao[]>([
    {
      quantidade: '1',
      comprimento_cm: '',
      largura_cm: '',
      altura_cm: '',
      peso_kg: '',
    },
  ])

  const volumesCalculados = useMemo(() => {
    return volumes.map((volume, index) => {
      const quantidade = Math.max(numero(volume.quantidade), 1)
      const comprimento = numero(volume.comprimento_cm)
      const largura = numero(volume.largura_cm)
      const altura = numero(volume.altura_cm)
      const pesoRealUnitario = numero(volume.peso_kg)

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
  }, [volumes])

  const resumo = useMemo(() => {
    const quantidadeVolumes = volumesCalculados.reduce((acc, item) => acc + item.quantidade, 0)
    const pesoReal = volumesCalculados.reduce((acc, item) => acc + item.pesoRealTotal, 0)
    const pesoDimensional = volumesCalculados.reduce((acc, item) => acc + item.pesoDimensionalTotal, 0)
    const pesoTaxado = volumesCalculados.reduce((acc, item) => acc + item.maiorPesoTotal, 0)

    return {
      quantidadeVolumes,
      pesoReal: arredondarMeioKg(pesoReal),
      pesoDimensional: arredondarMeioKg(pesoDimensional),
      pesoTaxado: arredondarMeioKg(pesoTaxado),
    }
  }, [volumesCalculados])

  const valores = useMemo(() => {
    const valorMercadoria = numero(form.valor_mercadoria)
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

  function atualizarCampo(campo: keyof typeof form, valor: string | boolean) {
    setForm((atual) => ({
      ...atual,
      [campo]: valor,
    }))
  }

  function trocarModelo(novoModelo: ModeloCotacao) {
    setModelo(novoModelo)

    if (novoModelo === 'FEDEX_EXPORTACAO') {
      setForm((atual) => ({
        ...atual,
        servico: 'EXPORTAÇÃO',
        transportadora: 'FEDEX',
      }))
      return
    }

    setForm((atual) => ({
      ...atual,
      servico: 'IMPORTAÇÃO FORMAL',
      transportadora: 'DHL',
    }))
  }

  function atualizarVolume(index: number, campo: keyof VolumeCotacao, valor: string) {
    setVolumes((atuais) =>
      atuais.map((volume, i) =>
        i === index
          ? {
              ...volume,
              [campo]: valor,
            }
          : volume
      )
    )
  }

  function adicionarVolume() {
    setVolumes((atuais) => [
      ...atuais,
      {
        quantidade: '1',
        comprimento_cm: '',
        largura_cm: '',
        altura_cm: '',
        peso_kg: '',
      },
    ])
  }

  function removerVolume(index: number) {
    setVolumes((atuais) => atuais.filter((_, i) => i !== index))
  }

  function nomeArquivoPdf(id?: string) {
    const base = form.referencia_hc || form.referencia_cliente || id || 'cotacao-hc'
    const sufixo = modelo === 'DHL_IMPORTACAO_FORMAL' ? 'dhl-importacao-formal' : 'fedex-exportacao'

    return `${base}-${sufixo}.pdf`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_+/g, '_')
  }

  async function montarPdf() {
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

    const logoHC = await buscarLogoHC()

    if (logoHC) {
      try {
        const tipoLogo = logoHC.includes('image/jpeg') || logoHC.includes('image/jpg') ? 'JPEG' : 'PNG'
        doc.addImage(logoHC, tipoLogo, 154, 5, 34, 20)
      } catch (error) {
        console.log('Não foi possível inserir a logo no PDF:', error)
      }
    }

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
    info('Referência HC', form.referencia_hc || '-')
    info('Empresa solicitante', form.empresa_solicitante || '-')
    info('Nome do solicitante', form.solicitante_nome || '-')
    info('Responsável / contato', form.responsavel_solicitante || '-')
    info('Telefone / WhatsApp', form.telefone_solicitante || '-')
    info('E-mail do cliente', form.solicitante_email || '-')
    info('Origem da solicitação', form.origem_solicitacao || '-')
    info('Origem', form.origem || '-')
    info('Destino', form.destino || '-')
    info('AOD / Formalização', form.aod || '-')
    info('Trânsito estimado', form.transito || '-')
    info('Validade', form.validade || '-')

    secao('PESOS E VOLUMES')
    info('Quantidade de volumes', resumo.quantidadeVolumes || '-')
    info('Peso bruto', kg(resumo.pesoReal))
    info('Peso dimensional', kg(resumo.pesoDimensional))
    info('Peso taxado', kg(resumo.pesoTaxado))

    if (volumesCalculados.length > 0) {
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

      volumesCalculados.forEach((volume) => {
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
      `${form.moeda || 'USD'} ${numero(form.valor_mercadoria).toLocaleString('pt-BR', {
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
    info('Descrição da mercadoria', form.descricao_mercadoria || '-')
    info('Observações comerciais', form.observacoes || '-')

    doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('Cotação sujeita à confirmação de peso, dimensões, documentos, disponibilidade de rota e regras da transportadora.', 14, 286)
    doc.text('HC Consultoria - portal.hcbhz.com', 196, 286, { align: 'right' })

    return doc
  }

  async function baixarPdf() {
    const doc = await montarPdf()
    doc.save(nomeArquivoPdf())
  }

  async function salvarCotacao(enviarEmail: boolean) {
    if (enviarEmail && !form.solicitante_email.trim()) {
      alert('Para enviar por e-mail, informe o e-mail do cliente.')
      return
    }

    if (!form.empresa_solicitante.trim() && !form.solicitante_nome.trim()) {
      alert('Informe a empresa solicitante ou o nome do solicitante.')
      return
    }

    setSalvando(true)

    try {
      const dimensoesTexto = volumes
        .map((v) => `${v.quantidade || 1} vol - ${v.comprimento_cm || 0} x ${v.largura_cm || 0} x ${v.altura_cm || 0} cm - ${v.peso_kg || 0} kg`)
        .join(' | ')

      const { data: cotacaoCriada, error } = await supabase
        .from('cotacoes')
        .insert([
          {
            origem_solicitacao: form.origem_solicitacao,
            solicitante_email: form.solicitante_email.trim() || null,
            empresa_solicitante: form.empresa_solicitante || null,
            solicitante_nome: form.solicitante_nome || null,
            responsavel_solicitante: form.responsavel_solicitante || form.solicitante_nome || null,
            telefone_solicitante: form.telefone_solicitante || null,
            cliente_final: form.empresa_solicitante || form.solicitante_nome || null,
            referencia_cliente: form.referencia_cliente || null,
            referencia_hc: form.referencia_hc || null,
            exportador: null,
            importador: null,
            servico: form.servico,
            tipo_operacao: form.servico,
            transportadoras_consulta: [form.transportadora],
            origem: form.origem || null,
            destino: form.destino || null,
            moeda: form.moeda || 'USD',
            valor_mercadoria: form.valor_mercadoria || null,
            descricao_mercadoria: form.descricao_mercadoria || null,
            observacoes: form.observacoes || null,
            volumes,
            dimensoes: dimensoesTexto,
            peso_real: resumo.pesoReal,
            peso_taxado: resumo.pesoTaxado,
            status: 'COTAÇÃO DISPONÍVEL',
          },
        ])
        .select()
        .single()

      if (error) {
        console.log(error)
        alert('Erro ao salvar cotação: ' + error.message)
        setSalvando(false)
        return
      }

      const doc = await montarPdf()
      const blob = doc.output('blob') as Blob
      const arquivo = new File([blob], nomeArquivoPdf(cotacaoCriada.id), { type: 'application/pdf' })
      const nomeStorage = `${cotacaoCriada.id}-${Date.now()}-${arquivo.name}`

      const { error: erroUpload } = await supabase.storage
        .from('cotacoes')
        .upload(nomeStorage, arquivo, {
          upsert: true,
          contentType: 'application/pdf',
        })

      if (erroUpload) {
        console.log(erroUpload)
        alert('Cotação criada, mas houve erro ao salvar o PDF.')
        setSalvando(false)
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
        })
        .eq('id', cotacaoCriada.id)
        .select()
        .single()

      if (erroUpdate) {
        console.log(erroUpdate)
        alert('PDF salvo, mas houve erro ao atualizar a cotação.')
        setSalvando(false)
        return
      }

      if (enviarEmail) {
        const respostaEmail = await fetch('/api/enviar-cotacao-manual', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: form.solicitante_email,
            nome: form.solicitante_nome || form.responsavel_solicitante || form.empresa_solicitante || 'cliente',
            referencia_hc: form.referencia_hc || form.referencia_cliente || cotacaoCriada.id,
            pdf_url: publicUrl.publicUrl,
            pdf_nome: arquivo.name,
            modelo: nomeModelo(modelo),
            total: dinheiro(valores.total),
          }),
        })

        if (!respostaEmail.ok) {
          const erro = await respostaEmail.json().catch(() => null)
          console.log(erro)
          alert('PDF salvo, mas houve erro ao enviar o e-mail.')
          window.location.href = `/admin/cotacoes/${cotacaoAtualizada.id}`
          return
        }
      }

      alert(enviarEmail ? 'Cotação salva e enviada por e-mail.' : 'Cotação salva no histórico.')
      window.location.href = `/admin/cotacoes/${cotacaoAtualizada.id}`
    } catch (error) {
      console.log(error)
      alert('Erro ao processar cotação.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <main className="w-full max-w-none p-8 text-white">
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 font-bold text-blue-400">Comercial</p>
          <h1 className="text-5xl font-black">Emissor de cotação</h1>
          <p className="mt-2 text-lg text-slate-400">
            Preencha tudo em uma única tela, gere o PDF e salve ou envie ao cliente.
          </p>
        </div>

        <a href="/admin/cotacoes" className="rounded-xl bg-slate-700 px-5 py-3 font-bold hover:bg-slate-600">
          Voltar para fila
        </a>
      </div>

      <section className="card mb-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-blue-400">Modelo</p>
            <h2 className="mt-2 text-3xl font-black">Dados principais</h2>
          </div>

          <div className="rounded-2xl border border-blue-900 bg-[#020817] p-4 text-right">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Total all in</p>
            <p className="mt-1 text-3xl font-black text-green-400">{dinheiro(valores.total)}</p>
          </div>
        </div>

        <div className="form-grid">
          <CampoSelect label="Modelo da cotação" value={modelo} onChange={(v) => trocarModelo(v as ModeloCotacao)}>
            <option value="DHL_IMPORTACAO_FORMAL">DHL - Importação Formal</option>
            <option value="FEDEX_EXPORTACAO">FedEx - Exportação</option>
          </CampoSelect>

          <CampoSelect label="Origem da solicitação" value={form.origem_solicitacao} onChange={(v) => atualizarCampo('origem_solicitacao', v)}>
            <option value="EMAIL">E-mail</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="TELEFONE">Telefone</option>
            <option value="MANUAL">Manual</option>
          </CampoSelect>

          <Campo label="Referência HC" value={form.referencia_hc} onChange={(v) => atualizarCampo('referencia_hc', v)} />
          <Campo label="Referência cliente" value={form.referencia_cliente} onChange={(v) => atualizarCampo('referencia_cliente', v)} />
          <Campo label="E-mail do cliente (opcional)" value={form.solicitante_email} onChange={(v) => atualizarCampo('solicitante_email', v)} />
          <Campo label="Empresa solicitante" value={form.empresa_solicitante} onChange={(v) => atualizarCampo('empresa_solicitante', v)} />
          <Campo label="Nome do solicitante" value={form.solicitante_nome} onChange={(v) => atualizarCampo('solicitante_nome', v)} />
          <Campo label="Responsável / contato" value={form.responsavel_solicitante} onChange={(v) => atualizarCampo('responsavel_solicitante', v)} />
          <Campo label="Telefone / WhatsApp" value={form.telefone_solicitante} onChange={(v) => atualizarCampo('telefone_solicitante', v)} />
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="mb-6 text-2xl font-black">Operação</h2>

        <div className="form-grid">
          <CampoSelect label="Serviço" value={form.servico} onChange={(v) => atualizarCampo('servico', v)}>
            <option value="IMPORTAÇÃO FORMAL">Importação formal</option>
            <option value="IMPORTAÇÃO COURIER">Importação courier</option>
            <option value="EXPORTAÇÃO FORMAL">Exportação formal</option>
            <option value="EXPORTAÇÃO COURIER">Exportação courier</option>
            <option value="EXPORTAÇÃO TEMPORÁRIA">Exportação temporária</option>
            <option value="NACIONAL">Nacional</option>
          </CampoSelect>
          <Campo label="Transportadora" value={form.transportadora} onChange={(v) => atualizarCampo('transportadora', v)} />
          <Campo label="Origem" value={form.origem} onChange={(v) => atualizarCampo('origem', v)} />
          <Campo label="Destino" value={form.destino} onChange={(v) => atualizarCampo('destino', v)} />
          <CampoAeroporto label="AOD / Formalização" value={form.aod} onChange={(v) => atualizarCampo('aod', v)} />
          <Campo label="Trânsito estimado" value={form.transito} onChange={(v) => atualizarCampo('transito', v)} />
          <Campo label="Validade" value={form.validade} onChange={(v) => atualizarCampo('validade', v)} />
          <CampoSelect label="Moeda mercadoria" value={form.moeda} onChange={(v) => atualizarCampo('moeda', v)}>
            <option value="USD">USD - Dólar americano</option>
            <option value="EUR">EUR - Euro</option>
            <option value="GBP">GBP - Libra esterlina</option>
            <option value="CNY">CNY - Yuan chinês</option>
            <option value="BRL">BRL - Real brasileiro</option>
            <option value="HKD">HKD - Dólar de Hong Kong</option>
            <option value="JPY">JPY - Iene japonês</option>
            <option value="CHF">CHF - Franco suíço</option>
            <option value="CAD">CAD - Dólar canadense</option>
            <option value="AUD">AUD - Dólar australiano</option>
          </CampoSelect>
          <Campo label="Valor mercadoria" type="number" value={form.valor_mercadoria} onChange={(v) => atualizarCampo('valor_mercadoria', v)} />
        </div>
      </section>

      <section className="card mb-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">Volumes</h2>
            <p className="mt-1 text-sm text-slate-400">Peso dimensional: comprimento x largura x altura / 5000.</p>
          </div>

          <button type="button" onClick={adicionarVolume} className="rounded-xl bg-blue-600 px-5 py-3 font-bold hover:bg-blue-500">
            + Volume
          </button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Resumo titulo="Volumes" valor={resumo.quantidadeVolumes} />
          <Resumo titulo="Peso real" valor={kg(resumo.pesoReal)} />
          <Resumo titulo="Peso dimensional" valor={kg(resumo.pesoDimensional)} />
          <Resumo titulo="Peso taxado" valor={kg(resumo.pesoTaxado)} />
        </div>

        <div className="space-y-4">
          {volumes.map((volume, index) => (
            <div key={index} className="grid grid-cols-1 gap-4 rounded-2xl border border-blue-900 bg-[#020817] p-4 md:grid-cols-6">
              <Campo label="Qtd" value={volume.quantidade} onChange={(v) => atualizarVolume(index, 'quantidade', v)} />
              <Campo label="Comprimento cm" value={volume.comprimento_cm} onChange={(v) => atualizarVolume(index, 'comprimento_cm', v)} />
              <Campo label="Largura cm" value={volume.largura_cm} onChange={(v) => atualizarVolume(index, 'largura_cm', v)} />
              <Campo label="Altura cm" value={volume.altura_cm} onChange={(v) => atualizarVolume(index, 'altura_cm', v)} />
              <Campo label="Peso kg" value={volume.peso_kg} onChange={(v) => atualizarVolume(index, 'peso_kg', v)} />

              <button
                type="button"
                onClick={() => removerVolume(index)}
                disabled={volumes.length === 1}
                className="self-end rounded-xl bg-red-700 px-4 py-3 font-bold hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="mb-6 text-2xl font-black">Seguro</h2>

        <div className="form-grid">
          <Campo label="Percentual seguro %" type="number" value={form.percentualSeguro} onChange={(v) => atualizarCampo('percentualSeguro', v)} />
          <Campo label="Mínimo seguro USD" type="number" value={form.seguroMinimo} onChange={(v) => atualizarCampo('seguroMinimo', v)} />
          <Campo label="Seguro manual USD" type="number" value={form.seguroManual} onChange={(v) => atualizarCampo('seguroManual', v)} />
          <Checkbox label="Usar seguro manual" checked={form.usarSeguroManual} onChange={(v) => atualizarCampo('usarSeguroManual', v)} />
          <Checkbox label="Sem seguro" checked={form.semSeguro} onChange={(v) => atualizarCampo('semSeguro', v)} />
          <Resumo titulo="Seguro final" valor={dinheiro(valores.seguro)} />
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="mb-6 text-2xl font-black">Valores do envio</h2>

        <div className="form-grid">
          <Campo label="Frete USD" type="number" value={form.frete} onChange={(v) => atualizarCampo('frete', v)} />
          <Campo label="Sobretaxa emergencial USD" type="number" value={form.sobretaxa} onChange={(v) => atualizarCampo('sobretaxa', v)} />
          <Campo label="Área remota USD" type="number" value={form.areaRemota} onChange={(v) => atualizarCampo('areaRemota', v)} />
          <Campo label="Peso excedente USD" type="number" value={form.pesoExcedente} onChange={(v) => atualizarCampo('pesoExcedente', v)} />

          {modelo === 'DHL_IMPORTACAO_FORMAL' ? (
            <>
              <Campo label="DTA USD" type="number" value={form.dta} onChange={(v) => atualizarCampo('dta', v)} />
              <Campo label="Delivery doc fee USD" type="number" value={form.deliveryDocFee} onChange={(v) => atualizarCampo('deliveryDocFee', v)} />
              <Campo label="Dimensão excedente USD" type="number" value={form.dimensaoExcedente} onChange={(v) => atualizarCampo('dimensaoExcedente', v)} />
            </>
          ) : (
            <>
              <Campo label="Emissão de DUE USD" type="number" value={form.emissaoDue} onChange={(v) => atualizarCampo('emissaoDue', v)} />
              <Campo label="Volume excedente USD" type="number" value={form.volumeExcedente} onChange={(v) => atualizarCampo('volumeExcedente', v)} />
              <Campo label="Impostos no destino USD" type="number" value={form.impostosDestino} onChange={(v) => atualizarCampo('impostosDestino', v)} />
            </>
          )}
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="mb-6 text-2xl font-black">Mercadoria e observações</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CampoTexto label="Descrição da mercadoria" value={form.descricao_mercadoria} onChange={(v) => atualizarCampo('descricao_mercadoria', v)} />
          <CampoTexto label="Observações comerciais" value={form.observacoes} onChange={(v) => atualizarCampo('observacoes', v)} />
        </div>
      </section>

      <section className="card">
        <div className="flex flex-wrap justify-end gap-4">
          <a href="/admin/cotacoes" className="rounded-xl bg-slate-700 px-5 py-3 font-bold hover:bg-slate-600">
            Cancelar
          </a>

          <button type="button" onClick={baixarPdf} className="rounded-xl bg-slate-700 px-5 py-3 font-bold hover:bg-slate-600">
            Baixar prévia PDF
          </button>

          <button
            type="button"
            onClick={() => salvarCotacao(false)}
            disabled={salvando}
            className="rounded-xl bg-blue-600 px-6 py-3 font-black hover:bg-blue-500 disabled:opacity-60"
          >
            {salvando ? 'Salvando...' : 'Salvar no histórico'}
          </button>

          <button
            type="button"
            onClick={() => salvarCotacao(true)}
            disabled={salvando}
            className="rounded-xl bg-green-700 px-6 py-3 font-black hover:bg-green-600 disabled:opacity-60"
          >
            {salvando ? 'Enviando...' : 'Salvar e enviar por e-mail'}
          </button>
        </div>
      </section>
    </main>
  )
}

function CampoAeroporto({
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
      <span className="mb-2 block text-sm font-bold text-slate-400">{label}</span>

      <input
        list="aeroportos-brasil"
        value={value || ''}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder="Ex.: CNF"
      />

      <datalist id="aeroportos-brasil">
        {AEROPORTOS_BRASIL.map((aeroporto) => (
          <option
            key={aeroporto.sigla}
            value={aeroporto.sigla}
            label={`${aeroporto.sigla} - ${aeroporto.nome} - ${aeroporto.cidade}/${aeroporto.uf}`}
          />
        ))}
      </datalist>

      <p className="mt-1 text-xs font-semibold text-slate-500">
        Digite ou selecione a sigla do aeroporto.
      </p>
    </label>
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
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-400">{label}</span>
      <input type={type} step={type === 'number' ? '0.01' : undefined} value={value || ''} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function CampoSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (valor: string) => void
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-400">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  )
}

function CampoTexto({
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
      <span className="mb-2 block text-sm font-bold text-slate-400">{label}</span>
      <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} className="min-h-[130px] w-full" />
    </label>
  )
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (valor: boolean) => void
}) {
  return (
    <label className="flex min-h-[64px] items-center gap-3 rounded-xl border border-blue-900 bg-[#020817] px-4 py-3">
      <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5" />
      <span className="text-sm font-black text-white">{label}</span>
    </label>
  )
}

function Resumo({ titulo, valor }: { titulo: string; valor: any }) {
  return (
    <div className="rounded-2xl border border-blue-900 bg-[#020817] p-4">
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">{titulo}</p>
      <p className="mt-2 text-2xl font-black text-white">{valor}</p>
    </div>
  )
}
