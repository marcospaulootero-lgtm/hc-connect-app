'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type AdminRealtimeAlertsProps = {
  onRefresh?: () => void | Promise<void>
}

type Alerta = {
  id: number
  titulo: string
  descricao: string
  tipo: 'success' | 'info' | 'warning'
}

type WebAudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext
  }

const TABELAS_REALTIME = [
  'cotacoes',
  'embarque_clientes',
  'suporte',
  'mensagens_suporte',
  'embarques',
  'faturas',
  'financeiro_embarques',
  'faturas_dhl',
  'faturas_fedex',
]

function getMensagemAlerta(table: string, eventType: string) {
  if (eventType === 'INSERT') {
    if (table === 'cotacoes') {
      return {
        titulo: 'Nova cotação recebida',
        descricao: 'Um cliente enviou uma nova solicitação pelo portal.',
        tocar: true,
      }
    }

    if (table === 'embarque_clientes') {
      return {
        titulo: 'Novo embarque enviado',
        descricao: 'Um cliente abriu um novo embarque direto pelo portal.',
        tocar: true,
      }
    }

    if (table === 'suporte') {
      return {
        titulo: 'Novo chamado de suporte',
        descricao: 'Um cliente abriu um novo atendimento no portal.',
        tocar: true,
      }
    }

    if (table === 'mensagens_suporte') {
      return {
        titulo: 'Nova mensagem no suporte',
        descricao: 'Chegou uma nova mensagem em uma conversa de suporte.',
        tocar: true,
      }
    }

    if (table === 'faturas') {
      return {
        titulo: 'Nova fatura registrada',
        descricao: 'Uma nova fatura foi adicionada ao sistema.',
        tocar: false,
      }
    }

    if (table === 'financeiro_embarques') {
      return {
        titulo: 'Novo registro financeiro',
        descricao: 'O financeiro recebeu uma nova movimentação de embarque.',
        tocar: false,
      }
    }
  }

  if (eventType === 'UPDATE') {
    if (table === 'embarques') {
      return {
        titulo: 'Embarque atualizado',
        descricao: 'As informações operacionais foram atualizadas.',
        tocar: false,
      }
    }

    if (table === 'faturas' || table === 'financeiro_embarques') {
      return {
        titulo: 'Financeiro atualizado',
        descricao: 'Os dados financeiros da dashboard foram atualizados.',
        tocar: false,
      }
    }
  }

  return {
    titulo: 'Dashboard atualizada',
    descricao: 'As informações foram sincronizadas em tempo real.',
    tocar: false,
  }
}

export default function AdminRealtimeAlerts({
  onRefresh,
}: AdminRealtimeAlertsProps) {
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [somAtivo, setSomAtivo] = useState(false)
  const [conectado, setConectado] = useState(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ultimoAlertaRef = useRef<string>('')

  function adicionarAlerta(
    titulo: string,
    descricao: string,
    tipo: Alerta['tipo'] = 'info'
  ) {
    const chave = `${titulo}-${descricao}`

    /**
     * Evita alerta duplicado quando várias alterações chegam juntas.
     */
    if (ultimoAlertaRef.current === chave) return

    ultimoAlertaRef.current = chave

    setTimeout(() => {
      ultimoAlertaRef.current = ''
    }, 1500)

    const id = Date.now() + Math.floor(Math.random() * 1000)

    setAlertas((atual) => [
      ...atual,
      {
        id,
        titulo,
        descricao,
        tipo,
      },
    ])

    setTimeout(() => {
      setAlertas((atual) => atual.filter((alerta) => alerta.id !== id))
    }, 5500)
  }

  function ativarSom() {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as WebAudioWindow).webkitAudioContext

      if (!AudioContextClass) {
        adicionarAlerta(
          'Som não disponível',
          'Este navegador não liberou o áudio de alerta.',
          'warning'
        )
        return
      }

      const audioContext = new AudioContextClass()
      audioContextRef.current = audioContext
      setSomAtivo(true)

      adicionarAlerta(
        'Som ativado',
        'Você receberá um toque quando chegar uma nova cotação, suporte ou embarque.',
        'success'
      )

      tocarSom(audioContext)
    } catch (error) {
      console.error('Erro ao ativar som:', error)

      adicionarAlerta(
        'Som bloqueado',
        'Clique novamente ou verifique as permissões de áudio do navegador.',
        'warning'
      )
    }
  }

  function tocarSom(contextoManual?: AudioContext | null) {
    if (!somAtivo && !contextoManual) return

    try {
      const audioContext = contextoManual || audioContextRef.current

      if (!audioContext) return

      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime)

      gainNode.gain.setValueAtTime(0.001, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(
        0.18,
        audioContext.currentTime + 0.03
      )
      gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.28
      )

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.3)
    } catch (error) {
      console.error('Erro ao tocar alerta:', error)
    }
  }

  function atualizarDashboardComDebounce() {
    if (!onRefresh) return

    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
    }

    refreshTimerRef.current = setTimeout(async () => {
      try {
        await onRefresh()
      } catch (error) {
        console.error('Erro ao atualizar dashboard em tempo real:', error)

        adicionarAlerta(
          'Erro ao atualizar',
          'A alteração chegou, mas a dashboard não conseguiu recarregar os dados.',
          'warning'
        )
      }
    }, 500)
  }

  useEffect(() => {
    const channel = supabase.channel('admin-dashboard-realtime')

    TABELAS_REALTIME.forEach((table) => {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
        },
        (payload) => {
          const eventType = payload.eventType
          const mensagem = getMensagemAlerta(table, eventType)

          atualizarDashboardComDebounce()

          /**
           * Mostra alerta para eventos importantes.
           * Eventos simples também atualizam a dashboard, mas sem ficar poluindo a tela.
           */
          if (
            eventType === 'INSERT' ||
            table === 'embarques' ||
            table === 'faturas' ||
            table === 'financeiro_embarques'
          ) {
            adicionarAlerta(
              mensagem.titulo,
              mensagem.descricao,
              mensagem.tocar ? 'success' : 'info'
            )
          }

          if (mensagem.tocar) {
            tocarSom()
          }
        }
      )
    })

    channel.subscribe((status) => {
      setConectado(status === 'SUBSCRIBED')
    })

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }

      supabase.removeChannel(channel)
    }
  }, [onRefresh, somAtivo])

  return (
    <>
      <div className="fixed right-5 top-5 z-[9999] flex w-[360px] max-w-[calc(100vw-40px)] flex-col gap-3">
        {alertas.map((alerta) => (
          <div
            key={alerta.id}
            className={[
              'animate-in slide-in-from-right-5 rounded-2xl border bg-white p-4 shadow-2xl duration-300',
              alerta.tipo === 'success'
                ? 'border-emerald-200'
                : alerta.tipo === 'warning'
                  ? 'border-amber-200'
                  : 'border-slate-200',
            ].join(' ')}
          >
            <div className="flex items-start gap-3">
              <div
                className={[
                  'mt-1 h-2.5 w-2.5 rounded-full',
                  alerta.tipo === 'success'
                    ? 'bg-emerald-500'
                    : alerta.tipo === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-blue-500',
                ].join(' ')}
              />

              <div>
                <p className="text-sm font-bold text-slate-900">
                  {alerta.titulo}
                </p>

                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {alerta.descricao}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-5 right-5 z-[9998] flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-xl">
        <span
          className={[
            'h-2.5 w-2.5 rounded-full',
            conectado ? 'bg-emerald-500' : 'bg-slate-300',
          ].join(' ')}
        />

        <span className="text-xs font-medium text-slate-600">
          {conectado ? 'Tempo real ativo' : 'Conectando tempo real'}
        </span>

        <button
          type="button"
          onClick={ativarSom}
          className={[
            'ml-2 rounded-xl px-3 py-1.5 text-xs font-bold transition',
            somAtivo
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-slate-900 text-white hover:bg-slate-700',
          ].join(' ')}
        >
          {somAtivo ? 'Som ativo' : 'Ativar som'}
        </button>
      </div>
    </>
  )
}