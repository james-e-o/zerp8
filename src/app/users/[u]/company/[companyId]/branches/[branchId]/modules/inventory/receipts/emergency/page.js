'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronsUpDown, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

import supabase from '@/config/supabaseClient'
import { usePurchaseCatalog } from '@/components/modules/procurement/purchase-catalog'
import EmergencyReceiptSheet from '@/components/modules/inventory/emergency-receipt-sheet'
import { formatDate, formatMoney, formatQty, useBranchCurrency, useStockNames } from '@/components/modules/inventory/inventory-shared'
import { EmptyState, ErrorNote, Tone } from '@/components/modules/inventory/receipt-shared'

// Inventory > Receipts > Emergency.
//
// Goods that arrived but are not in the product catalog. Nothing here is in
// stock. A row is only a register entry until the product exists.
//
//   open              recorded by whoever counted the goods in
//   product_drafted   Products turned it into a product draft
//   ready_to_receive  linked to a real product; count it in on a normal receipt
//   received / returned / closed   finished
//
// Who does what is enforced by the database: inventory records and marks
// received, products drafts and links, purchases returns or closes.

const STATUS = {
  open: { label: 'Open', tone: 'amber' },
  product_drafted: { label: 'Product draft made', tone: 'amber' },
  ready_to_receive: { label: 'Ready to receive', tone: 'amber' },
  received: { label: 'Received', tone: 'gray' },
  returned: { label: 'Returned', tone: 'gray' },
  closed: { label: 'Closed', tone: 'gray' },
}
const ACTIVE = ['open', 'product_drafted', 'ready_to_receive']

export default function EmergencyReceiptsPage() {
  const { branchId } = useParams()
  const currency = useBranchCurrency()
  const { catalog } = usePurchaseCatalog(branchId)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [view, setView] = useState('active')

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const [decision, setDecision] = useState(null) // { row, action }
  const [decisionNote, setDecisionNote] = useState('')
  const [linking, setLinking] = useState(null)
  const [pickedVariant, setPickedVariant] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [receiving, setReceiving] = useState(null)
  const [working, setWorking] = useState(false)

  const { variants } = useStockNames(rows.map((row) => row.variant).filter(Boolean))
  const productName = (id) => {
    const info = variants[id]
    if (!info) return 'Product'
    return info.label ? `${info.title} · ${info.label}` : info.title
  }

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    setLoadError('')
    const { data, error } = await supabase
      .from('emergency_receipts')
      .select(
        `id, status, item_name, description, quantity, unit_cost, delivery_note, location_note, notes,
         decision_note, created_at, supplier, purchase_order, variant, draft,
         vendor:suppliers ( name ),
         order:purchase_orders ( order_number )`
      )
      .eq('branch', branchId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Could not load emergency receipts:', error)
      toast.error(error.message || 'Could not load emergency receipts.')
      setLoadError(error.message || 'Could not load emergency receipts.')
      setRows([])
    } else {
      setRows(data || [])
    }
    setLoading(false)
  }, [branchId])

  useEffect(() => {
    load()
  }, [load])

  const shown = rows.filter((row) =>
    view === 'all' ? true : view === 'active' ? ACTIVE.includes(row.status) : !ACTIVE.includes(row.status)
  )

  const run = async (name, args, successText) => {
    setWorking(true)
    const { error } = await supabase.rpc(name, args)
    setWorking(false)
    if (error) {
      console.error(`${name} failed:`, error)
      toast.error(error.message || 'That did not work.')
      return false
    }
    toast.success(successText)
    load()
    return true
  }

  const makeDraft = (row) =>
    run(
      'draft_product_from_emergency_receipt',
      { p_id: row.id },
      'Product draft created. Open it from "Select draft" on the Create product page.'
    )

  const confirmDecision = async () => {
    if (!decision) return
    const ok = await run(
      'decide_emergency_receipt',
      { p_id: decision.row.id, p_action: decision.action, p_note: decisionNote },
      decision.action === 'return' ? 'Marked as returned to the supplier.' : 'Record closed.'
    )
    if (ok) {
      setDecision(null)
      setDecisionNote('')
    }
  }

  const confirmLink = async () => {
    if (!linking || !pickedVariant) return
    const ok = await run(
      'link_emergency_receipt_variant',
      { p_id: linking.id, p_variant: pickedVariant.id },
      'Linked. Count it in on a normal receipt now.'
    )
    if (ok) {
      setLinking(null)
      setPickedVariant(null)
    }
  }

  const confirmReceived = async () => {
    if (!receiving) return
    const ok = await run(
      'mark_emergency_receipt_received',
      { p_id: receiving.id, p_receipt: null },
      'Marked as received.'
    )
    if (ok) setReceiving(null)
  }

  const openAdd = () => {
    setEditing(null)
    setSheetOpen(true)
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-xs text-gray-500">
          Goods that arrived but are not in the product catalog. They are not in stock. Create the product, add it to
          the order, then count it in on a normal receipt.
        </p>
        <Button type="button" className="h-7 bg-core text-xs text-white hover:bg-core/90" onClick={openAdd}>
          <Plus className="mr-1 size-3.5" /> Add emergency item
        </Button>
      </div>

      <div className="flex gap-1.5 text-xs">
        {[
          ['active', 'Active'],
          ['finished', 'Finished'],
          ['all', 'All'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setView(value)}
            className={`rounded-md border px-2.5 py-1 ${
              view === value ? 'border-core bg-core/10 text-core' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-xs text-gray-500">Loading emergency receipts...</p>
      ) : loadError ? (
        <ErrorNote>{loadError}</ErrorNote>
      ) : shown.length === 0 ? (
        <EmptyState>Nothing here.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full min-w-[980px] text-xs">
            <thead className="bg-gray-50 text-[11px] font-medium text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-left">Supplier</th>
                <th className="px-3 py-2 text-left">Order</th>
                <th className="px-3 py-2 text-left">Kept at</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Cost</th>
                <th className="px-3 py-2 text-left">Arrived</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.map((row) => {
                const status = STATUS[row.status] || { label: row.status, tone: 'gray' }
                return (
                  <tr key={row.id} className="align-top">
                    <td className="max-w-[260px] px-3 py-2 text-[11px] text-gray-800">
                      {row.item_name}
                      {row.description && <span className="block text-[10px] text-gray-500">{row.description}</span>}
                      <span className="mt-0.5 block text-[10px] text-gray-500">{row.notes}</span>
                      {row.variant && <span className="mt-0.5 block text-[10px] text-gray-700">Product: {productName(row.variant)}</span>}
                      {row.decision_note && <span className="mt-0.5 block text-[10px] text-gray-700">Decision: {row.decision_note}</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{row.vendor?.name || '—'}</td>
                    <td className="px-3 py-2 text-gray-700">
                      {row.order?.order_number || '—'}
                      {row.delivery_note && <span className="block text-[10px] text-gray-500">Note {row.delivery_note}</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{row.location_note}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{formatQty(row.quantity)}</td>
                    <td className="px-3 py-2 text-right text-gray-900">
                      {row.unit_cost == null ? '—' : formatMoney(row.unit_cost, currency)}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{formatDate(row.created_at)}</td>
                    <td className="px-3 py-2">
                      <Tone tone={status.tone}>{status.label}</Tone>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {row.status === 'open' && (
                        <>
                          <RowButton onClick={() => { setEditing(row); setSheetOpen(true) }}>Edit</RowButton>
                          <RowButton disabled={working} onClick={() => makeDraft(row)}>Create product draft</RowButton>
                        </>
                      )}
                      {(row.status === 'open' || row.status === 'product_drafted') && (
                        <RowButton onClick={() => { setLinking(row); setPickedVariant(null) }}>Link to product</RowButton>
                      )}
                      {row.status === 'ready_to_receive' && (
                        <RowButton onClick={() => setReceiving(row)}>Mark received</RowButton>
                      )}
                      {ACTIVE.includes(row.status) && (
                        <>
                          <RowButton onClick={() => { setDecision({ row, action: 'return' }); setDecisionNote('') }}>Return</RowButton>
                          <RowButton onClick={() => { setDecision({ row, action: 'close' }); setDecisionNote('') }}>Close</RowButton>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <EmergencyReceiptSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        branchId={branchId}
        existing={editing}
        onSaved={load}
      />

      <AlertDialog open={!!decision} onOpenChange={(open) => !open && !working && setDecision(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              {decision?.action === 'return' ? 'Send this back to the supplier?' : 'Close this record?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {decision ? `${formatQty(decision.row.quantity)} × ${decision.row.item_name}. ` : ''}
              {decision?.action === 'return'
                ? 'Record that the goods are handed back. Nothing changes in stock because it was never in stock.'
                : 'Use this when the supplier keeps it or it is written off. Nothing changes in stock.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={decisionNote}
            onChange={(event) => setDecisionNote(event.target.value)}
            placeholder="Note (required)"
            className="min-h-16 text-xs"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-xs" disabled={working}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="h-7 bg-core text-xs text-white hover:bg-core/90"
              disabled={working || !decisionNote.trim()}
              onClick={(event) => { event.preventDefault(); confirmDecision() }}
            >
              {decision?.action === 'return' ? 'Mark returned' : 'Close record'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!linking} onOpenChange={(open) => !open && !working && setLinking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Link to a product</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {linking ? `${formatQty(linking.quantity)} × ${linking.item_name}. ` : ''}
              Choose the product it is now in the catalog as. After this, purchases adds it to the order and the
              goods are counted in on a normal receipt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="h-8 justify-between text-xs font-normal">
                {pickedVariant ? pickedVariant.displayName : 'Search product, variant or SKU...'}
                <ChevronsUpDown className="size-3.5 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[min(32rem,calc(100vw-3rem))] p-0">
              <Command>
                <CommandInput placeholder="Search product, variant, or SKU..." className="h-8 text-xs" />
                <CommandList>
                  <CommandEmpty>No matching product.</CommandEmpty>
                  <CommandGroup>
                    {catalog.map((variant) => (
                      <CommandItem
                        key={variant.id}
                        value={`${variant.displayName} ${variant.sku}`}
                        onSelect={() => {
                          setPickedVariant(variant)
                          setPickerOpen(false)
                        }}
                        className="text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{variant.displayName}</p>
                          <p className="text-[10px] text-muted-foreground">{variant.sku || 'No SKU'}</p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-xs" disabled={working}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="h-7 bg-core text-xs text-white hover:bg-core/90"
              disabled={working || !pickedVariant}
              onClick={(event) => { event.preventDefault(); confirmLink() }}
            >
              Link product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!receiving} onOpenChange={(open) => !open && !working && setReceiving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Mark as received?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {receiving ? `${formatQty(receiving.quantity)} × ${receiving.item_name}. ` : ''}
              Do this after the goods have been counted in on a normal receipt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-xs" disabled={working}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="h-7 bg-core text-xs text-white hover:bg-core/90"
              disabled={working}
              onClick={(event) => { event.preventDefault(); confirmReceived() }}
            >
              Mark received
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function RowButton({ children, ...props }) {
  return (
    <button
      type="button"
      className="mr-1.5 inline-flex h-7 items-center rounded-md border border-gray-300 px-2 text-[11px] text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      {...props}
    >
      {children}
    </button>
  )
}