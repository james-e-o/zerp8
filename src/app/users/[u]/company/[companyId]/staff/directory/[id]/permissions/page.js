// components/permissions-tab.jsx
'use client'

import { useState, useEffect, useContext } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import supabase from '@/config/supabaseClient'
import { RefreshCw, Edit2, Save, AlertCircle } from 'lucide-react'
import { useParams } from 'next/navigation'
import { StaffContext } from '@/components/contexts/staff-context'

export default function PermissionsTab() {
  const { id, companyId } = useParams()
  const { getAccessLevelPermissions, permissionKeysMetadata, refetchStaffData } = useContext(StaffContext)
  const [staffData, setStaffData] = useState(null)

  const [permissions, setPermissions] = useState({})
  const [originalPermissions, setOriginalPermissions] = useState({})
  // Keyed by composite "resource_key:permission_key" ->
  // { resource_key, permission_key, category, allowed }
  const [updatedPermissions, setUpdatedPermissions] = useState({})
  const [staffOverrides, setStaffOverrides] = useState({})
  const [staffAccessScope, setStaffAccessScope] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [isEditMode, setIsEditMode] = useState(false)

  // Which tab is active: 'core' or 'module'. Filters what's displayed only —
  // fetch/merge/save logic is unaffected, and category is read per-permission
  // in case a single resource group ever mixes core + module permissions.
  const [activeTab, setActiveTab] = useState('core')

  // Holds the toggle that's waiting on the branch-warning confirmation.
  // Shape: { permissionKey, currentStatus } | null
  const [pendingBranchToggle, setPendingBranchToggle] = useState(null)

  useEffect(() => {
    const fetchStaffData = async () => {
      try {
        const { data, error } = await supabase
          .from('staff')
          .select('*')
          .eq('id', id)
          .eq('company', companyId)
          .single()

        if (error) throw error
        setStaffData(data)
      } catch (err) {
        console.error('Error fetching staff:', err)
        setError(err.message)
      }
    }

    if (id && companyId) {
      fetchStaffData()
    }
  }, [id, companyId])

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

      // Step 1: Get staff's access level scope (branch or company).
      // Still needed — it drives whether the branch-override warning applies.
      const { data: accessLevelData, error: accessLevelError } = await supabase
        .from('access_level')
        .select('access')
        .eq('key', staffData.access_level)
        .single()

      if (accessLevelError) throw accessLevelError

      const scope = accessLevelData?.access // 'branch' or 'company'
      setStaffAccessScope(scope)

      // Step 2: Get merged default permissions from access level (includes category)
      const mergedPerms = await getAccessLevelPermissions(staffData.access_level)

      // Step 3: Get this staff's overrides
      const { data: overrides, error: overridesError } = await supabase
        .from('staff_permission_overrides')
        .select('scope_key, permission_key, allowed, category')
        .eq('staff_id', staffData.id)
        .eq('company_id', companyId)

      if (overridesError) throw overridesError

      const overridesMap = {}
      ;(overrides || []).forEach((override) => {
        const compositeKey = `${override.scope_key}:${override.permission_key}`
        overridesMap[compositeKey] = override.allowed
      })
      setStaffOverrides(overridesMap)

      // Step 4: Build final permissions with overrides applied.
      // category always comes from the access-level default row — it's the
      // same underlying resource whether the value is defaulted or overridden.
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

  // Does toggling this permission need the "staff isn't company-level" warning?
  // True only when the staff's own access level is branch-scoped AND this
  // specific permission is marked company-only (includes_branch === false).
  const needsBranchWarning = (permissionKey) => {
    const includesBranch = permissionKeysMetadata[permissionKey]?.includes_branch
    return staffAccessScope === 'branch' && includesBranch === false
  }

  // Performs the actual toggle — no gating, called either directly or after
  // the user confirms the branch-warning dialog.
  const applyToggle = (permissionKey, currentStatus) => {
    let targetGroup = null
    let targetPermIndex = null
    let targetPerm = null

    Object.keys(permissions).forEach((groupKey) => {
      const permIndex = permissions[groupKey].permissions.findIndex(p => p.key === permissionKey)
      if (permIndex !== -1) {
        targetGroup = groupKey
        targetPermIndex = permIndex
        targetPerm = permissions[groupKey].permissions[permIndex]
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
      [permissionKey]: {
        resource_key: targetPerm.resource_key,
        permission_key: targetPerm.permission_key,
        category: targetPerm.category || 'core',
        allowed: newStatus,
      },
    }))
  }

  const handlePermissionToggle = (permissionKey, currentStatus) => {
    if (needsBranchWarning(permissionKey)) {
      setPendingBranchToggle({ permissionKey, currentStatus })
      return
    }

    applyToggle(permissionKey, currentStatus)
  }

  const confirmBranchToggle = () => {
    if (pendingBranchToggle) {
      applyToggle(pendingBranchToggle.permissionKey, pendingBranchToggle.currentStatus)
    }
    setPendingBranchToggle(null)
  }

  const cancelBranchToggle = () => {
    setPendingBranchToggle(null)
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)

      // Batch all permission updates into a single array.
      // The database schema stores the canonical category on the permission
      // definition, and override rows must mirror that value.
      const upsertRows = Object.values(updatedPermissions).map((item) => ({
        company_id: companyId,
        staff_id: staffData.id,
        category: item.category || 'core',
        scope_key: item.resource_key,
        permission_key: item.permission_key,
        allowed: item.allowed,
      }))

      // Single upsert call with onConflict to update existing rows
      const { error } = await supabase
        .from('staff_permission_overrides')
        .upsert(upsertRows, {
          onConflict: 'staff_id,company_id,category,scope_key,permission_key'
        })

      if (error) throw error

      // Update local overrides
      const newOverrides = { ...staffOverrides }
      Object.keys(updatedPermissions).forEach((compositeKey) => {
        newOverrides[compositeKey] = updatedPermissions[compositeKey].allowed
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
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h4 className="text-base  font-semibold text-core">Staff Permissions Override</h4>

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

      {/* Core / Module Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-3 shrink-0">
        <TabsList className=" w-[260px] md:w-[300px] px-2 py-1">
          <TabsTrigger value="core" className="min-w-[120px] text-sm">Core</TabsTrigger>
          <TabsTrigger value="module" className="min-w-[120px] text-sm">Modules</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Permissions List */}
      <div className="flex-1 overflow-y-auto">
        {(() => {
          // Filter to groups that have at least one permission matching the
          // active tab, and within each group, only render matching permissions.
          const visibleGroups = Object.entries(permissions)
            .map(([groupKey, groupData]) => [
              groupKey,
              {
                ...groupData,
                permissions: groupData.permissions.filter((perm) => (perm.category || 'core') === activeTab),
              },
            ])
            .filter(([, groupData]) => groupData.permissions.length > 0)

          if (visibleGroups.length === 0) {
            return (
              <Card className="p-8 text-center text-gray-500">
                No {activeTab === 'core' ? 'core' : 'module'} permissions available
              </Card>
            )
          }

          return (
            <TooltipProvider>
              {visibleGroups.map(([groupKey, groupData]) => (
                <Card key={groupKey} className="mb-8 overflow-hidden">
                  <div className="bg-muted px-6 py-4 border-b">
                    <h2 className="text-xl font-semibold">{groupData.label}</h2>
                  </div>

                  <div className="divide-y">
                    {groupData.permissions.map((perm) => {
                      const { currentState, originalState, isOverriding } = getPermissionState(groupKey, perm.key)
                      const hasChanged = updatedPermissions[perm.key] !== undefined
                      const isCompanyLevelOnly = permissionKeysMetadata[perm.key]?.includes_branch === false
                      const isBranchRestricted = isCompanyLevelOnly && staffAccessScope === 'branch'

                      return (
                        <div
                          key={perm.key}
                          className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-5 items-center hover:bg-muted/50 transition-colors"
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
                              {isBranchRestricted && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-500 cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p>This staff is not a company level staff. This permission is company level — overriding it will grant company-level access to a branch-scoped staff member.</p>
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

                                <button
                                  onClick={() => handlePermissionToggle(perm.key, currentState)}
                                  className="px-3 py-1 text-xs font-medium rounded-md bg-core/10 text-core hover:bg-core/20 transition-colors"
                                >
                                  Toggle
                                </button>
                              </>
                            ) : (
                              getStatusBadge(currentState)
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              ))}
            </TooltipProvider>
          )
        })()}
      </div>

      {/* Branch-level staff / company-level permission warning */}
      <AlertDialog open={!!pendingBranchToggle} onOpenChange={(open) => { if (!open) cancelBranchToggle() }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Company-Level Permission Override</AlertDialogTitle>
            <AlertDialogDescription>
              This staff is not a company-level staff. Are you sure you want to override this permission for them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-3">
            <AlertDialogCancel onClick={cancelBranchToggle}>Cancel</AlertDialogCancel>
            <AlertDialogAction className={'bg-core'} onClick={confirmBranchToggle}>Continue</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}