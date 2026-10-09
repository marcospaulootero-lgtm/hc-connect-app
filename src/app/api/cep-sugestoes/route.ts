import { NextRequest, NextResponse } from 'next/server'

type Registro = Record<string, unknown>

function texto(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function GET(req: NextRequest) {
  const cep = req.nextUrl.searchParams.get('cep') || ''
  if (!/^\d{5,8}$/.test(cep)) {
    return NextResponse.json({ error: 'Informe de 5 a 8 números do CEP.' }, { status: 400 })
  }

  try {
    const completo = cep.length === 8
    const url = completo
      ? `https://viacep.com.br/ws/${cep}/json/`
      : `https://ceprua.com.br/api/buscar?q=${cep}`

    const resposta = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 86400 },
    })
    if (!resposta.ok) throw new Error('Falha no serviço de CEP')

    const dados: unknown = await resposta.json()
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) throw new Error('Resposta inválida')
    const objeto = dados as Registro
    let lista: unknown[]
    if (completo) {
      lista = objeto.erro ? [] : [objeto]
    } else {
      if (!Array.isArray(objeto.resultados)) throw new Error('Resposta inválida')
      lista = objeto.resultados
    }

    const vistos = new Set<string>()
    const resultados = lista.flatMap((valor) => {
      if (!valor || typeof valor !== 'object') return []
      const item = valor as Registro
      const numero = texto(item.cep).replace(/\D/g, '')
      const cidade = texto(item.cidade) || texto(item.localidade)
      const uf = texto(item.uf)
      if (!/^\d{8}$/.test(numero) || !numero.startsWith(cep) || !cidade || !/^[A-Z]{2}$/.test(uf)) return []
      const logradouro = texto(item.logradouro) || (item.tipo === 'logradouro' ? texto(item.nome) : '')
      const chave = numero + '|' + logradouro
      if (vistos.has(chave)) return []
      vistos.add(chave)
      return [{ cep: numero.replace(/^(\d{5})(\d{3})$/, '$1-$2'), logradouro, bairro: texto(item.bairro), cidade, uf }]
    }).slice(0, 30)

    return NextResponse.json({ resultados })
  } catch {
    return NextResponse.json(
      { error: 'Consulta de CEP indisponível. Tente novamente ou preencha o endereço manualmente.' },
      { status: 503 }
    )
  }
}
