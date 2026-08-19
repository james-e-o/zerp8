"use client"

import React, { useContext, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Trash2, Plus, ArrowLeft } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CompanyInfoContext } from '../../companyInfoProvider'
import supabase from '@/config/supabaseClient'
import { toast } from 'sonner'
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
  const { branches, accessLevelScope, currencies } = useContext(CompanyInfoContext)

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
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="p-0 h-fit"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-base font-semibold text-gray-800">Branch Management</h1>
            <p className="text-xs text-gray-500">Manage and configure all company branches</p>
          </div>
        </div>

        {/* Create New Branch Button */}
        {accessLevelScope === 'company' && (
          <div className="mb-6">
            <Button
              className="h-8 inline-flex items-center bg-army hover:bg-army/85 gap-2"
              onClick={() => router.push(`/users/${params.u}/company/${params.companyId}/branches/new`)}
            >
              <Plus size={14} />
              <span className="text-[10px]">Create New Branch</span>
            </Button>
          </div>
        )}

        {/* Branches List */}
        <div className="space-y-3">
          {branches && branches.length > 0 ? (
            branches.map((branch) => (
              <div
                key={branch.id}
                className="border rounded bg-white dark:bg-neutral-900 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-gray-800">{branch.name}</h3>
                      {branch.isheadoffice && (
                        <span className="text-[10px] px-2 py-1 bg-blue-50 text-blue-700 rounded">
                          Head Office
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {branch.address}
                      {branch.city && `, ${branch.city}`}
                    </div>
                    {branch.base_currency && (
                      <div className="text-xs text-gray-500 mt-1">
                        Base Currency: <strong>{branch.base_currency}</strong>
                      </div>
                    )}
                  </div>

                  {/* Delete Button */}
                  {accessLevelScope === 'company' && !branch.isheadoffice && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            className="h-8 inline-flex items-center gap-2"
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setBranchToDelete(branch)
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 size={14} />
                            <span className="text-xs">Delete</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete this branch</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
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
