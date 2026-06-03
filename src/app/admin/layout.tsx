'use client'

import Link from 'next/link'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background:
          'linear-gradient(135deg, #020617 0%, #00113a 45%, #000814 100%)',
        color: 'white',
      }}
    >
      <aside
        style={{
          width: 260,
          padding: 20,
          borderRight: '1px solid #1e3a8a',
          background: 'rgba(0,0,0,0.25)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              background: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: 22,
            }}
          >
            HC
          </div>

          <div>
            <h1
              style={{
                fontSize: 18,
                fontWeight: 'bold',
              }}
            >
              HC Connect
            </h1>

            <p
              style={{
                color: '#94a3b8',
                fontSize: 13,
              }}
            >
              Portal de embarques
            </p>
          </div>
        </div>

        <nav className="flex flex-col gap-3 mt-10">

          <Link
            href="/admin"
            className="px-4 py-3 rounded-xl text-slate-300 hover:bg-blue-600 hover:text-white transition font-medium"
          >
            Dashboard
          </Link>

          <Link
            href="/admin/clientes"
            className="px-4 py-3 rounded-xl text-slate-300 hover:bg-blue-600 hover:text-white transition font-medium"
          >
            Clientes
          </Link>

          <Link
            href="/admin/embarques"
            className="px-4 py-3 rounded-xl text-slate-300 hover:bg-blue-600 hover:text-white transition font-medium"
          >
            Embarques
          </Link>

          <Link
            href="/admin/faturas"
            className="px-4 py-3 rounded-xl text-slate-300 hover:bg-blue-600 hover:text-white transition font-medium"
          >
            Faturas
          </Link>

          <Link
            href="/admin/suporte"
            className="px-4 py-3 rounded-xl text-slate-300 hover:bg-blue-600 hover:text-white transition font-medium"
          >
            Suporte
          </Link>

        </nav>
      </aside>

      <main
        style={{
          flex: 1,
          padding: 30,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            marginBottom: 30,
            gap: 18,
          }}
        >
          <span>Área HC</span>

          <button
            style={{
              background: '#2563eb',
              border: 'none',
              color: 'white',
              padding: '12px 20px',
              borderRadius: 12,
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Sair
          </button>
        </div>

        {children}
      </main>
    </div>
  )
}