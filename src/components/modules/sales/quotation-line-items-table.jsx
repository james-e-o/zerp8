'use client'

import { useMemo, useState } from 'react'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { Plus, CirclePlus, CircleX, Check, ChevronsUpDown, ChevronDown, ChevronUp, MoreHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { emptyQuotationLine } from '@/components/modules/sales/dummy-product-variants'
import { formatNaira } from '@/components/modules/sales/dummy-data'
import { resolveQuotationPrice } from '@/components/modules/sales/quotation-catalog'

// `items` is the flat array of { variantId, qty, unitPrice } the parent
// page owns as state. This component only ever calls `setItems` with a
// full new array — it never mutates in place — so the parent's existing
// `useState`/`total` logic keeps working unchanged.
export default function QuotationLineItemsTable({ items, setItems, catalog, contexts = [], pricingContextId, pricingRules }) {
  const [detailsVariant, setDetailsVariant] = useState(null)
  const updateRow = (index, patch) => {
    setItems((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)))
  }

  const onVariantChange = (index, variantId) => {
    const variant = catalog.find((entry) => entry.id === variantId)
    updateRow(index, {
      variantId,
      productId: variant?.productId || '',
      productTitle: variant?.productTitle || '',
      variantLabel: variant?.variantLabel || '',
      sku: variant?.sku || '',
      pricingContextId,
      unitPrice: resolveQuotationPrice(variant, pricingContextId, pricingRules, 1),
    })
  }

  // Inserts a fresh empty row directly after `index`, regardless of where
  // in the table that row sits — this is the "always directly below the
  // row I clicked" behavior, not an append-to-end.
  const insertRowAfter = (index) => {
    setItems((current) => {
      const next = [...current]
      next.splice(index + 1, 0, emptyQuotationLine())
      return next
    })
  }

  const removeRow = (index) => {
    setItems((current) => (current.length > 1 ? current.filter((_, rowIndex) => rowIndex !== index) : current))
  }

  const columns = useMemo(
    () => [
      {
        id: 'product',
        header: 'Product',
        cell: ({ row }) => {
          const item = row.original
          return (
            <VariantPicker
              variantId={item.variantId}
              catalog={catalog}
              onSelect={(variantId) => onVariantChange(row.index, variantId)}
            />
          )
        },
      },
      {
        id: 'qty',
        header: 'Qty',
        cell: ({ row }) => {
          const variant = catalog.find((entry) => entry.id === row.original.variantId)
          const stock = Number(variant?.availableQuantity ?? variant?.stock ?? variant?.quantity ?? 0)
          const updateQuantity = (qty) => updateRow(row.index, {
            qty,
            unitPrice: resolveQuotationPrice(variant, row.original.pricingContextId || pricingContextId, pricingRules, qty),
          })

          return (
            <QuantityControl
              quantity={row.original.qty}
              stock={stock}
              onChange={updateQuantity}
            />
          )
        },
      },
      {
        id: 'unitPrice',
        header: 'Unit Price',
        cell: ({ row }) => (
          <Input
            type="number"
            min="0"
            value={row.original.unitPrice}
            onChange={(event) => updateRow(row.index, { unitPrice: Number(event.target.value) })}
            className="h-auto w-28 rounded border border-gray-200 px-2 py-1.5 text-xs focus:border-core focus:outline-none"
          />
        ),
      },
      {
        id: 'pricingContext',
        header: 'Price context',
        cell: ({ row }) => {
          const selectedContextId = row.original.pricingContextId || pricingContextId
          return (
            <Select
              value={selectedContextId || undefined}
              onValueChange={(value) => {
                const variant = catalog.find((entry) => entry.id === row.original.variantId)
                updateRow(row.index, {
                  pricingContextId: value,
                  unitPrice: resolveQuotationPrice(variant, value, pricingRules, row.original.qty),
                })
              }}
              disabled={!row.original.variantId || contexts.length === 0}
            >
              <SelectTrigger className="h-8 min-w-32 px-2 text-[10px]"><SelectValue placeholder="Context" /></SelectTrigger>
              <SelectContent>{contexts.map((context) => <SelectItem key={context.id} value={context.id}>{context.name}</SelectItem>)}</SelectContent>
            </Select>
          )
        },
      },
      {
        id: 'discount',
        header: 'Discount',
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Select value={row.original.discountType || 'amount'} onValueChange={(value) => updateRow(row.index, { discountType: value })}>
              <SelectTrigger className="h-8 w-16 px-1 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="amount">Amount</SelectItem><SelectItem value="percentage">%</SelectItem></SelectContent>
            </Select>
            <Input
              type="number"
              min="0"
              value={row.original.discountValue ?? 0}
              onChange={(event) => updateRow(row.index, { discountValue: Number(event.target.value) })}
              className="h-auto w-20 rounded border border-gray-200 px-2 py-1.5 text-xs focus:border-core focus:outline-none"
            />
          </div>
        ),
      },
      {
        id: 'amount',
        header: 'Line total',
        cell: ({ row }) => (
          <span className="text-xs font-semibold text-gray-700">{formatNaira(getLineTotal(row.original))}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDetailsVariant(catalog.find((variant) => variant.id === row.original.variantId) || null)}
              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="View product details"
              title="View product details"
            >
              <MoreHorizontal className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => removeRow(row.index)}
              className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
              aria-label="Remove row"
            >
              <CircleX className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => insertRowAfter(row.index)}
              className="rounded p-1.5 text-core hover:bg-core/10"
              aria-label="Add row below"
              title="Add product below this row"
            >
              <CirclePlus className="size-4" />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalog, contexts, pricingContextId, pricingRules]
  )

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (_row, index) => index,
  })

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200">
      <div className="min-h-0 flex-1 overflow-auto">
      <table className="min-w-[900px] w-full border-collapse text-left text-xs">
        <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className={`sticky top-0 z-20 border-b border-gray-200 bg-gray-50 px-3 py-2.5 ${header.column.id === 'product' ? 'left-0 z-40 border-r shadow-sm' : ''}`}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="align-middle">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className={`px-3 py-2 ${cell.column.id === 'product' ? 'sticky left-0 z-10 border-r border-gray-200 bg-white shadow-sm' : ''}`}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <button
        type="button"
        onClick={() => insertRowAfter(items.length - 1)}
        className="flex w-full shrink-0 items-center justify-end gap-1.5 border-t border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold text-core hover:bg-gray-100"
      >
        <Plus className="size-3.5" /> Add item
      </button>
      <Dialog open={Boolean(detailsVariant)} onOpenChange={(open) => { if (!open) setDetailsVariant(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailsVariant?.productTitle || 'Product details'}</DialogTitle>
            <DialogDescription>
              {detailsVariant?.variantLabel || 'Default variant'}
              {detailsVariant?.sku ? ` · SKU ${detailsVariant.sku}` : ''}
            </DialogDescription>
          </DialogHeader>
          {detailsVariant ? (
            <div className="space-y-4 text-sm text-gray-700">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-xs text-gray-500">Unit price</span><p className="font-semibold">{formatNaira(resolveQuotationPrice(detailsVariant, pricingContextId, pricingRules))}</p></div>
                <div><span className="text-xs text-gray-500">SKU</span><p className="font-semibold">{detailsVariant.sku || 'Not set'}</p></div>
                <div><span className="text-xs text-gray-500">Product type</span><p className="font-semibold capitalize">{detailsVariant.type || detailsVariant.productType || 'Product'}</p></div>
                <div><span className="text-xs text-gray-500">Available stock</span><p className="font-semibold">{detailsVariant.availableQuantity ?? detailsVariant.stock ?? detailsVariant.quantity ?? 'Not available'}</p></div>
              </div>
              {(detailsVariant.description || detailsVariant.productDescription) && <p className="leading-6 text-gray-600">{detailsVariant.description || detailsVariant.productDescription}</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Select a product variant first to view its details.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function getLineTotal(item) {
  const subtotal = Number(item.qty || 0) * Number(item.unitPrice || 0)
  const discount = item.discountType === 'percentage'
    ? subtotal * Math.min(100, Math.max(0, Number(item.discountValue || 0))) / 100
    : Math.min(subtotal, Math.max(0, Number(item.discountValue || 0)))
  return Math.max(0, subtotal - discount)
}

function QuantityControl({ quantity, stock, onChange }) {
  const exceedsStock = Number(quantity) > stock

  return (
    <div className="flex h-8 w-32 items-stretch overflow-hidden rounded border border-gray-200 bg-white">
      <div
        className="flex w-8 shrink-0 items-center justify-center bg-black text-xs font-semibold text-white"
        title="Available stock"
        aria-label={`Available stock: ${stock}`}
      >
        {stock}
      </div>
      <Input
        type="number"
        min="1"
        value={quantity}
        onChange={(event) => onChange(Math.max(1, Number(event.target.value) || 1))}
        className={`h-full min-w-0 flex-1 rounded-none border-0 px-2 text-center text-xs shadow-none focus-visible:ring-0 ${exceedsStock ? 'text-red-600' : 'text-gray-800'}`}
        aria-label="Quantity"
      />
      <div className="flex w-7 shrink-0 flex-col border-l border-gray-200">
        <button
          type="button"
          onClick={() => onChange(Number(quantity) + 1)}
          className="flex min-h-0 flex-1 items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          aria-label="Increase quantity"
        >
          <ChevronUp className="size-3" />
        </button>
        <button
          type="button"
          onClick={() => onChange(Math.max(1, Number(quantity) - 1))}
          className="flex min-h-0 flex-1 items-center justify-center border-t border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          aria-label="Decrease quantity"
        >
          <ChevronDown className="size-3" />
        </button>
      </div>
    </div>
  )
}

function VariantPicker({ variantId, catalog, onSelect }) {
  const [open, setOpen] = useState(false)
  const selected = catalog.find((variant) => variant.id === variantId)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="h-auto min-h-8 w-full justify-between px-2 py-1.5 text-left text-xs font-normal">
          <span className="truncate">{selected?.displayName || 'Select a product variant...'}</span>
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(42rem,calc(100vw-2rem))] p-0">
        <Command>
          <CommandInput placeholder="Search product, variant, or SKU..." className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty>No matching product variant.</CommandEmpty>
            <CommandGroup>
              {catalog.map((variant) => (
                <CommandItem key={variant.id} value={`${variant.displayName} ${variant.sku}`} onSelect={() => { onSelect(variant.id); setOpen(false) }} className="text-xs">
                  <div className="min-w-0 flex-1"><p className="truncate">{variant.displayName}</p><p className="text-[10px] text-muted-foreground">{variant.sku || 'No SKU'}</p></div>
                  {variant.id === variantId && <Check className="size-3.5" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
