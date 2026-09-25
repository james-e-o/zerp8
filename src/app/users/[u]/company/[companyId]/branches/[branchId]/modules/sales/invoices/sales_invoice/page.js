'use client'

import { useParams } from 'next/navigation'
import InvoicesList from '@/components/modules/sales/invoices-list'
import { DUMMY_INVOICES } from '@/components/modules/sales/dummy-data'

export default function SalesInvoicesPage() {
	const { u, companyId, branchId } = useParams()
	const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/invoices`
	const invoices = DUMMY_INVOICES.filter((invoice) => invoice.type === 'sales_invoice')

	return <InvoicesList title="Sales Invoices" base={base} invoices={invoices} newHref={`${base}/sales_invoice/new`} newLabel="New Sales Invoice" />
}