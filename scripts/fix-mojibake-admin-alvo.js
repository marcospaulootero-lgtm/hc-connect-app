const fs = require('fs')
const path = require('path')

const targets = [
  'src/app/admin/page.tsx',
  'src/app/admin/financeiro/page.tsx',
  'src/app/admin/embarques/page.tsx',
  'src/app/admin/faturas-transportadoras/page.tsx',
  'src/app/admin/usuarios/page.tsx',
  'src/app/admin/resultado-financeiro/page.tsx',
  'src/app/admin/clientes-faturamento/page.tsx'
]

const cp1252Special = new Map([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f]
])

function cp1252Bytes(str) {
  const bytes = []

  for (const ch of str) {
    const code = ch.codePointAt(0)

    if (cp1252Special.has(code)) {
      bytes.push(cp1252Special.get(code))
    } else if (code <= 0xff) {
      bytes.push(code)
    } else {
      return null
    }
  }

  return Buffer.from(bytes)
}

function decodeMojibakeSegment(segment) {
  const bytes = cp1252Bytes(segment)
  if (!bytes) return null

  const decoded = bytes.toString('utf8')
  if (!decoded || decoded.includes('\ufffd')) return null
  if (decoded === segment) return null

  return decoded
}

function isStart(ch) {
  return ch === '\u00c3' || ch === '\u00c2' || ch === '\u00e2' || ch === '\u00f0'
}

function repairOnce(text) {
  let out = ''

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (!isStart(ch)) {
      out += ch
      continue
    }

    let repaired = null
    let used = 0

    for (const len of [4, 3, 2]) {
      if (i + len > text.length) continue

      const segment = text.slice(i, i + len)
      const decoded = decodeMojibakeSegment(segment)

      if (decoded) {
        repaired = decoded
        used = len
        break
      }
    }

    if (repaired) {
      out += repaired
      i += used - 1
    } else {
      out += ch
    }
  }

  return out
}

function repairText(text) {
  let current = text

  for (let pass = 0; pass < 3; pass++) {
    const next = repairOnce(current)
    if (next === current) break
    current = next
  }

  return current
}

function timestamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

const root = process.cwd()
const backupDir = path.join(root, 'backups', `mojibake-admin-${timestamp()}`)
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
  const fixed = repairText(original)

  if (fixed !== original) {
    const backupFile = path.join(backupDir, relative)

    fs.mkdirSync(path.dirname(backupFile), { recursive: true })
    fs.writeFileSync(backupFile, original, 'utf8')
    fs.writeFileSync(file, fixed, 'utf8')

    changed.push(relative)
  }
}

console.log('')
console.log('=== HC CONNECT | FIX PROFISSIONAL DE ACENTUACAO E EMOJIS QUEBRADOS ===')
console.log('')
console.log('Backup local criado em:')
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
console.log('OK: correcao aplicada nos arquivos-alvo.')
