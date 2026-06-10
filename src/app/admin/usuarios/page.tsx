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

  async function alterarStatus(usuario: any) {
    const novoStatus = usuario.ativo === false ? true : false

    const { error } = await supabase
      .from('perfis')
      .update({ ativo: novoStatus })
      .eq('id', usuario.id)

    if (error) {
      alert('Erro ao alterar status do usuário')
      console.log(error)
      return
    }

    carregarUsuarios()
  }

  async function alterarTipoAcesso(usuario: any, novoTipo: string) {
    const { error } = await supabase
      .from('perfis')
      .update({ tipo_acesso: novoTipo })
      .eq('id', usuario.id)

    if (error) {
      alert('Erro ao alterar tipo de acesso')
      console.log(error)
      return
    }

    carregarUsuarios()
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
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => alterarStatus(usuario)}
                          className={
                            usuario.ativo === false
                              ? 'bg-green-600 hover:bg-green-500'
                              : 'bg-yellow-600 hover:bg-yellow-500'
                          }
                        >
                          {usuario.ativo === false ? 'Ativar' : 'Inativar'}
                        </button>

                        <select
                          value={usuario.tipo_acesso || 'cliente'}
                          onChange={(e) => alterarTipoAcesso(usuario, e.target.value)}
                          className="bg-slate-900 border border-blue-600 rounded-lg px-3 py-2 text-white font-bold uppercase"
                        >
                          <option value="cliente">CLIENTE</option>
                          <option value="admin">ADMIN</option>
                        </select>

                        <button
                          onClick={() => excluirUsuario(usuario)}
                          className="bg-red-600 hover:bg-red-500"
                        >
                          Excluir acesso
                        </button>
                      </div>
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