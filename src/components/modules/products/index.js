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
import { useParams } from "next/navigation"





export default function Productpage() {

    const params = useParams()
    const { u, companyId,branchId } = params

  return (
    <div className="space-y-6 px-1 font-WixMade">
        <div className="flex flex-col gap-1">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div> <p className="text-xs text-gray-600">Manage and browse your product catalog</p></div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button className="text-xs h-7" variant="outline">Import</Button>
                    <Button className="text-xs h-7" variant="outline">Export</Button>
                    <Link href="create" className="bg-core text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-xs">
                      + New Product
                    </Link>
                </div>
            </div>
        </div>

        <DataTable />
    </div>
  )
}









// -------------------------------------------------------------
// 20 Dummy Inventory Items
// -------------------------------------------------------------

const inventoryData = [
  {
    id: "INV-1001",
    category: "Electronics",
    title: "Wireless Bluetooth Speaker",
    stock: 34,
    status: "In Stock",
  },
  {
    id: "INV-1002",
    category: "Furniture",
    title: "Ergonomic Office Chair",
    stock: 4,
    status: "Low Stock",
  },
  {
    id: "INV-1003",
    category: "Accessories",
    title: "32GB USB Flash Drive",
    stock: 0,
    status: "Out of Stock",
  },
  {
    id: "INV-1004",
    category: "Electronics",
    title: "Noise-Cancelling Headphones",
    stock: 18,
    status: "In Stock",
  },
  {
    id: "INV-1005",
    category: "Stationery",
    title: "A5 Hardcover Notebook",
    stock: 120,
    status: "In Stock",
  },
  {
    id: "INV-1006",
    category: "Accessories",
    title: "Laptop Sleeve 15-inch",
    stock: 9,
    status: "Low Stock",
  },
  {
    id: "INV-1007",
    category: "Electronics",
    title: "Portable Power Bank 10,000mAh",
    stock: 52,
    status: "In Stock",
  },
  {
    id: "INV-1008",
    category: "Furniture",
    title: "Standing Desk (Adjustable)",
    stock: 3,
    status: "Low Stock",
  },
  {
    id: "INV-1009",
    category: "Kitchen",
    title: "Stainless Steel Water Bottle",
    stock: 77,
    status: "In Stock",
  },
  {
    id: "INV-1010",
    category: "Electronics",
    title: "1080p Web Camera",
    stock: 0,
    status: "Out of Stock",
  },
  {
    id: "INV-1011",
    category: "Stationery",
    title: "Ballpoint Pen Set (Pack of 10)",
    stock: 210,
    status: "In Stock",
  },
  {
    id: "INV-1012",
    category: "Accessories",
    title: "Smartwatch Charging Cable",
    stock: 11,
    status: "Low Stock",
  },
  {
    id: "INV-1013",
    category: "Furniture",
    title: "Desktop Bookshelf Organizer",
    stock: 32,
    status: "In Stock",
  },
  {
    id: "INV-1014",
    category: "Electronics",
    title: "USB-C to HDMI Adapter",
    stock: 22,
    status: "In Stock",
  },
  {
    id: "INV-1015",
    category: "Kitchen",
    title: "Electric Kettle 1.5L",
    stock: 6,
    status: "Low Stock",
  },
  {
    id: "INV-1016",
    category: "Accessories",
    title: "Wireless Mouse",
    stock: 0,
    status: "Out of Stock",
  },
  {
    id: "INV-1017",
    category: "Stationery",
    title: "Sticky Notes (Yellow)",
    stock: 90,
    status: "In Stock",
  },
  {
    id: "INV-1018",
    category: "Stationery",
    title: "Desk Calendar 2025",
    stock: 14,
    status: "In Stock",
  },
  {
    id: "INV-1019",
    category: "Electronics",
    title: "LED Desk Lamp",
    stock: 2,
    status: "Low Stock",
  },
  {
    id: "INV-1020",
    category: "Kitchen",
    title: "Insulated Lunch Bag",
    stock: 47,
    status: "In Stock",
  },
]

// -------------------------------------------------------------
// Table Columns
// -------------------------------------------------------------

export const columns = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox className={'ml-5'}
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox className={'ml-5'}
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
      />
    ),
     enableHiding: false,
  },
  {
    accessorKey: "id",
    header: "Item Code",
  },
  {
    header: "Title",
    accessorKey: "title",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{row.original.category}</Badge>
        <span>{row.original.title}</span>
      </div>
    ),
  },
  {
    header: "Status",
    accessorKey: "status",
  },
  {
    header: "Stock",
    accessorKey: "stock",
  },
  {
    id: "actions",
    header: "",
    cell: () => (
      <button className="p-2 hover:bg-muted rounded-md">
        <MoreHorizontal size={18} />
      </button>
    ),
  },
]

// -------------------------------------------------------------
// Inventory Table Component
// -------------------------------------------------------------

export function DataTable() {

    const [sorting, setSorting] = useState([])
    const [columnFilters, setColumnFilters] = useState([])
    const [columnVisibility, setColumnVisibility] = useState({})
    const [rowSelection, setRowSelection] = useState({})
    const table = useReactTable({
        data:inventoryData,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        // getPaginationRowModel: getPaginationRowModel(),
        // getSortedRowModel: getSortedRowModel(),
        // getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
            pagination :{
                pageSize:200,
                pageIndex:0
            }
        },
  })

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white text-xs text-neutral-800">
        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              placeholder="Search products..."
              value={(table.getColumn("title")?.getFilterValue()) ?? ""}
              onChange={(event) =>
                table.getColumn("title")?.setFilterValue(event.target.value)
              }
              className="w-full max-w-sm px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
            />
            <div className="ml-auto flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="text-xs h-7">
                    Columns <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {table
                    .getAllColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => {
                      return (
                        <DropdownMenuCheckboxItem
                          key={column.id}
                          className="capitalize"
                          checked={column.getIsVisible()}
                          onCheckedChange={(value) =>
                            column.toggleVisibility(!!value)
                          }
                        >
                          {column.id}
                        </DropdownMenuCheckboxItem>
                      )
                    })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      <Table className={'text-xs'}>
        {/* HEADER */}
        <TableHeader >
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>

        {/* BODY */}
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center"
              >
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

