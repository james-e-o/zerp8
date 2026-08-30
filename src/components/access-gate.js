// components/access-gate.js
"use client"
import { useAccess } from "@/hooks/use-access"

/**
 * Conditionally renders `children` based on the current staff member's
 * permissions. Two ways to use it:
 *
 * Single permission:
 *   <AccessGate resource="company_info" verb="view">
 *     <SettingsButton />
 *   </AccessGate>
 *
 * Multiple permissions:
 *   <AccessGate checks={[{ scopeKey: 'staff_info', permissionKey: 'edit' },
 *                         { scopeKey: 'staff_info', permissionKey: 'create' }]}
 *               requireAll={false}>
 *     <ManageStaffButton />
 *   </AccessGate>
 *
 * `category` defaults to 'core' (module permissions would pass
 * category="module"). `fallback` renders instead when the check fails —
 * omit it to render nothing.
 */
export function AccessGate({
  resource,
  verb,
  checks,
  requireAll = true,
  category = "core",
  fallback = null,
  children,
}) {
  const access = useAccess()
  if (access.isLoading) return null

  const list = resource && verb
    ? [{ scopeKey: resource, permissionKey: verb, category }]
    : checks || []

  const ok = requireAll ? access.hasAllPermissions(list) : access.hasAnyPermission(list)
  return ok ? children : fallback
}