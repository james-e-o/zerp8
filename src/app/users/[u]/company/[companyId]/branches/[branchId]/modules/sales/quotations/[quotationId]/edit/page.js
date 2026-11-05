'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, FileDown, Mail, Send } from 'lucide-react'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
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

// Edit a quotation that was already saved (status draft or sent).
// The quotation keeps its number; save_quotation updates the existing row.
export default function EditQuotationPage() {
  const router = useRouter()
  const { u, companyId, branchId, quotationId } = useParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/quotations`
  const money = useMoney()
  const { settings } = useSalesSettings(branchId)

  const [quotationNumber, setQuotationNumber] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [items, setItems] = useState([emptyQuotationLine()])
  const [discountType, setDiscountType] = useState('amount')
  const [discountValue, setDiscountValue] = useState(0)
  const [applyVat, setApplyVat] = useState(true)
  const [vatRate, setVatRate] = useState(null)
  const [notes, setNotes] = useState('')
  const [pricingContextId, setPricingContextId] = useState('')
  // '' = every warehouse of the branch. Only used to show stock and to stop a quantity going above it.
  const [warehouseId, setWarehouseId] = useState('')
  const warehouseChosen = useRef(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const [sendOpen, setSendOpen] = useState(false)
  const [sendMode, setSendMode] = useState('choose')
  const [busy, setBusy] = useState(false)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [sendMessage, setSendMessage] = useState('Please find our quotation below.')

  const { contexts, defaultContext, catalog, pricingRules, warehouses, loading: catalogLoading, error: catalogError, warning: catalogWarning } =
    useQuotationCatalog(branchId)

  const effectiveVatRate = vatRate ?? settings.default_vat_rate

  const fail = (message, error) => {
    if (error) console.error(message, error)
    setErrorMessage(message)
    toast.error(message)
  }

  // Default pricing context. It never re-prices lines on its own: the edited quotation
  // keeps the prices that were agreed.
  useEffect(() => {
    if (defaultContext?.id && !pricingContextId) setPricingContextId(defaultContext.id)
  }, [defaultContext, pricingContextId])

  // Stock checks start on the branch's default warehouse (a quotation does not store one).
  useEffect(() => {
    if (warehouseChosen.current || warehouses.length === 0) return
    const preferred = warehouses.find((warehouse) => warehouse.is_default) || warehouses[0]
    setWarehouseId(preferred.id)
  }, [warehouses])

  const warehouseLabel = warehouseId ? warehouses.find((warehouse) => warehouse.id === warehouseId)?.label || 'this warehouse' : 'all warehouses'

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

  // Load the quotation being edited.
  useEffect(() => {
    if (!quotationId) return
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('quotations')
        .select(
          `id, quote_number, status, customer, valid_until, discount_type, discount_value, apply_vat, vat_rate, notes,
           quotation_line_items ( variant, pricing_context, description_snapshot, variant_label_snapshot, sku_snapshot,
                                  quantity, unit_price_snapshot, discount_type, discount_value )`
        )
        .eq('id', quotationId)
        .eq('branch', branchId)
        .maybeSingle()
      if (cancelled) return
      if (error || !data) {
        fail('Could not load this quotation.', error)
      } else if (!['draft', 'sent'].includes(data.status)) {
        toast.error(`A ${data.status} quotation is closed and cannot be edited.`)
        router.replace(`${base}/${quotationId}`)
        return
      } else {
        const loadedItems = rowsToItems(data.quotation_line_items)
        setQuotationNumber(data.quote_number)
        setCustomerId(data.customer || '')
        setValidUntil(toDateInput(data.valid_until))
        setItems(loadedItems.length ? loadedItems : [emptyQuotationLine()])
        setDiscountType(data.discount_type || 'amount')
        setDiscountValue(Number(data.discount_value || 0))
        setApplyVat(data.apply_vat !== false)
        setVatRate(Number(data.vat_rate))
        setNotes(data.notes || '')
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotationId, branchId])

  // Pre-fill the recipient from the chosen customer.
  useEffect(() => {
    let cancelled = false
    async function loadEmail() {
      if (!customerId) return
      const { data } = await supabase.from('customers').select('email').eq('id', customerId).maybeSingle()
      if (!cancelled && data?.email) setRecipientEmail((current) => current || data.email)
    }
    loadEmail()
    return () => {
      cancelled = true
    }
  }, [customerId])

  const totals = useMemo(
    () => computeTotals(items, discountType, discountValue, applyVat, effectiveVatRate),
    [items, discountType, discountValue, applyVat, effectiveVatRate]
  )

  const filledItems = items.filter((item) => item.variantId)

  const validate = () => {
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
    if (validUntil) {
      const today = new Date().toISOString().slice(0, 10)
      if (validUntil < today) {
        toast.error('The valid-until date has already passed.')
        return false
      }
    }
    return true
  }

  const headerPayload = () => ({
    customer: customerId || null,
    valid_until: validUntil || null,
    discount_type: discountType,
    discount_value: Number(discountValue || 0),
    apply_vat: applyVat,
    vat_rate: Number(effectiveVatRate),
    notes,
  })

  // Updates the existing quotation row.
  const persist = async () => {
    const { data, error } = await supabase.rpc('save_quotation', {
      p_branch: branchId,
      p_quotation: quotationId,
      p_header: headerPayload(),
      p_lines: itemsToRpcLines(items),
    })
    if (error || !data?.success) {
      throw new Error(error?.message || data?.error || 'Could not save the quotation.')
    }
    return { id: data.quotation_id, number: data.quote_number }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    if (!validate()) return
    setSaving(true)
    try {
      const result = await persist()
      toast.success(`Quotation ${result.number} updated.`)
      router.push(`${base}/${result.id}`)
    } catch (err) {
      fail(err.message, err)
    } finally {
      setSaving(false)
    }
  }

  const openSend = () => {
    if (!validate()) return
    setSendMode('choose')
    setSendOpen(true)
  }

  const handleSheetChange = (open) => {
    setSendOpen(open)
    if (!open) setSendMode('choose')
  }

  const handleEmail = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    if (!recipientEmail.trim()) {
      toast.error('Enter the recipient email.')
      return
    }
    setBusy(true)
    try {
      const result = await persist()
      const { data, error } = await supabase.rpc('record_quotation_send', {
        p_quotation: result.id,
        p_email: recipientEmail,
        p_message: sendMessage,
      })
      if (error || !data?.success) throw new Error(error?.message || data?.error || 'Could not record the send.')

      toast.success(`Quotation ${result.number} saved as sent.`)
      const subject = `Quotation ${result.number}`
      const lines = filledItems.map((item) => `- ${item.productTitle || 'Item'}${item.variantLabel ? ` (${item.variantLabel})` : ''} x ${item.qty}`)
      const body = `${sendMessage}\n\n${lines.join('\n')}\n\nTotal: ${money(totals.total)}${validUntil ? `\nValid until: ${validUntil}` : ''}`
      setSendOpen(false)
      router.push(`${base}/${result.id}`)
      window.location.href = `mailto:${encodeURIComponent(recipientEmail.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    } catch (err) {
      fail(err.message, err)
    } finally {
      setBusy(false)
    }
  }

  const handleExport = async () => {
    setErrorMessage('')
    setBusy(true)
    try {
      const result = await persist()
      toast.success(`Quotation ${result.number} saved as sent.`)
      setSendOpen(false)
      router.push(`${base}/${result.id}?print=1`)
    } catch (err) {
      fail(err.message, err)
    } finally {
      setBusy(false)
    }
  }

  const summary = (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
      <p className="font-semibold text-gray-800">Quotation summary</p>
      <p className="mt-1">{quotationNumber}</p>
      <p>{filledItems.length} line item{filledItems.length === 1 ? '' : 's'}</p>
      <p>Total: {money(totals.total)}</p>
      {validUntil && <p>Valid until: {validUntil}</p>}
    </div>
  )

  if (loading) {
    return <p className="p-4 text-xs text-muted-foreground">Loading quotation...</p>
  }

  return (
    <div className="flex w-full max-w-none grow flex-col space-y-3 overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-bold tracking-tight text-slate-900">Edit Quotation</h1>
          <p className="text-xs text-gray-500">{quotationNumber}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="submit" className="h-6 text-xs" form="quotation-form" variant="outline" disabled={saving || busy}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
          <Button type="button" className="gap-2 h-6 text-xs bg-core text-white" disabled={saving || busy} onClick={openSend} aria-label="Send or export">
            <Send className="size-4" />
          </Button>
        </div>
      </div>

      {errorMessage && <p role="alert" className="rounded-sm border border-red-200 bg-red-50 p-2 text-xs text-red-700">{errorMessage}</p>}

      <form id="quotation-form" onSubmit={handleSubmit} className="flex min-h-0 grow flex-col justify-between gap-2 overflow-hidden">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <label className="text-xs font-medium text-gray-800">
            Customer <span className="font-normal text-gray-400">(optional until it becomes an order)</span>
            <CustomerPicker branchId={branchId} value={customerId} onChange={setCustomerId} />
          </label>
          <label className="text-xs font-medium text-gray-800">
            Valid until
            <Input
              type="date"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
              className="mt-1 h-auto w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-core focus:outline-none"
            />
          </label>
          <label className="text-xs font-medium text-gray-800">
            Warehouse
            <Select
              value={warehouseId || '__all'}
              onValueChange={(value) => {
                setWarehouseId(value === '__all' ? '' : value)
                warehouseChosen.current = true
              }}
              disabled={catalogLoading}
            >
              <SelectTrigger className="mt-1 h-auto w-full rounded-md border border-gray-200 px-3 py-2 text-sm">
                <SelectValue placeholder="Select warehouse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All warehouses</SelectItem>
                {warehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.label}{warehouse.is_default ? ' (Default)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            />
          )}
        </div>

        <div className="sales-document-summary flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/60 p-3 sm:flex-row sm:items-start sm:justify-between">
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
              <Input
                type="number"
                min="0"
                value={discountValue}
                onChange={(event) => setDiscountValue(Number(event.target.value))}
                className="h-7 w-20 bg-white px-2 text-[11px]"
              />
            </div>

            <label className="flex items-center gap-2 text-[11px] font-medium text-gray-700">
              <input
                type="checkbox"
                checked={applyVat}
                onChange={(event) => setApplyVat(event.target.checked)}
                className="size-3 rounded border-gray-300 text-core focus:ring-core"
              />
              Apply VAT ({Number(effectiveVatRate).toFixed(1)}%)
            </label>

            <label className="block text-[11px] font-medium text-gray-700">
              Notes
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Notes for this quotation..."
                rows={2}
                className="mt-1 field-sizing-fixed min-h-12 resize-y bg-white px-2 py-1 text-[11px] leading-4"
              />
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

      <Sheet open={sendOpen} onOpenChange={handleSheetChange}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{sendMode === 'email' ? 'Send Quotation' : 'Quotation actions'}</SheetTitle>
            <SheetDescription>
              {sendMode === 'email'
                ? 'The quotation is saved as sent, then your email app opens with the message ready.'
                : 'Choose how you want to share this quotation. It is saved as sent either way.'}
            </SheetDescription>
          </SheetHeader>
          {sendMode === 'choose' ? (
            <div className="flex flex-col gap-3 px-4 pt-4">
              <Button type="button" variant="outline" className="h-auto justify-start gap-3 px-4 py-4 text-left" onClick={() => setSendMode('email')}>
                <Mail className="size-5 text-core" />
                <span>
                  <span className="block font-semibold">Send by email</span>
                  <span className="block text-xs font-normal text-gray-500">Save it and email it to a recipient.</span>
                </span>
              </Button>
              <Button type="button" variant="outline" className="h-auto justify-start gap-3 px-4 py-4 text-left" onClick={() => setSendMode('export')}>
                <FileDown className="size-5 text-core" />
                <span>
                  <span className="block font-semibold">Export as PDF</span>
                  <span className="block text-xs font-normal text-gray-500">Save it and open the printable copy.</span>
                </span>
              </Button>
            </div>
          ) : sendMode === 'export' ? (
            <div className="flex flex-1 flex-col gap-5 px-4 pt-4">
              <Button type="button" variant="ghost" className="w-fit gap-2 px-0 text-gray-600 hover:text-gray-900" onClick={() => setSendMode('choose')}>
                <ArrowLeft className="size-4" /> Back
              </Button>
              {summary}
              <SheetFooter className="mt-auto px-0">
                <Button type="button" className="w-full gap-2 bg-core text-white" onClick={handleExport} disabled={busy}>
                  <FileDown className="size-4" /> {busy ? 'Saving...' : 'Save and export as PDF'}
                </Button>
              </SheetFooter>
            </div>
          ) : (
            <form onSubmit={handleEmail} className="flex flex-1 flex-col gap-5 px-4">
              <Button type="button" variant="ghost" className="w-fit gap-2 px-0 text-gray-600 hover:text-gray-900" onClick={() => setSendMode('choose')}>
                <ArrowLeft className="size-4" /> Back
              </Button>
              <label className="text-sm font-medium text-gray-800">
                Recipient email
                <Input type="email" required value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="customer@example.com" className="mt-1" />
              </label>
              <label className="text-sm font-medium text-gray-800">
                Message
                <Textarea value={sendMessage} onChange={(event) => setSendMessage(event.target.value)} className="mt-1 min-h-28" />
              </label>
              {summary}
              <SheetFooter className="mt-auto px-0">
                <Button
                  type="submit"
                  className="ml-auto size-10 gap-2 bg-core p-0 text-white"
                  disabled={busy}
                  aria-label={busy ? 'Sending quotation' : 'Send quotation'}
                  title={busy ? 'Sending quotation' : 'Send quotation'}
                >
                  <Send className="size-4" />
                </Button>
              </SheetFooter>
            </form>
          )}
        </SheetContent>
      </Sheet>
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