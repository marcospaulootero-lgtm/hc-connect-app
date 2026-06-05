'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function CadastroPage() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [codigo, setCodigo] = useState('')
  const [loading, setLoading] = useState(false)

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault()

    if (!nome || !email || !senha || !codigo) {
      alert('Preencha todos os campos')
      return
    }

    setLoading(true)

    const codigoFormatado = codigo
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()

    const { data: codigoEncontrado, error: erroCodigo } = await supabase
      .from('codigos_vinculo')
      .select('*')
      .eq('codigo', codigoFormatado)
      .eq('ativo', true)
      .single()

    if (erroCodigo || !codigoEncontrado) {
      alert('Código de vínculo inválido ou inativo')
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: {
          nome,
          codigo_vinculo: codigoFormatado,
          empresa_nome: codigoEncontrado.empresa_nome,
          tipo_acesso: 'cliente',
        },
      },
    })

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      const { error: erroPerfil } = await supabase.from('perfis').insert({
        id: data.user.id,
        nome,
        email,
        tipo_acesso: 'cliente',
        tipo_usuario: 'cliente',
        empresa_id: null,
        codigo_vinculo: codigoFormatado,
        empresa_nome: codigoEncontrado.empresa_nome,
        ativo: true,
      })

      if (erroPerfil) {
        alert('Conta criada, mas houve erro ao salvar o perfil.')
        console.log(erroPerfil)
        setLoading(false)
        return
      }
    }

    setLoading(false)

    alert('Conta criada com sucesso. Agora faça login.')

    window.location.href = '/login'
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
            Criar conta
          </h1>

          <p className="text-slate-400">
            Informe seus dados e o código de vínculo fornecido pela HC.
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
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />

          <input
            placeholder="Código de vínculo. Ex: HCSKYSEA"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
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