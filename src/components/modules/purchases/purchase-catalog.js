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
 *  - 'receive': status in (approved, partially_received) — still has qty left to receive
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
      .in('status', ['approved', 'partially_received'])
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
 * Posted receipts for a branch that are eligible to be billed — i.e. they
 * exist and a bill has not yet been raised covering their full received
 * value. Kept intentionally simple: returns all posted receipts with their
 * PO and supplier attached; the Bill form does the "how much is left to
 * bill" arithmetic against `bills` for that receipt.
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