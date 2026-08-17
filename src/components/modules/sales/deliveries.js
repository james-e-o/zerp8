'use client'

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function DeliveriesPage() {
  const [deliveriesList, setDeliveriesList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="w-full space-y-4 p-4">
      <div className="flex justify-between items-center gap-4">
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search deliveries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Button className="bg-core hover:bg-core/80 text-white flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Delivery
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No deliveries yet. Create delivery notes for your invoices.</p>
      </div>
    </div>
  );
}
