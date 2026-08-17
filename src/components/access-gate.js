// components/access-gate.js
"use client"
import { useAccess } from "@/hooks/use-access"

export function AccessGate({ permission, permissions, requireAll = true, fallback = null, children }) {
  const access = useAccess()
  if (access.isLoading) return null
  const keys = permission ? [permission] : permissions || []
  const ok = requireAll ? access.hasAllPermissions(keys) : access.hasAnyPermission(keys)
  return ok ? children : fallback
}