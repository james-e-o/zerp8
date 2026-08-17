'use client';

import { useParams } from 'next/navigation';

/**
 * Template Detail Page
 * 
 * View and edit a specific template
 * 
 * Features:
 * - Full template preview
 * - Edit template structure (JSON-based)
 * - Assign designs to template
 * - Test with sample data
 * - Duplicate template
 */

export default function TemplateDetailPage() {
	const params = useParams();
	const templateId = params.templateId;

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold">Template: {templateId}</h1>
				<p className="text-muted-foreground">Edit template configuration</p>
			</div>

			{/* TODO: Implement template editor */}
			<div className="border rounded-lg p-8 text-center text-muted-foreground">
				<p>Template editor coming soon</p>
			</div>
		</div>
	);
}
