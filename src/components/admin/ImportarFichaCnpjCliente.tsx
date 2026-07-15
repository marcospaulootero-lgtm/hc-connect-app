'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

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

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype = Object.getPrototypeOf(element)
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set

  valueSetter?.call(element, value)

  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

function encontrarCampoPorLabel(labelTexto: string) {
  const labels = Array.from(document.querySelectorAll('label'))

  const label = labels.find((item) =>
    String(item.textContent || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .includes(
        labelTexto
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
      )
  )

  if (!label) return null

  const container = label.closest('div') || label.parentElement

  return container?.querySelector('input, textarea, select') as
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement
    | null
}

function preencher(label: string, valor?: string) {
  if (!valor) return

  const campo = encontrarCampoPorLabel(label)

  if (campo) {
    setNativeValue(campo, valor)
  }
}

export default function ImportarFichaCnpjCliente() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [importando, setImportando] = useState(false)
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

      setDados(json.dados)
      aplicarDados(json.dados)

      alert('Ficha importada. Confira os campos e clique em Cadastrar cliente.')
    } catch (error: any) {
      alert(error?.message || 'Erro ao importar ficha CNPJ.')
    } finally {
      setImportando(false)

      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function aplicarDados(dadosFicha: DadosFicha) {
    preencher('Nome da empresa', dadosFicha.nome_empresa)
    preencher('CNPJ', dadosFicha.cnpj)
    preencher('Endereço', dadosFicha.endereco)
    preencher('Cidade', dadosFicha.cidade)
    preencher('Estado', dadosFicha.estado)
    preencher('CEP', dadosFicha.cep)
    preencher('Email', dadosFicha.email)
    preencher('Contato', dadosFicha.contato)
    preencher('Status', dadosFicha.status)
    preencher('Observações', dadosFicha.observacoes)
  }

  return (
    <section className="card mb-6 border-emerald-800/70">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-widest text-emerald-400">
            Importação automática
          </p>
          <h2 className="text-2xl font-black">Importar ficha CNPJ</h2>
          <p className="mt-1 text-sm text-slate-400">
            Envie o PDF original da Receita Federal para preencher o cadastro fiscal.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
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

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={importando}
            className="rounded-2xl bg-emerald-600 px-6 py-4 font-black text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {importando ? 'Lendo ficha...' : 'Importar ficha CNPJ'}
          </button>

          {dados ? (
            <button
              type="button"
              onClick={() => aplicarDados(dados)}
              className="rounded-2xl bg-blue-600 px-6 py-4 font-black text-white hover:bg-blue-500"
            >
              Preencher novamente
            </button>
          ) : null}
        </div>
      </div>

      {dados ? (
        <div className="mt-5 rounded-2xl border border-blue-900 bg-[#020817] p-4 text-sm">
          <p className="font-black text-blue-300">Última ficha lida:</p>
          <p className="mt-1">
            {dados.nome_empresa || '-'} — {dados.cnpj || '-'}
          </p>
          <p className="mt-1 text-slate-400">
            {dados.cidade || '-'} / {dados.estado || '-'} • {dados.email || '-'}
          </p>
        </div>
      ) : null}
    </section>
  )
}
