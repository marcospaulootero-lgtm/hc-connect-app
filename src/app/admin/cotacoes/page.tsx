'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type EmbarqueResumoCotacao = {
  id: string
  awb: string
  transportadora: string
}

export default function CotacoesAdminPage() {
  const [cotacoes, setCotacoes] = useState<any[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [filtroVisao, setFiltroVisao] = useState<
    | 'TODAS'
    | 'AGUARDANDO_ANALISE'
    | 'EM_ANALISE'
    | 'AGUARDANDO_TRANSPORTADORA'
    | 'DISPONIVEIS'
    | 'ENCERRADAS'
  >('TODAS')
  const [filtroArquivamento, setFiltroArquivamento] = useState<'ATIVAS' | 'ARQUIVADAS' | 'EXCLUIDAS' | 'TODAS'>('ATIVAS') // HC_COTACOES_LIXEIRA_V1
  const [filtroDocumentos, setFiltroDocumentos] = useState<'TODOS' | 'COM_ANEXOS' | 'SEM_ANEXOS'>('TODOS')
  const [filtroInteligencia, setFiltroInteligencia] = useState<'TODAS' | 'FOLLOWUP' | 'SEM_RETORNO' | 'PERDIDA'>('TODAS')
  const [embarquesPorId, setEmbarquesPorId] = useState<Record<string, EmbarqueResumoCotacao>>({})
  const [documentosPorCotacao, setDocumentosPorCotacao] = useState<Record<string, any[]>>({}) // HC_CENTRAL_COTACOES_V1
  const [cotacaoVinculo, setCotacaoVinculo] = useState<any>(null)
  const [usuarioVinculoId, setUsuarioVinculoId] = useState('')
  const [salvandoVinculo, setSalvandoVinculo] = useState(false)
  const [menuAcoes, setMenuAcoes] = useState<{ item: any; top: number; left: number } | null>(null) // HC_COTACOES_MENU_FLUTUANTE_V1
  const menuAcoesRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    carregar()
    carregarUsuarios()
  }, [])

  useEffect(() => {
    if (!menuAcoes) return

    function fecharAoClicarFora(event: MouseEvent) {
      const alvo = event.target as Node | null
      if (alvo && menuAcoesRef.current?.contains(alvo)) return
      setMenuAcoes(null)
    }

    function fecharAoRolarOuRedimensionar() {
      setMenuAcoes(null)
    }

    document.addEventListener('mousedown', fecharAoClicarFora)
    window.addEventListener('resize', fecharAoRolarOuRedimensionar)
    window.addEventListener('scroll', fecharAoRolarOuRedimensionar, true)

    return () => {
      document.removeEventListener('mousedown', fecharAoClicarFora)
      window.removeEventListener('resize', fecharAoRolarOuRedimensionar)
      window.removeEventListener('scroll', fecharAoRolarOuRedimensionar, true)
    }
  }, [menuAcoes])

  function abrirMenuAcoes(event: React.MouseEvent<HTMLButtonElement>, item: any) {
    const rect = event.currentTarget.getBoundingClientRect()
    const larguraMenu = 256
    const margem = 12
    const alturaEstimada = cotacaoExcluida(item) ? 64 : 430

    const left = Math.min(
      window.innerWidth - larguraMenu - margem,
      Math.max(margem, rect.right - larguraMenu)
    )

    const espacoAbaixo = window.innerHeight - rect.bottom
    const espacoAcima = rect.top
    const abreParaCima =
      espacoAbaixo < Math.min(alturaEstimada, 360) && espacoAcima > espacoAbaixo

    const top = abreParaCima
      ? Math.max(margem, rect.top - Math.min(alturaEstimada, espacoAcima - margem))
      : Math.min(window.innerHeight - margem, rect.bottom + 8)

    setMenuAcoes({ item, top, left })
  }

  function fecharMenuAcoes() {
    setMenuAcoes(null)
  }

  async function carregar() {
    const { data, error } = await supabase
      .from('cotacoes')
      .select('*')
      .order('criado_em', { ascending: false })

    if (error) {
      console.error('Erro ao carregar cotações:', error)
      return
    }

    const lista = data || []
    setCotacoes(lista)

    const idsCotacoes = lista
      .map((item: any) => String(item.id || '').trim())
      .filter(Boolean)

    if (idsCotacoes.length === 0) {
      setDocumentosPorCotacao({})
    } else {
      const { data: docsData, error: erroDocs } = await supabase
        .from('cotacao_documentos')
        .select('id, cotacao_id, nome, url, criado_em')
        .in('cotacao_id', idsCotacoes)

      if (erroDocs) {
        console.error('Erro ao carregar documentos das cotações:', erroDocs)
        setDocumentosPorCotacao({})
      } else {
        const mapaDocs: Record<string, any[]> = {}

        for (const doc of docsData || []) {
          const chave = String(doc?.cotacao_id || '')
          if (!chave) continue
          if (!mapaDocs[chave]) mapaDocs[chave] = []
          mapaDocs[chave].push(doc)
        }

        setDocumentosPorCotacao(mapaDocs)
      }
    }

    const idsEmbarques = Array.from(
      new Set(
        lista
          .map((item: any) => String(item.embarque_id || '').trim())
          .filter(Boolean)
      )
    )

    if (idsEmbarques.length === 0) {
      setEmbarquesPorId({})
      return
    }

    const { data: embarquesData, error: erroEmbarques } = await supabase
      .from('embarques')
      .select('id, awb, transportadora')
      .in('id', idsEmbarques)

    if (erroEmbarques) {
      console.error('Erro ao carregar embarques vinculados às cotações:', erroEmbarques)
      setEmbarquesPorId({})
      return
    }

    setEmbarquesPorId(
      Object.fromEntries(
        (embarquesData || []).map((item: any) => [
          String(item.id),
          {
            id: String(item.id),
            awb: String(item.awb || ''),
            transportadora: String(item.transportadora || ''),
          },
        ])
      )
    )
  }

  async function carregarUsuarios() {
    const { data } = await supabase
      .from('perfis')
      .select('*')
      .order('nome')

    setUsuarios(data || [])
  }

  function nomeUsuario(usuarioId: string) {
    const usuario = usuarios.find((item) => item.id === usuarioId)
    return usuario?.nome || usuario?.email || '-'
  }

  function emailUsuario(usuarioId: string) {
    const usuario = usuarios.find((item) => item.id === usuarioId)
    return usuario?.email || '-'
  }

  function usuariosClientesDisponiveis() {
    return usuarios.filter((item) => {
      const tipo = String(
        item?.tipo_acesso ||
        item?.tipo_usuario ||
        ''
      )
        .trim()
        .toLowerCase()

      if (tipo !== 'cliente') return false
      if (item?.ativo === false) return false

      return true
    })
  }

  function abrirVinculoLogin(item: any) {
    setCotacaoVinculo(item)
    setUsuarioVinculoId(
      String(item?.usuario_id || '')
    )
  }

  function fecharVinculoLogin() {
    if (salvandoVinculo) return

    setCotacaoVinculo(null)
    setUsuarioVinculoId('')
  }

  async function salvarVinculoLogin() {
    if (!cotacaoVinculo) return

    if (!usuarioVinculoId) {
      alert('Selecione um login de cliente.')
      return
    }

    const usuarioSelecionado =
      usuariosClientesDisponiveis().find(
        (item) =>
          String(item.id) ===
          String(usuarioVinculoId)
      )

    if (!usuarioSelecionado) {
      alert(
        'O login selecionado não foi localizado ou não está ativo como cliente.'
      )
      return
    }

    const nome =
      usuarioSelecionado.nome ||
      usuarioSelecionado.email ||
      'Cliente'

    const email =
      usuarioSelecionado.email || '-'

    const referencia =
      cotacaoVinculo.referencia_hc ||
      cotacaoVinculo.referencia_cliente ||
      cotacaoVinculo.id

    const confirmar = confirm(
      'Vincular esta cotação ao login selecionado?\n\n' +
      'Cotação: ' + referencia + '\n' +
      'Login: ' + nome + '\n' +
      'E-mail: ' + email + '\n\n' +
      'A cotação passará a aparecer em Minhas cotações deste usuário.\n\n' +
      'Nenhum valor, PDF, status ou dado financeiro será alterado.'
    )

    if (!confirmar) return

    setSalvandoVinculo(true)

    const { error } = await supabase
      .from('cotacoes')
      .update({
        usuario_id: usuarioSelecionado.id,
      })
      .eq('id', cotacaoVinculo.id)

    setSalvandoVinculo(false)

    if (error) {
      console.error(
        'Erro ao vincular cotação ao login:',
        error
      )

      alert(
        'Erro ao vincular cotação: ' +
        error.message
      )

      return
    }

    setCotacaoVinculo(null)
    setUsuarioVinculoId('')

    await carregar()

    alert(
      'Cotação vinculada com sucesso.\n\n' +
      'Ela já ficará disponível em Minhas cotações do login selecionado.'
    )
  }

  async function removerVinculoLogin() {
    if (!cotacaoVinculo?.usuario_id) return

    const referencia =
      cotacaoVinculo.referencia_hc ||
      cotacaoVinculo.referencia_cliente ||
      cotacaoVinculo.id

    const confirmar = confirm(
      'Remover o vínculo desta cotação com o login atual?\n\n' +
      'Cotação: ' + referencia + '\n' +
      'Login atual: ' +
      nomeUsuario(cotacaoVinculo.usuario_id) +
      '\n\n' +
      'A cotação deixará de aparecer em Minhas cotações desse usuário.\n' +
      'A cotação não será excluída.'
    )

    if (!confirmar) return

    setSalvandoVinculo(true)

    const { error } = await supabase
      .from('cotacoes')
      .update({
        usuario_id: null,
      })
      .eq('id', cotacaoVinculo.id)

    setSalvandoVinculo(false)

    if (error) {
      console.error(
        'Erro ao remover vínculo da cotação:',
        error
      )

      alert(
        'Erro ao remover vínculo: ' +
        error.message
      )

      return
    }

    setCotacaoVinculo(null)
    setUsuarioVinculoId('')

    await carregar()

    alert(
      'Vínculo removido com sucesso.'
    )
  }

  function dataHoraBR(data?: string | null) {
    if (!data) return '-'

    return new Date(data).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function tempoNaFila(data?: string | null) {
    if (!data) return '-'

    const inicio = new Date(data).getTime()
    const agora = Date.now()
    const diff = Math.max(0, agora - inicio)

    const minutos = Math.floor(diff / 60000)
    const horas = Math.floor(minutos / 60)
    const dias = Math.floor(horas / 24)

    if (dias > 0) return `${dias}d ${horas % 24}h`
    if (horas > 0) return `${horas}h ${minutos % 60}min`
    return `${minutos}min`
  }

  function dadosEmissorObjeto(item: any) {
    const dados = item?.dados_emissor

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

  function cotacaoArquivada(item: any) {
    return dadosEmissorObjeto(item)?.arquivada_admin === true
  }

  function cotacaoExcluida(item: any) {
    return dadosEmissorObjeto(item)?.excluida === true
  }

  function cotacaoNaFilaEspera(item: any) {
    if (!item) return false
    if (cotacaoExcluida(item)) return false
    if (cotacaoArquivada(item)) return false
    if (item?.embarque_id) return false

    return String(item?.status || 'AGUARDANDO ANÁLISE') === 'AGUARDANDO ANÁLISE'
  }

  function dataReferenciaFollowUp(item: any) {
    const dados = dadosEmissorObjeto(item)

    return (
      dados?.cotacao_disponivel_em ||
      item?.atualizado_em ||
      item?.criado_em ||
      null
    )
  }

  function horasSemRetornoCotacao(item: any) {
    const data = dataReferenciaFollowUp(item)
    if (!data) return 0

    const inicio = new Date(data).getTime()
    if (!Number.isFinite(inicio)) return 0

    return Math.max(0, (Date.now() - inicio) / 3600000)
  }

  function cotacaoPrecisaFollowUp(item: any) {
    if (!item) return false
    if (cotacaoExcluida(item)) return false
    if (cotacaoArquivada(item)) return false
    if (item?.embarque_id) return false
    if (item?.status !== 'COTAÇÃO DISPONÍVEL') return false

    return horasSemRetornoCotacao(item) >= 48
  }

  function tempoSemRetornoCotacao(item: any) {
    const horas = Math.floor(horasSemRetornoCotacao(item))
    const dias = Math.floor(horas / 24)
    const horasRestantes = horas % 24

    if (dias > 0) {
      return `${dias}d ${horasRestantes}h`
    }

    return `${horas}h`
  }

  function embarqueCotacao(item: any): EmbarqueResumoCotacao | null {
    if (!item?.embarque_id) return null

    return embarquesPorId[String(item.embarque_id)] || null
  }

  function awbCotacao(item: any) {
    const embarque = embarqueCotacao(item)
    if (!embarque) return ''

    const awb = String(embarque.awb || '').trim()

    if (awb.toUpperCase().startsWith('AGUARDANDO AWB')) {
      return 'AGUARDANDO AWB'
    }

    return awb
  }

  function transportadoraCotacao(item: any) {
    return String(embarqueCotacao(item)?.transportadora || '').trim()
  }

  function vinculoEmbarqueQuebrado(item: any) {
    return Boolean(item?.embarque_id) && !embarqueCotacao(item)
  }

  function documentosCotacao(item: any) {
    return documentosPorCotacao[String(item?.id || '')] || []
  }

  function quantidadeDocumentos(item: any) {
    return documentosCotacao(item).length
  }

  function temPdfHC(item: any) {
    return Boolean(item?.pdf_cotacao_url || item?.arquivo_resposta_url)
  }

  async function alterarArquivamento(item: any, arquivar: boolean) {
    const confirmar = confirm(
      arquivar
        ? 'Arquivar esta cotação da fila principal? Ela continuará salva e poderá ser restaurada.'
        : 'Restaurar esta cotação para a fila principal?'
    )

    if (!confirmar) return

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const dadosAtuais = dadosEmissorObjeto(item)

    const { error } = await supabase
      .from('cotacoes')
      .update({
        dados_emissor: {
          ...dadosAtuais,
          arquivada_admin: arquivar,
          arquivada_admin_em: arquivar ? new Date().toISOString() : null,
          arquivada_admin_por: arquivar ? user?.id || null : null,
        },
      })
      .eq('id', item.id)

    if (error) {
      console.error('Erro ao alterar arquivamento da cotação:', error)
      alert(error.message)
      return
    }

    await carregar()
  }

  async function atualizarStatus(id: string, status: string) {
  const cotacao = cotacoes.find((c) => c.id === id)
  const dadosAtuais = dadosEmissorObjeto(cotacao)

  const atualizacao: any = {
    status,
  }

  if (status === 'COTAÇÃO DISPONÍVEL') {
    atualizacao.dados_emissor = {
      ...dadosAtuais,
      cotacao_disponivel_em: new Date().toISOString(),
      resultado_comercial: null,
      resultado_comercial_em: null,
      resultado_comercial_por: null,
    }
  }

  const { error } = await supabase
    .from('cotacoes')
    .update(atualizacao)
    .eq('id', id)

  if (error) {
    alert('Erro ao atualizar status')
    console.log(error)
    return
  }

  if (
    status === 'COTAÇÃO DISPONÍVEL' &&
    cotacao?.solicitante_email
  ) {
    try {
      await fetch('/api/enviar-email-cotacao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          referencia_hc: cotacao.referencia_hc, 
          email: cotacao.solicitante_email,
          cliente: cotacao.cliente_final,
          origem: cotacao.origem,
          destino: cotacao.destino,
          tipo_operacao: cotacao.tipo_operacao,
        }),
      })
    } catch (err) {
      console.error(err)
    }
  }

  carregar()
}

  async function marcarResultadoComercial(
    item: any,
    status: 'SEM RETORNO' | 'COTAÇÃO PERDIDA'
  ) {
    if (!item || item?.embarque_id) {
      alert('Esta cotação já possui embarque e não pode ser encerrada como perdida ou sem retorno.')
      return
    }

    const descricao =
      status === 'SEM RETORNO'
        ? 'sem retorno do cliente'
        : 'cotação perdida'

    const confirmar = confirm(
      `Marcar esta cotação como ${descricao}?\n\n` +
      'Ela continuará salva no sistema e poderá ser filtrada no painel comercial.'
    )

    if (!confirmar) return

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const dadosAtuais = dadosEmissorObjeto(item)

    const { error } = await supabase
      .from('cotacoes')
      .update({
        status,
        dados_emissor: {
          ...dadosAtuais,
          resultado_comercial: status,
          resultado_comercial_em: new Date().toISOString(),
          resultado_comercial_por: user?.id || null,
        },
      })
      .eq('id', item.id)

    if (error) {
      console.error('Erro ao registrar resultado comercial da cotação:', error)
      alert(error.message)
      return
    }

    await carregar()
  }

  async function excluirCotacao(item: any) {
    const confirmar = confirm(
      'Mover esta cotação para Excluídas?\n\nEla continuará salva e poderá ser restaurada.'
    )
    if (!confirmar) return

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const dadosAtuais = dadosEmissorObjeto(item)

    const { error } = await supabase
      .from('cotacoes')
      .update({
        dados_emissor: {
          ...dadosAtuais,
          excluida: true,
          excluida_em: new Date().toISOString(),
          excluida_por: user?.id || null,
          excluida_origem: 'ADMIN',
        },
      })
      .eq('id', item.id)

    if (error) {
      alert('Erro ao excluir cotação')
      console.log(error)
      return
    }

    await carregar()
  }

  async function restaurarCotacaoExcluida(item: any) {
    const confirmar = confirm(
      'Restaurar esta cotação?\n\nEla voltará para a área anterior e continuará com o mesmo status, PDF e vínculos.'
    )
    if (!confirmar) return

    const dadosAtuais = dadosEmissorObjeto(item)

    const { error } = await supabase
      .from('cotacoes')
      .update({
        dados_emissor: {
          ...dadosAtuais,
          excluida: false,
          excluida_em: null,
          excluida_por: null,
          excluida_origem: null,
        },
      })
      .eq('id', item.id)

    if (error) {
      alert('Erro ao restaurar cotação')
      console.log(error)
      return
    }

    await carregar()
  }

  const cotacoesFiltradas = useMemo(() => {
    const statusEncerrados = [
      'APROVADA',
      'AUTORIZADA',
      'RECUSADA',
      'SEM RETORNO',
      'COTAÇÃO PERDIDA',
      'CONVERTIDA EM EMBARQUE',
    ]

    return cotacoes
      .filter((item) => {
        const arquivada = cotacaoArquivada(item)
        const excluida = cotacaoExcluida(item)
        const status = String(item?.status || 'AGUARDANDO ANÁLISE')
        const quantidadeDocs = quantidadeDocumentos(item)

        const texto = `
          ${nomeUsuario(item.usuario_id)}
          ${emailUsuario(item.usuario_id)}
          ${item.solicitante_email}
          ${item.cliente_final}
          ${item.referencia_hc}
          ${item.referencia_cliente}
          ${awbCotacao(item)}
          ${transportadoraCotacao(item)}
          ${item.tipo_operacao}
          ${item.servico}
          ${item.origem}
          ${item.destino}
          ${status}
        `.toLowerCase()

        const matchBusca = texto.includes(busca.toLowerCase())

        const matchVisao =
          filtroVisao === 'TODAS' ||
          (filtroVisao === 'AGUARDANDO_ANALISE' && status === 'AGUARDANDO ANÁLISE') ||
          (filtroVisao === 'EM_ANALISE' && status === 'EM ANÁLISE') ||
          (filtroVisao === 'AGUARDANDO_TRANSPORTADORA' && status === 'AGUARDANDO TRANSPORTADORA') ||
          (filtroVisao === 'DISPONIVEIS' && status === 'COTAÇÃO DISPONÍVEL') ||
          (filtroVisao === 'ENCERRADAS' && statusEncerrados.includes(status))

        const matchArquivamento =
          filtroArquivamento === 'TODAS' ||
          (filtroArquivamento === 'EXCLUIDAS'
            ? excluida
            : filtroArquivamento === 'ARQUIVADAS'
              ? !excluida && arquivada
              : !excluida && !arquivada)

        const matchDocumentos =
          filtroDocumentos === 'TODOS' ||
          (filtroDocumentos === 'COM_ANEXOS' && quantidadeDocs > 0) ||
          (filtroDocumentos === 'SEM_ANEXOS' && quantidadeDocs === 0)

        const matchInteligencia =
          filtroInteligencia === 'TODAS' ||
          (filtroInteligencia === 'FOLLOWUP' && cotacaoPrecisaFollowUp(item)) ||
          (filtroInteligencia === 'SEM_RETORNO' && status === 'SEM RETORNO') ||
          (filtroInteligencia === 'PERDIDA' && status === 'COTAÇÃO PERDIDA')

        return (
          matchBusca &&
          matchVisao &&
          matchArquivamento &&
          matchDocumentos &&
          matchInteligencia
        )
      })
      .sort((a, b) => {
        const dataA = a.criado_em ? new Date(a.criado_em).getTime() : 0
        const dataB = b.criado_em ? new Date(b.criado_em).getTime() : 0
        return dataB - dataA
      })
  }, [
    cotacoes,
    usuarios,
    busca,
    filtroVisao,
    filtroArquivamento,
    filtroDocumentos,
    filtroInteligencia,
    embarquesPorId,
    documentosPorCotacao,
  ])

  function corStatus(status: string) {
    if (status === 'AGUARDANDO ANÁLISE') return 'bg-yellow-400/15 text-yellow-300 border border-yellow-500/40'
    if (status === 'EM ANÁLISE') return 'bg-blue-600/20 text-blue-300 border border-blue-500/40'
    if (status === 'AGUARDANDO TRANSPORTADORA') return 'bg-purple-600/20 text-purple-300 border border-purple-500/40'
    if (status === 'COTAÇÃO DISPONÍVEL') return 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
    if (status === 'APROVADA' || status === 'AUTORIZADA') return 'bg-green-700/20 text-green-300 border border-green-500/40'
    if (status === 'RECUSADA') return 'bg-red-600/20 text-red-300 border border-red-500/40'
    if (status === 'SEM RETORNO') return 'bg-orange-700/20 text-orange-300 border border-orange-500/40'
    if (status === 'COTAÇÃO PERDIDA') return 'bg-rose-800/20 text-rose-300 border border-rose-500/40'
    if (status === 'CONVERTIDA EM EMBARQUE') return 'bg-slate-700 text-slate-200 border border-slate-600'
    return 'bg-slate-700 text-white border border-slate-600'
  }

  const cotacoesAtivas = cotacoes.filter(
    (c) => !cotacaoExcluida(c) && !cotacaoArquivada(c)
  )

  const cotacoesNoFiltroArquivamento = cotacoes.filter((item) => {
    const arquivada = cotacaoArquivada(item)
    const excluida = cotacaoExcluida(item)

    return (
      filtroArquivamento === 'TODAS' ||
      (filtroArquivamento === 'EXCLUIDAS'
        ? excluida
        : filtroArquivamento === 'ARQUIVADAS'
          ? !excluida && arquivada
          : !excluida && !arquivada)
    )
  })

  const totalAguardando = cotacoesAtivas.filter((c) => c.status === 'AGUARDANDO ANÁLISE').length
  const totalAnalise = cotacoesAtivas.filter((c) => c.status === 'EM ANÁLISE').length
  const totalAguardandoTransportadora = cotacoesAtivas.filter((c) => c.status === 'AGUARDANDO TRANSPORTADORA').length
  const totalDisponiveis = cotacoesAtivas.filter((c) => c.status === 'COTAÇÃO DISPONÍVEL').length
  const totalAprovadas = cotacoesAtivas.filter((c) => c.status === 'APROVADA' || c.status === 'AUTORIZADA').length
  const totalFollowUp = cotacoesNoFiltroArquivamento.filter((c) => cotacaoPrecisaFollowUp(c)).length
  const totalSemRetorno = cotacoesNoFiltroArquivamento.filter((c) => c.status === 'SEM RETORNO').length
  const totalPerdidas = cotacoesNoFiltroArquivamento.filter((c) => c.status === 'COTAÇÃO PERDIDA').length

  const filaEspera = cotacoes
    .filter((item) => cotacaoNaFilaEspera(item))
    .sort((a, b) => {
      const dataA = a.criado_em ? new Date(a.criado_em).getTime() : 0
      const dataB = b.criado_em ? new Date(b.criado_em).getTime() : 0

      if (dataA !== dataB) return dataA - dataB
      return String(a.id || '').localeCompare(String(b.id || ''))
    })

  const posicaoFilaPorId = new Map(
    filaEspera.map((item, index) => [String(item.id), index + 1])
  )

  const proximaCotacao = filaEspera[0]
  const ultimaCotacao = filaEspera[filaEspera.length - 1]
  const maiorEspera = proximaCotacao ? tempoNaFila(proximaCotacao.criado_em) : '-'

  return (
    <main className="w-full max-w-none p-6 xl:p-8 text-white">
      <div className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="mb-1 text-sm font-black text-blue-400">Comercial</p>
          <h1 className="text-4xl font-black tracking-tight xl:text-5xl">Cotações</h1>
          <p className="mt-1 text-slate-400">
            Central de cotações com fila operacional, follow-up comercial e gestão completa.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href="/admin/cotacoes/nova"
            className="rounded-xl bg-blue-600 px-5 py-3 font-black text-white hover:bg-blue-500"
          >
            + Cotação manual
          </a>

          <button
            type="button"
            onClick={() => {
              carregar()
              carregarUsuarios()
            }}
            className="rounded-xl border border-blue-900 bg-[#071225] px-5 py-3 font-black text-slate-200 hover:bg-[#0b1730]"
          >
            ↻ Atualizar
          </button>
        </div>
      </div>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <MetricCard
          titulo="Na fila"
          valor={filaEspera.length}
          icone="⏳"
          ativo={filtroVisao === 'AGUARDANDO_ANALISE'}
          onClick={() => {
            setFiltroVisao(filtroVisao === 'AGUARDANDO_ANALISE' ? 'TODAS' : 'AGUARDANDO_ANALISE')
            setFiltroInteligencia('TODAS')
          }}
        />
        <MetricCard
          titulo="Em análise"
          valor={totalAnalise}
          icone="⌕"
          ativo={filtroVisao === 'EM_ANALISE'}
          onClick={() => {
            setFiltroVisao(filtroVisao === 'EM_ANALISE' ? 'TODAS' : 'EM_ANALISE')
            setFiltroInteligencia('TODAS')
          }}
        />
        <MetricCard
          titulo="Aguard. transportadora"
          valor={totalAguardandoTransportadora}
          icone="🚚"
          ativo={filtroVisao === 'AGUARDANDO_TRANSPORTADORA'}
          onClick={() => {
            setFiltroVisao(
              filtroVisao === 'AGUARDANDO_TRANSPORTADORA'
                ? 'TODAS'
                : 'AGUARDANDO_TRANSPORTADORA'
            )
            setFiltroInteligencia('TODAS')
          }}
        />
        <MetricCard
          titulo="Disponíveis"
          valor={totalDisponiveis}
          icone="▤"
          ativo={filtroVisao === 'DISPONIVEIS'}
          onClick={() => {
            setFiltroVisao(filtroVisao === 'DISPONIVEIS' ? 'TODAS' : 'DISPONIVEIS')
            setFiltroInteligencia('TODAS')
          }}
        />
        <MetricCard
          titulo="Follow-up"
          valor={totalFollowUp}
          icone="☎"
          ativo={filtroInteligencia === 'FOLLOWUP'}
          onClick={() => {
            setFiltroInteligencia(filtroInteligencia === 'FOLLOWUP' ? 'TODAS' : 'FOLLOWUP')
            setFiltroVisao('TODAS')
          }}
        />
        <MetricCard
          titulo="Aprovadas"
          valor={totalAprovadas}
          icone="✓"
          ativo={false}
          onClick={() => {
            setFiltroVisao('ENCERRADAS')
            setFiltroInteligencia('TODAS')
          }}
        />
      </section>

      <section className="mb-6 overflow-hidden rounded-3xl border border-blue-900 bg-[#071225]">
        <div className="flex flex-col gap-5 border-b border-blue-900/70 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-xl">
              ⏳
            </div>
            <div>
              <h2 className="text-2xl font-black">Fila para análise</h2>
              <p className="mt-1 text-sm text-slate-400">
                Cotações aguardando início da análise da equipe comercial.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <QueueSummary titulo="Aguardando" valor={filaEspera.length} />
            <QueueSummary titulo="Maior espera" valor={maiorEspera} />
            <QueueSummary
              titulo="Próxima"
              valor={proximaCotacao?.referencia_hc || proximaCotacao?.referencia_cliente || '-'}
            />
            <QueueSummary
              titulo="Última entrada"
              valor={
                ultimaCotacao?.criado_em
                  ? new Date(ultimaCotacao.criado_em).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '-'
              }
            />
          </div>
        </div>

        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-blue-900 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3">Fila</th>
                <th className="px-3 py-3">Espera</th>
                <th className="px-3 py-3">Cliente</th>
                <th className="px-3 py-3">Referência</th>
                <th className="px-3 py-3">Operação</th>
                <th className="px-3 py-3">Rota</th>
                <th className="px-3 py-3">Documentos</th>
                <th className="px-3 py-3">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filaEspera.map((item) => {
                const qtdDocs = quantidadeDocumentos(item)
                const espera = tempoNaFila(item.criado_em)
                const minutosEspera = item.criado_em
                  ? Math.max(0, Math.floor((Date.now() - new Date(item.criado_em).getTime()) / 60000))
                  : 0

                const corEspera =
                  minutosEspera >= 90
                    ? 'border-red-500/30 bg-red-500/15 text-red-300'
                    : minutosEspera >= 45
                      ? 'border-amber-500/30 bg-amber-500/15 text-amber-300'
                      : 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'

                return (
                  <tr key={item.id} className="border-b border-blue-950/80 hover:bg-[#0b1730]">
                    <td className="px-3 py-4">
                      <span className="inline-flex min-w-12 justify-center rounded-lg bg-blue-600 px-3 py-2 font-black">
                        #{posicaoFilaPorId.get(String(item.id))}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <span className={`inline-flex rounded-lg border px-3 py-2 font-black ${corEspera}`}>
                        {espera}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <p className="font-black text-white">
                        {item.cliente_final || nomeUsuario(item.usuario_id)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.solicitante_email || emailUsuario(item.usuario_id)}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <a
                        href={`/admin/cotacoes/${item.id}`}
                        className="font-black text-blue-400 hover:text-blue-300"
                      >
                        {item.referencia_hc || item.referencia_cliente || String(item.id).slice(0, 8)}
                      </a>
                    </td>
                    <td className="px-3 py-4">
                      <span className="rounded-lg border border-blue-900 bg-[#0b1730] px-3 py-2 font-bold">
                        {item.tipo_operacao || item.servico || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <p className="font-bold">{item.origem || '-'}</p>
                      <p className="mt-1 text-xs text-slate-500">→ {item.destino || '-'}</p>
                    </td>
                    <td className="px-3 py-4">
                      {qtdDocs > 0 ? (
                        <a
                          href={`/admin/cotacoes/${item.id}`}
                          className="font-bold text-blue-400 hover:text-blue-300"
                        >
                          📎 {qtdDocs} {qtdDocs === 1 ? 'anexo' : 'anexos'}
                        </a>
                      ) : (
                        <span className="text-slate-500">Sem anexos</span>
                      )}
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => atualizarStatus(item.id, 'EM ANÁLISE')}
                          className="rounded-xl bg-blue-600 px-4 py-2 font-black hover:bg-blue-500"
                        >
                          Iniciar análise
                        </button>
                        <a
                          href={`/admin/cotacoes/${item.id}`}
                          className="rounded-xl border border-blue-900 bg-[#020817] px-3 py-2 font-black hover:bg-slate-800"
                          title="Abrir Cotação 360"
                        >
                          •••
                        </a>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {filaEspera.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              Nenhuma cotação aguardando análise.
            </div>
          ) : null}
        </div>

        <div className="mx-4 mb-4 rounded-2xl border border-blue-800/70 bg-blue-950/30 px-4 py-3 text-sm font-semibold text-blue-200">
          ⓘ A fila considera apenas cotações em AGUARDANDO ANÁLISE, não arquivadas e sem embarque.
        </div>
      </section>

      <section className="rounded-3xl border border-blue-900 bg-[#071225] p-5">
        <div className="mb-5 flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-xl">
            ▤
          </div>
          <div>
            <h2 className="text-2xl font-black">Gestão das cotações</h2>
            <p className="mt-1 text-sm text-slate-400">
              Visualize, filtre e gerencie todas as cotações do sistema.
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2 border-b border-blue-900/70 pb-4">
          {[
            ['TODAS', 'Todas'],
            ['EM_ANALISE', 'Em análise'],
            ['AGUARDANDO_TRANSPORTADORA', 'Aguardando transportadora'],
            ['DISPONIVEIS', 'Disponíveis'],
            ['ENCERRADAS', 'Encerradas'],
          ].map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              onClick={() => {
                setFiltroVisao(valor as any)
                setFiltroInteligencia('TODAS')
              }}
              className={
                filtroVisao === valor
                  ? 'rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white'
                  : 'rounded-xl border border-blue-950 bg-[#020817] px-4 py-2 text-sm font-black text-slate-400 hover:bg-slate-900'
              }
            >
              {rotulo}
            </button>
          ))}
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(320px,1fr)_190px_190px_auto]">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por referência, cliente, e-mail..."
            className="rounded-xl border border-blue-900 bg-[#020817] px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
          />

          <select
            value={filtroArquivamento}
            onChange={(e) =>
              setFiltroArquivamento(
                e.target.value as 'ATIVAS' | 'ARQUIVADAS' | 'EXCLUIDAS' | 'TODAS'
              )
            }
            className="rounded-xl border border-blue-900 bg-[#020817] px-4 py-3 font-bold text-white"
          >
            <option value="ATIVAS">Ativas</option>
            <option value="ARQUIVADAS">Arquivadas</option>
            <option value="EXCLUIDAS">Excluídas</option>
            <option value="TODAS">Todas</option>
          </select>

          <select
            value={filtroDocumentos}
            onChange={(e) =>
              setFiltroDocumentos(
                e.target.value as 'TODOS' | 'COM_ANEXOS' | 'SEM_ANEXOS'
              )
            }
            className="rounded-xl border border-blue-900 bg-[#020817] px-4 py-3 font-bold text-white"
          >
            <option value="TODOS">Todos os documentos</option>
            <option value="COM_ANEXOS">Com anexos</option>
            <option value="SEM_ANEXOS">Sem anexos</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setBusca('')
              setFiltroVisao('TODAS')
              setFiltroArquivamento('ATIVAS')
              setFiltroDocumentos('TODOS')
              setFiltroInteligencia('TODAS')
            }}
            className="rounded-xl border border-blue-600 px-5 py-3 font-black text-blue-300 hover:bg-blue-600/10"
          >
            Limpar filtros
          </button>
        </div>

        {(filtroInteligencia !== 'TODAS' || totalSemRetorno > 0 || totalPerdidas > 0) ? (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="text-slate-500">Comercial:</span>
            <button
              type="button"
              onClick={() => setFiltroInteligencia('FOLLOWUP')}
              className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-amber-300"
            >
              Follow-up {totalFollowUp}
            </button>
            <button
              type="button"
              onClick={() => setFiltroInteligencia('SEM_RETORNO')}
              className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-orange-300"
            >
              Sem retorno {totalSemRetorno}
            </button>
            <button
              type="button"
              onClick={() => setFiltroInteligencia('PERDIDA')}
              className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-rose-300"
            >
              Perdidas {totalPerdidas}
            </button>
            {filtroInteligencia !== 'TODAS' ? (
              <button
                type="button"
                onClick={() => setFiltroInteligencia('TODAS')}
                className="rounded-full border border-slate-700 px-3 py-1.5 text-slate-400"
              >
                remover filtro
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="mb-3 text-xs font-bold text-slate-500">
          {cotacoesFiltradas.length} cotação(ões) encontrada(s)
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] border-collapse text-sm">
            <thead>
              <tr className="border-y border-blue-900 bg-[#0b1730] text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-3 py-3">Referência</th>
                <th className="px-3 py-3">Cliente</th>
                <th className="px-3 py-3">Operação / Rota</th>
                <th className="px-3 py-3">Documentos</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Embarque</th>
                <th className="px-3 py-3">Ações</th>
              </tr>
            </thead>

            <tbody>
              {cotacoesFiltradas.map((item) => {
                const qtdDocs = quantidadeDocumentos(item)
                const dadosGestao = dadosEmissorObjeto(item)
                const excluida = cotacaoExcluida(item)

                return (
                  <tr key={item.id} className="border-b border-blue-950/80 hover:bg-[#0b1730]">
                    <td className="px-3 py-4">
                      <a
                        href={`/admin/cotacoes/${item.id}`}
                        className="font-black text-blue-400 hover:text-blue-300"
                      >
                        {item.referencia_hc || item.referencia_cliente || String(item.id).slice(0, 8)}
                      </a>
                      {item.referencia_hc && item.referencia_cliente ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Ref. cliente: {item.referencia_cliente}
                        </p>
                      ) : null}
                    </td>

                    <td className="px-3 py-4">
                      <p className="font-black text-white">
                        {item.cliente_final || nomeUsuario(item.usuario_id)}
                      </p>
                      <p className="mt-1 max-w-[260px] truncate text-xs text-slate-500">
                        {item.solicitante_email || emailUsuario(item.usuario_id)}
                      </p>
                    </td>

                    <td className="px-3 py-4">
                      <p className="font-black text-slate-200">
                        {item.tipo_operacao || item.servico || '-'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.origem || '-'} → {item.destino || '-'}
                      </p>
                    </td>

                    <td className="px-3 py-4">
                      <div className="space-y-1">
                        {qtdDocs > 0 ? (
                          <a
                            href={`/admin/cotacoes/${item.id}`}
                            className="block font-bold text-blue-400 hover:text-blue-300"
                          >
                            📎 {qtdDocs} {qtdDocs === 1 ? 'anexo do cliente' : 'anexos do cliente'}
                          </a>
                        ) : (
                          <span className="block text-slate-500">Sem anexos do cliente</span>
                        )}

                        {temPdfHC(item) ? (
                          <span className="block text-xs font-bold text-emerald-400">
                            ▤ PDF HC disponível
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-3 py-4">
                      <div className="flex flex-col items-start gap-2">
                        <span className={`rounded-full px-3 py-1.5 text-xs font-black ${corStatus(item.status)}`}>
                          {item.status || 'AGUARDANDO ANÁLISE'}
                        </span>
                        {excluida ? (
                          <>
                            <span className="text-[10px] font-black uppercase text-red-300">
                              Excluída
                            </span>
                            <span className="max-w-[220px] text-[10px] font-bold text-slate-500">
                              {dadosGestao.excluida_origem === 'CLIENTE' ? 'Cliente' : 'Admin'}
                              {dadosGestao.excluida_em ? ` • ${dataHoraBR(dadosGestao.excluida_em)}` : ''}
                              {dadosGestao.excluida_por ? ` • ${nomeUsuario(dadosGestao.excluida_por)}` : ''}
                            </span>
                          </>
                        ) : cotacaoArquivada(item) ? (
                          <span className="text-[10px] font-black uppercase text-amber-400">
                            Arquivada
                          </span>
                        ) : null}
                        {cotacaoPrecisaFollowUp(item) ? (
                          <span className="text-[10px] font-black uppercase text-amber-300">
                            ⚠ Follow-up {tempoSemRetornoCotacao(item)}
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-3 py-4">
                      {item.embarque_id ? (
                        vinculoEmbarqueQuebrado(item) ? (
                          <span className="text-xs font-black text-red-300">
                            ⚠ Vínculo não encontrado
                          </span>
                        ) : (
                          <a
                            href={`/admin/embarques/${item.embarque_id}`}
                            className="font-black text-cyan-400 hover:text-cyan-300"
                          >
                            {awbCotacao(item) || 'Abrir embarque'}
                          </a>
                        )
                      ) : (
                        <span className="text-slate-500">Sem embarque</span>
                      )}
                    </td>

                    <td className="px-3 py-4">
                      <div className="flex items-center gap-2">
                        <a
                          href={`/admin/cotacoes/${item.id}`}
                          className="rounded-xl bg-blue-600 px-4 py-2 font-black text-white hover:bg-blue-500"
                        >
                          Abrir cotação
                        </a>

                        <button
                          type="button"
                          onClick={(event) => abrirMenuAcoes(event, item)}
                          className="rounded-xl border border-blue-900 bg-[#020817] px-3 py-2 font-black text-slate-300 hover:bg-slate-800"
                          aria-label="Abrir ações da cotação"
                        >
                          •••
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {cotacoesFiltradas.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-blue-900 bg-[#020817] p-8 text-center text-slate-400">
              Nenhuma cotação encontrada com os filtros atuais.
            </div>
          ) : null}
        </div>
      </section>

      {menuAcoes ? (
        <div
          ref={menuAcoesRef}
          className="fixed z-[200] w-64 max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl border border-blue-900 bg-[#071225] p-2 shadow-2xl"
          style={{ top: menuAcoes.top, left: menuAcoes.left }}
        >
          {cotacaoExcluida(menuAcoes.item) ? (
            <button
              type="button"
              onClick={async () => {
                const item = menuAcoes.item
                fecharMenuAcoes()
                await restaurarCotacaoExcluida(item)
              }}
              className="w-full rounded-xl px-3 py-2 text-left text-sm font-black text-emerald-300 hover:bg-emerald-950/30"
            >
              Restaurar excluída
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  const item = menuAcoes.item
                  fecharMenuAcoes()
                  abrirVinculoLogin(item)
                }}
                className="w-full rounded-xl px-3 py-2 text-left font-bold hover:bg-slate-800"
              >
                {menuAcoes.item.usuario_id ? 'Alterar login' : 'Vincular login'}
              </button>

              <div className="my-1 border-t border-blue-950" />

              {[
                ['AGUARDANDO ANÁLISE', 'Aguardando análise'],
                ['EM ANÁLISE', 'Em análise'],
                ['AGUARDANDO TRANSPORTADORA', 'Aguardando transportadora'],
                ['COTAÇÃO DISPONÍVEL', 'Disponível'],
                ['APROVADA', 'Aprovada'],
                ['RECUSADA', 'Recusada'],
              ].map(([status, rotulo]) => (
                <button
                  key={status}
                  type="button"
                  onClick={async () => {
                    const item = menuAcoes.item
                    fecharMenuAcoes()
                    await atualizarStatus(item.id, status)
                  }}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-slate-800"
                >
                  {rotulo}
                </button>
              ))}

              {!menuAcoes.item.embarque_id &&
              menuAcoes.item.status !== 'CONVERTIDA EM EMBARQUE' &&
              menuAcoes.item.status !== 'SEM RETORNO' &&
              menuAcoes.item.status !== 'COTAÇÃO PERDIDA' ? (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      const item = menuAcoes.item
                      fecharMenuAcoes()
                      await marcarResultadoComercial(item, 'SEM RETORNO')
                    }}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-orange-300 hover:bg-orange-950/30"
                  >
                    Sem retorno
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const item = menuAcoes.item
                      fecharMenuAcoes()
                      await marcarResultadoComercial(item, 'COTAÇÃO PERDIDA')
                    }}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-rose-300 hover:bg-rose-950/30"
                  >
                    Cotação perdida
                  </button>
                </>
              ) : null}

              <div className="my-1 border-t border-blue-950" />

              <button
                type="button"
                onClick={async () => {
                  const item = menuAcoes.item
                  fecharMenuAcoes()
                  await alterarArquivamento(item, !cotacaoArquivada(item))
                }}
                className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-amber-300 hover:bg-amber-950/30"
              >
                {cotacaoArquivada(menuAcoes.item) ? 'Restaurar' : 'Arquivar'}
              </button>

              <button
                type="button"
                onClick={async () => {
                  const item = menuAcoes.item
                  fecharMenuAcoes()
                  await excluirCotacao(item)
                }}
                className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-red-300 hover:bg-red-950/30"
              >
                Mover para excluídas
              </button>
            </>
          )}
        </div>
      ) : null}

      {cotacaoVinculo ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-violet-700/60 bg-[#071225] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
                  Acesso do cliente
                </p>

                <h2 className="mt-2 text-2xl font-black text-white">
                  Vincular cotação a login
                </h2>

                <p className="mt-2 text-sm font-semibold text-slate-400">
                  A cotação aparecerá em Minhas cotações do usuário selecionado.
                </p>
              </div>

              <button
                type="button"
                disabled={salvandoVinculo}
                onClick={fecharVinculoLogin}
                className="rounded-xl border border-blue-900 bg-[#020817] px-4 py-2 font-black text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-blue-950 bg-[#020817] p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-black uppercase text-slate-500">
                    Cotação
                  </p>

                  <p className="mt-1 font-black text-blue-300">
                    {cotacaoVinculo.referencia_hc ||
                      cotacaoVinculo.referencia_cliente ||
                      cotacaoVinculo.id}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-black uppercase text-slate-500">
                    Cliente final
                  </p>

                  <p className="mt-1 font-black text-white">
                    {cotacaoVinculo.cliente_final || '-'}
                  </p>
                </div>
              </div>
            </div>

            {cotacaoVinculo.usuario_id ? (
              <div className="mt-4 rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-violet-300">
                  Login atualmente vinculado
                </p>

                <p className="mt-2 font-black text-white">
                  {nomeUsuario(cotacaoVinculo.usuario_id)}
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-400">
                  {emailUsuario(cotacaoVinculo.usuario_id)}
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="font-black text-amber-300">
                  Esta cotação ainda não possui login vinculado.
                </p>

                <p className="mt-1 text-sm font-semibold text-amber-100/60">
                  Ela não aparece em Minhas cotações de nenhum usuário.
                </p>
              </div>
            )}

            <div className="mt-6">
              <label className="text-sm font-black text-slate-300">
                Login do cliente
              </label>

              <select
                value={usuarioVinculoId}
                disabled={salvandoVinculo}
                onChange={(event) =>
                  setUsuarioVinculoId(event.target.value)
                }
                className="mt-2 w-full rounded-2xl border border-blue-900 bg-[#020817] px-4 py-4 font-bold text-white outline-none focus:border-violet-500 disabled:opacity-50"
              >
                <option value="">
                  Selecione um login...
                </option>

                {usuariosClientesDisponiveis().map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.nome || usuario.email || 'Cliente'}
                    {usuario.email
                      ? ` — ${usuario.email}`
                      : ''}
                  </option>
                ))}
              </select>

              <p className="mt-2 text-xs font-semibold text-slate-500">
                Somente logins ativos com perfil de cliente aparecem nesta lista.
              </p>
            </div>

            {cotacaoVinculo.embarque_id ? (
              <div className="mt-4 rounded-2xl border border-amber-600/30 bg-amber-600/10 p-4 text-sm font-semibold text-amber-200">
                ⚠️ Esta cotação já possui embarque vinculado. Esta ação altera somente o acesso à cotação; o vínculo do embarque não será modificado.
              </div>
            ) : null}

            <div className="mt-7 flex flex-wrap justify-end gap-3">
              {cotacaoVinculo.usuario_id ? (
                <button
                  type="button"
                  disabled={salvandoVinculo}
                  onClick={removerVinculoLogin}
                  className="mr-auto rounded-xl bg-red-800 px-5 py-3 font-black text-white hover:bg-red-700 disabled:opacity-40"
                >
                  Remover vínculo
                </button>
              ) : null}

              <button
                type="button"
                disabled={salvandoVinculo}
                onClick={fecharVinculoLogin}
                className="rounded-xl bg-slate-700 px-5 py-3 font-black text-white hover:bg-slate-600 disabled:opacity-40"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={
                  salvandoVinculo ||
                  !usuarioVinculoId
                }
                onClick={salvarVinculoLogin}
                className="rounded-xl bg-violet-600 px-5 py-3 font-black text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {salvandoVinculo
                  ? 'Salvando...'
                  : cotacaoVinculo.usuario_id
                    ? 'Alterar vínculo'
                    : 'Vincular cotação'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}


function MetricCard({
  titulo,
  valor,
  icone,
  ativo,
  onClick,
}: {
  titulo: string
  valor: any
  icone: string
  ativo?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        ativo
          ? 'rounded-2xl border border-blue-500 bg-blue-600/15 p-4 text-left shadow-lg shadow-blue-950/20'
          : 'rounded-2xl border border-blue-900 bg-[#071225] p-4 text-left hover:border-blue-700 hover:bg-[#0b1730]'
      }
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-xl">
          {icone}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-slate-400">{titulo}</p>
          <p className="mt-1 text-2xl font-black text-white">{valor}</p>
        </div>
      </div>
    </button>
  )
}

function QueueSummary({ titulo, valor }: { titulo: string; valor: any }) {
  return (
    <div className="min-w-[145px] rounded-2xl border border-blue-900 bg-[#020817] px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {titulo}
      </p>
      <p className="mt-1 max-w-[180px] truncate text-base font-black text-white">
        {valor}
      </p>
    </div>
  )
}


function FilaCard({ titulo, valor, detalhe }: any) {
  return (
    <div className="rounded-2xl border border-blue-900 bg-[#020817] p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {titulo}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{valor}</p>
      <p className="mt-1 text-xs text-slate-500 line-clamp-2">{detalhe}</p>
    </div>
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