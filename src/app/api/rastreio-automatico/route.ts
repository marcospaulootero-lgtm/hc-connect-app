import { NextResponse } from 'next/server'
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

export async function GET(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET
    const authHeader = req.headers.get('authorization') || ''

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

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
      return NextResponse.json(
        { error: 'Erro ao buscar embarques.', detalhes: error.message },
        { status: 500 }
      )
    }

    const resultados: any[] = []
    const origem = new URL(req.url).origin
    let primeiraConsultaDhl = true
    let dhlBloqueadoNestaExecucao = false

    for (const embarque of embarques || []) {
      if (
        embarque.proxima_tentativa_rastreio &&
        new Date(embarque.proxima_tentativa_rastreio) > new Date()
      ) {
        resultados.push({
          id: embarque.id,
          awb: embarque.awb || '-',
          transportadora: embarque.transportadora || '-',
          sucesso: false,
          erro: `AWB temporariamente bloqueado até ${embarque.proxima_tentativa_rastreio}`,
        })
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

      if (transportadora === 'DHL') {
        if (dhlBloqueadoNestaExecucao) {
          resultados.push({
            id: embarque.id,
            awb: embarque.awb || '-',
            transportadora: 'DHL',
            sucesso: false,
            erro: 'DHL pausado nesta execução após limite de requisições. O sistema tentará novamente na próxima rodada.',
          })
          continue
        }

        if (!primeiraConsultaDhl && DELAY_DHL_MS > 0) {
          await aguardar(DELAY_DHL_MS)
        }

        primeiraConsultaDhl = false
      }

      try {
        // IMPORTANTE: o automático não possui uma segunda regra DHL/FedEx.
        // Ele chama exatamente o mesmo endpoint usado pelo botão "Rodar rastreio".
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
      return NextResponse.json(
        {
          error: 'Rastreio executado, mas houve erro ao salvar log.',
          detalhes: erroLog.message,
          motor: '/api/rastreio',
          total_processado: resultados.length,
          total_sucesso: totalSucesso,
          total_erro: totalErro,
          erros: errosDetalhados,
          resultados,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      sucesso: true,
      motor: '/api/rastreio',
      total_processado: resultados.length,
      total_sucesso: totalSucesso,
      total_erro: totalErro,
      erros: errosDetalhados,
      resultados,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Erro interno no rastreio automático.',
        detalhes: error?.message || String(error),
      },
      { status: 500 }
    )
  }
}
