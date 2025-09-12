"use client"

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import apiClient from '@/lib/api-client'

export function MaintenanceBanner() {
  const pathname = usePathname()
  const [show, setShow] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const cfg: any = await apiClient.getPublicConfig()
        if (!mounted) return
        const isMaintenance = !!cfg?.maintenanceMode
        // Hide banner on admin routes; show elsewhere during maintenance
        if (isMaintenance && !pathname.startsWith('/admin')) {
          // Allow user to dismiss for the current session
          const dismissed = typeof window !== 'undefined' ? sessionStorage.getItem('maintenance_banner_dismissed') : null
          setShow(!dismissed)
        } else {
          setShow(false)
        }
      } catch {
        // Ignore failures; do not block UI
      }
    })()
    return () => { mounted = false }
  }, [pathname])

  if (!show) return null

  return (
    <div className="w-full bg-amber-500/10 text-amber-200 border-b border-amber-500/30">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between text-sm">
        <span>
          Maintenance mode is active. Only administrators can access the admin panel. Public pages are limited.
        </span>
        <button
          onClick={() => { try { sessionStorage.setItem('maintenance_banner_dismissed', '1') } catch {}; setShow(false) }}
          className="px-2 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
