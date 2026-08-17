'use client';

import { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import supabase from '../../../../../../../../config/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { CompanyInfoContext } from '../../../companyInfoProvider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, RefreshCw } from 'lucide-react';

export default function RolesPage() {
  const params = useParams();
  const companyCtx = useContext(CompanyInfoContext);
  const { u, companySlug } = params;
  const companyId = companyCtx?.info?.company_id;

  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    role: '',
    description: '',
  });

  // Fetch roles from database
  useEffect(() => {
    async function fetchRoles() {
      try {
        if (!companyId) {
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('company_roles')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching roles:', error);
          toast.error('Failed to load roles');
          setRoles([]);
        } else {
          setRoles(data || []);
        }
      } catch (err) {
        console.error('Error:', err);
        setRoles([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRoles();
  }, [companyId]);

  // Function to create a new role
  const handleCreateRole = async () => {
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

      if (!companyId) {
        toast.error('Company information not available');
        return;
      }

      setIsCreating(true);

      // Check if role name already exists for this company
      const { data: existingRole } = await supabase
        .from('company_roles')
        .select('id')
        .eq('company_id', companyId)
        .eq('role', formData.role.trim())
        .single();

      if (existingRole) {
        toast.error(`The role "${formData.role.trim()}" already exists in your company`);
        setIsCreating(false);
        return;
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error('Authentication required');
        setIsCreating(false);
        return;
      }

      const { data, error } = await supabase
        .from('company_roles')
        .insert([
          {
            company_id: companyId,
            role: formData.role.trim(),
            description: formData.description.trim() || null,
            is_active: true,
            is_system: false,
            created_by: user.id,
            updated_at: new Date().toISOString(),
          },
        ])
        .select();

      if (error) {
        console.error('Error creating role:', error);
        if (error.code === '23505') {
          toast.error('This role name already exists for your company');
        } else {
          toast.error('Failed to create role');
        }
        return;
      }

      if (data && data.length > 0) {
        setRoles([data[0], ...roles]);
        toast.success('Role created successfully');
        setFormData({ role: '', description: '' });
        setShowCreateForm(false);
      }
    } catch (err) {
      console.error('Error:', err);
      toast.error('Failed to create role');
    } finally {
      setIsCreating(false);
    }
  };

  // Function to refresh roles
  const handleRefreshRoles = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('company_roles')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error refreshing roles:', error);
        toast.error('Failed to refresh roles');
        return;
      }

      setRoles(data || []);
      toast.success('Roles refreshed');
    } catch (err) {
      console.error('Error:', err);
      toast.error('Failed to refresh roles');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner className="size-8 text-army" spinning={true} />
      </div>
    );
  }

  // Show create form view
  if (showCreateForm) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-medium tracking-tight text-core">Create New Role</h2>
          <p className="text-gray-600 text-sm mt-2">Add a new job role for your company</p>
        </div>

        <div className="p-6 border border-gray-200 rounded-lg bg-white">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Role Name *</Label>
              <Input
                id="role-name"
                placeholder="e.g., Cashier, Store Manager, Inventory Clerk"
                value={formData.role}
                maxLength={50}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
              />
              <p className="text-xs text-gray-500">
                {formData.role.length}/50 characters
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Input
                id="role-description"
                placeholder="e.g., Responsible for processing customer payments and transactions"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
              <p className="text-xs text-gray-500">
                Optional. Helps your team understand the purpose of this role.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateForm(false);
                setFormData({ role: '', description: '' });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateRole}
              disabled={isCreating}
              className="bg-core hover:bg-core/90"
            >
              {isCreating ? 'Adding...' : 'Add New Role'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show list view
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-core">Roles</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshRoles}
              disabled={isLoading}
            >
              <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <p className="text-gray-600 text-sm mt-2">Create and manage job roles</p>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="bg-core hover:bg-core/90"
        > <Plus className="size-4 mr-1" />
           Create Role
        </Button>
      </div>

      {roles.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-600">
            Your company has not created any roles yet.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Create your first role to get started.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {roles.map((role) => (
            <Link key={role.id} href={`roles/${role.id}`}>
              <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base text-core">
                        {role.role}
                      </h3>
                      <Badge
                        className={role.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-800'}
                        variant="default"
                      >
                        {role.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {role.description && (
                      <p className="text-xs text-gray-600 mt-1">
                        {role.description}
                      </p>
                    )}
                  </div>
                  <span className="text-gray-400">→</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
