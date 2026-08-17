import React, { useMemo, useState, useEffect, useRef } from 'react'
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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

// Enhanced EditableCell with synced margin calculations
const EditableCell = ({ row, column, table, getValue, productType = 'physical' }) => {
  const initialValue = getValue()
  const [value, setValue] = useState(initialValue)
  const rowData = table.options.meta?.rowData?.[row.index] || {}
  const costPrice = rowData.costPrice || ''
  
  // Parse column.id to extract context ID and field type
  // Format: {contextId}_margin_percentage or {contextId}_margin_value or {contextId}_selling_price
  const parseFieldInfo = (columnId) => {
    if (columnId.endsWith('_margin_percentage')) {
      const contextId = columnId.replace(/_margin_percentage$/, '')
      return { contextId, fieldType: 'margin_percentage' }
    } else if (columnId.endsWith('_margin_value')) {
      const contextId = columnId.replace(/_margin_value$/, '')
      return { contextId, fieldType: 'margin_value' }
    } else if (columnId.endsWith('_selling_price')) {
      const contextId = columnId.replace(/_selling_price$/, '')
      return { contextId, fieldType: 'selling_price' }
    } else if (columnId.endsWith('_bulk_price')) {
      const contextId = columnId.replace(/_bulk_price$/, '')
      return { contextId, fieldType: 'bulk_price' }
    } else if (columnId.endsWith('_bulk_reduction_value')) {
      const contextId = columnId.replace(/_bulk_reduction_value$/, '')
      return { contextId, fieldType: 'bulk_reduction_value' }
    } else if (columnId.endsWith('_bulk_reduction_percentage')) {
      const contextId = columnId.replace(/_bulk_reduction_percentage$/, '')
      return { contextId, fieldType: 'bulk_reduction_percentage' }
    }
    return { contextId: '', fieldType: '' }
  }
  
  const { contextId, fieldType } = parseFieldInfo(column.id)
  // Selling price is read-only for physical products, editable only for service products
  const isSellingPriceReadOnly = fieldType === 'selling_price' && productType === 'physical'
  
  const updateData = () => {
    const updates = { [column.id]: value }
    
    // If updating margin_percentage, auto-calculate margin_value and selling_price
    if (fieldType === 'margin_percentage') {
      const newMarginValue = calculateValueFromPercentage(value, costPrice)
      updates[`${contextId}_margin_value`] = newMarginValue
      updates[`${contextId}_selling_price`] = calculateSellingPrice(costPrice, newMarginValue)
    }
    // If updating margin_value, auto-calculate margin_percentage and selling_price
    else if (fieldType === 'margin_value') {
      const newMarginPercentage = calculatePercentageFromValue(value, costPrice)
      updates[`${contextId}_margin_percentage`] = newMarginPercentage
      updates[`${contextId}_selling_price`] = calculateSellingPrice(costPrice, value)
    }
    // If updating bulk_reduction_percentage, auto-calculate bulk_reduction_value
    else if (fieldType === 'bulk_reduction_percentage') {
      const newBulkValue = calculateValueFromPercentage(value, costPrice)
      updates[`${contextId}_bulk_reduction_value`] = newBulkValue
    }
    // If updating bulk_reduction_value, auto-calculate bulk_reduction_percentage
    else if (fieldType === 'bulk_reduction_value') {
      const newBulkPercentage = calculatePercentageFromValue(value, costPrice)
      updates[`${contextId}_bulk_reduction_percentage`] = newBulkPercentage
    }
    
    // Update all related fields
    Object.entries(updates).forEach(([key, val]) => {
      table.options.meta?.updateValue(row.index, key, val)
    })
  }
  
  // For physical products with selling price: don't allow editing, just display
  if (isSellingPriceReadOnly) {
    return (
      <div className="w-full h-7 px-1 text-center rounded-sm bg-gray-100 flex items-center justify-center border text-xs border-gray-300">
        {value}
      </div>
    )
  }
  
  return (
    <input 
      value={value} 
      onBlur={updateData} 
      className="w-full h-7 px-1 text-center rounded-sm bg-white/35 outline-none border text-xs border-zinc-400" 
      onChange={({ target }) => setValue(target.value)} 
    />
  )
}

export function VariantTable({ combinations = [], costPrice, pricingContexts, updateValue, productType = 'physical', bulkQuantity = '' }) {
  // track pending edits per row index: { rowIndex: { sku: 'value', ... }, ... }
  const [pendingEdits, setPendingEdits] = useState({})
  const [allTracked, setAllTracked] = useState(false)
  const [rowSelection, setRowSelection] = useState({})
  const [openContextId, setOpenContextId] = useState(pricingContexts && pricingContexts.length > 0 ? pricingContexts[0].id : null)
  const [variantData, setVariantData] = useState({}) // State to manage variant-specific values
  const pendingEditsRef = useRef(pendingEdits)

  useEffect(() => {
    pendingEditsRef.current = pendingEdits
  }, [pendingEdits])

  // Update openContextId when pricingContexts change
  useEffect(() => {
    if (pricingContexts && pricingContexts.length > 0) {
      setOpenContextId(pricingContexts[0].id)
    }
  }, [pricingContexts])

  // Initialize and sync variant data with latest values from combinations and pricing contexts
  // This ensures that changes in ProductConfigurations (cost price, pricing context values) are reflected in the table
  useEffect(() => {
    const initialized = {}
    combinations.forEach((combo, idx) => {
      initialized[idx] = {
        // Always use the latest costPrice from props - allows syncing from parent changes
        costPrice: costPrice || '',
      }
      // Set pricing context field values - sync from combo first, then fall back to context defaults
      if (pricingContexts && pricingContexts.length > 0) {
        pricingContexts.forEach(context => {
          const marginPercentage = combo[`${context.id}_margin_percentage`] || context.margin_percentage || ''
          const marginValue = combo[`${context.id}_margin_value`] || context.margin_value || ''
          let sellingPrice = combo[`${context.id}_selling_price`] || context.selling_price || ''
          
          // If selling_price is not set, calculate it from costPrice + marginValue
          if (!sellingPrice && marginValue && costPrice) {
            sellingPrice = calculateSellingPrice(costPrice, marginValue)
          }
          
          initialized[idx][`${context.id}_margin_percentage`] = marginPercentage
          initialized[idx][`${context.id}_margin_value`] = marginValue
          initialized[idx][`${context.id}_selling_price`] = sellingPrice
          
          // Initialize bulk pricing fields - sync from combo first, then fall back to context defaults
          const bulkReductionPercentage = combo[`${context.id}_bulk_reduction_percentage`] || context.bulk_reduction_percentage || ''
          const bulkReductionValue = combo[`${context.id}_bulk_reduction_value`] || context.bulk_reduction_value || ''
          
          initialized[idx][`${context.id}_bulk_reduction_percentage`] = bulkReductionPercentage
          initialized[idx][`${context.id}_bulk_reduction_value`] = bulkReductionValue
        })
      }
    })
    setVariantData(initialized)
  }, [combinations, costPrice, pricingContexts])

  // Handle context switch - only one context can be open at a time
  const handleContextSwitch = (contextId) => {
    setOpenContextId(openContextId === contextId ? null : contextId)
  }

  const baseColumns = [
   
    {
      accessorKey: "details",
      id: "details",
      header: () => (
        <div className="grid grid-cols-4 gap-0 min-w-xl bg-white h-full">
          {/* Variant Header */}
          <div className="flex items-center justify-center border-r border-gray-200 p-2">
            <p className="text-[11px] text-center font-medium">{productType === 'service' ? "Quality Tier" : "Variant"}</p>
          </div>
          {/* SKU Header */}
          <div className="flex items-center justify-center border-r border-gray-200 p-2">
            <p className="text-[11px] text-center font-medium">SKU</p>
          </div>
          {/* Tracked Header */}
          <div className="flex items-center justify-center border-r border-gray-200 p-2">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-medium">Tracked</span>
            </div>
          </div>
          {/* Cost Price Header */}
          <div className="flex items-center justify-center p-2">
            <p className="text-[11px] text-center font-medium">Cost Price</p>
          </div>
        </div>
      ),
      cell: ({ row, table }) => (
        <div className="grid grid-cols-4 gap-0 min-w-xl bg-white h-full">
          {/* Variant Cell */}
          <div className="flex items-center justify-center border-r border-gray-100 p-2">
            <div className="text-sm">{row.original.variant}</div>
          </div>
          {/* SKU Cell */}
          <div className="flex items-center justify-center border-r border-gray-100 p-2">
            <Input
              defaultValue={(pendingEdits[row.index]?.sku) ?? row.original.sku}
              onBlur={(e) => {
                const val = e.target.value ?? row.original.sku
                updateValue(row.index, "sku", val)
                setPendingEdits(prev => ({ ...prev, [row.index]: { ...(prev[row.index] || {}), sku: val } }))
              }}
              className="h-7 w-34 text-[11px]"
            />
          </div>
          {/* Tracked Cell */}
          <div className="flex items-center justify-center border-r border-gray-100 p-2">
            <Checkbox
              className="scale-100"
              checked={row.original.managed}
              onCheckedChange={(v) => updateValue(row.index, "managed", v)}
            />
          </div>
          {/* Cost Price Cell */}
          <div className="flex items-center justify-center p-2">
            <Input
              type="text"
              defaultValue={(pendingEdits[row.index]?.costPrice) ?? (variantData[row.index]?.costPrice || costPrice)}
              onBlur={(e) => {
                const val = e.target.value ?? costPrice
                updateValue(row.index, "costPrice", val)
                setPendingEdits(prev => ({ ...prev, [row.index]: { ...(prev[row.index] || {}), costPrice: val } }))
                setVariantData(prev => ({ ...prev, [row.index]: { ...(prev[row.index] || {}), costPrice: val } }))
                
                // For physical products: recalculate selling prices when cost price changes
                if (productType === 'physical' && pricingContexts && pricingContexts.length > 0) {
                  const updates = {}
                  pricingContexts.forEach(context => {
                    const contextId = context.id
                    // Get the current margin value for this context
                    const marginValue = variantData[row.index]?.[`${contextId}_margin_value`] || row.original?.[`${contextId}_margin_value`] || context.margin_value || ''
                    // Recalculate selling price with new cost price
                    if (marginValue) {
                      updates[`${contextId}_selling_price`] = calculateSellingPrice(val, marginValue)
                      updateValue(row.index, `${contextId}_selling_price`, updates[`${contextId}_selling_price`])
                    }
                  })
                }
              }}
              className="h-7 w-24 text-[11px]"
              placeholder="0.00"
              key={`cost-${costPrice}-${row.index}`}
            />
          </div>
        </div>
      ),
      size: 850,
    },
  ];

  // Create grouped columns for each pricing context
  const pricingContextColumns = pricingContexts && pricingContexts.length > 0
    ? pricingContexts
        .filter(context => openContextId === context.id)
        .map(context => ({
          header: context.name,
          id: `group_${context.id}`,
          columns: [
            {
              header: () => (
                <div className="flex flex-col gap-1 justify-start items-center">
                  <span className="text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded w-fit">{context.name}</span>
                  <span className='text-xs'>Margin %</span>
                </div>
              ),
              accessorKey: `${context.id}_margin_percentage`,
              cell: ({ row, column, table, getValue }) => <EditableCell row={row} column={column} table={table} getValue={getValue} />,
            },
            {
              header: () => (
                <div className="flex flex-col gap-1 justify-start items-center">
                  <span className="text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded w-fit">{context.name}</span>
                  <span className='text-xs'>Margin<br/> Value</span>
                </div>
              ),
              accessorKey: `${context.id}_margin_value`,
              cell: ({ row, column, table, getValue }) => <EditableCell row={row} column={column} table={table} getValue={getValue} />,
              // size: 90,
            },
            {
              header: () => (
                <div className="flex flex-col gap-1 justify-start items-center">
                  <span className="text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded w-fit">{context.name}</span>
                  <span className='text-xs'>Selling Price</span>
                </div>
              ),
              accessorKey: `${context.id}_selling_price`,
              cell: ({ row, column, table, getValue }) => <EditableCell row={row} column={column} table={table} getValue={getValue} productType={productType} />,
              size: 110,
            },
            {
              header: () => (
                <div className="flex flex-col gap-1 justify-start items-center">
                  <span className="text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded w-fit">{context.name}</span>
                  <span className='text-xs text-center'>Bulk<br/>Price %</span>
                </div>
              ),
              accessorKey: `${context.id}_bulk_reduction_percentage`,
              cell: ({ row, column, table, getValue }) => <EditableCell row={row} column={column} table={table} getValue={getValue} />,
              size: 75,
            },
            {
              header: () => (
                <div className="flex flex-col gap-1 justify-start items-center">
                  <span className="text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded w-fit">{context.name}</span>
                  <span className='text-xs text-center'>Bulk<br/>Price Value</span>
                </div>
              ),
              accessorKey: `${context.id}_bulk_reduction_value`,
              cell: ({ row, column, table, getValue }) => <EditableCell row={row} column={column} table={table} getValue={getValue} />,
              // size: 80,
            },
            {
              header: () => (
                <div className="flex flex-col gap-1 justify-start items-center">
                  <span className="text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded w-fit">{context.name}</span>
                  <span className='text-xs text-center'>Bulk <br/>Quantity</span>
                </div>
              ),
              accessorKey: `${context.id}_bulk_quantity`,
              cell: () => (
                <div className="p-2 text-center">
                  <span className="text-xs font-medium">{bulkQuantity || '-'}</span>
                </div>
              ),
              size: 85,
            },
          ],
        }))
    : [];

  const columns = [...baseColumns, ...pricingContextColumns];

  // Preserve pending edits when combinations change; only clear edits for rows beyond the new combination count
  useEffect(() => {
    setPendingEdits(prev => {
      const next = { ...prev }
      // Remove edits for rows that no longer exist
      Object.keys(next).forEach(idx => {
        if (parseInt(idx) >= combinations.length) {
          delete next[idx]
        }
      })
      return next
    })
  }, [combinations.length])

  const data = useMemo(() => {
    return combinations.map((combo, idx) => {
      // Use variantData values if available (edited by user), otherwise fall back to combo values
      const costPriceValue = variantData[idx]?.costPrice ?? combo.costPrice ?? costPrice ?? '';
      
      const baseData = {
        variant: combo.combination.length > 0 ? combo.combination.map(item => `${item.value}`).join(' / ') : 'Product',
        sku: combo.sku || '',
        managed: combo.managed || false,
        costPrice: costPriceValue,
      };

      // Add pricing context fields for each context
      const pricingData = pricingContexts && pricingContexts.length > 0
        ? pricingContexts.reduce((acc, context) => {
            const marginPercentage = combo[`${context.id}_margin_percentage`] || variantData[idx]?.[`${context.id}_margin_percentage`] || context.margin_percentage || ''
            const marginValue = combo[`${context.id}_margin_value`] || variantData[idx]?.[`${context.id}_margin_value`] || context.margin_value || ''
            let sellingPrice = combo[`${context.id}_selling_price`] || variantData[idx]?.[`${context.id}_selling_price`] || context.selling_price || ''
            
            // If selling_price is not set, calculate it from costPrice + marginValue
            if (!sellingPrice && marginValue && costPriceValue) {
              sellingPrice = calculateSellingPrice(costPriceValue, marginValue)
            }
            
            return {
              ...acc,
              [`${context.id}_margin_percentage`]: marginPercentage,
              [`${context.id}_margin_value`]: marginValue,
              [`${context.id}_selling_price`]: sellingPrice,
              [`${context.id}_bulk_reduction_percentage`]: variantData[idx]?.[`${context.id}_bulk_reduction_percentage`] || combo[`${context.id}_bulk_reduction_percentage`] || '',
              [`${context.id}_bulk_reduction_value`]: variantData[idx]?.[`${context.id}_bulk_reduction_value`] || combo[`${context.id}_bulk_reduction_value`] || '',
              [`${context.id}_bulk_price`]: combo[`${context.id}_bulk_price`] || '',
            }
          }, {})
        : {};

      return { ...baseData, ...pricingData };
    });
  }, [combinations, pricingContexts, costPrice, variantData]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    meta: {
      updateValue: updateValue,
      rowData: variantData,
    },
  });

  return (
    <div className="w-full border rounded-md overflow-hidden flex flex-col h-full">
      {/* Pricing Context Selector - Buttons */}
      {pricingContexts && pricingContexts.length > 0 && (
        <div className="p-3 bg-white border-b flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">Pricing Context:</span>
          {pricingContexts.map(context => (
            <Button
              key={context.id}
              variant={openContextId === context.id ? "default" : "outline"}
              size="sm"
              onClick={() => handleContextSwitch(context.id)}
              className={openContextId === context.id ? "bg-army h-7 text-xs ml-1.5 text-white hover:bg-core_light" : ""}
            >
              {context.name}
            </Button>
          ))}
        </div>
      )}
      
      {/* Horizontal scroll container for pricing context columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">

      
      <Table className="w-full min-w-max text-xs border-collapse">
        <TableHeader className="sticky top-0 z-20">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="h-fit">
              {headerGroup.headers.map((header) => {
                const isDetails = header.id === 'details'
                return (
                  <TableHead
                    data-value={header.id}
                    className={`p-2 text-left font-medium border-r border-gray-200 whitespace-nowrap bg-white ${
                      isDetails ? 'sticky left-0 z-40 shadow-sm' : ''
                    }`}
                    key={header.id}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && 'selected'}
                className="bg-white border-b hover:bg-gray-50"
              >
                {row.getVisibleCells().map((cell) => {
                  const isDetails = cell.column.id === 'details'
                  return (
                    <TableCell
                      data-state={row.getIsSelected() && 'selected'}
                      className={`p-2 align-middle border-r border-gray-100 whitespace-nowrap ${
                        isDetails
                          ? 'sticky left-0 z-30 bg-white'
                          : ''
                      }`}
                      key={cell.id}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  )
                })}
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
        {/* <div className='border-b-orange-400 h-10 w-[2000px]'></div> */}
     </div>
    </div>
  );
}






































































