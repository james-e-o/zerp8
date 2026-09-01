"use client";

import { useSearchParams } from "next/navigation";

function Field({ label, hint, children }) {
  return (
    <div className="py-4 border-b border-line last:border-0 grid grid-cols-3 gap-6">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint && <p className="text-xs text-inkmute mt-0.5">{hint}</p>}
      </div>
      <div className="col-span-2">{children}</div>
    </div>
  );
}

const inputClass =
  "w-full max-w-sm px-3 py-2 rounded-md border border-line bg-surface text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand";

export default function SettingsPage() {
  const section = useSearchParams().get("status") || "all";

  return (
    <div className="border border-line rounded-lg bg-surface p-6">
      {section === "all" && (
        <>
          <Field label="Branch name" hint="Shown on quotations and invoices.">
            <input className={inputClass} defaultValue="NexShelf — Lekki Branch" />
          </Field>
          <Field label="Default currency" hint="Applied across quotations, orders, and invoices.">
            <select className={inputClass} defaultValue="NGN">
              <option value="NGN">Nigerian Naira (₦)</option>
              <option value="USD">US Dollar ($)</option>
            </select>
          </Field>
        </>
      )}

      {section === "numbering" && (
        <>
          <Field label="Quotation prefix" hint="e.g. QT-0045">
            <input className={inputClass} defaultValue="QT-" />
          </Field>
          <Field label="Sales Order prefix" hint="e.g. SO-0124">
            <input className={inputClass} defaultValue="SO-" />
          </Field>
          <Field label="Invoice prefix" hint="e.g. INV-0125">
            <input className={inputClass} defaultValue="INV-" />
          </Field>
          <Field label="Credit Note prefix" hint="e.g. CN-0030">
            <input className={inputClass} defaultValue="CN-" />
          </Field>
        </>
      )}

      {section === "taxes" && (
        <Field label="VAT rate" hint="Applied to quotations, proforma, and sales invoices.">
          <input className={inputClass} defaultValue="7.5%" />
        </Field>
      )}

      {section === "terms" && (
        <Field label="Default payment terms" hint="Used when a credit customer's terms aren't set individually.">
          <select className={inputClass} defaultValue="30">
            <option value="0">Cash — due immediately</option>
            <option value="15">15 days</option>
            <option value="30">30 days</option>
            <option value="45">45 days</option>
          </select>
        </Field>
      )}

      {section === "invoicing" && (
        <Field
          label="Invoice on"
          hint="Whether a Sales Order generates one invoice for the full order, or one per delivery — matters most for B2B partial fulfillment."
        >
          <select className={inputClass} defaultValue="order">
            <option value="order">Full order only</option>
            <option value="delivery">Each delivery</option>
            <option value="confirmation">Order confirmation (pre-payment)</option>
          </select>
        </Field>
      )}
    </div>
  );
}
