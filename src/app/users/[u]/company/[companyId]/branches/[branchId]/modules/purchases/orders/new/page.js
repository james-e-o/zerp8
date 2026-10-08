'use client'

import { useContext, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
import { formatCurrency } from '@/components/modules/purchases/dummy-data'
import { useRequestCatalog } from '@/components/modules/purchases/request-catalog'
import { useSuppliers } from '@/components/modules/purchases/purchase-catalog'
import PurchaseOrderLineItemsTable from '@/components/modules/purchases/purchase-order-line-items-table'
import { BranchContext } from '@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext'

const generateOrderNumber = () => {
  const date = new Date()
  const stamp = `${String(date.getFullYear()).slice(2)}${String(
    date.getMonth() + 1
  ).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  return `PO-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export default function NewPurchaseOrderPage() {
  const router = useRouter()
  const { u, companyId, branchId } = useParams()
  const { currentBranch } = useContext(BranchContext) || {}
  const branchCurrencyCode = currentBranch?.base_currency || ''
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/orders`

  const [orderNumber, setOrderNumber] = useState('')
  const [supplierId, setSupplierId] = useState('')
  // No separate "requested by" concept here - purchase_orders.created_by
  // already records who made the order, auto-filled from the session,
  // same as the request form's requested_by.
  const [currentUser, setCurrentUser] = useState(null)
  const [neededBy, setNeededBy] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([
    { variantId: '', qty: 1, standardCostPrice: 0, unitCost: 0 },
  ])
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const { suppliers, loading: suppliersLoading } = useSuppliers(companyId)
  const { catalog, currencies, loading: catalogLoading, error: catalogError } =
    useRequestCatalog(branchId)
  const branchCurrencySymbol = currencies.find(
    (currency) => currency.code === branchCurrencyCode
  )?.symbol || ''

  useEffect(() => {
    setOrderNumber(generateOrderNumber())
  }, [])

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

  const createdByLabel =
    currentUser?.user_metadata?.full_name || currentUser?.email || 'You'

  const total = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + Number(item.qty || 0) * Number(item.unitCost || 0),
        0
      ),
    [items]
  )

  const currencyMismatches = useMemo(
    () => items
      .map((item) => catalog.find((entry) => entry.id === item.variantId))
      .filter((variant) => variant?.cost_currency && variant.cost_currency !== branchCurrencyCode),
    [catalog, items, branchCurrencyCode]
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitError('')

    if (!supplierId) {
      setSubmitError('A supplier is required to create a Purchase Order.')
      return
    }
    if (!currentUser?.id) {
      setSubmitError('Could not identify the current user - try reloading the page.')
      return
    }

    const validItems = items.filter((item) => item.variantId)
    if (validItems.length === 0) {
      setSubmitError('Add at least one product to the order.')
      return
    }

    setSaving(true)

    try {
      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .insert({
          branch: branchId,
          supplier: supplierId,
          order_number: orderNumber,
          status: 'draft',
          notes: notes || null,
          expected_delivery_date: neededBy || null,
          created_by: currentUser.id,
        })
        .select('id')
        .single()

      if (orderError) throw orderError

      const lineItems = validItems.map((item) => ({
        purchase_order: order.id,
        variant: item.variantId,
        quantity_ordered: item.qty,
        unit_cost_snapshot: item.unitCost,
        line_total: Number(item.qty || 0) * Number(item.unitCost || 0),
      }))

      const { error: lineItemsError } = await supabase
        .from('purchase_order_line_items')
        .insert(lineItems)

      if (lineItemsError) throw lineItemsError

      router.push(base)
    } catch (err) {
      console.error('Error creating purchase order:', err)
      setSubmitError(err.message || 'Something went wrong saving this order.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex w-full max-w-none grow flex-col space-y-4 overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            New Purchase Order
          </h1>

          <p className="text-xs text-gray-500">{orderNumber}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => router.back()}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            form="purchase-order-form"
            className="bg-core text-white h-7 text-xs"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save as Draft'}
          </Button>
        </div>
      </div>

      {submitError && (
        <p className="text-xs text-red-600">{submitError}</p>
      )}

      <form
        id="purchase-order-form"
        onSubmit={handleSubmit}
        className="flex min-h-0 justify-between grow flex-col gap-4 overflow-hidden"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium text-gray-800">
            Supplier <span className="text-red-500">*</span>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger className="mt-1 h-auto w-full text-sm">
                <SelectValue placeholder={suppliersLoading ? 'Loading suppliers...' : 'Select supplier'} />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <div className="text-xs font-medium text-gray-800">
            Created by

            <p className="mt-1 h-auto w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {createdByLabel}
            </p>
          </div>

          <label className="text-xs font-medium text-gray-800">
            Needed by

            <Input
              type="date"
              value={neededBy}
              onChange={(event) => setNeededBy(event.target.value)}
              className="mt-1 h-auto w-full text-sm"
            />
          </label>
        </div>

        <div className="flex grow flex-col overflow-hidden">
          {catalogError && (
            <p className="mb-2 text-xs text-red-600">{catalogError}</p>
          )}
          {catalogLoading ? (
            <p className="text-xs text-gray-500">Loading products...</p>
          ) : (
            <PurchaseOrderLineItemsTable
              items={items}
              setItems={setItems}
              catalog={catalog}
              branchCurrencyCode={branchCurrencyCode}
              branchCurrencySymbol={branchCurrencySymbol}
            />
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