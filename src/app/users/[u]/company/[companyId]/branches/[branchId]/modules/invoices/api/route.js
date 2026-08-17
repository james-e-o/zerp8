/**
 * INVOICES API ROUTE
 * 
 * GET /api/invoices
 * - Fetch all invoices for company/branch
 * - Query params: status, page, limit, search
 * 
 * POST /api/invoices
 * - Create new invoice
 * - Body: invoiceData (client, line items, design, template)
 * 
 * Return format:
 * {
 *   success: boolean,
 *   data: invoice | invoice[],
 *   error: string (if applicable)
 * }
 */

export async function GET(request) {
	// TODO: Implement GET logic
	// 1. Extract query params (status, page, limit, search)
	// 2. Fetch from Supabase
	// 3. Return invoices list with pagination
	
	return Response.json({
		success: false,
		error: 'Not implemented yet',
	});
}

export async function POST(request) {
	// TODO: Implement POST logic
	// 1. Validate invoice data
	// 2. Generate invoice number (sequence)
	// 3. Create invoice record in Supabase
	// 4. Return created invoice with ID
	
	return Response.json({
		success: false,
		error: 'Not implemented yet',
	});
}
