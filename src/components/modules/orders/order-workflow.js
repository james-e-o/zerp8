'use client'

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Search, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function OrderWorkflowPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState([]);

  const statuses = [
    { id: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-800', count: 0 },
    { id: 'pending', label: 'Pending Approval', color: 'bg-yellow-100 text-yellow-800', count: 0 },
    { id: 'confirmed', label: 'Confirmed', color: 'bg-core/20 text-core', count: 0 },
    { id: 'in-progress', label: 'In Progress', color: 'bg-purple-100 text-purple-800', count: 0 },
    { id: 'shipped', label: 'Shipped', color: 'bg-indigo-100 text-indigo-800', count: 0 },
    { id: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800', count: 0 },
  ];

  return (
    <div className="w-full space-y-4 p-4">
      <div className="flex justify-between items-center gap-4 mb-6">
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search orders by ID, customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statuses.map((status) => (
          <div key={status.id} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4 pb-3 border-b">
              <div>
                <h3 className="font-semibold text-gray-900">{status.label}</h3>
                <p className="text-sm text-gray-500">{status.count} orders</p>
              </div>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${status.color === 'bg-blue-100 text-blue-800' ? 'bg-core/20 text-core' : status.color}`}>
                {status.count}
              </span>
            </div>

            <div className="space-y-2">
              {status.count === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No orders in this stage</p>
                </div>
              ) : (
                // Orders would be mapped here
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">Orders will appear here when created</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {orders.length === 0 && (
      <div className="bg-core/10 border border-core/20 rounded-lg p-8 text-center mt-8">
          <p className="text-gray-700 mb-4">Track order status across different workflow stages using this Kanban view.</p>
          <p className="text-sm text-gray-600">Drag and drop orders to update their status, or click to view details and make adjustments.</p>
        </div>
      )}
    </div>
  );
}
