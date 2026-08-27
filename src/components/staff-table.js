
'use client'

import React, { useMemo, useState } from 'react'
import { useReactTable, getCoreRowModel, flexRender, getSortedRowModel, getFilteredRowModel } from '@tanstack/react-table'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Search, ChevronUp, ChevronDown } from 'lucide-react'

export function StaffTable({ staffList = [], userId, companyId }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    branch: 'all',
    status: 'all',
    accessLevel: 'all',
    role: 'all',
  })
  const [sorting, setSorting] = useState([])
  const [columnVisibility, setColumnVisibility] = useState({
    name: true,
    email: true,
    phone: true,
    branch: true,
    role: true,
    access_level: true,
    status: true,
    date_hired: true,
  })

  // Color mappings for badges
  const statusColors = {
    active: 'bg-green-500/10 text-green-700 border-green-500/20',
    pending: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
    suspended: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
    terminated: 'bg-gray-500/10 text-gray-700 border-gray-500/20',
  }

  const roleColors = {
    admin: 'bg-core/10 text-core border-core/20',
    manager: 'bg-army/10 text-army border-army/20',
    staff: 'bg-gray/10 text-gray border-gray/20',
    viewer: 'bg-gray-400/10 text-gray-700 border-gray-400/20',
  }

  const accessLevelColors = {
    owner: 'bg-core/10 text-core border-core/20',
    manager: 'bg-army/10 text-army border-army/20',
    staff: 'bg-gray/10 text-gray border-gray/20',
    viewer: 'bg-gray-400/10 text-gray-700 border-gray-400/20',
  }

  // Column definitions
  const columns = [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <button
          onClick={() => column.toggleSorting()}
          className="flex items-center gap-1 text-gray-700 font-semibold hover:text-army transition-colors"
        >
          Staff Name
          {column.getIsSorted() === 'asc' && <ChevronUp className="size-3" />}
          {column.getIsSorted() === 'desc' && <ChevronDown className="size-3" />}
        </button>
      ),
      cell: ({ row }) => (
        <div className="font-medium text-gray-900">
          {row.original.name || 'N/A'}
        </div>
      ),
    },
    {
      accessorKey: 'email',
      header: ({ column }) => (
        <button
          onClick={() => column.toggleSorting()}
          className="flex items-center gap-1 text-gray-700 font-semibold hover:text-army transition-colors"
        >
          Email
          {column.getIsSorted() === 'asc' && <ChevronUp className="size-3" />}
          {column.getIsSorted() === 'desc' && <ChevronDown className="size-3" />}
        </button>
      ),
      cell: ({ row }) => (
        <div className="text-gray-600 text-sm">{row.original.email || 'N/A'}</div>
      ),
    },
    {
      accessorKey: 'phone',
      header: () => <div className="text-gray-700 font-semibold">Phone</div>,
      cell: ({ row }) => (
        <div className="text-gray-600 text-sm">{row.original.phone || 'N/A'}</div>
      ),
    },
    {
      accessorKey: 'branch',
      header: () => <div className="text-gray-700 font-semibold">Branch</div>,
      cell: ({ row }) => (
        <div className="text-gray-600 text-sm capitalize">
          {row.original.branch || 'N/A'}
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: () => <div className="text-gray-700 font-semibold">Role</div>,
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={roleColors[row.original.role?.toLowerCase()] || roleColors.staff}
        >
          {row.original.role || 'N/A'}
        </Badge>
      ),
    },
    {
      accessorKey: 'access_level',
      header: () => <div className="text-gray-700 font-semibold">Access Level</div>,
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={accessLevelColors[row.original.access_level?.toLowerCase()] || accessLevelColors.staff}
        >
          {row.original.access_level || 'N/A'}
        </Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: () => <div className="text-gray-700 font-semibold">Status</div>,
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={statusColors[row.original.status?.toLowerCase()] || statusColors.active}
        >
          {row.original.status || 'Active'}
        </Badge>
      ),
    },
    {
      accessorKey: 'date_hired',
      header: ({ column }) => (
        <button
          onClick={() => column.toggleSorting()}
          className="flex items-center gap-1 text-gray-700 font-semibold hover:text-army transition-colors"
        >
          Date Hired
          {column.getIsSorted() === 'asc' && <ChevronUp className="size-3" />}
          {column.getIsSorted() === 'desc' && <ChevronDown className="size-3" />}
        </button>
      ),
      cell: ({ row }) => (
        <div className="text-gray-600 text-sm">
          {row.original.date_hired
            ? new Date(row.original.date_hired).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
            : 'N/A'}
        </div>
      ),
    },
  ]

  // Filter function
  const globalFilterFn = (row, columnId, value) => {
    const searchableData = [
      row.original.name || '',
      row.original.email || '',
      row.original.phone || '',
    ].join(' ').toLowerCase()

    return searchableData.includes(value.toLowerCase())
  }

  // Filtered and sorted data
  const filteredData = useMemo(() => {
    let data = staffList

    // Apply text search
    if (searchTerm) {
      data = data.filter((staff) => {
        const searchLower = searchTerm.toLowerCase()
        return (
          (staff.name && staff.name.toLowerCase().includes(searchLower)) ||
          (staff.email && staff.email.toLowerCase().includes(searchLower)) ||
          (staff.phone && staff.phone.toLowerCase().includes(searchLower))
        )
      })
    }

    // Apply filters
    if (filters.branch !== 'all') {
      data = data.filter((staff) => staff.branch?.toLowerCase() === filters.branch.toLowerCase())
    }
    if (filters.status !== 'all') {
      data = data.filter((staff) => (staff.status || 'active').toLowerCase() === filters.status.toLowerCase())
    }
    if (filters.accessLevel !== 'all') {
      data = data.filter(
        (staff) => (staff.access_level || 'staff').toLowerCase() === filters.accessLevel.toLowerCase()
      )
    }
    if (filters.role !== 'all') {
      data = data.filter((staff) => staff.role?.toLowerCase() === filters.role.toLowerCase())
    }

    return data
  }, [staffList, searchTerm, filters])

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  // Extract unique filter options
  const branches = useMemo(
    () => [...new Set(staffList.map((s) => s.branch).filter(Boolean))],
    [staffList]
  )
  const statuses = useMemo(
    () => [...new Set(staffList.map((s) => s.status || 'Active').filter(Boolean))],
    [staffList]
  )
  const accessLevels = useMemo(
    () => [...new Set(staffList.map((s) => s.access_level || 'Staff').filter(Boolean))],
    [staffList]
  )
  const roles = useMemo(() => [...new Set(staffList.map((s) => s.role).filter(Boolean))], [staffList])

  return (
    <div className="space-y-6">
      {/* Search Box */}
      <div className="relative">
        <Search className="absolute left-3 top-3 size-4 text-gray-400" />
        <Input
          placeholder="Search by name, email, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 border-gray-200"
        />
      </div>

      {/* Filters and Column Visibility */}
      <div className="flex items-center justify-between gap-4">
        {/* Filters aligned to the left */}
        <div className="flex items-center gap-3">
          {/* Branch Filter */}
          <Select value={filters.branch} onValueChange={(value) => setFilters({ ...filters, branch: value })}>
            <SelectTrigger className="h-9 border-gray-200 w-40">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch} value={branch}>
                  {branch}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
            <SelectTrigger className="h-9 border-gray-200 w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Access Level Filter */}
          <Select value={filters.accessLevel} onValueChange={(value) => setFilters({ ...filters, accessLevel: value })}>
            <SelectTrigger className="h-9 border-gray-200 w-40">
              <SelectValue placeholder="All Access Levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Access Levels</SelectItem>
              {accessLevels.map((level) => (
                <SelectItem key={level} value={level}>
                  {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Role Filter */}
          <Select value={filters.role} onValueChange={(value) => setFilters({ ...filters, role: value })}>
            <SelectTrigger className="h-9 border-gray-200 w-40">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {roles.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Column Visibility on the right */}
        <Select
          value=""
          onValueChange={(columnId) => {
            if (columnId) {
              table.getColumn(columnId)?.toggleVisibility()
            }
          }}
        >
          <SelectTrigger className="h-9 border-gray-200 w-48">
            <SelectValue placeholder="Select Column Visibility" />
          </SelectTrigger>
          <SelectContent>
            {table.getAllLeafColumns().map((column) => (
              column.id !== 'name' && (
                <SelectItem key={column.id} value={column.id} className="flex items-center">
                  <div className="flex items-center gap-2">
                    {column.getCanHide() && (
                      <input
                        type="checkbox"
                        checked={column.getIsVisible()}
                        onChange={column.getToggleVisibilityHandler()}
                        className="scale-110"
                      />
                    )}
                    <span className="capitalize">{column.id.replace('_', ' ')}</span>
                  </div>
                </SelectItem>
              )
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="w-full min-w-max">
            <TableHeader className="sticky top-0 z-20 bg-white">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-gray-200 hover:bg-transparent">
                  {headerGroup.headers.map((header) => {
                    const isFirstColumn = header.id === 'name'
                    return (
                      <TableHead
                        key={header.id}
                        className={`text-gray-700 font-semibold text-xs border-r border-gray-200 whitespace-nowrap p-3 ${
                          isFirstColumn ? 'sticky left-0 z-40 shadow-sm bg-white' : 'bg-gray-50/50'
                        }`}
                      >
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-8 text-gray-500">
                    No staff members found
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="border-gray-100 hover:bg-gray-50/50 transition-colors cursor-pointer"
                  >
                    {row.getVisibleCells().map((cell) => {
                      const isFirstColumn = cell.column.id === 'name'
                      return (
                        <TableCell
                          key={cell.id}
                          className={`text-sm py-3 border-r border-gray-100 whitespace-nowrap ${
                            isFirstColumn ? 'sticky left-0 z-30 bg-white shadow-sm' : ''
                          }`}
                        >
                          <Link
                            href={`/users/${userId}/company/${companyId}/staff/directory/${row.original.id}`}
                            className="block h-full w-full"
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </Link>
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Summary */}
      {filteredData.length > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            Showing <span className="font-semibold text-gray-900">{filteredData.length}</span> of{' '}
            <span className="font-semibold text-gray-900">{staffList.length}</span> staff members
          </div>
          {(searchTerm || Object.values(filters).some((f) => f !== 'all')) && (
            <button
              onClick={() => {
                setSearchTerm('')
                setFilters({ branch: 'all', status: 'all', accessLevel: 'all', role: 'all' })
              }}
              className="text-core hover:text-army font-medium transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
