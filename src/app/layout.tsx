import { AuthProvider } from '@/lib/auth/AuthProvider'
import './globals.css'

export const metadata = {
  title: 'LMS SaaS',
  description: 'Multi-tenant course platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
