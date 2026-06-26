'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'

type ClienteFaturamento = {
  id: string
  codigo_hc: string | null
  nome_empresa: string
  nome_contato: string | null
  endereco: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
  cnpj: string | null
  cpf: string | null
  email: string | null
  contato: string | null
  inscricao_estadual: string | null
  inscricao_municipal: string | null
  observacoes: string | null
  ativo: boolean | null
  criado_em: string | null
  atualizado_em: string | null
}

type FormState = {
  codigo_hc: string
  nome_empresa: string
  nome_contato: string
  endereco: string
  cidade: string
  estado: string
  cep: string
  cnpj: string
  cpf: string
  email: string
  contato: string
  inscricao_estadual: string
  inscricao_municipal: string
  observacoes: string
  ativo: boolean
}

const formVazio: FormState = {
  codigo_hc: '',
  nome_empresa: '',
  nome_contato: '',
  endereco: '',
  cidade: '',
  estado: '',
  cep: '',
  cnpj: '',
  cpf: '',
  email: '',
  contato: '',
  inscricao_estadual: '',
  inscricao_municipal: '',
  observacoes: '',
  ativo: true,
}

export default function ClientesFaturamentoPage() {
  const [clientes, setClientes] = useState<ClienteFaturamento[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>(formVazio)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'TODOS' | 'ATIVOS' | 'INATIVOS'>('ATIVOS')
  const [filtroEstado, setFiltroEstado] = useState('TODOS')

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setLoading(true)

    const { data, error } = await supabase
      .from('clientes_faturamento')
      .select('*')
      .order('nome_empresa', { ascending: true })

    if (error) {
      alert('Erro ao carregar clientes de faturamento: ' + error.message)
      setLoading(false)
      return
    }

    setClientes((data as ClienteFaturamento[]) || [])
    setLoading(false)
  }

  function normalizarBusca(valor: any) {
    return String(valor || '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
  }

  function limparDocumento(valor: any) {
    return String(valor || '').replace(/\D/g, '')
  }

  function formatarCnpj(valor: any) {
    const numeros = limparDocumento(valor)
    if (!numeros) return ''
    if (numeros.length !== 14) return String(valor || '').trim()

    return numeros.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  }

  function formatarCpf(valor: any) {
    const numeros = limparDocumento(valor)
    if (!numeros) return ''
    if (numeros.length !== 11) return String(valor || '').trim()

    return numeros.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  }

  function formatarCep(valor: any) {
    const numeros = limparDocumento(valor)
    if (!numeros) return ''
    if (numeros.length !== 8) return String(valor || '').trim()

    return numeros.replace(/^(\d{2})(\d{3})(\d{3})$/, '$1.$2-$3')
  }

  function pegarCampoExcel(linha: any, nomes: string[]) {
    for (const nome of nomes) {
      if (linha[nome] !== undefined && linha[nome] !== null && linha[nome] !== '') {
        return linha[nome]
      }
    }

    const chaves = Object.keys(linha || {})

    for (const nome of nomes) {
      const nomeNormalizado = normalizarBusca(nome)
      const chaveEncontrada = chaves.find((chave) => normalizarBusca(chave) === nomeNormalizado)

      if (
        chaveEncontrada &&
        linha[chaveEncontrada] !== undefined &&
        linha[chaveEncontrada] !== null &&
        linha[chaveEncontrada] !== ''
      ) {
        return linha[chaveEncontrada]
      }
    }

    const nomesNormalizados = nomes.map(normalizarBusca)

    for (const chave of chaves) {
      const chaveNormalizada = normalizarBusca(chave)

      if (
        nomesNormalizados.some((nome) => chaveNormalizada.includes(nome) || nome.includes(chaveNormalizada)) &&
        linha[chave] !== undefined &&
        linha[chave] !== null &&
        linha[chave] !== ''
      ) {
        return linha[chave]
      }
    }

    return ''
  }

  function montarPayload(origem: FormState) {
    return {
      codigo_hc: origem.codigo_hc.trim() || null,
      nome_empresa: origem.nome_empresa.trim(),
      nome_contato: origem.nome_contato.trim() || null,
      endereco: origem.endereco.trim() || null,
      cidade: origem.cidade.trim() || null,
      estado: origem.estado.trim() || null,
      cep: formatarCep(origem.cep.trim()) || null,
      cnpj: formatarCnpj(origem.cnpj.trim()) || null,
      cpf: formatarCpf(origem.cpf.trim()) || null,
      email: origem.email.trim() || null,
      contato: origem.contato.trim() || null,
      inscricao_estadual: origem.inscricao_estadual.trim() || null,
      inscricao_municipal: origem.inscricao_municipal.trim() || null,
      observacoes: origem.observacoes.trim() || null,
      ativo: origem.ativo,
    }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()

    if (!form.nome_empresa.trim()) {
      alert('Informe o nome da empresa.')
      return
    }

    const cnpjLimpo = limparDocumento(form.cnpj)
    const cpfLimpo = limparDocumento(form.cpf)

    if (!cnpjLimpo && !cpfLimpo) {
      alert('Informe CNPJ ou CPF para usar como chave fiscal.')
      return
    }

    if (cnpjLimpo && cnpjLimpo.length !== 14) {
      alert('CNPJ inválido. Confira se possui 14 números.')
      return
    }

    if (cpfLimpo && cpfLimpo.length !== 11) {
      alert('CPF inválido. Confira se possui 11 números.')
      return
    }

    setSalvando(true)

    const payload = montarPayload(form)

    if (editandoId) {
      const { error } = await supabase
        .from('clientes_faturamento')
        .update(payload)
        .eq('id', editandoId)

      setSalvando(false)

      if (error) {
        alert('Erro ao atualizar cliente: ' + error.message)
        return
      }

      alert('Cliente de faturamento atualizado com sucesso.')
    } else {
      const { error } = await supabase
        .from('clientes_faturamento')
        .insert([payload])

      setSalvando(false)

      if (error) {
        alert('Erro ao cadastrar cliente: ' + error.message)
        return
      }

      alert('Cliente de faturamento cadastrado com sucesso.')
    }

    limparFormulario()
    await carregar()
  }

  function editar(item: ClienteFaturamento) {
    setEditandoId(item.id)
    setForm({
      codigo_hc: item.codigo_hc || '',
      nome_empresa: item.nome_empresa || '',
      nome_contato: item.nome_contato || '',
      endereco: item.endereco || '',
      cidade: item.cidade || '',
      estado: item.estado || '',
      cep: item.cep || '',
      cnpj: item.cnpj || '',
      cpf: item.cpf || '',
      email: item.email || '',
      contato: item.contato || '',
      inscricao_estadual: item.inscricao_estadual || '',
      inscricao_municipal: item.inscricao_municipal || '',
      observacoes: item.observacoes || '',
      ativo: item.ativo !== false,
    })

    setTimeout(() => {
      document.getElementById('form_cliente_faturamento')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  function limparFormulario() {
    setEditandoId(null)
    setForm(formVazio)
  }

  async function alternarAtivo(item: ClienteFaturamento) {
    const novoStatus = item.ativo === false
    const confirmar = confirm(
      novoStatus
        ? `Ativar ${item.nome_empresa}?`
        : `Inativar ${item.nome_empresa}?`
    )

    if (!confirmar) return

    const { error } = await supabase
      .from('clientes_faturamento')
      .update({ ativo: novoStatus })
      .eq('id', item.id)

    if (error) {
      alert('Erro ao alterar status: ' + error.message)
      return
    }

    await carregar()
  }

  async function excluir(item: ClienteFaturamento) {
    const confirmar = confirm(
      `Excluir definitivamente o cadastro fiscal de ${item.nome_empresa}?\n\nEssa ação não deve ser usada se o cliente já tiver faturas emitidas.`
    )

    if (!confirmar) return

    const { error } = await supabase
      .from('clientes_faturamento')
      .delete()
      .eq('id', item.id)

    if (error) {
      alert('Erro ao excluir cliente: ' + error.message)
      return
    }

    await carregar()
  }

  async function importarExcel(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0]
    if (!arquivo) return

    if (!confirm('Importar esta lista de clientes para faturamento?\n\nClientes com o mesmo CNPJ/CPF serão atualizados.')) {
      event.target.value = ''
      return
    }

    setImportando(true)

    try {
      const XLSX = await import('xlsx')
      const buffer = await arquivo.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const linhas: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })

      const registros = linhas
        .map((linha) => {
          const nomeEmpresa = String(
            pegarCampoExcel(linha, [
              'Nome da empresa',
              'NOME DA EMPRESA',
              'EMPRESA',
              'RAZÃO SOCIAL',
              'RAZAO SOCIAL',
              'CLIENTE',
            ]) || ''
          ).trim()

          const cnpj = formatarCnpj(pegarCampoExcel(linha, ['CNPJ', 'CNPJ/CPF', 'DOCUMENTO']))
          const cpf = formatarCpf(pegarCampoExcel(linha, ['CPF']))

          return {
            codigo_hc: String(pegarCampoExcel(linha, ['ID', 'CODIGO', 'CÓDIGO', 'Código HC', 'CODIGO HC']) || '').trim() || null,
            nome_empresa: nomeEmpresa,
            nome_contato: String(pegarCampoExcel(linha, ['Nome de Contato', 'NOME DE CONTATO', 'CONTATO NOME', 'Responsável']) || '').trim() || null,
            endereco: String(pegarCampoExcel(linha, ['Endereço', 'ENDEREÇO', 'ENDERECO', 'Endereco', 'LOGRADOURO']) || '').trim() || null,
            cidade: String(pegarCampoExcel(linha, ['Cidade', 'CIDADE', 'MUNICÍPIO', 'MUNICIPIO']) || '').trim() || null,
            estado: String(pegarCampoExcel(linha, ['Estado', 'ESTADO', 'UF']) || '').trim() || null,
            cep: formatarCep(pegarCampoExcel(linha, ['CEP', 'Cep'])) || null,
            cnpj: cnpj || null,
            cpf: cpf || null,
            email: String(pegarCampoExcel(linha, ['Email', 'E-mail', 'EMAIL', 'E-MAIL']) || '').trim() || null,
            contato: String(pegarCampoExcel(linha, ['Contato', 'CONTATO', 'Telefone', 'TELEFONE', 'CELULAR']) || '').trim() || null,
            inscricao_estadual: String(pegarCampoExcel(linha, ['INSCR. ESTADUAL Nº', 'INSCR ESTADUAL', 'INSCRICAO ESTADUAL', 'INSCRIÇÃO ESTADUAL', 'IE']) || '').trim() || null,
            inscricao_municipal: String(pegarCampoExcel(linha, ['INSCR. MUNICIPAL Nº', 'INSCR MUNICIPAL', 'INSCRICAO MUNICIPAL', 'INSCRIÇÃO MUNICIPAL', 'IM']) || '').trim() || null,
            observacoes: String(pegarCampoExcel(linha, ['Observações', 'OBSERVAÇÕES', 'OBSERVACOES', 'OBS']) || '').trim() || null,
            ativo: true,
          }
        })
        .filter((item) => {
          const documento = limparDocumento(item.cnpj || item.cpf)
          return item.nome_empresa && documento.length >= 11
        })

      if (registros.length === 0) {
        alert('Nenhum cliente válido encontrado no Excel. Confira se existem Nome da empresa e CNPJ/CPF.')
        setImportando(false)
        event.target.value = ''
        return
      }

      const porDocumento = new Map<string, any>()
      let duplicadasNoExcel = 0

      registros.forEach((registro) => {
        const chave = limparDocumento(registro.cnpj || registro.cpf)
        if (porDocumento.has(chave)) duplicadasNoExcel += 1
        porDocumento.set(chave, registro)
      })

      const registrosUnicos = Array.from(porDocumento.values())

      const { data: existentes, error: erroExistentes } = await supabase
        .from('clientes_faturamento')
        .select('id, cnpj, cpf')

      if (erroExistentes) {
        alert('Erro ao buscar clientes existentes: ' + erroExistentes.message)
        setImportando(false)
        return
      }

      const existentesPorDocumento = new Map(
        ((existentes as any[]) || []).map((item) => [limparDocumento(item.cnpj || item.cpf), item])
      )

      const novos: any[] = []
      const atualizacoes: { id: string; payload: any }[] = []

      registrosUnicos.forEach((registro) => {
        const existente = existentesPorDocumento.get(limparDocumento(registro.cnpj || registro.cpf))

        if (existente?.id) {
          atualizacoes.push({ id: existente.id, payload: registro })
        } else {
          novos.push(registro)
        }
      })

      for (let i = 0; i < novos.length; i += 500) {
        const lote = novos.slice(i, i + 500)
        const { error } = await supabase.from('clientes_faturamento').insert(lote)

        if (error) {
          alert('Erro ao importar novos clientes: ' + error.message)
          setImportando(false)
          return
        }
      }

      for (const item of atualizacoes) {
        const { error } = await supabase
          .from('clientes_faturamento')
          .update(item.payload)
          .eq('id', item.id)

        if (error) {
          alert('Erro ao atualizar cliente existente: ' + error.message)
          setImportando(false)
          return
        }
      }

      alert(
        `Importação concluída.\n\n` +
          `Novos clientes: ${novos.length}\n` +
          `Clientes atualizados: ${atualizacoes.length}` +
          (duplicadasNoExcel > 0 ? `\nDuplicados no Excel mesclados: ${duplicadasNoExcel}` : '')
      )

      await carregar()
    } catch (error: any) {
      alert('Erro ao importar Excel: ' + error.message)
    }

    setImportando(false)
    event.target.value = ''
  }

  const estados = useMemo(() => {
    return Array.from(new Set(clientes.map((item) => item.estado).filter(Boolean)))
      .map(String)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [clientes])

  const filtrados = useMemo(() => {
    const termo = normalizarBusca(busca)

    return clientes.filter((item) => {
      const texto = normalizarBusca(`
        ${item.codigo_hc || ''}
        ${item.nome_empresa || ''}
        ${item.nome_contato || ''}
        ${item.cnpj || ''}
        ${item.cpf || ''}
        ${item.endereco || ''}
        ${item.cidade || ''}
        ${item.estado || ''}
        ${item.cep || ''}
        ${item.email || ''}
        ${item.contato || ''}
        ${item.inscricao_estadual || ''}
        ${item.inscricao_municipal || ''}
      `)

      const passaBusca = !termo || texto.includes(termo)
      const passaEstado = filtroEstado === 'TODOS' || item.estado === filtroEstado
      const passaStatus =
        filtroStatus === 'TODOS' ||
        (filtroStatus === 'ATIVOS' && item.ativo !== false) ||
        (filtroStatus === 'INATIVOS' && item.ativo === false)

      return passaBusca && passaEstado && passaStatus
    })
  }, [clientes, busca, filtroEstado, filtroStatus])

  const totais = useMemo(() => {
    const ativos = clientes.filter((item) => item.ativo !== false)
    const inativos = clientes.filter((item) => item.ativo === false)
    const cidades = new Set(clientes.map((item) => item.cidade).filter(Boolean))
    const estadosLista = new Set(clientes.map((item) => item.estado).filter(Boolean))
    const comEmail = clientes.filter((item) => item.email).length

    return {
      total: clientes.length,
      ativos: ativos.length,
      inativos: inativos.length,
      cidades: cidades.size,
      estados: estadosLista.size,
      comEmail,
    }
  }, [clientes])

  return (
    <main className="w-full max-w-none p-6 lg:p-8 text-white">
      <div className="mb-8 flex flex-col xl:flex-row justify-between gap-6">
        <div>
          <p className="text-blue-400 font-bold mb-2">Faturamento</p>
          <h1 className="text-5xl font-black mb-2">Clientes para faturamento</h1>
          <p className="text-slate-400 text-lg max-w-4xl">
            Cadastro fiscal usado para carregar automaticamente os dados do cliente no emissor de faturas.
          </p>
          <p className="text-slate-500 text-sm mt-3">
            Estrutura compatível com seu Excel: Nome da empresa, Nome de Contato, Endereço, Cidade, Estado, CEP, CNPJ, CPF, Email, Contato, Inscrições e ID.
          </p>
        </div>

        <div className="flex gap-3 flex-wrap h-fit">
          <a
            href="/admin/faturas"
            className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold"
          >
            Faturas clientes
          </a>

          <label className="bg-emerald-600 hover:bg-emerald-500 px-5 py-3 rounded-xl font-bold cursor-pointer">
            {importando ? 'Importando...' : 'Importar Excel'}
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              disabled={importando}
              onChange={importarExcel}
            />
          </label>

          <button
            onClick={carregar}
            className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl font-bold"
          >
            Atualizar
          </button>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-6 gap-5 mb-8">
        <KpiCard titulo="Total" valor={totais.total} detalhe="Cadastros fiscais" icone="🏢" />
        <KpiCard titulo="Ativos" valor={totais.ativos} detalhe="Disponíveis para fatura" icone="✅" />
        <KpiCard titulo="Inativos" valor={totais.inativos} detalhe="Ocultos na emissão" icone="🚫" />
        <KpiCard titulo="Cidades" valor={totais.cidades} detalhe="Bases cadastradas" icone="🏙ï¸" />
        <KpiCard titulo="Estados" valor={totais.estados} detalhe="UFs na lista" icone="🗺ï¸" />
        <KpiCard titulo="Com e-mail" valor={totais.comEmail} detalhe="Contato fiscal" icone="📧" />
      </section>

      <section id="form_cliente_faturamento" className="border border-blue-900 rounded-3xl bg-[#071225] p-7 mb-8">
        <div className="flex flex-col lg:flex-row justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-black">
              {editandoId ? 'Editar cadastro fiscal' : 'Cadastrar cliente para faturamento'}
            </h2>
            <p className="text-slate-400 text-sm">
              A chave principal é o CNPJ ou CPF. O mesmo cliente pode ter mais de uma filial cadastrada.
            </p>
          </div>

          {editandoId && (
            <button
              onClick={limparFormulario}
              className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold h-fit"
            >
              Cancelar edição
            </button>
          )}
        </div>

        <form onSubmit={salvar} className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-6 gap-4">
          <Campo label="ID HC">
            <input
              value={form.codigo_hc}
              onChange={(e) => setForm({ ...form, codigo_hc: e.target.value })}
              placeholder="Ex: HC0001"
            />
          </Campo>

          <div className="md:col-span-3 xl:col-span-3">
            <Campo label="Nome da empresa">
              <input
                value={form.nome_empresa}
                onChange={(e) => setForm({ ...form, nome_empresa: e.target.value })}
                placeholder="Razão social / Nome da empresa"
              />
            </Campo>
          </div>

          <div className="md:col-span-2">
            <Campo label="Nome de Contato">
              <input
                value={form.nome_contato}
                onChange={(e) => setForm({ ...form, nome_contato: e.target.value })}
                placeholder="Pessoa de contato"
              />
            </Campo>
          </div>

          <Campo label="CNPJ">
            <input
              value={form.cnpj}
              onChange={(e) => setForm({ ...form, cnpj: formatarCnpj(e.target.value) })}
              placeholder="00.000.000/0000-00"
            />
          </Campo>

          <Campo label="CPF">
            <input
              value={form.cpf}
              onChange={(e) => setForm({ ...form, cpf: formatarCpf(e.target.value) })}
              placeholder="000.000.000-00"
            />
          </Campo>

          <div className="md:col-span-2 xl:col-span-3">
            <Campo label="Endereço">
              <input
                value={form.endereco}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                placeholder="Rua, número, sala, bairro"
              />
            </Campo>
          </div>

          <Campo label="Cidade">
            <input
              value={form.cidade}
              onChange={(e) => setForm({ ...form, cidade: e.target.value })}
              placeholder="Cidade"
            />
          </Campo>

          <Campo label="Estado">
            <input
              value={form.estado}
              onChange={(e) => setForm({ ...form, estado: e.target.value })}
              placeholder="Estado ou UF"
            />
          </Campo>

          <Campo label="CEP">
            <input
              value={form.cep}
              onChange={(e) => setForm({ ...form, cep: formatarCep(e.target.value) })}
              placeholder="00.000-000"
            />
          </Campo>

          <Campo label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="financeiro@cliente.com"
            />
          </Campo>

          <Campo label="Contato">
            <input
              value={form.contato}
              onChange={(e) => setForm({ ...form, contato: e.target.value })}
              placeholder="Telefone / WhatsApp"
            />
          </Campo>

          <Campo label="Inscr. Estadual Nº">
            <input
              value={form.inscricao_estadual}
              onChange={(e) => setForm({ ...form, inscricao_estadual: e.target.value })}
              placeholder="IE"
            />
          </Campo>

          <Campo label="Inscr. Municipal Nº">
            <input
              value={form.inscricao_municipal}
              onChange={(e) => setForm({ ...form, inscricao_municipal: e.target.value })}
              placeholder="IM"
            />
          </Campo>

          <Campo label="Status">
            <select
              value={form.ativo ? 'ATIVO' : 'INATIVO'}
              onChange={(e) => setForm({ ...form, ativo: e.target.value === 'ATIVO' })}
            >
              <option value="ATIVO">Ativo</option>
              <option value="INATIVO">Inativo</option>
            </select>
          </Campo>

          <div className="md:col-span-4 xl:col-span-6">
            <Campo label="Observações">
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                className="min-h-[80px]"
                placeholder="Observações internas para emissão de fatura"
              />
            </Campo>
          </div>

          <button
            type="submit"
            disabled={salvando}
            className="md:col-span-4 xl:col-span-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 px-5 py-4 rounded-2xl font-black"
          >
            {salvando ? 'Salvando...' : editandoId ? 'Salvar edição' : 'Cadastrar cliente'}
          </button>
        </form>
      </section>

      <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
        <div className="flex flex-col xl:flex-row justify-between gap-5 mb-6">
          <div>
            <h2 className="text-2xl font-black">Lista de clientes para faturamento</h2>
            <p className="text-slate-400 text-sm">
              {filtrados.length} de {clientes.length} cadastro(s) encontrado(s)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 w-full xl:max-w-[1050px]">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por empresa, CNPJ, CPF, cidade, e-mail..."
            />

            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="TODOS">Todos os estados</option>
              {estados.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>

            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as any)}>
              <option value="ATIVOS">Ativos</option>
              <option value="INATIVOS">Inativos</option>
              <option value="TODOS">Todos</option>
            </select>

            <button
              onClick={() => {
                setBusca('')
                setFiltroEstado('TODOS')
                setFiltroStatus('ATIVOS')
              }}
              className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold"
            >
              Limpar filtros
            </button>
          </div>
        </div>

        {loading ? (
          <div className="border border-blue-900 bg-[#020817] rounded-2xl p-6 text-slate-400">
            Carregando clientes...
          </div>
        ) : filtrados.length === 0 ? (
          <div className="border border-blue-900 bg-[#020817] rounded-2xl p-6 text-slate-400">
            Nenhum cliente encontrado.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1900px] border-collapse text-sm [&_th]:border-b [&_th]:border-blue-900 [&_th]:px-3 [&_th]:py-3 [&_th]:text-left [&_th]:font-black [&_th]:text-slate-300 [&_td]:px-3 [&_td]:py-4 [&_td]:align-top">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nome da empresa</th>
                  <th>Contato</th>
                  <th>CNPJ</th>
                  <th>CPF</th>
                  <th>Endereço</th>
                  <th>Cidade</th>
                  <th>Estado</th>
                  <th>CEP</th>
                  <th>Email</th>
                  <th>Contato</th>
                  <th>IE</th>
                  <th>IM</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {filtrados.map((item) => (
                  <tr key={item.id} className="border-b border-blue-900/60 hover:bg-[#0b1730] transition">
                    <td>
                      <strong className="text-blue-300">{item.codigo_hc || '-'}</strong>
                    </td>

                    <td className="max-w-[360px]">
                      <strong className="text-white">{item.nome_empresa || '-'}</strong>
                      {item.observacoes ? (
                        <p className="text-slate-500 text-xs mt-1 line-clamp-2">{item.observacoes}</p>
                      ) : null}
                    </td>

                    <td>{item.nome_contato || '-'}</td>
                    <td className="font-bold text-slate-300">{item.cnpj || '-'}</td>
                    <td>{item.cpf || '-'}</td>
                    <td className="max-w-[340px]">{item.endereco || '-'}</td>
                    <td>{item.cidade || '-'}</td>
                    <td>{item.estado || '-'}</td>
                    <td>{item.cep || '-'}</td>
                    <td>{item.email || '-'}</td>
                    <td>{item.contato || '-'}</td>
                    <td>{item.inscricao_estadual || '-'}</td>
                    <td>{item.inscricao_municipal || '-'}</td>
                    <td>
                      <span className={item.ativo !== false ? 'border border-green-500 bg-green-600/20 text-green-300 px-3 py-1 rounded-full text-xs font-black' : 'border border-red-500 bg-red-600/20 text-red-300 px-3 py-1 rounded-full text-xs font-black'}>
                        {item.ativo !== false ? 'ATIVO' : 'INATIVO'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => editar(item)}
                          className="bg-purple-600 hover:bg-purple-500 px-3 py-2 rounded-xl font-bold text-xs"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => alternarAtivo(item)}
                          className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-xl font-bold text-xs"
                        >
                          {item.ativo !== false ? 'Inativar' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => excluir(item)}
                          className="bg-red-700 hover:bg-red-600 px-3 py-2 rounded-xl font-bold text-xs"
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
        )}
      </section>
    </main>
  )
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-slate-300 font-bold mb-2">{label}</label>
      {children}
    </div>
  )
}

function KpiCard({
  titulo,
  valor,
  detalhe,
  icone,
}: {
  titulo: string
  valor: any
  detalhe: string
  icone: string
}) {
  return (
    <div className="border border-blue-900 rounded-3xl bg-[#071225] p-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <p className="text-slate-300 font-bold">{titulo}</p>
          <h2 className="text-4xl font-black mt-4 text-white">{valor}</h2>
          <p className="text-slate-400 mt-2 text-sm">{detalhe}</p>
        </div>

        <div className="text-4xl">{icone}</div>
      </div>
    </div>
  )
}
