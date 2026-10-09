'use client'

import { useEffect, useState } from 'react'

type EnderecoCep = {
  cep: string
  logradouro: string
  bairro: string
  cidade: string
  uf: string
}

type Props = {
  value: string
  onChange: (value: string) => void
  onSelect: (endereco: EnderecoCep) => void
}

function digitos(value: string) {
  return value.replace(/\D/g, '').slice(0, 8)
}

function mascara(value: string) {
  return digitos(value).replace(/^(\d{5})(\d)/, '$1-$2')
}

export default function BuscaCepCliente({ value, onChange, onSelect }: Props) {
  const [aberto, setAberto] = useState(false)
  const [consulta, setConsulta] = useState({ termo: '', itens: [] as EnderecoCep[], erro: '', carregando: false })
  const termo = digitos(value)

  useEffect(() => {
    if (!aberto || termo.length < 5) return
    const controller = new AbortController()
    let ativo = true
    const timer = setTimeout(async () => {
      setConsulta({ termo, itens: [], erro: '', carregando: true })
      try {
        const resposta = await fetch('/api/cep-sugestoes?cep=' + termo, { signal: controller.signal })
        const json = await resposta.json()
        if (!resposta.ok) throw new Error(json.error || 'Consulta indisponível. Preencha o endereço manualmente.')
        if (ativo) setConsulta({ termo, itens: json.resultados || [], erro: '', carregando: false })
      } catch (error: unknown) {
        if (ativo) setConsulta({ termo, itens: [], erro: error instanceof Error ? error.message : 'Não foi possível consultar o CEP.', carregando: false })
      }
    }, 450)
    return () => {
      ativo = false
      clearTimeout(timer)
      controller.abort()
    }
  }, [termo, aberto])

  const atual = consulta.termo === termo
  const itens = atual ? consulta.itens : []

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setAberto(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setAberto(false)
      }}
    >
      <input
        value={value}
        aria-label="CEP"
        inputMode="numeric"
        autoComplete="off"
        placeholder="Digite o CEP"
        onFocus={() => setAberto(true)}
        onChange={(event) => {
          onChange(mascara(event.target.value))
          setAberto(true)
        }}
      />
      {aberto && termo.length < 5 && (
        <p className="mt-1 text-xs text-slate-400">Digite pelo menos 5 números para buscar.</p>
      )}
      {aberto && termo.length >= 5 && (
        <div className="absolute left-0 top-full z-50 mt-1 w-[min(24rem,80vw)] rounded-xl border border-blue-700 bg-[#08142c] shadow-xl">
          {(!atual || consulta.carregando) && <p role="status" className="p-3 text-sm text-slate-300">Buscando CEPs...</p>}
          {atual && consulta.erro && <p role="status" className="p-3 text-sm text-amber-300">{consulta.erro}</p>}
          {atual && !consulta.carregando && !consulta.erro && !itens.length && (
            <p role="status" className="p-3 text-sm text-slate-300">Nenhuma sugestão encontrada. Complete o CEP ou preencha o endereço manualmente.</p>
          )}
          {!!itens.length && (
            <>
              <ul aria-label="Sugestões de CEP" className="max-h-64 overflow-y-auto">
                {itens.map((item) => (
                  <li key={item.cep + item.logradouro}>
                    <button
                      type="button"
                      className="block w-full rounded-none border-b border-blue-900 bg-transparent px-3 py-3 text-left font-normal hover:bg-blue-900 focus:bg-blue-900"
                      onClick={() => {
                        setAberto(false)
                        onSelect(item)
                      }}
                    >
                      <span className="block text-sm font-bold text-blue-200">{item.cep} — {item.cidade}/{item.uf}</span>
                      <span className="block text-xs text-slate-300">{[item.logradouro, item.bairro].filter(Boolean).join(' · ') || 'CEP geral da localidade'}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="p-2 text-xs text-slate-400">Digite mais números para refinar. Selecione para preencher.</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
