'use client';

import { createContext, useState, useEffect } from 'react';
import supabase from '@/config/supabaseClient';

export const StaffContext = createContext();

export function StaffProvider({ children, companyId }) {
  const [staffData, setStaffData] = useState([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);
  const [error, setError] = useState(null);
  const [permissionKeys, setPermissionKeys] = useState({});
  const [permissionKeysMetadata, setPermissionKeysMetadata] = useState({});
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);

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

  // Fetch permission keys on mount
  useEffect(() => {
    async function fetchPermissionKeys() {
      try {
        setIsLoadingPermissions(true);
        const { data: allPermissions, error: permError } = await supabase
          .from('permission_keys')
          .select('*')
          .order('permission_group', { ascending: true });

        if (permError) throw permError;

        // Build metadata map with includes_branch flag
        const metadata = {};
        (allPermissions || []).forEach((perm) => {
          metadata[perm.permission_key] = {
            includes_branch: perm.includes_branch !== false,
          };
        });
        setPermissionKeysMetadata(metadata);

        // Group permissions by permission_group
        const groupedPerms = {};
        (allPermissions || []).forEach((perm) => {
          const group = perm.permission_group || 'ungrouped';
          if (!groupedPerms[group]) {
            groupedPerms[group] = {
              label: group
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (l) => l.toUpperCase()),
              permissions: [],
            };
          }
          groupedPerms[group].permissions.push({
            key: perm.permission_key,
            label: perm.name,
            description: perm.description,
            status: null,
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

  // Function to fetch access level permissions
  const getAccessLevelPermissions = async (accessLevelKey) => {
    try {
      const { data: levelPermissions, error: levelError } = await supabase
        .from('access_level_permissions')
        .select('permission_key, allowed')
        .eq('access_level_key', accessLevelKey);

      if (levelError) throw levelError;

      // Create lookup map for quick status check
      const statusMap = {};
      (levelPermissions || []).forEach((item) => {
        statusMap[item.permission_key] = item.allowed;
      });

      // Merge status into grouped permissions
      const mergedPerms = {};
      Object.keys(permissionKeys).forEach((groupKey) => {
        mergedPerms[groupKey] = {
          ...permissionKeys[groupKey],
          permissions: permissionKeys[groupKey].permissions.map((perm) => ({
            ...perm,
            status: statusMap[perm.key] !== undefined ? statusMap[perm.key] : null,
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

  const value = {
    staffData,
    isLoadingStaff,
    error,
    refetchStaffData,
    permissionKeys,
    permissionKeysMetadata,
    isLoadingPermissions,
    getAccessLevelPermissions,
  };

  return (
    <StaffContext.Provider value={value}>
      {children}
    </StaffContext.Provider>
  );
}
