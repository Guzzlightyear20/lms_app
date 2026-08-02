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
      <body>{children}</body>
    </html>
  )
}
