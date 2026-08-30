import { redirect } from "next/navigation";
import { isModuleEnabledServer } from "@/lib/module-access-server";
import { createSupabaseServerClient } from "@/config/supabaseServer";
import InventoryLayoutClient from "./inventoryLayoutClient";

export default async function InventoryLayout({ params, children }) {
  const { u, companyId, branchId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!companyId) redirect("/dashboard");

  await supabase.from("branches").select("id").eq("id", branchId).maybeSingle();

  const isInventoryEnabled = await isModuleEnabledServer(companyId, "inventory");

  if (!isInventoryEnabled) {
    redirect(`/users/${u}/company/${companyId}/branches/${branchId}/unauthorized?module=inventory`);
  }

  const navigationItems = [
    { key: 'overview', label: 'Overview', icon: 'Home', path: '' },
    { key: 'stock', label: 'Stock', icon: 'Boxes', path: '/stock' },
    { key: 'movements', label: 'Movements', icon: 'ArrowLeftRight', path: '/movements' },
    { key: 'adjustments', label: 'Adjustments', icon: 'SlidersHorizontal', path: '/adjustments' },
    { key: 'warehouses', label: 'Warehouses', icon: 'Warehouse', path: '/warehouses' },
    { key: 'transfers', label: 'Transfers', icon: 'Truck', path: '/transfers' },
    { key: 'counts', label: 'Counts', icon: 'ClipboardCheck', path: '/counts' },
    { key: 'reserved', label: 'Reserved', icon: 'Lock', path: '/reserved' },
    { key: 'settings', label: 'Settings', icon: 'Settings2', path: '/settings' },
  ];

  return (
    <InventoryLayoutClient
      params={params}
      title="Inventory"
      items={navigationItems}
      basePath={`/users/${u}/company/${companyId}/branches/${branchId}/modules/inventory`}
    >
      {children}
    </InventoryLayoutClient>
  );
}


