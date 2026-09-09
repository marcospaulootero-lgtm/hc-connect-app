'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

type Shift = null | 'f' | 'g'

type Stack = {
  x: number
  y: number
  z: number
  t: number
}

type FinanceRegs = {
  n: number
  i: number
  pv: number
  pmt: number
  fv: number
}

type KeyProps = {
  main: string
  top?: string
  bottom?: string
  orange?: boolean
  blue?: boolean
  tall?: boolean
  onClick: () => void
}

const ZERO_STACK: Stack = {
  x: 0,
  y: 0,
  z: 0,
  t: 0,
}

const ZERO_FINANCE: FinanceRegs = {
  n: 0,
  i: 0,
  pv: 0,
  pmt: 0,
  fv: 0,
}

function formatarDisplay(valor: number) {
  if (!Number.isFinite(valor)) return 'Error'

  const absoluto = Math.abs(valor)

  if (
    absoluto !== 0 &&
    (
      absoluto >= 1e10 ||
      absoluto < 1e-7
    )
  ) {
    return valor
      .toExponential(6)
      .replace('.', ',')
  }

  return valor.toLocaleString(
    'pt-BR',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
      useGrouping: false,
    }
  )
}

function Key({
  main,
  top,
  bottom,
  orange,
  blue,
  tall,
  onClick,
}: KeyProps) {
  return (
    <div
      className={
        tall
          ? 'row-span-2 flex min-h-[104px] flex-col'
          : 'flex min-h-[51px] flex-col'
      }
    >
      <div className="h-[13px] text-center text-[8px] font-black leading-[10px] text-[#e79c35]">
        {top || ''}
      </div>

      <button
        type="button"
        onClick={onClick}
        className={[
          'relative flex flex-1 items-center justify-center rounded-[5px]',
          'border border-black bg-gradient-to-b from-[#4b4b4b] to-[#252525]',
          'px-1 text-[15px] font-black text-white shadow-[inset_0_0_0_1px_#777,0_2px_1px_rgba(0,0,0,.8)]',
          'active:translate-y-[1px] active:shadow-none',
          orange
            ? '!border-[#8a4500] !bg-none !bg-[#f18b32] !text-black'
            : '',
          blue
            ? '!border-[#00647d] !bg-none !bg-[#11a6cf] !text-black'
            : '',
        ].join(' ')}
      >
        {main}
      </button>

      {!tall ? (
        <div className="h-[12px] text-center text-[7px] font-black leading-[10px] text-[#23a5d1]">
          {bottom || ''}
        </div>
      ) : null}
    </div>
  )
}

export default function CalculadoraFinanceira() {
  const [aberta, setAberta] = useState(false)
  const [ligada, setLigada] = useState(true)

  const [stack, setStack] =
    useState<Stack>(ZERO_STACK)

  const [finance, setFinance] =
    useState<FinanceRegs>(ZERO_FINANCE)

  const [display, setDisplay] =
    useState('0')

  const [digitando, setDigitando] =
    useState(false)

  const [shift, setShift] =
    useState<Shift>(null)

  const [memoria, setMemoria] =
    useState(0)

  const [stats, setStats] =
    useState({
      n: 0,
      soma: 0,
      soma2: 0,
    })

  const [mensagem, setMensagem] =
    useState('')

  const timerMensagem =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    )

  const x = useMemo(
    () => stack.x,
    [stack.x]
  )

  function avisar(texto: string) {
    setMensagem(texto)

    if (timerMensagem.current) {
      clearTimeout(
        timerMensagem.current
      )
    }

    timerMensagem.current =
      setTimeout(() => {
        setMensagem('')
      }, 1800)
  }

  function atualizarX(valor: number) {
    setStack((atual) => ({
      ...atual,
      x: valor,
    }))

    setDisplay(
      formatarDisplay(valor)
    )

    setDigitando(false)
  }

  function valorDigitado() {
    const normalizado =
      display
        .replace(/\./g, '')
        .replace(',', '.')

    const valor =
      Number(normalizado)

    return Number.isFinite(valor)
      ? valor
      : 0
  }

  function confirmarEntrada() {
    if (!digitando) {
      return stack.x
    }

    const valor =
      valorDigitado()

    setStack((atual) => ({
      ...atual,
      x: valor,
    }))

    setDigitando(false)

    return valor
  }

  function digito(valor: string) {
    if (!ligada) return

    setShift(null)

    setDisplay((atual) => {
      if (!digitando) {
        setDigitando(true)

        if (valor === ',') {
          return '0,'
        }

        return valor
      }

      if (
        valor === ',' &&
        atual.includes(',')
      ) {
        return atual
      }

      if (
        atual.replace('-', '').length >=
        14
      ) {
        return atual
      }

      return atual + valor
    })
  }

  function enter() {
    if (!ligada) return

    const valor =
      confirmarEntrada()

    setStack((atual) => ({
      x: valor,
      y: valor,
      z: atual.y,
      t: atual.z,
    }))

    setDisplay(
      formatarDisplay(valor)
    )

    setDigitando(false)
    setShift(null)
  }

  function binaria(
    operacao: (
      y: number,
      x: number
    ) => number
  ) {
    if (!ligada) return

    confirmarEntrada()

    setStack((atual) => {
      const resultado =
        operacao(
          atual.y,
          atual.x
        )

      if (
        !Number.isFinite(resultado)
      ) {
        avisar('Erro matemático')

        return atual
      }

      const novo = {
        x: resultado,
        y: atual.z,
        z: atual.t,
        t: atual.t,
      }

      setDisplay(
        formatarDisplay(resultado)
      )

      return novo
    })

    setDigitando(false)
    setShift(null)
  }

  function unaria(
    operacao: (
      x: number
    ) => number
  ) {
    if (!ligada) return

    confirmarEntrada()

    setStack((atual) => {
      const resultado =
        operacao(atual.x)

      if (
        !Number.isFinite(resultado)
      ) {
        avisar('Erro matemático')
        return atual
      }

      setDisplay(
        formatarDisplay(resultado)
      )

      return {
        ...atual,
        x: resultado,
      }
    })

    setDigitando(false)
    setShift(null)
  }

  function chs() {
    if (!ligada) return

    if (digitando) {
      setDisplay((atual) =>
        atual.startsWith('-')
          ? atual.slice(1)
          : '-' + atual
      )
      return
    }

    atualizarX(-stack.x)
  }

  function clx() {
    if (!ligada) return

    setStack((atual) => ({
      ...atual,
      x: 0,
    }))

    setDisplay('0')
    setDigitando(false)
    setShift(null)
  }

  function trocarXY() {
    if (!ligada) return

    confirmarEntrada()

    setStack((atual) => {
      const novo = {
        ...atual,
        x: atual.y,
        y: atual.x,
      }

      setDisplay(
        formatarDisplay(
          novo.x
        )
      )

      return novo
    })

    setShift(null)
  }

  function rollDown() {
    if (!ligada) return

    confirmarEntrada()

    setStack((atual) => {
      const novo = {
        x: atual.y,
        y: atual.z,
        z: atual.t,
        t: atual.x,
      }

      setDisplay(
        formatarDisplay(
          novo.x
        )
      )

      return novo
    })

    setShift(null)
  }

  function percent() {
    if (!ligada) return

    confirmarEntrada()

    setStack((atual) => {
      const resultado =
        atual.y *
        atual.x /
        100

      const novo = {
        ...atual,
        x: resultado,
      }

      setDisplay(
        formatarDisplay(
          resultado
        )
      )

      return novo
    })

    setShift(null)
  }

  function deltaPercent() {
    if (!ligada) return

    confirmarEntrada()

    setStack((atual) => {
      if (atual.y === 0) {
        avisar(
          'Base zero'
        )
        return atual
      }

      const resultado =
        (
          (
            atual.x -
            atual.y
          ) /
          atual.y
        ) *
        100

      setDisplay(
        formatarDisplay(
          resultado
        )
      )

      return {
        ...atual,
        x: resultado,
      }
    })

    setShift(null)
  }

  function taxa() {
    return finance.i / 100
  }

  function fatorPagamento(
    r: number,
    n: number
  ) {
    if (
      Math.abs(r) <
      1e-12
    ) {
      return n
    }

    return (
      1 -
      Math.pow(
        1 + r,
        -n
      )
    ) / r
  }

  function calcularFinanceiro(
    campo:
      | 'n'
      | 'i'
      | 'pv'
      | 'pmt'
      | 'fv'
  ) {
    if (!ligada) return

    const valor =
      confirmarEntrada()

    /*
      Se acabou de digitar um número,
      a tecla financeira grava o registro.
      Se não estava digitando, calcula o campo.
    */
    if (digitando) {
      setFinance((atual) => ({
        ...atual,
        [campo]: valor,
      }))

      avisar(
        campo.toUpperCase() +
        ' armazenado'
      )

      setDigitando(false)
      setShift(null)
      return
    }

    const r = taxa()
    const n = finance.n
    const pv = finance.pv
    const pmt = finance.pmt
    const fv = finance.fv

    let resultado = 0

    if (campo === 'fv') {
      if (n === 0) {
        resultado = -pv
      } else if (
        Math.abs(r) <
        1e-12
      ) {
        resultado =
          -(
            pv +
            pmt * n
          )
      } else {
        const fator =
          Math.pow(
            1 + r,
            n
          )

        resultado =
          -(
            pv * fator +
            pmt *
              (
                fator - 1
              ) /
              r
          )
      }
    }

    if (campo === 'pv') {
      if (
        Math.abs(r) <
        1e-12
      ) {
        resultado =
          -(
            pmt * n +
            fv
          )
      } else {
        resultado =
          -(
            pmt *
              fatorPagamento(
                r,
                n
              ) +
            fv *
              Math.pow(
                1 + r,
                -n
              )
          )
      }
    }

    if (campo === 'pmt') {
      if (n === 0) {
        avisar(
          'Informe n'
        )
        return
      }

      if (
        Math.abs(r) <
        1e-12
      ) {
        resultado =
          -(
            pv + fv
          ) / n
      } else {
        const fator =
          fatorPagamento(
            r,
            n
          )

        if (
          Math.abs(fator) <
          1e-12
        ) {
          avisar(
            'Não foi possível calcular'
          )
          return
        }

        resultado =
          -(
            pv +
            fv *
              Math.pow(
                1 + r,
                -n
              )
          ) / fator
      }
    }

    if (campo === 'n') {
      const funcao = (
        quantidade: number
      ) => {
        if (
          Math.abs(r) <
          1e-12
        ) {
          return (
            pv +
            pmt *
              quantidade +
            fv
          )
        }

        return (
          pv +
          pmt *
            fatorPagamento(
              r,
              quantidade
            ) +
          fv *
            Math.pow(
              1 + r,
              -quantidade
            )
        )
      }

      let baixo = 0
      let alto = 100000
      let fBaixo =
        funcao(baixo)
      let fAlto =
        funcao(alto)

      if (
        fBaixo === 0
      ) {
        resultado = baixo
      } else if (
        fAlto === 0
      ) {
        resultado = alto
      } else if (
        fBaixo *
          fAlto >
        0
      ) {
        avisar(
          'Sem solução para n'
        )
        return
      } else {
        for (
          let k = 0;
          k < 120;
          k++
        ) {
          const meio =
            (
              baixo +
              alto
            ) / 2

          const fMeio =
            funcao(meio)

          if (
            fBaixo *
              fMeio <=
            0
          ) {
            alto = meio
            fAlto = fMeio
          } else {
            baixo = meio
            fBaixo = fMeio
          }
        }

        resultado =
          (
            baixo +
            alto
          ) / 2
      }
    }

    if (campo === 'i') {
      const funcao = (
        taxaDecimal: number
      ) => {
        if (
          taxaDecimal <= -1
        ) {
          return NaN
        }

        return (
          pv +
          pmt *
            fatorPagamento(
              taxaDecimal,
              n
            ) +
          fv *
            Math.pow(
              1 +
                taxaDecimal,
              -n
            )
        )
      }

      let baixo = -0.999999
      let alto = 10
      let fBaixo =
        funcao(baixo)
      let fAlto =
        funcao(alto)

      if (
        !Number.isFinite(
          fBaixo
        ) ||
        !Number.isFinite(
          fAlto
        ) ||
        fBaixo *
          fAlto >
          0
      ) {
        avisar(
          'Sem solução para i'
        )
        return
      }

      for (
        let k = 0;
        k < 160;
        k++
      ) {
        const meio =
          (
            baixo +
            alto
          ) / 2

        const fMeio =
          funcao(meio)

        if (
          fBaixo *
            fMeio <=
          0
        ) {
          alto = meio
          fAlto = fMeio
        } else {
          baixo = meio
          fBaixo = fMeio
        }
      }

      resultado =
        (
          (
            baixo +
            alto
          ) /
          2
        ) *
        100
    }

    if (
      !Number.isFinite(
        resultado
      )
    ) {
      avisar(
        'Erro financeiro'
      )
      return
    }

    setFinance((atual) => ({
      ...atual,
      [campo]: resultado,
    }))

    atualizarX(resultado)

    avisar(
      campo.toUpperCase() +
      ' calculado'
    )

    setShift(null)
  }

  function financeiro(
    campo:
      | 'n'
      | 'i'
      | 'pv'
      | 'pmt'
      | 'fv'
  ) {
    calcularFinanceiro(
      campo
    )
  }

  function executarShift(
    normal: () => void,
    f?: () => void,
    g?: () => void
  ) {
    if (shift === 'f') {
      setShift(null)
      ;(f || normal)()
      return
    }

    if (shift === 'g') {
      setShift(null)
      ;(g || normal)()
      return
    }

    normal()
  }

  function armazenar() {
    const valor =
      confirmarEntrada()

    setMemoria(valor)
    avisar('STO')
    setShift(null)
  }

  function recuperar() {
    atualizarX(memoria)
    avisar('RCL')
    setShift(null)
  }

  function sigmaMais() {
    const valor =
      confirmarEntrada()

    setStats((atual) => ({
      n: atual.n + 1,
      soma:
        atual.soma +
        valor,
      soma2:
        atual.soma2 +
        valor * valor,
    }))

    setStack((atual) => ({
      ...atual,
      x: atual.x + 1,
    }))

    setDisplay(
      String(
        stats.n + 1
      )
    )

    setShift(null)
  }

  function limparTudo() {
    setStack(ZERO_STACK)
    setFinance(ZERO_FINANCE)
    setDisplay('0')
    setDigitando(false)
    setShift(null)
    setMemoria(0)
    setStats({
      n: 0,
      soma: 0,
      soma2: 0,
    })
    avisar('Memória limpa')
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(
        formatarDisplay(
          stack.x
        )
      )

      avisar(
        'Resultado copiado'
      )
    } catch {
      avisar(
        'Não foi possível copiar'
      )
    }
  }

  useEffect(() => {
    function teclado(
      event: KeyboardEvent
    ) {
      if (!aberta) return

      const alvo =
        event.target as HTMLElement | null

      const tag =
        alvo?.tagName?.toUpperCase()

      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT'
      ) {
        return
      }

      if (
        /^[0-9]$/.test(
          event.key
        )
      ) {
        digito(
          event.key
        )
        return
      }

      if (
        event.key === '.' ||
        event.key === ','
      ) {
        digito(',')
        return
      }

      if (
        event.key === 'Enter'
      ) {
        event.preventDefault()
        enter()
        return
      }

      if (
        event.key === '+'
      ) {
        binaria(
          (a, b) =>
            a + b
        )
        return
      }

      if (
        event.key === '-'
      ) {
        binaria(
          (a, b) =>
            a - b
        )
        return
      }

      if (
        event.key === '*'
      ) {
        binaria(
          (a, b) =>
            a * b
        )
        return
      }

      if (
        event.key === '/'
      ) {
        event.preventDefault()

        binaria(
          (a, b) =>
            a / b
        )
        return
      }

      if (
        event.key ===
        'Escape'
      ) {
        setAberta(false)
      }
    }

    window.addEventListener(
      'keydown',
      teclado
    )

    return () => {
      window.removeEventListener(
        'keydown',
        teclado
      )
    }
  }, [
    aberta,
    display,
    digitando,
    stack,
    finance,
    shift,
    memoria,
    stats,
  ])

  return (
    <>
      <button
        type="button"
        onClick={() =>
          setAberta(
            (valor) => !valor
          )
        }
        className="fixed bottom-5 right-[132px] z-[84] rounded-xl border border-amber-300/40 bg-[#2b2b2b] px-4 py-3 text-sm font-black text-amber-200 shadow-2xl hover:bg-[#3a3a3a]"
        title="Calculadora financeira HP 12C"
      >
        🧮 HP 12C
      </button>

      {aberta ? (
        <div className="fixed bottom-20 right-5 z-[85] w-[min(590px,calc(100vw-24px))] overflow-hidden rounded-[12px] border-4 border-[#343434] bg-[#bcb39c] shadow-[0_25px_90px_rgba(0,0,0,.65)]">
          <div className="flex items-center justify-between bg-[#3b3935] px-3 py-2 text-white">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-amber-300">
                HC Finance
              </p>
              <p className="text-xs font-black">
                Calculadora financeira · RPN
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copiar}
                className="rounded bg-white/10 px-2 py-1 text-[10px] font-black hover:bg-white/20"
              >
                Copiar
              </button>

              <button
                type="button"
                onClick={() =>
                  setAberta(false)
                }
                className="rounded bg-white/10 px-2 py-1 text-xs font-black hover:bg-white/20"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="border-b-4 border-[#5a5448] bg-[#d5ccb2] p-4">
            <div className="rounded-[7px] border-[5px] border-[#a28c5d] bg-[#aeb19b] px-4 py-3 shadow-inner">
              <div className="flex min-h-[55px] items-center justify-end overflow-hidden font-mono text-[32px] font-black tracking-[.06em] text-black">
                {ligada
                  ? display
                  : ''}
              </div>
            </div>

            <div className="mt-2 flex min-h-[18px] items-center justify-between text-[9px] font-black">
              <div className="flex gap-3">
                <span className="text-orange-700">
                  {shift === 'f'
                    ? 'f ATIVO'
                    : ''}
                </span>

                <span className="text-cyan-700">
                  {shift === 'g'
                    ? 'g ATIVO'
                    : ''}
                </span>
              </div>

              <div className="flex gap-3 text-[#4c493e]">
                <span>
                  n={formatarDisplay(
                    finance.n
                  )}
                </span>

                <span>
                  i={formatarDisplay(
                    finance.i
                  )}
                </span>
              </div>
            </div>

            {mensagem ? (
              <div className="mt-1 text-right text-[10px] font-black text-[#514b3e]">
                {mensagem}
              </div>
            ) : null}
          </div>

          <div className="bg-[#292827] p-3">
            <div className="grid grid-cols-10 gap-x-[6px] gap-y-[2px]">
              <Key
                main="n"
                top="AMORT"
                bottom="12×"
                onClick={() =>
                  executarShift(
                    () =>
                      financeiro('n'),
                    undefined,
                    () =>
                      atualizarX(
                        x * 12
                      )
                  )
                }
              />

              <Key
                main="i"
                top="INT"
                bottom="12÷"
                onClick={() =>
                  executarShift(
                    () =>
                      financeiro('i'),
                    undefined,
                    () =>
                      atualizarX(
                        x / 12
                      )
                  )
                }
              />

              <Key
                main="PV"
                top="NPV"
                bottom="CF₀"
                onClick={() =>
                  financeiro('pv')
                }
              />

              <Key
                main="PMT"
                top="RND"
                bottom="CFⱼ"
                onClick={() =>
                  financeiro('pmt')
                }
              />

              <Key
                main="FV"
                top="IRR"
                bottom="Nⱼ"
                onClick={() =>
                  financeiro('fv')
                }
              />

              <Key
                main="CHS"
                bottom="DATE"
                onClick={chs}
              />

              <Key
                main="7"
                bottom="BEG"
                onClick={() =>
                  digito('7')
                }
              />

              <Key
                main="8"
                bottom="END"
                onClick={() =>
                  digito('8')
                }
              />

              <Key
                main="9"
                bottom="MEM"
                onClick={() =>
                  digito('9')
                }
              />

              <Key
                main="÷"
                onClick={() =>
                  binaria(
                    (a, b) =>
                      a / b
                  )
                }
              />

              <Key
                main="yˣ"
                top="PRICE"
                bottom="√x"
                onClick={() =>
                  executarShift(
                    () =>
                      binaria(
                        (a, b) =>
                          Math.pow(
                            a,
                            b
                          )
                      ),
                    undefined,
                    () =>
                      unaria(
                        (v) =>
                          Math.sqrt(v)
                      )
                  )
                }
              />

              <Key
                main="1/x"
                top="YTM"
                bottom="eˣ"
                onClick={() =>
                  executarShift(
                    () =>
                      unaria(
                        (v) =>
                          1 / v
                      ),
                    undefined,
                    () =>
                      unaria(
                        Math.exp
                      )
                  )
                }
              />

              <Key
                main="%T"
                top="SL"
                bottom="LN"
                onClick={() =>
                  executarShift(
                    percent,
                    undefined,
                    () =>
                      unaria(
                        Math.log
                      )
                  )
                }
              />

              <Key
                main="Δ%"
                top="DEPRECIATION"
                bottom="FRAC"
                onClick={() =>
                  executarShift(
                    deltaPercent,
                    undefined,
                    () =>
                      unaria(
                        (v) =>
                          v -
                          Math.trunc(
                            v
                          )
                      )
                  )
                }
              />

              <Key
                main="%"
                top="DB"
                bottom="INTG"
                onClick={() =>
                  executarShift(
                    percent,
                    undefined,
                    () =>
                      unaria(
                        Math.trunc
                      )
                  )
                }
              />

              <Key
                main="EEX"
                top="SOYD"
                bottom="DAYS"
                onClick={() =>
                  avisar(
                    'EEX: use notação científica no visor'
                  )
                }
              />

              <Key
                main="4"
                bottom="D.MY"
                onClick={() =>
                  digito('4')
                }
              />

              <Key
                main="5"
                bottom="M.DY"
                onClick={() =>
                  digito('5')
                }
              />

              <Key
                main="6"
                bottom="x̄,w"
                onClick={() =>
                  digito('6')
                }
              />

              <Key
                main="×"
                onClick={() =>
                  binaria(
                    (a, b) =>
                      a * b
                  )
                }
              />

              <Key
                main="R/S"
                top="P/R"
                bottom="PSE"
                onClick={() =>
                  avisar(
                    'Programação não utilizada'
                  )
                }
              />

              <Key
                main="SST"
                top="Σ"
                bottom="BST"
                onClick={() =>
                  avisar(
                    'Programação não utilizada'
                  )
                }
              />

              <Key
                main="R↓"
                top="PRGM"
                bottom="GTO"
                onClick={rollDown}
              />

              <Key
                main="x↔y"
                top="CLEAR FIN"
                bottom="x≤y"
                onClick={() =>
                  executarShift(
                    trocarXY,
                    () => {
                      setFinance(
                        ZERO_FINANCE
                      )
                      avisar(
                        'FIN limpo'
                      )
                    }
                  )
                }
              />

              <Key
                main="CLx"
                top="REG"
                bottom="x=0"
                onClick={() =>
                  executarShift(
                    clx,
                    limparTudo
                  )
                }
              />

              <Key
                main="ENTER"
                top="PREFIX"
                bottom="LSTx"
                tall
                onClick={enter}
              />

              <Key
                main="1"
                bottom="x,r"
                onClick={() =>
                  digito('1')
                }
              />

              <Key
                main="2"
                bottom="ŷ,r"
                onClick={() =>
                  digito('2')
                }
              />

              <Key
                main="3"
                bottom="n!"
                onClick={() =>
                  digito('3')
                }
              />

              <Key
                main="−"
                onClick={() =>
                  binaria(
                    (a, b) =>
                      a - b
                  )
                }
              />

              <Key
                main="ON"
                onClick={() => {
                  setLigada(
                    (valor) =>
                      !valor
                  )
                  setShift(null)
                }}
              />

              <Key
                main="f"
                orange
                onClick={() =>
                  setShift(
                    shift === 'f'
                      ? null
                      : 'f'
                  )
                }
              />

              <Key
                main="g"
                blue
                onClick={() =>
                  setShift(
                    shift === 'g'
                      ? null
                      : 'g'
                  )
                }
              />

              <Key
                main="STO"
                onClick={armazenar}
              />

              <Key
                main="RCL"
                onClick={recuperar}
              />

              <div />

              <Key
                main="0"
                bottom="x̄"
                onClick={() =>
                  digito('0')
                }
              />

              <Key
                main=","
                bottom="s"
                onClick={() =>
                  digito(',')
                }
              />

              <Key
                main="Σ+"
                bottom="Σ−"
                onClick={sigmaMais}
              />

              <Key
                main="+"
                onClick={() =>
                  binaria(
                    (a, b) =>
                      a + b
                  )
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-black/40 bg-[#3b3935] px-3 py-2 text-[9px] font-bold text-slate-300">
            <span>
              RPN · ENTER antes do segundo valor
            </span>

            <span>
              Memória: {formatarDisplay(memoria)}
            </span>
          </div>
        </div>
      ) : null}
    </>
  )
}
