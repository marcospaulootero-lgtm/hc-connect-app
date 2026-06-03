'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  async function fazerLogin(e: React.FormEvent) {
    e.preventDefault()

    setErro('')
    setMensagem('')
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })

    if (error) {
      setErro('E-mail ou senha inválidos')
      setLoading(false)
      return
    }

    const userId = data.user.id

    const { data: perfil, error: erroPerfil } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', userId)
      .single()

    if (erroPerfil || !perfil) {
      setErro('Perfil não encontrado para este usuário')
      setLoading(false)
      return
    }

    if (perfil.tipo_acesso === 'admin') {
      router.push('/admin')
    } else {
      router.push('/cliente')
    }

    setLoading(false)
  }

  async function recuperarSenha() {
    if (!email) {
      alert('Digite seu e-mail primeiro')
      return
    }

    setErro('')
    setMensagem('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:3000/redefinir-senha',
    })

    if (error) {
      console.log(error)
      alert(error.message)
      return
    }

    setMensagem('Enviamos um link de recuperação para seu e-mail.')
  }

  return (
    <main className="min-h-screen bg-[#020817] flex items-center justify-center p-6">
      <section className="w-full max-w-md bg-[#08142c] border border-blue-900 rounded-3xl p-8">

        <div className="text-center mb-8">
          <img
            src="/HC-CONSULTORIA.png"
            alt="HC Consultoria"
            className="w-32 h-32 object-contain mx-auto mb-4"
          />

          <h1 className="text-white text-4xl font-black mb-2">
            HC Connect
          </h1>

          <p className="text-slate-400">
            Portal de embarques
          </p>
        </div>

        <form onSubmit={fazerLogin} className="space-y-5">
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />

          {erro && (
            <div className="bg-red-500/20 border border-red-500 text-red-300 rounded-2xl p-4 text-sm">
              {erro}
            </div>
          )}

          {mensagem && (
            <div className="bg-green-500/20 border border-green-500 text-green-300 rounded-2xl p-4 text-sm">
              {mensagem}
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <button
            type="button"
            onClick={recuperarSenha}
            className="w-full bg-slate-700 hover:bg-slate-600"
          >
            Esqueci minha senha
          </button>
        </form>

      </section>
    </main>
  )
}