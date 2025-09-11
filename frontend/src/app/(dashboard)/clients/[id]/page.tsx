'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { ClientType } from '@/types/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useClientStore, type Client } from '@/lib/stores/client-store'
import { Edit, Trash2, Mail, Phone, MapPin, Building2, ArrowLeft } from 'lucide-react'

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id || ''
  const router = useRouter()
  const { currentClient, getClient, deleteClient } = useClientStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        if (id) {
          await getClient(id)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [id, getClient])

  const client: Client | null = currentClient

  const initials = useMemo(() => {
    const name = client?.name || ''
    return name.split(' ').map(n => n[0]).join('').toUpperCase() || 'C'
  }, [client?.name])

  const formatDate = (date?: string) => {
    if (!date) return ''
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const formatClientType = (t: ClientType) => (t === 'COMPANY' ? 'Company' : 'Individual')

  const onDelete = async () => {
    if (!client) return
    const ok = window.confirm('Delete this client? This action cannot be undone.')
    if (!ok) return
    try {
      await deleteClient(client.id)
      router.push('/clients')
    } catch (e) {
      console.error('Failed to delete client', e)
      alert('Failed to delete client')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => router.push('/clients')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Clients
        </Button>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <p className="text-gray-600 dark:text-gray-300">Client not found.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.push('/clients')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/clients/${client.id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" /> Edit
          </Button>
          <Button variant="outline" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-2" /> Delete
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-gradient-to-r from-indigo-500 to-emerald-500 text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-2xl">{client.name}</CardTitle>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant={client.isActive ? 'success' : 'secondary'}>
                  {client.isActive ? 'active' : 'inactive'}
                </Badge>
                <Badge variant="outline">{formatClientType(client.clientType)}</Badge>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Client since {formatDate(client.createdAt)}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-center text-gray-700 dark:text-gray-300">
                <Mail className="h-4 w-4 mr-2" /> {client.email}
              </div>
              {client.phone && (
                <div className="flex items-center text-gray-700 dark:text-gray-300">
                  <Phone className="h-4 w-4 mr-2" /> {client.phone}
                </div>
              )}
              {client.companyName && (
                <div className="flex items-center text-gray-700 dark:text-gray-300">
                  <Building2 className="h-4 w-4 mr-2" /> {client.companyName}
                </div>
              )}
              {(client.addressLine1 || client.city || client.state || client.postalCode || client.country) && (
                <div className="flex items-center text-gray-700 dark:text-gray-300">
                  <MapPin className="h-4 w-4 mr-2" />
                  {[client.addressLine1, client.city, client.state, client.postalCode, client.country].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
            <div className="space-y-2 text-sm">
              {client.taxNumber && (
                <div className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">Tax Number:</span> {client.taxNumber}
                </div>
              )}
              <div className="text-gray-700 dark:text-gray-300">
                <span className="font-medium">Invoices:</span> {client._count?.invoices || 0}
              </div>
              <div className="text-gray-700 dark:text-gray-300">
                <span className="font-medium">Last updated:</span> {formatDate(client.updatedAt)}
              </div>
            </div>
          </div>

          {client.notes && (
            <div className="pt-4 border-t">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Notes</p>
              <p className="text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-200">{client.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
