'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Boxes, MapPin, Package, ShieldCheck } from 'lucide-react'

import supabase from '@/config/supabaseClient'
import {
  Pill,
  StockStateBadge,
  formatQty,
  useInventoryPaths,
  useStockNames,
} from '@/components/modules/inventory/inventory-shared'

function Metric({ label, value, detail, emphasis = false }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${emphasis ? 'text-core' : 'text-foreground'}`}>
        {value}
      </p>
      {detail && <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>}
    </div>
  )
}

export default function StockDetailPage() {
  const { variantId } = useParams()
  const { branchId, stock: stockPath } = useInventoryPaths()
  const [row, setRow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setErrorMessage('')

      const { data, error } = await supabase
        .from('inventory_branch_stock_view')
        .select('*')
        .eq('branch', branchId)
        .eq('variant', variantId)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        console.error('Failed to load stock details:', error)
        setErrorMessage(error.message || 'Could not load stock details.')
        setRow(null)
      } else {
        setRow(data)
      }
      setLoading(false)
    }

    if (branchId && variantId) load()
    return () => {
      cancelled = true
    }
  }, [branchId, variantId])

  const { variants, warehouses } = useStockNames(
    variantId ? [variantId] : [],
    row?.warehouse_ids || []
  )
  const item = variants[variantId]
  const warehouseIds = useMemo(
    () => [...new Set(row?.warehouse_ids || [])],
    [row?.warehouse_ids]
  )

  return (
    <div className="space-y-4 p-4 text-xs">
      <Link
        href={stockPath}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to stock
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Stock details</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
            {item?.title || (loading ? 'Loading product...' : 'Product stock')}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {item?.label && <span>{item.label}</span>}
            {item?.sku && <span className="font-mono">{item.sku}</span>}
            {!item?.label && !item?.sku && !loading && <span>Variant {variantId}</span>}
          </div>
        </div>
        {row && <StockStateBadge state={row.stock_state} />}
      </header>

      {errorMessage && (
        <p role="alert" className="border border-red-200 bg-red-50 p-3 text-red-700">
          {errorMessage}
        </p>
      )}

      {loading ? (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-muted-foreground">
          Loading stock details...
        </p>
      ) : !errorMessage && !row ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="font-medium text-foreground">No stock record found</p>
          <p className="mt-1 text-muted-foreground">
            This product variant has no stock summary for the current branch.
          </p>
        </div>
      ) : row ? (
        <>
          <section aria-label="Stock summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="On hand" value={formatQty(row.quantity_on_hand)} detail="Available and reserved stock" />
            <Metric label="Reserved" value={formatQty(row.quantity_reserved)} detail="Held back from available stock" />
            <Metric label="Available" value={formatQty(row.quantity_available)} emphasis />
            <Metric
              label="In quarantine"
              value={formatQty(row.quantity_quarantine)}
              detail="Received goods awaiting inventory review"
            />
          </section>

          <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" />
                <h3 className="font-semibold text-foreground">Stock locations</h3>
              </div>
              {warehouseIds.length ? (
                <>
                  <p className="mt-2 text-sm text-foreground">
                    Held in {formatQty(row.warehouse_count ?? warehouseIds.length)} warehouse
                    {Number(row.warehouse_count ?? warehouseIds.length) === 1 ? '' : 's'}
                  </p>
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    {warehouseIds.map((id) => (
                      <li key={id}>{warehouses[id] || 'Warehouse'}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Quantities are shown as a branch total. Per-warehouse quantities are not included in this stock summary.
                  </p>
                </>
              ) : (
                <p className="mt-2 text-muted-foreground">No warehouse location is recorded for this stock.</p>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <Package className="size-4 text-muted-foreground" />
                <h3 className="font-semibold text-foreground">Replenishment</h3>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Suggested order</span>
                <span className="font-semibold text-foreground">
                  {row.suggested_order_quantity == null ? '—' : formatQty(row.suggested_order_quantity)}
                </span>
              </div>
              {Number(row.warehouse_count) > 1 && Number(row.low_warehouses) > 0 && (
                <p className="mt-2 text-[11px] text-amber-700">
                  Low stock in {formatQty(row.low_warehouses)} of {formatQty(row.warehouse_count)} warehouses.
                </p>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                Reorder suggestions are calculated from the branch stock settings.
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2">
              {item?.isTracked ? (
                <ShieldCheck className="size-4 text-muted-foreground" />
              ) : (
                <Boxes className="size-4 text-muted-foreground" />
              )}
              <h3 className="font-semibold text-foreground">Inventory tracking</h3>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Pill className={item?.isTracked ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : ''}>
                {item?.isTracked ? 'Stock tracked' : 'Stock not tracked'}
              </Pill>
              {item?.trackingMode && item.trackingMode !== 'none' && (
                <Pill>{item.trackingMode === 'batch' ? 'Batch tracked' : 'Serial tracked'}</Pill>
              )}
              {item?.requiresExpiry && (
                <Pill className="border-amber-200 bg-amber-50 text-amber-700">Expiry date required</Pill>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
