"use client"

import React, { useContext, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Trash2, Plus, ArrowLeft, ArrowRight, Building2, MapPin } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CompanyInfoContext } from '../../companyInfoProvider'
import supabase from '@/config/supabaseClient'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function BranchManagementPage() {
  const router = useRouter()
  const params = useParams()
  const { branches, accessLevelScope } = useContext(CompanyInfoContext)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [branchToDelete, setBranchToDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const deleteBranch = async () => {
    if (!branchToDelete) return

    setIsDeleting(true)

    try {
      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', branchToDelete.id)

      if (error) {
        console.error('Failed to delete branch:', error)
        toast.error('Failed to delete branch')
        return
      }

      toast.success(`${branchToDelete.name} deleted successfully`)
      setDeleteDialogOpen(false)
      setBranchToDelete(null)
      // Trigger a refresh or navigation to update the list
      setTimeout(() => {
        router.refresh()
      }, 500)
    } catch (err) {
      console.error('Unexpected error:', err)
      toast.error('Unexpected error occurred')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="w-full font-WixMade min-h-screen">
      <div className="mx-auto">
        <header className="mb-4">
          <h1 className="text-lg font-semibold text-foreground">Branch Management</h1>
          <p className="mt-1 text-xs text-muted-foreground">Manage and configure all company branches.</p>
        </header>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/users/${params.u}/company/${params.companyId}/settings`}
            className="inline-flex h-8 items-center gap-2 rounded-md bg-core_light px-2 text-xs font-medium text-core transition-colors hover:bg-core_light/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-4" />
            Company settings
          </Link>
          {accessLevelScope === 'company' && (
            <Button
              className="h-8 bg-army hover:bg-army/85"
              onClick={() => router.push(`/users/${params.u}/company/${params.companyId}/branches/new`)}
            >
              <Plus className="size-4" />
              Create branch
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {branches && branches.length > 0 ? (
            branches.map((branch) => (
              <article
                key={branch.id}
                className="overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-core/40"
              >
                <Link
                  href={`/users/${params.u}/company/${params.companyId}/settings/branch-management/${branch.id}`}
                  className="group block p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <div className="mb-4 flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-core_light text-core">
                      <Building2 className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-sm font-semibold text-foreground group-hover:text-core">{branch.name}</h2>
                        {branch.isheadoffice && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Head office</span>}
                      </div>
                      <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">ID {branch.id}</p>
                    </div>
                    <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-core" />
                  </div>
                  <div className="space-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
                    <p className="flex items-start gap-2">
                      <MapPin className="mt-0.5 size-3.5 shrink-0" />
                      <span>{[branch.address, branch.city, branch.country].filter(Boolean).join(', ') || 'No address added'}</span>
                    </p>
                    <p>{branch.email || 'No contact email'}</p>
                    <p>Base currency: <span className="font-medium text-foreground">{branch.base_currency || 'Not set'}</span></p>
                  </div>
                </Link>
                {accessLevelScope === 'company' && !branch.isheadoffice && (
                  <div className="flex justify-end border-t border-border px-3 py-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            aria-label={`Delete ${branch.name}`}
                            className="text-muted-foreground hover:text-destructive"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setBranchToDelete(branch)
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Delete branch</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
              </article>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-border py-10 text-center text-muted-foreground sm:col-span-2 xl:col-span-3">
              <Building2 className="mx-auto mb-2 size-5" />
              <p className="text-sm">No branches found</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Branch</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{branchToDelete?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteBranch}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
