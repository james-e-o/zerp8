'use client'

import { useState, useEffect, useContext } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import supabase from '@/config/supabaseClient'
import { RefreshCw, Edit2, Save, AlertCircle } from 'lucide-react'
import { StaffContext } from '@/components/contexts/staff-context'

export default function PermissionsTab({ staffData, setStaffData, companyId }) {
  const { getAccessLevelPermissions, permissionKeysMetadata, refetchStaffData } = useContext(StaffContext)

  const [permissions, setPermissions] = useState({})
  const [originalPermissions, setOriginalPermissions] = useState({})
  const [updatedPermissions, setUpdatedPermissions] = useState({})
  const [staffOverrides, setStaffOverrides] = useState({})
  const [staffAccessScope, setStaffAccessScope] = useState(null)
  const [disabledPermissions, setDisabledPermissions] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [showDisabledDialog, setShowDisabledDialog] = useState(false)

  const getPermissionState = (groupKey, permKey) => {
    const perm = permissions[groupKey]?.permissions.find(p => p.key === permKey)
    const currentState = perm?.status
    const isOverriding = perm?.isOverriding

    const originalPerm = originalPermissions[groupKey]?.permissions.find(p => p.key === permKey)
    const originalState = originalPerm?.status

    return { currentState, originalState, isOverriding }
  }

  const getStatusBadge = (status) => {
    if (status === true) {
      return (
        <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
          Allowed
        </span>
      )
    } else if (status === false) {
      return (
        <span className="px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
          Not Allowed
        </span>
      )
    } else {
      return (
        <span className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          Not Defined
        </span>
      )
    }
  }

  const fetchPermissionsData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Step 1: Get staff's access level scope (branch or company)
      const { data: accessLevelData, error: accessLevelError } = await supabase
        .from('access_level')
        .select('access')
        .eq('key', staffData.access_level)
        .single()

      if (accessLevelError) throw accessLevelError

      const scope = accessLevelData?.access // 'branch' or 'company'
      setStaffAccessScope(scope)

      // Step 2: Calculate disabled permissions
      const disabled = {}
      Object.keys(permissionKeysMetadata).forEach((permKey) => {
        const includesBranch = permissionKeysMetadata[permKey]?.includes_branch
        // Disable if staff has branch access AND permission is company-only
        if (scope === 'branch' && includesBranch === false) {
          disabled[permKey] = true
        }
      })
      setDisabledPermissions(disabled)

      // Step 3: Get merged permissions from role
      const mergedPerms = await getAccessLevelPermissions(staffData.access_level)

      // Step 4: Get user overrides
      const { data: overrides, error: overridesError } = await supabase
        .from('staff_permission_overrides')
        .select('permission_key, allowed')
        .eq('staff_id', staffData.id)
        .eq('company_id', companyId)

      if (overridesError) throw overridesError

      const overridesMap = {}
      ;(overrides || []).forEach((override) => {
        overridesMap[override.permission_key] = override.allowed
      })
      setStaffOverrides(overridesMap)

      // Step 5: Build final permissions with overrides
      const finalPerms = {}
      Object.keys(mergedPerms).forEach((groupKey) => {
        finalPerms[groupKey] = {
          ...mergedPerms[groupKey],
          permissions: mergedPerms[groupKey].permissions.map((perm) => {
            const hasOverride = overridesMap[perm.key] !== undefined
            const overriddenStatus = hasOverride ? overridesMap[perm.key] : perm.status
            // Mark as "Overriding" if:
            // 1. Override contradicts the default (default exists but differs from override)
            // 2. Default is not defined (null) AND override is true
            const isConflicting = hasOverride && (
              (perm.status !== null && perm.status !== overridesMap[perm.key]) ||
              (perm.status === null && overridesMap[perm.key] === true)
            )
            return {
              ...perm,
              status: overriddenStatus,
              isOverriding: isConflicting,
            }
          }),
        }
      })

      setPermissions(finalPerms)
      setOriginalPermissions(JSON.parse(JSON.stringify(finalPerms)))
      setUpdatedPermissions({})
    } catch (err) {
      console.error('Error fetching permissions:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handlePermissionToggle = (permissionKey, currentStatus) => {
    // Check if this permission is disabled
    if (disabledPermissions[permissionKey]) {
      setShowDisabledDialog(true)
      return
    }

    let targetGroup = null
    let targetPermIndex = null

    Object.keys(permissions).forEach((groupKey) => {
      const permIndex = permissions[groupKey].permissions.findIndex(p => p.key === permissionKey)
      if (permIndex !== -1) {
        targetGroup = groupKey
        targetPermIndex = permIndex
      }
    })

    if (!targetGroup) return

    const newStatus = !currentStatus

    setPermissions((prev) => {
      const updated = { ...prev }
      const newPerms = [...updated[targetGroup].permissions]
      newPerms[targetPermIndex] = { ...newPerms[targetPermIndex], status: newStatus }
      updated[targetGroup] = { ...updated[targetGroup], permissions: newPerms }
      return updated
    })

    setUpdatedPermissions((prev) => ({
      ...prev,
      [permissionKey]: newStatus,
    }))
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)

      // Batch all permission updates into a single array
      const upsertRows = Object.keys(updatedPermissions).map((permissionKey) => ({
        company_id: companyId,
        staff_id: staffData.id,
        permission_key: permissionKey,
        allowed: updatedPermissions[permissionKey],
      }))

      // Single upsert call with onConflict to update existing rows
      const { error } = await supabase
        .from('staff_permission_overrides')
        .upsert(upsertRows, { 
          onConflict: 'staff_id,company_id,permission_key' 
        })

      if (error) throw error

      // Update local overrides
      const newOverrides = { ...staffOverrides }
      Object.keys(updatedPermissions).forEach((key) => {
        newOverrides[key] = updatedPermissions[key]
      })
      setStaffOverrides(newOverrides)

      setOriginalPermissions(JSON.parse(JSON.stringify(permissions)))
      setUpdatedPermissions({})
      setIsEditMode(false)

      // Refetch staff data from context to update automatically
      await refetchStaffData()

      // Refetch permissions data to update badges based on latest database state
      await fetchPermissionsData()
    } catch (err) {
      console.error('Error saving permissions:', err)
      setError(err?.message || 'Failed to save permissions')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchPermissionsData()
  }

  useEffect(() => {
    if (staffData?.id && staffData?.access_level && companyId) {
      fetchPermissionsData()
    }
  }, [staffData?.id, staffData?.access_level, companyId])

  if (isLoading) {
    return (
      <div className="p-6 h-full flex flex-col overflow-y-auto">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between mb-8 shrink-0">
          <Skeleton className="h-7 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>

        {/* Permissions Groups Skeleton */}
        <div className="flex-1 overflow-y-auto space-y-8">
          {[1, 2, 3].map((group) => (
            <Card key={group} className="overflow-hidden">
              {/* Group Header Skeleton */}
              <div className="bg-muted px-6 py-4 border-b">
                <Skeleton className="h-6 w-40" />
              </div>

              {/* Permission Rows Skeleton */}
              <div className="divide-y">
                {[1, 2, 3, 4].map((row) => (
                  <div key={row} className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-5 items-center">
                    <div className="md:col-span-5">
                      <Skeleton className="h-5 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                    <div className="md:col-span-2">
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="md:col-span-5 flex justify-end gap-3">
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-6 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="p-6 h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 shrink-0">
        <h4 className="text-lg font-semibold text-core">Staff Permissions Override</h4>

        <div className="flex gap-2">
          {isEditMode && Object.keys(updatedPermissions).length > 0 && (
            <Button
              onClick={handleSave}
              disabled={isSaving}
              variant="default"
              size="sm"
              className="bg-core hover:bg-core/90 text-white"
            >
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          )}

          <Button
            onClick={() => {
              setIsEditMode(!isEditMode)
              if (isEditMode) setUpdatedPermissions({})
            }}
            variant="outline"
            size="sm"
          >
            <Edit2 className="mr-2 h-4 w-4" />
            {isEditMode ? 'Cancel' : 'Edit'}
          </Button>

          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Permissions List */}
      <div className="flex-1 overflow-y-auto">
        {Object.keys(permissions).length === 0 ? (
          <Card className="p-8 text-center text-gray-500">
            No permissions available
          </Card>
        ) : (
          <TooltipProvider>
            {Object.entries(permissions).map(([groupKey, groupData]) => (
              <Card key={groupKey} className="mb-8 overflow-hidden">
                <div className="bg-muted px-6 py-4 border-b">
                  <h2 className="text-xl font-semibold">{groupData.label}</h2>
                </div>

                <div className="divide-y">
                  {groupData.permissions.map((perm) => {
                    const { currentState, originalState, isOverriding } = getPermissionState(groupKey, perm.key)
                    const hasChanged = updatedPermissions[perm.key] !== undefined
                    const isCompanyLevelOnly = permissionKeysMetadata[perm.key]?.includes_branch === false
                    const isDisabled = disabledPermissions[perm.key]

                    const permissionRow = (
                      <div
                        key={perm.key}
                        className={`grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-5 items-center hover:bg-muted/50 transition-colors ${isDisabled ? 'opacity-50' : ''}`}
                      >
                        <div className="md:col-span-5">
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{perm.label}</div>
                            {isCompanyLevelOnly && (
                              <span className="px-2 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                                Company level
                              </span>
                            )}
                            {isOverriding && !isEditMode && (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                                Overriding
                              </span>
                            )}
                            {isDisabled && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-500 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p>This staff is not a company level staff. To grant this user this permission, give the staff a company access level.</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {perm.description}
                          </div>
                        </div>

                        <div className="md:col-span-2 text-sm text-muted-foreground font-mono break-all">
                          {perm.key}
                        </div>

                        <div className="md:col-span-5 flex justify-end items-center gap-3">
                          {isEditMode ? (
                            <>
                              <div className="flex gap-3 items-center">
                                {hasChanged && (
                                  <>
                                    <div className="flex flex-col items-center">
                                      <div className="text-xs text-gray-500 mb-1">Original</div>
                                      {getStatusBadge(originalState)}
                                    </div>
                                    <div className="flex flex-col items-center">
                                      <div className="text-xs text-gray-500 mb-1">Updated</div>
                                      {getStatusBadge(currentState)}
                                    </div>
                                  </>
                                )}
                                {!hasChanged && (
                                  <>
                                    {getStatusBadge(currentState)}
                                    {isOverriding && (
                                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                                        Overriding
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>

                              {isDisabled ? (
                                <span className="px-3 py-1 text-xs font-medium text-gray-400 dark:text-gray-600">
                                  Company level
                                </span>
                              ) : (
                                <button
                                  onClick={() => handlePermissionToggle(perm.key, currentState)}
                                  className="px-3 py-1 text-xs font-medium rounded-md bg-core/10 text-core hover:bg-core/20 transition-colors"
                                >
                                  Toggle
                                </button>
                              )}
                            </>
                          ) : (
                            getStatusBadge(currentState)
                          )}
                        </div>
                      </div>
                    )

                    return isDisabled ? (
                      <Tooltip key={perm.key}>
                        <TooltipTrigger asChild>
                          {permissionRow}
                        </TooltipTrigger>
                      </Tooltip>
                    ) : (
                      permissionRow
                    )
                  })}
                </div>
              </Card>
            ))}
          </TooltipProvider>
        )}
      </div>

      {/* Company Level Access Dialog */}
      <AlertDialog open={showDisabledDialog} onOpenChange={setShowDisabledDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Company Level Access Required</AlertDialogTitle>
            <AlertDialogDescription>
              This staff does not have company access. This permission is company level and the staff does not have company access. Change the staff access to company access to enable this permission.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-3">
            <AlertDialogCancel>Close</AlertDialogCancel>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}