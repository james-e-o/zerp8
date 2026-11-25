'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'

import supabase from '@/config/supabaseClient'

// Records goods that arrived but are not in the product catalog.
//
// This is NOT a receipt: nothing goes into stock and no cost is recorded in
// the ledger. It is a register entry so the goods are not forgotten while the
// product is created. The same sheet is used from the New receipt page and from
// Inventory > Receipts > Emergency. It slides in from the right on larger
// screens and up from the bottom on phones.
//
// Saving calls record_emergency_receipt() (or update_emergency_receipt() when
// `existing` is passed). The database checks inventory edit permission.

const NONE = '__none__'

function Labelled({ label, children, className = '' }) {
  return (
    <label className={`block text-[11px] text-gray-600 ${className}`}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  )
}

function useIsPhone() {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const update = () => setPhone(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return phone
}

export default function EmergencyReceiptSheet({
  open,
  onOpenChange,
  branchId,
  defaultOrderId = '',
  defaultSupplierId = '',
  defaultDeliveryNote = '',
  existing = null,
  onSaved,
}) {
  const phone = useIsPhone()

  const [suppliers, setSuppliers] = useState([])
  const [orders, setOrders] = useState([])
  const [supplier, setSupplier] = useState('')
  const [orderId, setOrderId] = useState('')
  const [deliveryNote, setDeliveryNote] = useState('')
  const [itemName, setItemName] = useState('')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Fill the form each time the sheet opens.
  useEffect(() => {
    if (!open) return
    setFormError('')
    if (existing) {
      setSupplier(existing.supplier || '')
      setOrderId(existing.purchase_order || '')
      setDeliveryNote(existing.delivery_note || '')
      setItemName(existing.item_name || '')
      setDescription(existing.description || '')
      setQuantity(existing.quantity == null ? '' : String(existing.quantity))
      setUnitCost(existing.unit_cost == null ? '' : String(existing.unit_cost))
      setLocation(existing.location_note || '')
      setNotes(existing.notes || '')
    } else {
      setSupplier(defaultSupplierId || '')
      setOrderId(defaultOrderId || '')
      setDeliveryNote(defaultDeliveryNote || '')
      setItemName('')
      setDescription('')
      setQuantity('')
      setUnitCost('')
      setLocation('')
      setNotes('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id])

  useEffect(() => {
    if (!open || !branchId) return
    let cancelled = false
    async function load() {
      const [supplierResult, orderResult] = await Promise.all([
        supabase.from('suppliers').select('id, name').order('name', { ascending: true }),
        supabase
          .from('purchase_orders')
          .select('id, order_number, supplier')
          .eq('branch', branchId)
          .order('created_at', { ascending: false })
          .limit(200),
      ])
      if (cancelled) return
      if (supplierResult.error) {
        console.error('Could not read suppliers:', supplierResult.error)
        toast.error('Could not load suppliers.')
      }
      if (orderResult.error) {
        console.error('Could not read purchase orders:', orderResult.error)
        toast.error('Could not load purchase orders.')
      }
      setSuppliers(supplierResult.data || [])
      setOrders(orderResult.data || [])
    }
    load()
    return () => {
      cancelled = true
    }
  }, [open, branchId])

  const pickOrder = (value) => {
    const next = value === NONE ? '' : value
    setOrderId(next)
    const order = orders.find((entry) => entry.id === next)
    if (order?.supplier) setSupplier(order.supplier)
  }

  const visibleOrders = supplier ? orders.filter((order) => order.supplier === supplier) : orders

  const problem = () => {
    if (!supplier) return 'Choose the supplier.'
    if (!itemName.trim()) return 'Enter the name of the item.'
    if (!(Number(quantity) > 0)) return 'Enter the quantity.'
    if (unitCost !== '' && !(Number(unitCost) >= 0)) return 'The cost cannot be negative.'
    if (!location.trim()) return 'Say where the goods are being kept.'
    if (notes.trim().length < 10) return 'Explain where the item came from and why it is not in the catalog (at least 10 characters).'
    return ''
  }

  const save = async () => {
    const message = problem()
    setFormError(message)
    if (message) {
      toast.error(message)
      return
    }

    setSaving(true)
    const cost = unitCost === '' ? null : Number(unitCost)
    const { error } = existing
      ? await supabase.rpc('update_emergency_receipt', {
          p_id: existing.id,
          p_delivery_note: deliveryNote,
          p_item_name: itemName,
          p_description: description,
          p_quantity: Number(quantity),
          p_unit_cost: cost,
          p_location_note: location,
          p_notes: notes,
        })
      : await supabase.rpc('record_emergency_receipt', {
          p_branch: branchId,
          p_supplier: supplier,
          p_purchase_order: orderId || null,
          p_delivery_note: deliveryNote,
          p_item_name: itemName,
          p_description: description,
          p_quantity: Number(quantity),
          p_unit_cost: cost,
          p_location_note: location,
          p_notes: notes,
        })
    setSaving(false)

    if (error) {
      console.error('Could not save the emergency receipt:', error)
      setFormError(error.message || 'Could not save.')
      toast.error(error.message || 'Could not save.')
      return
    }

    toast.success(existing ? 'Emergency receipt updated.' : 'Emergency receipt recorded. It is not in stock yet.')
    onOpenChange(false)
    onSaved?.()
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <SheetContent
        side={phone ? 'bottom' : 'right'}
        className={phone ? 'max-h-[92vh] overflow-y-auto' : 'w-full overflow-y-auto sm:max-w-md'}
      >
        <SheetHeader>
          <SheetTitle className="text-base">{existing ? 'Edit emergency receipt' : 'Add emergency item'}</SheetTitle>
          <SheetDescription className="text-xs">
            For goods that are not in the product catalog. They do not go into stock. This only records that they
            arrived, so they are not forgotten while the product is created.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-3 px-4">
          <Labelled label="Item name *">
            <Input value={itemName} onChange={(event) => setItemName(event.target.value)} className="h-8 text-xs" />
          </Labelled>
          <div className="grid grid-cols-2 gap-3">
            <Labelled label="Quantity *">
              <Input
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className="h-8 text-right text-xs"
              />
            </Labelled>
            <Labelled label="Cost per unit">
              <Input
                type="number"
                min="0"
                step="any"
                value={unitCost}
                onChange={(event) => setUnitCost(event.target.value)}
                className="h-8 text-right text-xs"
                placeholder="If known"
              />
            </Labelled>
          </div>
          <Labelled label="Description">
            <Input value={description} onChange={(event) => setDescription(event.target.value)} className="h-8 text-xs" placeholder="Brand, size, anything that identifies it" />
          </Labelled>

          <Labelled label="Supplier *">
            <Select value={supplier || NONE} onValueChange={(value) => setSupplier(value === NONE ? '' : value)} disabled={!!existing}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Choose a supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE} className="text-xs">
                  Choose a supplier
                </SelectItem>
                {suppliers.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id} className="text-xs">
                    {entry.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Labelled>

          <Labelled label="Purchase order (if it came with one)">
            <Select value={orderId || NONE} onValueChange={pickOrder} disabled={!!existing}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE} className="text-xs">
                  None
                </SelectItem>
                {visibleOrders.map((order) => (
                  <SelectItem key={order.id} value={order.id} className="text-xs">
                    {order.order_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Labelled>

          <Labelled label="Delivery note no.">
            <Input value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} className="h-8 text-xs" />
          </Labelled>
          <Labelled label="Where are the goods kept? *">
            <Input value={location} onChange={(event) => setLocation(event.target.value)} className="h-8 text-xs" placeholder="e.g. Store room, back of the main warehouse" />
          </Labelled>
          <Labelled label="Notes * (where it came from and why it is not in the catalog)">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-20 text-xs" />
          </Labelled>

          {formError && <p className="text-[11px] text-red-600">{formError}</p>}
        </div>

        <SheetFooter className="mt-4 flex-row justify-end gap-2 px-4 pb-4">
          <Button type="button" variant="outline" className="h-8 text-xs" disabled={saving} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="h-8 bg-core text-xs text-white hover:bg-core/90" disabled={saving} onClick={save}>
            {saving ? 'Saving...' : existing ? 'Save changes' : 'Record item'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}