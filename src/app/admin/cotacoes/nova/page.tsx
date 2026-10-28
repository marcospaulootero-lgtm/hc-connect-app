'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { jsPDF } from 'jspdf'
import { supabase } from '@/lib/supabaseClient'
import { AEROPORTOS_BRASIL } from '@/lib/aeroportos-brasil'
import { useSearchParams } from 'next/navigation'
import { formatarEntradaTaxaBR, formatarEntradaValorBR, numeroValorBR } from '@/lib/valorContabil'

type ModeloCotacao = 'DHL' | 'FEDEX' | 'UPS' | 'AGENTE_CARGA'
type TipoCotacaoUI = 'COURIER' | 'FORMAL' | 'MARITIMO'

const SERVICOS_TRANSPORTADORAS_COTACAO = [
  'IMPORTAÇÃO FORMAL',
  'IMPORTAÇÃO COURIER',
  'EXPORTAÇÃO FORMAL',
  'EXPORTAÇÃO COURIER',
]

const SERVICOS_MODELO_AGENTE = [
  'IMPORTAÇÃO FORMAL',
  'MARÍTIMO',
]

const AGENTES_CARGA_COTACAO = [
  'KPM',
  'CLIPPER',
  'CRONOS LOGISTICS',
]

function normalizarModeloCotacao(valor: any): ModeloCotacao {
  const texto = String(valor || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (
    texto.includes('AGENTE') ||
    texto.includes('CARGA') ||
    texto.includes('KPM') ||
    texto.includes('CLIPPER') ||
    texto.includes('CRONOS')
  ) {
    return 'AGENTE_CARGA'
  }

  if (texto.includes('UPS')) return 'UPS'
  if (texto.includes('FEDEX')) return 'FEDEX'
  if (texto.includes('DHL')) return 'DHL'

  // Sem informação, mantém DHL como padrão inicial.
  if (!texto) return 'DHL'

  // Qualquer outro nome de transportadora é tratado como agente de carga.
  // Isso permite usar agentes digitados manualmente sem perder o modelo.
  return 'AGENTE_CARGA'
}

function transportadoraDoModelo(modelo: ModeloCotacao) {
  if (modelo === 'FEDEX') return 'FEDEX'
  if (modelo === 'UPS') return 'UPS'
  if (modelo === 'DHL') return 'DHL'
  return ''
}

type VolumeCotacao = {
  quantidade: string
  comprimento_cm: string
  largura_cm: string
  altura_cm: string
  peso_kg: string
}

function numero(valor: any) {
  return numeroValorBR(valor)
}

function arredondarMeioKg(valor: number) {
  return Math.ceil((Number(valor) || 0) / 0.5) * 0.5
}

function dinheiro(valor: any, moeda = 'USD') {
  return `${moeda} ${numero(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function resumoTotalMoedas(totais: Record<string, number>) {
  const entradas = Object.entries(totais).filter(([, valor]) => valor > 0)

  if (entradas.length === 0) return 'USD 0,00'

  return entradas
    .map(([moeda, valor]) => dinheiro(valor, moeda))
    .join(' + ')
}

function kg(valor: any) {
  return `${numero(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kg`
}

function nomeModelo(modelo: ModeloCotacao) {
  if (modelo === 'AGENTE_CARGA') return 'Agente de carga'
  if (modelo === 'FEDEX') return 'FedEx'
  if (modelo === 'UPS') return 'UPS'
  return 'DHL'
}


async function otimizarImagemBase64Pdf(dataUrl: string, larguraMax = 480) {
  try {
    return await new Promise<string>((resolve) => {
      const img = new Image()

      img.onload = () => {
        const larguraOriginal = img.naturalWidth || img.width
        const alturaOriginal = img.naturalHeight || img.height

        if (
          !larguraOriginal ||
          !alturaOriginal ||
          larguraOriginal <= larguraMax
        ) {
          resolve(dataUrl)
          return
        }

        const escala = larguraMax / larguraOriginal
        const largura = Math.max(1, Math.round(larguraOriginal * escala))
        const altura = Math.max(1, Math.round(alturaOriginal * escala))

        const canvas = document.createElement('canvas')
        canvas.width = largura
        canvas.height = altura

        const ctx = canvas.getContext('2d')

        if (!ctx) {
          resolve(dataUrl)
          return
        }

        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.clearRect(0, 0, largura, altura)
        ctx.drawImage(img, 0, 0, largura, altura)

        resolve(canvas.toDataURL('image/png'))
      }

      img.onerror = () => resolve(dataUrl)
      img.src = dataUrl
    })
  } catch {
    return dataUrl
  }
}

async function buscarLogoHCPdf() {
  const imagem = await buscarLogoHC()

  if (!imagem) return null

  return otimizarImagemBase64Pdf(imagem, 480)
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

async function imagemComOpacidade(dataUrl: string, opacidade = 0.10) {
  try {
    return await new Promise<string>((resolve) => {
      const img = new Image()

      img.onload = () => {
        const largura = img.naturalWidth || img.width
        const altura = img.naturalHeight || img.height

        const canvas = document.createElement('canvas')
        canvas.width = largura
        canvas.height = altura

        const ctx = canvas.getContext('2d')

        if (!ctx) {
          resolve(dataUrl)
          return
        }

        ctx.clearRect(0, 0, largura, altura)
        ctx.drawImage(img, 0, 0, largura, altura)

        const imagem = ctx.getImageData(0, 0, largura, altura)
        const pixels = imagem.data

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i]
          const g = pixels[i + 1]
          const b = pixels[i + 2]
          const a = pixels[i + 3]

          const muitoClaro = r > 225 && g > 225 && b > 225
          const quaseCinzaClaro = Math.abs(r - g) < 8 && Math.abs(g - b) < 8 && r > 215

          if (muitoClaro || quaseCinzaClaro || a < 18) {
            pixels[i + 3] = 0
          } else {
            pixels[i + 3] = Math.round(a * opacidade)
          }
        }

        ctx.putImageData(imagem, 0, 0)

        resolve(canvas.toDataURL('image/png'))
      }

      img.onerror = () => resolve(dataUrl)
      img.src = dataUrl
    })
  } catch {
    return dataUrl
  }
}


// HC_SERVICOS_AGENTE_ORDEM_ALFABETICA_V1
const SERVICOS_AGENTE_CARGA = [
  'Ad Valorem',
  'Adicional DTA',
  'Administration Fee',
  'Airline Docs Release',
  'Airport Transfer',
  'AMS-AWB',
  'Armazenagem Aérea',
  'AWB Fee',
  'Coleta',
  'Collect Fee',
  'Customs Clearance',
  'Delivery Fee',
  'Desconsolidação',
  'DESCONTO',
  'Desembaraço Aduaneiro',
  'Destination Charges',
  'DGR Fee',
  'Documentation Fee',
  'DTA - Trânsito Aduaneiro',
  'Ex Works',
  'Export Log Fee',
  'EXW Charges',
  'FCA Charges',
  'Frete Internacional',
  'Fuel',
  'Handling',
  'Handling Destino',
  'Insurance',
  'IOF',
  'Local Charges',
  'Pick Up',
  'SAF',
  'Serviços de seguro de carga',
  'Taxa Origem',
  'Teste Magnético',
  'THC Aéreo',
  'X-Ray Charge',
]


const CODIGOS_PAISES_COTACAO = [
  'BR','CN','US','DE','GB','PT','ES','FR','IT','NL','BE','CH','AT','SE','NO','DK','FI','IE',
  'JP','KR','TW','HK','SG','IN','ID','MY','TH','VN','AE','SA','TR','IL','CA','MX','AR','CL',
  'CO','PE','UY','PY','BO','EC','AU','NZ','ZA','EG','MA','PL','CZ','SK','HU','RO','BG','GR',
  'SI','HR','RS','RU','UA','QA','KW','KY','BH','OM','JO','LB','AF','AL','DZ','AD','AO','AG','AM',
  'AZ','BS','BD','BB','BY','BZ','BJ','BT','BA','BW','BN','BF','BI','CV','KH','CM','CF','TD',
  'KM','CG','CD','CR','CI','CU','CY','DJ','DM','DO','SV','ER','EE','ET','FJ','GA','GM','GE',
  'GH','GD','GT','GN','GW','GY','HT','HN','IS','IQ','JM','KZ','KE','KG','LA','LV','LS','LR',
  'LY','LI','LT','LU','MG','MW','MV','ML','MT','MR','MU','MD','MC','MN','ME','MZ','MM','NA',
  'NP','NI','NE','NG','MK','PK','PA','PG','PH','RW','SN','SC','SL','SO','LK','SD','SR','TJ',
  'TZ','TG','TN','TM','UG','UZ','VE','YE','ZM','ZW'
] as const

const displayPaisesCotacao =
  typeof Intl !== 'undefined' && (Intl as any).DisplayNames
    ? new (Intl as any).DisplayNames(['pt-BR'], { type: 'region' })
    : null

const PAISES_COTACAO = CODIGOS_PAISES_COTACAO
  .map((codigo) => {
    const nome = displayPaisesCotacao?.of?.(codigo) || codigo
    return `${nome} (${codigo})`
  })
  .sort((a, b) => a.localeCompare(b, 'pt-BR'))


const INCOTERMS_COTACAO = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP']
const INCOTERMS_MARITIMOS = ['FOB', 'CFR', 'CIF', 'FAS', 'EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP']

const TRANSPORTADORAS_COTACAO = [
  'FedEx',
  'DHL',
  'UPS',
  'KPM',
  'CLIPPER',
  'CRONOS LOGISTICS',
]

type ItemServicoEnvioCotacao = {
  id: string
  descricao: string
  moeda: string
  valor: string
  observacao: string
}

const SERVICOS_ENVIO_COTACAO = [
  'Frete Internacional',
  'Sobretaxa emergencial',
  'Área remota',
  'Peso excedente',
  'Dimensão excedente',
  'Volume excedente',
  'DTA',
  'Delivery doc fee',
  'Emissão de DUE',
  'Impostos no destino',
  'Manuseio formal',
  'DGR',
  'Tarifa adicional p/ carga não empilhável',
  'Oversize piece',
  'Taxa de alta demanda',
  'Entrega fora da área',
  'Handling',
  'AWB Fee',
  'Desembaraço',
  'Armazenagem',
  'Taxas aeroportuárias',
  'Outras taxas',
]

function novoItemServicoEnvioCotacao(
  descricao = 'Frete Internacional',
  moeda = 'USD'
): ItemServicoEnvioCotacao {
  return {
    id: `cotacao-servico-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    descricao,
    moeda,
    valor: '',
    observacao: '',
  }
}

function gerarReferenciaHCCotacao() {
  const agora = new Date()
  const ano = String(agora.getFullYear()).slice(-2)
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  const hora = String(agora.getHours()).padStart(2, '0')
  const minuto = String(agora.getMinutes()).padStart(2, '0')
  const segundo = String(agora.getSeconds()).padStart(2, '0')

  return `HCQ${ano}${mes}${dia}-${hora}${minuto}${segundo}`
}

function itensEnvioCotacaoLegados(formLegado: any): ItemServicoEnvioCotacao[] {
  const mapa: Array<[string, string]> = [
    ['Frete Internacional', 'frete'],
    ['Sobretaxa emergencial', 'sobretaxa'],
    ['Área remota', 'areaRemota'],
    ['Peso excedente', 'pesoExcedente'],
    ['Dimensão excedente', 'dimensaoExcedente'],
    ['Volume excedente', 'volumeExcedente'],
    ['DTA', 'dta'],
    ['Delivery doc fee', 'deliveryDocFee'],
    ['Emissão de DUE', 'emissaoDue'],
    ['Impostos no destino', 'impostosDestino'],
  ]

  const itens = mapa
    .filter(([, campo]) => numero(formLegado?.[campo]) > 0)
    .map(([descricao, campo]) => ({
      ...novoItemServicoEnvioCotacao(descricao),
      valor: String(formLegado?.[campo] || ''),
    }))

  return itens.length > 0 ? itens : [novoItemServicoEnvioCotacao()]
}

export default function NovaCotacaoManualPage() {
  const searchParams = useSearchParams()
  const cotacaoEditandoId = searchParams.get('editar')
  const [salvando, setSalvando] = useState(false)
  const [modelo, setModelo] = useState<ModeloCotacao>('DHL')
  const [dadosEmissorBase, setDadosEmissorBase] = useState<any>({})

  const [form, setForm] = useState({
    origem_solicitacao: 'EMAIL',
    solicitante_email: '',
    empresa_solicitante: '',
    solicitante_nome: '',
    responsavel_solicitante: '',
    telefone_solicitante: '',
    referencia_cliente: '',
    referencia_hc: cotacaoEditandoId ? '' : gerarReferenciaHCCotacao(),
    servico: 'IMPORTAÇÃO FORMAL',
    transportadora: 'DHL',
    origem: '',
    destino: '',
    aod: '',
    transito: '',
    validade: '7 dias',
    moeda: 'USD',
    valor_mercadoria: '',
    pesoTaxadoManualAgente: '',
    incoterm: 'EXW',
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

  const [itensEnvio, setItensEnvio] = useState<ItemServicoEnvioCotacao[]>([
    novoItemServicoEnvioCotacao(),
  ])

  const usarCamposAgente = modelo === 'AGENTE_CARGA'
  const ehMaritimo =
    usarCamposAgente &&
    String(form.servico || '').trim().toUpperCase() === 'MARÍTIMO'
  const usarTabelaServicosAgente = usarCamposAgente && !ehMaritimo // HC_EMISSOR_COTACAO_V2
  const tipoCotacaoSelecionado: TipoCotacaoUI = ehMaritimo
    ? 'MARITIMO'
    : usarCamposAgente
      ? 'FORMAL'
      : 'COURIER'
  const divisorPesoDimensional = usarCamposAgente ? 6000 : 5000
  const transportadoraSeguro = String(form.transportadora || '')
    .trim()
    .toUpperCase()

  const seguroFedexUpsAtivo =
    transportadoraSeguro.includes('FEDEX') ||
    transportadoraSeguro.includes('UPS')

  const seguroAgenteManual = modelo === 'AGENTE_CARGA'


  useEffect(() => {
    if (!cotacaoEditandoId) return

    async function carregarCotacaoParaEdicao() {
      const { data, error } = await supabase
        .from('cotacoes')
        .select('*')
        .eq('id', cotacaoEditandoId)
        .single()

      if (error || !data) {
        console.log(error)
        alert('Não foi possível carregar a cotação para edição.')
        return
      }

      const dadosEmissor =
        data.dados_emissor &&
        typeof data.dados_emissor === 'object' &&
        !Array.isArray(data.dados_emissor)
          ? data.dados_emissor
          : {}

      setDadosEmissorBase(dadosEmissor)

      if (dadosEmissor?.form) {
        setForm((atual) => ({
          ...atual,
          ...dadosEmissor.form,
          solicitante_nome:
            dadosEmissor.form.solicitante_nome ||
            dadosEmissor.form.responsavel_solicitante ||
            '',
          referencia_hc:
            dadosEmissor.form.referencia_hc ||
            data.referencia_hc ||
            atual.referencia_hc ||
            gerarReferenciaHCCotacao(),
        }))

        if (Array.isArray(dadosEmissor.itensEnvio) && dadosEmissor.itensEnvio.length > 0) {
          setItensEnvio(
            dadosEmissor.itensEnvio.map((item: any) => ({
              id: String(item.id || novoItemServicoEnvioCotacao().id),
              descricao: String(item.descricao || item.servico || ''),
              moeda: String(item.moeda || 'USD'),
              valor: String(item.valor || ''),
              observacao: String(item.observacao || ''),
            }))
          )
        } else if (normalizarModeloCotacao(dadosEmissor.modelo) !== 'AGENTE_CARGA') {
          setItensEnvio(itensEnvioCotacaoLegados(dadosEmissor.form))
        }

        if (Array.isArray(dadosEmissor.volumes) && dadosEmissor.volumes.length > 0) {
          setVolumes(
            dadosEmissor.volumes.map((v: any) => ({
              quantidade: String(v.quantidade || v.qtd || 1),
              comprimento_cm: String(v.comprimento_cm || v.comprimento || ''),
              largura_cm: String(v.largura_cm || v.largura || ''),
              altura_cm: String(v.altura_cm || v.altura || ''),
              peso_kg: String(v.peso_kg || v.peso || ''),
            }))
          )
        }

        if (Array.isArray(dadosEmissor.itensAgente)) {
          setItensAgente(dadosEmissor.itensAgente)
        }

        if (dadosEmissor.modelo) {
          setModelo(normalizarModeloCotacao(dadosEmissor.modelo))
        }

        return
      }

      setForm((atual) => ({
        ...atual,
        origem_solicitacao: data.origem_solicitacao || atual.origem_solicitacao,
        solicitante_email: data.solicitante_email || '',
        empresa_solicitante: data.empresa_solicitante || data.cliente_final || '',
        solicitante_nome:
          data.solicitante_nome ||
          data.responsavel_solicitante ||
          '',
        responsavel_solicitante: data.responsavel_solicitante || '',
        telefone_solicitante: data.telefone_solicitante || '',
        referencia_cliente: data.referencia_cliente || '',
        referencia_hc: data.referencia_hc || gerarReferenciaHCCotacao(),
        servico: data.servico || data.tipo_operacao || atual.servico,
        transportadora: Array.isArray(data.transportadoras_consulta)
          ? data.transportadoras_consulta[0] || atual.transportadora
          : atual.transportadora,
        origem: data.origem || '',
        destino: data.destino || '',
        moeda: data.moeda || atual.moeda || 'USD',
        valor_mercadoria: data.valor_mercadoria ? String(data.valor_mercadoria) : '',
        descricao_mercadoria: data.descricao_mercadoria || '',
        observacoes: data.observacoes || '',
      }))

      if (Array.isArray(data.volumes) && data.volumes.length > 0) {
        setVolumes(
          data.volumes.map((v: any) => ({
            quantidade: String(v.quantidade || v.qtd || 1),
            comprimento_cm: String(v.comprimento_cm || v.comprimento || ''),
            largura_cm: String(v.largura_cm || v.largura || ''),
            altura_cm: String(v.altura_cm || v.altura || ''),
            peso_kg: String(v.peso_kg || v.peso || ''),
          }))
        )
      }

      const transportadora = Array.isArray(data.transportadoras_consulta)
        ? String(data.transportadoras_consulta[0] || '').toUpperCase()
        : ''

      const servico = String(data.servico || data.tipo_operacao || '').toUpperCase()

      setModelo(normalizarModeloCotacao(transportadora))
    }

    carregarCotacaoParaEdicao()
  }, [cotacaoEditandoId])

  const volumesCalculados = useMemo(() => {
    return volumes.map((volume, index) => {
      const quantidade = Math.max(numero(volume.quantidade), 1)
      const comprimento = numero(volume.comprimento_cm)
      const largura = numero(volume.largura_cm)
      const altura = numero(volume.altura_cm)
      const pesoRealUnitario = numero(volume.peso_kg)

      const pesoDimensionalUnitario = (comprimento * largura * altura) / divisorPesoDimensional
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
  }, [volumes, divisorPesoDimensional])

  const resumo = useMemo(() => {
    const quantidadeVolumes = volumesCalculados.reduce((acc, item) => acc + item.quantidade, 0)
    const pesoReal = volumesCalculados.reduce((acc, item) => acc + item.pesoRealTotal, 0)
    const pesoDimensional = volumesCalculados.reduce((acc, item) => acc + item.pesoDimensionalTotal, 0)
    const pesoTaxadoAutomaticoBruto = volumesCalculados.reduce((acc, item) => acc + item.maiorPesoTotal, 0)

    const pesoTaxadoAutomatico =
      arredondarMeioKg(
        pesoTaxadoAutomaticoBruto
      )

    const pesoTaxadoManual =
      usarCamposAgente
        ? numero(
            form.pesoTaxadoManualAgente
          )
        : 0

    const pesoTaxadoFinal =
      pesoTaxadoManual > 0
        ? pesoTaxadoManual
        : pesoTaxadoAutomatico

    return {
      quantidadeVolumes,

      pesoReal:
        arredondarMeioKg(
          pesoReal
        ),

      pesoDimensional:
        arredondarMeioKg(
          pesoDimensional
        ),

      pesoTaxado:
        pesoTaxadoFinal,

      pesoTaxadoAutomatico,

      pesoTaxadoManualAtivo:
        usarCamposAgente &&
        pesoTaxadoManual > 0,
    }
  }, [
    volumesCalculados,
    usarCamposAgente,
    form.pesoTaxadoManualAgente,
  ])
const valores = useMemo(() => {
    const valorMercadoria = numero(form.valor_mercadoria)
    const percentualSeguro = numero(form.percentualSeguro)
    const seguroMinimo = numero(form.seguroMinimo)
    const seguroManual = numero(form.seguroManual)

    const seguroAutomatico = seguroFedexUpsAtivo
      ? (valorMercadoria / 100) * 1.30
      : Math.max(
          valorMercadoria * (percentualSeguro / 100),
          seguroMinimo
        )

    const seguro = form.semSeguro
      ? 0
      : seguroAgenteManual
        ? seguroManual
        : form.usarSeguroManual
          ? seguroManual
          : seguroAutomatico

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

    const totalServicosUsd = itensEnvio.reduce((acc, item) => {
      if (String(item.moeda || 'USD').toUpperCase() !== 'USD') return acc
      return acc + numero(item.valor)
    }, 0)

    const totalDhl = seguro + totalServicosUsd
    const totalFedex = seguro + totalServicosUsd

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
      total: seguro + totalServicosUsd,
    }
  }, [form, itensEnvio, seguroFedexUpsAtivo, seguroAgenteManual])

    const [itensAgente, setItensAgente] = useState(() =>
    SERVICOS_AGENTE_CARGA.map((servico) => ({
      usar: false,
      servico,
      moeda: 'USD',
      valor: '',
      observacao: '',
    }))
  )

const totaisAgenteMoedaTela = useMemo(() => {
    return itensAgente.reduce<Record<string, number>>((acc, item) => {
      if (!item.usar) return acc

      const moeda = item.moeda || 'USD'
      const valor = numero(item.valor)

      if (valor <= 0) return acc

      acc[moeda] = (acc[moeda] || 0) + valor

      return acc
    }, {})
  }, [itensAgente])

  const totaisEnvioMoedaTela = useMemo(() => {
    const totais = itensEnvio.reduce<Record<string, number>>((acc, item) => {
      if (!item.descricao.trim()) return acc

      const moeda = String(item.moeda || 'USD').toUpperCase()
      const valorItem = numero(item.valor)

      if (valorItem <= 0) return acc

      acc[moeda] = (acc[moeda] || 0) + valorItem
      return acc
    }, {})

    if (valores.seguro > 0) {
      const moedaSeguro =
        String(
          form.moeda || 'USD'
        ).toUpperCase()

      totais[moedaSeguro] =
        (totais[moedaSeguro] || 0) +
        valores.seguro
    }

    return totais
  }, [
    itensEnvio,
    valores.seguro,
    form.moeda,
  ])

  function atualizarItemAgente(
    index: number,
    campo: 'usar' | 'servico' | 'moeda' | 'valor' | 'observacao',
    valor: string | boolean
  ) {
    setItensAgente((atuais) =>
      atuais.map((item, i) =>
        i === index
          ? {
              ...item,
              [campo]: valor,
            }
          : item
      )
    )
  }

  function atualizarItemEnvio(
    index: number,
    campo: 'descricao' | 'moeda' | 'valor' | 'observacao',
    valor: string
  ) {
    setItensEnvio((atuais) =>
      atuais.map((item, i) =>
        i === index
          ? {
              ...item,
              [campo]: valor,
            }
          : item
      )
    )
  }

  function adicionarItemEnvio() {
    setItensEnvio((atuais) => [
      ...atuais,
      novoItemServicoEnvioCotacao(''),
    ])
  }

  function removerItemEnvio(index: number) {
    setItensEnvio((atuais) => {
      const proximos = atuais.filter((_, i) => i !== index)
      return proximos.length > 0
        ? proximos
        : [novoItemServicoEnvioCotacao()]
    })
  }

  function atualizarCampo(campo: keyof typeof form, valor: string | boolean) {
    setForm((atual) => ({
      ...atual,
      [campo]: valor,
    }))
  }

  function escolherTipoCotacao(tipo: TipoCotacaoUI) {
    if (tipo === 'MARITIMO') {
      setModelo('AGENTE_CARGA')
      setForm((atual) => ({
        ...atual,
        servico: 'MARÍTIMO',
        transportadora: ['DHL', 'FEDEX', 'UPS'].includes(
          String(atual.transportadora || '').trim().toUpperCase()
        )
          ? ''
          : atual.transportadora,
        incoterm: ['FOB', 'CFR', 'CIF', 'FAS'].includes(
          String(atual.incoterm || '').toUpperCase()
        )
          ? atual.incoterm
          : 'FOB',
      }))
      return
    }

    if (tipo === 'FORMAL') {
      setModelo('AGENTE_CARGA')
      setForm((atual) => ({
        ...atual,
        servico: 'IMPORTAÇÃO FORMAL',
        transportadora: ['DHL', 'FEDEX', 'UPS'].includes(
          String(atual.transportadora || '').trim().toUpperCase()
        )
          ? ''
          : atual.transportadora,
      }))
      return
    }

    const modeloCourier: ModeloCotacao =
      modelo === 'DHL' || modelo === 'FEDEX' || modelo === 'UPS'
        ? modelo
        : 'DHL'

    setModelo(modeloCourier)
    setForm((atual) => ({
      ...atual,
      servico: String(atual.servico || '').toUpperCase().includes('COURIER')
        ? atual.servico
        : 'IMPORTAÇÃO COURIER',
      transportadora: transportadoraDoModelo(modeloCourier),
    }))
  }

  const cbmTotal = useMemo(() => {
    return volumes.reduce((total, volume) => {
      const quantidade = Math.max(numero(volume.quantidade), 1)
      const comprimento = numero(volume.comprimento_cm)
      const largura = numero(volume.largura_cm)
      const altura = numero(volume.altura_cm)
      return total + (quantidade * comprimento * largura * altura) / 1000000
    }, 0)
  }, [volumes])

  function trocarModelo(novoModelo: ModeloCotacao) {
    setModelo(novoModelo)

    setForm((atual) => {
      if (novoModelo === 'AGENTE_CARGA') {
        const agenteAtual = String(atual.transportadora || '').trim()
        const transportadoraAtual = agenteAtual.toUpperCase()

        const manterAgente =
          agenteAtual &&
          !['DHL', 'FEDEX', 'UPS'].includes(transportadoraAtual)

        return {
          ...atual,
          servico: SERVICOS_MODELO_AGENTE.includes(String(atual.servico))
            ? atual.servico
            : 'IMPORTAÇÃO FORMAL',
          transportadora: manterAgente ? agenteAtual : '',
        }
      }

      return {
        ...atual,
        servico: SERVICOS_TRANSPORTADORAS_COTACAO.includes(
          String(atual.servico)
        )
          ? atual.servico
          : 'IMPORTAÇÃO FORMAL',
        transportadora: transportadoraDoModelo(novoModelo),
      }
    })
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
    const base =
      form.referencia_hc ||
      form.referencia_cliente ||
      id ||
      'cotacao-hc'

    const sufixo =
      modelo === 'AGENTE_CARGA'
        ? 'agente-carga'
        : modelo.toLowerCase()

    return (base + '-' + sufixo + '.pdf')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_+/g, '_')
  }

  async function montarPdf() {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const LIMITE_CONTEUDO = 258
    const Y_INICIAL_NOVA_PAGINA = 20
    const Y_RODAPE = 276
    const ALTURA_LINHA_INFO = 5

    let y = 12
    let rodapeInseridoNaPaginaAtual = false

    function adicionarPaginaConteudo() {
      inserirRodapePdf()
      doc.addPage()
      y = Y_INICIAL_NOVA_PAGINA
      rodapeInseridoNaPaginaAtual = false
    }

    function novaPagina(altura = 8) {
      if (y + altura > LIMITE_CONTEUDO) {
        adicionarPaginaConteudo()
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
      const linhas = doc.splitTextToSize(String(valor || '-'), 120) as string[]
      let indiceLinha = 0
      let continuacao = false

      while (indiceLinha < linhas.length) {
        novaPagina(8)

        const linhasQueCabem = Math.max(
          1,
          Math.floor((LIMITE_CONTEUDO - y) / ALTURA_LINHA_INFO) + 1
        )
        const trecho = linhas.slice(indiceLinha, indiceLinha + linhasQueCabem)

        doc.setTextColor(71, 85, 105)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.text(continuacao ? `${label} (cont.)` : label, 14, y)

        doc.setTextColor(15, 23, 42)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text(trecho, 68, y)

        y += Math.max(6, trecho.length * ALTURA_LINHA_INFO)
        indiceLinha += trecho.length

        if (indiceLinha < linhas.length) {
          adicionarPaginaConteudo()
          continuacao = true
        }
      }
    }

    function valor(label: string, numeroValor: any, moeda = 'USD') {
      const valorNumerico = numero(numeroValor)

      if (valorNumerico <= 0) return

      novaPagina(7)
      doc.setTextColor(15, 23, 42)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(label, 118, y)

      doc.setFont('helvetica', 'bold')
      doc.text(dinheiro(valorNumerico, moeda), 190, y, { align: 'right' })
      y += 6
    }

    doc.setFillColor(2, 8, 23)
    doc.rect(0, 0, 210, 28, 'F')

    const logoHC = await buscarLogoHCPdf()

    async function inserirMarcaDaguaLogoDados() {
      if (!logoHC) return

      try {
        const logoTransparente = await imagemComOpacidade(logoHC, 0.10)
        doc.addImage(logoTransparente, 'PNG', 112, 55, 76, 50)
      } catch (error) {
        console.log('Não foi possível inserir a marca d água da logo:', error)
      }
    }

    function inserirRodapePdf() {
      if (rodapeInseridoNaPaginaAtual) return

      doc.setDrawColor(203, 213, 225)
      doc.line(14, Y_RODAPE - 6, 196, Y_RODAPE - 6)

      doc.setTextColor(100, 116, 139)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)

      const textoRodape = doc.splitTextToSize(
        'Cotação sujeita à confirmação de peso, dimensões, documentação, disponibilidade de rota, regras da transportadora, validade informada nesta proposta e demais condições operacionais.',
        128
      )

      doc.text(textoRodape, 14, Y_RODAPE)

      doc.setFont('helvetica', 'bold')
      doc.text('HC Consultoria', 196, Y_RODAPE, { align: 'right' })

      doc.setFont('helvetica', 'normal')
      doc.text('portal.hcbhz.com', 196, Y_RODAPE + 4, { align: 'right' })

      rodapeInseridoNaPaginaAtual = true
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
    await inserirMarcaDaguaLogoDados()

    info('Referência HC', form.referencia_hc || '-')
    if (String(form.referencia_cliente || '').trim()) {
      info('Referência cliente', form.referencia_cliente)
    }
    info('Empresa solicitante', form.empresa_solicitante || '-')
    info('Solicitante / contato', form.solicitante_nome || '-')
    if (String(form.solicitante_email || '').trim()) {
      info('E-mail do cliente', form.solicitante_email)
    }
    info('Operação', form.servico || '-')
    info('Origem', form.origem || '-')
    info('Destino', form.destino || '-')
    info('Incoterm', form.incoterm || '-')
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

    if (usarTabelaServicosAgente) {
      itensAgente
        .filter((item) => item.usar && numero(item.valor) > 0)
        .forEach((item) => {
          info(
            item.servico,
            `${item.moeda || 'USD'} ${numero(item.valor).toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          )
        })
    } else {
      itensEnvio
        .filter((item) => item.descricao.trim() && numero(item.valor) > 0)
        .forEach((item) => {
          info(
            item.descricao,
            `${String(item.moeda || 'USD').toUpperCase()} ${numero(item.valor).toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          )
        })
    }

    if (valores.seguro > 0) {
      info(
        'Seguro',
        dinheiro(
          valores.seguro,
          String(form.moeda || 'USD').toUpperCase()
        )
      )
    }

    // HC_PDF_TOTAL_ALL_IN_V1
    novaPagina(22)

    const totalAllInPdf = usarTabelaServicosAgente
      ? resumoTotalMoedas(totaisAgenteMoedaTela)
      : resumoTotalMoedas(totaisEnvioMoedaTela)

    // Caixa ampla em duas linhas para impedir sobreposição em totais multimoeda.
    const totalBoxX = 30
    const totalBoxW = 166
    const totalBoxH = 18

    doc.setFillColor(219, 234, 254)
    doc.rect(totalBoxX, y, totalBoxW, totalBoxH, 'F')
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')

    doc.setFontSize(9)
    doc.text('TOTAL ALL IN', totalBoxX + 5, y + 6)

    // Fonte adaptativa conforme o comprimento do total.
    const tamanhoFonteTotal =
      totalAllInPdf.length > 52
        ? 7.5
        : totalAllInPdf.length > 40
          ? 8
          : 9.5

    doc.setFontSize(tamanhoFonteTotal)
    doc.text(totalAllInPdf, totalBoxX + totalBoxW - 5, y + 13, {
      align: 'right',
    })

    y += 24

    secao('MERCADORIA E OBSERVAÇÕES')
    info('Descrição da mercadoria', form.descricao_mercadoria || '-')
    info('Observações comerciais', form.observacoes || '-')

    inserirRodapePdf()

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

      const itensEnvioPersistidos = itensEnvio.map((item) => ({
        ...item,
        valor: numero(item.valor),
      }))

      const itensAgentePersistidos = itensAgente.map((item) => ({
        ...item,
        valor: numero(item.valor),
      }))

      const payloadCotacao = {
            origem_solicitacao: 'MANUAL',
            solicitante_email: form.solicitante_email.trim() || null,
            empresa_solicitante: form.empresa_solicitante || null,
            solicitante_nome: form.solicitante_nome || null,
            responsavel_solicitante: form.solicitante_nome || null,
            telefone_solicitante: null,
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
            valor_mercadoria: numero(form.valor_mercadoria) || null,
            descricao_mercadoria: form.descricao_mercadoria || null,
            observacoes: form.observacoes || null,
            volumes,
            dimensoes: dimensoesTexto,
            peso_real: resumo.pesoReal,
            peso_taxado: resumo.pesoTaxado,
            status: 'COTAÇÃO DISPONÍVEL',
            dados_emissor: {
              ...dadosEmissorBase,
              modelo,
              form,
              volumes,
              itensEnvio: itensEnvioPersistidos,
              itensAgente: usarTabelaServicosAgente ? itensAgentePersistidos : [],
              resumo,
              valores,
              totaisAgenteMoeda: usarTabelaServicosAgente ? totaisAgenteMoedaTela : {},
              atualizado_em: new Date().toISOString(),
            },
      }

      const operacaoCotacao = cotacaoEditandoId
        ? supabase.from('cotacoes').update(payloadCotacao).eq('id', cotacaoEditandoId)
        : supabase.from('cotacoes').insert([payloadCotacao])

      const { data: cotacaoCriada, error } = await operacaoCotacao.select().single()

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
            nome: form.solicitante_nome || form.empresa_solicitante || 'cliente',
            referencia_hc: form.referencia_hc || form.referencia_cliente || cotacaoCriada.id,
            pdf_url: publicUrl.publicUrl,
            pdf_nome: arquivo.name,
            modelo: nomeModelo(modelo),
            total: usarTabelaServicosAgente ? resumoTotalMoedas(totaisAgenteMoedaTela) : resumoTotalMoedas(totaisEnvioMoedaTela),
          }),
        })

        if (!respostaEmail.ok) {
          const erro = await respostaEmail.json().catch(() => null)
          console.log(erro)
          alert('PDF salvo, mas houve erro ao enviar o e-mail.')
          window.location.href = '/admin/cotacoes'
          return
        }
      }

      alert(enviarEmail ? 'Cotação salva e enviada por e-mail.' : cotacaoEditandoId ? 'Cotação atualizada e PDF salvo.' : 'Cotação salva no histórico.')
      window.location.href = '/admin/cotacoes'
    } catch (error) {
      console.log(error)
      alert('Erro ao processar cotação.')
    } finally {
      setSalvando(false)
    }
  }

  const totalTela = usarTabelaServicosAgente
    ? resumoTotalMoedas(totaisAgenteMoedaTela)
    : resumoTotalMoedas(totaisEnvioMoedaTela)

  const incotermsDisponiveis = ehMaritimo
    ? INCOTERMS_MARITIMOS
    : INCOTERMS_COTACAO

  const tituloTipo =
    tipoCotacaoSelecionado === 'MARITIMO'
      ? 'Marítimo'
      : tipoCotacaoSelecionado === 'FORMAL'
        ? 'Agente de carga / Formal'
        : 'Courier / Expresso'

  return (
    <main className="w-full max-w-none p-6 text-white xl:p-8">
      <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 font-bold text-blue-400">Comercial</p>
          <h1 className="text-4xl font-black xl:text-5xl">
            {cotacaoEditandoId ? 'Editar cotação' : 'Nova cotação'}
          </h1>
          <p className="mt-2 text-base text-slate-400 xl:text-lg">
            Escolha o tipo de cotação, preencha as informações e gere o PDF para o cliente.
          </p>
        </div>

        <a
          href="/admin/cotacoes"
          className="rounded-xl bg-slate-700 px-5 py-3 font-bold hover:bg-slate-600"
        >
          ← Voltar para lista
        </a>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 rounded-3xl border border-blue-900 bg-[#071225] p-4 md:grid-cols-5">
        {[
          ['1', 'Tipo de cotação', 'Escolha o modal'],
          ['2', 'Dados principais', 'Informações do cliente'],
          ['3', 'Operação', 'Rota e condições'],
          ['4', 'Serviços', 'Custos e composição'],
          ['5', 'PDF e envio', 'Revise e finalize'],
        ].map(([numeroEtapa, titulo, detalhe], index) => (
          <div key={numeroEtapa} className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border font-black ${
                index === 0
                  ? 'border-blue-400 bg-blue-600 text-white shadow-[0_0_24px_rgba(37,99,235,0.45)]'
                  : 'border-blue-950 bg-[#0b1b35] text-slate-400'
              }`}
            >
              {numeroEtapa}
            </div>
            <div className="min-w-0">
              <p className={index === 0 ? 'font-black text-blue-300' : 'font-black text-slate-300'}>
                {titulo}
              </p>
              <p className="truncate text-xs text-slate-500">{detalhe}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section className="card">
            <div className="mb-5">
              <h2 className="text-2xl font-black">1. Escolha o tipo de cotação</h2>
              <p className="mt-1 text-sm text-slate-400">
                Selecione o fluxo que melhor representa a operação.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <TipoCotacaoCard
                selecionado={tipoCotacaoSelecionado === 'COURIER'}
                icone="✈️"
                titulo="Courier / Expresso"
                descricao="Cotações expressas porta a porta com DHL, FedEx e UPS."
                etiquetas={['DHL', 'FedEx', 'UPS']}
                onClick={() => escolherTipoCotacao('COURIER')}
              />

              <TipoCotacaoCard
                selecionado={tipoCotacaoSelecionado === 'FORMAL'}
                icone="📄"
                titulo="Agente de carga / Formal"
                descricao="Operações formais com agente de carga e composição de custos."
                etiquetas={['Formal', 'Aéreo', 'Terrestre']}
                onClick={() => escolherTipoCotacao('FORMAL')}
              />

              <TipoCotacaoCard
                selecionado={tipoCotacaoSelecionado === 'MARITIMO'}
                icone="🚢"
                titulo="Marítimo"
                descricao="Frete marítimo com serviços manuais e condições próprias."
                etiquetas={['FCL', 'LCL', 'Projeto']}
                onClick={() => escolherTipoCotacao('MARITIMO')}
              />
            </div>
          </section>

          <section className="card">
            <div className="mb-5">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-400">
                Etapa 2
              </p>
              <h2 className="mt-1 text-2xl font-black">
                Dados principais — {tituloTipo}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Campo
                label="Referência HC"
                value={form.referencia_hc}
                onChange={() => {}}
                readOnly
              />
              <Campo
                label="Empresa solicitante"
                value={form.empresa_solicitante}
                onChange={(v) => atualizarCampo('empresa_solicitante', v)}
              />
              <Campo
                label="Solicitante / contato"
                value={form.solicitante_nome}
                onChange={(v) => atualizarCampo('solicitante_nome', v)}
              />
              <Campo
                label="Referência do cliente (opcional)"
                value={form.referencia_cliente}
                onChange={(v) => atualizarCampo('referencia_cliente', v)}
              />
              <Campo
                label="E-mail do cliente (opcional)"
                value={form.solicitante_email}
                onChange={(v) => atualizarCampo('solicitante_email', v)}
              />

              {tipoCotacaoSelecionado === 'COURIER' ? (
                <CampoSelect
                  label="Transportadora"
                  value={modelo}
                  onChange={(v) => trocarModelo(v as ModeloCotacao)}
                >
                  <option value="DHL">DHL</option>
                  <option value="FEDEX">FedEx</option>
                  <option value="UPS">UPS</option>
                </CampoSelect>
              ) : (
                <div className="rounded-2xl border border-blue-900 bg-[#020817] p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                    Modelo
                  </p>
                  <p className="mt-2 font-black text-blue-300">
                    {ehMaritimo ? 'Marítimo' : 'Agente de carga'}
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-400">
                  Etapa 3
                </p>
                <h2 className="mt-1 text-2xl font-black">
                  Operação — {tituloTipo}
                </h2>
              </div>

              {ehMaritimo && (
                <div className="rounded-xl border border-blue-800 bg-blue-950/30 px-4 py-2 text-xs font-bold text-blue-300">
                  Incoterms marítimos em destaque: FOB, CFR, CIF e FAS
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <CampoSelect
                label="Serviço"
                value={form.servico}
                onChange={(v) => atualizarCampo('servico', v)}
              >
                {(() => {
                  const servicosDisponiveis = usarCamposAgente
                    ? SERVICOS_MODELO_AGENTE
                    : SERVICOS_TRANSPORTADORAS_COTACAO
                  const servicoAtual = String(form.servico || '')

                  return (
                    <>
                      {servicoAtual && !servicosDisponiveis.includes(servicoAtual) && (
                        <option value={servicoAtual}>{servicoAtual} — valor existente</option>
                      )}
                      {servicosDisponiveis.map((servico) => (
                        <option key={servico} value={servico}>
                          {servico
                            .toLocaleLowerCase('pt-BR')
                            .replace(/^./, (letra) => letra.toLocaleUpperCase('pt-BR'))}
                        </option>
                      ))}
                    </>
                  )
                })()}
              </CampoSelect>

              {usarCamposAgente ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-400">
                    Agente de carga
                  </span>
                  <input
                    list="agentes-carga-cotacao"
                    value={form.transportadora}
                    onChange={(e) => atualizarCampo('transportadora', e.target.value)}
                    placeholder="Selecione ou digite o agente"
                    autoComplete="off"
                  />
                  <datalist id="agentes-carga-cotacao">
                    {AGENTES_CARGA_COTACAO.map((agente) => (
                      <option key={agente} value={agente} />
                    ))}
                  </datalist>
                </label>
              ) : (
                <Campo
                  label="Transportadora"
                  value={form.transportadora}
                  onChange={() => {}}
                  readOnly
                />
              )}

              <CampoSelect
                label="Origem"
                value={form.origem || ''}
                onChange={(v) => atualizarCampo('origem', v)}
              >
                <option value="">Selecione o país</option>
                {PAISES_COTACAO.map((pais) => (
                  <option key={pais} value={pais}>{pais}</option>
                ))}
              </CampoSelect>

              <CampoSelect
                label="Destino"
                value={form.destino || ''}
                onChange={(v) => atualizarCampo('destino', v)}
              >
                <option value="">Selecione o país</option>
                {PAISES_COTACAO.map((pais) => (
                  <option key={pais} value={pais}>{pais}</option>
                ))}
              </CampoSelect>

              {!ehMaritimo && (
                <CampoAeroporto
                  label="AOD / Formalização"
                  value={form.aod}
                  onChange={(v) => atualizarCampo('aod', v)}
                />
              )}

              <CampoSelect
                label={ehMaritimo ? 'Incoterm marítimo' : 'Incoterm'}
                value={form.incoterm || 'EXW'}
                onChange={(v) => atualizarCampo('incoterm', v)}
              >
                {incotermsDisponiveis.map((incoterm) => (
                  <option key={incoterm} value={incoterm}>{incoterm}</option>
                ))}
              </CampoSelect>

              <Campo
                label="Trânsito estimado"
                value={form.transito}
                onChange={(v) => atualizarCampo('transito', v)}
              />
              <Campo
                label="Validade"
                value={form.validade}
                onChange={(v) => atualizarCampo('validade', v)}
              />

              <CampoSelect
                label="Moeda mercadoria"
                value={form.moeda}
                onChange={(v) => atualizarCampo('moeda', v)}
              >
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

              <Campo
                label="Valor mercadoria"
                type="money"
                value={form.valor_mercadoria}
                onChange={(v) => atualizarCampo('valor_mercadoria', v)}
              />
            </div>
          </section>

          <section className="card">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-400">
                  Carga
                </p>
                <h2 className="mt-1 text-2xl font-black">Volumes e pesos</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {ehMaritimo
                    ? 'Informe os volumes da carga. O CBM é calculado automaticamente pelas dimensões.'
                    : `Peso dimensional: comprimento × largura × altura / ${divisorPesoDimensional}.`}
                </p>
              </div>

              <button
                type="button"
                onClick={adicionarVolume}
                className="rounded-xl bg-blue-600 px-5 py-3 font-bold hover:bg-blue-500"
              >
                + Adicionar volume
              </button>
            </div>

            <div className={`mb-5 grid grid-cols-1 gap-3 ${ehMaritimo ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
              <Resumo titulo="Volumes" valor={resumo.quantidadeVolumes} />
              <Resumo titulo="Peso real" valor={kg(resumo.pesoReal)} />
              {ehMaritimo && (
                <Resumo titulo="CBM" valor={`${cbmTotal.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} m³`} />
              )}
              <Resumo titulo="Peso dimensional" valor={kg(resumo.pesoDimensional)} />
              <Resumo titulo="Peso taxado" valor={kg(resumo.pesoTaxado)} />
            </div>

            {usarCamposAgente && (
              <div className="mb-5 rounded-2xl border border-amber-700/60 bg-amber-950/10 p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px] md:items-end">
                  <div>
                    <p className="text-sm font-black text-amber-300">Peso taxado manual</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Automático: {kg(resumo.pesoTaxadoAutomatico)}. Preencha apenas se o agente informar peso taxado diferente.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.pesoTaxadoManualAgente}
                      onChange={(e) => atualizarCampo('pesoTaxadoManualAgente', e.target.value)}
                      placeholder={String(resumo.pesoTaxadoAutomatico)}
                    />
                    <span className="font-black text-slate-300">kg</span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {volumes.map((volume, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 gap-3 rounded-2xl border border-blue-900 bg-[#020817] p-4 md:grid-cols-6"
                >
                  <Campo label="Qtd" value={volume.quantidade} onChange={(v) => atualizarVolume(index, 'quantidade', v)} />
                  <Campo label="Comprimento cm" value={volume.comprimento_cm} onChange={(v) => atualizarVolume(index, 'comprimento_cm', v)} />
                  <Campo label="Largura cm" value={volume.largura_cm} onChange={(v) => atualizarVolume(index, 'largura_cm', v)} />
                  <Campo label="Altura cm" value={volume.altura_cm} onChange={(v) => atualizarVolume(index, 'altura_cm', v)} />
                  <Campo label="Peso kg" value={volume.peso_kg} onChange={(v) => atualizarVolume(index, 'peso_kg', v)} />
                  <button
                    type="button"
                    onClick={() => removerVolume(index)}
                    disabled={volumes.length === 1}
                    className="self-end rounded-xl bg-red-800 px-4 py-3 font-bold hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-400">
                  Etapa 4
                </p>
                <h2 className="mt-1 text-2xl font-black">
                  Serviços — {tituloTipo}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {ehMaritimo
                    ? 'Adicione manualmente somente os serviços que farão parte desta cotação marítima.'
                    : usarTabelaServicosAgente
                      ? 'Marque os serviços do agente que entram na composição.'
                      : 'Adicione os serviços e valores desta cotação.'}
                </p>
              </div>

              {!usarTabelaServicosAgente && (
                <button
                  type="button"
                  onClick={adicionarItemEnvio}
                  className="rounded-xl bg-blue-600 px-5 py-3 font-bold hover:bg-blue-500"
                >
                  + Adicionar serviço
                </button>
              )}
            </div>

            {usarTabelaServicosAgente ? (
              <div className="overflow-x-auto rounded-2xl border border-blue-900">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-[#020817] text-xs uppercase tracking-widest text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Usar</th>
                      <th className="px-4 py-3">Serviço</th>
                      <th className="px-4 py-3">Moeda</th>
                      <th className="px-4 py-3">Valor</th>
                      <th className="px-4 py-3">Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itensAgente.map((item, index) => (
                      <tr key={`${item.servico}-${index}`} className="border-t border-blue-950">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={item.usar}
                            onChange={(e) => atualizarItemAgente(index, 'usar', e.target.checked)}
                          />
                        </td>
                        <td className="px-4 py-3 font-black">{item.servico}</td>
                        <td className="px-4 py-3">
                          <select value={item.moeda} onChange={(e) => atualizarItemAgente(index, 'moeda', e.target.value)}>
                            <option value="USD">USD</option>
                            <option value="BRL">BRL</option>
                            <option value="EUR">EUR</option>
                            <option value="GBP">GBP</option>
                            <option value="CNY">CNY</option>
                            <option value="HKD">HKD</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={formatarEntradaValorBR(item.valor)}
                            onChange={(e) => atualizarItemAgente(index, 'valor', formatarEntradaValorBR(e.target.value))}
                            placeholder="0,00"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={item.observacao}
                            onChange={(e) => atualizarItemAgente(index, 'observacao', e.target.value)}
                            placeholder="Opcional"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <>
                {!ehMaritimo && (
                  <datalist id="servicos-envio-cotacao">
                    {SERVICOS_ENVIO_COTACAO.map((servico) => (
                      <option key={servico} value={servico} />
                    ))}
                  </datalist>
                )}

                <div className="overflow-x-auto rounded-2xl border border-blue-900">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="bg-[#020817] text-xs uppercase tracking-widest text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Descrição do serviço</th>
                        <th className="px-4 py-3">Moeda</th>
                        <th className="px-4 py-3">Valor</th>
                        <th className="px-4 py-3">Observação</th>
                        <th className="px-4 py-3">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itensEnvio.map((item, index) => (
                        <tr key={item.id} className="border-t border-blue-950">
                          <td className="px-4 py-3">
                            <input
                              list={ehMaritimo ? undefined : 'servicos-envio-cotacao'}
                              value={item.descricao}
                              onChange={(e) => atualizarItemEnvio(index, 'descricao', e.target.value)}
                              placeholder={ehMaritimo ? 'Digite o serviço marítimo' : 'Selecione ou digite o serviço'}
                              className="min-w-[280px]"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <select value={item.moeda} onChange={(e) => atualizarItemEnvio(index, 'moeda', e.target.value)}>
                              <option value="USD">USD</option>
                              <option value="BRL">BRL</option>
                              <option value="EUR">EUR</option>
                              <option value="GBP">GBP</option>
                              <option value="CNY">CNY</option>
                              <option value="HKD">HKD</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              value={formatarEntradaValorBR(item.valor)}
                              onChange={(e) => atualizarItemEnvio(index, 'valor', formatarEntradaValorBR(e.target.value))}
                              placeholder="0,00"
                              inputMode="decimal"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              value={item.observacao}
                              onChange={(e) => atualizarItemEnvio(index, 'observacao', e.target.value)}
                              placeholder="Opcional"
                              className="min-w-[220px]"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => removerItemEnvio(index)}
                              className="rounded-lg bg-red-800 px-3 py-2 font-black hover:bg-red-700"
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="mt-4 rounded-2xl border border-green-900 bg-green-950/20 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                Total por moeda
              </p>
              <p className="mt-2 text-2xl font-black text-green-400">{totalTela}</p>
            </div>
          </section>

          <section className="card">
            <h2 className="mb-5 text-2xl font-black">Seguro, mercadoria e observações</h2>

            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Campo
                label="Percentual seguro %"
                type="decimal"
                value={form.percentualSeguro}
                onChange={(v) => atualizarCampo('percentualSeguro', v)}
              />
              <Campo
                label={`Mínimo seguro ${String(form.moeda || 'USD').toUpperCase()}`}
                type="money"
                value={form.seguroMinimo}
                onChange={(v) => atualizarCampo('seguroMinimo', v)}
              />
              <Campo
                label={`Seguro manual ${String(form.moeda || 'USD').toUpperCase()}`}
                type="money"
                value={form.seguroManual}
                onChange={(v) => atualizarCampo('seguroManual', v)}
              />
              <Checkbox label="Usar seguro manual" checked={form.usarSeguroManual} onChange={(v) => atualizarCampo('usarSeguroManual', v)} />
              <Checkbox label="Sem seguro" checked={form.semSeguro} onChange={(v) => atualizarCampo('semSeguro', v)} />
              <Resumo
                titulo="Seguro final"
                valor={dinheiro(valores.seguro, String(form.moeda || 'USD').toUpperCase())}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <CampoTexto
                label="Descrição da mercadoria"
                value={form.descricao_mercadoria}
                onChange={(v) => atualizarCampo('descricao_mercadoria', v)}
              />
              <CampoTexto
                label="Observações comerciais"
                value={form.observacoes}
                onChange={(v) => atualizarCampo('observacoes', v)}
              />
            </div>
          </section>
        </div>

        <aside className="h-fit 2xl:sticky 2xl:top-6">
          <div className="rounded-3xl border border-blue-800 bg-[#071225] p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Resumo da cotação</h2>
                <p className="mt-1 text-sm text-slate-400">{tituloTipo}</p>
              </div>
              <span className="rounded-lg border border-emerald-800 bg-emerald-950/40 px-3 py-1 text-xs font-black text-emerald-300">
                Em edição
              </span>
            </div>

            <div className="rounded-2xl border border-blue-900 bg-[#020817] p-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                Total all in
              </p>
              <p className="mt-2 break-words text-3xl font-black text-emerald-400">
                {totalTela}
              </p>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <ResumoLinha label="Validade" valor={form.validade || '-'} />
              <ResumoLinha label="Trânsito estimado" valor={form.transito || '-'} />
              <ResumoLinha label="Origem" valor={form.origem || '-'} />
              <ResumoLinha label="Destino" valor={form.destino || '-'} />
              <ResumoLinha label="Incoterm" valor={form.incoterm || '-'} />
              <ResumoLinha label="Volumes" valor={String(resumo.quantidadeVolumes || 0)} />
              <ResumoLinha label={ehMaritimo ? 'CBM' : 'Peso taxado'} valor={ehMaritimo ? `${cbmTotal.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} m³` : kg(resumo.pesoTaxado)} />
              <ResumoLinha label="Mercadoria" valor={`${form.moeda || 'USD'} ${numero(form.valor_mercadoria).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
            </div>

            <div className="my-5 border-t border-blue-950" />

            <button
              type="button"
              onClick={baixarPdf}
              className="w-full rounded-xl bg-blue-600 px-5 py-3 font-black hover:bg-blue-500"
            >
              📄 Gerar prévia PDF
            </button>

            <button
              type="button"
              onClick={() => salvarCotacao(false)}
              disabled={salvando}
              className="mt-3 w-full rounded-xl border border-blue-800 bg-[#0a1730] px-5 py-3 font-black hover:bg-blue-950 disabled:opacity-60"
            >
              {salvando ? 'Salvando...' : cotacaoEditandoId ? 'Atualizar cotação' : 'Salvar cotação'}
            </button>

            <button
              type="button"
              onClick={() => salvarCotacao(true)}
              disabled={salvando}
              className="mt-3 w-full rounded-xl bg-green-700 px-5 py-3 font-black hover:bg-green-600 disabled:opacity-60"
            >
              {salvando ? 'Enviando...' : 'Salvar e enviar por e-mail'}
            </button>

            <a
              href="/admin/cotacoes"
              className="mt-3 block w-full rounded-xl bg-slate-800 px-5 py-3 text-center font-bold hover:bg-slate-700"
            >
              Cancelar
            </a>
          </div>
        </aside>
      </div>
    </main>
  )
}

function TipoCotacaoCard({
  selecionado,
  icone,
  titulo,
  descricao,
  etiquetas,
  onClick,
}: {
  selecionado: boolean
  icone: string
  titulo: string
  descricao: string
  etiquetas: string[]
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-2xl border p-5 text-left transition ${
        selecionado
          ? 'border-blue-400 bg-blue-950/45 shadow-[0_0_0_1px_rgba(59,130,246,0.35),0_0_28px_rgba(37,99,235,0.12)]'
          : 'border-blue-900 bg-[#020817] hover:border-blue-700 hover:bg-[#07162d]'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl ${selecionado ? 'bg-blue-600/30' : 'bg-blue-950'}`}>
            {icone}
          </div>
          <div>
            <p className={selecionado ? 'font-black text-blue-300' : 'font-black text-white'}>
              {titulo}
            </p>
            <p className="mt-1 text-sm leading-5 text-slate-400">{descricao}</p>
          </div>
        </div>

        <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${selecionado ? 'border-blue-300 bg-blue-600 text-white' : 'border-slate-500 text-transparent'}`}>
          ✓
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {etiquetas.map((etiqueta) => (
          <span key={etiqueta} className="rounded-full bg-blue-950 px-3 py-1 text-xs font-bold text-blue-300">
            {etiqueta}
          </span>
        ))}
      </div>
    </button>
  )
}

function ResumoLinha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[58%] text-right font-bold text-slate-200">{valor}</span>
    </div>
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
  readOnly = false,
}: {
  label: string
  value: string
  onChange: (valor: string) => void
  type?: string
  readOnly?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-400">{label}</span>
      <input
        type={type === 'money' || type === 'decimal' ? 'text' : type}
        inputMode={type === 'money' || type === 'decimal' ? 'decimal' : undefined}
        step={type === 'number' ? '0.01' : undefined}
        value={
          type === 'money'
            ? formatarEntradaValorBR(value)
            : type === 'decimal'
              ? formatarEntradaTaxaBR(value)
              : value || ''
        }
        readOnly={readOnly}
        onChange={(e) =>
          onChange(
            type === 'money'
              ? formatarEntradaValorBR(e.target.value)
              : type === 'decimal'
                ? formatarEntradaTaxaBR(e.target.value)
                : e.target.value
          )
        }
        className={readOnly ? 'cursor-not-allowed bg-slate-900/70 text-blue-300' : undefined}
      />
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
