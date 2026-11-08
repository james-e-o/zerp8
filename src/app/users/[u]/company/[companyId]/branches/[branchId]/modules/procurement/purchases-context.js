'use client'

// ----------------------------------------------------------------------
// PurchasesProvider / usePurchasesContext
//
// All Supabase fetching for the purchases module lives HERE now, not in
// individual page.js files. This is mounted once in PurchasesLayoutClient,
// which wraps every purchases subroute (overview, suppliers, orders,
// receipts, bills, returns, requests, settings) - since Next's app router
// does not remount a layout when navigating between sibling subroutes,
// this fetch runs once per branch visit, not once per page.
//
// Scope note: this currently covers exactly what the Overview page needed
// (requests, orders, receipts, bills) - it does not yet fetch suppliers,
// returns, or any per-row detail (line items beyond what's needed to
// compute order totals). Extend this file once the other subroute pages
// are available, rather than guessing at what they need.
//
// Column notes (why the mapping below exists):
//   - purchase_orders has no `total` column. It's computed here by
//     summing each order's purchase_order_line_items.line_total via a
//     Supabase embedded-resource select, not stored anywhere.
//   - purchase_bills has `paid`, not `paid_amount`, and no `balance`
//     column at all. `balance` is computed here as total - paid.
// If this ever becomes a performance problem (large branches, frequent
// reads), the alternative is promoting these to real stored columns kept
// in sync by triggers/RPCs - deliberately not done here since it wasn't
// asked for and changes the schema.
// ----------------------------------------------------------------------

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import supabase from '@/config/supabaseClient'

const PurchasesContext = createContext(null)

export function PurchasesProvider({ branchId, children }) {
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState([])
  const [orders, setOrders] = useState([])
  const [receipts, setReceipts] = useState([])
  const [bills, setBills] = useState([])

  const fetchAll = useCallback(async () => {
    if (!branchId) return

    setLoading(true)

    try {
      const [
        { data: requestRows, error: requestsError },
        { data: orderRows, error: ordersError },
        { data: receiptRows, error: receiptsError },
        { data: billRows, error: billsError },
      ] = await Promise.all([
        supabase
          .from('purchase_requests')
          .select('id, status, created_at')
          .eq('branch', branchId)
          .order('created_at', { ascending: false })
          .limit(100),

        supabase
          .from('purchase_orders')
          .select('id, status, created_at, purchase_order_line_items(line_total)')
          .eq('branch', branchId)
          .order('created_at', { ascending: false })
          .limit(100),

        supabase
          .from('purchase_receipts')
          .select('id, status, created_at')
          .eq('branch', branchId)
          .order('created_at', { ascending: false })
          .limit(100),

        supabase
          .from('purchase_bills')
          .select('id, total, paid, status, due_date, created_at')
          .eq('branch', branchId)
          .order('created_at', { ascending: false })
          .limit(100),
      ])

      if (requestsError) throw requestsError
      if (ordersError) throw ordersError
      if (receiptsError) throw receiptsError
      if (billsError) throw billsError

      const ordersWithTotal = (orderRows || []).map((row) => ({
        ...row,
        total: (row.purchase_order_line_items || []).reduce(
          (sum, li) => sum + Number(li.line_total || 0),
          0
        ),
      }))

      const billsWithBalance = (billRows || []).map((row) => ({
        ...row,
        balance: Number(row.total || 0) - Number(row.paid || 0),
      }))

      setRequests(requestRows || [])
      setOrders(ordersWithTotal)
      setReceipts(receiptRows || [])
      setBills(billsWithBalance)
    } catch (err) {
      console.error('Error loading purchases context data:', err)
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return (
    <PurchasesContext.Provider
      value={{ loading, requests, orders, receipts, bills, refetch: fetchAll }}
    >
      {children}
    </PurchasesContext.Provider>
  )
}

export function usePurchasesContext() {
  const ctx = useContext(PurchasesContext)
  if (!ctx) {
    throw new Error('usePurchasesContext must be used within a PurchasesProvider')
  }
  return ctx
}