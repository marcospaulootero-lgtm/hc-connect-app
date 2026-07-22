import './globals.css'
import type { Metadata } from 'next'
import OnlinePresence from '@/components/OnlinePresence'

export const metadata: Metadata = {
  title: 'HC Connect',
  description: 'Portal de acompanhamento de embarques da HC Consultoria',
  manifest: '/manifest.json',
  themeColor: '#020817',
  appleWebApp: {
    capable: true,
    title: 'HC Connect',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <OnlinePresence />{children}</body>
    </html>
  )
}