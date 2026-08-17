import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check } from 'lucide-react'

export function PricingCard({ plan, planKey, isLoading, onSelectPlan }) {
  return (
    <div
      className={`relative rounded-xl border-2 transition-all duration-300 ${
        plan.popular
          ? 'border-core bg-core/5 shadow-lg scale-105'
          : 'border-gray-200 bg-white hover:border-core/50'
      }`}
    >
      {plan.popular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <Badge className="bg-core text-white">Most Popular</Badge>
        </div>
      )}

      <div className="p-8">
        {/* Plan Header */}
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
          <p className="text-gray-600 text-sm">{plan.description}</p>
        </div>

        {/* Pricing */}
        <div className="mb-6">
          {plan.price !== null ? (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold text-core">${plan.price}</span>
                <span className="text-gray-600">/{plan.billingPeriod}</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">Billed {plan.billingPeriod}ly</p>
            </>
          ) : (
            <div>
              <span className="text-4xl font-bold text-core">Custom</span>
              <p className="text-sm text-gray-500 mt-2">Contact us for custom pricing</p>
            </div>
          )}
        </div>

        {/* CTA Button */}
        <Button
          onClick={() => onSelectPlan(planKey)}
          disabled={isLoading}
          className={`w-full mb-6 font-semibold ${
            plan.popular
              ? 'bg-core hover:bg-core/90 text-white'
              : 'border-2 border-core text-core hover:bg-core/5'
          }`}
          variant={plan.popular ? 'default' : 'outline'}
        >
          {isLoading ? 'Loading...' : plan.cta}
        </Button>

        {/* Features List */}
        <div className="space-y-3">
          {plan.features.map((feature, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <Check className="w-5 h-5 text-army mt-0.5 flex-shrink-0" />
              <span className="text-gray-700 text-sm">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
