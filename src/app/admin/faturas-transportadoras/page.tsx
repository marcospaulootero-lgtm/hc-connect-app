'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type FaturaTransportadora = {
  id: string
  transportadora: string
  conta: string | null
  numero_fatura: string | null
  emissao: string | null
  vencimento: string | null
  situacao: string | null
  total: number | null
  valor_contestado: number | null
  pago_ajustado: number | null
  saldo: number | null
  moeda: string | null
  arquivo_pdf: string | null
  observacoes: string | null
  arquivada: boolean | null
  criado_em: string | null
  atualizado_em: string | null
}

type FormState = {
  transportadora: string
  conta: string
  numero_fatura: string
  emissao: string
  vencimento: string
  situacao: string
  total: string
  valor_contestado: string
  pago_ajustado: string
  saldo: string
  moeda: string
  observacoes: string
}

const formVazio: FormState = {
  transportadora: 'DHL',
  conta: '',
  numero_fatura: '',
  emissao: '',
  vencimento: '',
  situacao: 'EM ABERTO',
  total: '',
  valor_contestado: '',
  pago_ajustado: '',
  saldo: '',
  moeda: 'BRL',
  observacoes: '',
}

const STORAGE_BUCKET = 'faturas'

export default function FaturasTransportadorasPage() {
  const [faturas, setFaturas] = useState<FaturaTransportadora[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>(formVazio)
  const [busca, setBusca] = useState('')
  const [filtroTransportadora, setFiltroTransportadora] = useState('TODAS')
  const [filtroSituacao, setFiltroSituacao] = useState('TODAS')
  const [filtroArquivadas, setFiltroArquivadas] = useState('ATIVAS')
  const [ultimaAlteracao, setUltimaAlteracao] = useState('')

  useEffect(() => {
    const salvo = localStorage.getItem('hc_faturas_transportadoras_filtros')

    if (salvo) {
      try {
        const dados = JSON.parse(salvo)
        setBusca(dados.busca || '')
        setFiltroTransportadora(dados.filtroTransportadora || 'TODAS')
        setFiltroSituacao(dados.filtroSituacao || 'TODAS')
        setFiltroArquivadas(dados.filtroArquivadas || 'ATIVAS')
        setUltimaAlteracao(dados.ultimaAlteracao || '')
      } catch (error) {
        console.log('Erro ao carregar filtros salvos:', error)
      }
    }

    carregar()
  }, [])

  useEffect(() => {
    const dados = {
      busca,
      filtroTransportadora,
      filtroSituacao,
      filtroArquivadas,
      ultimaAlteracao: new Date().toLocaleString('pt-BR'),
    }

    localStorage.setItem('hc_faturas_transportadoras_filtros', JSON.stringify(dados))
    setUltimaAlteracao(dados.ultimaAlteracao)
  }, [busca, filtroTransportadora, filtroSituacao, filtroArquivadas])

  async function carregar() {
    setLoading(true)

    const { data, error } = await supabase
      .from('faturas_transportadoras')
      .select('*')
      .order('vencimento', { ascending: true, nullsFirst: false })
      .order('criado_em', { ascending: false })

    if (error) {
      alert('Erro ao carregar faturas de transportadoras: ' + error.message)
      setLoading(false)
      return
    }

    setFaturas((data as FaturaTransportadora[]) || [])
    setLoading(false)
  }

  function numero(valor: any) {
    if (valor === null || valor === undefined || valor === '') return 0
    if (typeof valor === 'number') return valor

    return (
      Number(
        String(valor)
          .replace(/[R$USD\s]/gi, '')
          .replace(/\./g, '')
          .replace(',', '.')
      ) || 0
    )
  }

  function moeda(valor: any, moedaBase = 'BRL') {
    const numeroValor = Number(valor || 0)

    return numeroValor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: moedaBase || 'BRL',
    })
  }

  function dataBR(data?: string | null) {
    if (!data) return '-'

    const texto = String(data).slice(0, 10)
    const [ano, mes, dia] = texto.split('-')

    if (ano && mes && dia) return `${dia}/${mes}/${ano}`

    return new Date(data).toLocaleDateString('pt-BR')
  }

  function hojeISO() {
    return new Date().toISOString().slice(0, 10)
  }

  function situacaoAutomatica(item: FaturaTransportadora) {
    const situacao = String(item.situacao || '').toUpperCase()

    if (situacao.includes('PAGO') || situacao.includes('BAIXADO')) return 'PAGA'
    if (Number(item.saldo || 0) <= 0 && Number(item.total || 0) > 0) return 'PAGA'

    const vencimento = String(item.vencimento || '').slice(0, 10)

    if (vencimento && vencimento < hojeISO()) return 'VENCIDA'

    return situacao || 'EM ABERTO'
  }

  function classeSituacao(status: string) {
    if (status === 'PAGA') return 'bg-green-600/20 text-green-300 border-green-500'
    if (status === 'VENCIDA') return 'bg-red-600/20 text-red-300 border-red-500'
    if (status.includes('CONTEST')) return 'bg-purple-600/20 text-purple-300 border-purple-500'
    return 'bg-yellow-500/20 text-yellow-300 border-yellow-500'
  }


  function normalizarBusca(valor: any) {
    return String(valor || '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
  }

  function pegarCampoExcel(linha: any, nomes: string[]) {
    for (const nome of nomes) {
      if (linha[nome] !== undefined && linha[nome] !== null && linha[nome] !== '') {
        return linha[nome]
      }
    }

    const chaves = Object.keys(linha || {})

    for (const nome of nomes) {
      const nomeNormalizado = normalizarBusca(nome)
      const chaveEncontrada = chaves.find((chave) => normalizarBusca(chave) === nomeNormalizado)

      if (
        chaveEncontrada &&
        linha[chaveEncontrada] !== undefined &&
        linha[chaveEncontrada] !== null &&
        linha[chaveEncontrada] !== ''
      ) {
        return linha[chaveEncontrada]
      }
    }

    const nomesNormalizados = nomes.map(normalizarBusca)

    for (const chave of chaves) {
      const chaveNormalizada = normalizarBusca(chave)

      if (
        nomesNormalizados.some(
          (nome) => chaveNormalizada.includes(nome) || nome.includes(chaveNormalizada)
        ) &&
        linha[chave] !== undefined &&
        linha[chave] !== null &&
        linha[chave] !== ''
      ) {
        return linha[chave]
      }
    }

    return ''
  }

  function normalizarDataExcel(valor: any) {
    if (!valor) return null

    if (valor instanceof Date && !isNaN(valor.getTime())) {
      return valor.toISOString().slice(0, 10)
    }

    if (typeof valor === 'number') {
      const data = new Date((valor - 25569) * 86400 * 1000)
      if (!isNaN(data.getTime())) return data.toISOString().slice(0, 10)
    }

    const texto = String(valor).trim()
    if (!texto) return null
    if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10)

    const partesBarra = texto.split('/')
    if (partesBarra.length === 3) {
      const [dia, mes, ano] = partesBarra
      const anoFinal = ano.length === 2 ? `20${ano}` : ano
      return `${anoFinal.padStart(4, '20')}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
    }

    const dataTentativa = new Date(texto)
    if (!isNaN(dataTentativa.getTime())) {
      return dataTentativa.toISOString().slice(0, 10)
    }

    return null
  }

  function normalizarTransportadora(valor: any) {
    const texto = normalizarBusca(valor)

    if (texto.includes('FEDEX') || texto.includes('FED EX')) return 'FedEx'
    if (texto.includes('DHL')) return 'DHL'

    return ''
  }

  function normalizarSituacaoExcel(valor: any, vencimento?: string | null) {
    const texto = normalizarBusca(valor)

    if (texto.includes('PAGO') || texto.includes('PAGA')) return 'PAGA'
    if (texto.includes('CANCEL')) return 'FATURA CANCELADA'
    if (texto.includes('CONTEST')) return 'CONTESTADA'
    if (texto.includes('ATRAS') || texto.includes('VENCIDA')) return 'VENCIDA'
    if (texto.includes('ABERTO') || texto.includes('OUTSTANDING')) return 'EM ABERTO'

    if (vencimento && vencimento < hojeISO()) return 'VENCIDA'

    return 'EM ABERTO'
  }

  function chaveFaturaTransportadora(transportadora: any, numeroFatura: any) {
    return `${normalizarBusca(transportadora)}|${normalizarBusca(numeroFatura)}`
  }

  function observacoesImportacao(linha: any) {
    const partes = [
      ['Dias restantes', pegarCampoExcel(linha, ['DIAS RESTANTES', 'DIAS_RESTANTES'])],
      ['Data pagamento', pegarCampoExcel(linha, ['DATA DE PAGAMENTO', 'DATA PAGAMENTO', 'PAGAMENTO'])],
      ['Utilizado para', pegarCampoExcel(linha, ['UTILIZADO PARA', 'UTILIZADO_PARA'])],
      ['Status recebimento', pegarCampoExcel(linha, ['STATUS_RECEBIMENTO_FATURA', 'STATUS RECEBIMENTO FATURA', 'STATUS_RECEBIMENTO', 'STATUS RECEBIME'])],
      ['Status contestação', pegarCampoExcel(linha, ['STATUS DE CONTESTAÇÃO', 'STATUS CONTESTACAO', 'STATUS DE COR', 'STATUS_DE_CONTESTACAO'])],
      ['Observação', pegarCampoExcel(linha, ['OBSERVAÇÕES', 'OBSERVACOES', 'OBSERVAÇÃO', 'OBSERVACAO'])],
    ]
      .filter(([, valor]) => valor !== undefined && valor !== null && String(valor).trim() !== '')
      .map(([titulo, valor]) => `${titulo}: ${valor}`)

    return partes.join(' | ')
  }

  async function importarExcel(event: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0]
    if (!arquivo) return

    if (!confirm('Importar este Excel para Faturas DHL/FedEx?')) {
      event.target.value = ''
      return
    }

    setImportando(true)

    try {
      const XLSX = await import('xlsx')
      const buffer = await arquivo.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const linhas: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

      const registros = linhas
        .map((linha) => {
          const numeroFatura = String(
            pegarCampoExcel(linha, [
              'NUMERO DA FATURA',
              'NÚMERO DA FATURA',
              'NUMERO_FATURA',
              'Nº FATURA',
              'N° FATURA',
              'FATURA',
              'Fatura Fiscal Nº',
              'FATURA FISCAL Nº',
              'INVOICE',
            ]) || ''
          ).trim()

          const transportadora =
            normalizarTransportadora(
              pegarCampoExcel(linha, [
                'FEDEX / DHL',
                'FEDEX/DHL',
                'DHL / FEDEX',
                'TRANSPORTADORA',
                'EMPRESA',
                'CARRIER',
              ])
            ) || 'DHL'

          const emissao = normalizarDataExcel(
            pegarCampoExcel(linha, [
              'EMISSÃO',
              'EMISSAO',
              'DATA DE EMISSÃO',
              'DATA DE EMISSAO',
              'DATA EMISSÃO',
              'DATA EMISSAO',
            ])
          )

          const vencimento = normalizarDataExcel(
            pegarCampoExcel(linha, [
              'DATA DE VENCIMENTO',
              'DATA VENCIMENTO',
              'DATA DE VENCIMEN',
              'VENCIMENTO',
              'VENCIMENTO_CLIENTE',
            ])
          )

          const valor = numero(
            pegarCampoExcel(linha, [
              'VALOR',
              'VALOR DA FATURA',
              'TOTAL',
              'TOTAL FATURA',
            ])
          )

          const totalAtualizado =
            numero(
              pegarCampoExcel(linha, [
                'TOTAL ATUALIZADO',
                'TOTAL_ATUALIZADO',
                'TOTAL AJUSTADO',
              ])
            ) || valor

          const valorContestado = numero(
            pegarCampoExcel(linha, [
              'VALOR CONTESTADO',
              'VALOR_CONTES',
              'VALOR CONTEST',
              'VALOR_CONTESTADO',
            ])
          )

          const pagoAjustado = numero(
            pegarCampoExcel(linha, [
              'PAGO / AJUST.',
              'PAGO/AJUST.',
              'PAGO AJUST.',
              'PAGO AJUSTADO',
              'PAGO_AJUSTADO',
              'PAGO AJUST',
            ])
          )

          const saldoInformado = numero(
            pegarCampoExcel(linha, [
              'SALDO',
              'DIFERENCA_FATURA',
              'DIFERENÇA_FATURA',
              'DIFERENCA_FA',
              'DIFERENÇA_FA',
            ])
          )

          const statusPlanilha = pegarCampoExcel(linha, [
            'STATUS DA FATURA',
            'STATUS_DA_FATURA',
            'SITUAÇÃO',
            'SITUACAO',
            'STATUS',
            'DIAS RESTANTES',
          ])

          const situacao = normalizarSituacaoExcel(statusPlanilha, vencimento)
          const saldo = saldoInformado || Math.max(totalAtualizado - pagoAjustado, 0)

          return {
            transportadora,
            conta: String(pegarCampoExcel(linha, ['CONTA', 'CONTA ENTIDADE', 'ACCOUNT']) || '').trim() || null,
            numero_fatura: numeroFatura || null,
            emissao,
            vencimento,
            situacao,
            total: totalAtualizado,
            valor_contestado: valorContestado,
            pago_ajustado: pagoAjustado,
            saldo,
            moeda: String(pegarCampoExcel(linha, ['MOEDA', 'CURRENCY']) || 'BRL').trim() || 'BRL',
            observacoes: observacoesImportacao(linha) || null,
            atualizado_em: new Date().toISOString(),
          }
        })
        .filter((item) => item.numero_fatura || item.total > 0)

      if (registros.length === 0) {
        alert('Nenhuma fatura válida encontrada no Excel.')
        setImportando(false)
        event.target.value = ''
        return
      }

      const faturasAtuaisPorChave = new Map(
        faturas
          .filter((item) => item.numero_fatura && item.id)
          .map((item) => [chaveFaturaTransportadora(item.transportadora, item.numero_fatura), item])
      )

      const novosPorChave = new Map<string, any>()
      const atualizacoesPorChave = new Map<string, { id: string; payload: any }>()
      let duplicadasNoExcel = 0

      registros.forEach((registro) => {
        const chave = chaveFaturaTransportadora(registro.transportadora, registro.numero_fatura)
        const existenteNoBanco = faturasAtuaisPorChave.get(chave)

        if (existenteNoBanco?.id) {
          atualizacoesPorChave.set(chave, {
            id: existenteNoBanco.id,
            payload: registro,
          })
          return
        }

        if (novosPorChave.has(chave)) {
          duplicadasNoExcel += 1
        }

        // Se a mesma fatura vier repetida no Excel, mantém uma linha só.
        // A última ocorrência ganha, evitando tentar atualizar id "undefined".
        novosPorChave.set(chave, registro)
      })

      const novos = Array.from(novosPorChave.values())
      const atualizacoes = Array.from(atualizacoesPorChave.values())

      for (let i = 0; i < novos.length; i += 500) {
        const lote = novos.slice(i, i + 500)
        const { error } = await supabase.from('faturas_transportadoras').insert(lote)

        if (error) {
          alert('Erro ao importar lote: ' + error.message)
          setImportando(false)
          return
        }
      }

      for (const item of atualizacoes) {
        const { error } = await supabase
          .from('faturas_transportadoras')
          .update(item.payload)
          .eq('id', item.id)

        if (error) {
          alert('Erro ao atualizar fatura existente: ' + error.message)
          setImportando(false)
          return
        }
      }

      alert(
        `Importação concluída.\n\n` +
          `Novas faturas: ${novos.length}\n` +
          `Faturas atualizadas: ${atualizacoes.length}` +
          (duplicadasNoExcel > 0
            ? `\nDuplicadas no Excel ignoradas/mescladas: ${duplicadasNoExcel}`
            : '')
      )


      await carregar()
    } catch (error: any) {
      alert('Erro ao importar Excel: ' + error.message)
    }

    setImportando(false)
    event.target.value = ''
  }


  async function salvarFatura() {
    if (!form.transportadora) return alert('Selecione a transportadora.')
    if (!form.numero_fatura.trim()) return alert('Informe o número da fatura.')

    setSalvando(true)

    const payload = {
      transportadora: form.transportadora,
      conta: form.conta || null,
      numero_fatura: form.numero_fatura || null,
      emissao: form.emissao || null,
      vencimento: form.vencimento || null,
      situacao: form.situacao || 'EM ABERTO',
      total: numero(form.total),
      valor_contestado: numero(form.valor_contestado),
      pago_ajustado: numero(form.pago_ajustado),
      saldo: form.saldo ? numero(form.saldo) : numero(form.total) - numero(form.pago_ajustado),
      moeda: form.moeda || 'BRL',
      observacoes: form.observacoes || null,
      atualizado_em: new Date().toISOString(),
    }

    if (editandoId) {
      const { error } = await supabase
        .from('faturas_transportadoras')
        .update(payload)
        .eq('id', editandoId)

      setSalvando(false)

      if (error) {
        alert(error.message)
        return
      }

      alert('Fatura atualizada com sucesso.')
    } else {
      const { error } = await supabase
        .from('faturas_transportadoras')
        .insert([payload])

      setSalvando(false)

      if (error) {
        alert(error.message)
        return
      }

      alert('Fatura cadastrada com sucesso.')
    }

    limparFormulario()
    carregar()
  }

  function editar(item: FaturaTransportadora) {
    setEditandoId(item.id)

    setForm({
      transportadora: item.transportadora || 'DHL',
      conta: item.conta || '',
      numero_fatura: item.numero_fatura || '',
      emissao: item.emissao ? String(item.emissao).slice(0, 10) : '',
      vencimento: item.vencimento ? String(item.vencimento).slice(0, 10) : '',
      situacao: item.situacao || 'EM ABERTO',
      total: item.total ? String(item.total).replace('.', ',') : '',
      valor_contestado: item.valor_contestado ? String(item.valor_contestado).replace('.', ',') : '',
      pago_ajustado: item.pago_ajustado ? String(item.pago_ajustado).replace('.', ',') : '',
      saldo: item.saldo ? String(item.saldo).replace('.', ',') : '',
      moeda: item.moeda || 'BRL',
      observacoes: item.observacoes || '',
    })

    setTimeout(() => {
      document.getElementById('form_fatura_transportadora')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  function limparFormulario() {
    setEditandoId(null)
    setForm(formVazio)
  }

  async function anexarPdf(item: FaturaTransportadora, arquivo: File | null) {
    if (!arquivo) return
    if (arquivo.type !== 'application/pdf') return alert('Anexe apenas PDF.')

    setUploadingId(item.id)

    const nomeLimpo = arquivo.name.replaceAll(' ', '-')
    const caminho = `transportadoras/${item.transportadora}/${item.id}/${Date.now()}-${nomeLimpo}`

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(caminho, arquivo, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'application/pdf',
      })

    if (uploadError) {
      setUploadingId(null)
      alert(uploadError.message)
      return
    }

    const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(caminho)

    const { error } = await supabase
      .from('faturas_transportadoras')
      .update({
        arquivo_pdf: urlData.publicUrl,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', item.id)

    setUploadingId(null)

    if (error) {
      alert(error.message)
      return
    }

    alert('PDF anexado com sucesso.')
    carregar()
  }

  async function alternarArquivada(item: FaturaTransportadora) {
    const arquivar = !item.arquivada
    const confirmar = confirm(
      arquivar
        ? `Arquivar a fatura ${item.numero_fatura}?`
        : `Restaurar a fatura ${item.numero_fatura}?`
    )

    if (!confirmar) return

    const { error } = await supabase
      .from('faturas_transportadoras')
      .update({
        arquivada: arquivar,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', item.id)

    if (error) {
      alert(error.message)
      return
    }

    carregar()
  }

  async function excluir(item: FaturaTransportadora) {
    const confirmar = confirm(`Excluir definitivamente a fatura ${item.numero_fatura}?`)
    if (!confirmar) return

    const { error } = await supabase
      .from('faturas_transportadoras')
      .delete()
      .eq('id', item.id)

    if (error) {
      alert(error.message)
      return
    }

    alert('Fatura excluída.')
    carregar()
  }

  function limparFiltros() {
    setBusca('')
    setFiltroTransportadora('TODAS')
    setFiltroSituacao('TODAS')
    setFiltroArquivadas('ATIVAS')
  }

  function filtroRapido(tipo: string) {
    if (tipo === 'DHL') {
      setFiltroTransportadora('DHL')
      setFiltroSituacao('TODAS')
      setFiltroArquivadas('ATIVAS')
    }

    if (tipo === 'FEDEX') {
      setFiltroTransportadora('FedEx')
      setFiltroSituacao('TODAS')
      setFiltroArquivadas('ATIVAS')
    }

    if (tipo === 'VENCIDAS') {
      setFiltroTransportadora('TODAS')
      setFiltroSituacao('VENCIDA')
      setFiltroArquivadas('ATIVAS')
    }

    if (tipo === 'ABERTAS') {
      setFiltroTransportadora('TODAS')
      setFiltroSituacao('EM ABERTO')
      setFiltroArquivadas('ATIVAS')
    }

    if (tipo === 'ARQUIVADAS') {
      setFiltroTransportadora('TODAS')
      setFiltroSituacao('TODAS')
      setFiltroArquivadas('ARQUIVADAS')
    }
  }

  const filtradas = useMemo(() => {
    const termo = busca.toLowerCase().trim()

    return faturas.filter((item) => {
      const statusAuto = situacaoAutomatica(item)

      const texto = `
        ${item.transportadora || ''}
        ${item.conta || ''}
        ${item.numero_fatura || ''}
        ${item.situacao || ''}
        ${item.moeda || ''}
        ${item.observacoes || ''}
      `.toLowerCase()

      const passaBusca = !termo || texto.includes(termo)
      const passaTransportadora =
        filtroTransportadora === 'TODAS' || item.transportadora === filtroTransportadora
      const passaSituacao =
        filtroSituacao === 'TODAS' ||
        statusAuto === filtroSituacao ||
        String(item.situacao || '').toUpperCase() === filtroSituacao
      const passaArquivadas =
        filtroArquivadas === 'TODAS' ||
        (filtroArquivadas === 'ATIVAS' && !item.arquivada) ||
        (filtroArquivadas === 'ARQUIVADAS' && !!item.arquivada)

      return passaBusca && passaTransportadora && passaSituacao && passaArquivadas
    })
  }, [faturas, busca, filtroTransportadora, filtroSituacao, filtroArquivadas])

  const totais = useMemo(() => {
    const ativas = faturas.filter((item) => !item.arquivada)
    const dhl = ativas.filter((item) => item.transportadora === 'DHL')
    const fedex = ativas.filter((item) => item.transportadora === 'FedEx')
    const vencidas = ativas.filter((item) => situacaoAutomatica(item) === 'VENCIDA')
    const abertas = ativas.filter((item) => situacaoAutomatica(item) === 'EM ABERTO')
    const arquivadas = faturas.filter((item) => item.arquivada)

    function somarSaldo(lista: FaturaTransportadora[]) {
      return lista.reduce((acc, item) => acc + Number(item.saldo || 0), 0)
    }

    function somarTotal(lista: FaturaTransportadora[]) {
      return lista.reduce((acc, item) => acc + Number(item.total || 0), 0)
    }

    return {
      dhl: { qtd: dhl.length, saldo: somarSaldo(dhl), total: somarTotal(dhl) },
      fedex: { qtd: fedex.length, saldo: somarSaldo(fedex), total: somarTotal(fedex) },
      vencidas: { qtd: vencidas.length, saldo: somarSaldo(vencidas) },
      abertas: { qtd: abertas.length, saldo: somarSaldo(abertas) },
      arquivadas: { qtd: arquivadas.length, saldo: somarSaldo(arquivadas) },
      geral: { qtd: ativas.length, saldo: somarSaldo(ativas), total: somarTotal(ativas) },
    }
  }, [faturas])

  return (
    <main className="w-full max-w-none p-6 lg:p-8 text-white">
      <div className="mb-8 flex flex-col xl:flex-row justify-between gap-6">
        <div>
          <p className="text-blue-400 font-bold mb-2">Transportadoras</p>
          <h1 className="text-5xl font-black mb-2">Faturas DHL e FedEx</h1>
          <p className="text-slate-400 text-lg">
            Controle as faturas das transportadoras sem misturar com as faturas emitidas para clientes.
          </p>

          <p className="text-slate-500 text-sm mt-3">
            Última alteração dos filtros: {ultimaAlteracao || '-'}
          </p>
        </div>

        <div className="flex gap-3 flex-wrap h-fit">
          <Link
            href="/admin/faturas"
            className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold"
          >
            Faturas clientes
          </Link>

          <label className="bg-emerald-600 hover:bg-emerald-500 px-5 py-3 rounded-xl font-bold cursor-pointer">
            {importando ? 'Importando...' : 'Importar Excel'}
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              disabled={importando}
              onChange={importarExcel}
            />
          </label>

          <button
            onClick={carregar}
            className="bg-blue-600 hover:bg-blue-500 px-5 py-3 rounded-xl font-bold"
          >
            Atualizar
          </button>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-5 mb-8">
        <KpiCard titulo="DHL" valor={totais.dhl.qtd} detalhe={`Saldo ${moeda(totais.dhl.saldo)}`} icone="🟡" onClick={() => filtroRapido('DHL')} />
        <KpiCard titulo="FedEx" valor={totais.fedex.qtd} detalhe={`Saldo ${moeda(totais.fedex.saldo)}`} icone="🟣" onClick={() => filtroRapido('FEDEX')} />
        <KpiCard titulo="Vencidas" valor={totais.vencidas.qtd} detalhe={`Saldo ${moeda(totais.vencidas.saldo)}`} icone="🚨" onClick={() => filtroRapido('VENCIDAS')} />
        <KpiCard titulo="Em aberto" valor={totais.abertas.qtd} detalhe={`Saldo ${moeda(totais.abertas.saldo)}`} icone="⏳" onClick={() => filtroRapido('ABERTAS')} />
        <KpiCard titulo="Arquivadas" valor={totais.arquivadas.qtd} detalhe="Ocultas da visão principal" icone="🗄️" onClick={() => filtroRapido('ARQUIVADAS')} />
        <KpiCard titulo="Saldo ativo" valor={moeda(totais.geral.saldo)} detalhe={`${totais.geral.qtd} fatura(s)`} icone="💰" />
      </section>

      <section id="form_fatura_transportadora" className="border border-blue-900 rounded-3xl bg-[#071225] p-7 mb-8">
        <div className="flex flex-col lg:flex-row justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-black">
              {editandoId ? 'Editar fatura da transportadora' : 'Cadastrar fatura da transportadora'}
            </h2>
            <p className="text-slate-400 text-sm">
              Cadastre manualmente ou cole os dados principais da DHL/FedEx.
            </p>
          </div>

          {editandoId && (
            <button
              onClick={limparFormulario}
              className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold h-fit"
            >
              Cancelar edição
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-6 gap-4">
          <Campo label="Transportadora">
            <select
              value={form.transportadora}
              onChange={(e) => setForm({ ...form, transportadora: e.target.value })}
            >
              <option value="DHL">DHL</option>
              <option value="FedEx">FedEx</option>
            </select>
          </Campo>

          <Campo label="Conta">
            <input
              value={form.conta}
              onChange={(e) => setForm({ ...form, conta: e.target.value })}
              placeholder="Ex: 965847180"
            />
          </Campo>

          <Campo label="Nº fatura">
            <input
              value={form.numero_fatura}
              onChange={(e) => setForm({ ...form, numero_fatura: e.target.value })}
              placeholder="Ex: BHZIR..."
            />
          </Campo>

          <Campo label="Emissão">
            <input
              type="date"
              value={form.emissao}
              onChange={(e) => setForm({ ...form, emissao: e.target.value })}
            />
          </Campo>

          <Campo label="Vencimento">
            <input
              type="date"
              value={form.vencimento}
              onChange={(e) => setForm({ ...form, vencimento: e.target.value })}
            />
          </Campo>

          <Campo label="Situação">
            <select
              value={form.situacao}
              onChange={(e) => setForm({ ...form, situacao: e.target.value })}
            >
              <option value="EM ABERTO">Em aberto</option>
              <option value="VENCIDA">Vencida</option>
              <option value="PAGA">Paga</option>
              <option value="CONTESTADA">Contestada</option>
            </select>
          </Campo>

          <Campo label="Total">
            <input
              value={form.total}
              onChange={(e) => setForm({ ...form, total: e.target.value })}
              placeholder="Ex: 3810,58"
            />
          </Campo>

          <Campo label="Valor contestado">
            <input
              value={form.valor_contestado}
              onChange={(e) => setForm({ ...form, valor_contestado: e.target.value })}
              placeholder="Ex: 0,00"
            />
          </Campo>

          <Campo label="Pago / Ajustado">
            <input
              value={form.pago_ajustado}
              onChange={(e) => setForm({ ...form, pago_ajustado: e.target.value })}
              placeholder="Ex: 0,00"
            />
          </Campo>

          <Campo label="Saldo">
            <input
              value={form.saldo}
              onChange={(e) => setForm({ ...form, saldo: e.target.value })}
              placeholder="Se vazio, calcula automático"
            />
          </Campo>

          <Campo label="Moeda">
            <select
              value={form.moeda}
              onChange={(e) => setForm({ ...form, moeda: e.target.value })}
            >
              <option value="BRL">BRL</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </Campo>

          <div className="md:col-span-4 xl:col-span-6">
            <Campo label="Observações">
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                className="min-h-[80px]"
                placeholder="Observações internas"
              />
            </Campo>
          </div>

          <button
            onClick={salvarFatura}
            disabled={salvando}
            className="md:col-span-4 xl:col-span-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 px-5 py-4 rounded-2xl font-black"
          >
            {salvando ? 'Salvando...' : editandoId ? 'Salvar edição' : 'Cadastrar fatura'}
          </button>
        </div>
      </section>

      <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
        <div className="flex flex-col xl:flex-row justify-between gap-5 mb-6">
          <div>
            <h2 className="text-2xl font-black">Faturas cadastradas</h2>
            <p className="text-slate-400 text-sm">
              {filtradas.length} de {faturas.length} fatura(s) encontrada(s)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 w-full xl:max-w-[1100px]">
            <select
              value={filtroTransportadora}
              onChange={(e) => setFiltroTransportadora(e.target.value)}
            >
              <option value="TODAS">Transportadora: todas</option>
              <option value="DHL">DHL</option>
              <option value="FedEx">FedEx</option>
            </select>

            <select
              value={filtroSituacao}
              onChange={(e) => setFiltroSituacao(e.target.value)}
            >
              <option value="TODAS">Situação: todas</option>
              <option value="EM ABERTO">Em aberto</option>
              <option value="VENCIDA">Vencida</option>
              <option value="PAGA">Paga</option>
              <option value="CONTESTADA">Contestada</option>
            </select>

            <select
              value={filtroArquivadas}
              onChange={(e) => setFiltroArquivadas(e.target.value)}
            >
              <option value="ATIVAS">Ativas</option>
              <option value="ARQUIVADAS">Arquivadas</option>
              <option value="TODAS">Todas</option>
            </select>

            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por conta, fatura, observação..."
            />

            <button
              onClick={limparFiltros}
              className="bg-slate-700 hover:bg-slate-600 px-5 py-3 rounded-xl font-bold"
            >
              Limpar filtros
            </button>
          </div>
        </div>

        {loading ? (
          <div className="border border-blue-900 bg-[#020817] rounded-2xl p-6 text-slate-400">
            Carregando faturas...
          </div>
        ) : filtradas.length === 0 ? (
          <div className="border border-blue-900 bg-[#020817] rounded-2xl p-6 text-slate-400">
            Nenhuma fatura encontrada.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1420px] border-collapse text-sm [&_th]:border-b [&_th]:border-blue-900 [&_th]:px-3 [&_th]:py-3 [&_th]:text-left [&_th]:font-black [&_th]:text-slate-300 [&_td]:px-3 [&_td]:py-4 [&_td]:align-middle">
              <thead>
                <tr>
                  <th>Transportadora</th>
                  <th>Conta</th>
                  <th>Fatura</th>
                  <th>Emissão</th>
                  <th>Vencimento</th>
                  <th>Situação</th>
                  <th>Total</th>
                  <th>Contestado</th>
                  <th>Pago/Ajust.</th>
                  <th>Saldo</th>
                  <th>PDF</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {filtradas.map((item) => {
                  const status = situacaoAutomatica(item)

                  return (
                    <tr key={item.id} className="border-b border-blue-900/60 hover:bg-[#0b1730] transition">
                      <td className="font-black">
                        <span className={item.transportadora === 'DHL' ? 'text-yellow-300' : 'text-purple-300'}>
                          {item.transportadora}
                        </span>
                      </td>

                      <td>
                        <strong>{item.conta || '-'}</strong>
                      </td>

                      <td>
                        <strong className="text-blue-400">{item.numero_fatura || '-'}</strong>
                        {item.observacoes ? (
                          <p className="text-slate-500 text-xs mt-1 max-w-[240px] truncate">
                            {item.observacoes}
                          </p>
                        ) : null}
                      </td>

                      <td>{dataBR(item.emissao)}</td>
                      <td>{dataBR(item.vencimento)}</td>

                      <td>
                        <span className={`border px-3 py-1 rounded-full text-xs font-black ${classeSituacao(status)}`}>
                          {status}
                        </span>
                      </td>

                      <td>{moeda(item.total, item.moeda || 'BRL')}</td>
                      <td>{moeda(item.valor_contestado, item.moeda || 'BRL')}</td>
                      <td>{moeda(item.pago_ajustado, item.moeda || 'BRL')}</td>
                      <td className="font-black">{moeda(item.saldo, item.moeda || 'BRL')}</td>

                      <td>
                        {item.arquivo_pdf ? (
                          <a
                            href={item.arquivo_pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-green-600 hover:bg-green-500 px-3 py-2 rounded-xl font-bold text-xs inline-block"
                          >
                            Abrir
                          </a>
                        ) : (
                          <span className="text-slate-500">Sem PDF</span>
                        )}
                      </td>

                      <td>
                        <div className="flex gap-2 flex-wrap">
                          <label className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-xl font-bold text-xs cursor-pointer">
                            {uploadingId === item.id ? 'Enviando...' : 'PDF'}
                            <input
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              disabled={uploadingId === item.id}
                              onChange={(e) => anexarPdf(item, e.target.files?.[0] || null)}
                            />
                          </label>

                          <button
                            onClick={() => editar(item)}
                            className="bg-purple-600 hover:bg-purple-500 px-3 py-2 rounded-xl font-bold text-xs"
                          >
                            Editar
                          </button>

                          <button
                            onClick={() => alternarArquivada(item)}
                            className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-xl font-bold text-xs"
                          >
                            {item.arquivada ? 'Restaurar' : 'Arquivar'}
                          </button>

                          <button
                            onClick={() => excluir(item)}
                            className="bg-red-700 hover:bg-red-600 px-3 py-2 rounded-xl font-bold text-xs"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-slate-300 font-bold mb-2">{label}</label>
      {children}
    </div>
  )
}

function KpiCard({
  titulo,
  valor,
  detalhe,
  icone,
  onClick,
}: {
  titulo: string
  valor: any
  detalhe: string
  icone: string
  onClick?: () => void
}) {
  const conteudo = (
    <div className="flex justify-between items-start gap-4">
      <div>
        <p className="text-slate-300 font-bold">{titulo}</p>
        <h2 className="text-4xl font-black mt-4 text-white">{valor}</h2>
        <p className="text-slate-400 mt-2 text-sm">{detalhe}</p>
      </div>

      <div className="text-4xl">{icone}</div>
    </div>
  )

  if (!onClick) {
    return (
      <div className="border border-blue-900 rounded-3xl bg-[#071225] p-6">
        {conteudo}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-blue-900 rounded-3xl bg-[#071225] hover:border-blue-400 hover:bg-blue-600/10 transition p-6 text-left"
    >
      {conteudo}
    </button>
  )
}
