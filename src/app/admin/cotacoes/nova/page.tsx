'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { jsPDF } from 'jspdf'
import { supabase } from '@/lib/supabaseClient'
import { AEROPORTOS_BRASIL } from '@/lib/aeroportos-brasil'
import { useSearchParams } from 'next/navigation'

type ModeloCotacao = 'DHL_IMPORTACAO_FORMAL' | 'DHL_IMPORTACAO_COURIER' | 'FEDEX_EXPORTACAO' | 'AGENTE_CARGA_FORMAL'

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
  if (modelo === 'AGENTE_CARGA_FORMAL') return 'Agente de carga - Formal'
  if (modelo === 'FEDEX_EXPORTACAO') return 'FedEx - Exportação'
  if (modelo === 'DHL_IMPORTACAO_COURIER') return 'DHL - Importação Courier'
  return 'DHL - Importação Formal'
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


const SERVICOS_AGENTE_CARGA = [
  'Frete Internacional',
  'Insurance',
  'Export Log Fee',
  'Airport Transfer',
  'Teste Magnético',
  'Ad Valorem',
  'Serviços de seguro de carga',
  'Delivery Fee',
  'Taxa Origem',
  'Desembaraço Aduaneiro',
  'DESCONTO',
  'Coleta',
  'Pick Up',
  'DTA - Trânsito Aduaneiro',
  'Documentation Fee',
  'Local Charges',
  'X-Ray Charge',
  'Handling',
  'EXW Charges',
  'Desconsolidação',
  'Customs Clearance',
  'IOF',
  'Armazenagem Aérea',
  'THC Aéreo',
  'SAF',
  'DGR Fee',
  'Administration Fee',
  'Ex Works',
  'Destination Charges',
  'FCA Charges',
  'AMS-AWB',
  'Adicional DTA',
  'Fuel',
  'Airline Docs Release',
  'Collect Fee',
  'Handling Destino',
  'AWB Fee',
]


const CODIGOS_PAISES_COTACAO = [
  'BR','CN','US','DE','GB','PT','ES','FR','IT','NL','BE','CH','AT','SE','NO','DK','FI','IE',
  'JP','KR','TW','HK','SG','IN','ID','MY','TH','VN','AE','SA','TR','IL','CA','MX','AR','CL',
  'CO','PE','UY','PY','BO','EC','AU','NZ','ZA','EG','MA','PL','CZ','SK','HU','RO','BG','GR',
  'SI','HR','RS','RU','UA','QA','KW','BH','OM','JO','LB','AF','AL','DZ','AD','AO','AG','AM',
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
  const [modelo, setModelo] = useState<ModeloCotacao>('DHL_IMPORTACAO_FORMAL')

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

  const usarCamposAgente = modelo === 'AGENTE_CARGA_FORMAL'
  const divisorPesoDimensional = usarCamposAgente ? 6000 : 5000


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

      const dadosEmissor = data.dados_emissor || {}

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
        } else if (dadosEmissor.modelo !== 'AGENTE_CARGA_FORMAL') {
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
          setModelo(dadosEmissor.modelo as ModeloCotacao)
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

      if (transportadora.includes('FEDEX') || servico.includes('EXPORT')) {
        setModelo('FEDEX_EXPORTACAO')
      } else if (transportadora.includes('AGENTE')) {
        setModelo('AGENTE_CARGA_FORMAL')
      } else if (servico.includes('COURIER')) {
        setModelo('DHL_IMPORTACAO_COURIER')
      } else {
        setModelo('DHL_IMPORTACAO_FORMAL')
      }
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
      total: modelo === 'FEDEX_EXPORTACAO' ? totalFedex : totalDhl,
    }
  }, [form, modelo, itensEnvio])

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
      totais.USD = (totais.USD || 0) + valores.seguro
    }

    return totais
  }, [itensEnvio, valores.seguro])

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

  function trocarModelo(novoModelo: ModeloCotacao) {
    setModelo(novoModelo)

    if (novoModelo === 'AGENTE_CARGA_FORMAL') {
      setForm((atual) => ({
        ...atual,
        servico: 'IMPORTAÇÃO FORMAL',
        transportadora: 'AGENTE',
      }))
      return
    }

    if (novoModelo === 'FEDEX_EXPORTACAO') {
      setForm((atual) => ({
        ...atual,
        servico: 'EXPORTAÇÃO',
        transportadora: 'FEDEX',
      }))
      return
    }

    if (novoModelo === 'DHL_IMPORTACAO_COURIER') {
      setForm((atual) => ({
        ...atual,
        servico: 'IMPORTAÇÃO COURIER',
        transportadora: 'DHL',
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
        y = 268
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

    const logoHC = await buscarLogoHC()

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
      const yRodape = 276

      if (y > yRodape - 16) {
        y = 268
      }

      doc.setDrawColor(203, 213, 225)
      doc.line(14, yRodape - 6, 196, yRodape - 6)

      doc.setTextColor(100, 116, 139)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)

      const textoRodape = doc.splitTextToSize(
        'Cotação sujeita à confirmação de peso, dimensões, documentação, disponibilidade de rota, regras da transportadora, validade informada nesta proposta e demais condições operacionais.',
        128
      )

      doc.text(textoRodape, 14, yRodape)

      doc.setFont('helvetica', 'bold')
      doc.text('HC Consultoria', 196, yRodape, { align: 'right' })

      doc.setFont('helvetica', 'normal')
      doc.text('portal.hcbhz.com', 196, yRodape + 4, { align: 'right' })
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

    if (usarCamposAgente) {
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
      info('Seguro', dinheiro(valores.seguro, 'USD'))
    }

    novaPagina(16)
    doc.setFillColor(219, 234, 254)
    doc.rect(114, y, 82, 12, 'F')
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('TOTAL ALL IN', 118, y + 8)
    doc.text(
      usarCamposAgente
        ? resumoTotalMoedas(totaisAgenteMoedaTela)
        : resumoTotalMoedas(totaisEnvioMoedaTela),
      192,
      y + 8,
      { align: 'right' }
    )
    y += 18

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
            valor_mercadoria: form.valor_mercadoria || null,
            descricao_mercadoria: form.descricao_mercadoria || null,
            observacoes: form.observacoes || null,
            volumes,
            dimensoes: dimensoesTexto,
            peso_real: resumo.pesoReal,
            peso_taxado: resumo.pesoTaxado,
            status: 'COTAÇÃO DISPONÍVEL',
            dados_emissor: {
              modelo,
              form,
              volumes,
              itensEnvio,
              itensAgente,
              resumo,
              valores,
              totaisAgenteMoeda: totaisAgenteMoedaTela,
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
            total: usarCamposAgente ? resumoTotalMoedas(totaisAgenteMoedaTela) : resumoTotalMoedas(totaisEnvioMoedaTela),
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
            <p className="mt-1 text-3xl font-black text-green-400">{usarCamposAgente ? resumoTotalMoedas(totaisAgenteMoedaTela) : resumoTotalMoedas(totaisEnvioMoedaTela)}</p>
          </div>
        </div>

        <div className="form-grid">
          <CampoSelect label="Modelo da cotação" value={modelo} onChange={(v) => trocarModelo(v as ModeloCotacao)}>
            <option value="DHL_IMPORTACAO_FORMAL">DHL - Importação Formal</option>
            <option value="DHL_IMPORTACAO_COURIER">DHL - Importação Courier</option>
            <option value="AGENTE_CARGA_FORMAL">Agente de carga - Formal</option>
            <option value="FEDEX_EXPORTACAO">FedEx - Exportação</option>
          </CampoSelect>

          <Campo label="Referência HC" value={form.referencia_hc} onChange={() => {}} readOnly />
          <Campo label="Referência cliente (opcional)" value={form.referencia_cliente} onChange={(v) => atualizarCampo('referencia_cliente', v)} />
          <Campo label="E-mail do cliente (opcional)" value={form.solicitante_email} onChange={(v) => atualizarCampo('solicitante_email', v)} />
          <Campo label="Empresa solicitante" value={form.empresa_solicitante} onChange={(v) => atualizarCampo('empresa_solicitante', v)} />
          <Campo label="Solicitante / contato" value={form.solicitante_nome} onChange={(v) => atualizarCampo('solicitante_nome', v)} />
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
          <CampoSelect label="Origem" value={form.origem || ''} onChange={(v) => atualizarCampo('origem', v)}>
            <option value="">Selecione o país</option>
            {PAISES_COTACAO.map((pais) => (
              <option key={pais} value={pais}>
                {pais}
              </option>
            ))}
          </CampoSelect>
          <CampoSelect label="Destino" value={form.destino || ''} onChange={(v) => atualizarCampo('destino', v)}>
            <option value="">Selecione o país</option>
            {PAISES_COTACAO.map((pais) => (
              <option key={pais} value={pais}>
                {pais}
              </option>
            ))}
          </CampoSelect>
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

          <CampoSelect label="Incoterm" value={form.incoterm || 'EXW'} onChange={(v) => atualizarCampo('incoterm', v)}>
            {INCOTERMS_COTACAO.map((incoterm) => (
              <option key={incoterm} value={incoterm}>
                {incoterm}
              </option>
            ))}
          </CampoSelect>
          <Campo label="Valor mercadoria" type="number" value={form.valor_mercadoria} onChange={(v) => atualizarCampo('valor_mercadoria', v)} />
        </div>
      </section>

      <section className="card mb-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">Volumes</h2>
            <p className="mt-1 text-sm text-slate-400">Peso dimensional: comprimento x largura x altura / {divisorPesoDimensional}.</p>
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

        {usarCamposAgente ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-blue-900 bg-[#020817] p-4">
              <p className="text-sm font-black text-blue-300">Agente de carga / formal</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                Marque apenas os valores que entram na cotação. Cada item pode ter uma moeda diferente.
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-blue-900">
              <table className="w-full min-w-[980px] text-left text-sm">
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
                    <tr key={item.servico} className="border-t border-blue-950">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={item.usar}
                          onChange={(e) => atualizarItemAgente(index, 'usar', e.target.checked)}
                        />
                      </td>

                      <td className="px-4 py-3 font-black text-white">{item.servico}</td>

                      <td className="px-4 py-3">
                        <select
                          value={item.moeda}
                          onChange={(e) => atualizarItemAgente(index, 'moeda', e.target.value)}
                          className="min-w-[110px]"
                        >
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
                          value={item.valor}
                          onChange={(e) => atualizarItemAgente(index, 'valor', e.target.value)}
                          placeholder="0,00"
                          className="min-w-[140px]"
                        />
                      </td>

                      <td className="px-4 py-3">
                        <input
                          value={item.observacao}
                          onChange={(e) => atualizarItemAgente(index, 'observacao', e.target.value)}
                          placeholder="Opcional"
                          className="min-w-[260px]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-2xl border border-green-900 bg-green-950/20 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Total por moeda</p>
              <p className="mt-2 text-2xl font-black text-green-400">
                {resumoTotalMoedas(totaisAgenteMoedaTela)}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 rounded-2xl border border-blue-900 bg-[#020817] p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-black text-blue-300">Serviços da cotação</p>
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  Selecione um serviço da lista ou digite qualquer descrição manualmente.
                </p>
              </div>

              <button
                type="button"
                onClick={adicionarItemEnvio}
                className="rounded-xl bg-blue-600 px-5 py-3 font-bold hover:bg-blue-500"
              >
                + Adicionar serviço
              </button>
            </div>

            <datalist id="servicos-envio-cotacao">
              {SERVICOS_ENVIO_COTACAO.map((servico) => (
                <option key={servico} value={servico} />
              ))}
            </datalist>

            <div className="overflow-x-auto rounded-2xl border border-blue-900">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-[#020817] text-xs uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Descrição</th>
                    <th className="px-4 py-3">Moeda</th>
                    <th className="px-4 py-3">Valor original</th>
                    <th className="px-4 py-3">Observação</th>
                    <th className="px-4 py-3">Ação</th>
                  </tr>
                </thead>

                <tbody>
                  {itensEnvio.map((item, index) => (
                    <tr key={item.id} className="border-t border-blue-950">
                      <td className="px-4 py-3">
                        <input
                          list="servicos-envio-cotacao"
                          value={item.descricao}
                          onChange={(e) => atualizarItemEnvio(index, 'descricao', e.target.value)}
                          placeholder="Selecione ou digite o serviço"
                          className="min-w-[280px]"
                        />
                      </td>

                      <td className="px-4 py-3">
                        <select
                          value={item.moeda}
                          onChange={(e) => atualizarItemEnvio(index, 'moeda', e.target.value)}
                          className="min-w-[110px]"
                        >
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
                          value={item.valor}
                          onChange={(e) => atualizarItemEnvio(index, 'valor', e.target.value)}
                          placeholder="0,00"
                          inputMode="decimal"
                          className="min-w-[150px]"
                        />
                      </td>

                      <td className="px-4 py-3">
                        <input
                          value={item.observacao}
                          onChange={(e) => atualizarItemEnvio(index, 'observacao', e.target.value)}
                          placeholder="Opcional"
                          className="min-w-[260px]"
                        />
                      </td>

                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => removerItemEnvio(index)}
                          className="rounded-lg bg-red-700 px-3 py-2 font-black text-white hover:bg-red-600"
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-2xl border border-green-900 bg-green-950/20 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Total por moeda</p>
              <p className="mt-2 text-2xl font-black text-green-400">
                {resumoTotalMoedas(totaisEnvioMoedaTela)}
              </p>
            </div>
          </div>
        )}
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
            {salvando ? 'Salvando...' : cotacaoEditandoId ? 'Atualizar cotação' : 'Salvar cotação'}
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
        type={type}
        step={type === 'number' ? '0.01' : undefined}
        value={value || ''}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
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
