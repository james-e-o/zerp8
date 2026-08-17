'use client';

import { useState, useEffect } from 'react';

/**
 * Invoice Settings Page
 * 
 * Configure global company-level invoice defaults and behavior
 * Settings apply to all invoices in the company
 * 
 * Sections:
 * 1. Company & Branding
 * 2. Numbering & Identification
 * 3. Tax & Financial Rules
 * 4. Payment Terms & Notes
 * 5. Invoice Behavior (Workflow)
 * 6. Export & Delivery Defaults
 */

export default function InvoiceSettingsPage() {
	const [formData, setFormData] = useState({
		// 1. Company & Branding
		defaultLogo: '',
		defaultInvoiceTitle: 'Invoice',
		defaultTemplate: 'classic',
		defaultCurrency: 'GBP',

		// 2. Numbering & Identification
		invoiceNumberPrefix: 'INV-',
		invoiceNumberFormat: 'prefix_year_sequence', // prefix_year_sequence | prefix_sequence
		resetNumberingPerYear: true,
		allowManualOverride: true,
		currentSequence: 1,

		// 3. Tax & Financial Rules
		defaultTaxRate: 20,
		taxInclusive: false,
		enableTaxPerInvoice: true,
		defaultDiscountBehavior: 'fixed', // fixed | percentage

		// 4. Payment Terms & Notes
		defaultPaymentTerms: 'Net 30',
		defaultFooterNotes: 'Thank you for your business!',
		defaultLegalTerms: '',
		bankDetails: '',

		// 5. Invoice Behavior
		defaultInvoiceStatus: 'draft', // draft | issued
		allowEditingAfterIssue: true,
		requireApprovalBeforePosting: false,
		autoPostToAccounting: false,

		// 6. Export & Delivery Defaults
		defaultExportFormat: 'pdf', // pdf | docx | both
		includeLogoOnExport: true,
		pageSize: 'a4', // a4 | letter
		language: 'en',
	});

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');

	useEffect(() => {
		// TODO: Fetch settings from API
		// For now, using default values
		setLoading(false);
	}, []);

	const handleInputChange = (e) => {
		const { name, value, type, checked } = e.target;
		setFormData(prev => ({
			...prev,
			[name]: type === 'checkbox' ? checked : value
		}));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setSaving(true);
		setError('');
		setSuccess('');

		try {
			const response = await fetch(`/api/invoices/settings`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData),
			});

			if (!response.ok) throw new Error('Failed to save settings');

			const result = await response.json();
			if (result.success) {
				setSuccess('Settings saved successfully!');
				setTimeout(() => setSuccess(''), 3000);
			} else {
				setError(result.error || 'Unknown error occurred');
			}
		} catch (err) {
			setError(err.message);
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return <div className="text-center py-12"><p className="text-xs text-gray-500">Loading settings...</p></div>;
	}

	return (
		<div className="space-y-6 max-w-4xl">
			<div>
				<h1 className="text-2xl font-bold text-core">Invoice Settings</h1>
				<p className="text-xs text-gray-600">Configure global defaults for all invoices</p>
			</div>

			{error && (
				<div className="bg-red-50 border border-red-200 rounded-lg p-4 text-xs text-red-700">
					{error}
				</div>
			)}

			{success && (
				<div className="bg-green-50 border border-green-200 rounded-lg p-4 text-xs text-green-700">
					{success}
				</div>
			)}

			<form onSubmit={handleSubmit} className="space-y-6">

				{/* 1. Company & Branding Defaults */}
				<div className="bg-white border border-gray-200 rounded-lg p-6">
					<h2 className="text-lg font-bold text-core mb-4">1. Company & Branding Defaults</h2>
					<p className="text-xs text-gray-600 mb-4">Used automatically when creating new invoices</p>
					
					<div className="space-y-4">
						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-2">Default Logo URL</label>
							<input
								type="text"
								name="defaultLogo"
								value={formData.defaultLogo}
								onChange={handleInputChange}
								placeholder="https://..."
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
							/>
							<p className="text-xs text-gray-500 mt-1">Logo to appear on all invoices</p>
						</div>

						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-2">Invoice Title</label>
							<input
								type="text"
								name="defaultInvoiceTitle"
								value={formData.defaultInvoiceTitle}
								onChange={handleInputChange}
								placeholder="Invoice"
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
							/>
							<p className="text-xs text-gray-500 mt-1">e.g., Invoice, Tax Invoice, Proforma</p>
						</div>

						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-2">Default Template</label>
							<select
								name="defaultTemplate"
								value={formData.defaultTemplate}
								onChange={handleInputChange}
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
							>
								<option value="classic">Classic</option>
								<option value="modern">Modern</option>
								<option value="minimal">Minimal</option>
							</select>
						</div>

						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-2">Default Currency</label>
							<select
								name="defaultCurrency"
								value={formData.defaultCurrency}
								onChange={handleInputChange}
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
							>
								<option value="GBP">GBP (£)</option>
								<option value="USD">USD ($)</option>
								<option value="EUR">EUR (€)</option>
								<option value="NGN">NGN (₦)</option>
							</select>
						</div>
					</div>
				</div>

				{/* 2. Numbering & Identification */}
				<div className="bg-white border border-gray-200 rounded-lg p-6">
					<h2 className="text-lg font-bold text-core mb-4">2. Numbering & Identification</h2>
					<p className="text-xs text-gray-600 mb-4">Core accounting behavior for invoice numbering</p>
					
					<div className="space-y-4">
						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-2">Invoice Number Prefix</label>
							<input
								type="text"
								name="invoiceNumberPrefix"
								value={formData.invoiceNumberPrefix}
								onChange={handleInputChange}
								placeholder="INV-"
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
							/>
							<p className="text-xs text-gray-500 mt-1">e.g., INV-, 2026/INV/, BILL-</p>
						</div>

						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-2">Number Format</label>
							<select
								name="invoiceNumberFormat"
								value={formData.invoiceNumberFormat}
								onChange={handleInputChange}
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
							>
								<option value="prefix_sequence">Prefix + Sequence (INV-001, INV-002)</option>
								<option value="prefix_year_sequence">Prefix + Year + Sequence (INV-2026-001)</option>
							</select>
						</div>

						<div className="flex items-center gap-4">
							<label className="flex items-center gap-2 text-xs cursor-pointer">
								<input
									type="checkbox"
									name="resetNumberingPerYear"
									checked={formData.resetNumberingPerYear}
									onChange={handleInputChange}
									className="w-4 h-4 rounded border-gray-300"
								/>
								<span className="font-semibold text-gray-700">Reset numbering per year</span>
							</label>
							<label className="flex items-center gap-2 text-xs cursor-pointer">
								<input
									type="checkbox"
									name="allowManualOverride"
									checked={formData.allowManualOverride}
									onChange={handleInputChange}
									className="w-4 h-4 rounded border-gray-300"
								/>
								<span className="font-semibold text-gray-700">Allow manual override</span>
							</label>
						</div>

						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-2">Current Sequence</label>
							<input
								type="number"
								name="currentSequence"
								value={formData.currentSequence}
								onChange={handleInputChange}
								min="1"
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
							/>
							<p className="text-xs text-gray-500 mt-1">Next invoice will use: {formData.invoiceNumberPrefix}{formData.invoiceNumberFormat === 'prefix_year_sequence' ? new Date().getFullYear() + '-' : ''}{String(formData.currentSequence).padStart(3, '0')}</p>
						</div>
					</div>
				</div>

				{/* 3. Tax & Financial Rules */}
				<div className="bg-white border border-gray-200 rounded-lg p-6">
					<h2 className="text-lg font-bold text-core mb-4">3. Tax & Financial Rules</h2>
					<p className="text-xs text-gray-600 mb-4">Avoid repeating tax logic per invoice</p>
					
					<div className="space-y-4">
						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-2">Default Tax Rate (%)</label>
							<input
								type="number"
								name="defaultTaxRate"
								value={formData.defaultTaxRate}
								onChange={handleInputChange}
								min="0"
								max="100"
								step="0.01"
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
							/>
						</div>

						<div className="flex items-center gap-4">
							<label className="flex items-center gap-2 text-xs cursor-pointer">
								<input
									type="checkbox"
									name="taxInclusive"
									checked={formData.taxInclusive}
									onChange={handleInputChange}
									className="w-4 h-4 rounded border-gray-300"
								/>
								<span className="font-semibold text-gray-700">Tax is inclusive (VAT)</span>
							</label>
							<label className="flex items-center gap-2 text-xs cursor-pointer">
								<input
									type="checkbox"
									name="enableTaxPerInvoice"
									checked={formData.enableTaxPerInvoice}
									onChange={handleInputChange}
									className="w-4 h-4 rounded border-gray-300"
								/>
								<span className="font-semibold text-gray-700">Allow per-item tax rates</span>
							</label>
						</div>

						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-2">Default Discount Behavior</label>
							<select
								name="defaultDiscountBehavior"
								value={formData.defaultDiscountBehavior}
								onChange={handleInputChange}
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
							>
								<option value="fixed">Fixed Amount</option>
								<option value="percentage">Percentage</option>
							</select>
						</div>
					</div>
				</div>

				{/* 4. Payment Terms & Notes */}
				<div className="bg-white border border-gray-200 rounded-lg p-6">
					<h2 className="text-lg font-bold text-core mb-4">4. Payment Terms & Notes</h2>
					<p className="text-xs text-gray-600 mb-4">Like Odoo & Zoho do this exactly</p>
					
					<div className="space-y-4">
						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-2">Default Payment Terms</label>
							<select
								name="defaultPaymentTerms"
								value={formData.defaultPaymentTerms}
								onChange={handleInputChange}
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
							>
								<option>Due on Receipt</option>
								<option>Net 7</option>
								<option>Net 15</option>
								<option>Net 30</option>
								<option>Net 45</option>
								<option>Net 60</option>
								<option>End of Month</option>
								<option>End of Following Month</option>
							</select>
						</div>

						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-2">Default Footer Notes</label>
							<textarea
								name="defaultFooterNotes"
								value={formData.defaultFooterNotes}
								onChange={handleInputChange}
								placeholder="Thank you for your business!"
								rows="2"
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
							/>
						</div>

						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-2">Default Legal Terms</label>
							<textarea
								name="defaultLegalTerms"
								value={formData.defaultLegalTerms}
								onChange={handleInputChange}
								placeholder="1. Terms and conditions...
2. Payment details...
3. Cancellation policy..."
								rows="4"
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
							/>
						</div>

						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-2">Bank Details / Payment Instructions</label>
							<textarea
								name="bankDetails"
								value={formData.bankDetails}
								onChange={handleInputChange}
								placeholder="Account Name: ...
Account Number: ...
Bank Code: ...
SWIFT: ..."
								rows="3"
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
							/>
						</div>
					</div>
				</div>

				{/* 5. Invoice Behavior (Workflow) */}
				<div className="bg-white border border-gray-200 rounded-lg p-6">
					<h2 className="text-lg font-bold text-core mb-4">5. Invoice Behavior (Workflow)</h2>
					<p className="text-xs text-gray-600 mb-4">Control how invoices connect to accounting</p>
					
					<div className="space-y-4">
						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-2">Default Invoice Status</label>
							<select
								name="defaultInvoiceStatus"
								value={formData.defaultInvoiceStatus}
								onChange={handleInputChange}
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
							>
								<option value="draft">Draft (Not sent yet)</option>
								<option value="issued">Issued (Sent to customer)</option>
							</select>
							<p className="text-xs text-gray-500 mt-1">Invoices created with this status by default</p>
						</div>

						<div className="flex items-center gap-4">
							<label className="flex items-center gap-2 text-xs cursor-pointer">
								<input
									type="checkbox"
									name="allowEditingAfterIssue"
									checked={formData.allowEditingAfterIssue}
									onChange={handleInputChange}
									className="w-4 h-4 rounded border-gray-300"
								/>
								<span className="font-semibold text-gray-700">Allow editing after issuing</span>
							</label>
						</div>

						<div className="flex items-center gap-4">
							<label className="flex items-center gap-2 text-xs cursor-pointer">
								<input
									type="checkbox"
									name="requireApprovalBeforePosting"
									checked={formData.requireApprovalBeforePosting}
									onChange={handleInputChange}
									className="w-4 h-4 rounded border-gray-300"
								/>
								<span className="font-semibold text-gray-700">Require approval before posting</span>
							</label>
							<p className="text-xs text-gray-500">(for high-value invoices)</p>
						</div>

						<div className="flex items-center gap-4">
							<label className="flex items-center gap-2 text-xs cursor-pointer">
								<input
									type="checkbox"
									name="autoPostToAccounting"
									checked={formData.autoPostToAccounting}
									onChange={handleInputChange}
									className="w-4 h-4 rounded border-gray-300"
								/>
								<span className="font-semibold text-gray-700">Auto-post to accounting</span>
							</label>
							<p className="text-xs text-gray-500">(creates journal entries immediately)</p>
						</div>
					</div>
				</div>

				{/* 6. Export & Delivery Defaults */}
				<div className="bg-white border border-gray-200 rounded-lg p-6">
					<h2 className="text-lg font-bold text-core mb-4">6. Export & Delivery Defaults</h2>
					<p className="text-xs text-gray-600 mb-4">Control default export behavior</p>
					
					<div className="space-y-4">
						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-2">Default Export Format</label>
							<select
								name="defaultExportFormat"
								value={formData.defaultExportFormat}
								onChange={handleInputChange}
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
							>
								<option value="pdf">PDF Only</option>
								<option value="docx">Word (DOCX) Only</option>
								<option value="both">Both PDF & Word</option>
							</select>
						</div>

						<div className="flex items-center gap-4">
							<label className="flex items-center gap-2 text-xs cursor-pointer">
								<input
									type="checkbox"
									name="includeLogoOnExport"
									checked={formData.includeLogoOnExport}
									onChange={handleInputChange}
									className="w-4 h-4 rounded border-gray-300"
								/>
								<span className="font-semibold text-gray-700">Include logo on export</span>
							</label>
						</div>

						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-2">Page Size</label>
							<select
								name="pageSize"
								value={formData.pageSize}
								onChange={handleInputChange}
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
							>
								<option value="a4">A4 (210mm × 297mm)</option>
								<option value="letter">Letter (8.5" × 11")</option>
							</select>
						</div>

						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-2">Language</label>
							<select
								name="language"
								value={formData.language}
								onChange={handleInputChange}
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
							>
								<option value="en">English</option>
								<option value="es">Spanish</option>
								<option value="fr">French</option>
								<option value="de">German</option>
								<option value="pt">Portuguese</option>
							</select>
						</div>
					</div>
				</div>

				{/* Action Buttons */}
				<div className="flex gap-3">
					<button
						type="submit"
						disabled={saving}
						className="px-6 py-2 bg-core text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold text-xs"
					>
						{saving ? 'Saving...' : 'Save Settings'}
					</button>
					<button
						type="button"
						onClick={() => window.history.back()}
						className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold text-xs"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	);
}
