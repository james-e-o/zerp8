'use client';

import { useParams } from 'next/navigation';

/**
 * Invoice Detail Page
 * 
 * Displays a single invoice with:
 * - Full invoice details
 * - Client information
 * - Line items
 * - Totals & calculations
 * - Status badge
 * - Action buttons (edit, preview, export, send, post)
 */

export default function InvoiceDetailPage() {
	const params = useParams();
	const invoiceId = params.invoiceId;

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold">Invoice #{invoiceId}</h1>
					<p className="text-muted-foreground">View and manage invoice details</p>
				</div>
				<div className="flex gap-2">
					<a href={`${invoiceId}/edit`} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">
						Edit
					</a>
					<a href={`${invoiceId}/preview`} className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600">
						Preview
					</a>
					<a href={`${invoiceId}/export`} className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600">
						Export
					</a>
				</div>
			</div>

			{/* TODO: Implement InvoiceRenderer component */}
			<div className="border rounded-lg p-8 text-center text-muted-foreground">
				<p>Invoice detail view coming soon</p>
			</div>
		</div>
	);
}
