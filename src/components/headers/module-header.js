"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useEffect, useState } from "react";
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

export default function ModuleHeader({ title, children }) {
  const pathname = usePathname();
  const params = useParams();
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    const checkScreen = () => setIsSmallScreen(window.innerWidth < 640);
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  const segments = pathname.split("/").filter(Boolean);
  const userId = segments[1];
  const companyId = segments[3];
  const branchId = params?.branchId || segments[5];
  const moduleIndex = segments.indexOf("modules");
  const moduleSlug = moduleIndex >= 0 ? segments[moduleIndex + 1] : "";

  const baseCompany = `/users/${userId}/company/${companyId}`;
  const baseBranch = `${baseCompany}/branches/${branchId}`;
  const baseModule = moduleSlug ? `${baseBranch}/modules/${moduleSlug}` : baseBranch;

  const breadcrumbItems = [
    { label: "Admin", href: `/users/${userId}` },
    { label: companyId, href: baseCompany },
    ...(branchId ? [{ label: "Branches", href: `${baseCompany}/branches` }, { label: branchId, href: baseBranch }] : []),
    ...(moduleSlug ? [{ label: "modules", href: `${baseBranch}/modules` }, { label: moduleSlug, href: baseModule }] : []),
  ];

  const collapsedItems =
    isSmallScreen && breadcrumbItems.length > 3
      ? [breadcrumbItems[0], { label: "..." }, breadcrumbItems[breadcrumbItems.length - 2], breadcrumbItems[breadcrumbItems.length - 1]]
      : breadcrumbItems;

  const currentTitle = title || (moduleSlug ? moduleSlug.replace(/-/g, " ") : "Module");

  return (
    <header className="flex h-12 w-full justify-between items-center gap-2 border-b px-4">
      <div className="flex items-center gap-2 min-w-0">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />

        <Breadcrumb>
          <BreadcrumbList className="flex items-center gap-1 text-xs sm:text-sm truncate">
            {collapsedItems.map((item, index) => {
              if (item.label === "...") {
                return (
                  <div key={`ellipsis-${index}`} className="flex items-center">
                    <BreadcrumbSeparator className="mx-1" />
                    <span className="text-muted-foreground">…</span>
                  </div>
                );
              }

              const isLast = index === collapsedItems.length - 1;

              return (
                <div key={`${item.href ?? item.label}-${index}`} className="flex items-center">
                  {index > 0 && <BreadcrumbSeparator className="mx-1" />}
                  {isLast ? (
                    <BreadcrumbItem>
                      <BreadcrumbPage className="capitalize">{currentTitle}</BreadcrumbPage>
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
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-2">{children}</div>
    </header>
  );
}
