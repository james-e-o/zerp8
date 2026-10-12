'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import supabase from '@/config/supabaseClient'

// An 'open' order (created internally) or a 'sent' one (actually
// transmitted/exported, set from the order detail page's Send/Export
// flow) is editable here - once it's partially/fully received or
// cancelled, the record is locked (receiving and cancellation have
// their own flows; this form is just for fixing up the title,
// delivery date and notes on an order still in flight). Supplier and
// line items are intentionally NOT editable here - changing what was
// actually ordered after the fact is a new order, not an edit.
const EDITABLE_STATUSES = ['open', 'sent']

export default function EditPurchaseOrderPage() {
  const router = useRouter()
  const { u, companyId, branchId, orderId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/orders`

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [neededBy, setNeededBy] = useState('')
  const [status, setStatus] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadOrder() {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const { data: orderRow, error: orderError } = await supabase
          .from('purchase_orders')
          .select('id, title, notes, expected_delivery_date, status')
          .eq('id', orderId)
          .eq('branch', branchId)
          .maybeSingle()

        if (orderError) throw orderError
        if (!orderRow) throw new Error('Purchase order not found.')

        if (!cancelled) {
          setTitle(orderRow.title || '')
          setNotes(orderRow.notes || '')
          setNeededBy(orderRow.expected_delivery_date || '')
          setStatus(orderRow.status)
        }
      } catch (loadError) {
        console.error('Failed to load purchase order for editing:', loadError)
        if (!cancelled) setErrorMessage(loadError.message || 'Could not load this purchase order.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    if (orderId && branchId) loadOrder()

    return () => {
      cancelled = true
    }
  }, [orderId, branchId])

  const handleSave = async (event) => {
    event.preventDefault()
    setErrorMessage('')

    if (!title.trim()) {
      setErrorMessage('Give this order a title before saving.')
      return
    }

    setIsSaving(true)

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({
          title: title.trim(),
          notes: notes || null,
          expected_delivery_date: neededBy || null,
        })
        .eq('id', orderId)
        .eq('branch', branchId)
        .in('status', EDITABLE_STATUSES)

      if (error) throw error
      router.push(`${base}/${orderId}`)
    } catch (saveError) {
      console.error('Failed to save purchase order:', saveError)
      setErrorMessage(saveError.message || 'Could not save this purchase order.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <p className="p-4 text-xs text-muted-foreground">Loading purchase order...</p>
  }

  if (!EDITABLE_STATUSES.includes(status)) {
    return (
      <div className="space-y-4 p-4 text-xs">
        <Link href={`${base}/${orderId}`}>
          <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
            <ArrowLeft className="mr-1.5 size-3.5" /> Back to order
          </Button>
        </Link>
        <div role="alert" className="border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          This order can no longer be edited here - only an order still in flight (open or sent) can be changed here.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 text-xs">
      <Link href={`${base}/${orderId}`}>
        <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
          <ArrowLeft className="mr-1.5 size-3.5" /> Back to order
        </Button>
      </Link>

      {errorMessage && (
        <p role="alert" className="border border-red-200 bg-red-50 p-3 text-xs text-red-700">{errorMessage}</p>
      )}

      <form onSubmit={handleSave} className="space-y-4 border border-border rounded-sm bg-card p-4">
        <label className="block text-xs font-medium text-foreground">
          Title <span className="text-red-500">*</span>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Lagos branch generator fuel"
            className="mt-1 h-auto w-full text-sm"
          />
        </label>

        <label className="block text-xs font-medium text-foreground">
          Expected delivery date
          <Input
            type="date"
            value={neededBy}
            onChange={(event) => setNeededBy(event.target.value)}
            className="mt-1 h-auto w-full text-sm"
          />
        </label>

        <label className="block text-xs font-medium text-foreground">
          Notes
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="mt-1 min-h-24 w-full text-sm"
          />
        </label>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-sm text-xs"
            onClick={() => router.push(`${base}/${orderId}`)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            className="h-7 bg-core rounded-sm text-xs text-white"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}