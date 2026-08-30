// hooks/useAccess.js
"use client"

import { useContext, useEffect, useState } from "react"
import { CompanyInfoContext } from "@/app/users/[u]/company/[companyId]/companyInfoProvider"
import supabase from "@/config/supabaseClient"

function permKey(category, scopeKey, permissionKey) {
  return `${category}:${scopeKey}:${permissionKey}`
}

export function useAccess() {
  const context = useContext(CompanyInfoContext)
  if (!context) throw new Error("useAccess must be used within CompanyInfoContext provider")

  const { accessLevel, accessLevelScope, branchId, suspended, staff_id, company_id } = context
  const isOwner = accessLevel === "owner"
  const isSuspended = suspended === true

  const [permissions, setPermissions] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!accessLevel) return

    if (isOwner) {
      setPermissions({})
      setIsLoading(false)
      return
    }

    let cancelled = false
    async function resolve() {
      setIsLoading(true)
      setError(null)
      try {
        // A permission's real identity is (category, scope_key,
        // permission_key) — NOT permission_key alone, which is just one
        // of six reused verbs shared across every resource. Selecting
        // only permission_key silently collided different resources'
        // permissions into one entry (e.g. staff.edit and branches.edit
        // would overwrite each other in `base`).
        const { data: roleDefaults, error: roleError } = await supabase
          .from("access_level_permissions")
          .select("category, scope_key, permission_key, allowed")
          .eq("access_level_key", accessLevel)
        if (roleError) throw roleError

        const base = {}
        ;(roleDefaults || []).forEach(({ category, scope_key, permission_key, allowed }) => {
          base[permKey(category, scope_key, permission_key)] = allowed
        })

        let overrides = {}
        if (staff_id && company_id) {
          const { data: overrideRows, error: overrideError } = await supabase
            .from("staff_permission_overrides")
            .select("category, scope_key, permission_key, allowed")
            .eq("staff_id", staff_id)
            .eq("company_id", company_id)
          if (overrideError) throw overrideError
          ;(overrideRows || []).forEach(({ category, scope_key, permission_key, allowed }) => {
            overrides[permKey(category, scope_key, permission_key)] = allowed
          })
        }

        const resolved = { ...base, ...overrides }
        if (isSuspended) Object.keys(resolved).forEach(k => { resolved[k] = false })

        if (!cancelled) setPermissions(resolved)
      } catch (err) {
        console.error("Error resolving permissions:", err)
        if (!cancelled) { setError(err.message); setPermissions({}) }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    resolve()
    return () => { cancelled = true }
  }, [accessLevel, staff_id, company_id, isSuspended, isOwner])

  // 'manage' implies every other verb — matches the backend
  // has_permission() logic (permission_key IN (p_permission_key,
  // 'manage')), so a role granted 'manage' on a resource passes any
  // specific verb check too.
  const checkOne = (scopeKey, permissionKey, category = "core") => {
    if (isOwner) return true
    if (isSuspended) return false
    return (
      permissions[permKey(category, scopeKey, permissionKey)] === true ||
      permissions[permKey(category, scopeKey, "manage")] === true
    )
  }

  return {
    permissions,
    isLoading,
    error,
    isOwner,
    isSuspended,
    accessLevel,
    accessLevelScope,
    branchId,
    isCompanyLevel: accessLevelScope === "company",
    isBranchLevel: accessLevelScope === "branch",
    // Primary API — mirrors the backend has_permission(company, category,
    // scope_key, permission_key) signature: hasPermission('staff_info', 'edit')
    hasPermission: (scopeKey, permissionKey, category = "core") =>
      checkOne(scopeKey, permissionKey, category),
    // Each check is { scopeKey, permissionKey, category? }
    hasAnyPermission: (checks = []) =>
      isOwner ? true : isSuspended ? false : checks.some(c => checkOne(c.scopeKey, c.permissionKey, c.category)),
    hasAllPermissions: (checks = []) =>
      isOwner ? true : isSuspended ? false : checks.every(c => checkOne(c.scopeKey, c.permissionKey, c.category)),
  }
}

export default useAccess