'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import supabase from '@/config/supabaseClient'
import { plans as allPlans } from '@/lib/billingsdk-config'
import { PricingCard } from '@/components/billing/pricing-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'

export default function BillingPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const { u: userId } = params

  const [user, setUser] = useState(null)
  const [currentPlan, setCurrentPlan] = useState(null)
  const [plans, setPlans] = useState([])

  const getAllPlans = () => allPlans.map((plan) => ({
    ...plan,
    key: plan.id,
    stripePriceId: plan.stripePriceId ?? null,
    popular: !!plan.highlight,
    name: plan.title,
    price: plan.monthlyPrice === 'Custom' ? null : Number(plan.monthlyPrice),
    billingPeriod: 'month',
    cta: plan.buttonText,
    features: (plan.features || []).map(feature => feature.name),
  }))
  const [isLoading, setIsLoading] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [subscription, setSubscription] = useState(null)

  // Check for success/cancel from Stripe
  useEffect(() => {
    if (searchParams.get('success')) {
      setSuccess('Payment successful! Your subscription is now active.')
    }
    if (searchParams.get('canceled')) {
      setError('Payment was canceled. Please try again.')
    }
  }, [searchParams])

  // Fetch user and subscription data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get current user
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) {
          router.push('/accounts/login')
          return
        }
        setUser(authUser)

        // Get user subscription
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', authUser.id)
          .single()

        if (subData) {
          setSubscription(subData)
          // Map Stripe price ID to plan
          const matchedPlan = getAllPlans().find(
            (plan) => plan.stripePriceId === subData.stripe_price_id
          )
          if (matchedPlan) {
            setCurrentPlan(matchedPlan[0])
          }
        }

        // Load all plans
        setPlans(getAllPlans())
      } catch (err) {
        console.error('Error fetching billing data:', err)
        setError('Failed to load billing information')
      }
    }

    fetchData()
  }, [router])

  const handleSelectPlan = async (planKey) => {
    if (planKey === 'free') {
      // Free plan - just update locally
      setCurrentPlan('free')
      setSuccess('You are now on the Free plan')
      return
    }

    if (!user) {
      setError('Please log in to select a plan')
      return
    }

    setIsLoading(true)
    setError(null)
    setSelectedPlan(planKey)

    try {
      const plan = getAllPlans().find(p => p.key === planKey)
      
      // Call checkout API
      const response = await fetch('/api/billing/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: plan.stripePriceId,
          userId: user.id,
          email: user.email,
          planKey: planKey,
        }),
      })

      const { sessionId, url, error: checkoutError } = await response.json()

      if (checkoutError) {
        setError(checkoutError)
        return
      }

      // Redirect to Stripe checkout
      if (url) {
        window.location.href = url
      }
    } catch (err) {
      console.error('Checkout error:', err)
      setError('Failed to start checkout. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleManageSubscription = async () => {
    if (!user) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/billing/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
        }),
      })

      const { url, error: portalError } = await response.json()

      if (portalError) {
        setError(portalError)
        return
      }

      if (url) {
        window.location.href = url
      }
    } catch (err) {
      console.error('Portal error:', err)
      setError('Failed to open billing portal')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-armylight via-white to-armylight">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="border-core text-core"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Success Message */}
        {success && (
          <Alert className="mb-6 bg-green-50 border-green-200">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {/* Error Message */}
        {error && (
          <Alert className="mb-6 bg-red-50 border-red-200">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Current Subscription */}
        {currentPlan && (
          <Card className="mb-8 border-core/30 bg-core/5">
            <CardHeader>
              <CardTitle className="text-core">Current Plan</CardTitle>
              <CardDescription>You are currently on the {currentPlan.toUpperCase()} plan</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <div>
                  {subscription && (
                    <>
                      <p className="text-sm text-gray-600">
                        Renewal date: {new Date(subscription.current_period_end).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        Status: <span className="font-semibold capitalize text-core">{subscription.status}</span>
                      </p>
                    </>
                  )}
                </div>
                <Button
                  onClick={handleManageSubscription}
                  disabled={isLoading}
                  className="bg-core hover:bg-core/90"
                >
                  Manage Subscription
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Billing Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-core mb-2">Simple, Transparent Pricing</h1>
          <p className="text-gray-600 text-lg">Choose the perfect plan for your business</p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan) => (
            <PricingCard
              key={plan.key}
              plan={plan}
              planKey={plan.key}
              isLoading={isLoading && selectedPlan === plan.key}
              onSelectPlan={handleSelectPlan}
            />
          ))}
        </div>

        {/* FAQ Section */}
        <div className="bg-white rounded-xl border-2 border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-core mb-6">Frequently Asked Questions</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Can I change plans?</h3>
              <p className="text-gray-600 text-sm">
                Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">What payment methods do you accept?</h3>
              <p className="text-gray-600 text-sm">
                We accept all major credit cards through Stripe. Your payment information is secure.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Is there a free trial?</h3>
              <p className="text-gray-600 text-sm">
                Pro and Enterprise plans include a 14-day free trial. No credit card required to start.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Can I cancel anytime?</h3>
              <p className="text-gray-600 text-sm">
                Yes, cancel your subscription at any time. You'll have access until the end of your billing period.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
