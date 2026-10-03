'use client'

import { useContext, useEffect, useState } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import supabase from '@/config/supabaseClient'
import { BranchContext } from '@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext'
import { useParams } from 'next/navigation'

// ----------------------------------------------------------------------
// Sales Overview
//
// BRANCH-SPECIFIC:
//   - Sales performance
//   - Sales orders
//   - Deliveries
//   - Invoices / receivables
//   - Recent sales activity
// ----------------------------------------------------------------------

function StatCard({ label, value, loading }) {
  return (
    <div className="border border-border rounded-sm bg-card p-4">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground mt-1">
        {loading ? '—' : value}
      </p>
    </div>
  )
}

const ACTIVITY_TABS = [
  { key: 'orders', label: 'Orders' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'deliveries', label: 'Deliveries' },
  { key: 'payments', label: 'Payments' },
]

export default function SalesOverviewPage() {
  const { u, companyId, branchId } = useParams()
  const { currentBranch } = useContext(BranchContext)

  const [loading, setLoading] = useState(true)

  const [stats, setStats] = useState({
    salesThisMonth: 0,
    invoices: 0,
    receivables: 0,
    openOrders: 0,
    pendingDeliveries: 0,
    partialOrders: 0,
    unpaidInvoices: 0,
    overdueInvoices: 0,
  })

  const [activeTab, setActiveTab] = useState('orders')

  const [activity, setActivity] = useState({
    orders: [],
    invoices: [],
    deliveries: [],
    payments: [],
  })

  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`

  useEffect(() => {
    if (!companyId || !branchId) return

    const fetchOverview = async () => {
      setLoading(true)

      try {
        /*
         * These queries assume the following conceptual tables:
         *
         * sales_orders
         * sales_invoices
         * deliveries
         * payments
         *
         * Adjust table/column names to your final schema.
         */

        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const [
          { data: orders },
          { data: invoices },
          { data: deliveries },
          { data: payments },
        ] = await Promise.all([
          supabase
            .from('sales_orders')
            .select('id, total, status, created_at')
            .eq('branch', branchId)
            .order('created_at', { ascending: false })
            .limit(100),

          supabase
            .from('sales_invoices')
            .select('id, total, paid_amount, balance, status, due_date, created_at')
            .eq('branch', branchId)
            .order('created_at', { ascending: false })
            .limit(100),

          supabase
            .from('deliveries')
            .select('id, status, created_at')
            .eq('branch', branchId)
            .order('created_at', { ascending: false })
            .limit(100),

          supabase
            .from('payments')
            .select('id, amount, created_at')
            .eq('branch', branchId)
            .order('created_at', { ascending: false })
            .limit(100),
        ])

        const orderRows = orders || []
        const invoiceRows = invoices || []
        const deliveryRows = deliveries || []
        const paymentRows = payments || []

        const salesThisMonth = invoiceRows
          .filter((row) => new Date(row.created_at) >= startOfMonth)
          .reduce((sum, row) => sum + Number(row.total || 0), 0)

        const receivables = invoiceRows
          .reduce((sum, row) => sum + Number(row.balance || 0), 0)

        const openOrders = orderRows.filter((row) =>
          ['draft', 'confirmed', 'partially_fulfilled'].includes(row.status)
        ).length

        const pendingDeliveries = deliveryRows.filter((row) =>
          ['draft', 'pending', 'in_transit'].includes(row.status)
        ).length

        const partialOrders = orderRows.filter(
          (row) => row.status === 'partially_fulfilled'
        ).length

        const unpaidInvoices = invoiceRows.filter(
          (row) => row.status === 'unpaid'
        ).length

        const overdueInvoices = invoiceRows.filter((row) => {
          if (!row.due_date) return false

          return (
            new Date(row.due_date) < new Date() &&
            Number(row.balance || 0) > 0
          )
        }).length

        setStats({
          salesThisMonth,
          invoices: invoiceRows.length,
          receivables,
          openOrders,
          pendingDeliveries,
          partialOrders,
          unpaidInvoices,
          overdueInvoices,
        })

        setActivity({
          orders: orderRows.slice(0, 10).map((row) => ({
            id: row.id,
            primary: `Order ${row.id}`,
            secondary: `${row.status || 'Unknown'} · ${Number(row.total || 0).toLocaleString()}`,
            timestamp: row.created_at,
          })),

          invoices: invoiceRows.slice(0, 10).map((row) => ({
            id: row.id,
            primary: `Invoice ${row.id}`,
            secondary: `${row.status || 'Unknown'} · Balance ${Number(row.balance || 0).toLocaleString()}`,
            timestamp: row.created_at,
          })),

          deliveries: deliveryRows.slice(0, 10).map((row) => ({
            id: row.id,
            primary: `Delivery ${row.id}`,
            secondary: row.status || 'Unknown',
            timestamp: row.created_at,
          })),

          payments: paymentRows.slice(0, 10).map((row) => ({
            id: row.id,
            primary: `Payment ${row.id}`,
            secondary: Number(row.amount || 0).toLocaleString(),
            timestamp: row.created_at,
          })),
        })
      } catch (err) {
        console.error('Error loading sales overview:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchOverview()
  }, [companyId, branchId])

  const currentActivity = activity[activeTab] || []

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Sales activity and performance for this branch."
      />

      <div className="p space-y-6 text-xs">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">

          <div className="lg:col-span-3 space-y-6">

            {/* Primary statistics */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                label="Sales This Month"
                value={
                  loading
                    ? '—'
                    : `${currentBranch?.base_currency || ''} ${stats.salesThisMonth.toLocaleString()}`
                }
                loading={loading}
              />

              <StatCard
                label="Sales Invoices"
                value={stats.invoices}
                loading={loading}
              />

              <StatCard
                label="Outstanding Receivables"
                value={
                  loading
                    ? '—'
                    : `${currentBranch?.base_currency || ''} ${stats.receivables.toLocaleString()}`
                }
                loading={loading}
              />

              <StatCard
                label="Open Sales Orders"
                value={stats.openOrders}
                loading={loading}
              />
            </div>

            {/* Operational statistics */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                label="Pending Deliveries"
                value={stats.pendingDeliveries}
                loading={loading}
              />

              <StatCard
                label="Partially Fulfilled"
                value={stats.partialOrders}
                loading={loading}
              />

              <StatCard
                label="Unpaid Invoices"
                value={stats.unpaidInvoices}
                loading={loading}
              />

              <StatCard
                label="Overdue Invoices"
                value={stats.overdueInvoices}
                loading={loading}
              />
            </div>

            {/* Recent activity */}
            <div className="border border-border rounded-sm bg-card">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-xs font-semibold text-foreground">
                  Recent Activity
                </h2>

                <p className="text-[10px] text-muted-foreground">
                  Recent sales orders, invoices, deliveries and payments for this branch.
                </p>
              </div>

              <div className="flex gap-1 border-b border-border px-4 pt-2">
                {ACTIVITY_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-3 py-1.5 rounded-t-sm text-[11px] font-medium ${
                      activeTab === tab.key
                        ? 'bg-core_light text-core border border-b-0 border-border'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {loading ? (
                <p className="px-4 py-6 text-muted-foreground">
                  Loading activity...
                </p>
              ) : currentActivity.length === 0 ? (
                <p className="px-4 py-6 text-muted-foreground">
                  Nothing here yet.
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-muted text-[10px] font-medium text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Reference</th>
                      <th className="px-4 py-2 text-left">Details</th>
                      <th className="px-4 py-2 text-right">When</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border">
                    {currentActivity.map((event) => (
                      <tr key={event.id}>
                        <td className="px-4 py-2 text-foreground font-medium">
                          {event.primary}
                        </td>

                        <td className="px-4 py-2 text-muted-foreground">
                          {event.secondary}
                        </td>

                        <td className="px-4 py-2 text-right text-muted-foreground">
                          {new Date(event.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Branch context */}
          <div className="space-y-4">

            <div className="border border-border rounded-sm bg-card p-4 space-y-3">
              <h2 className="text-xs font-semibold text-foreground">
                This branch
              </h2>

              <div>
                <p className="text-[10px] text-muted-foreground">
                  Currency
                </p>

                <p className="font-medium text-foreground">
                  {currentBranch?.base_currency || '—'}
                </p>
              </div>

              <div>
                <p className="text-[10px] text-muted-foreground">
                  Open orders
                </p>

                <p className="font-medium text-foreground">
                  {loading ? '—' : stats.openOrders}
                </p>
              </div>

              <div>
                <p className="text-[10px] text-muted-foreground">
                  Outstanding receivables
                </p>

                <p className="font-medium text-foreground">
                  {loading
                    ? '—'
                    : `${currentBranch?.base_currency || ''} ${stats.receivables.toLocaleString()}`}
                </p>
              </div>
            </div>

            <div className="border border-border rounded-sm bg-card p-4 space-y-2">
              <h2 className="text-xs font-semibold text-foreground mb-1">
                Quick actions
              </h2>

              <Link
                href={`${basePath}/orders/new`}
                className="block rounded-sm bg-core px-3 py-2 text-center text-white hover:bg-core/90"
              >
                New sales order
              </Link>

              <Link
                href={`${basePath}/invoices/new`}
                className="block rounded-sm border border-border px-3 py-2 text-center text-muted-foreground hover:bg-muted"
              >
                New invoice
              </Link>

              <Link
                href={`${basePath}/customers`}
                className="block rounded-sm border border-border px-3 py-2 text-center text-muted-foreground hover:bg-muted"
              >
                View customers
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}