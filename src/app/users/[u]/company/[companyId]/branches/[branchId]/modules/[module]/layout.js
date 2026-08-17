import Link from "next/link";

export default async function ModuleLayout({ children, params }) {
  const { u, companySlug, modules } = await  params; // your dynamic route is [modules]

  // Sidebar / tabs links
  const links = [
    { name: "Overview", href: `/admin/${u}/company/${companySlug}/${modules}` },
    { name: "Create", href: `/admin/${u}/company/${companySlug}/${modules}/create` },
    { name: "Manage", href: `/admin/${u}/company/${companySlug}/${modules}/manage` },
  ];

  return (
    <div className="w-full">

      {/* Module Title */}
      <h4 className="text-4xl font-semibold mb-4 capitalize">
        {modules}
      </h4>

      {/* Module Tabs
      <div className="flex gap-4 border-b mb-4 pb-2">
        {links.map((link) => {
          // Active tab detection using params only
          const active = link.href.endsWith(modules);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`pb-2 ${
                active ? "border-b-2 border-blue-600 font-medium" : "text-gray-500"
              }`}
            >
              {link.name}
            </Link>
          );
        })}
      </div> */}

      {/* Module Content */}
      <div>{children}</div>
    </div>
  );
}
