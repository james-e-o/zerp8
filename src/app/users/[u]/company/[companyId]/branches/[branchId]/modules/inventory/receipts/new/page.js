'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ChevronsUpDown, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import supabase from '@/config/supabaseClient'
import { useRequestCatalog } from '@/components/modules/purchases/request-catalog'
import { useVariantNames } from '@/components/modules/purchases/purchase-catalog'
import { useBranchWarehouses } from '@/components/modules/purchases/use-branch-warehouses'
import { formatDate, formatMoney, formatQty, useBranchCurrency } from '@/components/modules/inventory/inventory-shared'
import {
  ErrorNote,
  RECEIPT_SOURCES,
  Tone,
  useFlowPaths,
  useInventoryCan,
} from '@/components/modules/inventory/receipt-shared'

// Inventory > Receipts > New receipt.
//
// Whoever stands at the door counts the goods and posts the receipt, so the
// quantities here are the count, not a copy of the supplier's delivery note.
// Everything posts into quarantine first; the Quarantine tab inspects it.
//
// Sources: purchase order (quantities are checked against the order, cost is
// the order price and cannot be edited here), gift or donation, opening
// stock, other (cost entered here).
//
// Each product line is counted once, then split into rows. A row is one
// condition (good / damaged / refused) and, for batch-tracked products, one
// batch. Refused rows are goods the driver took back: they appear on the
// receipt for purchases to see but never become stock. Damaged rows go to
// quarantine flagged as damaged on arrival. Batch:
// "new batch" (the default) or "add to an existing batch". The rows must add
// up to the count.
//
// SAVING. This page calls one database function that the receipts migration
// provides (not part of this file set yet):
//
//   rpc('save_inventory_receipt', {
//     p_branch, p_receipt (draft id or null), p_post (boolean),
//     p_payload: { header, lines, ui }
//   })  ->  { success, error, receipt_id, receipt_number }
//
//   header { source, purchase_order, warehouse, delivery_note, received_on, source_label, notes }
//   line   { purchase_order_line_item, variant, warehouse, shelf, counted_quantity, unit_cost,
//            rows: [{ quantity, condition, batch_mode, existing_batch, supplier_batch_reference,
//                     expiry_date, manufactured_on, reason, note }] }
//   ui     the form state as it stands, stored with a draft so "Continue counting" restores it exactly.

const REASONS = ['Delivery', 'Expiry', 'Production run', 'Quality grade', 'Source supplier', 'Other']
const RECEIVABLE = ['open', 'sent', 'partially_received']
const NONE = '__none__'

const newKey = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
const today = () => new Date().toISOString().slice(0, 10)

const emptyRow = (quantity = '') => ({
  key: newKey('row'),
  quantity,
  condition: 'good',
  batchMode: 'new',
  existingBatch: '',
  supplierLot: '',
  expiry: '',
  manufacturedOn: '',
  reason: 'Delivery',
  note: '',
})

// Goods the driver took back are on the receipt but never become stock, so they
// are not "received" when checking against the order.
const takenIn = (line) =>
  line.rows.reduce((sum, row) => (row.condition === 'refused' ? sum : sum + Number(row.quantity || 0)), 0)

const selectClass =
  'h-7 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-core disabled:opacity-50'

function ProductPicker({ catalog, onSelect }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="h-7 gap-2 text-xs font-normal">
          <Plus className="size-3.5" /> Add item
          <ChevronsUpDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(36rem,calc(100vw-2rem))] p-0">
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
                    onSelect(variant)
                    setOpen(false)
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
  )
}

function Labelled({ label, children, className = '' }) {
  return (
    <label className={`block text-[10px] text-gray-500 ${className}`}>
      {label}
      <div className="mt-0.5">{children}</div>
    </label>
  )
}

function NewReceiptForm() {
  const router = useRouter()
  const search = useSearchParams()
  const { branchId } = useParams()
  const { receipts: receiptsPath } = useFlowPaths()
  const currency = useBranchCurrency()
  const canCreate = useInventoryCan('create')

  const presetOrder = search.get('order') || ''
  const draftId = search.get('draft') || ''

  // Header
  const [source, setSource] = useState('purchase_order')
  const [orderId, setOrderId] = useState(presetOrder)
  const [warehouseId, setWarehouseId] = useState('')
  const [deliveryNote, setDeliveryNote] = useState('')
  const [receivedOn, setReceivedOn] = useState(today())
  const [sourceText, setSourceText] = useState('')
  const [notes, setNotes] = useState('')

  // Lines
  const [lines, setLines] = useState([])
  const [loadingLines, setLoadingLines] = useState(false)
  const [info, setInfo] = useState({}) // variant -> tracking details
  const [batchOptions, setBatchOptions] = useState({}) // variant -> existing batches
  const [shelves, setShelves] = useState([])

  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [excessHandling, setExcessHandling] = useState(null)
  const [requireDeliveryNote, setRequireDeliveryNote] = useState(false)
  const [allowedSources, setAllowedSources] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [draftLoaded, setDraftLoaded] = useState(!draftId)

  const { warehouses, defaultId } = useBranchWarehouses(branchId)
  const { catalog } = useRequestCatalog(branchId)
  const { names } = useVariantNames(lines.map((line) => line.variantId))

  const isOrderReceipt = source === 'purchase_order'
  const selectedOrder = orders.find((order) => order.id === orderId)

  // ---- loaders -------------------------------------------------------------

  useEffect(() => {
    if (!warehouseId && defaultId) setWarehouseId(defaultId)
  }, [defaultId, warehouseId])

  useEffect(() => {
    let cancelled = false
    async function loadOrders() {
      if (!branchId) return
      setOrdersLoading(true)
      const { data, error: orderError } = await supabase
        .from('purchase_orders')
        .select(
          `id, order_number, status, supplier:suppliers ( name ),
           lines:purchase_order_line_items (
             id, variant, quantity_ordered, quantity_received, quantity_delivered, unit_cost_snapshot, delivery_warehouse
           )`
        )
        .eq('branch', branchId)
        .in('status', RECEIVABLE)
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (orderError) console.error('Could not read purchase orders:', orderError)
      setOrders(data || [])
      setOrdersLoading(false)
    }
    loadOrders()
    return () => {
      cancelled = true
    }
  }, [branchId])

  useEffect(() => {
    let cancelled = false
    async function loadRules() {
      if (!branchId) return
      // Receiving rules live in Inventory settings > Receiving.
      const { data, error: ruleError } = await supabase.rpc('get_effective_inventory_settings', { p_branch: branchId })
      if (cancelled || ruleError || !data) return
      const row = Array.isArray(data) ? data[0] : data
      setExcessHandling(row?.excess_handling ?? null)
      setRequireDeliveryNote(row?.require_delivery_note === true)
      setAllowedSources(Array.isArray(row?.allowed_receipt_sources) ? row.allowed_receipt_sources : null)
    }
    loadRules()
    return () => {
      cancelled = true
    }
  }, [branchId])

  // A new receipt starts from a source this branch is allowed to receive from.
  useEffect(() => {
    if (draftId || !allowedSources || allowedSources.includes(source)) return
    setSource(allowedSources[0])
  }, [allowedSources, draftId, source])

  const warehouseKey = warehouses.map((entry) => entry.id).sort().join(',')
  useEffect(() => {
    let cancelled = false
    async function loadShelves() {
      const ids = warehouseKey ? warehouseKey.split(',') : []
      if (ids.length === 0) return
      const { data } = await supabase
        .from('warehouse_shelves')
        .select('id, code, label, warehouse')
        .in('warehouse', ids)
        .order('code', { ascending: true })
      if (!cancelled) setShelves(data || [])
    }
    loadShelves()
    return () => {
      cancelled = true
    }
  }, [warehouseKey])

  // Tracking details and existing batches for every product on the form.
  const variantKey = [...new Set(lines.map((line) => line.variantId).filter(Boolean))].sort().join(',')
  useEffect(() => {
    let cancelled = false
    async function loadInfo() {
      const ids = variantKey ? variantKey.split(',') : []
      if (ids.length === 0) return
      const { data } = await supabase
        .from('product_variants')
        .select('id, is_tracked_inventory, tracking_mode, requires_expiry')
        .in('id', ids)
      if (cancelled) return
      setInfo((previous) => {
        const next = { ...previous }
        for (const row of data || []) next[row.id] = row
        return next
      })

      const trackedIds = (data || []).filter((row) => row.tracking_mode === 'batch').map((row) => row.id)
      if (trackedIds.length === 0) return
      const { data: batchRows } = await supabase
        .from('inventory_batches')
        .select('id, variant, batch_number, supplier_batch_reference, expiry_date')
        .in('variant', trackedIds)
        .order('created_at', { ascending: false })
        .limit(500)
      if (cancelled) return
      const grouped = {}
      for (const row of batchRows || []) (grouped[row.variant] ||= []).push(row)
      setBatchOptions((previous) => ({ ...previous, ...grouped }))
    }
    loadInfo()
    return () => {
      cancelled = true
    }
  }, [variantKey])

  const isTracked = (variantId) => info[variantId]?.tracking_mode === 'batch'
  const isStocked = (variantId) => info[variantId]?.is_tracked_inventory !== false

  // Picking an order seeds one line per order line, counting what is still
  // outstanding. "Delivered" includes goods still in quarantine, so nothing is
  // expected twice while it waits to be checked.
  useEffect(() => {
    if (!isOrderReceipt || draftId) return
    if (!selectedOrder) {
      setLines((previous) => previous.filter((line) => !line.orderLineId))
      return
    }
    setLoadingLines(true)
    const seeded = (selectedOrder.lines || []).map((line) => {
      const delivered = Number(line.quantity_delivered ?? line.quantity_received ?? 0)
      const outstanding = Math.max(Number(line.quantity_ordered || 0) - delivered, 0)
      return {
        key: line.id,
        orderLineId: line.id,
        variantId: line.variant,
        ordered: Number(line.quantity_ordered || 0),
        delivered,
        outstanding,
        orderUnitCost: line.unit_cost_snapshot,
        unitCost: '',
        warehouseId: line.delivery_warehouse || '',
        shelfId: '',
        counted: outstanding > 0 ? String(outstanding) : '',
        rows: [emptyRow(outstanding > 0 ? String(outstanding) : '')],
      }
    })
    setLines((previous) => [...seeded, ...previous.filter((line) => !line.orderLineId)])
    setLoadingLines(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, orders.length, source])

  // Continue a saved draft.
  useEffect(() => {
    if (!draftId || !branchId) return
    let cancelled = false
    async function loadDraft() {
      const { data, error: draftError } = await supabase
        .from('purchase_receipts')
        .select('id, status, draft_payload')
        .eq('id', draftId)
        .eq('branch', branchId)
        .maybeSingle()
      if (cancelled) return
      if (draftError || !data || data.status !== 'draft' || !data.draft_payload?.ui) {
        setError(draftError?.message || 'This draft could not be reopened. Start a new receipt instead.')
      } else {
        const ui = data.draft_payload.ui
        setSource(ui.source || 'purchase_order')
        setOrderId(ui.orderId || '')
        setWarehouseId(ui.warehouseId || '')
        setDeliveryNote(ui.deliveryNote || '')
        setReceivedOn(ui.receivedOn || today())
        setSourceText(ui.sourceText || '')
        setNotes(ui.notes || '')
        setLines(ui.lines || [])
      }
      setDraftLoaded(true)
    }
    loadDraft()
    return () => {
      cancelled = true
    }
  }, [draftId, branchId])

  // ---- editing helpers -----------------------------------------------------

  const updateLine = (key, patch) =>
    setLines((previous) => previous.map((line) => (line.key === key ? { ...line, ...patch } : line)))

  // With a single row the row simply follows the count.
  const setCounted = (key, value) =>
    setLines((previous) =>
      previous.map((line) => {
        if (line.key !== key) return line
        const rows = line.rows.length === 1 ? [{ ...line.rows[0], quantity: value }] : line.rows
        return { ...line, counted: value, rows }
      })
    )

  const updateRow = (lineKey, rowKey, patch) =>
    setLines((previous) =>
      previous.map((line) =>
        line.key !== lineKey
          ? line
          : { ...line, rows: line.rows.map((row) => (row.key === rowKey ? { ...row, ...patch } : row)) }
      )
    )

  const addRow = (lineKey) =>
    setLines((previous) =>
      previous.map((line) => {
        if (line.key !== lineKey) return line
        const used = line.rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0)
        const left = Math.max(Number(line.counted || 0) - used, 0)
        return { ...line, rows: [...line.rows, emptyRow(left > 0 ? String(left) : '')] }
      })
    )

  const removeRow = (lineKey, rowKey) =>
    setLines((previous) =>
      previous.map((line) => {
        if (line.key !== lineKey || line.rows.length === 1) return line
        const rows = line.rows.filter((row) => row.key !== rowKey)
        return {
          ...line,
          rows: rows.length === 1 ? [{ ...rows[0], quantity: line.counted }] : rows,
        }
      })
    )

  const addItem = (variant) => {
    setLines((previous) => [
      ...previous,
      {
        key: newKey('extra'),
        orderLineId: null,
        variantId: variant.id,
        ordered: 0,
        delivered: 0,
        outstanding: 0,
        orderUnitCost: null,
        unitCost: '',
        warehouseId: '',
        shelfId: '',
        counted: '',
        rows: [emptyRow('')],
        extra: true,
      },
    ])
  }

  const removeLine = (key) => setLines((previous) => previous.filter((line) => line.key !== key))

  const switchSource = (value) => {
    setSource(value)
    setError('')
    if (value !== 'purchase_order') {
      setOrderId('')
      setLines((previous) => previous.filter((line) => !line.orderLineId))
    }
  }

  // ---- validation ----------------------------------------------------------

  const countedLines = lines.filter((line) => Number(line.counted) > 0)

  const lineProblems = useMemo(() => {
    const problems = {}
    for (const line of countedLines) {
      const list = []
      const counted = Number(line.counted)
      const total = line.rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0)
      if (Math.abs(total - counted) > 1e-9) {
        list.push(`The rows add up to ${formatQty(total)}, but ${formatQty(counted)} were counted.`)
      }
      if (line.rows.some((row) => !(Number(row.quantity) > 0))) list.push('Every row needs a quantity.')
      if (!isOrderReceipt && !(line.unitCost !== '' && Number(line.unitCost) >= 0)) {
        list.push('Enter the unit cost.')
      }
      if (isTracked(line.variantId)) {
        for (const row of line.rows) {
          if (row.condition === 'refused') continue
          if (info[line.variantId]?.requires_expiry && !row.expiry && row.batchMode === 'new') {
            list.push('This product needs an expiry date on every new batch.')
            break
          }
          if (row.batchMode === 'existing') {
            const chosen = (batchOptions[line.variantId] || []).find((batch) => batch.id === row.existingBatch)
            if (!chosen) {
              list.push('Choose the batch to add to, or keep the row as a new batch.')
              break
            }
            if (chosen.expiry_date && row.expiry && chosen.expiry_date !== row.expiry) {
              list.push(`${chosen.batch_number} expires on ${formatDate(chosen.expiry_date)}. Different expiry dates stay separate batches.`)
              break
            }
          }
        }
      }
      if (list.length) problems[line.key] = list
    }
    return problems
  }, [countedLines, isOrderReceipt, info, batchOptions])

  const excessTotal = countedLines.reduce((sum, line) => {
    if (line.extra && !line.orderLineId) return sum + takenIn(line)
    return sum + Math.max(takenIn(line) - line.outstanding, 0)
  }, 0)

  const headerProblem = () => {
    if (isOrderReceipt && !orderId) return 'Choose the purchase order these goods are for.'
    if (source === 'other' && !sourceText.trim()) return 'Say where these goods came from.'
    if (!warehouseId) return 'Choose the warehouse the goods go into.'
    if (requireDeliveryNote && !deliveryNote.trim()) return 'Enter the delivery note number. This branch requires one on every receipt.'
    if (countedLines.length === 0) return 'Count at least one item.'
    if (Object.keys(lineProblems).length > 0) return 'Fix the rows marked in red.'
    if (excessTotal > 0 && excessHandling === 'block') {
      return 'Receiving rules (Inventory settings > Receiving) do not allow excess or unexpected goods. Reduce the counts or remove those items.'
    }
    return ''
  }

  // ---- saving --------------------------------------------------------------

  const buildPayload = () => ({
    header: {
      source,
      purchase_order: isOrderReceipt ? orderId : null,
      warehouse: warehouseId,
      delivery_note: deliveryNote.trim() || null,
      received_on: receivedOn || null,
      source_label: source === 'other' ? sourceText.trim() : null,
      notes: notes.trim() || null,
    },
    lines: countedLines.map((line) => ({
      purchase_order_line_item: line.orderLineId,
      variant: line.variantId,
      warehouse: line.warehouseId || warehouseId,
      shelf: line.shelfId || null,
      counted_quantity: Number(line.counted),
      // Order receipts take the order price in the database; only the other
      // sources send a cost.
      unit_cost: isOrderReceipt ? null : Number(line.unitCost),
      rows: line.rows.map((row) => ({
        quantity: Number(row.quantity),
        condition: row.condition,
        batch_mode: isTracked(line.variantId) ? row.batchMode : null,
        existing_batch: isTracked(line.variantId) && row.batchMode === 'existing' ? row.existingBatch : null,
        supplier_batch_reference: row.supplierLot.trim() || null,
        expiry_date: row.expiry || null,
        manufactured_on: row.manufacturedOn || null,
        reason: row.reason || null,
        note: row.note.trim() || null,
      })),
    })),
    ui: { source, orderId, warehouseId, deliveryNote, receivedOn, sourceText, notes, lines },
  })

  const save = async (post) => {
    setError('')
    if (post) {
      const problem = headerProblem()
      if (problem) {
        setError(problem)
        return
      }
    }
    setSaving(true)
    const { data, error: rpcError } = await supabase.rpc('save_inventory_receipt', {
      p_branch: branchId,
      p_receipt: draftId || null,
      p_post: post,
      p_payload: buildPayload(),
    })
    setSaving(false)

    const result = Array.isArray(data) ? data[0] : data
    if (rpcError || result?.success === false) {
      setError(rpcError?.message || result?.error || 'The receipt could not be saved.')
      return
    }
    router.push(result?.receipt_id ? `${receiptsPath}/${result.receipt_id}` : `${receiptsPath}/drafts`)
  }

  // ---- render --------------------------------------------------------------

  if (!draftLoaded) return <p className="p-4 text-xs text-gray-500">Opening draft...</p>

  const nameOf = (variantId) => names[variantId]?.display || names[variantId]?.displayName || 'Item'
  const shelvesFor = (line) => shelves.filter((shelf) => shelf.warehouse === (line.warehouseId || warehouseId))

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <Labelled label="Source">
          <Select value={source} onValueChange={switchSource} disabled={!!draftId}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RECEIPT_SOURCES.filter((entry) => !allowedSources || allowedSources.includes(entry.value) || entry.value === source).map((entry) => (
                <SelectItem key={entry.value} value={entry.value} className="text-xs">
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Labelled>

        {isOrderReceipt ? (
          <Labelled label="Purchase order" className="lg:col-span-2">
            <Select value={orderId || NONE} onValueChange={(value) => setOrderId(value === NONE ? '' : value)} disabled={!!draftId}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder={ordersLoading ? 'Loading orders...' : 'Choose an order'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE} className="text-xs">
                  Choose an order
                </SelectItem>
                {orders.map((order) => (
                  <SelectItem key={order.id} value={order.id} className="text-xs">
                    {order.order_number} · {order.supplier?.name || 'Supplier'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Labelled>
        ) : source === 'other' ? (
          <Labelled label="Where it came from" className="lg:col-span-2">
            <Input value={sourceText} onChange={(event) => setSourceText(event.target.value)} className="h-7 text-xs" placeholder="e.g. Sample from a supplier visit" />
          </Labelled>
        ) : (
          <div className="lg:col-span-2" />
        )}

        <Labelled label="Warehouse">
          <Select value={warehouseId || NONE} onValueChange={(value) => setWarehouseId(value === NONE ? '' : value)}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Choose a warehouse" />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id} className="text-xs">
                  {warehouse.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Labelled>

        <Labelled label={requireDeliveryNote ? 'Delivery note no. (required)' : 'Delivery note no.'}>
          <Input value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} className="h-7 text-xs" />
        </Labelled>
        <Labelled label="Counted on">
          <Input type="date" value={receivedOn} onChange={(event) => setReceivedOn(event.target.value)} className="h-7 text-xs" />
        </Labelled>
        <Labelled label="Note" className="sm:col-span-2">
          <Input value={notes} onChange={(event) => setNotes(event.target.value)} className="h-7 text-xs" placeholder="Optional" />
        </Labelled>
      </div>

      {isOrderReceipt && selectedOrder && (
        <p className="text-xs text-gray-500">
          Supplier: <span className="text-gray-800">{selectedOrder.supplier?.name || '—'}</span>. Counts start at what is
          still outstanding. Change them to what actually arrived.
        </p>
      )}

      {loadingLines && <p className="text-xs text-gray-500">Loading order lines...</p>}

      {lines.length === 0 && !loadingLines && (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          {isOrderReceipt ? 'Choose a purchase order to start counting, or add an item below.' : 'Add the items you are counting in.'}
        </div>
      )}

      {lines.map((line) => {
        const counted = Number(line.counted || 0)
        const excess = line.extra && !line.orderLineId ? takenIn(line) : Math.max(takenIn(line) - line.outstanding, 0)
        const tracked = isTracked(line.variantId)
        const problems = lineProblems[line.key] || []
        const lineWarehouses = warehouses.length > 1
        return (
          <div key={line.key} className="rounded-lg border border-gray-200">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-100 bg-gray-50 px-3 py-2">
              <div className="min-w-[200px] flex-1">
                <p className="text-xs font-medium text-gray-800">{nameOf(line.variantId)}</p>
                <p className="text-[10px] text-gray-500">
                  {line.orderLineId
                    ? `Ordered ${formatQty(line.ordered)} · already counted in ${formatQty(line.delivered)} · outstanding ${formatQty(line.outstanding)}`
                    : isOrderReceipt
                      ? 'Not on this order'
                      : 'Counted item'}
                  {!isStocked(line.variantId) && ' · not a stocked item'}
                </p>
              </div>

              <div className="w-24">
                <Labelled label="Counted">
                  <Input
                    type="number"
                    min="0"
                    value={line.counted}
                    onChange={(event) => setCounted(line.key, event.target.value)}
                    className="h-7 text-right text-xs"
                  />
                </Labelled>
              </div>

              <div className="w-28">
                <Labelled label={isOrderReceipt && line.orderLineId ? 'Order price' : 'Unit cost'}>
                  {isOrderReceipt && line.orderLineId ? (
                    <p className="h-7 py-1.5 text-xs text-gray-700">
                      {line.orderUnitCost == null ? '—' : formatMoney(line.orderUnitCost, currency)}
                    </p>
                  ) : (
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={line.unitCost}
                      onChange={(event) => updateLine(line.key, { unitCost: event.target.value })}
                      className="h-7 text-right text-xs"
                    />
                  )}
                </Labelled>
              </div>

              {lineWarehouses && (
                <div className="w-36">
                  <Labelled label="Warehouse">
                    <select
                      className={selectClass}
                      value={line.warehouseId || warehouseId}
                      onChange={(event) => updateLine(line.key, { warehouseId: event.target.value, shelfId: '' })}
                    >
                      {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </option>
                      ))}
                    </select>
                  </Labelled>
                </div>
              )}

              {shelvesFor(line).length > 0 && (
                <div className="w-28">
                  <Labelled label="Shelf">
                    <select
                      className={selectClass}
                      value={line.shelfId}
                      onChange={(event) => updateLine(line.key, { shelfId: event.target.value })}
                    >
                      <option value="">None</option>
                      {shelvesFor(line).map((shelf) => (
                        <option key={shelf.id} value={shelf.id}>
                          {shelf.label || shelf.code}
                        </option>
                      ))}
                    </select>
                  </Labelled>
                </div>
              )}

              {excess > 0 && (
                <Tone tone={line.orderLineId ? 'amber' : 'red'}>
                  {line.orderLineId ? `Excess ${formatQty(excess)}` : 'Not on order'}
                </Tone>
              )}

              {line.extra && (
                <button type="button" onClick={() => removeLine(line.key)} className="text-gray-400 hover:text-red-600" aria-label="Remove item">
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>

            {counted > 0 && (
              <div className="space-y-2 p-3">
                {line.rows.map((row) => {
                  const options = batchOptions[line.variantId] || []
                  const existing = options.find((batch) => batch.id === row.existingBatch)
                  return (
                    <div key={row.key} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-6 lg:grid-cols-12">
                      <div className="sm:col-span-2 lg:col-span-1">
                        <Labelled label="Condition">
                          <select
                            className={selectClass}
                            value={row.condition}
                            onChange={(event) => updateRow(line.key, row.key, { condition: event.target.value })}
                          >
                            <option value="good">Good</option>
                            <option value="damaged">Damaged</option>
                            <option value="refused">Refused (not taken in)</option>
                          </select>
                        </Labelled>
                      </div>
                      <div className="lg:col-span-1">
                        <Labelled label="Qty">
                          <Input
                            type="number"
                            min="0"
                            value={row.quantity}
                            disabled={line.rows.length === 1}
                            onChange={(event) => updateRow(line.key, row.key, { quantity: event.target.value })}
                            className="h-7 text-right text-xs"
                          />
                        </Labelled>
                      </div>

                      {tracked && row.condition !== 'refused' && (
                        <>
                          <div className="sm:col-span-2 lg:col-span-2">
                            <Labelled label="Batch">
                              <select
                                className={selectClass}
                                value={row.batchMode}
                                onChange={(event) =>
                                  updateRow(line.key, row.key, { batchMode: event.target.value, existingBatch: '' })
                                }
                              >
                                <option value="new">New batch</option>
                                <option value="existing" disabled={options.length === 0}>
                                  Add to existing batch
                                </option>
                              </select>
                            </Labelled>
                          </div>

                          {row.batchMode === 'existing' ? (
                            <div className="col-span-2 sm:col-span-4 lg:col-span-5">
                              <Labelled label="Existing batch">
                                <select
                                  className={selectClass}
                                  value={row.existingBatch}
                                  onChange={(event) => {
                                    const chosen = options.find((batch) => batch.id === event.target.value)
                                    updateRow(line.key, row.key, {
                                      existingBatch: event.target.value,
                                      expiry: chosen?.expiry_date || row.expiry,
                                    })
                                  }}
                                >
                                  <option value="">Choose a batch</option>
                                  {options.map((batch) => (
                                    <option key={batch.id} value={batch.id}>
                                      {batch.batch_number}
                                      {batch.supplier_batch_reference ? ` · lot ${batch.supplier_batch_reference}` : ''}
                                      {batch.expiry_date ? ` · exp ${formatDate(batch.expiry_date)}` : ' · no expiry'}
                                    </option>
                                  ))}
                                </select>
                              </Labelled>
                              {existing && (
                                <p className="mt-0.5 text-[10px] text-gray-500">
                                  Merging only works when the expiry dates match.
                                </p>
                              )}
                            </div>
                          ) : (
                            <>
                              <div className="sm:col-span-2 lg:col-span-2">
                                <Labelled label="Supplier lot">
                                  <Input
                                    value={row.supplierLot}
                                    onChange={(event) => updateRow(line.key, row.key, { supplierLot: event.target.value })}
                                    className="h-7 text-xs"
                                    placeholder="From the label"
                                  />
                                </Labelled>
                              </div>
                              <div className="sm:col-span-2 lg:col-span-2">
                                <Labelled label={`Expiry${info[line.variantId]?.requires_expiry ? ' *' : ''}`}>
                                  <Input
                                    type="date"
                                    value={row.expiry}
                                    onChange={(event) => updateRow(line.key, row.key, { expiry: event.target.value })}
                                    className="h-7 text-xs"
                                  />
                                </Labelled>
                              </div>
                              <div className="sm:col-span-2 lg:col-span-1">
                                <Labelled label="Made on">
                                  <Input
                                    type="date"
                                    value={row.manufacturedOn}
                                    onChange={(event) => updateRow(line.key, row.key, { manufacturedOn: event.target.value })}
                                    className="h-7 text-xs"
                                  />
                                </Labelled>
                              </div>
                            </>
                          )}

                          <div className="sm:col-span-2 lg:col-span-2">
                            <Labelled label="Reason for the batch">
                              <select
                                className={selectClass}
                                value={row.reason}
                                onChange={(event) => updateRow(line.key, row.key, { reason: event.target.value })}
                              >
                                {REASONS.map((reason) => (
                                  <option key={reason} value={reason}>
                                    {reason}
                                  </option>
                                ))}
                              </select>
                            </Labelled>
                          </div>
                        </>
                      )}

                      <div className="col-span-2 sm:col-span-4 lg:col-span-2">
                        <Labelled
                          label={
                            row.condition === 'damaged'
                              ? 'What is wrong'
                              : row.condition === 'refused'
                                ? 'Why it was refused'
                                : 'Note'
                          }
                        >
                          <Input
                            value={row.note}
                            onChange={(event) => updateRow(line.key, row.key, { note: event.target.value })}
                            className="h-7 text-xs"
                          />
                        </Labelled>
                      </div>

                      <div className="flex justify-end lg:col-span-1">
                        {line.rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRow(line.key, row.key)}
                            className="mb-1 text-gray-400 hover:text-red-600"
                            aria-label="Remove row"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => addRow(line.key)}>
                    <Plus className="mr-1 size-3.5" />
                    {tracked ? 'Add batch or condition' : 'Split off damaged or refused'}
                  </Button>
                  {problems.map((problem) => (
                    <p key={problem} className="text-[11px] text-red-600">
                      {problem}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ProductPicker catalog={catalog} onSelect={addItem} />
        {excessTotal > 0 && (
          <p className="text-xs text-amber-700">
            {formatQty(excessTotal)} unit(s) are not on the order. They go to quarantine as excess for purchases to decide.
          </p>
        )}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t border-gray-200 bg-white px-4 py-2">
        {!canCreate && <span className="mr-auto text-[11px] text-gray-500">You need inventory create access to post receipts.</span>}
        <Button type="button" variant="outline" className="h-7 text-xs" disabled={saving || !canCreate} onClick={() => save(false)}>
          Save draft
        </Button>
        <Button
          type="button"
          className="h-7 bg-core text-xs text-white hover:bg-core/90"
          disabled={saving || !canCreate}
          onClick={() => save(true)}
        >
          {saving ? 'Posting...' : 'Post to quarantine'}
        </Button>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NewReceiptForm />
    </Suspense>
  )
}