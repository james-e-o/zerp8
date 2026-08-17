'use client'

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Search, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function BackordersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [backorders, setBackorders] = useState([]);

  return (
    <div className="w-full space-y-4 p-4">
      <div className="flex justify-between items-center gap-4">
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search backorders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Filter</Button>
        </div>
      </div>

      {/* Backorder Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-red-50 rounded-lg border border-red-200 p-4">
          <p className="text-sm text-red-700 mb-1">Pending Backorders</p>
          <p className="text-2xl font-bold text-red-900">0</p>
        </div>
        <div className="bg-orange-50 rounded-lg border border-orange-200 p-4">
          <p className="text-sm text-orange-700 mb-1">Items Out of Stock</p>
          <p className="text-2xl font-bold text-orange-900">0</p>
        </div>
        <div className="bg-core/10 rounded-lg border border-core/20 p-4">
          <p className="text-sm text-core mb-1">Expected Restock</p>
          <p className="text-2xl font-bold text-core">-</p>
        </div>
      </div>

      {/* Empty State */}
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 mb-2">No backorders at the moment.</p>
        <p className="text-sm text-gray-400">Items that cannot be fulfilled immediately will be tracked here.</p>
      </div>
    </div>
  );
}
