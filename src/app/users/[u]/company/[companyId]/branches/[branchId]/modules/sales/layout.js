import { redirect } from "next/navigation";
import { isModuleEnabledServer } from "@/lib/module-access-server";
import { createSupabaseServerClient } from "@/config/supabaseServer";
import SalesLayoutClient from "./salesLayoutClient";

export default async function SalesLayout({ params, children }) {
  const { u, companyId, branchId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!companyId) redirect("/dashboard");

  await supabase.from("branches").select("id").eq("id", branchId).maybeSingle();

  const isSalesEnabled = await isModuleEnabledServer(companyId, "sales");

  if (!isSalesEnabled) {
    redirect(`/users/${u}/company/${companyId}/branches/${branchId}/unauthorized?module=sales`);
  }

  const navigationItems = [
    { key: 'overview', label: 'Overview', icon: 'Home', path: '' },
    { key: 'customers', label: 'Customers', icon: 'Users', path: '/customers' },
    { key: 'quotations', label: 'Quotations', icon: 'FileText', path: '/quotations' },
    { key: 'orders', label: 'Orders', icon: 'ShoppingCart', path: '/orders' },
    { key: 'deliveries', label: 'Deliveries', icon: 'Truck', path: '/deliveries' },
    { key: 'invoices', label: 'Invoices', icon: 'Receipt', path: '/invoices' },
    { key: 'returns', label: 'Returns', icon: 'Undo2', path: '/returns' },
    { key: 'pos', label: 'POS', icon: 'CreditCard', path: '/pos' },
    { key: 'settings', label: 'Settings', icon: 'Settings2', path: '/settings' },
  ];

  return (
    <SalesLayoutClient
      params={params}
      title="Sales"
      items={navigationItems}
      basePath={`/users/${u}/company/${companyId}/branches/${branchId}/modules/sales`}
    >
      {children}
    </SalesLayoutClient>
  );
}

