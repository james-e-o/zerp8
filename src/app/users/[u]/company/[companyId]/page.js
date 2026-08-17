"use client"

import { useContext, useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { CompanyInfoContext } from "./companyInfoProvider"
import { RefreshContext } from "@/app/users/[u]/pageLayoutProvider"
import { ReusableCompanySidebar } from "./companyLayoutClient"
import { AccessGate } from "@/components/access-gate"
import supabase from "@/config/supabaseClient"
import useAccess from "@/hooks/use-access"
import {
  Plus,
  UserPlus,
  FileBarChart2,
  Wallet,
  ArrowUpRight,
  ArrowRight,
  Building2,
  Receipt,
  CircleDot,
  X,
} from "lucide-react"
import Link from "next/link"

// ─────────────────────────────────────────────────────────────
// Record header — the one signature element. Reads like a POS
// ticket: company name, then a single monospace meta line.
// ─────────────────────────────────────────────────────────────
function RecordHeader({ info, branchCount, staffCount, planLabel }) {
  const initials = (info?.name || "?").slice(0, 2).toUpperCase()
  return (
    <div className="bg-card border border-border rounded-xl px-6 py-5 mb-6">
      <div className="flex items-center gap-4">
        <div className="size-11 rounded-lg bg-core_light flex items-center justify-center shrink-0">
          <span className="text-core font-semibold text-sm">{initials}</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground truncate">
            {info?.name || "Company"}
          </h1>
          <p className="text-xs font-mono text-muted-foreground tracking-wide mt-1">
            {planLabel?.toUpperCase() || "NO PLAN"}
            <span className="mx-2 text-muted-foreground">·</span>
            {branchCount} {branchCount === 1 ? "BRANCH" : "BRANCHES"}
            <span className="mx-2 text-muted-foreground">·</span>
            {staffCount} STAFF
          </p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// KPI strip — hairline-divided, not separate shadow cards.
// ─────────────────────────────────────────────────────────────
function KpiStrip({ items }) {
  return (
    <div className="bg-card border border-border rounded-xl mb-6 grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border">
      {items.map((item, i) => (
        <div key={i} className="px-6 py-5">
          <p className="text-xs text-muted-foreground font-medium">{item.label}</p>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-mono font-semibold text-foreground">
              {item.value}
            </span>
            {item.delta && (
              <span
                className={`text-xs font-medium flex items-center gap-0.5 ${
                  item.deltaPositive ? "text-emerald-600" : "text-muted-foreground"
                }`}
              >
                {item.deltaPositive && <ArrowUpRight className="size-3" />}
                {item.delta}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Branch performance — dense table, not chart widgets.
// ─────────────────────────────────────────────────────────────
function BranchTable({ branches }) {
  const rows = branches?.length
    ? branches
    : [{ id: "placeholder", name: "No branches yet", isheadoffice: false }]

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Branches</h3>
        <Link
          href="#"
          className="text-xs text-core font-medium flex items-center gap-1 hover:underline"
        >
          View all <ArrowRight className="size-3" />
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground border-b border-border">
            <th className="px-6 py-2.5 font-medium">Name</th>
            <th className="px-6 py-2.5 font-medium">Role</th>
            <th className="px-6 py-2.5 font-medium text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((b) => (
            <tr key={b.id} className="hover:bg-muted/60">
              <td className="px-6 py-3 font-medium text-foreground">{b.name}</td>
              <td className="px-6 py-3 text-muted-foreground">
                {b.isheadoffice ? "Head office" : "Branch"}
              </td>
              <td className="px-6 py-3 text-right">
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <CircleDot className="size-2.5 fill-emerald-500 text-emerald-500" />
                  Active
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Activity ledger — monospace timestamps, right rail.
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

// ─────────────────────────────────────────────────────────────
// Task ledger — for branch-level staff, in place of activity feed.
// ─────────────────────────────────────────────────────────────
function TaskLedger({ tasks }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Your tasks</h3>
      </div>
      <div className="divide-y divide-border">
        {tasks.map((t, i) => (
          <div key={i} className="px-6 py-3.5 flex items-center gap-3">
            <div className={`size-2 rounded-full shrink-0 ${t.dotColor}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground font-medium">{t.title}</p>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">{t.due}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Quick actions — flat icon tiles, not gradient buttons.
// ─────────────────────────────────────────────────────────────
function QuickActions({ actions }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {actions.map((a, i) => (
        <Link
          key={i}
          href={a.href}
          className="bg-card border border-border rounded-xl p-4 hover:border-core/40 hover:bg-core_light/20 transition-colors group"
        >
          <div className="size-9 rounded-lg bg-muted group-hover:bg-card flex items-center justify-center mb-3">
            <a.icon className="size-4 text-muted-foreground group-hover:text-core transition-colors" />
          </div>
          <p className="text-sm font-medium text-foreground">{a.label}</p>
        </Link>
      ))}
    </div>
  )
}

export default function CompanyPage() {
  const { info, setInfo, branches } = useContext(CompanyInfoContext)
  const access = useAccess()
  const params = useParams()
  const searchParams = useSearchParams()
  const { u, companyId } = params
  const { refreshKey, setRefreshKey } = useContext(RefreshContext)
  const [showWelcome, setShowWelcome] = useState(false)

  useEffect(() => {
    setRefreshKey((prev) => prev + 1)
  }, [u, companyId, setRefreshKey])

  useEffect(() => {
    const newlyInvited = searchParams.get("newly_invited_staff")
    if (newlyInvited === "true") {
      setShowWelcome(true)
      const timer = setTimeout(() => setShowWelcome(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [searchParams])

  useEffect(() => {
    async function fetchCompanyData() {
      try {
        if (!access.isCompanyLevel && !access.isOwner) return
        if (!info?.id) return

        const { data: fullCompanyData, error } = await supabase
          .from("companies")
          .select("*")
          .eq("id", info.id)
          .maybeSingle()

        if (error) {
          console.error("Error fetching company data:", error)
          return
        }

        if (fullCompanyData) {
          setInfo((prev) => ({
            ...prev,
            ...fullCompanyData,
            accessLevel: prev.accessLevel,
            accessLevelScope: prev.accessLevelScope,
            branchId: prev.branchId,
            suspended: prev.suspended,
          }))
        }
      } catch (error) {
        console.error("Error in fetchCompanyData:", error)
      }
    }

    fetchCompanyData()
  }, [info?.id, access.isCompanyLevel, access.isOwner, setInfo])

  const assignedBranch =
    branches?.[0]?.name ?? (info?.branchId ? `Branch #${info.branchId}` : "Unassigned")
  const branchCount = branches?.length ?? 0

  return (
    <ReusableCompanySidebar>
      <div className="p-6 h-full flex flex-col overflow-y-auto bg-background">
        {showWelcome && (
          <div className="mb-6 bg-card border border-core/20 rounded-xl px-5 py-3.5 flex items-center justify-between">
            <p className="text-sm text-foreground">
              You've been added to <span className="font-semibold">{info?.name}</span> — welcome aboard.
            </p>
            <button
              onClick={() => setShowWelcome(false)}
              className="text-muted-foreground hover:text-foreground shrink-0 ml-4"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        <RecordHeader
          info={info}
          branchCount={branchCount}
          staffCount={48}
          planLabel={access.isOwner ? "trial" : undefined}
        />

        {/* ==================== OWNER VIEW ==================== */}
        {access.isOwner && (
          <div className="space-y-6">
            <KpiStrip
              items={[
                { label: "Revenue (30d)", value: "$124,500", delta: "+12%", deltaPositive: true },
                { label: "Orders (30d)", value: "1,248", delta: "+4%", deltaPositive: true },
                { label: "Active staff", value: "48" },
                { label: "Branches", value: String(branchCount) },
              ]}
            />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <BranchTable branches={branches} />
              </div>
              <ActivityLedger
                entries={[
                  { icon: <Receipt className="size-4 text-muted-foreground" />, text: "New invoice created", time: "2026-08-08 14:02" },
                  { icon: <UserPlus className="size-4 text-muted-foreground" />, text: "Staff member added", time: "2026-08-08 09:41" },
                  { icon: <Building2 className="size-4 text-muted-foreground" />, text: "System settings updated", time: "2026-08-07 18:15" },
                ]}
              />
            </div>
            <QuickActions
              actions={[
                { icon: Plus, label: "Add branch", href: `/users/${u}/company/${companyId}/branches/new` },
                { icon: UserPlus, label: "Invite staff", href: `/users/${u}/company/${companyId}/staff/new` },
                { icon: FileBarChart2, label: "View reports", href: `/users/${u}/company/${companyId}/reports` },
                { icon: Wallet, label: "Billing", href: `/users/${u}/company/${companyId}/subscriptions` },
              ]}
            />
          </div>
        )}

        {/* ==================== COMPANY-LEVEL VIEW ==================== */}
        {!access.isOwner && access.isCompanyLevel && (
          <div className="space-y-6">
            <KpiStrip
              items={[
                { label: "Your access", value: access.accessLevel || "—" },
                { label: "Staff members", value: "48" },
                { label: "Active branches", value: String(branchCount) },
                { label: "Modules enabled", value: "8" },
              ]}
            />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <BranchTable branches={branches} />
              </div>
              <AccessGate permission="can_view_reports">
                <ActivityLedger
                  entries={[
                    { icon: <Receipt className="size-4 text-muted-foreground" />, text: "New invoice created", time: "2026-08-08 14:02" },
                    { icon: <UserPlus className="size-4 text-muted-foreground" />, text: "Staff member added", time: "2026-08-08 09:41" },
                    { icon: <Building2 className="size-4 text-muted-foreground" />, text: "System settings updated", time: "2026-08-07 18:15" },
                  ]}
                />
              </AccessGate>
            </div>
          </div>
        )}

        {/* ==================== BRANCH-LEVEL VIEW ==================== */}
        {!access.isOwner && access.isBranchLevel && (
          <div className="space-y-6">
            <KpiStrip
              items={[
                { label: "Your access", value: access.accessLevel || "—" },
                { label: "Assigned branch", value: assignedBranch },
              ]}
            />
            <TaskLedger
              tasks={[
                { title: "Complete inventory check", due: "Due 2026-08-11", dotColor: "bg-amber-500" },
                { title: "Review daily sales report", due: "Due today", dotColor: "bg-blue-500" },
                { title: "Team briefing", due: "Tomorrow · 10:00", dotColor: "bg-emerald-500" },
              ]}
            />
          </div>
        )}
      </div>
    </ReusableCompanySidebar>
  )
}