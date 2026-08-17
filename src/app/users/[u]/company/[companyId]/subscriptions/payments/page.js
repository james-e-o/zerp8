"use client"

import { Button } from "@/components/ui/button"

export default function PaymentsPage() {
  return (
    <div className="bg-white">
      {/* Payment Details Content */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Payment Method</h3>
        <div className="space-y-4">
          <Button variant="outline" className="w-full">
            Add Payment Method
          </Button>
        </div>
      </div>
    </div>
  )
}
