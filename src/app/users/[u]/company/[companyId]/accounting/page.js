"use client"

import { useState } from "react"
import {ColumnDef,flexRender,getCoreRowModel,useReactTable,} from "@tanstack/react-table"
import { ChevronDown,MoreHorizontal } from "lucide-react"
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow,} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {DropdownMenu,DropdownMenuCheckboxItem,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator,DropdownMenuTrigger,} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { useParams,usePathname } from "next/navigation"





export default function AccountingDashboard() {
    const pathname = usePathname();
    const linkBase = "text-sm font-medium text-neutral-700 hover:text-black pb-2";
    const activeStyle = "border-b-[3px] border-army text-black";
  return (
    <div className="w-full">

      {/* TOP NAVIGATION */}
       <div className="flex items-center gap-6 border-b bg-white px-6 pt-3">

        <Link
          href="/accounting"
          className={`${linkBase} ${
            pathname === "/accounting" ? activeStyle : ""
          }`}
        >
          Dashboard
        </Link>

        <Link
          href="/accounting/taxes"
          className={`${linkBase} ${
            pathname.startsWith("/accounting/taxes") ? activeStyle : ""
          }`}
        >
          Taxes
        </Link>

        <Link
          href="/accounting/income-expenses"
          className={`${linkBase} ${
            pathname.startsWith("/accounting/income-expenses") ? activeStyle : ""
          }`}
        >
          Income & Expenses
        </Link>

        <Link
          href="/accounting/banking"
          className={`${linkBase} ${
            pathname.startsWith("/accounting/banking") ? activeStyle : ""
          }`}
        >
          Banking
        </Link>

        <Link
          href="/accounting/reports"
          className={`${linkBase} ${
            pathname.startsWith("/accounting/reports") ? activeStyle : ""
          }`}
        >
          Reports
        </Link>

        <Link
          href="/accounting/chart-of-accounts"
          className={`${linkBase} ${
            pathname.startsWith("/accounting/chart-of-accounts") ? activeStyle : ""
          }`}
        >
          Chart of Accounts
        </Link>

      </div>

      {/* MAIN CONTENT */}
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-2">Accounting Overview</h1>
        <p className="text-sm text-neutral-600">
          Quick shortcuts and insights for your accounting module.
        </p>
      </div>

    </div>
  );
}
