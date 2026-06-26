import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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




function normalizarNumeroFaturaParaSistema(numeroFatura: any) {
  const textoOriginal = String(numeroFatura || '').trim()
  if (!textoOriginal) return ''

  const somenteNumeros = textoOriginal.replace(/\D/g, '')
  return somenteNumeros || textoOriginal.toUpperCase()
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL não configurada.')
  }

  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada.')
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

async function buscarFinanceiroPorAwb(supabase: any, awbOriginal: string) {
  const awb = normalizarAwb(awbOriginal)
  if (!awb) return null

  const { data, error } = await supabase
    .from('financeiro_embarques')
    .select('id, awb, valor_compra')
    .eq('awb', awb)
    .limit(10)

  if (error) {
    throw new Error('Erro ao buscar AWB no financeiro: ' + error.message)
  }

  const direto = (data || []).find((item: any) => normalizarAwb(item.awb) === awb)
  if (direto) return direto

  const { data: aproximados, error: erroAproximado } = await supabase
    .from('financeiro_embarques')
    .select('id, awb, valor_compra')
    .ilike('awb', `%${awb}%`)
    .limit(10)

  if (erroAproximado) {
    throw new Error('Erro ao buscar AWB aproximado no financeiro: ' + erroAproximado.message)
  }

  return (aproximados || []).find((item: any) => normalizarAwb(item.awb) === awb) || null
}

async function salvarFaturaEItens(preview: PreviewPdf) {
  const supabase = supabaseAdmin()
  const agora = new Date().toISOString()
  const numeroFatura = normalizarNumeroFaturaParaSistema(preview.numero_fatura)
  const totalItens = preview.itens.reduce((acc, item) => acc + Number(item.valor_compra || 0), 0)
  const totalFatura = Number(preview.valor_total || totalItens || 0)

  const payloadFatura = {
    transportadora: preview.transportadora,
    conta: preview.conta || null,
    numero_fatura: numeroFatura,
    emissao: preview.emissao || null,
    vencimento: preview.vencimento || null,
    situacao: 'EM ABERTO',
    total: totalFatura,
    saldo: totalFatura,
    moeda: 'BRL',
    observacoes: `Importada por PDF com ${preview.itens.length} AWB(s).`,
    atualizado_em: agora,
  }

  const { data: faturaExistente, error: erroBuscaFatura } = await supabase
    .from('faturas_transportadoras')
    .select('id')
    .eq('transportadora', preview.transportadora)
    .eq('numero_fatura', numeroFatura)
    .maybeSingle()

  if (erroBuscaFatura) {
    throw new Error('Erro ao buscar fatura existente: ' + erroBuscaFatura.message)
  }

  let faturaId = faturaExistente?.id

  if (faturaId) {
    const { error } = await supabase
      .from('faturas_transportadoras')
      .update(payloadFatura)
      .eq('id', faturaId)

    if (error) {
      throw new Error('Erro ao atualizar fatura: ' + error.message)
    }
  } else {
    const { data: faturaCriada, error } = await supabase
      .from('faturas_transportadoras')
      .insert([payloadFatura])
      .select('id')
      .single()

    if (error) {
      throw new Error('Erro ao cadastrar fatura: ' + error.message)
    }

    faturaId = faturaCriada.id
  }

  let itensSalvos = 0
  let custosLancados = 0
  let aguardandoProcesso = 0
  let jaTinhamCusto = 0

  for (const item of preview.itens) {
    const awb = normalizarAwb(item.awb)
    if (!awb || Number(item.valor_compra || 0) <= 0) continue

    const financeiro = await buscarFinanceiroPorAwb(supabase, awb)
    const valorAnterior = Number(financeiro?.valor_compra || 0)
    let financeiroId = financeiro?.id || null
    let statusLancamento = 'AGUARDANDO_PROCESSO'
    let observacao = 'AWB ainda não encontrado em processos faturados. Será lançado quando o processo for criado.'

    if (financeiroId && valorAnterior <= 0) {
      const { error } = await supabase
        .from('financeiro_embarques')
        .update({
          valor_compra: item.valor_compra,
          atualizado_em: agora,
        })
        .eq('id', financeiroId)

      if (error) {
        throw new Error(`Erro ao lançar custo no AWB ${awb}: ${error.message}`)
      }

      statusLancamento = 'LANÇADO'
      observacao = 'Valor de compra lançado automaticamente pela importação da fatura.'
      custosLancados++
    } else if (financeiroId && valorAnterior > 0) {
      statusLancamento = 'PROCESSO_JA_TINHA_CUSTO'
      observacao = `Processo já tinha custo lançado: ${valorAnterior}.`
      jaTinhamCusto++
    } else {
      aguardandoProcesso++
    }

    const payloadItem = {
      fatura_transportadora_id: faturaId,
      transportadora: preview.transportadora,
      numero_fatura: numeroFatura,
      awb,
      referencia: item.referencia || null,
      data_envio: item.data_envio || null,
      valor_compra: item.valor_compra,
      financeiro_embarque_id: financeiroId,
      valor_compra_anterior: valorAnterior,
      status_lancamento: statusLancamento,
      observacao,
      lancado_em: statusLancamento === 'LANÇADO' ? agora : null,
    }

    const { data: itemExistente, error: erroBuscaItem } = await supabase
      .from('faturas_transportadoras_itens')
      .select('id')
      .eq('fatura_transportadora_id', faturaId)
      .eq('awb', awb)
      .maybeSingle()

    if (erroBuscaItem) {
      throw new Error(`Erro ao buscar item do AWB ${awb}: ${erroBuscaItem.message}`)
    }

    if (itemExistente?.id) {
      const { error } = await supabase
        .from('faturas_transportadoras_itens')
        .update(payloadItem)
        .eq('id', itemExistente.id)

      if (error) {
        throw new Error(`Erro ao atualizar item do AWB ${awb}: ${error.message}`)
      }
    } else {
      const { error } = await supabase
        .from('faturas_transportadoras_itens')
        .insert([payloadItem])

      if (error) {
        throw new Error(`Erro ao salvar item do AWB ${awb}: ${error.message}`)
      }
    }

    itensSalvos++
  }

  return {
    fatura_id: faturaId,
    numero_fatura: numeroFatura,
    itens_salvos: itensSalvos,
    custos_lancados: custosLancados,
    aguardando_processo: aguardandoProcesso,
    ja_tinham_custo: jaTinhamCusto,
  }
}

function extrairFedEx(textoOriginal: string): PreviewPdf {
  const texto = limparTexto(textoOriginal)

  const numeroFatura =
    texto.match(/N[úu]mero\s+da\s+Fatura:\s*([0-9.-]+)/i)?.[1]?.trim() ||
    texto.match(/No\s+da\s+Fatura:\s*([0-9.-]+)/i)?.[1]?.trim() ||
    ''

  const emissao =
    dataMesPtParaISO(texto.match(/Data\s+de\s+Emiss[ãa]o:\s*(\d{1,2}\s+[a-zçãé]{3,12}\s+\d{4})/i)?.[1]) ||
    dataBRParaISO(texto.match(/Data\s+do\s+Docto:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1]) ||
    null

  const vencimento =
    dataMesPtParaISO(texto.match(/Data\s+de\s*Vencimento:\s*(\d{1,2}\s+[a-zçãé]{3,12}\s+\d{4})/i)?.[1]) ||
    dataBRParaISO(texto.match(/Vencimento:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1]) ||
    null

  const valorTotal =
    numeroBR(texto.match(/Valor\s*Devido:\s*R\$\s*([0-9.]+,\d{2})/i)?.[1]) ||
    numeroBR(texto.match(/ValorDevido:\s*R\$\s*([0-9.]+,\d{2})/i)?.[1]) ||
    numeroBR(texto.match(/Valor\s+Total\s+USD\s+[0-9.,]+\s+R\$\s*([0-9.]+,\d{2})/i)?.[1]) ||
    numeroBR(texto.match(/Valor\s+do\s+Documento:\s*([0-9.]+,\d{2})/i)?.[1])

  const itens: ItemPdf[] = []

  let marcadores = Array.from(
    texto.matchAll(/(?:N[°ºo.]?\s*de\s*)?Rastreio\s*[:\s]*([0-9][0-9\s.-]{8,20})/gi)
  ).map((match) => ({
    awb: normalizarAwb(match[1]),
    index: match.index || 0,
  })).filter((item) => item.awb.length >= 10 && item.awb.length <= 15)

  if (marcadores.length === 0) {
    marcadores = Array.from(texto.matchAll(/\b(\d{12})\b/g))
      .map((match) => ({
        awb: normalizarAwb(match[1]),
        index: match.index || 0,
      }))
      .filter((item) => {
        const trecho = texto.slice(Math.max(0, item.index - 250), item.index + 1200)
        return /FedEx|Federal Express|Subtotal|Taxa\s+de\s+Transporte|Rastreio/i.test(trecho)
      })
  }

  const vistos = new Set<string>()
  marcadores = marcadores.filter((item) => {
    if (!item.awb || vistos.has(item.awb)) return false
    vistos.add(item.awb)
    return true
  })

  marcadores.forEach((item, index) => {
    const inicio = item.index
    const fim = marcadores[index + 1]?.index || texto.length
    const bloco = texto.slice(inicio, fim)
    const blocoAntes = texto.slice(Math.max(0, inicio - 500), inicio)

    const posSubtotal = bloco.search(/Subtotal/i)
    if (posSubtotal < 0) return

    const janelaSubtotal = bloco.slice(posSubtotal, posSubtotal + 300)

    const valorComReal = janelaSubtotal.match(/R\$\s*([0-9.]+,\d{2})/i)?.[1]

    const valores = Array.from(
      janelaSubtotal.matchAll(/([0-9]{1,3}(?:\.[0-9]{3})*,\d{2}|[0-9]+,\d{2})/g)
    ).map((match) => match[1])

    const valorSubtotal = numeroBR(valorComReal || valores[valores.length - 1])

    if (!valorSubtotal || valorSubtotal <= 0) return

    const referenciaRaw =
      blocoAntes.match(/Refer[êe]ncia:\s*([^\n]+)/i)?.[1]
        ?.replace(/N[°ºo.]?\s*de\s*Rastreio.*/i, '')
        ?.trim() || null

    const dataEnvio =
      dataMesPtParaISO(blocoAntes.match(/Data\s+de\s+Emiss[ãa]o:\s*(\d{1,2}\s+[a-zçãé]{3,12}\s+\d{4})/i)?.[1]) ||
      null

    itens.push({
      awb: item.awb,
      referencia: referenciaRaw,
      data_envio: dataEnvio,
      valor_compra: valorSubtotal,
    })
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
    const pdfParseModule = await import('pdf-parse/lib/pdf-parse.js')
    const pdfParse = (pdfParseModule as any).default || pdfParseModule
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
        { error: 'Não encontrei AWBs com valor em R$ neste PDF. O leitor conseguiu abrir o PDF, mas não conseguiu associar rastreio + subtotal. Me envie o print deste alerta se continuar.' },
        { status: 400 }
      )
    }

    preview.numero_fatura = normalizarNumeroFaturaParaSistema(preview.numero_fatura)

    const importacao = await salvarFaturaEItens(preview)

    return NextResponse.json({ preview, importacao })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao importar PDF.' },
      { status: 500 }
    )
  }
}
