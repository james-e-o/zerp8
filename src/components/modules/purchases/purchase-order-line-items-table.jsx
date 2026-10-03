'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { X } from 'lucide-react'
import { formatCurrency } from './dummy-data'

// Line item shape: { variantId, variantLabel, qty, unitCost }

export default function PurchaseOrderLineItemsTable({
  items,
  setItems,
  catalog,
  branchCurrencyCode,
  branchCurrencySymbol,
}) {
  const updateItem = (index, patch) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    )
  }

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const insertRowBelow = (index) => {
    setItems((prev) => {
      const next = [...prev]
      next.splice(index + 1, 0, {
        variantId: '',
        variantLabel: '',
        qty: 1,
        standardCostPrice: 0,
        unitCost: 0,
      })
      return next
    })
  }

  const selectVariant = (index, variant) => {
    updateItem(index, {
      variantId: variant.id,
      variantLabel: variant.displayName || variant.label || variant.name,
      // Default unit cost from the product record, but this stays editable —
      // suppliers quote different prices order to order.
      standardCostPrice: Number(variant.cost_price ?? variant.costPrice ?? 0),
      unitCost: Number(variant.cost_price ?? variant.costPrice ?? 0),
    })
  }

  const total = items.reduce(
    (sum, item) => sum + Number(item.qty || 0) * Number(item.unitCost || 0),
    0
  )

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs font-medium text-gray-600">
          <tr>
            <th className="w-2/5 px-3 py-2 text-left">Product / Variant</th>
            <th className="px-3 py-2 text-right">Qty</th>
            <th className="w-32 px-2 py-2 text-right leading-tight">
              Standard<br />cost price
            </th>
            <th className="w-32 px-2 py-2 text-right leading-tight">
              Estimated<br />cost price
            </th>
            <th className="w-32 px-2 py-2 text-right leading-tight">
              Estimated<br />amount
            </th>
            <th className="w-10 px-3 py-2" />
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100">
          {items.map((item, index) => (
            <tr key={index}>
              <td className="px-3 py-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full truncate rounded-md border border-gray-200 px-2 py-1.5 text-left text-sm hover:bg-gray-50"
                    >
                      {item.variantLabel || (
                        <span className="text-gray-400">
                          Select a product...
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>

                  <PopoverContent className="w-80 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search products..." />
                      <CommandList>
                        <CommandEmpty>No products found.</CommandEmpty>
                        <CommandGroup>
                          {catalog.map((variant) => (
                            <CommandItem
                              key={variant.id}
                              value={variant.displayName || variant.label || variant.name}
                              onSelect={() => selectVariant(index, variant)}
                            >
                              {variant.displayName || variant.label || variant.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </td>

              <td className="px-3 py-2">
                <Input
                  type="number"
                  min="1"
                  value={item.qty}
                  onChange={(event) =>
                    updateItem(index, { qty: event.target.value })
                  }
                  className="h-auto w-20 text-right text-sm"
                />
              </td>

              <td className="px-3 py-2 text-right font-medium text-slate-900">
                {formatCurrency(
                  Number(item.standardCostPrice || 0),
                  branchCurrencyCode,
                  branchCurrencySymbol
                )}
              </td>

              <td className="px-3 py-2">
                <div className="flex items-center justify-end gap-1">
                  <span className="text-xs text-gray-500">
                    {branchCurrencySymbol || branchCurrencyCode || ''}
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitCost}
                    onChange={(event) =>
                      updateItem(index, { unitCost: event.target.value })
                    }
                    className="h-auto w-24 text-right text-sm"
                    aria-label="Estimated cost price"
                  />
                </div>
              </td>

              <td className="px-3 py-2 text-right font-medium text-slate-900">
                {formatCurrency(
                  Number(item.qty || 0) * Number(item.unitCost || 0),
                  branchCurrencyCode,
                  branchCurrencySymbol
                )}
              </td>

              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-gray-400 hover:text-red-600"
                  aria-label="Remove line"
                >
                  <X className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50/60 px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => insertRowBelow(items.length - 1)}
        >
          + Add line
        </Button>

        <span className="text-sm font-semibold text-slate-900">
          Total: {formatCurrency(
            total,
            branchCurrencyCode,
            branchCurrencySymbol
          )}
        </span>
      </div>
    </div>
  )
}
