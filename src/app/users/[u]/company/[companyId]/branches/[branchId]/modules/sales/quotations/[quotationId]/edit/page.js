'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import QuotationLineItemsTable from '@/components/modules/sales/quotation-line-items-table'
import { DUMMY_VARIANT_INDEX } from '@/components/modules/sales/dummy-product-variants'
import { DUMMY_QUOTATIONS, formatNaira } from '@/components/modules/sales/dummy-data'
import { resolveQuotationPrice, useQuotationCatalog } from '@/components/modules/sales/quotation-catalog'

export default function EditQuotationPage() {
  const router = useRouter()
  const { u, companyId, branchId, quotationId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/quotations`
  const existing = DUMMY_QUOTATIONS.find((quotation) => quotation.id === quotationId) || DUMMY_QUOTATIONS[0]

  // Editable only while the quotation is still a draft — once sent, a
  // change should go through a new quotation instead.
  useEffect(() => {
    if (existing.status !== 'draft') router.replace(`${base}/${existing.id}`)
  }, [base, existing, router])

  const [validUntil, setValidUntil] = useState(existing.validUntil)
  // Old dummy quotation rows were shaped as { productId, name, qty, unitPrice }.
  // The variant-based catalog needs a variantId, so map the best matching
  // variant across once, on mount, rather than on every render.
  const [items, setItems] = useState(() =>
    existing.items.map((item) => {
      const matchedVariant = DUMMY_VARIANT_INDEX.find((variant) => variant.productId === item.productId)
      return { variantId: matchedVariant?.id || '', qty: item.qty, unitPrice: item.unitPrice }
    })
  )
  const [saving, setSaving] = useState(false)
  const [discountType, setDiscountType] = useState('amount')
  const [discountValue, setDiscountValue] = useState(0)
  const { contexts, defaultContext, catalog, pricingRules, loading: catalogLoading, error: catalogError } = useQuotationCatalog(branchId)
  const [pricingContextId, setPricingContextId] = useState('')

  useEffect(() => {
    if (defaultContext?.id && !pricingContextId) setPricingContextId(defaultContext.id)
  }, [defaultContext, pricingContextId])

  useEffect(() => {
    if (!catalog.length) return
    setItems((current) => current.map((item) => {
      const variant = catalog.find((entry) => entry.id === item.variantId) || catalog.find((entry) => entry.productId === item.productId)
      return variant
        ? { ...item, variantId: variant.id, productId: variant.productId, productTitle: variant.productTitle, variantLabel: variant.variantLabel, sku: variant.sku, unitPrice: resolveQuotationPrice(variant, pricingContextId || defaultContext?.id, pricingRules, item.qty) }
        : item
    }))
  }, [catalog, defaultContext, pricingContextId, pricingRules])

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.unitPrice || 0), 0), [items])
  const lineDiscountTotal = useMemo(() => items.reduce((sum, item) => sum + getLineDiscount(item), 0), [items])
  const lineTotal = subtotal - lineDiscountTotal
  const documentDiscount = discountType === 'percentage'
    ? lineTotal * Math.min(100, Math.max(0, Number(discountValue || 0))) / 100
    : Math.min(lineTotal, Math.max(0, Number(discountValue || 0)))
  const total = Math.max(0, lineTotal - documentDiscount)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    // TODO: replace with real update once the quotations RPC/table is wired up
    await new Promise((resolve) => setTimeout(resolve, 500))
    setSaving(false)
    router.push(`${base}/${existing.id}`)
  }

  if (existing.status !== 'draft') return null

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Edit {existing.id}</h1>
        <p className="mt-1 text-sm text-gray-600">Editable while this quotation is still a draft.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
        <label className="block max-w-xs text-sm font-semibold text-gray-800">
          Valid until
          <Input
            type="date"
            value={validUntil}
            onChange={(event) => setValidUntil(event.target.value)}
            className="mt-1 block h-auto w-full rounded border border-gray-200 px-3 py-2 text-sm focus:border-core focus:outline-none"
          />
        </label>

        <label className="block max-w-xs text-sm font-semibold text-gray-800">
          Pricing context
          <Select value={pricingContextId} onValueChange={setPricingContextId} disabled={catalogLoading || contexts.length === 0}>
            <SelectTrigger className="mt-1 h-auto w-full rounded border border-gray-200 px-3 py-2 text-sm"><SelectValue placeholder="Select pricing context" /></SelectTrigger>
            <SelectContent>{contexts.map((context) => <SelectItem key={context.id} value={context.id}>{context.name}{context.is_default ? ' (Standard)' : ''}</SelectItem>)}</SelectContent>
          </Select>
        </label>

        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-800">Line items</label>
          {catalogError && <p className="mb-2 text-xs text-red-600">{catalogError}</p>}
          {catalogLoading ? <p className="text-xs text-gray-500">Loading products and pricing contexts...</p> : <QuotationLineItemsTable items={items} setItems={setItems} catalog={catalog} contexts={contexts} pricingContextId={pricingContextId || defaultContext?.id} pricingRules={pricingRules} />}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800"><span>Document discount</span><Select value={discountType} onValueChange={setDiscountType}><SelectTrigger className="h-8 w-24 px-2 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="amount">Amount</SelectItem><SelectItem value="percentage">Percent</SelectItem></SelectContent></Select><Input type="number" min="0" value={discountValue} onChange={(event) => setDiscountValue(Number(event.target.value))} className="h-8 w-24 px-2 text-xs" /></div>
          <div className="text-right text-xs text-gray-600"><p>Subtotal: {formatNaira(subtotal)}</p><p>Line discounts: {formatNaira(lineDiscountTotal)}</p><p>Document discount: {formatNaira(documentDiscount)}</p><p className="mt-1 text-xl font-bold text-slate-900">Total: {formatNaira(total)}</p></div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" className="bg-core text-white" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function getLineDiscount(item) {
  const subtotal = Number(item.qty || 0) * Number(item.unitPrice || 0)
  return item.discountType === 'percentage'
    ? subtotal * Math.min(100, Math.max(0, Number(item.discountValue || 0))) / 100
    : Math.min(subtotal, Math.max(0, Number(item.discountValue || 0)))
}
