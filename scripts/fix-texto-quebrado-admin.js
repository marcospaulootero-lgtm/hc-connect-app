const fs = require('fs')
const path = require('path')

const targets = [
  'src/app/admin/page.tsx',
  'src/app/admin/financeiro/page.tsx',
  'src/app/admin/embarques/page.tsx',
  'src/app/admin/faturas-transportadoras/page.tsx',
  'src/app/admin/usuarios/page.tsx',
  'src/app/admin/resultado-financeiro/page.tsx'
]

const replacements = [
  ['\\u00c3\\u00a1', '\\u00e1'],
  ['\\u00c3\\u00a0', '\\u00e0'],
  ['\\u00c3\\u00a2', '\\u00e2'],
  ['\\u00c3\\u00a3', '\\u00e3'],
  ['\\u00c3\\u00a9', '\\u00e9'],
  ['\\u00c3\\u00aa', '\\u00ea'],
  ['\\u00c3\\u00ad', '\\u00ed'],
  ['\\u00c3\\u00b3', '\\u00f3'],
  ['\\u00c3\\u00b4', '\\u00f4'],
  ['\\u00c3\\u00b5', '\\u00f5'],
  ['\\u00c3\\u00ba', '\\u00fa'],
  ['\\u00c3\\u00a7', '\\u00e7'],

  ['\\u00c3\\u0081', '\\u00c1'],
  ['\\u00c3\\u0080', '\\u00c0'],
  ['\\u00c3\\u0082', '\\u00c2'],
  ['\\u00c3\\u0083', '\\u00c3'],
  ['\\u00c3\\u0089', '\\u00c9'],
  ['\\u00c3\\u008a', '\\u00ca'],
  ['\\u00c3\\u008d', '\\u00cd'],
  ['\\u00c3\\u0093', '\\u00d3'],
  ['\\u00c3\\u0094', '\\u00d4'],
  ['\\u00c3\\u0095', '\\u00d5'],
  ['\\u00c3\\u009a', '\\u00da'],
  ['\\u00c3\\u0087', '\\u00c7'],

  ['\\u00c2\\u00ba', '\\u00ba'],
  ['\\u00c2\\u00aa', '\\u00aa'],
  ['\\u00c2\\u00b0', '\\u00b0'],
  ['\\u00c2\\u00b7', '\\u00b7'],
  ['\\u00c2', ''],

  ['\\u00e2\\u20ac\\u0153', '\\u201c'],
  ['\\u00e2\\u20ac\\u009c', '\\u201c'],
  ['\\u00e2\\u20ac\\u009d', '\\u201d'],
  ['\\u00e2\\u20ac\\u02dc', '\\u2018'],
  ['\\u00e2\\u20ac\\u2122', '\\u2019'],
  ['\\u00e2\\u20ac\\u0098', '\\u2018'],
  ['\\u00e2\\u20ac\\u0099', '\\u2019'],
  ['\\u00e2\\u20ac\\u0093', '\\u2013'],
  ['\\u00e2\\u20ac\\u0094', '\\u2014'],
  ['\\u00e2\\u20ac\\u00a6', '\\u2026'],
  ['\\u00e2\\u20ac\\u00a2', '\\u2022'],
  ['\\u00e2\\u2020\\u2019', '\\u2192'],

  ['\\u00e2\\u0153\\u2026', '\\u2705'],
  ['\\u00e2\\u0161\\u00a0', '\\u26a0'],
  ['\\u00e2\\u008f\\u00b3', '\\u23f3'],

  ['\\u00f0\\u0178\\u2019\\u00b0', ''],
  ['\\u00f0\\u0178\\u0092\\u00b0', ''],
  ['\\u00f0\\u0178\\u201a\\u00b0', ''],
  ['\\u00f0\\u0178\\u0161\\u00a8', ''],
  ['\\u00f0\\u0178\\u0161\\u161', ''],
  ['\\u00f0\\u0178\\u201c\\u0160', ''],
  ['\\u00f0\\u0178\\u201c\\u02c6', ''],
  ['\\u00f0\\u0178\\u008f\\u00a6', ''],
  ['\\u00f0\\u0178\\u00a7\\u00be', ''],
  ['\\u00f0\\u0178\\u201c\\u201e', ''],
  ['\\u00f0\\u0178\\u201c\\u00a6', ''],
  ['\\u00f0\\u0178\\u2018\\u00a5', ''],
  ['\\u00f0\\u0178\\u008f\\u00a2', '']
]

function decodeUnicodeEscapes(str) {
  return str.replace(/\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})/g, (_, braced, fixed) => {
    const code = parseInt(braced || fixed, 16)
    return String.fromCodePoint(code)
  })
}

const decodedReplacements = replacements.map(([from, to]) => [
  decodeUnicodeEscapes(from),
  decodeUnicodeEscapes(to)
])

function timestamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function fixText(input) {
  let output = input

  for (const [from, to] of decodedReplacements) {
    output = output.split(from).join(to)
  }

  output = output.replace(/\u00f0[\u0080-\uffff]{1,4}/g, '')
  output = output.replace(/\u00e2[\u2020-\u2022\u2026\u2030-\u206f\u20ac-\u20ff][\u0080-\uffff]?/g, '')
  output = output.replace(/\u00e2[\u0080-\u009f][\u0080-\u00bf]?/g, '')
  output = output.replace(/\u00c2(?=[\u0080-\u00bf])/g, '')

  return output
}

const root = process.cwd()
const backupDir = path.join(root, 'backups', `encoding-admin-${timestamp()}`)
const changed = []
const missing = []

fs.mkdirSync(backupDir, { recursive: true })

for (const relative of targets) {
  const file = path.join(root, relative)

  if (!fs.existsSync(file)) {
    missing.push(relative)
    continue
  }

  const original = fs.readFileSync(file, 'utf8')
  const fixed = fixText(original)

  if (fixed !== original) {
    const backupFile = path.join(backupDir, relative)
    fs.mkdirSync(path.dirname(backupFile), { recursive: true })
    fs.writeFileSync(backupFile, original, 'utf8')
    fs.writeFileSync(file, fixed, 'utf8')
    changed.push(relative)
  }
}

console.log('')
console.log('=== HC CONNECT | CORRECAO DE TEXTOS QUEBRADOS ===')
console.log('')
console.log('Backup criado em:')
console.log('- ' + path.relative(root, backupDir))

console.log('')
console.log('Arquivos alterados:')
if (changed.length === 0) {
  console.log('- Nenhum arquivo precisou ser alterado.')
} else {
  for (const file of changed) console.log('- ' + file)
}

if (missing.length > 0) {
  console.log('')
  console.log('Arquivos nao encontrados:')
  for (const file of missing) console.log('- ' + file)
}

console.log('')
console.log('Concluido.')
