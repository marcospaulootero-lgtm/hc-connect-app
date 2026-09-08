'use client'

import {
  useEffect,
  useRef,
  useState,
} from 'react'

import { supabase } from '@/lib/supabaseClient'

type Mensagem = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const SUGESTOES = [
  'Analise o portal e diga o que precisa da minha atenção hoje.',
  'Quais processos estão vencidos e qual o valor total?',
  'Quais processos estão aguardando custo?',
  'Analise as faturas DHL/FedEx pagas com pendência deste ano.',
]

function novoId() {
  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .slice(2)
  )
}

export default function IaHcPage() {
  const [mensagens, setMensagens] =
    useState<Mensagem[]>([
      {
        id: novoId(),
        role: 'assistant',
        content:
          'Olá. Sou a IA HC.\n\nNesta primeira versão estou em modo somente leitura. Posso analisar Financeiro, AWBs, embarques e faturas DHL/FedEx sem alterar nenhum dado.\n\nO rastreamento está protegido: eu apenas leio o status já gravado no HC Connect.',
      },
    ])

  const [texto, setTexto] =
    useState('')

  const [enviando, setEnviando] =
    useState(false)

  const fimRef =
    useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    fimRef.current?.scrollIntoView({
      behavior: 'smooth',
    })
  }, [mensagens, enviando])

  async function enviar(
    textoDireto?: string
  ) {
    const pergunta =
      String(
        textoDireto ?? texto
      ).trim()

    if (!pergunta || enviando) {
      return
    }

    const mensagemUsuario: Mensagem = {
      id: novoId(),
      role: 'user',
      content: pergunta,
    }

    const historico = [
      ...mensagens,
      mensagemUsuario,
    ]

    setMensagens(historico)
    setTexto('')
    setEnviando(true)

    try {
      const {
        data: { session },
      } =
        await supabase.auth.getSession()

      const token =
        session?.access_token

      if (!token) {
        throw new Error(
          'Sessão administrativa expirada. Entre novamente.'
        )
      }

      const resposta = await fetch(
        '/api/ia-hc/chat',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            Authorization:
              `Bearer ${token}`,
          },

          body: JSON.stringify({
            mensagens:
              historico
                .slice(-16)
                .map((item) => ({
                  role: item.role,
                  content:
                    item.content,
                })),
          }),
        }
      )

      const retorno =
        await resposta
          .json()
          .catch(() => null)

      if (!resposta.ok) {
        throw new Error(
          retorno?.error ||
          'Erro ao consultar a IA HC.'
        )
      }

      setMensagens(
        (atual) => [
          ...atual,
          {
            id: novoId(),
            role: 'assistant',
            content:
              retorno?.resposta ||
              'Não recebi uma resposta válida.',
          },
        ]
      )
    } catch (error: any) {
      setMensagens(
        (atual) => [
          ...atual,
          {
            id: novoId(),
            role: 'assistant',
            content:
              `⚠️ ${error?.message || 'Erro ao consultar a IA HC.'}`,
          },
        ]
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl pb-10">
      <section className="mb-6 overflow-hidden rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-500/15 via-[#071225] to-[#020817] p-6 shadow-2xl">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-300">
              Inteligência HC
            </p>

            <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
              ✨ IA HC
            </h1>

            <p className="mt-3 max-w-3xl text-sm font-semibold leading-relaxed text-slate-400 sm:text-base">
              Assistente interno para analisar operação,
              Financeiro, AWBs e faturas DHL/FedEx usando
              os dados atuais do HC Connect.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-300">
              🔒 Somente leitura
            </span>

            <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-black text-blue-300">
              🛡️ Rastreamento protegido
            </span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-3xl border border-blue-950 bg-[#071225] p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Atalhos
            </p>

            <div className="mt-4 space-y-3">
              {SUGESTOES.map(
                (sugestao, index) => (
                  <button
                    key={sugestao}
                    type="button"
                    disabled={enviando}
                    onClick={() =>
                      enviar(sugestao)
                    }
                    className="w-full rounded-2xl border border-blue-900 bg-[#020817] px-4 py-3 text-left text-sm font-bold text-slate-200 transition hover:border-violet-500 hover:bg-violet-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="mr-2">
                      {index === 0
                        ? '✨'
                        : index === 1
                          ? '⏰'
                          : index === 2
                            ? '⚠️'
                            : '🚛'}
                    </span>

                    {sugestao}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-5">
            <p className="font-black text-amber-300">
              V1A protegida
            </p>

            <p className="mt-2 text-xs font-semibold leading-relaxed text-amber-100/60">
              A IA não pode alterar valores, marcar pagamentos,
              excluir registros, vincular AWBs ou atualizar
              rastreamentos nesta versão.
            </p>
          </div>

          <div className="rounded-3xl border border-blue-950 bg-[#071225] p-5">
            <p className="font-black text-white">
              O que já posso perguntar?
            </p>

            <div className="mt-3 space-y-2 text-xs font-semibold leading-relaxed text-slate-400">
              <p>• “Consulte o AWB 123...”</p>
              <p>• “Analise a fatura 02418143.”</p>
              <p>• “Quanto temos vencido?”</p>
              <p>• “Quem está aguardando custo?”</p>
              <p>• “Por que esta fatura não conciliou?”</p>
            </div>
          </div>
        </aside>

        <div className="flex min-h-[680px] flex-col overflow-hidden rounded-3xl border border-blue-950 bg-[#050d1f] shadow-2xl">
          <div className="border-b border-blue-950 bg-[#071225] px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-black text-white">
                  Conversa com a IA HC
                </p>

                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Os dados são consultados somente quando a pergunta exigir.
                </p>
              </div>

              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-black text-emerald-300">
                LEITURA
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
            {mensagens.map(
              (mensagem) => {
                const usuario =
                  mensagem.role ===
                  'user'

                return (
                  <div
                    key={mensagem.id}
                    className={
                      usuario
                        ? 'flex justify-end'
                        : 'flex justify-start'
                    }
                  >
                    <div
                      className={
                        usuario
                          ? 'max-w-[88%] rounded-3xl rounded-br-lg bg-blue-600 px-5 py-4 text-sm font-semibold leading-relaxed text-white shadow-lg sm:max-w-[75%]'
                          : 'max-w-[94%] rounded-3xl rounded-bl-lg border border-blue-950 bg-[#071225] px-5 py-4 text-sm font-semibold leading-relaxed text-slate-200 shadow-lg sm:max-w-[85%]'
                      }
                    >
                      {!usuario && (
                        <p className="mb-2 text-xs font-black uppercase tracking-wider text-violet-300">
                          ✨ IA HC
                        </p>
                      )}

                      <div className="whitespace-pre-wrap">
                        {mensagem.content}
                      </div>
                    </div>
                  </div>
                )
              }
            )}

            {enviando && (
              <div className="flex justify-start">
                <div className="rounded-3xl rounded-bl-lg border border-violet-500/20 bg-violet-500/10 px-5 py-4">
                  <p className="text-sm font-black text-violet-300">
                    ✨ Analisando o HC Connect...
                  </p>

                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Consultando somente os dados necessários.
                  </p>
                </div>
              </div>
            )}

            <div ref={fimRef} />
          </div>

          <div className="border-t border-blue-950 bg-[#071225] p-4 sm:p-5">
            <div className="flex items-end gap-3">
              <textarea
                value={texto}
                disabled={enviando}
                rows={2}
                placeholder="Ex.: Por que esta fatura DHL aparece com pendência?"
                onChange={(event) =>
                  setTexto(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key ===
                      'Enter' &&
                    !event.shiftKey
                  ) {
                    event.preventDefault()
                    enviar()
                  }
                }}
                className="min-h-[58px] flex-1 resize-none rounded-2xl border border-blue-900 bg-[#020817] px-4 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-violet-500 disabled:opacity-50"
              />

              <button
                type="button"
                disabled={
                  enviando ||
                  !texto.trim()
                }
                onClick={() => enviar()}
                className="h-[58px] rounded-2xl bg-violet-600 px-6 font-black text-white shadow-lg transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {enviando
                  ? '...'
                  : 'Enviar'}
              </button>
            </div>

            <p className="mt-3 text-[11px] font-semibold text-slate-600">
              Shift + Enter para nova linha • Enter para enviar
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
