"use client"

import { useState } from "react"
import {ColumnDef,flexRender,getCoreRowModel,useReactTable,} from "@tanstack/react-table"
import { ChevronDown } from "lucide-react"
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow,} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {DropdownMenu,DropdownMenuCheckboxItem,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator,DropdownMenuTrigger,} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { MoreHorizontal } from "lucide-react"

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
    <div className="overflow-hidden rounded-md border bg-card">
        <div className="flex items-center p-7">
        <Input
          placeholder="Filter titles..."
          value={(table.getColumn("title")?.getFilterValue()) ?? ""}
          onChange={(event) =>
            table.getColumn("title")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
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
      <Table >
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

