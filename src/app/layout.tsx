import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'HC Connect',
  description: 'Portal de acompanhamento de embarques da HC Consultoria',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
