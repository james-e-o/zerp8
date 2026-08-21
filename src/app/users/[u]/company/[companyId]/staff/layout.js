'use client';

import { useContext } from 'react';
import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { CompanyInfoContext } from '../companyInfoProvider';
import { ReusableCompanySidebar } from '../companyLayoutClient';
import { StaffContext, StaffProvider } from '@/components/contexts/staff-context';
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
  const { pendingOnboardingCount } = useContext(StaffContext) || {};
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
        <div className="flex flex-col sm:flex-row sm:items-center mt-1 sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Staff Management</h1>
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
        <div className="flex items-center gap-2 overflow-x-auto no_scroll -mx-1 px-1 py-1">
          {TABS.map((tab) => {
            const active = isActive(tab.path);
            const href = `/users/${u}/company/${info.id}/staff${tab.path}`;
            // Only the Onboarding tab gets the count badge — a single
            // rounded indicator showing items awaiting review.
            const showBadge = tab.key === 'onboarding' && (pendingOnboardingCount || 0) > 0;

            return (
              <Link key={tab.key} href={href} className="shrink-0 relative">
                <button
                  className={`flex cursor-pointer items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-core_light text-core border-core/20'
                      : 'text-muted-foreground border-border hover:bg-muted'
                  }`}
                >
                  <tab.icon className="size-3.5" />
                  {tab.label}
                </button>

                {showBadge && (
                  <span
                    className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-[16px] px-0.5 rounded-full bg-core text-white text-[9px] font-semibold leading-none pointer-events-none"
                    aria-label={`${pendingOnboardingCount} pending`}
                  >
                    {pendingOnboardingCount > 99 ? '99+' : pendingOnboardingCount}
                  </span>
                )}
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