import React, { useMemo, useState, useEffect, useRef } from 'react'
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// Helper functions for margin and price calculations
const calculateValueFromPercentage = (percentage, basePrice) => {
  if (!percentage || !basePrice) return '';
  return (parseFloat(basePrice) * parseFloat(percentage) / 100).toFixed(2);
};

const calculatePercentageFromValue = (value, basePrice) => {
  if (!value || !basePrice) return '';
  return (parseFloat(value) / parseFloat(basePrice) * 100).toFixed(2);
};

const calculateSellingPrice = (costPrice, marginValue) => {
  if (!costPrice || !marginValue) return '';
  return (parseFloat(costPrice) + parseFloat(marginValue)).toFixed(2);
};

// ----------------------------------------------------------------------
// VariantTable
// ----------------------------------------------------------------------
// Per resolution reached earlier in this conversation:
// - Each variant row is independently priceable: its own Cost Price
//   (overrides the product-level costPrice for that row only), its own
//   Margin % / Margin Value (synced to each other, same math as the
//   Standard block), and a read-only Selling Price computed from that
//   row's own cost + margin - not the product-level costPrice.
// - Two master switches above the table ("Track Inventory" / "Track in
//   Shop"), both default ON. Each has a per-variant checkbox column.
//   Flipping a switch bulk-sets every row's checkbox in that column;
//   individual rows remain independently toggleable afterward (the
//   switch does not lock them).
// - The multi-pricing-context tab UI that used to live in this file
//   (openContextId, per-context margin/selling/bulk-reduction columns)
//   has been removed entirely - that responsibility now lives in
//   ProductConfigurations (Configurations tab), which is where every
//   non-Standard pricing context is configured as a Reduction/Markup
//   adjustment relative to Standard's selling price.
//
// NEW (this update):
// - standardPricing is now accepted as a prop. Any row that hasn't been
//   manually edited (no combo.marginPercentage / marginValue / sellingPrice
//   set yet) defaults to showing Standard's margin %/value and selling
//   price - mirroring the same "combo value wins, else fall back" pattern
//   already used for costPrice. The moment a user edits a row's margin or
//   cost price, that row's own value takes over via updateValue(), and the
//   Standard default no longer applies to that row.
// - Margin inputs now carry a remount `key` tied to standardPricing, same
//   as the existing costPrice input's key, so a freshly-set Standard value
//   actually shows up in not-yet-edited rows (uncontrolled inputs otherwise
//   won't reflect a changed defaultValue after first render).
// ----------------------------------------------------------------------

export function VariantTable({ combinations = [], costPrice, standardPricing = {}, updateValue, productType = 'physical' }) {
  const [pendingEdits, setPendingEdits] = useState({})
  const [trackInventorySwitch, setTrackInventorySwitch] = useState(true)
  const [trackInShopSwitch, setTrackInShopSwitch] = useState(true)

  // A row's checkbox is considered ON unless explicitly set to false -
  // this gives us "default ON" without needing an effect to pre-seed
  // every row the moment it's generated.
  const isTrackedInventory = (combo) => combo.managed !== false
  const isTrackedInShop = (combo) => combo.trackedInShop !== false

  const handleBulkToggle = (column, value, setSwitchState) => {
    setSwitchState(value)
    combinations.forEach((_, idx) => updateValue(idx, column, value))
  }

  // Preserve pending edits when combinations change; only clear edits for rows beyond the new combination count
  useEffect(() => {
    setPendingEdits(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(idx => {
        if (parseInt(idx) >= combinations.length) {
          delete next[idx]
        }
      })
      return next
    })
  }, [combinations.length])

  const data = useMemo(() => {
    return combinations.map((combo) => {
      const rowCostPrice = combo.costPrice || costPrice || '';

      // Margin %/value default to Standard's values until the row is
      // edited directly (combo.marginPercentage / combo.marginValue get
      // set by updateValue the moment the user blurs one of these inputs).
      const marginPercentage = combo.marginPercentage || standardPricing.marginPercentage || '';
      const marginValue = combo.marginValue || standardPricing.marginValue || '';

      let sellingPrice = combo.sellingPrice || '';
      if (!sellingPrice && marginValue && rowCostPrice) {
        // Computed from THIS row's cost + margin, not copied straight from
        // Standard - a row can have its own overridden cost price while
        // still inheriting Standard's margin, and the selling price should
        // reflect that combination.
        sellingPrice = calculateSellingPrice(rowCostPrice, marginValue);
      }
      if (!sellingPrice) {
        // Covers service-type products, where Standard's selling price is
        // entered directly rather than computed from cost + margin.
        sellingPrice = standardPricing.sellingPrice || '';
      }

      return {
        variant: combo.combination.length > 0 ? combo.combination.map(item => `${item.value}`).join(' / ') : 'Product',
        sku: combo.sku || '',
        managed: combo.managed,
        trackedInShop: combo.trackedInShop,
        costPrice: rowCostPrice,
        marginPercentage,
        marginValue,
        sellingPrice,
      };
    });
  }, [combinations, costPrice, standardPricing]);

  const columns = [
    {
      accessorKey: 'details',
      id: 'details',
      header: () => (
        <div className="grid grid-cols-8 gap-0 min-w-4xl bg-white h-full">
          <div className="flex items-center justify-center border-r border-gray-200 p-2">
            <p className="text-[11px] text-center font-medium">{productType === 'service' ? 'Quality Tier' : 'Variant'}</p>
          </div>
          <div className="flex items-center justify-center border-r border-gray-200 p-2">
            <p className="text-[11px] text-center font-medium">SKU</p>
          </div>
          <div className="flex items-center justify-center border-r border-gray-200 p-2">
            <p className="text-[11px] text-center font-medium">Tracked in Inventory</p>
          </div>
          <div className="flex items-center justify-center border-r border-gray-200 p-2">
            <p className="text-[11px] text-center font-medium">Tracked in Shop</p>
          </div>
          <div className="flex items-center justify-center border-r border-gray-200 p-2">
            <p className="text-[11px] text-center font-medium">Cost Price</p>
          </div>
          <div className="flex items-center justify-center border-r border-gray-200 p-2">
            <p className="text-[11px] text-center font-medium">Margin %</p>
          </div>
          <div className="flex items-center justify-center border-r border-gray-200 p-2">
            <p className="text-[11px] text-center font-medium">Margin Value</p>
          </div>
          <div className="flex items-center justify-center p-2">
            <p className="text-[11px] text-center font-medium">Selling Price</p>
          </div>
        </div>
      ),
      cell: ({ row }) => {
        const combo = row.original
        const rowIndex = row.index

        const recalcFromMarginPercentage = (val) => {
          const newMarginValue = calculateValueFromPercentage(val, combo.costPrice)
          updateValue(rowIndex, 'marginPercentage', val)
          updateValue(rowIndex, 'marginValue', newMarginValue)
          updateValue(rowIndex, 'sellingPrice', calculateSellingPrice(combo.costPrice, newMarginValue))
        }

        const recalcFromMarginValue = (val) => {
          const newMarginPercentage = calculatePercentageFromValue(val, combo.costPrice)
          updateValue(rowIndex, 'marginValue', val)
          updateValue(rowIndex, 'marginPercentage', newMarginPercentage)
          updateValue(rowIndex, 'sellingPrice', calculateSellingPrice(combo.costPrice, val))
        }

        const recalcFromCostPrice = (val) => {
          updateValue(rowIndex, 'costPrice', val)
          if (combo.marginValue) {
            updateValue(rowIndex, 'sellingPrice', calculateSellingPrice(val, combo.marginValue))
          }
        }

        return (
          <div className="grid grid-cols-8 gap-0 min-w-4xl bg-white h-full">
            <div className="flex items-center justify-center border-r border-gray-100 p-2">
              <div className="text-sm">{combo.variant}</div>
            </div>
            <div className="flex items-center justify-center border-r border-gray-100 p-2">
              <Input
                defaultValue={(pendingEdits[rowIndex]?.sku) ?? combo.sku}
                onBlur={(e) => {
                  const val = e.target.value ?? combo.sku
                  updateValue(rowIndex, 'sku', val)
                  setPendingEdits(prev => ({ ...prev, [rowIndex]: { ...(prev[rowIndex] || {}), sku: val } }))
                }}
                className="h-7 w-32 text-[11px]"
              />
            </div>
            <div className="flex items-center justify-center border-r border-gray-100 p-2">
              <Checkbox
                checked={isTrackedInventory(combo)}
                onCheckedChange={(v) => updateValue(rowIndex, 'managed', v)}
              />
            </div>
            <div className="flex items-center justify-center border-r border-gray-100 p-2">
              <Checkbox
                checked={isTrackedInShop(combo)}
                onCheckedChange={(v) => updateValue(rowIndex, 'trackedInShop', v)}
              />
            </div>
            <div className="flex items-center justify-center border-r border-gray-100 p-2">
              <Input
                type="text"
                defaultValue={(pendingEdits[rowIndex]?.costPrice) ?? combo.costPrice}
                onBlur={(e) => {
                  const val = e.target.value ?? combo.costPrice
                  recalcFromCostPrice(val)
                  setPendingEdits(prev => ({ ...prev, [rowIndex]: { ...(prev[rowIndex] || {}), costPrice: val } }))
                }}
                className="h-7 w-20 text-[11px]"
                placeholder="0.00"
                key={`cost-${costPrice}-${rowIndex}`}
              />
            </div>
            <div className="flex items-center justify-center border-r border-gray-100 p-2">
              <Input
                type="text"
                defaultValue={(pendingEdits[rowIndex]?.marginPercentage) ?? combo.marginPercentage}
                onBlur={(e) => {
                  const val = e.target.value
                  recalcFromMarginPercentage(val)
                  setPendingEdits(prev => ({ ...prev, [rowIndex]: { ...(prev[rowIndex] || {}), marginPercentage: val } }))
                }}
                className="h-7 w-16 text-[11px]"
                placeholder="0.00"
                key={`margin-pct-${standardPricing.marginPercentage}-${rowIndex}`}
              />
            </div>
            <div className="flex items-center justify-center border-r border-gray-100 p-2">
              <Input
                type="text"
                defaultValue={(pendingEdits[rowIndex]?.marginValue) ?? combo.marginValue}
                onBlur={(e) => {
                  const val = e.target.value
                  recalcFromMarginValue(val)
                  setPendingEdits(prev => ({ ...prev, [rowIndex]: { ...(prev[rowIndex] || {}), marginValue: val } }))
                }}
                className="h-7 w-20 text-[11px]"
                placeholder="0.00"
                key={`margin-val-${standardPricing.marginValue}-${rowIndex}`}
              />
            </div>
            <div className="flex items-center justify-center p-2">
              <div className="w-full h-7 px-1 text-center rounded-sm bg-gray-100 flex items-center justify-center border text-xs border-gray-300">
                {combo.sellingPrice || '-'}
              </div>
            </div>
          </div>
        )
      },
      size: 1000,
    },
  ]

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      updateValue,
    },
  });

  return (
    <div className="w-full border rounded-md overflow-hidden flex flex-col h-full">
      <div className="p-3 bg-white border-b flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <Switch checked={trackInventorySwitch} onCheckedChange={(v) => handleBulkToggle('managed', v, setTrackInventorySwitch)} />
          <span className="text-xs font-medium">Track Inventory</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={trackInShopSwitch} onCheckedChange={(v) => handleBulkToggle('trackedInShop', v, setTrackInShopSwitch)} />
          <span className="text-xs font-medium">Track in Shop</span>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <Table className="w-full min-w-max text-xs border-collapse">
          <TableHeader className="sticky top-0 z-20">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="h-fit">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    data-value={header.id}
                    className="p-2 text-left font-medium border-r border-gray-200 whitespace-nowrap bg-white"
                    key={header.id}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="bg-white border-b hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      className="p-2 align-middle border-r border-gray-100 whitespace-nowrap"
                      key={cell.id}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 whitespace-nowrap text-center">
                  No variants found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}