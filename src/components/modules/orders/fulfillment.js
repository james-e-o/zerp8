'use client'

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Search, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function FulfillmentPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [fulfillments, setFulfillments] = useState([]);

  return (
    <div className="w-full space-y-4 p-4">
      <div className="flex justify-between items-center gap-4">
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search orders for fulfillment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Button className="bg-core hover:bg-core/80 text-white flex items-center gap-2">
          <Package className="h-4 w-4" />
          Start Fulfillment
        </Button>
      </div>

      {/* Fulfillment Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Ready to Pick</p>
          <p className="text-2xl font-bold text-gray-900">0</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">In Preparation</p>
          <p className="text-2xl font-bold text-gray-900">0</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Ready to Ship</p>
          <p className="text-2xl font-bold text-gray-900">0</p>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No pending fulfillments. Orders ready for fulfillment will appear here.</p>
      </div>
    </div>
  );
}
