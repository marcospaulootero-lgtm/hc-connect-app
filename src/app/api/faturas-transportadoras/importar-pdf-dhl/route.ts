import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

type ItemPdf = {
  awb: string
  referencia: string | null
  data_envio: string | null
  valor_compra: number
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
  const ano = match[3].length === 2 ? '20' + match[3] : match[3]

  return ano + '-' + mes + '-' + dia
}

function limparTexto(texto: any) {
  return String(texto || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function somenteDigitos(valor: any) {
  return String(valor || '').replace(/\D/g, '')
}

function normalizarAwb(valor: any) {
  return somenteDigitos(valor)
}

function normalizarNumeroFaturaParaSistema(valor: any) {
  const texto = String(valor || '').trim()
  const numeros = texto.replace(/\D/g, '')
  return numeros || texto.toUpperCase()
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL não configurada.')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada.')

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

function unicosPorAwb(itens: ItemPdf[]) {
  const mapa = new Map<string, ItemPdf>()

  for (const item of itens) {
    const awb = normalizarAwb(item.awb)
    const valor = Number(item.valor_compra || 0)

    if (!awb || awb.length !== 10 || valor <= 0) continue
    if (!mapa.has(awb)) {
      mapa.set(awb, {
        ...item,
        awb,
        valor_compra: Number(valor.toFixed(2)),
      })
    }
  }

  return Array.from(mapa.values())
}

async function lerTextoPdf(arquivo: File) {
  const arrayBuffer = await arquivo.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const mod: any = await import('pdf-parse')
  const pdfParse = mod.default || mod

  const resultado = await pdfParse(buffer)
  return String(resultado?.text || '')
}

function extrairDhl(textoOriginal: string) {
  const bruto = String(textoOriginal || '').replace(/\r/g, '\n')
  const texto = limparTexto(bruto)

  const numeroCompleto =
    texto.match(/Fatura:\s*(BHZIR[0-9A-Z]+)/i)?.[1]?.trim().toUpperCase() ||
    texto.match(/\b(BHZIR[0-9A-Z]+)\b/i)?.[1]?.trim().toUpperCase() ||
    ''

  const numeroFatura = normalizarNumeroFaturaParaSistema(numeroCompleto)

  const conta =
    texto.match(/Conta:\s*([0-9]+)/i)?.[1]?.trim() ||
    null

  const emissao =
    dataBRParaISO(texto.match(/Emiss[ãa]o:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1]) ||
    null

  const vencimento =
    dataBRParaISO(texto.match(/Prazo\s+de\s+Pagamento:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1]) ||
    null

  const valorTotal =
    numeroBR(texto.match(/Valor\s+Total\s*\(\s*BRL\s*\)\s*([0-9.]+,\d{2})/i)?.[1]) ||
    0

  const marcadores: Array<{
    awb: string
    index: number
    referencia: string | null
    data_envio: string | null
  }> = []

  /*
    Regra DHL:
    acha AWB de 10 dígitos no texto extraído e, dentro do bloco até o próximo AWB,
    pega somente o valor após "Total (BRL):".
  */
  const regexAwb = /(^|[^A-Za-z0-9])(\d{10})(?!\d)/g
  let matchAwb: RegExpExecArray | null

  while ((matchAwb = regexAwb.exec(bruto)) !== null) {
    const awb = normalizarAwb(matchAwb[2])
    const index = Number(matchAwb.index || 0) + String(matchAwb[1] || '').length

    if (!awb || awb.length !== 10) continue

    const trechoInicio = bruto.slice(index, index + 500)
    const matchData = trechoInicio.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/)
    const data_envio = dataBRParaISO(matchData?.[1]) || null

    const referencia = matchData
      ? trechoInicio
          .replace(new RegExp('^' + awb + '\\s*'), '')
          .slice(0, matchData.index || 0)
          .replace(/\s+/g, ' ')
          .trim() || null
      : null

    const depois = bruto.slice(index, index + 9000)

    if (!/Total\s*\(\s*BRL\s*\)\s*:?/i.test(depois)) continue

    if (!marcadores.some((item) => item.awb === awb)) {
      marcadores.push({ awb, index, referencia, data_envio })
    }
  }

  marcadores.sort((a, b) => a.index - b.index)

  const itens: ItemPdf[] = []

  for (let i = 0; i < marcadores.length; i++) {
    const atual = marcadores[i]
    const proximo = marcadores[i + 1]
    const bloco = bruto.slice(atual.index, proximo?.index || bruto.length)

    const totalBrlDepois = bloco.match(
      /Total\s*\(\s*BRL\s*\)\s*:?\s*([0-9]{1,3}(?:\.[0-9]{3})*,\d{2}|[0-9]+,\d{2})(?!\d)/i
    )

    const totalBrlAntes = bloco.match(
      /([0-9]{1,3}(?:\.[0-9]{3})*,\d{2}|[0-9]+,\d{2})(?!\d)\s*Total\s*\(\s*BRL\s*\)\s*:?/i
    )

    const valorCompra = numeroBR(totalBrlDepois?.[1] || totalBrlAntes?.[1])

    if (!valorCompra || valorCompra <= 0) continue
    if (valorTotal > 0 && marcadores.length > 1 && valorCompra >= valorTotal) continue

    itens.push({
      awb: atual.awb,
      referencia: atual.referencia,
      data_envio: atual.data_envio,
      valor_compra: Number(valorCompra.toFixed(2)),
    })
  }

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

async function salvarDhl(preview: ReturnType<typeof extrairDhl>) {
  const supabase = supabaseAdmin()
  const agora = new Date().toISOString()
  const numeroFatura = normalizarNumeroFaturaParaSistema(preview.numero_fatura)

  if (!numeroFatura) {
    throw new Error('Não consegui identificar o número da fatura DHL no PDF.')
  }

  const itensValidos = unicosPorAwb(preview.itens)

  const payloadFatura = {
    transportadora: 'DHL',
    conta: preview.conta || null,
    numero_fatura: numeroFatura,
    emissao: preview.emissao || null,
    vencimento: preview.vencimento || null,
    situacao: 'EM ABERTO',
    total: Number(preview.valor_total || 0),
    saldo: Number(preview.valor_total || 0),
    moeda: 'BRL',
    observacoes:
      itensValidos.length === 0
        ? 'Fatura DHL importada, mas nenhum AWB/Total (BRL) foi identificado automaticamente.'
        : 'Fatura DHL importada pela rota exclusiva AWB + Total (BRL).',
    atualizado_em: agora,
  }

  const { data: faturasEncontradas, error: erroBusca } = await supabase
    .from('faturas_transportadoras')
    .select('id, numero_fatura')
    .eq('transportadora', 'DHL')

  if (erroBusca) throw new Error('Erro ao buscar fatura DHL existente: ' + erroBusca.message)

  const faturaExistente = ((faturasEncontradas as any[]) || []).find((item) => {
    return normalizarNumeroFaturaParaSistema(item.numero_fatura) === numeroFatura
  })

  let faturaId = faturaExistente?.id || ''

  if (faturaId) {
    const { error } = await supabase
      .from('faturas_transportadoras')
      .update(payloadFatura)
      .eq('id', faturaId)

    if (error) throw new Error('Erro ao atualizar fatura DHL: ' + error.message)
  } else {
    const { data, error } = await supabase
      .from('faturas_transportadoras')
      .insert([payloadFatura])
      .select('id')
      .single()

    if (error) throw new Error('Erro ao cadastrar fatura DHL: ' + error.message)
    faturaId = data.id
  }

  await supabase
    .from('faturas_transportadoras_itens')
    .delete()
    .eq('fatura_transportadora_id', faturaId)

  if (itensValidos.length > 0) {
    const payloadItens = itensValidos.map((item) => ({
      fatura_transportadora_id: faturaId,
      transportadora: 'DHL',
      numero_fatura: numeroFatura,
      awb: item.awb,
      referencia: item.referencia || null,
      data_envio: item.data_envio || null,
      valor_compra: Number(item.valor_compra || 0),
      tipo_lancamento: 'COMPRA',
      financeiro_embarque_id: null,
      valor_compra_anterior: null,
      status_lancamento: 'AGUARDANDO_PROCESSO',
      observacao: 'Item DHL importado por AWB + Total (BRL).',
      lancado_em: null,
      atualizado_em: agora,
    }))

    const { error } = await supabase
      .from('faturas_transportadoras_itens')
      .insert(payloadItens)

    if (error) throw new Error('Erro ao salvar itens DHL: ' + error.message)
  }

  const { error: erroSync } = await supabase.rpc('hc_sincronizar_itens_faturas_transportadoras')
  if (erroSync) throw new Error('Itens DHL salvos, mas erro ao sincronizar: ' + erroSync.message)

  const { data: itensDepois, error: erroDepois } = await supabase
    .from('faturas_transportadoras_itens')
    .select('awb, valor_compra, status_lancamento, financeiro_embarque_id, observacao')
    .eq('fatura_transportadora_id', faturaId)
    .order('awb')

  if (erroDepois) throw new Error('Fatura DHL salva, mas erro ao conferir itens: ' + erroDepois.message)

  const itensResultado = ((itensDepois as any[]) || []).map((item) => ({
    awb: item.awb,
    valor_compra: Number(item.valor_compra || 0),
    status_lancamento: item.status_lancamento,
    financeiro_embarque_id: item.financeiro_embarque_id,
    observacao: item.observacao,
  }))

  return {
    fatura_id: faturaId,
    numero_fatura: numeroFatura,
    valor_total: Number(preview.valor_total || 0),
    itens_salvos: itensValidos.length,
    itens: itensResultado,
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()

    const arquivo = Array.from(formData.values()).find((valor: any) => {
      return valor && typeof valor === 'object' && typeof valor.arrayBuffer === 'function'
    }) as File | undefined

    if (!arquivo) {
      return NextResponse.json({ error: 'Nenhum PDF DHL foi enviado.' }, { status: 400 })
    }

    const texto = await lerTextoPdf(arquivo)
    const preview = extrairDhl(texto)
    const resultado = await salvarDhl(preview)

    const itens = resultado.itens || []

    const custosLancados = itens.filter((item) => {
      const status = String(item.status_lancamento || '').toUpperCase()
      return status === 'LANCADO' || status === 'JA_LANCADO'
    }).length

    const aguardandoProcesso = itens.filter((item) => {
      const status = String(item.status_lancamento || '').toUpperCase()
      return status.includes('AGUARDANDO')
    }).length

    const jaTinhamCusto = itens.filter((item) => {
      const status = String(item.status_lancamento || '').toUpperCase()
      return status.includes('CONFERIR') || status.includes('EXISTENTE')
    }).length

    return NextResponse.json({
      ok: true,
      transportadora: 'DHL',
      conta: preview.conta,
      numero_fatura: resultado.numero_fatura,
      fatura: resultado.numero_fatura,
      emissao: preview.emissao,
      vencimento: preview.vencimento,
      valor_total: resultado.valor_total,
      total_fatura: resultado.valor_total,
      awbs_encontrados: preview.itens.length,
      itens_salvos: resultado.itens_salvos,
      custos_lancados: custosLancados,
      aguardando_processo: aguardandoProcesso,
      ja_tinham_custo: jaTinhamCusto,
      pendente_conferencia: resultado.itens_salvos === 0,
      mensagem:
        resultado.itens_salvos === 0
          ? 'Fatura DHL cadastrada, mas nenhum AWB/Total (BRL) foi identificado.'
          : 'Fatura DHL importada e sincronizada automaticamente.',
      itens,
      preview,
    })
  } catch (error: any) {
    console.error('Erro ao importar PDF DHL:', error)

    return NextResponse.json(
      { error: error?.message || 'Erro ao importar PDF DHL.' },
      { status: 500 }
    )
  }
}
