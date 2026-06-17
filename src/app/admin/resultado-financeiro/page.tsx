'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ResultadoFinanceiroPage() {
  const [dados, setDados] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [ano, setAno] = useState('TODOS')
  const [mes, setMes] = useState('TODOS')
  const [cliente, setCliente] = useState('TODOS')
  const [transportadora, setTransportadora] = useState('TODOS')

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

    if (!data || data.length < limite) {
      break
    }

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

  function getDataProfit(item: any) {
    return item.recebimento || null
  }

  function getAno(item: any) {
    const data = getDataProfit(item)
    if (!data) return 'SEM RECEBIMENTO'
    return String(data).slice(0, 4)
  }

  function getMes(item: any) {
    const data = getDataProfit(item)
    if (!data) return 'SEM RECEBIMENTO'

    const m = String(data).slice(5, 7)

    const nomes: any = {
      '01': 'Janeiro',
      '02': 'Fevereiro',
      '03': 'Março',
      '04': 'Abril',
      '05': 'Maio',
      '06': 'Junho',
      '07': 'Julho',
      '08': 'Agosto',
      '09': 'Setembro',
      '10': 'Outubro',
      '11': 'Novembro',
      '12': 'Dezembro',
    }

    return nomes[m] || 'SEM RECEBIMENTO'
  }

  function temRecebimento(item: any) {
    return !!item.recebimento
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
    return ['TODOS', ...Array.from(new Set(dadosRecebidos.map(getAno))).filter(Boolean)]
  }, [dadosRecebidos])

  const meses = [
    'TODOS',
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

    return {
      faturamentoTotal,
      faturamentoReal,
      custos: totalCustos,
      profit: totalProfit,
      margemReal,
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

  const porMes = useMemo(() => {
    const mapa: any = {}

    filtradosComCusto.forEach((item) => {
      const chave = `${getAno(item)} - ${getMes(item)}`

      if (!mapa[chave]) {
        mapa[chave] = {
          mes: chave,
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

    return Object.values(mapa)
  }, [filtradosComCusto])

  return (
    <main className="max-w-[1800px] mx-auto text-white">
      <div className="mb-8 flex flex-col lg:flex-row justify-between gap-5">
        <div>
          <p className="text-blue-400 font-bold mb-2">Resultado Financeiro</p>
          <h1 className="text-5xl font-black mb-2">Análise de Profit HC Real</h1>
          <p className="text-slate-400 text-lg">
            O mês do profit é considerado pela data de recebimento.
          </p>
        </div>

        <button
          onClick={carregar}
          className="bg-blue-600 hover:bg-blue-500 px-6 py-4 rounded-2xl font-bold h-fit"
        >
          {loading ? 'Atualizando...' : 'Atualizar dados'}
        </button>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Select label="Ano" value={ano} onChange={setAno} options={anos} />
        <Select label="Mês" value={mes} onChange={setMes} options={meses} />
        <Select label="Cliente" value={cliente} onChange={setCliente} options={clientes} />
        <Select label="Transportadora" value={transportadora} onChange={setTransportadora} options={transportadoras} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-6 gap-5 mb-8">
        <Card titulo="Faturamento Total" valor={moeda(totais.faturamentoTotal)} detalhe="Recebidos no mês filtrado" />
        <Card titulo="Faturamento Real" valor={moeda(totais.faturamentoReal)} detalhe="Recebidos com custo informado" />
        <Card titulo="Custos Reais" valor={moeda(totais.custos)} detalhe="Compra + DTA + terceiros" />
        <Card titulo="Profit HC Real" valor={moeda(totais.profit)} detalhe="Resultado líquido real" destaque />
        <Card titulo="Margem Real" valor={`${totais.margemReal.toFixed(2)}%`} detalhe="Sobre faturamento real" />
        <Card titulo="Sem Custo" valor={String(totais.semCusto)} detalhe="Recebidos sem valor de compra" alerta />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        <Card titulo="Processos com custo" valor={String(totais.comCusto)} detalhe="Entram no Profit HC Real" destaque />
        <Card titulo="Total de processos" valor={String(totais.processos)} detalhe="Recebidos no filtro selecionado" />
      </section>

      {totais.semCusto > 0 && (
        <section className="border border-yellow-500 bg-yellow-500/10 rounded-3xl p-5 mb-8">
          <p className="text-yellow-300 font-bold">
            ⚠ Existem {totais.semCusto} processos recebidos sem valor de compra. Eles não entram no Profit HC Real nem nos rankings.
          </p>
        </section>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <Ranking titulo="Top clientes por Profit HC Real" dados={rankingClientes} moeda={moeda} />
        <Ranking titulo="Top transportadoras por Profit HC Real" dados={rankingTransportadoras} moeda={moeda} />
        <Ranking titulo="Top despachantes por Profit HC Real" dados={rankingDespachantes} moeda={moeda} />
        <Ranking titulo="Top serviços por Profit HC Real" dados={rankingServicos} moeda={moeda} />
      </section>

      <section className="border border-blue-900 rounded-3xl bg-[#071225] p-7 mb-8">
        <h2 className="text-2xl font-black mb-5">Resultado real por mês de recebimento</h2>

        <div className="overflow-x-auto">
          <table className="table min-w-[900px]">
            <thead>
              <tr>
                <th>Mês</th>
                <th>Processos com custo</th>
                <th>Faturamento Real</th>
                <th>Custos Reais</th>
                <th>Profit HC Real</th>
                <th>Margem Real</th>
              </tr>
            </thead>
            <tbody>
              {porMes.map((item: any) => {
                const margem = item.faturamento > 0 ? (item.profit / item.faturamento) * 100 : 0

                return (
                  <tr key={item.mes}>
                    <td className="font-bold text-blue-300">{item.mes}</td>
                    <td>{item.processos}</td>
                    <td>{moeda(item.faturamento)}</td>
                    <td>{moeda(item.custos)}</td>
                    <td className={item.profit >= 0 ? 'text-green-400 font-black' : 'text-red-400 font-black'}>
                      {moeda(item.profit)}
                    </td>
                    <td>{margem.toFixed(2)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {porMes.length === 0 && (
            <p className="text-slate-400 text-center py-8">Nenhum processo recebido com custo informado.</p>
          )}
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
                const margem = temCustoReal(item) && faturamento > 0 ? (totalProfit / faturamento) * 100 : 0

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
                    <td>{item.recebimento || '-'}</td>
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
        destaque
          ? 'border-green-500'
          : alerta
          ? 'border-yellow-500'
          : 'border-blue-900'
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