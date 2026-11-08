'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import QuotationLineItemsTable from '@/components/modules/sales/quotation-line-items-table'
import CustomerPicker from '@/components/modules/sales/customer-picker'
import { useQuotationCatalog, resolveQuotationPrice } from '@/components/modules/sales/quotation-catalog'
import {
  computeTotals,
  emptyQuotationLine,
  getAvailableStock,
  itemsToRpcLines,
  rowsToItems,
  toDateInput,
  useMoney,
  useSalesSettings,
} from '@/components/modules/sales/quotation-shared'

// Used by proforma-invoices/new/page.js and proforma-invoices/[proformaId]/edit/page.js
// (two pages, so it stays a component).
//
// A proforma tells the customer what can be supplied right now and at what price. It looks like a
// quotation, but quantities are capped at the free stock (the black box on every line): you cannot
// list what does not exist. Nothing is reserved. When the customer accepts, the detail page converts
// it into a sales order and a draft sales invoice.
export default function ProformaForm({ proformaId = null }) {
  const router = useRouter()
  const { u, companyId, branchId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/invoices/proforma-invoices`
  const money = useMoney()
  const { settings, loaded: settingsLoaded } = useSalesSettings(branchId)

  const [number, setNumber] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [items, setItems] = useState([emptyQuotationLine()])
  const [discountType, setDiscountType] = useState('amount')
  const [discountValue, setDiscountValue] = useState(0)
  const [applyVat, setApplyVat] = useState(true)
  const [vatRate, setVatRate] = useState(null)
  const [notes, setNotes] = useState('')
  const [pricingContextId, setPricingContextId] = useState('')
  const [loading, setLoading] = useState(Boolean(proformaId))
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const { contexts, defaultContext, catalog, pricingRules, loading: catalogLoading, error: catalogError, warning: catalogWarning } =
    useQuotationCatalog(branchId)

  const editing = Boolean(proformaId)
  const effectiveVatRate = vatRate ?? settings.default_vat_rate

  const fail = (message, error) => {
    if (error) console.error(message, error)
    setErrorMessage(message)
    toast.error(message)
  }

  const validPrefilled = useRef(false)
  useEffect(() => {
    if (validPrefilled.current || !settingsLoaded || proformaId) return
    validPrefilled.current = true
    const days = Number(settings.quotation_valid_days)
    if (days > 0) {
      const date = new Date()
      date.setDate(date.getDate() + days)
      const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      setValidUntil(local.toISOString().slice(0, 10))
    }
  }, [settingsLoaded, settings.quotation_valid_days, proformaId])

  useEffect(() => {
    if (defaultContext?.id && !pricingContextId) setPricingContextId(defaultContext.id)
  }, [defaultContext, pricingContextId])

  const handlePricingContextChange = (nextId) => {
    setPricingContextId(nextId)
    setItems((current) =>
      current.map((item) => {
        const variant = catalog.find((entry) => entry.id === item.variantId)
        return variant ? { ...item, pricingContextId: nextId, unitPrice: resolveQuotationPrice(variant, nextId, pricingRules, item.qty) } : item
      })
    )
  }

  // Editing: load the saved proforma.
  useEffect(() => {
    if (!proformaId) return
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('proforma_invoices')
        .select(
          `id, proforma_number, status, customer, valid_until, discount_type, discount_value, apply_vat, vat_rate, notes,
           lines:proforma_invoice_line_items ( variant, pricing_context, description_snapshot, variant_label_snapshot, sku_snapshot,
                                               quantity, unit_price_snapshot, discount_type, discount_value, position )`
        )
        .eq('id', proformaId)
        .eq('branch', branchId)
        .maybeSingle()
      if (cancelled) return
      if (error || !data) {
        fail('Could not load this proforma.', error)
      } else if (!['draft', 'saved', 'sent'].includes(data.status)) {
        toast.error(`A ${data.status} proforma is closed and cannot be edited.`)
        router.replace(`${base}/${proformaId}`)
        return
      } else {
        const lines = [...(data.lines || [])].sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
        setNumber(data.proforma_number)
        setCustomerId(data.customer || '')
        setValidUntil(toDateInput(data.valid_until))
        setItems(lines.length ? rowsToItems(lines) : [emptyQuotationLine()])
        setDiscountType(data.discount_type || 'amount')
        setDiscountValue(Number(data.discount_value || 0))
        setApplyVat(data.apply_vat !== false)
        setVatRate(Number(data.vat_rate))
        setNotes(data.notes || '')
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proformaId, branchId])

  const totals = useMemo(
    () => computeTotals(items, discountType, discountValue, applyVat, effectiveVatRate),
    [items, discountType, discountValue, applyVat, effectiveVatRate]
  )

  const filledItems = items.filter((item) => item.variantId)

  function firstProblem() {
    if (!customerId) return 'Choose the customer.'
    if (filledItems.length === 0) return 'Add at least one item first.'
    if (filledItems.some((item) => Number(item.qty) <= 0)) return 'Every item needs a quantity above zero.'
    // Same product on several lines counts together against its stock.
    const perVariant = {}
    filledItems.forEach((item) => { perVariant[item.variantId] = (perVariant[item.variantId] || 0) + Number(item.qty) })
    for (const [variantId, qty] of Object.entries(perVariant)) {
      const variant = catalog.find((entry) => entry.id === variantId)
      const free = getAvailableStock(variant, '')
      if (free !== Infinity && qty > free) return `${variant?.productTitle || 'An item'} has only ${free} available. A proforma can only list what can be supplied now.`
    }
    if (validUntil && validUntil < new Date().toISOString().slice(0, 10)) return 'The valid-until date has already passed.'
    return ''
  }

  const save = async () => {
    setErrorMessage('')
    const problem = firstProblem()
    if (problem) {
      toast.error(problem)
      setErrorMessage(problem)
      return
    }
    setSaving(true)
    const { data, error } = await supabase.rpc('save_proforma', {
      p_branch: branchId,
      p_proforma: proformaId,
      p_header: {
        customer: customerId,
        valid_until: validUntil || null,
        discount_type: discountType,
        discount_value: Number(discountValue || 0),
        apply_vat: applyVat,
        vat_rate: Number(effectiveVatRate),
        notes,
      },
      p_lines: itemsToRpcLines(items),
    })
    setSaving(false)
    if (error || !data?.success) {
      fail(error?.message || data?.error || 'Could not save the proforma.', error || data)
      return
    }
    toast.success(editing ? `Proforma ${data.proforma_number} updated.` : `Proforma ${data.proforma_number} saved.`)
    router.push(`${base}/${data.proforma_id}`)
  }

  if (loading) return <p className="p-4 text-xs text-muted-foreground">Loading proforma...</p>

  return (
    <div className="flex w-full max-w-none grow flex-col space-y-3 overflow-hidden px-1 py-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-bold tracking-tight text-slate-900">{editing ? 'Edit proforma' : 'New proforma'}</h1>
          <p className="text-xs text-gray-500">{number || 'Number is given when it is saved'}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" className="h-6 text-xs" disabled={saving} onClick={() => router.back()}>Cancel</Button>
          <Button type="button" className="h-6 bg-core text-xs text-white" disabled={saving} onClick={save}>
            {saving ? 'Saving...' : editing ? 'Save changes' : 'Save'}
          </Button>
        </div>
      </div>

      {errorMessage && <p role="alert" className="rounded-sm border border-red-200 bg-red-50 p-2 text-xs text-red-700">{errorMessage}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        <label className="text-xs font-medium text-gray-800">
          Customer
          <CustomerPicker branchId={branchId} value={customerId} onChange={setCustomerId} />
        </label>
        <label className="text-xs font-medium text-gray-800">
          Valid until
          <Input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} className="mt-1 h-auto w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-core focus:outline-none" />
        </label>
        <label className="text-xs font-medium text-gray-800">
          Pricing context
          <Select value={pricingContextId} onValueChange={handlePricingContextChange} disabled={catalogLoading || contexts.length === 0}>
            <SelectTrigger className="mt-1 h-auto w-full rounded-md border border-gray-200 px-3 py-2 text-sm"><SelectValue placeholder="Select pricing context" /></SelectTrigger>
            <SelectContent>
              {contexts.map((context) => (
                <SelectItem key={context.id} value={context.id}>{context.name}{context.is_default ? ' (Standard)' : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      <div className="flex min-h-0 grow flex-col overflow-y-auto">
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
            warehouseId=""
            warehouseLabel="the branch"
            restrictToStock
          />
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/60 p-3 sm:flex-row sm:items-start sm:justify-between">
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
          <label className="block text-[11px] font-medium text-gray-700">
            Notes
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes for this proforma..." rows={2} className="mt-1 field-sizing-fixed min-h-12 resize-y bg-white px-2 py-1 text-[11px] leading-4" />
          </label>
        </div>
        <div className="w-full max-w-xs shrink-0 space-y-1 sm:ml-auto">
          <Row label="Subtotal" value={money(totals.subtotal)} />
          <Row label="Line discounts" value={`-${money(totals.lineDiscounts)}`} />
          <Row label="Document discount" value={`-${money(totals.documentDiscount)}`} />
          {applyVat && <Row label={`VAT (${Number(effectiveVatRate).toFixed(1)}%)`} value={`+${money(totals.vat)}`} />}
          <div className="my-1 border-t border-dashed border-gray-300" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800">Total</span>
            <span className="text-2xl font-bold tracking-tight text-slate-900">{money(totals.total)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-[11px] text-gray-500">
      <span>{label}</span>
      <span className="font-medium text-gray-700">{value}</span>
    </div>
  )
}
