export const docsModules = [
  {
    slug: "getting-started",
    title: "Getting started",
    summary: "Set up an account, company, branches, and team access.",
    icon: "clipboard",
  },
  {
    slug: "concepts",
    title: "Concepts",
    summary: "Understand the ideas and rules shared across ZERP-8.",
    icon: "building",
  },
  {
    slug: "products",
    title: "Products",
    summary: "Manage the shared catalogue, product details, and pricing.",
    icon: "boxes",
  },
  {
    slug: "purchases",
    title: "Purchases",
    summary: "Follow supplier activity, orders, bills, and payments.",
    icon: "cart",
  },
  {
    slug: "inventory",
    title: "Inventory",
    summary: "Track stock, warehouses, movements, and valuation.",
    icon: "package",
  },
  {
    slug: "sales",
    title: "Sales",
    summary: "Manage customers, orders, invoices, and fulfilment.",
    icon: "store",
  },
  {
    slug: "accounting",
    title: "Accounting",
    summary: "Accounting documentation will be added here.",
    icon: "calculator",
    status: "planned",
  },
  {
    slug: "administration",
    title: "Administration",
    summary: "Company settings, notifications, and system records.",
    icon: "settings",
  },
  {
    slug: "reference",
    title: "Reference",
    summary: "Quick reference tables for permissions, statuses, and settings.",
    icon: "book",
  },
  {
    slug: "faq",
    title: "FAQ",
    summary: "Short answers to common questions, grouped by module.",
    icon: "help",
  },
]

const liveTopics = [
  {
    module: "getting-started",
    slug: "account",
    title: "Account",
    summary: "Sign up, sign in, and keep your profile details up to date.",
    status: "live",
    sections: [
      { heading: "What it is", body: "Your account is your personal sign-in for ZERP-8. It identifies you across the companies and branches you can access." },
      { heading: "Where to find it", body: "Use the public sign-up and sign-in pages. Your profile options are available from the user menu." },
      { heading: "Who can use it", body: "Anyone can create an account. You need an account to accept an invitation or use a workspace." },
      { heading: "How it works", steps: ["Create an account with your email and sign-in details.", "Sign in to open your user workspace.", "Use the profile menu to review your account details."] },
      { heading: "Rules and limits", items: ["An account does not grant access to a company by itself.", "Company and branch access depends on an invitation or assigned permissions."] },
      { heading: "Related", related: ["getting-started/company", "getting-started/staff", "getting-started/permissions"] },
    ],
  },
  {
    module: "getting-started",
    slug: "company",
    title: "Creating a company",
    summary: "Create a company, choose its default currency, and get its Head Office branch.",
    status: "live",
    sections: [
      { heading: "What it is", body: "A company is the shared workspace for its branches, team, catalogue, and company-wide settings." },
      { heading: "Where to find it", body: "From your user workspace, choose Launch New Company. Existing companies appear in the company switcher." },
      { heading: "Who can use it", body: "A signed-in user can create a company. Company owners can manage company details and access." },
      { heading: "How it works", steps: ["Open Launch New Company.", "Enter the company details and choose its default currency.", "Create the company. ZERP-8 creates a Head Office branch automatically."] },
      { heading: "Rules and limits", items: ["The company default currency is used as the starting currency for company activity.", "The Head Office branch is created with the company and is not a separate company."] },
      { heading: "Related", related: ["getting-started/branches", "concepts/company-vs-branch", "concepts/currencies"] },
    ],
  },
  {
    module: "getting-started",
    slug: "branches",
    title: "Branches",
    summary: "Create branches and maintain their profile and operating currency.",
    status: "live",
    sections: [
      { heading: "What it is", body: "A branch is a location within a company. Branch-level work, such as stock and operational documents, is associated with a branch." },
      { heading: "Where to find it", body: "Open a company, then choose Branches from its sidebar." },
      { heading: "Who can use it", body: "Company users with branch-management access can create or update branches." },
      { heading: "How it works", steps: ["Open the company and go to Branches.", "Create a branch or select an existing one.", "Update its name, address, tax ID, logo, or currency in the branch profile."] },
      { heading: "Rules and limits", items: ["Each branch belongs to one company.", "A branch uses its own currency setting for branch-level work."] },
      { heading: "Related", related: ["getting-started/company", "getting-started/staff", "concepts/company-vs-branch", "concepts/currencies"] },
    ],
  },
  {
    module: "getting-started",
    slug: "staff",
    title: "Inviting staff",
    summary: "Invite people, review onboarding, and assign branch access.",
    status: "live",
    sections: [
      { heading: "What it is", body: "Staff invitations let a company bring people into its workspace and assign the branches they can work in." },
      { heading: "Where to find it", body: "Open Staff from the company or branch sidebar." },
      { heading: "Who can use it", body: "Users with staff-management access can invite people and manage their branch assignments." },
      { heading: "How it works", steps: ["Send an invitation to the person's email address.", "The invitee accepts the invitation and completes the requested onboarding details.", "Review onboarding when required, then assign the person to the appropriate branches."] },
      { heading: "Rules and limits", items: ["An invitation does not provide workspace access until it is accepted.", "Only assign a person to branches they need to use."] },
      { heading: "Statuses", table: { columns: ["Status", "Meaning"], rows: [["Pending", "The invitation has been sent and is awaiting a response."], ["Accepted", "The invitee has accepted the invitation."], ["Onboarding review", "Submitted onboarding details are awaiting review."]] } },
      { heading: "Related", related: ["getting-started/permissions", "concepts/company-vs-branch"] },
    ],
  },
  {
    module: "getting-started",
    slug: "permissions",
    title: "Permissions",
    summary: "Learn the access levels and permission verbs used in the workspace.",
    status: "live",
    sections: [
      { heading: "What it is", body: "Permissions define which company and branch resources a team member can use and which actions they can take." },
      { heading: "Where to find it", body: "Company and branch access settings are managed from the relevant workspace's staff or permissions screens." },
      { heading: "Who can use it", body: "Owners and users with permission-management access can assign access levels." },
      { heading: "How it works", steps: ["Assign the user an access level for the relevant scope.", "Grant only the verbs needed for their work.", "Check both company and branch access when a user cannot open a screen or complete an action."] },
      { heading: "Rules and limits", items: ["Common permission verbs include view, create, edit, delete, approve, and manage.", "Company-level and branch-level access combine; access at one scope does not automatically grant every action at the other.", "The company owner is exempt from ordinary permission restrictions."] },
      { heading: "Related", related: ["getting-started/staff", "reference/permissions-matrix", "concepts/approvals"] },
    ],
  },
  {
    module: "getting-started",
    slug: "subscriptions",
    title: "Subscriptions",
    summary: "See how plans, trials, and module access fit together.",
    status: "live",
    sections: [
      { heading: "What it is", body: "A subscription determines which plan applies to a company and which modules that plan makes available." },
      { heading: "Where to find it", body: "Open Subscriptions from the company sidebar." },
      { heading: "Who can use it", body: "Company owners and users with subscription-management access can review subscription details." },
      { heading: "How it works", steps: ["Review the available plan and trial information.", "Choose a plan for the company's needs.", "Open the module manager to see which modules are available under the plan."] },
      { heading: "Rules and limits", items: ["Module availability depends on the company's plan.", "Trial length and plan features are shown in the subscription screens; check there for current details."] },
      { heading: "Related", related: ["getting-started/company", "administration/company-settings"] },
    ],
  },
  {
    module: "getting-started",
    slug: "navigation",
    title: "Navigation",
    summary: "Use the sidebar to switch workspaces and find notifications.",
    status: "live",
    sections: [
      { heading: "What it is", body: "The sidebar provides links to your user, company, branch, and module workspaces." },
      { heading: "Where to find it", body: "The sidebar is shown beside the current workspace. The notification bell is in the workspace header." },
      { heading: "Who can use it", body: "Anyone signed in can use the navigation options available to their account." },
      { heading: "How it works", steps: ["Choose a company from the company list.", "Open a branch to work with branch-specific records.", "Use the module links to move between work areas.", "Open the notification bell to review pending invitations or other notices."] },
      { heading: "Rules and limits", items: ["The sidebar only shows workspaces and actions available to your account.", "A missing link may mean you need access or a subscription that includes the module."] },
      { heading: "Related", related: ["getting-started/account", "getting-started/company", "getting-started/branches"] },
    ],
  },
  {
    module: "concepts",
    slug: "company-vs-branch",
    title: "Company and branch",
    summary: "See which information is shared and which belongs to a branch.",
    status: "live",
    sections: [
      { heading: "What it is", body: "A company groups shared business information and its branches. Each branch has its own operational records." },
      { heading: "How it works", items: ["Company-wide information includes the shared product catalogue, categories, and brands.", "Branch-level information includes stock, prices, and operational documents.", "Use the company workspace for shared setup and a branch workspace for local operations."] },
      { heading: "Rules and limits", items: ["A branch belongs to one company.", "Company-wide product information can be used across branches, while branch activity remains associated with its branch."] },
      { heading: "Related", related: ["getting-started/company", "getting-started/branches", "concepts/currencies"] },
    ],
  },
  {
    module: "concepts",
    slug: "approvals",
    title: "Approvals",
    summary: "Understand approval requests and the permissions used to act on them.",
    status: "live",
    sections: [
      { heading: "What it is", body: "An approval request asks an authorized user to review a restricted action before it proceeds." },
      { heading: "Who can use it", body: "Users with the relevant approve permission can act on requests. The company owner is exempt from ordinary permission restrictions." },
      { heading: "How it works", steps: ["A user requests approval when an action requires it.", "An authorized approver reviews the request.", "The approval can be used once for the action it covers."] },
      { heading: "Rules and limits", items: ["An approval is one-time use; it does not grant ongoing access.", "Approval requirements depend on the action and its configured rules."] },
      { heading: "Related", related: ["getting-started/permissions", "reference/permissions-matrix"] },
    ],
  },
  {
    module: "concepts",
    slug: "document-numbers",
    title: "Document numbers",
    summary: "Learn how document prefixes identify records such as invoices and orders.",
    status: "live",
    sections: [
      { heading: "What it is", body: "Document numbers are identifiers that help teams recognize and find operational records." },
      { heading: "How it works", items: ["A prefix can indicate the document type, such as INV for an invoice, PO for a purchase order, or RCT for a receipt.", "The remaining part distinguishes the record within its numbering sequence."] },
      { heading: "Rules and limits", items: ["Number formats are managed in settings where the document type supports configuration.", "A document number identifies a record; it does not indicate that the document is approved or complete."] },
      { heading: "Related", related: ["administration/number-formats", "reference/statuses", "concepts/statuses"] },
    ],
  },
  {
    module: "concepts",
    slug: "statuses",
    title: "Statuses",
    summary: "Understand status tags and why some changes are manual.",
    status: "live",
    sections: [
      { heading: "What it is", body: "A status tag summarizes where a record is in its workflow. It is separate from the record's number and its approval history." },
      { heading: "How it works", items: ["Draft records are still being prepared.", "Open records are active in a workflow.", "Completed records have reached a finished state.", "Cancelled records have been stopped rather than completed."] },
      { heading: "Rules and limits", items: ["Available statuses differ by document type.", "Some status changes happen automatically after an action; others require a user to choose an allowed action."] },
      { heading: "Related", related: ["reference/statuses", "concepts/approvals", "concepts/drafts"] },
    ],
  },
  {
    module: "concepts",
    slug: "currencies",
    title: "Currencies",
    summary: "Compare the company default currency with branch currency.",
    status: "live",
    sections: [
      { heading: "What it is", body: "ZERP-8 stores a default currency for the company and a currency for each branch." },
      { heading: "Where to find it", body: "The company currency is set in company details. Branch currency is part of the branch profile." },
      { heading: "How it works", items: ["The company default currency is used for company-level defaults.", "Branch currency is used for branch-level work and is shown with relevant branch records."] },
      { heading: "Rules and limits", items: ["Choose the correct currency when setting up a company or branch.", "Changing a currency does not itself convert existing amounts."] },
      { heading: "Related", related: ["getting-started/company", "getting-started/branches", "company-vs-branch"] },
    ],
  },
  {
    module: "concepts",
    slug: "drafts",
    title: "Drafts",
    summary: "Learn how unfinished records can be saved and resumed.",
    status: "live",
    sections: [
      { heading: "What it is", body: "A draft is an unfinished record that has not yet been submitted or posted as a final document." },
      { heading: "How it works", steps: ["Start a supported record.", "Save it as a draft when you need to pause.", "Return to the draft to review and continue it."] },
      { heading: "Rules and limits", items: ["Draft support depends on the type of record.", "A draft does not have the same effect as a submitted, posted, or completed record."] },
      { heading: "Related", related: ["concepts/statuses", "purchases/orders", "sales/invoices"] },
    ],
  },
  {
    module: "concepts",
    slug: "glossary",
    title: "Glossary",
    summary: "Plain-language definitions for common operations terms.",
    status: "live",
    sections: [
      { heading: "What it is", body: "A quick reference for terms used across purchasing, inventory, and sales." },
      { heading: "How it works", items: [
        "GRNI: Goods Received Not Invoiced; goods have been received but the supplier bill has not yet been recorded.",
        "Pro forma: A preliminary sales document issued before the final invoice.",
        "Advance: A payment received or made before it is fully matched to a bill or invoice.",
        "Hold: A record or stock quantity set aside so it cannot be used in normal work.",
        "Layer: A group of inventory units with a shared cost used by a layer-based valuation method.",
      ] },
      { heading: "Related", related: ["purchases/bills", "inventory/valuation-and-costing", "sales/pro-forma-invoices"] },
    ],
  },
  {
    module: "purchases",
    slug: "rfqs",
    title: "Request for Quotation",
    summary: "Request prices from one supplier and compare the quoted prices before creating a purchase order.",
    status: "live",
    sections: [
      { heading: "What it is", body: "An RFQ asks one supplier to quote prices and terms for a set of products. An Open RFQ with prices on every line can be converted into a purchase order." },
      { heading: "Where to find it", body: "Purchases > RFQs." },
      { heading: "Who can use it", body: "People with access to Purchases in the branch can view RFQs. Creating and managing RFQs requires the matching permissions." },
      { heading: "How it works", steps: ["Create an RFQ for one supplier and add products and quantities.", "Set an optional reply-by date; otherwise the branch default is used.", "Enter the supplier's quoted prices and terms when they reply.", "Convert an Open RFQ with a price on every line into a purchase order."] },
      { heading: "Rules and limits", items: ["One RFQ has one supplier.", "An Open RFQ becomes Lost when its reply-by date passes.", "Only Open RFQs can be converted to purchase orders.", "Converted and Cancelled RFQs are final; duplicate one to start a new draft."] },
      { heading: "Statuses", items: ["Draft: being prepared.", "Open: sent for a supplier quotation and awaiting a response.", "Lost: the reply-by date passed; it can be reopened.", "Converted: used to create a purchase order.", "Cancelled: closed with a reason."] },
      { heading: "Related", related: ["purchases/orders", "purchases/settings"] },
    ],
  },
]

const plannedTopicRows = [
  ["products", "overview", "Products overview", "A map of the product catalogue and pricing tools.", "live"],
  ["products", "catalogue", "Product catalogue", "Search and review shared products and their details."],
  ["products", "create-product", "Creating a product", "Product details, configurations, variants, and drafts."],
  ["products", "variants-and-barcodes", "Variants and barcodes", "Options, SKUs, barcode rules, and duplicate checks."],
  ["products", "categories-brands-attributes", "Categories, brands, and attributes", "Organize products with shared product information."],
  ["products", "units-and-quantity-rules", "Units and quantity rules", "Measurement units and product quantity settings."],
  ["products", "batches-and-expiry", "Batches and expiry", "Track product batches, expiry dates, and shelf life."],
  ["products", "pricing-contexts", "Pricing contexts", "Understand standard pricing and other pricing contexts."],
  ["products", "standard-price-and-margin", "Standard price and margin", "Review selling price, margin, and minimum-margin rules."],
  ["products", "cost-estimates", "Cost estimates", "Estimate product costs and review estimate methods."],
  ["products", "suggested-prices", "Suggested prices", "Review, edit, approve, or reject suggested prices."],
  ["products", "price-changes", "Price changes", "Review price history and recorded reasons."],
  ["products", "reprice-modes", "Reprice modes", "Automatic, review, and locked repricing settings.", "planned"],
  ["products", "settings", "Product settings", "Review catalogue, pricing, and product defaults."],
  ["purchases", "overview", "Purchases overview", "A map of supplier purchasing and payment workflows.", "live"],
  ["purchases", "suppliers", "Suppliers", "Maintain supplier records for purchasing activity."],
  ["purchases", "orders", "Purchase orders", "Create, review, receive, cancel, and merge purchase orders."],
  ["purchases", "order-approval", "Purchase order approval", "Approval before a purchase order becomes open.", "planned"],
  ["purchases", "bills", "Supplier bills", "Create bills from orders and handle partial billing."],
  ["purchases", "supplier-payments", "Supplier payments", "Pay bills, record advances, and handle refunds."],
  ["purchases", "returns", "Purchase returns", "Record goods returned to a supplier."],
  ["purchases", "emergency-receipts", "Emergency receipts", "Record receipt of goods without a purchase order."],
  ["purchases", "settings", "Purchase settings", "General, order, bill, return, and approval settings."],
  ["inventory", "overview", "Inventory overview", "A map of stock, storage, and inventory workflows.", "live"],
  ["inventory", "stock", "Stock", "Review stock availability and quantities by branch."],
  ["inventory", "warehouses-and-shelves", "Warehouses and shelves", "Organize inventory storage locations."],
  ["inventory", "receipts", "Receipts", "Receive goods against orders and record shortages or excess."],
  ["inventory", "quarantine-and-holds", "Quarantine and holds", "Set aside stock that cannot be used in normal operations."],
  ["inventory", "transfers", "Transfers", "Move stock between locations and follow in-transit value."],
  ["inventory", "adjustments-and-counts", "Adjustments and counts", "Count stock and record quantity corrections."],
  ["inventory", "movements", "Stock movements", "Review the read-only inventory movement ledger."],
  ["inventory", "batches-and-expiry", "Batches and expiry", "Track batch quantities, expiry dates, and shelf life."],
  ["inventory", "valuation-and-costing", "Valuation and costing", "Understand FIFO and weighted-average valuation."],
  ["inventory", "cost-variances", "Cost variances", "Review and resolve inventory cost differences."],
  ["inventory", "settings", "Inventory settings", "General, costing, receiving, and approval settings."],
  ["sales", "overview", "Sales overview", "A map of customer, order, invoice, and delivery workflows.", "live"],
  ["sales", "customers", "Customers", "Maintain customer records for sales activity."],
  ["sales", "quotations", "Quotations", "Prepare quotations, manage expiry, and convert to orders."],
  ["sales", "orders", "Sales orders", "Manage order contracts, reservations, and order status."],
  ["sales", "pro-forma-invoices", "Pro forma invoices", "Create a pro forma from an order and prepare an invoice."],
  ["sales", "invoices", "Sales invoices", "Create invoices, apply discounts, post, and cancel."],
  ["sales", "deliveries", "Deliveries", "Record full or partial deliveries against orders."],
  ["sales", "payments-and-advances", "Payments and advances", "Receive payments, allocate balances, and manage advances."],
  ["sales", "returns", "Sales returns", "Review return windows, approvals, and refund methods."],
  ["sales", "pos", "Point of sale", "Use the till, hold sales, and apply permitted discounts."],
  ["sales", "discounts-and-margin", "Discounts and margin", "Review discount limits, minimum margin, and overrides."],
  ["sales", "promotions", "Promotions", "Promotion tools are planned.", "planned"],
  ["sales", "settings", "Sales settings", "General, documents, delivery, discounts, returns, and POS."],
  ["administration", "company-settings", "Company settings", "Review company profile and shared defaults."],
  ["administration", "number-formats", "Number formats", "Configure supported document number sequences."],
  ["administration", "document-templates", "Document templates", "Document templates are planned.", "planned"],
  ["administration", "notifications", "Notifications", "Review workspace notifications and pending actions."],
  ["administration", "audit-and-history", "Audit and history", "Audit and history tools are planned.", "planned"],
  ["reference", "permissions-matrix", "Permissions matrix", "Compare modules and supported permission verbs."],
  ["reference", "statuses", "Status reference", "A quick table of document workflow statuses."],
  ["reference", "settings-index", "Settings index", "Find settings, their locations, and defaults."],
  ["reference", "changelog", "Changelog", "Review dated changes to ZERP-8."],
]

const faqTopics = [
  {
    module: "faq",
    slug: "getting-started",
    title: "Getting started",
    summary: "Short answers about accounts, companies, branches, and access.",
    status: "live",
    sections: [
      { heading: "Getting started FAQs", faqs: [
        { question: "Is a company the same as a branch?", answer: "No. A company groups shared information and branches. Each branch has its own operational records." },
        { question: "Does a new company get a Head Office branch?", answer: "Yes. ZERP-8 creates a Head Office branch when the company is created." },
        { question: "Does accepting an invitation make every module available?", answer: "No. Account access, permissions, and the company's subscription determine what you can use." },
      ] },
    ],
  },
  {
    module: "faq",
    slug: "concepts",
    title: "Concepts",
    summary: "Short answers about approvals, statuses, currencies, and drafts.",
    status: "live",
    sections: [
      { heading: "Concepts FAQs", faqs: [
        { question: "Does a document number mean a document is complete?", answer: "No. A number identifies a record. Its status shows where it is in the workflow." },
        { question: "Does an approval grant ongoing access?", answer: "No. An approval is for the action it covers and can be used once." },
        { question: "Does changing a currency convert existing amounts?", answer: "No. Changing the currency setting does not itself convert existing amounts." },
      ] },
    ],
  },
]

const faqTopicRows = [
  ["products", "Products"],
  ["purchases", "Purchases"],
  ["inventory", "Inventory"],
  ["sales", "Sales"],
  ["accounting", "Accounting"],
  ["administration", "Administration"],
  ["reference", "Reference"],
]

export const docsRegistry = [
  ...liveTopics,
  ...plannedTopicRows.map(([module, slug, title, summary, status = "planned"]) => ({
    module,
    slug,
    title,
    summary,
    status,
    sections: status === "live" ? [{ heading: "What it is", body: summary }] : [],
  })),
  ...faqTopics,
  ...faqTopicRows.map(([sourceModule, title]) => ({
    module: "faq",
    slug: sourceModule,
    title,
    summary: `Short answers for ${title.toLowerCase()} are being prepared.`,
    status: "planned",
    sections: [],
  })),
]

export function getDocsModule(slug) {
  return docsModules.find((module) => module.slug === slug)
}

export function getDocsTopic(moduleSlug, topicSlug) {
  return docsRegistry.find((topic) => topic.module === moduleSlug && topic.slug === topicSlug)
}

export function getModuleTopics(moduleSlug) {
  return docsRegistry.filter((topic) => topic.module === moduleSlug)
}

export function getAdjacentTopics(moduleSlug, topicSlug) {
  const topics = getModuleTopics(moduleSlug)
  const index = topics.findIndex((topic) => topic.slug === topicSlug)

  if (index < 0) return { previous: null, next: null }

  return {
    previous: topics[index - 1] || null,
    next: topics[index + 1] || null,
  }
}
