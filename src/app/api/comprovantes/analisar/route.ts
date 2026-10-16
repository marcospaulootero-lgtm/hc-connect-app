// HC_AUTO_COMPROVANTE_V1
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TOLERANCIA_VALOR = 0.01
const CONFIANCA_MINIMA = 0.9

function texto(valor: any) {
  return String(valor ?? '').trim()
}

function numero(valor: any) {
  if (valor === null || valor === undefined || valor === '') return 0
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0

  let base = String(valor)
    .replace(/[R$USD\s]/gi, '')
    .trim()

  if (!base) return 0

  if (base.includes(',') && base.includes('.')) {
    base = base.replace(/\./g, '').replace(',', '.')
  } else if (base.includes(',')) {
    base = base.replace(',', '.')
  }

  const resultado = Number(base)
  return Number.isFinite(resultado) ? resultado : 0
}

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function dataBR(valor: string | null | undefined) {
  if (!valor) return '-'
  const parte = String(valor).slice(0, 10)
  const match = parte.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return parte
  return `${match[3]}/${match[2]}/${match[1]}`
}

function dataIsoValida(valor: any): string | null {
  const base = texto(valor)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) return null

  const data = new Date(`${base}T12:00:00Z`)
  if (Number.isNaN(data.getTime())) return null

  const hoje = new Date()
  const limite = new Date(Date.UTC(
    hoje.getUTCFullYear(),
    hoje.getUTCMonth(),
    hoje.getUTCDate() + 1,
    23,
    59,
    59
  ))

  if (data.getTime() > limite.getTime()) return null
  return base
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Supabase administrativo não configurado na Vercel.')
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

function supabaseAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    throw new Error('Supabase público não configurado na Vercel.')
  }

  return createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

async function usuarioAutenticado(request: NextRequest) {
  const authorization = request.headers.get('authorization') || ''
  const token = authorization.replace(/^Bearer\s+/i, '').trim()

  if (!token) return null

  const auth = supabaseAuth()
  const {
    data: { user },
    error,
  } = await auth.auth.getUser(token)

  if (error || !user) return null
  return user
}

function normalizarStatus(valor: any) {
  return texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

async function autorizadoNaFatura(
  admin: ReturnType<typeof supabaseAdmin>,
  user: any,
  fatura: any,
  embarque: any
) {
  const { data: perfil } = await admin
    .from('perfis')
    .select('id, tipo_acesso')
    .eq('id', user.id)
    .maybeSingle()

  if (normalizarStatus(perfil?.tipo_acesso) === 'ADMIN') return true
  if (String(fatura?.usuario_id || '') === String(user.id)) return true
  if (String(embarque?.usuario_id || '') === String(user.id)) return true

  const { data: vinculoFatura } = await admin
    .from('fatura_clientes')
    .select('fatura_id')
    .eq('fatura_id', fatura.id)
    .eq('cliente_id', user.id)
    .limit(1)
    .maybeSingle()

  if (vinculoFatura) return true

  if (fatura?.embarque_id) {
    const { data: vinculoEmbarque } = await admin
      .from('embarque_clientes')
      .select('embarque_id')
      .eq('embarque_id', fatura.embarque_id)
      .eq('cliente_id', user.id)
      .limit(1)
      .maybeSingle()

    if (vinculoEmbarque) return true
  }

  return false
}

async function buscarFinanceiro(admin: ReturnType<typeof supabaseAdmin>, embarque: any) {
  if (!embarque) return null

  if (embarque.id) {
    const { data } = await admin
      .from('financeiro_embarques')
      .select('*')
      .eq('embarque_id', embarque.id)
      .limit(1)

    if (data?.[0]) return data[0]
  }

  if (embarque.awb) {
    const { data } = await admin
      .from('financeiro_embarques')
      .select('*')
      .eq('awb', embarque.awb)
      .limit(1)

    if (data?.[0]) return data[0]
  }

  return null
}

function conteudoRespostaOpenRouter(resposta: any) {
  const conteudo = resposta?.choices?.[0]?.message?.content

  if (typeof conteudo === 'string') return conteudo.trim()

  if (Array.isArray(conteudo)) {
    return conteudo
      .map((item: any) => item?.text || item?.content || '')
      .filter(Boolean)
      .join('\n')
      .trim()
  }

  return ''
}

function parseJsonSeguro(valor: string) {
  const limpo = String(valor || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    return JSON.parse(limpo)
  } catch {
    const inicio = limpo.indexOf('{')
    const fim = limpo.lastIndexOf('}')

    if (inicio >= 0 && fim > inicio) {
      return JSON.parse(limpo.slice(inicio, fim + 1))
    }

    throw new Error('A IA não retornou JSON válido.')
  }
}

async function analisarComprovanteIA(urlComprovante: string, faturaId: string) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY não configurada na Vercel.')

  const respostaArquivo = await fetch(urlComprovante, { cache: 'no-store' })
  if (!respostaArquivo.ok) {
    throw new Error(`Não foi possível abrir o comprovante (HTTP ${respostaArquivo.status}).`)
  }

  const bytes = Buffer.from(await respostaArquivo.arrayBuffer())
  if (!bytes.length) throw new Error('O comprovante está vazio.')

  if (bytes.length > 12 * 1024 * 1024) {
    throw new Error('O comprovante excede 12 MB e precisa de conferência manual.')
  }

  let mime = texto(respostaArquivo.headers.get('content-type')).split(';')[0].toLowerCase()
  const urlLower = urlComprovante.toLowerCase()

  if (!mime || mime === 'application/octet-stream') {
    if (urlLower.includes('.pdf')) mime = 'application/pdf'
    else if (urlLower.includes('.png')) mime = 'image/png'
    else mime = 'image/jpeg'
  }

  const base64 = bytes.toString('base64')
  const dataUrl = `data:${mime};base64,${base64}`

  const instrucao =
    'Leia este comprovante bancário/PIX. Extraia SOMENTE o que estiver claramente visível no documento. ' +
    'A data_pagamento deve ser a data efetiva da transação/pagamento, nunca a data de upload, notificação ou impressão. ' +
    'O valor deve ser o valor efetivamente pago. Se houver dúvida, use null e reduza a confiança. ' +
    'Não tente fazer a conciliação com a fatura; apenas leia o comprovante.'

  const conteudoArquivo =
    mime === 'application/pdf'
      ? {
          type: 'file',
          file: {
            filename: `comprovante-${faturaId}.pdf`,
            file_data: dataUrl,
          },
        }
      : {
          type: 'image_url',
          image_url: {
            url: dataUrl,
          },
        }

  const schema = {
    name: 'leitura_comprovante_hc',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        eh_comprovante_pagamento: { type: 'boolean' },
        valor: { type: ['number', 'null'] },
        moeda: { type: ['string', 'null'] },
        data_pagamento: { type: ['string', 'null'] },
        confianca: { type: 'number' },
        id_transacao: { type: ['string', 'null'] },
        beneficiario: { type: ['string', 'null'] },
        observacao: { type: ['string', 'null'] },
      },
      required: [
        'eh_comprovante_pagamento',
        'valor',
        'moeda',
        'data_pagamento',
        'confianca',
        'id_transacao',
        'beneficiario',
        'observacao',
      ],
      additionalProperties: false,
    },
  }

  const modelo = process.env.OPENROUTER_COMPROVANTE_MODEL || 'openrouter/free'

  const corpoBase: any = {
    model: modelo,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: instrucao },
          conteudoArquivo,
        ],
      },
    ],
    max_tokens: 550,
    temperature: 0,
    provider: {
      data_collection: 'deny',
    },
  }

  if (mime === 'application/pdf') {
    corpoBase.plugins = [
      {
        id: 'file-parser',
        pdf: {
          engine: 'mistral-ocr',
        },
      },
    ]
  }

  async function chamar(usarSchema: boolean) {
    const corpo = usarSchema
      ? {
          ...corpoBase,
          response_format: {
            type: 'json_schema',
            json_schema: schema,
          },
        }
      : corpoBase

    const resposta = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://portal.hcbhz.com',
        'X-Title': 'HC Connect - Validação de comprovante',
      },
      body: JSON.stringify(corpo),
    })

    const dados = await resposta.json().catch(() => null)

    if (!resposta.ok) {
      const mensagem =
        dados?.error?.message ||
        dados?.message ||
        `Erro HTTP ${resposta.status}`

      throw new Error(`OpenRouter: ${mensagem}`)
    }

    return parseJsonSeguro(conteudoRespostaOpenRouter(dados))
  }

  try {
    return await chamar(true)
  } catch (erroSchema) {
    console.warn('Leitura estruturada do comprovante falhou; tentando JSON simples.', erroSchema)
    return await chamar(false)
  }
}

async function marcarRevisao(
  admin: ReturnType<typeof supabaseAdmin>,
  faturaId: string,
  motivo: string
) {
  const observacao =
    `Validação automática pendente: ${motivo}`.slice(0, 900)

  await admin
    .from('faturas')
    .update({
      status_pagamento: 'COMPROVANTE ENVIADO',
      observacao_pagamento: observacao,
    })
    .eq('id', faturaId)

  return NextResponse.json({
    ok: true,
    status: 'REVISAO',
    mensagem: motivo,
  })
}

function numeroPorExtenso(numero: number): string {
  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
  const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

  function ate999(n: number): string {
    if (n === 0) return ''
    if (n === 100) return 'cem'

    const c = Math.floor(n / 100)
    const d = Math.floor((n % 100) / 10)
    const u = n % 10
    const partes: string[] = []

    if (c > 0) partes.push(centenas[c])

    const resto = n % 100
    if (resto >= 10 && resto <= 19) {
      partes.push(especiais[resto - 10])
    } else {
      if (d > 1) partes.push(dezenas[d])
      if (u > 0) partes.push(unidades[u])
    }

    return partes.filter(Boolean).join(' e ')
  }

  if (numero === 0) return 'zero'
  if (numero < 1000) return ate999(numero)

  const milhoes = Math.floor(numero / 1000000)
  const milhares = Math.floor((numero % 1000000) / 1000)
  const resto = numero % 1000
  const partes: string[] = []

  if (milhoes > 0) {
    partes.push(`${numeroPorExtenso(milhoes)} ${milhoes === 1 ? 'milhão' : 'milhões'}`)
  }

  if (milhares > 0) {
    partes.push(milhares === 1 ? 'mil' : `${ate999(milhares)} mil`)
  }

  if (resto > 0) partes.push(ate999(resto))

  return partes.join(resto > 0 && (resto < 100 || numero < 100000) ? ' e ' : ', ')
}

function valorPorExtensoBRL(valorOriginal: number) {
  const valor = Math.max(0, Math.round(Number(valorOriginal || 0) * 100) / 100)
  const reais = Math.floor(valor)
  const centavos = Math.round((valor - reais) * 100)
  const partes: string[] = []

  partes.push(`${numeroPorExtenso(reais)} ${reais === 1 ? 'real' : 'reais'}`)

  if (centavos > 0) {
    partes.push(`${numeroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`)
  }

  return partes.join(' e ')
}

async function gerarPdfRecibo(params: {
  fatura: any
  embarque: any
  valor: number
  dataPagamento: string
  idTransacao?: string | null
}) {
  const modulo = await import('jspdf')
  const JsPDF = (modulo as any).jsPDF || (modulo as any).default

  if (!JsPDF) throw new Error('Biblioteca jsPDF não disponível.')

  const { fatura, embarque, valor, dataPagamento, idTransacao } = params
  const dados = fatura?.dados_cliente_faturamento || {}

  const nomeCliente =
    texto(dados.nome_empresa) ||
    texto(dados.razao_social) ||
    texto(dados.nome) ||
    texto(embarque?.cliente_final) ||
    texto(embarque?.importador)

  const documento =
    texto(dados.cnpj) ||
    texto(dados.cpf) ||
    texto(dados.documento) ||
    '-'

  if (!nomeCliente) {
    throw new Error('Cliente fiscal não identificado com segurança para o recibo.')
  }

  const pdf = new JsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  }) as any

  const margem = 44
  const largura = pdf.internal.pageSize.getWidth()

  pdf.setDrawColor(25, 25, 25)
  pdf.setLineWidth(1)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text('RECIBO DE PAGAMENTO', margem, 54)

  pdf.setFontSize(9)
  pdf.text('COUTO E OTERO INTERMEDIAÇÃO LTDA', margem, 82)
  pdf.setFont('helvetica', 'normal')
  pdf.text('CNPJ 41.456.630/0001-52', margem, 96)
  pdf.text('RUA DOS COMANCHES Nº 131 - BELO HORIZONTE/MG - CEP 31530250', margem, 110)
  pdf.text('E-MAIL: GRUPOHCCONSULTORIA@OUTLOOK.COM', margem, 124)
  pdf.line(margem, 146, largura - margem, 146)

  const y = 166
  const boxW = largura - margem * 2
  pdf.setFillColor(238, 242, 255)
  pdf.rect(margem, y, boxW, 126, 'FD')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8.5)
  pdf.text('Recebemos de:', margem + 12, y + 24)
  pdf.text('CNPJ / CPF:', margem + 320, y + 24)
  pdf.text('Referente à fatura:', margem + 12, y + 68)
  pdf.text('AWB / HAWB:', margem + 320, y + 68)
  pdf.text('Data do recebimento:', margem + 12, y + 104)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(pdf.splitTextToSize(nomeCliente, 275), margem + 12, y + 39)
  pdf.text(pdf.splitTextToSize(documento, boxW - 340), margem + 320, y + 39)
  pdf.text(pdf.splitTextToSize(texto(fatura.numero_fatura) || '-', 275), margem + 12, y + 83)
  pdf.text(pdf.splitTextToSize(texto(embarque?.awb) || '-', boxW - 340), margem + 320, y + 83)
  pdf.text(dataBR(dataPagamento), margem + 12, y + 119)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.text('Valor recebido:', margem, 330)
  pdf.setFontSize(24)
  pdf.text(moeda(valor), margem + 130, 334)

  pdf.setFontSize(10)
  pdf.text('Valor por extenso:', margem, 376)
  pdf.setFont('helvetica', 'normal')
  pdf.text(
    pdf.splitTextToSize(valorPorExtensoBRL(valor), largura - margem * 2 - 125),
    margem + 125,
    376
  )

  pdf.setFont('helvetica', 'bold')
  pdf.text('Forma de recebimento:', margem, 420)
  pdf.setFont('helvetica', 'normal')
  pdf.text('PIX / Transferência bancária', margem + 130, 420)

  pdf.setFont('helvetica', 'bold')
  pdf.text('Descrição:', margem, 456)
  pdf.setFont('helvetica', 'normal')
  pdf.text(
    pdf.splitTextToSize(
      `Recebimento referente à fatura ${texto(fatura.numero_fatura) || '-'} vinculada ao AWB ${texto(embarque?.awb) || '-'}.`,
      largura - margem * 2
    ),
    margem,
    474
  )

  pdf.setFont('helvetica', 'bold')
  pdf.text('Observações:', margem, 522)
  pdf.setFont('helvetica', 'normal')
  pdf.text(
    pdf.splitTextToSize(
      `Pagamento validado automaticamente pelo comprovante enviado no HC Connect.${idTransacao ? ` ID da transação: ${idTransacao}.` : ''}`,
      largura - margem * 2
    ),
    margem,
    540
  )

  const yAssinatura = 640
  pdf.setDrawColor(70, 70, 70)
  pdf.setLineWidth(0.4)
  pdf.line(largura / 2 - 95, yAssinatura, largura / 2 + 95, yAssinatura)
  pdf.setFont('times', 'italic')
  pdf.setFontSize(11)
  pdf.text('Marcos Paulo Otero', largura / 2, yAssinatura - 8, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.text('COUTO E OTERO INTERMEDIAÇÃO LTDA', largura / 2, yAssinatura + 16, { align: 'center' })
  pdf.text('CNPJ: 41.456.630/0001-52', largura / 2, yAssinatura + 30, { align: 'center' })

  pdf.setFontSize(7)
  pdf.text(`Recibo emitido pelo HC Connect em ${dataBR(new Date().toISOString())}`, margem, 780)

  return Buffer.from(pdf.output('arraybuffer'))
}

async function removerReciboStorage(admin: ReturnType<typeof supabaseAdmin>, caminho: string) {
  try {
    await admin.storage.from('faturas').remove([caminho])
  } catch (error) {
    console.warn('Não foi possível remover recibo órfão:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await usuarioAutenticado(request)

    if (!user) {
      return NextResponse.json(
        { error: 'Sessão inválida ou expirada.' },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => null)
    const faturaId = texto(body?.fatura_id)

    if (!faturaId) {
      return NextResponse.json(
        { error: 'Fatura não informada.' },
        { status: 400 }
      )
    }

    const admin = supabaseAdmin()

    const { data: fatura, error: erroFatura } = await admin
      .from('faturas')
      .select('*')
      .eq('id', faturaId)
      .maybeSingle()

    if (erroFatura || !fatura) {
      return NextResponse.json(
        { error: 'Fatura não localizada.' },
        { status: 404 }
      )
    }

    let embarque: any = null

    if (fatura.embarque_id) {
      const { data } = await admin
        .from('embarques')
        .select('*')
        .eq('id', fatura.embarque_id)
        .maybeSingle()

      embarque = data || null
    }

    const permitido = await autorizadoNaFatura(admin, user, fatura, embarque)

    if (!permitido) {
      return NextResponse.json(
        { error: 'Você não tem acesso a esta fatura.' },
        { status: 403 }
      )
    }

    const statusAtual = normalizarStatus(fatura.status_pagamento)

    if (
      statusAtual === 'PAGO' ||
      !!fatura.recibo_pdf ||
      !!fatura.data_pagamento
    ) {
      return NextResponse.json({
        ok: true,
        status: 'JA_PROCESSADO',
        recibo_url: fatura.recibo_pdf || null,
        mensagem: 'Esta fatura já possui pagamento/recibo registrado.',
      })
    }

    if (!fatura.comprovante_pagamento) {
      return NextResponse.json(
        { error: 'A fatura não possui comprovante anexado.' },
        { status: 400 }
      )
    }

    if (!fatura.arquivo_pdf) {
      return marcarRevisao(
        admin,
        fatura.id,
        'A fatura ainda não possui PDF principal para emissão automática do recibo.'
      )
    }

    const tipoFatura = normalizarStatus(fatura.tipo_fatura)

    if (
      fatura.fatura_complementar === true ||
      tipoFatura.includes('IMPOSTOS') ||
      tipoFatura.includes('COMPLEMENTAR') ||
      tipoFatura.includes('AGENTE')
    ) {
      return marcarRevisao(
        admin,
        fatura.id,
        'Faturas complementares ou de agente de carga continuam com conferência manual.'
      )
    }

    if (!embarque?.id) {
      return marcarRevisao(
        admin,
        fatura.id,
        'A fatura não possui um embarque estável vinculado.'
      )
    }

    const financeiro = await buscarFinanceiro(admin, embarque)

    const valorEsperado =
      numero(financeiro?.valor_cobranca) ||
      numero(fatura.valor_total) ||
      numero(embarque.valor_cobrado_cliente) ||
      numero(embarque.valor_fechado) ||
      numero(embarque.valor_venda)

    if (valorEsperado <= 0) {
      return marcarRevisao(
        admin,
        fatura.id,
        'Não foi possível determinar com segurança o valor cobrado nesta fatura.'
      )
    }

    let leitura: any

    try {
      leitura = await analisarComprovanteIA(
        fatura.comprovante_pagamento,
        fatura.id
      )
    } catch (error: any) {
      console.error('Falha na leitura automática do comprovante:', error)

      return marcarRevisao(
        admin,
        fatura.id,
        `Não foi possível ler o comprovante automaticamente: ${error?.message || error}`
      )
    }

    if (leitura?.eh_comprovante_pagamento !== true) {
      return marcarRevisao(
        admin,
        fatura.id,
        'O arquivo anexado não foi reconhecido com segurança como comprovante de pagamento.'
      )
    }

    const confianca = Number(leitura?.confianca || 0)

    if (!Number.isFinite(confianca) || confianca < CONFIANCA_MINIMA) {
      return marcarRevisao(
        admin,
        fatura.id,
        `Leitura do comprovante com confiança insuficiente (${Math.round(confianca * 100)}%).`
      )
    }

    const valorComprovante = numero(leitura?.valor)

    if (valorComprovante <= 0) {
      return marcarRevisao(
        admin,
        fatura.id,
        'O valor pago não pôde ser identificado com segurança no comprovante.'
      )
    }

    const moedaComprovante = normalizarStatus(leitura?.moeda || 'BRL')

    if (
      moedaComprovante &&
      moedaComprovante !== 'BRL' &&
      moedaComprovante !== 'R$' &&
      !moedaComprovante.includes('REAL')
    ) {
      return marcarRevisao(
        admin,
        fatura.id,
        `O comprovante foi lido em moeda diferente de BRL (${texto(leitura?.moeda)}).`
      )
    }

    const diferenca = Math.abs(valorComprovante - valorEsperado)

    if (diferenca > TOLERANCIA_VALOR) {
      return marcarRevisao(
        admin,
        fatura.id,
        `Valor incompatível. Fatura: ${moeda(valorEsperado)}. Comprovante: ${moeda(valorComprovante)}.`
      )
    }

    const dataPagamento = dataIsoValida(leitura?.data_pagamento)

    if (!dataPagamento) {
      return marcarRevisao(
        admin,
        fatura.id,
        'A data efetiva da transação não pôde ser identificada com segurança.'
      )
    }

    const idTransacao = texto(leitura?.id_transacao)

    if (idTransacao.length >= 8) {
      const { data: possiveisDuplicadas } = await admin
        .from('faturas')
        .select('id, numero_fatura, observacao_pagamento')
        .neq('id', fatura.id)
        .ilike('observacao_pagamento', `%${idTransacao}%`)
        .limit(5)

      if ((possiveisDuplicadas || []).length > 0) {
        return marcarRevisao(
          admin,
          fatura.id,
          'O identificador desta transação já aparece em outra fatura. Conferência manual obrigatória.'
        )
      }
    }

    let pdfBytes: Buffer

    try {
      pdfBytes = await gerarPdfRecibo({
        fatura,
        embarque,
        valor: valorComprovante,
        dataPagamento,
        idTransacao: idTransacao || null,
      })
    } catch (error: any) {
      return marcarRevisao(
        admin,
        fatura.id,
        `Comprovante aprovado, mas o recibo precisa de conferência: ${error?.message || error}`
      )
    }

    const identificador = String(
      fatura.numero_fatura ||
      embarque.awb ||
      fatura.id
    ).replace(/[^A-Z0-9_-]/gi, '-')

    const caminhoRecibo =
      `recibos/${fatura.id}/auto-${Date.now()}-recibo-${identificador}.pdf`

    const { error: erroUploadRecibo } = await admin.storage
      .from('faturas')
      .upload(caminhoRecibo, pdfBytes, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'application/pdf',
      })

    if (erroUploadRecibo) {
      return marcarRevisao(
        admin,
        fatura.id,
        `Comprovante aprovado, mas houve erro ao salvar o recibo: ${erroUploadRecibo.message}`
      )
    }

    const { data: urlReciboData } = admin.storage
      .from('faturas')
      .getPublicUrl(caminhoRecibo)

    const urlRecibo = urlReciboData.publicUrl

    const observacaoValidacao = [
      'Comprovante validado automaticamente pelo HC Connect.',
      `Valor conferido: ${moeda(valorComprovante)}.`,
      `Data da transação: ${dataBR(dataPagamento)}.`,
      idTransacao ? `ID transação: ${idTransacao}.` : '',
      texto(leitura?.beneficiario)
        ? `Beneficiário lido: ${texto(leitura.beneficiario)}.`
        : '',
    ].filter(Boolean).join(' ')

    let financeiroCriadoId: string | null = null
    let financeiroAnterior: any = null

    if (financeiro?.id) {
      financeiroAnterior = {
        recebimento: financeiro.recebimento ?? null,
        valor_cobranca: financeiro.valor_cobranca ?? null,
        mes_profit: financeiro.mes_profit ?? null,
        observacoes: financeiro.observacoes ?? null,
      }

      const observacoesFinanceiro = [
        texto(financeiro.observacoes),
        'Recebimento confirmado automaticamente pelo comprovante do cliente.',
        `Recebimento em ${dataBR(dataPagamento)}.`,
        `Valor recebido: ${moeda(valorComprovante)}.`,
        idTransacao ? `ID transação: ${idTransacao}.` : '',
        `Recibo: ${urlRecibo}.`,
      ].filter(Boolean).join(' | ')

      const { error: erroFinanceiro } = await admin
        .from('financeiro_embarques')
        .update({
          recebimento: dataPagamento,
          valor_cobranca:
            numero(financeiro.valor_cobranca) > 0
              ? financeiro.valor_cobranca
              : valorEsperado,
          mes_profit: dataPagamento.slice(0, 7),
          observacoes: observacoesFinanceiro,
        })
        .eq('id', financeiro.id)

      if (erroFinanceiro) {
        await removerReciboStorage(admin, caminhoRecibo)

        return marcarRevisao(
          admin,
          fatura.id,
          `Comprovante aprovado, mas o Financeiro não pôde ser atualizado: ${erroFinanceiro.message}`
        )
      }
    } else {
      const payloadFinanceiro: any = {
        embarque_id: embarque.id,
        cliente:
          texto(fatura?.dados_cliente_faturamento?.nome_empresa) ||
          texto(fatura?.dados_cliente_faturamento?.razao_social) ||
          texto(embarque.cliente_final) ||
          texto(embarque.importador) ||
          null,
        awb: embarque.awb || null,
        fatura: fatura.numero_fatura || null,
        transportadora: embarque.transportadora || null,
        servico: embarque.servico || null,
        valor_cobranca: valorEsperado,
        valor_compra: 0,
        doc_dta: 0,
        debito_terceiro: 0,
        vencimento_cobranca: fatura.vencimento || null,
        recebimento: dataPagamento,
        mes: texto(fatura.vencimento).slice(0, 7) || dataPagamento.slice(0, 7),
        mes_profit: dataPagamento.slice(0, 7),
        observacoes: [
          'Processo financeiro criado automaticamente na validação do comprovante.',
          `Valor recebido: ${moeda(valorComprovante)}.`,
          `Recebimento em ${dataBR(dataPagamento)}.`,
          idTransacao ? `ID transação: ${idTransacao}.` : '',
          `Recibo: ${urlRecibo}.`,
        ].filter(Boolean).join(' | '),
      }

      const { data: criado, error: erroCriarFinanceiro } = await admin
        .from('financeiro_embarques')
        .insert([payloadFinanceiro])
        .select('id')
        .single()

      if (erroCriarFinanceiro) {
        await removerReciboStorage(admin, caminhoRecibo)

        return marcarRevisao(
          admin,
          fatura.id,
          `Comprovante aprovado, mas não foi possível criar o registro financeiro: ${erroCriarFinanceiro.message}`
        )
      }

      financeiroCriadoId = criado?.id || null
    }

    const { error: erroAtualizarFatura } = await admin
      .from('faturas')
      .update({
        recibo_pdf: urlRecibo,
        recibo_nome: `Recibo ${fatura.numero_fatura || embarque.awb || ''}`.trim(),
        data_pagamento: dataPagamento,
        valor_pago: valorComprovante,
        recibo_emitido_em: new Date().toISOString(),
        status_pagamento: 'PAGO',
        observacao_pagamento: observacaoValidacao,
      })
      .eq('id', fatura.id)

    if (erroAtualizarFatura) {
      if (financeiro?.id && financeiroAnterior) {
        await admin
          .from('financeiro_embarques')
          .update(financeiroAnterior)
          .eq('id', financeiro.id)
      } else if (financeiroCriadoId) {
        await admin
          .from('financeiro_embarques')
          .delete()
          .eq('id', financeiroCriadoId)
      }

      await removerReciboStorage(admin, caminhoRecibo)

      return marcarRevisao(
        admin,
        fatura.id,
        `Comprovante aprovado, mas a fatura não pôde ser baixada: ${erroAtualizarFatura.message}`
      )
    }

    return NextResponse.json({
      ok: true,
      status: 'APROVADO',
      mensagem:
        `Pagamento validado em ${dataBR(dataPagamento)} no valor de ${moeda(valorComprovante)}. Recibo emitido automaticamente.`,
      valor_comprovante: valorComprovante,
      valor_fatura: valorEsperado,
      data_pagamento: dataPagamento,
      recibo_url: urlRecibo,
    })
  } catch (error: any) {
    console.error('Erro geral na validação automática de comprovante:', error)

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Erro inesperado ao validar o comprovante.',
      },
      { status: 500 }
    )
  }
}
