"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Settings, Building2, Shield, Globe, DollarSign, GitBranch } from "lucide-react";

export default function CompanySettingsPage() {
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
        <div className="grid gap-3 sm:grid-cols-2">
          {settingsSections.map((section) => (
            <Link
              key={section.route}
              href={`/users/${u}/company/${companyParam}/settings/${section.route}`}
              className="group flex items-start gap-3 rounded-md border bg-white p-4 text-left transition-colors hover:bg-armylight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded bg-armylight">
                {section.icon}
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-800 group-hover:underline">{section.title}</h3>
                <p className="text-xs text-gray-500">{section.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
