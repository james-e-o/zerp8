'use client'

import { useContext, useEffect, useState } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import supabase from '@/config/supabaseClient'
import { BranchContext } from '@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext'
import { useParams } from 'next/navigation'

// ----------------------------------------------------------------------
// Inventory Overview
//
// BRANCH-SPECIFIC:
//   - Stock currently available to the branch
//   - Stock value
//   - Low / out-of-stock products
//   - Reserved stock
//   - Movements
//   - Transfers
//   - Counts
//   - Adjustments
//
// Warehouses are company-level entities.
// This page only operates on warehouses assigned to this branch.
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
  { key: 'movements', label: 'Movements' },
  { key: 'adjustments', label: 'Adjustments' },
  { key: 'transfers', label: 'Transfers' },
  { key: 'counts', label: 'Counts' },
]

export default function InventoryOverviewPage() {
  const { u, companyId, branchId } = useParams()
  const { currentBranch } = useContext(BranchContext)

  const [loading, setLoading] = useState(true)

  const [stats, setStats] = useState({
    stockValue: 0,
    productsInStock: 0,
    lowStock: 0,
    outOfStock: 0,
    unitsOnHand: 0,
    reservedUnits: 0,
    pendingTransfers: 0,
    pendingCounts: 0,
  })

  const [activeTab, setActiveTab] = useState('movements')

  const [activity, setActivity] = useState({
    movements: [],
    adjustments: [],
    transfers: [],
    counts: [],
  })

  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory`

  useEffect(() => {
    if (!companyId || !branchId) return

    const fetchOverview = async () => {
      setLoading(true)

      try {
        /*
         * Conceptual inventory tables:
         *
         * inventory_stock
         * inventory_movements
         * inventory_adjustments
         * inventory_transfers
         * inventory_counts
         *
         * Adjust names to your final schema.
         */

        const [
          { data: stock },
          { data: movements },
          { data: adjustments },
          { data: transfers },
          { data: counts },
        ] = await Promise.all([
          supabase
            .from('inventory_stock')
            .select('id, product, warehouse, quantity, reserved_quantity, available_quantity, stock_value, reorder_level')
            .eq('branch', branchId)
            .limit(1000),

          supabase
            .from('inventory_movements')
            .select('id, product, movement_type, source, quantity, created_at')
            .eq('branch', branchId)
            .order('created_at', { ascending: false })
            .limit(100),

          supabase
            .from('inventory_adjustments')
            .select('id, reason, status, quantity, created_at')
            .eq('branch', branchId)
            .order('created_at', { ascending: false })
            .limit(100),

          supabase
            .from('inventory_transfers')
            .select('id, status, created_at')
            .eq('branch', branchId)
            .order('created_at', { ascending: false })
            .limit(100),

          supabase
            .from('inventory_counts')
            .select('id, status, created_at')
            .eq('branch', branchId)
            .order('created_at', { ascending: false })
            .limit(100),
        ])

        const stockRows = stock || []
        const movementRows = movements || []
        const adjustmentRows = adjustments || []
        const transferRows = transfers || []
        const countRows = counts || []

        const stockValue = stockRows.reduce(
          (sum, row) => sum + Number(row.stock_value || 0),
          0
        )

        const unitsOnHand = stockRows.reduce(
          (sum, row) => sum + Number(row.quantity || 0),
          0
        )

        const reservedUnits = stockRows.reduce(
          (sum, row) => sum + Number(row.reserved_quantity || 0),
          0
        )

        const productsInStock = stockRows.filter(
          (row) => Number(row.quantity || 0) > 0
        ).length

        const lowStock = stockRows.filter((row) => {
          const quantity = Number(row.quantity || 0)
          const reorderLevel = Number(row.reorder_level || 0)

          return quantity > 0 && quantity <= reorderLevel
        }).length

        const outOfStock = stockRows.filter(
          (row) => Number(row.quantity || 0) <= 0
        ).length

        const pendingTransfers = transferRows.filter((row) =>
          ['pending', 'in_transit'].includes(row.status)
        ).length

        const pendingCounts = countRows.filter((row) =>
          ['scheduled', 'in_progress'].includes(row.status)
        ).length

        setStats({
          stockValue,
          productsInStock,
          lowStock,
          outOfStock,
          unitsOnHand,
          reservedUnits,
          pendingTransfers,
          pendingCounts,
        })

        setActivity({
          movements: movementRows.slice(0, 10).map((row) => ({
            id: row.id,
            primary: `Movement ${row.id}`,
            secondary: `${row.movement_type || 'Movement'} · ${row.source || '—'} · ${Number(row.quantity || 0)}`,
            timestamp: row.created_at,
          })),

          adjustments: adjustmentRows.slice(0, 10).map((row) => ({
            id: row.id,
            primary: `Adjustment ${row.id}`,
            secondary: `${row.reason || 'Adjustment'} · ${row.status || 'Unknown'} · ${Number(row.quantity || 0)}`,
            timestamp: row.created_at,
          })),

          transfers: transferRows.slice(0, 10).map((row) => ({
            id: row.id,
            primary: `Transfer ${row.id}`,
            secondary: row.status || 'Unknown',
            timestamp: row.created_at,
          })),

          counts: countRows.slice(0, 10).map((row) => ({
            id: row.id,
            primary: `Count ${row.id}`,
            secondary: row.status || 'Unknown',
            timestamp: row.created_at,
          })),
        })
      } catch (err) {
        console.error('Error loading inventory overview:', err)
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
        description="Inventory position and stock activity for this branch."
      />

      <div className="p space-y-6 text-xs">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">

          <div className="lg:col-span-3 space-y-6">

            {/* Primary stock statistics */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                label="Total Stock Value"
                value={
                  loading
                    ? '—'
                    : `${currentBranch?.base_currency || ''} ${stats.stockValue.toLocaleString()}`
                }
                loading={loading}
              />

              <StatCard
                label="Products In Stock"
                value={stats.productsInStock}
                loading={loading}
              />

              <StatCard
                label="Low Stock"
                value={stats.lowStock}
                loading={loading}
              />

              <StatCard
                label="Out of Stock"
                value={stats.outOfStock}
                loading={loading}
              />
            </div>

            {/* Operational stock statistics */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                label="Units On Hand"
                value={stats.unitsOnHand.toLocaleString()}
                loading={loading}
              />

              <StatCard
                label="Reserved Units"
                value={stats.reservedUnits.toLocaleString()}
                loading={loading}
              />

              <StatCard
                label="Pending Transfers"
                value={stats.pendingTransfers}
                loading={loading}
              />

              <StatCard
                label="Pending Counts"
                value={stats.pendingCounts}
                loading={loading}
              />
            </div>

            {/* Recent inventory activity */}
            <div className="border border-border rounded-sm bg-card">

              <div className="border-b border-border px-4 py-3">
                <h2 className="text-xs font-semibold text-foreground">
                  Recent Activity
                </h2>

                <p className="text-[10px] text-muted-foreground">
                  Recent stock movements, adjustments, transfers and stock counts.
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
                  Units on hand
                </p>

                <p className="font-medium text-foreground">
                  {loading ? '—' : stats.unitsOnHand.toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-[10px] text-muted-foreground">
                  Stock value
                </p>

                <p className="font-medium text-foreground">
                  {loading
                    ? '—'
                    : `${currentBranch?.base_currency || ''} ${stats.stockValue.toLocaleString()}`}
                </p>
              </div>

              <div>
                <p className="text-[10px] text-muted-foreground">
                  Reserved units
                </p>

                <p className="font-medium text-foreground">
                  {loading ? '—' : stats.reservedUnits.toLocaleString()}
                </p>
              </div>

              <p className="text-[10px] text-muted-foreground pt-1 border-t border-border">
                Warehouses are managed at company level. This branch operates
                against warehouses assigned to it.
              </p>
            </div>

            <div className="border border-border rounded-sm bg-card p-4 space-y-2">

              <h2 className="text-xs font-semibold text-foreground mb-1">
                Quick actions
              </h2>

              <Link
                href={`${basePath}/transfers/new`}
                className="block rounded-sm bg-core px-3 py-2 text-center text-white hover:bg-core/90"
              >
                New transfer
              </Link>

              <Link
                href={`${basePath}/counts/new`}
                className="block rounded-sm border border-border px-3 py-2 text-center text-muted-foreground hover:bg-muted"
              >
                Start stock count
              </Link>

              <Link
                href={`${basePath}/adjustments/new`}
                className="block rounded-sm border border-border px-3 py-2 text-center text-muted-foreground hover:bg-muted"
              >
                New adjustment
              </Link>

              <Link
                href={`${basePath}/stock`}
                className="block rounded-sm border border-border px-3 py-2 text-center text-muted-foreground hover:bg-muted"
              >
                View stock
              </Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}