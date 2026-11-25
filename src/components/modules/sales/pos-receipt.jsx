'use client'

import { useEffect, useRef, useState } from 'react'
import { Printer } from 'lucide-react'
import { toast } from 'sonner'

import supabase from '@/config/supabaseClient'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useMoney } from '@/components/modules/sales/quotation-shared'
import { formatDateTime, useBranchTimezone } from '@/components/modules/sales/pos-shared'

// The receipt: shown after a sale and on the sale's page. Prints through a small window so
// only the receipt is printed.
export function ReceiptBody({ sale, lines, payments, tz, innerRef }) {
  const money = useMoney()
  const change = payments.reduce((sum, p) => sum + Number(p.change_given || 0), 0)
  return (
    <div ref={innerRef} className="mx-auto w-full max-w-sm space-y-3 text-sm">
      <div className="text-center">
        <p className="text-base font-semibold">{sale.sale_number}</p>
        <p className="text-xs text-muted-foreground">{formatDateTime(sale.created_at, tz)}</p>
        {sale.cashier_label ? <p className="text-xs text-muted-foreground">Cashier: {sale.cashier_label}</p> : null}
      </div>
      <div className="border-y border-dashed border-border py-2">
        {lines.map((l) => (
          <div key={l.id} className="flex justify-between gap-3 py-0.5">
            <span className="min-w-0 flex-1">
              {l.description_snapshot}
              <span className="block text-xs text-muted-foreground">
                {Number(l.quantity)} × {money(l.unit_price)}
                {Number(l.discount_value) > 0 ? ` (−${Number(l.discount_value)}%)` : ''}
              </span>
            </span>
            <span className="tabular-nums">{money(l.line_total)}</span>
          </div>
        ))}
      </div>
      <div className="space-y-0.5">
        <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{money(sale.subtotal)}</span></div>
        {Number(sale.discount_total) > 0 ? <div className="flex justify-between"><span>Discount</span><span className="tabular-nums">−{money(sale.discount_total)}</span></div> : null}
        {sale.apply_vat ? <div className="flex justify-between"><span>VAT ({Number(sale.vat_rate)}%)</span><span className="tabular-nums">{money(sale.vat_total)}</span></div> : null}
        <div className="flex justify-between text-base font-semibold"><span>Total</span><span className="tabular-nums">{money(sale.total)}</span></div>
      </div>
      <div className="border-t border-dashed border-border pt-2">
        {payments.map((p) => (
          <div key={p.id} className="flex justify-between">
            <span>{p.method_name}{p.reference ? ` · ${p.reference}` : ''}</span>
            <span className="tabular-nums">{money(p.amount)}</span>
          </div>
        ))}
        {change > 0 ? <div className="flex justify-between font-medium"><span>Change given</span><span className="tabular-nums">{money(change)}</span></div> : null}
      </div>
      <p className="text-center text-xs text-muted-foreground">Thank you</p>
    </div>
  )
}

export function usePosSale(saleId) {
  const [data, setData] = useState({ loading: true, sale: null, lines: [], payments: [] })
  useEffect(() => {
    let cancelled = false
    if (!saleId) return undefined
    setData({ loading: true, sale: null, lines: [], payments: [] })
    async function load() {
      const [s, l, p] = await Promise.all([
        supabase.from('pos_sales').select('*, customers(name), pos_sessions(id, session_number)').eq('id', saleId).maybeSingle(),
        supabase.from('pos_sale_lines').select('*').eq('sale', saleId).order('position'),
        supabase.from('pos_sale_payments').select('*').eq('sale', saleId).order('created_at'),
      ])
      if (cancelled) return
      const err = s.error || l.error || p.error
      if (err) {
        console.error('Failed to load POS sale:', err)
        toast.error(err.message || 'Could not load the sale.')
      }
      setData({ loading: false, sale: s.data || null, lines: l.data || [], payments: p.data || [] })
    }
    load()
    return () => { cancelled = true }
  }, [saleId])
  return data
}

export function printReceipt(node) {
  if (!node) return
  const w = window.open('', '_blank', 'width=380,height=640')
  if (!w) {
    toast.error('Allow pop-ups to print the receipt.')
    return
  }
  w.document.write(`<html><head><title>Receipt</title><style>
    body{font-family:ui-monospace,Menlo,monospace;font-size:12px;padding:12px;color:#000}
    .flex{display:flex}.justify-between{justify-content:space-between}.text-center{text-align:center}
    .text-xs{font-size:10px}.text-base{font-size:14px}.font-semibold{font-weight:600}.block{display:block}
    .gap-3{gap:12px}.flex-1{flex:1}.border-y,.border-t{border-top:1px dashed #000}.border-y{border-bottom:1px dashed #000}
    .py-2{padding:6px 0}.pt-2{padding-top:6px}.space-y-3>*+*{margin-top:10px}
  </style></head><body>${node.outerHTML}</body></html>`)
  w.document.close()
  w.focus()
  w.print()
}

export default function ReceiptDialog({ branchId, saleId, onClose }) {
  const tz = useBranchTimezone(branchId)
  const { loading, sale, lines, payments } = usePosSale(saleId)
  const ref = useRef(null)
  return (
    <Dialog open={Boolean(saleId)} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Sale complete</DialogTitle></DialogHeader>
        {loading ? <p className="py-6 text-center text-sm text-muted-foreground">Loading receipt...</p>
          : sale ? <ReceiptBody sale={sale} lines={lines} payments={payments} tz={tz} innerRef={ref} />
          : <p className="py-6 text-center text-sm text-muted-foreground">Receipt not available.</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!sale} onClick={() => printReceipt(ref.current)}>
            <Printer className="mr-1.5 h-4 w-4" /> Print
          </Button>
          <Button type="button" size="sm" onClick={onClose}>New sale</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
