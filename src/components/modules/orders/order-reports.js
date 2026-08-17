'use client'

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Search, Download, BarChart3 } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function OrderReportsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('month');

  return (
    <div className="w-full space-y-4 p-4">
      <div className="flex justify-between items-center gap-4 mb-6">
        <div className="flex gap-2">
          <select 
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
        </div>
        <Button className="bg-core hover:bg-core/80 text-white flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">0</p>
            </div>
            <BarChart3 className="h-8 w-8 text-core" />
          </div>
          <p className="text-xs text-gray-500">+0% from last period</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-gray-600">Total Value</p>
              <p className="text-2xl font-bold text-gray-900">₦0.00</p>
            </div>
            <BarChart3 className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-xs text-gray-500">+0% from last period</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-gray-600">Avg Order Value</p>
              <p className="text-2xl font-bold text-gray-900">₦0.00</p>
            </div>
            <BarChart3 className="h-8 w-8 text-purple-600" />
          </div>
          <p className="text-xs text-gray-500">Order performance</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-gray-600">Fulfillment Rate</p>
              <p className="text-2xl font-bold text-gray-900">0%</p>
            </div>
            <BarChart3 className="h-8 w-8 text-orange-600" />
          </div>
          <p className="text-xs text-gray-500">on-time delivery</p>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Orders by Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Completed</span>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{width: '0%'}}></div>
                </div>
                <span className="text-sm font-medium text-gray-900">0</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">In Progress</span>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div className="bg-core h-2 rounded-full" style={{width: '0%'}}></div>
                </div>
                <span className="text-sm font-medium text-gray-900">0</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Pending</span>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div className="bg-yellow-600 h-2 rounded-full" style={{width: '0%'}}></div>
                </div>
                <span className="text-sm font-medium text-gray-900">0</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Top Customers (by Order Value)</h3>
          <div className="space-y-3">
            <p className="text-sm text-gray-500 text-center py-8">No orders yet. Analytics will appear here.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
