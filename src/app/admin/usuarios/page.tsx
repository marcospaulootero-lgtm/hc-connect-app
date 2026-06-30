'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroDashboard, setFiltroDashboard] = useState('')

  useEffect(() => {
    aplicarFiltrosDaDashboard()
    carregarUsuarios()
  }, [])


  function aplicarFiltrosDaDashboard() {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const origemDashboard = params.get('origem') === 'dashboard' || params.get('dash') === '1'

    if (!origemDashboard) return

    const tipoUrl = params.get('tipo') || ''
    const statusUrl = params.get('status') || ''
    const buscaUrl = params.get('busca') || ''

    if (tipoUrl) setFiltroTipo(tipoUrl)
    if (statusUrl) setFiltroStatus(statusUrl)
    if (buscaUrl) setBusca(buscaUrl)

    const partes = [
      tipoUrl ? `tipo ${tipoUrl}` : '',
      statusUrl ? `status ${statusUrl}` : '',
      buscaUrl ? `busca ${buscaUrl}` : '',
    ].filter(Boolean)

    setFiltroDashboard(partes.length ? `Dashboard: ${partes.join(' • ')}` : 'Dashboard: usuários filtrados')
  }

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

    const confirmar = confirm(
      `${novoStatus ? 'Ativar' : 'Inativar'} o acesso de ${usuario.nome || usuario.email}?`
    )

    if (!confirmar) return

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
    const confirmar = confirm(
      `Alterar ${usuario.nome || usuario.email} para ${novoTipo.toUpperCase()}?`
    )

    if (!confirmar) return

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

  function empresaUsuario(usuario: any) {
    return String(
      usuario.empresa_nome ||
      usuario.nome_empresa ||
      usuario.empresa ||
      usuario.razao_social ||
      usuario.nome_fantasia ||
      usuario.empresa_id ||
      usuario.codigo_vinculo ||
      ''
    ).trim()
  }

  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter((usuario) => {
      const texto = `
        ${usuario.nome}
        ${usuario.email}
        ${empresaUsuario(usuario)}
        ${usuario.tipo_acesso}
      `.toLowerCase()

      const statusUsuario = usuario.ativo === false ? 'inativo' : 'ativo'
      const tipoUsuario = usuario.tipo_acesso || 'cliente'

      const matchBusca = texto.includes(busca.toLowerCase())
      const matchTipo = !filtroTipo || tipoUsuario === filtroTipo
      const matchStatus = !filtroStatus || statusUsuario === filtroStatus

      return matchBusca && matchTipo && matchStatus
    })
  }, [usuarios, busca, filtroTipo, filtroStatus])

  const totalUsuarios = usuarios.length
  const totalAdmins = usuarios.filter((u) => u.tipo_acesso === 'admin').length
  const totalClientes = usuarios.filter((u) => (u.tipo_acesso || 'cliente') === 'cliente').length
  const totalAtivos = usuarios.filter((u) => u.ativo !== false).length
  const totalInativos = usuarios.filter((u) => u.ativo === false).length

  return (
    <main className="w-full max-w-none p-8 text-white">
      <div className="mb-8 flex flex-col lg:flex-row justify-between gap-6">
        <div>
          <p className="text-blue-400 font-bold mb-2">
            Controle de acesso
          </p>

          <h1 className="text-5xl font-black mb-2">
            Usuários do portal
          </h1>

          <p className="text-slate-400 text-lg">
            Gerencie clientes, administradores, status de acesso e empresas dos clientes.
          </p>
        </div>

        <button
          onClick={carregarUsuarios}
          className="bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold h-fit"
        >
          Atualizar lista
        </button>
      </div>

      {filtroDashboard && (
        <section className="mb-6 rounded-2xl border border-blue-500/40 bg-blue-600/10 p-4 text-blue-100">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-blue-300">Filtro aplicado pela Dashboard</p>
              <p className="mt-1 font-bold">{filtroDashboard}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                setBusca('')
                setFiltroTipo('')
                setFiltroStatus('')
                setFiltroDashboard('')
              }}
              className="w-fit rounded-xl bg-slate-700 px-4 py-2 text-sm font-black text-white hover:bg-slate-600"
            >
              Limpar filtro
            </button>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-8">
        <Card titulo="Total" valor={totalUsuarios} detalhe="Usuários cadastrados" icone="👥" />
        <Card titulo="Admins" valor={totalAdmins} detalhe="Acesso administrativo" icone="🛡️" />
        <Card titulo="Clientes" valor={totalClientes} detalhe="Acesso ao portal" icone="🏢" />
        <Card titulo="Ativos" valor={totalAtivos} detalhe="Podem acessar" icone="✅" />
        <Card titulo="Inativos" valor={totalInativos} detalhe="Acesso bloqueado" icone="🚫" />
      </section>

      <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7 mb-8">
        <div className="flex flex-col lg:flex-row justify-between gap-5 mb-7">
          <div>
            <h2 className="text-2xl font-black">
              Cadastros realizados
            </h2>

            <p className="text-slate-400 text-sm mt-1">
              Busque, filtre e gerencie as permissões dos usuários do sistema.
            </p>
          </div>

          <button
            onClick={() => {
              setBusca('')
              setFiltroTipo('')
              setFiltroStatus('')
            }}
            className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold h-fit"
          >
            Limpar filtros
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-7">
          <input
            placeholder="Buscar por nome, e-mail ou empresa..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />

          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="admin">Admin</option>
            <option value="cliente">Cliente</option>
          </select>

          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>

          <div className="border border-blue-900 rounded-2xl bg-[#020817] px-5 py-3 text-slate-300 font-bold flex items-center">
            {usuariosFiltrados.length} usuário(s) encontrado(s)
          </div>
        </div>

        {carregando ? (
          <div className="border border-blue-900 bg-[#020817] rounded-2xl p-8 text-slate-400">
            Carregando usuários...
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>E-mail</th>
                  <th>Empresa</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Data cadastro</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {usuariosFiltrados.map((usuario) => {
                  const ativo = usuario.ativo !== false
                  const tipo = usuario.tipo_acesso || 'cliente'

                  return (
                    <tr key={usuario.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black ${
                              tipo === 'admin'
                                ? 'bg-purple-600'
                                : 'bg-blue-600'
                            }`}
                          >
                            {(usuario.nome || usuario.email || '?').charAt(0).toUpperCase()}
                          </div>

                          <div>
                            <p className="font-black">
                              {usuario.nome || '-'}
                            </p>

                            <p className="text-slate-500 text-sm">
                              ID: {usuario.id?.slice(0, 8)}...
                            </p>
                          </div>
                        </div>
                      </td>

                      <td>{usuario.email || '-'}</td>

                      <td>
                        <span className="px-3 py-2 rounded-xl bg-purple-600 text-white text-sm font-black">
                          {empresaUsuario(usuario) || '-'}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`px-3 py-2 rounded-xl text-xs font-black uppercase ${
                            tipo === 'admin'
                              ? 'bg-purple-600 text-white'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {tipo}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`px-3 py-2 rounded-xl text-xs font-black ${
                            ativo
                              ? 'bg-green-600 text-white'
                              : 'bg-red-600 text-white'
                          }`}
                        >
                          {ativo ? 'ATIVO' : 'INATIVO'}
                        </span>
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
                              ativo
                                ? 'bg-yellow-600 hover:bg-yellow-500 px-4 py-2 rounded-xl font-bold'
                                : 'bg-green-600 hover:bg-green-500 px-4 py-2 rounded-xl font-bold'
                            }
                          >
                            {ativo ? 'Inativar' : 'Ativar'}
                          </button>

                          <select
                            value={tipo}
                            onChange={(e) => alterarTipoAcesso(usuario, e.target.value)}
                            className="bg-slate-900 border border-blue-600 rounded-xl px-3 py-2 text-white font-bold uppercase"
                          >
                            <option value="cliente">CLIENTE</option>
                            <option value="admin">ADMIN</option>
                          </select>

                          <button
                            onClick={() => excluirUsuario(usuario)}
                            className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded-xl font-bold"
                          >
                            Excluir acesso
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {usuariosFiltrados.length === 0 && (
              <div className="border border-blue-900 bg-[#020817] rounded-2xl p-8 text-center text-slate-400 mt-6">
                Nenhum usuário encontrado.
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  )
}

function Card({ titulo, valor, detalhe, icone }: any) {
  return (
    <div className="border border-blue-900 rounded-3xl bg-[#071225] p-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <p className="text-slate-300 font-bold">{titulo}</p>
          <h2 className="text-5xl font-black mt-4 text-white">{valor}</h2>
          <p className="text-slate-400 mt-2">{detalhe}</p>
        </div>

        <div className="text-4xl">{icone}</div>
      </div>
    </div>
  )
}