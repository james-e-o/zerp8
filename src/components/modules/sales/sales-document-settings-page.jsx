'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const EMPTY = {
  business_name: '',
  business_address: '',
  business_phone: '',
  business_email: '',
  business_tax_id: '',
  bank_details: '',
  quotation_terms: '',
  document_footer: '',
}

const LIMITS = {
  business_name: 120,
  business_address: 300,
  business_phone: 60,
  business_email: 120,
  business_tax_id: 60,
  bank_details: 500,
  quotation_terms: 1500,
  document_footer: 200,
}

// Sales Settings > Documents. What is printed on every quotation sent from this branch.
// A copy is saved on each quotation when it is created, so changing this later does not
// alter quotations that were already sent.
export default function SalesDocumentSettingsPage() {
  const { branchId } = useParams()
  const [values, setValues] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase.rpc('get_effective_sales_settings', { p_branch: branchId })
      if (cancelled) return
      if (error || !data?.success) {
        const message = error?.message || data?.error || 'Could not load the document details.'
        console.error('get_effective_sales_settings failed:', error || data)
        setErrorMessage(message)
        toast.error(message)
      } else {
        setValues(Object.fromEntries(Object.keys(EMPTY).map((key) => [key, data[key] || ''])))
      }
      setLoading(false)
    }
    if (branchId) load()
    return () => {
      cancelled = true
    }
  }, [branchId])

  const set = (key) => (event) => setValues((current) => ({ ...current, [key]: event.target.value }))

  const fail = (message) => {
    setErrorMessage(message)
    toast.error(message)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    if (values.business_email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.business_email.trim())) {
      return fail('Enter a valid business email address.')
    }
    setSaving(true)
    const { data, error } = await supabase.rpc('save_sales_document_details', { p_branch: branchId, p_values: values })
    setSaving(false)
    if (error || !data?.success) {
      const message = error?.message || data?.error || 'Could not save the document details.'
      console.error('save_sales_document_details failed:', error || data)
      return fail(message)
    }
    toast.success('Document details saved.')
  }

  if (loading) return <p className="p-4 text-xs text-muted-foreground">Loading document details...</p>

  return (
    <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto px-1 py-3 text-xs">
      <div className="flex max-w-2xl flex-col gap-4">
        {errorMessage && <p role="alert" className="rounded-sm border border-red-200 bg-red-50 p-2 text-red-700">{errorMessage}</p>}

        <p className="text-muted-foreground">
          This is printed on every quotation from this branch, in the PDF and on the quotation page. A copy is saved on each quotation when it is created, so quotations already sent keep the details they were sent with.
        </p>

        <Section title="Business details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name" counter={`${values.business_name.length}/${LIMITS.business_name}`}>
              <Input value={values.business_name} onChange={set('business_name')} maxLength={LIMITS.business_name} className="mt-1 h-8 text-xs" />
            </Field>
            <Field label="Tax ID (TIN)">
              <Input value={values.business_tax_id} onChange={set('business_tax_id')} maxLength={LIMITS.business_tax_id} className="mt-1 h-8 text-xs" />
            </Field>
            <Field label="Phone">
              <Input value={values.business_phone} onChange={set('business_phone')} maxLength={LIMITS.business_phone} className="mt-1 h-8 text-xs" />
            </Field>
            <Field label="Email">
              <Input type="email" value={values.business_email} onChange={set('business_email')} maxLength={LIMITS.business_email} className="mt-1 h-8 text-xs" />
            </Field>
          </div>
          <Field label="Address" counter={`${values.business_address.length}/${LIMITS.business_address}`}>
            <Textarea value={values.business_address} onChange={set('business_address')} maxLength={LIMITS.business_address} rows={2} className="mt-1 field-sizing-fixed min-h-12 resize-y text-xs" />
          </Field>
        </Section>

        <Section title="Bank details">
          <Field label="Where customers should pay" counter={`${values.bank_details.length}/${LIMITS.bank_details}`}>
            <Textarea value={values.bank_details} onChange={set('bank_details')} maxLength={LIMITS.bank_details} rows={3} placeholder="Bank, account name, account number..." className="mt-1 field-sizing-fixed min-h-16 resize-y text-xs" />
          </Field>
        </Section>

        <Section title="Terms and footer">
          <Field label="Terms & conditions" counter={`${values.quotation_terms.length}/${LIMITS.quotation_terms}`}>
            <Textarea value={values.quotation_terms} onChange={set('quotation_terms')} maxLength={LIMITS.quotation_terms} rows={5} placeholder="Payment terms, delivery terms, how long prices hold..." className="mt-1 field-sizing-fixed min-h-24 resize-y text-xs" />
          </Field>
          <Field label="Footer line" counter={`${values.document_footer.length}/${LIMITS.document_footer}`}>
            <Input value={values.document_footer} onChange={set('document_footer')} maxLength={LIMITS.document_footer} placeholder="Thank you for your business." className="mt-1 h-8 text-xs" />
          </Field>
        </Section>

        <div>
          <Button type="submit" className="h-8 bg-core text-xs text-white" disabled={saving}>{saving ? 'Saving...' : 'Save document details'}</Button>
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

function Field({ label, counter, children }) {
  return (
    <label className="block font-medium text-gray-800">
      <span className="flex items-center justify-between">
        {label}
        {counter && <span className="font-normal text-muted-foreground">{counter}</span>}
      </span>
      {children}
    </label>
  )
}
