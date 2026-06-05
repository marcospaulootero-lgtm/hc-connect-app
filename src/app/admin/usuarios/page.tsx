'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregarUsuarios()
  }, [])

  async function carregarUsuarios() {
    setCarregando(true)

    const { data, error } = await supabase
      .from('perfis')
      .select('*')
      .order('criado_em', { ascending: false })

    if (error) {
      alert('Erro ao carregar usuários')
      console.log(error)
      setCarregando(false)
      return
    }

    setUsuarios(data || [])
    setCarregando(false)
  }

  async function excluirUsuario(usuario: any) {
    const confirmar = confirm(
      `Tem certeza que deseja remover o acesso de:\n\n${usuario.nome || usuario.email}?`
    )

    if (!confirmar) return

    const { error } = await supabase
      .from('perfis')
      .delete()
      .eq('id', usuario.id)

    if (error) {
      alert('Erro ao excluir usuário')
      console.log(error)
      return
    }

    alert('Usuário removido do portal')
    carregarUsuarios()
  }

  return (
    <main className="max-w-7xl mx-auto p-8 text-white">
      <div className="mb-8">
        <h1 className="text-5xl font-black mb-2">
          Usuários do portal
        </h1>

        <p className="text-slate-400 text-lg">
          Lista de usuários cadastrados pelos clientes através do código de vínculo.
        </p>
      </div>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-4">
          Como funciona
        </h2>

        <p className="text-slate-300 leading-8">
          O cliente cria a própria conta na tela de cadastro e informa o código
          da empresa. Exemplo: quem for da Sky Sea usa o código
          <strong className="text-blue-400"> HCSKYSEA</strong>.
        </p>
      </section>

      <section className="card">
        <h2 className="text-2xl font-black mb-6">
          Cadastros realizados
        </h2>

        {carregando ? (
          <p className="text-slate-400">Carregando usuários...</p>
        ) : (
          <div className="overflow-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Código vínculo</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Data cadastro</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {usuarios.map((usuario) => (
                  <tr key={usuario.id}>
                    <td>{usuario.nome || '-'}</td>

                    <td>{usuario.email || '-'}</td>

                    <td>
                      <span className="px-3 py-1 rounded-full bg-purple-600 text-white text-sm font-bold">
                        {usuario.codigo_vinculo || '-'}
                      </span>
                    </td>

                    <td>
                      <span className="px-3 py-1 rounded-full bg-blue-600 text-white text-sm font-bold uppercase">
                        {usuario.tipo_acesso || 'cliente'}
                      </span>
                    </td>

                    <td>
                      {usuario.ativo === false ? (
                        <span className="px-3 py-1 rounded-full bg-red-600 text-white text-sm font-bold">
                          Inativo
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full bg-green-600 text-white text-sm font-bold">
                          Ativo
                        </span>
                      )}
                    </td>

                    <td>
                      {usuario.criado_em
                        ? new Date(usuario.criado_em).toLocaleDateString('pt-BR')
                        : '-'}
                    </td>

                    <td>
                      <button
                        onClick={() => excluirUsuario(usuario)}
                        className="bg-red-600 hover:bg-red-500"
                      >
                        Excluir acesso
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}