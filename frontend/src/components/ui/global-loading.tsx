'use client'

import { useEffect } from 'react'
import { useUIStore } from '@/lib/stores/ui-store'
import { Loader2 } from 'lucide-react'

export function GlobalLoading() {
  const loadingCount = useUIStore((s) => s.loadingCount)

  const visible = loadingCount > 0

  // Prevent body scroll when global loading is visible
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (visible) {
      document.body.classList.add('cursor-wait')
    } else {
      document.body.classList.remove('cursor-wait')
    }
    return () => {
      document.body.classList.remove('cursor-wait')
    }
  }, [visible])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[1000] pointer-events-auto" aria-busy>
      <div className="absolute inset-0 bg-black/5 dark:bg-black/20 transition-opacity" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-3 rounded-lg bg-white/90 dark:bg-gray-900/90 px-4 py-3 shadow-lg ring-1 ring-black/5">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          <span className="text-sm text-gray-700 dark:text-gray-200">Loading…</span>
        </div>
      </div>
    </div>
  )
}
