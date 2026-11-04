'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import CustomerPicker from '@/components/modules/sales/customer-picker'
import { QuotationStatusPill, formatDate, isQuotationExpired, useMoney } from '@/components/modules/sales/quotation-shared'

// Quotation detail and printable document. Opening it with ?print=1 (what Export as PDF
// does) opens the browser's print dialog, where "Save as PDF" is a choice.
export default function QuotationDetailPage({ quotationId }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { u, companyId, branchId } = useParams()
  const money = useMoney()
  const salesBase = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`
  const base = `${salesBase}/quotations`

  const [quotation, setQuotation] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [working, setWorking] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null) // 'reject' | 'accept' | 'delete'
  const [convertOpen, setConvertOpen] = useState(false)
  const [convertCustomer, setConvertCustomer] = useState('')
  const printedRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMessage('')
    const { data, error } = await supabase
      .from('quotations')
      .select(
        `id, quote_number, status, status_note, valid_until, sent_at, created_at, notes, currency,
         discount_type, discount_value, apply_vat, vat_rate, subtotal, discount_total, vat_total, total, document_details,
         customer:customers!quotations_customer_fkey ( id, name, customer_number, email, phone, address ),
         quotation_line_items ( id, description_snapshot, variant_label_snapshot, sku_snapshot, quantity,
                                unit_price_snapshot, discount_type, discount_value, line_total ),
         quotation_sends ( id, recipient_email, sent_at )`
      )
      .eq('id', quotationId)
      .eq('branch', branchId)
      .maybeSingle()

    if (error || !data) {
      const message = error?.message || 'Quotation not found.'
      console.error('Failed to load quotation:', error)
      setErrorMessage(message)
      toast.error(message)
      setLoading(false)
      return
    }
    setQuotation(data)

    const { data: orderRows } = await supabase
      .from('sales_orders')
      .select('id, order_number, status')
      .eq('quotation', quotationId)
      .order('created_at', { ascending: false })
    setOrders(orderRows || [])
    setLoading(false)
  }, [quotationId, branchId])

  useEffect(() => {
    if (branchId && quotationId) load()
  }, [branchId, quotationId, load])

  useEffect(() => {
    if (quotation && searchParams.get('print') === '1' && !printedRef.current) {
      printedRef.current = true
      setTimeout(() => window.print(), 400)
    }
  }, [quotation, searchParams])

  const activeOrder = orders.find((order) => order.status !== 'cancelled')
  const expired = isQuotationExpired(quotation)
  const canEdit = quotation && ['draft', 'sent'].includes(quotation.status) && !activeOrder
  const canAnswer = quotation?.status === 'sent' && !activeOrder
  const canConvert = quotation && ['sent', 'accepted'].includes(quotation.status) && !activeOrder
  const canDelete = quotation && orders.length === 0

  const runStatus = async (status) => {
    setWorking(true)
    const { data, error } = await supabase.rpc('set_quotation_status', { p_quotation: quotationId, p_status: status, p_note: null })
    setWorking(false)
    setConfirmAction(null)
    if (error || !data?.success) {
      const message = error?.message || data?.error || 'Could not update the quotation.'
      console.error('set_quotation_status failed:', error || data)
      toast.error(message)
      return
    }
    toast.success(status === 'accepted' ? 'Quotation marked as accepted.' : 'Quotation marked as rejected.')
    load()
  }

  const runDelete = async () => {
    setWorking(true)
    const { data, error } = await supabase.rpc('delete_quotation', { p_quotation: quotationId })
    setWorking(false)
    setConfirmAction(null)
    if (error || !data?.success) {
      const message = error?.message || data?.error || 'Could not delete the quotation.'
      console.error('delete_quotation failed:', error || data)
      toast.error(message)
      return
    }
    toast.success('Quotation deleted.')
    router.push(base)
  }

  const runConvert = async () => {
    const customerId = quotation.customer?.id || convertCustomer
    if (!customerId) {
      toast.error('Choose the customer for this order.')
      return
    }
    setWorking(true)
    const { data, error } = await supabase.rpc('create_sales_order_from_quotation', {
      p_quotation: quotationId,
      p_customer: customerId,
    })
    setWorking(false)
    if (error || !data?.success) {
      const message = error?.message || data?.error || 'Could not create the order.'
      console.error('create_sales_order_from_quotation failed:', error || data)
      toast.error(message)
      return
    }
    toast.success(`Order ${data.order_number} created as a draft.`)
    setConvertOpen(false)
    router.push(`${salesBase}/orders/${data.order_id}`)
  }

  const startConvert = () => {
    if (quotation.customer?.id) runConvert()
    else setConvertOpen(true)
  }

  if (loading) return <p className="p-4 text-xs text-muted-foreground">Loading quotation...</p>
  if (errorMessage || !quotation) {
    return <p role="alert" className="m-4 border border-red-200 bg-red-50 p-3 text-xs text-red-700">{errorMessage || 'Quotation not found.'}</p>
  }

  const lines = quotation.quotation_line_items || []
  const details = quotation.document_details || {}
  const hasHeader = ['business_name', 'business_address', 'business_phone', 'business_email', 'business_tax_id'].some((key) => details[key])
  const lastSend = [...(quotation.quotation_sends || [])].sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at))[0]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">{quotation.quote_number}</h2>
          <QuotationStatusPill quotation={quotation} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <Button asChild variant="outline" className="h-8 text-xs"><Link href={`${base}/${quotationId}/edit`}>Edit</Link></Button>
          )}
          <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => window.print()}>Print / PDF</Button>
          {canAnswer && (
            <>
              <Button type="button" variant="outline" className="h-8 text-xs" disabled={working} onClick={() => setConfirmAction('reject')}>Mark rejected</Button>
              <Button type="button" variant="outline" className="h-8 text-xs" disabled={working} onClick={() => setConfirmAction('accept')}>Mark accepted</Button>
            </>
          )}
          {canConvert && (
            <Button type="button" className="h-8 bg-core text-xs text-white" disabled={working} onClick={startConvert}>
              {working ? 'Creating...' : 'Convert to order'}
            </Button>
          )}
          {canDelete && (
            <Button type="button" variant="outline" className="h-8 text-xs text-red-600" disabled={working} onClick={() => setConfirmAction('delete')}>Delete</Button>
          )}
        </div>
      </div>

      {expired && (
        <p className="rounded-sm border border-amber-200 bg-amber-50 p-2 text-amber-800 print:hidden">
          This quotation expired on {formatDate(quotation.valid_until)}. The prices on it are no longer on offer; edit it with a new date or convert it only if the customer still agrees.
        </p>
      )}
      {activeOrder && (
        <p className="rounded-sm border border-border bg-muted/40 p-2 print:hidden">
          Order <Link href={`${salesBase}/orders/${activeOrder.id}`} className="font-medium text-core">{activeOrder.order_number}</Link> was made from this quotation.
        </p>
      )}

      <div className="rounded-sm border border-border bg-card p-6">
        {hasHeader && (
          <div className="mb-5 border-b border-border pb-4">
            {details.business_name && <p className="text-base font-bold text-slate-900">{details.business_name}</p>}
            {details.business_address && <p className="whitespace-pre-wrap text-muted-foreground">{details.business_address}</p>}
            {(details.business_phone || details.business_email) && (
              <p className="text-muted-foreground">{[details.business_phone, details.business_email].filter(Boolean).join(' · ')}</p>
            )}
            {details.business_tax_id && <p className="text-muted-foreground">Tax ID: {details.business_tax_id}</p>}
          </div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-base font-bold text-slate-900">Quotation</p>
            <p className="text-muted-foreground">{quotation.quote_number}</p>
          </div>
          <div className="text-right text-muted-foreground">
            <p>Date: {formatDate(quotation.sent_at || quotation.created_at)}</p>
            <p>Valid until: {formatDate(quotation.valid_until)}</p>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Prepared for</p>
          {quotation.customer ? (
            <div className="mt-1 text-sm">
              <p className="font-semibold text-foreground">{quotation.customer.name}</p>
              <p className="text-muted-foreground">{quotation.customer.customer_number}</p>
              {quotation.customer.address && <p className="text-muted-foreground">{quotation.customer.address}</p>}
              {(quotation.customer.phone || quotation.customer.email) && (
                <p className="text-muted-foreground">{[quotation.customer.phone, quotation.customer.email].filter(Boolean).join(' · ')}</p>
              )}
            </div>
          ) : (
            <p className="mt-1 text-muted-foreground">No customer chosen.</p>
          )}
        </div>

        <table className="mt-5 w-full border-collapse text-xs">
          <thead className="bg-muted text-[10px] text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Unit price</th>
              <th className="px-3 py-2 text-right font-medium">Discount</th>
              <th className="px-3 py-2 text-right font-medium">Line total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lines.map((line) => (
              <tr key={line.id}>
                <td className="px-3 py-2">
                  <p className="font-medium text-foreground">{line.description_snapshot}</p>
                  {(line.variant_label_snapshot || line.sku_snapshot) && (
                    <p className="text-[10px] text-muted-foreground">{[line.variant_label_snapshot, line.sku_snapshot].filter(Boolean).join(' · ')}</p>
                  )}
                </td>
                <td className="px-3 py-2 text-right">{Number(line.quantity)}</td>
                <td className="px-3 py-2 text-right">{money(line.unit_price_snapshot)}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  {Number(line.discount_value) > 0 ? (line.discount_type === 'percentage' ? `${Number(line.discount_value)}%` : money(line.discount_value)) : '—'}
                </td>
                <td className="px-3 py-2 text-right font-medium">{money(line.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-full max-w-xs space-y-1.5">
          <Row label="Subtotal" value={money(quotation.subtotal)} />
          {Number(quotation.discount_total) > 0 && <Row label="Discounts" value={`-${money(quotation.discount_total)}`} />}
          {quotation.apply_vat && <Row label={`VAT (${Number(quotation.vat_rate)}%)`} value={`+${money(quotation.vat_total)}`} />}
          <div className="my-2 border-t border-dashed border-border" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Total</span>
            <span className="text-xl font-bold text-slate-900">{money(quotation.total)}</span>
          </div>
        </div>

        {quotation.notes && (
          <div className="mt-5">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{quotation.notes}</p>
          </div>
        )}

        {details.bank_details && (
          <div className="mt-5">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Bank details</p>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{details.bank_details}</p>
          </div>
        )}

        {details.terms && (
          <div className="mt-5">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Terms &amp; conditions</p>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{details.terms}</p>
          </div>
        )}

        {details.footer && <p className="mt-6 border-t border-border pt-3 text-center text-muted-foreground">{details.footer}</p>}
      </div>

      {lastSend && (
        <p className="text-muted-foreground print:hidden">Last emailed to {lastSend.recipient_email} on {formatDate(lastSend.sent_at)}.</p>
      )}

      <AlertDialog open={Boolean(confirmAction)} onOpenChange={(open) => { if (!open && !working) setConfirmAction(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'delete' ? 'Delete this quotation?' : confirmAction === 'accept' ? 'Mark as accepted?' : 'Mark as rejected?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'delete'
                ? `${quotation.quote_number} will be removed for good.`
                : `${quotation.quote_number} will be closed and can no longer be edited.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={working}
              onClick={(event) => {
                event.preventDefault()
                if (confirmAction === 'delete') runDelete()
                else runStatus(confirmAction === 'accept' ? 'accepted' : 'rejected')
              }}
            >
              {working ? 'Working...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Who is this order for?</DialogTitle>
            <DialogDescription>A sales order always has a customer. This quotation has none yet.</DialogDescription>
          </DialogHeader>
          <CustomerPicker branchId={branchId} value={convertCustomer} onChange={setConvertCustomer} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConvertOpen(false)} disabled={working}>Cancel</Button>
            <Button type="button" className="bg-core text-white" onClick={runConvert} disabled={working || !convertCustomer}>
              {working ? 'Creating...' : 'Create order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}
