import { Loader2 } from 'lucide-react'

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center gap-3 rounded-lg bg-white/90 dark:bg-gray-900/90 px-4 py-3 shadow-lg ring-1 ring-black/5">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
        <span className="text-sm text-gray-700 dark:text-gray-200">Loading…</span>
      </div>
    </div>
  )
}
