"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  BadgeDollarSign,
  Image as ImageIcon,
  Loader2,
  Package,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BranchContext } from "@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext";
import supabase from "@/config/supabaseClient";

const formatCurrency = (value, currencyCode = "") => {
  const numeric = Number(value || 0);

  if (!currencyCode) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(numeric);
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(numeric);
  } catch {
    return `${currencyCode} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(numeric)}`;
  }
};

const getFirstImage = (product) => {
  const images = Array.isArray(product.images) ? product.images : [];
  const primaryImage = images.find((image) => image.is_primary) || images[0];
  return primaryImage?.url || primaryImage?.src || primaryImage?.image_url || null;
};

const getProductTypeLabel = (type) => (type === "service" ? "Service" : "Physical");

const getPriceRange = (variants = [], currencyCode = "") => {
  const prices = variants
    .map((variant) => Number(variant?.standard_prices?.[0]?.selling_price ?? variant?.selling_price ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (prices.length === 0) return "Price not set";

  const min = Math.min(...prices);
  const max = Math.max(...prices);

  return min === max
    ? formatCurrency(min, currencyCode)
    : `${formatCurrency(min, currencyCode)} – ${formatCurrency(max, currencyCode)}`;
};

export default function AllProductsPage() {
  const { u, companyId, branchId } = useParams();
  const { currentBranch } = useContext(BranchContext) || {};

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const branchIdValue = currentBranch?.id || branchId;

  useEffect(() => {
    let isMounted = true;

    const loadProducts = async () => {
      if (!branchIdValue) return;

      setIsLoading(true);
      setErrorMessage("");

      const { data: productRows, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("company", companyId)
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (productError) {
        console.error("Failed to load products:", productError);
        setErrorMessage("Failed to load products.");
        setProducts([]);
        setIsLoading(false);
        return;
      }

      const productIds = (productRows || []).map((product) => product.id);
      let variantRows = [];

      if (productIds.length > 0) {
        const { data, error } = await supabase
          .from("product_variants")
          .select("*, standard_prices(*)")
          .in("product", productIds)
          .eq("standard_prices.branch", branchIdValue)
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Failed to load product variants:", error);
        } else {
          variantRows = data || [];
        }
      }

      const productMap = new Map();
      for (const variant of variantRows) {
        const field = variant.product;
        if (!productMap.has(field)) productMap.set(field, []);
        productMap.get(field).push(variant);
      }

      const mergedProducts = (productRows || []).map((product) => ({
        ...product,
        product_variants: productMap.get(product.id) || [],
      }));

      if (!isMounted) return;
      setProducts(mergedProducts);
      setIsLoading(false);
    };

    loadProducts();
    return () => { isMounted = false; };
  }, [branchIdValue]);

  const tabs = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "inactive", label: "Inactive" },
    { key: "physical", label: "Physical" },
    { key: "service", label: "Service" },
  ];

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const status = product.status || "active";
      const type = product.type || "physical";

      const matchesTab =
        tab === "all" ||
        (tab === "active" && status === "active") ||
        (tab === "inactive" && status !== "active") ||
        (tab === "physical" && type === "physical") ||
        (tab === "service" && type === "service");

      const matchesSearch =
        !query ||
        [product.title, product.handle, product.sub_title, product.description]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      return matchesTab && matchesSearch;
    });
  }, [products, search, tab]);

  return (
    <div className="space-y-6 p text-xs">
      <div className="border border-border rounded-sm bg-card p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products, SKU, or handle"
              className="h-8 pl-8 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="inline-flex items-center gap-1 rounded-sm border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
              <SlidersHorizontal className="size-3.5" /> Filters
            </button>

            {tabs.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`rounded-sm px-3 py-1.5 text-[11px] font-medium transition ${
                  tab === item.key ? "bg-core_light text-core" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center gap-2 border border-dashed border-border bg-card text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading products...
        </div>
      ) : errorMessage ? (
        <div className="border border-red-200 bg-red-50 p-4 text-xs text-red-600">{errorMessage}</div>
      ) : filteredProducts.length === 0 ? (
        <div className="border border-dashed border-border bg-card p-12 text-center text-xs text-muted-foreground">
          No products match this view.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {filteredProducts.map((product) => {
            const imageUrl = getFirstImage(product);
            const variants = Array.isArray(product.product_variants) ? product.product_variants : [];
            const branchCurrency = currentBranch?.base_currency || "";
            const priceRange = getPriceRange(variants, branchCurrency);
            const firstVariant = variants[0];
            const primaryPrice = firstVariant?.standard_prices?.[0]?.selling_price ?? firstVariant?.selling_price ?? 0;

            return (
              <Link
                key={product.id}
                href={`/users/${u}/company/${companyId}/branches/${branchId}/modules/products/all-products/${product.id}`}
                className="group block overflow-hidden rounded-sm border border-border bg-card transition hover:border-core/50"
              >
                <div className="relative h-32 bg-muted">
                  {imageUrl ? (
                    <img src={imageUrl} alt={product.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <ImageIcon className="size-8" />
                    </div>
                  )}

                  <div className="absolute right-2 top-2 rounded-sm border border-border bg-card/90 px-2 py-1 text-[10px] font-medium text-foreground">
                    {getProductTypeLabel(product.type)}
                  </div>
                </div>

                <div className="space-y-2 p-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{product.title || "Untitled product"}</p>
                      {product.sub_title ? <p className="truncate text-[10px] text-muted-foreground">{product.sub_title}</p> : null}
                    </div>
                    <span className="inline-flex rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {product.status || "active"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Package className="size-3" /> {variants.length} var
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium text-foreground">
                      <BadgeDollarSign className="size-3" /> {primaryPrice ? formatCurrency(primaryPrice, branchCurrency) : priceRange}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
