'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

const etapas = [
  {
    numero: '01',
    titulo: 'Conte o que precisa',
    texto:
      'Informe origem, destino, peso, volumes, mercadoria e o tipo de operação que sua empresa precisa realizar.',
  },
  {
    numero: '02',
    titulo: 'A HC analisa a operação',
    texto:
      'Nossa equipe avalia transportadora, modalidade, documentação, custos e os melhores caminhos para o embarque.',
  },
  {
    numero: '03',
    titulo: 'Acompanhamos o processo',
    texto:
      'Você acompanha coleta, trânsito, fiscalização, liberação, entrega e todas as atualizações importantes.',
  },
  {
    numero: '04',
    titulo: 'Tudo fica organizado',
    texto:
      'Cotações, documentos, faturas, recibos, comprovantes e suporte ficam centralizados no HC Connect.',
  },
]

const servicos = [
  {
    icone: '✈',
    titulo: 'Importação Courier',
    texto: 'Operações internacionais rápidas com acompanhamento da HC.',
  },
  {
    icone: '🌎',
    titulo: 'Exportação Courier',
    texto: 'Coleta, envio, acompanhamento e suporte para suas exportações.',
  },
  {
    icone: '📦',
    titulo: 'Importação Formal',
    texto: 'Organização operacional e acompanhamento de processos formais.',
  },
  {
    icone: '🚢',
    titulo: 'Exportação Formal',
    texto: 'Suporte para operações aéreas, marítimas e rodoviárias.',
  },
  {
    icone: '📄',
    titulo: 'DUE / Export Declaration',
    texto: 'Emissão e acompanhamento da documentação necessária à exportação.',
  },
  {
    icone: '🛰',
    titulo: 'Acompanhamento',
    texto: 'Visibilidade da operação desde a coleta até a entrega.',
  },
  {
    icone: '🔎',
    titulo: 'Conferência de cobranças',
    texto: 'Análise de faturas, pesos, taxas e divergências das transportadoras.',
  },
  {
    icone: '🎧',
    titulo: 'Suporte operacional',
    texto: 'Contato direto com a equipe HC durante toda a operação.',
  },
]

const recursosPortal = [
  'Acompanhamento dos embarques',
  'Solicitação e aprovação de cotações',
  'Documentos organizados por processo',
  'Faturas, boletos e recibos',
  'Envio de comprovantes de pagamento',
  'Suporte direto com a equipe HC',
  'Histórico completo das operações',
  'Responsável HC identificado em cada processo',
]

export default function HomePage() {
  const router = useRouter()
  const [verificando, setVerificando] = useState(true)

  useEffect(() => {
    let ativo = true

    async function verificarSessao() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!ativo) return

        if (!user?.id) {
          setVerificando(false)
          return
        }

        const { data: perfil, error } = await supabase
          .from('perfis')
          .select('tipo_acesso, ativo')
          .eq('id', user.id)
          .maybeSingle()

        if (!ativo) return

        if (error || !perfil || perfil.ativo === false) {
          await supabase.auth.signOut()

          if (ativo) {
            setVerificando(false)
          }

          return
        }

        const tipo = String(perfil.tipo_acesso || '').toLowerCase()

        if (tipo === 'admin') {
          router.replace('/admin')
          return
        }

        router.replace('/cliente')
      } catch (error) {
        console.error('Erro ao verificar sessão na página inicial:', error)

        if (ativo) {
          setVerificando(false)
        }
      }
    }

    verificarSessao()

    return () => {
      ativo = false
    }
  }, [router])

  if (verificando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020817] px-6 text-white">
        <div className="rounded-3xl border border-blue-900 bg-[#071225] p-8 text-center shadow-2xl">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-blue-400">
            HC Connect
          </p>

          <h1 className="mt-3 text-2xl font-black">
            Preparando sua experiência...
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Verificando se já existe uma sessão ativa.
          </p>
        </div>
      </div>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020817] text-white">
      <div className="pointer-events-none absolute left-[-180px] top-[-120px] h-[500px] w-[500px] rounded-full bg-blue-600/20 blur-[130px]" />
      <div className="pointer-events-none absolute right-[-180px] top-[150px] h-[480px] w-[480px] rounded-full bg-cyan-500/10 blur-[130px]" />

      <header className="relative z-20 border-b border-white/10 bg-[#020817]/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="rounded-xl bg-white p-2 shadow-lg">
              <img
                src="/HC-CONSULTORIA-TRANSPARENTE.png"
                alt="HC Consultoria"
                className="h-10 w-auto object-contain"
              />
            </div>

            <div className="hidden sm:block">
              <p className="text-lg font-black leading-none">HC Connect</p>
              <p className="mt-1 text-xs font-bold text-slate-400">
                Portal de comércio exterior
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-bold text-slate-300 lg:flex">
            <a href="#como-funciona" className="transition hover:text-white">
              Como funciona
            </a>

            <a href="#servicos" className="transition hover:text-white">
              Serviços
            </a>

            <a href="#portal" className="transition hover:text-white">
              HC Connect
            </a>

            <a href="#contato" className="transition hover:text-white">
              Contato
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-xl border border-blue-700 bg-blue-600/10 px-4 py-3 text-sm font-black text-blue-100 transition hover:bg-blue-600 hover:text-white"
            >
              Acessar conta
            </Link>

            <Link
              href="/cadastro"
              className="hidden rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-blue-100 sm:inline-flex"
            >
              Criar conta
            </Link>
          </div>
        </div>
      </header>

      <section className="relative z-10">
        <div className="mx-auto grid min-h-[720px] w-full max-w-7xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-700/70 bg-blue-600/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
              <span className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_12px_rgba(74,222,128,0.9)]" />
              Operações internacionais acompanhadas
            </div>

            <h1 className="mt-7 max-w-4xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-7xl">
              Sua operação de comércio exterior em um só lugar.
            </h1>

            <p className="mt-7 max-w-3xl text-lg font-medium leading-8 text-slate-300 lg:text-xl">
              A HC Consultoria auxilia empresas em importações e exportações,
              desde a cotação e coleta até o acompanhamento, faturamento e
              suporte operacional.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-7 py-4 text-base font-black text-white shadow-[0_15px_50px_rgba(37,99,235,0.35)] transition hover:-translate-y-0.5 hover:bg-blue-500"
              >
                Já sou cliente — Entrar
              </Link>

              <a
                href="#contato"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-600 bg-white/5 px-7 py-4 text-base font-black text-white transition hover:border-cyan-400 hover:bg-white/10"
              >
                Quero conhecer a HC
              </a>
            </div>

            <div className="mt-10 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
              <MiniDestaque
                titulo="Atendimento próximo"
                texto="Contato direto com a equipe HC"
              />

              <MiniDestaque
                titulo="Informação centralizada"
                texto="Processos e documentos organizados"
              />

              <MiniDestaque
                titulo="Visibilidade"
                texto="Acompanhamento da operação"
              />
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-[40px] bg-blue-600/20 blur-3xl" />

            <div className="relative overflow-hidden rounded-[34px] border border-blue-700/50 bg-[#071225]/95 p-5 shadow-2xl sm:p-7">
              <div className="mb-5 flex items-center justify-between border-b border-blue-900 pb-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                    HC Connect
                  </p>

                  <h2 className="mt-1 text-2xl font-black">
                    Sua operação organizada
                  </h2>
                </div>

                <div className="flex gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-red-400" />
                  <span className="h-3 w-3 rounded-full bg-yellow-400" />
                  <span className="h-3 w-3 rounded-full bg-green-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <PainelDemo
                  titulo="Embarques"
                  valor="Acompanhamento"
                  detalhe="Status e previsão"
                  classe="border-blue-700 bg-blue-600/10"
                />

                <PainelDemo
                  titulo="Cotações"
                  valor="Solicite online"
                  detalhe="Aprovação no portal"
                  classe="border-purple-700 bg-purple-600/10"
                />

                <PainelDemo
                  titulo="Documentos"
                  valor="Tudo reunido"
                  detalhe="Por processo e AWB"
                  classe="border-cyan-700 bg-cyan-600/10"
                />

                <PainelDemo
                  titulo="Financeiro"
                  valor="Faturas e recibos"
                  detalhe="Pagamento organizado"
                  classe="border-green-700 bg-green-600/10"
                />
              </div>

              <div className="mt-4 rounded-2xl border border-blue-900 bg-[#020817] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                      Processo acompanhado
                    </p>

                    <p className="mt-1 font-black">
                      Origem → Em trânsito → Fiscalização → Entrega
                    </p>
                  </div>

                  <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-black text-green-300">
                    Atualizado
                  </span>
                </div>

                <div className="mt-5 flex items-center gap-2">
                  {[0, 1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className={`h-2 flex-1 rounded-full ${
                        item < 3 ? 'bg-blue-500' : 'bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="como-funciona"
        className="relative z-10 border-y border-white/10 bg-[#061022]"
      >
        <div className="mx-auto w-full max-w-7xl px-5 py-20 lg:px-8">
          <CabecalhoSecao
            etiqueta="Como funciona"
            titulo="Da solicitação à entrega, você acompanha cada etapa."
            texto="A HC organiza as informações da operação e mantém sua empresa atualizada durante todo o processo."
          />

          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {etapas.map((etapa) => (
              <article
                key={etapa.numero}
                className="rounded-3xl border border-blue-900 bg-[#020817] p-6 transition hover:-translate-y-1 hover:border-blue-500"
              >
                <span className="text-4xl font-black text-blue-500/50">
                  {etapa.numero}
                </span>

                <h3 className="mt-6 text-xl font-black">{etapa.titulo}</h3>

                <p className="mt-3 text-sm font-medium leading-6 text-slate-400">
                  {etapa.texto}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="servicos" className="relative z-10">
        <div className="mx-auto w-full max-w-7xl px-5 py-20 lg:px-8">
          <CabecalhoSecao
            etiqueta="Soluções HC"
            titulo="Suporte para diferentes tipos de operação."
            texto="Atendimento operacional e acompanhamento para empresas que importam e exportam."
          />

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {servicos.map((servico) => (
              <article
                key={servico.titulo}
                className="group rounded-3xl border border-slate-800 bg-[#071225] p-6 transition hover:border-blue-500 hover:bg-[#0a1933]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/15 text-2xl transition group-hover:bg-blue-600/25">
                  {servico.icone}
                </div>

                <h3 className="mt-5 text-lg font-black">{servico.titulo}</h3>

                <p className="mt-3 text-sm font-medium leading-6 text-slate-400">
                  {servico.texto}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="portal"
        className="relative z-10 border-y border-white/10 bg-[#061022]"
      >
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-20 lg:grid-cols-2 lg:items-center lg:px-8">
          <div>
            <CabecalhoSecao
              etiqueta="Portal HC Connect"
              titulo="Mais organização para quem já trabalha com a HC."
              texto="O portal reúne os principais dados da operação e facilita a comunicação entre sua empresa e nossa equipe."
              alinhamento="left"
            />

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {recursosPortal.map((recurso) => (
                <div
                  key={recurso}
                  className="flex items-start gap-3 rounded-2xl border border-blue-900/70 bg-[#020817] p-4"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-xs font-black text-green-300">
                    ✓
                  </span>

                  <span className="text-sm font-bold text-slate-300">
                    {recurso}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-blue-800 bg-[#020817] p-6 shadow-2xl sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
              Acesso do cliente
            </p>

            <h3 className="mt-3 text-3xl font-black">
              Já possui cadastro no HC Connect?
            </h3>

            <p className="mt-4 leading-7 text-slate-400">
              Entre com seu e-mail e senha para consultar embarques, cotações,
              documentos, faturas e falar com a equipe HC.
            </p>

            <div className="mt-7 space-y-3">
              <Link
                href="/login"
                className="flex w-full items-center justify-center rounded-2xl bg-blue-600 px-6 py-4 font-black text-white transition hover:bg-blue-500"
              >
                Acessar minha conta
              </Link>

              <Link
                href="/cadastro"
                className="flex w-full items-center justify-center rounded-2xl border border-blue-700 bg-blue-600/10 px-6 py-4 font-black text-blue-100 transition hover:bg-blue-600/20"
              >
                Criar minha conta
              </Link>

              <p className="pt-2 text-center text-xs font-medium text-slate-500">
                As áreas administrativa e de clientes continuam protegidas por
                autenticação.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="contato" className="relative z-10">
        <div className="mx-auto w-full max-w-7xl px-5 py-20 lg:px-8">
          <div className="overflow-hidden rounded-[36px] border border-blue-700 bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-600 p-8 shadow-[0_25px_80px_rgba(37,99,235,0.3)] sm:p-12 lg:p-16">
            <div className="max-w-4xl">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-100">
                Ainda não trabalha com a HC?
              </p>

              <h2 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">
                Conte um pouco sobre sua operação.
              </h2>

              <p className="mt-5 max-w-3xl text-lg font-medium leading-8 text-blue-50">
                Nossa equipe entrará em contato para entender sua necessidade e
                apresentar a melhor forma de atendimento para sua empresa.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="mailto:marcos@hcbhz.com?subject=Quero%20conhecer%20a%20HC%20Consultoria"
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-7 py-4 font-black text-blue-700 transition hover:bg-blue-50"
                >
                  Solicitar atendimento
                </a>

                <a
                  href="https://www.instagram.com/hcconsult"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/40 bg-white/10 px-7 py-4 font-black text-white transition hover:bg-white/20"
                >
                  Conhecer o Instagram
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 bg-[#01050d]">
        <div className="mx-auto flex w-full max-w-7xl flex-col justify-between gap-5 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:items-center lg:px-8">
          <div>
            <p className="font-black text-white">HC Consultoria</p>
            <p className="mt-1">
              Couto e Otero Intermediação LTDA • CNPJ 41.456.630/0001-52
            </p>
          </div>

          <div className="flex flex-wrap gap-5 font-bold">
            <Link href="/login" className="transition hover:text-white">
              Acessar portal
            </Link>

            <Link href="/cadastro" className="transition hover:text-white">
              Criar conta
            </Link>

            <a
              href="https://hcbhz.com"
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-white"
            >
              Site HC
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}

function MiniDestaque({
  titulo,
  texto,
}: {
  titulo: string
  texto: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-black text-white">{titulo}</p>
      <p className="mt-1 text-xs font-medium leading-5 text-slate-400">
        {texto}
      </p>
    </div>
  )
}

function PainelDemo({
  titulo,
  valor,
  detalhe,
  classe,
}: {
  titulo: string
  valor: string
  detalhe: string
  classe: string
}) {
  return (
    <div className={`rounded-2xl border p-4 ${classe}`}>
      <p className="text-xs font-black uppercase tracking-wider text-slate-400">
        {titulo}
      </p>
      <p className="mt-2 font-black text-white">{valor}</p>
      <p className="mt-1 text-xs font-medium text-slate-400">{detalhe}</p>
    </div>
  )
}

function CabecalhoSecao({
  etiqueta,
  titulo,
  texto,
  alinhamento = 'center',
}: {
  etiqueta: string
  titulo: string
  texto: string
  alinhamento?: 'left' | 'center'
}) {
  return (
    <div
      className={
        alinhamento === 'center'
          ? 'mx-auto max-w-4xl text-center'
          : 'max-w-3xl text-left'
      }
    >
      <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
        {etiqueta}
      </p>

      <h2 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">
        {titulo}
      </h2>

      <p className="mt-5 text-base font-medium leading-7 text-slate-400 sm:text-lg">
        {texto}
      </p>
    </div>
  )
}
