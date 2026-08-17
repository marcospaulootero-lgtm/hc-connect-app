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
  tipo_lancamento: 'COMPRA' | 'IMPOSTOS'
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

async function vincularPdfConsolidado(
  buffer: Buffer,
  nomeArquivoOriginal: string,
  faturaIds: string[]
) {
  const ids = Array.from(new Set(faturaIds.filter(Boolean)))
  if (ids.length === 0) return null

  const supabase = supabaseAdmin()
  const nomeLimpo = String(nomeArquivoOriginal || 'faturas-fedex.pdf')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'faturas-fedex.pdf'

  const caminho = `transportadoras/FedEx/consolidados/${Date.now()}-${nomeLimpo}`

  const { error: erroUpload } = await supabase.storage
    .from('faturas')
    .upload(caminho, buffer, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'application/pdf',
    })

  if (erroUpload) {
    throw new Error('Faturas salvas, mas houve erro ao anexar o PDF consolidado: ' + erroUpload.message)
  }

  const { data: urlData } = supabase.storage.from('faturas').getPublicUrl(caminho)
  const arquivoPdf = urlData.publicUrl

  const { error: erroVinculo } = await supabase
    .from('faturas_transportadoras')
    .update({
      arquivo_pdf: arquivoPdf,
      atualizado_em: new Date().toISOString(),
    })
    .in('id', ids)

  if (erroVinculo) {
    throw new Error('PDF enviado, mas houve erro ao vinculá-lo às faturas: ' + erroVinculo.message)
  }

  return arquivoPdf
}

async function buscarFinanceiroPorAwb(supabase: any, awbOriginal: string) {
  const awb = normalizarAwb(awbOriginal)
  if (!awb) return null

  const { data, error } = await supabase
    .from('financeiro_embarques')
    .select('id, awb, valor_compra, doc_dta')
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

  const itensValidos = unicosPorAwb(preview.itens)
    .map((item) => ({
      ...item,
      awb: normalizarAwb(item.awb),
      valor_compra: Number(item.valor_compra || 0),
    }))
    .filter((item) => item.awb && item.valor_compra > 0)

  const semItensAutomaticos = itensValidos.length === 0

  const totalItens = itensValidos.reduce((acc, item) => acc + Number(item.valor_compra || 0), 0)
  const totalFatura = Number(preview.valor_total || totalItens || 0)
  const tipoLancamento = preview.tipo_lancamento || 'COMPRA'

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
    observacoes:
      semItensAutomaticos
        ? 'Fatura importada por PDF, mas nenhum AWB/valor foi identificado automaticamente. Conferir itens manualmente.'
        : tipoLancamento === 'IMPOSTOS'
          ? 'Fatura FedEx de impostos/taxas importada por PDF e sincronizada pelo Supabase.'
          : 'Fatura de transportadora importada por PDF e sincronizada pelo Supabase.',
    atualizado_em: agora,
  }

  const { data: faturasEncontradas, error: erroBuscaFaturas } = await supabase
    .from('faturas_transportadoras')
    .select('id, transportadora, numero_fatura')
    .eq('transportadora', preview.transportadora)

  if (erroBuscaFaturas) {
    throw new Error('Erro ao buscar fatura existente: ' + erroBuscaFaturas.message)
  }

  const faturaExistente = ((faturasEncontradas as any[]) || []).find((item) => {
    return normalizarNumeroFaturaParaSistema(item.numero_fatura) === numeroFatura
  })

  let faturaId = faturaExistente?.id || ''

  if (faturaId) {
    const { error } = await supabase
      .from('faturas_transportadoras')
      .update(payloadFatura)
      .eq('id', faturaId)

    if (error) {
      throw new Error('Erro ao atualizar fatura da transportadora: ' + error.message)
    }
  } else {
    const { data: faturaCriada, error } = await supabase
      .from('faturas_transportadoras')
      .insert([payloadFatura])
      .select('id')
      .single()

    if (error) {
      throw new Error('Erro ao cadastrar fatura da transportadora: ' + error.message)
    }

    faturaId = faturaCriada.id
  }

  if (semItensAutomaticos) {
    return {
      fatura_id: faturaId,
      numero_fatura: numeroFatura,
      itens_salvos: 0,
      custos_lancados: 0,
      aguardando_processo: 0,
      ja_tinham_custo: 0,
      pendente_conferencia: true,
      mensagem: 'Fatura cadastrada, mas o PDF não permitiu leitura automática dos AWBs/valores. Conferir manualmente.',
    }
  }

  const awbsDoPdf = Array.from(new Set(itensValidos.map((item) => item.awb).filter(Boolean)))

  const { data: itensAntigos, error: erroItensAntigos } = await supabase
    .from('faturas_transportadoras_itens')
    .select('id, awb')
    .eq('fatura_transportadora_id', faturaId)

  if (erroItensAntigos) {
    throw new Error('Erro ao conferir itens antigos da fatura: ' + erroItensAntigos.message)
  }

  const idsParaRemover = ((itensAntigos as any[]) || [])
    .filter((item) => !awbsDoPdf.includes(normalizarAwb(item.awb)))
    .map((item) => item.id)
    .filter(Boolean)

  if (idsParaRemover.length > 0) {
    const { error: erroRemover } = await supabase
      .from('faturas_transportadoras_itens')
      .delete()
      .in('id', idsParaRemover)

    if (erroRemover) {
      throw new Error('Erro ao remover AWBs antigos/errados da fatura: ' + erroRemover.message)
    }
  }

  let itensSalvos = 0

  for (const item of itensValidos) {
    const awb = normalizarAwb(item.awb)

    const payloadItem = {
      fatura_transportadora_id: faturaId,
      transportadora: preview.transportadora,
      numero_fatura: numeroFatura,
      awb,
      referencia: item.referencia || null,
      data_envio: item.data_envio || null,
      valor_compra: Number(item.valor_compra || 0),
      tipo_lancamento: tipoLancamento,
      financeiro_embarque_id: null,
      valor_compra_anterior: null,
      status_lancamento: 'AGUARDANDO_PROCESSO',
      observacao: 'Item importado por PDF. Sincronização feita automaticamente pelo Supabase.',
      lancado_em: null,
      atualizado_em: agora,
    }

    const { data: itemExistente, error: erroBuscaItem } = await supabase
      .from('faturas_transportadoras_itens')
      .select('id')
      .eq('transportadora', preview.transportadora)
      .eq('numero_fatura', numeroFatura)
      .eq('awb', awb)
      .maybeSingle()

    if (erroBuscaItem) {
      throw new Error('Erro ao buscar item do AWB ' + awb + ': ' + erroBuscaItem.message)
    }

    if (itemExistente?.id) {
      const { error } = await supabase
        .from('faturas_transportadoras_itens')
        .update(payloadItem)
        .eq('id', itemExistente.id)

      if (error) {
        throw new Error('Erro ao atualizar item do AWB ' + awb + ': ' + error.message)
      }
    } else {
      const { error } = await supabase
        .from('faturas_transportadoras_itens')
        .insert([payloadItem])

      if (error) {
        throw new Error('Erro ao salvar item do AWB ' + awb + ': ' + error.message)
      }
    }

    itensSalvos++
  }

  const { error: erroSync } = await supabase.rpc('hc_sincronizar_itens_faturas_transportadoras')

  if (erroSync) {
    throw new Error('Itens salvos, mas erro ao sincronizar com processos faturados: ' + erroSync.message)
  }

  const { data: itensDepois, error: erroItensDepois } = await supabase
    .from('faturas_transportadoras_itens')
    .select('status_lancamento, financeiro_embarque_id, valor_compra_anterior')
    .eq('fatura_transportadora_id', faturaId)
    .in('awb', awbsDoPdf)

  if (erroItensDepois) {
    throw new Error('Fatura sincronizada, mas erro ao conferir resultado: ' + erroItensDepois.message)
  }

  let custosLancados = 0
  let aguardandoProcesso = 0
  let jaTinhamCusto = 0

  ;((itensDepois as any[]) || []).forEach((item) => {
    const status = String(item.status_lancamento || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()

    if (status.includes('LANCADO')) {
      custosLancados++
      return
    }

    if (status.includes('AGUARDANDO')) {
      aguardandoProcesso++
      return
    }

    if (
      status.includes('JA_TINHA') ||
      status.includes('CONFERIR') ||
      status.includes('EXISTENTE') ||
      Number(item.valor_compra_anterior || 0) > 0
    ) {
      jaTinhamCusto++
    }
  })

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

  // A FedEx pode trazer textos de taxas adicionais também em faturas normais de frete.
  // Quando o bloco da própria fatura declara FRETE / TRANSPORTE, essa natureza deve
  // prevalecer. Só tratamos como IMPOSTOS quando há um título forte de impostos e
  // não há identificação explícita de fatura de frete no mesmo bloco.
  const ehFaturaFrete =
    /FATURA\s+DE\s+FRETE\s+INTERNACIONAL/i.test(texto) ||
    /Sum[aá]rio\s+de\s+Transporte/i.test(texto) ||
    /Custos\s+de\s+Transporte\s+Expresso/i.test(texto)

  const ehFaturaImpostosTaxas =
    !ehFaturaFrete &&
    (/TAXAS,\s*IMPOSTOS,\s*E\s*OUTROS\s*ENCARGOS/i.test(texto) ||
      /Sum[aá]rio\s+de\s+Taxas/i.test(texto))

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
    tipo_lancamento: ehFaturaImpostosTaxas ? 'IMPOSTOS' : 'COMPRA',
    itens: unicosPorAwb(itens),
  }
}

function extrairFedExMultiplas(textoOriginal: string): PreviewPdf[] {
  const texto = limparTexto(textoOriginal)
  const regexNumeroFatura = /(?:N[úu]mero|No)\s+da\s+Fat(?:ura)?\s*:?\s*([0-9][0-9.-]+)/gi
  const grupos: Array<{ numero: string; index: number }> = []
  const numerosVistos = new Set<string>()

  for (const match of texto.matchAll(regexNumeroFatura)) {
    const numero = normalizarNumeroFaturaParaSistema(match[1])
    if (!numero || numerosVistos.has(numero)) continue

    numerosVistos.add(numero)
    grupos.push({
      numero,
      index: match.index || 0,
    })
  }

  if (grupos.length <= 1) {
    return [extrairFedEx(texto)]
  }

  return grupos
    .map((grupo, index) => {
      const inicio = grupo.index
      const fim = grupos[index + 1]?.index || texto.length
      return extrairFedEx(texto.slice(inicio, fim))
    })
    .filter((preview) => preview.numero_fatura)
}


function extrairDhl(textoOriginal: string): PreviewPdf {
  const bruto = String(textoOriginal || '').replace(/\r/g, '\n')
  const texto = limparTexto(bruto)

  const numeroFatura =
    texto.match(/Fatura:\s*(BHZIR[0-9A-Z]+)/i)?.[1]?.trim().toUpperCase() ||
    texto.match(/\b(BHZIR[0-9A-Z]+)\b/i)?.[1]?.trim().toUpperCase() ||
    ''

  const conta =
    texto.match(/Conta:\s*([0-9]+)/i)?.[1]?.trim() ||
    texto.match(/Número\s+da\s+Conta:\s*([0-9*]+)/i)?.[1]?.trim() ||
    null

  const emissao =
    dataBRParaISO(texto.match(/Emiss[ãa]o:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1]) ||
    null

  const vencimento =
    dataBRParaISO(texto.match(/Prazo\s+de\s+Pagamento:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1]) ||
    dataBRParaISO(texto.match(/Vencimento\s*[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1]) ||
    null

  const valorTotal =
    numeroBR(texto.match(/Valor\s+Total\s*\(\s*BRL\s*\)\s*([0-9.]+,\d{2})/i)?.[1]) ||
    numeroBR(texto.match(/Total:\s*BRL:[\s\S]{0,120}?([0-9]{1,3}(?:\.[0-9]{3})*,\d{2})/i)?.[1]) ||
    0

  function extrairItensDhlDireto(base: string) {
    const textoBase = String(base || '').replace(/\r/g, '\n')
    const marcadores: Array<{
      awb: string
      index: number
      referencia: string | null
      dataEnvio: string | null
    }> = []

    /*
      DHL no texto extraído:
      4610363273 SO45184062 06/07/2026 ...
      Total (BRL): 3.707,94

      Aqui a regra é direta:
      AWB no começo da linha + referência + data.
      Depois pega o primeiro Total (BRL) antes do próximo AWB.
    */
    const regexLinhaAwb = /(?:^|\n)\s*(\d{10})\s+(.{1,120}?)\s+(\d{1,2}\/\d{1,2}\/\d{4})\b/g
    let matchAwb: RegExpExecArray | null

    while ((matchAwb = regexLinhaAwb.exec(textoBase)) !== null) {
      const awb = normalizarAwb(matchAwb[1])
      const referencia = String(matchAwb[2] || '').replace(/\s+/g, ' ').trim() || null
      const dataEnvio = dataBRParaISO(matchAwb[3]) || null
      const index = Number(matchAwb.index || 0)

      if (!awb || awb.length !== 10) continue

      const trechoDepois = textoBase.slice(index, index + 3500)

      if (!/Total\s*\(\s*BRL\s*\)\s*:?/i.test(trechoDepois)) continue

      if (!marcadores.some((item) => item.awb === awb)) {
        marcadores.push({ awb, index, referencia, dataEnvio })
      }
    }

    marcadores.sort((a, b) => a.index - b.index)

    const itens: ItemPdf[] = []

    for (let i = 0; i < marcadores.length; i++) {
      const atual = marcadores[i]
      const proximo = marcadores[i + 1]
      const fim = proximo?.index || textoBase.length
      const bloco = textoBase.slice(atual.index, fim)

      const matchTotal = bloco.match(
        /Total\s*\(\s*BRL\s*\)\s*:?\s*([0-9]{1,3}(?:\.[0-9]{3})*,\d{2}|[0-9]+,\d{2})(?!\d)/i
      )

      const valorCompra = numeroBR(matchTotal?.[1])

      if (!valorCompra || valorCompra <= 0) continue

      if (valorTotal > 0 && marcadores.length > 1 && valorCompra >= valorTotal) continue

      itens.push({
        awb: atual.awb,
        referencia: atual.referencia,
        data_envio: atual.dataEnvio,
        valor_compra: Number(valorCompra.toFixed(2)),
      })
    }

    return unicosPorAwb(itens)
  }

  const itensBruto = extrairItensDhlDireto(bruto)
  const itensLimpo = extrairItensDhlDireto(texto)

  const somaBruto = itensBruto.reduce((acc, item) => acc + Number(item.valor_compra || 0), 0)
  const somaLimpo = itensLimpo.reduce((acc, item) => acc + Number(item.valor_compra || 0), 0)

  const itens =
    itensBruto.length > itensLimpo.length
      ? itensBruto
      : itensLimpo.length > itensBruto.length
        ? itensLimpo
        : Math.abs(somaBruto - valorTotal) <= Math.abs(somaLimpo - valorTotal)
          ? itensBruto
          : itensLimpo

  return {
    transportadora: 'DHL',
    conta,
    numero_fatura: numeroFatura,
    emissao,
    vencimento,
    valor_total: valorTotal,
    tipo_lancamento: 'COMPRA',
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

    let previews: PreviewPdf[] = []

    if (/FedEx|Federal Express/i.test(texto)) {
      previews = extrairFedExMultiplas(texto)
    } else if (/DHL Express|Fatura de Serviço|BHZIR/i.test(texto)) {
      previews = [extrairDhl(texto)]
    }

    if (!previews.length) {
      return NextResponse.json(
        { error: 'Não consegui identificar se o PDF é DHL ou FedEx.' },
        { status: 400 }
      )
    }

    const previewSemNumero = previews.find((preview) => !preview.numero_fatura)

    if (previewSemNumero) {
      return NextResponse.json(
        { error: 'Não consegui identificar o número da fatura no PDF.' },
        { status: 400 }
      )
    }

    previews = previews.map((preview) => ({
      ...preview,
      numero_fatura: normalizarNumeroFaturaParaSistema(preview.numero_fatura),
      itens: Array.isArray(preview.itens) ? preview.itens : [],
    }))

    const importacoes = []

    for (const preview of previews) {
      importacoes.push(await salvarFaturaEItens(preview))
    }

    let arquivoPdf: string | null = null

    if (previews.every((preview) => preview.transportadora === 'FedEx')) {
      arquivoPdf = await vincularPdfConsolidado(
        buffer,
        arquivo.name,
        importacoes.map((importacao) => importacao.fatura_id)
      )
    }

    return NextResponse.json({
      preview: previews[0],
      importacao: importacoes[0],
      previews,
      importacoes,
      total_faturas: previews.length,
      arquivo_pdf: arquivoPdf,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao importar PDF.' },
      { status: 500 }
    )
  }
}
