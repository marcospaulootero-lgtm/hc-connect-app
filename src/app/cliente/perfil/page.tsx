'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type Mensagem = {
  tipo: 'sucesso' | 'erro'
  texto: string
}

export default function PerfilClientePage() {
  const [usuario, setUsuario] = useState<any>(null)
  const [perfil, setPerfil] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [salvandoSenha, setSalvandoSenha] = useState(false)
  const [mensagem, setMensagem] = useState<Mensagem | null>(null)

  const [form, setForm] = useState({
    contato_responsavel: '',
    telefone: '',
    whatsapp: '',
    email_contato: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
  })

  const [senha, setSenha] = useState({
    nova: '',
    confirmar: '',
  })

  useEffect(() => {
    carregarPerfil()
  }, [])

  async function carregarPerfil() {
    setCarregando(true)
    setMensagem(null)

    const {
      data: { user },
      error: erroUsuario,
    } = await supabase.auth.getUser()

    if (erroUsuario || !user) {
      window.location.href = '/login'
      return
    }

    setUsuario(user)

    const { data, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      setMensagem({
        tipo: 'erro',
        texto: 'Não foi possível carregar seu perfil.',
      })
      setCarregando(false)
      return
    }

    setPerfil(data)

    setForm({
      contato_responsavel: data?.contato_responsavel || data?.nome || '',
      telefone: data?.telefone || '',
      whatsapp: data?.whatsapp || '',
      email_contato: data?.email_contato || data?.email || user.email || '',
      endereco: data?.endereco || '',
      numero: data?.numero || '',
      complemento: data?.complemento || '',
      bairro: data?.bairro || '',
      cidade: data?.cidade || '',
      estado: data?.estado || '',
      cep: data?.cep || '',
    })

    setCarregando(false)
  }

  function atualizarCampo(campo: keyof typeof form, valor: string) {
    setForm((atual) => ({
      ...atual,
      [campo]: valor,
    }))
  }

  async function salvarPerfil() {
    setSalvando(true)
    setMensagem(null)

    const { error } = await supabase.rpc('atualizar_meu_perfil_cliente', {
      p_contato_responsavel: form.contato_responsavel,
      p_telefone: form.telefone,
      p_whatsapp: form.whatsapp,
      p_email_contato: form.email_contato,
      p_endereco: form.endereco,
      p_numero: form.numero,
      p_complemento: form.complemento,
      p_bairro: form.bairro,
      p_cidade: form.cidade,
      p_estado: form.estado,
      p_cep: form.cep,
    })

    if (error) {
      setMensagem({
        tipo: 'erro',
        texto: `Erro ao salvar perfil: ${error.message}`,
      })
      setSalvando(false)
      return
    }

    setMensagem({
      tipo: 'sucesso',
      texto: 'Perfil atualizado com sucesso.',
    })

    setSalvando(false)
    await carregarPerfil()
  }

  async function trocarSenha() {
    setSalvandoSenha(true)
    setMensagem(null)

    if (!senha.nova || senha.nova.length < 6) {
      setMensagem({
        tipo: 'erro',
        texto: 'A nova senha precisa ter pelo menos 6 caracteres.',
      })
      setSalvandoSenha(false)
      return
    }

    if (senha.nova !== senha.confirmar) {
      setMensagem({
        tipo: 'erro',
        texto: 'A confirmação da senha não confere.',
      })
      setSalvandoSenha(false)
      return
    }

    const { error } = await supabase.auth.updateUser({
      password: senha.nova,
    })

    if (error) {
      setMensagem({
        tipo: 'erro',
        texto: `Erro ao trocar senha: ${error.message}`,
      })
      setSalvandoSenha(false)
      return
    }

    setSenha({
      nova: '',
      confirmar: '',
    })

    setMensagem({
      tipo: 'sucesso',
      texto: 'Senha alterada com sucesso.',
    })

    setSalvandoSenha(false)
  }

  if (carregando) {
    return (
      <main className="min-h-screen bg-[#020817] p-6 text-white">
        <div className="rounded-3xl border border-blue-900 bg-[#071225] p-6">
          Carregando perfil...
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#020817] p-6 text-white">
      <section className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-black text-blue-400">Portal do cliente</p>
            <h1 className="mt-2 text-4xl font-black">Meu perfil</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Atualize seus dados de contato, endereço e senha de acesso ao HC Connect.
            </p>
          </div>

          <Link
            href="/cliente"
            className="rounded-xl bg-blue-600 px-5 py-3 text-center font-black hover:bg-blue-500"
          >
            Voltar ao portal
          </Link>
        </div>

        {mensagem && (
          <div
            className={
              mensagem.tipo === 'sucesso'
                ? 'mb-5 rounded-2xl border border-green-800 bg-green-900/20 p-4 font-bold text-green-300'
                : 'mb-5 rounded-2xl border border-red-800 bg-red-900/20 p-4 font-bold text-red-300'
            }
          >
            {mensagem.texto}
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <CardResumo titulo="Cliente" valor={perfil?.nome || perfil?.empresa || perfil?.email || usuario?.email || '-'} />
          <CardResumo titulo="E-mail de login" valor={usuario?.email || '-'} />
          <CardResumo titulo="Tipo de acesso" valor={perfil?.tipo_acesso || 'cliente'} />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="rounded-3xl border border-blue-900 bg-[#071225] p-5 xl:col-span-2">
            <div className="mb-5">
              <h2 className="text-2xl font-black">Dados de contato e endereço</h2>
              <p className="mt-1 text-sm text-slate-400">
                Essas informações ajudam a HC a falar com o responsável certo e manter seus dados atualizados.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Campo
                label="Responsável / contato principal"
                value={form.contato_responsavel}
                onChange={(v) => atualizarCampo('contato_responsavel', v)}
              />

              <Campo
                label="E-mail de contato"
                value={form.email_contato}
                onChange={(v) => atualizarCampo('email_contato', v)}
              />

              <Campo
                label="Telefone"
                value={form.telefone}
                onChange={(v) => atualizarCampo('telefone', v)}
              />

              <Campo
                label="WhatsApp"
                value={form.whatsapp}
                onChange={(v) => atualizarCampo('whatsapp', v)}
              />

              <Campo
                label="Endereço"
                value={form.endereco}
                onChange={(v) => atualizarCampo('endereco', v)}
              />

              <Campo
                label="Número"
                value={form.numero}
                onChange={(v) => atualizarCampo('numero', v)}
              />

              <Campo
                label="Complemento"
                value={form.complemento}
                onChange={(v) => atualizarCampo('complemento', v)}
              />

              <Campo
                label="Bairro"
                value={form.bairro}
                onChange={(v) => atualizarCampo('bairro', v)}
              />

              <Campo
                label="Cidade"
                value={form.cidade}
                onChange={(v) => atualizarCampo('cidade', v)}
              />

              <Campo
                label="Estado"
                value={form.estado}
                onChange={(v) => atualizarCampo('estado', v)}
              />

              <Campo
                label="CEP"
                value={form.cep}
                onChange={(v) => atualizarCampo('cep', v)}
              />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={salvarPerfil}
                disabled={salvando}
                className="rounded-xl bg-green-700 px-6 py-3 font-black hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {salvando ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-blue-900 bg-[#071225] p-5">
            <div className="mb-5">
              <h2 className="text-2xl font-black">Trocar senha</h2>
              <p className="mt-1 text-sm text-slate-400">
                A senha é alterada diretamente no acesso do usuário.
              </p>
            </div>

            <div className="space-y-4">
              <Campo
                label="Nova senha"
                type="password"
                value={senha.nova}
                onChange={(v) => setSenha((atual) => ({ ...atual, nova: v }))}
              />

              <Campo
                label="Confirmar nova senha"
                type="password"
                value={senha.confirmar}
                onChange={(v) => setSenha((atual) => ({ ...atual, confirmar: v }))}
              />
            </div>

            <button
              type="button"
              onClick={trocarSenha}
              disabled={salvandoSenha}
              className="mt-6 w-full rounded-xl bg-purple-700 px-6 py-3 font-black hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {salvandoSenha ? 'Alterando...' : 'Alterar senha'}
            </button>

            <div className="mt-5 rounded-2xl border border-blue-900 bg-[#020817] p-4 text-sm text-slate-400">
              <strong className="text-blue-300">Importante:</strong> o e-mail de login não é alterado aqui. Esta tela altera apenas o e-mail de contato e a senha.
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

function CardResumo({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-2xl border border-blue-900 bg-[#071225] p-4">
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">{titulo}</p>
      <p className="mt-2 break-words text-lg font-black text-white">{valor}</p>
    </div>
  )
}

function Campo({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (valor: string) => void
  type?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase tracking-widest text-slate-400">
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-blue-900 bg-[#020817] px-4 py-3 font-bold text-white outline-none focus:border-blue-500"
      />
    </label>
  )
}
