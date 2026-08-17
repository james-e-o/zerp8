'use client';

import { useState, useEffect, useContext } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import supabase from '../../../../../../../../../config/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { CompanyInfoContext } from '../../../../companyInfoProvider';

export default function RoleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const companyCtx = useContext(CompanyInfoContext);
  const { roleId, companySlug, u } = params;
  const companyId = companyCtx?.info?.company_id;

  const [role, setRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    role: '',
    description: '',
    is_active: true,
  });

  // Fetch role details
  useEffect(() => {
    async function fetchRole() {
      try {
        if (!roleId || !companyId) {
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('company_roles')
          .select('*')
          .eq('id', roleId)
          .eq('company_id', companyId)
          .single();

        if (error) {
          console.error('Error fetching role:', error);
          toast.error('Failed to load role details');
          router.push(`/users/${u}/company/${companySlug}/staff/settings/roles`);
          return;
        }

        if (data) {
          setRole(data);
          setFormData({
            role: data.role,
            description: data.description || '',
            is_active: data.is_active,
          });
        }
      } catch (err) {
        console.error('Error:', err);
        toast.error('Failed to load role');
      } finally {
        setIsLoading(false);
      }
    }

    fetchRole();
  }, [roleId, companyId, u, companySlug, router]);

  const handleSaveRole = async () => {
    try {
      if (!formData.role.trim()) {
        toast.error('Role name is required');
        return;
      }

      if (formData.role.trim().length < 2) {
        toast.error('Role name must be at least 2 characters');
        return;
      }

      if (formData.role.trim().length > 50) {
        toast.error('Role name must not exceed 50 characters');
        return;
      }

      // Check if role name already exists for this company (excluding current role)
      const { data: existingRole } = await supabase
        .from('company_roles')
        .select('id')
        .eq('company_id', companyId)
        .eq('role', formData.role.trim())
        .neq('id', roleId)
        .single();

      if (existingRole) {
        toast.error(`The role "${formData.role.trim()}" already exists in your company`);
        return;
      }

      setIsSaving(true);

      const { data, error } = await supabase
        .from('company_roles')
        .update({
          role: formData.role.trim(),
          description: formData.description.trim() || null,
          is_active: formData.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', roleId)
        .eq('company_id', companyId)
        .select();

      if (error) {
        console.error('Error updating role:', error);
        toast.error('Failed to update role');
        return;
      }

      if (data && data.length > 0) {
        setRole(data[0]);
        setIsEditing(false);
        toast.success('Role updated successfully');
      }
    } catch (err) {
      console.error('Error:', err);
      toast.error('Failed to update role');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!window.confirm(`Are you sure you want to delete the "${role?.role}" role? This action cannot be undone.`)) {
      return;
    }

    try {
      setIsSaving(true);

      const { error } = await supabase
        .from('company_roles')
        .delete()
        .eq('id', roleId)
        .eq('company_id', companyId);

      if (error) {
        console.error('Error deleting role:', error);
        toast.error('Failed to delete role');
        return;
      }

      toast.success('Role deleted successfully');
      router.push(`/users/${u}/company/${companySlug}/staff/settings/roles`);
    } catch (err) {
      console.error('Error:', err);
      toast.error('Failed to delete role');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner className="size-8 text-army" spinning={true} />
      </div>
    );
  }

  if (!role) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/users/${u}/company/${companySlug}/staff/settings/roles`}
          className="text-core hover:underline text-sm mb-2 block"
        >
          ← Back to Roles
        </Link>
        <h2 className="text-base font-medium tracking-tight text-core">{role.role}</h2>
        <p className="text-gray-600 text-sm mt-2">Manage role details and settings</p>
      </div>

      {!isEditing ? (
        <Card className="p-6 space-y-4">
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Role Name</Label>
              <p className="text-base mt-1">{role.role}</p>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Description</Label>
              <p className="text-base mt-1 text-gray-600">
                {role.description || 'No description provided'}
              </p>
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-700">Status</Label>
              <div className="mt-1">
                <Badge
                  className={role.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
                >
                  {role.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t flex gap-3">
            <Button
              onClick={() => setIsEditing(true)}
              className="bg-core hover:bg-core/90"
            >
              Edit Role
            </Button>
            <Button
              onClick={handleDeleteRole}
              variant="destructive"
            >
              Delete Role
            </Button>
          </div>
        </Card>
      ) : (
        <div className="p-6 border border-gray-200 rounded-lg bg-white">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Role Name *</Label>
              <Input
                id="role-name"
                value={formData.role}
                maxLength={50}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              />
              <p className="text-xs text-gray-500">
                {formData.role.length}/50 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Input
                id="role-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
              <p className="text-xs text-gray-500">
                Optional. Helps your team understand the purpose of this role.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-700">Status</Label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is-active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="is-active" className="text-sm cursor-pointer">
                  Active
                </Label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditing(false);
                setFormData({
                  role: role.role,
                  description: role.description || '',
                  is_active: role.is_active,
                });
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveRole}
              disabled={isSaving}
              className="bg-core hover:bg-core/90"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
