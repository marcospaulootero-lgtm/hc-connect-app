'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function CriarUsuarioAdmin({ onCriado }: { onCriado?: () => void }) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [tipoAcesso, setTipoAcesso] = useState('cliente')
  const [ativo, setAtivo] = useState(true)
  const [salvando, setSalvando] = useState(false)

  async function criarUsuario() {
    if (!nome.trim()) {
      alert('Informe o nome.')
      return
    }

    if (!email.trim()) {
      alert('Informe o e-mail.')
      return
    }

    if (!senha.trim() || senha.trim().length < 6) {
      alert('A senha precisa ter pelo menos 6 caracteres.')
      return
    }

    setSalvando(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        alert('Sessão expirada. Faça login novamente.')
        return
      }

      const resp = await fetch('/api/admin/criar-usuario', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          nome,
          email,
          senha,
          tipo_acesso: tipoAcesso,
          ativo,
        }),
      })

      const json = await resp.json()

      if (!resp.ok) {
        throw new Error(json?.error || 'Erro ao criar usuário.')
      }

      alert('Login criado com sucesso.')

      setNome('')
      setEmail('')
      setSenha('')
      setTipoAcesso('cliente')
      setAtivo(true)

      onCriado?.()
    } catch (error: any) {
      alert(error?.message || 'Erro ao criar usuário.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className="card mb-8 border-emerald-800/70">
      <div className="mb-5">
        <p className="text-sm font-black uppercase tracking-widest text-emerald-400">
          Novo acesso
        </p>
        <h2 className="text-2xl font-black">Criar novo login</h2>
        <p className="mt-1 text-sm text-slate-400">
          Crie acesso de cliente ou administrador sem sair do painel.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div>
          <label>Nome</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do usuário" />
        </div>

        <div>
          <label>E-mail</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@empresa.com" />
        </div>

        <div>
          <label>Senha inicial</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="mínimo 6 caracteres"
          />
        </div>

        <div>
          <label>Tipo de acesso</label>
          <select value={tipoAcesso} onChange={(e) => setTipoAcesso(e.target.value)}>
            <option value="cliente">Cliente</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div>
          <label>Status</label>
          <select value={ativo ? 'ativo' : 'bloqueado'} onChange={(e) => setAtivo(e.target.value === 'ativo')}>
            <option value="ativo">Ativo</option>
            <option value="bloqueado">Bloqueado</option>
          </select>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={criarUsuario}
          disabled={salvando}
          className="rounded-2xl bg-emerald-600 px-6 py-4 font-black text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {salvando ? 'Criando...' : '+ Criar login'}
        </button>

        <p className="text-sm text-slate-400">
          O usuário já nasce confirmado e pode acessar o portal com a senha criada.
        </p>
      </div>
    </section>
  )
}
