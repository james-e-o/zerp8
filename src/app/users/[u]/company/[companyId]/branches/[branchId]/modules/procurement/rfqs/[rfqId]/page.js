'use client'

import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

import { BranchContext } from '@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatCurrency } from '@/components/modules/procurement/dummy-data'
import { useVariantNames } from '@/components/modules/procurement/purchase-catalog'
import RfqStatusBadge from '@/components/modules/procurement/rfq-status-badge'
import {
  callRfqRpc,
  formatRfqDate,
  getRfqId,
  isRfqReadyToConvert,
} from '@/components/modules/procurement/rfq-utils'
import supabase from '@/config/supabaseClient'

export default function RfqDetailPage() {
  const { u, companyId, branchId, rfqId } = useParams()
  const router = useRouter()
  const { currentBranch } = useContext(BranchContext) || {}
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/procurement/rfqs`
  const ordersBase = `/users/${u}/company/${companyId}/branches/${branchId}/modules/procurement/orders`
  const [rfq, setRfq] = useState(null)
  const [lines, setLines] = useState([])
  const [supplier, setSupplier] = useState(null)
  const [convertedOrder, setConvertedOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [editingPrices, setEditingPrices] = useState(false)
  const [prices, setPrices] = useState({})
  const [quoteFields, setQuoteFields] = useState({
    quote_reference: '',
    valid_until: '',
    lead_time_days: '',
    payment_terms: '',
  })
  const [savingQuote, setSavingQuote] = useState(false)
  const [readyToConvert, setReadyToConvert] = useState(null)
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false)
  const [replyBy, setReplyBy] = useState('')
  const [reopening, setReopening] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [duplicating, setDuplicating] = useState(false)

  const variantIds = useMemo(() => lines.map((line) => line.variant).filter(Boolean), [lines])
  const { names: variantNames } = useVariantNames(variantIds)
  const canConvert = readyToConvert ?? isRfqReadyToConvert(lines)

  const loadRfq = useCallback(async (showLoading = true) => {
    if (!rfqId || !branchId) return
    if (showLoading) setLoading(true)
    setErrorMessage('')

    try {
      await callRfqRpc('rfq_sweep', { p_branch: branchId })
      const { data: row, error: rfqError } = await supabase
        .from('rfqs')
        .select('*')
        .eq('id', rfqId)
        .eq('branch', branchId)
        .maybeSingle()
      if (rfqError) throw rfqError
      if (!row) throw new Error('RFQ not found.')

      const { data: lineRows, error: linesError } = await supabase
        .from('rfq_line_items')
        .select('*')
        .eq('rfq', rfqId)
      if (linesError) throw linesError

      let supplierRow = null
      if (row.supplier) {
        const { data, error } = await supabase
          .from('suppliers')
          .select('id, name, email, phone, address')
          .eq('id', row.supplier)
          .maybeSingle()
        if (error) throw error
        supplierRow = data || null
      }

      let orderRow = null
      const convertedOrderId = typeof row.converted_order === 'object'
        ? row.converted_order?.id
        : row.converted_order
      if (convertedOrderId) {
        const { data, error } = await supabase
          .from('purchase_orders')
          .select('id, order_number')
          .eq('id', convertedOrderId)
          .maybeSingle()
        if (error) throw error
        orderRow = data || null
      }

      setRfq(row)
      setLines(lineRows || [])
      setSupplier(supplierRow)
      setConvertedOrder(orderRow)
      setPrices(Object.fromEntries((lineRows || []).map((line) => [
        line.id,
        line.quoted_unit_cost == null ? '' : String(line.quoted_unit_cost),
      ])))
      setQuoteFields({
        quote_reference: row.quote_reference || '',
        valid_until: row.valid_until ? String(row.valid_until).slice(0, 10) : '',
        lead_time_days: row.lead_time_days == null ? '' : String(row.lead_time_days),
        payment_terms: row.payment_terms || '',
      })
      setReadyToConvert(isRfqReadyToConvert(lineRows || []))
    } catch (error) {
      console.error('Failed to load RFQ:', error)
      const message = error.message || 'Could not load this RFQ.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [rfqId, branchId])

  useEffect(() => {
    loadRfq()
  }, [loadRfq])

  const updateQuoteField = (key, value) => {
    setQuoteFields((current) => ({ ...current, [key]: value }))
  }

  const saveQuote = async () => {
    setSavingQuote(true)
    try {
      const result = await callRfqRpc('rfq_enter_quote', {
        p_rfq: rfq.id,
        p_prices: lines.map((line) => ({
          line_id: line.id,
          quoted_unit_cost: prices[line.id] === '' ? null : Number(prices[line.id]),
        })),
        p_fields: {
          quote_reference: quoteFields.quote_reference || null,
          valid_until: quoteFields.valid_until || null,
          lead_time_days: quoteFields.lead_time_days === '' ? null : Number(quoteFields.lead_time_days),
          payment_terms: quoteFields.payment_terms || null,
        },
      })
      await loadRfq(false)
      if (typeof result?.ready_to_convert === 'boolean') {
        setReadyToConvert(result.ready_to_convert)
      }
      setEditingPrices(false)
      toast.success('Quoted prices saved')
    } catch (error) {
      console.error('Failed to save RFQ quote:', error)
      toast.error(error.message || 'Could not save quoted prices.')
    } finally {
      setSavingQuote(false)
    }
  }

  const deleteDraft = async () => {
    if (!window.confirm('Delete this draft RFQ? This cannot be undone.')) return
    try {
      await callRfqRpc('rfq_delete_draft', { p_rfq: rfq.id })
      toast.success('Draft deleted')
      router.push(base)
    } catch (error) {
      console.error('Failed to delete RFQ draft:', error)
      toast.error(error.message || 'Could not delete the draft.')
    }
  }

  const duplicateRfq = async () => {
    setDuplicating(true)
    try {
      const result = await callRfqRpc('rfq_duplicate', { p_rfq: rfq.id })
      const newRfqId = getRfqId(result)
      if (!newRfqId) throw new Error('The duplicated RFQ did not return an RFQ ID.')
      toast.success('Copied to a new draft')
      router.push(`${base}/${newRfqId}/edit`)
    } catch (error) {
      console.error('Failed to duplicate RFQ:', error)
      toast.error(error.message || 'Could not duplicate this RFQ.')
    } finally {
      setDuplicating(false)
    }
  }

  const reopenRfq = async (event) => {
    event.preventDefault()
    setReopening(true)
    try {
      await callRfqRpc('rfq_reopen', { p_rfq: rfq.id, p_reply_by: replyBy || null })
      setReopenDialogOpen(false)
      setReplyBy('')
      toast.success('RFQ reopened')
      await loadRfq(false)
    } catch (error) {
      console.error('Failed to reopen RFQ:', error)
      toast.error(error.message || 'Could not reopen this RFQ.')
    } finally {
      setReopening(false)
    }
  }

  const cancelRfq = async (event) => {
    event.preventDefault()
    if (!cancelReason.trim()) {
      toast.error('Enter a cancellation reason.')
      return
    }
    setCancelling(true)
    try {
      await callRfqRpc('rfq_cancel', { p_rfq: rfq.id, p_reason: cancelReason.trim() })
      setCancelDialogOpen(false)
      toast.success('RFQ cancelled')
      await loadRfq(false)
    } catch (error) {
      console.error('Failed to cancel RFQ:', error)
      toast.error(error.message || 'Could not cancel this RFQ.')
    } finally {
      setCancelling(false)
    }
  }

  const downloadPdf = () => {
    if (!rfq) return
    try {
      const doc = new jsPDF()
      const branch = currentBranch || {}
      const branchAddress = [branch.address, branch.city, branch.country].filter(Boolean).join(', ')
      const branchTaxId = branch.tax_id || branch.tax_identification_number || branch.business_tax_id
      let y = 16

      if (branch.logo_url?.startsWith('data:image/')) {
        doc.addImage(branch.logo_url, 14, y, 24, 16)
        y += 20
      }

      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(branch.name || 'Branch', 14, y)
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      if (branchAddress) {
        doc.text(branchAddress, 14, y)
        y += 5
      }
      const branchContact = [branch.phone, branch.email].filter(Boolean).join(' · ')
      if (branchContact) {
        doc.text(branchContact, 14, y)
        y += 5
      }
      if (branchTaxId) {
        doc.text(`Tax ID: ${branchTaxId}`, 14, y)
        y += 7
      } else {
        y += 2
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.text('Request for Quotation', 14, y)
      y += 8
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      const details = [
        `RFQ #: ${rfq.rfq_number || '—'}`,
        `Name: ${rfq.name || '—'}`,
        `Supplier: ${supplier?.name || '—'}`,
        `Reply by: ${formatRfqDate(rfq.reply_by)}`,
        `Needed by: ${formatRfqDate(rfq.needed_by)}`,
      ]
      details.forEach((detail) => {
        doc.text(detail, 14, y)
        y += 6
      })

      autoTable(doc, {
        startY: y + 1,
        head: [['Product', 'Quantity', 'Notes']],
        body: lines.map((line) => [
          variantNames[line.variant]?.display || 'Product unavailable',
          Number(line.quantity || 0).toLocaleString(),
          line.notes || '—',
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59] },
      })

      let finalY = (doc.lastAutoTable?.finalY || y) + 9
      if (rfq.notes) {
        doc.setFont('helvetica', 'bold')
        doc.text('Notes', 14, finalY)
        doc.setFont('helvetica', 'normal')
        finalY += 5
        doc.text(doc.splitTextToSize(rfq.notes, 180), 14, finalY)
        finalY += 8
      }
      if (rfq.terms) {
        doc.setFont('helvetica', 'bold')
        doc.text('Terms', 14, finalY)
        doc.setFont('helvetica', 'normal')
        finalY += 5
        doc.text(doc.splitTextToSize(rfq.terms, 180), 14, finalY)
      }

      doc.save(`${rfq.rfq_number || 'rfq'}.pdf`)
      toast.success('RFQ PDF downloaded')
    } catch (error) {
      console.error('Failed to generate RFQ PDF:', error)
      toast.error(error.message || 'Could not generate the RFQ PDF.')
    }
  }

  if (loading) return <p className="p-4 text-xs text-muted-foreground">Loading RFQ...</p>
  if (errorMessage || !rfq) return <p className="p-4 text-xs text-red-600">{errorMessage || 'RFQ not found.'}</p>

  const currency = rfq.currency || currentBranch?.base_currency || ''
  const quotedTotal = lines.reduce(
    (total, line) => total + (line.quoted_unit_cost == null ? 0 : Number(line.quoted_unit_cost) * Number(line.quantity || 0)),
    0
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-tight text-foreground">{rfq.name || 'RFQ'}</h1>
            <RfqStatusBadge status={rfq.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{rfq.rfq_number || '—'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {rfq.status === 'draft' && (
            <>
              <Button variant="outline" className="h-7 text-xs" onClick={() => router.push(`${base}/${rfq.id}/edit`)}>Edit</Button>
              <Button variant="destructive" className="h-7 text-xs" onClick={deleteDraft}>Delete</Button>
            </>
          )}
          {rfq.status === 'open' && (
            <>
              <Button variant="outline" className="h-7 text-xs" onClick={downloadPdf}>Download PDF</Button>
              <Button variant="outline" className="h-7 text-xs" onClick={() => setEditingPrices((current) => !current)}>
                {editingPrices ? 'Close prices' : 'Enter prices'}
              </Button>
              <Button
                className="h-7 bg-core text-xs text-white"
                disabled={!canConvert || editingPrices}
                title={editingPrices ? 'Save quoted prices before converting.' : !canConvert ? 'Enter a quoted price for every line first.' : undefined}
                onClick={() => router.push(`${ordersBase}/new?fromRfq=${encodeURIComponent(rfq.id)}`)}
              >
                Convert to PO
              </Button>
              <Button variant="outline" className="h-7 text-xs" onClick={duplicateRfq} disabled={duplicating}>
                {duplicating ? 'Copying...' : 'Duplicate'}
              </Button>
              <Button variant="outline" className="h-7 text-xs" onClick={() => setCancelDialogOpen(true)}>Cancel</Button>
              <Button variant="outline" className="h-7 text-xs" disabled title="Coming soon">Send</Button>
            </>
          )}
          {rfq.status === 'lost' && (
            <>
              <Button variant="outline" className="h-7 text-xs" onClick={() => setReopenDialogOpen(true)}>Reopen</Button>
              <Button variant="outline" className="h-7 text-xs" onClick={duplicateRfq} disabled={duplicating}>Duplicate</Button>
              <Button variant="outline" className="h-7 text-xs" onClick={() => setCancelDialogOpen(true)}>Cancel</Button>
            </>
          )}
          {['converted', 'cancelled'].includes(rfq.status) && (
            <Button variant="outline" className="h-7 text-xs" onClick={duplicateRfq} disabled={duplicating}>Duplicate</Button>
          )}
        </div>
      </header>

      <section className="rounded-sm border border-border bg-card">
        <dl className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-[10px] text-muted-foreground">Supplier</dt><dd className="mt-1 text-xs font-medium text-foreground">{supplier?.name || '—'}</dd></div>
          <div><dt className="text-[10px] text-muted-foreground">Reply by</dt><dd className="mt-1 text-xs font-medium text-foreground">{formatRfqDate(rfq.reply_by)}</dd></div>
          <div><dt className="text-[10px] text-muted-foreground">Needed by</dt><dd className="mt-1 text-xs font-medium text-foreground">{formatRfqDate(rfq.needed_by)}</dd></div>
          <div><dt className="text-[10px] text-muted-foreground">Created</dt><dd className="mt-1 text-xs font-medium text-foreground">{formatRfqDate(rfq.created_at)}</dd></div>
          {rfq.status === 'lost' && (
            <div><dt className="text-[10px] text-muted-foreground">Lost on</dt><dd className="mt-1 text-xs font-medium text-foreground">{formatRfqDate(rfq.lost_at || rfq.updated_at)}</dd></div>
          )}
          {rfq.status === 'cancelled' && (
            <div className="sm:col-span-2"><dt className="text-[10px] text-muted-foreground">Cancel reason</dt><dd className="mt-1 whitespace-pre-wrap text-xs text-foreground">{rfq.cancel_reason || rfq.cancellation_reason || '—'}</dd></div>
          )}
          {rfq.status === 'converted' && convertedOrder && (
            <div><dt className="text-[10px] text-muted-foreground">Purchase order</dt><dd className="mt-1 text-xs font-medium">
              <Link href={`${ordersBase}/${convertedOrder.id}`} className="text-core hover:underline">
                {convertedOrder.order_number || convertedOrder.id}
              </Link>
            </dd></div>
          )}
          <div><dt className="text-[10px] text-muted-foreground">Quoted total</dt><dd className="mt-1 text-xs font-medium text-foreground">{lines.some((line) => line.quoted_unit_cost != null) ? formatCurrency(quotedTotal, currency) : '—'}</dd></div>
        </dl>
        {(rfq.notes || rfq.terms) && (
          <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
            {rfq.notes && <div><p className="text-[10px] text-muted-foreground">Notes</p><p className="mt-1 whitespace-pre-wrap text-xs text-foreground">{rfq.notes}</p></div>}
            {rfq.terms && <div><p className="text-[10px] text-muted-foreground">Terms</p><p className="mt-1 whitespace-pre-wrap text-xs text-foreground">{rfq.terms}</p></div>}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-sm border border-border bg-card">
        <h2 className="border-b border-border bg-muted px-4 py-2.5 text-xs font-semibold text-foreground">RFQ lines</h2>
        <div className="overflow-auto">
          <table className="w-full min-w-[700px] border-collapse text-left text-xs">
            <thead className="bg-muted text-[10px] font-semibold uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Quantity</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2">Quoted price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-3 py-2 text-foreground">{variantNames[line.variant]?.display || 'Loading product...'}</td>
                  <td className="px-3 py-2 text-foreground">{Number(line.quantity || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-muted-foreground">{line.notes || '—'}</td>
                  <td className="px-3 py-2">
                    {editingPrices && rfq.status === 'open' ? (
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">{currency}</span>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={prices[line.id] ?? ''}
                          onChange={(event) => setPrices((current) => ({ ...current, [line.id]: event.target.value }))}
                          className="h-7 w-32 text-xs"
                          aria-label={`Quoted price for ${variantNames[line.variant]?.display || 'line'}`}
                        />
                      </div>
                    ) : line.quoted_unit_cost == null ? '—' : formatCurrency(Number(line.quoted_unit_cost), currency)}
                  </td>
                </tr>
              ))}
              {lines.length === 0 && <tr><td colSpan={4} className="px-3 py-5 text-center text-muted-foreground">No lines.</td></tr>}
            </tbody>
          </table>
        </div>
        {editingPrices && rfq.status === 'open' && (
          <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-[11px] font-medium text-foreground">Quote reference
              <Input value={quoteFields.quote_reference} onChange={(event) => updateQuoteField('quote_reference', event.target.value)} className="mt-1 h-8 text-xs" />
            </label>
            <label className="text-[11px] font-medium text-foreground">Valid until
              <Input type="date" value={quoteFields.valid_until} onChange={(event) => updateQuoteField('valid_until', event.target.value)} className="mt-1 h-8 text-xs" />
            </label>
            <label className="text-[11px] font-medium text-foreground">Lead time (days)
              <Input type="number" min="0" step="1" value={quoteFields.lead_time_days} onChange={(event) => updateQuoteField('lead_time_days', event.target.value)} className="mt-1 h-8 text-xs" />
            </label>
            <label className="text-[11px] font-medium text-foreground">Payment terms
              <Input value={quoteFields.payment_terms} onChange={(event) => updateQuoteField('payment_terms', event.target.value)} className="mt-1 h-8 text-xs" />
            </label>
            <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-4">
              <Button variant="outline" className="h-7 text-xs" disabled={savingQuote} onClick={() => setEditingPrices(false)}>Discard</Button>
              <Button className="h-7 bg-core text-xs text-white" disabled={savingQuote} onClick={saveQuote}>
                {savingQuote ? 'Saving...' : 'Save prices'}
              </Button>
            </div>
          </div>
        )}
      </section>

      {rfq.status === 'lost' && (
        <p className="text-xs text-muted-foreground">Lost on {formatRfqDate(rfq.lost_at || rfq.updated_at)}.</p>
      )}

      {rfq.status === 'converted' && convertedOrder && (
        <p className="text-xs text-muted-foreground">
          Converted to <Link href={`${ordersBase}/${convertedOrder.id}`} className="text-core hover:underline">{convertedOrder.order_number || 'purchase order'}</Link>.
        </p>
      )}

      <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen RFQ</DialogTitle>
            <DialogDescription>Choose a new reply-by date, or leave it blank to use the default period.</DialogDescription>
          </DialogHeader>
          <form onSubmit={reopenRfq} className="space-y-4">
            <label className="block text-xs font-medium text-foreground">Reply by
              <Input type="date" value={replyBy} onChange={(event) => setReplyBy(event.target.value)} className="mt-1 h-8 text-xs" />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="h-7 text-xs" onClick={() => setReopenDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="h-7 bg-core text-xs text-white" disabled={reopening}>{reopening ? 'Reopening...' : 'Reopen RFQ'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel RFQ</DialogTitle>
            <DialogDescription>Enter a reason for cancelling this RFQ.</DialogDescription>
          </DialogHeader>
          <form onSubmit={cancelRfq} className="space-y-4">
            <label className="block text-xs font-medium text-foreground">Reason <span className="text-red-500">*</span>
              <Textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className="mt-1 text-xs" rows={3} />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="h-7 text-xs" onClick={() => setCancelDialogOpen(false)}>Keep RFQ</Button>
              <Button type="submit" variant="destructive" className="h-7 text-xs" disabled={cancelling || !cancelReason.trim()}>{cancelling ? 'Cancelling...' : 'Cancel RFQ'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
