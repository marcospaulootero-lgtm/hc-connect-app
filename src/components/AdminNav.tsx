'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'

export default function AdminNav() {
  const pathname = usePathname()

  const menus = [
  {
    nome: 'Dashboard',
    link: '/admin'
  },
  {
    nome: 'Clientes',
    link: '/admin/clientes'
  },
  {
    nome: 'Embarques',
    link: '/admin/embarques'
  },
  {
    nome: 'Cotações',
    link: '/admin/cotacoes'
  },
  {
    nome: 'Faturas',
    link: '/admin/faturas'
  },
  {
    nome: 'Suporte',
    link: '/admin/suporte'
  }
]

  return (
    <aside className="w-[260px] min-h-screen bg-[#020817] border-r border-blue-900 flex flex-col justify-between">

      <div>

        <div className="p-6 border-b border-blue-900">

          <div className="flex flex-col items-center text-center">

            <Image
              src="/HC-CONSULTORIA.png"
              alt="HC Consultoria"
              width={160}
              height={160}
              className="object-contain mb-4"
              priority
            />

            <h1 className="text-white text-2xl font-black">
              HC Connect
            </h1>

            <p className="text-slate-400 text-sm mt-1">
              Portal de embarques
            </p>

          </div>

        </div>

        <nav className="p-4 flex flex-col gap-2">

  {menus.map((item) => {

    const ativo =
      item.link === '/admin'
        ? pathname === '/admin'
        : pathname.startsWith(item.link)

    return (
      <Link
        key={item.link}
        href={item.link}
        className={`
          px-5 py-4 rounded-2xl transition font-medium
          ${
            ativo
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
              : 'text-slate-300 hover:bg-[#08142c]'
          }
        `}
      >
        {item.nome}
      </Link>
    )
  })}

</nav>

      </div>

      <div className="p-5 border-t border-blue-900">

        <div className="flex items-center gap-3">

          <div className="w-12 h-12 rounded-full bg-black border border-slate-700 flex items-center justify-center text-white font-bold">
            M
          </div>

          <div>
            <p className="text-white font-semibold">
              Marcos Paulo
            </p>

            <p className="text-slate-400 text-sm">
              HC Consultoria
            </p>
          </div>

        </div>

      </div>

    </aside>
  )
}