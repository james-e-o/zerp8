"use client";

import { PricingTableOne } from "@/components/billingsdk/pricing-table-one";
import { plans } from "@/lib/billingsdk-config";

export function PricingTableOneDemo() {
  return (
    <PricingTableOne
      plans={plans}
      title="Pricing"
      description="Choose the plan that's right for you"
      onPlanSelect={(planId) => console.log("Selected plan:", planId)}
      // small, medium, large
      size="medium"
      // minimal or classic
      theme="classic"
      className="w-full" />
  );
}
