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
// - standardPricing is accepted as a prop. Any row that hasn't been
//   manually edited (no combo.marginPercentage / marginValue / sellingPrice
//   set yet) defaults to showing Standard's margin %/value and selling
//   price - mirroring the same "combo value wins, else fall back" pattern
//   already used for costPrice. The moment a user edits a row's margin or
//   cost price, that row's own value takes over via updateValue(), and the
//   Standard default no longer applies to that row.
//
// NEW (this update):
// - Reorder Level column removed entirely - that field no longer exists
//   on the product (inventory module owns reorder thresholds now).
// - New Bulk Threshold column (per variant). Same "combo value wins, else
//   fall back to the product-level default" pattern as everything else
//   here: product-level `bulkThreshold` (from Configurations' Quantity
//   Rules) is the default shown for a row that hasn't been edited; once a
//   row's own bulkThreshold is set via updateValue(), that row keeps its
//   own value even if the product-level default changes later. This is
//   what lets e.g. a Small variant default to a dozen while a Large
//   variant is overridden to six.
//
// Oct 2026 update - the "Cost Price" column is labeled "Cost Price (Est.)":
// cost is no longer stored on product_variants at all (moved server-side
// into product_cost_estimates, one company-wide row per variant). This
// row-level field, its key in the payload ("cost"), and the sync math
// against margin are all unchanged - only the label changed, so it reads
// as an estimate rather than a final number the way ProductConfigurations'
// Cost Price field now does too.
//
// Oct 2026 update #2 - Margin % and Margin Value now sync LIVE as you
// type, matching ProductConfigurations' Standard block instead of only
// resolving on blur. Previously these two Inputs were uncontrolled
// (defaultValue + a key that remounts only when the product-level
// default changes) and recalculated the sibling field via updateValue()
// on blur - which updates the lifted `combinations` state correctly, but
// never visually touches the sibling Input, since its defaultValue only
// re-renders on remount. Typing 20% into Margin % left Margin Value
// showing nothing until you clicked away. Fixed by making both inputs
// controlled against a small per-row `marginDrafts` buffer while being
// edited (same pattern as ProductConfigurations' standardDraft) - every
// keystroke recomputes the sibling field, updates sellingPrice, and
// pushes all three into the lifted combinations state immediately, so
// what's on screen and what's in parent state never drift apart. On
// blur the per-row draft clears and the fields fall back to display
// combo.marginPercentage/marginValue directly - which by then already
// hold the live-synced values, so nothing visually jumps.
// recalcFromCostPrice was also extended: if a row has its own
// marginPercentage set, changing cost now recomputes marginValue from
// that percentage against the NEW cost (keeping % authoritative),
// instead of only recomputing sellingPrice off the stale marginValue.
// ----------------------------------------------------------------------

export function VariantTable({ combinations = [], costPrice, standardPricing = {}, bulkThreshold, updateValue, productType = 'physical' }) {
  const [pendingEdits, setPendingEdits] = useState({})
  // Live edit buffer for margin %/value, per row index - see comment above.
  const [marginDrafts, setMarginDrafts] = useState({})
  const getMarginDraft = (rowIndex, field, fallback) => (
    marginDrafts[rowIndex]?.[field] ?? fallback
  )
  const clearMarginDraft = (rowIndex) => setMarginDrafts(prev => {
    if (!(rowIndex in prev)) return prev
    const next = { ...prev }
    delete next[rowIndex]
    return next
  })
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
        bulkThreshold: combo.bulkThreshold || bulkThreshold || '',
      };
    });
  }, [combinations, costPrice, standardPricing, bulkThreshold]);

  const columns = [
    {
      accessorKey: 'details',
      id: 'details',
      header: () => (
        <div className="grid grid-cols-9 gap-0 min-w-4xl bg-white h-full">
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
            <p className="text-[11px] text-center font-medium">Cost Price (Est.)</p>
          </div>
          <div className="flex items-center justify-center border-r border-gray-200 p-2">
            <p className="text-[11px] text-center font-medium">Margin %</p>
          </div>
          <div className="flex items-center justify-center border-r border-gray-200 p-2">
            <p className="text-[11px] text-center font-medium">Margin Value</p>
          </div>
          <div className="flex items-center justify-center border-r border-gray-200 p-2">
            <p className="text-[11px] text-center font-medium">Selling Price</p>
          </div>
          <div className="flex items-center justify-center p-2">
            <p className="text-[11px] text-center font-medium">Bulk Threshold</p>
          </div>
        </div>
      ),
      cell: ({ row }) => {
        const combo = row.original
        const rowIndex = row.index

        // Live, as-you-type: updates the sibling field's draft AND pushes
        // all three (percentage, value, sellingPrice) into lifted state on
        // every keystroke, not just on blur.
        const recalcFromMarginPercentage = (val) => {
          const newMarginValue = calculateValueFromPercentage(val, combo.costPrice)
          setMarginDrafts(prev => ({ ...prev, [rowIndex]: { marginPercentage: val, marginValue: newMarginValue } }))
          updateValue(rowIndex, 'marginPercentage', val)
          updateValue(rowIndex, 'marginValue', newMarginValue)
          updateValue(rowIndex, 'sellingPrice', calculateSellingPrice(combo.costPrice, newMarginValue))
        }

        const recalcFromMarginValue = (val) => {
          const newMarginPercentage = calculatePercentageFromValue(val, combo.costPrice)
          setMarginDrafts(prev => ({ ...prev, [rowIndex]: { marginPercentage: newMarginPercentage, marginValue: val } }))
          updateValue(rowIndex, 'marginValue', val)
          updateValue(rowIndex, 'marginPercentage', newMarginPercentage)
          updateValue(rowIndex, 'sellingPrice', calculateSellingPrice(combo.costPrice, val))
        }

        const recalcFromCostPrice = (val) => {
          updateValue(rowIndex, 'costPrice', val)
          if (combo.marginPercentage) {
            // % is authoritative when set - recompute the value against
            // the new cost, don't let it go stale.
            const newMarginValue = calculateValueFromPercentage(combo.marginPercentage, val)
            updateValue(rowIndex, 'marginValue', newMarginValue)
            updateValue(rowIndex, 'sellingPrice', calculateSellingPrice(val, newMarginValue))
          } else if (combo.marginValue) {
            updateValue(rowIndex, 'sellingPrice', calculateSellingPrice(val, combo.marginValue))
          }
        }

        return (
          <div className="grid grid-cols-9 gap-0 min-w-4xl bg-white h-full">
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
                value={getMarginDraft(rowIndex, 'marginPercentage', combo.marginPercentage)}
                onChange={(e) => recalcFromMarginPercentage(e.target.value)}
                onBlur={() => clearMarginDraft(rowIndex)}
                className="h-7 w-16 text-[11px]"
                placeholder="0.00"
              />
            </div>
            <div className="flex items-center justify-center border-r border-gray-100 p-2">
              <Input
                type="text"
                value={getMarginDraft(rowIndex, 'marginValue', combo.marginValue)}
                onChange={(e) => recalcFromMarginValue(e.target.value)}
                onBlur={() => clearMarginDraft(rowIndex)}
                className="h-7 w-20 text-[11px]"
                placeholder="0.00"
              />
            </div>
            <div className="flex items-center justify-center border-r border-gray-100 p-2">
              <div className="w-full h-7 px-1 text-center rounded-sm bg-gray-100 flex items-center justify-center border text-xs border-gray-300">
                {combo.sellingPrice || '-'}
              </div>
            </div>
            <div className="flex items-center justify-center p-2">
              <Input
                type="number"
                defaultValue={(pendingEdits[rowIndex]?.bulkThreshold) ?? combo.bulkThreshold}
                onBlur={(e) => {
                  const val = e.target.value
                  updateValue(rowIndex, 'bulkThreshold', val)
                  setPendingEdits(prev => ({ ...prev, [rowIndex]: { ...(prev[rowIndex] || {}), bulkThreshold: val } }))
                }}
                className="h-7 w-20 text-[11px]"
                placeholder="e.g. 12"
                // Remounts when the product-level default changes, same
                // pattern as the cost/margin inputs above - so a row that
                // hasn't been individually edited actually reflects a
                // freshly-changed default instead of keeping a stale one.
                key={`bulk-${bulkThreshold}-${rowIndex}`}
              />
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