import Link from "next/link";
import PageHeader from "@/components/PageHeader";

export default async function CustomersLayout({ children, params }) {
  const { u, companyId, branchId } = await params;
  const basePath = `/users/${u}/company/${companyId}/branches/${branchId}/modules/sales/customers`;

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Profiles, balances and transaction history."
        action={
          <Link href={`${basePath}/new`} className="rounded-md bg-core px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-core/90">
            New customer
          </Link>
        }
      />
      {children}
    </div>
  );
}
