'use client'

import { useContext, useEffect, useState } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import supabase from '@/config/supabaseClient'
import { BranchContext } from '@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext'
import { useParams } from 'next/navigation'

// ----------------------------------------------------------------------
// Purchases Overview
//
// BRANCH-SPECIFIC:
//   - Purchase requests
//   - Purchase orders
//   - Receipts
//   - Supplier bills
//   - Purchase returns
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
  { key: 'requests', label: 'Requests' },
  { key: 'orders', label: 'Orders' },
  { key: 'receipts', label: 'Receipts' },
  { key: 'bills', label: 'Bills' },
]

export default function PurchasesOverviewPage() {
  const { u, companyId, branchId } = useParams()
  const { currentBranch } = useContext(BranchContext)

  const [loading, setLoading] = useState(true)

  const [stats, setStats] = useState({
    purchaseSpend: 0,
    openOrders: 0,
    outstandingBills: 0,
    pendingRequests: 0,
    awaitingReceipt: 0,
    partialOrders: 0,
    unpaidBills: 0,
    overdueBills: 0,
  })

  const [activeTab, setActiveTab] = useState('requests')

  const [activity, setActivity] = useState({
    requests: [],
    orders: [],
    receipts: [],
    bills: [],
  })

  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases`

  useEffect(() => {
    if (!companyId || !branchId) return

    const fetchOverview = async () => {
      setLoading(true)

      try {
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const [
          { data: requests },
          { data: orders },
          { data: receipts },
          { data: bills },
        ] = await Promise.all([
          supabase
            .from('purchase_requests')
            .select('id, status, created_at')
            .eq('branch', branchId)
            .order('created_at', { ascending: false })
            .limit(100),

          supabase
            .from('purchase_orders')
            .select('id, total, status, created_at')
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
            .select('id, total, paid_amount, balance, status, due_date, created_at')
            .eq('branch', branchId)
            .order('created_at', { ascending: false })
            .limit(100),
        ])

        const requestRows = requests || []
        const orderRows = orders || []
        const receiptRows = receipts || []
        const billRows = bills || []

        const purchaseSpend = billRows
          .filter((row) => new Date(row.created_at) >= startOfMonth)
          .reduce((sum, row) => sum + Number(row.total || 0), 0)

        const outstandingBills = billRows
          .reduce((sum, row) => sum + Number(row.balance || 0), 0)

        const pendingRequests = requestRows.filter((row) =>
          ['pending', 'pending_approval'].includes(row.status)
        ).length

        const openOrders = orderRows.filter((row) =>
          ['draft', 'pending', 'approved', 'partially_received'].includes(row.status)
        ).length

        const awaitingReceipt = orderRows.filter((row) =>
          ['approved', 'confirmed', 'partially_received'].includes(row.status)
        ).length

        const partialOrders = orderRows.filter(
          (row) => row.status === 'partially_received'
        ).length

        const unpaidBills = billRows.filter(
          (row) => row.status === 'unpaid'
        ).length

        const overdueBills = billRows.filter((row) => {
          if (!row.due_date) return false

          return (
            new Date(row.due_date) < new Date() &&
            Number(row.balance || 0) > 0
          )
        }).length

        setStats({
          purchaseSpend,
          openOrders,
          outstandingBills,
          pendingRequests,
          awaitingReceipt,
          partialOrders,
          unpaidBills,
          overdueBills,
        })

        setActivity({
          requests: requestRows.slice(0, 10).map((row) => ({
            id: row.id,
            primary: `Request ${row.id}`,
            secondary: row.status || 'Unknown',
            timestamp: row.created_at,
          })),

          orders: orderRows.slice(0, 10).map((row) => ({
            id: row.id,
            primary: `Purchase Order ${row.id}`,
            secondary: `${row.status || 'Unknown'} · ${Number(row.total || 0).toLocaleString()}`,
            timestamp: row.created_at,
          })),

          receipts: receiptRows.slice(0, 10).map((row) => ({
            id: row.id,
            primary: `Receipt ${row.id}`,
            secondary: row.status || 'Unknown',
            timestamp: row.created_at,
          })),

          bills: billRows.slice(0, 10).map((row) => ({
            id: row.id,
            primary: `Bill ${row.id}`,
            secondary: `${row.status || 'Unknown'} · Balance ${Number(row.balance || 0).toLocaleString()}`,
            timestamp: row.created_at,
          })),
        })
      } catch (err) {
        console.error('Error loading purchases overview:', err)
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
        description="Purchasing activity and supplier obligations for this branch."
      />

      <div className="p space-y-6 text-xs">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">

          <div className="lg:col-span-3 space-y-6">

            {/* Primary statistics */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                label="Purchase Spend This Month"
                value={
                  loading
                    ? '—'
                    : `${currentBranch?.base_currency || ''} ${stats.purchaseSpend.toLocaleString()}`
                }
                loading={loading}
              />

              <StatCard
                label="Open Purchase Orders"
                value={stats.openOrders}
                loading={loading}
              />

              <StatCard
                label="Outstanding Supplier Bills"
                value={
                  loading
                    ? '—'
                    : `${currentBranch?.base_currency || ''} ${stats.outstandingBills.toLocaleString()}`
                }
                loading={loading}
              />

              <StatCard
                label="Pending Requests"
                value={stats.pendingRequests}
                loading={loading}
              />
            </div>

            {/* Operational statistics */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                label="Awaiting Receipt"
                value={stats.awaitingReceipt}
                loading={loading}
              />

              <StatCard
                label="Partially Received"
                value={stats.partialOrders}
                loading={loading}
              />

              <StatCard
                label="Unpaid Bills"
                value={stats.unpaidBills}
                loading={loading}
              />

              <StatCard
                label="Overdue Bills"
                value={stats.overdueBills}
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
                  Recent purchase requests, orders, receipts and supplier bills.
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
                  Open purchase orders
                </p>

                <p className="font-medium text-foreground">
                  {loading ? '—' : stats.openOrders}
                </p>
              </div>

              <div>
                <p className="text-[10px] text-muted-foreground">
                  Supplier balance
                </p>

                <p className="font-medium text-foreground">
                  {loading
                    ? '—'
                    : `${currentBranch?.base_currency || ''} ${stats.outstandingBills.toLocaleString()}`}
                </p>
              </div>
            </div>

            <div className="border border-border rounded-sm bg-card p-4 space-y-2">
              <h2 className="text-xs font-semibold text-foreground mb-1">
                Quick actions
              </h2>

              <Link
                href={`${basePath}/requests/new`}
                className="block rounded-sm bg-core px-3 py-2 text-center text-white hover:bg-core/90"
              >
                New purchase request
              </Link>

              <Link
                href={`${basePath}/orders/new`}
                className="block rounded-sm border border-border px-3 py-2 text-center text-muted-foreground hover:bg-muted"
              >
                New purchase order
              </Link>

              <Link
                href={`${basePath}/suppliers`}
                className="block rounded-sm border border-border px-3 py-2 text-center text-muted-foreground hover:bg-muted"
              >
                View suppliers
              </Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}