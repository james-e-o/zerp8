"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

export default function CompanyHeader({ children }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  // Example: ["admin", "john", "company", "fedeco", "settings"]

  const userId = segments[1];
  const companyId = segments[3];
  const companySegments = segments.slice(4); // e.g. ["settings"]

  const isAtCompanyRoot = segments.length === 4;

  return (
    <header className="flex h-12 w-full overflow-x-hidden justify-between items-center gap-2 border-b px-4">
      <div className="flex shrink-0 items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />

        <Breadcrumb>
          <BreadcrumbList className="flex items-center gap-1">
            {/* Always show "Dashboard" */}
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/users/${userId}`}>Admin Page</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>

            <BreadcrumbSeparator />

            {/* Company breadcrumb */}
            {isAtCompanyRoot ? (
              <BreadcrumbItem>
                <BreadcrumbPage className="capitalize">{companyId}</BreadcrumbPage>
              </BreadcrumbItem>
            ) : (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link
                      href={`/users/${userId}/company/${companyId}`}
                      className="capitalize"
                    >
                      {companyId}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>

                {/* Sub-page breadcrumbs */}
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

      {/* Right side content (e.g. profile, buttons, etc.) */}
      <div>{children}</div>
    </header>
  );
}

