'use client'

import { useParams } from 'next/navigation'
import InvoicesList from '@/components/modules/sales/invoices-list'
import { DUMMY_INVOICES } from '@/components/modules/sales/dummy-data'

export default function ProformaInvoicesPage() {
	const { u, companyId, branchId } = useParams()
	const base = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/invoices`
	const invoices = DUMMY_INVOICES.filter((invoice) => invoice.type === 'proforma')

	return <InvoicesList title="Proforma Invoices" base={base} invoices={invoices} newHref={`${base}/proforma/new`} newLabel="New Proforma Invoice" />
}