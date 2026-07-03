'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Props = {
  area: 'admin' | 'cliente'
}

export default function OnlinePresence({ area }: Props) {
  const pathname = usePathname()

  useEffect(() => {
    let ativo = true
    let historicoRegistrado = false

    async function atualizarPresenca() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user || !ativo) return

        const { data: perfil } = await supabase
          .from('perfis')
          .select('id, nome, email, tipo_acesso, tipo_usuario, ativo')
          .eq('id', user.id)
          .maybeSingle()

        if (perfil?.ativo === false) return

        const nome = perfil?.nome || user.email || 'Usuário'
        const email = perfil?.email || user.email || ''
        const tipoAcesso = perfil?.tipo_acesso || perfil?.tipo_usuario || area
        const paginaAtual = pathname || '/'

        await supabase.from('usuarios_online').upsert(
          {
            user_id: user.id,
            nome,
            email,
            tipo_acesso: tipoAcesso,
            area,
            pagina_atual: paginaAtual,
            ultima_atividade: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )

        if (!historicoRegistrado) {
          historicoRegistrado = true

          await supabase.from('presenca_historico').insert({
            usuario_id: user.id,
            nome,
            email,
            tipo_acesso: tipoAcesso,
            area,
            pagina: paginaAtual,
            acao: 'ENTROU',
            status: 'ATIVO',
            metadata: {
              user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
              origem: 'OnlinePresence',
            },
          })
        }
      } catch (error) {
        console.error('Erro ao atualizar presença online:', error)
      }
    }

    atualizarPresenca()

    const intervalo = setInterval(() => {
      atualizarPresenca()
    }, 20000)

    const aoVoltarParaAba = () => {
      if (document.visibilityState === 'visible') {
        atualizarPresenca()
      }
    }

    document.addEventListener('visibilitychange', aoVoltarParaAba)

    return () => {
      ativo = false
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', aoVoltarParaAba)
    }
  }, [pathname, area])

  return null
}
