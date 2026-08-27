import { after, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'placeholder-key'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

const DELAY_DHL_MS = Number(process.env.DHL_RASTREIO_DELAY_MS || 1800)
const MAX_DHL_POR_EXECUCAO = Number(process.env.DHL_RASTREIO_MAX_POR_EXECUCAO || 5)
const MAX_FEDEX_POR_EXECUCAO = Number(process.env.FEDEX_RASTREIO_MAX_POR_EXECUCAO || 10)

function aguardar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizarAwb(valor: any) {
  return String(valor || '').replace(/\D/g, '')
}

function transportadoraCurta(transportadora: any, awb: any) {
  const texto = String(transportadora || '').toUpperCase()
  const awbLimpo = normalizarAwb(awb)

  if (texto.includes('DHL')) return 'DHL'
  if (texto.includes('FEDEX') || texto.includes('FED EX')) return 'FEDEX'
  if (awbLimpo.length === 10) return 'DHL'
  if (awbLimpo.length === 12) return 'FEDEX'
  return ''
}

function ehRateLimit(mensagem: any) {
  const texto = String(mensagem || '').toLowerCase()

  return (
    texto.includes('429') ||
    texto.includes('too many requests') ||
    texto.includes('many requests') ||
    texto.includes('rate limit') ||
    texto.includes('defined time period')
  )
}

function limparMensagemErro(mensagem: any) {
  const texto = String(mensagem || '').trim()

  if (ehRateLimit(texto)) {
    return 'Limite de consultas atingido na transportadora. O sistema tentará novamente mais tarde.'
  }

  if (texto.length > 220) {
    return `${texto.slice(0, 220)}...`
  }

  return texto || 'Erro não informado.'
}

async function registrarFalhaGeral(erro: any) {
  const mensagem = limparMensagemErro(erro?.message || String(erro))

  const { error } = await supabase.from('logs_rastreio').insert({
    total_processado: 0,
    total_sucesso: 0,
    total_erro: 1,
    detalhes: [
      {
        id: null,
        awb: '-',
        transportadora: '-',
        erro: mensagem,
      },
    ],
  })

  if (error) {
    console.error('Erro ao registrar falha geral do rastreio automático:', error.message)
  }
}

async function processarRastreios(origem: string, cronSecret: string) {
  const { data: embarques, error } = await supabase
    .from('embarques')
    .select('id, awb, transportadora, status_operacional, proxima_tentativa_rastreio, ultima_atualizacao')
    .not('awb', 'is', null)
    .not('awb', 'ilike', 'AGUARDANDO AWB%')
    .not('status_operacional', 'eq', 'Entregue')
    .not('status_operacional', 'eq', 'Finalizado')
    .not('status_operacional', 'eq', 'Cancelado')
    .order('ultima_atualizacao', { ascending: true })

  if (error) {
    throw new Error(`Erro ao buscar embarques: ${error.message}`)
  }

  const resultados: any[] = []
  const filaFedEx: any[] = []
  const filaDhl: any[] = []
  const agora = new Date()

  // Processa lotes pequenos e justos por transportadora.
  // A ordenação por ultima_atualizacao faz os AWBs mais antigos avançarem
  // para o início da fila nas próximas execuções.
  for (const embarque of embarques || []) {
    if (
      embarque.proxima_tentativa_rastreio &&
      new Date(embarque.proxima_tentativa_rastreio) > agora
    ) {
      continue
    }

    const transportadora = transportadoraCurta(embarque.transportadora, embarque.awb)

    if (!transportadora) {
      resultados.push({
        id: embarque.id,
        awb: embarque.awb || '-',
        transportadora: embarque.transportadora || '-',
        sucesso: false,
        erro: 'Transportadora não suportada para rastreio automático.',
      })
      continue
    }

    if (transportadora === 'FEDEX' && filaFedEx.length < MAX_FEDEX_POR_EXECUCAO) {
      filaFedEx.push({ ...embarque, transportadora_rastreio: transportadora })
      continue
    }

    if (transportadora === 'DHL' && filaDhl.length < MAX_DHL_POR_EXECUCAO) {
      filaDhl.push({ ...embarque, transportadora_rastreio: transportadora })
    }
  }

  // FedEx primeiro: não fica esperando os intervalos necessários entre consultas DHL.
  const fila = [...filaFedEx, ...filaDhl]

  let primeiraConsultaDhl = true
  let dhlBloqueadoNestaExecucao = false

  for (const embarque of fila) {
    const transportadora = embarque.transportadora_rastreio as 'DHL' | 'FEDEX'

    if (transportadora === 'DHL') {
      if (dhlBloqueadoNestaExecucao) {
        continue
      }

      if (!primeiraConsultaDhl && DELAY_DHL_MS > 0) {
        await aguardar(DELAY_DHL_MS)
      }

      primeiraConsultaDhl = false
    }

    try {
      // O automático continua usando exatamente o mesmo motor do botão manual.
      const response = await fetch(`${origem}/api/rastreio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({
          embarque_id: embarque.id,
        }),
        cache: 'no-store',
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok || payload?.sucesso !== true) {
        const mensagem =
          payload?.detalhes ||
          payload?.error ||
          `Falha HTTP ${response.status} ao atualizar o rastreio.`

        if (transportadora === 'DHL' && ehRateLimit(mensagem)) {
          dhlBloqueadoNestaExecucao = true
          const proximaTentativa = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()

          await supabase
            .from('embarques')
            .update({
              proxima_tentativa_rastreio: proximaTentativa,
            })
            .eq('id', embarque.id)
        }

        resultados.push({
          id: embarque.id,
          awb: embarque.awb || '-',
          transportadora: transportadora === 'FEDEX' ? 'FedEx' : transportadora,
          sucesso: false,
          erro: limparMensagemErro(mensagem),
        })
        continue
      }

      resultados.push({
        id: embarque.id,
        awb: payload?.awb || embarque.awb || '-',
        transportadora:
          payload?.transportadora ||
          (transportadora === 'FEDEX' ? 'FedEx' : transportadora),
        sucesso: true,
        status: payload?.status || null,
        descricao: payload?.descricao || null,
      })
    } catch (erro: any) {
      const mensagem = erro?.message || String(erro)

      resultados.push({
        id: embarque.id,
        awb: embarque.awb || '-',
        transportadora: transportadora === 'FEDEX' ? 'FedEx' : transportadora,
        sucesso: false,
        erro: limparMensagemErro(mensagem),
      })
    }
  }

  const totalSucesso = resultados.filter((r) => r.sucesso === true).length
  const totalErro = resultados.filter((r) => r.sucesso === false).length

  const errosDetalhados = resultados
    .filter((r) => r.sucesso === false)
    .map((r) => ({
      id: r.id || null,
      awb: r.awb || '-',
      transportadora: r.transportadora || '-',
      erro: limparMensagemErro(r.erro || 'Erro não informado.'),
    }))

  const { error: erroLog } = await supabase.from('logs_rastreio').insert({
    total_processado: resultados.length,
    total_sucesso: totalSucesso,
    total_erro: totalErro,
    detalhes: errosDetalhados,
  })

  if (erroLog) {
    throw new Error(`Rastreio executado, mas houve erro ao salvar log: ${erroLog.message}`)
  }

  console.log('Rastreio automático concluído.', {
    motor: '/api/rastreio',
    dhl_selecionados: filaDhl.length,
    fedex_selecionados: filaFedEx.length,
    total_processado: resultados.length,
    total_sucesso: totalSucesso,
    total_erro: totalErro,
  })
}

export async function GET(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET
    const authHeader = req.headers.get('authorization') || ''

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const origem = new URL(req.url).origin

    // O Supabase pg_net aceita no máximo 5 s de timeout.
    // Respondemos imediatamente e mantemos o lote vivo com after(),
    // que é a API oficial do Next.js para trabalho pós-resposta.
    after(async () => {
      try {
        await processarRastreios(origem, cronSecret)
      } catch (erro: any) {
        console.error('Erro no processamento do rastreio automático:', erro)
        await registrarFalhaGeral(erro)
      }
    })

    return NextResponse.json(
      {
        sucesso: true,
        aceito: true,
        motor: '/api/rastreio',
        mensagem: 'Rastreio automático iniciado em segundo plano.',
      },
      { status: 202 }
    )
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Erro ao iniciar o rastreio automático.',
        detalhes: error?.message || String(error),
      },
      { status: 500 }
    )
  }
}
