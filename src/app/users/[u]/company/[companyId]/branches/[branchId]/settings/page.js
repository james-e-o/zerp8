"use client"

import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Settings, Edit3, DollarSign, Grid, Truck } from "lucide-react";

export default function BranchSettingsPage() {
  const router = useRouter()
  const params = useParams()
  const { u, companySlug, branch } = params

  const settingsSections = [
    {
      title: "Basic Information",
      description: "Edit branch name, address and contact details.",
      icon: <Edit3 className="w-5 h-5 text-gray-600" />,
      route: "basic-info",
    },
    {
      title: "Fiscal & Currency",
      description: "Manage base currency, enabled currencies and exchange rates.",
      icon: <DollarSign className="w-5 h-5 text-gray-600" />,
      route: "fiscal-currency",
    },
    {
      title: "Modules",
      description: "Enable or disable branch-level modules.",
      icon: <Grid className="w-5 h-5 text-gray-600" />,
      route: "modules",
    },
    {
      title: "Shipping Profiles",
      description: "Create and manage shipping options for your products.",
      icon: <Truck className="w-5 h-5 text-gray-600" />,
      route: "shipping-profiles",
    }
  ]

  return (
    <div className="w-full font-WixMade pt-2 min-h-screen">
      <div className="mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Settings className="size-4 text-primary" />
          <h1 className="text-base font-semibold text-gray-800">Branch Settings</h1>
        </div>

        <div className="flex flex-col gap-4">
          {settingsSections.map((section, index) => (
            <Button
              key={index}
              onClick={() => router.push(`/admin/${u}/company/${companySlug}/branches/${branch}/settings/${section.route}`)}
              className="flex items-start gap-4 p-5 rounded-lg h-fit border bg-white hover:bg-armylight hover:shadow-xs transition-all text-left"
            >
              <div className="mt-1">{section.icon}</div>
              <div>
                <h3 className="text-base font-medium text-gray-800">{section.title}</h3>
                <p className="text-xs text-gray-500">{section.description}</p>
              </div>
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}