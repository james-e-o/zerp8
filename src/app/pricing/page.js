'use client'
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import Link from "next/link";
import supabase from "@/config/supabaseClient";
import LandingHeader from "@/components/landing-header";
import { Spinner } from "@/components/ui/spinner";

const Pricing = () => {
  const [dropState, setDropState] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState("monthly");
  const [plans, setPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.onpointerdown = ({ target }) => {
      if (dropState && target.closest('div#drop-box')) return;
      else if (dropState) {
        setDropState(!dropState);
      }
    };
  });

  // Fetch plans and pricing from database
  useEffect(() => {
    async function fetchPlans() {
      try {
        setIsLoading(true);

        // Fetch all plans except trial
        const { data: plansData, error: plansError } = await supabase
          .from("plans")
          .select("*")
          .neq("key", "trial")
          .order("created_at", { ascending: true });

        if (plansError) throw plansError;

        // Fetch all pricing
        const { data: pricingData, error: pricingError } = await supabase
          .from("core_plan_pricing")
          .select("*");

        if (pricingError) throw pricingError;

        // Combine plans with their pricing
        const combinedPlans = plansData.map((plan) => {
          try {
                  let monthlyPrice = pricingData.find((p) => {
              return Number(p.plan_id) === Number(plan.id) && p.interval === "monthly";
            });

            let annualPrice = pricingData.find((p) => {
              return Number(p.plan_id) === Number(plan.id) && p.interval === "yearly";
            });


            // Safely parse features
            let parsedFeatures = [];
            if (plan.features) {
              try {
                // If it's already an array, use it; otherwise parse as JSON
                parsedFeatures = Array.isArray(plan.features) 
                  ? plan.features 
                  : JSON.parse(plan.features);
              } catch (e) {
                // If parsing fails, treat as empty array
                parsedFeatures = [];
              }
            }

            return {
              key: plan.key,
              title: plan.title,
              description: plan.description,
              features: parsedFeatures,
              badge: plan.badge || "",
              highlight: plan.highlight || false,
              ctaLabel: plan.ctaLabel || "Get started",
              disabled: plan.disabled || false,
              footerNote: plan.footer_note || "",
              // Pricing
              monthlyPrice: monthlyPrice?.cost ?? 0,
              monthlyOriginalPrice: monthlyPrice?.base_price ?? 0,
              annualPrice: annualPrice?.cost ?? 0,
              annualOriginalPrice: annualPrice?.base_price ?? 0,
            };
          } catch (err) {
            console.error(`Error processing plan ${plan.key}:`, err);
            return {
              key: plan.key,
              title: plan.title,
              description: plan.description,
              features: [],
              badge: plan.badge || "",
              highlight: plan.highlight || false,
              ctaLabel: plan.ctaLabel || "Get started",
              disabled: plan.disabled || false,
              footerNote: plan.footer_note || "",
              monthlyPrice: 0,
              monthlyOriginalPrice: 0,
              annualPrice: 0,
              annualOriginalPrice: 0,
            };
          }
        });

        setPlans(combinedPlans);
        setError(null);
      } catch (err) {
        console.error("Error fetching plans:", err);
        setError("Failed to load pricing plans");
      } finally {
        setIsLoading(false);
      }
    }

    fetchPlans();
  }, []);

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-white">
        <Spinner className="size-8 text-core" spinning={true} />
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-y-auto overflow-x-clip z-0 bg-white">
      <LandingHeader />

      {/* Hero Section */}
      <section className="relative bg-linear-to-br from-core via-core/95 to-core/90 text-white overflow-hidden">
        {/* Background Decorations */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Glow layers */}
          <div className="absolute -top-40 -right-40 size-128 bg-army/25 rounded-full blur-[140px]" />
          <div className="absolute -bottom-40 -left-40 size-120 bg-army/15 rounded-full blur-[120px]" />

          {/* Floating boxes */}
          <div className="absolute top-24 left-16 w-6 h-6 border border-white/40 rounded-sm" />
          <div className="absolute top-40 left-32 w-10 h-10 border border-white/35 rounded-md" />
          <div className="absolute top-20 right-40 w-8 h-8 border border-white/30 rounded-sm" />
          <div className="absolute top-56 right-24 w-14 h-14 border border-white/30 rounded-lg" />

          <div className="absolute bottom-32 left-28 w-12 h-12 border border-white/30 rounded-md" />
          <div className="absolute bottom-24 right-36 w-6 h-6 border border-white/35 rounded-sm" />
          <div className="absolute bottom-44 right-16 w-10 h-10 border border-white/30 rounded-md" />

          {/* Bubble dots */}
          <div className="absolute top-52 left-24 w-2 h-2 bg-amber-500/60 rounded-full" />
          <div className="absolute top-60 left-60 w-1.5 h-1.5 bg-amber-500/50 rounded-full" />
          <div className="absolute top-36 right-64 w-2 h-2 bg-amber-500/60 rounded-full" />

          <div className="absolute bottom-40 left-52 w-2 h-2 bg-amber-500/50 rounded-full" />
          <div className="absolute bottom-28 right-52 w-1.5 h-1.5 bg-amber-500/60 rounded-full" />
          <div className="absolute bottom-60 right-24 w-2 h-2 bg-amber-500/50 rounded-full" />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-10 lg:px-12 py-16 md:py-24">
          <div className="text-center">
            <h1 className="font-ClashDisplay text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight mb-4 leading-tight">
              Choose the Right Plan for Your Company
            </h1>

            <p className="text-xs md:text-base text-white/75 mb-10 max-w-xl mx-auto leading-relaxed">
              Flexible pricing designed for businesses of all sizes. Each plan is applied per company, so you can manage multiple businesses with ease.
            </p>

            {/* Steps visual */}
            <div className="flex flex-wrap justify-center items-center gap-4 text-base text-white">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-full bg-white/15">
                  1
                </span>
                <span>Create account</span>
              </div>

              <span className="opacity-50">→</span>

              <div className="flex items-center gap-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-full bg-white/15">
                  2
                </span>
                <span>Create company</span>
              </div>

              <span className="opacity-50">→</span>

              <div className="flex items-center gap-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-full bg-white/15">
                  3
                </span>
                <span>Choose plan</span>
              </div>

              <span className="opacity-50">→</span>

              <div className="flex items-center gap-2">
                <span className="w-7 h-7 flex items-center justify-center rounded-full bg-white/15">
                  4
                </span>
                <span>Run Your Business</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className=" mx-10 px-6 py-16 md:py-20">
        {/* Billing Toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex rounded-full border-2 border-gray-200 bg-gray-50 p-1 gap-1">
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={`px-6 py-2 rounded-full font-semibold text-sm transition-all ${
                billingPeriod === "monthly"
                  ? "bg-core text-white shadow-md"
                  : "text-gray-700 hover:text-core"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod("annual")}
              className={`px-6 py-2 rounded-full font-semibold text-sm transition-all ${
                billingPeriod === "annual"
                  ? "bg-core text-white shadow-md"
                  : "text-gray-700 hover:text-core"
              }`}
            >
              Annual
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
          {error ? (
            <div className="col-span-full text-center py-16">
              <p className="text-red-600 text-lg mb-6">{error}</p>
              <Button onClick={() => window.location.reload()} className="bg-core text-white hover:bg-core/90">
                Retry
              </Button>
            </div>
          ) : (
            plans.map((plan) => (
              <PricingCard
                key={plan.key}
                planKey={plan.key}
                title={plan.title}
                description={plan.description}
                price={
                  billingPeriod === "monthly" ? plan.monthlyPrice : plan.annualPrice
                }
                originalPrice={
                  billingPeriod === "monthly"
                    ? plan.monthlyOriginalPrice
                    : plan.annualOriginalPrice
                }
                period={billingPeriod}
                features={plan.features}
                badge={plan.badge}
                highlight={plan.highlight}
                ctaLabel={plan.ctaLabel}
                disabled={plan.disabled}
                footerNote={plan.footerNote}
              />
            ))
          )}
        </div>

        {/* Bottom CTA Section */}
        <div className="mt-16 text-center">
          <p className="text-gray-600 mb-4">Questions about our plans?</p>
          <Button className="bg-core text-white hover:bg-core/90 px-8 py-3">
            Contact Our Team
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Pricing;


const PricingCard = ({
  planKey,
  title,
  description,
  price,
  originalPrice,
  period,
  features,
  badge,
  highlight = false,
  ctaLabel,
  disabled = false,
  footerNote,
}) => {
  return (
    <div
      className={`relative rounded-2xl h-full transition-all duration-300 ${
        highlight
          ? "bg-linear-to-br from-core to-core/90 text-white shadow-2xl scale-105 md:scale-100"
          : "bg-white border-2 border-gray-100 hover:border-army/20 shadow-lg"
      } ${disabled ? "opacity-75" : ""}`}
    >
      {badge && (
        <div className="absolute top-0 left-0 right-0 rounded-t-2xl bg-linear-to-r from-army to-army/80 text-white text-center py-2 font-semibold text-sm">
          {badge}
        </div>
      )}

      <div className="p-8 pt-12">
        <h3 className={`font-Clash text-2xl font-bold mb-2`}>
          {title}
        </h3>

        <p className={`text-sm mb-6 ${highlight ? "text-white/80" : "text-gray-600"}`}>
          {description}
        </p>

        {/* Price */}
        <div className="mb-6">
          {planKey === "custom" ? (
            <p className="text-lg font-semibold">Contact us</p>
          ) : price !== null ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-bold`}>
                  ${price.toLocaleString()}
                </span>
                <span className="text-sm opacity-70">/mo</span>
              </div>

              {originalPrice && (
                <p className="text-sm line-through opacity-60 mt-2">
                  ${originalPrice.toLocaleString()}
                </p>
              )}
            </>
          ) : (
            <p className="text-lg font-semibold">Contact us</p>
          )}
        </div>

        {/* CTA */}
        {disabled ? (
          <Button
            disabled
            className={`w-full py-3 font-semibold rounded-lg mb-8 opacity-50 cursor-not-allowed ${
              highlight
                ? "bg-white text-core"
                : "bg-gray-900 text-white"
            }`}
          >
            {ctaLabel}
          </Button>
        ) : (
          <Link href="/accounts/signup">
            <Button
              className={`w-full py-3 font-semibold rounded-lg mb-8 transition-all ${
                highlight
                  ? "bg-white text-core hover:bg-gray-50"
                  : "bg-gray-900 text-white hover:bg-gray-800"
              }`}
            >
              {ctaLabel}
            </Button>
          </Link>
        )}


        {/* Features */}
        <ul className="space-y-3 mb-6">
          {features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <Check size={20} className="text-army mt-0.5" />
              <span className="text-sm opacity-90">{feature}</span>
            </li>
          ))}
        </ul>

        {/* Footer note */}
        {footerNote && (
          <p className="text-xs text-center opacity-60">
            {footerNote}
          </p>
        )}
      </div>
    </div>
  );
};







