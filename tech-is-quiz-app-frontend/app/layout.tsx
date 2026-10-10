import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { GameAudioProvider } from '@/components/game-audio-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'TechIs QuizApp | Make every answer count',
  description: 'Host a quiz, form a team, play live questions, and compete for the top spot on the TechIs QuizApp team leaderboard.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0b1018',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <GameAudioProvider>{children}</GameAudioProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
