import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type MensagemChat = {
  role: 'user' | 'assistant'
  content: string
}

const TAMANHO_PAGINA = 1000
const MAX_REGISTROS_TABELA = 20000
const MAX_RESULTADOS_FERRAMENTA = 50

const INSTRUCOES_IA_HC = `
Você é a IA HC, assistente administrativo interno da HC Consultoria dentro do sistema HC Connect.

REGRAS OBRIGATÓRIAS:

1. Você está em modo SOMENTE LEITURA.
2. Nunca diga que alterou, baixou, arquivou, vinculou, excluiu ou atualizou um registro.
3. Se o usuário pedir alteração, explique que a V1 está em modo leitura e que a ação poderá ser preparada futuramente para confirmação.
4. Use as ferramentas HC sempre que a pergunta depender de dados do portal.
5. Nunca invente dados do HC Connect.
6. Quando não encontrar um registro, diga claramente que ele não foi localizado.
7. Valores financeiros devem ser apresentados em reais quando forem BRL.
8. Diferencie:
   - processo financeiro;
   - embarque;
   - fatura de cliente;
   - fatura DHL/FedEx;
   - item/AWB de fatura.
9. Faturas DHL/FedEx históricas podem existir e ser conciliadas, mas análises do Dashboard operacional devem priorizar o ano corrente.
10. Fatura paga sem AWBs vinculados não deve ser tratada automaticamente como prova de cliente inadimplente. Informe separadamente como "fatura sem AWBs para conciliar".
11. RASTREAMENTO É PROTEGIDO:
    - você pode apenas ler o status já armazenado em embarques;
    - nunca tente atualizar rastreamento;
    - nunca tente chamar DHL, FedEx ou UPS;
    - nunca solicite alteração de timeline ou status de rastreio.
12. Ao apresentar uma análise, explique resumidamente o critério usado.
13. Ao final de respostas baseadas no portal, inclua uma linha "Fontes HC:" informando quais áreas/tabelas foram consultadas.
14. Seja objetivo, profissional e útil para tomada de decisão administrativa.
`

function normalizarTexto(valor: any) {
  return String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function normalizarAwb(valor: any) {
  return String(valor || '').replace(/\D/g, '')
}

function normalizarNumeroFatura(valor: any) {
  const original = String(valor || '').trim()
  if (!original) return ''

  const digitos = original.replace(/\D/g, '')
  return digitos || original.toUpperCase()
}

function numero(valor: any) {
  if (valor === null || valor === undefined || valor === '') return 0
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0

  let texto = String(valor)
    .replace(/[R$USD\s]/gi, '')
    .trim()

  if (!texto) return 0

  if (texto.includes(',') && texto.includes('.')) {
    texto = texto.replace(/\./g, '').replace(',', '.')
  } else if (texto.includes(',')) {
    texto = texto.replace(',', '.')
  }

  const resultado = Number(texto)
  return Number.isFinite(resultado) ? resultado : 0
}

function normalizarData(valor: any): string | null {
  if (!valor) return null

  if (valor instanceof Date && !isNaN(valor.getTime())) {
    return valor.toISOString().slice(0, 10)
  }

  if (typeof valor === 'number') {
    const data = new Date((valor - 25569) * 86400 * 1000)
    if (!isNaN(data.getTime())) return data.toISOString().slice(0, 10)
  }

  const texto = String(valor).trim()
  if (!texto || texto === '0') return null

  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) {
    return texto.slice(0, 10)
  }

  const partes = texto.split('/')

  if (partes.length === 3) {
    const [dia, mes, anoOriginal] = partes
    const ano =
      anoOriginal.length === 2
        ? `20${anoOriginal}`
        : anoOriginal

    return `${ano.padStart(4, '20')}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
  }

  const tentativa = new Date(texto)

  if (!isNaN(tentativa.getTime())) {
    return tentativa.toISOString().slice(0, 10)
  }

  return null
}

function hojeIso() {
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')

  return `${ano}-${mes}-${dia}`
}

function campo(item: any, nomes: string[]) {
  for (const nome of nomes) {
    const valor = item?.[nome]

    if (
      valor !== undefined &&
      valor !== null &&
      valor !== ''
    ) {
      return valor
    }
  }

  return ''
}

function transportadoraFatura(item: any) {
  return String(
    campo(item, [
      'transportadora',
      'empresa',
      'carrier',
    ]) || ''
  )
}

function ehDhlFedex(item: any) {
  const transportadora = normalizarTexto(
    transportadoraFatura(item)
  )

  return (
    transportadora.includes('DHL') ||
    transportadora.includes('FEDEX') ||
    transportadora.includes('FED EX')
  )
}

function numeroFatura(item: any) {
  return String(
    campo(item, [
      'numero_fatura',
      'n_fatura',
      'nº_fatura',
      'nro_fatura',
      'fatura',
      'invoice',
    ]) || ''
  )
}

function vencimentoFatura(item: any) {
  return normalizarData(
    campo(item, [
      'vencimento',
      'data_vencimento',
      'vencimento_fatura',
      'data_vencimento_fatura',
    ])
  )
}

function pagamentoFatura(item: any) {
  return normalizarData(
    campo(item, [
      'data_pagamento',
      'pagamento',
      'data_pago',
      'pago_em',
    ])
  )
}

function totalFatura(item: any) {
  return numero(
    campo(item, [
      'total',
      'valor_total',
      'valor',
      'valor_fatura',
    ])
  )
}

function faturaArquivada(item: any) {
  const valor = campo(item, [
    'arquivada',
    'arquivado',
    'oculta',
    'oculto',
  ])

  if (valor === true) return true

  return ['TRUE', 'SIM', '1'].includes(
    normalizarTexto(valor)
  )
}

function faturaPaga(item: any) {
  if (pagamentoFatura(item)) return true

  const status = normalizarTexto(
    campo(item, [
      'situacao',
      'situação',
      'status',
    ])
  )

  return (
    status.includes('PAGO') ||
    status.includes('PAGA') ||
    status.includes('BAIXADO') ||
    status.includes('BAIXADA')
  )
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL não configurada.'
    )
  }

  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY não configurada.'
    )
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

function supabaseAutenticacao() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anon) {
    throw new Error(
      'Variáveis públicas do Supabase não configuradas.'
    )
  }

  return createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

async function verificarAdmin(
  request: NextRequest
) {
  const authorization =
    request.headers.get('authorization') || ''

  const token = authorization
    .replace(/^Bearer\s+/i, '')
    .trim()

  if (!token) {
    return {
      autorizado: false as const,
      status: 401,
      erro: 'Sessão não informada.',
    }
  }

  const auth = supabaseAutenticacao()

  const {
    data: { user },
    error,
  } = await auth.auth.getUser(token)

  if (error || !user) {
    return {
      autorizado: false as const,
      status: 401,
      erro: 'Sessão inválida ou expirada.',
    }
  }

  const admin = supabaseAdmin()

  const {
    data: perfil,
    error: erroPerfil,
  } = await admin
    .from('perfis')
    .select('id, nome, tipo_acesso')
    .eq('id', user.id)
    .maybeSingle()

  if (
    erroPerfil ||
    !perfil ||
    normalizarTexto(perfil.tipo_acesso) !== 'ADMIN'
  ) {
    return {
      autorizado: false as const,
      status: 403,
      erro: 'Acesso restrito ao administrador.',
    }
  }

  return {
    autorizado: true as const,
    user,
    perfil,
    admin,
  }
}

async function carregarTodos(
  db: any,
  tabela: string,
  selecao = '*'
) {
  const resultado: any[] = []

  for (
    let inicio = 0;
    inicio < MAX_REGISTROS_TABELA;
    inicio += TAMANHO_PAGINA
  ) {
    const { data, error } = await db
      .from(tabela)
      .select(selecao)
      .range(
        inicio,
        inicio + TAMANHO_PAGINA - 1
      )

    if (error) {
      throw new Error(
        `Erro ao consultar ${tabela}: ${error.message}`
      )
    }

    const pagina = data || []
    resultado.push(...pagina)

    if (pagina.length < TAMANHO_PAGINA) {
      break
    }
  }

  return resultado
}

function resumoProcessoFinanceiro(item: any) {
  return {
    id: item.id || null,
    embarque_id: item.embarque_id || null,
    awb: item.awb || null,
    cliente: item.cliente || null,
    transportadora: item.transportadora || null,
    fatura: item.fatura || null,
    valor_cobranca: numero(item.valor_cobranca),
    valor_compra: numero(item.valor_compra),
    doc_dta: numero(item.doc_dta),
    debito_terceiro: numero(item.debito_terceiro),
    vencimento_cobranca:
      normalizarData(item.vencimento_cobranca),
    recebimento:
      normalizarData(item.recebimento),
  }
}

async function analisarPortal(db: any) {
  const hoje = hojeIso()
  const anoAtual = hoje.slice(0, 4)

  const [
    financeiro,
    faturas,
    itensFaturas,
    embarques,
  ] = await Promise.all([
    carregarTodos(
      db,
      'financeiro_embarques',
      '*'
    ),
    carregarTodos(
      db,
      'faturas_transportadoras',
      '*'
    ),
    carregarTodos(
      db,
      'faturas_transportadoras_itens',
      '*'
    ),
    carregarTodos(
      db,
      'embarques',
      'id, awb, cliente_final, importador, exportador, transportadora, status_operacional, criado_em, data_envio, data_coleta'
    ),
  ])

  const processosVencidos = financeiro.filter(
    (item: any) => {
      if (normalizarData(item.recebimento)) {
        return false
      }

      const vencimento =
        normalizarData(item.vencimento_cobranca)

      return (
        !!vencimento &&
        vencimento < hoje &&
        numero(item.valor_cobranca) > 0
      )
    }
  )

  const aguardandoCusto = financeiro.filter(
    (item: any) =>
      numero(item.valor_compra) <= 0 &&
      numero(item.valor_cobranca) > 0
  )

  const emAberto = financeiro.filter(
    (item: any) =>
      !normalizarData(item.recebimento) &&
      numero(item.valor_cobranca) > 0
  )

  const processosPorId =
    new Map<string, any>()

  const processosPorAwb =
    new Map<string, any[]>()

  financeiro.forEach((processo: any) => {
    if (processo?.id) {
      processosPorId.set(
        String(processo.id),
        processo
      )
    }

    const awb =
      normalizarAwb(processo?.awb)

    if (!awb) return

    const lista =
      processosPorAwb.get(awb) || []

    lista.push(processo)
    processosPorAwb.set(awb, lista)
  })

  const itensPorFatura =
    new Map<string, any[]>()

  itensFaturas.forEach((item: any) => {
    const id = String(
      item?.fatura_transportadora_id || ''
    )

    if (!id) return

    const lista =
      itensPorFatura.get(id) || []

    lista.push(item)
    itensPorFatura.set(id, lista)
  })

  const faturasAnoAtual =
    faturas.filter((fatura: any) => {
      if (!ehDhlFedex(fatura)) return false
      if (faturaArquivada(fatura)) return false

      const vencimento =
        vencimentoFatura(fatura)

      return (
        !!vencimento &&
        vencimento.startsWith(anoAtual)
      )
    })

  const resumosFaturas =
    faturasAnoAtual.map((fatura: any) => {
      const itens =
        itensPorFatura.get(
          String(fatura.id || '')
        ) || []

      const detalhes =
        itens.map((item: any) => {
          const vinculado =
            item.financeiro_embarque_id
              ? processosPorId.get(
                  String(
                    item.financeiro_embarque_id
                  )
                ) || null
              : null

          const candidatos =
            processosPorAwb.get(
              normalizarAwb(item.awb)
            ) || []

          const processo =
            vinculado ||
            candidatos.find(
              (registro: any) =>
                !!normalizarData(
                  registro.recebimento
                )
            ) ||
            candidatos[0] ||
            null

          const recebido =
            !!normalizarData(
              processo?.recebimento
            )

          return {
            awb: item.awb || null,
            processo,
            recebido,
          }
        })

      const recebidos =
        detalhes.filter(
          (item: any) => item.recebido
        )

      const pendentes =
        detalhes.filter(
          (item: any) =>
            item.processo &&
            !item.recebido
        )

      const naoLocalizados =
        detalhes.filter(
          (item: any) => !item.processo
        )

      const valorRecebido =
        recebidos.reduce(
          (acc: number, item: any) =>
            acc +
            numero(
              item.processo?.valor_cobranca
            ),
          0
        )

      const valorPendente =
        pendentes.reduce(
          (acc: number, item: any) =>
            acc +
            numero(
              item.processo?.valor_cobranca
            ),
          0
        )

      const total =
        totalFatura(fatura)

      const cobertura =
        total > 0
          ? (valorRecebido / total) * 100
          : 0

      const todosRecebidos =
        detalhes.length > 0 &&
        recebidos.length === detalhes.length &&
        naoLocalizados.length === 0

      const coberturaSuficiente =
        total <= 0 ||
        valorRecebido + 0.01 >= total

      return {
        id: fatura.id,
        transportadora:
          transportadoraFatura(fatura),
        numero_fatura:
          numeroFatura(fatura),
        vencimento:
          vencimentoFatura(fatura),
        total,
        paga:
          faturaPaga(fatura),
        total_awbs:
          detalhes.length,
        recebidos:
          recebidos.length,
        pendentes:
          pendentes.length,
        nao_localizados:
          naoLocalizados.length,
        valor_recebido:
          valorRecebido,
        valor_pendente:
          valorPendente,
        cobertura_percentual:
          Number(cobertura.toFixed(1)),
        todos_recebidos:
          todosRecebidos,
        cobertura_suficiente:
          coberturaSuficiente,
      }
    })

  const pagasComPendencia =
    resumosFaturas.filter(
      (item: any) =>
        item.paga &&
        item.total_awbs > 0 &&
        (
          !item.todos_recebidos ||
          !item.cobertura_suficiente
        )
    )

  const pagasSemAwbs =
    resumosFaturas.filter(
      (item: any) =>
        item.paga &&
        item.total_awbs === 0
    )

  const prontasParaPagar =
    resumosFaturas.filter(
      (item: any) =>
        !item.paga &&
        item.total_awbs > 0 &&
        item.todos_recebidos &&
        item.cobertura_suficiente
    )

  const faturasVencidas =
    resumosFaturas.filter(
      (item: any) =>
        !item.paga &&
        !!item.vencimento &&
        item.vencimento < hoje
    )

  const embarquesAtivos =
    embarques.filter((item: any) => {
      const status =
        normalizarTexto(
          item.status_operacional
        )

      return (
        !status.includes('ENTREGUE') &&
        !status.includes('CANCELAD') &&
        !status.includes('EXCLUID')
      )
    })

  return {
    data_referencia: hoje,
    ano_dashboard: Number(anoAtual),

    financeiro: {
      processos_em_aberto:
        emAberto.length,
      valor_em_aberto:
        emAberto.reduce(
          (acc: number, item: any) =>
            acc +
            numero(item.valor_cobranca),
          0
        ),
      processos_vencidos:
        processosVencidos.length,
      valor_vencido:
        processosVencidos.reduce(
          (acc: number, item: any) =>
            acc +
            numero(item.valor_cobranca),
          0
        ),
      processos_aguardando_custo:
        aguardandoCusto.length,
      valor_cobranca_aguardando_custo:
        aguardandoCusto.reduce(
          (acc: number, item: any) =>
            acc +
            numero(item.valor_cobranca),
          0
        ),
    },

    faturas_transportadoras: {
      faturas_dhl_fedex_ano_atual:
        resumosFaturas.length,

      pagas_com_pendencia_real:
        pagasComPendencia.length,

      pagas_sem_awbs_para_conciliar:
        pagasSemAwbs.length,

      prontas_para_pagar:
        prontasParaPagar.length,

      vencidas:
        faturasVencidas.length,

      valor_ainda_a_receber_nas_pagas_com_pendencia:
        pagasComPendencia.reduce(
          (acc: number, item: any) =>
            acc + item.valor_pendente,
          0
        ),

      exemplos_pagas_com_pendencia:
        pagasComPendencia.slice(0, 20),

      exemplos_sem_awbs:
        pagasSemAwbs.slice(0, 20),
    },

    operacao: {
      embarques_ativos:
        embarquesAtivos.length,

      observacao:
        'Status apenas lido da tabela embarques. Nenhuma API de rastreio foi chamada.',
    },

    principais_vencidos:
      processosVencidos
        .sort((a: any, b: any) =>
          String(
            a.vencimento_cobranca || ''
          ).localeCompare(
            String(
              b.vencimento_cobranca || ''
            )
          )
        )
        .slice(0, 20)
        .map(resumoProcessoFinanceiro),

    principais_aguardando_custo:
      aguardandoCusto
        .slice(0, 20)
        .map(resumoProcessoFinanceiro),
  }
}

async function buscarProcessosVencidos(
  db: any
) {
  const hoje = hojeIso()

  const financeiro =
    await carregarTodos(
      db,
      'financeiro_embarques',
      '*'
    )

  const itens =
    financeiro
      .filter((item: any) => {
        if (
          normalizarData(item.recebimento)
        ) {
          return false
        }

        const vencimento =
          normalizarData(
            item.vencimento_cobranca
          )

        return (
          !!vencimento &&
          vencimento < hoje &&
          numero(item.valor_cobranca) > 0
        )
      })
      .sort((a: any, b: any) =>
        String(
          a.vencimento_cobranca || ''
        ).localeCompare(
          String(
            b.vencimento_cobranca || ''
          )
        )
      )

  return {
    total_processos: itens.length,

    valor_total:
      itens.reduce(
        (acc: number, item: any) =>
          acc +
          numero(item.valor_cobranca),
        0
      ),

    processos:
      itens
        .slice(
          0,
          MAX_RESULTADOS_FERRAMENTA
        )
        .map(resumoProcessoFinanceiro),

    limitado_a:
      MAX_RESULTADOS_FERRAMENTA,
  }
}

async function buscarAguardandoCusto(
  db: any
) {
  const financeiro =
    await carregarTodos(
      db,
      'financeiro_embarques',
      '*'
    )

  const itens =
    financeiro.filter(
      (item: any) =>
        numero(item.valor_compra) <= 0 &&
        numero(item.valor_cobranca) > 0
    )

  return {
    total_processos:
      itens.length,

    valor_cobranca_total:
      itens.reduce(
        (acc: number, item: any) =>
          acc +
          numero(item.valor_cobranca),
        0
      ),

    processos:
      itens
        .slice(
          0,
          MAX_RESULTADOS_FERRAMENTA
        )
        .map(resumoProcessoFinanceiro),

    limitado_a:
      MAX_RESULTADOS_FERRAMENTA,
  }
}

async function consultarAwb(
  db: any,
  awbInformado: any
) {
  const awb =
    normalizarAwb(awbInformado)

  if (!awb) {
    return {
      encontrado: false,
      erro: 'AWB inválido.',
    }
  }

  const [
    financeiroRes,
    embarquesRes,
    itensRes,
  ] = await Promise.all([
    db
      .from('financeiro_embarques')
      .select('*')
      .eq('awb', awb)
      .limit(20),

    db
      .from('embarques')
      .select('*')
      .eq('awb', awb)
      .limit(20),

    db
      .from(
        'faturas_transportadoras_itens'
      )
      .select('*')
      .eq('awb', awb)
      .limit(50),
  ])

  if (financeiroRes.error) {
    throw new Error(
      financeiroRes.error.message
    )
  }

  if (embarquesRes.error) {
    throw new Error(
      embarquesRes.error.message
    )
  }

  if (itensRes.error) {
    throw new Error(
      itensRes.error.message
    )
  }

  const itens =
    itensRes.data || []

  const idsFaturas =
    Array.from(
      new Set(
        itens
          .map(
            (item: any) =>
              item.fatura_transportadora_id
          )
          .filter(Boolean)
      )
    )

  let faturas: any[] = []

  if (idsFaturas.length > 0) {
    const { data, error } = await db
      .from('faturas_transportadoras')
      .select('*')
      .in('id', idsFaturas)

    if (error) {
      throw new Error(error.message)
    }

    faturas = data || []
  }

  return {
    encontrado:
      (financeiroRes.data || []).length > 0 ||
      (embarquesRes.data || []).length > 0 ||
      itens.length > 0,

    awb,

    financeiro:
      (financeiroRes.data || [])
        .map(resumoProcessoFinanceiro),

    embarques:
      embarquesRes.data || [],

    itens_faturas_transportadoras:
      itens,

    faturas_transportadoras:
      faturas,

    rastreamento:
      'Somente os status já armazenados em embarques foram consultados. Nenhuma atualização de rastreio foi executada.',
  }
}

async function buscarFaturaTransportadora(
  db: any,
  numeroInformado: any
) {
  const numeroBusca =
    String(numeroInformado || '').trim()

  if (!numeroBusca) {
    return {
      encontrado: false,
      erro: 'Número da fatura não informado.',
    }
  }

  const { data, error } = await db
    .from('faturas_transportadoras')
    .select('*')
    .ilike(
      'numero_fatura',
      `%${numeroBusca}%`
    )
    .limit(20)

  if (error) {
    throw new Error(error.message)
  }

  const faturas = data || []

  return {
    encontrado:
      faturas.length > 0,

    quantidade:
      faturas.length,

    faturas:
      faturas.map((item: any) => ({
        ...item,
        numero_normalizado:
          normalizarNumeroFatura(
            numeroFatura(item)
          ),
      })),
  }
}

async function analisarConciliacaoFatura(
  db: any,
  numeroInformado: any
) {
  const numeroBusca =
    normalizarNumeroFatura(
      numeroInformado
    )

  if (!numeroBusca) {
    return {
      encontrado: false,
      erro: 'Número da fatura não informado.',
    }
  }

  const busca =
    await buscarFaturaTransportadora(
      db,
      numeroInformado
    )

  const faturas =
    Array.isArray(busca.faturas)
      ? busca.faturas
      : []

  if (faturas.length === 0) {
    return {
      encontrado: false,
      numero_fatura:
        String(numeroInformado || ''),
    }
  }

  const fatura =
    faturas.find(
      (item: any) =>
        normalizarNumeroFatura(
          numeroFatura(item)
        ) === numeroBusca
    ) ||
    faturas[0]

  const { data: itens, error } = await db
    .from(
      'faturas_transportadoras_itens'
    )
    .select('*')
    .eq(
      'fatura_transportadora_id',
      fatura.id
    )

  if (error) {
    throw new Error(error.message)
  }

  const listaItens = itens || []

  const financeiro =
    await carregarTodos(
      db,
      'financeiro_embarques',
      '*'
    )

  const porId =
    new Map<string, any>()

  const porAwb =
    new Map<string, any[]>()

  financeiro.forEach((processo: any) => {
    if (processo.id) {
      porId.set(
        String(processo.id),
        processo
      )
    }

    const awb =
      normalizarAwb(processo.awb)

    if (!awb) return

    const lista =
      porAwb.get(awb) || []

    lista.push(processo)
    porAwb.set(awb, lista)
  })

  const detalhes =
    listaItens.map((item: any) => {
      const vinculado =
        item.financeiro_embarque_id
          ? porId.get(
              String(
                item.financeiro_embarque_id
              )
            ) || null
          : null

      const candidatos =
        porAwb.get(
          normalizarAwb(item.awb)
        ) || []

      const processo =
        vinculado ||
        candidatos.find(
          (registro: any) =>
            !!normalizarData(
              registro.recebimento
            )
        ) ||
        candidatos[0] ||
        null

      const recebido =
        !!normalizarData(
          processo?.recebimento
        )

      return {
        awb: item.awb || null,

        financeiro_embarque_id:
          processo?.id || null,

        cliente:
          processo?.cliente || null,

        valor_cobranca:
          numero(
            processo?.valor_cobranca
          ),

        recebimento:
          normalizarData(
            processo?.recebimento
          ),

        situacao:
          !processo
            ? 'PROCESSO_NAO_LOCALIZADO'
            : recebido
              ? 'RECEBIDO'
              : 'PENDENTE_RECEBIMENTO',
      }
    })

  const recebidos =
    detalhes.filter(
      (item: any) =>
        item.situacao === 'RECEBIDO'
    )

  const pendentes =
    detalhes.filter(
      (item: any) =>
        item.situacao ===
        'PENDENTE_RECEBIMENTO'
    )

  const naoLocalizados =
    detalhes.filter(
      (item: any) =>
        item.situacao ===
        'PROCESSO_NAO_LOCALIZADO'
    )

  const valorRecebido =
    recebidos.reduce(
      (acc: number, item: any) =>
        acc +
        numero(item.valor_cobranca),
      0
    )

  const valorPendente =
    pendentes.reduce(
      (acc: number, item: any) =>
        acc +
        numero(item.valor_cobranca),
      0
    )

  const total =
    totalFatura(fatura)

  return {
    encontrado: true,

    fatura: {
      id: fatura.id,
      transportadora:
        transportadoraFatura(fatura),
      numero_fatura:
        numeroFatura(fatura),
      vencimento:
        vencimentoFatura(fatura),
      pagamento:
        pagamentoFatura(fatura),
      total,
      paga:
        faturaPaga(fatura),
    },

    conciliacao: {
      total_awbs:
        detalhes.length,

      recebidos:
        recebidos.length,

      pendentes:
        pendentes.length,

      nao_localizados:
        naoLocalizados.length,

      valor_recebido:
        valorRecebido,

      valor_pendente:
        valorPendente,

      cobertura_percentual:
        total > 0
          ? Number(
              (
                (valorRecebido / total) *
                100
              ).toFixed(1)
            )
          : 0,
    },

    itens:
      detalhes.slice(
        0,
        MAX_RESULTADOS_FERRAMENTA
      ),

    limitado_a:
      MAX_RESULTADOS_FERRAMENTA,
  }
}

const FERRAMENTAS = [
  {
    type: 'function',
    name: 'analisar_portal',
    description:
      'Analisa as principais pendências atuais do HC Connect: financeiro, faturas DHL/FedEx e operação. Não altera nada.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },

  {
    type: 'function',
    name: 'consultar_awb',
    description:
      'Consulta um AWB no Financeiro, Embarques e itens das faturas DHL/FedEx. Rastreamento é somente leitura.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        awb: {
          type: 'string',
          description:
            'Número do AWB a consultar.',
        },
      },
      required: ['awb'],
      additionalProperties: false,
    },
  },

  {
    type: 'function',
    name: 'buscar_processos_vencidos',
    description:
      'Lista os processos financeiros ainda não recebidos cujo vencimento já passou.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },

  {
    type: 'function',
    name: 'buscar_processos_aguardando_custo',
    description:
      'Lista processos financeiros cujo valor de compra ainda está zerado ou ausente.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },

  {
    type: 'function',
    name: 'buscar_fatura_transportadora',
    description:
      'Procura uma fatura DHL/FedEx pelo número informado.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        numero: {
          type: 'string',
          description:
            'Número da fatura DHL ou FedEx.',
        },
      },
      required: ['numero'],
      additionalProperties: false,
    },
  },

  {
    type: 'function',
    name: 'analisar_conciliacao_fatura',
    description:
      'Analisa os AWBs de uma fatura DHL/FedEx e cruza com processos financeiros, classificando recebido, pendente ou não localizado.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        numero: {
          type: 'string',
          description:
            'Número da fatura DHL ou FedEx.',
        },
      },
      required: ['numero'],
      additionalProperties: false,
    },
  },
]

async function executarFerramenta(
  nome: string,
  argumentos: any,
  db: any
) {
  switch (nome) {
    case 'analisar_portal':
      return analisarPortal(db)

    case 'consultar_awb':
      return consultarAwb(
        db,
        argumentos?.awb
      )

    case 'buscar_processos_vencidos':
      return buscarProcessosVencidos(db)

    case 'buscar_processos_aguardando_custo':
      return buscarAguardandoCusto(db)

    case 'buscar_fatura_transportadora':
      return buscarFaturaTransportadora(
        db,
        argumentos?.numero
      )

    case 'analisar_conciliacao_fatura':
      return analisarConciliacaoFatura(
        db,
        argumentos?.numero
      )

    default:
      return {
        erro:
          `Ferramenta não autorizada: ${nome}`,
      }
  }
}

async function chamarIA(
  input: any[]
) {
  const apiKey =
    process.env.OPENROUTER_API_KEY

  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY não configurada na Vercel.'
    )
  }

  const model =
    process.env.OPENROUTER_MODEL ||
    'openrouter/free'

  const resposta = await fetch(
    'https://openrouter.ai/api/v1/responses',
    {
      method: 'POST',

      headers: {
        Authorization:
          `Bearer ${apiKey}`,
        'Content-Type':
          'application/json',
        'HTTP-Referer':
          process.env.NEXT_PUBLIC_SITE_URL ||
          'https://portal.hcbhz.com',
        'X-Title':
          'HC Connect - IA HC',
      },

      body: JSON.stringify({
        model,

        instructions:
          INSTRUCOES_IA_HC,

        input,

        tools: FERRAMENTAS,

        tool_choice: 'auto',

        max_output_tokens: 2200,

        provider: {
          data_collection: 'deny',
          require_parameters: true,
        },
      }),
    }
  )

  const dados =
    await resposta
      .json()
      .catch(() => null)

  if (!resposta.ok) {
    const mensagem =
      dados?.error?.message ||
      dados?.message ||
      `Erro HTTP ${resposta.status}`

    if (
      resposta.status === 429
    ) {
      throw new Error(
        'Limite gratuito diário da IA HC atingido no OpenRouter. Tente novamente mais tarde.'
      )
    }

    throw new Error(
      `OpenRouter: ${mensagem}`
    )
  }

  return dados
}

function extrairTextoResposta(
  resposta: any
) {
  if (
    typeof resposta?.output_text ===
      'string' &&
    resposta.output_text.trim()
  ) {
    return resposta.output_text.trim()
  }

  const textos: string[] = []

  for (
    const item of resposta?.output || []
  ) {
    if (item?.type !== 'message') {
      continue
    }

    for (
      const conteudo of item?.content || []
    ) {
      if (
        conteudo?.type === 'output_text' &&
        typeof conteudo?.text ===
          'string'
      ) {
        textos.push(conteudo.text)
      }
    }
  }

  return textos.join('\n').trim()
}

function prepararHistorico(
  mensagens: any
): MensagemChat[] {
  if (!Array.isArray(mensagens)) {
    return []
  }

  return mensagens
    .filter(
      (item: any) =>
        (
          item?.role === 'user' ||
          item?.role === 'assistant'
        ) &&
        typeof item?.content ===
          'string'
    )
    .slice(-16)
    .map((item: any) => ({
      role: item.role,
      content:
        item.content
          .trim()
          .slice(0, 5000),
    }))
    .filter(
      (item: MensagemChat) =>
        !!item.content
    )
}

export async function POST(
  request: NextRequest
) {
  try {
    const acesso =
      await verificarAdmin(request)

    if (!acesso.autorizado) {
      return NextResponse.json(
        {
          error: acesso.erro,
        },
        {
          status: acesso.status,
        }
      )
    }

    const body =
      await request.json()

    const mensagens =
      prepararHistorico(
        body?.mensagens
      )

    if (mensagens.length === 0) {
      return NextResponse.json(
        {
          error:
            'Mensagem não informada.',
        },
        {
          status: 400,
        }
      )
    }

    const input: any[] =
      mensagens.map(
        (mensagem) => ({
          role: mensagem.role,
          content: mensagem.content,
        })
      )

    let resposta =
      await chamarIA(input)

    for (
      let rodada = 0;
      rodada < 5;
      rodada++
    ) {
      const chamadas =
        (resposta?.output || []).filter(
          (item: any) =>
            item?.type ===
            'function_call'
        )

      if (chamadas.length === 0) {
        const texto =
          extrairTextoResposta(
            resposta
          )

        return NextResponse.json({
          resposta:
            texto ||
            'Não consegui gerar uma resposta textual.',
          modelo:
            process.env.OPENROUTER_MODEL ||
            'openrouter/free',
          modo:
            'LEITURA',
        })
      }

      input.push(
        ...(resposta.output || [])
      )

      for (
        const chamada of chamadas
      ) {
        let argumentos: any = {}

        try {
          argumentos = JSON.parse(
            chamada.arguments || '{}'
          )
        } catch {
          argumentos = {}
        }

        let resultado: any

        try {
          resultado =
            await executarFerramenta(
              chamada.name,
              argumentos,
              acesso.admin
            )
        } catch (error: any) {
          resultado = {
            erro:
              error?.message ||
              'Erro ao executar ferramenta HC.',
          }
        }

        input.push({
          type:
            'function_call_output',
          call_id:
            chamada.call_id,
          output:
            JSON.stringify(resultado),
        })
      }

      resposta =
        await chamarIA(input)
    }

    return NextResponse.json(
      {
        error:
          'A IA excedeu o limite interno de consultas para esta pergunta.',
      },
      {
        status: 422,
      }
    )
  } catch (error: any) {
    console.error(
      'Erro IA HC:',
      error
    )

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Erro interno da IA HC.',
      },
      {
        status: 500,
      }
    )
  }
}
