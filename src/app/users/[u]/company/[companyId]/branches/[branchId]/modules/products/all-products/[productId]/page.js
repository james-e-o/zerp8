"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BadgeDollarSign,
  Image as ImageIcon,
  Package,
  Tag,
  Warehouse,
  Layers3,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { CompanyInfoContext } from "@/app/users/[u]/company/[companyId]/companyInfoProvider";
import { BranchContext } from "@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext";
import supabase from "@/config/supabaseClient";

const formatCurrency = (value, currencyCode = "", currencyMeta) => {
  const numeric = Number(value || 0);
  const symbol = currencyMeta?.symbol || currencyMeta?.symbol_native || "";
  const formattedNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(numeric);
  return symbol ? `${symbol}${formattedNumber}` : `${currencyCode} ${formattedNumber}`.trim();
};

const getCurrencyParts = (value, currencyCode = "", currencyMeta) => ({
  symbol: currencyMeta?.symbol || currencyMeta?.symbol_native || currencyCode || "",
  amount: new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(value || 0)),
});

const getFirstImage = (source) => {
  const images = Array.isArray(source?.images) ? source.images : [];
  const primaryImage = images.find((image) => image.is_primary) || images[0];
  return primaryImage?.url || primaryImage?.src || primaryImage?.image_url || null;
};

const getPrimaryPrice = (variant) => Number(variant?.selling_price || 0);

const getPrimaryStandardPrice = (variant) => variant?.standard_price_rows?.[0] || null;

const getVariantCurrencyCode = (variant, branchCurrency) => (
  getPrimaryStandardPrice(variant)?.currency || variant?.currency || branchCurrency || ""
);

const mergeStandardPrices = (variants, priceRows) => variants.map((variant) => {
  const price = (priceRows || []).find((row) => row.variant === variant.id);
  return price ? {
    ...variant,
    selling_price: price.selling_price,
    margin_percentage: price.margin_percentage,
    currency: price.currency,
    standard_price_rows: [price],
  } : variant;
});

// Cost price moved out of product_variants and into product_cost_estimates
// (one row per variant, company-wide - see the branch-access/cost-estimate
// migration). This merges that row's estimate back onto the variant object
// the UI already expects, under the same cost_price field name, so nothing
// below this point needs to know the data moved.
const mergeCostEstimates = (variants, costRows) => variants.map((variant) => {
  const cost = (costRows || []).find((row) => row.variant_id === variant.id);
  return cost ? {
    ...variant,
    cost_price: cost.cost_price,
    cost_currency: cost.cost_currency,
  } : variant;
});

const getCurrencyMeta = (currencies, code) => (currencies || []).find((currency) => currency.code === code);

export default function ProductDetailPage() {
  const { u, companyId, branchId, productId } = useParams();
  const { currentBranch } = useContext(BranchContext) || {};
  const { currencies } = useContext(CompanyInfoContext) || {};
  const [product, setProduct] = useState(null);
  const [currencyRows, setCurrencyRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadProduct = async () => {
      if (!productId) return;

      setLoading(true);
      setError("");

      const { data: productRow, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

      if (!isMounted) return;

      if (productError) {
        console.error("Failed to load product:", productError);
        setError("Product not found or could not be loaded.");
        setProduct(null);
      } else {
        // product_variants is company-wide now - it has no branch column
        // to filter on (dropped in the branch-access migration). Which
        // variants a branch can see is enforced by RLS via the product's
        // access_scope / product_branch_access, not by a client-side
        // .eq("branch", ...) filter, so that filter is removed here.
        const { data: variantRows, error: variantError } = await supabase
          .from("product_variants")
          .select("*")
          .eq("product", productId)
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (variantError) throw variantError;
        const variantIds = (variantRows || []).map((variant) => variant.id);

        const { data: standardPrices, error: priceError } = variantIds.length
          ? await supabase.from("standard_prices").select("id,variant,branch,selling_price,margin_percentage,currency").eq("branch", branchId).in("variant", variantIds)
          : { data: [], error: null };

        if (priceError) throw priceError;

        const { data: costEstimates, error: costError } = variantIds.length
          ? await supabase.from("product_cost_estimates").select("variant_id,cost_price,cost_currency").in("variant_id", variantIds)
          : { data: [], error: null };

        if (costError) throw costError;

        const { data: currencyData, error: currencyError } = await supabase
          .from("currencies")
          .select("id,code,name,symbol")
          .order("code");

        if (currencyError) throw currencyError;
        setCurrencyRows(currencyData || []);

        const mergedVariants = mergeCostEstimates(
          mergeStandardPrices(variantRows || [], standardPrices || []),
          costEstimates || []
        );
        setProduct({ ...productRow, product_variants: mergedVariants });
        setSelectedVariantId(mergedVariants[0]?.id || null);
      }

      setLoading(false);
    };

    loadProduct();
    return () => { isMounted = false; };
  }, [productId, branchId]);

  const variants = useMemo(() => Array.isArray(product?.product_variants) ? product.product_variants : [], [product]);
  const branchCurrency = currentBranch?.base_currency || "";
  const availableCurrencies = [...currencyRows, ...(currencies || [])];
  const currencyMeta = getCurrencyMeta(availableCurrencies, branchCurrency);
  const productImage = getFirstImage(product);

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) || variants[0] || null,
    [variants, selectedVariantId]
  );
  // A variant's own image (if it has one) takes over the hero image when
  // it's selected; falls back to the product's own image when the variant
  // has none of its own.
  const displayedImage = getFirstImage(selectedVariant) || productImage;

  if (loading) {
    return (
      <div className="space-y-6 p text-xs">
        <div className="border border-dashed border-border bg-card p-8 text-center text-muted-foreground">
          Loading product...
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="space-y-6 p text-xs">
        <Link href={`/users/${u}/company/${companyId}/branches/${branchId}/modules/products/all-products`}>
          <Button variant="outline" size="sm" className="mb-4 text-xs">
            <ArrowLeft className="mr-2 size-3.5" /> Back to products
          </Button>
        </Link>
        <div className="border border-red-200 bg-red-50 p-4 text-xs text-red-600">{error || "Product not found."}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p text-xs">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/users/${u}/company/${companyId}/branches/${branchId}/modules/products/all-products`}>
          <Button variant="outline" size="sm" className="text-xs">
            <ArrowLeft className="mr-2 size-3.5" /> Back
          </Button>
        </Link>
        <span className="rounded-sm bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
          {product.status || "active"}
        </span>
      </div>

      <div className="border border-border rounded-sm bg-card p-4">
        <div className="grid gap-5 lg:grid-cols-[minmax(220px,32%)_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-sm border border-border bg-muted">
            {displayedImage ? (
              <img src={displayedImage} alt={product.title} className="h-full max-h-[280px] w-full object-cover sm:max-h-[320px] lg:max-h-[360px]" />
            ) : (
              <div className="flex h-full min-h-[220px] items-center justify-center text-muted-foreground sm:min-h-[260px] lg:min-h-[300px]">
                <ImageIcon className="size-12" />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground">Product</p>
                <h1 className="mt-1 text-lg font-semibold text-foreground">{product.title || "Untitled product"}</h1>
                {product.sub_title ? <p className="mt-1 text-xs text-muted-foreground">{product.sub_title}</p> : null}
              </div>
              <Button type="button" variant="outline" size="sm" className="h-7 px-2.5 text-[11px]">
                Edit
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-sm bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
                {product.type === "service" ? "Service" : "Physical"}
              </span>
              <span className="rounded-sm bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
                {variants.length} variant{variants.length === 1 ? "" : "s"}
              </span>
              {product.handle ? (
                <span className="rounded-sm bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
                  {product.handle}
                </span>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="border border-border rounded-sm bg-muted p-3">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <BadgeDollarSign className="size-3.5" /> Base price
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {variants.length > 0 ? (() => {
                    const code = getVariantCurrencyCode(variants[0], branchCurrency);
                    const parts = getCurrencyParts(getPrimaryPrice(variants[0]), code, getCurrencyMeta(availableCurrencies, code) || currencyMeta);
                    return <><span className="text-core">{parts.symbol}</span>{parts.amount}</>;
                  })() : "Price not set"}
                </p>
              </div>
              <div className="border border-border rounded-sm bg-muted p-3">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Layers3 className="size-3.5" /> Variants
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">{variants.length}</p>
              </div>
              <div className="border border-border rounded-sm bg-muted p-3">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <ShieldCheck className="size-3.5" /> Status
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">{product.status || "active"}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="border border-border rounded-sm bg-card p-3">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Tag className="size-3.5" /> Brand
                </div>
                <p className="mt-2 text-xs font-medium text-foreground">{product.brand || "—"}</p>
              </div>
              <div className="border border-border rounded-sm bg-card p-3">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Package className="size-3.5" /> Product type
                </div>
                <p className="mt-2 text-xs font-medium text-foreground">{product.type === "service" ? "Service" : "Physical"}</p>
              </div>
            </div>

            {product.description ? (
              <div className="border border-border rounded-sm bg-card p-3">
                <p className="text-[10px] font-medium text-muted-foreground">Description</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{product.description}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="border border-border rounded-sm bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Warehouse className="size-3.5 text-muted-foreground" />
          <h2 className="text-xs font-semibold text-foreground">Variants</h2>
        </div>

        <div className="space-y-3">
          {variants.length === 0 ? (
            <div className="border border-dashed border-border rounded-sm bg-muted p-4 text-xs text-muted-foreground">
              No variants have been created for this product yet.
            </div>
          ) : (
            variants.map((variant) => {
              const variantPrice = getPrimaryPrice(variant);
              const variantCurrency = getVariantCurrencyCode(variant, branchCurrency);
              const variantCurrencyMeta = getCurrencyMeta(availableCurrencies, variantCurrency) || currencyMeta;
              const costCurrency = variant.cost_currency || variantCurrency;
              const costCurrencyMeta = getCurrencyMeta(availableCurrencies, costCurrency) || currencyMeta;
              const isSelected = selectedVariant?.id === variant.id;
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => setSelectedVariantId(variant.id)}
                  className={`w-full rounded-sm border p-3 text-left transition-colors ${
                    isSelected
                      ? "border-core bg-core_light ring-1 ring-core"
                      : "border-border bg-muted hover:bg-card"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold text-foreground">{variant.variant_label || "Default variant"}</p>
                      <p className="text-[10px] text-muted-foreground">SKU: {variant.sku || "—"}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                      {(() => {
                        const priceParts = getCurrencyParts(variantPrice, variantCurrency, variantCurrencyMeta);
                        const costParts = getCurrencyParts(variant.cost_price || 0, costCurrency, costCurrencyMeta);
                        return <>
                          <span className="rounded-sm bg-card px-2 py-1">Price: <span className="text-core">{priceParts.symbol}</span>{priceParts.amount}</span>
                          <span className="rounded-sm bg-card px-2 py-1">Cost (est.): <span className="text-core">{costParts.symbol}</span>{costParts.amount}</span>
                        </>;
                      })()}
                      <span className="rounded-sm bg-card px-2 py-1">Margin: {variant.margin_percentage ?? "—"}%</span>
                      <span className="rounded-sm bg-card px-2 py-1">Active: {variant.is_active ? "Yes" : "No"}</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}