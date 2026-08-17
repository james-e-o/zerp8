'use client'

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Search, Download, BarChart3 } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function SalesReportsPage() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="w-full space-y-4 p-4">
      <div className="flex justify-between items-center gap-4">
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Button className="bg-core hover:bg-core/80 text-white flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-gray-600">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">₦0.00</p>
            </div>
            <BarChart3 className="h-8 w-8 text-blue-600" />
          </div>
          <p className="text-xs text-gray-500">This month</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">0</p>
            </div>
            <BarChart3 className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-xs text-gray-500">This month</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-gray-600">Pending Returns</p>
              <p className="text-2xl font-bold text-gray-900">0</p>
            </div>
            <BarChart3 className="h-8 w-8 text-red-600" />
          </div>
          <p className="text-xs text-gray-500">Awaiting processing</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500">Sales analytics and reports will appear here.</p>
      </div>
    </div>
  );
}
