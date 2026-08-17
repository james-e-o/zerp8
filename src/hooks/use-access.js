// hooks/useAccess.js
"use client"

import { useContext, useEffect, useState } from "react"
import { CompanyInfoContext } from "@/app/users/[u]/company/[companyId]/companyInfoProvider"
import supabase from "@/config/supabaseClient"

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
        const { data: roleDefaults, error: roleError } = await supabase
          .from("access_level_permissions")
          .select("permission_key, allowed")
          .eq("access_level_key", accessLevel)
        if (roleError) throw roleError

        const base = {}
        ;(roleDefaults || []).forEach(({ permission_key, allowed }) => { base[permission_key] = allowed })

        let overrides = {}
        if (staff_id && company_id) {
          const { data: overrideRows, error: overrideError } = await supabase
            .from("staff_permission_overrides")
            .select("permission_key, allowed")
            .eq("staff_id", staff_id)
            .eq("company_id", company_id)
          if (overrideError) throw overrideError
          ;(overrideRows || []).forEach(({ permission_key, allowed }) => { overrides[permission_key] = allowed })
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
    hasPermission: (key) => isOwner ? true : isSuspended ? false : permissions[key] === true,
    hasAnyPermission: (keys = []) => isOwner ? true : isSuspended ? false : keys.some(k => permissions[k] === true),
    hasAllPermissions: (keys = []) => isOwner ? true : isSuspended ? false : keys.every(k => permissions[k] === true),
  }
}

export default useAccess