"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { BranchContext } from "@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext";
import supabase from "@/config/supabaseClient";

const getFirstImage = (product) => {
  const images = Array.isArray(product.images) ? product.images : [];
  const primaryImage = images.find((image) => image.is_primary) || images[0];
  return primaryImage?.url || primaryImage?.src || primaryImage?.image_url || null;
};

export default function AllProductsPage() {
  const { u, companyId, branchId } = useParams();
  const { currentBranch } = useContext(BranchContext) || {};
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadProducts = async () => {
      if (!branchId && !currentBranch?.id) return;

      setIsLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("branch", currentBranch?.id || branchId)
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (error) {
        console.error("Failed to load products:", error);
        setErrorMessage("Failed to load products.");
        setProducts([]);
      } else {
        setProducts(data || []);
      }
      setIsLoading(false);
    };

    loadProducts();
    return () => { isMounted = false; };
  }, [branchId, currentBranch?.id]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) =>
      [product.title, product.handle, product.sub_title]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [products, search]);

  const productPath = (productId) =>
    `/users/${u}/company/${companyId}/branches/${branchId}/modules/products/${productId}`;

  return (
    <div className="space-y-4 px-1 font-WixMade">

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products..." className="h-8 pl-8 text-xs" />
      </div>

      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex h-24 items-center justify-center gap-2 text-xs text-gray-500">
            <Loader2 className="size-4 animate-spin" /> Loading products...
          </div>
        ) : errorMessage ? (
          <div className="p-5 text-center text-xs text-red-600">{errorMessage}</div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-5 text-center text-xs text-gray-500">No products found.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredProducts.map((product) => {
              const imageUrl = getFirstImage(product);
              return (
                <Link
                  key={product.id}
                  href={productPath(product.id)}
                  className="flex min-h-[55px] items-center gap-3 px-3 py-1.5 transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-gray-200 bg-gray-50">
                    {imageUrl ? (
                      <img src={imageUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="text-[9px] text-gray-400">No image</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-gray-900">{product.title || "Untitled product"}</p>
                    <p className="truncate text-[10px] text-gray-500">{product.sub_title || product.handle || "No additional details"}</p>
                  </div>
                  <div className="hidden shrink-0 text-right text-[10px] text-gray-500 sm:block">
                    <p>{product.type || "Product"}</p>
                    <p>{product.status || "Active"}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
