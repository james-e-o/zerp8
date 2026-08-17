'use client';

import { useEffect, useState } from 'react';
import { useContext } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RefreshCw } from 'lucide-react';
import  supabase  from '../../../../../../../../config/supabaseClient';
import { CompanyInfoContext } from '../../../companyInfoProvider';

export default function InvitationsPage() {
  const params = useParams();
  const { info, accessLevels } = useContext(CompanyInfoContext);
  const companyId = info?.id;

  if (!companyId) {
    return <div>Loading...</div>;
  }
  const [settings, setSettings] = useState({
    default_role_id: null,
    default_access_level_key: '',
    default_branch_id: '',
    auto_activate_staff: false,
  });

  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branchError, setBranchError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        // Set default access level from context on first load
        if (!settings.default_access_level_key && accessLevels && accessLevels.length > 0) {
          setSettings(prev => ({
            ...prev,
            default_access_level_key: accessLevels[0].key,
          }));
        }

        // Fetch roles from company_roles table
        const { data: rolesData, error: fetchRolesError } = await supabase
          .from('company_roles')
          .select('id, role')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .order('created_at', { ascending: true });

        if (fetchRolesError) {
          console.error('Error fetching roles:', fetchRolesError);
        } else {
          setRoles(rolesData || []);
        }

        // Fetch branches separately
        const { data: branchData, error: fetchBranchError } = await supabase
          .from('branches_lite')
          .select('id, name')
          .eq('company', companyId)
          .order('name', { ascending: true });

        if (fetchBranchError) {
          console.error('Error fetching branches:', fetchBranchError);
          setBranchError(fetchBranchError.message);
          return;
        }

        setBranches(branchData || []);
        if (!settings.default_branch_id && branchData && branchData.length > 0) {
          setSettings(prev => ({
            ...prev,
            default_branch_id: branchData[0].id,
          }));
        }
      } catch (err) {
        console.error('Error fetching branches:', err);
        setBranchError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBranches();
  }, [companyId, accessLevels]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    // Refetch roles and branches
    try {
      const { data: rolesData, error: fetchRolesError } = await supabase
        .from('company_roles')
        .select('id, role')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (fetchRolesError) {
        console.error('Error fetching roles:', fetchRolesError);
      } else {
        setRoles(rolesData || []);
      }

      const { data: branchData, error: fetchBranchError } = await supabase
        .from('branches_lite')
        .select('id, name')
        .eq('company', companyId)
        .order('name', { ascending: true });

      if (!fetchBranchError) {
        setBranches(branchData || []);
        setBranchError(null);
      } else {
        setBranchError(fetchBranchError.message);
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Link href="./" className="text-blue-600 hover:underline text-sm whitespace-nowrap">
            ← Back to Settings
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-blue-600 hover:text-blue-700 p-1 h-auto"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <h2 className="text-base font-medium tracking-tight text-core">Invitation Settings</h2>
        </div>
        <p className="text-gray-600 text-sm">Control staff onboarding behavior and defaults</p>
      </div>

      <Card className="p-6 space-y-6">
        <div className="grid gap-6">
          {/* Default Role Selection */}
          <div className="space-y-2">
            <Label htmlFor="default_role_id">Default Role for New Invitations</Label>
            <Select
              value={settings.default_role_id === null ? 'none' : String(settings.default_role_id)}
              onValueChange={(value) =>
                setSettings(prev => ({ ...prev, default_role_id: value === 'none' ? null : value }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  No Selection
                </SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={String(role.id)}>
                    {role.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">New invitations will be assigned this role by default</p>
          </div>

          {/* Default Access Level Selection */}
          <div className="space-y-2">
            <Label htmlFor="default_access_level_key">Default Access Level</Label>
            {!accessLevels || accessLevels.length === 0 ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : (
              <>
                <Select
                  value={settings.default_access_level_key}
                  onValueChange={(value) =>
                    setSettings(prev => ({ ...prev, default_access_level_key: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an access level" />
                  </SelectTrigger>
                  <SelectContent>
                    {accessLevels.map((level) => (
                      <SelectItem key={level.key} value={level.key}>
                        {level.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">New invitations will have this access level by default</p>
              </>
            )}
          </div>

          {/* Default Branch Selection */}
          <div className="space-y-2">
            <Label htmlFor="default_branch_id">Default Branch</Label>
            {branchError ? (
              <p className="text-sm text-red-600">Error loading branches: {branchError}</p>
            ) : (
              <>
                <Select
                  value={settings.default_branch_id}
                  onValueChange={(value) =>
                    setSettings(prev => ({ ...prev, default_branch_id: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">New invitations will be assigned to this branch by default</p>
              </>
            )}
          </div>
        </div>

        {/* Activation Option */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-activate Staff</Label>
              <p className="text-xs text-gray-500 mt-1">Staff accounts activate immediately without verification</p>
            </div>
            <Switch
              checked={settings.auto_activate_staff}
              onCheckedChange={(checked) =>
                setSettings(prev => ({ ...prev, auto_activate_staff: checked }))
              }
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 border-t pt-4">
          <Button className="bg-core text-white">Save Settings</Button>
          <Button variant="outline">Cancel</Button>
        </div>
      </Card>
    </div>
  );
}
