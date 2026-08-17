'use client';

import { useParams } from 'next/navigation';

/**
 * Export Invoice Page
 * 
 * Handles invoice export options:
 * - PDF (Puppeteer/Playwright rendering)
 * - Word Document (HTML → DOCX)
 * - Scheduled export to email
 * 
 * Features:
 * - Multiple format selection
 * - File download
 * - Email delivery option
 * - Export history log
 */

export default function ExportInvoicePage() {
	const params = useParams();
	const invoiceId = params.invoiceId;

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold">Export Invoice #{invoiceId}</h1>
				<p className="text-muted-foreground">Choose export format and options</p>
			</div>

			<div className="grid grid-cols-2 gap-4">
				<div className="border rounded-lg p-6 cursor-pointer hover:bg-gray-50">
					<h3 className="font-bold mb-2">PDF Document</h3>
					<p className="text-muted-foreground text-sm">High-quality PDF for printing and sharing</p>
				</div>
				<div className="border rounded-lg p-6 cursor-pointer hover:bg-gray-50">
					<h3 className="font-bold mb-2">Word Document</h3>
					<p className="text-muted-foreground text-sm">Editable DOCX format for further customization</p>
				</div>
			</div>

			{/* TODO: Implement export form with API integration */}
			<div className="border rounded-lg p-8 text-center text-muted-foreground">
				<p>Export options coming soon</p>
			</div>
		</div>
	);
}
