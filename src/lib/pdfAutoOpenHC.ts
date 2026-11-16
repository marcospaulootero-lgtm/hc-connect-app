/* HC_PDF_AUTOABRIR_V1: abrir em aba reservada antes de qualquer await, evitando bloqueios de pop-up. */
export function reservarAbaPdfHC(): Window | null {
  const aba = window.open('', '_blank')
  if (!aba) return null
  try {
    aba.opener = null
    aba.document.title = 'Preparando PDF | HC Connect'
    aba.document.body.style.cssText = 'font-family:Arial,sans-serif;padding:32px;background:#071225;color:#fff'
    aba.document.body.textContent = 'HC Connect: preparando seu PDF...'
  } catch (_) { /* A aba ainda podera navegar normalmente. */ }
  return aba
}

export function mostrarPdfNaAbaHC(aba: Window | null, url: string): boolean {
  if (!aba || !url) return false
  try {
    if (aba.closed) return false
    aba.location.replace(url)
    aba.focus()
    return true
  } catch (erro) {
    console.warn('HC Connect: falha ao abrir o PDF na nova aba:', erro)
    return false
  }
}

export function fecharAbaPdfHC(aba: Window | null): void {
  try { if (aba && !aba.closed) aba.close() } catch (_) {}
}
