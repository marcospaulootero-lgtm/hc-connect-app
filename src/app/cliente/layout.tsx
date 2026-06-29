import type { ReactNode } from 'react'

export default function ClienteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}

      <div className="w-full border-t border-blue-900/50 bg-[#020817] px-6 py-4 text-center text-xs text-slate-500">
        Portal desenvolvido por{' '}
        <span className="font-bold text-slate-300">Marcos Paulo Otero</span>
        {' '}• HC Connect
      </div>
    </>
  )
}
