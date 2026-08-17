'use client';

import { useState } from 'react';

/**
 * Invoice Templates Page
 * 
 * Browse and manage invoice templates
 * 
 * Features:
 * - View all templates (built-in + custom)
 * - Preview templates
 * - Create custom template
 * - Duplicate & edit templates
 * - Set as default
 * 
 * Built-in templates:
 * - Classic
 * - Modern
 * - Minimal
 * - Corporate
 */

export default function TemplatesPage() {
	const [templates] = useState([
		{
			id: 'classic',
			name: 'Classic',
			description: 'Professional and traditional layout',
			type: 'built-in',
			preview: '📄'
		},
		{
			id: 'modern',
			name: 'Modern',
			description: 'Contemporary and clean design',
			type: 'built-in',
			preview: '✨'
		},
		{
			id: 'minimal',
			name: 'Minimal',
			description: 'Simple and spacious layout',
			type: 'built-in',
			preview: '🎯'
		},
		{
			id: 'corporate',
			name: 'Corporate',
			description: 'Enterprise-level design',
			type: 'built-in',
			preview: '🏢'
		}
	]);

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-2xl font-bold text-core">Invoice Templates</h1>
					<p className="text-xs text-gray-600">Choose or create your invoice layout</p>
				</div>
				<button className="bg-core text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold text-xs">
					+ Create Template
				</button>
			</div>

			{/* Templates Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{templates.map((template) => (
					<div 
						key={template.id} 
						className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg hover:border-core transition-all duration-200 cursor-pointer"
					>
						<div className="bg-gray-100 h-40 flex items-center justify-center text-5xl">
							{template.preview}
						</div>
						<div className="p-4 space-y-2">
							<div className="flex justify-between items-start">
								<div>
									<h3 className="font-bold text-sm text-gray-900">{template.name}</h3>
									<p className="text-xs text-gray-600">{template.description}</p>
								</div>
								{template.type === 'built-in' && (
									<span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-1 rounded">
										Built-in
									</span>
								)}
							</div>

							<div className="flex gap-2 pt-2">
								<button className="flex-1 px-3 py-2 bg-core text-white rounded-lg hover:bg-blue-700 font-semibold text-xs">
									Preview
								</button>
								<button className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold text-xs">
									Customize
								</button>
								<button className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold text-xs" title="Set as default">
									★
								</button>
							</div>
						</div>
					</div>
				))}
			</div>

			{/* Custom Templates Section */}
			<div className="bg-white border border-gray-200 rounded-lg p-6 mt-8">
				<h2 className="text-sm font-bold text-core mb-4">Custom Templates</h2>
				<div className="text-center py-8">
					<p className="text-xs text-gray-600 mb-4">No custom templates yet</p>
					<button className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 font-semibold text-xs">
						Create Your First Template
					</button>
				</div>
			</div>
		</div>
	);
}
