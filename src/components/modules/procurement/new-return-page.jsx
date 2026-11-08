'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import supabase from '@/config/supabaseClient'
import { toast } from 'sonner'
import { useVariantNames } from '@/components/modules/procurement/purchase-catalog'
import {
  Notice,
  Pill,
  SectionCard,
  inputClass,
  messageOf,
} from '@/components/modules/procurement/supplier-credit-shared'

// Goes at returns/new/page.js (wrapped in <Suspense>).
//
// Starts a return to ONE supplier. Goods come from two places:
//   In quarantine   goods that arrived but are not stock yet (excess, wrong
//                   items, damaged...). Only the quarantine balance drops.
//   Available stock goods already accepted into stock. The available
//                   balance drops when the return is dispatched.
// There is one draft per supplier: if this supplier already has a draft
// return, the chosen goods are added to it instead of starting another.
// The database re-checks everything (supplier, references required by
// Purchase settings, quantities), so this page only guides.

const OPEN_STATUSES = ['draft', 'pending_approval', 'approved']

const KIND_LABELS = {
  normal: { label: 'Matches order', className: 'bg-gray-100 text-gray-700' },
  excess: { label: 'Excess', className: 'bg-amber-100 text-amber-800' },
  wrong_item: { label: 'Wrong item', className: 'bg-red-100 text-red-800' },
  stock_damage: { label: 'Found damaged', className: 'bg-orange-100 text-orange-800' },
}

const RESOLUTION_CHOICES = [
  { value: 'credit_note', label: 'A credit note' },
  { value: 'refund', label: 'A cash refund' },
  { value: 'replacement', label: 'A replacement' },
]

export default function NewReturnPage() {
  const { u, companyId, branchId } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/returns`

  const [suppliers, setSuppliers] = useState([])
  const [supplierId, setSupplierId] = useState(searchParams.get('supplier') || '')
  const [draft, setDraft] = useState(null)
  const [holds, setHolds] = useState([])
  const [stockLines, setStockLines] = useState([])
  const [pickedHolds, setPickedHolds] = useState({}) // holdId -> qty string
  const [pickedStock, setPickedStock] = useState({}) // receipt line id -> qty string
  const [reason, setReason] = useState('')
  const [resolution, setResolution] = useState('credit_note')
  const [loadingSuppliers, setLoadingSuppliers] = useState(true)
  const [loadingGoods, setLoadingGoods] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  const { names: variantNames } = useVariantNames([
    ...holds.map((hold) => hold.variant),
    ...stockLines.map((line) => line.variant),
  ])

  useEffect(() => {
    let cancelled = false
    async function loadSuppliers() {
      const { data } = await supabase
        .from('suppliers')
        .select('id, name, status')
        .eq('company', companyId)
        .eq('branch', branchId)
        .order('name', { ascending: true })
      if (cancelled) return
      setSuppliers((data || []).filter((supplier) => supplier.status !== 'inactive'))
      setLoadingSuppliers(false)
    }
    if (companyId && branchId) loadSuppliers()
    return () => {
      cancelled = true
    }
  }, [companyId, branchId])

  useEffect(() => {
    let cancelled = false

    async function loadGoods() {
      setPickedHolds({})
      setPickedStock({})
      setHolds([])
      setStockLines([])
      setDraft(null)
      if (!supplierId) return
      setLoadingGoods(true)

      const [draftRes, holdRes, lineRes] = await Promise.all([
        supabase
          .from('purchase_returns')
          .select('id, return_number')
          .eq('branch', branchId)
          .eq('supplier', supplierId)
          .eq('status', 'draft')
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('purchase_receipt_holds')
          .select(
            `id, kind, status, quantity, note, variant,
             receipt_line:purchase_receipt_line_items (
               purchase_receipt:purchase_receipts (
                 receipt_number,
                 purchase_order:purchase_orders ( order_number, supplier )
               )
             )`
          )
          .eq('branch', branchId)
          .in('status', ['awaiting_review', 'damaged']),
        supabase
          .from('purchase_receipt_line_items')
          .select(
            `id, variant, quantity, quantity_accepted, purchase_order_line_item,
             purchase_receipt:purchase_receipts!inner (
               receipt_number, status, branch,
               purchase_order:purchase_orders ( order_number, supplier )
             )`
          )
          .eq('purchase_receipt.branch', branchId)
          .eq('purchase_receipt.status', 'posted'),
      ])

      if (cancelled) return

      const mineHolds = (holdRes.data || []).filter(
        (hold) => hold.receipt_line?.purchase_receipt?.purchase_order?.supplier === supplierId
      )
      const mineLines = (lineRes.data || []).filter(
        (line) => line.purchase_receipt?.purchase_order?.supplier === supplierId
      )

      // How much of each hold is already promised to an open return.
      let reserved = {}
      if (mineHolds.length > 0) {
        const { data: open } = await supabase
          .from('purchase_return_line_items')
          .select('hold, quantity, purchase_returns!inner(status)')
          .in('hold', mineHolds.map((hold) => hold.id))
          .in('purchase_returns.status', OPEN_STATUSES)
        for (const row of open || []) reserved[row.hold] = (reserved[row.hold] || 0) + Number(row.quantity)
      }

      // What can still go back per order line (received minus returned).
      const poIds = [...new Set(mineLines.map((line) => line.purchase_order_line_item).filter(Boolean))]
      let poRoom = {}
      if (poIds.length > 0) {
        const { data: poLines } = await supabase
          .from('purchase_order_line_items')
          .select('id, quantity_received, quantity_returned')
          .in('id', poIds)
        for (const row of poLines || []) {
          poRoom[row.id] = Math.max(Number(row.quantity_received) - Number(row.quantity_returned), 0)
        }
      }

      if (cancelled) return
      setDraft(draftRes.data?.[0] || null)
      setHolds(
        mineHolds
          .map((hold) => ({ ...hold, free: Number(hold.quantity) - (reserved[hold.id] || 0) }))
          .filter((hold) => hold.free > 0)
      )
      setStockLines(
        mineLines
          .map((line) => ({ ...line, room: poRoom[line.purchase_order_line_item] ?? null }))
          .filter((line) => line.room === null || line.room > 0)
      )
      setLoadingGoods(false)
    }

    loadGoods()
    return () => {
      cancelled = true
    }
  }, [supplierId, branchId])

  const holdLines = Object.entries(pickedHolds).filter(([, qty]) => Number(qty) > 0)
  const stockPicked = Object.entries(pickedStock).filter(([, qty]) => Number(qty) > 0)
  const total = holdLines.length + stockPicked.length

  const overHold = useMemo(
    () => holds.some((hold) => Number(pickedHolds[hold.id] || 0) > hold.free),
    [holds, pickedHolds]
  )
  const overStock = useMemo(
    () => stockLines.some((line) => line.room !== null && Number(pickedStock[line.id] || 0) > line.room),
    [stockLines, pickedStock]
  )

  const submit = async () => {
    setResult(null)
    if (!supplierId) {
      setResult({ ok: false, lines: ['Choose the supplier first.'] })
      toast.error('Choose the supplier first.')
      return
    }
    if (total === 0) {
      setResult({ ok: false, lines: ['Enter a quantity for at least one item.'] })
      toast.error('Enter a quantity for at least one item.')
      return
    }

    const lines = [
      ...holdLines.map(([hold, qty]) => ({ source: 'quarantine', hold, quantity: Number(qty) })),
      ...stockPicked.map(([id, qty]) => {
        const line = stockLines.find((item) => item.id === id)
        return {
          source: 'stock',
          variant: line.variant,
          quantity: Number(qty),
          purchase_receipt_line_item: id,
        }
      }),
    ]

    setSaving(true)
    const { data, error } = draft
      ? await supabase.rpc('add_purchase_return_lines', { p_return: draft.id, p_lines: lines })
      : await supabase.rpc('create_purchase_return', {
          p_branch: branchId,
          p_supplier: supplierId,
          p_reason: reason.trim() || null,
          p_lines: lines,
          p_resolution: resolution,
        })
    setSaving(false)

    if (error) {
      setResult({ ok: false, lines: [messageOf(error)] })
      toast.error(messageOf(error))
      return
    }
    toast.success(draft ? 'Items added to the return.' : 'Return created.')
    router.push(`${base}/${draft ? draft.id : data.return_id}`)
  }

  return (
    <div className="space-y-4 px-1 py-3 text-xs">
      <div className="flex items-center gap-2">
        <Link href={base}>
          <Button type="button" variant="outline" size="sm" className="h-7 rounded-sm text-xs">
            <ArrowLeft className="mr-1.5 size-3.5" /> Back
          </Button>
        </Link>
        <h1 className="text-sm font-semibold text-foreground">New return</h1>
      </div>

      <Notice result={result} onDismiss={() => setResult(null)} />

      <SectionCard title="Supplier">
        <div className="space-y-3 p-4">
          <label className="block max-w-sm">
            <span className="text-[10px] text-muted-foreground">Return goods to</span>
            <select
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
              className={`${inputClass} mt-1`}
              disabled={loadingSuppliers}
            >
              <option value="">{loadingSuppliers ? 'Loading...' : 'Choose a supplier...'}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </label>
          {draft && (
            <p className="rounded-sm border border-blue-200 bg-blue-50 p-2.5 text-[11px] text-blue-800">
              This supplier already has a draft return (
              <Link href={`${base}/${draft.id}`} className="underline">{draft.return_number}</Link>
              ). The goods you pick will be added to it.
            </p>
          )}
        </div>
      </SectionCard>

      {supplierId && (
        <>
          <SectionCard title="In quarantine">
            {loadingGoods ? (
              <p className="p-4 text-muted-foreground">Loading...</p>
            ) : holds.length === 0 ? (
              <p className="p-4 text-muted-foreground">Nothing from this supplier is in quarantine.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-[10px] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Item</th>
                    <th className="px-4 py-2 text-left font-medium">Receipt</th>
                    <th className="px-4 py-2 text-left font-medium">Why held</th>
                    <th className="px-4 py-2 text-right font-medium">Can return</th>
                    <th className="px-4 py-2 text-right font-medium">Return</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {holds.map((hold) => {
                    const kind = KIND_LABELS[hold.kind] || KIND_LABELS.normal
                    return (
                      <tr key={hold.id}>
                        <td className="px-4 py-2 text-foreground">{variantNames[hold.variant]?.display || '—'}</td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {hold.receipt_line?.purchase_receipt?.receipt_number || '—'}
                        </td>
                        <td className="px-4 py-2"><Pill className={kind.className}>{kind.label}</Pill></td>
                        <td className="px-4 py-2 text-right">{hold.free.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">
                          <Input
                            type="number"
                            min="0"
                            max={hold.free}
                            value={pickedHolds[hold.id] ?? ''}
                            placeholder="0"
                            onChange={(event) => setPickedHolds((prev) => ({ ...prev, [hold.id]: event.target.value }))}
                            className="ml-auto h-7 w-20 text-right text-xs"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </SectionCard>

          <SectionCard title="From available stock">
            {loadingGoods ? (
              <p className="p-4 text-muted-foreground">Loading...</p>
            ) : stockLines.length === 0 ? (
              <p className="p-4 text-muted-foreground">No received goods from this supplier can still be returned.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-[10px] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Item</th>
                    <th className="px-4 py-2 text-left font-medium">Receipt</th>
                    <th className="px-4 py-2 text-right font-medium">Received</th>
                    <th className="px-4 py-2 text-right font-medium">Can return</th>
                    <th className="px-4 py-2 text-right font-medium">Return</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stockLines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-2 text-foreground">{variantNames[line.variant]?.display || '—'}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {line.purchase_receipt?.receipt_number}
                        <span className="block text-[10px]">{line.purchase_receipt?.purchase_order?.order_number}</span>
                      </td>
                      <td className="px-4 py-2 text-right">{Number(line.quantity_accepted ?? line.quantity).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">{line.room === null ? '—' : line.room.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">
                        <Input
                          type="number"
                          min="0"
                          value={pickedStock[line.id] ?? ''}
                          placeholder="0"
                          onChange={(event) => setPickedStock((prev) => ({ ...prev, [line.id]: event.target.value }))}
                          className="ml-auto h-7 w-20 text-right text-xs"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SectionCard>

          {!draft && (
            <SectionCard title="About this return">
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] text-muted-foreground">We expect the supplier to give us</span>
                  <select value={resolution} onChange={(event) => setResolution(event.target.value)} className={`${inputClass} mt-1`}>
                    {RESOLUTION_CHOICES.map((choice) => (
                      <option key={choice.value} value={choice.value}>{choice.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-[10px] text-muted-foreground">Reason</span>
                  <Textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-16 text-xs" placeholder="Why these goods are going back" />
                </label>
              </div>
            </SectionCard>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="h-8 bg-core text-xs text-white hover:bg-core/90"
              disabled={saving || total === 0 || overHold || overStock}
              onClick={submit}
            >
              {saving ? 'Saving...' : draft ? 'Add to draft return' : 'Create draft return'}
            </Button>
            {(overHold || overStock) && (
              <span className="text-[11px] text-red-600">A quantity is more than can be returned.</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
