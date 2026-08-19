// app/modules/products/layout.jsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Settings2, Plus, List, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductsMenuToggle } from '@/components/products-menu-toggle';
import { ParamsProvider } from '@/components/params-provider';
import { isModuleEnabledServer } from '@/lib/module-access-server';
import { createSupabaseServerClient } from '@/config/supabaseServer';
export default async function ProductsLayout({ params, children }) {

	const { u, companyId, branchId } = await params;
	const supabase = await createSupabaseServerClient();
	const { data: { user } } = await supabase.auth.getUser()

  if (!companyId) redirect('/dashboard');

  // 🧪 Test: Verify SSR Supabase client is working
  const { data: testBranch, error: testError } = await supabase
    .from('branches')
    .select('id')
    .eq('id', branchId)
    .maybeSingle();

 const isProductsEnabled = await isModuleEnabledServer(companyId, 'products');

  // Redirect if not allowed
  if (!isProductsEnabled) {
    redirect(`/users/${u}/company/${companyId}/branches/${branchId}/unauthorized?module=products`);
  }

  const navigationItems = [
    { label: 'Products', href: '/', icon: List },
    { label: 'Create Product', href: 'create', icon: Plus },
    { label: 'Categories', href: 'categories', icon: Palette },
    { label: 'Settings', href: 'settings', icon: Settings2 },
  ];

  return (
    <ParamsProvider params={params}>
      <div className="w-full flex-col font-WixMade flex px-1 h-full overflow-hidden">
        <header className="bg-white border-gray-200 transition-all py-1 items-center duration-300 flex">
         <div>
                    <h1 className="text-xl mx-3 font-bold text-core">Products</h1>
                   
                </div>

          <nav id="products-nav" data-menu-view="expanded" className="flex gap-1.5 overflow-y-auto">
            {navigationItems.map((item) => (
              <Link
                key={item.label}
                href={`/users/${u}/company/${companyId}/branches/${branchId}/modules/products/${item.href}`}
              >
                <Button variant="secondary" className="h-7">
                  <span className="text-xl">
                    <item.icon className="text-indigo-700 font-extrabold" />
                  </span>
                  <span className="menu-label text-sm font-medium">{item.label}</span>
                </Button>
              </Link>
            ))}
          </nav>

          <div>
            <ProductsMenuToggle />
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-2">{children}</div>
        </main>
      </div>
    </ParamsProvider>
  );
}