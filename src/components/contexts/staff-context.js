'use client'

import { createContext, useState, useEffect } from 'react';
import supabase from '@/config/supabaseClient';

export const StaffContext = createContext();

// Resource keys that should be visually folded into a parent group in the
// permissions UI. Only staff/company/branch have a split "_info" table.
const SUPER_GROUP_MAP = {
  staff_info: 'staff',
  company_info: 'company',
  branch_info: 'branch',
};

function getSuperGroupKey(resourceKey) {
  return SUPER_GROUP_MAP[resourceKey] || resourceKey;
}

function toLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export function StaffProvider({ children, companyId }) {
  const [staffData, setStaffData] = useState([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);
  const [error, setError] = useState(null);
  const [permissionKeys, setPermissionKeys] = useState({});
  const [permissionKeysMetadata, setPermissionKeysMetadata] = useState({});
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);

  // Count of items awaiting attention on the Onboarding page
  // (pending invitations + pending staff onboarding submissions),
  // used to render the notification badge on the Onboarding nav tab.
  const [pendingOnboardingCount, setPendingOnboardingCount] = useState(0);
  const [isLoadingOnboardingCount, setIsLoadingOnboardingCount] = useState(true);

  // Fetch staff data on mount and when companyId changes
  useEffect(() => {
    async function fetchStaffData() {
      if (!companyId) {
        setIsLoadingStaff(false);
        return;
      }

      try {
        setIsLoadingStaff(true);
        setError(null);

        const { data: staff, error: fetchError } = await supabase
          .from('staff')
          .select('*, staff_info(date_hired)')
          .eq('company', companyId)
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('Error fetching staff data:', fetchError);
          setError(fetchError.message);
        } else {
          setStaffData(
            (staff || []).map((item) => ({
              ...item,
              date_hired: item.staff_info?.[0]?.date_hired || null,
            }))
          );
        }
      } catch (error) {
        console.error('Error fetching staff data:', error);
        setError(error.message);
      } finally {
        setIsLoadingStaff(false);
      }
    }

    fetchStaffData();
  }, [companyId]);

  // Fetch permission keys on mount.
  // These rows carry the canonical category (core or module) for each
  // permission definition, and the access-level/override rows should match it.
  useEffect(() => {
    async function fetchPermissionKeys() {
      try {
        setIsLoadingPermissions(true);

        const { data: allPermissions, error: permError } = await supabase
          .from('permission_keys')
          .select('*')
          .order('resource_key', { ascending: true });

        if (permError) throw permError;

        // Build metadata map keyed by composite "resource_key:permission_key"
        const metadata = {};
        (allPermissions || []).forEach((perm) => {
          const compositeKey = `${perm.resource_key}:${perm.permission_key}`;
          metadata[compositeKey] = {
            includes_branch: perm.includes_branch !== false,
            category: perm.category || 'core',
          };
        });
        setPermissionKeysMetadata(metadata);

        // Group by super-group (resource_key, with *_info tables folded
        // into their parent resource — staff_info -> staff, etc.)
        const groupedPerms = {};
        (allPermissions || []).forEach((perm) => {
          const superGroupKey = getSuperGroupKey(perm.resource_key);
          if (!groupedPerms[superGroupKey]) {
            groupedPerms[superGroupKey] = {
              label: toLabel(superGroupKey),
              permissions: [],
            };
          }
          groupedPerms[superGroupKey].permissions.push({
            key: `${perm.resource_key}:${perm.permission_key}`,
            resource_key: perm.resource_key,
            permission_key: perm.permission_key,
            label: perm.name,
            description: perm.description,
            status: null,
            category: perm.category || 'core',
          });
        });

        setPermissionKeys(groupedPerms);
      } catch (error) {
        console.error('Error fetching permission keys:', error);
      } finally {
        setIsLoadingPermissions(false);
      }
    }

    fetchPermissionKeys();
  }, []);

  // Fetch counts for the Onboarding notification badge:
  // pending company_invites + pending staff_pending_acceptance records.
  useEffect(() => {
    async function fetchPendingOnboardingCount() {
      if (!companyId) {
        setIsLoadingOnboardingCount(false);
        return;
      }

      try {
        setIsLoadingOnboardingCount(true);

        const [invitesResult, staffPendingResult] = await Promise.all([
          supabase
            .from('company_invites')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .eq('status', 'pending'),
          supabase
            .from('staff_pending_acceptance')
            .select('id', { count: 'exact', head: true })
            .eq('company', companyId)
            .eq('status', 'pending'),
        ]);

        if (invitesResult.error) throw invitesResult.error;
        if (staffPendingResult.error) throw staffPendingResult.error;

        const total = (invitesResult.count || 0) + (staffPendingResult.count || 0);
        setPendingOnboardingCount(total);
      } catch (error) {
        console.error('Error fetching pending onboarding count:', error);
        setPendingOnboardingCount(0);
      } finally {
        setIsLoadingOnboardingCount(false);
      }
    }

    fetchPendingOnboardingCount();
  }, [companyId]);

  // Function to fetch access level (default) permissions for a given access level.
  // category is the canonical permission definition on permission_keys, while
  // access_level_permissions and staff_permission_overrides mirror that value.
  const getAccessLevelPermissions = async (accessLevelKey) => {
    try {
      const { data: levelPermissions, error: levelError } = await supabase
        .from('access_level_permissions')
        .select('scope_key, permission_key, allowed, category')
        .eq('access_level_key', accessLevelKey);

      if (levelError) throw levelError;

      // Create lookup map keyed by composite "resource_key:permission_key"
      const statusMap = {};
      const categoryMap = {};
      (levelPermissions || []).forEach((item) => {
        const compositeKey = `${item.scope_key}:${item.permission_key}`;
        statusMap[compositeKey] = item.allowed;
        categoryMap[compositeKey] = item.category || 'core';
      });

      // Merge status + category into grouped permissions
      const mergedPerms = {};
      Object.keys(permissionKeys).forEach((groupKey) => {
        mergedPerms[groupKey] = {
          ...permissionKeys[groupKey],
          permissions: permissionKeys[groupKey].permissions.map((perm) => ({
            ...perm,
            status: statusMap[perm.key] !== undefined ? statusMap[perm.key] : null,
            category: categoryMap[perm.key] !== undefined ? categoryMap[perm.key] : (perm.category || 'core'),
          })),
        };
      });

      return mergedPerms;
    } catch (error) {
      console.error('Error fetching access level permissions:', error);
      throw error;
    }
  };

  // Function to refetch staff data manually
  const refetchStaffData = async () => {
    if (!companyId) return;

    try {
      setIsLoadingStaff(true);
      setError(null);

      const { data: staff, error: fetchError } = await supabase
        .from('staff')
        .select('*, staff_info(date_hired)')
        .eq('company', companyId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error refetching staff data:', fetchError);
        setError(fetchError.message);
      } else {
        setStaffData(
          (staff || []).map((item) => ({
            ...item,
            date_hired: item.staff_info?.[0]?.date_hired || null,
          }))
        );
      }
    } catch (error) {
      console.error('Error refetching staff data:', error);
      setError(error.message);
    } finally {
      setIsLoadingStaff(false);
    }
  };

  // Function to refetch the onboarding badge count manually
  // (call this after accepting/rejecting an invite or a pending staff record
  // so the badge updates immediately without a full page reload).
  const refetchPendingOnboardingCount = async () => {
    if (!companyId) return;

    try {
      setIsLoadingOnboardingCount(true);

      const [invitesResult, staffPendingResult] = await Promise.all([
        supabase
          .from('company_invites')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('status', 'pending'),
        supabase
          .from('staff_pending_acceptance')
          .select('id', { count: 'exact', head: true })
          .eq('company', companyId)
          .eq('status', 'pending'),
      ]);

      if (invitesResult.error) throw invitesResult.error;
      if (staffPendingResult.error) throw staffPendingResult.error;

      const total = (invitesResult.count || 0) + (staffPendingResult.count || 0);
      setPendingOnboardingCount(total);
    } catch (error) {
      console.error('Error refetching pending onboarding count:', error);
    } finally {
      setIsLoadingOnboardingCount(false);
    }
  };

  const value = {
    staffData,
    isLoadingStaff,
    error,
    refetchStaffData,
    permissionKeys,
    permissionKeysMetadata,
    isLoadingPermissions,
    getAccessLevelPermissions,
    pendingOnboardingCount,
    isLoadingOnboardingCount,
    refetchPendingOnboardingCount,
  };

  return (
    <StaffContext.Provider value={value}>
      {children}
    </StaffContext.Provider>
  );
}