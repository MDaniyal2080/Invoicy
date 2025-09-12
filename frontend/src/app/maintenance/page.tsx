'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function MaintenancePage() {
  return (
    <main className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="max-w-xl w-full glass-card p-8 text-center">
        <div className="mx-auto mb-4 h-14 w-14 flex items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold text-gradient mb-2">Well be right back</h1>
        <p className="text-muted-foreground mb-6">
          The site is currently in maintenance mode. Only administrators can access the admin panel during this time.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button asChild className="gradient-primary text-white">
            <Link href="/login">Admin Login</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go to Homepage</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
