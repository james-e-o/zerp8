import { redirect } from "next/navigation";
import { isModuleEnabledServer } from "@/lib/module-access-server";
import { createSupabaseServerClient } from "@/config/supabaseServer";
import InvoicesLayoutClient from "./invoicesLayoutClient";

export default async function InvoicesLayout({ params, children }) {
  const { u, companyId, branchId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!companyId) redirect("/dashboard");

  await supabase.from("branches").select("id").eq("id", branchId).maybeSingle();

  const isInvoicesEnabled = await isModuleEnabledServer(companyId, "invoices");

  if (!isInvoicesEnabled) {
    redirect(`/users/${u}/company/${companyId}/branches/${branchId}/unauthorized?module=invoices`);
  }

  const navigationItems = [
    { label: "Overview", href: "/", icon: "FileStack" },
    { label: "Create Invoice", href: "create", icon: "FilePlus" },
    { label: "Templates", href: "templates", icon: "LayoutTemplate" },
    { label: "Settings", href: "settings", icon: "Settings2" },
  ];

  return (
    <InvoicesLayoutClient
      params={params}
      title="Invoices"
      items={navigationItems}
      basePath={`/users/${u}/company/${companyId}/branches/${branchId}/modules/invoices`}
    >
      {children}
    </InvoicesLayoutClient>
  );
}
