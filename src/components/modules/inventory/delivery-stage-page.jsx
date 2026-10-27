'use client'

import { EmptyState } from '@/components/modules/inventory/receipt-shared'

// Shared by the Picking, Ready, Done and POS tabs of Inventory > Outgoing.
//
// These four tabs show delivery documents (picks, hand-overs, dispatched
// deliveries, deferred POS orders). No delivery tables exist in the database
// yet, so there is nothing real to list, and this page says so instead of
// showing invented rows. When Sales creates delivery documents, each tab here
// becomes a list of them, filtered by stage:
//
//   picking  documents being picked (batch chosen per line, soonest expiry first)
//   ready    picked and packed, waiting for the customer or carrier
//   done     handed over; the stock movement is posted
//   pos      point-of-sale orders that are delivered later than they are sold
//
// Pending (the landing tab) and Returns already read real data.

const STAGES = {
  picking: {
    title: 'Picking',
    body: 'Delivery documents that are being picked will be listed here, with the batch to take for each line.',
  },
  ready: {
    title: 'Ready',
    body: 'Documents that are picked and waiting to be handed to the customer or carrier will be listed here.',
  },
  done: {
    title: 'Done',
    body: 'Delivered documents will be listed here, each with the stock movement it posted.',
  },
  pos: {
    title: 'POS',
    body: 'Point-of-sale orders that are delivered later than they are sold will be listed here. Orders handed over at the till never appear.',
  },
}

export default function DeliveryStagePage({ stage }) {
  const copy = STAGES[stage] || STAGES.picking
  return (
    <div className="flex flex-col gap-3 p-4">
      <EmptyState>
        <div className="max-w-md space-y-1">
          <p className="font-medium text-gray-800">{copy.title}</p>
          <p className="text-xs">{copy.body}</p>
          <p className="text-xs">Delivery documents arrive with the Sales module, so there is nothing to show yet.</p>
        </div>
      </EmptyState>
    </div>
  )
}
