'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function RedefinirSenhaPage() {
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function alterarSenha(e: React.FormEvent) {
    e.preventDefault()

    setErro('')
    setMensagem('')

    if (!senha || !confirmarSenha) {
      setErro('Preencha os dois campos.')
      return
    }

    if (senha !== confirmarSenha) {
      setErro('As senhas não conferem.')
      return
    }

    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password: senha,
    })

    setLoading(false)

    if (error) {
      setErro('Erro ao alterar senha. Solicite um novo link.')
      return
    }

    setMensagem('Senha alterada com sucesso. Você já pode fazer login.')

    setTimeout(() => {
      window.location.href = '/login'
    }, 2000)
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
            Nova senha
          </h1>

          <p className="text-slate-400">
            Crie uma nova senha para acessar o HC Connect.
          </p>
        </div>

        <form onSubmit={alterarSenha} className="space-y-5">
          <input
            type="password"
            placeholder="Nova senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Confirmar nova senha"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
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
            {loading ? 'Alterando...' : 'Alterar senha'}
          </button>
        </form>
      </section>
    </main>
  )
}