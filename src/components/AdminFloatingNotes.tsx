'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'hc_admin_notes_v1'
const STORAGE_OPEN_KEY = 'hc_admin_notes_open_v1'

export default function AdminFloatingNotes() {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    const savedNote = localStorage.getItem(STORAGE_KEY) || ''
    const savedOpen = localStorage.getItem(STORAGE_OPEN_KEY) === 'true'

    setNote(savedNote)
    setOpen(savedOpen)
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, note)
  }, [note])

  useEffect(() => {
    localStorage.setItem(STORAGE_OPEN_KEY, String(open))
  }, [open])

  function clearNote() {
    const ok = window.confirm('Deseja limpar todas as anotações?')
    if (!ok) return
    setNote('')
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[9999] rounded-full bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-2xl hover:bg-blue-700"
      >
        📝 Anotações
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-[360px] rounded-2xl border border-blue-500/50 bg-slate-950 text-white shadow-2xl">
      <div className="flex items-center justify-between rounded-t-2xl border-b border-blue-500/30 bg-blue-600 px-4 py-3">
        <div>
          <p className="text-sm font-black">📝 Anotações rápidas</p>
          <p className="text-[11px] font-semibold text-blue-100">
            Salva automático neste navegador
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg bg-white/15 px-3 py-1 text-sm font-black hover:bg-white/25"
        >
          ×
        </button>
      </div>

      <div className="space-y-3 p-4">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anote aqui pendências, clientes, faturas, retornos, lembretes..."
          className="h-72 w-full resize-none rounded-xl border border-blue-500/40 bg-slate-900 p-3 text-sm font-semibold text-white outline-none placeholder:text-slate-500 focus:border-blue-400"
        />

        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400">
            {note.length} caracteres
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={clearNote}
              className="rounded-xl border border-red-500/40 px-3 py-2 text-xs font-black text-red-300 hover:bg-red-500/10"
            >
              Limpar
            </button>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-700"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
