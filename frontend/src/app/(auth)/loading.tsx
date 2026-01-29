import { Loader2 } from 'lucide-react'
import { FrontPageShell } from '@/components/ui/front-page-shell'
import { SiteBrand } from '@/components/ui/site-brand'

export default function Loading() {
  return (
    <FrontPageShell title={<SiteBrand />} description="Tech-Forward Dark Mode">
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-slate-700" />
          <span className="text-sm text-slate-700">Loading…</span>
        </div>
      </div>
    </FrontPageShell>
  )
}
