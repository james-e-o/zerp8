'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

/**
 * Invoices List Component
 * 
 * Displays all invoices for the company/branch as horizontal stacked cards
 * Features:
 * - Full-width horizontal card layout
 * - Search by invoice number or customer name
 * - Filter by status
 * - Quick actions (view, edit, export)
 */
export function InvoicesList({ moduleSlug = 'invoices' }) {
	const [invoices, setInvoices] = useState([]);
	const [filteredInvoices, setFilteredInvoices] = useState([]);
	const [loading, setLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState('');
	const [statusFilter, setStatusFilter] = useState('all');

	useEffect(() => {
		// TODO: Fetch invoices from API
		// For now, showing placeholder data
		const mockInvoices = [
			{
				id: '1',
				invoiceNumber: 'INV/2023/00004',
				clientName: 'Mr & Mrs Hemingway',
				invoiceDate: '2023-07-07',
				total: 8232.75,
				currency: 'GBP',
				status: 'posted',
				dueDate: '2023-08-31',
			},
			{
				id: '2',
				invoiceNumber: 'INV/2023/00003',
				clientName: 'Acme Corporation',
				invoiceDate: '2023-07-05',
				total: 5000.00,
				currency: 'GBP',
				status: 'issued',
				dueDate: '2023-08-05',
			},
			{
				id: '3',
				invoiceNumber: 'INV/2023/00002',
				clientName: 'Design Studio Ltd',
				invoiceDate: '2023-06-28',
				total: 3450.50,
				currency: 'GBP',
				status: 'paid',
				dueDate: '2023-07-28',
			},
			{
				id: '4',
				invoiceNumber: 'INV/2023/00001',
				clientName: 'Tech Solutions Inc',
				invoiceDate: '2023-06-15',
				total: 12750.00,
				currency: 'GBP',
				status: 'draft',
				dueDate: '2023-07-15',
			},
		];
		setInvoices(mockInvoices);
		setLoading(false);
	}, []);

	useEffect(() => {
		let filtered = invoices;

		// Filter by search term
		if (searchTerm.trim()) {
			filtered = filtered.filter(
				(inv) =>
					inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
					inv.clientName.toLowerCase().includes(searchTerm.toLowerCase())
			);
		}

		// Filter by status
		if (statusFilter !== 'all') {
			filtered = filtered.filter((inv) => inv.status === statusFilter);
		}

		setFilteredInvoices(filtered);
	}, [searchTerm, statusFilter, invoices]);

	const getStatusBadge = (status) => {
		const badges = {
			draft: 'bg-gray-100 text-gray-800',
			issued: 'bg-blue-100 text-blue-800',
			approved: 'bg-yellow-100 text-yellow-800',
			posted: 'bg-purple-100 text-purple-800',
			paid: 'bg-green-100 text-green-800',
		};
		return badges[status] || badges.draft;
	};

	const getStatusLabel = (status) => {
		return status.charAt(0).toUpperCase() + status.slice(1);
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-2xl font-bold text-core">Invoices</h1>
					<p className="text-xs text-gray-600">Manage and track all your invoices</p>
				</div>
				<a
					href="create"
					className="bg-core text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-xs"
				>
					+ New Invoice
				</a>
			</div>

			{/* Search & Filter */}
			<div className="flex gap-4">
				<div className="flex-1">
					<input
						type="text"
						placeholder="Search by invoice number or customer name..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
					/>
				</div>
				<select
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
					className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core text-xs"
				>
					<option value="all">All Status</option>
					<option value="draft">Draft</option>
					<option value="issued">Issued</option>
					<option value="approved">Approved</option>
					<option value="posted">Posted</option>
					<option value="paid">Paid</option>
				</select>
			</div>

			{/* Invoice Cards - Horizontal Stacked */}
			{loading ? (
				<div className="text-center py-12">
					<p className="text-xs text-gray-500">Loading invoices...</p>
				</div>
			) : filteredInvoices.length === 0 ? (
				<div className="text-center py-12 border border-dashed rounded-lg">
					<p className="text-xs text-gray-500 mb-4">No invoices found</p>
					<a
						href="create"
						className="text-core hover:text-blue-800 font-medium text-xs"
					>
						Create your first invoice →
					</a>
				</div>
			) : (
				<div className="space-y-3">
					{filteredInvoices.map((invoice) => (
						<InvoiceRow key={invoice.id} invoice={invoice} statusBadge={getStatusBadge} statusLabel={getStatusLabel} />
					))}
				</div>
			)}
		</div>
	);
}

/**
 * Invoice Row Component
 * Displays invoice summary in horizontal card format (full width)
 */
export function InvoiceRow({ invoice, statusBadge, statusLabel }) {
	return (
		<div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200 flex justify-between items-center">
			{/* Left: Invoice Info */}
			<div className="flex-1">
				<div className="flex items-start gap-6">
					{/* Invoice Number & Date */}
					<div className="min-w-fit">
						<h3 className="text-xs font-bold text-core">{invoice.invoiceNumber}</h3>
						<p className="text-xs text-gray-500">{new Date(invoice.invoiceDate).toLocaleDateString()}</p>
					</div>

					{/* Customer Name */}
					<div className="min-w-fit">
						<p className="text-xs text-gray-600 font-medium">Customer</p>
						<p className="text-xs font-semibold text-gray-900">{invoice.clientName}</p>
					</div>

					{/* Due Date */}
					<div className="min-w-fit">
						<p className="text-xs text-gray-600 font-medium">Due</p>
						<p className="text-xs text-gray-900">{new Date(invoice.dueDate).toLocaleDateString()}</p>
					</div>

					{/* Total Amount */}
					<div className="min-w-fit">
						<p className="text-xs text-gray-600 font-medium">Total</p>
						<p className="text-xs font-bold text-core">
							{invoice.currency} {invoice.total.toFixed(2)}
						</p>
					</div>
				</div>
			</div>

			{/* Right: Status & Actions */}
			<div className="flex items-center gap-3 ml-4">
				{/* Status Badge */}
				<span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(invoice.status)} whitespace-nowrap`}>
					{statusLabel(invoice.status)}
				</span>

				{/* Actions */}
				<div className="flex gap-2">
					<Link
						href={`${invoice.id}`}
						className="px-2 py-1 bg-core text-white rounded hover:bg-blue-700 text-xs font-medium transition-colors whitespace-nowrap"
					>
						View
					</Link>
					<Link
						href={`${invoice.id}/edit`}
						className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs font-medium transition-colors whitespace-nowrap"
					>
						Edit
					</Link>
					<Link
						href={`${invoice.id}/export`}
						className="px-2 py-1 bg-amber text-white rounded hover:bg-yellow-600 text-xs font-medium transition-colors whitespace-nowrap"
					>
						Export
					</Link>
				</div>
			</div>
		</div>
	);
}

