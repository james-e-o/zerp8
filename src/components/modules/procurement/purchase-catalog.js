'use client'

import supabase from '@/config/supabaseClient'

import { useEffect, useState, useCallback } from 'react'

/**
 * Suppliers for a company (suppliers are company-level, not branch-level,
 * matching the customers-are-branch-level / suppliers-are-company-level split
 * implied by the PO approval rules we've already settled).
 */
export function useSuppliers(companyId) {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!companyId) return
      setLoading(true)
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, payment_terms, email, phone')
        .eq('company', companyId)
        .order('name', { ascending: true })

      if (cancelled) return

      if (error) {
        setError(error.message)
      } else {
        setSuppliers(data || [])
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [companyId])

  return { suppliers, loading, error }
}

/**
 * Approved Purchase Requests for a branch that have not yet been converted
 * into a Purchase Order. Used by the "convert from request" picker on the
 * New Purchase Order form. Purchase Requests are optional input to a PO,
 * never required.
 */
export function useConvertibleRequests(branchId) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!branchId) return
      setLoading(true)
      const { data, error } = await supabase
        .from('purchase_requests')
        .select(
          'id, request_number, requested_by, needed_by, notes, purchase_request_line_items(id, variant, quantity_requested)'
        )
        .eq('branch', branchId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (error) {
        setError(error.message)
      } else {
        setRequests(data || [])
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [branchId])

  return { requests, loading, error }
}

/**
 * Purchase Orders for a branch that still have an outstanding balance to
 * receive or bill against. `purpose` narrows which POs are eligible:
 *  - 'receive': status in (open, sent, partially_received) — still has qty left to receive.
 *    'open' is included because an order is receivable the moment it's
 *    raised internally - nothing about receiving depends on whether it's
 *    been formally sent/exported to the supplier yet (that's a separate,
 *    later action from the order detail page's own Send sheet). This was
 *    previously just (sent, partially_received), written before the
 *    open/sent status split existed - it silently hid every order raised
 *    since then, since none of them had ever been marked 'sent'.
 *  - 'bill':    any PO/receipt that has been received (has at least one posted receipt)
 */
export function useReceivablePurchaseOrders(branchId) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('purchase_orders')
      .select(
        `id, order_number, supplier, status, expected_delivery_date,
         purchase_order_line_items (
           id, variant, quantity_ordered, quantity_received, unit_cost_snapshot
         )`
      )
      .eq('branch', branchId)
      .in('status', ['open', 'sent', 'partially_received'])
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setOrders(data || [])
    }
    setLoading(false)
  }, [branchId])

  useEffect(() => {
    reload()
  }, [reload])

  return { orders, loading, error, reload }
}

/**
 * SUPERSEDED — bills no longer require a Receipt (see
 * usePurchaseOrdersForBilling below). Real supplier relationships
 * sometimes need a bill, and even a payment, before anything has been
 * received (a required down payment) — mandating a Receipt up front
 * made that impossible. Kept here, unused, only so nothing else that
 * might still import it breaks; new code should not call this.
 */
export function useBillableReceipts(branchId) {
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!branchId) return
      setLoading(true)
      const { data, error } = await supabase
        .from('purchase_receipts')
        .select(
          `id, receipt_number, status, created_at,
           purchase_order (id, order_number, supplier),
           purchase_receipt_line_items ( id, variant, quantity, unit_cost_snapshot )`
        )
        .eq('branch', branchId)
        .eq('status', 'posted')
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (error) {
        setError(error.message)
      } else {
        setReceipts(data || [])
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [branchId])

  return { receipts, loading, error }
}

/**
 * Purchase Orders a Bill can be raised against. A Bill always starts
 * from a PO (never a Receipt directly) — this is deliberately NOT
 * filtered to "has a receipt yet", so a down-payment bill can be
 * raised the moment a PO exists, with no delivery required first.
 * Excludes only 'cancelled' orders. Each line item carries
 * quantity_ordered/received/billed and unit_cost_snapshot so the Bill
 * form can show the running balance and default unit prices the
 * moment a PO is picked.
 */
/**
 * Product name + variant label for a list of variant ids, shared by every
 * purchases page that shows line items (Bills, Receipts...), so none of
 * them has to show a raw variant id or a bare variant label again.
 *
 * product_variants.product -> products.id, and the name lives in
 * products.title (same lookup the purchase request page uses).
 *
 * Returns { names, loading } where names is
 *   { [variantId]: { title, variantLabel, sku, display } }
 * and display is "Title" (default variant) or "Title - Label".
 * Use `names[id]?.display` and fall back to '—' while it loads.
 */
export function useVariantNames(variantIds) {
  const [names, setNames] = useState({})
  const [loading, setLoading] = useState(false)

  // A stable key so a new array with the same ids doesn't refetch.
  const key = [...new Set((variantIds || []).filter(Boolean))].sort().join(',')

  useEffect(() => {
    let cancelled = false

    async function load() {
      const ids = key ? key.split(',') : []
      if (ids.length === 0) {
        setNames({})
        return
      }

      setLoading(true)
      const { data: variants, error: variantError } = await supabase
        .from('product_variants')
        .select('id, product, variant_label, sku')
        .in('id', ids)

      if (cancelled) return
      if (variantError) {
        setLoading(false)
        return
      }

      const productIds = [...new Set((variants || []).map((v) => v.product).filter(Boolean))]
      let titles = {}
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, title')
          .in('id', productIds)
        titles = Object.fromEntries((products || []).map((p) => [p.id, p.title]))
      }

      if (cancelled) return

      const result = {}
      for (const v of variants || []) {
        const title = titles[v.product] || ''
        const label = v.variant_label || ''
        result[v.id] = {
          title,
          variantLabel: label,
          sku: v.sku || '',
          display: title && label ? `${title} - ${label}` : title || label || v.sku || '',
        }
      }
      setNames(result)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [key])

  return { names, loading }
}

export function usePurchaseOrdersForBilling(branchId) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!branchId) return
      setLoading(true)
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(
          `id, order_number, supplier:suppliers(id, name), status,
           purchase_order_line_items (
             id, variant, quantity_ordered, quantity_received, quantity_billed,
             unit_cost_snapshot, cost_currency,
             product_variants ( id, product, variant_label, sku )
           )`
        )
        .eq('branch', branchId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (error) {
        setError(error.message)
      } else {
        setOrders(data || [])
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [branchId])

  return { orders, loading, error }
}

/**
 * Receipts already posted against a given PO — shown as an optional
 * reference on the Bill form once a PO is picked (never required: a
 * bill can exist with zero receipts, e.g. a deposit).
 */
export function useReceiptsForPurchaseOrder(purchaseOrderId) {
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!purchaseOrderId) {
        setReceipts([])
        setLoading(false)
        return
      }
      setLoading(true)
      const { data, error } = await supabase
        .from('purchase_receipts')
        .select('id, receipt_number, status, received_at')
        .eq('purchase_order', purchaseOrderId)
        .order('received_at', { ascending: false })

      if (cancelled) return
      if (!error) setReceipts(data || [])
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [purchaseOrderId])

  return { receipts, loading }
}

/**
 * Live PO balance (ordered/received/billed/paid/GRNI) from
 * get_po_purchase_balance — drives the Bill form's "here's where this
 * PO stands" panel once a PO is selected.
 */
export function usePoPurchaseBalance(purchaseOrderId) {
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!purchaseOrderId) {
        setBalance(null)
        return
      }
      setLoading(true)
      const { data, error } = await supabase.rpc('get_po_purchase_balance', {
        p_purchase_order: purchaseOrderId,
      })

      if (cancelled) return
      if (!error) setBalance(data?.[0] || null)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [purchaseOrderId])

  return { balance, loading }
}