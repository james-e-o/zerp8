"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

// Renders the horizontal status/sub-view tabs inside a route's layout.js.
// Lives in the layout (not the page) because it wraps every filtered view
// of the same document list. Filter state travels via ?status= so the
// page.js underneath can read it with useSearchParams and refine the query
// without needing a real sub-route per status.
// tabs: [{ label: "All", value: "all" }, { label: "Unpaid", value: "unpaid" }]
export default function TabNav({ tabs, basePath }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("status") || "all";

  return (
    <nav className="flex items-center gap-1 border-b border-line -mt-2 mb-6 overflow-x-auto">
      {tabs.map((tab) => {
        const active = current === tab.value;
        const href = tab.value === "all" ? basePath : `${basePath}?status=${tab.value}`;
        return (
          <Link
            key={tab.value}
            href={href}
            className={`relative px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${
              active ? "text-ink font-medium" : "text-inkmute hover:text-ink"
            }`}
          >
            {tab.label}
            {active && (
              <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-brand rounded-full" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
