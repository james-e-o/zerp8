'use client'

import { useMemo } from 'react'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { CircleX, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VariantPicker } from '@/components/modules/procurement/purchase-order-line-items-table'

const blankLine = () => ({ variantId: '', quantity: 1, notes: '' })

export default function RfqLineItemsTable({ items, setItems, catalog }) {
  const duplicateProductKeys = useMemo(() => {
    const counts = new Map()
    items.forEach((item) => {
      if (!item.variantId) return
      const productKey = catalog.find((variant) => variant.id === item.variantId)?.productId || item.variantId
      counts.set(productKey, (counts.get(productKey) || 0) + 1)
    })
    return new Set([...counts].filter(([, count]) => count > 1).map(([id]) => id))
  }, [items, catalog])

  const updateRow = (index, patch) => {
    setItems((current) => current.map((item, rowIndex) =>
      rowIndex === index ? { ...item, ...patch } : item
    ))
  }

  const columns = useMemo(() => [
    {
      id: 'product',
      header: 'Product',
      cell: ({ row }) => (
        <div>
          <VariantPicker
            variantId={row.original.variantId}
            catalog={catalog}
            onSelect={(variantId) => updateRow(row.index, { variantId })}
          />
          {duplicateProductKeys.has(
            catalog.find((variant) => variant.id === row.original.variantId)?.productId || row.original.variantId
          ) && (
            <p className="mt-1 text-[10px] text-red-600">This product has been added more than once.</p>
          )}
        </div>
      ),
    },
    {
      id: 'quantity',
      header: 'Quantity',
      cell: ({ row }) => (
        <Input
          type="number"
          min="1"
          step="any"
          value={row.original.quantity}
          onChange={(event) => updateRow(row.index, {
            quantity: Math.max(1, Number(event.target.value) || 1),
          })}
          className="h-8 w-28 text-xs"
          aria-label="Quantity"
        />
      ),
    },
    {
      id: 'notes',
      header: 'Line notes',
      cell: ({ row }) => (
        <Input
          value={row.original.notes || ''}
          onChange={(event) => updateRow(row.index, { notes: event.target.value })}
          className="h-8 min-w-48 text-xs"
          aria-label="Line notes"
        />
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-gray-400 hover:text-red-600"
          onClick={() => setItems((current) =>
            current.length > 1 ? current.filter((_, index) => index !== row.index) : [blankLine()]
          )}
          aria-label="Remove line"
        >
          <CircleX className="size-4" />
        </Button>
      ),
    },
  ], [catalog, duplicateProductKeys, setItems])

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (_row, index) => String(index),
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-[700px] w-full border-collapse text-left text-xs">
          <thead className="bg-muted text-[10px] font-semibold uppercase text-muted-foreground">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th key={header.id} className="sticky top-0 z-10 border-b border-border bg-muted px-3 py-2">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        type="button"
        variant="ghost"
        className="h-9 shrink-0 justify-start gap-2 rounded-none border-t border-border text-xs text-core"
        onClick={() => setItems((current) => [...current, blankLine()])}
      >
        <Plus className="size-3.5" /> Add item
      </Button>
      {duplicateProductKeys.size > 0 && (
        <p className="border-t border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
          Each product can appear only once on an RFQ.
        </p>
      )}
    </div>
  )
}
