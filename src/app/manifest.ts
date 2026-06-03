import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HC Connect',
    short_name: 'HC Connect',
    description: 'Portal logístico HC Consultoria',
    start_url: '/cliente',
    display: 'standalone',
    background_color: '#020817',
    theme_color: '#020817',

    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}