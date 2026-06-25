'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function EmbarqueDiretoClientePage() {
  const [usuario, setUsuario] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [arquivos, setArquivos] = useState<File[]>([])

  const [form, setForm] = useState({
    cliente_final: '',
    tipo_operacao: '',
    origem: '',
    destino: '',
    transportadora: '',
    awb: '',
    peso: '',
    volumes: '',
    descricao_mercadoria: '',
    instrucoes: '',
  })

  useEffect(() => {
    carregarUsuario()
  }, [])

  async function carregarUsuario() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/login'
      return
    }

    setUsuario({
      id: user.id,
      email: user.email,
    })
  }

  async function enviarEmbarqueDireto() {
    if (!usuario?.id) {
      alert('Usuário não identificado')
      return
    }

    const tipoOperacao = form.tipo_operacao.trim()
    const origem = form.origem.trim()
    const destino = form.destino.trim()
    const descricaoMercadoria = form.descricao_mercadoria.trim()
    const instrucoes = form.instrucoes.trim()

    if (!tipoOperacao || !origem || !destino) {
      alert('Preencha tipo de operação, origem e destino.')
      return
    }

    if (!descricaoMercadoria && !instrucoes) {
      alert('Preencha a descrição da mercadoria ou as instruções para a HC.')
      return
    }

    setSalvando(true)

    const { data: embarqueCriado, error } = await supabase
      .from('embarque_direto')
      .insert([
        {
          usuario_id: usuario.id,
          solicitante_email: usuario.email,
          cliente_final: form.cliente_final.trim(),
          tipo_operacao: tipoOperacao,
          origem,
          destino,
          transportadora: form.transportadora.trim(),
          awb: form.awb.trim(),
          peso: form.peso.trim(),
          volumes: form.volumes.trim(),
          descricao_mercadoria: descricaoMercadoria,
          instrucoes,
          status: 'AGUARDANDO ANÁLISE',
        },
      ])
      .select()
      .single()

    if (error) {
      setSalvando(false)
      console.log(error)
      alert('Erro ao enviar solicitação')
      return
    }

    if (arquivos.length > 0 && embarqueCriado?.id) {
      for (const arquivo of arquivos) {
        const nomeArquivoSeguro = arquivo.name.replaceAll(' ', '-')
        const caminho = `${usuario.id}/${embarqueCriado.id}/${Date.now()}-${nomeArquivoSeguro}`

        const { error: uploadError } = await supabase.storage
          .from('embarque-direto-documentos')
          .upload(caminho, arquivo)

        if (uploadError) {
          console.log(uploadError)
          alert(`Erro ao enviar ${arquivo.name}: ${uploadError.message}`)
          continue
        }

        const { data: publicUrl } = supabase.storage
          .from('embarque-direto-documentos')
          .getPublicUrl(caminho)

        await supabase.from('embarque_direto_documentos').insert([
          {
            embarque_direto_id: embarqueCriado.id,
            usuario_id: usuario.id,
            nome: arquivo.name,
            url: publicUrl.publicUrl,
            caminho,
            tipo: arquivo.type,
            tamanho: arquivo.size,
          },
        ])
      }
    }

    setSalvando(false)

    alert('Solicitação de embarque enviada com sucesso.')

    setForm({
      cliente_final: '',
      tipo_operacao: '',
      origem: '',
      destino: '',
      transportadora: '',
      awb: '',
      peso: '',
      volumes: '',
      descricao_mercadoria: '',
      instrucoes: '',
    })

    setArquivos([])
  }

  return (
    <main className="min-h-screen bg-[#020817] text-white px-4 py-6 md:px-6 lg:px-8">
      <div className="w-full max-w-none mx-auto">
        <div className="mb-10 flex flex-col lg:flex-row justify-between items-start gap-6">
          <div>
            <h1 className="text-5xl font-black mb-2">
              Fechar embarque direto
            </h1>

            <p className="text-slate-400 text-lg">
              Envie os dados e documentos para a HC iniciar o processo sem passar por cotação.
            </p>
          </div>

          <a
            href="/cliente"
            className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl text-white font-bold"
          >
            Voltar ao portal
          </a>
        </div>

        <section className="card mb-8">
          <h2 className="text-2xl font-black mb-6">
            Dados do embarque
          </h2>

          <div className="form-grid">
            <input
              placeholder="Cliente final"
              value={form.cliente_final}
              onChange={(e) => setForm({ ...form, cliente_final: e.target.value })}
            />

            <select
              value={form.tipo_operacao}
              onChange={(e) => setForm({ ...form, tipo_operacao: e.target.value })}
            >
              <option value="">Tipo de operação</option>
              <option value="Importação">Importação</option>
              <option value="Exportação">Exportação</option>
              <option value="Courier">Courier</option>
              <option value="Marítimo">Marítimo</option>
              <option value="Aéreo formal">Aéreo formal</option>
            </select>

            <input
              placeholder="Origem"
              value={form.origem}
              onChange={(e) => setForm({ ...form, origem: e.target.value })}
            />

            <input
              placeholder="Destino"
              value={form.destino}
              onChange={(e) => setForm({ ...form, destino: e.target.value })}
            />

            <input
              placeholder="Transportadora desejada"
              value={form.transportadora}
              onChange={(e) => setForm({ ...form, transportadora: e.target.value })}
            />

            <input
              placeholder="AWB / Referência se já existir"
              value={form.awb}
              onChange={(e) => setForm({ ...form, awb: e.target.value })}
            />

            <input
              placeholder="Peso total"
              value={form.peso}
              onChange={(e) => setForm({ ...form, peso: e.target.value })}
            />

            <input
              placeholder="Volumes / caixas"
              value={form.volumes}
              onChange={(e) => setForm({ ...form, volumes: e.target.value })}
            />
          </div>

          <textarea
            placeholder="Descrição da mercadoria"
            value={form.descricao_mercadoria}
            onChange={(e) => setForm({ ...form, descricao_mercadoria: e.target.value })}
            className="mt-5 min-h-[120px]"
          />

          <textarea
            placeholder="Instruções para a HC, como se fosse um e-mail enviado"
            value={form.instrucoes}
            onChange={(e) => setForm({ ...form, instrucoes: e.target.value })}
            className="mt-5 min-h-[160px]"
          />

          <div className="mt-6 border border-blue-900 rounded-3xl p-5 bg-[#071225]">
            <h3 className="text-xl font-black mb-2">
              Documentos do embarque
            </h3>

            <p className="text-slate-400 mb-4">
              Anexe invoice, packing list, AWB, comprovantes, PDFs, imagens ou planilhas.
            </p>

            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
              onChange={(e) => {
                const selecionados = Array.from(e.target.files || [])
                setArquivos(selecionados)
              }}
            />

            {arquivos.length > 0 && (
              <div className="mt-4 space-y-2">
                {arquivos.map((arquivo, index) => (
                  <div
                    key={index}
                    className="bg-[#020817] border border-blue-900 rounded-xl px-4 py-3 text-slate-300"
                  >
                    📎 {arquivo.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={enviarEmbarqueDireto}
            disabled={salvando}
            className="mt-6 bg-green-600 hover:bg-green-500 px-6 py-4 rounded-2xl font-bold disabled:opacity-60"
          >
            {salvando ? 'Enviando...' : 'Enviar para operação HC'}
          </button>
        </section>
      </div>
    </main>
  )
}
