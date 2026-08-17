'use client';

import { useContext, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CompanyInfoContext } from '../../companyInfoProvider';
import supabase from '@/config/supabaseClient';

export default function StaffHierarchyPage() {
  const params = useParams();
  const { u, companyId } = params;
  const { accessLevels } = useContext(CompanyInfoContext);
  const [staffList, setStaffList] = useState([]);
  const [staffError, setStaffError] = useState(null);

  useEffect(() => {
    const fetchStaffList = async () => {
      if (!companyId) return;

      try {
        const { data, error } = await supabase
          .from('staff_lite')
          .select('staff_id, first_name, last_name, access_level, status, branch')
          .eq('company', companyId)
          .order('first_name', { ascending: true });

        if (error) throw error;

        setStaffList((data || []).filter((staff) => staff.status !== 'suspended'));
      } catch (err) {
        console.error('Error fetching staff list:', err);
        setStaffError(err.message);
      }
    };

    fetchStaffList();
  }, [companyId]);

  const levels = accessLevels || [];

  return (
    <div className="space-y-6 grow flex flex-col overflow-y-auto">
      <div>
        <h2 className="text-base font-medium tracking-tight text-core">Staff Access & Hierarchy</h2>
        <p className="text-gray-600 text-sm mt-2">
          Review the staff roster on the left and the access structure on the right.
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row xl:items-start">
        <div className="flex-1  space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-core">Staff</h3>
            <Badge variant="outline">{staffList.length}</Badge>
          </div>

          {staffError ? (
            <Card className="p-4 text-sm text-red-600">We could not load the staff list right now.</Card>
          ) : staffList.length === 0 ? (
            <Card className="p-6 text-center text-sm text-gray-600">
              <p className="font-medium text-core">You don&apos;t have any staff in this company yet.</p>
              <p className="mt-2">Once staff are added, they will appear here in the hierarchy view.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {staffList.map((staff) => {
                const fullName = [staff.first_name, staff.last_name].filter(Boolean).join(' ') || 'Unnamed staff';
                const accessLabel = levels.find((level) => level.key === staff.access_level)?.name || 'Access level';

                return (
                  <Card key={staff.staff_id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-core">{fullName}</p>
                        <p className="text-xs text-gray-600 mt-1">{accessLabel}</p>
                      </div>
                      <Badge variant="outline" className="text-army">Staff</Badge>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className=" flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-black">Nexshelf built in Access Levels</h3>
            <Badge variant="outline">{levels.length}</Badge>
          </div>

          {levels.length === 0 ? (
            <Card className="p-6 text-center text-sm text-gray-600">
              <p className="font-medium text-core">No hierarchy levels available.</p>
              <p className="mt-2">Access levels will appear here once they are set up.</p>
            </Card>
          ) : (
            <div className="space-y-2 flex-col flex">
              {levels.map((level) => (
                <Link key={level.key} href={`/users/${u}/company/${companyId}/staff/hierarchy/${level.key}`}>
                  <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-base text-core">{level.name}</h3>
                          <Badge className="text-army" variant="outline">{`Level ${level.level_number}`}</Badge>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{level.description}</p>
                      </div>
                      <span className="text-gray-400">→</span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
