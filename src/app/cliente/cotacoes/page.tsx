'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Volume = {
  quantidade: string
  comprimento_cm: string
  largura_cm: string
  altura_cm: string
  peso_kg: string
}

const SERVICOS = [
  'IMPORTAÇÃO FORMAL',
  'IMPORTAÇÃO COURIER',
  'EXPORTAÇÃO',
  'AÉREO FORMAL',
  'MARÍTIMO',
  'RODOVIÁRIO',
]

const TRANSPORTADORAS = ['DHL', 'FEDEX', 'UPS', 'AGENTE DE CARGA']

export default function CotacoesClientePage() {
  const [usuario, setUsuario] = useState<any>(null)
  const [salvando, setSalvando] = useState(false)
  const [arquivos, setArquivos] = useState<File[]>([])

  const [form, setForm] = useState({
    exportador: '',
    importador: '',
    referencia_cliente: '',
    servico: '',
    transportadoras_consulta: [] as string[],
    origem: '',
    destino: '',
    peso_real: '',
    peso_taxado: '',
    descricao_mercadoria: '',
    moeda: 'USD',
    valor_mercadoria: '',
    observacoes: '',
  })

  const [volumes, setVolumes] = useState<Volume[]>([
    {
      quantidade: '1',
      comprimento_cm: '',
      largura_cm: '',
      altura_cm: '',
      peso_kg: '',
    },
  ])

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

    const { data: perfil, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error || !perfil) {
      window.location.href = '/login'
      return
    }

    if (perfil.tipo_acesso === 'admin') {
      window.location.href = '/admin'
      return
    }

    setUsuario({
      ...perfil,
      id: user.id,
      email: user.email,
    })
  }

  function adicionarVolume() {
    setVolumes([
      ...volumes,
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
    if (volumes.length === 1) {
      alert('A cotação precisa ter pelo menos um volume.')
      return
    }

    setVolumes(volumes.filter((_, i) => i !== index))
  }

  function atualizarVolume(index: number, campo: keyof Volume, valor: string) {
    const novosVolumes = [...volumes]
    novosVolumes[index][campo] = valor
    setVolumes(novosVolumes)
  }

  function alternarTransportadora(nome: string, marcado: boolean) {
    setForm((atual) => ({
      ...atual,
      transportadoras_consulta: marcado
        ? [...atual.transportadoras_consulta, nome]
        : atual.transportadoras_consulta.filter((item) => item !== nome),
    }))
  }

  function calcularPesoTotal() {
    return volumes.reduce((total, volume) => {
      const qtd = Number(String(volume.quantidade || 0).replace(',', '.'))
      const peso = Number(String(volume.peso_kg || 0).replace(',', '.'))
      return total + qtd * peso
    }, 0)
  }

  function numero(valor: any) {
    if (valor === null || valor === undefined || valor === '') return null
    return Number(String(valor).replace(',', '.'))
  }


  async function avisarEquipeNovaCotacao(cotacaoCriada: any) {
    try {
      await fetch('/api/enviar-email-cotacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cotacao_id: cotacaoCriada.id,
          solicitante_email: usuario?.email,
          exportador: form.exportador,
          importador: form.importador,
          referencia_cliente: form.referencia_cliente,
          servico: form.servico,
          transportadoras_consulta: form.transportadoras_consulta,
          origem: form.origem,
          destino: form.destino,
          peso_real: form.peso_real || String(calcularPesoTotal()),
          peso_taxado: form.peso_taxado || String(calcularPesoTotal()),
          peso_total: String(calcularPesoTotal()),
          moeda: form.moeda,
          valor_mercadoria: form.valor_mercadoria,
          observacoes: form.observacoes,
          link_admin: `${window.location.origin}/admin/cotacoes/${cotacaoCriada.id}`,
        }),
      })
    } catch (error) {
      console.log('Erro ao avisar equipe sobre nova cotação:', error)
    }
  }

  async function enviarCotacao() {
    if (!usuario?.id) {
      alert('Usuário não identificado')
      return
    }

    if (!form.exportador || !form.importador || !form.servico || !form.origem || !form.destino) {
      alert('Preencha exportador, importador, serviço, origem e destino.')
      return
    }

    if (form.transportadoras_consulta.length === 0) {
      alert('Selecione pelo menos uma transportadora para consulta.')
      return
    }

    const algumVolumeIncompleto = volumes.some(
      (v) =>
        !v.quantidade ||
        !v.comprimento_cm ||
        !v.largura_cm ||
        !v.altura_cm ||
        !v.peso_kg
    )

    if (algumVolumeIncompleto) {
      alert('Preencha todos os dados dos volumes.')
      return
    }

    setSalvando(true)

    const pesoTotal = calcularPesoTotal()

    const { data: cotacaoCriada, error } = await supabase
      .from('cotacoes')
      .insert([
        {
          usuario_id: usuario.id,
          solicitante_email: usuario.email,

          exportador: form.exportador,
          importador: form.importador,
          referencia_cliente: form.referencia_cliente || null,

          servico: form.servico,
          tipo_operacao: form.servico,

          transportadoras_consulta: form.transportadoras_consulta,

          origem: form.origem,
          destino: form.destino,

          peso_real: numero(form.peso_real) || pesoTotal,
          peso_taxado: numero(form.peso_taxado) || pesoTotal,
          peso: String(pesoTotal),
          dimensoes: `${volumes.length} volume(s)`,
          volumes,

          descricao_mercadoria: form.descricao_mercadoria,
          moeda: form.moeda,
          valor_mercadoria: form.valor_mercadoria,
          observacoes: form.observacoes,
          status: 'AGUARDANDO ANÁLISE',
        },
      ])
      .select()
      .single()

    if (error) {
      setSalvando(false)
      alert('Erro ao enviar cotação. Verifique se as novas colunas foram criadas no Supabase.')
      console.log(error)
      return
    }

    if (arquivos.length > 0 && cotacaoCriada?.id) {
      for (const arquivo of arquivos) {
        const nomeLimpo = arquivo.name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9.-]/g, '_')
          .replace(/_+/g, '_')

        const caminho = `${usuario.id}/${cotacaoCriada.id}/${Date.now()}-${nomeLimpo}`

        const { error: uploadError } = await supabase.storage
          .from('cotacoes-documentos')
          .upload(caminho, arquivo)

        if (uploadError) {
          console.log(uploadError)
          alert(`Erro ao enviar o arquivo: ${arquivo.name}`)
          continue
        }

        const { data: publicUrl } = supabase.storage
          .from('cotacoes-documentos')
          .getPublicUrl(caminho)

        await supabase.from('cotacao_documentos').insert([
          {
            cotacao_id: cotacaoCriada.id,
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

    await avisarEquipeNovaCotacao(cotacaoCriada)

    setSalvando(false)

    alert('Solicitação de cotação enviada com sucesso')

    setForm({
      exportador: '',
      importador: '',
      referencia_cliente: '',
      servico: '',
      transportadoras_consulta: [],
      origem: '',
      destino: '',
      peso_real: '',
      peso_taxado: '',
      descricao_mercadoria: '',
      moeda: 'USD',
      valor_mercadoria: '',
      observacoes: '',
    })

    setVolumes([
      {
        quantidade: '1',
        comprimento_cm: '',
        largura_cm: '',
        altura_cm: '',
        peso_kg: '',
      },
    ])

    setArquivos([])

    const inputArquivo = document.getElementById('arquivos_cotacao') as HTMLInputElement | null
    if (inputArquivo) inputArquivo.value = ''
  }

  return (
    <main className="min-h-screen bg-[#020817] text-white px-4 py-6 md:px-6 lg:px-8">
      <div className="w-full max-w-none mx-auto">
        <div className="mb-10 flex flex-col lg:flex-row justify-between items-start gap-6">
          <div>
            <h1 className="text-5xl font-black mb-2">
              Solicitar cotação
            </h1>

            <p className="text-slate-400 text-lg">
              Preencha os dados da operação. Se a cotação for aprovada, essas informações serão usadas para criar o embarque.
            </p>
          </div>

          <div className="flex gap-3 flex-wrap">
            <a
              href="/cliente/minhas-cotacoes"
              className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl text-white font-bold"
            >
              Minhas cotações
            </a>

            <a
              href="/cliente"
              className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl text-white font-bold"
            >
              Voltar ao portal
            </a>
          </div>
        </div>

        <section className="card mb-8">
          <h2 className="text-2xl font-black mb-6">
            Dados da operação
          </h2>

          <div className="form-grid">
            <input
              placeholder="Exportador *"
              value={form.exportador}
              onChange={(e) =>
                setForm({ ...form, exportador: e.target.value })
              }
            />

            <input
              placeholder="Importador *"
              value={form.importador}
              onChange={(e) =>
                setForm({ ...form, importador: e.target.value })
              }
            />

            <input
              placeholder="Referência cliente"
              value={form.referencia_cliente}
              onChange={(e) =>
                setForm({ ...form, referencia_cliente: e.target.value })
              }
            />

            <select
              value={form.servico}
              onChange={(e) =>
                setForm({ ...form, servico: e.target.value })
              }
            >
              <option value="">Serviço *</option>
              {SERVICOS.map((servico) => (
                <option key={servico} value={servico}>
                  {servico}
                </option>
              ))}
            </select>

            <input
              placeholder="Origem *"
              value={form.origem}
              onChange={(e) =>
                setForm({ ...form, origem: e.target.value })
              }
            />

            <input
              placeholder="Destino *"
              value={form.destino}
              onChange={(e) =>
                setForm({ ...form, destino: e.target.value })
              }
            />

            <input
              placeholder="Peso real kg"
              value={form.peso_real}
              onChange={(e) =>
                setForm({ ...form, peso_real: e.target.value })
              }
            />

            <input
              placeholder="Peso taxado kg"
              value={form.peso_taxado}
              onChange={(e) =>
                setForm({ ...form, peso_taxado: e.target.value })
              }
            />

            <input
              placeholder="Descrição da mercadoria"
              value={form.descricao_mercadoria}
              onChange={(e) =>
                setForm({
                  ...form,
                  descricao_mercadoria: e.target.value,
                })
              }
            />

            <select
              value={form.moeda}
              onChange={(e) =>
                setForm({ ...form, moeda: e.target.value })
              }
            >
              <option value="USD">USD - Dólar Americano</option>
              <option value="EUR">EUR - Euro</option>
              <option value="BRL">BRL - Real Brasileiro</option>
              <option value="CNY">CNY - Yuan Chinês</option>
            </select>

            <input
              placeholder="Valor da mercadoria"
              value={form.valor_mercadoria}
              onChange={(e) =>
                setForm({ ...form, valor_mercadoria: e.target.value })
              }
            />
          </div>
        </section>

        <section className="card mb-8">
          <h2 className="text-2xl font-black mb-4">
            Transportadoras para consulta
          </h2>

          <p className="text-slate-400 mb-5">
            Marque uma ou mais empresas para cotação.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {TRANSPORTADORAS.map((nome) => (
              <label
                key={nome}
                className={`border rounded-2xl p-5 cursor-pointer font-black ${
                  form.transportadoras_consulta.includes(nome)
                    ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                    : 'border-blue-900 bg-[#071225] text-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={form.transportadoras_consulta.includes(nome)}
                  onChange={(e) => alternarTransportadora(nome, e.target.checked)}
                  className="mr-3"
                />
                {nome}
              </label>
            ))}
          </div>
        </section>

        <section className="card mb-8">
          <div className="flex flex-col md:flex-row justify-between gap-5 md:items-center mb-5">
            <div>
              <h3 className="text-2xl font-black">
                Volumes / caixas
              </h3>

              <p className="text-slate-400">
                Informe quantidade, dimensões em cm e peso em kg de cada volume.
              </p>
            </div>

            <button type="button" onClick={adicionarVolume}>
              + Adicionar volume
            </button>
          </div>

          <div className="space-y-5">
            {volumes.map((volume, index) => (
              <div
                key={index}
                className="border border-blue-900 rounded-3xl p-5 bg-[#071225]"
              >
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-xl font-bold">
                    Volume {index + 1}
                  </h4>

                  <button
                    type="button"
                    onClick={() => removerVolume(index)}
                    className="bg-red-600 hover:bg-red-500"
                  >
                    Remover
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <input
                    placeholder="Quantidade"
                    value={volume.quantidade}
                    onChange={(e) =>
                      atualizarVolume(index, 'quantidade', e.target.value)
                    }
                  />

                  <input
                    placeholder="Comprimento cm"
                    value={volume.comprimento_cm}
                    onChange={(e) =>
                      atualizarVolume(index, 'comprimento_cm', e.target.value)
                    }
                  />

                  <input
                    placeholder="Largura cm"
                    value={volume.largura_cm}
                    onChange={(e) =>
                      atualizarVolume(index, 'largura_cm', e.target.value)
                    }
                  />

                  <input
                    placeholder="Altura cm"
                    value={volume.altura_cm}
                    onChange={(e) =>
                      atualizarVolume(index, 'altura_cm', e.target.value)
                    }
                  />

                  <input
                    placeholder="Peso kg"
                    value={volume.peso_kg}
                    onChange={(e) =>
                      atualizarVolume(index, 'peso_kg', e.target.value)
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 border border-blue-900 rounded-2xl p-5 bg-[#020817]">
            <p className="text-slate-400">Peso total informado</p>
            <h3 className="text-3xl font-black mt-2">
              {calcularPesoTotal()} kg
            </h3>
          </div>
        </section>

        <section className="card mb-8">
          <h2 className="text-2xl font-black mb-6">
            Observações e documentos
          </h2>

          <textarea
            placeholder="Observações"
            value={form.observacoes}
            onChange={(e) =>
              setForm({ ...form, observacoes: e.target.value })
            }
            className="min-h-[120px]"
          />

          <div className="mt-6 border border-blue-900 rounded-3xl p-5 bg-[#071225]">
            <h3 className="text-xl font-black mb-2">
              Documentos da cotação
            </h3>

            <p className="text-slate-400 mb-4">
              Anexe invoice, packing list, AWB, PDFs, imagens ou outros documentos necessários.
            </p>

            <input
              id="arquivos_cotacao"
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
            onClick={enviarCotacao}
            disabled={salvando}
            className="mt-6"
          >
            {salvando ? 'Enviando...' : 'Enviar cotação'}
          </button>
        </section>
      </div>
    </main>
  )
}
