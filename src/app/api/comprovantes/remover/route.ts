// HC_EXCLUSAO_SEGURA_V1 - Remoção restrita a comprovante ainda não confirmado.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clienteSupabase(chave: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url || !chave) throw new Error('Supabase não configurado.')
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function POST(req: NextRequest) {
  try {
    const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!jwt) return NextResponse.json({ error: 'Autenticação necessária.' }, { status: 401 })
    const auth = clienteSupabase(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
    const { data: { user }, error: authError } = await auth.auth.getUser(jwt)
    if (authError || !user) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const id = String(body?.fatura_id || '').trim()
    const urlEsperada = String(body?.comprovante_url || '').trim()
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id) || !urlEsperada) {
      return NextResponse.json({ error: 'Identificação inválida.' }, { status: 400 })
    }

    const admin = clienteSupabase(process.env.SUPABASE_SERVICE_ROLE_KEY || '')
    const { data: fatura, error: erroBusca } = await admin.from('faturas')
      .select('id, usuario_id, embarque_id, comprovante_pagamento, status_pagamento, recibo_pdf, data_pagamento, valor_pago')
      .eq('id', id).maybeSingle()
    if (erroBusca || !fatura) return NextResponse.json({ error: 'Fatura não encontrada.' }, { status: 404 })

    let autorizado = String(fatura.usuario_id || '') === user.id
    if (fatura.embarque_id && !autorizado) {
      const { data: embarque } = await admin.from('embarques').select('usuario_id')
        .eq('id', fatura.embarque_id).maybeSingle()
      autorizado = embarque?.usuario_id === user.id
    }
    if (!autorizado) {
      const { data } = await admin.from('fatura_clientes').select('fatura_id')
        .eq('fatura_id', id).eq('cliente_id', user.id).limit(1).maybeSingle()
      autorizado = !!data
    }
    if (!autorizado && fatura.embarque_id) {
      const { data } = await admin.from('embarque_clientes').select('embarque_id')
        .eq('embarque_id', fatura.embarque_id).eq('cliente_id', user.id).limit(1).maybeSingle()
      autorizado = !!data
    }
    if (!autorizado) return NextResponse.json({ error: 'Sem acesso à fatura.' }, { status: 403 })

    const status = String(fatura.status_pagamento || '').trim().toUpperCase()
    if (!['COMPROVANTE ENVIADO', 'COMPROVANTE REJEITADO'].includes(status) ||
        fatura.recibo_pdf || fatura.data_pagamento || Number(fatura.valor_pago || 0) > 0) {
      return NextResponse.json({ error: 'Pagamento já processado ou em revisão. Solicite ajuste à HC.' }, { status: 409 })
    }
    if (fatura.comprovante_pagamento !== urlEsperada) {
      return NextResponse.json({ error: 'Comprovante mudou. Atualize a página.' }, { status: 409 })
    }

    // Atualização condicional para evitar apagar comprovante substituído ou pagamento aprovado.
    const { data: alteradas, error: erroUpdate } = await admin.from('faturas')
      .update({ comprovante_pagamento: null, data_comprovante: null, status_pagamento: 'AGUARDANDO PAGAMENTO', observacao_pagamento: null })
      .eq('id', id)
      .eq('comprovante_pagamento', urlEsperada)
      .eq('status_pagamento', fatura.status_pagamento)
      .is('recibo_pdf', null)
      .is('data_pagamento', null)
      .select('id')
    if (erroUpdate) throw erroUpdate
    if (!alteradas || alteradas.length !== 1) return NextResponse.json({ error: 'Estado da fatura mudou. Atualize a página.' }, { status: 409 })

    // Não remove o objeto do Storage: preserva trilha de auditoria e evita perda irreversível.
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Falha remoção de comprovante:', error)
    return NextResponse.json({ error: 'Erro ao remover comprovante. Tente novamente.' }, { status: 500 })
  }
}
