'use client';

import { useParams } from 'next/navigation';

/**
 * Invoice Preview Page
 * 
 * Full-page preview of the invoice as it will appear
 * when exported or sent to customer
 * 
 * Features:
 * - Live preview with selected template + design
 * - WYSIWYG rendering
 * - Print-friendly view
 * - "Send" button
 * - "Download PDF" button
 */

export default function PreviewInvoicePage() {
	const params = useParams();
	const invoiceId = params.invoiceId;

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<h1 className="text-3xl font-bold">Invoice Preview #{invoiceId}</h1>
				<div className="flex gap-2">
					<button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">
						Send to Client
					</button>
					<button className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600">
						Download PDF
					</button>
				</div>
			</div>

			{/* TODO: Implement full-page invoice renderer */}
			<div className="border rounded-lg p-8 text-center text-muted-foreground">
				<p>Invoice preview coming soon</p>
			</div>
		</div>
	);
}
