"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { Building2, ChevronRight, CircleDollarSign, Grid2X2, Settings, Truck } from "lucide-react"

const settingsSections = [
  {
    title: "Branch profile",
    description: "View and update the branch identity, location, and contact details.",
    icon: Building2,
    route: "basic-info",
  },
  {
    title: "Currency configuration",
    description: "Manage the branch base currency and exchange rates.",
    icon: CircleDollarSign,
    route: "fiscal-currency",
  },
  {
    title: "Modules",
    description: "Choose which branch-level modules are available.",
    icon: Grid2X2,
    route: "modules",
  },
  {
    title: "Shipping profiles",
    description: "Create and manage shipping options for this branch.",
    icon: Truck,
    route: "shipping-profiles",
  },
]

export default function BranchSettingsPage() {
  const { u, companyId, branchId } = useParams()
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/settings`

  return (
    <div className="space-y-6 p-2">
      <header className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-core_light text-core">
          <Settings className="size-5" />
        </div>
        <div >
          <h1 className="text-base text-core tracking-tight font-semibold">Branch settings</h1>
          <p className=" text-xs text-muted-foreground">
            Manage the details and options for this branch.
          </p>
        </div>
      </header>

      <section
        aria-label="Branch settings sections"
        className="grid gap-3 sm:grid-cols-2"
      >
        {settingsSections.map((section) => (
          <Link
            key={section.route}
            href={`${basePath}/${section.route}`}
            className="group flex min-h-28 items-start gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-core/40 hover:bg-core_light/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-card group-hover:text-core">
              <section.icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xs font-semibold text-foreground">{section.title}</h2>
              <p className="mt-1 text-xs leading-4 text-muted-foreground">
                {section.description}
              </p>
            </div>
            <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-core" />
          </Link>
        ))}
      </section>
    </div>
  )
}
