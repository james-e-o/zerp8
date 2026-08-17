'use client'

import { useContext, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DataContext } from '../pageLayoutProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import Link from 'next/link'
import supabase from '@/config/supabaseClient'
import { Spinner } from '@/components/ui/spinner'

export default function CompanyInvitesPage() {
  const { data, setData } = useContext(DataContext)
  const params = useParams()
  const router = useRouter()

  const [invites, setInvites] = useState([])
  const [decliningId, setDecliningId] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch pending company invites
  useEffect(() => {
    const fetchInvites = async () => {
      if (!data?.profile?.email) return

      try {
        setLoading(true)
        const { data: pendingInvites, error } = await supabase
          .from('company_invites')
          .select('*')
          .eq('email', data.profile.email)
          .in('status', ['pending', 'registered'])
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error fetching invites:', error)
          toast.error('Failed to load invites')
          return
        }

        setInvites(pendingInvites || [])
      } catch (err) {
        console.error('Unexpected error:', err)
        toast.error('An error occurred while loading invites')
      } finally {
        setLoading(false)
      }
    }

    fetchInvites()
  }, [data?.profile?.email])

  const handleDeclineInvite = async (inviteId) => {
    try {
      setDecliningId(inviteId)

      const { error } = await supabase
        .from('company_invites')
        .update({ status: 'declined' })
        .eq('id', inviteId)

      if (error) {
        toast.error('Failed to decline invite')
        return
      }

      setInvites(prev =>
        prev.filter(invite => invite.id !== inviteId)
      )

      // Update pending count in context
      setData(prev => ({
        ...prev,
        pendingInvitesCount: Math.max(0, (prev.pendingInvitesCount || 1) - 1)
      }))

      toast.success('Invite declined')
    } catch (err) {
      console.error(err)
      toast.error('Failed to decline invite')
    } finally {
      setDecliningId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Company Invites</h1>
        <p className="text-gray-600">
          Manage your company invitations ({invites.length})
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner spinning={true} className="size-6 text-core" />
        </div>
      ) : invites.length === 0 ? (
        <p className="text-gray-500">No pending invites</p>
      ) : (
        <div className="space-y-4">
          {invites.map(invite => (
            <Card key={invite.id} className="border">
              <CardContent className="flex items-center justify-between p-4">
                
                {/* LEFT SIDE */}
                <div>
                  {invite.logo_url && (
                    <img
                      src={invite.logo_url}
                      alt={invite.company_name}
                      className="w-12 h-12 object-contain rounded mb-2"
                    />
                  )}
                  <p className="font-semibold text-lg">
                    {invite.company_name}
                  </p>
                  <p className="text-sm text-gray-500">
                    Invited via {invite.email}
                  </p>
                  {invite.invited_by && (
                    <p className="text-xs text-gray-400 mt-1">
                      Invited by: {invite.invited_by}
                    </p>
                  )}
                </div>

                {/* RIGHT SIDE ACTIONS */}
                <div className="flex gap-2">
                  <Link href={`/users/${params.u}/company-invites/${encodeURIComponent(invite.id)}`}>
                    <Button className="bg-army text-white hover:bg-army/90">
                      Accept
                    </Button>
                  </Link>

                  <Button
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => handleDeclineInvite(invite.id)}
                    disabled={decliningId === invite.id}
                  >
                    {decliningId === invite.id ? <Spinner spinning={true} className="size-3" /> : 'Decline'}
                  </Button>
                </div>

              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}