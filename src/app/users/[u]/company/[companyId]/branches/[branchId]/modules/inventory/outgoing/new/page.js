'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronsUpDown, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { useRequestCatalog } from '@/components/modules/procurement/request-catalog'
import { useVariantNames } from '@/components/modules/procurement/purchase-catalog'
import { useBranchWarehouses } from '@/components/modules/procurement/use-branch-warehouses'
import { formatDate, formatQty } from '@/components/modules/inventory/inventory-shared'
import { OUTGOING_REASONS, OUTGOING_TYPES, reasonLabel, useAdjustmentPaths } from '@/components/modules/inventory/adjustment-shared'

// Inventory > Outgoing > New outgoing.
//
// Laid out like New receipt: a header (type, then what goes with it), the items leaving, and the
// buttons at the bottom. Four types:
//   Delivery         pick an open delivery (pending, picking or ready). Its items come from the
//                    delivery; picking and hand-over happen on the delivery page it opens.
//   Purchase return  pick an approved purchase return. Its items come from the return; confirm
//                    here that the goods were handed to the supplier and the stock leaves.
//   Write-off or sample, Gift   stock that was never sold: choose the warehouse and the items.
// Deliveries are created in Sales and purchase returns in Purchases, so a delivery or return
// must already exist; there is no way to invent one here. Transfers are not outgoing.
//
// Approval is the same switch and approvers as Adjustments. Submit posts straight away when
// approval is off, otherwise it sends the document for approval.
//
// Saving uses create_inventory_adjustment (kind 'outgoing') and save_inventory_adjustment_lines.

const NONE = '__none__'
const OUTGOING_BASE_TYPES = [
  { value: 'delivery', label: 'Delivery', text: 'Goods going to a customer. Choose the delivery that is waiting to go out.' },
  { value: 'purchase_return', label: 'Purchase return', text: 'Goods going back to a supplier. Choose the approved return that is waiting to go out.' },
  ...OUTGOING_TYPES,
]
const STAGE = { pending: 'Pending', picking: 'Picking', ready: 'Ready' }
const newKey = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
const selectClass =
  'h-7 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-core disabled:opacity-50'

const emptyRow = () => ({ key: newKey('row'), batch: '', quantity: '' })

function Labelled({ label, children, className = '' }) {
  return (
    <label className={`block text-[10px] text-gray-500 ${className}`}>
      {label}
      <div className="mt-0.5">{children}</div>
    </label>
  )
}

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

export default function NewOutgoingPage() {
  const router = useRouter()
  const { u, companyId, branchId } = useParams()
  const { writeOffs } = useAdjustmentPaths()
  const outgoingBase = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory/outgoing`

  const [type, setType] = useState('delivery')
  const [warehouseId, setWarehouseId] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState([]) // { key, variantId, reason, rows: [{ key, batch, quantity }] }
  const [info, setInfo] = useState({}) // variant -> { tracking_mode, is_tracked_inventory }
  const [onHand, setOnHand] = useState({}) // variant -> quantity in the chosen warehouse
  const [batchStock, setBatchStock] = useState({}) // variant -> [{ id, number, expiry, onHand }]
  const [saving, setSaving] = useState(false)

  const { warehouses, defaultId } = useBranchWarehouses(branchId)
  const { catalog } = useRequestCatalog(branchId)
  const { names } = useVariantNames(lines.map((line) => line.variantId))

  const reasons = OUTGOING_REASONS[type] || []
  const isDocument = type === 'delivery' || type === 'purchase_return'

  // Delivery / purchase return: the open documents to choose from, and the one chosen.
  const [documents, setDocuments] = useState([])
  const [documentId, setDocumentId] = useState('')
  const [documentLines, setDocumentLines] = useState([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const { names: returnNames } = useVariantNames(type === 'purchase_return' ? documentLines.map((line) => line.variant).filter(Boolean) : [])

  useEffect(() => {
    if (!isDocument || !branchId) return
    let cancelled = false
    async function loadDocuments() {
      setDocumentsLoading(true)
      setDocuments([])
      setDocumentId('')
      setDocumentLines([])
      if (type === 'delivery') {
        const { data, error } = await supabase
          .from('deliveries')
          .select(
            `id, delivery_number, status, planned_date, created_at,
             order:sales_orders!deliveries_sales_order_fkey ( order_number ),
             customer:customers!deliveries_customer_fkey ( name ),
             delivery_lines ( id, description_snapshot, variant_label_snapshot, quantity, quantity_picked )`
          )
          .eq('branch', branchId)
          .in('status', ['pending', 'picking', 'ready'])
          .order('created_at', { ascending: true })
        if (cancelled) return
        if (error) {
          console.error('Failed to load deliveries:', error)
          toast.error(error.message || 'Could not load deliveries.')
        } else {
          setDocuments((data || []).map((row) => ({
            id: row.id,
            label: `${row.delivery_number} · ${row.order?.order_number || 'No order'} · ${row.customer?.name || 'Customer'} · ${STAGE[row.status] || row.status}`,
            lines: (row.delivery_lines || []).map((line) => ({
              id: line.id,
              name: [line.description_snapshot, line.variant_label_snapshot].filter(Boolean).join(' - ') || 'Item',
              quantity: Number(line.quantity),
              picked: Number(line.quantity_picked),
            })),
          })))
        }
      } else {
        const { data, error } = await supabase
          .from('purchase_returns')
          .select(
            `id, return_number, approved_at, supplier:suppliers ( name ),
             purchase_return_line_items ( id, variant, quantity )`
          )
          .eq('branch', branchId)
          .eq('status', 'approved')
          .order('approved_at', { ascending: true })
        if (cancelled) return
        if (error) {
          console.error('Failed to load purchase returns:', error)
          toast.error(error.message || 'Could not load purchase returns.')
        } else {
          setDocuments((data || []).map((row) => ({
            id: row.id,
            label: `${row.return_number} · ${row.supplier?.name || 'Supplier'}`,
            lines: (row.purchase_return_line_items || []).map((line) => ({ id: line.id, variant: line.variant, quantity: Number(line.quantity) })),
          })))
        }
      }
      setDocumentsLoading(false)
    }
    loadDocuments()
    return () => { cancelled = true }
  }, [type, isDocument, branchId])

  const chosenDocument = documents.find((entry) => entry.id === documentId)
  useEffect(() => {
    setDocumentLines(chosenDocument?.lines || [])
  }, [chosenDocument])

  async function confirmReturn() {
    if (!documentId) {
      toast.error('Choose the purchase return first.')
      return
    }
    setSaving(true)
    const { data, error } = await supabase.rpc('dispatch_purchase_return', { p_return: documentId, p_note: note.trim() || null })
    setSaving(false)
    const response = Array.isArray(data) ? data[0] : data
    if (error || response?.success === false) {
      const message = error?.message || response?.error || 'Could not confirm the hand-over.'
      console.error('dispatch_purchase_return failed:', error || response)
      toast.error(message)
      return
    }
    toast.success('Confirmed as handed over. The stock has left.')
    router.push(`${outgoingBase}/returns`)
  }

  useEffect(() => {
    if (!warehouseId && defaultId) setWarehouseId(defaultId)
  }, [defaultId, warehouseId])

  // Changing the type changes the reasons that are allowed: reset every line to the first one.
  function switchType(next) {
    setType(next)
    setNote('')
    const first = OUTGOING_REASONS[next]?.[0]
    if (!first) return
    setLines((previous) => previous.map((line) => ({ ...line, reason: first })))
  }

  // Tracking details for every product on the form.
  const variantKey = [...new Set(lines.map((line) => line.variantId))].sort().join(',')
  useEffect(() => {
    let cancelled = false
    async function loadInfo() {
      const ids = variantKey ? variantKey.split(',') : []
      if (ids.length === 0) return
      const { data, error } = await supabase.from('product_variants').select('id, tracking_mode, is_tracked_inventory').in('id', ids)
      if (cancelled) return
      if (error) {
        console.error('Failed to load product tracking:', error)
        toast.error(error.message)
        return
      }
      const next = {}
      ;(data || []).forEach((row) => { next[row.id] = row })
      setInfo(next)
    }
    loadInfo()
    return () => { cancelled = true }
  }, [variantKey])

  // What is on hand in the chosen warehouse, and (batch-tracked) what each batch holds.
  useEffect(() => {
    let cancelled = false
    async function loadStock() {
      const ids = variantKey ? variantKey.split(',') : []
      if (!warehouseId || ids.length === 0) {
        setOnHand({})
        setBatchStock({})
        return
      }
      const [{ data: levels, error: levelError }, { data: batchRows, error: batchError }] = await Promise.all([
        supabase.from('inventory_levels').select('variant, quantity_on_hand').eq('warehouse', warehouseId).in('variant', ids),
        supabase
          .from('inventory_batch_levels')
          .select('variant, quantity_on_hand, batch:inventory_batches ( id, batch_number, expiry_date )')
          .eq('warehouse', warehouseId)
          .in('variant', ids)
          .gt('quantity_on_hand', 0),
      ])
      if (cancelled) return
      if (levelError || batchError) {
        console.error('Failed to load stock:', levelError || batchError)
        toast.error((levelError || batchError).message)
        return
      }
      const stock = {}
      ;(levels || []).forEach((row) => { stock[row.variant] = Number(row.quantity_on_hand) })
      setOnHand(stock)
      const batches = {}
      ;(batchRows || []).forEach((row) => {
        if (!row.batch) return
        ;(batches[row.variant] ||= []).push({ id: row.batch.id, number: row.batch.batch_number, expiry: row.batch.expiry_date, onHand: Number(row.quantity_on_hand) })
      })
      Object.values(batches).forEach((list) => list.sort((a, b) => String(a.expiry || '9999').localeCompare(String(b.expiry || '9999'))))
      setBatchStock(batches)
    }
    loadStock()
    return () => { cancelled = true }
  }, [warehouseId, variantKey])

  // The warehouse decides which batches exist, so changing it clears the batches chosen.
  function switchWarehouse(next) {
    setWarehouseId(next)
    setLines((previous) => previous.map((line) => ({ ...line, rows: line.rows.map((row) => ({ ...row, batch: '' })) })))
  }

  const isTracked = (variantId) => info[variantId]?.tracking_mode === 'batch'
  const nameOf = (variantId) => names[variantId]?.display || names[variantId]?.displayName || 'Item'

  const addItem = (variant) => {
    if (lines.some((line) => line.variantId === variant.id)) {
      toast.error('That product is already on the list. Add another batch to it instead.')
      return
    }
    setLines((previous) => [...previous, { key: newKey('line'), variantId: variant.id, reason: reasons[0], rows: [emptyRow()] }])
  }
  const removeLine = (key) => setLines((previous) => previous.filter((line) => line.key !== key))
  const updateLine = (key, patch) => setLines((previous) => previous.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  const updateRow = (lineKey, rowKey, patch) =>
    setLines((previous) =>
      previous.map((line) =>
        line.key === lineKey ? { ...line, rows: line.rows.map((row) => (row.key === rowKey ? { ...row, ...patch } : row)) } : line
      )
    )
  const addRow = (lineKey) => setLines((previous) => previous.map((line) => (line.key === lineKey ? { ...line, rows: [...line.rows, emptyRow()] } : line)))
  const removeRow = (lineKey, rowKey) =>
    setLines((previous) => previous.map((line) => (line.key === lineKey ? { ...line, rows: line.rows.filter((row) => row.key !== rowKey) } : line)))

  const totalOut = useMemo(
    () => lines.reduce((sum, line) => sum + line.rows.reduce((rowSum, row) => rowSum + Number(row.quantity || 0), 0), 0),
    [lines]
  )

  // Anything wrong with the form as it stands, as text; empty when it is fine.
  function firstProblem() {
    if (!warehouseId) return 'Pick the warehouse the stock leaves from.'
    if (lines.length === 0) return 'Add at least one item that is leaving.'
    for (const line of lines) {
      const name = nameOf(line.variantId)
      const tracked = isTracked(line.variantId)
      const filled = line.rows.filter((row) => Number(row.quantity || 0) > 0)
      if (filled.length === 0) return `Enter the quantity of ${name} that is leaving.`
      if (!line.reason) return `Pick a reason for ${name}.`
      let total = 0
      const seen = new Set()
      for (const row of filled) {
        const quantity = Number(row.quantity)
        total += quantity
        if (tracked) {
          if (!row.batch) return `Choose the batch of ${name}.`
          if (seen.has(row.batch)) return `${name}: the same batch is listed twice.`
          seen.add(row.batch)
          const batch = (batchStock[line.variantId] || []).find((entry) => entry.id === row.batch)
          if (batch && quantity > batch.onHand) return `Only ${formatQty(batch.onHand)} of batch ${batch.number} is in this warehouse.`
        }
      }
      if (onHand[line.variantId] !== undefined && total > onHand[line.variantId]) {
        return `Only ${formatQty(onHand[line.variantId])} of ${name} is on hand in this warehouse.`
      }
    }
    return ''
  }

  async function save(submit) {
    const problem = firstProblem()
    if (problem) {
      toast.error(problem)
      return
    }
    setSaving(true)

    const created = await supabase.rpc('create_inventory_adjustment', {
      p_branch: branchId,
      p_warehouse: warehouseId,
      p_kind: 'outgoing',
      p_outgoing_type: type,
      p_note: note || null,
    })
    if (created.error || !created.data?.success) {
      const message = created.error?.message || created.data?.error || 'Could not start the outgoing.'
      console.error('create_inventory_adjustment failed:', created.error || created.data)
      toast.error(message)
      setSaving(false)
      return
    }
    const documentId = created.data.adjustment_id

    // One line per product and batch; an outgoing only takes stock out, so quantities go in negative.
    const payload = lines.flatMap((line) =>
      line.rows
        .filter((row) => Number(row.quantity || 0) > 0)
        .map((row) => ({
          variant: line.variantId,
          batch: isTracked(line.variantId) ? row.batch : null,
          quantity_change: -Math.abs(Number(row.quantity)),
          reason: line.reason,
        }))
    )
    const savedLines = await supabase.rpc('save_inventory_adjustment_lines', { p_adjustment: documentId, p_lines: payload })
    if (savedLines.error || !savedLines.data?.success) {
      const message = savedLines.error?.message || savedLines.data?.error || 'Could not save the items.'
      console.error('save_inventory_adjustment_lines failed:', savedLines.error || savedLines.data)
      toast.error(`${message} The outgoing ${created.data.adjustment_number} was started; open it to fix the items.`)
      setSaving(false)
      router.push(`${writeOffs}/${documentId}`)
      return
    }

    if (!submit) {
      toast.success(`Draft ${created.data.adjustment_number} saved.`)
      setSaving(false)
      router.push(`${writeOffs}/${documentId}`)
      return
    }

    const submitted = await supabase.rpc('submit_inventory_adjustment', { p_adjustment: documentId })
    setSaving(false)
    if (submitted.error || !submitted.data?.success) {
      const message = submitted.error?.message || submitted.data?.error || 'Could not submit it.'
      console.error('submit_inventory_adjustment failed:', submitted.error || submitted.data)
      toast.error(`${message} It was saved as a draft.`)
    } else if (submitted.data.outcome === 'posted') {
      toast.success(`${created.data.adjustment_number} posted. Stock has been reduced.`)
    } else {
      toast.success(`${created.data.adjustment_number} sent for approval.`)
    }
    router.push(`${writeOffs}/${documentId}`)
  }

  return (
    <div className="flex flex-col gap-4 p-111">
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <Labelled label="Type">
          <Select value={type} onValueChange={switchType}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OUTGOING_BASE_TYPES.map((entry) => (
                <SelectItem key={entry.value} value={entry.value} className="text-xs">
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Labelled>

        {isDocument && (
          <Labelled label={type === 'delivery' ? 'Delivery' : 'Purchase return'} className="sm:col-span-2">
            <select className={selectClass} value={documentId} onChange={(event) => setDocumentId(event.target.value)} disabled={documentsLoading}>
              <option value="">
                {documentsLoading
                  ? 'Loading...'
                  : documents.length === 0
                    ? type === 'delivery' ? 'No open delivery' : 'No approved purchase return'
                    : type === 'delivery' ? 'Choose a delivery' : 'Choose a purchase return'}
              </option>
              {documents.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.label}</option>
              ))}
            </select>
          </Labelled>
        )}

        {!isDocument && (
        <Labelled label="Warehouse">
          <Select value={warehouseId || NONE} onValueChange={(value) => switchWarehouse(value === NONE ? '' : value)}>
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
        )}

        {(!isDocument || type === 'purchase_return') && (
        <Labelled label={type === 'purchase_return' ? 'Hand-over note' : type === 'gift' ? 'Who is it for, and why?' : 'Note'} className="sm:col-span-2">
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="h-7 text-xs"
            placeholder={type === 'purchase_return' ? 'Who collected it? Optional' : type === 'gift' ? 'Optional' : 'What happened, or where are the samples going? Optional'}
          />
        </Labelled>
        )}
      </div>

      <p className="text-xs text-gray-500">
        {OUTGOING_BASE_TYPES.find((entry) => entry.value === type)?.text}
        {type === 'delivery' && ' Deliveries are created in Sales.'}
        {type === 'purchase_return' && ' Returns are raised and approved in Purchases.'}
      </p>

      {isDocument && documentId && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-[10px] text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Item</th>
                <th className="px-3 py-2 text-right font-medium">Quantity</th>
                {type === 'delivery' && <th className="px-3 py-2 text-right font-medium">Picked</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {documentLines.map((line) => (
                <tr key={line.id}>
                  <td className="px-3 py-2">{type === 'delivery' ? line.name : (returnNames[line.variant]?.display || returnNames[line.variant]?.displayName || 'Item')}</td>
                  <td className="px-3 py-2 text-right">{formatQty(line.quantity)}</td>
                  {type === 'delivery' && <td className="px-3 py-2 text-right">{formatQty(line.picked)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isDocument && !documentId && !documentsLoading && (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          {documents.length === 0
            ? type === 'delivery' ? 'There is no delivery waiting to go out.' : 'There is no approved purchase return waiting to go out.'
            : `Choose the ${type === 'delivery' ? 'delivery' : 'purchase return'} that is going out.`}
        </div>
      )}

      {isDocument && (
        <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t border-gray-200 bg-white px-4 py-2">
          {type === 'delivery' ? (
            <Button
              type="button"
              className="h-7 bg-core text-xs text-white hover:bg-core/90"
              disabled={!documentId}
              onClick={() => router.push(`${outgoingBase}/${documentId}`)}
            >
              Open delivery to pick and hand over
            </Button>
          ) : (
            <Button type="button" className="h-7 bg-core text-xs text-white hover:bg-core/90" disabled={saving || !documentId} onClick={confirmReturn}>
              {saving ? 'Confirming...' : 'Confirm handed over'}
            </Button>
          )}
        </div>
      )}

      {!isDocument && lines.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          Add the items that are leaving.
        </div>
      )}

      {!isDocument && lines.map((line) => {
        const tracked = isTracked(line.variantId)
        const options = batchStock[line.variantId] || []
        const available = onHand[line.variantId]
        return (
          <div key={line.key} className="rounded-lg border border-gray-200">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-100 bg-gray-50 px-3 py-2">
              <div className="min-w-[200px] flex-1">
                <p className="text-xs font-medium text-gray-800">{nameOf(line.variantId)}</p>
                <p className="text-[10px] text-gray-500">
                  {available === undefined ? 'Checking stock...' : `${formatQty(available)} on hand in this warehouse`}
                  {tracked && ' · tracked by batch'}
                </p>
              </div>
              <div className="w-44">
                <Labelled label="Reason">
                  <select className={selectClass} value={line.reason} onChange={(event) => updateLine(line.key, { reason: event.target.value })}>
                    {reasons.map((reason) => (
                      <option key={reason} value={reason}>
                        {reasonLabel(reason)}
                      </option>
                    ))}
                  </select>
                </Labelled>
              </div>
              <button type="button" onClick={() => removeLine(line.key)} className="text-gray-400 hover:text-red-600" aria-label="Remove item">
                <Trash2 className="size-3.5" />
              </button>
            </div>

            <div className="space-y-2 p-3">
              {line.rows.map((row) => (
                <div key={row.key} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-6 lg:grid-cols-12">
                  {tracked && (
                    <div className="col-span-2 sm:col-span-4 lg:col-span-6">
                      <Labelled label="Batch">
                        <select className={selectClass} value={row.batch} onChange={(event) => updateRow(line.key, row.key, { batch: event.target.value })}>
                          <option value="">{options.length === 0 ? 'No batch has stock here' : 'Choose a batch'}</option>
                          {options.map((batch) => (
                            <option key={batch.id} value={batch.id}>
                              {batch.number}
                              {batch.expiry ? ` · exp ${formatDate(batch.expiry)}` : ' · no expiry'} · {formatQty(batch.onHand)} in stock
                            </option>
                          ))}
                        </select>
                      </Labelled>
                    </div>
                  )}
                  <div className="lg:col-span-2">
                    <Labelled label="Quantity out">
                      <Input
                        type="number"
                        min="0"
                        value={row.quantity}
                        onChange={(event) => updateRow(line.key, row.key, { quantity: event.target.value })}
                        className="h-7 text-right text-xs"
                      />
                    </Labelled>
                  </div>
                  <div className="flex justify-end lg:col-span-1">
                    {line.rows.length > 1 && (
                      <button type="button" onClick={() => removeRow(line.key, row.key)} className="mb-1 text-gray-400 hover:text-red-600" aria-label="Remove row">
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {tracked && (
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => addRow(line.key)}>
                  <Plus className="mr-1 size-3.5" />
                  Add another batch
                </Button>
              )}
            </div>
          </div>
        )
      })}

      {!isDocument && (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ProductPicker catalog={catalog} onSelect={addItem} />
        {totalOut > 0 && <p className="text-xs text-gray-600">{formatQty(totalOut)} unit(s) leaving in total.</p>}
      </div>
      )}

      {!isDocument && (
      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t border-gray-200 bg-white px-4 py-2">
        <Button type="button" variant="outline" className="h-7 text-xs" disabled={saving} onClick={() => save(false)}>
          Save draft
        </Button>
        <Button type="button" className="h-7 bg-core text-xs text-white hover:bg-core/90" disabled={saving} onClick={() => save(true)}>
          {saving ? 'Saving...' : 'Submit'}
        </Button>
      </div>
      )}
    </div>
  )
}