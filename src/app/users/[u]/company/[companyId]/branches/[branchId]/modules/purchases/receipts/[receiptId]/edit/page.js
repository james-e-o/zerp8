'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import supabase from '@/config/supabaseClient'

export default function EditPurchaseReceiptPage() {
  const router = useRouter()
  const { u, companyId, branchId, receiptId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/receipts`

  const [receiptNumber, setReceiptNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadReceipt() {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const { data: receiptRow, error } = await supabase
          .from('purchase_receipts')
          .select('id, receipt_number, notes, status')
          .eq('id', receiptId)
          .eq('branch', branchId)
          .maybeSingle()

        if (error) throw error
        if (!receiptRow) throw new Error('Purchase receipt not found.')

        if (!cancelled) {
          setReceiptNumber(receiptRow.receipt_number || '')
          setNotes(receiptRow.notes || '')
          setStatus(receiptRow.status)
        }
      } catch (loadError) {
        console.error('Failed to load purchase receipt for editing:', loadError)
        if (!cancelled) {
          setErrorMessage(loadError.message || 'Could not load this purchase receipt.')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    if (receiptId && branchId) loadReceipt()
    return () => {
      cancelled = true
    }
  }, [receiptId, branchId])

  const handleSave = async (event) => {
    event.preventDefault()
    setErrorMessage('')

    if (!receiptNumber.trim()) {
      setErrorMessage('Enter a receipt number before saving.')
      return
    }

    setIsSaving(true)

    try {
      const { data, error } = await supabase
        .from('purchase_receipts')
        .update({
          receipt_number: receiptNumber.trim(),
          notes: notes || null,
        })
        .eq('id', receiptId)
        .eq('branch', branchId)
        .eq('status', 'draft')
        .select('id')
        .maybeSingle()

      if (error) throw error
      if (!data) throw new Error('This receipt is no longer a draft and cannot be edited.')
      router.push(`${base}/${receiptId}`)
    } catch (saveError) {
      console.error('Failed to save purchase receipt:', saveError)
      setErrorMessage(saveError.message || 'Could not save this purchase receipt.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <p className="p-4 text-xs text-muted-foreground">Loading receipt...</p>
  }

  if (errorMessage && !status) {
    return (
      <div className="space-y-4 p-4 text-xs">
        <Link href={`${base}/${receiptId}`}>
          <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
            <ArrowLeft className="mr-1.5 size-3.5" /> Back to receipt
          </Button>
        </Link>
        <p role="alert" className="border border-red-200 bg-red-50 p-3 text-red-700">
          {errorMessage}
        </p>
      </div>
    )
  }

  if (status !== 'draft') {
    return (
      <div className="space-y-4 p-4 text-xs">
        <Link href={`${base}/${receiptId}`}>
          <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
            <ArrowLeft className="mr-1.5 size-3.5" /> Back to receipt
          </Button>
        </Link>
        <div role="alert" className="border border-amber-200 bg-amber-50 p-3 text-amber-800">
          Only draft receipts can be edited.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 text-xs">
      <Link href={`${base}/${receiptId}`}>
        <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
          <ArrowLeft className="mr-1.5 size-3.5" /> Back to receipt
        </Button>
      </Link>

      {errorMessage && (
        <p role="alert" className="border border-red-200 bg-red-50 p-3 text-red-700">
          {errorMessage}
        </p>
      )}

      <form onSubmit={handleSave} className="space-y-4 rounded-sm border border-border bg-card p-4">
        <h1 className="text-base font-semibold text-foreground">Edit receipt</h1>

        <label className="block font-medium text-foreground">
          Receipt number <span className="text-red-500">*</span>
          <Input
            value={receiptNumber}
            onChange={(event) => setReceiptNumber(event.target.value)}
            className="mt-1 h-auto w-full text-sm"
          />
        </label>

        <label className="block font-medium text-foreground">
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
            onClick={() => router.push(`${base}/${receiptId}`)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            className="h-7 rounded-sm bg-core text-xs text-white"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
