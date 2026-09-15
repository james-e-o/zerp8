"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import PageHeader from "@/components/modules/sales/PageHeader"

export default function AttributesLayout({ children }) {
  return (
    <div>
      <PageHeader
        title="Attributes"
        description="Define the attributes used to describe products."
        action={
          <Button
            onClick={() => window.dispatchEvent(new CustomEvent("attributes:add"))}
            className="h-7 bg-core border border-core text-xs text-white hover:bg-core_light"
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add Attribute
          </Button>
        }
      />
      {children}
    </div>
  )
}
