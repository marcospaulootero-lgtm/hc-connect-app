// HC_IDENTIDADE_GLOBAL_V2

export type AliasCliente = {
  alias?: string | null
  alias_normalizado?: string | null
  nome_oficial?: string | null
  nome_oficial_normalizado?: string | null
}

export function normalizarIdentidade(valor: any) {
  return String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[“”"'`´]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function mesmaIdentidade(a: any, b: any) {
  const x = normalizarIdentidade(a)
  const y = normalizarIdentidade(b)
  return Boolean(x && y && x === y)
}

export function nomeExibicaoPreferido(valores: any[]) {
  const unicos = Array.from(
    new Map(
      valores
        .map((valor) => String(valor ?? '').trim())
        .filter(Boolean)
        .map((valor) => [normalizarIdentidade(valor), valor])
    ).values()
  )

  if (!unicos.length) return ''

  return [...unicos].sort((a, b) => {
    const tokensA = normalizarIdentidade(a).split(' ').filter(Boolean).length
    const tokensB = normalizarIdentidade(b).split(' ').filter(Boolean).length
    if (tokensA !== tokensB) return tokensB - tokensA
    if (a.length !== b.length) return b.length - a.length
    return a.localeCompare(b, 'pt-BR')
  })[0]
}

const PALAVRAS_JURIDICAS = new Set([
  'ltda', 'limitada', 'sa', 's a', 'eireli', 'me', 'epp', 'mei',
  'industria', 'industrial', 'comercio', 'comercial', 'servicos', 'servico',
  'empresa', 'companhia', 'cia', 'de', 'da', 'das', 'do', 'dos', 'e',
])

function tokensDistintivos(valor: any) {
  return normalizarIdentidade(valor)
    .split(' ')
    .filter((token) => token.length >= 3 && !PALAVRAS_JURIDICAS.has(token))
}

// Esta função APENAS sugere uma possível duplicidade. Nunca deve fazer fusão automática.
export function nomesProvavelmenteMesmoCliente(a: any, b: any) {
  const na = normalizarIdentidade(a)
  const nb = normalizarIdentidade(b)
  if (!na || !nb || na === nb) return false

  const [menor, maior] = na.length <= nb.length ? [na, nb] : [nb, na]
  const tokensMenor = tokensDistintivos(menor)
  const tokensMaior = new Set(tokensDistintivos(maior))

  if (tokensMenor.length === 1 && tokensMenor[0].length >= 5 && tokensMaior.has(tokensMenor[0])) {
    return true
  }

  if (tokensMenor.length >= 2) {
    const encontrados = tokensMenor.filter((token) => tokensMaior.has(token)).length
    return encontrados / tokensMenor.length >= 0.8
  }

  return maior.includes(menor) && menor.length >= 6
}

export function mapaAliasesClientes(linhas: AliasCliente[]) {
  const mapa = new Map<string, string>()

  for (const linha of linhas || []) {
    const alias = normalizarIdentidade(linha.alias_normalizado || linha.alias)
    const oficial = String(linha.nome_oficial || '').trim()
    if (alias && oficial) mapa.set(alias, oficial)
  }

  return mapa
}

export function nomeCanonicoCliente(valor: any, aliases: Map<string, string>) {
  const original = String(valor ?? '').trim()
  if (!original) return ''
  return aliases.get(normalizarIdentidade(original)) || original
}

export async function carregarAliasesClientes(supabase: any): Promise<AliasCliente[]> {
  try {
    const { data, error } = await supabase
      .from('cliente_aliases')
      .select('alias, alias_normalizado, nome_oficial, nome_oficial_normalizado')

    if (error) {
      const mensagem = String(error.message || '')
      if (!mensagem.toLowerCase().includes('cliente_aliases')) {
        console.warn('[Identidade] Não foi possível carregar aliases de clientes:', mensagem)
      }
      return []
    }

    return (data || []) as AliasCliente[]
  } catch (error) {
    console.warn('[Identidade] Falha ao carregar aliases de clientes:', error)
    return []
  }
}
