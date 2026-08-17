/**
 * SINGLE INVOICE API ROUTE
 * 
 * GET /api/invoices/[invoiceId]
 * - Fetch single invoice details
 * 
 * PATCH /api/invoices/[invoiceId]
 * - Update invoice (only if draft or issued)
 * - Body: partial invoice data
 * 
 * DELETE /api/invoices/[invoiceId]
 * - Delete invoice (only if draft)
 * 
 * Return format:
 * {
 *   success: boolean,
 *   data: invoice,
 *   error: string (if applicable)
 * }
 */

export async function GET(request, { params }) {
	const { invoiceId } = params;
	
	// TODO: Implement GET logic
	// 1. Fetch invoice from Supabase
	// 2. Include related line items, client, template, design
	// 3. Return complete invoice data
	
	return Response.json({
		success: false,
		error: 'Not implemented yet',
		invoiceId,
	});
}

export async function PATCH(request, { params }) {
	const { invoiceId } = params;
	const data = await request.json();
	
	// TODO: Implement PATCH logic
	// 1. Check invoice status (must be draft or issued)
	// 2. Validate update data
	// 3. Update invoice in Supabase
	// 4. Return updated invoice
	
	return Response.json({
		success: false,
		error: 'Not implemented yet',
		invoiceId,
	});
}

export async function DELETE(request, { params }) {
	const { invoiceId } = params;
	
	// TODO: Implement DELETE logic
	// 1. Check invoice status (must be draft)
	// 2. Delete invoice and related line items
	// 3. Return success
	
	return Response.json({
		success: false,
		error: 'Not implemented yet',
		invoiceId,
	});
}
