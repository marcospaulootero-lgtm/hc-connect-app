'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<any[]>([])
  const [salvando, setSalvando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const [form, setForm] = useState({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    contato_principal: '',
    email_principal: '',
    telefone: '',
    email_acesso: '',
    senha_acesso: '',
    tipo_acesso: 'cliente',
    codigo_vinculo: '',
  })

  useEffect(() => {
    carregar()
  }, [])

  function gerarCodigo(texto: string) {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
  }

  async function carregar() {
    const { data } = await supabase
      .from('empresas')
      .select('*')
      .order('criado_em', { ascending: false })

    setClientes(data || [])
  }

  function limparFormulario() {
    setForm({
      razao_social: '',
      nome_fantasia: '',
      cnpj: '',
      contato_principal: '',
      email_principal: '',
      telefone: '',
      email_acesso: '',
      senha_acesso: '',
      tipo_acesso: 'cliente',
      codigo_vinculo: '',
    })

    setEditandoId(null)
  }

  function gerarSenha() {
    const senha = `HC${Math.floor(100000 + Math.random() * 900000)}`
    setForm({ ...form, senha_acesso: senha })
  }

  function preencherCodigoAutomatico() {
    const base = form.nome_fantasia || form.razao_social
    if (!base) {
      alert('Informe razão social ou nome fantasia primeiro')
      return
    }

    setForm({
      ...form,
      codigo_vinculo: gerarCodigo(base),
    })
  }

  function editarCliente(cliente: any) {
    setEditandoId(cliente.id)

    setForm({
      razao_social: cliente.razao_social || '',
      nome_fantasia: cliente.nome_fantasia || '',
      cnpj: cliente.cnpj || '',
      contato_principal: cliente.contato_principal || '',
      email_principal: cliente.email_principal || '',
      telefone: cliente.telefone || '',
      email_acesso: cliente.email_acesso || '',
      senha_acesso: '',
      tipo_acesso: cliente.tipo_acesso || 'cliente',
      codigo_vinculo: cliente.codigo_vinculo || '',
    })

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function salvar() {
    if (!form.razao_social || !form.email_principal) {
      alert('Informe razão social e e-mail principal')
      return
    }

    if (!form.codigo_vinculo) {
      alert('Informe ou gere o código de vínculo')
      return
    }

    setSalvando(true)

    if (editandoId) {
      const { error } = await supabase
        .from('empresas')
        .update({
          razao_social: form.razao_social,
          nome_fantasia: form.nome_fantasia,
          cnpj: form.cnpj,
          contato_principal: form.contato_principal,
          email_principal: form.email_principal,
          telefone: form.telefone,
          email_acesso: form.email_acesso,
          tipo_acesso: form.tipo_acesso,
          codigo_vinculo: form.codigo_vinculo,
        })
        .eq('id', editandoId)

      if (error) {
        alert('Erro ao atualizar cliente')
        console.log(error)
        setSalvando(false)
        return
      }

      await supabase
        .from('perfis')
        .update({
          codigo_vinculo: form.codigo_vinculo,
          tipo_acesso: form.tipo_acesso,
        })
        .eq('empresa_id', editandoId)

      alert('Cliente atualizado com sucesso')
      limparFormulario()
      carregar()
      setSalvando(false)
      return
    }

    if (!form.email_acesso || !form.senha_acesso) {
      alert('Informe e-mail e senha de acesso ao portal')
      setSalvando(false)
      return
    }

    const { data: empresaCriada, error: erroEmpresa } = await supabase
      .from('empresas')
      .insert([
        {
          razao_social: form.razao_social,
          nome_fantasia: form.nome_fantasia,
          cnpj: form.cnpj,
          contato_principal: form.contato_principal,
          email_principal: form.email_principal,
          telefone: form.telefone,
          email_acesso: form.email_acesso,
          tipo_acesso: form.tipo_acesso,
          codigo_vinculo: form.codigo_vinculo,
        },
      ])
      .select()
      .single()

    if (erroEmpresa) {
      alert('Erro ao salvar cliente')
      console.log(erroEmpresa)
      setSalvando(false)
      return
    }

    const resposta = await fetch('/api/criar-usuario', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: form.email_acesso,
        senha: form.senha_acesso,
        tipo_acesso: form.tipo_acesso,
        empresa_id: empresaCriada.id,
        codigo_vinculo: form.codigo_vinculo,
        nome: form.contato_principal || form.razao_social,
      }),
    })

    const resultado = await resposta.json()

    if (!resposta.ok) {
      alert(`Cliente salvo, mas erro ao criar login: ${resultado.erro}`)
      console.log(resultado)
      carregar()
      setSalvando(false)
      return
    }

    alert(
      `Cliente e acesso criados com sucesso!\n\nE-mail: ${form.email_acesso}\nSenha: ${form.senha_acesso}\nCódigo vínculo: ${form.codigo_vinculo}`
    )

    limparFormulario()
    carregar()
    setSalvando(false)
  }

  async function excluirCliente(cliente: any) {
    const confirmar = confirm(
      `Tem certeza que deseja excluir o cliente:\n\n${cliente.razao_social}?`
    )

    if (!confirmar) return

    const { error } = await supabase
      .from('empresas')
      .delete()
      .eq('id', cliente.id)

    if (error) {
      alert('Erro ao excluir cliente. Verifique se ele possui embarques vinculados.')
      console.log(error)
      return
    }

    alert('Cliente excluído com sucesso')
    carregar()
  }

  return (
    <main className="max-w-7xl mx-auto p-8 text-white">
      <div className="mb-8">
        <h1 className="text-5xl font-black mb-2">
          Clientes / Parceiros
        </h1>

        <p className="text-slate-400 text-lg">
          Cadastre parceiros, clientes e códigos de vínculo para acesso ao portal.
        </p>
      </div>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">
          {editandoId ? 'Editar cliente/parceiro' : 'Cadastrar cliente/parceiro'}
        </h2>

        <div className="form-grid">
          <input
            placeholder="Razão social"
            value={form.razao_social}
            onChange={(e) =>
              setForm({ ...form, razao_social: e.target.value })
            }
          />

          <input
            placeholder="Nome fantasia"
            value={form.nome_fantasia}
            onChange={(e) =>
              setForm({ ...form, nome_fantasia: e.target.value })
            }
          />

          <input
            placeholder="Código de vínculo. Ex: SKYSEA"
            value={form.codigo_vinculo}
            onChange={(e) =>
              setForm({
                ...form,
                codigo_vinculo: gerarCodigo(e.target.value),
              })
            }
          />

          <button type="button" onClick={preencherCodigoAutomatico}>
            Gerar código
          </button>

          <input
            placeholder="CNPJ"
            value={form.cnpj}
            onChange={(e) =>
              setForm({ ...form, cnpj: e.target.value })
            }
          />

          <input
            placeholder="Contato principal"
            value={form.contato_principal}
            onChange={(e) =>
              setForm({ ...form, contato_principal: e.target.value })
            }
          />

          <input
            placeholder="E-mail principal"
            value={form.email_principal}
            onChange={(e) =>
              setForm({ ...form, email_principal: e.target.value })
            }
          />

          <input
            placeholder="Telefone"
            value={form.telefone}
            onChange={(e) =>
              setForm({ ...form, telefone: e.target.value })
            }
          />

          <input
            placeholder="E-mail de acesso ao portal"
            value={form.email_acesso}
            onChange={(e) =>
              setForm({ ...form, email_acesso: e.target.value })
            }
          />

          {!editandoId && (
            <input
              placeholder="Senha de acesso"
              value={form.senha_acesso}
              onChange={(e) =>
                setForm({ ...form, senha_acesso: e.target.value })
              }
            />
          )}

          <select
            value={form.tipo_acesso}
            onChange={(e) =>
              setForm({ ...form, tipo_acesso: e.target.value })
            }
          >
            <option value="cliente">Cliente / Parceiro</option>
            <option value="admin">Admin HC</option>
          </select>

          {!editandoId && (
            <button type="button" onClick={gerarSenha}>
              Gerar senha
            </button>
          )}
        </div>

        <div className="flex gap-4 mt-6">
          <button onClick={salvar} disabled={salvando}>
            {salvando
              ? 'Salvando...'
              : editandoId
              ? 'Salvar alterações'
              : 'Salvar cliente e criar acesso'}
          </button>

          {editandoId && (
            <button
              type="button"
              onClick={limparFormulario}
              className="bg-slate-700 hover:bg-slate-600"
            >
              Cancelar edição
            </button>
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="text-2xl font-black mb-6">
          Clientes / Parceiros cadastrados
        </h2>

        <div className="overflow-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Razão social</th>
                <th>Nome fantasia</th>
                <th>Código vínculo</th>
                <th>CNPJ</th>
                <th>Contato</th>
                <th>E-mail</th>
                <th>E-mail acesso</th>
                <th>Tipo</th>
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              {clientes.map((cliente) => (
                <tr key={cliente.id}>
                  <td>{cliente.razao_social}</td>
                  <td>{cliente.nome_fantasia}</td>
                  <td>
                    <span className="px-3 py-1 rounded-full bg-purple-600 text-white text-sm font-bold">
                      {cliente.codigo_vinculo || '-'}
                    </span>
                  </td>
                  <td>{cliente.cnpj}</td>
                  <td>{cliente.contato_principal}</td>
                  <td>{cliente.email_principal}</td>
                  <td>{cliente.email_acesso}</td>
                  <td>
                    <span className="px-3 py-1 rounded-full bg-blue-600 text-white text-sm font-bold">
                      {cliente.tipo_acesso || 'cliente'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-3">
                      <button onClick={() => editarCliente(cliente)}>
                        Editar
                      </button>

                      <button
                        onClick={() => excluirCliente(cliente)}
                        className="bg-red-600 hover:bg-red-500"
                      >
                        Excluir
                      </button>
                    </div>
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