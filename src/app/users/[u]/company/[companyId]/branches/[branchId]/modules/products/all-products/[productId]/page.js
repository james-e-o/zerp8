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

const getFirstImage = (product) => {
  const images = Array.isArray(product?.images) ? product.images : [];
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
 
const getCurrencyMeta = (currencies, code) => (currencies || []).find((currency) => currency.code === code);

export default function ProductDetailPage() {
  const { u, companyId, branchId, productId } = useParams();
  const { currentBranch } = useContext(BranchContext) || {};
  const { currencies } = useContext(CompanyInfoContext) || {};
  const [product, setProduct] = useState(null);
  const [currencyRows, setCurrencyRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        const { data: variantRows, error: variantError } = await supabase
          .from("product_variants")
          .select("*")
          .eq("product", productId)
          .eq("branch", branchId)
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (variantError) throw variantError;
        const variantIds = (variantRows || []).map((variant) => variant.id);
        const { data: standardPrices, error: priceError } = variantIds.length
          ? await supabase.from("standard_prices").select("id,variant,branch,selling_price,margin_percentage,currency").eq("branch", branchId).in("variant", variantIds)
          : { data: [], error: null };

        if (priceError) throw priceError;
        const { data: currencyData, error: currencyError } = await supabase
          .from("currencies")
          .select("id,code,name,symbol")
          .order("code");

        if (currencyError) throw currencyError;
        setCurrencyRows(currencyData || []);
        setProduct({ ...productRow, product_variants: mergeStandardPrices(variantRows || [], standardPrices || []) });
      }

      setLoading(false);
    };

    loadProduct();
    return () => { isMounted = false; };
  }, [productId]);

  const variants = useMemo(() => Array.isArray(product?.product_variants) ? product.product_variants : [], [product]);
  const branchCurrency = currentBranch?.base_currency || "";
  const availableCurrencies = [...currencyRows, ...(currencies || [])];
  const currencyMeta = getCurrencyMeta(availableCurrencies, branchCurrency);
  const productImage = getFirstImage(product);

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Loading product...
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="space-y-4 p-4">
        <Link href={`/users/${u}/company/${companyId}/branches/${branchId}/modules/products/all-products`}>
          <Button variant="outline" className="mb-4">
            <ArrowLeft className="mr-2 size-4" /> Back to products
          </Button>
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-600">{error || "Product not found."}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/users/${u}/company/${companyId}/branches/${branchId}/modules/products/all-products`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 size-4" /> Back
          </Button>
        </Link>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700">
          {product.status || "active"}
        </span>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-5 lg:grid-cols-[minmax(220px,32%)_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
            {productImage ? (
              <img src={productImage} alt={product.title} className="h-full max-h-[280px] w-full object-cover sm:max-h-[320px] lg:max-h-[360px]" />
            ) : (
              <div className="flex h-full min-h-[220px] items-center justify-center text-gray-400 sm:min-h-[260px] lg:min-h-[300px]">
                <ImageIcon className="size-12" />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-gray-400">Product</p>
                <h1 className="mt-1 text-2xl font-bold text-slate-900">{product.title || "Untitled product"}</h1>
                {product.sub_title ? <p className="mt-1 text-sm text-gray-500">{product.sub_title}</p> : null}
              </div>
              <Button type="button" variant="outline" size="sm" className="h-7 px-2.5 text-[10px]">
                Edit
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-700">
                {product.type === "service" ? "Service" : "Physical"}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-700">
                {variants.length} variant{variants.length === 1 ? "" : "s"}
              </span>
              {product.handle ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-700">
                  {product.handle}
                </span>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-gray-400">
                  <BadgeDollarSign className="size-3.5" /> Base price
                </div>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {variants.length > 0 ? (() => {
                    const code = getVariantCurrencyCode(variants[0], branchCurrency);
                    const parts = getCurrencyParts(getPrimaryPrice(variants[0]), code, getCurrencyMeta(availableCurrencies, code) || currencyMeta);
                    return <><span className="text-core">{parts.symbol}</span>{parts.amount}</>;
                  })() : "Price not set"}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-gray-400">
                  <Layers3 className="size-3.5" /> Variants
                </div>
                <p className="mt-2 text-base font-semibold text-slate-900">{variants.length}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-gray-400">
                  <ShieldCheck className="size-3.5" /> Status
                </div>
                <p className="mt-2 text-base font-semibold text-slate-900">{product.status || "active"}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-gray-400">
                  <Tag className="size-3.5" /> Brand
                </div>
                <p className="mt-2 text-sm font-medium text-slate-800">{product.brand || "—"}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-gray-400">
                  <Package className="size-3.5" /> Product type
                </div>
                <p className="mt-2 text-sm font-medium text-slate-800">{product.type === "service" ? "Service" : "Physical"}</p>
              </div>
            </div>

            {product.description ? (
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-gray-400">Description</p>
                <p className="mt-2 text-sm leading-6 text-gray-700">{product.description}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Warehouse className="size-4 text-slate-500" />
          <h2 className="text-base font-semibold text-slate-900">Variants</h2>
        </div>

        <div className="space-y-3">
          {variants.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-slate-50 p-4 text-sm text-gray-500">
              No variants have been created for this product yet.
            </div>
          ) : (
            variants.map((variant) => {
              const variantPrice = getPrimaryPrice(variant);
              const variantCurrency = getVariantCurrencyCode(variant, branchCurrency);
              const variantCurrencyMeta = getCurrencyMeta(availableCurrencies, variantCurrency) || currencyMeta;
              return (
                <div key={variant.id} className="rounded-xl border border-gray-200 bg-slate-50 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{variant.variant_label || "Default variant"}</p>
                      <p className="text-[11px] text-gray-500">SKU: {variant.sku || "—"}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                      {(() => {
                        const priceParts = getCurrencyParts(variantPrice, variantCurrency, variantCurrencyMeta);
                        const costParts = getCurrencyParts(variant.cost_price || 0, variantCurrency, variantCurrencyMeta);
                        return <>
                          <span className="rounded-full bg-white px-2 py-1">Price: <span className="text-core">{priceParts.symbol}</span>{priceParts.amount}</span>
                          <span className="rounded-full bg-white px-2 py-1">Cost: <span className="text-core">{costParts.symbol}</span>{costParts.amount}</span>
                        </>;
                      })()}
                      <span className="rounded-full bg-white px-2 py-1">Margin: {variant.margin_percentage ?? "—"}%</span>
                      <span className="rounded-full bg-white px-2 py-1">Active: {variant.is_active ? "Yes" : "No"}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
