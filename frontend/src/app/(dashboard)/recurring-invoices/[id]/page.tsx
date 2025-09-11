"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, Edit, Pause, Play, XCircle, Zap, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useRecurringInvoiceStore } from "@/lib/stores/recurring-invoice-store"
import { cn } from "@/lib/utils"

const statusClasses: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/15 text-emerald-600',
  PAUSED: 'bg-amber-500/15 text-amber-600',
  CANCELLED: 'bg-rose-500/15 text-rose-600',
}

export default function RecurringInvoiceDetailPage() {
  const router = useRouter()
  // This route is deprecated; redirect to invoices list
  useEffect(() => { router.replace('/invoices') }, [router])
  return null
  const params = useParams()
  const id = (params?.id as string) || ''

  const {
    isLoading,
    currentRecurringInvoice,
    getRecurringInvoice,
    pauseRecurringInvoice,
    resumeRecurringInvoice,
    cancelRecurringInvoice,
    runNowRecurringInvoice,
    deleteRecurringInvoice,
  } = useRecurringInvoiceStore()

  const [action, setAction] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getRecurringInvoice(id).catch((err: any) => {
      const msg = err?.response?.data?.message || 'Failed to load recurring invoice'
      toast.error(msg)
      router.push('/recurring-invoices')
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const clientInitials = useMemo(() => {
    const name = currentRecurringInvoice?.client?.name || ''
    return name ? name.split(' ').map(n => n[0]).join('').slice(0,2) : 'CL'
  }, [currentRecurringInvoice])

  if (isLoading && !currentRecurringInvoice) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    )
  }

  if (!currentRecurringInvoice) return null

  const ri = currentRecurringInvoice!

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/recurring-invoices')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Recurring Invoice</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Next run: {ri.nextRunAt ? new Date(ri.nextRunAt).toLocaleDateString() : '-'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn(statusClasses[ri.status] || '')}>{ri.status}</Badge>
          <Link href={`/recurring-invoices/${ri.id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" /> Edit
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            disabled={
              isLoading ||
              action==='run' ||
              !(ri.status === 'ACTIVE' && (ri.nextRunAt ? new Date(ri.nextRunAt) <= new Date() : true))
            }
            title={
              ri.status !== 'ACTIVE'
                ? 'Schedule is not active'
                : ri.nextRunAt && new Date(ri.nextRunAt) > new Date()
                  ? 'Schedule is not due yet'
                  : undefined
            }
            onClick={async () => {
              try {
                const isActive = ri.status === 'ACTIVE'
                const isDue = ri.nextRunAt ? new Date(ri.nextRunAt) <= new Date() : true
                if (!isActive || !isDue) {
                  toast.error(!isActive ? 'Schedule must be ACTIVE.' : 'Schedule is not due yet.')
                  return
                }
                setAction('run')
                await runNowRecurringInvoice(ri.id)
              } catch (err: any) {
                toast.error(err?.response?.data?.message || 'Failed to run now')
              } finally {
                setAction(null)
              }
            }}
          >
            <Zap className="h-4 w-4 mr-2" /> Run now
          </Button>
          {ri.status === 'ACTIVE' ? (
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading || action==='pause'}
              onClick={async () => {
                try {
                  setAction('pause')
                  await pauseRecurringInvoice(ri.id)
                } catch (err: any) {
                  toast.error(err?.response?.data?.message || 'Failed to pause')
                } finally {
                  setAction(null)
                }
              }}
            >
              <Pause className="h-4 w-4 mr-2" /> Pause
            </Button>
          ) : ri.status === 'PAUSED' ? (
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading || action==='resume'}
              onClick={async () => {
                try {
                  setAction('resume')
                  await resumeRecurringInvoice(ri.id)
                } catch (err: any) {
                  toast.error(err?.response?.data?.message || 'Failed to resume')
                } finally {
                  setAction(null)
                }
              }}
            >
              <Play className="h-4 w-4 mr-2" /> Resume
            </Button>
          ) : null}
          {ri.status !== 'CANCELLED' && (
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading || action==='cancel'}
              onClick={async () => {
                const ok = window.confirm('Cancel this recurring schedule? This cannot be undone.')
                if (!ok) return
                try {
                  setAction('cancel')
                  await cancelRecurringInvoice(ri.id)
                } catch (err: any) {
                  toast.error(err?.response?.data?.message || 'Failed to cancel')
                } finally {
                  setAction(null)
                }
              }}
            >
              <XCircle className="h-4 w-4 mr-2" /> Cancel
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            disabled={isLoading || action==='delete'}
            onClick={async () => {
              const ok = window.confirm('Delete this recurring schedule?')
              if (!ok) return
              try {
                setAction('delete')
                await deleteRecurringInvoice(ri.id)
                router.push('/recurring-invoices')
              } catch (err: any) {
                toast.error(err?.response?.data?.message || 'Failed to delete')
              } finally {
                setAction(null)
              }
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Client</CardTitle>
              <CardDescription>Billing recipient</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-gradient-to-r from-indigo-500 to-emerald-500 text-white text-xs">
                    {clientInitials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{ri.client?.name || 'Unknown client'}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{ri.client?.email || ''}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 text-sm">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Frequency</p>
                  <p className="font-medium">Every {ri.interval} {ri.frequency.toLowerCase()}(s)</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                  <p className="font-medium">{ri.status}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Start Date</p>
                  <p className="font-medium">{ri.startDate ? new Date(ri.startDate).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">End Date</p>
                  <p className="font-medium">{ri.endDate ? new Date(ri.endDate as string).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Next Run</p>
                  <p className="font-medium">{ri.nextRunAt ? new Date(ri.nextRunAt).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Last Run</p>
                  <p className="font-medium">{ri.lastRunAt ? new Date(ri.lastRunAt as string).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Due In</p>
                  <p className="font-medium">{ri.dueInDays ? `${ri.dueInDays} days` : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Auto-send</p>
                  <p className="font-medium">{ri.autoSend ? 'Yes' : 'No'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Items</CardTitle>
              <CardDescription>{ri.items?.length || 0} line items</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400">
                      <th className="py-2">Description</th>
                      <th className="py-2">Qty</th>
                      <th className="py-2">Rate</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {(ri.items || []).map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2 pr-4">{it.description}</td>
                        <td className="py-2 pr-4">{it.quantity}</td>
                        <td className="py-2 pr-4">{(it.rate || 0).toFixed(2)}</td>
                        <td className="py-2 text-right">{((it.quantity || 0) * (it.rate || 0)).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notes/Terms */}
        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Additional</CardTitle>
              <CardDescription>Notes and terms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Notes</p>
                <p className="font-medium whitespace-pre-line">{ri.notes || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Terms</p>
                <p className="font-medium whitespace-pre-line">{ri.terms || '—'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
