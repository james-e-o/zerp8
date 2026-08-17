'use client';

import { useParams } from 'next/navigation';

/**
 * Edit Invoice Page
 * 
 * Edit existing invoice (only if status is Draft or Issued)
 * Once Posted, only read-only viewing is allowed
 * 
 * Features:
 * - Edit client details
 * - Modify line items
 * - Adjust discounts & taxes
 * - Change design (for non-posted invoices)
 */

export default function EditInvoicePage() {
	const params = useParams();
	const invoiceId = params.invoiceId;

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold">Edit Invoice #{invoiceId}</h1>
				<p className="text-muted-foreground">Modify invoice details</p>
			</div>

			{/* TODO: Implement InvoiceForm component in edit mode */}
			<div className="border rounded-lg p-8 text-center text-muted-foreground">
				<p>Invoice edit form coming soon</p>
			</div>
		</div>
	);
}
