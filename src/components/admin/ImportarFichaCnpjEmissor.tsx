'use client'

// HC_IMPORTAR_FICHA_CNPJ_EMISSOR_V1

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { proximoCodigoHc } from '@/components/admin/ImportarFichaCnpjCliente'

type DadosFicha = {
  cnpj?: string
  nome_empresa?: string
  endereco?: string
  cidade?: string
  estado?: string
  cep?: string
  email?: string
  contato?: string
  status?: string
  observacoes?: string
}

export type ClienteFiscalCriado = {
  id: string
  codigo_hc?: string | null
  nome_empresa: string
  nome_contato?: string | null
  endereco?: string | null
  cidade?: string | null
  estado?: string | null
  cep?: string | null
  cnpj?: string | null
  cpf?: string | null
  email?: string | null
  contato?: string | null
  inscricao_estadual?: string | null
  inscricao_municipal?: string | null
  observacoes?: string | null
  ativo?: boolean | null
}

type Props = {
  onClientePronto: (cliente: ClienteFiscalCriado) => void | Promise<void>
}

function limparDocumento(valor: unknown) {
  return String(valor || '').replace(/\D/g, '')
}

function formatarCnpj(valor: unknown) {
  const numeros = limparDocumento(valor)
  if (!numeros) return ''
  if (numeros.length !== 14) return String(valor || '').trim()

  return numeros.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  )
}

function formatarCep(valor: unknown) {
  const numeros = limparDocumento(valor)
  if (!numeros) return ''
  if (numeros.length !== 8) return String(valor || '').trim()

  return numeros.replace(/^(\d{2})(\d{3})(\d{3})$/, '$1.$2-$3')
}

export default function ImportarFichaCnpjEmissor({
  onClientePronto,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [importando, setImportando] = useState(false)
  const [cadastrando, setCadastrando] = useState(false)
  const [dados, setDados] = useState<DadosFicha | null>(null)

  async function importarArquivo(file: File) {
    setImportando(true)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        alert('Sessão expirada. Faça login novamente.')
        return
      }

      const formData = new FormData()
      formData.append('arquivo', file)

      const resp = await fetch('/api/admin/importar-ficha-cnpj', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      })

      const json = await resp.json()

      if (!resp.ok) {
        throw new Error(json?.error || 'Erro ao importar ficha.')
      }

      setDados(json.dados || null)
    } catch (error: unknown) {
      alert(
        error instanceof Error
          ? error.message
          : 'Erro ao importar ficha CNPJ.'
      )
    } finally {
      setImportando(false)

      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  async function cadastrarEUsar() {
    if (!dados || cadastrando) return

    const nomeEmpresa = String(dados.nome_empresa || '').trim()
    const cnpjNumeros = limparDocumento(dados.cnpj)

    if (!nomeEmpresa) {
      alert('Não foi possível identificar o nome da empresa na ficha.')
      return
    }

    if (cnpjNumeros.length !== 14) {
      alert('CNPJ inválido na ficha. Confira se possui 14 números.')
      return
    }

    setCadastrando(true)

    try {
      const cnpjFormatado = formatarCnpj(dados.cnpj)

      // Primeiro tenta localizar um cadastro já existente.
      // Assim evitamos duplicar o mesmo CNPJ caso ele já esteja no banco.
      const { data: existente, error: erroExistente } = await supabase
        .from('clientes_faturamento')
        .select('*')
        .eq('cnpj', cnpjFormatado)
        .maybeSingle()

      if (erroExistente) {
        throw new Error(
          'Erro ao verificar cliente existente: ' + erroExistente.message
        )
      }

      if (existente?.id) {
        await onClientePronto(existente as ClienteFiscalCriado)
        setDados(null)
        alert('Este CNPJ já estava em Clientes Faturamento e foi selecionado.')
        return
      }

      const codigoHc = await proximoCodigoHc()

      const payload = {
        codigo_hc: codigoHc,
        nome_empresa: nomeEmpresa,
        nome_contato: null,
        endereco: String(dados.endereco || '').trim() || null,
        cidade: String(dados.cidade || '').trim() || null,
        estado: String(dados.estado || '').trim() || null,
        cep: formatarCep(dados.cep) || null,
        cnpj: cnpjFormatado,
        cpf: null,
        email: String(dados.email || '').trim() || null,
        contato: String(dados.contato || '').trim() || null,
        inscricao_estadual: null,
        inscricao_municipal: null,
        observacoes: String(dados.observacoes || '').trim() || null,
        ativo: String(dados.status || 'Ativo').toLowerCase() !== 'inativo',
      }

      const { data: criado, error } = await supabase
        .from('clientes_faturamento')
        .insert([payload])
        .select('*')
        .single()

      if (error) {
        throw new Error('Erro ao cadastrar cliente: ' + error.message)
      }

      if (!criado?.id) {
        throw new Error(
          'Cliente cadastrado, mas o banco não retornou o registro criado.'
        )
      }

      await onClientePronto(criado as ClienteFiscalCriado)
      setDados(null)

      alert(
        'Cliente cadastrado em Clientes Faturamento e selecionado nesta emissão.'
      )
    } catch (error: unknown) {
      alert(
        error instanceof Error
          ? error.message
          : 'Não foi possível cadastrar o cliente.'
      )
    } finally {
      setCadastrando(false)
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-emerald-900 bg-emerald-950/10 p-4">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,application/pdf,text/plain"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) importarArquivo(file)
        }}
      />

      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-black text-emerald-200">
            Cliente ainda não cadastrado?
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Importe a ficha CNPJ da Receita sem sair desta emissão.
          </p>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={importando || cadastrando}
          className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {importando ? 'Lendo ficha...' : 'Importar ficha CNPJ'}
        </button>
      </div>

      {dados ? (
        <div className="mt-4 rounded-xl border border-blue-900 bg-[#020817] p-4">
          <p className="text-xs font-black uppercase tracking-wider text-blue-300">
            Dados encontrados
          </p>

          <p className="mt-2 font-black text-white">
            {dados.nome_empresa || 'Empresa não identificada'}
          </p>

          <p className="mt-1 text-sm text-slate-300">
            {formatarCnpj(dados.cnpj) || 'CNPJ não identificado'}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {dados.cidade || '-'} / {dados.estado || '-'}
            {dados.cep ? ` • CEP ${formatarCep(dados.cep)}` : ''}
          </p>

          {dados.email ? (
            <p className="mt-1 text-xs text-slate-400">{dados.email}</p>
          ) : null}

          <button
            type="button"
            onClick={cadastrarEUsar}
            disabled={cadastrando || importando}
            className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {cadastrando
              ? 'Cadastrando cliente...'
              : 'Cadastrar e usar nesta fatura'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
