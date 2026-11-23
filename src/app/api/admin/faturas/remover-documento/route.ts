// HC_ADMIN_DOCUMENTOS_V3 — exclusão de PDFs por administrador, sem apagar faturas/financeiro.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CAMPOS_FATURA = ['arquivo_pdf', 'recibo_pdf', 'comprovante_pagamento'] as const
const MAX_URL = 3000

function cliente(key: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url || !key) throw new Error('Supabase não configurado.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

// HC_REMOVER_COMPROVANTE_CLIENTE_V1: aceita bucket "faturas" e comprovantes de cliente em "documentos/comprovantes/".
function caminhoStorage(url: string): { bucket: string; path: string } | null {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '') + '/storage/v1/object/public/'
  const permitidos: { bucket: string; subpasta: string }[] = [
    { bucket: 'faturas', subpasta: '' },
    { bucket: 'documentos', subpasta: 'comprovantes/' },
  ]
  for (const p of permitidos) {
    const prefixo = base + p.bucket + '/'
    if (!url.startsWith(prefixo)) continue
    let path: string
    try { path = decodeURIComponent(url.slice(prefixo.length).split('?')[0]) } catch { return null }
    if (!path || path.startsWith('/') || path.includes('..') || path.includes('\\')) return null
    if (p.subpasta && !path.startsWith(p.subpasta)) return null
    if (!/\.(pdf|png|jpe?g)$/i.test(path)) return null
    return { bucket: p.bucket, path }
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return NextResponse.json({ error: 'Faça login novamente.' }, { status: 401 })
    const auth = cliente(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
    const { data: { user }, error: erroAuth } = await auth.auth.getUser(token)
    if (erroAuth || !user) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

    const admin = cliente(process.env.SUPABASE_SERVICE_ROLE_KEY || '')
    const { data: perfil, error: erroPerfil } = await admin.from('perfis')
      .select('tipo_acesso, ativo').eq('id', user.id).maybeSingle()
    if (erroPerfil || String(perfil?.tipo_acesso || '').trim().toUpperCase() !== 'ADMIN' || perfil?.ativo === false) {
      return NextResponse.json({ error: 'Apenas administradores podem remover documentos.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const tabela = String(body?.origem || '')
    const id = String(body?.id || '').trim()
    const url = String(body?.url || '').trim()
    if (!['faturas', 'fatura_arquivos'].includes(tabela) || !UUID.test(id) || url.length > MAX_URL || !url) {
      return NextResponse.json({ error: 'Documento inválido.' }, { status: 400 })
    }
    const alvo = caminhoStorage(url)
    if (!alvo) return NextResponse.json({ error: 'O documento não pertence ao Storage do HC (faturas ou comprovantes).' }, { status: 400 })
    const caminho = alvo.bucket + '/' + alvo.path

    let campo = ''
    let faturaAtual: any = null
    if (tabela === 'faturas') {
      const { data: fatura, error } = await admin.from('faturas')
        .select('id, arquivo_pdf, recibo_pdf, comprovante_pagamento, status_pagamento, data_pagamento, valor_pago').eq('id', id).maybeSingle()
      if (error || !fatura) return NextResponse.json({ error: 'Fatura não encontrada.' }, { status: 404 })
      const encontrados = CAMPOS_FATURA.filter(c => fatura[c] === url)
      if (encontrados.length !== 1) return NextResponse.json({ error: 'Documento alterado ou ambíguo. Recarregue a página.' }, { status: 409 })
      campo = encontrados[0]
      faturaAtual = fatura
    } else {
      const { data: anexo, error } = await admin.from('fatura_arquivos')
        .select('id, url').eq('id', id).maybeSingle()
      if (error || !anexo) return NextResponse.json({ error: 'Anexo não encontrado.' }, { status: 404 })
      if (anexo.url !== url) return NextResponse.json({ error: 'Anexo alterado. Recarregue a página.' }, { status: 409 })
      campo = 'url'
    }

    // Registra o pedido no banco antes de modificar o documento.
    const { data: auditoria, error: erroAuditoria } = await admin.from('hc_documentos_exclusoes')
      .insert({ tabela_origem: tabela, registro_id: id, campo, url_original: url,
        caminho_storage: caminho, excluido_por: user.id, status: 'SOLICITADO' })
      .select('id').single()
    if (erroAuditoria || !auditoria) {
      return NextResponse.json({ error: 'Não foi possível registrar a auditoria. Execute o SQL da V3.' }, { status: 500 })
    }

    let erroBanco: string | null = null
    let okBanco = false
    if (tabela === 'faturas') {
      const payload: Record<string, any> = { [campo]: null }
      if (campo === 'recibo_pdf') {
        payload.recibo_nome = null
        payload.recibo_emitido_em = null
        payload.recibo_observacoes = null
      }
      if (campo === 'comprovante_pagamento' && faturaAtual) {
        const st = String(faturaAtual.status_pagamento || '').trim().toUpperCase()
        const naoProcessado = !faturaAtual.recibo_pdf && !faturaAtual.data_pagamento && Number(faturaAtual.valor_pago || 0) <= 0
        if (naoProcessado && ['COMPROVANTE ENVIADO', 'COMPROVANTE REJEITADO'].includes(st)) {
          payload.status_pagamento = 'AGUARDANDO PAGAMENTO'
          payload.data_comprovante = null
          payload.observacao_pagamento = null
        }
      }
      // NÃO modificar data_pagamento, valor_pago ou Financeiro. Status só volta se comprovante ainda não processado.
      const { data, error } = await admin.from('faturas').update(payload)
        .eq('id', id).eq(campo, url).select('id').maybeSingle()
      erroBanco = error?.message || null
      okBanco = !!data && !error
    } else {
      const { data, error } = await admin.from('fatura_arquivos').delete()
        .eq('id', id).eq('url', url).select('id').maybeSingle()
      erroBanco = error?.message || null
      okBanco = !!data && !error
    }
    if (!okBanco) {
      await admin.from('hc_documentos_exclusoes').update({ status: 'FALHOU', erro: erroBanco || 'Documento já alterado' }).eq('id', auditoria.id)
      return NextResponse.json({ error: erroBanco || 'Documento alterado. Atualize a tela.' }, { status: 409 })
    }

    const { error: erroStorage } = await admin.storage.from(alvo.bucket).remove([alvo.path])
    await admin.from('hc_documentos_exclusoes').update({
      status: erroStorage ? 'LIMPEZA_PENDENTE' : 'CONCLUIDO',
      erro: erroStorage?.message || null,
      finalizado_em: new Date().toISOString(),
    }).eq('id', auditoria.id)

    if (erroStorage) {
      return NextResponse.json({ ok: true, aviso: 'Documento desvinculado. A exclusão física do PDF está pendente e ficou registrada para auditoria.' })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('HC_ADMIN_DOCUMENTOS_V3:', error)
    return NextResponse.json({ error: 'Falha ao remover documento. Consulte os logs.' }, { status: 500 })
  }
}
