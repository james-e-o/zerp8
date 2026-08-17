"use client";

import { useRouter,useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Settings, Building2, Users, Shield, Globe, CalendarDays, DollarSign, GitBranch } from "lucide-react";

export default function CompanySettingsPage() {
  const router = useRouter();
  const params = useParams()
  const {u, companySlug, companyId} = params
  const companyParam = companyId ?? companySlug

  const settingsSections = [
    {
      title: "Company Information",
      description: "Edit company name, email, phone, and general info.",
      icon: <Building2 className="w-5 h-5 text-gray-600" />,
      route: "company-info",
    },
 
    {
      title: "Fiscal & Tax Settings",
      description: "Manage tax details, fiscal year,  and default  tax rate.",
      icon: <DollarSign className="w-5 h-5 text-gray-600" />,
      route: "fiscal-tax",
    },
    {
      title: "Currency & Country",
      description: "Change default currency, country, and timezone.",
      icon: <Globe className="w-5 h-5 text-gray-600" />,
      route: "country&currency",
    },
    {
      title: "Branch Management",
      description: "Manage Branches, configure, and delete branches.",
      icon: <GitBranch className="w-5 h-5 text-gray-600" />,
      route: "branch-management",
    },
    {
      title: "Security & Ownership",
      description: "Transfer ownership, enable 2FA, or delete company.",
      icon: <Shield className="w-5 h-5 text-gray-600" />,
      route: "security",
    },
  ];

  return (
    <div className="w-full font-WixMade pt-2 min-h-screen">
      <div className="mx-auto">
        {/* Page Header */}
        <div className="flex items-center gap-2 mb-8">
          <Settings className="size-4 text-primary" />
          <h1 className="text-base font-semibold text-gray-800">Company Settings</h1>
        </div>

        {/* Settings Sections */}
        <div className="flex flex-col gap-4">
          {settingsSections.map((section, index) => (
            <Button
              key={index}
              onClick={() => router.push(`/users/${u}/company/${companyParam}/settings/${section.route}`)}
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
  );
}
