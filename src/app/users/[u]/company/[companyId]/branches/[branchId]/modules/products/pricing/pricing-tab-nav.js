"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const TABS = [
  { label: "Pricing Contexts", path: "/contexts" },
  { label: "Promotions", path: "/promotions" },
  { label: "Settings", path: "/settings" },
]

export default function PricingTabNav({ basePath }) {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-2 overflow-x-auto" aria-label="Pricing navigation">
      {TABS.map((tab) => {
        const href = `${basePath}${tab.path}`
        const active = pathname === href || pathname.startsWith(`${href}/`)

        return (
          <Link
            key={tab.path}
            href={href}
            className={`flex min-w-max cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
              active
                ? "bg-core_light text-core border-core/20"
                : "text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}