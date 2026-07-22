'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

function texto(valor: any) {
  return String(valor || '').trim()
}

function areaPeloPath(pathname: string) {
  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/cliente')) return 'cliente'
  return 'portal'
}

function tipoPeloPerfilOuArea(perfil: any, area: string) {
  const tipo = texto(perfil?.tipo_acesso || perfil?.tipo_usuario || perfil?.tipo || area).toLowerCase()

  if (tipo.includes('admin')) return 'admin'
  if (tipo.includes('cliente')) return 'cliente'

  if (area === 'admin') return 'admin'
  if (area === 'cliente') return 'cliente'

  return tipo || 'cliente'
}

function nomePerfil(perfil: any, user: any) {
  return (
    texto(perfil?.nome) ||
    texto(perfil?.nome_empresa) ||
    texto(perfil?.razao_social) ||
    texto(perfil?.empresa) ||
    texto(user?.user_metadata?.nome) ||
    texto(user?.email) ||
    'Usuário'
  )
}

async function buscarPerfil(userId: string) {
  try {
    const { data } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (data) return data
  } catch (error) {
    console.warn('Presença: não conseguiu buscar perfil por id:', error)
  }

  try {
    const { data } = await supabase
      .from('perfis')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (data) return data
  } catch (error) {
    console.warn('Presença: não conseguiu buscar perfil por user_id:', error)
  }

  return null
}

async function salvarOnline(payload: any) {
  const { error: erroUpsert } = await supabase
    .from('usuarios_online')
    .upsert(payload, { onConflict: 'user_id' })

  if (!erroUpsert) return

  console.warn('Presença: upsert falhou, tentando atualizar/inserir:', erroUpsert.message)

  const { data: existente } = await supabase
    .from('usuarios_online')
    .select('user_id')
    .eq('user_id', payload.user_id)
    .maybeSingle()

  if (existente) {
    const { error } = await supabase
      .from('usuarios_online')
      .update(payload)
      .eq('user_id', payload.user_id)

    if (error) console.error('Presença: erro ao atualizar online:', error.message)

    return
  }

  const { error } = await supabase
    .from('usuarios_online')
    .insert(payload)

  if (error) console.error('Presença: erro ao inserir online:', error.message)
}

async function salvarHistorico(payload: any) {
  const { error } = await supabase.from('presenca_historico').insert(payload)

  if (error) {
    console.error('Presença: erro ao salvar histórico:', error.message)
  }
}

export default function OnlinePresence({ area: areaForcada }: { area?: string } = {}) {
  const pathname = usePathname() || ''

  useEffect(() => {
    let ativo = true

    async function atualizarPresenca(acao: 'ENTRADA' | 'ATIVIDADE' | 'TROCA_PAGINA' = 'ATIVIDADE') {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!ativo || !user) return

        const perfil = await buscarPerfil(user.id)
        const area = areaForcada || areaPeloPath(pathname || window.location.pathname || '')
        const tipoAcesso = tipoPeloPerfilOuArea(perfil, area)
        const agora = new Date().toISOString()
        const paginaAtual = pathname || window.location.pathname || '/'
        const email = texto(perfil?.email || user.email)
        const nome = nomePerfil(perfil, user)

        const payloadOnline = {
          user_id: user.id,
          nome,
          email,
          tipo_acesso: tipoAcesso,
          area,
          pagina_atual: paginaAtual,
          ultima_atividade: agora,
        }

        await salvarOnline(payloadOnline)

        const chaveSessao = `hc_presenca_${user.id}_${area}_${paginaAtual}`

        if (!sessionStorage.getItem(chaveSessao)) {
          sessionStorage.setItem(chaveSessao, agora)

          await salvarHistorico({
            usuario_id: user.id,
            nome,
            email,
            tipo_acesso: tipoAcesso,
            area,
            pagina: paginaAtual,
            acao,
            status: 'ONLINE',
            criado_em: agora,
          })
        }
      } catch (error) {
        console.error('Erro ao atualizar presença online:', error)
      }
    }

    atualizarPresenca('ENTRADA')

    const intervalo = window.setInterval(() => {
      atualizarPresenca('ATIVIDADE')
    }, 30000)

    const aoFocar = () => atualizarPresenca('ATIVIDADE')

    const aoVoltarParaTela = () => {
      if (!document.hidden) atualizarPresenca('ATIVIDADE')
    }

    window.addEventListener('focus', aoFocar)
    document.addEventListener('visibilitychange', aoVoltarParaTela)

    return () => {
      ativo = false
      window.clearInterval(intervalo)
      window.removeEventListener('focus', aoFocar)
      document.removeEventListener('visibilitychange', aoVoltarParaTela)
    }
  }, [pathname, areaForcada])

  return null
}
