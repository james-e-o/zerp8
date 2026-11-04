'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { QuotationStatusPill, formatDate, useMoney, useSalesSettings } from '@/components/modules/sales/quotation-shared'

const TERMS = ['Due on receipt', 'Net 7', 'Net 14', 'Net 30', 'Net 60']

// New customer (no customerId) and customer details/edit (with customerId) in one form.
// The customer ID (CUS-...) is given by the database when the customer is saved.
export default function CustomerFormPage({ customerId = null }) {
  const router = useRouter()
  const { u, companyId, branchId } = useParams()
  const money = useMoney()
  const { settings, loaded: settingsLoaded } = useSalesSettings(branchId)
  const salesBase = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`
  const base = `${salesBase}/customers`
  const editing = Boolean(customerId)

  const [customerNumber, setCustomerNumber] = useState('')
  const [type, setType] = useState('individual')
  const [name, setName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [taxId, setTaxId] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('Due on receipt')
  const [creditLimit, setCreditLimit] = useState('')
  const [status, setStatus] = useState('active')
  const [notes, setNotes] = useState('')

  const [quotations, setQuotations] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const fail = (message, error) => {
    if (error) console.error(message, error)
    setErrorMessage(message)
    toast.error(message)
  }

  // A new customer starts with the branch's default payment terms.
  useEffect(() => {
    if (!editing && settingsLoaded && settings.default_payment_terms) setPaymentTerms(settings.default_payment_terms)
  }, [editing, settingsLoaded, settings.default_payment_terms])

  useEffect(() => {
    if (!editing) return
    let cancelled = false
    async function load() {
      const { data, error } = await supabase.from('customers').select('*').eq('id', customerId).eq('branch', branchId).maybeSingle()
      if (cancelled) return
      if (error || !data) {
        fail('Could not load this customer.', error)
        setLoading(false)
        return
      }
      setCustomerNumber(data.customer_number)
      setType(data.customer_type || 'individual')
      setName(data.name || '')
      setContactPerson(data.contact_person || '')
      setPhone(data.phone || '')
      setEmail(data.email || '')
      setAddress(data.address || '')
      setTaxId(data.tax_id || '')
      setPaymentTerms(data.payment_terms || 'Due on receipt')
      setCreditLimit(data.credit_limit == null ? '' : String(data.credit_limit))
      setStatus(data.status || 'active')
      setNotes(data.notes || '')

      const [{ data: quoteRows }, { data: orderRows }] = await Promise.all([
        supabase
          .from('quotations')
          .select('id, quote_number, status, valid_until, total')
          .eq('customer', customerId)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('sales_orders')
          .select('id, order_number, status, total, order_date')
          .eq('customer', customerId)
          .order('created_at', { ascending: false })
          .limit(10),
      ])
      if (!cancelled) {
        setQuotations(quoteRows || [])
        setOrders(orderRows || [])
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, branchId])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    if (!name.trim()) return fail(type === 'business' ? "Enter the business name." : "Enter the customer's name.")
    if (email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return fail('Enter a valid email address.')
    if (creditLimit !== '' && Number(creditLimit) < 0) return fail('Credit limit cannot be negative.')

    setSaving(true)
    const { data, error } = await supabase.rpc('save_customer', {
      p_branch: branchId,
      p_customer: customerId,
      p_values: {
        customer_type: type,
        name,
        contact_person: type === 'business' ? contactPerson : '',
        phone,
        email,
        address,
        tax_id: taxId,
        payment_terms: paymentTerms,
        credit_limit: creditLimit === '' ? null : creditLimit,
        notes,
        status,
      },
    })
    setSaving(false)
    if (error || !data?.success) {
      return fail(error?.message || data?.error || 'Could not save the customer.', error || data)
    }
    toast.success(editing ? 'Customer updated.' : `Customer ${data.customer_number} added.`)
    router.push(base)
  }

  if (loading) return <p className="p-4 text-xs text-muted-foreground">Loading customer...</p>

  const termOptions = TERMS.includes(paymentTerms) ? TERMS : [paymentTerms, ...TERMS]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">{editing ? name || 'Customer' : 'New customer'}</h2>
          <p className="text-gray-500">{editing ? customerNumber : 'The customer ID is given when you save.'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="h-8 text-xs"><Link href={base}>Cancel</Link></Button>
          <Button type="submit" form="customer-form" className="h-8 bg-core text-xs text-white" disabled={saving}>
            {saving ? 'Saving...' : editing ? 'Save changes' : 'Add customer'}
          </Button>
        </div>
      </div>

      {errorMessage && <p role="alert" className="rounded-sm border border-red-200 bg-red-50 p-2 text-red-700">{errorMessage}</p>}

      <form id="customer-form" onSubmit={handleSubmit} className="grid gap-4 rounded-sm border border-border bg-card p-5 md:grid-cols-2">
        <Field label="Type">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="mt-1 h-9 w-full text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="business">Business</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={type === 'business' ? 'Business name' : 'Full name'}>
          <Input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 h-9 text-sm" />
        </Field>
        {type === 'business' && (
          <Field label="Contact person">
            <Input value={contactPerson} onChange={(event) => setContactPerson(event.target.value)} className="mt-1 h-9 text-sm" />
          </Field>
        )}
        <Field label="Phone">
          <Input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 h-9 text-sm" />
        </Field>
        <Field label="Email">
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 h-9 text-sm" />
        </Field>
        <Field label="Tax ID (TIN)">
          <Input value={taxId} onChange={(event) => setTaxId(event.target.value)} className="mt-1 h-9 text-sm" />
        </Field>
        <Field label="Payment terms">
          <Select value={paymentTerms} onValueChange={setPaymentTerms}>
            <SelectTrigger className="mt-1 h-9 w-full text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{termOptions.map((term) => <SelectItem key={term} value={term}>{term}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Credit limit (leave empty for none)">
          <Input type="number" min="0" value={creditLimit} onChange={(event) => setCreditLimit(event.target.value)} className="mt-1 h-9 text-sm" />
        </Field>
        {editing && (
          <Field label="Status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1 h-9 w-full text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive (cannot be picked for new documents)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}
        <div className="md:col-span-2">
          <Field label="Address">
            <Textarea value={address} onChange={(event) => setAddress(event.target.value)} className="mt-1 min-h-16 text-sm" />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Notes">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Delivery instructions, preferences..." className="mt-1 min-h-16 text-sm" />
          </Field>
        </div>
      </form>

      {editing && (
        <div className="grid gap-4 md:grid-cols-2">
          <HistoryCard title="Recent quotations" empty="No quotations for this customer.">
            {quotations.map((q) => (
              <Link key={q.id} href={`${salesBase}/quotations/${q.id}`} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/40">
                <span className="font-medium text-foreground">{q.quote_number}</span>
                <span className="flex items-center gap-2 text-muted-foreground">{money(q.total)} <QuotationStatusPill quotation={q} /></span>
              </Link>
            ))}
          </HistoryCard>
          <HistoryCard title="Recent orders" empty="No orders for this customer.">
            {orders.map((o) => (
              <Link key={o.id} href={`${salesBase}/orders/${o.id}`} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/40">
                <span className="font-medium text-foreground">{o.order_number}</span>
                <span className="text-muted-foreground">{money(o.total)} · {formatDate(o.order_date)} · <span className="capitalize">{String(o.status).replace('_', ' ')}</span></span>
              </Link>
            ))}
          </HistoryCard>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return <label className="block text-xs font-medium text-gray-800">{label}{children}</label>
}

function HistoryCard({ title, empty, children }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <div className="overflow-hidden rounded-sm border border-border bg-card">
      <p className="border-b border-border bg-muted px-3 py-2 text-[10px] font-medium text-muted-foreground">{title}</p>
      {hasRows ? <div className="divide-y divide-border">{children}</div> : <p className="px-3 py-4 text-muted-foreground">{empty}</p>}
    </div>
  )
}
