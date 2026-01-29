import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Authentication - Invoicy',
  description: 'Sign in to your Invoicy account',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
