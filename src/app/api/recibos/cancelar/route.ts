// HC_CANCELAMENTO_RECIBO_V1 — Exclusivamente administrador.
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
    const motivo = String(body?.motivo || '').trim()
    if (!uuid.test(id) || !urlEsperada || motivo.length < 10 || motivo.length > 1000) {
      return NextResponse.json({ error: 'Informe a fatura, o recibo atual e um motivo entre 10 e 1000 caracteres.' }, { status: 400 })
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

    // Salvar a evidência em bucket privado ANTES de retirar o PDF vigente.
    const { data: arquivo, error: erroDownload } = await admin.storage.from('faturas').download(caminho)
    if (erroDownload || !arquivo) return NextResponse.json({ error: 'Não foi possível preservar o PDF original. Cancelamento interrompido.' }, { status: 409 })
    const nomeAuditoria = `${id}/${Date.now()}-${user.id}-recibo-cancelado.pdf`
    const { error: erroArquivo } = await admin.storage.from('hc-recibos-auditoria')
      .upload(nomeAuditoria, arquivo, { contentType: 'application/pdf', upsert: false })
    if (erroArquivo) return NextResponse.json({ error: 'Falha no arquivamento privado. Verifique o SQL de instalação.' }, { status: 500 })

    const { data: logId, error: erroCancelamento } = await admin.rpc('hc_cancelar_recibo_principal_v1', {
      p_fatura_id: id, p_recibo_url: urlEsperada, p_caminho_original: caminho,
      p_arquivo_auditoria: nomeAuditoria, p_motivo: motivo, p_admin_id: user.id,
    })
    if (erroCancelamento) {
      // Se o recibo foi modificado durante o processamento, não cancelar a nova versão.
      await admin.storage.from('hc-recibos-auditoria').remove([nomeAuditoria])
      return NextResponse.json({ error: erroCancelamento.message }, { status: 409 })
    }

    // Invalidar link público anterior; a cópia de auditoria é privada.
    const { error: erroRemocao } = await admin.storage.from('faturas').remove([caminho])
    if (erroRemocao) {
      console.error('HC recibo cancelado, porém limpeza do Storage pendente:', { id, logId, caminho, erroRemocao })
      return NextResponse.json({ ok: true, aviso: 'Recibo cancelado e arquivado, mas a exclusão do PDF público precisa de conferência no Storage.' })
    }
    return NextResponse.json({ ok: true, cancelamento_id: logId })
  } catch (error: any) {
    console.error('Falha ao cancelar recibo principal:', error)
    return NextResponse.json({ error: 'Erro ao cancelar recibo. Consulte os registros e tente novamente.' }, { status: 500 })
  }
}
