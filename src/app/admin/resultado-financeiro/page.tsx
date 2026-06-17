'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export default function ResultadoFinanceiroPage() {
  const [dados, setDados] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [ano, setAno] = useState('TODOS')
  const [mes, setMes] = useState('TODOS')
  const [cliente, setCliente] = useState('TODOS')
  const [transportadora, setTransportadora] = useState('TODOS')
  const [metaMes, setMetaMes] = useState('8000')

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setLoading(true)

    let todos: any[] = []
    let inicio = 0
    const limite = 1000

    while (true) {
      const { data, error } = await supabase
        .from('financeiro_embarques')
        .select('*')
        .order('cliente', { ascending: true })
        .range(inicio, inicio + limite - 1)

      if (error) {
        alert('Erro ao carregar resultado financeiro: ' + error.message)
        setLoading(false)
        return
      }

      todos = [...todos, ...(data || [])]

      if (!data || data.length < limite) break

      inicio += limite
    }

    setDados(
      todos.sort((a, b) =>
        String(a.cliente || '').localeCompare(String(b.cliente || ''), 'pt-BR')
      )
    )

    setLoading(false)
  }

  function moeda(valor: any) {
    return Number(valor || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  function numero(valor: any) {
    if (valor === null || valor === undefined || valor === '') return 0
    if (typeof valor === 'number') return valor

    return (
      Number(
        String(valor)
          .replace(/[R$\s]/g, '')
          .replace(/\./g, '')
          .replace(',', '.')
      ) || 0
    )
  }

  function normalizarData(valor: any) {
    if (!valor) return null

    if (valor instanceof Date && !isNaN(valor.getTime())) {
      return valor.toISOString().slice(0, 10)
    }

    const texto = String(valor).trim()
    if (!texto) return null

    if (/^\d{4}-\d{2}-\d{2}/.test(texto)) {
      return texto.slice(0, 10)
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
      const [dia, mes, ano] = texto.split('/')
      return `${ano}-${mes}-${dia}`
    }

    return null
  }

  function getDataProfit(item: any) {
    return normalizarData(item.recebimento)
  }

  function getAno(item: any) {
    const data = getDataProfit(item)
    if (!data) return 'SEM RECEBIMENTO'
    return data.slice(0, 4)
  }

  function getMesNumero(item: any) {
    const data = getDataProfit(item)
    if (!data) return null
    return Number(data.slice(5, 7))
  }

  function getMes(item: any) {
    const numeroMes = getMesNumero(item)
    if (!numeroMes) return 'SEM RECEBIMENTO'
    return MESES[numeroMes - 1] || 'SEM RECEBIMENTO'
  }

  function temRecebimento(item: any) {
    return !!getDataProfit(item)
  }

  function temCustoReal(item: any) {
    return Number(item.valor_compra || 0) > 0
  }

  function custos(item: any) {
    return (
      Number(item.doc_dta || 0) +
      Number(item.debito_terceiro || 0) +
      Number(item.valor_compra || 0)
    )
  }

  function profit(item: any) {
    if (!temCustoReal(item)) return 0

    return (
      Number(item.valor_cobranca || 0) -
      Number(item.doc_dta || 0) -
      Number(item.debito_terceiro || 0) -
      Number(item.valor_compra || 0)
    )
  }

  const dadosRecebidos = useMemo(() => {
    return dados.filter(temRecebimento)
  }, [dados])

  const anos = useMemo(() => {
    return [
      'TODOS',
      ...Array.from(new Set(dadosRecebidos.map(getAno)))
        .filter(Boolean)
        .sort(),
    ]
  }, [dadosRecebidos])

  const meses = ['TODOS', ...MESES]

  const clientes = useMemo(() => {
    return [
      'TODOS',
      ...Array.from(new Set(dadosRecebidos.map((d) => d.cliente || 'SEM CLIENTE'))).sort(
        (a, b) => String(a).localeCompare(String(b), 'pt-BR')
      ),
    ]
  }, [dadosRecebidos])

  const transportadoras = useMemo(() => {
    return [
      'TODOS',
      ...Array.from(
        new Set(dadosRecebidos.map((d) => d.transportadora || 'SEM TRANSPORTADORA'))
      ).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR')),
    ]
  }, [dadosRecebidos])

  const filtrados = useMemo(() => {
    return dadosRecebidos.filter((item) => {
      const passaAno = ano === 'TODOS' || getAno(item) === ano
      const passaMes = mes === 'TODOS' || getMes(item) === mes
      const passaCliente = cliente === 'TODOS' || (item.cliente || 'SEM CLIENTE') === cliente
      const passaTransportadora =
        transportadora === 'TODOS' ||
        (item.transportadora || 'SEM TRANSPORTADORA') === transportadora

      return passaAno && passaMes && passaCliente && passaTransportadora
    })
  }, [dadosRecebidos, ano, mes, cliente, transportadora])

  const filtradosComCusto = useMemo(() => {
    return filtrados.filter(temCustoReal)
  }, [filtrados])

  const totais = useMemo(() => {
    const faturamentoTotal = filtrados.reduce(
      (acc, item) => acc + Number(item.valor_cobranca || 0),
      0
    )

    const faturamentoReal = filtradosComCusto.reduce(
      (acc, item) => acc + Number(item.valor_cobranca || 0),
      0
    )

    const totalCustos = filtradosComCusto.reduce((acc, item) => acc + custos(item), 0)
    const totalProfit = filtradosComCusto.reduce((acc, item) => acc + profit(item), 0)
    const margemReal = faturamentoReal > 0 ? (totalProfit / faturamentoReal) * 100 : 0
    const ticketMedio = filtrados.length > 0 ? faturamentoTotal / filtrados.length : 0

    return {
      faturamentoTotal,
      faturamentoReal,
      custos: totalCustos,
      profit: totalProfit,
      margemReal,
      ticketMedio,
      processos: filtrados.length,
      comCusto: filtradosComCusto.length,
      semCusto: filtrados.length - filtradosComCusto.length,
    }
  }, [filtrados, filtradosComCusto])

  function ranking(campo: string) {
    const mapa: any = {}

    filtradosComCusto.forEach((item) => {
      const chave = item[campo] || `SEM ${campo.toUpperCase()}`

      if (!mapa[chave]) {
        mapa[chave] = {
          nome: chave,
          processos: 0,
          faturamento: 0,
          custos: 0,
          profit: 0,
        }
      }

      mapa[chave].processos += 1
      mapa[chave].faturamento += Number(item.valor_cobranca || 0)
      mapa[chave].custos += custos(item)
      mapa[chave].profit += profit(item)
    })

    return Object.values(mapa)
      .sort((a: any, b: any) => b.profit - a.profit)
      .slice(0, 10)
  }

  const rankingClientes = ranking('cliente')
  const rankingTransportadoras = ranking('transportadora')
  const rankingDespachantes = ranking('despachante')
  const rankingServicos = ranking('servico')

  const historicoMensal = useMemo(() => {
    const mapa: any = {}

    dadosRecebidos.filter(temCustoReal).forEach((item) => {
      const anoItem = getAno(item)
      const mesNumero = getMesNumero(item)

      if (!anoItem || !mesNumero) return

      const chave = `${anoItem}-${String(mesNumero).padStart(2, '0')}`

      if (!mapa[chave]) {
        mapa[chave] = {
          ano: anoItem,
          mesNumero,
          mes: MESES[mesNumero - 1],
          faturamento: 0,
          custos: 0,
          profit: 0,
          processos: 0,
        }
      }

      mapa[chave].faturamento += Number(item.valor_cobranca || 0)
      mapa[chave].custos += custos(item)
      mapa[chave].profit += profit(item)
      mapa[chave].processos += 1
    })

    return Object.values(mapa).sort((a: any, b: any) => {
      if (a.ano !== b.ano) return Number(a.ano) - Number(b.ano)
      return a.mesNumero - b.mesNumero
    })
  }, [dadosRecebidos])

  const anosHistorico = useMemo(() => {
    return Array.from(new Set(historicoMensal.map((i: any) => i.ano))).sort()
  }, [historicoMensal])

  const resumoAtual: any = useMemo(() => {
    const anoSelecionado = ano !== 'TODOS' ? Number(ano) : null
    const mesSelecionado = mes !== 'TODOS' ? MESES.indexOf(mes) + 1 : null

    if (!anoSelecionado || !mesSelecionado) return null

    return historicoMensal.find(
      (item: any) => Number(item.ano) === anoSelecionado && item.mesNumero === mesSelecionado
    )
  }, [historicoMensal, ano, mes])

  const resumoAnoAnterior: any = useMemo(() => {
    const anoSelecionado = ano !== 'TODOS' ? Number(ano) : null
    const mesSelecionado = mes !== 'TODOS' ? MESES.indexOf(mes) + 1 : null

    if (!anoSelecionado || !mesSelecionado) return null

    return historicoMensal.find(
      (item: any) =>
        Number(item.ano) === anoSelecionado - 1 && item.mesNumero === mesSelecionado
    )
  }, [historicoMensal, ano, mes])

  const comparativoAnoAnterior = useMemo(() => {
    if (!resumoAtual || !resumoAnoAnterior) {
      return {
        diferenca: 0,
        percentual: 0,
        temComparativo: false,
      }
    }

    const diferenca = Number(resumoAtual.profit || 0) - Number(resumoAnoAnterior.profit || 0)
    const percentual =
      Number(resumoAnoAnterior.profit || 0) > 0
        ? (diferenca / Number(resumoAnoAnterior.profit || 0)) * 100
        : 0

    return {
      diferenca,
      percentual,
      temComparativo: true,
    }
  }, [resumoAtual, resumoAnoAnterior])

  const metaValor = numero(metaMes)
  const progressoMeta = metaValor > 0 ? Math.min((totais.profit / metaValor) * 100, 100) : 0
  const faltaMeta = Math.max(metaValor - totais.profit, 0)
  const melhorCliente = rankingClientes[0] as any
  const melhorTransportadora = rankingTransportadoras[0] as any

  const alertas = useMemo(() => {
    const lista: string[] = []

    if (metaValor > 0 && totais.profit < metaValor) {
      lista.push(`Faltam ${moeda(faltaMeta)} para atingir a meta do período.`)
    }

    if (comparativoAnoAnterior.temComparativo && comparativoAnoAnterior.percentual < 0) {
      lista.push(
        `Profit ${Math.abs(comparativoAnoAnterior.percentual).toFixed(1)}% abaixo do mesmo mês do ano anterior.`
      )
    }

    if (totais.semCusto > 0) {
      lista.push(`${totais.semCusto} processos recebidos estão sem valor de compra.`)
    }

    if (totais.margemReal > 0 && totais.margemReal < 20) {
      lista.push(`Margem real abaixo de 20%. Margem atual: ${totais.margemReal.toFixed(2)}%.`)
    }

    if (lista.length === 0) {
      lista.push('Resultado saudável no filtro selecionado.')
    }

    return lista
  }, [totais, comparativoAnoAnterior, metaValor, faltaMeta])

  return (
    <main className="max-w-[1800px] mx-auto text-white pb-12">
      <div className="mb-8 flex flex-col lg:flex-row justify-between gap-5">
        <div>
          <p className="text-blue-400 font-bold mb-2">Resultado Financeiro Premium</p>
          <h1 className="text-5xl font-black mb-2">Painel Executivo HC</h1>
          <p className="text-slate-400 text-lg">
            Análise visual por recebimento, comparação histórica, meta e evolução do Profit HC.
          </p>
        </div>

        <button
          onClick={carregar}
          className="bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold h-fit"
        >
          {loading ? 'Atualizando...' : 'Atualizar dados'}
        </button>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <Select label="Ano" value={ano} onChange={setAno} options={anos} />
        <Select label="Mês" value={mes} onChange={setMes} options={meses} />
        <Select label="Cliente" value={cliente} onChange={setCliente} options={clientes} />
        <Select label="Transportadora" value={transportadora} onChange={setTransportadora} options={transportadoras} />

        <div className="border border-blue-900 bg-[#071225] rounded-2xl p-4">
          <label className="text-sm text-slate-400 font-bold">Meta do período</label>
          <input
            value={metaMes}
            onChange={(e) => setMetaMes(e.target.value)}
            className="mt-2 w-full bg-[#020817] border border-blue-900 rounded-xl px-3 py-3 text-white"
            placeholder="8000"
          />
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-8">
        <div className="xl:col-span-2 border border-green-500/60 rounded-3xl bg-gradient-to-br from-[#06231b] to-[#071225] p-7">
          <p className="text-green-300 font-bold mb-2">Profit HC Real</p>
          <h2 className="text-6xl font-black text-green-400 mb-4">{moeda(totais.profit)}</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <MiniIndicador titulo="Recebido" valor={moeda(totais.faturamentoTotal)} />
            <MiniIndicador titulo="Custos reais" valor={moeda(totais.custos)} />
            <MiniIndicador titulo="Margem real" valor={`${totais.margemReal.toFixed(2)}%`} />
          </div>
        </div>

        <div className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
          <p className="text-slate-400 font-bold">Comparativo anual</p>

          {comparativoAnoAnterior.temComparativo ? (
            <>
              <h2
                className={`text-4xl font-black mt-4 ${
                  comparativoAnoAnterior.diferenca >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {comparativoAnoAnterior.percentual >= 0 ? '+' : ''}
                {comparativoAnoAnterior.percentual.toFixed(1)}%
              </h2>

              <p className="text-slate-400 mt-3">
                Diferença vs mesmo mês do ano anterior:
              </p>

              <p
                className={`text-2xl font-black mt-2 ${
                  comparativoAnoAnterior.diferenca >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {moeda(comparativoAnoAnterior.diferenca)}
              </p>
            </>
          ) : (
            <p className="text-slate-400 mt-5">
              Selecione um ano e mês com histórico anterior para comparar.
            </p>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-6 gap-5 mb-8">
        <Card titulo="Faturamento Total" valor={moeda(totais.faturamentoTotal)} detalhe="Recebidos no período" />
        <Card titulo="Faturamento Real" valor={moeda(totais.faturamentoReal)} detalhe="Recebidos com custo" />
        <Card titulo="Ticket Médio" valor={moeda(totais.ticketMedio)} detalhe="Recebido / processos" />
        <Card titulo="Processos" valor={String(totais.processos)} detalhe="Recebidos no filtro" />
        <Card titulo="Com Custo" valor={String(totais.comCusto)} detalhe="Entram no profit" destaque />
        <Card titulo="Sem Custo" valor={String(totais.semCusto)} detalhe="Aguardando compra" alerta />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        <div className="xl:col-span-2 border border-blue-900 rounded-3xl bg-[#071225] p-7">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
            <div>
              <h2 className="text-2xl font-black">Evolução do Profit HC</h2>
              <p className="text-slate-400">
                Comparativo mensal por ano para visualizar crescimento ou queda.
              </p>
            </div>
          </div>

          <GraficoLinhas historico={historicoMensal} anos={anosHistorico} moeda={moeda} />
        </div>

        <div className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
          <h2 className="text-2xl font-black mb-2">Meta do período</h2>
          <p className="text-slate-400 mb-6">
            Quanto falta para atingir sua meta no filtro atual.
          </p>

          <div className="mb-5">
            <p className="text-slate-400 font-bold">Meta</p>
            <h3 className="text-3xl font-black">{moeda(metaValor)}</h3>
          </div>

          <div className="mb-5">
            <p className="text-slate-400 font-bold">Realizado</p>
            <h3 className="text-3xl font-black text-green-400">{moeda(totais.profit)}</h3>
          </div>

          <BarraProgresso percentual={progressoMeta} />

          <p className="text-slate-400 mt-4">
            {progressoMeta.toFixed(1)}% atingido
          </p>

          <p className="text-yellow-300 font-bold mt-3">
            Faltam {moeda(faltaMeta)}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        <RankingVisual titulo="Top clientes por Profit HC" dados={rankingClientes} moeda={moeda} />
        <RankingVisual titulo="Top transportadoras" dados={rankingTransportadoras} moeda={moeda} />
        <AlertasPremium alertas={alertas} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <Ranking titulo="Top despachantes por Profit HC Real" dados={rankingDespachantes} moeda={moeda} />
        <Ranking titulo="Top serviços por Profit HC Real" dados={rankingServicos} moeda={moeda} />
      </section>

      <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7 mb-8">
        <h2 className="text-2xl font-black mb-5">Resumo do período</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ResumoLinha titulo="Melhor cliente" valor={melhorCliente?.nome || '-'} detalhe={melhorCliente ? moeda(melhorCliente.profit) : '-'} />
          <ResumoLinha titulo="Melhor transportadora" valor={melhorTransportadora?.nome || '-'} detalhe={melhorTransportadora ? moeda(melhorTransportadora.profit) : '-'} />
        </div>
      </section>

      <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
        <h2 className="text-2xl font-black mb-5">Processos detalhados</h2>

        <div className="overflow-x-auto">
          <table className="table min-w-[1400px]">
            <thead>
              <tr>
                <th>AWB</th>
                <th>Cliente</th>
                <th>Despachante</th>
                <th>Transportadora</th>
                <th>Serviço</th>
                <th>Faturamento</th>
                <th>Custos</th>
                <th>Profit HC Real</th>
                <th>Margem</th>
                <th>Status Custo</th>
                <th>Vencimento</th>
                <th>Recebimento</th>
              </tr>
            </thead>

            <tbody>
              {filtrados.map((item) => {
                const faturamento = Number(item.valor_cobranca || 0)
                const totalCustos = temCustoReal(item) ? custos(item) : 0
                const totalProfit = profit(item)
                const margem =
                  temCustoReal(item) && faturamento > 0
                    ? (totalProfit / faturamento) * 100
                    : 0

                return (
                  <tr key={item.id}>
                    <td className="font-black text-blue-300">{item.awb || '-'}</td>
                    <td>{item.cliente || '-'}</td>
                    <td>{item.despachante || '-'}</td>
                    <td>{item.transportadora || '-'}</td>
                    <td>{item.servico || '-'}</td>
                    <td>{moeda(faturamento)}</td>
                    <td>{temCustoReal(item) ? moeda(totalCustos) : '-'}</td>
                    <td className={temCustoReal(item) ? (totalProfit >= 0 ? 'text-green-400 font-black' : 'text-red-400 font-black') : 'text-yellow-300 font-black'}>
                      {temCustoReal(item) ? moeda(totalProfit) : 'Aguardando custo'}
                    </td>
                    <td>{temCustoReal(item) ? `${margem.toFixed(2)}%` : '-'}</td>
                    <td>
                      {temCustoReal(item) ? (
                        <span className="text-green-400 font-bold">Com custo</span>
                      ) : (
                        <span className="text-yellow-300 font-bold">Sem custo</span>
                      )}
                    </td>
                    <td>{item.vencimento_cobranca || '-'}</td>
                    <td>{getDataProfit(item) || '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {filtrados.length === 0 && (
            <p className="text-slate-400 text-center py-8">Nenhum processo recebido encontrado.</p>
          )}
        </div>
      </section>
    </main>
  )
}

function Card({ titulo, valor, detalhe, destaque = false, alerta = false }: any) {
  return (
    <div
      className={`border rounded-3xl p-6 bg-[#071225] ${
        destaque ? 'border-green-500' : alerta ? 'border-yellow-500' : 'border-blue-900'
      }`}
    >
      <p className="text-slate-400 font-bold">{titulo}</p>
      <h2
        className={`text-3xl font-black mt-3 ${
          destaque ? 'text-green-400' : alerta ? 'text-yellow-300' : 'text-white'
        }`}
      >
        {valor}
      </h2>
      <p className="text-slate-500 text-sm mt-2">{detalhe}</p>
    </div>
  )
}

function MiniIndicador({ titulo, valor }: any) {
  return (
    <div className="rounded-2xl bg-black/20 border border-white/10 p-4">
      <p className="text-slate-400 font-bold text-sm">{titulo}</p>
      <p className="text-2xl font-black mt-2">{valor}</p>
    </div>
  )
}

function Select({ label, value, onChange, options }: any) {
  return (
    <div className="border border-blue-900 bg-[#071225] rounded-2xl p-4">
      <label className="text-sm text-slate-400 font-bold">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full bg-[#020817] border border-blue-900 rounded-xl px-3 py-3 text-white"
      >
        {options.map((opcao: string) => (
          <option key={opcao} value={opcao}>
            {opcao}
          </option>
        ))}
      </select>
    </div>
  )
}

function BarraProgresso({ percentual }: any) {
  return (
    <div className="w-full h-5 bg-[#020817] border border-blue-900 rounded-full overflow-hidden">
      <div
        className="h-full bg-green-500 rounded-full"
        style={{ width: `${Math.max(0, Math.min(percentual, 100))}%` }}
      />
    </div>
  )
}

function GraficoLinhas({ historico, anos, moeda }: any) {
  const largura = 900
  const altura = 300
  const padding = 45

  const maior = Math.max(...historico.map((i: any) => Number(i.profit || 0)), 1)

  function ponto(mesNumero: number, valor: number) {
    const x = padding + ((mesNumero - 1) / 11) * (largura - padding * 2)
    const y = altura - padding - (valor / maior) * (altura - padding * 2)
    return { x, y }
  }

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${largura} ${altura}`} className="min-w-[900px] w-full h-[330px]">
        {[0, 1, 2, 3].map((linha) => {
          const y = padding + linha * ((altura - padding * 2) / 3)
          return (
            <line
              key={linha}
              x1={padding}
              x2={largura - padding}
              y1={y}
              y2={y}
              stroke="rgba(148,163,184,0.18)"
            />
          )
        })}

        {MESES_ABREV.map((m, index) => {
          const x = padding + (index / 11) * (largura - padding * 2)
          return (
            <text key={m} x={x} y={altura - 12} fill="#94a3b8" fontSize="13" textAnchor="middle">
              {m}
            </text>
          )
        })}

        {anos.map((anoItem: string, index: number) => {
          const pontos = MESES.map((_, mesIndex) => {
            const item = historico.find(
              (h: any) => h.ano === anoItem && h.mesNumero === mesIndex + 1
            )

            return ponto(mesIndex + 1, Number(item?.profit || 0))
          })

          const d = pontos.map((p: any, i: number) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

          const cores = ['#38bdf8', '#22c55e', '#facc15', '#f97316', '#a855f7']
          const cor = cores[index % cores.length]

          return (
            <g key={anoItem}>
              <path d={d} fill="none" stroke={cor} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

              {pontos.map((p: any, i: number) => (
                <circle key={i} cx={p.x} cy={p.y} r="4" fill={cor}>
                  <title>{`${MESES[i]} ${anoItem}: ${moeda(
                    historico.find((h: any) => h.ano === anoItem && h.mesNumero === i + 1)?.profit || 0
                  )}`}</title>
                </circle>
              ))}

              <text x={largura - padding + 10} y={pontos[pontos.length - 1]?.y || 20} fill={cor} fontSize="14" fontWeight="bold">
                {anoItem}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function RankingVisual({ titulo, dados, moeda }: any) {
  const maior = Math.max(...dados.map((i: any) => Number(i.profit || 0)), 1)

  return (
    <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
      <h2 className="text-2xl font-black mb-5">{titulo}</h2>

      <div className="space-y-5">
        {dados.slice(0, 6).map((item: any, index: number) => {
          const largura = Math.max((Number(item.profit || 0) / maior) * 100, 3)

          return (
            <div key={item.nome}>
              <div className="flex justify-between gap-4 mb-2">
                <p className="font-bold text-blue-300 truncate">
                  {index === 0 ? '🥇 ' : index === 1 ? '🥈 ' : index === 2 ? '🥉 ' : ''}
                  {item.nome}
                </p>
                <p className="font-black">{moeda(item.profit)}</p>
              </div>

              <div className="h-3 bg-[#020817] border border-blue-900 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${largura}%` }} />
              </div>

              <p className="text-xs text-slate-500 mt-1">{item.processos} processos</p>
            </div>
          )
        })}

        {dados.length === 0 && (
          <p className="text-slate-400 text-center py-6">
            Nenhum processo com custo informado.
          </p>
        )}
      </div>
    </section>
  )
}

function AlertasPremium({ alertas }: any) {
  return (
    <section className="border border-yellow-500/60 rounded-3xl bg-yellow-500/10 p-7">
      <h2 className="text-2xl font-black mb-5 text-yellow-300">Alertas inteligentes</h2>

      <div className="space-y-3">
        {alertas.map((alerta: string, index: number) => (
          <div key={index} className="rounded-2xl bg-[#071225] border border-yellow-500/40 p-4">
            <p className="text-yellow-200 font-bold">⚠ {alerta}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function ResumoLinha({ titulo, valor, detalhe }: any) {
  return (
    <div className="border border-blue-900 rounded-2xl bg-[#020817] p-5">
      <p className="text-slate-400 font-bold">{titulo}</p>
      <h3 className="text-2xl font-black mt-2 text-blue-300">{valor}</h3>
      <p className="text-green-400 font-black mt-1">{detalhe}</p>
    </div>
  )
}

function Ranking({ titulo, dados, moeda }: any) {
  return (
    <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7">
      <h2 className="text-2xl font-black mb-5">{titulo}</h2>

      <div className="overflow-x-auto">
        <table className="table min-w-[700px]">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Processos</th>
              <th>Faturamento Real</th>
              <th>Custos Reais</th>
              <th>Profit HC Real</th>
            </tr>
          </thead>

          <tbody>
            {dados.map((item: any) => (
              <tr key={item.nome}>
                <td className="font-bold text-blue-300">{item.nome}</td>
                <td>{item.processos}</td>
                <td>{moeda(item.faturamento)}</td>
                <td>{moeda(item.custos)}</td>
                <td className={item.profit >= 0 ? 'text-green-400 font-black' : 'text-red-400 font-black'}>
                  {moeda(item.profit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {dados.length === 0 && (
          <p className="text-slate-400 text-center py-6">
            Nenhum processo recebido com custo informado.
          </p>
        )}
      </div>
    </section>
  )
}