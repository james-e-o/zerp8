# Invoice Module Architecture Documentation

## 📋 Overview

This document outlines the complete architecture for the NexShelf Pro invoice module. It's designed to be customizable, scalable, and integrated with accounting systems.

---

## 🎯 Core Concepts

### Invoice vs Sales vs Accounting

| Concept | Definition | Key Difference |
|---------|-----------|-----------------|
| **Invoice** | A financial document requesting payment | Generic - for anything (services, misc income, adjustments) |
| **Sales** | Business transactions involving products | Always tied to inventory & stock |
| **Accounting** | System of record (ledger, journals) | Truth layer - invoices don't affect books until posted |

### Critical Rule: Posting Lifecycle

```
Draft → Issued → Approved → Posted → Paid
  ↓       ↓         ↓         ↓       ↓
 Edit    Edit     Review    RO*    Reconciled
 
*RO = Read-Only
```

**Only Posted invoices create accounting entries**

---

## 📁 Folder Structure

```
invoices/
├── layout.js                           # Module layout & navigation
├── page.js                             # Invoice list/dashboard
│
├── create/
│   └── page.js                         # Create new invoice
│
├── [invoiceId]/
│   ├── page.js                         # View invoice details
│   ├── edit/
│   │   └── page.js                     # Edit invoice (draft/issued only)
│   ├── preview/
│   │   └── page.js                     # Full-page invoice preview
│   └── export/
│       └── page.js                     # Export to PDF/DOCX
│
├── templates/
│   ├── page.js                         # Browse & manage templates
│   └── [templateId]/
│       └── page.js                     # View/edit specific template
│
├── designs/
│   ├── page.js                         # Browse & manage designs (PRO)
│   └── generate/
│       └── page.js                     # AI design generator (PRO)
│
├── settings/
│   └── page.js                         # Global invoice config
│
└── api/
    ├── route.js                        # GET all / POST create
    ├── [invoiceId]/
    │   ├── route.js                    # GET / PATCH / DELETE
    │   ├── post/route.js               # POST to accounting
    │   ├── export/route.js             # Generate PDF/DOCX
    │   └── send/route.js               # Send via email
    ├── templates/route.js              # Template CRUD
    └── designs/
        └── generate/route.js           # AI generation
```

---

## 🧩 Components Architecture

### Core Components (`src/components/invoices/`)

#### 1. **InvoiceForm.jsx**
- **Purpose**: Create & edit invoices
- **Features**:
  - Dynamic line items management
  - Client selection/creation
  - Tax & discount calculation
  - Template & design selection
  - Save as Draft or Issue
- **Props**:
  - `initialData` - For edit mode
  - `onSuccess` - Callback after save
  - `companyId`, `branchId` - Context

#### 2. **InvoiceRenderer.jsx**
- **Purpose**: Render invoice based on template + design + data
- **Features**:
  - Server-renderable (for PDFs)
  - Design-agnostic
  - Print-friendly
- **Props**:
  - `invoice` - Invoice data
  - `template` - Template configuration
  - `design` - Design/styling config
  - `mode` - 'view' | 'print' | 'pdf'

#### 3. **LineItemsTable.jsx**
- **Purpose**: Display & manage line items
- **Features**:
  - Add/remove rows
  - Inline editing
  - Subtotal calculations
  - Tax toggle per item

#### 4. **TotalsSummary.jsx**
- **Purpose**: Display invoice calculations
- **Features**:
  - Subtotal
  - Discounts (amount or %)
  - Taxes
  - Grand total
  - Currency support

### Template Components (`src/components/invoices/templates/`)

**Three built-in templates:**

1. **ClassicTemplate.jsx** - Professional services
   - Standard header layout
   - Simple clean design
   - Best for: Consulting, professional services

2. **ModernTemplate.jsx** - Contemporary design
   - Gradient/bold color accents
   - Modern typography
   - Best for: Tech, creative services

3. **MinimalTemplate.jsx** - Spacious & elegant
   - Lots of whitespace
   - Subtle accents
   - Best for: Freelancers, minimalist brands

---

## 🔌 API Routes

### Invoices CRUD

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/invoices` | Fetch all invoices (paginated) |
| POST | `/api/invoices` | Create new invoice |
| GET | `/api/invoices/[id]` | Fetch single invoice |
| PATCH | `/api/invoices/[id]` | Update invoice |
| DELETE | `/api/invoices/[id]` | Delete invoice (draft only) |

### Posting to Accounting

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/invoices/[id]/post` | Change status to Posted + create journal entry |

**Journal Entry Logic:**
```
For non-sales invoice:
  Debit: Accounts Receivable
  Credit: Service Revenue (or misc account)

For sales invoice:
  Debit: Accounts Receivable
  Credit: Sales Revenue
  Debit: Cost of Goods Sold
  Credit: Inventory
```

### Export & Communication

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/invoices/[id]/export` | Generate PDF/DOCX |
| POST | `/api/invoices/[id]/send` | Send via email |

### Templates

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/invoices/templates` | Fetch all templates |
| POST | `/api/invoices/templates` | Create custom template |

### AI Design (PRO)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/invoices/designs/generate` | Generate design with AI |

---

## 💾 Data Model (Supabase Tables)

### invoices
```sql
id (uuid)
company_id (uuid)
branch_id (uuid)
invoice_number (string) - Unique sequence
invoice_date (date)
due_date (date)
client_id (uuid) - Optional, for repeat clients
client_name (string)
client_email (string)
client_address (text)
template_id (string) - References template
design_id (uuid) - Optional, for custom designs (PRO)
subtotal (numeric)
discount_type (enum: 'amount', 'percentage')
discount_value (numeric)
tax_rate (numeric) - Percentage
total (numeric)
notes (text)
status (enum: 'draft', 'issued', 'approved', 'posted', 'paid')
created_at (timestamp)
updated_at (timestamp)
```

### invoice_line_items
```sql
id (uuid)
invoice_id (uuid)
description (string)
quantity (numeric)
unit_price (numeric)
taxable (boolean)
account_code (string) - For accounting mapping
sort_order (integer)
created_at (timestamp)
```

### invoice_templates
```sql
id (string) - 'classic', 'modern', 'minimal', custom IDs
company_id (uuid) - NULL for built-in
name (string)
description (text)
structure (jsonb) - Template configuration
is_default (boolean)
is_custom (boolean)
created_at (timestamp)
```

### invoice_designs
```sql
id (uuid)
company_id (uuid)
name (string)
colors (jsonb) - { primary, secondary, accent }
fonts (jsonb) - { heading, body }
background_url (text)
spacing (jsonb)
border_style (string)
ai_generated (boolean)
created_at (timestamp)
```

### invoice_settings (Company Level)
```sql
company_id (uuid) - Primary key
logo_url (text)
company_name (string)
company_address (text)
company_phone (string)
company_email (string)
default_currency (string) - Default: '₦'
tax_rate_default (numeric)
payment_terms_default (string)
default_template_id (string)
footer_text (text)
legal_text (text)
invoice_number_prefix (string)
invoice_number_sequence (integer)
updated_at (timestamp)
```

### accounting_entries
```sql
id (uuid)
company_id (uuid)
invoice_id (uuid)
entry_date (date)
account_debit (string) - Account code
amount_debit (numeric)
account_credit (string) - Account code
amount_credit (numeric)
description (string)
reference_type (enum: 'invoice', 'sales', 'adjustment')
created_at (timestamp)
```

---

## 🔄 Integration Points

### With Accounting Module

**Events / Webhooks:**
- `invoice.posted` - Triggered when invoice is Posted
  - Accounting module listens
  - Creates journal entries
  - Updates GL balances

- `invoice.paid` - Triggered when invoice is marked Paid
  - Accounting module creates payment entry
  - Reconciles with cash account

**Data Flow:**
```
Invoice (Draft)
    ↓ (User clicks "Post")
    ↓ POST /api/invoices/[id]/post
    ↓
Invoice Status → Posted
    ↓
Emit Event: invoice.posted
    ↓
Accounting Module Listens
    ↓
Create Journal Entry
    ↓
Update GL Accounts
```

### With Sales Module

**Relationship:**
- Sales module generates Sales Invoices automatically
- Sales invoices have different accounting entries (include COGS)
- Both inherit from same core invoice structure
- Can be distinguished by `reference_type` or `source` field

---

## 🎨 Design System

### Template (Structure) vs Design (Style)

| Aspect | Template | Design |
|--------|----------|--------|
| **What** | Layout & arrangement | Colors, fonts, backgrounds |
| **Where** | invoice_templates table | invoice_designs table |
| **Examples** | Header position, item table layout | Blue primary color, sans-serif font |
| **Customization** | Structural changes | Style-only changes |

### AI Design Generation (PRO Feature)

**Flow:**
1. User describes ideal design or selects style preference
2. AI generates design config JSON
3. System downloads/generates background image
4. Saves design to database
5. User can apply to invoices or refine

**Design Config Structure:**
```json
{
  "colors": {
    "primary": "#1f2937",
    "secondary": "#6366f1",
    "accent": "#f97316"
  },
  "fonts": {
    "heading": "Inter, sans-serif",
    "body": "Inter, sans-serif"
  },
  "backgroundUrl": "https://...",
  "spacing": {
    "padding": "40px",
    "marginBottom": "30px"
  },
  "borderStyle": "solid"
}
```

---

## 📦 Global Invoice Settings

**Company-level configuration (not per-invoice):**

1. **Company Information**
   - Company name
   - Logo
   - Address
   - Contact info

2. **Tax Configuration**
   - Default tax rate
   - Tax inclusive/exclusive
   - Tax account codes

3. **Payment Terms**
   - Default payment period
   - Late payment penalties
   - Accepted payment methods

4. **Numbering**
   - Invoice number prefix
   - Sequence counter
   - Format (INV-2025-001, etc.)

5. **Footer & Legal**
   - Default footer text
   - Legal disclaimers
   - Payment instructions
   - Company registration info

6. **Defaults**
   - Default template
   - Default design
   - Default currency

---

## 🔐 Status & Permissions

### Invoice Statuses

| Status | Editable | Can Post | Can Delete | Notes |
|--------|----------|----------|-----------|-------|
| Draft | ✅ Yes | ❌ No | ✅ Yes | Work in progress |
| Issued | ⚠️ Limited | ✅ Yes | ❌ No | Sent to customer |
| Approved | ❌ No | ✅ Yes | ❌ No | Waiting for posting |
| Posted | ❌ No | ❌ No | ❌ No | Affects accounting |
| Paid | ❌ No | N/A | ❌ No | Archived/reconciled |

### User Permissions (Future)

- `create_invoice` - Create new invoices
- `edit_invoice` - Edit draft/issued invoices
- `post_invoice` - Post invoices to accounting
- `delete_invoice` - Delete draft invoices
- `export_invoice` - Export to PDF/DOCX
- `send_invoice` - Send via email
- `manage_templates` - Create/edit templates
- `manage_designs` - Create/edit designs (PRO)
- `manage_settings` - Configure global settings

---

## 🚀 Next Steps / Implementation Roadmap

### Phase 1: Core (Weeks 1-2)
- ✅ Folder structure
- ✅ Components scaffold
- [ ] Supabase schema
- [ ] API routes implementation
- [ ] Invoice CRUD

### Phase 2: Features (Weeks 3-4)
- [ ] Invoice form validation
- [ ] Template rendering
- [ ] Export to PDF (Puppeteer)
- [ ] Email integration (Resend)

### Phase 3: Integration (Weeks 5-6)
- [ ] Accounting sync (journal entries)
- [ ] Sales module integration
- [ ] Double-entry validation

### Phase 4: PRO Features (Weeks 7-8)
- [ ] AI design generation
- [ ] Design customization UI
- [ ] Custom backgrounds
- [ ] Export to Word (DOCX)

### Phase 5: Polish (Week 9+)
- [ ] Advanced search/filters
- [ ] Bulk operations
- [ ] Email templates
- [ ] Analytics & reporting
- [ ] Mobile optimization

---

## 📝 Notes

1. **Database Design**: Templates should be mostly JSON-based for flexibility
2. **Export Strategy**: Always render server-side for consistency
3. **AI Integration**: Plan for OpenAI API integration for design generation
4. **Accounting**: Use event-driven architecture to keep modules decoupled
5. **Caching**: Cache templates & designs for faster rendering

---

## 🔗 Related Modules

- **Accounting Module**: Consumes posting events
- **Sales Module**: Generates sales invoices
- **Email Module**: Sends invoice notifications
- **Settings Module**: Manages global config

---

**Last Updated**: January 7, 2025
**Version**: 1.0
