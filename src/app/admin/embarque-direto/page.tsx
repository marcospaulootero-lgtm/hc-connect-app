'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function AdminEmbarqueDiretoPage() {
  const [solicitacoes, setSolicitacoes] = useState<any[]>([])
  const [documentos, setDocumentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('TODOS')
  const [arquivamentoFiltro, setArquivamentoFiltro] = useState('ATIVAS')
  const [convertendo, setConvertendo] = useState<string | number | null>(null)
  const [removendo, setRemovendo] = useState<string | number | null>(null)
  const [restaurando, setRestaurando] = useState<string | number | null>(null)
  const [vinculandoExistente, setVinculandoExistente] = useState<string | number | null>(null)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setLoading(true)

    const { data: solicitacoesData, error } = await supabase
      .from('embarque_direto')
      .select('*')
      .order('id', { ascending: false })

    if (error) {
      console.log(error)
      alert('Erro ao carregar solicitações: ' + error.message)
      setLoading(false)
      return
    }

    const ids = (solicitacoesData || []).map((s) => s.id)

    let docs: any[] = []

    if (ids.length > 0) {
      const { data: docsData } = await supabase
        .from('embarque_direto_documentos')
        .select('*')
        .in('embarque_direto_id', ids)

      docs = docsData || []
    }

    setSolicitacoes(solicitacoesData || [])
    setDocumentos(docs)
    setLoading(false)
  }

  function docsDaSolicitacao(id: string | number) {
    return documentos.filter((doc) => String(doc.embarque_direto_id) === String(id))
  }

  function dataBR(data?: string | null) {
    if (!data) return '-'
    return new Date(data).toLocaleString('pt-BR')
  }

  function arquivada(item: any) {
    return !!item.arquivado_admin || String(item.status || '').toUpperCase() === 'EXCLUIDO'
  }

  function statusVisual(item: any) {
    if (String(item.status || '').toUpperCase() === 'EXCLUIDO') return 'ARQUIVADO'
    return item.status || 'AGUARDANDO ANÁLISE'
  }

  const filtradas = useMemo(() => {
    return solicitacoes.filter((item) => {
      const itemArquivado = arquivada(item)

      const texto = `
        ${item.cliente_final || ''}
        ${item.solicitante_email || ''}
        ${item.tipo_operacao || ''}
        ${item.origem || ''}
        ${item.destino || ''}
        ${item.transportadora || ''}
        ${item.awb || ''}
        ${item.status || ''}
      `.toLowerCase()

      const passaBusca = texto.includes(busca.toLowerCase())
      const passaStatus =
        statusFiltro === 'TODOS' ||
        (statusFiltro === 'ARQUIVADO'
          ? itemArquivado
          : String(item.status || '') === statusFiltro)

      const passaArquivamento =
        arquivamentoFiltro === 'TODAS' ||
        (arquivamentoFiltro === 'ARQUIVADAS' ? itemArquivado : !itemArquivado)

      return passaBusca && passaStatus && passaArquivamento
    })
  }, [solicitacoes, busca, statusFiltro, arquivamentoFiltro])

  const solicitacoesAtivas = solicitacoes.filter((s) => !arquivada(s))
  const solicitacoesArquivadas = solicitacoes.filter((s) => arquivada(s))

  const aguardando = solicitacoesAtivas.filter((s) => s.status === 'AGUARDANDO ANÁLISE' || !s.status).length
  const emAnalise = solicitacoesAtivas.filter((s) => s.status === 'EM ANÁLISE').length
  const convertidas = solicitacoesAtivas.filter((s) => s.status === 'CONVERTIDO EM EMBARQUE').length
  const recusadas = solicitacoesAtivas.filter((s) => s.status === 'RECUSADO').length
  const arquivadas = solicitacoesArquivadas.length

  async function atualizarStatus(id: string | number, status: string) {
    const { error } = await supabase
      .from('embarque_direto')
      .update({ status })
      .eq('id', id)

    if (error) {
      alert(error.message)
      return
    }

    carregar()
  }

  async function atualizarEmbarqueDiretoSeguro(id: string | number, payload: any) {
    const executarUpdate = async (dados: any) => {
      return await supabase
        .from('embarque_direto')
        .update(dados)
        .eq('id', id)
    }

    let dadosAtualizacao = payload
    let { error } = await executarUpdate(dadosAtualizacao)

    if (
      error &&
      (
        String(error.message || '').includes('arquivado_admin_por') ||
        String(error.message || '').includes('schema cache')
      )
    ) {
      const { arquivado_admin_por, ...payloadSemPor } = payload
      dadosAtualizacao = payloadSemPor

      const tentativa = await executarUpdate(payloadSemPor)
      error = tentativa.error
    }

    if (error) {
      throw new Error(error.message)
    }

    const { data: atualizado, error: erroBusca } = await supabase
      .from('embarque_direto')
      .select('id, status, embarque_id, arquivado_admin, arquivado_admin_em, arquivado_admin_por, usuario_id, solicitante_email')
      .eq('id', id)
      .maybeSingle()

    if (erroBusca) {
      console.warn('Atualizou, mas não conseguiu confirmar a solicitação:', erroBusca)
      return {
        id,
        ...dadosAtualizacao,
      }
    }

    return atualizado || {
      id,
      ...dadosAtualizacao,
    }
  }

  async function removerDaLista(item: any) {
    const confirmar = confirm(
      `Arquivar esta solicitação da lista principal?\n\n` +
        `Cliente: ${item.cliente_final || '-'}\n` +
        `Solicitante: ${item.solicitante_email || '-'}\n` +
        `AWB/Referência: ${item.awb || '-'}\n\n` +
        `Ela ficará arquivada e poderá ser restaurada pelo filtro "Arquivadas".`
    )

    if (!confirmar) return

    setRemovendo(item.id)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const atualizado = await atualizarEmbarqueDiretoSeguro(item.id, {
        arquivado_admin: true,
        arquivado_admin_em: new Date().toISOString(),
        arquivado_admin_por: user?.id || null,
      })

      if (!atualizado?.arquivado_admin) {
        throw new Error('O banco não confirmou o arquivamento da solicitação.')
      }

      alert('Solicitação arquivada com sucesso.')

      setBusca('')
      setStatusFiltro('TODOS')
      setArquivamentoFiltro('ATIVAS')

      await carregar()
    } catch (error: any) {
      alert('Erro ao arquivar solicitação: ' + (error?.message || error))
    } finally {
      setRemovendo(null)
    }
  }

  async function restaurarDaLista(item: any) {
    const confirmar = confirm(
      `Restaurar esta solicitação para a lista principal?\n\n` +
        `Cliente: ${item.cliente_final || '-'}\n` +
        `AWB/Referência: ${item.awb || '-'}`
    )

    if (!confirmar) return

    setRestaurando(item.id)

    try {
      const payload: any = {
        arquivado_admin: false,
        arquivado_admin_em: null,
        arquivado_admin_por: null,
      }

      if (String(item.status || '').toUpperCase() === 'EXCLUIDO') {
        payload.status = 'AGUARDANDO ANÁLISE'
      }

      await atualizarEmbarqueDiretoSeguro(item.id, payload)

      alert('Solicitação restaurada com sucesso.')
      setArquivamentoFiltro('ATIVAS')
      setStatusFiltro('TODOS')

      await carregar()
    } catch (error: any) {
      alert('Erro ao restaurar solicitação: ' + (error?.message || error))
    } finally {
      setRestaurando(null)
    }
  }

  function normalizarAwbOpcional(valor: any) {
    const texto = String(valor || '').trim()
    const normalizado = texto.toUpperCase()

    if (
      !texto ||
      texto === '-' ||
      normalizado === 'N/A' ||
      normalizado === 'NA' ||
      normalizado === 'SEM AWB' ||
      normalizado === 'SEM-AWB' ||
      normalizado === 'AGUARDANDO AWB'
    ) {
      return null
    }

    return texto
  }

  function normalizarPeso(valor: any) {
    if (!valor) return null

    const numero = Number(String(valor).replace(',', '.'))

    if (!Number.isFinite(numero)) return null

    return numero
  }

async function buscarClienteDaSolicitacao(item: any) {
    if (item?.usuario_id) {
      return {
        id: item.usuario_id,
        empresa_id: item.empresa_id || null,
      }
    }

    const email = String(item?.solicitante_email || '').trim()

    if (!email) return null

    const { data, error } = await supabase
      .from('perfis')
      .select('id, nome, email, empresa_id')
      .ilike('email', email)
      .limit(1)

    if (error) {
      console.warn('Não foi possível buscar cliente pelo e-mail da solicitação:', error)
      return null
    }

    return data?.[0] || null
  }

  async function vincularEmbarqueAoClienteDaSolicitacao(embarqueId: string, item: any) {
    if (!embarqueId) return null

    const cliente = await buscarClienteDaSolicitacao(item)

    if (!cliente?.id) {
      console.warn('Solicitação sem usuario_id e sem perfil encontrado pelo e-mail. O status será atualizado, mas o vínculo do cliente não foi alterado.')
      return null
    }

    const { data: vinculoExistente, error: erroBuscaVinculo } = await supabase
      .from('embarque_clientes')
      .select('id')
      .eq('embarque_id', embarqueId)
      .eq('cliente_id', cliente.id)
      .limit(1)

    if (erroBuscaVinculo) {
      throw new Error('Erro ao verificar vínculo do cliente: ' + erroBuscaVinculo.message)
    }

    if (!vinculoExistente || vinculoExistente.length === 0) {
      const { error: erroVinculo } = await supabase
        .from('embarque_clientes')
        .insert([
          {
            embarque_id: embarqueId,
            cliente_id: cliente.id,
          },
        ])

      if (erroVinculo) {
        throw new Error('Erro ao liberar embarque para o cliente: ' + erroVinculo.message)
      }
    }

    const payloadEmbarque: any = {
      usuario_id: cliente.id,
      ultima_atualizacao: new Date().toISOString(),
    }

    if (cliente.empresa_id || item?.empresa_id) {
      payloadEmbarque.empresa_id = cliente.empresa_id || item.empresa_id
    }

    const { error: erroEmbarque } = await supabase
      .from('embarques')
      .update(payloadEmbarque)
      .eq('id', embarqueId)

    if (erroEmbarque) {
      throw new Error('Vínculo criado, mas houve erro ao atualizar o embarque para o cliente: ' + erroEmbarque.message)
    }

    return cliente
  }

  async function converterEmEmbarque(item: any, arquivarDepois = false) {
    if (item.embarque_id) {
      alert(
        'Esta solicitação já está vinculada a um embarque.\n\n' +
          'Ela não será convertida novamente para evitar duplicidade.'
      )
      return
    }

    const confirmar = confirm(
      'Converter a solicitação de ' +
        (item.cliente_final || item.solicitante_email || '-') +
        ' em embarque?' +
        (arquivarDepois ? '\n\nApós converter, ela será arquivada da lista principal.' : '')
    )

    if (!confirmar) return

    setConvertendo(item.id)

    try {
      const awbNormalizado = normalizarAwbOpcional(item.awb)

      if (awbNormalizado) {
        const { data: embarqueExistente, error: erroBuscaAwb } = await supabase
          .from('embarques')
          .select('id, awb, cliente_final, referencia_hc')
          .eq('awb', awbNormalizado)
          .maybeSingle()

        if (erroBuscaAwb) {
          throw new Error('Erro ao verificar AWB existente: ' + erroBuscaAwb.message)
        }

        if (embarqueExistente) {
          alert(
            'Este AWB já existe no sistema e não será criado em duplicidade.\n\n' +
              'AWB: ' + awbNormalizado + '\n' +
              'Cliente: ' + (embarqueExistente.cliente_final || '-') + '\n' +
              'Referência HC: ' + (embarqueExistente.referencia_hc || '-') + '\n\n' +
              'Abra o embarque existente para conferir.'
          )
          return
        }
      }

      const peso = normalizarPeso(item.peso)

      const { data: novoEmbarque, error } = await supabase
        .from('embarques')
        .insert([
          {
            usuario_id: item.usuario_id || null,
            cliente_final: item.cliente_final || null,
            exportador: item.tipo_operacao === 'Exportação' ? item.cliente_final : null,
            importador: item.tipo_operacao === 'Importação' ? item.cliente_final : null,
            awb: awbNormalizado,
            transportadora: item.transportadora || null,
            servico: item.tipo_operacao || null,
            origem: item.origem || null,
            destino: item.destino || null,
            peso_real: peso,
            peso_taxado: peso,
            status_operacional: 'Aguardando coleta',
            observacoes: [
              'Solicitação criada via Embarque Direto.',
              '',
              'Solicitante: ' + (item.solicitante_email || '-'),
              'Volumes: ' + (item.volumes || '-'),
              'Descrição da mercadoria: ' + (item.descricao_mercadoria || '-'),
              'Instruções: ' + (item.instrucoes || '-'),
            ].join('\n').trim(),
          },
        ])
        .select()
        .single()

      if (error) {
        console.log(error)

        if (
          String(error.message || '').includes('duplicate key') ||
          String(error.message || '').includes('embarques_awb_key')
        ) {
          alert(
            'Este AWB já existe no sistema. A solicitação não foi convertida para evitar duplicidade.\n\n' +
              'AWB: ' + (awbNormalizado || item.awb || '-') +
              '\n\nConfira o embarque já cadastrado antes de tentar converter novamente.'
          )
          return
        }

        throw new Error(error.message)
      }

      await vincularEmbarqueAoClienteDaSolicitacao(novoEmbarque.id, item)

      const docs = docsDaSolicitacao(item.id)

      for (const doc of docs) {
        const { error: erroDocumento } = await supabase.from('documentos_embarques').insert([
          {
            embarque_id: novoEmbarque.id,
            nome: doc.nome,
            url: doc.url,
            caminho: doc.caminho || null,
          },
        ])

        if (erroDocumento) {
          console.log(erroDocumento)
          alert('Embarque criado, mas houve erro ao copiar um documento: ' + erroDocumento.message)
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      const payloadAtualizacao: any = {
        status: 'CONVERTIDO EM EMBARQUE',
        embarque_id: novoEmbarque.id,
      }

      if (arquivarDepois) {
        payloadAtualizacao.arquivado_admin = true
        payloadAtualizacao.arquivado_admin_em = new Date().toISOString()
        payloadAtualizacao.arquivado_admin_por = user?.id || null
      }

      const solicitacaoAtualizada = await atualizarEmbarqueDiretoSeguro(item.id, payloadAtualizacao)

      if (arquivarDepois && !solicitacaoAtualizada?.arquivado_admin) {
        throw new Error('O embarque foi criado, mas o banco não confirmou o arquivamento da solicitação.')
      }

      alert(
        arquivarDepois
          ? 'Solicitação convertida em embarque e arquivada com sucesso.'
          : 'Solicitação convertida em embarque com sucesso.'
      )

      await carregar()
    } catch (error: any) {
      console.log(error)
      alert('Erro ao converter solicitação: ' + (error?.message || 'erro desconhecido'))
    } finally {
      setConvertendo(null)
    }
  }

  async function buscarEmbarqueExistentePorTermo(termoBusca: string) {
    const termo = String(termoBusca || '').trim()

    if (!termo) return null

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (uuidRegex.test(termo)) {
      const { data, error } = await supabase
        .from('embarques')
        .select('id, awb, referencia_hc, cliente_final, transportadora')
        .eq('id', termo)
        .maybeSingle()

      if (error) throw new Error(error.message)
      if (data) return data
    }

    const { data: porAwb, error: erroAwb } = await supabase
      .from('embarques')
      .select('id, awb, referencia_hc, cliente_final, transportadora')
      .eq('awb', termo)
      .limit(2)

    if (erroAwb) throw new Error(erroAwb.message)

    if ((porAwb || []).length === 1) return porAwb[0]

    const { data: porReferencia, error: erroReferencia } = await supabase
      .from('embarques')
      .select('id, awb, referencia_hc, cliente_final, transportadora')
      .ilike('referencia_hc', '%' + termo + '%')
      .limit(5)

    if (erroReferencia) throw new Error(erroReferencia.message)

    if ((porReferencia || []).length === 1) return porReferencia[0]

    const encontrados = [...(porAwb || []), ...(porReferencia || [])]

    if (encontrados.length > 1) {
      alert(
        'Encontrei mais de um embarque possível. Use o ID exato ou o AWB exato.\n\n' +
          encontrados
            .slice(0, 5)
            .map((e) => 'AWB: ' + (e.awb || '-') + ' | Ref HC: ' + (e.referencia_hc || '-') + ' | Cliente: ' + (e.cliente_final || '-'))
            .join('\n')
      )
      return null
    }

    return null
  }

  async function vincularAEmbarqueExistente(item: any, arquivarDepois = false) {
    let embarque: any = null

    if (item.embarque_id) {
      const { data, error } = await supabase
        .from('embarques')
        .select('id, awb, referencia_hc, cliente_final, transportadora')
        .eq('id', item.embarque_id)
        .maybeSingle()

      if (error) {
        alert('Erro ao buscar embarque já vinculado: ' + error.message)
        return
      }

      embarque = data
    }

    if (!embarque) {
      const termo = prompt(
        'Informe o AWB, referência HC ou ID do embarque já criado para vincular a esta solicitação:'
      )

      if (!termo) return

      setVinculandoExistente(item.id)

      try {
        embarque = await buscarEmbarqueExistentePorTermo(termo)
      } catch (error: any) {
        setVinculandoExistente(null)
        alert('Erro ao buscar embarque existente: ' + (error?.message || 'erro desconhecido'))
        return
      }
    } else {
      setVinculandoExistente(item.id)
    }

    try {
      if (!embarque) {
        alert('Não encontrei nenhum embarque com esse AWB, referência HC ou ID.')
        return
      }

      const confirmar = confirm(
        'Vincular esta solicitação ao embarque existente e marcar como CONVERTIDO EM EMBARQUE?\n\n' +
          'AWB: ' + (embarque.awb || '-') + '\n' +
          'Referência HC: ' + (embarque.referencia_hc || '-') + '\n' +
          'Cliente: ' + (embarque.cliente_final || '-') +
          (arquivarDepois ? '\n\nDepois de vincular, a solicitação será arquivada.' : '')
      )

      if (!confirmar) return

      await vincularEmbarqueAoClienteDaSolicitacao(embarque.id, item)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      const payload: any = {
        status: 'CONVERTIDO EM EMBARQUE',
        embarque_id: embarque.id,
      }

      if (arquivarDepois) {
        payload.arquivado_admin = true
        payload.arquivado_admin_em = new Date().toISOString()
        payload.arquivado_admin_por = user?.id || null
      }

      await atualizarEmbarqueDiretoSeguro(item.id, payload)

      setSolicitacoes((atual) =>
        atual.map((solicitacao) =>
          String(solicitacao.id) === String(item.id)
            ? {
                ...solicitacao,
                ...payload,
              }
            : solicitacao
        )
      )

      alert(
        arquivarDepois
          ? 'Solicitação vinculada ao embarque existente, convertida e arquivada com sucesso.'
          : 'Solicitação vinculada ao embarque existente e convertida com sucesso.'
      )

      await carregar()
    } catch (error: any) {
      console.log(error)
      alert('Erro ao vincular embarque existente: ' + (error?.message || 'erro desconhecido'))
    } finally {
      setVinculandoExistente(null)
    }
  }

  async function marcarComoConvertida(item: any) {
    const confirmar = confirm(
      'Marcar esta solicitação como CONVERTIDO EM EMBARQUE?\n\n' +
        'Use isso apenas quando o embarque já existe e você só precisa corrigir o status da solicitação.'
    )

    if (!confirmar) return

    setVinculandoExistente(item.id)

    try {
      const payload: any = {
        status: 'CONVERTIDO EM EMBARQUE',
      }

      if (item.embarque_id) {
        payload.embarque_id = item.embarque_id
      }

      await atualizarEmbarqueDiretoSeguro(item.id, payload)

      setSolicitacoes((atual) =>
        atual.map((solicitacao) =>
          String(solicitacao.id) === String(item.id)
            ? {
                ...solicitacao,
                ...payload,
              }
            : solicitacao
        )
      )

      alert('Solicitação marcada como convertida com sucesso.')
      await carregar()
    } catch (error: any) {
      console.log(error)
      alert('Erro ao marcar como convertida: ' + (error?.message || 'erro desconhecido'))
    } finally {
      setVinculandoExistente(null)
    }
  }

  function aplicarFiltroArquivadas() {
    setArquivamentoFiltro('ARQUIVADAS')
    setStatusFiltro('TODOS')
  }

  return (
    <main className="w-full max-w-none p-8 text-white">
      <div className="mb-8 flex flex-col xl:flex-row justify-between gap-6">
        <div>
          <p className="text-blue-400 font-bold mb-2">Operação</p>
          <h1 className="text-5xl font-black mb-2">Embarque Direto</h1>
          <p className="text-slate-400 text-lg">
            Solicitações enviadas pelos clientes para abertura de embarques sem cotação.
          </p>
        </div>

        <button
          onClick={carregar}
          className="bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold h-fit"
        >
          Atualizar
        </button>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-5 gap-5 mb-8">
        <Card titulo="Aguardando" valor={aguardando} detalhe="Novas solicitações" icone="🟡" />
        <Card titulo="Em análise" valor={emAnalise} detalhe="Em tratamento" icone="🔎" />
        <Card titulo="Convertidas" valor={convertidas} detalhe="Viraram embarque" icone="✅" />
        <Card titulo="Recusadas" valor={recusadas} detalhe="Não seguiram" icone="❌" />
        <Card
          titulo="Arquivadas"
          valor={arquivadas}
          detalhe="Removidas da lista"
          icone="🗄️"
          onClick={aplicarFiltroArquivadas}
        />
      </section>

      <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
        <div className="flex flex-col xl:flex-row justify-between gap-5 mb-7">
          <div>
            <h2 className="text-2xl font-black">Solicitações recebidas</h2>
            <p className="text-slate-400 text-sm">
              Analise os dados, veja os anexos e converta em embarque quando necessário.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full xl:max-w-[880px]">
            <select
              value={arquivamentoFiltro}
              onChange={(e) => setArquivamentoFiltro(e.target.value)}
            >
              <option value="ATIVAS">Lista: ativas</option>
              <option value="ARQUIVADAS">Lista: arquivadas</option>
              <option value="TODAS">Lista: todas</option>
            </select>

            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
            >
              <option value="TODOS">Todos os status</option>
              <option value="AGUARDANDO ANÁLISE">Aguardando análise</option>
              <option value="EM ANÁLISE">Em análise</option>
              <option value="CONVERTIDO EM EMBARQUE">Convertido em embarque</option>
              <option value="RECUSADO">Recusado</option>
              <option value="ARQUIVADO">Arquivado</option>
            </select>

            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por cliente, e-mail, origem, destino..."
              className="min-w-[320px]"
            />
          </div>
        </div>

        {loading ? (
          <div className="border border-blue-900 bg-[#020817] rounded-2xl p-6 text-slate-400">
            Carregando solicitações...
          </div>
        ) : filtradas.length === 0 ? (
          <div className="border border-blue-900 bg-[#020817] rounded-2xl p-6 text-slate-400">
            Nenhuma solicitação encontrada.
          </div>
        ) : (
          <div className="space-y-6">
            {filtradas.map((item) => {
              const docs = docsDaSolicitacao(item.id)
              const itemArquivado = arquivada(item)

              return (
                <article
                  key={item.id}
                  className={
                    itemArquivado
                      ? 'border border-slate-700 bg-[#020817] rounded-3xl p-6 opacity-80'
                      : 'border border-blue-900 bg-[#020817] rounded-3xl p-6'
                  }
                >
                  <div className="flex flex-col xl:flex-row justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-4">
                        <h3 className="text-2xl font-black text-blue-400">
                          {item.cliente_final || 'Cliente não informado'}
                        </h3>

                        <Status status={statusVisual(item)} />

                        {itemArquivado && (
                          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-500 bg-slate-700/20 text-slate-300 text-xs font-black">
                            🗄️ Arquivada
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
                        <Info label="Solicitante" valor={item.solicitante_email} />
                        <Info label="Operação" valor={item.tipo_operacao} />
                        <Info label="Origem" valor={item.origem} />
                        <Info label="Destino" valor={item.destino} />
                        <Info label="Transportadora" valor={item.transportadora} />
                        <Info label="AWB / Referência" valor={item.awb} />
                        <Info label="Peso" valor={item.peso} />
                        <Info label="Volumes" valor={item.volumes} />
                        <Info label="Criado em" valor={dataBR(item.created_at)} />
                        {itemArquivado && <Info label="Arquivado em" valor={dataBR(item.arquivado_admin_em)} />}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                        <TextoBox titulo="Mercadoria" texto={item.descricao_mercadoria} />
                        <TextoBox titulo="Instruções" texto={item.instrucoes} />
                      </div>

                      <div className="border border-blue-900 rounded-2xl p-5 bg-[#071225]">
                        <h4 className="font-black mb-3">Documentos anexados</h4>

                        {docs.length === 0 ? (
                          <p className="text-slate-500">Nenhum documento anexado.</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {docs.map((doc) => (
                              <a
                                key={doc.id}
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="border border-blue-900 rounded-xl p-3 hover:border-green-500 transition"
                              >
                                <p className="font-bold break-all">📎 {doc.nome}</p>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="xl:w-[260px] flex flex-col gap-3">
                      {itemArquivado ? (
                        <button
                          onClick={() => restaurarDaLista(item)}
                          disabled={restaurando === item.id}
                          className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-bold disabled:opacity-60"
                        >
                          {restaurando === item.id ? 'Restaurando...' : 'Restaurar para lista'}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => atualizarStatus(item.id, 'EM ANÁLISE')}
                            className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl font-bold"
                          >
                            Marcar em análise
                          </button>

                          <button
                            onClick={() => converterEmEmbarque(item, false)}
                            disabled={convertendo === item.id}
                            className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl font-bold disabled:opacity-60"
                          >
                            {convertendo === item.id ? 'Convertendo...' : 'Converter em embarque'}
                          </button>

                          <button
                            onClick={() => converterEmEmbarque(item, true)}
                            disabled={convertendo === item.id}
                            className="bg-emerald-700 hover:bg-emerald-600 px-5 py-3 rounded-xl font-bold disabled:opacity-60"
                          >
                            {convertendo === item.id ? 'Convertendo...' : 'Converter e arquivar'}
                          </button>

                          <button
                            onClick={() => vincularAEmbarqueExistente(item, false)}
                            disabled={vinculandoExistente === item.id || convertendo === item.id}
                            className="bg-purple-700 hover:bg-purple-600 px-5 py-3 rounded-xl font-bold disabled:opacity-60"
                          >
                            {vinculandoExistente === item.id ? 'Vinculando...' : 'Vincular a embarque existente'}
                          </button>

                          <button
                            onClick={() => vincularAEmbarqueExistente(item, true)}
                            disabled={vinculandoExistente === item.id || convertendo === item.id}
                            className="bg-purple-900 hover:bg-purple-800 px-5 py-3 rounded-xl font-bold disabled:opacity-60"
                          >
                            {vinculandoExistente === item.id ? 'Vinculando...' : 'Vincular e arquivar'}
                          </button>

                          <button
                            onClick={() => marcarComoConvertida(item)}
                            disabled={vinculandoExistente === item.id || convertendo === item.id}
                            className="bg-yellow-600 hover:bg-yellow-500 px-5 py-3 rounded-xl font-bold disabled:opacity-60"
                          >
                            Marcar como convertida
                          </button>

                          <button
                            onClick={() => atualizarStatus(item.id, 'RECUSADO')}
                            className="bg-red-600 hover:bg-red-500 px-5 py-3 rounded-xl font-bold"
                          >
                            Recusar
                          </button>

                          <button
                            onClick={() => removerDaLista(item)}
                            disabled={removendo === item.id}
                            className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold disabled:opacity-60"
                          >
                            {removendo === item.id ? 'Arquivando...' : 'Arquivar solicitação'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

function Card({ titulo, valor, detalhe, icone, onClick }: any) {
  const conteudo = (
    <div className="flex justify-between items-start gap-4">
      <div>
        <p className="text-slate-300 font-bold">{titulo}</p>
        <h2 className="text-5xl font-black mt-4 text-white">{valor}</h2>
        <p className="text-slate-400 mt-2">{detalhe}</p>
      </div>

      <div className="text-4xl">{icone}</div>
    </div>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="text-left w-full border border-blue-900 rounded-3xl bg-[#071225] p-6 hover:border-blue-400 hover:bg-blue-600/10 transition"
      >
        {conteudo}
      </button>
    )
  }

  return (
    <div className="border border-blue-900 rounded-3xl bg-[#071225] p-6">
      {conteudo}
    </div>
  )
}

function Info({ label, valor }: any) {
  return (
    <div className="border border-blue-900 bg-[#071225] rounded-2xl p-4">
      <p className="text-slate-500 text-sm mb-1">{label}</p>
      <p className="font-bold break-words">{valor || '-'}</p>
    </div>
  )
}

function TextoBox({ titulo, texto }: any) {
  return (
    <div className="border border-blue-900 bg-[#071225] rounded-2xl p-4">
      <p className="text-slate-500 text-sm mb-2">{titulo}</p>
      <p className="text-slate-300 whitespace-pre-wrap">{texto || '-'}</p>
    </div>
  )
}

function Status({ status }: any) {
  const s = String(status || '').toUpperCase()

  let classe = 'bg-yellow-500/20 text-yellow-300 border-yellow-500'
  let icone = '🟡'

  if (s === 'EM ANÁLISE') {
    classe = 'bg-blue-600/20 text-blue-300 border-blue-500'
    icone = '🔎'
  } else if (s === 'CONVERTIDO EM EMBARQUE') {
    classe = 'bg-green-600/20 text-green-300 border-green-500'
    icone = '✅'
  } else if (s === 'RECUSADO') {
    classe = 'bg-red-600/20 text-red-300 border-red-500'
    icone = '❌'
  } else if (s === 'ARQUIVADO' || s === 'EXCLUIDO') {
    classe = 'bg-slate-700/30 text-slate-300 border-slate-500'
    icone = '🗄️'
  }

  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-black ${classe}`}>
      <span>{icone}</span>
      {status || 'AGUARDANDO ANÁLISE'}
    </span>
  )
}
