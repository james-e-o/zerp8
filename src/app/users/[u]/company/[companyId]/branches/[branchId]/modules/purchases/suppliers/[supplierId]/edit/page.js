'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import supabase from '@/config/supabaseClient'

export default function EditSupplierPage() {
  const router = useRouter()
  const { u, companyId, branchId, supplierId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/suppliers`

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('Net 30')
  const [status, setStatus] = useState('active')
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setErrorMessage('')

      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, email, phone, address, payment_terms, status')
        .eq('id', supplierId)
        .eq('company', companyId)
        .eq('branch', branchId)
        .maybeSingle()

      if (cancelled) return

      if (error || !data) {
        setErrorMessage('Could not load this supplier.')
      } else {
        setName(data.name || '')
        setEmail(data.email || '')
        setPhone(data.phone || '')
        setAddress(data.address || '')
        setPaymentTerms(data.payment_terms || 'Net 30')
        setStatus(data.status || 'active')
      }
      setIsLoading(false)
    }

    if (supplierId && companyId && branchId) load()
    return () => {
      cancelled = true
    }
  }, [supplierId, companyId, branchId])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')

    if (!name.trim()) {
      setErrorMessage('Give this supplier a name before saving.')
      return
    }

    setSaving(true)

    try {
      const { error } = await supabase
        .from('suppliers')
        .update({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
          payment_terms: paymentTerms,
          status,
        })
        .eq('id', supplierId)
        .eq('company', companyId)
        .eq('branch', branchId)

      if (error) throw error
      router.push(`${base}/${supplierId}`)
    } catch (err) {
      console.error('Failed to save supplier:', err)
      setErrorMessage(err.message || 'Could not save this supplier.')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return <p className="p-4 text-xs text-muted-foreground">Loading supplier...</p>
  }

  return (
    <div className="max-w-2xl space-y-4 text-xs">
      <Link href={`${base}/${supplierId}`}>
        <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
          <ArrowLeft className="mr-1.5 size-3.5" /> Back to supplier
        </Button>
      </Link>

      {errorMessage && (
        <p role="alert" className="border border-red-200 bg-red-50 p-3 text-xs text-red-700">{errorMessage}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 border border-border rounded-sm bg-card p-4">
        <label className="block text-xs font-medium text-foreground">
          Supplier name <span className="text-red-500">*</span>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 h-auto w-full text-sm"
          />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-foreground">
            Email
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 h-auto w-full text-sm"
            />
          </label>

          <label className="text-xs font-medium text-foreground">
            Phone
            <Input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-1 h-auto w-full text-sm"
            />
          </label>
        </div>

        <label className="block text-xs font-medium text-foreground">
          Address
          <Textarea
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            rows={2}
            className="mt-1 min-h-16 w-full text-sm"
          />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-foreground">
            Payment terms
            <Select value={paymentTerms} onValueChange={setPaymentTerms}>
              <SelectTrigger className="mt-1 h-auto w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Due on receipt">Due on receipt</SelectItem>
                <SelectItem value="Net 15">Net 15</SelectItem>
                <SelectItem value="Net 30">Net 30</SelectItem>
                <SelectItem value="Net 60">Net 60</SelectItem>
              </SelectContent>
            </Select>
          </label>

          <label className="text-xs font-medium text-foreground">
            Status
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1 h-auto w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-sm text-xs"
            onClick={() => router.push(`${base}/${supplierId}`)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            className="h-7 bg-core rounded-sm text-xs text-white"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save supplier'}
          </Button>
        </div>
      </form>
    </div>
  )
}