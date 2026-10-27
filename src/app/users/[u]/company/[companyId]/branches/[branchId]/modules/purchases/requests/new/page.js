'use client'

import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import supabase from '@/config/supabaseClient'
import { formatCurrency } from '@/components/modules/purchases/dummy-data'
import PurchaseRequestLineItemsTable from '@/components/modules/purchases/purchase-request-line-items-table'
import { useRequestCatalog } from '@/components/modules/purchases/request-catalog'
import { BranchContext } from '@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext'

const generateRequestNumber = () => {
  const date = new Date()

  const stamp = `${String(date.getFullYear()).slice(2)}${String(
    date.getMonth() + 1
  ).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`

  return `PR-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

// The empty line the table always has at least one of.
const blankLine = () => ({ variantId: '', qty: 0, estimatedCostPrice: 0 })

// A draft is not a half-formed purchase_requests row - it's a snapshot of
// in-progress form state, stored as one JSONB blob in
// purchase_request_drafts (same pattern as product_drafts). This form
// opens an existing draft via ?draft=<id> in the URL; with no draft param
// it starts blank, same as before.
//
// Title vs request number: 'title' is a person-entered name ("Q4
// packaging restock") and is what the planned "Copy" feature will
// prefix with "Copy of ...". request_number is the auto-generated,
// immutable identifier (PR-xxxxxx-XXXX) - the two used to be conflated
// (the draft row's own 'title' column held the generated number), now
// they're genuinely separate: the draft row's title column holds this
// real title, and the generated number travels inside the payload.
export default function PurchaseRequestForm() {
  const router = useRouter()
  const { u, companyId, branchId } = useParams()
  const searchParams = useSearchParams()
  const draftParam = searchParams.get('draft')

  const { currentBranch } = useContext(BranchContext) || {}
  const branchCurrencyCode = currentBranch?.base_currency || ''

  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/requests`

  const [title, setTitle] = useState('')
  const [requestNumber, setRequestNumber] = useState('')
  const [draftId, setDraftId] = useState(draftParam || null)
  const [draftLoading, setDraftLoading] = useState(Boolean(draftParam))
  // "Requested by" is no longer a free-text field - requested_by is a
  // uuid referencing the real user, so it's auto-filled from the
  // logged-in session and shown read-only instead of typed.
  const [currentUser, setCurrentUser] = useState(null)
  const [neededBy, setNeededBy] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([blankLine()])
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // The table always keeps one line. Whatever the table does to the list
  // (including removing the last remaining line), if the result would be
  // empty it becomes a single fresh blank line instead - so clicking the
  // red X on the last line clears and resets it rather than leaving nothing.
  const setItemsKeepingOneLine = useCallback((updater) => {
    setItems((previous) => {
      const next = typeof updater === 'function' ? updater(previous) : updater
      return Array.isArray(next) && next.length > 0 ? next : [blankLine()]
    })
  }, [])

  const clearAllLines = () => setItems([blankLine()])
  const isAlreadyBlank = items.length === 1 && !items[0]?.variantId

  const {
    catalog,
    currencies,
    loading: catalogLoading,
    error: catalogError,
  } = useRequestCatalog(branchId)

  const branchCurrencySymbol = currencies.find(
    (currency) => currency.code === branchCurrencyCode
  )?.symbol || ''

  const total = useMemo(
    () =>
      items.reduce((sum, item) => {
        return (
          sum +
          Number(item.qty || 0) *
            Number(item.estimatedCostPrice || 0)
        )
      }, 0),
    [items]
  )

  const currencyMismatches = useMemo(
    () =>
      items
        .map((item) => catalog.find((entry) => entry.id === item.variantId))
        .filter((variant) => variant?.cost_currency && variant.cost_currency !== branchCurrencyCode),
    [catalog, items, branchCurrencyCode]
  )

  // Only generate a fresh request number when NOT opening an existing
  // draft - a reopened draft keeps the number it was first saved under,
  // read back from the draft's payload (see loadDraft below).
  useEffect(() => {
    if (!draftParam) {
      setRequestNumber(generateRequestNumber())
    }
  }, [draftParam])

  useEffect(() => {
    let cancelled = false

    async function loadUser() {
      const { data, error } = await supabase.auth.getUser()
      if (cancelled || error || !data?.user) return
      setCurrentUser(data.user)
    }

    loadUser()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadDraft() {
      if (!draftParam) return
      setDraftLoading(true)

      const { data, error } = await supabase
        .from('purchase_request_drafts')
        .select('id, title, payload')
        .eq('id', draftParam)
        .single()

      if (cancelled) return

      if (error || !data) {
        setSubmitError('Could not load this draft - it may have been deleted.')
        setDraftLoading(false)
        return
      }

      const payload = data.payload || {}
      setTitle(data.title || '')
      setRequestNumber(payload.requestNumber || generateRequestNumber())
      setNeededBy(payload.neededBy || '')
      setNotes(payload.notes || '')
      setItems(
        Array.isArray(payload.items) && payload.items.length > 0
          ? payload.items
          : [{ variantId: '', qty: 1, estimatedCostPrice: 0 }]
      )
      setDraftId(data.id)
      setDraftLoading(false)
    }

    loadDraft()
    return () => {
      cancelled = true
    }
  }, [draftParam])

  const requesterLabel =
    currentUser?.user_metadata?.full_name || currentUser?.email || 'You'

  const handleSaveDraft = async (event) => {
    event.preventDefault()
    setSubmitError('')

    if (!currentUser?.id) {
      setSubmitError('Could not identify the current user - try reloading the page.')
      return
    }
    if (!title.trim()) {
      setSubmitError('Give this request a title before saving.')
      return
    }

    setSaving(true)

    try {
      const payload = { requestNumber, neededBy, notes, items }

      if (draftId) {
        const { error } = await supabase
          .from('purchase_request_drafts')
          .update({
            title: title.trim(),
            payload,
            updated_by: currentUser.id,
          })
          .eq('id', draftId)

        if (error) throw error
      } else {
        const { error } = await supabase.from('purchase_request_drafts').insert({
          company: companyId,
          branch: branchId,
          title: title.trim(),
          payload,
          created_by: currentUser.id,
          updated_by: currentUser.id,
        })

        if (error) throw error
      }

      router.push(base)
    } catch (err) {
      console.error('Error saving purchase request draft:', err)
      setSubmitError(err.message || 'Something went wrong saving this draft.')
    } finally {
      setSaving(false)
    }
  }

  // The real, final submit - creates the actual purchase_requests row,
  // starting at 'pending_approval' (there is no 'draft' state for a real
  // row anymore - that lives only in purchase_request_drafts).
  //
  // The request, its line items and (if this form was opened from a draft)
  // the removal of that draft all happen inside ONE database function,
  // create_purchase_request(), in a single transaction: if any part fails,
  // nothing is saved - no request without lines, no orphaned lines, and the
  // draft is kept.
  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitError('')

    if (!currentUser?.id) {
      setSubmitError('Could not identify the current user - try reloading the page.')
      return
    }
    if (!title.trim()) {
      setSubmitError('Give this request a title before submitting.')
      return
    }

    const validItems = items.filter((item) => item.variantId)
    if (validItems.length === 0) {
      setSubmitError('Add at least one product to the request.')
      return
    }

    setSaving(true)

    try {
      const { error } = await supabase.rpc('create_purchase_request', {
        p_branch: branchId,
        p_title: title.trim(),
        p_request_number: requestNumber,
        p_notes: notes || null,
        p_needed_by: neededBy || null,
        p_line_items: validItems.map((item) => ({
          variant: item.variantId,
          quantity_requested: item.qty,
          estimated_unit_cost: item.estimatedCostPrice,
        })),
        p_draft: draftId || null,
      })

      if (error) throw error

      router.push(base)
    } catch (err) {
      console.error('Error creating purchase request:', err)
      setSubmitError(err.message || 'Something went wrong saving this request.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex w-full max-w-none grow flex-col space-y-4 overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-bold tracking-tight text-slate-900">
            New Purchase Request
          </h1>

          <p className="text-xs text-gray-500">{requestNumber}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className={'h-6 text-xs'}
            onClick={() => router.back()}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="outline"
            className={'h-6 text-xs'}
            disabled={saving || draftLoading}
            onClick={handleSaveDraft}
          >
            {saving ? 'Saving...' : 'Save as Draft'}
          </Button>

          <Button
            type="button"
            className="bg-core text-white h-6 text-xs"
            disabled={saving || draftLoading}
            onClick={handleSubmit}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {submitError && (
        <p className="text-xs text-red-600">{submitError}</p>
      )}

      <form
        id="purchase-request-form"
        className="flex min-h-0 justify-between grow flex-col gap-4 overflow-hidden"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 lg:gap-4">
          <label className="text-xs font-medium text-gray-800">
            Title <span className="text-red-500">*</span>

            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Q4 packaging restock"
              className="mt-1 h-auto w-full text-xs lg:text-sm"
            />
          </label>

          <label className="text-xs font-medium text-gray-800">
            Requested by <span className="text-red-500"></span>

            <Input
              value={requesterLabel}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Q4 packaging restock"
              className="mt-1 h-auto w-full text-xs lg:text-sm"
              readOnly
            />
          </label>

          <label className="text-xs font-medium text-gray-800">
            Needed by

            <Input
              type="date"
              value={neededBy}
              onChange={(event) => setNeededBy(event.target.value)}
              className="mt-1 h-auto w-full text-xs lg:text-sm"
            />
          </label>
        </div>

        <div className="flex flex-col grow overflow-hidden">
          {catalogError && (
            <p className="mb-2 text-xs text-red-600">{catalogError}</p>
          )}

          {catalogLoading || draftLoading ? (
            <p className="text-xs text-gray-500">
              {draftLoading ? 'Loading draft...' : 'Loading products...'}
            </p>
          ) : (
            <>
              <div className="mb-1 flex shrink-0 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="h-6 text-xs"
                  disabled={isAlreadyBlank}
                  onClick={clearAllLines}
                >
                  Clear all
                </Button>
              </div>

              <PurchaseRequestLineItemsTable
                items={items}
                setItems={setItemsKeepingOneLine}
                catalog={catalog}
                branchCurrencyCode={branchCurrencyCode}
                branchCurrencySymbol={branchCurrencySymbol}
              />
            </>
          )}
          {currencyMismatches.length > 0 && (
            <p className="mt-2 text-xs text-amber-600">
              Some selected products use a different cost currency than this branch ({branchCurrencyCode || 'base currency'}).
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-gray-50/60 p-5 sm:flex-row sm:items-start sm:justify-between">
          <label className="flex-1 text-xs font-medium text-gray-700">
            Notes

            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Reason, delivery details, or approval notes..."
              className="mt-1 min-h-20 bg-white text-xs"
            />
          </label>

          <div className="w-full max-w-xs shrink-0 sm:ml-auto">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">
                Estimated total
              </span>

              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {formatCurrency(total, branchCurrencyCode, branchCurrencySymbol)}
              </span>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}