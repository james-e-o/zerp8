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
    { label: "Overview", path: "", icon: "Home" },
    { label: "All Products", path: "/all-products", icon: "PackageSearch" },
    { label: "Create Product", path: "/create", icon: "Plus" },
    { label: "Categories", path: "/categories", icon: "FolderTree" },
    { label: "Brands", path: "/brands", icon: "Tags" },
    { label: "Attributes", path: "/attributes", icon: "ListFilter" },
    { label: "Pricing", path: "/pricing", icon: "BadgeDollarSign" },
    { label: "Settings", path: "/settings", icon: "Settings2" },
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