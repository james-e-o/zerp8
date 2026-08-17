'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Image from 'next/image'

export default function InvitationsLayout({ children }) {
  return (
    <Suspense fallback={<LayoutFallback />}>
      <InvitationsLayoutContent>{children}</InvitationsLayoutContent>
    </Suspense>
  )
}

function LayoutFallback() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="bg-linear-to-br from-core/55 to-army/50 relative hidden lg:flex lg:flex-col lg:items-center lg:justify-center overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=1000&h=1000&fit=crop"
          alt="Team working together"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-core/40 to-army/10"></div>
      </div>
      <div className="flex flex-col gap-4 p-6 md:p-10 overflow-y-auto max-h-svh">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-core border-t-transparent rounded-full"></div>
        </div>
      </div>
    </div>
  )
}

function InvitationsLayoutContent({ children }) {
  const searchParams = useSearchParams()
  
  // Extract company info from URL params
  const companyName = searchParams.get('company_name')
  const logoUrl = searchParams.get('logo_url')

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Left Side - Company Logo/Image (Always visible, fallback to default if no company data) */}
      <div className="bg-linear-to-br from-core/55 to-army/50 relative hidden lg:flex lg:flex-col lg:items-center lg:justify-center overflow-hidden">
        {logoUrl && companyName ? (
          <div className="relative z-10 flex flex-col items-center gap-6 px-6">
            <img
              src={logoUrl}
              alt={companyName}
              className="w-24 h-24 object-contain drop-shadow-lg"
            />
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-white">{companyName}</h2>
              <p className="text-white/80">Welcome to Nexshelf Pro</p>
            </div>
          </div>
        ) : (
          <img
            src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=1000&h=1000&fit=crop"
            alt="Team working together"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-core/40 to-army/10"></div>
      </div>

      {/* Right Side - Content */}
      <div className="flex flex-col gap-4 p-6 md:p-10 overflow-y-auto max-h-svh">
        {children}
      </div>
    </div>
  );
}