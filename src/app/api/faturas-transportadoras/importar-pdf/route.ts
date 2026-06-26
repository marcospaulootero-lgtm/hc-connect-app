import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type ItemPdf = {
  awb: string
  referencia: string | null
  data_envio: string | null
  valor_compra: number
}

type PreviewPdf = {
  transportadora: string
  conta: string | null
  numero_fatura: string
  emissao: string | null
  vencimento: string | null
  valor_total: number
  itens: ItemPdf[]
}

function limparTexto(texto: string) {
  return String(texto || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function numeroBR(valor: any) {
  if (valor === null || valor === undefined || valor === '') return 0
  if (typeof valor === 'number') return valor

  return (
    Number(
      String(valor)
        .replace(/[R$USD\s]/gi, '')
        .replace(/\./g, '')
        .replace(',', '.')
    ) || 0
  )
}

function dataBRParaISO(valor: any) {
  const texto = String(valor || '').trim()
  const match = texto.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)

  if (!match) return null

  const dia = match[1].padStart(2, '0')
  const mes = match[2].padStart(2, '0')
  const ano = match[3].length === 2 ? `20${match[3]}` : match[3]

  return `${ano}-${mes}-${dia}`
}

function dataMesPtParaISO(valor: any) {
  const texto = String(valor || '').trim().toLowerCase()

  const meses: Record<string, string> = {
    jan: '01',
    janeiro: '01',
    fev: '02',
    fevereiro: '02',
    mar: '03',
    março: '03',
    marco: '03',
    abr: '04',
    abril: '04',
    mai: '05',
    maio: '05',
    jun: '06',
    junho: '06',
    jul: '07',
    julho: '07',
    ago: '08',
    agosto: '08',
    set: '09',
    setembro: '09',
    out: '10',
    outubro: '10',
    nov: '11',
    novembro: '11',
    dez: '12',
    dezembro: '12',
  }

  const match = texto.match(/(\d{1,2})\s+([a-zçãé]+)\s+(\d{4})/i)
  if (!match) return null

  const dia = match[1].padStart(2, '0')
  const mes = meses[match[2]] || meses[match[2].slice(0, 3)]
  const ano = match[3]

  if (!mes) return null

  return `${ano}-${mes}-${dia}`
}

function somenteDigitos(valor: any) {
  return String(valor || '').replace(/\D/g, '')
}

function normalizarAwb(valor: any) {
  return somenteDigitos(valor)
}

function unicosPorAwb(itens: ItemPdf[]) {
  const mapa = new Map<string, ItemPdf>()

  itens.forEach((item) => {
    const awb = normalizarAwb(item.awb)
    if (!awb || item.valor_compra <= 0) return
    if (!mapa.has(awb)) mapa.set(awb, { ...item, awb })
  })

  return Array.from(mapa.values())
}

function extrairFedEx(textoOriginal: string): PreviewPdf {
  const texto = limparTexto(textoOriginal)

  const numeroFatura =
    texto.match(/N[úu]mero\s+da\s+Fatura:\s*([0-9.-]+)/i)?.[1]?.trim() || ''

  const emissao =
    dataMesPtParaISO(texto.match(/Data\s+de\s+Emiss[ãa]o:\s*(\d{1,2}\s+[a-zçãé]{3,12}\s+\d{4})/i)?.[1]) ||
    null

  const vencimento =
    dataMesPtParaISO(texto.match(/Data\s+de\s*Vencimento:\s*(\d{1,2}\s+[a-zçãé]{3,12}\s+\d{4})/i)?.[1]) ||
    dataBRParaISO(texto.match(/Vencimento:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1]) ||
    null

  const valorTotal =
    numeroBR(texto.match(/Valor\s*Devido:\s*R\$\s*([0-9.]+,\d{2})/i)?.[1]) ||
    numeroBR(texto.match(/Valor\s+Total\s+USD\s+[0-9.,]+\s+R\$\s*([0-9.]+,\d{2})/i)?.[1])

  const itens: ItemPdf[] = []
  const rastreios = Array.from(texto.matchAll(/N[°º]\s*de\s*Rastreio\s+(\d{10,15})/gi))

  rastreios.forEach((match, index) => {
    const awb = normalizarAwb(match[1])
    const inicio = Math.max(0, match.index || 0)
    const inicioComCabecalho = Math.max(0, inicio - 350)
    const fim = rastreios[index + 1]?.index || texto.length
    const bloco = texto.slice(inicioComCabecalho, fim)

    const subtotal =
      numeroBR(bloco.match(/Subtotal\s+USD\s*[-0-9.,]+\s*R\$\s*([0-9.]+,\d{2})/i)?.[1]) ||
      numeroBR(bloco.match(/Subtotal\s+[-0-9.,]+\s+([0-9.]+,\d{2})/i)?.[1])

    const referenciaRaw =
      bloco.match(/Refer[êe]ncia:\s*([^\n]+)/i)?.[1]
        ?.replace(/N[°º]\s*de\s*Rastreio.*/i, '')
        ?.trim() || null

    const dataEnvio =
      dataMesPtParaISO(bloco.match(/Data\s+de\s+Emiss[ãa]o:\s*(\d{1,2}\s+[a-zçãé]{3,12}\s+\d{4})/i)?.[1]) ||
      null

    if (awb && subtotal > 0) {
      itens.push({
        awb,
        referencia: referenciaRaw,
        data_envio: dataEnvio,
        valor_compra: subtotal,
      })
    }
  })

  return {
    transportadora: 'FedEx',
    conta: texto.match(/N[úu]mero\s+da\s+Conta:\s*([*0-9]+)/i)?.[1]?.trim() || null,
    numero_fatura: numeroFatura,
    emissao,
    vencimento,
    valor_total: valorTotal,
    itens: unicosPorAwb(itens),
  }
}

function extrairDhl(textoOriginal: string): PreviewPdf {
  const texto = limparTexto(textoOriginal)

  const numeroFatura =
    texto.match(/Fatura:\s*(BHZIR[0-9A-Z]+)/i)?.[1]?.trim().toUpperCase() ||
    texto.match(/N[úu]mero\s+Fatura\s+IBS\s*([A-Z0-9]+)/i)?.[1]?.trim().toUpperCase() ||
    texto.match(/N[º°]\s*fatura\s*([0-9]+)/i)?.[1]?.trim() ||
    ''

  const conta = texto.match(/Conta:\s*([0-9]+)/i)?.[1]?.trim() || null

  const emissao =
    dataBRParaISO(texto.match(/Emiss[ãa]o:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1]) ||
    dataBRParaISO(texto.match(/Data\s+do\s+Documento\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1]) ||
    null

  const vencimento =
    dataBRParaISO(texto.match(/Prazo\s+de\s+Pagamento:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1]) ||
    dataBRParaISO(texto.match(/Vencimento\s*[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1]) ||
    null

  const valorTotal =
    numeroBR(texto.match(/Valor\s+Total\s*\(BRL\)\s*([0-9.]+,\d{2})/i)?.[1]) ||
    numeroBR(texto.match(/Valor\s+Total\s+da\s+Fatura\s*([0-9.]+,\d{2})/i)?.[1]) ||
    numeroBR(texto.match(/Valor\s+do\s+Documento\s*[:\s]+([0-9.]+,\d{2})/i)?.[1])

  const itens: ItemPdf[] = []
  const awbs = Array.from(texto.matchAll(/(?:^|\n)(\d{10})\s+/g))

  awbs.forEach((match, index) => {
    const awb = normalizarAwb(match[1])
    const inicio = match.index || 0
    const fim =
      awbs[index + 1]?.index ||
      texto.indexOf('Sub-Total de Serviço', inicio) ||
      texto.length

    const bloco = texto.slice(inicio, fim)
    const primeiraLinha = bloco.split('\n')[0] || ''

    const totalBrl = numeroBR(bloco.match(/Total\s*\(BRL\):\s*([0-9.]+,\d{2})/i)?.[1])
    const dataEnvio = dataBRParaISO(primeiraLinha.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)?.[1])
    const referencia =
      primeiraLinha
        .replace(awb, '')
        .replace(/\d{1,2}\/\d{1,2}\/\d{4}.*/g, '')
        .trim() || null

    if (awb && totalBrl > 0) {
      itens.push({
        awb,
        referencia,
        data_envio: dataEnvio,
        valor_compra: totalBrl,
      })
    }
  })

  return {
    transportadora: 'DHL',
    conta,
    numero_fatura: numeroFatura,
    emissao,
    vencimento,
    valor_total: valorTotal,
    itens: unicosPorAwb(itens),
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const arquivo = formData.get('arquivo')

    if (!(arquivo instanceof File)) {
      return NextResponse.json(
        { error: 'Arquivo PDF não enviado.' },
        { status: 400 }
      )
    }

    if (arquivo.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Envie apenas arquivo PDF.' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await arquivo.arrayBuffer())
    const pdfParse = (await import('pdf-parse')).default
    const resultado = await pdfParse(buffer)
    const texto = limparTexto(resultado.text || '')

    if (!texto) {
      return NextResponse.json(
        { error: 'Não foi possível ler texto deste PDF.' },
        { status: 400 }
      )
    }

    let preview: PreviewPdf | null = null

    if (/FedEx|Federal Express/i.test(texto)) {
      preview = extrairFedEx(texto)
    } else if (/DHL Express|Fatura de Serviço|BHZIR/i.test(texto)) {
      preview = extrairDhl(texto)
    }

    if (!preview) {
      return NextResponse.json(
        { error: 'Não consegui identificar se o PDF é DHL ou FedEx.' },
        { status: 400 }
      )
    }

    if (!preview.numero_fatura) {
      return NextResponse.json(
        { error: 'Não consegui identificar o número da fatura no PDF.' },
        { status: 400 }
      )
    }

    if (!preview.itens.length) {
      return NextResponse.json(
        { error: 'Não encontrei AWBs com valor em R$ neste PDF. Verifique se enviou a fatura detalhada, não apenas o boleto.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ preview })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao importar PDF.' },
      { status: 500 }
    )
  }
}
