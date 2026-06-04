'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function CotacoesAdminPage() {
  const [cotacoes, setCotacoes] = useState<any[]>([])

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    const { data } = await supabase
      .from('cotacoes')
      .select('*')
      .order('criado_em', { ascending: false })

    setCotacoes(data || [])
  }

  return (
    <main className="max-w-7xl mx-auto p-8 text-white">
      <div className="mb-8">
        <h1 className="text-5xl font-black mb-2">Cotações</h1>

        <p className="text-slate-400 text-lg">
          Fila de solicitações de cotação dos clientes e parceiros.
        </p>
      </div>

      <section className="card">
        <h2 className="text-2xl font-black mb-6">
          Solicitações recebidas
        </h2>

        <div className="overflow-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Código</th>
                <th>Cliente final</th>
                <th>Operação</th>
                <th>Origem</th>
                <th>Destino</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {cotacoes.map((item) => (
                <tr key={item.id}>
                  <td>
                    {new Date(item.criado_em).toLocaleDateString('pt-BR')}
                  </td>

                  <td>{item.codigo_vinculo}</td>

                  <td>{item.cliente_final}</td>

                  <td>{item.tipo_operacao}</td>

                  <td>{item.origem}</td>

                  <td>{item.destino}</td>

                  <td>
                    <span className="px-3 py-1 rounded-full bg-yellow-400 text-black text-sm font-bold">
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}