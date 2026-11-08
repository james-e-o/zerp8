import { redirect } from "next/navigation";
import { isModuleEnabledServer } from "@/lib/module-access-server";
import { createSupabaseServerClient } from "@/config/supabaseServer";
import PurchasesLayoutClient from "./purchasesLayoutClient";

export default async function PurchasesLayout({ params, children }) {
  const { u, companyId, branchId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!companyId) redirect("/dashboard");

  await supabase.from("branches").select("id").eq("id", branchId).maybeSingle();

  const isPurchasesEnabled = await isModuleEnabledServer(companyId, "purchases");

  if (!isPurchasesEnabled) {
    redirect(`/users/${u}/company/${companyId}/branches/${branchId}/unauthorized?module=purchases`);
  }

  const navigationItems = [
    { key: 'overview', label: 'Overview', icon: 'Home', path: '' },
    { key: 'suppliers', label: 'Suppliers', icon: 'Users', path: '/suppliers' },
    { key: 'orders', label: 'Orders', icon: 'FileText', path: '/orders' },
    { key: 'receipts', label: 'Receipts', icon: 'PackageCheck', path: '/receipts' },
    { key: 'bills', label: 'Bills', icon: 'Receipt', path: '/bills' },
    { key: 'returns', label: 'Returns', icon: 'Undo2', path: '/returns' },
    { key: 'requests', label: 'Requests', icon: 'ClipboardList', path: '/requests' },
    { key: 'settings', label: 'Settings', icon: 'Settings2', path: '/settings' },
  ];

  return (
    <PurchasesLayoutClient
      params={params}
      title="Purchases"
      items={navigationItems}
      basePath={`/users/${u}/company/${companyId}/branches/${branchId}/modules/purchases`}
    >
      {children}
    </PurchasesLayoutClient>
  );
}

