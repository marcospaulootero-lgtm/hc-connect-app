'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function CadastroPage() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [loading, setLoading] = useState(false)

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault()

    if (!nome || !email || !senha) {
      alert('Preencha nome, e-mail e senha')
      return
    }

    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: {
          nome,
          empresa_nome: empresa,
          tipo_acesso: 'cliente',
        },
      },
    })

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    if (!data.user) {
      alert('Não foi possível criar o usuário.')
      setLoading(false)
      return
    }

    const { error: erroPerfil } = await supabase.from('perfis').upsert({
      id: data.user.id,
      nome,
      email,
      tipo_acesso: 'cliente',
      tipo_usuario: 'cliente',
      empresa_id: null,
      empresa_nome: empresa || null,
      codigo_vinculo: null,
      ativo: true,
    })

    if (erroPerfil) {
      alert('Conta criada, mas houve erro ao salvar o perfil.')
      console.log(erroPerfil)
      setLoading(false)
      return
    }

    const { data: sessao } = await supabase.auth.getSession()

    setLoading(false)

    if (sessao.session) {
      alert('Conta criada com sucesso. Você já pode acessar o portal.')
      window.location.href = '/cliente'
    } else {
      alert('Conta criada com sucesso. Faça login para acessar o portal.')
      window.location.href = '/login'
    }
  }

  return (
    <main className="min-h-screen bg-[#020817] flex items-center justify-center p-6">
      <section className="w-full max-w-md bg-[#08142c] border border-blue-900 rounded-3xl p-8">
        <div className="text-center mb-8">
          <img
  src="/HC-CONSULTORIA-TRANSPARENTE.png"
  alt="HC Consultoria"
  className="w-40 mx-auto mb-6 bg-white rounded-2xl p-4"
/>

          <h1 className="text-white text-4xl font-black mb-2">
            Criar conta
          </h1>

          <p className="text-slate-400">
            Crie sua conta para acessar o portal da HC Consultoria.
          </p>
        </div>

        <form onSubmit={cadastrar} className="space-y-5">
          <input
            placeholder="Nome completo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />

          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            placeholder="Empresa"
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
          />

          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />

          <button type="submit" disabled={loading} className="w-full">
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>

          <a
            href="/login"
            className="block text-center text-blue-400 hover:text-blue-300 font-bold"
          >
            Já tenho conta
          </a>
        </form>
      </section>
    </main>
  )
}