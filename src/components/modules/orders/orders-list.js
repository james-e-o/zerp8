'use client'

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Search, Eye, Edit, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function OrdersListPage() {
  const [ordersList, setOrdersList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const statuses = ['all', 'draft', 'pending', 'confirmed', 'in-progress', 'shipped', 'completed', 'cancelled'];
  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-core/20 text-core',
    'in-progress': 'bg-purple-100 text-purple-800',
    shipped: 'bg-indigo-100 text-indigo-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  return (
    <div className="w-full space-y-4 p-4">
      <div className="flex justify-between items-center gap-4">
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Button className="bg-core hover:bg-core/80 text-white flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Order
        </Button>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {statuses.map((status) => (
          <Button
            key={status}
            variant={filterStatus === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus(status)}
            className="capitalize"
          >
            {status}
          </Button>
        ))}
      </div>

      {/* Empty State */}
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500 mb-4">No orders found. Create your first order to get started.</p>
        <Button className="bg-core hover:bg-core/80 text-white flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Order
        </Button>
      </div>
    </div>
  );
}
