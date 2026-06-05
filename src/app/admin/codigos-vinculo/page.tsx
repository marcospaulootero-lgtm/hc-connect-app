'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function CodigosVinculoPage() {
  const [empresa, setEmpresa] = useState('')
  const [codigo, setCodigo] = useState('')
  const [lista, setLista] = useState<any[]>([])

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    const { data } = await supabase
      .from('codigos_vinculo')
      .select('*')
      .order('empresa_nome')

    setLista(data || [])
  }

  async function salvar() {
    if (!empresa || !codigo) {
      alert('Preencha todos os campos')
      return
    }

    const { error } = await supabase
      .from('codigos_vinculo')
      .insert({
        empresa_nome: empresa,
        codigo: codigo.toUpperCase(),
      })

    if (error) {
      alert(error.message)
      return
    }

    setEmpresa('')
    setCodigo('')

    carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir código?')) return

    await supabase
      .from('codigos_vinculo')
      .delete()
      .eq('id', id)

    carregar()
  }

  return (
    <main className="max-w-7xl mx-auto p-8 text-white">

      <h1 className="text-5xl font-black mb-2">
        Códigos de vínculo
      </h1>

      <p className="text-slate-400 mb-8">
        Clientes utilizarão estes códigos para criar acesso ao portal.
      </p>

      <section className="card mb-8">

        <h2 className="text-2xl font-bold mb-6">
          Novo código
        </h2>

        <div className="grid md:grid-cols-3 gap-4">

          <input
            placeholder="Empresa"
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
          />

          <input
            placeholder="Código"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          />

          <button onClick={salvar}>
            Salvar código
          </button>

        </div>

      </section>

      <section className="card">

        <h2 className="text-2xl font-bold mb-6">
          Códigos cadastrados
        </h2>

        <table className="table">

          <thead>
            <tr>
              <th>Empresa</th>
              <th>Código</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>

            {lista.map((item) => (
              <tr key={item.id}>

                <td>{item.empresa_nome}</td>

                <td>
                  <span className="px-3 py-1 bg-purple-600 rounded-full text-sm font-bold">
                    {item.codigo}
                  </span>
                </td>

                <td>
                  <button
                    className="bg-red-600 hover:bg-red-500"
                    onClick={() => excluir(item.id)}
                  >
                    Excluir
                  </button>
                </td>

              </tr>
            ))}

          </tbody>

        </table>

      </section>

    </main>
  )
}