'use client'

import { useContext, useEffect, useState } from "react"
import Link from "next/link"
import PageHeader from "@/components/PageHeader"
import supabase from "@/config/supabaseClient"
import { BranchContext } from "@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext"
import { useParams } from "next/navigation"

// ----------------------------------------------------------------------
// Products Overview - identical component for every branch's route.
//
//   COMPANY-WIDE (same for every branch viewing this page):
//     - Total Products, Active Variants, Categories, Brands
//     - Activity tabs: Products created, Categories created, Brands created
//
//   BRANCH-SPECIFIC (differs per branch on purpose):
//     - Active Pricing Contexts, Aliases Set (sidebar)
//     - Activity tab: Price changes (this branch's own standard_prices)
//
// Categories and Brands moved out of "branch-specific" since both are now
// company-wide tables (Oct 2026 migrations).
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
  { key: 'products', label: 'Products' },
  { key: 'categories', label: 'Categories' },
  { key: 'brands', label: 'Brands' },
  { key: 'prices', label: 'Price changes (this branch)' },
]

export default function ProductsOverviewPage() {
  const { u, companyId, branchId } = useParams()
  const { currentBranch } = useContext(BranchContext)

  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeVariants: 0,
    categories: 0,
    brands: 0,
    aliasesSet: 0,
    activeContexts: 0,
  })

  const [activeTab, setActiveTab] = useState('products')
  const [activity, setActivity] = useState({
    products: [],
    categories: [],
    brands: [],
    prices: [],
  })

  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/products`

  useEffect(() => {
    if (!companyId || !branchId) return

    const fetchOverview = async () => {
      setLoading(true)
      try {
        const [
          { count: totalProducts },
          { count: activeVariants },
          { count: categories },
          { count: brands },
          { count: aliasesSet },
          { count: activeContexts },
        ] = await Promise.all([
          // Company-wide
          supabase
            .from('products')
            .select('id', { count: 'exact', head: true })
            .eq('company', companyId)
            .eq('status', 'active'),

          supabase
            .from('product_variants')
            .select('id, products!inner(company)', { count: 'exact', head: true })
            .eq('products.company', companyId)
            .eq('is_active', true),

          // Company-wide now (categories migrated off branch-scoping)
          supabase
            .from('categories')
            .select('id', { count: 'exact', head: true })
            .eq('company', companyId),

          // Company-wide (brands were always company-scoped)
          supabase
            .from('brands')
            .select('id', { count: 'exact', head: true })
            .eq('company', companyId)
            .eq('is_active', true),

          // Branch-specific
          supabase
            .from('product_branch_aliases')
            .select('id', { count: 'exact', head: true })
            .eq('branch', branchId),

          supabase
            .from('pricing_contexts')
            .select('id', { count: 'exact', head: true })
            .eq('branch', branchId)
            .eq('is_active', true),
        ])

        setStats({
          totalProducts: totalProducts || 0,
          activeVariants: activeVariants || 0,
          categories: categories || 0,
          brands: brands || 0,
          aliasesSet: aliasesSet || 0,
          activeContexts: activeContexts || 0,
        })

        const [
          { data: recentProducts },
          { data: recentCategories },
          { data: recentBrands },
          { data: recentPrices },
        ] = await Promise.all([
          supabase
            .from('products')
            .select('id, title, created_at, branches(name)')
            .eq('company', companyId)
            .order('created_at', { ascending: false })
            .limit(10),

          supabase
            .from('categories')
            .select('id, name, created_at, branches(name)')
            .eq('company', companyId)
            .order('created_at', { ascending: false })
            .limit(10),

          supabase
            .from('brands')
            .select('id, name, created_at')
            .eq('company', companyId)
            .order('created_at', { ascending: false })
            .limit(10),

          // Branch-specific: this branch's own price changes
          supabase
            .from('standard_prices')
            .select('id, selling_price, currency, updated_at, product_variants(sku, products(title))')
            .eq('branch', branchId)
            .order('updated_at', { ascending: false })
            .limit(10),
        ])

        setActivity({
          products: (recentProducts || []).map((p) => ({
            id: p.id,
            primary: p.title,
            secondary: `Created from ${p.branches?.name || 'a branch'}`,
            timestamp: p.created_at,
          })),
          categories: (recentCategories || []).map((c) => ({
            id: c.id,
            primary: c.name,
            secondary: `Created from ${c.branches?.name || 'a branch'}`,
            timestamp: c.created_at,
          })),
          brands: (recentBrands || []).map((b) => ({
            id: b.id,
            primary: b.name,
            secondary: '',
            timestamp: b.created_at,
          })),
          prices: (recentPrices || []).map((row) => ({
            id: row.id,
            primary: row.product_variants?.products?.title || 'A product',
            secondary: `Set to ${row.selling_price} ${row.currency}`,
            timestamp: row.updated_at,
          })),
        })
      } catch (err) {
        console.error('Error loading products overview:', err)
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
        description="Product activity and performance for this branch."
      />

      <div className="p space-y-6 text-xs">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Main column: stat cards + tabbed activity */}
          <div className="lg:col-span-3 space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Total Products (company-wide)" value={stats.totalProducts} loading={loading} />
              <StatCard label="Active Variants (company-wide)" value={stats.activeVariants} loading={loading} />
              <StatCard label="Categories (company-wide)" value={stats.categories} loading={loading} />
              <StatCard label="Brands (company-wide)" value={stats.brands} loading={loading} />
            </div>

            <div className="border border-border rounded-sm bg-card">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-xs font-semibold text-foreground">Recent Activity</h2>
                <p className="text-[10px] text-muted-foreground">
                  Products, Categories and Brands are company-wide. Price changes shown are specific to this branch.
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
                <p className="px-4 py-6 text-muted-foreground">Loading activity...</p>
              ) : currentActivity.length === 0 ? (
                <p className="px-4 py-6 text-muted-foreground">Nothing here yet.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-muted text-[10px] font-medium text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Details</th>
                      <th className="px-4 py-2 text-right">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {currentActivity.map((event) => (
                      <tr key={event.id}>
                        <td className="px-4 py-2 text-foreground font-medium">{event.primary}</td>
                        <td className="px-4 py-2 text-muted-foreground">{event.secondary}</td>
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

          {/* Sidebar: branch-specific context + quick links */}
          <div className="space-y-4">
            <div className="border border-border rounded-sm bg-card p-4 space-y-3">
              <h2 className="text-xs font-semibold text-foreground">This branch</h2>

              <div>
                <p className="text-[10px] text-muted-foreground">Currency</p>
                <p className="font-medium text-foreground">{currentBranch?.base_currency || '—'}</p>
              </div>

              <div>
                <p className="text-[10px] text-muted-foreground">Active pricing contexts</p>
                <p className="font-medium text-foreground">{loading ? '—' : stats.activeContexts}</p>
              </div>

              <div>
                <p className="text-[10px] text-muted-foreground">Aliases set by this branch</p>
                <p className="font-medium text-foreground">{loading ? '—' : stats.aliasesSet}</p>
              </div>

              <p className="text-[10px] text-muted-foreground pt-1 border-t border-border">
                Products, Categories and Brands are shared across the whole company. Pricing and
                aliases shown here are specific to this branch.
              </p>
            </div>

            <div className="border border-border rounded-sm bg-card p-4 space-y-2">
              <h2 className="text-xs font-semibold text-foreground mb-1">Quick actions</h2>
              <Link href={`${basePath}/create`} className="block rounded-sm bg-core px-3 py-2 text-center text-white hover:bg-core/90">
                Add product
              </Link>
              <Link href={`${basePath}/list`} className="block rounded-sm border border-border px-3 py-2 text-center text-muted-foreground hover:bg-muted">
                View all products
              </Link>
              <Link href={`${basePath}/brands`} className="block rounded-sm border border-border px-3 py-2 text-center text-muted-foreground hover:bg-muted">
                Manage brands
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}