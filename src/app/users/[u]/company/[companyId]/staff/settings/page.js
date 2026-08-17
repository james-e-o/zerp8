'use client'
 
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Users, Lock, Mail, Shield, FileText } from 'lucide-react';

export default function StaffSettingsPage() {
  const params = useParams();
  const { u, companyId } = params;
  const sections = [
    {
      title: 'Roles',
      description: 'Manage job roles and module access',
      href: 'roles',
      icon: Users,
    },
    {
      title: 'Invitations',
      description: 'Control staff onboarding behavior',
      href: 'invitations',
      icon: Mail,
    }
  ];

  return (
    <div className="space-y-6 grow flex flex-col overflow-y-auto">
      <div>
        <h2 className="text-base font-medium tracking-tight">Staff Settings</h2>
        <p className="text-gray-600 text-sm mt-2">
          Configure roles, invitations, and staff administration settings
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((section) => {
          const IconComponent = section.icon;
          return (
            <Link key={section.href} href={`/users/${u}/company/${companyId}/staff/settings/${section.href}`}>
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
                <IconComponent className="size-6 mb-3 text-army" />
                <h3 className="font-semibold text-base mb-2 text-neutral-700">{section.title}</h3>
                <p className="text-xs text-gray-600">{section.description}</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
