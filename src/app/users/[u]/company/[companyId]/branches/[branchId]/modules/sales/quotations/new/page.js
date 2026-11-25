'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Send } from 'lucide-react'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import QuotationLineItemsTable from '@/components/modules/sales/quotation-line-items-table'
import CustomerPicker from '@/components/modules/sales/customer-picker'
import QuotationSendDialog from '@/components/modules/sales/quotation-send-dialog'
import { useQuotationCatalog, resolveQuotationPrice } from '@/components/modules/sales/quotation-catalog'
import {
  computeTotals,
  emptyQuotationLine,
  itemsToRpcLines,
  rowsToItems,
  toDateInput,
  useMoney,
  useSalesSettings,
} from '@/components/modules/sales/quotation-shared'

// One form for three situations:
//   /quotations/new                 a new quotation
//   /quotations/new?draft=<id>      reopening a draft (quotation_drafts, one JSONB row)
//   /quotations/<id>/edit           editing a saved or sent quotation
// Three buttons:
//   Save as draft  keeps unfinished work in quotation_drafts (no number yet)
//   Save           makes a real, completed quotation with its number (status Saved)
//   Send           opens the send dialog (email or PDF) and marks it Sent
// The number is given by the database, never made up in the browser.
export default function QuotationFormPage({ quotationId = null }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { u, companyId, branchId } = useParams()
  const draftParam = searchParams.get('draft')
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/quotations`
  const money = useMoney()
  const { settings, loaded: settingsLoaded } = useSalesSettings(branchId)

  const [draftId, setDraftId] = useState(draftParam || null)
  const [quotationNumber, setQuotationNumber] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [items, setItems] = useState([emptyQuotationLine()])
  const [applyVat, setApplyVat] = useState(true)
  const [vatRate, setVatRate] = useState(null)
  const [notes, setNotes] = useState('')
  const [pricingContextId, setPricingContextId] = useState('')
  const [loading, setLoading] = useState(Boolean(quotationId || draftParam))
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const [sendOpen, setSendOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [recipientEmail, setRecipientEmail] = useState('')
  // The id of the real quotation once it exists, so a retry after a failed send updates
  // the same quotation instead of creating another one.
  const [savedId, setSavedId] = useState(quotationId)

  const { contexts, defaultContext, catalog, pricingRules, loading: catalogLoading, error: catalogError, warning: catalogWarning } =
    useQuotationCatalog(branchId)

  const editing = Boolean(quotationId)
  const effectiveVatRate = vatRate ?? settings.default_vat_rate

  const fail = (message, error) => {
    if (error) console.error(message, error)
    setErrorMessage(message)
    toast.error(message)
  }

  // A brand-new quotation starts with valid-until = today + the branch's default days (if set).
  // Drafts and edited quotations keep their own date.
  const validPrefilled = useRef(false)
  useEffect(() => {
    if (validPrefilled.current || !settingsLoaded || quotationId || draftParam) return
    validPrefilled.current = true
    const days = Number(settings.quotation_valid_days)
    if (days > 0) {
      const date = new Date()
      date.setDate(date.getDate() + days)
      const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      setValidUntil(local.toISOString().slice(0, 10))
    }
  }, [settingsLoaded, settings.quotation_valid_days, quotationId, draftParam])

  // Default pricing context. It never re-prices lines on its own: a loaded draft or an
  // edited quotation keeps the prices that were agreed.
  useEffect(() => {
    if (defaultContext?.id && !pricingContextId) setPricingContextId(defaultContext.id)
  }, [defaultContext, pricingContextId])

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

  // Load a draft.
  useEffect(() => {
    if (!draftParam) return
    let cancelled = false
    async function load() {
      const { data, error } = await supabase.from('quotation_drafts').select('id, payload').eq('id', draftParam).eq('branch', branchId).maybeSingle()
      if (cancelled) return
      if (error || !data) {
        fail('Could not load this draft. It may have been deleted.', error)
      } else {
        const p = data.payload || {}
        setCustomerId(p.customerId || '')
        setValidUntil(p.validUntil || '')
        setItems(Array.isArray(p.items) && p.items.length ? noDiscount(p.items) : [emptyQuotationLine()])
        setApplyVat(p.applyVat !== false)
        setVatRate(p.vatRate ?? null)
        setNotes(p.notes || '')
        if (p.pricingContextId) setPricingContextId(p.pricingContextId)
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftParam, branchId])

  // Load a saved or sent quotation for editing.
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
      } else if (!['draft', 'saved', 'sent'].includes(data.status)) {
        toast.error(`A ${data.status} quotation is closed and cannot be edited.`)
        router.replace(`${base}/${quotationId}`)
        return
      } else {
        setQuotationNumber(data.quote_number)
        setCustomerId(data.customer || '')
        setValidUntil(toDateInput(data.valid_until))
        setItems(rowsToItems(data.quotation_line_items).length ? noDiscount(rowsToItems(data.quotation_line_items)) : [emptyQuotationLine()])
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

  // Quotations carry no discount (VAT only). The discount is given on the pro forma or the invoice.
  const totals = useMemo(
    () => computeTotals(items, 'amount', 0, applyVat, effectiveVatRate),
    [items, applyVat, effectiveVatRate]
  )

  const filledItems = items.filter((item) => item.variantId)

  const validateForSend = () => {
    if (filledItems.length === 0) {
      toast.error('Add at least one item first.')
      return false
    }
    if (filledItems.some((item) => Number(item.qty) <= 0)) {
      toast.error('Every item needs a quantity above zero.')
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
    discount_type: 'amount',
    discount_value: 0,
    apply_vat: applyVat,
    vat_rate: Number(effectiveVatRate),
    notes,
  })

  // ---- Draft ----
  const saveDraft = async () => {
    setErrorMessage('')
    setSaving(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id
      if (!userId) throw new Error('Could not identify the current user. Try reloading the page.')

      let title = 'Untitled quotation'
      if (customerId) {
        const { data: customer } = await supabase.from('customers').select('name').eq('id', customerId).maybeSingle()
        if (customer?.name) title = `Quotation for ${customer.name}`
      }
      const payload = {
        customerId,
        validUntil,
        items,
        applyVat,
        vatRate: effectiveVatRate,
        notes,
        pricingContextId,
      }

      if (draftId) {
        const { error } = await supabase
          .from('quotation_drafts')
          .update({ title, payload, updated_by: userId })
          .eq('id', draftId)
          .eq('branch', branchId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('quotation_drafts')
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

  // ---- Real quotation ----
  // Creates (or updates) the quotation row. A draft it came from is removed afterwards.
  const persist = async () => {
    const { data, error } = await supabase.rpc('save_quotation', {
      p_branch: branchId,
      p_quotation: savedId,
      p_header: headerPayload(),
      p_lines: itemsToRpcLines(items),
    })
    if (error || !data?.success) {
      throw new Error(error?.message || data?.error || 'Could not save the quotation.')
    }
    setSavedId(data.quotation_id)
    if (draftId) {
      const { error: deleteError } = await supabase.from('quotation_drafts').delete().eq('id', draftId)
      if (deleteError) {
        console.error('Quotation saved, but its draft could not be deleted:', deleteError)
        toast.message('The quotation was saved, but the old draft could not be removed. Delete it from the Draft tab.')
      }
    }
    setQuotationNumber(data.quote_number)
    setDraftId(null)
    return { id: data.quotation_id, number: data.quote_number }
  }

  // Save: a completed quotation (new ones start as Saved; a sent one stays Sent).
  const saveQuotation = async () => {
    setErrorMessage('')
    if (!validateForSend()) return
    setSaving(true)
    try {
      const result = await persist()
      toast.success(editing ? `Quotation ${result.number} updated.` : `Quotation ${result.number} saved.`)
      router.push(`${base}/${result.id}`)
    } catch (err) {
      fail(err.message, err)
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
  }

  const openSend = () => {
    setErrorMessage('')
    if (!validateForSend()) return
    setSendOpen(true)
  }

  const handleEmail = async ({ email, message }) => {
    setBusy(true)
    try {
      const result = await persist()
      const { data, error } = await supabase.rpc('record_quotation_send', {
        p_quotation: result.id,
        p_email: email,
        p_message: message,
      })
      if (error || !data?.success) throw new Error(error?.message || data?.error || 'Could not record the send.')

      toast.success(`Quotation ${result.number} sent.`)
      const subject = `Quotation ${result.number}`
      const lines = filledItems.map((item) => `- ${item.productTitle || 'Item'}${item.variantLabel ? ` (${item.variantLabel})` : ''} x ${item.qty}`)
      const body = `${message}\n\n${lines.join('\n')}\n\nTotal: ${money(totals.total)}${validUntil ? `\nValid until: ${validUntil}` : ''}`
      setSendOpen(false)
      router.push(`${base}/${result.id}`)
      window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    } catch (err) {
      fail(err.message, err)
      throw err
    } finally {
      setBusy(false)
    }
  }

  const handleExport = async () => {
    setBusy(true)
    try {
      const result = await persist()
      const { data, error } = await supabase.rpc('mark_quotation_sent', { p_quotation: result.id })
      if (error || !data?.success) throw new Error(error?.message || data?.error || 'Could not mark the quotation as sent.')
      toast.success(`Quotation ${result.number} sent.`)
      setSendOpen(false)
      router.push(`${base}/${result.id}?print=1`)
    } catch (err) {
      fail(err.message, err)
      throw err
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="p-4 text-xs text-muted-foreground">Loading quotation...</p>
  }

  return (
    <div className="flex w-full max-w-none grow flex-col space-y-3 overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-bold tracking-tight text-slate-900">{editing ? 'Edit Quotation' : draftId ? 'Draft Quotation' : 'New Quotation'}</h1>
          <p className="text-xs text-gray-500">{quotationNumber || 'Number is given when it is saved'}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!editing && !savedId && (
            <Button type="button" className="h-6 text-xs" variant="outline" disabled={saving || busy} onClick={saveDraft}>
              {saving ? 'Saving...' : 'Save as draft'}
            </Button>
          )}
          <Button type="button" className="h-6 text-xs" variant="outline" disabled={saving || busy} onClick={saveQuotation}>
            {saving ? 'Saving...' : editing || savedId ? 'Save changes' : 'Save'}
          </Button>
          <Button type="button" className="h-6 gap-1.5 bg-core text-xs text-white" disabled={saving || busy} onClick={openSend}>
            <Send className="size-3.5" /> Send
          </Button>
        </div>
      </div>

      {errorMessage && <p role="alert" className="rounded-sm border border-red-200 bg-red-50 p-2 text-xs text-red-700">{errorMessage}</p>}

      <form id="quotation-form" onSubmit={handleSubmit} className="flex min-h-0 grow flex-col justify-between gap-2 overflow-hidden">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
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
              warehouseLabel="the branch"
            />
          )}
        </div>

        <div className="sales-document-summary flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50/60 p-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-2">
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
            {applyVat && <SummaryRow label={`VAT (${Number(effectiveVatRate).toFixed(1)}%)`} value={`+${money(totals.vat)}`} />}
            <div className="my-1 border-t border-dashed border-gray-300" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">Total</span>
              <span className="text-2xl font-bold tracking-tight text-slate-900">{money(totals.total)}</span>
            </div>
          </div>
        </div>
      </form>

      <QuotationSendDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        quoteLabel={quotationNumber || 'this quotation'}
        defaultEmail={recipientEmail}
        summaryLines={[
          `${filledItems.length} line item${filledItems.length === 1 ? '' : 's'}`,
          `Total: ${money(totals.total)}`,
          ...(validUntil ? [`Valid until: ${validUntil}`] : []),
        ]}
        onEmail={handleEmail}
        onExport={handleExport}
      />
    </div>
  )
}

// Old drafts and quotations may still carry a discount; it is cleared here (the database ignores it too).
const noDiscount = (list) => list.map((item) => ({ ...item, discountType: 'amount', discountValue: 0 }))

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-[11px] text-gray-500">
      <span>{label}</span>
      <span className="font-medium text-gray-700">{value}</span>
    </div>
  )
}