'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import supabase from '@/config/supabaseClient'
import { startFreeTrial } from '@/lib/start-free-trial'

export default function StartFreeTrialButton({ className = '', label = 'Start Trial' }) {
  const router = useRouter()
  const params = useParams()
  const { u, companyId } = params
  const [loading, setLoading] = useState(false)

  const handleStartFreeTrial = async () => {
    setLoading(true)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setLoading(false)
        return
      }

      const result = await startFreeTrial(companyId)

      if (result.success) {
        const destination = `/users/${u}/company/${companyId}`
        router.refresh()
        window.location.assign(destination)
      }
    } catch (error) {
      console.error('Error starting free trial:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleStartFreeTrial}
      disabled={loading}
      className={className || 'w-full bg-linear-to-r from-orange-400 via-army to-core text-white hover:bg-core/90'}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
          Starting...
        </span>
      ) : (
        label
      )}
    </Button>
  )
}
