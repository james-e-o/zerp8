'use client';

import { useContext } from 'react';
import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { CompanyInfoContext } from '../companyInfoProvider';
import { ReusableCompanySidebar } from '../companyLayoutClient';
import { StaffContext, StaffProvider } from '@/components/contexts/staff-context';
import { useAccess } from '@/hooks/use-access';
import { Plus, List, ChartBar, Network, Settings } from 'lucide-react';

const TABS = [
  { key: 'overview', label: 'Overview', icon: ChartBar, path: '', requiresStaffInfoView: false },
  { key: 'directory', label: 'Directory', icon: List, path: '/directory', requiresStaffInfoView: true },
  { key: 'hierarchy', label: 'Hierarchy', icon: Network, path: '/hierarchy', requiresStaffInfoView: false },
  { key: 'onboarding', label: 'Onboarding', icon: Plus, path: '/onboarding', requiresStaffInfoView: true },
  { key: 'settings', label: 'Settings', icon: Settings, path: '/settings', requiresStaffInfoView: true },
];

function StaffLayoutContent({ children }) {
  const { info } = useContext(CompanyInfoContext);
  const { pendingOnboardingCount } = useContext(StaffContext) || {};
  const access = useAccess();
  const pathname = usePathname();
  const { u } = useParams();

  const isActive = (path) => {
    if (path === '') return pathname.endsWith('/staff');
    return pathname.includes(path);
  };

  // Directory, Onboarding, and Settings are gated on staff_info view
  // access — Overview and Hierarchy stay visible to everyone. While the
  // permission check is still loading, gated tabs are omitted rather
  // than shown-then-hidden, to avoid a flash of tabs someone may not
  // actually have access to.
  const canViewStaffInfo = access.isOwner || access.hasPermission('staff_info', 'view');
  const visibleTabs = TABS.filter((tab) => {
    if (!tab.requiresStaffInfoView) return true
    if (access.isLoading) return false
    return canViewStaffInfo
  });

  return (
    <ReusableCompanySidebar>
      <div className="space-y-4 px-4 h-full flex-col flex overflow-hidden">
        {/* Header */}
        <div className="my-1">
          <div>
            <h1 className="text-lg m-1 font-semibold text-foreground">Staff Management</h1>
          </div>
        </div>

        {/* Tab strip — same chip-pill pattern (padding, border, active
            state, icon size) reused by StaffDetailLayout's sub-nav, so
            both nav bars in this route tree read as one consistent
            system rather than two different UI treatments. */}
        <div className="flex items-center gap-2  py-1">
          {visibleTabs.map((tab) => {
            const active = isActive(tab.path);
            const href = `/users/${u}/company/${info.id}/staff${tab.path}`;
            const showBadge = tab.key === 'onboarding' && (pendingOnboardingCount || 0) > 0;

            return (
              <Link key={tab.key} href={href} className="shrink-0 relative">
                <button
                  className={`flex shrink-0 min-w-max cursor-pointer items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
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