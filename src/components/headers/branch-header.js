"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import {Breadcrumb,  BreadcrumbList,  BreadcrumbItem,  BreadcrumbSeparator,  BreadcrumbLink,  BreadcrumbPage,} from "@/components/ui/breadcrumb";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { BranchContext } from "@/app/users/[u]/company/[companyId]/branches/[branchId]/branchContext";
import { CompanyInfoContext } from "@/app/users/[u]/company/[companyId]/companyInfoProvider"; // NEW

export default function BranchHeader({ children }) {
  const pathname = usePathname();
  const params = useParams();
  const { currentBranch } = useContext(BranchContext);
  const { info } = useContext(CompanyInfoContext); // NEW: company slug lives here

  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    const checkScreen = () => setIsSmallScreen(window.innerWidth < 640);
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  const segments = pathname.split("/").filter(Boolean);

  const userId = segments[1];
  const companyId = segments[3]; // raw id — stays in every href
  const companyLabel = info?.slug || companyId; // NEW: what renders

  const isInBranch = segments.includes("branches");
  const isInModule = segments.includes("modules");

  const baseCompany = `/users/${userId}/company/${companyId}`;
  const branchBase = `${baseCompany}/branches/${params.branch}`; // href still uses the id
  const branchLabel = currentBranch?.slug || currentBranch?.name; // NEW: slug, not name
  const isAtCompanyRoot = segments.length === 4;

  const breadcrumbItems = [];
  breadcrumbItems.push({ label: "Admin", href: `/users/${userId}` });

  if (isAtCompanyRoot) {
    breadcrumbItems.push({ label: companyLabel, href: baseCompany, isCurrent: true }); // CHANGED
  } else {
    breadcrumbItems.push({ label: companyLabel, href: baseCompany }); // CHANGED

    if (isInBranch && currentBranch) {
      breadcrumbItems.push({ label: branchLabel, href: branchBase }); // CHANGED

      if (isInModule) {
        const modulesIndex = segments.indexOf("modules");
        const moduleSlug = segments[modulesIndex + 1];

        breadcrumbItems.push({ label: moduleSlug, href: `${branchBase}/modules/${moduleSlug}` });

        for (let i = modulesIndex + 2; i < segments.length; i++) {
          const subLabel = segments[i];
          const subPath = segments.slice(modulesIndex + 2, i + 1).join("/");
          breadcrumbItems.push({ label: subLabel, href: `${branchBase}/modules/${moduleSlug}/${subPath}` });
        }
      } else {
        const branchIndex = segments.indexOf("branches");
        for (let i = branchIndex + 2; i < segments.length; i++) {
          const subLabel = segments[i];
          const subPath = segments.slice(branchIndex + 2, i + 1).join("/");
          breadcrumbItems.push({ label: subLabel, href: `${branchBase}/${subPath}` });
        }
      }
    } else {
      for (let i = 4; i < segments.length; i++) {
        const seg = segments[i];
        const path = segments.slice(4, i + 1).join("/");
        breadcrumbItems.push({ label: seg, href: `${baseCompany}/${path}` });
      }
    }
  }

  const collapsedItems =
    isSmallScreen && breadcrumbItems.length > 3
      ? [breadcrumbItems[0], { label: "..." }, breadcrumbItems[breadcrumbItems.length - 2], breadcrumbItems[breadcrumbItems.length - 1]]
      : breadcrumbItems;

  return (
    <header className="flex h-12 w-full justify-between items-center gap-2 border-b px-4">
      <div className="flex items-center gap-2 min-w-0">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />

        <Breadcrumb>
          <BreadcrumbList className="flex items-center gap-1 text-xs sm:text-sm truncate">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/users/${userId}`}>Admin</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>

            <BreadcrumbSeparator />

            {isAtCompanyRoot ? (
              <BreadcrumbItem>
                <BreadcrumbPage className="capitalize">
                  {companyLabel}
                </BreadcrumbPage>
              </BreadcrumbItem>
            ) : (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href={baseCompany} className="capitalize">
                      {companyLabel}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>

                {collapsedItems.slice(2).map((item, i) => {
                  if (item.label === "...") {
                    return (
                      <div key={`ellipsis-${i}`} className="flex items-center">
                        <BreadcrumbSeparator className="mx-1" />
                        <span className="text-muted-foreground">…</span>
                      </div>
                    );
                  }

                  const remainingItems = collapsedItems.slice(2);
                  const isLast = i === remainingItems.length - 1;

                  return (
                    <div key={`${item.href ?? item.label}-${i}`} className="flex items-center">
                      <BreadcrumbSeparator className="mx-1" />
                      {isLast ? (
                        <BreadcrumbItem>
                          <BreadcrumbPage className="capitalize">
                            {item.label}
                          </BreadcrumbPage>
                        </BreadcrumbItem>
                      ) : (
                        <BreadcrumbItem>
                          <BreadcrumbLink asChild>
                            <Link href={item.href} className="capitalize">
                              {item.label}
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

      <div className="flex items-center gap-2">
        {children}
      </div>
    </header>
  );
}