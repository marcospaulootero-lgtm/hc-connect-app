import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CotacaoBacen = {
  cotacaoCompra?: number
  cotacaoVenda?: number
  dataHoraCotacao?: string
}

function isoHoje() {
  return new Date().toISOString().slice(0, 10)
}

function dataValidaISO(valor: any) {
  const texto = String(valor || '').slice(0, 10)

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto

  return isoHoje()
}

function addDias(dataISO: string, dias: number) {
  const data = new Date(`${dataISO}T12:00:00`)
  data.setDate(data.getDate() + dias)
  return data.toISOString().slice(0, 10)
}

function formatarDataBacen(dataISO: string) {
  const [ano, mes, dia] = dataISO.split('-')
  return `${mes}-${dia}-${ano}`
}

function inicioMesAnterior(dataISO: string) {
  const data = new Date(`${dataISO}T12:00:00`)
  return new Date(data.getFullYear(), data.getMonth() - 1, 1).toISOString().slice(0, 10)
}

function fimMesAnterior(dataISO: string) {
  const data = new Date(`${dataISO}T12:00:00`)
  return new Date(data.getFullYear(), data.getMonth(), 0).toISOString().slice(0, 10)
}

function dataISODataHoraBacen(valor: any) {
  const texto = String(valor || '')
  const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : ''
}

async function buscarUltimaCotacao(inicioISO: string, fimISO: string) {
  const url =
    `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/` +
    `CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)` +
    `?@dataInicial='${formatarDataBacen(inicioISO)}'` +
    `&@dataFinalCotacao='${formatarDataBacen(fimISO)}'` +
    `&$top=1000&$format=json`

  const resposta = await fetch(url, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!resposta.ok) {
    throw new Error(`Banco Central retornou status ${resposta.status}`)
  }

  const json = await resposta.json()
  const cotacoes = Array.isArray(json?.value) ? json.value : []

  const ordenadas = cotacoes
    .filter((item: CotacaoBacen) => Number(item?.cotacaoVenda || 0) > 0)
    .sort((a: CotacaoBacen, b: CotacaoBacen) =>
      String(b.dataHoraCotacao || '').localeCompare(String(a.dataHoraCotacao || ''))
    )

  const ultima = ordenadas[0]

  if (!ultima) {
    return null
  }

  return {
    valor: Number(ultima.cotacaoVenda || 0),
    data: dataISODataHoraBacen(ultima.dataHoraCotacao),
    data_hora: ultima.dataHoraCotacao || null,
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const dataBase = dataValidaISO(searchParams.get('data'))

    const dolarVendaDia = await buscarUltimaCotacao(addDias(dataBase, -10), dataBase)

    const ptaxDhlMesAnterior = await buscarUltimaCotacao(
      inicioMesAnterior(dataBase),
      fimMesAnterior(dataBase)
    )

    if (!dolarVendaDia) {
      return NextResponse.json(
        { error: 'Não encontrei cotação de dólar venda recente no Banco Central.' },
        { status: 404 }
      )
    }

    if (!ptaxDhlMesAnterior) {
      return NextResponse.json(
        { error: 'Não encontrei PTAX do mês anterior no Banco Central.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ok: true,
      data_base: dataBase,
      dolar_venda_dia: dolarVendaDia,
      ptax_dhl_mes_anterior: ptaxDhlMesAnterior,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao consultar câmbio no Banco Central.' },
      { status: 500 }
    )
  }
}
