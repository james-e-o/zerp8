'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import supabase from '@/config/supabaseClient'

export default function EditPurchaseBillPage() {
  const router = useRouter()
  const { u, companyId, branchId, billId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/bills`

  const [billNumber, setBillNumber] = useState('')
  const [issuedAt, setIssuedAt] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadBill() {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const { data, error } = await supabase
          .from('purchase_bills')
          .select('bill_number, issued_at, due_date')
          .eq('id', billId)
          .eq('branch', branchId)
          .maybeSingle()

        if (error) throw error
        if (!data) throw new Error('Bill not found.')

        if (!cancelled) {
          setBillNumber(data.bill_number || '')
          setIssuedAt(data.issued_at ? data.issued_at.slice(0, 10) : '')
          setDueDate(data.due_date ? data.due_date.slice(0, 10) : '')
        }
      } catch (loadError) {
        console.error('Failed to load purchase bill for editing:', loadError)
        if (!cancelled) {
          setErrorMessage(loadError.message || 'Could not load this bill.')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    if (billId && branchId) loadBill()

    return () => {
      cancelled = true
    }
  }, [billId, branchId])

  const handleSave = async (event) => {
    event.preventDefault()
    setErrorMessage('')

    if (!billNumber.trim() || !issuedAt) {
      setErrorMessage('Enter a bill number and bill date before saving.')
      return
    }

    setIsSaving(true)

    try {
      const { error } = await supabase
        .from('purchase_bills')
        .update({
          bill_number: billNumber.trim(),
          issued_at: new Date(`${issuedAt}T00:00:00`).toISOString(),
          due_date: dueDate ? new Date(`${dueDate}T00:00:00`).toISOString() : null,
        })
        .eq('id', billId)
        .eq('branch', branchId)

      if (error) throw error
      router.push(`${base}/${billId}`)
    } catch (saveError) {
      console.error('Failed to save purchase bill:', saveError)
      setErrorMessage(saveError.message || 'Could not save this bill.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <p className="p-4 text-xs text-muted-foreground">Loading bill...</p>
  }

  return (
    <div className="space-y-4 p-4 text-xs">
      <Link href={`${base}/${billId}`}>
        <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
          Back to bill
        </Button>
      </Link>

      {errorMessage && (
        <p role="alert" className="border border-red-200 bg-red-50 p-3 text-red-700">
          {errorMessage}
        </p>
      )}

      <form onSubmit={handleSave} className="max-w-xl space-y-4 rounded-sm border border-border bg-card p-4">
        <h2 className="text-base font-semibold text-foreground">Edit bill</h2>

        <label className="block font-medium text-foreground">
          Bill number <span className="text-red-500">*</span>
          <Input
            value={billNumber}
            onChange={(event) => setBillNumber(event.target.value)}
            className="mt-1 h-auto w-full text-sm"
          />
        </label>

        <label className="block font-medium text-foreground">
          Bill date <span className="text-red-500">*</span>
          <Input
            type="date"
            value={issuedAt}
            onChange={(event) => setIssuedAt(event.target.value)}
            className="mt-1 h-auto w-full text-sm"
          />
        </label>

        <label className="block font-medium text-foreground">
          Due date
          <Input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="mt-1 h-auto w-full text-sm"
          />
        </label>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-sm text-xs"
            onClick={() => router.push(`${base}/${billId}`)}
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
