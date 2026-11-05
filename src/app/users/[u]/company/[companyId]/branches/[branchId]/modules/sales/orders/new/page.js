'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import QuotationLineItemsTable from '@/components/modules/sales/quotation-line-items-table'
import CustomerPicker from '@/components/modules/sales/customer-picker'
import { useQuotationCatalog, resolveQuotationPrice } from '@/components/modules/sales/quotation-catalog'
import {
  computeTotals,
  emptyQuotationLine,
  getAvailableStock,
  itemsToRpcLines,
  useMoney,
  useSalesSettings,
} from '@/components/modules/sales/quotation-shared'

// New sales order. Two buttons:
//   Save as draft  keeps the work in sales_order_drafts (one JSONB row, like quotations)
//   Create order   makes the real order. It starts OPEN: prices lock and stock is reserved
//                  (when Reserve stock is ticked) in the same step.
// Reached empty (/orders/new), from a draft (?draft=<id>), or from a quotation's
// "Convert to order" / a cancelled order's "Duplicate", which both make a draft first.
export default function SalesOrderFormPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { u, companyId, branchId } = useParams()
  const draftParam = searchParams.get('draft')
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/orders`
  const money = useMoney()
  const { settings, loaded: settingsLoaded } = useSalesSettings(branchId)

  const [draftId, setDraftId] = useState(draftParam || null)
  const [source, setSource] = useState({ quotationId: '', quotationNumber: '', duplicatedFrom: '', duplicatedFromNumber: '' })
  const [customerId, setCustomerId] = useState('')
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [deliveryDate, setDeliveryDate] = useState('')
  const [items, setItems] = useState([emptyQuotationLine()])
  const [discountType, setDiscountType] = useState('amount')
  const [discountValue, setDiscountValue] = useState(0)
  const [applyVat, setApplyVat] = useState(true)
  const [vatRate, setVatRate] = useState(null)
  const [notes, setNotes] = useState('')
  const [pricingContextId, setPricingContextId] = useState('')
  const [reserveStock, setReserveStock] = useState(null)
  const [loading, setLoading] = useState(Boolean(draftParam))
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const { contexts, defaultContext, catalog, pricingRules, loading: catalogLoading, error: catalogError, warning: catalogWarning } =
    useQuotationCatalog(branchId)

  const effectiveVatRate = vatRate ?? settings.default_vat_rate
  const effectiveReserve = reserveStock ?? settings.reserve_stock_on_order !== false

  const fail = (message, error) => {
    if (error) console.error(message, error)
    setErrorMessage(message)
    toast.error(message)
  }

  useEffect(() => {
    if (defaultContext?.id && !pricingContextId) setPricingContextId(defaultContext.id)
  }, [defaultContext, pricingContextId])

  // Sales never chooses where the stock comes from: Inventory picks the warehouse and batch
  // when it picks the delivery. Stock is checked against the whole branch.
  const warehouseId = ''
  const warehouseLabel = 'the branch'

  const handlePricingContextChange = (nextId) => {
    setPricingContextId(nextId)
    setItems((current) =>
      current.map((item) => {
        const variant = catalog.find((entry) => entry.id === item.variantId)
        return variant
          ? { ...item, pricingContextId: nextId, unitPrice: resolveQuotationPrice(variant, nextId, pricingRules, item.qty) }
          : item
      })
    )
  }

  // Load a draft. Prices in it are kept as they were (a converted quotation keeps its prices).
  useEffect(() => {
    if (!draftParam) return
    let cancelled = false
    async function load() {
      const { data, error } = await supabase.from('sales_order_drafts').select('id, payload').eq('id', draftParam).eq('branch', branchId).maybeSingle()
      if (cancelled) return
      if (error || !data) {
        fail('Could not load this draft. It may have been deleted.', error)
      } else {
        const p = data.payload || {}
        setCustomerId(p.customerId || '')
        if (p.orderDate) setOrderDate(p.orderDate)
        setDeliveryDate(p.requestedDeliveryDate || '')
        setItems(Array.isArray(p.items) && p.items.length ? p.items : [emptyQuotationLine()])
        setDiscountType(p.discountType || 'amount')
        setDiscountValue(Number(p.discountValue || 0))
        setApplyVat(p.applyVat !== false)
        setVatRate(p.vatRate ?? null)
        setNotes(p.notes || '')
        if (p.pricingContextId) setPricingContextId(p.pricingContextId)
        if (p.reserveStock !== undefined) setReserveStock(Boolean(p.reserveStock))
        setSource({
          quotationId: p.quotationId || '',
          quotationNumber: p.quotationNumber || '',
          duplicatedFrom: p.duplicatedFrom || '',
          duplicatedFromNumber: p.duplicatedFromNumber || '',
        })
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftParam, branchId])

  const totals = useMemo(
    () => computeTotals(items, discountType, discountValue, applyVat, effectiveVatRate),
    [items, discountType, discountValue, applyVat, effectiveVatRate]
  )
  const filledItems = items.filter((item) => item.variantId)

  // ---- Draft ----
  const saveDraft = async () => {
    setErrorMessage('')
    setSaving(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id
      if (!userId) throw new Error('Could not identify the current user. Try reloading the page.')

      let title = source.quotationNumber ? `Order from ${source.quotationNumber}` : 'Untitled order'
      if (customerId) {
        const { data: customer } = await supabase.from('customers').select('name').eq('id', customerId).maybeSingle()
        if (customer?.name) title = `Order for ${customer.name}`
      }
      const payload = {
        ...source,
        customerId,
        orderDate,
        requestedDeliveryDate: deliveryDate,
        items,
        discountType,
        discountValue,
        applyVat,
        vatRate: effectiveVatRate,
        notes,
        pricingContextId,
        reserveStock: effectiveReserve,
      }

      if (draftId) {
        const { error } = await supabase.from('sales_order_drafts').update({ title, payload, updated_by: userId }).eq('id', draftId).eq('branch', branchId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('sales_order_drafts')
          .insert({ company: companyId, branch: branchId, title, payload, created_by: userId, updated_by: userId })
          .select('id')
          .single()
        if (error) throw error
        setDraftId(data.id)
      }
      toast.success('Draft saved.')
      router.push(`${base}/draft`)
    } catch (err) {
      fail(err.message || 'Something went wrong saving this draft.', err)
    } finally {
      setSaving(false)
    }
  }

  // ---- Create the order ----
  const validateForCreate = () => {
    if (!customerId) {
      toast.error('Choose the customer. A sales order always has one.')
      return false
    }
    if (filledItems.length === 0) {
      toast.error('Add at least one item first.')
      return false
    }
    if (filledItems.some((item) => Number(item.qty) <= 0)) {
      toast.error('Every item needs a quantity above zero.')
      return false
    }
    const overStock = filledItems.find((item) => Number(item.qty) > getAvailableStock(catalog.find((entry) => entry.id === item.variantId), warehouseId))
    if (overStock) {
      const free = getAvailableStock(catalog.find((entry) => entry.id === overStock.variantId), warehouseId)
      toast.error(`${overStock.productTitle || 'An item'} has only ${free} available in ${warehouseLabel}. Reduce the quantity or pick another warehouse.`)
      return false
    }
    return true
  }

  const askCreate = () => {
    setErrorMessage('')
    if (validateForCreate()) setConfirmOpen(true)
  }

  const createOrder = async () => {
    setCreating(true)
    try {
      const { data, error } = await supabase.rpc('create_sales_order', {
        p_branch: branchId,
        p_header: {
          customer: customerId,
          quotation: source.quotationId || null,
          duplicated_from: source.duplicatedFrom || null,
          order_date: orderDate || null,
          requested_delivery_date: deliveryDate || null,
          discount_type: discountType,
          discount_value: Number(discountValue || 0),
          apply_vat: applyVat,
          vat_rate: Number(effectiveVatRate),
          notes,
          reserve_stock: effectiveReserve,
        },
        p_lines: itemsToRpcLines(items),
        p_draft: draftId,
      })
      if (error || !data?.success) throw new Error(error?.message || data?.error || 'Could not create the order.')

      toast.success(`Order ${data.order_number} created.`)
      if (data.reserve_requested && Number(data.short_lines) > 0) {
        toast.warning(`Stock was short on ${data.short_lines} line${Number(data.short_lines) === 1 ? '' : 's'}; only what was free is reserved.`)
      }
      setConfirmOpen(false)
      router.push(`${base}/${data.order_id}`)
    } catch (err) {
      setConfirmOpen(false)
      fail(err.message, err)
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <p className="p-4 text-xs text-muted-foreground">Loading order...</p>

  return (
    <div className="flex w-full max-w-none grow flex-col space-y-3 overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-bold tracking-tight text-slate-900">{draftId ? 'Draft Sales Order' : 'New Sales Order'}</h1>
          <p className="text-xs text-gray-500">
            {source.quotationNumber
              ? `From quotation ${source.quotationNumber}`
              : source.duplicatedFromNumber
                ? `Copy of cancelled order ${source.duplicatedFromNumber}`
                : 'The number is given when the order is created'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" className="h-6 text-xs" disabled={saving || creating} onClick={saveDraft}>
            {saving ? 'Saving...' : 'Save as draft'}
          </Button>
          <Button type="button" className="h-6 bg-core text-xs text-white" disabled={saving || creating} onClick={askCreate}>
            Create order
          </Button>
        </div>
      </div>

      {errorMessage && <p role="alert" className="rounded-sm border border-red-200 bg-red-50 p-2 text-xs text-red-700">{errorMessage}</p>}

      <form onSubmit={(event) => event.preventDefault()} className="flex min-h-0 grow flex-col justify-between gap-2 overflow-hidden">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <label className="text-xs font-medium text-gray-800">
            Customer <span className="text-red-500">*</span>
            <CustomerPicker branchId={branchId} value={customerId} onChange={setCustomerId} />
          </label>
          <label className="text-xs font-medium text-gray-800">
            Order date
            <Input type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} className="mt-1 h-auto w-full rounded-md border border-gray-200 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-gray-800">
            Requested delivery
            <Input type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} className="mt-1 h-auto w-full rounded-md border border-gray-200 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-gray-800">
            Pricing context
            <Select value={pricingContextId} onValueChange={handlePricingContextChange} disabled={catalogLoading || contexts.length === 0}>
              <SelectTrigger className="mt-1 h-auto w-full rounded-md border border-gray-200 px-3 py-2 text-sm">
                <SelectValue placeholder="Select pricing context" />
              </SelectTrigger>
              <SelectContent>
                {contexts.map((context) => (
                  <SelectItem key={context.id} value={context.id}>
                    {context.name}{context.is_default ? ' (Standard)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>

        <div className="flex min-h-0 grow flex-col overflow-hidden">
          {catalogError && <p className="mb-2 text-xs text-red-600">{catalogError}</p>}
          {!catalogError && catalogWarning && <p className="mb-2 text-xs text-amber-600">{catalogWarning}</p>}
          {catalogLoading ? (
            <p className="text-xs text-gray-500">Loading products and pricing contexts...</p>
          ) : (
            <QuotationLineItemsTable
              items={items}
              setItems={setItems}
              catalog={catalog}
              contexts={contexts}
              pricingContextId={pricingContextId}
              pricingRules={pricingRules}
              warehouseId={warehouseId}
              warehouseLabel={warehouseLabel}
              restrictToStock
            />
          )}
        </div>

        <div className="sales-document-summary mt-auto flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/60 p-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-800">
              <span>Document discount</span>
              <Select value={discountType} onValueChange={setDiscountType}>
                <SelectTrigger className="h-7 w-20 bg-white px-2 text-[11px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="amount">Amount</SelectItem>
                  <SelectItem value="percentage">Percent</SelectItem>
                </SelectContent>
              </Select>
              <Input type="number" min="0" value={discountValue} onChange={(event) => setDiscountValue(Number(event.target.value))} className="h-7 w-20 bg-white px-2 text-[11px]" />
            </div>

            <label className="flex items-center gap-2 text-[11px] font-medium text-gray-700">
              <input type="checkbox" checked={applyVat} onChange={(event) => setApplyVat(event.target.checked)} className="size-3 rounded border-gray-300 text-core focus:ring-core" />
              Apply VAT ({Number(effectiveVatRate).toFixed(1)}%)
            </label>

            <label className="flex items-center gap-2 text-[11px] font-medium text-gray-700">
              <input type="checkbox" checked={effectiveReserve} onChange={(event) => setReserveStock(event.target.checked)} className="size-3 rounded border-gray-300 text-core focus:ring-core" />
              Reserve stock when the order is created
            </label>

            <label className="block text-[11px] font-medium text-gray-700">
              Notes
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes for this order..." rows={2} className="mt-1 field-sizing-fixed min-h-12 resize-y bg-white px-2 py-1 text-[11px] leading-4" />
            </label>
          </div>

          <div className="w-full max-w-xs shrink-0 space-y-1 sm:ml-auto">
            <SummaryRow label="Subtotal" value={money(totals.subtotal)} />
            <SummaryRow label="Line discounts" value={`-${money(totals.lineDiscounts)}`} />
            <SummaryRow label="Document discount" value={`-${money(totals.documentDiscount)}`} />
            {applyVat && <SummaryRow label={`VAT (${Number(effectiveVatRate).toFixed(1)}%)`} value={`+${money(totals.vat)}`} />}
            <div className="my-1 border-t border-dashed border-gray-300" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">Total</span>
              <span className="text-2xl font-bold tracking-tight text-slate-900">{money(totals.total)}</span>
            </div>
          </div>
        </div>
      </form>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => { if (!creating) setConfirmOpen(open) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create this order?</AlertDialogTitle>
            <AlertDialogDescription>
              The order starts as Open and its prices and lines lock. {effectiveReserve ? 'Free stock is reserved for it now.' : 'No stock is reserved; you can reserve it later from the order.'}{' '}
              To change a price afterwards, cancel the order and duplicate it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={creating}>Back</AlertDialogCancel>
            <Button type="button" className="bg-core text-white" disabled={creating} onClick={createOrder}>
              {creating ? 'Creating...' : 'Create order'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}


function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-[11px] text-gray-500">
      <span>{label}</span>
      <span className="font-medium text-gray-700">{value}</span>
    </div>
  )
}
