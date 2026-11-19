'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import StatusBadge from '@/components/StatusBadge'
import { numeroValorBR } from '@/lib/valorContabil'

type ServicoFinanceiroEmbarque = {
  nome: string
  valor: string
  moeda?: string
}

function awbPendente(valor: any) {
  return String(valor || '').trim().toUpperCase().startsWith('AGUARDANDO AWB')
}

function awbExibicao(valor: any) {
  if (awbPendente(valor)) return 'AGUARDANDO AWB'
  return String(valor || '').trim() || '-'
}

export default function DetalheEmbarquePage() {
  const params = useParams()

  const [embarque, setEmbarque] = useState<any>(null)
  const [erroCarregamento, setErroCarregamento] = useState('')
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [timeline, setTimeline] = useState<any[]>([])
  const [rastreioReal, setRastreioReal] = useState<any[]>([])
  const [documentos, setDocumentos] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [tipoDocumentoUpload, setTipoDocumentoUpload] = useState('DOCUMENTO_GERAL')
  const [atualizandoRastreio, setAtualizandoRastreio] = useState(false)

  const [editandoStatus, setEditandoStatus] = useState(false)
  const [novoStatus, setNovoStatus] = useState('')
  const [descricaoStatus, setDescricaoStatus] = useState('')
  const [salvandoStatus, setSalvandoStatus] = useState(false)

  const [masterNumero, setMasterNumero] = useState('')
  const [salvandoMaster, setSalvandoMaster] = useState(false)

  // HC_TRES_CORRECOES_V1_DETALHE: edicao operacional sem alterar financeiro/rastreio.
  const [editandoDados, setEditandoDados] = useState(false)
  const [salvandoDados, setSalvandoDados] = useState(false)
  const [dadosEdicao, setDadosEdicao] = useState<Record<string, string>>({})

  useEffect(() => {
    carregar()
    carregarUsuarios()
  }, [])

  async function carregar() {
    setErroCarregamento('')

    const { data, error } = await supabase
      .from('embarques')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()

    if (error) {
      console.log(error)
      setEmbarque(null)
      setErroCarregamento(
        'Não foi possível consultar o embarque solicitado. Atualize a página e tente novamente.'
      )
      return
    }

    if (!data) {
      setEmbarque(null)
      setErroCarregamento(
        'O ID informado não corresponde a um embarque disponível no cadastro atual.'
      )
      return
    }

    setEmbarque(data)
    setMasterNumero(data.master || '')
    setDadosEdicao({
      awb: awbPendente(data.awb) ? '' : String(data.awb || ''),
      transportadora: String(data.transportadora || ''),
      servico: String(data.servico || ''),
      exportador: String(data.exportador || ''),
      importador: String(data.importador || ''),
      referencia_cliente: String(data.referencia_cliente || ''),
      despachante: String(data.despachante || ''),
      origem: String(data.origem || ''),
      destino: String(data.destino || ''),
      data_prevista: String(data.data_prevista || '').slice(0, 10),
      peso_real: data.peso_real == null ? '' : String(data.peso_real).replace('.', ','),
      peso_taxado: data.peso_taxado == null ? '' : String(data.peso_taxado).replace('.', ','),
      observacoes: String(data.observacoes || ''),
    })
    if (new URLSearchParams(window.location.search).get('editar') === '1') {
      setEditandoDados(true)
    }

    const { data: timelineData } = await supabase
      .from('timeline_embarques')
      .select('*')
      .eq('embarque_id', params.id)
      .order('criado_em', { ascending: false })

    setTimeline(timelineData || [])

    const { data: rastreioData } = await supabase
      .from('rastreios_embarques')
      .select('*')
      .eq('embarque_id', params.id)
      .order('data_evento', { ascending: false })

    setRastreioReal(rastreioData || [])

    const { data: documentosData, error: documentosError } = await supabase
      .from('documentos_embarques')
      .select('*')
      .eq('embarque_id', params.id)
      .order('criado_em', { ascending: false })

    if (documentosError) {
      console.log(documentosError)
    }

    setDocumentos(documentosData || [])
  }

  async function salvarDadosPrincipais() {
    if (!embarque || salvandoDados) return

    const novoAwb = String(dadosEdicao.awb || '').trim().toUpperCase().replace(/\s+/g, '')
    const awbAnterior = String(embarque.awb || '').trim()
    const anteriorReal = !!awbAnterior && !awbPendente(awbAnterior)
    const mudouAwb = novoAwb !== (anteriorReal ? awbAnterior.toUpperCase().replace(/\s+/g, '') : '')

    if (novoAwb && !/^[A-Z0-9-]{6,50}$/.test(novoAwb)) {
      alert('Confira o AWB: informe de 6 a 50 caracteres (letras, numeros ou hifen).')
      return
    }
    if (anteriorReal && !novoAwb) {
      alert('Para evitar perder o rastreio, não é permitido apagar um AWB já preenchido.')
      return
    }

    const pesoReal = dadosEdicao.peso_real?.trim() ? numeroValorBR(dadosEdicao.peso_real) : null
    const pesoTaxado = dadosEdicao.peso_taxado?.trim() ? numeroValorBR(dadosEdicao.peso_taxado) : null
    if ([pesoReal, pesoTaxado].some((n) => n !== null && (!Number.isFinite(n) || n < 0))) {
      alert('Informe pesos válidos e não negativos.')
      return
    }

    setSalvandoDados(true)
    try {
      if (mudouAwb && novoAwb) {
        const { data: iguais, error: erroIguais } = await supabase
          .from('embarques')
          .select('id')
          .eq('awb', novoAwb)
          .neq('id', embarque.id)
          .limit(1)
        if (erroIguais) throw new Error('Não foi possível verificar duplicidade de AWB: ' + erroIguais.message)
        if (iguais?.length) throw new Error('Este AWB já pertence a outro embarque. Operação cancelada.')
      }

      if (mudouAwb && anteriorReal) {
        // Um AWB com lançamentos financeiros vinculados não pode ser renomeado aqui.
        const { data: financeiros, error: erroFinanceiros } = await supabase
          .from('financeiro_embarques')
          .select('id')
          .eq('awb', awbAnterior)
          .limit(1)
        if (erroFinanceiros) throw new Error('Não foi possível verificar os vínculos financeiros: ' + erroFinanceiros.message)
        if (financeiros?.length) throw new Error('AWB já vinculado ao financeiro. Faça a conciliação dos vínculos antes de alterar seu número.')
        if (!confirm('Alterar o AWB existente? Confira documentos e cotações que possam mencionar o número antigo. A referência HC não será alterada.')) return
      }

      const campos: any = {
        transportadora: dadosEdicao.transportadora?.trim() || null,
        servico: dadosEdicao.servico?.trim() || null,
        exportador: dadosEdicao.exportador?.trim() || null,
        importador: dadosEdicao.importador?.trim() || null,
        referencia_cliente: dadosEdicao.referencia_cliente?.trim() || null,
        despachante: dadosEdicao.despachante?.trim() || null,
        origem: dadosEdicao.origem?.trim() || null,
        destino: dadosEdicao.destino?.trim() || null,
        data_prevista: dadosEdicao.data_prevista || null,
        peso_real: pesoReal,
        peso_taxado: pesoTaxado,
        observacoes: dadosEdicao.observacoes || null,
        ultima_atualizacao: new Date().toISOString(),
      }
      if (mudouAwb) {
        campos.awb = novoAwb || (awbPendente(awbAnterior) ? awbAnterior : null)
        if (novoAwb && String(embarque.status_operacional || '').toUpperCase() === 'AGUARDANDO AWB') {
          campos.status_operacional = 'Aguardando coleta'
        }
      }

      // Proteção contra alterações concorrentes, inclusive AWB originalmente nulo.
      const atualizador = supabase.from('embarques').update(campos).eq('id', embarque.id)
      const { data: salvo, error: erroSalvar } = await (
        embarque.awb == null
          ? atualizador.is('awb', null)
          : atualizador.eq('awb', embarque.awb)
      ).select('id')
      if (erroSalvar) throw new Error(erroSalvar.message)
      if (!salvo || salvo.length !== 1) throw new Error('O AWB mudou em outra sessão. Recarregue o embarque antes de salvar.')

      const { error: erroTimeline } = await supabase.from('timeline_embarques').insert({
        embarque_id: embarque.id,
        status: 'EDIÇÃO',
        descricao: mudouAwb
          ? `Dados do embarque atualizados. AWB: ${awbAnterior || '-'} -> ${novoAwb || '-'}.`
          : 'Dados gerais do embarque atualizados no detalhe administrativo.',
      })
      if (erroTimeline) console.warn('Dados salvos, mas a timeline não foi atualizada:', erroTimeline)
      setEditandoDados(false)
      window.history.replaceState(null, '', window.location.pathname)
      await carregar()
      alert('Dados e AWB salvos com sucesso.')
    } catch (erro: any) {
      alert('Não foi possível salvar o embarque: ' + (erro?.message || 'erro desconhecido'))
    } finally {
      setSalvandoDados(false)
    }
  }

  async function carregarUsuarios() {
    const { data } = await supabase
      .from('perfis')
      .select('*')
      .eq('tipo_acesso', 'cliente')
      .order('nome')

    setUsuarios(data || [])
  }

  function nomeUsuario(usuarioId: string) {
    const usuario = usuarios.find((item) => item.id === usuarioId)
    return usuario?.nome || usuario?.email || 'Não vinculado'
  }

  function normalizarDocumento(valor: any) {
    return String(valor || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  }

  function documentoEhConhecimento(documento: any) {
    const texto = normalizarDocumento(`${documento?.nome || ''} ${documento?.url || ''} ${documento?.caminho || ''}`)

    return (
      texto.includes('conhecimento') ||
      texto.includes('bill-of-lading') ||
      texto.includes('waybill') ||
      texto.includes('awb')
    )
  }

  function nomeSeguroArquivo(nome: string) {
    const seguro = String(nome || 'arquivo')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    return seguro || 'arquivo'
  }

  function nomeDocumentoUpload(file: File) {
    if (tipoDocumentoUpload === 'CONHECIMENTO_EMBARQUE') {
      return `Conhecimento de Embarque - ${file.name}`
    }

    return file.name
  }

  function linkRastreio() {
    if (!embarque?.awb || awbPendente(embarque.awb)) return ''

    const transportadora = (embarque.transportadora || '').toUpperCase()

    if (transportadora.includes('DHL')) {
      return `https://mydhl.express.dhl/br/pt/tracking.html#/results?id=${embarque.awb}`
    }

    if (transportadora.includes('FEDEX')) {
      return `https://www.fedex.com/fedextrack/?trknbr=${embarque.awb}`
    }

    if (transportadora.includes('UPS')) {
      return `https://www.ups.com/track?tracknum=${embarque.awb}`
    }

    return ''
  }

  async function atualizarStatus(statusManual?: string) {
    if (!embarque) return

    const statusFinal = statusManual || novoStatus

    if (!statusFinal) {
      alert('Selecione um status')
      return
    }

    setSalvandoStatus(true)

    const dadosAtualizar: any = {
      status_operacional: statusFinal,
      ultima_atualizacao: new Date().toISOString(),
    }

    if (statusFinal === 'Coletado' && !embarque.data_envio) {
      dadosAtualizar.data_envio = new Date().toISOString().split('T')[0]
    }

    if (statusFinal === 'Entregue') {
      dadosAtualizar.data_entrega = new Date().toISOString().split('T')[0]
    }

    const { error } = await supabase
      .from('embarques')
      .update(dadosAtualizar)
      .eq('id', embarque.id)

    if (error) {
      alert(`Erro ao atualizar status: ${error.message}`)
      console.log(error)
      setSalvandoStatus(false)
      return
    }

    const { error: erroTimeline } = await supabase.from('timeline_embarques').insert({
      embarque_id: embarque.id,
      status: statusFinal,
      descricao:
        descricaoStatus ||
        `Status atualizado para ${statusFinal} pela HC Consultoria.`,
    })

    if (erroTimeline) {
      alert(`Status atualizado, mas houve erro ao gravar timeline: ${erroTimeline.message}`)
      console.log(erroTimeline)
    }

    setNovoStatus('')
    setDescricaoStatus('')
    setEditandoStatus(false)
    setSalvandoStatus(false)

    await carregar()
  }

  async function salvarMaster() {
    if (!embarque) return

    const masterLimpo = masterNumero.trim()

    setSalvandoMaster(true)

    const dadosAtualizar: any = {
      master: masterLimpo || null,
      data_master: masterLimpo ? embarque.data_master || new Date().toISOString() : null,
      ultima_atualizacao: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('embarques')
      .update(dadosAtualizar)
      .eq('id', embarque.id)

    if (error) {
      alert(`Erro ao salvar master: ${error.message}`)
      console.log(error)
      setSalvandoMaster(false)
      return
    }

    await supabase.from('timeline_embarques').insert({
      embarque_id: embarque.id,
      status: 'MASTER',
      descricao: masterLimpo
        ? `Master informado: ${masterLimpo}`
        : 'Master removido do embarque.',
    })

    setSalvandoMaster(false)
    await carregar()
    alert(masterLimpo ? 'Master salvo com sucesso.' : 'Master removido com sucesso.')
  }

  async function atualizarRastreio() {
  if (!embarque?.id) {
    alert('Embarque não encontrado.')
    return
  }

  const {
    data: { session: sessaoRastreio },
  } = await supabase.auth.getSession()

  const accessTokenRastreio = sessaoRastreio?.access_token

  if (!accessTokenRastreio) {
    alert('Sessão administrativa expirada. Entre novamente.')
    return
  }

  setAtualizandoRastreio(true)

  try {
    const response = await fetch('/api/rastreio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessTokenRastreio}`,
      },
      body: JSON.stringify({
        embarque_id: embarque.id,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      const detalhes = String(data.detalhes || '')

      if (
        detalhes.includes('Too Many Requests') ||
        detalhes.includes('429')
      ) {
        alert(
          'A DHL bloqueou temporariamente novas consultas por excesso de requisições.\n\nTente novamente em alguns minutos.'
        )
        return
      }

      alert(data.error || 'Erro ao atualizar rastreio.')
      return
    }

    alert(`Rastreio atualizado: ${data.status}`)

    await carregar()
  } catch (error) {
    alert('Erro ao atualizar rastreio.')
  } finally {
    setAtualizandoRastreio(false)
  }
}

  async function uploadArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]

    if (!file || !embarque) return

    setUploading(true)

    const pasta = tipoDocumentoUpload === 'CONHECIMENTO_EMBARQUE' ? 'conhecimento-embarque' : 'documentos'
    const nomeArquivo = `${embarque.id}/${pasta}/${Date.now()}-${nomeSeguroArquivo(file.name)}`

    const { error } = await supabase.storage
      .from('documentos')
      .upload(nomeArquivo, file, {
        upsert: true,
      })

    if (error) {
      alert('Erro ao enviar arquivo')
      console.log(error)
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('documentos').getPublicUrl(nomeArquivo)

    const { error: insertError } = await supabase
      .from('documentos_embarques')
      .insert({
        embarque_id: embarque.id,
        nome: nomeDocumentoUpload(file),
        url: data.publicUrl,
        caminho: nomeArquivo,
      })

    if (insertError) {
      console.log('ERRO DOCUMENTO:', insertError)

      alert(
        `${insertError.message}\n\n${insertError.details || ''}\n\n${insertError.hint || ''}`
      )

      setUploading(false)
      return
    }

    await supabase
      .from('embarques')
      .update({
        documento_url: data.publicUrl,
        ultima_atualizacao: new Date().toISOString(),
      })
      .eq('id', embarque.id)

    await supabase.from('timeline_embarques').insert({
      embarque_id: embarque.id,
      status: 'DOCUMENTO',
      descricao:
        tipoDocumentoUpload === 'CONHECIMENTO_EMBARQUE'
          ? `Conhecimento de Embarque enviado: ${file.name}`
          : `Documento enviado: ${file.name}`,
    })

    e.target.value = ''
    setUploading(false)
    await carregar()

    alert(
      tipoDocumentoUpload === 'CONHECIMENTO_EMBARQUE'
        ? 'Conhecimento de Embarque enviado com sucesso e disponível para o cliente.'
        : 'Arquivo enviado com sucesso'
    )
  }

  async function excluirDocumento(documento: any) {
    const confirmar = confirm(`Deseja excluir o documento "${documento.nome}"?`)
    if (!confirmar) return

    if (documento.caminho) {
      await supabase.storage.from('documentos').remove([documento.caminho])
    }

    const { error } = await supabase
      .from('documentos_embarques')
      .delete()
      .eq('id', documento.id)

    if (error) {
      alert('Erro ao excluir documento')
      console.log(error)
      return
    }

    await supabase.from('timeline_embarques').insert({
      embarque_id: embarque.id,
      status: 'DOCUMENTO',
      descricao: `Documento excluído: ${documento.nome}`,
    })

    await carregar()
  }


  function numeroFinanceiro(valor: any) {
    return numeroValorBR(valor)
  }


  function moeda(valor: any, moedaBase = 'USD') {
    if (valor === null || valor === undefined || valor === '') return '-'

    const numeroValor = Number(valor || 0)

    if (moedaBase === 'BRL') {
      return numeroValor.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })
    }

    return `${moedaBase} ${numeroValor.toFixed(2)}`
  }

  function chaveServicoFinanceiro(nome: any) {
    const base = String(nome || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase()

    if (base === 'FRETE' || base === 'FRETE INTERNACIONAL' || base === 'INTERNATIONAL FREIGHT') {
      return { chave: 'FRETE', nome: 'FRETE' }
    }

    if (base === 'DELIVERY DOC FEE' || base === 'DELIVERY FEE DOC' || base === 'DELIVER FEE DOC') {
      return { chave: 'DELIVERY_FEE_DOC', nome: 'DELIVER FEE DOC' }
    }

    if (base === 'INSURANCE' || base.includes('SEGURO')) {
      return { chave: 'SEGURO', nome: 'SEGURO' }
    }

    return { chave: base, nome: base }
  }

  function moedaItemFinanceiro(item: any, moedaPadrao = '') {
    const explicita = String(item?.moeda || '').trim().toUpperCase()
    if (explicita) return explicita

    const encontradaNoNome = String(item?.nome || '')
      .trim()
      .match(/\(([A-Z]{3})\)\s*$/i)?.[1]

    return String(encontradaNoNome || moedaPadrao || '')
      .trim()
      .toUpperCase()
  }

  function nomeItemFinanceiro(item: any) {
    return String(item?.nome || '')
      .replace(/\s*\(([A-Z]{3})\)\s*$/i, '')
      .trim()
  }

  function servicosFinanceirosLista(lista: any): ServicoFinanceiroEmbarque[] {
    if (!Array.isArray(lista)) return []

    const itens = new Map<string, ServicoFinanceiroEmbarque>()

    for (const item of lista) {
      const nomeOriginal = nomeItemFinanceiro(item)
      if (!nomeOriginal) continue

      const canonico = chaveServicoFinanceiro(nomeOriginal)
      const moedaItem = moedaItemFinanceiro(item)
      const chaveItem = `${canonico.chave}|${moedaItem || 'PADRAO'}`

      if (!canonico.chave || itens.has(chaveItem)) continue

      const valor =
        Math.round(
          (numeroFinanceiro(item?.valor) + Number.EPSILON) * 100
        ) / 100

      itens.set(chaveItem, {
        nome: canonico.nome,
        valor: String(valor),
        ...(moedaItem ? { moeda: moedaItem } : {}),
      })
    }

    return Array.from(itens.values())
  }

  function totaisServicosFinanceirosPorMoeda(
    lista: any,
    moedaPadrao = 'USD'
  ) {
    const totais: Record<string, number> = {}

    for (const item of servicosFinanceirosLista(lista)) {
      const moedaItem =
        moedaItemFinanceiro(item, moedaPadrao) ||
        String(moedaPadrao || 'USD').toUpperCase()

      const valor = numeroFinanceiro(item.valor)
      const sinal = item.nome === 'DESCONTO' ? -1 : 1

      totais[moedaItem] =
        (totais[moedaItem] || 0) + valor * sinal
    }

    return totais
  }

  function resumoTotaisServicosFinanceiros(
    lista: any,
    moedaPadrao = 'USD'
  ) {
    return Object.entries(
      totaisServicosFinanceirosPorMoeda(lista, moedaPadrao)
    )
      .filter(([, total]) => Math.abs(Number(total || 0)) > 0.0001)
      .map(([codigo, total]) => moeda(total, codigo))
      .join(' + ')
  }

  function quantidadeServicosFinanceiros(lista: any) {
    return servicosFinanceirosLista(lista).length
  }

  function classeItemFinanceiro(nome: string) {
    return nome === 'DESCONTO'
      ? 'border-red-500/60 bg-red-600/10 text-red-300'
      : 'border-green-500/60 bg-green-600/10 text-green-300'
  }

  function statusNormalizadoVisual() {
    return String(embarque?.status_operacional || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  }

  function indiceStatusAtual() {
    const status = statusNormalizadoVisual()

    if (status.includes('entregue')) return 5
    if (status.includes('liberado') || status.includes('saiu para entrega')) return 4
    if (status.includes('fiscalizacao')) return 3
    if (status.includes('em transito')) return 2
    if (status.includes('coletado')) return 1

    if (
      status.includes('aguardando coleta') ||
      status.includes('etiqueta gerada') ||
      status.includes('aguardando awb')
    ) {
      return 0
    }

    return 0
  }

  function indiceEtapa(etapa: string) {
    const mapa: Record<string, number> = {
      aguardando_coleta: 0,
      coleta: 1,
      transito: 2,
      fiscalizacao: 3,
      liberado: 4,
      entregue: 5,
    }

    return mapa[etapa] ?? 0
  }

  function etapaConcluida(etapa: string) {
    return indiceEtapa(etapa) <= indiceStatusAtual()
  }

  function etapaAtual(etapa: string) {
    return indiceEtapa(etapa) === indiceStatusAtual()
  }

  if (erroCarregamento) {
    return (
      <main className="w-full max-w-none p-8 text-white">
        <section className="mx-auto max-w-3xl rounded-3xl border border-red-700 bg-[#071225] p-8">
          <p className="text-sm font-black uppercase tracking-wide text-red-300">
            Embarque não localizado
          </p>
          <h1 className="mt-2 text-3xl font-black">Não foi possível abrir este embarque</h1>
          <p className="mt-4 font-semibold text-slate-300">{erroCarregamento}</p>
          <p className="mt-3 break-all text-xs font-bold text-slate-500">
            ID solicitado: {String(params.id || '-')}
          </p>
          <a
            href="/admin/cotacoes"
            className="mt-6 inline-flex rounded-xl bg-slate-700 px-5 py-3 font-black text-white hover:bg-slate-600"
          >
            Voltar para cotações
          </a>
        </section>
      </main>
    )
  }

  if (!embarque) {
    return <main className="p-10 text-white">Carregando embarque...</main>
  }

  return (
    <main className="w-full max-w-none p-6 text-white lg:p-8">
      <header className="border border-blue-900 rounded-3xl bg-[#071225] p-8 mb-8 shadow-[0_0_35px_rgba(37,99,235,0.12)]">
        <div className="flex flex-col lg:flex-row justify-between gap-8">
          <div>
            <p className="text-blue-400 font-bold mb-2">Detalhe do embarque</p>

            <h1 className="text-5xl font-black mb-3">
              AWB {awbExibicao(embarque.awb)}
            </h1>

            <div className="flex items-center gap-4 flex-wrap">
              <StatusBadge status={embarque.status_operacional} />

              <span className="text-slate-400">
                {embarque.transportadora || '-'} • {embarque.servico || '-'}
              </span>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap h-fit">
            <button
              onClick={() => setEditandoDados((atual) => !atual)}
              className="bg-emerald-700 hover:bg-emerald-600 px-5 py-3 rounded-xl font-bold"
            >
              {editandoDados ? 'Fechar edição' : 'Editar dados / AWB'}
            </button>
            <a
              href="/admin/embarques"
              className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold"
            >
              Voltar
            </a>

            {linkRastreio() && (
              <a
                href={linkRastreio()}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-yellow-500 hover:bg-yellow-400 px-5 py-3 rounded-xl text-black font-bold"
              >
                Rastrear
              </a>
            )}

            <button
              onClick={atualizarRastreio}
              disabled={atualizandoRastreio}
              className="bg-purple-600 hover:bg-purple-500 px-5 py-3 rounded-xl font-bold disabled:opacity-60"
            >
              {atualizandoRastreio ? 'Atualizando...' : '🔄 Atualizar rastreio'}
            </button>

            <button
              onClick={() => {
                setNovoStatus(embarque.status_operacional || '')
                setEditandoStatus(!editandoStatus)
              }}
              className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl font-bold"
            >
              Alterar status
            </button>

            <button
              onClick={() => atualizarStatus('Entregue')}
              disabled={salvandoStatus}
              className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-bold disabled:opacity-60"
            >
              Finalizar
            </button>
          </div>
        </div>
      </header>

      {editandoDados && (
        <section className="card mb-8 border border-emerald-700" data-hc-editor-awb="v1">
          <div className="mb-5">
            <h2 className="text-2xl font-black">Editar dados do embarque e AWB</h2>
            <p className="text-sm text-slate-400 mt-1">Edite aqui após converter a cotação ou o embarque direto. A referência HC, os registros financeiros e o rastreio automático serão preservados.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {([
              ['awb', 'AWB / Número de rastreio'],
              ['transportadora', 'Transportadora'],
              ['servico', 'Serviço'],
              ['exportador', 'Exportador'],
              ['importador', 'Importador'],
              ['referencia_cliente', 'Referência do cliente'],
              ['despachante', 'Despachante / Parceiro'],
              ['origem', 'Origem'],
              ['destino', 'Destino'],
              ['peso_real', 'Peso real (kg)'],
              ['peso_taxado', 'Peso taxado (kg)'],
              ['data_prevista', 'Data prevista'],
            ] as const).map(([campo, titulo]) => (
              <label key={campo} className="flex flex-col gap-1 text-sm font-semibold text-slate-300">
                {titulo}
                <input
                  type={campo === 'data_prevista' ? 'date' : 'text'}
                  inputMode={campo === 'peso_real' || campo === 'peso_taxado' ? 'decimal' : 'text'}
                  value={dadosEdicao[campo] || ''}
                  onChange={(e) => setDadosEdicao((atual) => ({ ...atual, [campo]: e.target.value }))}
                  className="rounded-xl border border-blue-800 bg-[#051029] px-3 py-3 text-white"
                />
              </label>
            ))}
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-300 md:col-span-2 xl:col-span-3">
              Observações do embarque
              <textarea
                rows={3}
                value={dadosEdicao.observacoes || ''}
                onChange={(e) => setDadosEdicao((atual) => ({ ...atual, observacoes: e.target.value }))}
                className="rounded-xl border border-blue-800 bg-[#051029] px-3 py-3 text-white"
              />
            </label>
          </div>
          <div className="flex justify-end gap-3 mt-5">
            <button onClick={() => setEditandoDados(false)} className="bg-slate-700 rounded-xl px-5 py-3 font-bold">Cancelar</button>
            <button
              disabled={salvandoDados}
              onClick={salvarDadosPrincipais}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 rounded-xl px-5 py-3 font-bold"
            >
              {salvandoDados ? 'Salvando...' : 'Salvar dados e AWB'}
            </button>
          </div>
        </section>
      )}

      {editandoStatus && (
        <section className="card mb-8">
          <h2 className="text-2xl font-black mb-6">Alterar status do embarque</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <select value={novoStatus} onChange={(e) => setNovoStatus(e.target.value)}>
              <option value="">Selecione o status</option>
              <option value="Aguardando coleta">Aguardando coleta</option>
              <option value="Coletado">Coletado</option>
              <option value="Em trânsito">Em trânsito</option>
              <option value="Fiscalização">Fiscalização</option>
              <option value="Liberado">Liberado</option>
              <option value="Entregue">Entregue</option>
              <option value="Atrasado">Atrasado</option>
              <option value="Aguardando AWB">Aguardando AWB</option>
            </select>

            <input
              placeholder="Observação opcional"
              value={descricaoStatus}
              onChange={(e) => setDescricaoStatus(e.target.value)}
            />

            <button
              onClick={() => atualizarStatus()}
              disabled={salvandoStatus}
              className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-bold disabled:opacity-60"
            >
              {salvandoStatus ? 'Salvando...' : 'Salvar status'}
            </button>
          </div>
        </section>
      )}

      <section className="card mb-8">
        <div className="flex flex-col lg:flex-row justify-between gap-6">
          <div>
            <p className="text-blue-400 font-bold mb-2">Master do processo</p>
            <h2 className="text-2xl font-black mb-2">Número master</h2>
            <p className="text-slate-400">
              Informe o master quando o processo formal sair da origem e o número for gerado.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-3 w-full lg:max-w-2xl">
            <input
              value={masterNumero}
              onChange={(e) => setMasterNumero(e.target.value)}
              placeholder="Digite o número master"
              className="flex-1"
            />

            <button
              onClick={salvarMaster}
              disabled={salvandoMaster}
              className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-bold disabled:opacity-60"
            >
              {salvandoMaster ? 'Salvando...' : 'Salvar master'}
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-8">
        <InfoCard titulo="Cliente vinculado" valor={nomeUsuario(embarque.usuario_id)} icone="👤" />

        <InfoCard
          titulo="Última atualização"
          valor={
            embarque.ultima_atualizacao
              ? new Date(embarque.ultima_atualizacao).toLocaleString('pt-BR')
              : '-'
          }
          icone="🕒"
        />

        <InfoCard
          titulo="Data de envio"
          valor={
            embarque.data_envio
              ? new Date(embarque.data_envio).toLocaleDateString('pt-BR')
              : '-'
          }
          icone="📤"
        />

        <InfoCard
          titulo="Master"
          valor={embarque.master || 'Aguardando geração'}
          icone="🧾"
        />

        <InfoCard
          titulo="Previsão"
          valor={
            embarque.data_prevista
              ? new Date(embarque.data_prevista).toLocaleDateString('pt-BR')
              : '-'
          }
          icone="📅"
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="text-2xl font-black mb-6">Dados comerciais</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <CampoResumo titulo="Exportador" valor={embarque.exportador} />
            <CampoResumo titulo="Importador" valor={embarque.importador} />
            <CampoResumo titulo="Referência Cliente" valor={embarque.referencia_cliente} />
            <CampoResumo titulo="Referência HC Consultoria" valor={embarque.referencia_hc} />
          </div>
        </div>

        <div className="card">
          <h2 className="text-2xl font-black mb-6">Dados logísticos</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <CampoResumo titulo="Despachante / Parceiro" valor={embarque.despachante || '-'} />
            <CampoResumo titulo="Origem" valor={embarque.origem} />
            <CampoResumo titulo="Destino" valor={embarque.destino} />
            <CampoResumo titulo="Master" valor={embarque.master || 'Aguardando geração'} />
            <CampoResumo titulo="Peso real" valor={embarque.peso_real ? `${embarque.peso_real} kg` : '-'} />
            <CampoResumo titulo="Peso taxado" valor={embarque.peso_taxado ? `${embarque.peso_taxado} kg` : '-'} />
          </div>
        </div>
      </section>

      <section className="card mb-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-6">
          <div>
            <p className="text-green-400 font-bold mb-2">Financeiro do embarque</p>
            <h2 className="text-2xl font-black">Serviços e valores salvos</h2>
            <p className="text-slate-400 mt-2">
              Valores selecionados no cadastro/edição do embarque.
            </p>
          </div>

          <div className="border border-green-600/60 bg-green-600/10 rounded-3xl p-5 min-w-[260px]">
            <p className="text-slate-400 text-sm font-bold">Total do embarque</p>
            <h3 className="text-3xl font-black text-green-400 mt-2">
              {resumoTotaisServicosFinanceiros(
                embarque.servicos_financeiros,
                embarque.moeda_cobranca || 'USD'
              ) ||
                moeda(
                  embarque.valor_cobrado_cliente,
                  embarque.moeda_cobranca || 'USD'
                )}
            </h3>
            <p className="text-slate-500 text-xs mt-1">
              {quantidadeServicosFinanceiros(embarque.servicos_financeiros)} item(ns) financeiro(s)
            </p>
          </div>
        </div>

        {servicosFinanceirosLista(embarque.servicos_financeiros).length === 0 ? (
          <div className="border border-blue-900 bg-[#020817] rounded-2xl p-5 text-slate-400">
            Nenhum serviço financeiro detalhado foi salvo neste embarque.
            {embarque.valor_cobrado_cliente ? (
              <span className="block mt-2 text-white font-bold">
                Valor cobrado salvo: {moeda(embarque.valor_cobrado_cliente, embarque.moeda_cobranca || 'USD')}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {servicosFinanceirosLista(embarque.servicos_financeiros).map((item) => {
              const valor = numeroFinanceiro(item.valor)
              const desconto = item.nome === 'DESCONTO'

              return (
                <div
                  key={`${item.nome}-${item.moeda || embarque.moeda_cobranca || 'USD'}`}
                  className={`border rounded-2xl p-4 ${classeItemFinanceiro(item.nome)}`}
                >
                  <p className="text-xs font-black uppercase tracking-wide opacity-80">
                    {desconto ? 'Abatimento' : 'Serviço'}
                  </p>
                  <h4 className="font-black text-white mt-2 break-words">{item.nome}</h4>
                  <p className={desconto ? 'text-red-300 text-2xl font-black mt-3' : 'text-green-300 text-2xl font-black mt-3'}>
                    {desconto ? '- ' : '+ '}
                    {moeda(valor, item.moeda || embarque.moeda_cobranca || 'USD')}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </section>


      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-8">Progresso do embarque</h2>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <Etapa
            titulo="Aguardando coleta"
            ativo={etapaConcluida('aguardando_coleta')}
            atual={etapaAtual('aguardando_coleta')}
          />
          <Etapa
            titulo="Coletado"
            ativo={etapaConcluida('coleta')}
            atual={etapaAtual('coleta')}
          />
          <Etapa
            titulo="Em trânsito"
            ativo={etapaConcluida('transito')}
            atual={etapaAtual('transito')}
          />
          <Etapa
            titulo="Fiscalização"
            ativo={etapaConcluida('fiscalizacao')}
            atual={etapaAtual('fiscalizacao')}
          />
          <Etapa
            titulo="Liberado"
            ativo={etapaConcluida('liberado')}
            atual={etapaAtual('liberado')}
          />
          <Etapa
            titulo="Entregue"
            ativo={etapaConcluida('entregue')}
            atual={etapaAtual('entregue')}
          />
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="text-2xl font-black mb-6">Rastreio</h2>

        <div className="rounded-3xl border border-blue-900 bg-[#020817] p-6">
          <div className="flex flex-col md:flex-row justify-between gap-6 items-start md:items-center">
            <div>
              <p className="text-slate-400 mb-1">Origem</p>
              <h3 className="text-3xl font-black">{embarque.origem || '-'}</h3>
            </div>

            <div className="text-blue-400 text-4xl">✈️</div>

            <div>
              <p className="text-slate-400 mb-1">Destino</p>
              <h3 className="text-3xl font-black">{embarque.destino || '-'}</h3>
            </div>
          </div>
        </div>

        {linkRastreio() && (
          <a
            href={linkRastreio()}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-yellow-500 hover:bg-yellow-400 px-5 py-3 rounded-xl text-black font-bold inline-block mt-6"
          >
            Abrir rastreio da transportadora
          </a>
        )}
      </section>

      <section className="card mb-8">
        <div className="flex justify-between items-center gap-4 flex-wrap mb-8">
          <div>
            <h2 className="text-2xl font-black">🌍 Timeline da transportadora</h2>
            <p className="text-slate-400 mt-1">
              Eventos reais importados do rastreio FedEx, DHL ou UPS.
            </p>
          </div>

          <span className="bg-purple-600/20 border border-purple-500 text-purple-300 px-4 py-2 rounded-full text-sm font-bold">
            {rastreioReal.length} evento(s)
          </span>
        </div>

        {rastreioReal.length === 0 ? (
          <div className="border border-blue-900 bg-[#020817] rounded-2xl p-5 text-slate-400">
            Nenhum evento carregado ainda. Clique em “Atualizar rastreio”.
          </div>
        ) : (
          <div className="space-y-5">
            {rastreioReal.map((evento, index) => (
              <div key={evento.id} className="relative pl-10">
                <div className="absolute left-3 top-0 bottom-0 w-[2px] bg-blue-900" />

                <div
                  className={`absolute left-0 top-2 w-6 h-6 rounded-full border-4 border-[#071225] ${
                    index === 0 ? 'bg-green-600' : 'bg-blue-600'
                  }`}
                />

                <div className="border border-blue-900 rounded-2xl bg-[#020817] p-5">
                  <div className="flex flex-col md:flex-row md:justify-between gap-4 mb-3">
                    <div>
                      <strong className="text-blue-400 text-lg">
                        {evento.status || 'Evento'}
                      </strong>

                      <p className="text-slate-300 mt-2">
                        {evento.descricao || '-'}
                      </p>

                      <p className="text-slate-500 text-sm mt-2">
                        📍 {evento.localizacao || 'Localização não informada'}
                      </p>
                    </div>

                    <span className="text-slate-500 text-sm whitespace-nowrap">
                      {evento.data_evento
                        ? new Date(evento.data_evento).toLocaleString('pt-BR')
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card mb-8">
        <div className="flex justify-between items-center gap-4 flex-wrap mb-6">
          <div>
            <h2 className="text-2xl font-black">Documentos</h2>
            <p className="text-slate-400 mt-1">
              {documentos.length} documento(s) anexado(s)
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={tipoDocumentoUpload}
              onChange={(e) => setTipoDocumentoUpload(e.target.value)}
              className="bg-[#020817] border border-blue-900 text-white px-4 py-3 rounded-xl font-bold"
            >
              <option value="DOCUMENTO_GERAL">Documento geral</option>
              <option value="CONHECIMENTO_EMBARQUE">Conhecimento de Embarque</option>
            </select>

            <label className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl font-bold cursor-pointer">
              {uploading
                ? 'Enviando...'
                : tipoDocumentoUpload === 'CONHECIMENTO_EMBARQUE'
                  ? 'Enviar conhecimento'
                  : 'Enviar documento'}

              <input type="file" className="hidden" onChange={uploadArquivo} disabled={uploading} />
            </label>
          </div>
        </div>

        {documentos.length === 0 ? (
          <div className="border border-blue-900 bg-[#020817] rounded-2xl p-5 text-slate-400">
            Nenhum documento anexado ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {documentos.map((documento) => (
              <div
                key={documento.id}
                className="border border-blue-900 bg-[#020817] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-white break-all">
                      {documentoEhConhecimento(documento) ? '📄 Conhecimento de Embarque' : `📎 ${documento.nome}`}
                    </p>

                    {documentoEhConhecimento(documento) && (
                      <span className="rounded-full border border-green-500 bg-green-500/10 px-3 py-1 text-xs font-black text-green-300">
                        Visível para cliente
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-sm mt-1">
                    Enviado em{' '}
                    {documento.criado_em
                      ? new Date(documento.criado_em).toLocaleString('pt-BR')
                      : '-'}
                  </p>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <a
                    href={documento.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-xl font-bold"
                  >
                    Abrir
                  </a>

                  <button
                    onClick={() => excluirDocumento(documento)}
                    className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded-xl font-bold"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="text-2xl font-black mb-8">Histórico operacional HC</h2>

        <div className="space-y-5">
          {timeline.length === 0 ? (
            <p className="text-slate-400">Nenhuma atualização encontrada.</p>
          ) : (
            timeline.map((item) => (
              <div key={item.id} className="relative pl-10">
                <div className="absolute left-3 top-0 bottom-0 w-[2px] bg-blue-900" />
                <div className="absolute left-0 top-2 w-6 h-6 rounded-full bg-blue-600 border-4 border-[#071225]" />

                <div className="border border-blue-900 rounded-2xl bg-[#071225] p-5">
                  <div className="flex flex-col md:flex-row md:justify-between gap-2 mb-3">
                    <strong className="text-blue-400">{item.status}</strong>

                    <span className="text-slate-500 text-sm">
                      {item.criado_em
                        ? new Date(item.criado_em).toLocaleString('pt-BR')
                        : '-'}
                    </span>
                  </div>

                  <p className="text-slate-300">{item.descricao}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  )
}

function InfoCard({ titulo, valor, icone }: any) {
  return (
    <div className="border border-blue-900 rounded-3xl bg-[#071225] p-5">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-400 text-sm">{titulo}</p>
          <p className="font-bold mt-3 break-words">{valor || '-'}</p>
        </div>

        <div className="text-3xl">{icone}</div>
      </div>
    </div>
  )
}

function CampoResumo({ titulo, valor }: any) {
  return (
    <div className="border border-blue-900 rounded-2xl p-4 bg-[#020817]">
      <p className="text-slate-500 text-sm mb-2">{titulo}</p>
      <p className="font-bold">{valor || '-'}</p>
    </div>
  )
}

function Etapa({
  titulo,
  ativo,
  atual = false,
}: {
  titulo: string
  ativo: boolean
  atual?: boolean
}) {
  return (
    <div
      className={`rounded-3xl p-5 border text-center transition ${
        ativo
          ? atual
            ? 'bg-green-600 border-green-300 shadow-[0_0_25px_rgba(34,197,94,0.35)]'
            : 'bg-green-700/80 border-green-600'
          : 'bg-[#071225] border-blue-900'
      }`}
    >
      <div className="text-3xl mb-3">{ativo ? '✔️' : '⏳'}</div>
      <p className="font-bold">{titulo}</p>
      {atual ? (
        <p className="text-xs font-black mt-2 text-green-100">Status atual</p>
      ) : null}
    </div>
  )
}