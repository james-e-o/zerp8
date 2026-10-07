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

// Sub-tabs shown inside the "Modules" tab. UI only for now - every entry
// other than 'products' renders an empty placeholder; nothing here filters
// which permission groups belong to which module yet. Add entries here
// when that's ready, no other changes needed.
const MODULE_SUB_TABS = [
  { key: 'products', label: 'Products' },
  { key: 'sales', label: 'Sales' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'inventory', label: 'Inventory' },
]

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

  // Branch access now comes straight from get_staff_branch_access(), one row
  // per branch: { branch_id, branch_name, is_default, has_override, has_access }.
  // No more client-side default computation.
  const [branchAccessRows, setBranchAccessRows] = useState([])
  const [selectedBranchIds, setSelectedBranchIds] = useState([])
  const [originalBranchIds, setOriginalBranchIds] = useState([])
  const [originalBranchOverrideIds, setOriginalBranchOverrideIds] = useState([])

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

  // Which sub-tab is active inside "Modules" (Products / Sales / Purchases /
  // Inventory). Display-only, same as activeTab above - doesn't affect
  // fetch/merge/save logic.
  const [activeModuleTab, setActiveModuleTab] = useState('products')

  // Which sub-tab is active inside "Core" (Branches / Company / Staff /
  // whatever groups the data actually has). Unlike the Modules sub-tabs,
  // these are real - derived straight from the groups already present in
  // `permissions`, not a static placeholder list - so this is populated
  // once data loads, kept in sync whenever permissions changes (see effect
  // below), and defaults to the first available group.
  const [activeCoreTab, setActiveCoreTab] = useState(null)

  // Holds the toggle that's waiting on the branch-warning confirmation.
  // Shape: { permissionKey, currentStatus } | null
  const [pendingBranchToggle, setPendingBranchToggle] = useState(null)

  // Derived views over branchAccessRows — kept as plain consts so nothing else
  // in the render tree has to know about the row shape.
  const branches = branchAccessRows.map((r) => ({ id: r.branch_id, name: r.branch_name }))
  const defaultBranchIds = branchAccessRows.filter((r) => r.is_default).map((r) => r.branch_id)

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
        <span className="rounded-sm bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
          Allowed
        </span>
      )
    } else if (status === false) {
      return (
        <span className="rounded-sm bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
          Not Allowed
        </span>
      )
    } else {
      return (
        <span className="rounded-sm bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
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
      // Still needed here for the permission-tab branch-warning logic
      // (needsBranchWarning) — unrelated to the Branch Access tab itself.
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

      // Step 3.5 (Branch Access tab): single RPC call replaces the previous
      // separate `branches` + `staff_branch_overrides` fetches and the
      // client-side default computation. The backend now owns the
      // is_default / has_override / has_access resolution entirely.
      const { data: branchAccessData, error: branchAccessError } = await supabase
        .rpc('get_staff_branch_access', {
          p_staff_id: staffData.id,
          p_company_id: companyId,
        })

      if (branchAccessError) throw branchAccessError

      const rows = branchAccessData || []
      setBranchAccessRows(rows)

      const effectiveIds = rows.filter((r) => r.has_access).map((r) => r.branch_id)
      const overrideIds = rows.filter((r) => r.has_override).map((r) => r.branch_id)

      setSelectedBranchIds(effectiveIds)
      setOriginalBranchIds(effectiveIds)
      setOriginalBranchOverrideIds(overrideIds)

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

      if (upsertRows.length > 0) {
        const { error } = await supabase
          .from('staff_permission_overrides')
          .upsert(upsertRows, {
            onConflict: 'staff_id,company_id,category,scope_key,permission_key'
          })

        if (error) throw error
      }

           // A branch needs an override row whenever the user's selection
      // disagrees with that branch's backend-computed default — but now we
      // write the EXPLICIT allowed value, not just presence of a row.
      const branchesNeedingOverride = branches.filter(
        (branch) => defaultBranchIds.includes(branch.id) !== selectedBranchIds.includes(branch.id)
      )
      const branchOverrideIds = branchesNeedingOverride.map((b) => b.id)
      const branchUpsertRows = branchesNeedingOverride.map((branch) => ({
        staff_id: staffData.id,
        company_id: companyId,
        branch_id: branch.id,
        allowed: selectedBranchIds.includes(branch.id),
      }))

      if (branchUpsertRows.length > 0) {
        const { error: branchUpsertError } = await supabase
          .from('staff_branch_overrides')
          .upsert(branchUpsertRows, { onConflict: 'staff_id,branch_id' })

        if (branchUpsertError) throw branchUpsertError
      }

      const removedBranchIds = originalBranchOverrideIds.filter(
        (branchId) => !branchOverrideIds.includes(branchId)
      )

      if (removedBranchIds.length > 0) {
        const { error: branchDeleteError } = await supabase
          .from('staff_branch_overrides')
          .delete()
          .eq('staff_id', staffData.id)
          .eq('company_id', companyId)
          .in('branch_id', removedBranchIds)

        if (branchDeleteError) throw branchDeleteError
      }
      // Update local overrides
      const newOverrides = { ...staffOverrides }
      Object.keys(updatedPermissions).forEach((compositeKey) => {
        newOverrides[compositeKey] = updatedPermissions[compositeKey].allowed
      })
      setStaffOverrides(newOverrides)

      setOriginalPermissions(JSON.parse(JSON.stringify(permissions)))
      setOriginalBranchIds(selectedBranchIds)
      setOriginalBranchOverrideIds(branchOverrideIds)
      setUpdatedPermissions({})
      setIsEditMode(false)

      // Refetch staff data from context to update automatically
      await refetchStaffData()

      // Refetch permissions data (incl. branch access via the RPC) to update
      // badges based on latest database state
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

  const handleBranchToggle = (branchId) => {
    setSelectedBranchIds((currentIds) => (
      currentIds.includes(branchId)
        ? currentIds.filter((id) => id !== branchId)
        : [...currentIds, branchId]
    ))
  }

  useEffect(() => {
    if (staffData?.id && staffData?.access_level && companyId) {
      fetchPermissionsData()
    }
  }, [staffData?.id, staffData?.access_level, companyId])

  // Keep activeCoreTab pointed at a real group. Recomputes from `permissions`
  // directly (rather than trusting a possibly-stale derived list) so this
  // stays correct after every fetch/refresh, including when the set of
  // groups itself changes.
  useEffect(() => {
    const coreGroupKeys = Object.entries(permissions)
      .filter(([, groupData]) => groupData.permissions.some((perm) => (perm.category || 'core') === 'core'))
      .map(([groupKey]) => groupKey)

    if (coreGroupKeys.length === 0) return

    setActiveCoreTab((current) => (current && coreGroupKeys.includes(current) ? current : coreGroupKeys[0]))
  }, [permissions])

  if (isLoading) {
    return (
      <div className="h-full p-3 text-xs flex flex-col overflow-y-auto">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <Skeleton className="h-5 w-40" />
          <div className="flex gap-1.5">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-7 w-20" />
          </div>
        </div>

        {/* Permissions Groups Skeleton */}
        <div className="flex-1 overflow-y-auto space-y-4">
          {[1, 2, 3].map((group) => (
            <Card key={group} className="overflow-hidden rounded-sm border-border bg-card shadow-none">
              {/* Group Header Skeleton */}
              <div className="bg-muted px-4 py-3 border-b border-border">
                <Skeleton className="h-4 w-32" />
              </div>

              {/* Permission Rows Skeleton */}
              <div className="divide-y">
                {[1, 2, 3, 4].map((row) => (
                  <div key={row} className="grid grid-cols-1 md:grid-cols-12 gap-3 px-4 py-3 items-center">
                    <div className="md:col-span-5">
                      <Skeleton className="h-4 w-3/4 mb-1.5" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                    <div className="md:col-span-2">
                      <Skeleton className="h-3 w-28" />
                    </div>
                    <div className="md:col-span-5 flex justify-end gap-3">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-14" />
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
      <div className="p-3 text-xs">
        <p className="border border-red-200 bg-red-50 p-3 text-red-600">Error: {error}</p>
      </div>
    )
  }

  // Shared renderer for the Core / Products module-tab permission list — the
  // exact same grouping/filtering logic as before, just factored out so it
  // can be called from either the Core tab or the Modules -> Products
  // sub-tab without duplicating the JSX.
  const renderPermissionGroups = (categoryKey, emptyLabel, restrictToGroupKey = null) => {
    const visibleGroups = Object.entries(permissions)
      .map(([groupKey, groupData]) => [
        groupKey,
        {
          ...groupData,
          permissions: groupData.permissions.filter((perm) => (perm.category || 'core') === categoryKey),
        },
      ])
      .filter(([groupKey, groupData]) => groupData.permissions.length > 0 && (!restrictToGroupKey || groupKey === restrictToGroupKey))

    if (visibleGroups.length === 0) {
      return (
        <Card className="rounded-sm border-border bg-card p-6 text-center text-xs text-muted-foreground shadow-none">
          No {emptyLabel} permissions available
        </Card>
      )
    }

    return (
      <TooltipProvider>
        {visibleGroups.map(([groupKey, groupData]) => (
          <Card key={groupKey} className="mb-4 overflow-hidden rounded-sm border-border bg-card shadow-none">
            <div className="bg-muted px-4 py-3 border-b border-border">
              <h2 className="text-xs font-semibold text-foreground">{groupData.label}</h2>
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
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 px-4 py-3 items-center hover:bg-muted/50 transition-colors"
                  >
                    <div className="md:col-span-5">
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-medium text-foreground">{perm.label}</div>
                        {isCompanyLevelOnly && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                            Company level
                          </span>
                        )}
                        {isOverriding && !isEditMode && (
                            <span className="rounded-sm bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                            Overriding
                          </span>
                        )}
                        {isBranchRestricted && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertCircle className="size-4 text-amber-600 dark:text-amber-500 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>This staff is not a company level staff. This permission is company level — overriding it will grant company-level access to a branch-scoped staff member.</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <div className="text-[11px] leading-4 text-muted-foreground mt-1">
                        {perm.description}
                      </div>
                    </div>

                    <div className="md:col-span-2 text-[10px] text-muted-foreground font-mono break-all">
                      {perm.key}
                    </div>

                    <div className="md:col-span-5 flex justify-end items-center gap-2">
                      {isEditMode ? (
                        <>
                          <div className="flex gap-2 items-center">
                            {hasChanged && (
                              <>
                                <div className="flex flex-col items-center">
                                  <div className="text-[10px] text-muted-foreground mb-1">Original</div>
                                  {getStatusBadge(originalState)}
                                </div>
                                <div className="flex flex-col items-center">
                                  <div className="text-[10px] text-muted-foreground mb-1">Updated</div>
                                  {getStatusBadge(currentState)}
                                </div>
                              </>
                            )}
                            {!hasChanged && (
                              <>
                                {getStatusBadge(currentState)}
                                {isOverriding && (
                                  <span className="rounded-sm bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                                    Overriding
                                  </span>
                                )}
                              </>
                            )}
                          </div>

                          <button
                            onClick={() => handlePermissionToggle(perm.key, currentState)}
                            className="rounded-sm bg-core_light px-2.5 py-1 text-[10px] font-medium text-core hover:bg-core_light/80 transition-colors"
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
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto text-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h4 className="text-xs mx-1.5 font-semibold text-foreground">Staff Permissions Override</h4>

        <div className="flex gap-1.5">
          {isEditMode && Object.keys(updatedPermissions).length > 0 && (
            <Button
              onClick={handleSave}
              disabled={isSaving}
              variant="default"
              size="sm"
              className="h-7 rounded-sm bg-core px-2.5 text-[11px] text-white hover:bg-core/90"
            >
              <Save className="mr-1.5 size-3.5" />
              Save Changes
            </Button>
          )}

          {isEditMode && JSON.stringify(selectedBranchIds) !== JSON.stringify(originalBranchIds) && Object.keys(updatedPermissions).length === 0 && (
            <Button
              onClick={handleSave}
              disabled={isSaving}
              variant="default"
              size="sm"
              className="h-7 rounded-sm bg-core px-2.5 text-[11px] text-white hover:bg-core/90"
            >
              <Save className="mr-1.5 size-3.5" />
              Save Changes
            </Button>
          )}

          <Button
            onClick={() => {
              setIsEditMode(!isEditMode)
              if (isEditMode) {
                setUpdatedPermissions({})
                setSelectedBranchIds(originalBranchIds)
              }
            }}
            variant="outline"
            size="sm"
            className="h-6 rounded-sm px-2.5 text-[11px]"
          >
            <Edit2 className="mr-1.5 size-3.5" />
            {isEditMode ? 'Cancel' : 'Edit'}
          </Button>

          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
            className="h-6 rounded-sm px-2.5 text-[11px]"
          >
            <RefreshCw className={`mr-1.5 size-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Core / Module Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-3 shrink-0">
        <TabsList className="h-8 w-fit gap-1 rounded-sm bg-muted px-1 ">
          <TabsTrigger value="core" className="h-6 rounded-sm px-3 text-[11px]">Core</TabsTrigger>
          <TabsTrigger value="module" className="h-6 rounded-sm px-3 text-[11px]">Modules</TabsTrigger>
          <TabsTrigger value="branch-access" className="h-6 rounded-sm px-3 text-[11px]">Branch Access</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Modules -> Products / Sales / Purchases / Inventory sub-tabs.
          Same TabsList/TabsTrigger styling as the row above. Only shown
          while the "Modules" tab is active. UI only - Sales/Purchases/
          Inventory are empty placeholders for now. */}
      {activeTab === 'module' && (
        <Tabs value={activeModuleTab} onValueChange={setActiveModuleTab} className="mb-3 shrink-0">
          <TabsList className="h-8 w-fit gap-1 rounded-sm bg-muted px-1 ">
            {MODULE_SUB_TABS.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key} className="h-6 rounded-sm px-3 text-[11px]">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Core -> one sub-tab per real group (Branches / Company / Staff /
          etc). Same styling as the Modules sub-tab row above, but unlike
          that one these are live: built from whatever groups actually have
          core-category permissions in `permissions`, not a fixed list. */}
      {activeTab === 'core' && (() => {
        const coreGroupTabs = Object.entries(permissions)
          .filter(([, groupData]) => groupData.permissions.some((perm) => (perm.category || 'core') === 'core'))
          .map(([groupKey, groupData]) => ({ key: groupKey, label: groupData.label }))

        if (coreGroupTabs.length === 0) return null

        return (
          <Tabs value={activeCoreTab || coreGroupTabs[0].key} onValueChange={setActiveCoreTab} className="mb-3 shrink-0">
            <TabsList className="h-8 w-fit gap-1 rounded-sm bg-muted px-1 ">
              {coreGroupTabs.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key} className="h-6 rounded-sm px-3 text-[11px]">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )
      })()}

      {/* Permissions List */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'branch-access' ? (
          branches.length === 0 ? (
            <Card className="rounded-sm border-border bg-card p-6 text-center text-xs text-muted-foreground shadow-none">
              No branches available
            </Card>
          ) : (
            <Card className="overflow-hidden rounded-sm border-border bg-card shadow-none">
              <div className="bg-muted px-4 py-3 border-b border-border">
                <h2 className="text-xs font-semibold text-foreground">Branch Access</h2>
              </div>
              <div className="divide-y">
                {branches.map((branch) => {
                  const isSelected = selectedBranchIds.includes(branch.id)
                  const hasDefaultAccess = defaultBranchIds.includes(branch.id)
                  const isOverriding = isSelected !== hasDefaultAccess

                  return (
                    <div
                      key={branch.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-xs font-medium text-foreground">{branch.name}</span>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(isSelected)}
                          <span className="text-[10px] text-muted-foreground">
                          {isOverriding ? 'Overriding' : 'Default'}
                        </span>
                        {isEditMode && (
                          <button
                            onClick={() => handleBranchToggle(branch.id)}
                            className="rounded-sm bg-core_light px-2.5 py-1 text-[10px] font-medium text-core hover:bg-core_light/80 transition-colors"
                          >
                            Toggle
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )
        ) : activeTab === 'module' ? (
          activeModuleTab === 'products' ? (
            renderPermissionGroups('module', 'module')
          ) : (
            <Card className="rounded-sm border-border bg-card p-6 text-center text-xs text-muted-foreground shadow-none">
              No {MODULE_SUB_TABS.find((tab) => tab.key === activeModuleTab)?.label} permissions configured yet
            </Card>
          )
        ) : (
          renderPermissionGroups('core', 'core', activeCoreTab)
        )}
      </div>

      {/* Branch-level staff / company-level permission warning */}
      <AlertDialog open={!!pendingBranchToggle} onOpenChange={(open) => { if (!open) cancelBranchToggle() }}>
        <AlertDialogContent className="rounded-sm border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold">Company-Level Permission Override</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              This staff is not a company-level staff. Are you sure you want to override this permission for them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel onClick={cancelBranchToggle} className="h-7 rounded-sm px-2.5 text-[11px]">Cancel</AlertDialogCancel>
            <AlertDialogAction className="h-7 rounded-sm bg-core px-2.5 text-[11px] text-white hover:bg-core/90" onClick={confirmBranchToggle}>Continue</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}