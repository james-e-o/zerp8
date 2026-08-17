"use client"

import { Button } from "@/components/ui/button"

export default function BillingPage() {
  return (
    <div className="bg-white">
      {/* Billing Address Content */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Billing Address</h3>
        <div className="space-y-4">
          <Button variant="outline" className="w-full">
            Add Billing Address
          </Button>
        </div>
      </div>
    </div>
  )
}
