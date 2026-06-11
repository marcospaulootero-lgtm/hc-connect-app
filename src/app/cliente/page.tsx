'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import StatusBadge from '@/components/StatusBadge'

export default function ClientePage() {
  const [usuario, setUsuario] = useState<any>(null)
  const [embarques, setEmbarques] = useState<any[]>([])
  const [cotacoes, setCotacoes] = useState<any[]>([])
  const [faturas, setFaturas] = useState<any[]>([])
  const [documentosPorEmbarque, setDocumentosPorEmbarque] = useState<any>({})
  const [busca, setBusca] = useState('')

  useEffect(() => {
    carregarUsuario()
  }, [])

  async function carregarUsuario() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/login'
      return
    }

    const { data: perfil, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error || !perfil || perfil.ativo === false) {
      await supabase.auth.signOut()
      window.location.href = '/login'
      return
    }

    if (perfil.tipo_acesso === 'admin') {
      window.location.href = '/admin'
      return
    }

    setUsuario({
      id: user.id,
      nome: perfil?.nome || user.email,
      email: user.email,
      tipo: perfil?.tipo_acesso || 'CLIENTE',
    })

    carregarEmbarques(user.id)
    carregarCotacoes(user.id)
    carregarFaturas(user.id)
  }

  async function carregarEmbarques(usuarioId: string) {
    const { data, error } = await supabase
      .from('embarques')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('criado_em', { ascending: false })

    if (error) {
      console.log(error)
      return
    }

    setEmbarques(data || [])

    const ids = (data || []).map((e) => e.id)

    if (ids.length > 0) {
      const { data: docs } = await supabase
        .from('documentos_embarques')
        .select('*')
        .in('embarque_id', ids)

      const agrupado: any = {}

      docs?.forEach((doc) => {
        if (!agrupado[doc.embarque_id]) agrupado[doc.embarque_id] = []
        agrupado[doc.embarque_id].push(doc)
      })

      setDocumentosPorEmbarque(agrupado)
    }
  }

  async function carregarCotacoes(usuarioId: string) {
    const { data } = await supabase
      .from('cotacoes')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('criado_em', { ascending: false })

    setCotacoes(data || [])
  }

  async function carregarFaturas(usuarioId: string) {
    const { data } = await supabase
      .from('faturas')
      .select('*')
      .eq('usuario_id', usuarioId)
      .eq('visivel_cliente', true)
      .order('criado_em', { ascending: false })

    setFaturas(data || [])
  }

  async function sair() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function linkRastreio(item: any) {
    const awb = item.awb || ''
    const transportadora = (item.transportadora || '').toUpperCase()

    if (!awb || awb === 'AGUARDANDO AWB') return ''

    if (transportadora.includes('DHL')) {
      return `https://mydhl.express.dhl/br/pt/tracking.html#/results?id=${awb}`
    }

    if (transportadora.includes('FEDEX')) {
      return `https://www.fedex.com/fedextrack/?trknbr=${awb}`
    }

    if (transportadora.includes('UPS')) {
      return `https://www.ups.com/track?tracknum=${awb}`
    }

    return ''
  }

  function progresso(status: string) {
    const s = (status || '').toLowerCase()

    if (s.includes('entregue')) return 100
    if (s.includes('liberado')) return 80
    if (s.includes('fiscal')) return 60
    if (s.includes('trânsito')) return 40
    if (s.includes('colet')) return 20
    return 10
  }

  const filtrados = embarques.filter((item) => {
    const texto = `
      ${item.awb}
      ${item.transportadora}
      ${item.origem}
      ${item.destino}
      ${item.status_operacional}
      ${item.exportador}
      ${item.importador}
      ${item.referencia_cliente}
      ${item.referencia_hc}
    `.toLowerCase()

    return texto.includes(busca.toLowerCase())
  })

  return (
    <main className="min-h-screen bg-[#020817] text-white p-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-10 gap-6">
          <div>
            <div className="bg-white inline-block p-5 rounded-2xl shadow-lg mb-6">
              <Image
                src="/HC-CONSULTORIA-TRANSPARENTE.png"
                alt="HC Consultoria"
                width={260}
                height={140}
                priority
              />
            </div>

            <h1 className="text-5xl font-black mb-2">Meu portal</h1>

            <p className="text-slate-400 text-lg mb-5">
              Acompanhe seus embarques, documentos, cotações e faturas em tempo real.
            </p>

            <div className="flex gap-4 flex-wrap">
              <a href="/cliente/cotacoes" className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl font-bold">
                Solicitar cotação
              </a>

              <a href="/cliente/cotacoes" className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold">
                Minhas cotações
              </a>

              <a href="/cliente/faturas" className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-bold">
                Minhas faturas
              </a>

              <a href="/cliente/suporte" className="bg-purple-600 hover:bg-purple-500 px-5 py-3 rounded-xl font-bold">
                Suporte
              </a>
            </div>
          </div>

          {usuario && (
            <div className="border border-blue-900 bg-[#071225] rounded-3xl px-5 py-4">
              <p className="font-bold text-lg">{usuario.nome}</p>
              <p className="text-slate-400 text-sm mb-4">{usuario.email}</p>

              <button
                onClick={sair}
                className="bg-blue-600 hover:bg-blue-700 px-5 py-3 rounded-2xl font-bold"
              >
                Sair
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card titulo="Embarques" valor={embarques.length} />
          <Card titulo="Em trânsito" valor={embarques.filter((e) => e.status_operacional === 'Em trânsito').length} />
          <Card titulo="Fiscalização" valor={embarques.filter((e) => e.status_operacional === 'Fiscalização').length} />
          <Card titulo="Entregues" valor={embarques.filter((e) => e.status_operacional === 'Entregue').length} />
          <Card titulo="Faturas" valor={faturas.length} />
        </div>

        <section className="card mb-8">
          <div className="flex justify-between items-center gap-4">
            <div>
              <h2 className="text-2xl font-black">Meus embarques</h2>
              <p className="text-slate-400 mt-1">
                Consulte status, rastreio, documentos e atualizações operacionais.
              </p>
            </div>

            <input
              className="max-w-md"
              placeholder="Buscar AWB, destino, status..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </section>

        <section className="grid gap-6">
          {filtrados.length === 0 ? (
            <div className="card text-center">
              <p className="text-slate-400">Nenhum embarque encontrado.</p>
            </div>
          ) : (
            filtrados.map((item) => {
              const documentos = documentosPorEmbarque[item.id] || []
              const link = linkRastreio(item)
              const percentual = progresso(item.status_operacional)

              return (
                <div key={item.id} className="card hover:border-blue-500 transition">
                  <div className="flex flex-col lg:flex-row justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap mb-4">
                        <h2 className="text-3xl font-black text-blue-400">
                          AWB {item.awb || '-'}
                        </h2>

                        <StatusBadge status={item.status_operacional} />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
                        <Info titulo="Transportadora" valor={item.transportadora} />
                        <Info titulo="Serviço" valor={item.servico} />
                        <Info titulo="Origem" valor={item.origem} />
                        <Info titulo="Destino" valor={item.destino} />
                        <Info titulo="Peso real" valor={item.peso_real ? `${item.peso_real} kg` : '-'} />
                        <Info titulo="Peso taxado" valor={item.peso_taxado ? `${item.peso_taxado} kg` : '-'} />
                        <Info
                          titulo="Previsão"
                          valor={item.data_prevista ? new Date(item.data_prevista).toLocaleDateString('pt-BR') : '-'}
                        />
                        <Info
                          titulo="Atualizado"
                          valor={item.ultima_atualizacao ? new Date(item.ultima_atualizacao).toLocaleString('pt-BR') : '-'}
                        />
                      </div>

                      <div className="mb-5">
                        <div className="flex justify-between text-sm text-slate-400 mb-2">
                          <span>Progresso do embarque</span>
                          <span>{percentual}%</span>
                        </div>

                        <div className="w-full h-3 bg-[#020817] rounded-full overflow-hidden border border-blue-900">
                          <div
                            className="h-full bg-green-600 rounded-full"
                            style={{ width: `${percentual}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex gap-3 flex-wrap">
                        <a
                          href={`/cliente/embarques/${item.id}`}
                          className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl font-bold"
                        >
                          Ver detalhes
                        </a>

                        {link && (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-yellow-500 hover:bg-yellow-400 px-4 py-2 rounded-xl text-black font-bold"
                          >
                            Rastrear
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="lg:w-[320px] border border-blue-900 bg-[#020817] rounded-2xl p-5">
                      <h3 className="font-black mb-3">Documentos</h3>

                      {documentos.length === 0 ? (
                        <p className="text-slate-500 text-sm">
                          Nenhum documento disponível.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {documentos.slice(0, 3).map((doc: any) => (
                            <a
                              key={doc.id}
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block border border-blue-900 rounded-xl p-3 hover:border-green-500 transition"
                            >
                              <p className="font-bold text-sm break-all">📎 {doc.nome}</p>
                              <p className="text-slate-500 text-xs mt-1">
                                {doc.criado_em
                                  ? new Date(doc.criado_em).toLocaleString('pt-BR')
                                  : '-'}
                              </p>
                            </a>
                          ))}

                          {documentos.length > 3 && (
                            <p className="text-slate-400 text-sm">
                              + {documentos.length - 3} documento(s) no detalhe
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </section>
      </div>
    </main>
  )
}

function Card({ titulo, valor }: any) {
  return (
    <div className="card">
      <p className="text-slate-400">{titulo}</p>
      <h2 className="text-5xl font-black mt-4">{valor}</h2>
    </div>
  )
}

function Info({ titulo, valor }: any) {
  return (
    <div className="border border-blue-900 bg-[#020817] rounded-2xl p-4">
      <p className="text-slate-500 text-sm mb-1">{titulo}</p>
      <p className="font-bold break-words">{valor || '-'}</p>
    </div>
  )
} 