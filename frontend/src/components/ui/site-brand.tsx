"use client"

import { useEffect } from 'react'
import { useUIStore } from '@/lib/stores/ui-store'
import apiClient from '@/lib/api-client'

export function SiteBrand({ className }: { className?: string }) {
  const siteName = useUIStore(s => s.siteName)
  const setSiteName = useUIStore(s => s.setSiteName)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        if (!siteName || siteName === 'Invoicy') {
          const cfg = await apiClient.getPublicConfig()
          if (mounted && cfg?.siteName) setSiteName(cfg.siteName)
        }
      } catch {}
    })()
    return () => { mounted = false }
  }, [siteName, setSiteName])

  return <span className={className}>{siteName || 'Invoicy'}</span>
}
