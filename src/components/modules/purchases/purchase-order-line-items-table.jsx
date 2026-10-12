'use client'

import { useMemo, useState } from 'react'

import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'

import {
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  CirclePlus,
  CircleX,
  MoreHorizontal,
  Plus,
} from 'lucide-react'

import { Button } from '@/components/ui/button'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

import { Input } from '@/components/ui/input'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

import { formatCurrency } from './dummy-data'

// Deliberately a separate component from PurchaseRequestLineItemsTable,
// not a shared one - same visual style (sticky product column, tanstack
// table, variant picker, details dialog) but a different resource:
// orders track what the supplier is actually charging (unitCost), with
// the catalog's own cost_price kept alongside only as a reference point
// (standardCostPrice), not the thing being edited.
//
// Line item shape: { variantId, qty, standardCostPrice, unitCost }

export default function PurchaseOrderLineItemsTable({
  items,
  setItems,
  catalog,
  branchCurrencyCode,
  branchCurrencySymbol,
}) {
  const [detailsVariant, setDetailsVariant] = useState(null)

  const updateRow = (index, patch) => {
    setItems((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row
      )
    )
  }

  const insertRowAfter = (index) => {
    setItems((current) => {
      const next = [...current]
      next.splice(index + 1, 0, {
        variantId: '',
        qty: 1,
        standardCostPrice: 0,
        unitCost: 0,
      })
      return next
    })
  }

  const removeRow = (index) => {
    setItems((current) =>
      current.length > 1
        ? current.filter((_row, rowIndex) => rowIndex !== index)
        : current
    )
  }

  const columns = useMemo(
    () => [
      {
        id: 'product',
        header: 'Product',
        cell: ({ row }) => (
          <VariantPicker
            variantId={row.original.variantId}
            catalog={catalog}
            onSelect={(variantId) => {
              const variant = catalog.find((entry) => entry.id === variantId)
              const costPrice = getCostPrice(variant)
              updateRow(row.index, {
                variantId,
                standardCostPrice: costPrice,
                // Unit cost defaults from the catalog but stays editable -
                // suppliers quote different prices order to order.
                unitCost: costPrice,
              })
            }}
          />
        ),
      },
      {
        id: 'qty',
        header: 'Qty',
        cell: ({ row }) => {
          const variant = catalog.find(
            (entry) => entry.id === row.original.variantId
          )
          const stock = Number(
            variant?.availableQuantity ??
              variant?.stock ??
              variant?.quantity ??
              0
          )

          return (
            <QuantityControl
              quantity={row.original.qty}
              stock={stock}
              onChange={(qty) => updateRow(row.index, { qty })}
            />
          )
        },
      },
      {
        id: 'standardCostPrice',
        header: (
          <span className="block text-[11px] leading-tight">
            Standard estimated
            <br />
            cost price
          </span>
        ),
        cell: ({ row }) => {
          const variant = catalog.find(
            (entry) => entry.id === row.original.variantId
          )

          return (
            <span className="text-xs font-semibold text-gray-700">
              {variant
                ? formatCurrency(
                    row.original.standardCostPrice,
                    branchCurrencyCode,
                    branchCurrencySymbol
                  )
                : 'Select a product'}
            </span>
          )
        },
      },
      {
        id: 'unitCost',
        header: (
          <span className="block text-[11px] leading-tight">
            Current estimated
            <br />
            cost price
          </span>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">
              {branchCurrencySymbol || branchCurrencyCode || ''}
            </span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={row.original.unitCost ?? ''}
              onChange={(event) =>
                updateRow(row.index, {
                  unitCost: Number(event.target.value) || 0,
                })
              }
              className="h-8 w-24 text-right text-xs"
              aria-label="Unit cost"
            />
          </div>
        ),
      },
      {
        id: 'amount',
        header: (
          <span className="block leading-tight">
            Line
            <br />
            amount
          </span>
        ),
        cell: ({ row }) =>
          formatCurrency(
            Number(row.original.qty || 0) * Number(row.original.unitCost || 0),
            branchCurrencyCode,
            branchCurrencySymbol
          ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() =>
                setDetailsVariant(
                  catalog.find(
                    (variant) => variant.id === row.original.variantId
                  ) || null
                )
              }
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
    [catalog]
  )

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (_row, index) => String(index),
  })

  const total = items.reduce(
    (sum, item) => sum + Number(item.qty || 0) * Number(item.unitCost || 0),
    0
  )

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-gray-200">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-[900px] w-full border-collapse text-left text-xs">
          <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`sticky top-0 z-20 border-b border-gray-200 bg-gray-50 px-3 py-2.5 ${
                      header.column.id === 'product'
                        ? 'left-0 z-40 border-r shadow-sm'
                        : header.column.id === 'qty'
                          ? 'w-32'
                          : ['standardCostPrice', 'unitCost', 'amount'].includes(header.column.id)
                            ? 'w-32'
                        : ''
                    }`}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="align-middle">
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={`px-3 py-2 ${
                      cell.column.id === 'product'
                        ? 'sticky left-0 z-10 border-r border-gray-200 bg-white shadow-sm'
                        : ''
                    }`}
                  >
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
        className="flex w-full shrink-0 items-center justify-between gap-1.5 border-t border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold text-core hover:bg-gray-100"
      >
        <span className="flex items-center gap-1.5">
          <Plus className="size-3.5" /> Add item
        </span>

        <span className="text-sm font-semibold text-slate-900">
          Total: {formatCurrency(total, branchCurrencyCode, branchCurrencySymbol)}
        </span>
      </button>

      <Dialog
        open={Boolean(detailsVariant)}
        onOpenChange={(open) => {
          if (!open) setDetailsVariant(null)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {detailsVariant?.productTitle || 'Product details'}
            </DialogTitle>
            <DialogDescription>
              {detailsVariant?.variantLabel || 'Default variant'}
              {detailsVariant?.sku ? ` · SKU ${detailsVariant.sku}` : ''}
            </DialogDescription>
          </DialogHeader>
          {detailsVariant ? (
            <div className="space-y-4 text-sm text-gray-700">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-gray-500">Cost price</span>
                  <p className="font-semibold">
                    {formatCurrency(
                      getCostPrice(detailsVariant),
                      branchCurrencyCode,
                      branchCurrencySymbol
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">SKU</span>
                  <p className="font-semibold">
                    {detailsVariant.sku || 'Not set'}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Product type</span>
                  <p className="font-semibold capitalize">
                    {detailsVariant.type || detailsVariant.productType || 'Product'}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Available stock</span>
                  <p className="font-semibold">
                    {detailsVariant.availableQuantity ??
                      detailsVariant.stock ??
                      detailsVariant.quantity ??
                      'Not available'}
                  </p>
                </div>
              </div>
              {(detailsVariant.description ||
                detailsVariant.productDescription) && (
                <p className="leading-6 text-gray-600">
                  {detailsVariant.description || detailsVariant.productDescription}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Select a product variant first to view its details.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function getCostPrice(variant) {
  return Number(variant?.cost_price ?? variant?.costPrice ?? 0)
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
        onChange={(event) =>
          onChange(Math.max(1, Number(event.target.value) || 1))
        }
        className={`h-full min-w-0 flex-1 rounded-none border-0 px-2 text-center text-xs shadow-none focus-visible:ring-0 ${
          exceedsStock ? 'text-red-600' : 'text-gray-800'
        }`}
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
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-auto min-h-8 w-full justify-between px-2 py-1.5 text-left text-xs font-normal"
        >
          <span className="truncate">
            {selected?.displayName || 'Select a product variant...'}
          </span>
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(42rem,calc(100vw-2rem))] p-0"
      >
        <Command>
          <CommandInput
            placeholder="Search product, variant, or SKU..."
            className="h-8 text-xs"
          />
          <CommandList>
            <CommandEmpty>No matching product variant.</CommandEmpty>
            <CommandGroup>
              {catalog.map((variant) => (
                <CommandItem
                  key={variant.id}
                  value={`${variant.displayName} ${variant.sku}`}
                  onSelect={() => {
                    onSelect(variant.id)
                    setOpen(false)
                  }}
                  className="text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{variant.displayName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {variant.sku || 'No SKU'}
                    </p>
                  </div>
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