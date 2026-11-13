// HC_FOLLOWUP_COMERCIAL_V1 — API administrativa, independente do envio normal de propostas.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export const runtime = 'nodejs'
const COPIAS = ['marcos@hcbhz.com', 'hericacouto@hcbhz.com', 'hericamcouto@outlook.com']
const FROM = 'HC Connect <noreply@hcbhz.com>'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c))

async function contexto(request: NextRequest) {
  const token = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1]
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anon || !service || !process.env.RESEND_API_KEY) throw new Error('Servidor sem configuração de Supabase/Resend')
  if (!token) return null
  const authClient = createClient(url, anon, {auth:{persistSession:false,autoRefreshToken:false}})
  const { data:{user}, error } = await authClient.auth.getUser(token)
  if (error || !user) return null
  const db = createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:perfil,error:erroPerfil} = await db.from('perfis').select('*').eq('id',user.id).maybeSingle()
  if (erroPerfil || !perfil || perfil.ativo === false) return null
  const role = String(perfil.tipo_acesso || perfil.tipo_usuario || perfil.role || perfil.perfil || '').toUpperCase().trim()
  if (!['ADMIN','ADMINISTRADOR','ADM'].includes(role)) return null
  return {db,user}
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await contexto(request)
    if (!ctx) return NextResponse.json({error:'Não autorizado'}, {status:403})
    const id = request.nextUrl.searchParams.get('cotacao_id')
    let query = ctx.db.from('hc_cotacao_followups')
      .select('id,cotacao_id,modelo,destinatario,cc,assunto,criado_em,enviado_em,status,responsavel_id,pdf_anexado')
      .eq('status','ENVIADO').order('enviado_em',{ascending:false}).limit(id ? 100 : 1000)
    if (id) query = query.eq('cotacao_id',id)
    const {data,error} = await query
    if(error) return NextResponse.json({error:'Histórico indisponível: verifique o SQL de instalação.'},{status:503})
    return NextResponse.json({historico:data || []})
  } catch(e) { console.error('Follow-up GET:',e); return NextResponse.json({error:'Erro ao consultar histórico'},{status:500}) }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await contexto(request)
    if (!ctx) return NextResponse.json({error:'Não autorizado'}, {status:403})
    const body = await request.json().catch(()=>({}))
    const cotacaoId = String(body.cotacao_id || '').trim()
    const mensagem = String(body.mensagem || '').trim()
    const destinatario = String(body.destinatario || '').trim().toLowerCase()
    const modelo = String(body.modelo || 'primeiro').slice(0,30)
    const anexarPdf = body.anexar_pdf === true
    if (!/^[0-9a-f-]{36}$/i.test(cotacaoId)) return NextResponse.json({error:'Identificação da cotação inválida'},{status:400})
    if (!EMAIL_RE.test(destinatario) || mensagem.length < 20 || mensagem.length > 12000) return NextResponse.json({error:'Revise o destinatário e a mensagem'},{status:400})
    const {data:cotacao,error:cotErro} = await ctx.db.from('cotacoes').select('*').eq('id',cotacaoId).single()
    if (cotErro || !cotacao) return NextResponse.json({error:'Cotação não encontrada'},{status:404})
    const dados = cotacao.dados_emissor || {}
    if (dados.excluida === true || cotacao.status !== 'COTAÇÃO DISPONÍVEL') return NextResponse.json({error:'O follow-up só pode ser enviado para cotação disponível e não excluída'},{status:409})
    // Não permitir que um usuário escolha qualquer destinatário fora da cotação.
    const emailsPermitidos = [cotacao.solicitante_email].filter(Boolean).map((e:string)=>String(e).toLowerCase().trim())
    if (cotacao.usuario_id) {
      const {data:cliente} = await ctx.db.from('perfis').select('email').eq('id',cotacao.usuario_id).maybeSingle()
      if (cliente?.email) emailsPermitidos.push(String(cliente.email).toLowerCase().trim())
    }
    if (!emailsPermitidos.includes(destinatario)) return NextResponse.json({error:'Destinatário não vinculado à cotação'},{status:403})
    if (COPIAS.includes(destinatario)) return NextResponse.json({error:'Destinatário principal deve ser o cliente'},{status:400})
    const referencia = String(cotacao.referencia_hc || cotacao.referencia_cliente || cotacao.id)
    const assunto = `Acompanhamento de cotação – ${referencia} | HC Consultoria`
    const bucket = Math.floor(Date.now()/600000) // Janela única de 10 minutos por cotação.
    // Constraint UNIQUE impede envios simultâneos/duplicados, inclusive entre administradores.
    const {data:reserva,error:reservaErro} = await ctx.db.from('hc_cotacao_followups')
      .insert({cotacao_id:cotacaoId,janela:bucket,status:'PROCESSANDO',responsavel_id:ctx.user.id,modelo,destinatario,cc:COPIAS,assunto,pdf_anexado:anexarPdf})
      .select('id').single()
    if (reservaErro || !reserva) return NextResponse.json({error:'Já existe um follow-up recente ou o histórico não está configurado. Tente mais tarde.'},{status:409})
    try {
      const options:any = {
        from:FROM,to:[destinatario],cc:COPIAS,replyTo:'marcos@hcbhz.com',subject:assunto,
        html:`<div style="font-family:Arial,sans-serif;max-width:700px;color:#172033;line-height:1.65;white-space:normal">${esc(mensagem).replace(/\r?\n/g,'<br>')}<hr style="border:0;border-top:1px solid #ddd"><small>Referência: ${esc(referencia)}</small></div>`
      }
      if (anexarPdf) {
        const pdfUrl = String(cotacao.pdf_cotacao_url || '')
        const supaHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host
        let parsed:URL
        try { parsed = new URL(pdfUrl) } catch { throw new Error('PDF inválido; desmarque o anexo ou corrija a cotação') }
        const prefixo = '/storage/v1/object/public/cotacoes/'
        if (parsed.protocol !== 'https:' || parsed.host !== supaHost || !parsed.pathname.startsWith(prefixo)) throw new Error('PDF não está no armazenamento autorizado de cotações')
        const storagePath = decodeURIComponent(parsed.pathname.slice(prefixo.length))
        if (!storagePath || storagePath.includes('..')) throw new Error('Caminho inválido para PDF')
        const {data:arquivo,error:pdfErro} = await ctx.db.storage.from('cotacoes').download(storagePath)
        if (pdfErro || !arquivo) throw new Error('Não foi possível acessar o PDF da cotação')
        if (arquivo.size > 10*1024*1024) throw new Error('PDF acima de 10 MB')
        options.attachments = [{filename:`cotacao-${referencia.replace(/[^\w-]/g,'_')}.pdf`,content:Buffer.from(await arquivo.arrayBuffer())}]
      }
      const resend = new Resend(process.env.RESEND_API_KEY)
      const {data,error} = await resend.emails.send(options,{idempotencyKey:`hc-followup-${reserva.id}`})
      if (error || !data?.id) throw new Error(error?.message || 'Falha no serviço de e-mail')
      const {error:logErro} = await ctx.db.from('hc_cotacao_followups').update({status:'ENVIADO',enviado_em:new Date().toISOString(),resend_id:data.id}).eq('id',reserva.id)
      if (logErro) console.error('ALERTA: e-mail enviado mas registro não confirmado',reserva.id,logErro)
      return NextResponse.json({ok:true,id:reserva.id,registro_confirmado:!logErro})
    } catch(e:any) {
      await ctx.db.from('hc_cotacao_followups').update({status:'FALHOU',erro:String(e?.message || e).slice(0,300)}).eq('id',reserva.id)
      return NextResponse.json({error:e?.message || 'Falha no envio'},{status:502})
    }
  } catch(e) {console.error('Follow-up POST:',e);return NextResponse.json({error:'Falha interna ao enviar follow-up'},{status:500})}
}
