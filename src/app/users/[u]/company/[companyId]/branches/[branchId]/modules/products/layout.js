import { redirect } from "next/navigation";
import { isModuleEnabledServer } from "@/lib/module-access-server";
import { createSupabaseServerClient } from "@/config/supabaseServer";
import ProductsLayoutClient from "./productsLayoutClient";

export default async function ProductsLayout({ params, children }) {
  const { u, companyId, branchId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!companyId) redirect("/dashboard");

  await supabase.from("branches").select("id").eq("id", branchId).maybeSingle();

  const isProductsEnabled = await isModuleEnabledServer(companyId, "products");

  if (!isProductsEnabled) {
    redirect(`/users/${u}/company/${companyId}/branches/${branchId}/unauthorized?module=products`);
  }

  const navigationItems = [
    { label: "Products", href: "/", icon: "List" },
    { label: "Create Product", href: "create", icon: "Plus" },
    { label: "Categories", href: "categories", icon: "Palette" },
    { label: "Settings", href: "settings", icon: "Settings2" },
  ];

  return (
    <ProductsLayoutClient
      params={params}
      title="Products"
      items={navigationItems}
      basePath={`/users/${u}/company/${companyId}/branches/${branchId}/modules/products`}
    >
      {children}
    </ProductsLayoutClient>
  );
}