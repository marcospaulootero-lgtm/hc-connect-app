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

  if (!itensValidos.length) {
    throw new Error('Nenhum AWB válido encontrado para salvar no Supabase.')
  }

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
      tipoLancamento === 'IMPOSTOS'
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

  const ehFaturaImpostosTaxas =
    /TAXAS,\s*IMPOSTOS,\s*E\s*OUTROS\s*ENCARGOS/i.test(texto) ||
    /Sumário\s+de\s+Taxas/i.test(texto) ||
    /Tarifa\s+de\s+transferência\s+de\s+aeroporto/i.test(texto) ||
    /Cobranças\s+de\s+Serviços\s+Adicionais/i.test(texto)

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
    dataBRParaISO(texto.match(/Data\s+do\s+Documento\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1]) ||
    null

  const vencimento =
    dataBRParaISO(texto.match(/Prazo\s+de\s+Pagamento:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1]) ||
    dataBRParaISO(texto.match(/Vencimento\s*[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1]) ||
    null

  const valorTotal =
    numeroBR(texto.match(/Valor\s+Total\s*\(\s*BRL\s*\)\s*([0-9.]+,\d{2})/i)?.[1]) ||
    numeroBR(texto.match(/Valor\s+Total\s+da\s+Fatura\s*([0-9.]+,\d{2})/i)?.[1]) ||
    0

  type MarcadorAwbDhl = {
    awb: string
    index: number
  }

  function areaDetalhadaDhl() {
    const paginas = bruto.split(/\f/g)

    if (paginas.length > 1) {
      const paginasDetalhe = paginas
        .slice(1)
        .filter((pagina) => /(?:^|\n)\s*\d{10}(?=\s)/.test(pagina))

      if (paginasDetalhe.length) return paginasDetalhe.join('\n')
    }

    const inicioCabecalho = bruto.search(/AWB\s+Refer[êe]ncia/i)
    if (inicioCabecalho >= 0) return bruto.slice(inicioCabecalho)

    const inicioPrimeiroAwb = bruto.search(
      /(?:^|\n)\s*\d{10}(?=\s)[\s\S]{0,450}?\d{1,2}\/\d{1,2}\/\d{4}[\s\S]{0,1200}?(?:EXPRESS|WORLDWIDE|NONDOC|DOC)/i
    )

    if (inicioPrimeiroAwb >= 0) return bruto.slice(inicioPrimeiroAwb)

    return bruto
  }

  function extrairAwbs(base: string) {
    const candidatos: MarcadorAwbDhl[] = []
    const linhas = String(base || '').split('\n')
    let posicao = 0

    for (const linhaOriginal of linhas) {
      const linha = String(linhaOriginal || '')
      const inicioLinha = posicao
      posicao += linha.length + 1

      const match = linha.match(/^\s*(\d{10})(?=\s)/)
      if (!match) continue

      const awb = normalizarAwb(match[1])
      if (!awb || awb.length !== 10) continue

      const index = inicioLinha + linha.indexOf(match[1])
      const caractereDepois = base.slice(index + awb.length, index + awb.length + 1)

      // Evita o erro principal:
      // ORDER 60024025 + 15/06/2026 não pode virar 6002402515.
      // AWB DHL válido começa a linha e depois tem espaço, não barra/data colada.
      if (caractereDepois && !/\s/.test(caractereDepois)) continue

      const upperLinha = linha.toUpperCase()

      if (upperLinha.includes('FATURA:')) continue
      if (upperLinha.includes('CONTA:')) continue
      if (upperLinha.includes('CNPJ')) continue
      if (upperLinha.includes('TELEFONE')) continue
      if (upperLinha.includes('NÚMERO DE PÁGINAS')) continue
      if (upperLinha.includes('NUMERO DE PAGINAS')) continue
      if (upperLinha.includes('VALOR TOTAL')) continue
      if (upperLinha.includes('PRAZO DE PAGAMENTO')) continue

      const trechoValidacao = base.slice(index, index + 1600)
      const trechoDepoisAwb = base.slice(index + awb.length, index + 450)

      const temDataEnvio = /\b\d{1,2}\/\d{1,2}\/\d{4}\b/.test(trechoDepoisAwb)
      const temServicoDhl = /(EXPRESS|WORLDWIDE|NONDOC|DOC)/i.test(trechoValidacao)

      if (!temDataEnvio || !temServicoDhl) continue

      if (!candidatos.some((item) => item.awb === awb)) {
        candidatos.push({ awb, index })
      }
    }

    return candidatos.sort((a, b) => a.index - b.index)
  }

  function extrairTotaisBrl(base: string) {
    return Array.from(
      String(base || '').matchAll(/Total\s*\(\s*BRL\s*\)\s*:?\s*([0-9.]+,\d{2})/gi)
    )
      .map((match) => numeroBR(match[1]))
      .filter((valor) => valor > 0 && (!valorTotal || valor <= valorTotal))
  }

  function numerosMoeda(linha: string) {
    return Array.from(String(linha || '').matchAll(/-?\d{1,3}(?:\.\d{3})*,\d{2}/g))
      .map((match) => numeroBR(match[0]))
      .filter((valor) => Number.isFinite(valor))
  }

  function linhaEhTaxaDhl(linha: string) {
    const upper = linha.toUpperCase()

    return (
      [
        'BROKER NOTIFICATION',
        'FUEL SURCHARGE',
        'SEGURO',
        'OVERSIZE PIECE',
        'REMOTE AREA PICKUP',
        'REMOTE AREA DELIVERY',
        'REMOTE AREA',
        'NON-CONVEYABLE',
        'PIECE - WEIGHT',
        'EXPORT DECLARATION',
        'ELEVATED RISK',
        'EMERGENCY SITUATION',
        'DUTY TAX',
        'IMPORT DUTY',
        'ADDRESS CORRECTION',
        'DHL FEE',
      ].some((termo) => upper.includes(termo)) ||
      (upper.includes('DHL') && upper.includes('FEE'))
    )
  }

  function somarBlocoDhl(bloco: string) {
    const linhas = String(bloco || '').split('\n')
    let total = 0

    for (const linhaOriginal of linhas) {
      const linha = String(linhaOriginal || '').trim()
      const upper = linha.toUpperCase()

      if (!linha) continue
      if (upper.includes('TOTAL (BRL)')) continue
      if (upper.includes('TOTAL (USD)')) continue
      if (upper.includes('TAXA DE CÂMBIO')) continue
      if (upper.includes('TAXA DE CAMBIO')) continue
      if (upper.includes('SUB-TOTAL')) continue
      if (upper.includes('TOTAL:')) continue

      const ehLinhaPrincipalAwb =
        /^\s*\d{10}\b/.test(linha) &&
        /(EXPRESS|WORLDWIDE|NONDOC|DOC)/i.test(bloco.slice(0, 1600))

      const ehTaxaDhl = linhaEhTaxaDhl(linha)

      if (!ehLinhaPrincipalAwb && !ehTaxaDhl) continue

      const valores = numerosMoeda(linha).filter((valor) => valor > 0)
      if (!valores.length) continue

      total += valores[valores.length - 1]
    }

    return Number(total.toFixed(2))
  }

  function referenciaEDataDoBloco(awb: string, bloco: string) {
    const linhas = String(bloco || '').split('\n')
    const primeiraLinha =
      linhas.find((linha) => linha.trim().startsWith(awb)) ||
      String(bloco || '').slice(0, 450)

    const semAwb = primeiraLinha.replace(new RegExp('^\\s*' + awb + '\\s*'), '')
    const dataMatch = semAwb.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/)

    const dataTexto =
      dataMatch?.[1] ||
      String(bloco || '').slice(0, 450).match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/)?.[1] ||
      null

    const dataEnvio = dataBRParaISO(dataTexto) || null

    const referencia = dataMatch
      ? semAwb
          .slice(0, dataMatch.index || 0)
          .replace(/\s+/g, ' ')
          .trim() || null
      : null

    return { referencia, dataEnvio }
  }

  function valorCompraDoBloco(bloco: string) {
    const valorTotalBrl =
      numeroBR(String(bloco || '').match(/Total\s*\(\s*BRL\s*\)\s*:?\s*([0-9.]+,\d{2})/i)?.[1]) ||
      0

    if (valorTotalBrl > 0) return valorTotalBrl

    return somarBlocoDhl(bloco)
  }

  function extrairItensPorBloco(base: string) {
    const awbs = extrairAwbs(base)
    const itensExtraidos: ItemPdf[] = []

    for (let i = 0; i < awbs.length; i++) {
      const atual = awbs[i]
      const proximo = awbs[i + 1]

      const fim = proximo?.index || Math.min(base.length, atual.index + 9000)
      const bloco = base.slice(atual.index, fim)

      const valorCompra = valorCompraDoBloco(bloco)

      if (!valorCompra || valorCompra <= 0) continue
      if (valorTotal > 0 && valorCompra > valorTotal) continue

      const { referencia, dataEnvio } = referenciaEDataDoBloco(atual.awb, bloco)

      itensExtraidos.push({
        awb: atual.awb,
        referencia,
        data_envio: dataEnvio,
        valor_compra: valorCompra,
      })
    }

    return unicosPorAwb(itensExtraidos)
  }

  function extrairItensPorOrdem(base: string) {
    const awbs = extrairAwbs(base)
    const totais = extrairTotaisBrl(base)

    if (!awbs.length || totais.length < awbs.length) return []

    const itensExtraidos: ItemPdf[] = []

    for (let i = 0; i < awbs.length; i++) {
      const atual = awbs[i]
      const proximo = awbs[i + 1]
      const fim = proximo?.index || Math.min(base.length, atual.index + 9000)
      const bloco = base.slice(atual.index, fim)
      const { referencia, dataEnvio } = referenciaEDataDoBloco(atual.awb, bloco)

      itensExtraidos.push({
        awb: atual.awb,
        referencia,
        data_envio: dataEnvio,
        valor_compra: totais[i],
      })
    }

    return unicosPorAwb(itensExtraidos)
  }

  const detalhadoOriginal = areaDetalhadaDhl()
  const detalhadoLimpo = limparTexto(detalhadoOriginal)

  let itens = extrairItensPorBloco(detalhadoOriginal)

  const awbsDetalhe = extrairAwbs(detalhadoOriginal)
  const totaisDetalhe = extrairTotaisBrl(detalhadoOriginal)

  if (awbsDetalhe.length > itens.length && totaisDetalhe.length >= awbsDetalhe.length) {
    const porOrdem = extrairItensPorOrdem(detalhadoOriginal)
    if (porOrdem.length > itens.length) itens = porOrdem
  }

  if (itens.length === 0) {
    itens = extrairItensPorBloco(detalhadoLimpo)
  }

  if (itens.length === 0) {
    itens = extrairItensPorOrdem(detalhadoLimpo)
  }

  if (itens.length === 0) {
    itens = extrairItensPorBloco(texto)
  }

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
        { error: 'Não encontrei AWBs com Total (BRL) ou valor em R$ neste PDF. O leitor conseguiu abrir o PDF, mas não conseguiu associar rastreio + subtotal. Me envie o print deste alerta se continuar.' },
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
