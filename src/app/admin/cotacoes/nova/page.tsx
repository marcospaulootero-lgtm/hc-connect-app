'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type VolumeCotacao = {
  quantidade: string
  comprimento_cm: string
  largura_cm: string
  altura_cm: string
  peso_kg: string
}

function numero(valor: any) {
  if (valor === null || valor === undefined || valor === '') return 0
  return Number(String(valor).replace(',', '.').replace(/[^0-9.-]/g, '')) || 0
}

function arredondarMeioKg(valor: number) {
  return Math.ceil((Number(valor) || 0) / 0.5) * 0.5
}

export default function NovaCotacaoManualPage() {
  const [salvando, setSalvando] = useState(false)

  const [form, setForm] = useState({
    origem_solicitacao: 'EMAIL',
    solicitante_email: '',
    empresa_solicitante: '',
    solicitante_nome: '',
    responsavel_solicitante: '',
    telefone_solicitante: '',
    referencia_cliente: '',
    servico: 'IMPORTAÇÃO FORMAL',
    transportadora: 'DHL',
    origem: '',
    destino: '',
    moeda: 'USD',
    valor_mercadoria: '',
    descricao_mercadoria: '',
    observacoes: '',
  })

  const [volumes, setVolumes] = useState<VolumeCotacao[]>([
    {
      quantidade: '1',
      comprimento_cm: '',
      largura_cm: '',
      altura_cm: '',
      peso_kg: '',
    },
  ])

  const resumo = useMemo(() => {
    let quantidadeVolumes = 0
    let pesoReal = 0
    let pesoDimensional = 0
    let pesoTaxado = 0

    volumes.forEach((volume) => {
      const qtd = Math.max(numero(volume.quantidade), 1)
      const comp = numero(volume.comprimento_cm)
      const larg = numero(volume.largura_cm)
      const alt = numero(volume.altura_cm)
      const peso = numero(volume.peso_kg)

      const dimensionalUnitario = (comp * larg * alt) / 5000
      const maiorPesoUnitario = Math.max(peso, dimensionalUnitario)

      quantidadeVolumes += qtd
      pesoReal += peso * qtd
      pesoDimensional += dimensionalUnitario * qtd
      pesoTaxado += maiorPesoUnitario * qtd
    })

    return {
      quantidadeVolumes,
      pesoReal: arredondarMeioKg(pesoReal),
      pesoDimensional: arredondarMeioKg(pesoDimensional),
      pesoTaxado: arredondarMeioKg(pesoTaxado),
    }
  }, [volumes])

  function atualizarCampo(campo: keyof typeof form, valor: string) {
    setForm((atual) => ({
      ...atual,
      [campo]: valor,
    }))
  }

  function atualizarVolume(index: number, campo: keyof VolumeCotacao, valor: string) {
    setVolumes((atuais) =>
      atuais.map((volume, i) =>
        i === index
          ? {
              ...volume,
              [campo]: valor,
            }
          : volume
      )
    )
  }

  function adicionarVolume() {
    setVolumes((atuais) => [
      ...atuais,
      {
        quantidade: '1',
        comprimento_cm: '',
        largura_cm: '',
        altura_cm: '',
        peso_kg: '',
      },
    ])
  }

  function removerVolume(index: number) {
    setVolumes((atuais) => atuais.filter((_, i) => i !== index))
  }

  async function salvarCotacaoManual() {
    if (!form.empresa_solicitante.trim() && !form.solicitante_nome.trim()) {
      alert('Informe a empresa solicitante ou o nome do solicitante.')
      return
    }

    setSalvando(true)

    const dimensoesTexto = volumes
      .map((v) => {
        return `${v.quantidade || 1} vol - ${v.comprimento_cm || 0} x ${v.largura_cm || 0} x ${v.altura_cm || 0} cm - ${v.peso_kg || 0} kg`
      })
      .join(' | ')

    const { data, error } = await supabase
      .from('cotacoes')
      .insert([
        {
          origem_solicitacao: form.origem_solicitacao,
          solicitante_email: form.solicitante_email.trim() || null,
          cliente_final: form.empresa_solicitante || form.solicitante_nome || null,
          empresa_solicitante: form.empresa_solicitante || null,
          solicitante_nome: form.solicitante_nome || null,
          responsavel_solicitante: form.responsavel_solicitante || form.solicitante_nome || null,
          telefone_solicitante: form.telefone_solicitante || null,
          referencia_cliente: form.referencia_cliente || null,
          exportador: null,
          importador: null,
          servico: form.servico,
          tipo_operacao: form.servico,
          transportadoras_consulta: [form.transportadora],
          origem: form.origem || null,
          destino: form.destino || null,
          moeda: form.moeda || 'USD',
          valor_mercadoria: form.valor_mercadoria || null,
          descricao_mercadoria: form.descricao_mercadoria || null,
          observacoes: form.observacoes || null,
          volumes,
          dimensoes: dimensoesTexto,
          peso_real: resumo.pesoReal,
          peso_taxado: resumo.pesoTaxado,
          status: 'AGUARDANDO ANÁLISE',
        },
      ])
      .select()
      .single()

    setSalvando(false)

    if (error) {
      console.log(error)
      alert('Erro ao criar cotação manual: ' + error.message)
      return
    }

    window.location.href = `/admin/cotacoes/${data.id}`
  }

  return (
    <main className="w-full max-w-none p-8 text-white">
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 font-bold text-blue-400">Comercial</p>
          <h1 className="text-5xl font-black">Nova cotação manual</h1>
          <p className="mt-2 text-lg text-slate-400">
            Use quando o pedido chegar por e-mail, WhatsApp ou telefone.
          </p>
        </div>

        <a href="/admin/cotacoes" className="rounded-xl bg-slate-700 px-5 py-3 font-bold hover:bg-slate-600">
          Voltar para fila
        </a>
      </div>

      <section className="card mb-8">
        <h2 className="mb-6 text-2xl font-black">Dados do cliente</h2>

        <div className="form-grid">
          <Campo label="Origem da solicitação" value={form.origem_solicitacao} onChange={(v) => atualizarCampo('origem_solicitacao', v)} tipo="select">
            <option value="EMAIL">E-mail</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="TELEFONE">Telefone</option>
            <option value="MANUAL">Manual</option>
          </Campo>

          <Campo label="E-mail do cliente" value={form.solicitante_email} onChange={(v) => atualizarCampo('solicitante_email', v)} />
          <Campo label="Empresa solicitante" value={form.empresa_solicitante} onChange={(v) => atualizarCampo('empresa_solicitante', v)} />
          <Campo label="Nome do solicitante" value={form.solicitante_nome} onChange={(v) => atualizarCampo('solicitante_nome', v)} />
          <Campo label="Responsável / contato" value={form.responsavel_solicitante} onChange={(v) => atualizarCampo('responsavel_solicitante', v)} />
          <Campo label="Telefone / WhatsApp" value={form.telefone_solicitante} onChange={(v) => atualizarCampo('telefone_solicitante', v)} />
          <Campo label="Referência cliente" value={form.referencia_cliente} onChange={(v) => atualizarCampo('referencia_cliente', v)} />
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="mb-6 text-2xl font-black">Dados da operação</h2>

        <div className="form-grid">
          <Campo label="Serviço" value={form.servico} onChange={(v) => atualizarCampo('servico', v)} tipo="select">
            <option value="IMPORTAÇÃO FORMAL">Importação formal</option>
            <option value="IMPORTAÇÃO COURIER">Importação courier</option>
            <option value="EXPORTAÇÃO">Exportação</option>
          </Campo>

          <Campo label="Transportadora" value={form.transportadora} onChange={(v) => atualizarCampo('transportadora', v)} tipo="select">
            <option value="DHL">DHL</option>
            <option value="FEDEX">FedEx</option>
            <option value="UPS">UPS</option>
            <option value="AGENTE">Agente</option>
          </Campo>

          <Campo label="Origem" value={form.origem} onChange={(v) => atualizarCampo('origem', v)} />
          <Campo label="Destino" value={form.destino} onChange={(v) => atualizarCampo('destino', v)} />
          <Campo label="Moeda" value={form.moeda} onChange={(v) => atualizarCampo('moeda', v)} />
          <Campo label="Valor mercadoria" value={form.valor_mercadoria} onChange={(v) => atualizarCampo('valor_mercadoria', v)} />
        </div>
      </section>

      <section className="card mb-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">Volumes</h2>
            <p className="mt-1 text-sm text-slate-400">
              Peso dimensional: comprimento x largura x altura / 5000.
            </p>
          </div>

          <button type="button" onClick={adicionarVolume} className="rounded-xl bg-blue-600 px-5 py-3 font-bold hover:bg-blue-500">
            + Volume
          </button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Resumo titulo="Volumes" valor={resumo.quantidadeVolumes} />
          <Resumo titulo="Peso real" valor={`${resumo.pesoReal.toFixed(2)} kg`} />
          <Resumo titulo="Peso dimensional" valor={`${resumo.pesoDimensional.toFixed(2)} kg`} />
          <Resumo titulo="Peso taxado" valor={`${resumo.pesoTaxado.toFixed(2)} kg`} />
        </div>

        <div className="space-y-4">
          {volumes.map((volume, index) => (
            <div key={index} className="grid grid-cols-1 gap-4 rounded-2xl border border-blue-900 bg-[#020817] p-4 md:grid-cols-6">
              <Campo label="Qtd" value={volume.quantidade} onChange={(v) => atualizarVolume(index, 'quantidade', v)} />
              <Campo label="Comprimento cm" value={volume.comprimento_cm} onChange={(v) => atualizarVolume(index, 'comprimento_cm', v)} />
              <Campo label="Largura cm" value={volume.largura_cm} onChange={(v) => atualizarVolume(index, 'largura_cm', v)} />
              <Campo label="Altura cm" value={volume.altura_cm} onChange={(v) => atualizarVolume(index, 'altura_cm', v)} />
              <Campo label="Peso kg" value={volume.peso_kg} onChange={(v) => atualizarVolume(index, 'peso_kg', v)} />

              <button
                type="button"
                onClick={() => removerVolume(index)}
                disabled={volumes.length === 1}
                className="self-end rounded-xl bg-red-700 px-4 py-3 font-bold hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="mb-6 text-2xl font-black">Mercadoria e observações</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <CampoTexto label="Descrição da mercadoria" value={form.descricao_mercadoria} onChange={(v) => atualizarCampo('descricao_mercadoria', v)} />
          <CampoTexto label="Observações" value={form.observacoes} onChange={(v) => atualizarCampo('observacoes', v)} />
        </div>
      </section>

      <section className="card">
        <div className="flex flex-wrap justify-end gap-4">
          <a href="/admin/cotacoes" className="rounded-xl bg-slate-700 px-5 py-3 font-bold hover:bg-slate-600">
            Cancelar
          </a>

          <button
            type="button"
            onClick={salvarCotacaoManual}
            disabled={salvando}
            className="rounded-xl bg-green-700 px-6 py-3 font-black hover:bg-green-600 disabled:opacity-60"
          >
            {salvando ? 'Criando...' : 'Criar cotação e abrir emissor'}
          </button>
        </div>
      </section>
    </main>
  )
}

function Campo({
  label,
  value,
  onChange,
  tipo = 'input',
  children,
}: {
  label: string
  value: string
  onChange: (valor: string) => void
  tipo?: 'input' | 'select'
  children?: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-400">{label}</span>

      {tipo === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {children}
        </select>
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  )
}

function CampoTexto({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (valor: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-400">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[130px] w-full"
      />
    </label>
  )
}

function Resumo({ titulo, valor }: { titulo: string; valor: any }) {
  return (
    <div className="rounded-2xl border border-blue-900 bg-[#020817] p-4">
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">{titulo}</p>
      <p className="mt-2 text-2xl font-black text-white">{valor}</p>
    </div>
  )
}
