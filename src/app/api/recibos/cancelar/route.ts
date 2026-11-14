// HC_CANCELAMENTO_RECIBO_V1 + HC_CANCELAMENTO_RECIBO_V2 — Exclusivamente administrador.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function supabaseServidor(chave: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url || !chave) throw new Error('Supabase não configurado.')
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } })
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return NextResponse.json({ error: 'Autenticação necessária.' }, { status: 401 })
    const auth = supabaseServidor(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
    const { data: { user }, error: authError } = await auth.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

    const admin = supabaseServidor(process.env.SUPABASE_SERVICE_ROLE_KEY || '')
    const { data: perfil, error: perfilErro } = await admin.from('perfis')
      .select('tipo_acesso, ativo').eq('id', user.id).maybeSingle()
    if (perfilErro || String(perfil?.tipo_acesso || '').trim().toUpperCase() !== 'ADMIN' || perfil?.ativo === false) {
      return NextResponse.json({ error: 'Somente administradores podem cancelar recibos.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const id = String(body?.fatura_id || '').trim()
    const urlEsperada = String(body?.recibo_url || '').trim()
    if (!uuid.test(id) || !urlEsperada) {
      return NextResponse.json({ error: 'Informe a fatura e o recibo atual.' }, { status: 400 })
    }
    const { data: fatura, error: erroFatura } = await admin.from('faturas')
      .select('id, recibo_pdf').eq('id', id).maybeSingle()
    if (erroFatura || !fatura) return NextResponse.json({ error: 'Fatura não localizada.' }, { status: 404 })
    if (fatura.recibo_pdf !== urlEsperada) {
      return NextResponse.json({ error: 'Recibo já alterado. Atualize a página.' }, { status: 409 })
    }

    const marcador = '/storage/v1/object/public/faturas/'
    const posicao = urlEsperada.indexOf(marcador)
    if (posicao < 0) return NextResponse.json({ error: 'Endereço do PDF incompatível com o Storage de faturas.' }, { status: 400 })
    const caminho = decodeURIComponent(urlEsperada.slice(posicao + marcador.length).split('?')[0])
    if (!caminho.startsWith(`recibos/${id}/`) || !caminho.toLowerCase().endsWith('.pdf') || caminho.includes('..')) {
      return NextResponse.json({ error: 'Somente recibos principais do Storage de faturas podem ser cancelados.' }, { status: 400 })
    }

    // V2: o usuário optou por EXCLUSÃO DEFINITIVA do PDF, sem cópia em bucket privado.
    // O banco mantém somente metadados da emissão cancelada e do administrador.
    const motivoPadrao = 'Cancelamento administrativo confirmado; PDF excluído por solicitação.'
    const arquivoAuditoria = 'PDF_EXCLUIDO_DEFINITIVAMENTE_V2'

    const { data: logId, error: erroCancelamento } = await admin.rpc('hc_cancelar_recibo_principal_v1', {
      p_fatura_id: id, p_recibo_url: urlEsperada, p_caminho_original: caminho,
      p_arquivo_auditoria: arquivoAuditoria, p_motivo: motivoPadrao, p_admin_id: user.id,
    })
    if (erroCancelamento) {
      // O banco recusa o cancelamento se o recibo foi modificado durante o processamento.
      return NextResponse.json({ error: erroCancelamento.message }, { status: 409 })
    }

    // Remover PDF original do bucket público. Não existe cópia privada na V2.
    const { error: erroRemocao } = await admin.storage.from('faturas').remove([caminho])
    if (erroRemocao) {
      console.error('HC recibo cancelado, porém limpeza do Storage pendente:', { id, logId, caminho, erroRemocao })
      return NextResponse.json({ ok: true, aviso: 'Recibo desassociado, mas não foi possível excluir o PDF do Storage. Solicite a limpeza do arquivo antes de reemitir.' })
    }
    return NextResponse.json({ ok: true, cancelamento_id: logId })
  } catch (error: any) {
    console.error('Falha ao cancelar recibo principal:', error)
    return NextResponse.json({ error: 'Erro ao cancelar recibo. Consulte os registros e tente novamente.' }, { status: 500 })
  }
}
