'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import apiClient from '@/lib/api-client'
import { useUIStore } from '@/lib/stores'

export default function AdminMaintenancePage() {
  const { addNotification } = useUIStore()
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const status = await apiClient.adminGetBackupStatus()
        if (mounted) setMaintenanceEnabled(!!status.maintenanceMode)
      } catch {}
    })()
    return () => { mounted = false }
  }, [])

  async function handleSave() {
    try {
      setLoading(true)
      const res = await apiClient.adminSetMaintenance(maintenanceEnabled)
      addNotification({ type: 'success', title: 'Maintenance updated', message: res.maintenanceMode ? 'Maintenance mode enabled' : 'Maintenance mode disabled' })
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Failed to update maintenance', message: e?.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Maintenance</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Enable or disable maintenance mode</p>
        </div>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Maintenance Mode</CardTitle>
          <CardDescription>Users will see a maintenance notice when enabled.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <input id="maintenanceMode" type="checkbox" className="h-4 w-4" checked={!!maintenanceEnabled} onChange={(e) => setMaintenanceEnabled(e.target.checked)} />
            <label htmlFor="maintenanceMode" className="text-sm">Enable maintenance mode</label>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
