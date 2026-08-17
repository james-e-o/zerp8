'use client';

import { useContext } from 'react';
import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { CompanyInfoContext } from '../companyInfoProvider';
import { ReusableCompanySidebar } from '../companyLayoutClient';
import { StaffProvider } from '@/components/contexts/staff-context';
import { Plus, List, ChartBar, Network, Settings, UserPlus } from 'lucide-react';

const TABS = [
  { key: 'overview', label: 'Overview', icon: ChartBar, path: '' },
  { key: 'directory', label: 'Directory', icon: List, path: '/directory' },
  { key: 'hierarchy', label: 'Hierarchy', icon: Network, path: '/hierarchy' },
  { key: 'onboarding', label: 'Onboarding', icon: Plus, path: '/onboarding' },
  { key: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
];

function StaffLayoutContent({ children }) {
  const { info } = useContext(CompanyInfoContext);
  const pathname = usePathname();
  const { u } = useParams();

  const isActive = (path) => {
    if (path === '') return pathname.endsWith('/staff');
    return pathname.includes(path);
  };

  return (
    <ReusableCompanySidebar>
      <div className="space-y-4 px-4 h-full flex-col flex overflow-hidden">
        {/* Header — title + primary action, stacks on mobile */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Staff management</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage and view all company staff members
            </p>
          </div>
          <Link href={`/users/${u}/company/${info.id}/staff/new`} className="shrink-0">
            <button className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-core text-white hover:bg-core/90 transition-colors">
              <UserPlus className="size-4" />
              Invite staff
            </button>
          </Link>
        </div>

        {/* Tab strip — horizontally scrollable, no manual collapse needed */}
        <div className="flex items-center gap-2 overflow-x-auto no_scroll -mx-1 px-1 pb-1">
          {TABS.map((tab) => {
            const active = isActive(tab.path);
            const href = `/users/${u}/company/${info.id}/staff${tab.path}`;
            return (
              <Link key={tab.key} href={href} className="shrink-0">
                <button
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-core_light text-core border-core/20'
                      : 'text-muted-foreground border-border hover:bg-muted'
                  }`}
                >
                  <tab.icon className="size-4" />
                  {tab.label}
                </button>
              </Link>
            );
          })}
        </div>

        {/* Page content */}
        <div className="grow overflow-y-auto ">{children}</div>
      </div>
    </ReusableCompanySidebar>
  );
}

export default function StaffLayout({ children }) {
  const { info } = useContext(CompanyInfoContext);

  return (
    <StaffProvider companyId={info?.id}>
      <StaffLayoutContent>{children}</StaffLayoutContent>
    </StaffProvider>
  );
}