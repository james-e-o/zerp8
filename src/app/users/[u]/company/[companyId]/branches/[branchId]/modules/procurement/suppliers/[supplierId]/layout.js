'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'

// Sits inside suppliers/layout.js (which already renders the "Suppliers"
// header). Adds the tabs for ONE supplier - Overview | Credits & refunds.
// The tabs hide themselves on the forms and the credit detail page, which
// have their own Back buttons and are not tabs.
export default function SupplierLayout({ children }) {
  const { u, companyId, branchId, supplierId } = useParams()
  const pathname = (usePathname() || '').replace(/\/$/, '')
  const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases/suppliers/${supplierId}`

  const tabs = [
    { label: 'Overview', href: base },
    { label: 'Credits & refunds', href: `${base}/credits` },
  ]

  const showTabs = tabs.some((tab) => tab.href === pathname)

  return (
    <div>
      {showTabs && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-full border px-3 py-1 text-xs ${
                pathname === tab.href
                  ? 'border-core bg-core text-white'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      )}
      {children}
    </div>
  )
}