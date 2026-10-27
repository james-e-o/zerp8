import { redirect } from "next/navigation";
import { isModuleEnabledServer } from "@/lib/module-access-server";
import { createSupabaseServerClient } from "@/config/supabaseServer";
import InventoryLayoutClient from "./inventoryLayoutClient";

export default async function InventoryLayout({ params, children }) {
  const { u, companyId, branchId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!companyId) redirect("/dashboard");

  const { data: branchData } = await supabase
    .from("branches")
    .select("*, branch_info(*)")
    .eq("id", branchId)
    .maybeSingle();

  const { data: companyData } = await supabase
    .from("companies")
    .select("id, name, slug, owner")
    .eq("id", companyId)
    .single();

  const isInventoryEnabled = await isModuleEnabledServer(companyId, "inventory");

  if (!isInventoryEnabled) {
    redirect(`/users/${u}/company/${companyId}/branches/${branchId}/unauthorized?module=inventory`);
  }

  const infoRow = Array.isArray(branchData?.branch_info)
    ? branchData.branch_info[0]
    : branchData?.branch_info;

  const currentBranch = branchData ? {
    ...branchData,
    ...infoRow,
    branch_info: undefined,
  } : null;

  const profile = user ? { email: user.email, id: user.id } : null;

  const navigationItems = [
    { key: 'overview', label: 'Overview', icon: 'Home', path: '' },
    { key: 'receipts', label: 'Receipts', icon: 'PackagePlus', path: '/receipts' },
    { key: 'stock', label: 'Stock', icon: 'Boxes', path: '/stock' },
    { key: 'outgoing', label: 'Outgoing', icon: 'PackageMinus', path: '/outgoing' },
    { key: 'movements', label: 'Movements', icon: 'ArrowLeftRight', path: '/movements' },
    { key: 'adjustments', label: 'Adjustments', icon: 'SlidersHorizontal', path: '/adjustments' },
    { key: 'transfers', label: 'Transfers', icon: 'Truck', path: '/transfers' },
    { key: 'warehouses', label: 'Warehouses', icon: 'Warehouse', path: '/warehouses' },
    { key: 'settings', label: 'Settings', icon: 'Settings2', path: '/settings' },
  ];

  return (
    <InventoryLayoutClient
      params={params}
      title="Inventory"
      items={navigationItems}
      basePath={`/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory`}
      profile={profile}
      company={companyData}
      branch={currentBranch}
    >
      {children}
    </InventoryLayoutClient>
  );
}
