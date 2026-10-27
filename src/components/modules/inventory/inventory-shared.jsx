'use client'

import { useContext, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

import supabase from '@/config/supabaseClient'
import { BranchContext } from '@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext'

// Shared pieces for the Inventory pages (Stock, Warehouses, ...).

export function useInventoryPaths() {
  const { u, companyId, branchId } = useParams()
  const root = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory`
  return {
    u,
    companyId,
    branchId,
    root,
    stock: `${root}/stock`,
    warehouses: `${root}/warehouses`,
  }
}

export function useBranchCurrency() {
  const { currentBranch } = useContext(BranchContext) || {}
  return currentBranch?.base_currency || ''
}

export function formatQty(value) {
  const number = Number(value || 0)
  return number.toLocaleString(undefined, { maximumFractionDigits: 3 })
}

export function formatMoney(value, currency) {
  const number = Number(value || 0)
  const text = number.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return currency ? `${currency} ${text}` : text
}

export function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
}

const STATE_STYLES = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  low: 'border-amber-200 bg-amber-50 text-amber-700',
  out: 'border-red-200 bg-red-50 text-red-700',
}

const STATE_LABELS = { ok: 'Healthy', low: 'Low Stock', out: 'Out of Stock' }

export function Pill({ className = '', children }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${className}`}
    >
      {children}
    </span>
  )
}

export function StockStateBadge({ state }) {
  return <Pill className={STATE_STYLES[state] || STATE_STYLES.ok}>{STATE_LABELS[state] || 'Healthy'}</Pill>
}

// Product title, variant label and SKU for a list of variant ids, plus
// warehouse names for a list of warehouse ids.
export function useStockNames(variantIds, warehouseIds = []) {
  const variantKey = [...new Set((variantIds || []).filter(Boolean))].sort().join(',')
  const warehouseKey = [...new Set((warehouseIds || []).filter(Boolean))].sort().join(',')
  const [variants, setVariants] = useState({})
  const [warehouses, setWarehouses] = useState({})

  useEffect(() => {
    let cancelled = false

    async function load() {
      const ids = variantKey ? variantKey.split(',') : []
      if (ids.length === 0) return

      const { data: variantRows, error } = await supabase
        .from('product_variants')
        .select('id, product, variant_label, sku, tracking_mode, requires_expiry, is_tracked_inventory')
        .in('id', ids)
      if (cancelled) return
      if (error) {
        console.error('Could not read product details:', error)
        return
      }

      const productIds = [...new Set((variantRows || []).map((row) => row.product).filter(Boolean))]
      let titles = new Map()
      if (productIds.length > 0) {
        const { data: productRows } = await supabase
          .from('products')
          .select('id, title')
          .in('id', productIds)
        titles = new Map((productRows || []).map((row) => [row.id, row.title]))
      }
      if (cancelled) return

      setVariants((previous) => {
        const next = { ...previous }
        for (const row of variantRows || []) {
          next[row.id] = {
            id: row.id,
            title: titles.get(row.product) || 'Product',
            label: row.variant_label || '',
            sku: row.sku || '',
            trackingMode: row.tracking_mode || 'none',
            requiresExpiry: row.requires_expiry === true,
            isTracked: row.is_tracked_inventory !== false,
          }
        }
        return next
      })
    }

    load()
    return () => {
      cancelled = true
    }
  }, [variantKey])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const ids = warehouseKey ? warehouseKey.split(',') : []
      if (ids.length === 0) return
      const { data, error } = await supabase.from('warehouses').select('*').in('id', ids)
      if (cancelled) return
      if (error) {
        console.error('Could not read warehouse names:', error)
        return
      }
      setWarehouses((previous) => {
        const next = { ...previous }
        for (const row of data || []) next[row.id] = row.name || row.label || row.code || 'Warehouse'
        return next
      })
    }

    load()
    return () => {
      cancelled = true
    }
  }, [warehouseKey])

  return { variants, warehouses }
}

// Simple client-side paging for list pages.
export function PageControls({ page, pageSize, total, onPage }) {
  if (total <= pageSize) return null
  const pages = Math.ceil(total / pageSize)
  return (
    <div className="flex items-center justify-between px-1 py-2 text-xs text-muted-foreground">
      <span>
        {(page * pageSize + 1).toLocaleString()}–{Math.min((page + 1) * pageSize, total).toLocaleString()} of{' '}
        {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
          className="rounded border border-gray-200 px-2 py-1 disabled:opacity-40"
        >
          Previous
        </button>
        <span>
          Page {page + 1} of {pages}
        </span>
        <button
          type="button"
          disabled={page >= pages - 1}
          onClick={() => onPage(page + 1)}
          className="rounded border border-gray-200 px-2 py-1 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}
