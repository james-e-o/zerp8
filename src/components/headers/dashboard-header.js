"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {  Breadcrumb,  BreadcrumbList,  BreadcrumbItem,  BreadcrumbSeparator,  BreadcrumbLink,  BreadcrumbPage,
} from "@/components/ui/breadcrumb"; // adjust if needed
import { Separator } from "../ui/separator";
import { SidebarTrigger } from "../ui/sidebar";

export default function Header({children}) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean); // e.g. ["john", "reports", "sales"]
  // Map human-readable labels
   const labels = {
    calculator: "Calculator",
    account: "Account",
    trade: "Trade",
  };

  const isDashboard = segments.length === 2;

   const breadcrumbSegments = segments.length > 2 ? segments.slice(2) : [];

  // Treat the first segment (username) as "Dashboard"
  // const breadcrumbSegments = segments.map((seg, index) =>
  //   index === 0 ? "dashboard" : seg
  // );

  return (
    <header className="flex h-12 w-full overflow-x-hidden justify-between items-center gap-2 border-b px-4">
    <div className="flex shrink-0 items-center gap-2">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />

     
      <Breadcrumb>
          <BreadcrumbList className="flex items-center gap-1">
            {/* If user is on /user/[id], show only Dashboard */}
            {isDashboard ? (
              <BreadcrumbItem>
                <BreadcrumbPage>Dashboard</BreadcrumbPage>
              </BreadcrumbItem>
            ) : (
              breadcrumbSegments.map((segment, i) => {
                const href =
                  "/users/" +
                  segments[1] + // dynamic user ID
                  "/" +
                  breadcrumbSegments.slice(0, i + 1).join("/");

                const isLast = i === breadcrumbSegments.length - 1;
                const label = labels[segment] || segment;

                if (isLast) {
                  return (
                    <BreadcrumbItem className="h-fit" key={href}>
                      <BreadcrumbPage className="capitalize">
                        {label}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  );
                }

                return (
                  <div key={href} className="flex items-center">
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <Link href={href} className="capitalize">
                          {label}
                        </Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="flex items-center ml-1 relative top-0.5" />
                  </div>
                );
              })
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div>
        {children}
      </div>
    </header>
  );
}
