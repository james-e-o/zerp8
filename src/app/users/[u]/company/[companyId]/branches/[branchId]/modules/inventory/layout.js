import { redirect } from "next/navigation";
import { getModuleAccessLevelServer } from "@/lib/module-access-server";
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

  // "full"      -> normal use
  // "read_only" -> subscription no longer includes Inventory but the company has history here:
  //                pages load and a banner explains
  // "none"      -> never had the module and has no data here: send them to subscriptions
  //                instead of showing a module they should not see
  const accessLevel = await getModuleAccessLevelServer(companyId, "inventory");

  if (accessLevel === "none") {
    redirect(`/users/${u}/company/${companyId}/subscriptions`);
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
    { key: 'bill-differences', label: 'Bill differences', icon: 'FileDiff', path: '/bill-differences' },
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
      accessLevel={accessLevel}
    >
      {children}
    </InventoryLayoutClient>
  );
}