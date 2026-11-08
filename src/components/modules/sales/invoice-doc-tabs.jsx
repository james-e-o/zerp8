'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// The document-type tabs of Invoices (Sales invoices | Proforma | Credit notes). A tab stays lit on
// every page beneath it (lists, detail, new, edit), which a plain exact-match tab bar would not do.
export default function InvoiceDocTabs({ basePath, tabs }) {
  const pathname = usePathname() || ''
  return (
    <div className="flex gap-1 border-b border-border px-1">
      {tabs.map((tab) => {
        const href = `${basePath}/${tab.value}`
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={tab.value}
            href={href}
            className={`-mb-px border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
              active ? 'border-core text-core' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
