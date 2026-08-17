

import { DataTable } from "@/components/table";
export default function ModuleHome({ params }) {
  const { module } = params;

  return (
    <div>
      <DataTable />
    </div>
  );
}
