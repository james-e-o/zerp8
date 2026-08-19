"use client"

import { useContext } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { BranchContext } from "./branchContext"
import { CompanyInfoContext } from "../../companyInfoProvider"
import {
  MapPin,
  Phone,
  Mail,
  ArrowRight,
  Package,
  Receipt,
  Users2,
  CircleDot,
  Boxes,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────
// Record header — matches the company dashboard's receipt-tape style.
// ─────────────────────────────────────────────────────────────
function BranchRecordHeader({ branch }) {
  const initials = (branch?.name || "?").slice(0, 2).toUpperCase()
  return (
    <div className="bg-card border border-border rounded-xl px-6 py-5 mb-6">
      <div className="flex items-center gap-4">
        <div className="size-11 rounded-lg bg-core_light flex items-center justify-center shrink-0">
          <span className="text-core font-semibold text-sm">{initials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-foreground truncate">
            {branch?.name || "Branch"}
          </h1>
          <p className="text-xs font-mono text-muted-foreground tracking-wide mt-1">
            {(branch?.status || "ACTIVE").toUpperCase()}
            <span className="mx-2 text-muted-foreground/40">·</span>
            {branch?.isheadoffice ? "HEAD OFFICE" : "BRANCH"}
            <span className="mx-2 text-muted-foreground/40">·</span>
            {branch?.base_currency || "—"}
          </p>
        </div>
      </div>

      {(branch?.address || branch?.phone || branch?.email) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 mt-4 pt-4 border-t border-border">
          {branch?.address && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5" />
              {branch.address}
              {branch.city ? `, ${branch.city}` : ""}
            </span>
          )}
          {branch?.phone && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="size-3.5" />
              {branch.phone}
            </span>
          )}
          {branch?.email && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="size-3.5" />
              {branch.email}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// KPI strip — same hairline pattern used across the app.
// ─────────────────────────────────────────────────────────────
function KpiStrip({ items }) {
  return (
    <div className="bg-card border border-border rounded-xl mb-6 grid grid-cols-2 sm:grid-cols-3 divide-x divide-y sm:divide-y-0 divide-border">
      {items.map((item, i) => (
        <div key={i} className="px-6 py-5">
          <div className="flex items-center gap-2 mb-1.5">
            <item.icon className="size-3.5 text-core" />
            <p className="text-xs text-muted-foreground font-medium">{item.label}</p>
          </div>
          <span className="text-2xl font-mono font-semibold text-foreground">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Modules grid — Shopify-app-tile style quick access to what's
// enabled for this branch, instead of a generic "quick actions" row.
// ─────────────────────────────────────────────────────────────
function ModulesGrid({ modules, basePath }) {
  const branchModules = (modules || []).filter((m) => m.branchlevel)

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Modules</h3>
      </div>
      {branchModules.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
          {branchModules.map((m) => (
            <Link
              key={m.key}
              href={`${basePath}/modules/${m.key}`}
              className="border border-border rounded-lg p-4 hover:border-core/40 hover:bg-core_light/20 transition-colors group"
            >
              <div className="size-9 rounded-lg bg-muted group-hover:bg-card flex items-center justify-center mb-3">
                <Boxes className="size-4 text-muted-foreground group-hover:text-core transition-colors" />
              </div>
              <p className="text-sm font-medium text-foreground">{m.name}</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No modules enabled for this branch yet.
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Activity ledger — same monospace-timestamp pattern as company dashboard.
// ─────────────────────────────────────────────────────────────
function ActivityLedger({ entries }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Recent activity</h3>
      </div>
      <div className="divide-y divide-border">
        {entries.map((e, i) => (
          <div key={i} className="px-6 py-3.5 flex items-start gap-3">
            <span className="mt-0.5 shrink-0">{e.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">{e.text}</p>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">{e.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function BranchPage() {
  const { currentBranch, modules } = useContext(BranchContext)
  const { info } = useContext(CompanyInfoContext)
  const { u, companyId, branchId } = useParams()

  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}`

  return (
    <div className="p-4 space-y-6">
      <BranchRecordHeader branch={currentBranch} />

      <KpiStrip
        items={[
          { icon: Receipt, label: "Orders (30d)", value: "312" },
          { icon: Package, label: "Items in stock", value: "1,204" },
          { icon: Users2, label: "Staff assigned", value: "6" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ModulesGrid modules={modules} basePath={basePath} />
        </div>
        <ActivityLedger
          entries={[
            { icon: <Receipt className="size-4 text-muted-foreground" />, text: "New sale recorded", time: "2026-08-08 15:12" },
            { icon: <Package className="size-4 text-muted-foreground" />, text: "Stock adjusted — 12 units", time: "2026-08-08 11:03" },
            { icon: <CircleDot className="size-4 text-muted-foreground" />, text: "Branch marked active", time: "2026-08-07 09:00" },
          ]}
        />
      </div>
    </div>
  )
}