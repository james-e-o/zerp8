// app/users/[u]/page.jsx
'use client'

import { useContext, useEffect, useState } from 'react'
import { DataContext } from './pageLayoutProvider'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Factory, Plus, ArrowRight, Handshake, Calculator, Package, ShoppingCart, Users2, FileBarChart2, Wallet,} from 'lucide-react'
import Link from 'next/link'
import { Spinner } from '@/components/ui/spinner'
import UserSidebarLayout from '@/components/user-sidebar-layout'
import supabase from '@/config/supabaseClient'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'

const MODULES = [
  { key: 'accounting', name: 'Accounting', desc: 'Ledgers, invoices, expenses', icon: Calculator },
  { key: 'inventory', name: 'Inventory', desc: 'Stock across branches', icon: Package },
  { key: 'sales', name: 'Sales & POS', desc: 'Orders, checkout, receipts', icon: ShoppingCart },
  { key: 'staff', name: 'Staff & HR', desc: 'Roles, access, payroll', icon: Users2 },
  { key: 'reports', name: 'Reports', desc: 'Performance across companies', icon: FileBarChart2 },
  { key: 'billing', name: 'Billing', desc: 'Plans, invoices, usage', icon: Wallet },
]

function CompanyCard({ company, params }) {
  const initials = (company.name || '?').slice(0, 2).toUpperCase()
  return (
    <Link href={`/users/${params.u}/company/${company.id}`} className="block">
      <div className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 transition-all hover:border-core hover:shadow-sm">
        {company.logo_url ? (
          <img
            src={company.logo_url}
            alt={company.name}
            className="size-11 shrink-0 rounded-xl object-cover border border-gray-100"
          />
        ) : (
          <div className="size-11 shrink-0 rounded-xl bg-core_light flex items-center justify-center">
            <span className="text-core font-semibold text-sm">{initials}</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm truncate">{company.name}</h3>
            <span
              className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                company.badge === 'owner'
                  ? 'bg-core_light text-core'
                  : 'bg-orange-50 text-orange-700'
              }`}
            >
              {company.badge === 'owner' ? 'OWNER' : (company.role || 'STAFF').toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{company.slug}</p>
        </div>
        <ArrowRight className="size-4 text-gray-300 group-hover:text-core transition-colors shrink-0" />
      </div>
    </Link>
  )
}

function ModuleTeaser({ mod }) {
  const Icon = mod.icon
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 hover:border-core/40 transition-colors">
      <div className="size-9 rounded-lg bg-core_light flex items-center justify-center mb-3">
        <Icon className="size-4 text-core" />
      </div>
      <h4 className="text-sm font-medium">{mod.name}</h4>
      <p className="text-xs text-gray-500 mt-0.5">{mod.desc}</p>
    </div>
  )
}

function UserDashboardContent() {
  const params = useParams()
  const { data, setData } = useContext(DataContext)
  const [pendingInvites, setPendingInvites] = useState([])
  const [showInvitesDialog, setShowInvitesDialog] = useState(false)
  const [loadingInvites, setLoadingInvites] = useState(true)


  useEffect(() => {
  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession()
  }
  checkSession()
}, [])
  useEffect(() => {
    const fetchPendingInvites = async () => {
      if (!data?.profile?.email) return

      try {
        setLoadingInvites(true)
        const { data: invites, error } = await supabase
          .from('company_invites')
          .select('*')
          .eq('email', data.profile.email)
          .in('status', ['pending', 'registered'])
          .order('created_at', { ascending: false })

        if (error) return

        setPendingInvites(invites || [])
        setData(prev => ({
          ...prev,
          pendingInvitesCount: invites?.length || 0,
          pendingInvites: invites || [],
        }))

        if (invites && invites.length > 0) setShowInvitesDialog(true)
      } catch (err) {
        console.error('Unexpected error fetching invites:', err)
        toast.error('Failed to load pending invites')
      } finally {
        setLoadingInvites(false)
      }
    }

    fetchPendingInvites()
  }, [data?.profile?.email, setData])

  const companies = data?.companies || []
  const hasCompanies = companies.length > 0

  return (
    <>
      <Dialog open={showInvitesDialog} onOpenChange={setShowInvitesDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pending company invitations</DialogTitle>
            <DialogDescription>
              You have {pendingInvites.length} pending invitation{pendingInvites.length !== 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {loadingInvites ? (
              <div className="flex items-center justify-center py-8">
                <Spinner spinning={true} className="size-5 text-core" />
              </div>
            ) : pendingInvites.length > 0 ? (
              pendingInvites.map(invite => (
                <div key={invite.id} className="p-4 border border-core/20 rounded-lg bg-core_light/40">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {invite.logo_url && (
                        <img
                          src={invite.logo_url}
                          alt={invite.company_name}
                          className="w-12 h-12 object-contain rounded mb-2"
                        />
                      )}
                      <p className="font-semibold text-sm">{invite.company_name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Invited by: {invite.invited_by || 'Company admin'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(invite.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-xs font-semibold px-2 py-1 bg-orange-100 text-orange-700 rounded">
                      PENDING
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">No pending invites.</p>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Link href={`/users/${params.u}/company-invites`} className="flex-1">
              <Button className="w-full bg-core hover:bg-core/90">View all invites</Button>
            </Link>
            <DialogClose asChild>
              <Button variant="outline" className="flex-1">Dismiss</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      <div className="w-full max-w-full space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-semibold">Welcome, {data?.profile?.username}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {hasCompanies
                ? 'Pick up where you left off, or start something new.'
                : 'Set up your first company to start using Nexshelf.'}
            </p>
          </div>
          {/* <Link href={`/users/${params.u}/new-company`}>
            <Button className="h-9 bg-core hover:bg-core/90 gap-1.5">
              <Plus className="size-4" />
              New company
            </Button>
          </Link> */}
        </div>

        {hasCompanies ? (
          <div className="grid sm:grid-cols-2 gap-3 mb-10">
            {companies.map((company, index) => (
              <CompanyCard key={company.id || index} company={company} params={params} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white px-8 py-12 text-center mb-10 w-full">
            <div className="flex flex-col items-center gap-4 w-full mx-auto">
              <div className="p-4 rounded-full bg-core_light">
                <Factory className="size-5 text-core" />
              </div>
              <div className="w-full max-w-2xl">
                <h3 className="text-sm font-medium">Start your first company</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Set up accounting, inventory, sales, and staff — all in one place, built for the way West African SMBs actually run.
                </p>
              </div>
              <Link href={`/users/${params.u}/new-company`}>
                <Button className="h-9 bg-core hover:bg-core/90 gap-1.5">
                  <Plus className="size-4" />
                  Create company
                </Button>
              </Link>
            </div>
          </div>
        )}

        <div className="w-full">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-medium text-gray-700">What you can run on Nexshelf</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {MODULES.map(mod => (
              <ModuleTeaser key={mod.key} mod={mod} />
            ))}
          </div>
        </div>

        {companies.some(c => c.badge === 'staff') && (
          <div className="mt-8 flex items-center gap-3 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
            <Handshake className="size-4 text-gray-400 shrink-0" />
            <p className="text-xs text-gray-500">
              Companies marked <span className="font-medium text-orange-700">staff</span> are ones you've been invited to join — your access there is set by that company's admin.
            </p>
          </div>
        )}
      </div>
    </>
  )
}

export default function AdminUserPage() {
  return (
    <UserSidebarLayout>
      <UserDashboardContent />
    </UserSidebarLayout>
  )
}