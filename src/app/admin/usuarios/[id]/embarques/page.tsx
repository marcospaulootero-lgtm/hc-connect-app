'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import StatusBadge from '@/components/StatusBadge'

type EmbarqueComVinculo = {
  [key: string]: any
  tipo_vinculo_hc?: string
}

export default function EmbarquesDoUsuarioPage() {
  const params = useParams()

  const usuarioId = String(
    Array.isArray(params?.id)
      ? params.id[0]
      : params?.id || ''
  )

  const [usuario, setUsuario] =
    useState<any | null>(null)

  const [embarques, setEmbarques] =
    useState<EmbarqueComVinculo[]>([])

  const [carregando, setCarregando] =
    useState(true)

  const [erro, setErro] =
    useState('')

  const [busca, setBusca] =
    useState('')

  const [filtroStatus, setFiltroStatus] =
    useState('')

  const [filtroTransportadora, setFiltroTransportadora] =
    useState('')

  useEffect(() => {
    if (!usuarioId) return

    carregar()
  }, [usuarioId])

  async function carregar() {
    setCarregando(true)
    setErro('')

    try {
      /*
      ============================================
      PERFIL DO LOGIN
      ============================================
      */

      const {
        data: perfil,
        error: erroPerfil,
      } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', usuarioId)
        .maybeSingle()

      if (erroPerfil) {
        throw erroPerfil
      }

      if (!perfil) {
        throw new Error(
          'Usuário não encontrado.'
        )
      }

      setUsuario(perfil)

      /*
      ============================================
      1. EMBARQUES DIRETAMENTE VINCULADOS
         embarques.usuario_id
      ============================================
      */

      const {
        data: diretos,
        error: erroDiretos,
      } = await supabase
        .from('embarques')
        .select('*')
        .eq('usuario_id', usuarioId)

      if (erroDiretos) {
        throw erroDiretos
      }

      /*
      ============================================
      2. EMBARQUES DA TABELA embarque_clientes
         embarque_clientes.cliente_id
      ============================================
      */

      const {
        data: vinculos,
        error: erroVinculos,
      } = await supabase
        .from('embarque_clientes')
        .select('embarque_id')
        .eq('cliente_id', usuarioId)

      if (erroVinculos) {
        throw erroVinculos
      }

      const idsVinculados = Array.from(
        new Set(
          (vinculos || [])
            .map(
              (item: any) =>
                String(
                  item.embarque_id || ''
                )
            )
            .filter(Boolean)
        )
      )

      let embarquesVinculados: any[] = []

      if (idsVinculados.length > 0) {
        const {
          data,
          error,
        } = await supabase
          .from('embarques')
          .select('*')
          .in(
            'id',
            idsVinculados
          )

        if (error) {
          throw error
        }

        embarquesVinculados =
          data || []
      }

      /*
      ============================================
      UNIFICAR SEM DUPLICAR

      Um embarque pode existir em:
      - usuario_id
      - embarque_clientes
      - ambos

      O painel mostra apenas uma linha.
      ============================================
      */

      const mapa =
        new Map<string, EmbarqueComVinculo>()

      for (const item of diretos || []) {
        mapa.set(
          String(item.id),
          {
            ...item,
            tipo_vinculo_hc:
              'Direto',
          }
        )
      }

      for (
        const item of embarquesVinculados
      ) {
        const id =
          String(item.id)

        const existente =
          mapa.get(id)

        mapa.set(
          id,
          {
            ...(existente || item),

            tipo_vinculo_hc:
              existente
                ? 'Direto + vínculo'
                : 'Vínculo adicional',
          }
        )
      }

      const lista =
        Array.from(
          mapa.values()
        ).sort(
          (a: any, b: any) => {
            const dataA =
              new Date(
                a.ultima_atualizacao ||
                a.criado_em ||
                0
              ).getTime()

            const dataB =
              new Date(
                b.ultima_atualizacao ||
                b.criado_em ||
                0
              ).getTime()

            return dataB - dataA
          }
        )

      setEmbarques(lista)
    } catch (error: any) {
      console.error(
        'Erro ao carregar embarques do login:',
        error
      )

      setErro(
        error?.message ||
        'Erro ao carregar os embarques deste usuário.'
      )

      setEmbarques([])
    } finally {
      setCarregando(false)
    }
  }

  const embarquesFiltrados =
    useMemo(() => {
      const termo =
        busca
          .trim()
          .toLowerCase()

      return embarques.filter(
        (item: any) => {
          if (
            filtroStatus &&
            String(
              item.status_operacional || ''
            ) !== filtroStatus
          ) {
            return false
          }

          if (
            filtroTransportadora &&
            String(
              item.transportadora || ''
            ) !== filtroTransportadora
          ) {
            return false
          }

          if (!termo) {
            return true
          }

          const base = [
            item.awb,
            item.referencia_hc,
            item.referencia_cliente,
            item.cliente_final,
            item.exportador,
            item.importador,
            item.transportadora,
            item.servico,
            item.origem,
            item.destino,
            item.status_operacional,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()

          return base.includes(
            termo
          )
        }
      )
    }, [
      embarques,
      busca,
      filtroStatus,
      filtroTransportadora,
    ])

  const statusDisponiveis =
    useMemo(
      () =>
        Array.from(
          new Set(
            embarques
              .map(
                (item: any) =>
                  String(
                    item.status_operacional ||
                    ''
                  )
              )
              .filter(Boolean)
          )
        ).sort(),
      [embarques]
    )

  const transportadorasDisponiveis =
    useMemo(
      () =>
        Array.from(
          new Set(
            embarques
              .map(
                (item: any) =>
                  String(
                    item.transportadora ||
                    ''
                  )
              )
              .filter(Boolean)
          )
        ).sort(),
      [embarques]
    )

  const totalEntregues =
    embarques.filter(
      (item: any) =>
        String(
          item.status_operacional ||
          ''
        )
          .toUpperCase()
          .includes('ENTREG')
    ).length

  const totalTransito =
    embarques.filter(
      (item: any) =>
        String(
          item.status_operacional ||
          ''
        )
          .toUpperCase()
          .includes('TRÂNSITO') ||
        String(
          item.status_operacional ||
          ''
        )
          .toUpperCase()
          .includes('TRANSITO')
    ).length

  const totalFiscalizacao =
    embarques.filter(
      (item: any) =>
        String(
          item.status_operacional ||
          ''
        )
          .toUpperCase()
          .includes('FISCAL')
    ).length

  function nomeEmpresa() {
    return (
      usuario?.empresa_nome ||
      usuario?.nome_empresa ||
      usuario?.empresa ||
      usuario?.razao_social ||
      usuario?.nome_fantasia ||
      usuario?.nome ||
      '-'
    )
  }

  function formatarData(
    valor: any
  ) {
    if (!valor) return '-'

    const data =
      new Date(valor)

    if (
      Number.isNaN(
        data.getTime()
      )
    ) {
      return String(valor)
    }

    return data.toLocaleDateString(
      'pt-BR'
    )
  }

  return (
    <main className="p-4 md:p-7">
      <section className="mb-6 rounded-3xl border border-blue-900 bg-[#071225] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-400">
              Usuário do portal
            </p>

            <h1 className="mt-2 text-3xl font-black text-white">
              Embarques vinculados
            </h1>

            <p className="mt-3 text-lg font-black text-white">
              {usuario?.nome ||
                usuario?.email ||
                'Usuário'}
            </p>

            <p className="mt-1 text-sm font-bold text-slate-400">
              Login: {usuario?.email || '-'}
            </p>

            <p className="mt-1 text-sm font-bold text-slate-400">
              Empresa: {nomeEmpresa()}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                window.location.href =
                  '/admin/usuarios'
              }}
              className="rounded-xl bg-slate-700 px-5 py-3 font-black text-white hover:bg-slate-600"
            >
              ← Voltar para usuários
            </button>

            <button
              type="button"
              onClick={carregar}
              className="rounded-xl bg-blue-600 px-5 py-3 font-black text-white hover:bg-blue-500"
            >
              ↻ Atualizar
            </button>
          </div>
        </div>
      </section>

      {erro && (
        <section className="mb-6 rounded-2xl border border-red-700 bg-red-950/30 p-5 font-bold text-red-300">
          {erro}
        </section>
      )}

      <section className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Resumo
          titulo="Total"
          valor={embarques.length}
          detalhe="Embarques vinculados"
        />

        <Resumo
          titulo="Em trânsito"
          valor={totalTransito}
          detalhe="Em andamento"
        />

        <Resumo
          titulo="Fiscalização"
          valor={totalFiscalizacao}
          detalhe="Em conferência"
        />

        <Resumo
          titulo="Entregues"
          valor={totalEntregues}
          detalhe="Finalizados"
        />
      </section>

      <section className="mb-6 rounded-3xl border border-blue-900 bg-[#071225] p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <input
            value={busca}
            onChange={(e) =>
              setBusca(
                e.target.value
              )
            }
            placeholder="Buscar AWB, referência, cliente..."
          />

          <select
            value={filtroStatus}
            onChange={(e) =>
              setFiltroStatus(
                e.target.value
              )
            }
          >
            <option value="">
              Todos os status
            </option>

            {statusDisponiveis.map(
              (status) => (
                <option
                  key={status}
                  value={status}
                >
                  {status}
                </option>
              )
            )}
          </select>

          <select
            value={
              filtroTransportadora
            }
            onChange={(e) =>
              setFiltroTransportadora(
                e.target.value
              )
            }
          >
            <option value="">
              Todas as transportadoras
            </option>

            {transportadorasDisponiveis.map(
              (transportadora) => (
                <option
                  key={
                    transportadora
                  }
                  value={
                    transportadora
                  }
                >
                  {transportadora}
                </option>
              )
            )}
          </select>

          <button
            type="button"
            onClick={() => {
              setBusca('')
              setFiltroStatus('')
              setFiltroTransportadora('')
            }}
            className="rounded-xl bg-slate-700 px-4 py-3 font-black hover:bg-slate-600"
          >
            Limpar filtros
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-blue-900 bg-[#071225] p-5">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">
              Processos do login
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Todos os embarques ligados diretamente ou pela tabela de vínculos.
            </p>
          </div>

          <span className="rounded-full bg-blue-600/20 px-4 py-2 text-sm font-black text-blue-300">
            {embarquesFiltrados.length} processo(s)
          </span>
        </div>

        {carregando ? (
          <div className="rounded-2xl border border-blue-900 bg-[#020817] p-8 text-slate-400">
            Carregando embarques...
          </div>
        ) : embarquesFiltrados.length === 0 ? (
          <div className="rounded-2xl border border-blue-900 bg-[#020817] p-8 text-center text-slate-400">
            Nenhum embarque vinculado a este login.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>AWB</th>
                  <th>Ref. HC</th>
                  <th>Cliente</th>
                  <th>Transportadora</th>
                  <th>Serviço</th>
                  <th>Rota</th>
                  <th>Status</th>
                  <th>Vínculo</th>
                  <th>Atualização</th>
                  <th>Ação</th>
                </tr>
              </thead>

              <tbody>
                {embarquesFiltrados.map(
                  (item: any) => (
                    <tr key={item.id}>
                      <td className="font-black text-blue-300">
                        {item.awb || '-'}
                      </td>

                      <td>
                        {item.referencia_hc ||
                          '-'}
                      </td>

                      <td>
                        {item.cliente_final ||
                          item.importador ||
                          item.exportador ||
                          '-'}
                      </td>

                      <td>
                        {item.transportadora ||
                          '-'}
                      </td>

                      <td>
                        {item.servico || '-'}
                      </td>

                      <td>
                        <div className="min-w-[150px]">
                          <p className="font-bold">
                            {item.origem ||
                              '-'}
                          </p>

                          <p className="text-xs text-slate-500">
                            →
                            {' '}
                            {item.destino ||
                              '-'}
                          </p>
                        </div>
                      </td>

                      <td>
                        <StatusBadge
                          status={
                            item.status_operacional ||
                            '-'
                          }
                        />
                      </td>

                      <td>
                        <span className="rounded-full bg-purple-600/20 px-3 py-1 text-xs font-black text-purple-300">
                          {item.tipo_vinculo_hc ||
                            '-'}
                        </span>
                      </td>

                      <td>
                        {formatarData(
                          item.ultima_atualizacao ||
                          item.criado_em
                        )}
                      </td>

                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            window.location.href =
                              `/admin/embarques/${item.id}`
                          }}
                          className="rounded-xl bg-blue-600 px-4 py-2 font-black hover:bg-blue-500"
                        >
                          Abrir
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

function Resumo({
  titulo,
  valor,
  detalhe,
}: {
  titulo: string
  valor: any
  detalhe: string
}) {
  return (
    <div className="rounded-2xl border border-blue-900 bg-[#071225] p-5">
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">
        {titulo}
      </p>

      <p className="mt-2 text-3xl font-black text-white">
        {valor}
      </p>

      <p className="mt-1 text-xs font-bold text-slate-500">
        {detalhe}
      </p>
    </div>
  )
}
