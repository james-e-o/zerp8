import PageHeader from "@/components/PageHeader";
import TabNav from "@/components/TabNav";

const TABS = [
  { label: "General", value: "all" },
  { label: "Document Numbering", value: "numbering" },
  { label: "Taxes", value: "taxes" },
  { label: "Payment Terms", value: "terms" },
  { label: "Invoicing Rules", value: "invoicing" },
];

export default function SettingsLayout({ children }) {
  return (
    <div>
      <PageHeader
        title="Sales Settings"
        description="Configuration that governs how quotations, orders, and invoices behave on this branch."
      />
      <TabNav tabs={TABS} basePath="/settings" />
      {children}
    </div>
  );
}
