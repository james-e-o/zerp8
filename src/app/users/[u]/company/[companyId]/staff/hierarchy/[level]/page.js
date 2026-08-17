'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import supabase from '@/config/supabaseClient';

export default function StaffHierarchyDetailPage() {
  const params = useParams();
  const { level } = params;

  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const capitalizeLevel = (str) => {
    if (!str) return '';
    return str
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getStatusBadge = (status) => {
    if (status === true) {
      return <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Allowed</span>;
    }
    if (status === false) {
      return <span className="px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Not Allowed</span>;
    }
    return <span className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-500">Not Defined</span>;
  };

  const fetchPermissionsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: allPermissions, error: permError } = await supabase
        .from('permission_keys')
        .select('*')
        .order('permission_group', { ascending: true });

      if (permError) throw permError;

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

      const { data: levelPermissions, error: levelError } = await supabase
        .from('access_level_permissions')
        .select('permission_key, allowed')
        .eq('access_level_key', level);

      if (levelError) throw levelError;

      const statusMap = {};
      (levelPermissions || []).forEach((item) => {
        statusMap[item.permission_key] = item.allowed;
      });

      Object.keys(groupedPerms).forEach((groupKey) => {
        groupedPerms[groupKey].permissions = groupedPerms[groupKey].permissions.map((perm) => ({
          ...perm,
          status: statusMap[perm.key] !== undefined ? statusMap[perm.key] : null,
        }));
      });

      setPermissions(groupedPerms);
    } catch (err) {
      console.error('Error fetching permissions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchPermissionsData();
  };

  useEffect(() => {
    if (level) {
      fetchPermissionsData();
    }
  }, [level]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="../hierarchy">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Staff Hierarchy
            </Button>
          </Link>
          <h1 className="text-2xl font-semibold">{capitalizeLevel(level)} Access Level</h1>
        </div>
        <p>Loading permissions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="../hierarchy">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Staff Hierarchy
            </Button>
          </Link>
          <h1 className="text-lg text-core font-semibold">{capitalizeLevel(level)} Access Level</h1>
        </div>
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="../hierarchy">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Staff Hierarchy
            </Button>
          </Link>
          <h4 className="text-lg font-semibold text-core">{capitalizeLevel(level)} Access Level</h4>
        </div>

        <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline">
          <RefreshCw className={`mr-2 text-army h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {Object.keys(permissions).length === 0 ? (
          <Card className="p-8 text-center text-gray-500">No permissions available</Card>
        ) : (
          Object.entries(permissions).map(([groupKey, groupData]) => (
            <Card key={groupKey} className="mb-8 overflow-hidden">
              <div className="bg-muted px-6 py-4 border-b">
                <h2 className="text-xl font-semibold">{groupData.label}</h2>
              </div>

              <div className="divide-y">
                {groupData.permissions.map((perm) => (
                  <div
                    key={perm.key}
                    className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-5 items-center hover:bg-muted/50 transition-colors"
                  >
                    <div className="md:col-span-5">
                      <div className="font-medium">{perm.label}</div>
                      <div className="text-sm text-muted-foreground mt-1">{perm.description}</div>
                    </div>

                    <div className="md:col-span-4 text-sm text-muted-foreground font-mono break-all">{perm.key}</div>

                    <div className="md:col-span-3 flex justify-end">{getStatusBadge(perm.status)}</div>
                  </div>
                ))}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
