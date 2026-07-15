import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function respostaErro(error: string, status = 400) {
  return NextResponse.json({ error }, { status })
}

function limpar(valor?: string | null) {
  return String(valor || '')
    .replace(/\s+/g, ' ')
    .replace(/\*+/g, '')
    .trim()
}

function pegar(texto: string, regex: RegExp) {
  const match = texto.match(regex)
  return limpar(match?.[1])
}

function montarEndereco(logradouro: string, numero: string, complemento: string, bairro: string) {
  return [logradouro, numero, complemento, bairro].filter(Boolean).join(', ')
}

function extrairDados(textoOriginal: string) {
  const texto = textoOriginal
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')

  const textoLinha = texto.replace(/\n/g, ' ')

  const cnpj =
    pegar(textoLinha, /N[ÚU]MERO DE INSCRI[ÇC][ÃA]O\s*([0-9]{2}\.[0-9]{3}\.[0-9]{3}\/[0-9]{4}-[0-9]{2})/i) ||
    pegar(textoLinha, /([0-9]{2}\.[0-9]{3}\.[0-9]{3}\/[0-9]{4}-[0-9]{2})/)

  const nome =
    pegar(textoLinha, /NOME EMPRESARIAL\s*(.*?)\s*T[ÍI]TULO DO ESTABELECIMENTO/i) ||
    pegar(textoLinha, /NOME EMPRESARIAL\s*(.*?)\s*PORTE/i)

  const atividade =
    pegar(
      textoLinha,
      /C[ÓO]DIGO E DESCRI[ÇC][ÃA]O DA ATIVIDADE ECON[ÔO]MICA PRINCIPAL\s*(.*?)\s*C[ÓO]DIGO E DESCRI[ÇC][ÃA]O DAS ATIVIDADES/i
    )

  const natureza = pegar(
    textoLinha,
    /C[ÓO]DIGO E DESCRI[ÇC][ÃA]O DA NATUREZA JUR[ÍI]DICA\s*(.*?)\s*LOGRADOURO/i
  )

  const logradouro = pegar(textoLinha, /LOGRADOURO\s*(.*?)\s*N[ÚU]MERO/i)
  const numero = pegar(textoLinha, /N[ÚU]MERO\s*(.*?)\s*COMPLEMENTO/i)
  const complemento = pegar(textoLinha, /COMPLEMENTO\s*(.*?)\s*CEP/i)
  const cep = pegar(textoLinha, /CEP\s*([0-9]{2}\.[0-9]{3}-[0-9]{3}|[0-9]{5}-[0-9]{3})/i)
  const bairro = pegar(textoLinha, /BAIRRO\/DISTRITO\s*(.*?)\s*MUNIC[ÍI]PIO/i)
  const cidade = pegar(textoLinha, /MUNIC[ÍI]PIO\s*(.*?)\s*UF/i)
  const estado = pegar(textoLinha, /UF\s*([A-Z]{2})/i)

  const email = pegar(
    textoLinha,
    /ENDERE[ÇC]O ELETR[ÔO]NICO\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i
  )

  const telefone =
    pegar(textoLinha, /TELEFONE\s*([()0-9\s.-]{8,25})\s*ENTE FEDERATIVO/i) ||
    pegar(textoLinha, /TELEFONE\s*([()0-9\s.-]{8,25})\s*SITUA[ÇC][ÃA]O/i)

  const situacao = pegar(textoLinha, /SITUA[ÇC][ÃA]O CADASTRAL\s*([A-ZÇÃÕ\s]+?)\s*DATA DA SITUA/i)
  const dataAbertura = pegar(textoLinha, /DATA DE ABERTURA\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i)

  const observacoes = [
    atividade ? `Atividade principal: ${atividade}` : '',
    natureza ? `Natureza jurídica: ${natureza}` : '',
    situacao ? `Situação cadastral: ${situacao}` : '',
    dataAbertura ? `Data de abertura: ${dataAbertura}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return {
    cnpj,
    nome_empresa: nome,
    endereco: montarEndereco(logradouro, numero, complemento, bairro),
    cidade,
    estado,
    cep,
    email,
    contato: telefone,
    status: situacao.toUpperCase().includes('ATIVA') ? 'Ativo' : 'Inativo',
    observacoes,
  }
}

async function validarAdmin(token: string) {
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return false

  const supabaseAuth = createClient(supabaseUrl, anonKey)
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser(token)

  if (!user?.id) return false

  const { data: perfil } = await supabaseAdmin
    .from('perfis')
    .select('tipo_acesso, ativo')
    .eq('id', user.id)
    .maybeSingle()

  return perfil?.ativo !== false && String(perfil?.tipo_acesso || '').toLowerCase() === 'admin'
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()

    if (!token) return respostaErro('Sessão não enviada.', 401)

    const adminOk = await validarAdmin(token)

    if (!adminOk) return respostaErro('Apenas administradores podem importar ficha CNPJ.', 403)

    const formData = await req.formData()
    const arquivo = formData.get('arquivo')

    if (!(arquivo instanceof File)) {
      return respostaErro('Envie o PDF da ficha CNPJ.')
    }

    const nomeArquivo = arquivo.name.toLowerCase()
    const buffer = Buffer.from(await arquivo.arrayBuffer())

    let texto = ''

    if (nomeArquivo.endsWith('.pdf') || arquivo.type.includes('pdf')) {
      const pdfParseModule: any = await import('pdf-parse')
      const pdfParse = pdfParseModule.default || pdfParseModule
      const parsed = await pdfParse(buffer)
      texto = parsed.text || ''
    } else if (nomeArquivo.endsWith('.txt')) {
      texto = buffer.toString('utf8')
    } else {
      return respostaErro('Use o PDF original da ficha CNPJ. Print/imagem ainda não é suportado.')
    }

    if (!texto.trim()) {
      return respostaErro('Não consegui ler texto do arquivo. Envie o PDF original da Receita Federal.')
    }

    const dados = extrairDados(texto)

    if (!dados.cnpj && !dados.nome_empresa) {
      return respostaErro('Não consegui identificar CNPJ ou nome da empresa neste arquivo.')
    }

    return NextResponse.json({
      ok: true,
      dados,
    })
  } catch (error: any) {
    return respostaErro(error?.message || 'Erro ao importar ficha CNPJ.', 500)
  }
}
