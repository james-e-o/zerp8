'use client'

import { useContext, useEffect, useState } from 'react'

import supabase from '@/config/supabaseClient'
import { BranchContext } from '@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext'
import { formatCurrency } from '@/components/modules/purchases/dummy-data'

// Small pieces shared by the quotation pages, the customer pages and (later) sales orders,
// so money, dates, totals and status labels are done one way everywhere.

export const FALLBACK_VAT_RATE = 7.5

export function useMoney() {
  const { currentBranch } = useContext(BranchContext) || {}
  return (amount) => formatCurrency(Number(amount || 0), currentBranch?.base_currency || '')
}

export function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

export function toDateInput(value) {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

// Branch sales settings (reserve stock default, VAT rate, valid days, payment terms...).
// Falls back to the defaults when the call fails so the form still works.
const SETTINGS_FALLBACK = {
  reserve_stock_on_order: true,
  default_vat_rate: FALLBACK_VAT_RATE,
  quotation_valid_days: 14,
  default_payment_terms: 'Due on receipt',
}

export function useSalesSettings(branchId) {
  const [settings, setSettings] = useState(SETTINGS_FALLBACK)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!branchId) return
      const { data, error } = await supabase.rpc('get_effective_sales_settings', { p_branch: branchId })
      if (cancelled) return
      if (!error && data?.success) {
        setSettings({
          ...data,
          reserve_stock_on_order: data.reserve_stock_on_order !== false,
          default_vat_rate: Number(data.default_vat_rate ?? FALLBACK_VAT_RATE),
        })
      }
      setLoaded(true)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [branchId])

  return { settings, loaded }
}

export function emptyQuotationLine() {
  return {
    variantId: '',
    productId: '',
    productTitle: '',
    variantLabel: '',
    sku: '',
    qty: 0,
    unitPrice: 0,
    pricingContextId: '',
    discountType: 'amount',
    discountValue: 0,
  }
}

// Free stock of a variant. warehouseId '' means every warehouse of the branch.
// Services and other non-stocked variants have no limit (Infinity).
export function getAvailableStock(variant, warehouseId) {
  if (!variant) return 0
  if (variant.is_tracked_inventory === false) return Infinity
  if (warehouseId) return Number(variant.stockByWarehouse?.[warehouseId] ?? 0)
  return Number(variant.availableQuantity ?? 0)
}

export function getLineDiscount(item) {
  const subtotal = Number(item.qty || 0) * Number(item.unitPrice || 0)
  return item.discountType === 'percentage'
    ? (subtotal * Math.min(100, Math.max(0, Number(item.discountValue || 0)))) / 100
    : Math.min(subtotal, Math.max(0, Number(item.discountValue || 0)))
}

export function getLineTotal(item) {
  const subtotal = Number(item.qty || 0) * Number(item.unitPrice || 0)
  return Math.max(0, subtotal - getLineDiscount(item))
}

// Same arithmetic as the database (sales_compute_totals), used for the live summary.
// The database recalculates on save, so these numbers can never drift into the record.
export function computeTotals(items, discountType, discountValue, applyVat, vatRate) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.unitPrice || 0), 0)
  const lineDiscounts = items.reduce((sum, item) => sum + getLineDiscount(item), 0)
  const net = subtotal - lineDiscounts
  const documentDiscount =
    discountType === 'percentage'
      ? (net * Math.min(100, Math.max(0, Number(discountValue || 0)))) / 100
      : Math.min(net, Math.max(0, Number(discountValue || 0)))
  const taxable = Math.max(0, net - documentDiscount)
  const vat = applyVat ? (taxable * Number(vatRate || 0)) / 100 : 0
  return { subtotal, lineDiscounts, documentDiscount, taxable, vat, total: taxable + vat }
}

export function itemsToRpcLines(items) {
  return items
    .filter((item) => item.variantId)
    .map((item) => ({
      variant: item.variantId,
      quantity: Number(item.qty || 0),
      unit_price: Number(item.unitPrice || 0),
      discount_type: item.discountType || 'amount',
      discount_value: Number(item.discountValue || 0),
      pricing_context: item.pricingContextId || null,
      description_snapshot: item.productTitle || '',
      variant_label_snapshot: item.variantLabel || '',
      sku_snapshot: item.sku || '',
    }))
}

export function rowsToItems(rows) {
  return (rows || []).map((row) => ({
    variantId: row.variant,
    productId: '',
    productTitle: row.description_snapshot || '',
    variantLabel: row.variant_label_snapshot || '',
    sku: row.sku_snapshot || '',
    qty: Number(row.quantity || 1),
    unitPrice: Number(row.unit_price_snapshot || 0),
    pricingContextId: row.pricing_context || '',
    discountType: row.discount_type || 'amount',
    discountValue: Number(row.discount_value || 0),
  }))
}

// "Expired" is never stored: a sent quotation whose valid-until date has passed.
export function isQuotationExpired(quotation) {
  if (!quotation || quotation.status !== 'sent' || !quotation.valid_until) return false
  const end = new Date(quotation.valid_until)
  if (Number.isNaN(end.getTime())) return false
  end.setHours(23, 59, 59, 999)
  return end.getTime() < Date.now()
}

const STATUS_STYLES = {
  draft: ['Draft', 'bg-muted text-muted-foreground'],
  sent: ['Sent', 'bg-blue-50 text-blue-700'],
  accepted: ['Accepted', 'bg-emerald-50 text-emerald-700'],
  rejected: ['Rejected', 'bg-red-50 text-red-700'],
  expired: ['Expired', 'bg-amber-50 text-amber-700'],
}

export function QuotationStatusPill({ quotation, status }) {
  const key = quotation ? (isQuotationExpired(quotation) ? 'expired' : quotation.status) : status
  const [label, style] = STATUS_STYLES[key] || [key || '—', 'bg-muted text-muted-foreground']
  return (
    <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${style}`}>{label}</span>
  )
}
