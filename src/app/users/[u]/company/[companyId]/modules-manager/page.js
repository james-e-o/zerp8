"use client"

import React, { useEffect, useState, useContext } from "react"
import { CompanyInfoContext } from "../companyInfoProvider"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  FileChartLine,
  ChartCandlestick,
  Settings,
  Users,
  Package,
  Boxes,
  Truck,
  Lock,
  AlertCircle,
  Loader,
} from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import supabase from "@/config/supabaseClient"

// Map module keys → icons (for dynamic assignment)
const MODULE_ICONS = {
  dashboard: LayoutDashboard,
  inventory: Package,
  products: FileChartLine,
  customers: Users,
  sales: ChartCandlestick,
  orders: Boxes,
  purchases: Boxes,
  services: Settings,
  bookings: Users,
  projects: Settings,
  logistics: Truck,
  warehousing: Boxes,
}

// Module status constants
const MODULE_STATUS = {
  ACTIVE: "active",
  COMING_SOON: "coming_soon",
  INACTIVE: "inactive",
}

export default function ModulesManagementPage() {
  const params = useParams()
  const router = useRouter()
  const { u, companyId } = params
  const { modules: companyModules = [] } = useContext(CompanyInfoContext) || {}

  // State management
  const [modules, setModules] = useState([])
  const [plans, setPlans] = useState([])
  const [currentPlan, setCurrentPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  /**
   * Check if a company has a specific module enabled
   * Handles multiple possible field names from context
   */
  const isModuleEnabled = (moduleKey) => {
    if (!Array.isArray(companyModules)) return false
    
    return companyModules.some((module) => {
      if (!module) return false
      
      // Handle string references
      if (typeof module === "string") {
        return module === moduleKey
      }
      
      // Handle object references with various property names
      return (
        module.key === moduleKey ||
        module.slug === moduleKey ||
        module.module_key === moduleKey
      )
    })
  }

  /**
   * Check if company's subscription plan allows access to this module
   */
  const hasAccessToModule = (modulePlanLevel) => {
    // Free modules (null min_plan_level) are always accessible
    if (!modulePlanLevel && modulePlanLevel !== 0) return true
    
    // No active plan means no premium access
    if (!currentPlan) return false
    
    // Ensure level is treated as a number for comparison
    const planLevel = Number(currentPlan.level)
    const requiredLevel = Number(modulePlanLevel)
    
    // Access granted if current plan level >= module's minimum required level
    return planLevel >= requiredLevel
  }

  /**
   * Fetch company's active subscription and its plan details
   */
  const fetchCompanySubscription = async () => {
    try {
      // Step 1: Fetch subscription
      const { data: subscription, error: subError } = await supabase
        .from("subscriptions")
        .select("product_id, status")
        .eq("company_id", companyId)
        .in("status", ["active", "trial"])
        .maybeSingle()

      if (subError) throw subError

      if (subscription?.product_id) {
        console.log("Subscription product_id:", subscription.product_id)
        
        // Step 2: Fetch plan using the product_id
        // IMPORTANT: Only select basic columns to avoid jsonb issues
        const { data: planData, error: planError } = await supabase
          .from("plans")
          .select("bachs_product_id, name, level, badge")
          .eq("bachs_product_id", subscription.product_id)
          .maybeSingle()

        console.log("Plan query result:", planData)
        console.log("Plan query error:", planError)

        if (planError) throw planError
        
        if (planData) {
          console.log(`✅ Plan found: "${planData.name}" with level ${planData.level}`)
        } else {
          console.warn(`⚠️ No plan found for product_id: ${subscription.product_id}`)
        }
        
        setCurrentPlan(planData)
      } else {
        console.warn("No product_id in subscription")
        setCurrentPlan(null)
      }
    } catch (err) {
      console.error("Subscription fetch error:", err)
      setError("Failed to load subscription info")
    }
  }

  /**
   * Fetch all available plans for the plan selector badges
   */
  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("plans")
        .select("bachs_product_id, name, level, badge")
        .eq("active", true)
        .order("level", { ascending: true })

      if (error) throw error
      
      setPlans(data || [])
    } catch (err) {
      console.error("Plans fetch error:", err)
    }
  }

  /**
   * Fetch all available modules
   */
  const fetchModules = async () => {
    try {
      const { data, error } = await supabase
        .from("modules")
        .select("*")
        .order("name", { ascending: true })

      if (error) throw error

      if (Array.isArray(data)) {
        // Enrich modules with company context
        const enrichedModules = data.map((module) => ({
          ...module,
          isEnabledForCompany: isModuleEnabled(module.key),
        }))
        setModules(enrichedModules)
      }
    } catch (err) {
      console.error("Modules fetch error:", err)
      setError("Failed to load modules")
    }
  }

  /**
   * Initial data fetch on component mount
   */
  useEffect(() => {
    setLoading(true)
    setError(null)
    
    Promise.all([
      fetchModules(),
      fetchCompanySubscription(),
      fetchPlans(),
    ])
      .catch((err) => {
        console.error("Data fetch error:", err)
        setError("Failed to load data")
      })
      .finally(() => setLoading(false))
  }, [companyId])

  /**
   * Handle module activation/deactivation
   */
  const toggleModule = async (moduleId) => {
    setModules((prev) =>
      prev.map((m) =>
        m.id === moduleId
          ? { ...m, isEnabledForCompany: !m.isEnabledForCompany }
          : m
      )
    )
    
    // TODO: Persist change to database
    // await updateCompanyModule(companyId, moduleId, !currentState)
  }

  /**
   * Get the plan that unlocks this module
   */
  const getRequiredPlan = (modulePlanLevel) => {
    return plans.find((p) => Number(p.level) === Number(modulePlanLevel))
  }

  // Render states
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen px-5">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading modules...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full md:p-3 p-2 overflow-y-auto bg-background">
      {/* Header Section */}
      <div className="mb-8 border-b border-border pb-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex flex-col p-1">
            <h1 className="text-xl font-semibold text-foreground">Module Access</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage which features are available to this company
            </p>
          </div>
          {currentPlan && (
            <div className="bg-core_light rounded-lg px-4 py-3 border border-core/20">
              <p className="text-xs text-muted-foreground mb-1">Current Plan</p>
              <p className="text-sm font-semibold text-core">{currentPlan.name}</p>
              <p className="text-xs text-muted-foreground mt-1">Level: {currentPlan.level}</p>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
            <AlertCircle size={16} className="text-red-600 dark:text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
        {modules.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-sm text-muted-foreground">No modules found</p>
          </div>
        ) : (
          modules.map((module) => {
            const Icon = MODULE_ICONS[module.key] || Package
            const status = module.status?.toLowerCase() || MODULE_STATUS.COMING_SOON
            const isActive = status === MODULE_STATUS.ACTIVE
            const isComingSoon = status.includes("coming")
            const hasAccess = hasAccessToModule(module.min_plan_level)
            const requiredPlan = !hasAccess ? getRequiredPlan(module.min_plan_level) : null
            const isEnabled = module.isEnabledForCompany

            return (
              <article
                key={module.id}
                className={`relative rounded-lg border overflow-hidden transition-all ${
                  hasAccess
                    ? "border-border bg-card hover:border-core/30"
                    : "border-core_light bg-core_light/40"
                }`}
              >
                {/* Access Badge */}
                {!hasAccess && (
                  <div className="absolute right-3 top-3 z-10">
                    <button
                      onClick={() => router.push(`/users/${u}/company/${companyId}/subscriptions/plans`)}
                      className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-core text-white hover:bg-core/90 transition-colors cursor-pointer"
                    >
                      <Lock size={12} />
                      Upgrade Required
                    </button>
                  </div>
                )}

                {/* Card Content */}
                <div className={`p-4 flex gap-4 ${!hasAccess ? "opacity-70" : ""}`}>
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    <div
                      className={`w-12 h-12 rounded-lg border flex items-center justify-center ${
                        hasAccess
                          ? "bg-core_light border-core/20"
                          : "bg-white/50 border-core/30"
                      }`}
                    >
                      <Icon
                        size={20}
                        className={
                          hasAccess ? "text-core" : "text-core/60"
                        }
                      />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-foreground">
                        {module.name}
                      </h3>
                      {module.premium && (
                        <span className="text-xs font-medium px-2 py-1 rounded bg-core_light text-core whitespace-nowrap flex-shrink-0">
                          Premium
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                      {module.description || "No description"}
                    </p>

                    {/* Actions or Message */}
                    {hasAccess && isActive ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={isEnabled ? "default" : "outline"}
                          className={`text-xs h-7 ${
                            isEnabled
                              ? "bg-core hover:bg-core/90 text-white"
                              : "border-border text-foreground hover:bg-core_light"
                          }`}
                          onClick={() => toggleModule(module.id)}
                        >
                          {isEnabled ? "Remove" : "Add"}
                        </Button>

                        {isEnabled && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-7 text-muted-foreground hover:text-core"
                          >
                            Configure
                          </Button>
                        )}
                      </div>
                    ) : !hasAccess ? (
                      <div className="text-xs text-core font-medium">
                        {requiredPlan
                          ? `Requires ${requiredPlan.name} plan`
                          : "Plan upgrade required"}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-2 bg-core_light/50 border-t border-core/10 flex items-center justify-between text-xs">
                  <div>
                    {isActive ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 font-medium">
                        Active
                      </span>
                    ) : isComingSoon ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 font-medium">
                        Coming Soon
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                        Inactive
                      </span>
                    )}
                  </div>

                  {isEnabled && isActive && (
                    <span className="text-core font-medium">Enabled</span>
                  )}
                </div>
              </article>
            )
          })
        )}
      </div>
    </div>
  )
}