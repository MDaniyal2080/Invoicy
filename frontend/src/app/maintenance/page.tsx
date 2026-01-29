'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import { FrontInfoCallout, FrontPageShell, FrontPalette } from '@/components/ui/front-page-shell'
import { SiteBrand } from '@/components/ui/site-brand'

export default function MaintenancePage() {
  return (
    <FrontPageShell title={<SiteBrand />} description="Tech-Forward Dark Mode">
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">We&apos;ll be right back</h2>
          <p className="text-sm text-slate-600">
            The site is currently in maintenance mode. Only administrators can access the admin panel during this time.
          </p>
        </div>

        <FrontPalette />

        <FrontInfoCallout>
          <div className="space-y-1">
            <div className="font-semibold">Font: Space Grotesk (Modern, tech feel)</div>
            <div className="font-semibold">Best for: Tech companies, modern startups</div>
          </div>
        </FrontInfoCallout>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 mt-0.5" />
          <div>
            <div className="font-semibold">Maintenance in progress</div>
            <div className="text-xs mt-1">Please try again later.</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
          <Button asChild className="h-11 bg-[#0f0c29] hover:bg-[#302b63] text-white">
            <Link href="/login">Admin Login</Link>
          </Button>
          <Button asChild variant="outline" className="h-11">
            <Link href="/">Go to Homepage</Link>
          </Button>
        </div>
      </div>
    </FrontPageShell>
  )
}
