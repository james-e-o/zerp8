"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// tabs: [{ label: "All", value: "all" }, { label: "Unpaid", value: "unpaid" }]
export default function TabNav({ tabs, basePath }) {
  const pathname = usePathname();
  const current = pathname === basePath ? "all" : pathname.slice(basePath.length + 1).split("/")[0];

  return (
    <nav className="flex h-11 shrink-0 items-center gap-1.5 overflow-x-auto overflow-y-hidden border-line pt-1 pb-3.5">
      {tabs.map((tab) => {
        const value = tab.path || tab.value || "all";
        const active = current === value;
        const href = value === "all" ? basePath : `${basePath}/${value}`;
        return (
          <Link
            key={tab.value}
            href={href}
            className={`relative flex min-w-max cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
              active
                ? "bg-core text-white border-core/20"
                : "text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
