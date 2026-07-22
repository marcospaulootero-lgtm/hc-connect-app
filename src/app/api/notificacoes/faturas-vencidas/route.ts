import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function texto(valor: any) {
  return String(valor || '').trim()
}

function hojeISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(new Date())
}

function normalizarData(valor: any) {
  const raw = texto(valor)
  if (!raw) return ''

  const matchIso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (matchIso) return `${matchIso[1]}-${matchIso[2]}-${matchIso[3]}`

  const matchBr = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (matchBr) return `${matchBr[3]}-${matchBr[2]}-${matchBr[1]}`

  return raw.slice(0, 10)
}

function dataBR(valor: any) {
  const data = normalizarData(valor)
  if (!data) return ''

  const [ano, mes, dia] = data.split('-')
  if (!ano || !mes || !dia) return data

  return `${dia}/${mes}/${ano}`
}

function numero(valor: any) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0

  const raw = texto(valor)
  if (!raw) return 0

  const limpo = raw
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')

  const n = Number(limpo)
  return Number.isFinite(n) ? n : 0
}

function moeda(valor: any) {
  return numero(valor).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function siteUrl() {
  const direto = texto(process.env.NEXT_PUBLIC_SITE_URL)
  if (direto) return direto.replace(/\/$/, '')

  const vercel = texto(process.env.VERCEL_URL)
  if (vercel) return `https://${vercel}`.replace(/\/$/, '')

  return 'http://localhost:3000'
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Supabase admin não configurado.')
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

async function buscarEmbarque(admin: any, embarqueId: any) {
  const id = texto(embarqueId)
  if (!id) return null

  try {
    const { data } = await admin
      .from('embarques')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    return data || null
  } catch (error) {
    console.warn('Não foi possível buscar embarque:', error)
    return null
  }
}

async function buscarPerfil(admin: any, usuarioId: any) {
  const id = texto(usuarioId)
  if (!id) return null

  try {
    const { data } = await admin
      .from('perfis')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (data?.email) return data
  } catch (error) {
    console.warn('Não foi possível buscar perfil por id:', error)
  }

  try {
    const { data } = await admin
      .from('perfis')
      .select('*')
      .eq('user_id', id)
      .maybeSingle()

    if (data?.email) return data
  } catch (error) {
    console.warn('Não foi possível buscar perfil por user_id:', error)
  }

  return null
}

async function buscarPerfilPorEmbarqueCliente(admin: any, embarqueId: any) {
  const id = texto(embarqueId)
  if (!id) return null

  try {
    const { data: vinculo } = await admin
      .from('embarque_clientes')
      .select('*')
      .eq('embarque_id', id)
      .limit(1)
      .maybeSingle()

    const usuarioId =
      vinculo?.usuario_id ||
      vinculo?.cliente_id ||
      vinculo?.perfil_id ||
      vinculo?.user_id ||
      null

    if (!usuarioId) return null

    return await buscarPerfil(admin, usuarioId)
  } catch (error) {
    console.warn('Não foi possível buscar vínculo embarque_clientes:', error)
    return null
  }
}

async function jaEnviouVencida(admin: any, faturaId: any) {
  const id = texto(faturaId)
  if (!id) return false

  const { data, error } = await admin
    .from('emails_enviados')
    .select('id')
    .eq('tipo', 'FATURA_VENCIDA')
    .eq('referencia_tipo', 'faturas')
    .eq('referencia_id', id)
    .in('status', ['PENDENTE', 'ENVIADO'])
    .limit(1)

  if (error) {
    console.warn('Não foi possível consultar emails_enviados:', error.message)
    return false
  }

  return Array.isArray(data) && data.length > 0
}

async function enviarEmailFaturaVencida(params: {
  email: string
  nome: string
  fatura: any
  embarque: any
}) {
  const { email, nome, fatura, embarque } = params

  const resposta = await fetch(`${siteUrl()}/api/email-cliente-notificacao`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tipo: 'FATURA_VENCIDA',
      email,
      nome,
      awb: embarque?.awb || fatura?.awb || '',
      referencia:
        embarque?.referencia_cliente ||
        embarque?.referencia_hc ||
        fatura?.numero_fatura ||
        '',
      referencia_tipo: 'faturas',
      referencia_id: fatura.id,
      link: `${siteUrl()}/cliente/faturas`,
      mensagem: 'Consta uma fatura vencida em aberto no Portal HC Connect.',
      dados: {
        Fatura: fatura.numero_fatura || '-',
        AWB: embarque?.awb || '-',
        Vencimento: dataBR(fatura.vencimento),
        Valor: numero(fatura.valor_total) > 0 ? moeda(fatura.valor_total) : '',
      },
    }),
  })

  if (!resposta.ok) {
    const erro = await resposta.text()
    throw new Error(erro || 'Erro ao enviar e-mail de fatura vencida.')
  }

  return resposta.json()
}

export async function GET(req: Request) {
  try {
    const admin = supabaseAdmin()
    const url = new URL(req.url)
    const dryRun = url.searchParams.get('dry_run') === '1'
    const limite = Math.min(Number(url.searchParams.get('limite') || 100), 300)
    const hoje = hojeISO()

    const { data: faturas, error } = await admin
      .from('faturas')
      .select('*')
      .not('arquivo_pdf', 'is', null)
      .eq('visivel_cliente', true)
      .lt('vencimento', hoje)
      .limit(limite)

    if (error) throw new Error(error.message)

    const resultado = {
      hoje,
      dry_run: dryRun,
      analisadas: Array.isArray(faturas) ? faturas.length : 0,
      enviadas: 0,
      puladas: 0,
      sem_email: 0,
      duplicadas: 0,
      erros: [] as any[],
      detalhes: [] as any[],
    }

    for (const fatura of faturas || []) {
      const vencimento = normalizarData(fatura.vencimento)

      if (!vencimento || vencimento >= hoje) {
        resultado.puladas++
        continue
      }

      if (fatura.recibo_pdf) {
        resultado.puladas++
        resultado.detalhes.push({
          fatura_id: fatura.id,
          numero_fatura: fatura.numero_fatura,
          status: 'PULADA_COM_RECIBO',
        })
        continue
      }

      if (fatura.arquivado_admin === true || fatura.arquivado_cliente === true) {
        resultado.puladas++
        resultado.detalhes.push({
          fatura_id: fatura.id,
          numero_fatura: fatura.numero_fatura,
          status: 'PULADA_ARQUIVADA',
        })
        continue
      }

      const duplicada = await jaEnviouVencida(admin, fatura.id)

      if (duplicada) {
        resultado.duplicadas++
        resultado.detalhes.push({
          fatura_id: fatura.id,
          numero_fatura: fatura.numero_fatura,
          status: 'JA_NOTIFICADA',
        })
        continue
      }

      const embarque = await buscarEmbarque(admin, fatura.embarque_id)

      const perfil =
        (await buscarPerfil(admin, fatura.usuario_id || embarque?.usuario_id)) ||
        (await buscarPerfilPorEmbarqueCliente(admin, fatura.embarque_id))

      const emailCliente = texto(
        fatura.email_cliente ||
          fatura.cliente_email ||
          fatura.email ||
          perfil?.email
      ).toLowerCase()

      if (!emailCliente) {
        resultado.sem_email++
        resultado.detalhes.push({
          fatura_id: fatura.id,
          numero_fatura: fatura.numero_fatura,
          status: 'SEM_EMAIL',
        })
        continue
      }

      const nomeCliente =
        texto(perfil?.nome) ||
        texto(perfil?.nome_empresa) ||
        texto(perfil?.razao_social) ||
        texto(fatura.cliente_nome) ||
        texto(fatura.nome_cliente) ||
        emailCliente

      if (dryRun) {
        resultado.detalhes.push({
          fatura_id: fatura.id,
          numero_fatura: fatura.numero_fatura,
          email: emailCliente,
          status: 'DRY_RUN_ENVIARIA',
        })
        continue
      }

      try {
        await enviarEmailFaturaVencida({
          email: emailCliente,
          nome: nomeCliente,
          fatura,
          embarque,
        })

        resultado.enviadas++
        resultado.detalhes.push({
          fatura_id: fatura.id,
          numero_fatura: fatura.numero_fatura,
          email: emailCliente,
          status: 'ENVIADA',
        })
      } catch (error: any) {
        resultado.erros.push({
          fatura_id: fatura.id,
          numero_fatura: fatura.numero_fatura,
          erro: error?.message || String(error),
        })
      }
    }

    return NextResponse.json({
      success: true,
      ...resultado,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Erro ao processar faturas vencidas.',
      },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  return GET(req)
}
