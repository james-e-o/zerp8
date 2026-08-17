'use client';

import { useState } from 'react';

/**
 * Create Invoice Page
 * 
 * Comprehensive invoice creation form based on professional invoice standards
 * Includes:
 * - Customer details
 * - Invoice metadata (date, payment terms, currency)
 * - Multiple line items with per-item tax rates
 * - Terms and conditions
 * - Tax summary by rate
 */

export default function CreateInvoicePage() {
	const [formData, setFormData] = useState({
		// Basic Info
		invoiceNumber: '',
		invoiceDate: new Date().toISOString().split('T')[0],
		dueDate: '',
		
		// Customer
		customerName: '',
		customerAddress: '',
		customerCity: '',
		customerPostcode: '',
		customerCountry: '',
		
		// Payment Info
		paymentReference: '',
		paymentTerms: 'End of Following Month',
		currency: 'GBP',
		
		// Line Items
		lineItems: [
			{
				id: 1,
				product: '',
				label: '',
				quantity: 1,
				price: 0,
				taxRate: 20,
			}
		],
		
		// Terms & Conditions
		termsAndConditions: '',
	});

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');

	// Handle basic input changes
	const handleInputChange = (e) => {
		const { name, value } = e.target;
		setFormData(prev => ({ ...prev, [name]: value }));
	};

	// Handle line item changes
	const handleLineItemChange = (id, field, value) => {
		setFormData(prev => ({
			...prev,
			lineItems: prev.lineItems.map(item =>
				item.id === id ? { ...item, [field]: field === 'quantity' || field === 'price' || field === 'taxRate' ? parseFloat(value) || 0 : value } : item
			)
		}));
	};

	// Add new line item
	const addLineItem = () => {
		const newId = Math.max(...formData.lineItems.map(item => item.id), 0) + 1;
		setFormData(prev => ({
			...prev,
			lineItems: [
				...prev.lineItems,
				{ id: newId, product: '', label: '', quantity: 1, price: 0, taxRate: 20 }
			]
		}));
	};

	// Remove line item
	const removeLineItem = (id) => {
		if (formData.lineItems.length === 1) {
			setError('You must have at least one line item');
			return;
		}
		setFormData(prev => ({
			...prev,
			lineItems: prev.lineItems.filter(item => item.id !== id)
		}));
	};

	// Calculate totals
	const calculateTotals = () => {
		let totals = {
			untaxedAmount: 0,
			taxByRate: {},
			totalTax: 0,
			grandTotal: 0,
		};

		formData.lineItems.forEach(item => {
			const lineTotal = item.quantity * item.price;
			totals.untaxedAmount += lineTotal;

			if (!totals.taxByRate[item.taxRate]) {
				totals.taxByRate[item.taxRate] = 0;
			}
			totals.taxByRate[item.taxRate] += (lineTotal * item.taxRate) / 100;
		});

		totals.totalTax = Object.values(totals.taxByRate).reduce((sum, tax) => sum + tax, 0);
		totals.grandTotal = totals.untaxedAmount + totals.totalTax;

		return totals;
	};

	const totals = calculateTotals();
	const taxRates = Object.keys(totals.taxByRate).sort((a, b) => a - b);

	// Handle form submission
	const handleSubmit = async (e, status = 'draft') => {
		e.preventDefault();
		setLoading(true);
		setError('');
		setSuccess('');

		// Validation
		if (!formData.invoiceNumber.trim()) {
			setError('Invoice number is required');
			setLoading(false);
			return;
		}

		if (!formData.customerName.trim()) {
			setError('Customer name is required');
			setLoading(false);
			return;
		}

		if (formData.lineItems.length === 0) {
			setError('At least one line item is required');
			setLoading(false);
			return;
		}

		try {
			const payload = {
				...formData,
				status,
				totals,
			};

			const response = await fetch(`/api/invoices`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			if (!response.ok) throw new Error('Failed to save invoice');

			const result = await response.json();
			if (result.success) {
				setSuccess('Invoice saved successfully!');
				// Reset form or redirect
				setTimeout(() => {
					window.location.href = `${result.data.id}`;
				}, 1000);
			} else {
				setError(result.error || 'Unknown error occurred');
			}
		} catch (err) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="space-y-6 max-w-5xl">
			<div>
				<h1 className="text-2xl font-bold text-core">Create Invoice</h1>
				<p className="text-xs text-gray-600">Fill in the details below to create a new invoice</p>
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

			<form onSubmit={(e) => handleSubmit(e, 'draft')} className="space-y-6">

				{/* Section 1: Invoice Details */}
				<div className="bg-white border border-gray-200 rounded-lg p-6">
					<h2 className="text-sm font-bold text-core mb-4">Invoice Details</h2>
					<div className="grid grid-cols-3 gap-4">
						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-1">Invoice Number</label>
							<input
								type="text"
								name="invoiceNumber"
								value={formData.invoiceNumber}
								onChange={handleInputChange}
								placeholder="INV/2023/00001"
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
								required
							/>
						</div>
						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-1">Invoice Date</label>
							<input
								type="date"
								name="invoiceDate"
								value={formData.invoiceDate}
								onChange={handleInputChange}
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
								required
							/>
						</div>
						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-1">Due Date</label>
							<input
								type="date"
								name="dueDate"
								value={formData.dueDate}
								onChange={handleInputChange}
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
								required
							/>
						</div>
					</div>
				</div>

				{/* Section 2: Customer Information */}
				<div className="bg-white border border-gray-200 rounded-lg p-6">
					<h2 className="text-sm font-bold text-core mb-4">Customer Information</h2>
					<div className="grid grid-cols-2 gap-4 mb-4">
						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-1">Customer Name *</label>
							<input
								type="text"
								name="customerName"
								value={formData.customerName}
								onChange={handleInputChange}
								placeholder="Mr & Mrs Hemingway"
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
								required
							/>
						</div>
						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-1">Address</label>
							<input
								type="text"
								name="customerAddress"
								value={formData.customerAddress}
								onChange={handleInputChange}
								placeholder="Sunflower Av. 1321"
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
							/>
						</div>
						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-1">City</label>
							<input
								type="text"
								name="customerCity"
								value={formData.customerCity}
								onChange={handleInputChange}
								placeholder="San Francisco CA 94112"
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
							/>
						</div>
						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-1">Postcode</label>
							<input
								type="text"
								name="customerPostcode"
								value={formData.customerPostcode}
								onChange={handleInputChange}
								placeholder="94112"
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
							/>
						</div>
						<div className="col-span-2">
							<label className="block text-xs font-semibold text-gray-700 mb-1">Country</label>
							<input
								type="text"
								name="customerCountry"
								value={formData.customerCountry}
								onChange={handleInputChange}
								placeholder="United States"
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
							/>
						</div>
					</div>
				</div>

				{/* Section 3: Payment Information */}
				<div className="bg-white border border-gray-200 rounded-lg p-6">
					<h2 className="text-sm font-bold text-core mb-4">Payment Information</h2>
					<div className="grid grid-cols-3 gap-4">
						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-1">Payment Reference</label>
							<input
								type="text"
								name="paymentReference"
								value={formData.paymentReference}
								onChange={handleInputChange}
								placeholder="INV/2023/00004"
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
							/>
						</div>
						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-1">Payment Terms</label>
							<select
								name="paymentTerms"
								value={formData.paymentTerms}
								onChange={handleInputChange}
								className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
							>
								<option>Due on Receipt</option>
								<option>End of Following Month</option>
								<option>Net 15</option>
								<option>Net 30</option>
								<option>Net 45</option>
								<option>Net 60</option>
							</select>
						</div>
						<div>
							<label className="block text-xs font-semibold text-gray-700 mb-1">Currency</label>
							<select
								name="currency"
								value={formData.currency}
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

				{/* Section 4: Line Items */}
				<div className="bg-white border border-gray-200 rounded-lg p-6">
					<h2 className="text-sm font-bold text-core mb-4">Invoice Lines</h2>
					<div className="overflow-x-auto">
						<table className="w-full border-collapse">
							<thead>
								<tr className="bg-gray-50 border-b">
									<th className="px-4 py-2 text-left text-xs font-semibold">Product</th>
									<th className="px-4 py-2 text-left text-xs font-semibold">Label</th>
									<th className="px-4 py-2 text-right text-xs font-semibold w-20">Qty</th>
									<th className="px-4 py-2 text-right text-xs font-semibold w-24">Price</th>
									<th className="px-4 py-2 text-center text-xs font-semibold w-20">Tax %</th>
									<th className="px-4 py-2 text-right text-xs font-semibold w-24">Total</th>
									<th className="px-4 py-2 text-center w-12"></th>
								</tr>
							</thead>
							<tbody>
								{formData.lineItems.map((item) => {
									const itemTotal = item.quantity * item.price;
									return (
										<tr key={item.id} className="border-b hover:bg-gray-50">
											<td className="px-4 py-3">
												<input
													type="text"
													value={item.product}
													onChange={(e) => handleLineItemChange(item.id, 'product', e.target.value)}
													placeholder="Wedding cake"
													className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-core text-xs"
												/>
											</td>
											<td className="px-4 py-3">
												<input
													type="text"
													value={item.label}
													onChange={(e) => handleLineItemChange(item.id, 'label', e.target.value)}
													placeholder="Wedding cake"
													className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-core text-xs"
												/>
											</td>
											<td className="px-4 py-3">
												<input
													type="number"
													value={item.quantity}
													onChange={(e) => handleLineItemChange(item.id, 'quantity', e.target.value)}
													min="0"
													step="0.01"
													className="w-full px-2 py-1 text-right border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-core text-xs"
												/>
											</td>
											<td className="px-4 py-3">
												<input
													type="number"
													value={item.price}
													onChange={(e) => handleLineItemChange(item.id, 'price', e.target.value)}
													min="0"
													step="0.01"
													className="w-full px-2 py-1 text-right border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-core text-xs"
												/>
											</td>
											<td className="px-4 py-3">
												<select
													value={item.taxRate}
													onChange={(e) => handleLineItemChange(item.id, 'taxRate', e.target.value)}
													className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-core text-xs"
												>
													<option value="0">0%</option>
													<option value="5">5%</option>
													<option value="10">10%</option>
													<option value="20">20%</option>
													<option value="25">25%</option>
												</select>
											</td>
											<td className="px-4 py-3 text-right font-semibold text-xs">
												{formData.currency} {itemTotal.toFixed(2)}
											</td>
											<td className="px-4 py-3 text-center">
												<button
													type="button"
													onClick={() => removeLineItem(item.id)}
													className="text-red-600 hover:text-red-800 font-bold text-xs"
												>
													✕
												</button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
					<button
						type="button"
						onClick={addLineItem}
						className="mt-4 px-4 py-2 bg-core text-white rounded-lg hover:bg-blue-700 font-semibold text-xs"
					>
						+ Add Line Item
					</button>
				</div>

				{/* Section 5: Tax Summary */}
				<div className="bg-white border border-gray-200 rounded-lg p-6">
					<h2 className="text-sm font-bold text-core mb-4">Tax Summary</h2>
					<div className="flex justify-end">
						<div className="w-full md:w-96 space-y-3">
							<div className="flex justify-between">
								<span className="text-gray-700 text-xs">Untaxed Amount:</span>
								<span className="font-semibold text-xs">{formData.currency} {totals.untaxedAmount.toFixed(2)}</span>
							</div>
							{taxRates.map(rate => (
								<div key={rate} className="flex justify-between text-xs">
									<span className="text-gray-600">TAX {rate}%:</span>
									<span className="font-semibold">{formData.currency} {totals.taxByRate[rate].toFixed(2)}</span>
								</div>
							))}
							<div className="border-t pt-3 flex justify-between text-sm font-bold">
								<span>Total:</span>
								<span className="text-core">{formData.currency} {totals.grandTotal.toFixed(2)}</span>
							</div>
						</div>
					</div>
				</div>

				{/* Section 6: Terms and Conditions */}
				<div className="bg-white border border-gray-200 rounded-lg p-6">
					<h2 className="text-sm font-bold text-core mb-4">Terms and Conditions</h2>
					<textarea
						name="termsAndConditions"
						value={formData.termsAndConditions}
						onChange={handleInputChange}
						placeholder="1. If the bride or groom runs away during or on the day of the ceremony, the wedding planner will charge the full amount.
2. If you run away 3 days before the wedding, the wedding planner will charge 50%.
3. The wedding planner will not be held accountable for any accidents involving cake and/or bagpipes"
						rows="6"
						className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
					/>
				</div>

				{/* Action Buttons */}
				<div className="flex gap-3">
					<button
						type="submit"
						disabled={loading}
						className="flex-1 px-6 py-2 bg-core text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold text-xs"
					>
						{loading ? 'Saving...' : 'Save as Draft'}
					</button>
					<button
						type="button"
						onClick={(e) => handleSubmit(e, 'issued')}
						disabled={loading}
						className="flex-1 px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 font-semibold text-xs"
					>
						{loading ? 'Saving...' : 'Save & Issue'}
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
