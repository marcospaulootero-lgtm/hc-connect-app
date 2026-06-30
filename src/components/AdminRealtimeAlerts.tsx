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
  'financeiro_embarques',
  'financeiro_movimentacoes',
  'faturas_transportadoras',
  'logs_rastreio',
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

    if (table === 'financeiro_embarques') {
      return {
        titulo: 'Novo registro financeiro',
        descricao: 'O financeiro recebeu uma nova informação.',
        tocar: false,
      }
    }

    if (table === 'faturas_transportadoras') {
      return {
        titulo: 'Nova fatura DHL/FedEx',
        descricao: 'Uma nova fatura de transportadora foi registrada.',
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

    if (
      table === 'financeiro_embarques' ||
      table === 'financeiro_movimentacoes'
    ) {
      return {
        titulo: 'Financeiro atualizado',
        descricao: 'Os dados financeiros da dashboard foram atualizados.',
        tocar: false,
      }
    }

    if (table === 'faturas_transportadoras') {
      return {
        titulo: 'Fatura atualizada',
        descricao: 'Uma fatura DHL/FedEx foi atualizada.',
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
  const somAtivoRef = useRef(false)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ultimoAlertaRef = useRef<string>('')

  function adicionarAlerta(
    titulo: string,
    descricao: string,
    tipo: Alerta['tipo'] = 'info'
  ) {
    const chave = `${titulo}-${descricao}`

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

  async function obterAudioContext() {
    const AudioContextClass =
      window.AudioContext || (window as WebAudioWindow).webkitAudioContext

    if (!AudioContextClass) return null

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass()
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume()
    }

    return audioContextRef.current
  }

  async function ativarSom() {
    try {
      const audioContext = await obterAudioContext()

      if (!audioContext) {
        adicionarAlerta(
          'Som não disponível',
          'Este navegador não liberou o áudio de alerta.',
          'warning'
        )
        return
      }

      somAtivoRef.current = true
      setSomAtivo(true)

      localStorage.setItem('hc-admin-som-alerta', 'ativo')

      adicionarAlerta(
        'Som ativado',
        'Você receberá um toque quando chegar uma nova cotação, suporte ou embarque.',
        'success'
      )

      await tocarSom(true)
    } catch (error) {
      console.error('Erro ao ativar som:', error)

      adicionarAlerta(
        'Som bloqueado',
        'Clique novamente ou verifique as permissões de áudio do navegador.',
        'warning'
      )
    }
  }

  async function tocarSom(forcar = false) {
    if (!somAtivoRef.current && !forcar) return

    try {
      const audioContext = await obterAudioContext()
      if (!audioContext) return

      const tocarBeep = (inicio: number, frequencia: number) => {
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequencia, inicio)

        gainNode.gain.setValueAtTime(0.001, inicio)
        gainNode.gain.exponentialRampToValueAtTime(0.35, inicio + 0.03)
        gainNode.gain.exponentialRampToValueAtTime(0.001, inicio + 0.22)

        oscillator.start(inicio)
        oscillator.stop(inicio + 0.24)
      }

      const agora = audioContext.currentTime

      tocarBeep(agora, 880)
      tocarBeep(agora + 0.28, 1175)
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
    const somSalvo = localStorage.getItem('hc-admin-som-alerta')

    if (somSalvo === 'ativo') {
      somAtivoRef.current = true
      setSomAtivo(true)
    }
  }, [])

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
        async (payload) => {
          const eventType = payload.eventType
          const mensagem = getMensagemAlerta(table, eventType)

          atualizarDashboardComDebounce()

          if (
            eventType === 'INSERT' ||
            table === 'embarques' ||
            table === 'financeiro_embarques' ||
            table === 'financeiro_movimentacoes' ||
            table === 'faturas_transportadoras' ||
            table === 'logs_rastreio'
          ) {
            adicionarAlerta(
              mensagem.titulo,
              mensagem.descricao,
              mensagem.tocar ? 'success' : 'info'
            )
          }

          if (mensagem.tocar) {
            await tocarSom()
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
  }, [onRefresh])

  return (
    <>
      <div className="fixed right-5 top-5 z-[9999] flex w-[360px] max-w-[calc(100vw-40px)] flex-col gap-3">
        {alertas.map((alerta) => (
          <div
            key={alerta.id}
            className={[
              'rounded-2xl border bg-white p-4 shadow-2xl',
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
              ? 'bg-blue-600 text-white hover:bg-blue-500'
              : 'bg-slate-900 text-white hover:bg-slate-700',
          ].join(' ')}
        >
          {somAtivo ? 'Som ativo' : 'Ativar som'}
        </button>
      </div>
    </>
  )
}