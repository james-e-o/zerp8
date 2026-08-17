"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { startFreeTrial } from "@/lib/start-free-trial"
import supabase from "@/config/supabaseClient"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"

export default function PlansPage() {
  const router = useRouter()
  const params = useParams()
  const { u, companyId, companySlug } = params
  const companyParam = companyId ?? companySlug
  const [billingPeriod, setBillingPeriod] = useState("monthly")
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [selectedPlanData, setSelectedPlanData] = useState(null)
  const [checkoutStep, setCheckoutStep] = useState(1)
  const [trialLoading, setTrialLoading] = useState(false)
  const [bachsProducts, setBachsProducts] = useState([])
  const [bachsLoading, setBachsLoading] = useState(true)
  const [bachsError, setBachsError] = useState(null)
  const [billingInfo, setBillingInfo] = useState({
    email: "",
    name: "",
    address: "",
  })
  const [plans, setPlans] = useState([])

  useEffect(() => {
    async function loadPlans() {
      const { data, error } = await supabase.from("plans").select("*").neq("bachs_product_id", "trial").order("created_at", { ascending: true })

      if (!error) {
        const mapped = (data || []).map((plan) => ({
          key: plan.key || plan.bachs_product_id || plan.id,
          title: plan.name || plan.title || "Plan",
          description: plan.description || "",
          badge: plan.badge || "",
          highlight: plan.highlight || false,
          disabled: plan.disabled || !plan.active,
          ctaLabel: plan.cta_label || "Get started",
          monthlyPrice: Number(plan.price ?? 0),
          annualPrice: Number(plan.price ?? 0),
          monthlyOriginalPrice: Number(plan.price ?? 0),
          annualOriginalPrice: Number(plan.price ?? 0),
        }))

        setPlans(mapped)
      }
    }

    loadPlans()
  }, [])

  useEffect(() => {
    async function fetchBachsProducts() {
      setBachsLoading(true)
      setBachsError(null)

      try {
        const response = await fetch("/api/bachs/products")
        const data = await response.json()

        if (!response.ok) {
          setBachsError(data?.error || "Unable to load Bax products.")
          setBachsProducts([])
          return
        }

        setBachsProducts(data.items || [])
      } catch (error) {
        console.error("Error fetching Bax products:", error)
        setBachsError(error?.message || "Unable to load Bax products.")
        setBachsProducts([])
      } finally {
        setBachsLoading(false)
      }
    }

    fetchBachsProducts()
  }, [])

  const handleSelectPlan = (plan) => {
    setSelectedPlanData(plan)
    setCheckoutStep(1)
    setBillingInfo({ email: "", name: "", address: "" })
    setCheckoutOpen(true)
  }

  const handleBillingChange = (field, value) => {
    setBillingInfo((prev) => ({ ...prev, [field]: value }))
  }

  const handleCheckoutSubmit = (e) => {
    e.preventDefault()
    setCheckoutStep(2)
  }

  const handlePayment = (e) => {
    e.preventDefault()
    console.log("Processing payment with Paystack:", {
      email: billingInfo.email,
      amount: billingPeriod === "annual" ? selectedPlanData.annualPrice : selectedPlanData.monthlyPrice,
      plan: selectedPlanData.title,
    })
  }

  const handleStartFreeTrial = async () => {
    setTrialLoading(true)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setTrialLoading(false)
        return
      }

      const result = await startFreeTrial(companyId)

      if (result.success) {
        const destination = `/users/${u}/company/${companyParam}`
        router.refresh()
        window.location.assign(destination)
      } else {
        setTrialLoading(false)
      }
    } catch (error) {
      console.error("Error starting free trial:", error)
      setTrialLoading(false)
    }
  }

  return (
    <div className="bg-white">
      <div className="flex justify-start mb-8">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        {plans.map((plan) => {
          const currentPrice = billingPeriod === "annual" ? plan.annualPrice : plan.monthlyPrice
          const currentOriginalPrice =
            billingPeriod === "annual" ? plan.annualOriginalPrice : plan.monthlyOriginalPrice

          return (
            <div
              key={plan.key}
              className={`relative rounded-2xl h-full transition-all duration-300 ${
                plan.highlight
                  ? "bg-linear-to-br from-core to-core/90 text-white shadow-2xl scale-105 md:scale-100"
                  : "bg-white border-2 border-gray-100 hover:border-core/20 shadow-lg"
              } ${plan.disabled ? "opacity-75" : ""}`}
            >
              {plan.badge && (
                <div className="absolute top-0 left-0 right-0 rounded-t-2xl bg-linear-to-r from-slate-900 to-slate-800 text-white text-center py-2 font-semibold text-sm">
                  {plan.badge}
                </div>
              )}

              <div className="p-8 pt-12">
                <h3 className="font-Clash text-2xl font-bold mb-2">{plan.title}</h3>

                <p className={`text-sm mb-6 ${plan.highlight ? "text-white/80" : "text-gray-600"}`}>
                  {plan.description}
                </p>

                <div className="mb-6">
                  {plan.key === "custom" ? (
                    <p className="text-lg font-semibold">Contact us</p>
                  ) : currentPrice !== null ? (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold">${currentPrice.toLocaleString()}</span>
                        <span className="text-sm opacity-70">/mo</span>
                      </div>

                      {currentOriginalPrice && (
                        <p className="text-sm line-through opacity-60 mt-2">
                          ${currentOriginalPrice.toLocaleString()}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-lg font-semibold">Contact us</p>
                  )}
                </div>

                {plan.disabled ? (
                  <Button
                    disabled
                    className={`w-full py-3 font-semibold rounded-lg opacity-50 cursor-not-allowed ${
                      plan.highlight ? "bg-white text-core" : "bg-gray-900 text-white"
                    }`}
                  >
                    {plan.ctaLabel}
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleSelectPlan(plan)}
                    className={`w-full py-3 font-semibold rounded-lg transition-all ${
                      plan.highlight
                        ? "bg-white text-core hover:bg-gray-50"
                        : "bg-gray-900 text-white hover:bg-gray-800"
                    }`}
                  >
                    {plan.ctaLabel}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-12">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-core">Bachs Products</h2>
            <p className="text-sm text-gray-600">Products fetched from your Bachs sandbox account.</p>
          </div>
          {bachsLoading && <div className="text-sm text-gray-500">Loading Bachs products...</div>}
        </div>

        {bachsError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {bachsError}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {bachsProducts.length === 0 && !bachsLoading ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700">
                No Bachs products found. Verify your sandbox key and product setup in Bachs.io.
              </div>
            ) : (
              bachsProducts.map((product) => (
                <div key={product.id} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">{product.name || product.id}</h3>
                    <span className="rounded-full bg-core/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-core">
                      {product.status || "unknown"}
                    </span>
                  </div>
                  {product.description && (
                    <p className="text-sm text-gray-600 mb-4">{product.description}</p>
                  )}
                  <div className="grid gap-2 text-sm text-gray-700">
                    <div className="flex justify-between">
                      <span className="font-medium">Price</span>
                      <span>
                        {product.price?.amount ? `${product.price.amount} ${product.price.currency}` : "n/a"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Billing</span>
                      <span>{product.billing_cycle?.interval || "n/a"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Default price</span>
                      <span>{product.prices?.[0]?.is_default ? "yes" : "no"}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="mt-16 flex flex-col items-center justify-center">
        <div className="w-full">
          <div className="bg-linear-to-r from-orange-400 via-army to-core rounded-lg p-8 text-white text-center">
            <h3 className="text-2xl font-bold mb-3">Start 7 Day Free Trial</h3>
            <p className="text-sm text-white/90 mb-6">
              Try free & unsubscribe few seconds - no card required
            </p>
            <Button
              onClick={handleStartFreeTrial}
              disabled={trialLoading}
              className="w-2/4 bg-white text-core font-bold py-6 text-lg hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {trialLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                  Starting...
                </span>
              ) : (
                "Start Trial"
              )}
            </Button>
          </div>
        </div>
      </div>

      <Sheet open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <SheetContent side="right" className="w-full md:w-[40%] overflow-y-auto p-6 md:max-w-none">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-2xl font-bold">
              {checkoutStep === 1 ? "Checkout" : "Payment"}
            </SheetTitle>
            <SheetDescription>
              {checkoutStep === 1 ? "Review your plan and enter billing details" : "Complete your payment"}
            </SheetDescription>
          </SheetHeader>

          {selectedPlanData && (
            <>
              {checkoutStep === 1 && (
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-2">{selectedPlanData.title}</h3>
                    <p className="text-gray-600 text-sm mb-4">{selectedPlanData.description}</p>

                    <div className="border-t pt-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 text-sm">Price:</span>
                        <span className="font-bold">
                          ${
                            (billingPeriod === "annual"
                              ? selectedPlanData.annualPrice
                              : selectedPlanData.monthlyPrice
                            ).toLocaleString()
                          }
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 text-sm">Billing:</span>
                        <span className="text-sm font-semibold capitalize">
                          {billingPeriod === "annual" ? "Yearly" : "Monthly"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={billingInfo.email}
                        onChange={(e) => handleBillingChange("email", e.target.value)}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                      <Input
                        type="text"
                        placeholder="John Doe"
                        value={billingInfo.name}
                        onChange={(e) => handleBillingChange("name", e.target.value)}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Address <span className="text-gray-400 text-xs">(Optional)</span>
                      </label>
                      <Input
                        type="text"
                        placeholder="123 Main St, City, Country"
                        value={billingInfo.address}
                        onChange={(e) => handleBillingChange("address", e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-core/50"
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-core text-white font-bold py-3 rounded-lg hover:bg-core/90 transition-all"
                    >
                      Continue to Payment
                    </Button>
                  </form>
                </div>
              )}

              {checkoutStep === 2 && (
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-core">
                    <h4 className="font-semibold mb-3">Order Summary</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">{selectedPlanData.title}</span>
                        <span className="font-semibold">
                          ${
                            (billingPeriod === "annual"
                              ? selectedPlanData.annualPrice
                              : selectedPlanData.monthlyPrice
                            ).toLocaleString()
                          }
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{billingPeriod === "annual" ? "Annual" : "Monthly"} Billing</span>
                      </div>
                      <div className="pt-2 border-t flex justify-between font-bold text-lg">
                        <span>Total:</span>
                        <span>
                          ${
                            (billingPeriod === "annual"
                              ? selectedPlanData.annualPrice
                              : selectedPlanData.monthlyPrice
                            ).toLocaleString()
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm">
                    <div className="mb-2">
                      <span className="text-gray-600">Email:</span>
                      <p className="font-semibold">{billingInfo.email}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Name:</span>
                      <p className="font-semibold">{billingInfo.name}</p>
                    </div>
                  </div>

                  <form onSubmit={handlePayment} className="space-y-4">
                    <Button
                      type="submit"
                      className="w-full bg-core text-white font-bold py-3 rounded-lg hover:bg-core/90 transition-all text-lg"
                    >
                      Pay ${
                        (billingPeriod === "annual"
                          ? selectedPlanData.annualPrice
                          : selectedPlanData.monthlyPrice
                        ).toLocaleString()}
                    </Button>

                    <Button
                      type="button"
                      onClick={() => setCheckoutStep(1)}
                      variant="outline"
                      className="w-full"
                    >
                      Back to Billing
                    </Button>

                    <p className="text-xs text-gray-500 text-center mt-4">
                      🔒 Secure payment powered by Paystack
                    </p>
                  </form>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
