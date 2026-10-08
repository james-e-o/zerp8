# Branch Modules: Implementation and Agentic AI Plan

This document describes the six module areas mounted beneath a branch, their current route and implementation shape, and a backend design for adding useful, permission-aware agentic AI.

## 1. Current Implementation

### Route root and shared shell

All six modules are children of:

```text
/users/[u]/company/[companyId]/branches/[branchId]/modules/[module]
```

The `[u]`, `[companyId]`, and `[branchId]` segments identify the user, company, and current branch. The branch sidebar builds links to enabled branch-level modules. Module layouts supply their own nested navigation and wrap their pages in a module header/sidebar shell. Inventory, Products, Invoices, Purchases, and Sales use client layout components with the shared `ModuleSidebar` and `ModuleHeader`; standalone Orders uses a bespoke horizontal navigation layout. A generic `ModuleLayout` component also exists, but these module route layouts do not use it.

Most module layouts use `isModuleEnabledServer(companyId, moduleKey)` and redirect when the module is disabled. The check calls the Supabase `has_module_access` RPC. Inventory, Products, Invoices, Purchases, and Sales perform that check. The standalone Orders layout currently does not. The server layout checks are entitlement gates; data APIs still need to enforce authentication, company/branch ownership, role permissions, and database RLS independently.

### Module router and subroutes

The following tree summarizes the concrete route folders. `[id]` and `[status]` are dynamic Next.js route segments.

```text
modules/
├── inventory/
│   ├── stock/ [low-stock, out-of-stock]
│   ├── movements/ [inbound, outbound]
│   ├── adjustments/ [pending, posted]
│   ├── transfers/ [pending, in-transit, completed, cancelled]
│   ├── counts/ [scheduled, in-progress, completed]
│   └── reserved/ [by-order, by-quotation, expiring-soon]
├── invoices/
│   ├── create/
│   ├── settings/
│   ├── templates/ [templateId]
│   ├── [invoiceId]/ [edit, export, preview]
│   └── api/
│       ├── [invoiceId]/ [export, post, send]
│       ├── designs/ [generate]
│       └── templates/
├── orders/
│   ├── create/
│   ├── workflow/
│   ├── fulfillment/
│   ├── backorders/
│   └── reports/
├── products/
│   ├── all-products/ [productId]
│   ├── create/
│   ├── categories/
│   ├── brands/
│   ├── attributes/
│   ├── pricing/ [promotions, settings]
│   └── settings/
├── purchases/
│   ├── suppliers/ [new, supplierId/edit]
│   ├── orders/ [new, draft, pending-approval, approved, partially-received,
│   │             fully-received, cancelled, status]
│   ├── requests/ [new, draft, pending-approval, approved, rejected,
│   │               converted, status]
│   ├── receipts/ [new, draft, posted, cancelled, status]
│   ├── bills/ [new, draft, unpaid, partially-paid, paid, overdue,
│   │            cancelled, status]
│   ├── returns/ [status]
│   └── settings/ [section]
└── sales/
    ├── overview/
   ├── channels/
    ├── customers/ [new, customerId, customerId/edit]
    ├── quotations/ [new, draft, sent, accepted, rejected, expired,
    │                 quotationId, quotationId/edit]
    ├── orders/ [new, open, partially_fulfilled, fulfilled, cancelled,
    │            orderId, orderId/edit]
    ├── deliveries/ [new, pending, pickup, completed, delivery,
    │                deliveryId]
    ├── invoices/ [unpaid, partially-paid, paid, overdue, sales_invoice,
    │              sales_invoice/new, proforma, proforma/new, credit_note,
    │              credit_note/new, invoiceId]
    ├── returns/ [new, requested, approved, rejected, received, returnId]
    ├── pos/ [history, history/posId]
    ├── discounts/
    └── settings/
```

Notes on the route map:

- The top-level `invoices` module is separate from the invoice workflows inside `sales`.
- The top-level `orders` module is separate from customer orders inside `sales` and purchase orders inside `purchases`.
- Sales Channels is a Sales subroute. It is intended to manage external selling platforms and Nexshelf's own storefront; product publishing remains reachable from Products.
- Inventory navigation advertises Warehouses and Settings, but corresponding route folders are not present in the current route tree.
- Sales route folders include Discounts, while the Sales layout navigation does not currently expose it.
- The module sidebar builds links from route parameters and each layout's `basePath`. The bespoke Orders layout uses a separate URL-building implementation.

### Module behavior and backend status

| Module | Current behavior | Data/backend status |
| --- | --- | --- |
| Inventory | The root overview presents branch stock KPIs and activity. Stock, movements, adjustments, transfers, counts, and reserved routes render their own filtered lists through six reusable components in `src/components/modules/inventory`. Each route page is a thin wrapper passing its title/filter; the parent section layouts provide the shared title/description and tab navigation. | The overview issues Supabase queries against `inventory_stock`, `inventory_movements`, `inventory_adjustments`, `inventory_transfers`, and `inventory_counts`, which the page itself labels as conceptual table names to reconcile with the final schema. Subroute list rows are static samples from `inventory-demo-data.js`; these screens are not yet connected to inventory persistence. Warehouses and Settings are advertised but lack route folders. |
| Invoices | The root uses `InvoicesList`; create form captures invoice metadata, customer details, line items, and tax totals. Detail, edit, preview, export, send, post, design, and template routes are scaffolded. | The list uses hard-coded sample invoices. The create form calls `/api/invoices`, but the corresponding `src/app/api/invoices` route is not present. Route handlers under the module's `api` folder are TODO stubs. Treat persistence, sending, export, and accounting posting as unimplemented until verified. |
| Orders | Root list includes status/search controls and an empty state. The create form captures customer, delivery, line items, and notes. Workflow, fulfillment, backorders, and reports have route surfaces. | The list/form are client-side UI only: the list starts empty, form submission is not connected to persistence, and no module-specific database/API operations were found. The layout also lacks the module entitlement check used by the other modules. |
| Products | Overview shows company-wide product, variant, category, and brand counts/activity alongside branch-specific pricing contexts, aliases, and price changes. All Products and product details load products, active variants, branch standard prices, and currency information from Supabase. The overview's Add product action routes to `/create`. | This is the most database-connected module in the set. Product/catalog data is company-wide while prices and aliases are branch-specific. Queries are branch-aware in key list/detail paths, but company/branch scope and RLS still need to be consistently verified. |
| Purchases | Routes cover suppliers and the procure-to-pay lifecycle: requests, purchase orders, receipts, bills, returns, and settings. The root overview derives branch-scoped spend, order, request, receipt, and bill activity from `PurchasesProvider`. Purchase request creation writes a draft request and its line items; receipts, list pages, and catalog helpers also contain Supabase reads/writes. | Purchases is partially database-connected, not placeholder-only. `PurchasesProvider` is mounted by `purchasesLayoutClient.jsx` and shares up to 100 recent requests, orders, receipts, and bills with subroutes for the current branch. It does not yet load suppliers, returns, or detail records; some screens still use local/demo fixtures. The full lifecycle, authorization/RLS audit, atomic multi-record writes, approval transitions, payment, and reconciliation still need completion. `dummy-data.js` remains a source of shared formatting/demo data. |
| Sales | Routes cover customers, quotations, customer orders, deliveries, invoices, returns, POS, channels, discounts, and settings. The new Channels page presents Shopify as an external platform and Nexshelf Store as a separate first-party channel. | Many sales routes still import `DUMMY_*` data; the overview also uses mock data. The Channels page is frontend scaffolding: Shopify domain validation is local only, OAuth and token storage are not implemented, channel records are not persisted, and the Nexshelf storefront is not configured. It shows an explicit not-connected state rather than implying success. |

### Sales Channels: Current Frontend

The Sales layout registers a `Channels` navigation item at `/modules/sales/channels`. The page treats connections as company-wide, while noting that product pricing and fulfillment may vary by branch. It currently has two separate entries:

- **Shopify:** external platform card and a dialog that validates a `*.myshopify.com` domain. It does not redirect to Shopify OAuth, create a connection, or handle credentials.
- **Nexshelf Store:** first-party channel setup information, separate from Shopify. Storefront creation and checkout are not implemented.

The displayed `0 connected` count and connection badges are static UI, not database state. Before enabling a real connection, add a server-side OAuth/callback flow, secure token storage, company ownership/permissions, channel and product/variant mapping records, and sync status/error handling. Never send Shopify access tokens to the browser. Keep the shared Nexshelf product as the source record; channel IDs and provider-specific fields belong in mapping records, not core product fields.

The intended split is: **Sales → Channels** manages connections and channel operations; **Products** shows per-product publish/mapping status and offers publish actions. Purchases remains supplier procurement and is not a sales-channel owner.

The route-level module gates are not substitutes for backend authorization. Any new write path must derive the authenticated actor server-side, validate the company and branch against that actor, enforce role permissions and module access, and rely on database policies for defense in depth.

## 2. Agentic AI: Recommended Shape

### Design principle

Build one shared agent runtime with six module-specific toolsets and context providers, not six independent agents with unrestricted database access. Each agent should explain, retrieve, calculate, draft, and propose actions using typed application tools. The server owns all permissions and writes. The model must never receive raw SQL, service-role credentials, or an unrestricted Supabase client.

The agent is “agentic” when it can plan across multiple approved tools, carry context across a workflow, and produce or execute a multi-step result under explicit policy. It does not mean allowing the model to autonomously post financial records, approve purchases, change prices, or ship goods.

### Shared backend foundation

1. **Authenticated entry point:** Add a server-only endpoint or server action for assistant turns. Resolve the Supabase user from the session; do not trust user, company, branch, or role identifiers supplied by the model or browser.
2. **Scope and policy:** Resolve active company/branch membership and role permissions on every request. Check `has_module_access` for the requested module, and enforce RLS on all queried and mutated tables. Refuse requests outside the active scope.
3. **Agent registry:** Configure each module with its prompt, approved tools, read/write classifications, data freshness requirements, and approval rules. Keep module tools behind a shared schema and execution layer.
4. **Typed tools:** Implement narrow server-side functions such as `search_products`, `get_stock`, `draft_purchase_order`, and `send_invoice`. Validate inputs and outputs with schemas, bound result sizes, and return structured errors. Never expose arbitrary table names or SQL to the model.
5. **Human approval:** Make consequential mutations preview-first. Show the exact records and values to change, require confirmation, then re-check authorization and current record state before executing. Require designated human approval for financial posting, payment/credit decisions, procurement approvals, price changes, inventory adjustments, and fulfillment actions.
6. **Reliable execution:** Use database transactions/RPCs for multi-record changes, idempotency keys for retries, optimistic concurrency/version checks, and a durable job queue for long-running work such as document processing or email delivery.
7. **Audit and observability:** Persist the actor, company, branch, conversation/run ID, tool name, validated arguments, approval, result, and timestamps. Redact personal and payment data from model context and logs; set retention limits. Record tool latency/errors and model usage.
8. **Grounding and evaluation:** Return source records, timestamps, and calculations with answers. Add tests for permissions, tenant isolation, tool schemas, approval bypasses, and deterministic calculations; evaluate representative tasks before enabling write tools.

Suggested backend building blocks:

```text
Web client
  -> authenticated assistant endpoint
     -> scope/permission resolver
     -> shared agent orchestrator
        -> module context/read tools
        -> module action tools (policy gated)
     -> audit/run store + durable jobs
     -> Supabase RLS-protected tables and transactional RPCs
```

### Module-specific agent capabilities and backend work

| Module | Useful agent behavior | Backend/data work required before write-capable AI |
| --- | --- | --- |
| Inventory | Answer “what is low or reserved?”, explain stock discrepancies, summarize movement history, suggest replenishment or transfer quantities, and prepare a count/adjustment for review. | Implement canonical stock balances by branch and warehouse, an immutable movement ledger, reservations, transfer/count/adjustment records, and transactional stock mutations. Add branch/location-scoped read tools and idempotent action RPCs. Adjustments and transfers require explicit review; stock must not be silently changed by generated text. |
| Invoices | Draft invoices from a customer request or approved sales record, identify missing fields, explain overdue balances, prepare a reminder, and summarize invoice status. | Complete invoice, line-item, customer, tax, payment, template, and document tables; implement scoped CRUD and numbering; finish the currently stubbed endpoints and align the create form with a real endpoint. Add deterministic tax/total calculations and document/email jobs. Require approval before sending, issuing, or posting. Accounting journal creation must be atomic and deterministic, never delegated to the model. |
| Orders | Turn a request into a draft order, validate customer/product/quantity, check availability and promised dates, explain backorders, and prepare fulfillment suggestions. | Add normalized order/header/line/status/event tables, customer and product references, inventory availability integration, state-transition rules, and transactional create/update/fulfillment endpoints. The present Orders form/list do not persist. Gate the module on the server and enforce status transitions and branch scope. |
| Products | Answer product/catalog questions, summarize variants and branch pricing, suggest descriptions/attributes, detect incomplete records, and prepare channel publish previews. | Build on existing Supabase product/variant/category/attribute/pricing data. Normalize read tools and ensure every query is company/branch scoped. Add channel adapters and product/variant mapping records before enabling publish actions. Add server-side validation and audit/approval for product changes, promotions, and prices. Keep pricing calculations deterministic and show the source cost, margin, and currency. |
| Purchases | Explain spend and supplier history, recommend reorder quantities from demand/lead time/stock, draft purchase requests or POs, match receipts to orders, and flag invoice/receipt discrepancies. | Audit and complete the existing Supabase-backed request, order, receipt, bill, catalog, and supplier paths rather than rebuilding them. Verify schema constraints, branch scoping, RLS, and state transitions; add missing supplier/return/payment persistence and secure server-side tools. Make multi-record writes such as request-plus-lines and receipt posting transactional/idempotent. Connect purchases to inventory and accounting through auditable events/RPCs, add budget/approval policies and duplicate-invoice checks, and reconcile provider aggregates with canonical records. The current partial persistence and remaining demo data are not sufficient for operational recommendations. |
| Sales | Draft quotations and orders, answer customer/order history questions, suggest follow-ups, summarize sales/returns, explain channel sync results, and help an operator prepare a POS transaction. | Replace `DUMMY_*` data with tenant-scoped customer, quotation, order, delivery, invoice, return, and POS persistence. Define status transitions, pricing/tax rules, inventory reservation/fulfillment effects, and payment boundaries. For channels, complete OAuth, connection ownership, provider mapping, and sync jobs before offering agent actions. Use deterministic totals and require confirmation before sending quotations, publishing products, accepting discounts, posting invoices, issuing refunds, or completing fulfillment. |

### Rollout sequence

1. **Make records real:** Replace fixture-backed screens and placeholders with authenticated, branch-scoped APIs and consistent database state transitions. Close the invoice endpoint mismatch and add the missing Orders entitlement check.
2. **Build the channel foundation:** Implement company-owned connections, OAuth/token handling, provider/product/variant mappings, and asynchronous sync status before turning the current Shopify form into a real Connect action.
3. **Ship read-only assistance:** Add grounded search, summaries, explanations, and calculations using scoped tools. Return record citations/links and freshness timestamps.
4. **Add draft generation:** Allow the agent to create unsaved drafts for invoices, orders, quotations, purchase requests, stock actions, and channel publish plans. Validate against the same business rules as manual forms.
5. **Enable approved writes:** Add previews, explicit confirmation, role-based approvals, transactional tools, idempotency, and audit history.
6. **Expand automation by measured risk:** Start with low-risk suggestions and document extraction; only automate actions with clear policy, test coverage, rollback/reconciliation paths, and monitored outcomes.

### Non-negotiable safeguards

- Scope every tool to the authenticated actor's authorized company and branch; ignore model-provided tenant IDs.
- Keep RLS and server authorization active even when a module UI is hidden or disabled.
- Do not let the model execute raw SQL or invoke arbitrary functions.
- Keep money, tax, inventory, and status-transition calculations in deterministic backend code.
- Require explicit permission and approval for financially material or externally visible actions.
- Treat imported documents, user prompts, and retrieved text as untrusted input; do not follow instructions embedded in records or files.
- Make every write auditable, idempotent, and revalidated immediately before commit.

## Code Anchors

- Branch routing and module link generation: `src/components/sidebars/branch-sidebar/branch-sidebar-content.js`
- Module entitlement check: `src/lib/module-access-server.js`
- Shared module shell: `src/components/sidebars/module-sidebar/module-sidebar-content.js` and `src/components/modules/module-layout.js`
- Product data examples: `src/app/users/[u]/company/[companyId]/branches/[branchId]/modules/products/all-products/page.js`
- Product overview and create entry: `src/app/users/[u]/company/[companyId]/branches/[branchId]/modules/products/page.js` and `src/app/users/[u]/company/[companyId]/branches/[branchId]/modules/products/create/page.js`
- Inventory route wrappers and reusable lists: `src/app/users/[u]/company/[companyId]/branches/[branchId]/modules/inventory` and `src/components/modules/inventory/*-list-page.jsx`
- Inventory sample records and shared section tabs: `src/components/modules/inventory/inventory-demo-data.js` and `src/components/modules/inventory/inventory-section-layout.jsx`
- Purchases shared branch-scoped data: `src/app/users/[u]/company/[companyId]/branches/[branchId]/modules/purchases/purchases-context.js` and `purchasesLayoutClient.jsx`
- Purchase request creation and line items: `src/app/users/[u]/company/[companyId]/branches/[branchId]/modules/purchases/requests/new/page.js` and `src/components/modules/purchases/purchase-request-line-items-table.jsx`
- Sales Channels navigation and initial UI: `src/app/users/[u]/company/[companyId]/branches/[branchId]/modules/sales/layout.js` and `src/app/users/[u]/company/[companyId]/branches/[branchId]/modules/sales/channels/page.js`
- Invoice API stubs: `src/app/users/[u]/company/[companyId]/branches/[branchId]/modules/invoices/api/route.js` and `src/app/users/[u]/company/[companyId]/branches/[branchId]/modules/invoices/api/[invoiceId]/route.js`
- Sales fixtures: `src/components/modules/sales/dummy-data.js`
- Purchases fixtures: `src/components/modules/purchases/dummy-data.js`