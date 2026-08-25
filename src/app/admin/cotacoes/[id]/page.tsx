'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import EmissorCotacaoHC from '@/components/EmissorCotacaoHC'

export default function DetalheCotacaoAdminPage() {
  const params = useParams()
  const [cotacao, setCotacao] = useState<any>(null)
  const [documentosCliente, setDocumentosCliente] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [salvandoRef, setSalvandoRef] = useState(false)
  const [referenciaHC, setReferenciaHC] = useState('')
  const [emailEnviado, setEmailEnviado] = useState(false)
  const [enviandoEmail, setEnviandoEmail] = useState(false)
  const [convertendo, setConvertendo] = useState(false)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    const { data } = await supabase
      .from('cotacoes')
      .select('*')
      .eq('id', params.id)
      .single()

    setCotacao(data)
    setReferenciaHC(data?.referencia_hc || '')

    const { data: docs, error: erroDocs } = await supabase
      .from('cotacao_documentos')
      .select('*')
      .eq('cotacao_id', params.id)
      .order('criado_em', { ascending: false })

    if (erroDocs) {
      console.log(erroDocs)
      setDocumentosCliente([])
      return
    }

    setDocumentosCliente(docs || [])
  }

  function servicoCotacao() {
    return cotacao?.servico || cotacao?.tipo_operacao || '-'
  }

  function transportadorasTexto() {
    const valor = cotacao?.transportadoras_consulta

    if (Array.isArray(valor)) return valor.join(', ')

    if (typeof valor === 'string') {
      try {
        const lista = JSON.parse(valor)
        if (Array.isArray(lista)) return lista.join(', ')
      } catch {}
      return valor
    }

    return '-'
  }

  function pesoRealCotacao() {
    return cotacao?.peso_real || cotacao?.peso || null
  }

  function pesoTaxadoCotacao() {
    return cotacao?.peso_taxado || cotacao?.peso || null
  }

  function numero(valor: any) {
    if (valor === null || valor === undefined || valor === '') return null

    if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null

    const texto = String(valor).trim()

    if (texto.includes(',') && texto.includes('.')) {
      const convertido = Number(
        texto.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')
      )
      return Number.isFinite(convertido) ? convertido : null
    }

    const convertido = Number(
      texto.includes(',')
        ? texto.replace(',', '.').replace(/[^0-9.-]/g, '')
        : texto.replace(/[^0-9.-]/g, '')
    )

    return Number.isFinite(convertido) ? convertido : null
  }

  function normalizarTexto(valor: any) {
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase()
  }

  function dadosEmissorObjeto() {
    const dados = cotacao?.dados_emissor

    if (dados && typeof dados === 'object' && !Array.isArray(dados)) {
      return dados
    }

    if (typeof dados === 'string') {
      try {
        const convertido = JSON.parse(dados)
        if (convertido && typeof convertido === 'object' && !Array.isArray(convertido)) {
          return convertido
        }
      } catch {}
    }

    return {}
  }

  function transportadoraSelecionadaCotacao() {
    const dadosEmissor: any = dadosEmissorObjeto()
    const transportadoraForm = String(dadosEmissor?.form?.transportadora || '').trim()

    if (transportadoraForm) return transportadoraForm

    const valor = cotacao?.transportadoras_consulta

    if (Array.isArray(valor)) {
      return String(valor.find((item) => String(item || '').trim()) || '').trim() || 'AGENTE DE CARGA'
    }

    if (typeof valor === 'string') {
      try {
        const lista = JSON.parse(valor)
        if (Array.isArray(lista)) {
          return String(lista.find((item) => String(item || '').trim()) || '').trim() || 'AGENTE DE CARGA'
        }
      } catch {}

      const primeira = valor
        .split(',')
        .map((item) => item.trim())
        .find(Boolean)

      return primeira || 'AGENTE DE CARGA'
    }

    return 'AGENTE DE CARGA'
  }

  function empresaSolicitanteCotacao() {
    const dadosEmissor: any = dadosEmissorObjeto()
    return (
      cotacao?.cliente_final ||
      cotacao?.empresa_solicitante ||
      dadosEmissor?.form?.empresa_solicitante ||
      null
    )
  }

  function exportadorCotacao() {
    if (cotacao?.exportador) return cotacao.exportador

    const operacao = normalizarTexto(
      cotacao?.servico || cotacao?.tipo_operacao || dadosEmissorObjeto()?.form?.servico
    )

    return operacao.includes('EXPORT') ? empresaSolicitanteCotacao() : null
  }

  function importadorCotacao() {
    if (cotacao?.importador) return cotacao.importador

    const operacao = normalizarTexto(
      cotacao?.servico || cotacao?.tipo_operacao || dadosEmissorObjeto()?.form?.servico
    )

    return operacao.includes('IMPORT') ? empresaSolicitanteCotacao() : null
  }

  function dadosFinanceirosCotacao() {
    const dadosEmissor: any = dadosEmissorObjeto()
    const formEmissor =
      dadosEmissor?.form && typeof dadosEmissor.form === 'object'
        ? dadosEmissor.form
        : {}

    const itensEnvioComValor = Array.isArray(dadosEmissor?.itensEnvio)
      ? dadosEmissor.itensEnvio.filter(
          (item: any) =>
            String(item?.descricao || item?.servico || item?.nome || '').trim() &&
            (numero(item?.valor) || 0) !== 0
        )
      : []

    const itensAgenteComValor = Array.isArray(dadosEmissor?.itensAgente)
      ? dadosEmissor.itensAgente.filter(
          (item: any) =>
            item?.usar !== false &&
            String(item?.servico || item?.descricao || item?.nome || '').trim() &&
            (numero(item?.valor) || 0) !== 0
        )
      : []

    const modeloEmissor = normalizarTexto(dadosEmissor?.modelo)
    const itensOriginais: any[] =
      modeloEmissor.includes('AGENTE') && itensAgenteComValor.length > 0
        ? itensAgenteComValor
        : itensEnvioComValor.length > 0
          ? itensEnvioComValor
          : itensAgenteComValor

    const itens = itensOriginais
      .map((item: any) => {
        const nome = String(item?.descricao || item?.servico || item?.nome || '').trim()
        const valor = numero(item?.valor) || 0
        const moeda = String(
          item?.moeda || formEmissor?.moeda || cotacao?.moeda || 'USD'
        )
          .trim()
          .toUpperCase()

        return { nome, valor, moeda }
      })
      .filter((item: any) => item.nome && item.valor !== 0)

    const seguro = numero(dadosEmissor?.valores?.seguro) || 0

    if (
      seguro > 0 &&
      !itens.some((item: any) => normalizarTexto(item.nome).includes('SEGURO'))
    ) {
      itens.push({
        nome: 'SEGURO',
        valor: seguro,
        moeda: 'USD',
      })
    }

    const moedas = Array.from(
      new Set(itens.map((item: any) => item.moeda).filter(Boolean))
    )

    const moedaPrincipal =
      moedas.length === 1
        ? moedas[0]
        : String(formEmissor?.moeda || cotacao?.moeda || 'USD').toUpperCase()

    const totaisPorMoeda = itens.reduce<Record<string, number>>((acc, item: any) => {
      acc[item.moeda] = (acc[item.moeda] || 0) + Number(item.valor || 0)
      return acc
    }, {})

    const totalUnico =
      moedas.length === 1
        ? totaisPorMoeda[moedas[0]] || 0
        : numero(dadosEmissor?.valores?.total) || 0

    const servicosFinanceiros = itens.map((item: any) => ({
      nome:
        moedas.length > 1
          ? `${normalizarTexto(item.nome)} (${item.moeda})`
          : normalizarTexto(item.nome),
      valor: String(item.valor),
    }))

    const resumoMoedas = Object.entries(totaisPorMoeda)
      .map(([moeda, total]) =>
        `${moeda} ${Number(total).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      )
      .join(' • ')

    return {
      servicosFinanceiros,
      total: totalUnico,
      moeda: moedaPrincipal,
      resumoMoedas,
    }
  }

  async function salvarReferenciaHC() {
    if (!cotacao) return

    setSalvandoRef(true)

    const { error } = await supabase
      .from('cotacoes')
      .update({ referencia_hc: referenciaHC || null })
      .eq('id', cotacao.id)

    setSalvandoRef(false)

    if (error) {
      alert('Erro ao salvar Referência HC')
      console.log(error)
      return
    }

    alert('Referência HC salva com sucesso')
    carregar()
  }

  async function enviarEmailCotacao(cotacaoAtualizada: any) {
    if (!cotacaoAtualizada?.solicitante_email) {
      alert('E-mail do solicitante não encontrado.')
      return false
    }

    try {
      setEnviandoEmail(true)

      const response = await fetch('/api/enviar-email-cotacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cotacaoAtualizada.solicitante_email,
          nome: cotacaoAtualizada.importador || cotacaoAtualizada.exportador || cotacaoAtualizada.cliente_final,
          referencia_hc: cotacaoAtualizada.referencia_hc,
          link: `${window.location.origin}/cliente/minhas-cotacoes`,
        }),
      })

      const resultado = await response.json().catch(() => null)

      if (!response.ok) {
        console.error(resultado)
        alert('A cotação foi disponibilizada, mas houve erro ao enviar o e-mail.')
        return false
      }

      setEmailEnviado(true)
      return true
    } catch (err) {
      console.error(err)
      alert('A cotação foi disponibilizada, mas houve erro ao enviar o e-mail.')
      return false
    } finally {
      setEnviandoEmail(false)
    }
  }

  async function atualizarStatus(status: string) {
    setEmailEnviado(false)

    const { data, error } = await supabase
      .from('cotacoes')
      .update({
        status,
        referencia_hc: referenciaHC || cotacao?.referencia_hc || null,
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      alert('Erro ao atualizar status')
      return
    }

    if (status === 'COTAÇÃO DISPONÍVEL') {
      await enviarEmailCotacao(data)
    }

    carregar()
  }

  async function anexarPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !cotacao) return

    if (file.type !== 'application/pdf') {
      alert('Envie apenas arquivo PDF')
      return
    }

    setEmailEnviado(false)
    setUploading(true)

    const nomeLimpo = file.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_+/g, '_')

    const nomeArquivo = `${cotacao.id}-${Date.now()}-${nomeLimpo}`

    const { error } = await supabase.storage
      .from('cotacoes')
      .upload(nomeArquivo, file, {
        upsert: true,
        contentType: 'application/pdf',
      })

    if (error) {
      console.log(error)
      alert(JSON.stringify(error))
      setUploading(false)
      return
    }

    const { data } = supabase.storage
      .from('cotacoes')
      .getPublicUrl(nomeArquivo)

    const { data: cotacaoAtualizada, error: erroUpdate } = await supabase
      .from('cotacoes')
      .update({
        pdf_cotacao_url: data.publicUrl,
        pdf_nome: file.name,
        referencia_hc: referenciaHC || cotacao.referencia_hc || null,
        status: 'COTAÇÃO DISPONÍVEL',
      })
      .eq('id', cotacao.id)
      .select()
      .single()

    setUploading(false)

    if (erroUpdate) {
      console.log(erroUpdate)
      alert('PDF enviado, mas houve erro ao atualizar a cotação.')
      return
    }

    await enviarEmailCotacao(cotacaoAtualizada)
    await carregar()
  }

  async function converterEmEmbarque() {
    if (!cotacao) return

    if (cotacao.embarque_id) {
      alert('Esta cotação já foi convertida em embarque.')
      window.location.href = `/admin/embarques/${cotacao.embarque_id}`
      return
    }

    const confirmar = confirm(
      'Converter esta cotação em embarque?\n\nO embarque será criado com AWB AGUARDANDO AWB. Os valores, serviços, documentos e vínculo do cliente serão levados da cotação.'
    )

    if (!confirmar) return

    setConvertendo(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert('Admin não identificado. Faça login novamente.')
        return
      }

      const { data: perfilAdmin } = await supabase
        .from('perfis')
        .select('nome, email')
        .eq('id', user.id)
        .single()

      const dadosEmissor: any = dadosEmissorObjeto()
      const formEmissor =
        dadosEmissor?.form && typeof dadosEmissor.form === 'object'
          ? dadosEmissor.form
          : {}

      const servico = cotacao.servico || cotacao.tipo_operacao || formEmissor.servico || null
      const operacao = normalizarTexto(servico)
      const empresaSolicitante =
        cotacao.cliente_final ||
        cotacao.empresa_solicitante ||
        formEmissor.empresa_solicitante ||
        null

      const ehImportacao = operacao.includes('IMPORT')
      const ehExportacao = operacao.includes('EXPORT')

      const exportador =
        cotacao.exportador ||
        (ehExportacao ? empresaSolicitante : null)

      const importador =
        cotacao.importador ||
        (ehImportacao ? empresaSolicitante : null)

      const pesoReal =
        numero(cotacao.peso_real) ??
        numero(dadosEmissor?.resumo?.pesoReal) ??
        numero(dadosEmissor?.resumo?.pesoBruto) ??
        numero(cotacao.peso)

      const pesoTaxado =
        numero(cotacao.peso_taxado) ??
        numero(dadosEmissor?.resumo?.pesoTaxado) ??
        numero(cotacao.peso)

      const financeiroCotacao = dadosFinanceirosCotacao()
      const transportadoraSelecionada = transportadoraSelecionadaCotacao()

      let clienteVinculadoId = cotacao.usuario_id || null
      let empresaClienteId: string | null = null

      if (clienteVinculadoId) {
        const { data: perfilCliente } = await supabase
          .from('perfis')
          .select('id, empresa_id')
          .eq('id', clienteVinculadoId)
          .maybeSingle()

        empresaClienteId = perfilCliente?.empresa_id || null
      } else if (cotacao.solicitante_email) {
        const { data: perfilCliente } = await supabase
          .from('perfis')
          .select('id, empresa_id')
          .ilike('email', String(cotacao.solicitante_email).trim())
          .eq('tipo_acesso', 'cliente')
          .maybeSingle()

        clienteVinculadoId = perfilCliente?.id || null
        empresaClienteId = perfilCliente?.empresa_id || null
      }

      const observacoesConversao = [
        'Embarque criado a partir da cotação.',
        `Serviço: ${servico || '-'}`,
        `Transportadora da cotação: ${transportadoraSelecionada || '-'}`,
        `Transportadoras consultadas: ${transportadorasTexto()}`,
        `Valor mercadoria: ${cotacao.moeda || formEmissor.moeda || ''} ${cotacao.valor_mercadoria || formEmissor.valor_mercadoria || '-'}`,
        financeiroCotacao.resumoMoedas
          ? `Total da cotação: ${financeiroCotacao.resumoMoedas}`
          : '',
        `Descrição: ${cotacao.descricao_mercadoria || formEmissor.descricao_mercadoria || '-'}`,
        `Observações do cliente: ${cotacao.observacoes || formEmissor.observacoes || '-'}`,
      ]
        .filter(Boolean)
        .join('\n')

      const { data: novoEmbarque, error } = await supabase
        .from('embarques')
        .insert([
          {
            usuario_id: clienteVinculadoId,
            empresa_id: empresaClienteId,
            cliente_final: empresaSolicitante || importador || exportador || null,

            criado_por_admin_id: user.id,
            criado_por_admin_nome: perfilAdmin?.nome || user.email || null,
            criado_por_admin_email: perfilAdmin?.email || user.email || null,

            responsavel_id: user.id,
            responsavel_nome: perfilAdmin?.nome || user.email || null,
            responsavel_email: perfilAdmin?.email || user.email || null,

            exportador,
            importador,
            referencia_cliente: cotacao.referencia_cliente || null,
            referencia_hc: referenciaHC || cotacao.referencia_hc || null,

            awb: `AGUARDANDO AWB:${cotacao.id}`,
            transportadora: transportadoraSelecionada,
            servico,
            origem: cotacao.origem || formEmissor.origem || null,
            destino: cotacao.destino || formEmissor.destino || null,

            peso_real: pesoReal,
            peso_taxado: pesoTaxado,

            valor_cobrado_cliente:
              financeiroCotacao.total > 0 ? financeiroCotacao.total : null,
            moeda_cobranca: financeiroCotacao.moeda || 'USD',
            taxa_conversao: null,
            spread_percentual: null,
            servicos_financeiros: financeiroCotacao.servicosFinanceiros,

            status_operacional: 'Aguardando AWB',
            data_envio: null,
            data_prevista: null,
            ultima_atualizacao: new Date().toISOString(),
            observacoes: observacoesConversao,
          },
        ])
        .select()
        .single()

      if (error) {
        console.log(error)
        alert(error.message)
        return
      }

      if (clienteVinculadoId) {
        const { error: erroVinculo } = await supabase
          .from('embarque_clientes')
          .upsert(
            [
              {
                embarque_id: novoEmbarque.id,
                cliente_id: clienteVinculadoId,
              },
            ],
            { onConflict: 'embarque_id,cliente_id' }
          )

        if (erroVinculo) {
          console.error('Embarque criado, mas houve erro ao vincular cliente:', erroVinculo)
        }
      }

      for (const doc of documentosCliente) {
        const { error: erroDocumento } = await supabase.from('documentos_embarques').insert([
          {
            embarque_id: novoEmbarque.id,
            nome: doc.nome,
            url: doc.url,
            caminho: doc.caminho || null,
          },
        ])

        if (erroDocumento) {
          console.error('Erro ao copiar documento da cotação:', erroDocumento)
        }
      }

      const pdfCotacaoUrl =
        cotacao.pdf_cotacao_url || cotacao.arquivo_resposta_url || null

      if (pdfCotacaoUrl) {
        const { error: erroPdf } = await supabase.from('documentos_embarques').insert([
          {
            embarque_id: novoEmbarque.id,
            nome: cotacao.pdf_nome
              ? `Cotação aprovada - ${cotacao.pdf_nome}`
              : 'Cotação aprovada - PDF',
            url: pdfCotacaoUrl,
            caminho: null,
          },
        ])

        if (erroPdf) {
          console.error('Erro ao vincular PDF da cotação ao embarque:', erroPdf)
        }
      }

      const { error: erroCotacao } = await supabase
        .from('cotacoes')
        .update({
          status: 'CONVERTIDA EM EMBARQUE',
          embarque_id: novoEmbarque.id,
          referencia_hc: referenciaHC || cotacao.referencia_hc || null,
        })
        .eq('id', cotacao.id)

      if (erroCotacao) {
        console.error('Embarque criado, mas houve erro ao atualizar a cotação:', erroCotacao)
      }

      await supabase.from('timeline_embarques').insert([
        {
          embarque_id: novoEmbarque.id,
          status: 'CRIADO POR COTAÇÃO',
          descricao:
            financeiroCotacao.total > 0
              ? `Embarque criado automaticamente a partir da cotação aprovada com ${financeiroCotacao.servicosFinanceiros.length} serviço(s) e total ${financeiroCotacao.moeda} ${financeiroCotacao.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
              : 'Embarque criado automaticamente a partir de uma cotação aprovada.',
        },
      ])

      alert(
        'Embarque criado com sucesso.\n\nAgora informe o AWB. Ao salvar o número real, o portal tentará atualizar o rastreio imediatamente.'
      )
      window.location.href = `/admin/embarques/${novoEmbarque.id}`
    } catch (erro: any) {
      console.error('Erro ao converter cotação em embarque:', erro)
      alert(erro?.message || 'Erro ao converter cotação em embarque.')
    } finally {
      setConvertendo(false)
    }
  }

  function formatarTamanho(bytes?: number) {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  if (!cotacao) {
    return <main className="p-10 text-white">Carregando cotação...</main>
  }

  return (
    <main className="w-full max-w-none p-8 text-white">
      <div className="mb-8 flex flex-col lg:flex-row justify-between gap-5">
        <div>
          <h1 className="text-5xl font-black mb-2">Cotação</h1>
          <p className="text-slate-400 text-lg">
            Detalhes completos da solicitação.
          </p>
        </div>

        <a
          href="/admin/cotacoes"
          className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold h-fit"
        >
          Voltar para fila
        </a>
      </div>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">Resumo</h2>

        <div className="form-grid">
          <div>
            <strong className="text-slate-400">Solicitante</strong>
            <p>{cotacao.solicitante_email || '-'}</p>
          </div>

          <div>
            <strong className="text-slate-400">Referência cliente</strong>
            <p>{cotacao.referencia_cliente || '-'}</p>
          </div>

          <div>
            <strong className="text-slate-400">Status</strong>
            <p>{cotacao.status}</p>
          </div>

          <div>
            <strong className="text-slate-400">Arquivo resposta HC</strong>
            <p>{cotacao.pdf_nome || 'Nenhum PDF anexado'}</p>
          </div>
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">Dados da operação</h2>

        <div className="form-grid">
          <Info titulo="Exportador" valor={exportadorCotacao() || '-'} />
          <Info titulo="Importador" valor={importadorCotacao() || '-'} />
          <Info titulo="Serviço" valor={servicoCotacao()} />
          <Info titulo="Transportadoras consultadas" valor={transportadorasTexto()} />
          <Info titulo="Origem" valor={cotacao.origem || '-'} />
          <Info titulo="Destino" valor={cotacao.destino || '-'} />
          <Info titulo="Peso real" valor={pesoRealCotacao() ? `${pesoRealCotacao()} kg` : '-'} />
          <Info titulo="Peso taxado" valor={pesoTaxadoCotacao() ? `${pesoTaxadoCotacao()} kg` : '-'} />
          <Info titulo="Dimensões gerais" valor={cotacao.dimensoes || '-'} />
          <Info titulo="Valor da mercadoria" valor={`${cotacao.moeda || ''} ${cotacao.valor_mercadoria || '-'}`} />
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">
          Documentos enviados pelo cliente
        </h2>

        {documentosCliente.length === 0 ? (
          <p className="text-slate-400">
            Nenhum documento enviado pelo cliente.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {documentosCliente.map((doc) => (
              <div
                key={doc.id}
                className="border border-blue-900 rounded-2xl p-5 bg-[#071225]"
              >
                <p className="font-black text-white mb-2">
                  📎 {doc.nome || 'Documento'}
                </p>

                <p className="text-slate-400 text-sm mb-4">
                  {formatarTamanho(doc.tamanho)}
                </p>

                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-xl text-white font-bold inline-block"
                >
                  Abrir documento
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">Referência HC</h2>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
          <div>
            <label className="block text-slate-400 font-bold mb-2">
              Número de referência da cotação
            </label>

            <input
              type="text"
              value={referenciaHC}
              onChange={(e) => setReferenciaHC(e.target.value)}
              placeholder="Ex: HC-2026-0001"
            />
          </div>

          <button
            onClick={salvarReferenciaHC}
            disabled={salvandoRef}
            className="bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold disabled:opacity-60"
          >
            {salvandoRef ? 'Salvando...' : 'Salvar referência'}
          </button>
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">Mercadoria</h2>

        <p className="text-slate-300 leading-8">
          {cotacao.descricao_mercadoria || 'Sem descrição informada.'}
        </p>

        <h3 className="text-xl font-black mt-8 mb-3">Observações</h3>

        <p className="text-slate-300 leading-8">
          {cotacao.observacoes || 'Sem observações.'}
        </p>
      </section>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">Volumes</h2>

        {!cotacao.volumes || cotacao.volumes.length === 0 ? (
          <p className="text-slate-400">Nenhum volume informado.</p>
        ) : (
          <div className="overflow-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Qtd</th>
                  <th>Comprimento</th>
                  <th>Largura</th>
                  <th>Altura</th>
                  <th>Peso</th>
                </tr>
              </thead>

              <tbody>
                {cotacao.volumes.map((volume: any, index: number) => (
                  <tr key={index}>
                    <td>{volume.quantidade}</td>
                    <td>{volume.comprimento_cm} cm</td>
                    <td>{volume.largura_cm} cm</td>
                    <td>{volume.altura_cm} cm</td>
                    <td>{volume.peso_kg} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <EmissorCotacaoHC
        cotacao={cotacao}
        referenciaHC={referenciaHC || cotacao?.referencia_hc || ''}
        onPdfSalvo={carregar}
        enviarEmailCotacao={enviarEmailCotacao}
      />

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">Resposta da cotação</h2>

        <div className="flex gap-4 flex-wrap items-center">
          <label className="btn-primary cursor-pointer">
            {uploading ? 'Enviando PDF...' : 'Anexar PDF da cotação'}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={anexarPdf}
            />
          </label>

          {cotacao.pdf_cotacao_url && (
            <a
              href={cotacao.pdf_cotacao_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              Abrir PDF anexado
            </a>
          )}

          <button
            onClick={() => atualizarStatus('COTAÇÃO DISPONÍVEL')}
            disabled={enviandoEmail}
            className="bg-emerald-600 hover:bg-emerald-500 px-5 py-3 rounded-xl font-bold disabled:opacity-60"
          >
            {enviandoEmail
              ? 'Enviando e-mail...'
              : 'Disponibilizar cotação e notificar cliente'}
          </button>
        </div>

        {emailEnviado && (
          <div className="mt-4 bg-blue-900/30 border border-blue-500 rounded-xl p-4">
            <p className="text-blue-400 font-bold">
              E-mail enviado com sucesso
            </p>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="text-2xl font-black mb-6">Ações</h2>

        <div className="flex gap-4 flex-wrap">
          <button onClick={() => atualizarStatus('EM ANÁLISE')}>
            Marcar em análise
          </button>

          <button
            onClick={() => atualizarStatus('AGUARDANDO TRANSPORTADORA')}
            className="bg-purple-600 hover:bg-purple-500"
          >
            Aguardando transportadora
          </button>

          {cotacao.status === 'COTAÇÃO DISPONÍVEL' && (
            <button
              onClick={() => atualizarStatus('APROVADA')}
              className="bg-green-700 hover:bg-green-600"
            >
              Aprovar cotação
            </button>
          )}

          <button
            onClick={() => atualizarStatus('RECUSADA')}
            className="bg-red-600 hover:bg-red-500"
          >
            Recusar
          </button>

          {(cotacao.status === 'APROVADA' || cotacao.status === 'AUTORIZADA') && (
            <button
              onClick={converterEmEmbarque}
              disabled={convertendo}
              className="bg-green-700 hover:bg-green-600 disabled:opacity-60"
            >
              {convertendo ? 'Convertendo...' : '🚚 Converter em embarque'}
            </button>
          )}
        </div>
      </section>
    </main>
  )
}

function Info({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <strong className="text-slate-400">{titulo}</strong>
      <p>{valor || '-'}</p>
    </div>
  )
}
