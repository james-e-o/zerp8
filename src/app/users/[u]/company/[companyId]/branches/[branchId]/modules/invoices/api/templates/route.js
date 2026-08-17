/**
 * INVOICE TEMPLATES API ROUTE
 * 
 * GET /api/invoices/templates
 * - Fetch all available templates
 * - Include built-in templates
 * - Include custom company templates
 * 
 * POST /api/invoices/templates
 * - Create new custom template
 * - Body: template configuration (JSON structure)
 * 
 * Return:
 * {
 *   success: boolean,
 *   data: template | template[],
 *   error: string
 * }
 */

export async function GET(request) {
	// TODO: Implement GET logic
	// 1. Fetch built-in templates (hardcoded or from DB)
	// 2. Fetch custom company templates from Supabase
	// 3. Return array of templates
	
	return Response.json({
		success: false,
		error: 'Not implemented yet',
	});
}

export async function POST(request) {
	const data = await request.json();
	
	// TODO: Implement POST logic
	// 1. Validate template structure
	// 2. Create template in Supabase
	// 3. Return created template with ID
	
	return Response.json({
		success: false,
		error: 'Not implemented yet',
	});
}
