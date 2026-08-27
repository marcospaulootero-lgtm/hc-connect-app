export function numeroValorBR(valor: any) {
  if (valor === null || valor === undefined || valor === '') return 0
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0

  let texto = String(valor)
    .trim()
    .replace(/[^0-9,.-]/g, '')

  if (!texto || texto === '-' || texto === ',' || texto === '.') return 0

  const negativo = texto.startsWith('-')
  texto = texto.replace(/-/g, '')

  const ultimaVirgula = texto.lastIndexOf(',')
  const ultimoPonto = texto.lastIndexOf('.')
  let normalizado = texto

  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    const separadorDecimal = ultimaVirgula > ultimoPonto ? ',' : '.'
    const indice = texto.lastIndexOf(separadorDecimal)
    const inteiro = texto.slice(0, indice).replace(/[.,]/g, '') || '0'
    const decimal = texto.slice(indice + 1).replace(/[.,]/g, '')
    normalizado = decimal ? `${inteiro}.${decimal}` : inteiro
  } else if (ultimaVirgula >= 0) {
    const inteiro = texto.slice(0, ultimaVirgula).replace(/[.,]/g, '') || '0'
    const decimal = texto.slice(ultimaVirgula + 1).replace(/[.,]/g, '')
    normalizado = decimal ? `${inteiro}.${decimal}` : inteiro
  } else if (ultimoPonto >= 0) {
    const partes = texto.split('.')
    const ultimoGrupo = partes.at(-1) || ''
    const pontoEhDecimal =
      partes.length === 2
        ? ultimoGrupo.length > 0 && ultimoGrupo.length !== 3
        : ultimoGrupo.length > 0 && ultimoGrupo.length <= 2

    if (pontoEhDecimal) {
      const inteiro = partes.slice(0, -1).join('').replace(/\D/g, '') || '0'
      normalizado = `${inteiro}.${ultimoGrupo.replace(/\D/g, '')}`
    } else {
      normalizado = partes.join('')
    }
  }

  const convertido = Number(`${negativo ? '-' : ''}${normalizado}`)
  return Number.isFinite(convertido) ? convertido : 0
}

function agruparInteiro(valor: string) {
  const semZeros = valor.replace(/^0+(?=\d)/, '') || '0'
  return semZeros.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function formatarEntradaValorBR(
  valor: any,
  casasDecimais = 2,
  zeroInicialComoDecimal = true
) {
  if (valor === null || valor === undefined || valor === '') return ''

  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) return ''
    const temDecimal = !Number.isInteger(valor)
    return valor.toLocaleString('pt-BR', {
      minimumFractionDigits: temDecimal ? casasDecimais : 0,
      maximumFractionDigits: casasDecimais,
    })
  }

  let textoOriginal = String(valor).trim()
  if (!textoOriginal) return ''

  const negativo = textoOriginal.startsWith('-')
  textoOriginal = textoOriginal.replace(/-/g, '')

  const limpo = textoOriginal.replace(/[^0-9,.]/g, '')
  if (!limpo) return negativo ? '-' : ''

  const ultimaVirgula = limpo.lastIndexOf(',')
  const ultimoPonto = limpo.lastIndexOf('.')

  let inteiro = ''
  let decimal = ''
  let temDecimalExplicito = false

  if (ultimaVirgula >= 0) {
    temDecimalExplicito = true
    inteiro = limpo.slice(0, ultimaVirgula).replace(/[.,]/g, '') || '0'
    const decimalDigitado = limpo.slice(ultimaVirgula + 1).replace(/[.,]/g, '')

    if (
      zeroInicialComoDecimal &&
      casasDecimais > 0 &&
      Number(inteiro || 0) === 0 &&
      decimalDigitado.length > casasDecimais
    ) {
      const digitos = limpo.replace(/\D/g, '')
      const preenchido = digitos.padStart(casasDecimais + 1, '0')
      inteiro = preenchido.slice(0, -casasDecimais) || '0'
      decimal = preenchido.slice(-casasDecimais)
    } else {
      decimal = decimalDigitado.slice(0, casasDecimais)
    }
  } else if (ultimoPonto >= 0) {
    const partes = limpo.split('.')
    const ultimoGrupo = partes.at(-1) || ''
    const pontoEhDecimal =
      partes.length === 2
        ? ultimoGrupo.length > 0 && ultimoGrupo.length !== 3 && ultimoGrupo.length <= casasDecimais
        : ultimoGrupo.length > 0 && ultimoGrupo.length <= casasDecimais && ultimoGrupo.length !== 3

    if (pontoEhDecimal) {
      temDecimalExplicito = true
      inteiro = partes.slice(0, -1).join('').replace(/\D/g, '') || '0'
      decimal = ultimoGrupo.replace(/\D/g, '').slice(0, casasDecimais)
    } else {
      inteiro = partes.join('').replace(/\D/g, '') || '0'
    }
  } else {
    const digitos = limpo.replace(/\D/g, '')

    if (
      zeroInicialComoDecimal &&
      casasDecimais > 0 &&
      digitos.length > 1 &&
      digitos.startsWith('0')
    ) {
      const preenchido = digitos.padStart(casasDecimais + 1, '0')
      inteiro = preenchido.slice(0, -casasDecimais) || '0'
      decimal = preenchido.slice(-casasDecimais)
      temDecimalExplicito = true
    } else {
      inteiro = digitos || '0'
    }
  }

  const sinal = negativo ? '-' : ''
  const parteInteira = agruparInteiro(inteiro)

  if (!temDecimalExplicito) return `${sinal}${parteInteira}`

  return `${sinal}${parteInteira},${decimal}`
}

export function formatarEntradaTaxaBR(valor: any, casasDecimais = 4) {
  return formatarEntradaValorBR(valor, casasDecimais, false)
}

export function formatarValorBR(valor: any, casasDecimais = 2) {
  return numeroValorBR(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: casasDecimais,
    maximumFractionDigits: casasDecimais,
  })
}
