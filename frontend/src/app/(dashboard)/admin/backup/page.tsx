'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import apiClient from '@/lib/api-client'
import { useUIStore } from '@/lib/stores'

export default function AdminBackupPage() {
  const { addNotification } = useUIStore()
  const [backupStatus, setBackupStatus] = useState<{ lastBackupAt: string | null; lastBackupId: string | null; lastBackupFile: string | null; maintenanceMode: boolean } | null>(null)
  const [runningBackup, setRunningBackup] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const status = await apiClient.adminGetBackupStatus()
        if (mounted) setBackupStatus(status)
      } catch {}
    })()
    return () => { mounted = false }
  }, [])

  async function handleRunBackup() {
    try {
      setRunningBackup(true)
      const res = await apiClient.adminRunBackup()
      addNotification({ type: 'success', title: 'Backup started', message: `Backup ${res.backupId} created` })
      try {
        const status = await apiClient.adminGetBackupStatus()
        setBackupStatus(status)
      } catch {}
    } catch (e: any) {
      addNotification({ type: 'error', title: 'Backup failed', message: e?.message })
    } finally {
      setRunningBackup(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Backups</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Trigger a manual backup and view the most recent backup metadata.</p>
        </div>
        <Button onClick={handleRunBackup} disabled={runningBackup}>
          {runningBackup ? 'Running…' : 'Run Backup Now'}
        </Button>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Backup Status</CardTitle>
          <CardDescription>Latest backup metadata</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <div>Last backup: <span className="font-medium">{backupStatus?.lastBackupAt ? new Date(backupStatus.lastBackupAt).toLocaleString() : '—'}</span></div>
            <div>Backup ID: <span className="font-mono">{backupStatus?.lastBackupId || '—'}</span></div>
            <div>File: <span className="font-mono">{backupStatus?.lastBackupFile || '—'}</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
