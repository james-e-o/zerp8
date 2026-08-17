"use client"

import React, { useEffect, useState,useContext } from "react"
import { CompanyInfoContext } from "../companyInfoProvider"
import { Button } from "@/components/ui/button"
import {  LayoutDashboard,  FileChartLine,  ChartCandlestick,  Settings,  Users,  Check,  Plus,  Info,  Package,  Boxes,  Truck,} from "lucide-react"
import supabase from "@/config/supabaseClient"

// Map module keys → icons (for dynamic assignment)
const moduleIcons = {
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

export default function ModulesManagementPage() {
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const {modules:CompanyModules} = useContext(CompanyInfoContext)
  console .log("CompanyModules in ModulesManagementPage:", CompanyModules);

  // helper: check if a fetched module key matches any company module `slug`
  const isKeyInCompanyBySlug = (key) => {
    if (!CompanyModules || !Array.isArray(CompanyModules)) return false
    return CompanyModules.some((cm) => {
      if (!cm) return false
      // support string entries
      if (typeof cm === "string") return cm === key || cm === String(key)
      // support objects with a `slug` property
      if (cm.slug && cm.slug === key) return true
      // backwards compatibility: other possible keys
      if (cm.key && cm.key === key) return true
      if (cm.module_key && cm.module_key === key) return true
      if (cm.mod_key && cm.mod_key === key) return true
      return false
    })
  }

  // Fetch modules from Supabase
  const fetchModules = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("modules")
      .select("*")
      .order("id", { ascending: true })

    if (error) console.error("Fetch error:", error)
    else if (Array.isArray(data)) {
      const annotated = data.map((d) => ({
        ...d,
        included: !!(d.included || isKeyInCompanyBySlug(d.key)),
      }))
      setModules(annotated)
    } else setModules(data)

    setLoading(false)
  }

  useEffect(() => {
    fetchModules()
  }, [CompanyModules])

  const toggleModule = async (id) => {
    // You'll update this based on your company-module join table logic.
    // For now, we only toggle visually.

    setModules((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, included: !m.included } : m
      )
    )
  }

  if (loading) {
    return (
      <div className="px-5 text-sm text-muted-foreground">
        Loading modules...
      </div>
    )
  }

  return (
    <div className="px-5 font-WixMade">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-base font-semibold">Modules Manager</h1>
          <p className="text-xs text-muted-foreground">
            Choose and manage which modules are available to this company and its branches.
          </p>
        </div>
      </div>

      {/* MODULE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((mod) => {
          const Icon = moduleIcons[mod.key] || Info
          const status = String(mod.status || "active").toLowerCase()
          const isActive = status === "active"
          const isComing = status === "coming_soon" || status === "coming-soon" || status === "coming soon"
          const disableAdd = !isActive && !mod.included

          return (
            <article
              key={mod.id}
              className="relative rounded-lg overflow-hidden border border-core"
            >
              {/* Top badge: only show 'Not Added' when module is NOT included by company slug */}
              {isActive&&!mod.included && (
                <div className="absolute right-3 top-3 z-10">
                  <span className="inline-flex items-center gap-1  text-[11px] font-medium px-2 py rounded-full bg-army text-zinc-50">
                    Not Added
                  </span>
                </div>
              )}

              {/* Card content */}
              <div
                className="p-4 flex gap-4 items-start"
                style={{ minHeight: 140, maxHeight: 180 }}
              >
                <div className="shrink-0">
                  <div className="w-14 h-14 rounded-lg bg-white/70 border border-white flex items-center justify-center shadow">
                    <Icon size={22} className="text-army" />
                  </div>
                </div>

                <div className="flex-1">
                  <h3 className="text-sm font-semibold mb-1">{mod.name}</h3>
                  <p className="text-xs text-zinc-600 mb-3">
                    {mod.description}
                  </p>

                  {isActive && (
                    <div className="flex items-center gap-3">
                      <Button
                        data-included={mod.included}
                        className={`h-6 text-xs ${
                          disableAdd
                            ? "bg-gray-200 text-gray-600 opacity-60 cursor-not-allowed"
                            : mod.included
                            ? "bg-army hover:bg-army/85"
                            : "bg-core hover:bg-core/85"
                        }`}
                        onClick={() => toggleModule(mod.id)}
                        disabled={disableAdd}
                      >
                        {mod.included ? "Remove" : "Add"}
                      </Button>

                      <Button
                        variant="ghost"
                        className={`h-6 text-xs ${!(mod.included && isActive) ? "opacity-60 text-gray-500 cursor-not-allowed" : ""}`}
                        disabled={!(mod.included && isActive)}
                      >
                        Configure
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer row: premium (left) and status badge (right) */}
              <div className="px-4 py-2 border-t border-white/50 bg-white/30 flex items-center justify-between">
                <div>
                  {isActive&&mod.premium && (
                    <span className="inline-flex items-center text-[10px] italic font-medium px-2 py rounded-full bg-purple-100 text-purple-800">Premium</span>
                  )}
                </div>

                <div>
                  {isActive && (
                    <span className="inline-flex items-center text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-800">Active</span>
                  )}
                  {isComing && (
                    <span className="inline-flex items-center text-xs font-medium px-2 py-1 rounded-full bg-orange-300 text-neutral-900">Coming Soon</span>
                  )}
                  {!isActive && !isComing && (
                    <span className="inline-flex items-center text-xs font-medium px-2 py-1 rounded-full bg-zinc-100 text-zinc-700">Inactive</span>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
