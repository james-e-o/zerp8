"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useContext } from "react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbSeparator,
  BreadcrumbLink,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { CompanyInfoContext } from "@/app/users/[u]/company/[companyId]/companyInfoProvider";

export default function CompanyHeader({ children }) {
  const pathname = usePathname();
  const { info } = useContext(CompanyInfoContext); // NEW: pull slug from context, not the URL

  const segments = pathname.split("/").filter(Boolean);
  const userId = segments[1];
  const companyId = segments[3]; // still the raw id — stays in every href
  const companyLabel = info?.slug || companyId; // NEW: what actually renders
  const companySegments = segments.slice(4);

  const isAtCompanyRoot = segments.length === 4;

  return (
    <header className="flex h-12 w-full overflow-x-hidden justify-between items-center gap-2 border-b px-4">
      <div className="flex shrink-0 items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />

        <Breadcrumb>
          <BreadcrumbList className="flex items-center gap-1">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/users/${userId}`}>Admin Page</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>

            <BreadcrumbSeparator />

            {isAtCompanyRoot ? (
              <BreadcrumbItem>
                <BreadcrumbPage className="capitalize">{companyLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            ) : (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href={`/users/${userId}/company/${companyId}`} className="capitalize">
                      {companyLabel}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>

                {companySegments.map((segment, i) => {
                  const href = `/users/${userId}/company/${companyId}/${companySegments
                    .slice(0, i + 1)
                    .join("/")}`;
                  const isLast = i === companySegments.length - 1;

                  return (
                    <div key={href} className="flex items-center">
                      <BreadcrumbSeparator className="flex items-center mr-1.5 relative " />
                      {isLast ? (
                        <BreadcrumbItem>
                          <BreadcrumbPage className="capitalize">{segment}</BreadcrumbPage>
                        </BreadcrumbItem>
                      ) : (
                        <BreadcrumbItem>
                          <BreadcrumbLink asChild>
                            <Link href={href} className="capitalize">
                              {segment}
                            </Link>
                          </BreadcrumbLink>
                        </BreadcrumbItem>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div>{children}</div>
    </header>
  );
}