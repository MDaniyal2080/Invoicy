'use client'

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { useClientStore } from '@/lib/stores/client-store'
import { ArrowLeft, Save } from 'lucide-react'
import type { UpdateClientInput, ClientType } from '@/types/client'

export default function EditClientPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id || ''
  const router = useRouter()
  const { currentClient, getClient, updateClient } = useClientStore()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState<UpdateClientInput>({
    name: '',
    email: '',
    clientType: 'INDIVIDUAL',
    phone: '',
    companyName: '',
    taxNumber: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    notes: '',
    isActive: true,
  })

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        if (id) {
          const c = await getClient(id)
          if (mounted && c) {
            setForm({
              name: c.name || '',
              email: c.email || '',
              clientType: (c.clientType || 'INDIVIDUAL') as ClientType,
              phone: c.phone || '',
              companyName: c.companyName || '',
              taxNumber: c.taxNumber || '',
              addressLine1: c.addressLine1 || '',
              addressLine2: c.addressLine2 || '',
              city: c.city || '',
              state: c.state || '',
              country: c.country || '',
              postalCode: c.postalCode || '',
              notes: c.notes || '',
              isActive: c.isActive,
            })
          }
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [id, getClient])

  const onChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name as keyof UpdateClientInput]: value } as UpdateClientInput))
  }

  const onToggleActive = (e: ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, isActive: e.target.checked }))
  }

  const onTypeChange = (value: ClientType) => {
    setForm(prev => ({ ...prev, clientType: value }))
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!id) return
    setSubmitting(true)
    try {
      await updateClient(id, form)
      router.push(`/clients/${id}`)
    } catch (err) {
      console.error('Failed to update client', err)
      alert('Failed to update client')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.push(`/clients/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Edit Client</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={onSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" value={form.name} onChange={onChange} required />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" value={form.email} onChange={onChange} required />
              </div>
              <div>
                <Label htmlFor="clientType">Client Type</Label>
                <Select value={form.clientType} onValueChange={onTypeChange}>
                  <SelectTrigger id="clientType">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                    <SelectItem value="COMPANY">Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" value={form.phone} onChange={onChange} />
              </div>
              <div>
                <Label htmlFor="companyName">Company Name</Label>
                <Input id="companyName" name="companyName" value={form.companyName} onChange={onChange} />
              </div>
              <div>
                <Label htmlFor="taxNumber">Tax Number</Label>
                <Input id="taxNumber" name="taxNumber" value={form.taxNumber} onChange={onChange} />
              </div>
              <div>
                <Label htmlFor="addressLine1">Address Line 1</Label>
                <Input id="addressLine1" name="addressLine1" value={form.addressLine1} onChange={onChange} />
              </div>
              <div>
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input id="addressLine2" name="addressLine2" value={form.addressLine2} onChange={onChange} />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" value={form.city} onChange={onChange} />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input id="state" name="state" value={form.state} onChange={onChange} />
              </div>
              <div>
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input id="postalCode" name="postalCode" value={form.postalCode} onChange={onChange} />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input id="country" name="country" value={form.country} onChange={onChange} />
              </div>
              <div className="flex items-center gap-2 mt-6">
                <input id="isActive" name="isActive" type="checkbox" checked={form.isActive} onChange={onToggleActive} />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <textarea id="notes" name="notes" value={form.notes} onChange={onChange} className="w-full border border-gray-300 dark:border-gray-700 rounded-md p-2 bg-white dark:bg-gray-900" rows={4} />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                <Save className="h-4 w-4 mr-2" /> {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
