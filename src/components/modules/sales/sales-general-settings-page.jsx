'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const TERMS = ['Due on receipt', 'Net 7', 'Net 14', 'Net 30', 'Net 60']

const DEFAULT_FORMATS = {
  quotation: 'QT-{YY}{MM}{DD}-{RAND}',
  order: 'SO-{YY}{MM}{DD}-{RAND}',
  customer: 'CUS-{YY}{MM}-{RAND}',
}

function preview(format, fallback) {
  const now = new Date()
  return (format || fallback)
    .replace('{YYYY}', String(now.getFullYear()))
    .replace('{YY}', String(now.getFullYear()).slice(2))
    .replace('{MM}', String(now.getMonth() + 1).padStart(2, '0'))
    .replace('{DD}', String(now.getDate()).padStart(2, '0'))
    .replace('{RAND}', 'A1B2')
}

// Sales Settings > General. Saved per branch. Empty number formats mean "use the default".
export default function SalesGeneralSettingsPage() {
  const { branchId } = useParams()

  const [reserve, setReserve] = useState(true)
  const [vatRate, setVatRate] = useState('7.5')
  const [validDays, setValidDays] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('Due on receipt')
  const [quotationFormat, setQuotationFormat] = useState('')
  const [orderFormat, setOrderFormat] = useState('')
  const [customerFormat, setCustomerFormat] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase.rpc('get_effective_sales_settings', { p_branch: branchId })
      if (cancelled) return
      if (error || !data?.success) {
        const message = error?.message || data?.error || 'Could not load the sales settings.'
        console.error('get_effective_sales_settings failed:', error || data)
        setErrorMessage(message)
        toast.error(message)
      } else {
        setReserve(data.reserve_stock_on_order !== false)
        setVatRate(String(data.default_vat_rate ?? 7.5))
        setValidDays(data.quotation_valid_days == null ? '' : String(data.quotation_valid_days))
        setPaymentTerms(data.default_payment_terms || 'Due on receipt')
        setQuotationFormat(data.quotation_number_format || '')
        setOrderFormat(data.order_number_format || '')
        setCustomerFormat(data.customer_number_format || '')
      }
      setLoading(false)
    }
    if (branchId) load()
    return () => {
      cancelled = true
    }
  }, [branchId])

  const fail = (message) => {
    setErrorMessage(message)
    toast.error(message)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    if (vatRate === '' || Number(vatRate) < 0 || Number(vatRate) > 100) return fail('VAT rate must be between 0 and 100.')
    if (validDays !== '' && (Number(validDays) < 1 || Number(validDays) > 365 || !Number.isInteger(Number(validDays)))) {
      return fail('Quotations can be valid for 1 to 365 whole days.')
    }
    for (const [label, value] of [['Quotation', quotationFormat], ['Order', orderFormat], ['Customer', customerFormat]]) {
      if (value.trim() && !value.includes('{RAND}')) return fail(`${label} number format must contain {RAND}.`)
    }

    setSaving(true)
    const { data, error } = await supabase.rpc('save_sales_settings', {
      p_branch: branchId,
      p_values: {
        reserve_stock_on_order: reserve,
        default_vat_rate: Number(vatRate),
        quotation_valid_days: validDays === '' ? null : Number(validDays),
        default_payment_terms: paymentTerms,
        quotation_number_format: quotationFormat,
        order_number_format: orderFormat,
        customer_number_format: customerFormat,
      },
    })
    setSaving(false)
    if (error || !data?.success) {
      const message = error?.message || data?.error || 'Could not save the settings.'
      console.error('save_sales_settings failed:', error || data)
      return fail(message)
    }
    toast.success('Sales settings saved.')
  }

  if (loading) return <p className="p-4 text-xs text-muted-foreground">Loading settings...</p>

  const termOptions = TERMS.includes(paymentTerms) ? TERMS : [paymentTerms, ...TERMS]

  return (
    <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto px-1 py-3 text-xs">
      <div className="flex max-w-2xl flex-col gap-4">
        {errorMessage && <p role="alert" className="rounded-sm border border-red-200 bg-red-50 p-2 text-red-700">{errorMessage}</p>}

        <Section title="Orders and stock">
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={reserve} onChange={(event) => setReserve(event.target.checked)} className="mt-0.5 size-3.5 rounded border-gray-300 text-core focus:ring-core" />
            <span>
              <span className="font-medium text-gray-800">Reserve stock automatically</span>
              <span className="block text-muted-foreground">
                When an order is confirmed, free stock is reserved for it. Each order still has its own Reserve stock tick, which starts from this setting. When this is off, stock is reserved by hand from the order.
              </span>
            </span>
          </label>
        </Section>

        <Section title="Tax and quotations">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Default VAT rate (%)">
              <Input type="number" min="0" max="100" step="0.1" value={vatRate} onChange={(event) => setVatRate(event.target.value)} className="mt-1 h-8 text-xs" />
            </Field>
            <Field label="New quotations are valid for (days)" hint="Leave empty for no default date.">
              <Input type="number" min="1" max="365" value={validDays} onChange={(event) => setValidDays(event.target.value)} className="mt-1 h-8 text-xs" />
            </Field>
          </div>
        </Section>

        <Section title="Customers">
          <Field label="Default payment terms for new customers">
            <Select value={paymentTerms} onValueChange={setPaymentTerms}>
              <SelectTrigger className="mt-1 h-8 w-full max-w-xs text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{termOptions.map((term) => <SelectItem key={term} value={term}>{term}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </Section>

        <Section title="Document numbers">
          <p className="text-muted-foreground">
            Tags: {'{YYYY} {YY} {MM} {DD}'} for the date and {'{RAND}'} for a random code (required). Leave a box empty to use the default.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Quotations" hint={`Example: ${preview(quotationFormat, DEFAULT_FORMATS.quotation)}`}>
              <Input value={quotationFormat} onChange={(event) => setQuotationFormat(event.target.value)} placeholder={DEFAULT_FORMATS.quotation} maxLength={40} className="mt-1 h-8 text-xs" />
            </Field>
            <Field label="Sales orders" hint={`Example: ${preview(orderFormat, DEFAULT_FORMATS.order)}`}>
              <Input value={orderFormat} onChange={(event) => setOrderFormat(event.target.value)} placeholder={DEFAULT_FORMATS.order} maxLength={40} className="mt-1 h-8 text-xs" />
            </Field>
            <Field label="Customers" hint={`Example: ${preview(customerFormat, DEFAULT_FORMATS.customer)}`}>
              <Input value={customerFormat} onChange={(event) => setCustomerFormat(event.target.value)} placeholder={DEFAULT_FORMATS.customer} maxLength={40} className="mt-1 h-8 text-xs" />
            </Field>
          </div>
          <p className="text-muted-foreground">A new format applies to documents created from now on. Existing numbers do not change.</p>
        </Section>

        <div>
          <Button type="submit" className="h-8 bg-core text-xs text-white" disabled={saving}>{saving ? 'Saving...' : 'Save settings'}</Button>
        </div>
      </div>
    </form>
  )
}

function Section({ title, children }) {
  return (
    <div className="space-y-3 rounded-sm border border-border bg-card p-4">
      <p className="text-[11px] font-semibold uppercase text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <label className="block font-medium text-gray-800">
      {label}
      {children}
      {hint && <span className="mt-1 block font-normal text-muted-foreground">{hint}</span>}
    </label>
  )
}
