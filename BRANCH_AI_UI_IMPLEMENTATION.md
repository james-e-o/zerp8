# Branch AI UI Implementation Summary

## Purpose

This document describes the current Branch AI interface implementation for review and planning. It is a UI-only foundation: it does not connect to an AI model, read business records for prompts, or execute actions.

## Product Scope

There is one assistant scope in this implementation: **the current branch**. The **Zerp8 AI** action is reachable from both the Branch sidebar footer and the shared Module sidebar footer. Both controls open the same assistant panel and the same branch-wide context; the Module sidebar does not create a module-specific assistant. The footer tooltip is currently `Zerp-8 AI`, while the panel heading and status copy still say `Branch AI`; align these labels as a follow-up if that distinction is not intentional.

The panel covers the active branch content area, including module content, while leaving the active sidebar and its header visible. It therefore works independently of the current branch route.

## Current UI Behavior

- The **Zerp8 AI** sidebar action toggles the panel open and closed from either sidebar. It is content-fit, with a blue-50 background and blue-500 text; its hover state uses blue-100.
- The panel identifies the current branch and labels its scope as the entire branch.
- The panel reveals downward from the top, with opacity and position transitions, and animates out when closed.
- The prompt composer is positioned directly below the panel header, above the suggestions and context content.
- The user can type a prompt or click one of four suggested prompts. Suggestions populate the composer.
- Enter submits; Shift+Enter inserts a newline. Escape closes the panel. A close button is also available.
- The desktop layout includes a context rail describing branch-wide coverage; on smaller screens this rail is hidden.
- Submitting a prompt does not send it anywhere. The UI explicitly reports that the assistant is not connected.

## Implementation Map

- `src/app/users/[u]/company/[companyId]/branches/[branchId]/branchLayoutClient.jsx`
  - Wraps all branch-route children in `BranchAssistantProvider` and renders the branch dashboard overlay in its content viewport.
  - Keeps the Branch header and sidebar outside the overlay.
- `src/components/ai/branch-assistant-context.js`
  - Owns open/closed state and exposes the shared toggle, close action, and branch name to nested route components.
  - Exports `BranchAssistantOverlay` for each route shell to place over its own content pane.
- `src/components/ai/branch-assistant.jsx`
  - Renders the panel, branch label, composer, suggestions, context rail, close behavior, and entrance/exit animation.
- `src/components/sidebars/branch-sidebar/branch-sidebar.js`
  - Passes the Branch AI toggle into the Branch sidebar footer.
- `src/components/sidebars/branch-sidebar/branch-sidebar-footer.js`
  - Renders the Branch AI action in the Branch sidebar footer.
- `src/components/sidebars/module-sidebar/module-sidebar.js`
  - Reads the shared branch toggle from context and passes it to the common Module sidebar footer.
- `src/components/sidebars/module-sidebar/module-sidebar-footer.js`
  - Renders the same Zerp8 AI action in Module sidebar footers across modules.
- Module content shells mount `BranchAssistantOverlay` so a Module sidebar click displays the overlay over the active module content while preserving its header and sidebar:
  - `src/app/users/[u]/company/[companyId]/branches/[branchId]/modules/inventory/inventoryLayoutClient.jsx`
  - `src/app/users/[u]/company/[companyId]/branches/[branchId]/modules/invoices/invoicesLayoutClient.jsx`
  - `src/app/users/[u]/company/[companyId]/branches/[branchId]/modules/products/productsLayoutClient.jsx`
  - `src/app/users/[u]/company/[companyId]/branches/[branchId]/modules/purchases/purchasesLayoutClient.jsx`
  - `src/app/users/[u]/company/[companyId]/branches/[branchId]/modules/sales/salesLayoutClient.jsx`

## Intentionally Not Implemented

- No AI provider, model request, API endpoint, server action, or streaming response.
- No conversation persistence, history, or multi-turn message list.
- No database/context retrieval; the displayed branch coverage is descriptive UI only.
- No authorization design for AI tools or individual record access.
- No AI-generated tables/artifacts or execution of purchase, inventory, sales, or other operations.
- No Company AI entry point or company-wide assistant scope.

## Validation Performed

- Focused diagnostics reported no errors in the touched components.
- `npm run build` completed successfully after the shared Branch/Module integration, button styling, and animation changes. The composer repositioning also passed focused component diagnostics.
- A separate `npm run dev` attempt could not start because a Next.js development server was already running on port 3000; the existing process was left untouched.

## Suggested Review Questions

1. Should the panel be a content-area modal/overlay, or should it use a shared drawer/dialog primitive for focus trapping and inert background behavior?
2. Should opening Branch AI from a Module sidebar close/collapse the Module sidebar on mobile, or should both remain visible?
3. Should the visible `Zerp8 AI`, tooltip `Zerp-8 AI`, and panel title `Branch AI` use one consistent brand label?
4. Is the branch-wide coverage statement accurate for every listed module and branch route?
5. Should composer state persist if the panel is closed and reopened, or reset on close?
6. What responsive behavior is preferred for the context rail and composer on narrow screens?
7. What backend contract, authorization checks, audit trail, and confirmation flow are required before enabling prompts or actions?





















-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.users (
  id uuid NOT NULL,
  email text UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone,
  username text UNIQUE CHECK (length(username) >= 3),
  handle text UNIQUE,
  first_name text,
  avatar text,
  website text,
  last_name text,
  email_confirmed_at timestamp with time zone,
  invited_by uuid,
  company_invite boolean DEFAULT false,
  company uuid,
  invite_id uuid,
  profile_completed boolean NOT NULL DEFAULT false,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT admins_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.access_level (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  key text UNIQUE,
  level_number smallint NOT NULL,
  description text,
  name text,
  access USER-DEFINED NOT NULL DEFAULT 'branch'::access_type,
  CONSTRAINT access_level_pkey PRIMARY KEY (id)
);
CREATE TABLE public.modules (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  key text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  description text,
  premium boolean NOT NULL,
  companylevel boolean NOT NULL DEFAULT false,
  branchlevel boolean DEFAULT true,
  free_trial boolean NOT NULL DEFAULT true,
  CONSTRAINT modules_pkey PRIMARY KEY (id)
);
CREATE TABLE public.companies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  type text,
  logo text,
  currencies jsonb,
  created_at timestamp with time zone DEFAULT now(),
  default_currency text NOT NULL,
  CONSTRAINT companies_pkey PRIMARY KEY (id),
  CONSTRAINT companies_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id)
);
CREATE TABLE public.company_info (
  company_id uuid NOT NULL,
  owner uuid NOT NULL,
  email text NOT NULL UNIQUE,
  phone text NOT NULL UNIQUE,
  country text,
  industry text,
  fiscalstartmonth integer,
  fiscalstartday integer,
  taxId text UNIQUE,
  status text DEFAULT 'active'::text,
  address text,
  city text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT company_info_pkey PRIMARY KEY (company_id),
  CONSTRAINT company_info_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT company_info_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id)
);
CREATE TABLE public.branches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company uuid NOT NULL,
  name text NOT NULL,
  isheadoffice boolean DEFAULT false,
  base_currency text,
  currencies jsonb,
  slug text CHECK (length(slug) >= 3),
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT branches_pkey PRIMARY KEY (id),
  CONSTRAINT branches_company_fkey FOREIGN KEY (company) REFERENCES public.companies(id)
);
CREATE TABLE public.branch_info (
  branch_id uuid NOT NULL,
  company uuid NOT NULL,
  address text,
  city text,
  country text,
  phone text,
  email text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT branch_info_pkey PRIMARY KEY (branch_id),
  CONSTRAINT branch_info_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT branch_info_company_fkey FOREIGN KEY (company) REFERENCES public.companies(id)
);
CREATE TABLE public.staff (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email character varying NOT NULL,
  role text,
  access_level text DEFAULT 'basic'::text,
  first_name text,
  last_name text,
  photo text,
  company uuid NOT NULL,
  branch uuid,
  status USER-DEFINED DEFAULT 'pending'::staff_status,
  user uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT staff_pkey PRIMARY KEY (id),
  CONSTRAINT staff_access_level_fkey FOREIGN KEY (access_level) REFERENCES public.access_level(key),
  CONSTRAINT staff_user_fkey FOREIGN KEY (user) REFERENCES public.users(id),
  CONSTRAINT staff_email_fkey FOREIGN KEY (email) REFERENCES public.users(email),
  CONSTRAINT staff_company_fkey FOREIGN KEY (company) REFERENCES public.companies(id),
  CONSTRAINT staff_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id)
);
CREATE TABLE public.staff_info (
  staff_id uuid NOT NULL,
  company uuid NOT NULL,
  phone text,
  gender text,
  identity_number text,
  identity_type text,
  address text,
  date_hired timestamp with time zone DEFAULT now(),
  bank_name text,
  bank_account text,
  bank_account_name text,
  date_of_birth text,
  signature text,
  invited_by uuid,
  invite_id uuid DEFAULT gen_random_uuid(),
  last_sign timestamp with time zone,
  updated_at timestamp with time zone,
  CONSTRAINT staff_info_pkey PRIMARY KEY (staff_id),
  CONSTRAINT staff_info_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id),
  CONSTRAINT staff_info_company_fkey FOREIGN KEY (company) REFERENCES public.companies(id)
);
CREATE TABLE public.access_level_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  access_level_key text NOT NULL,
  category text NOT NULL DEFAULT 'core'::text CHECK (category = ANY (ARRAY['core'::text, 'module'::text])),
  scope_key text NOT NULL,
  permission_key text NOT NULL CHECK (permission_key = ANY (ARRAY['view'::text, 'create'::text, 'edit'::text, 'delete'::text, 'manage'::text, 'approve'::text])),
  allowed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT access_level_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT access_level_permissions_access_level_key_fkey FOREIGN KEY (access_level_key) REFERENCES public.access_level(key),
  CONSTRAINT access_level_permissions_scope_permission_fkey FOREIGN KEY (scope_key) REFERENCES public.permission_keys(resource_key),
  CONSTRAINT access_level_permissions_scope_permission_fkey FOREIGN KEY (permission_key) REFERENCES public.permission_keys(permission_key)
);
CREATE TABLE public.staff_permission_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  company_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'core'::text CHECK (category = ANY (ARRAY['core'::text, 'module'::text])),
  scope_key text NOT NULL,
  permission_key text NOT NULL CHECK (permission_key = ANY (ARRAY['view'::text, 'create'::text, 'edit'::text, 'delete'::text, 'manage'::text, 'approve'::text])),
  allowed boolean NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT staff_permission_overrides_pkey PRIMARY KEY (id),
  CONSTRAINT staff_permission_overrides_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id),
  CONSTRAINT staff_permission_overrides_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);
CREATE TABLE public.company_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text,
  company_id uuid,
  company_name text,
  expiry double precision,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone,
  accepted_at timestamp with time zone,
  last_sent timestamp with time zone,
  status USER-DEFINED DEFAULT 'pending'::invite_status,
  invited_by uuid,
  invited_user_id uuid,
  CONSTRAINT company_invites_pkey PRIMARY KEY (id),
  CONSTRAINT company_invites_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);
CREATE TABLE public.staff_pending_acceptance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_invite uuid NOT NULL,
  company uuid NOT NULL,
  first_name text,
  last_name text,
  gender text,
  date_of_birth date,
  phone text,
  address text,
  identity_number text,
  identity_type text,
  bank_name text,
  bank_account text,
  signature_file text,
  additional_documents jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  photo text,
  review_notes text,
  info_request_details text,
  rejected_reason text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::onboard_staff,
  bank_account_name text,
  CONSTRAINT staff_pending_acceptance_pkey PRIMARY KEY (id),
  CONSTRAINT staff_pending_acceptance_company_fkey FOREIGN KEY (company) REFERENCES public.companies(id),
  CONSTRAINT staff_pending_acceptance_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id),
  CONSTRAINT staff_pending_acceptance_company_invite_fkey FOREIGN KEY (company_invite) REFERENCES public.company_invites(id)
);
CREATE TABLE public.permission_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  resource_key text NOT NULL,
  permission_key text NOT NULL CHECK (permission_key = ANY (ARRAY['view'::text, 'create'::text, 'edit'::text, 'delete'::text, 'manage'::text, 'approve'::text])),
  name text NOT NULL,
  description text,
  permission_group text NOT NULL,
  includes_branch boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  category USER-DEFINED NOT NULL DEFAULT 'core'::resource_category,
  CONSTRAINT permission_keys_pkey PRIMARY KEY (id)
);
CREATE TABLE public.company_approval_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  category text NOT NULL CHECK (category = ANY (ARRAY['core'::text, 'module'::text])),
  scope_key text NOT NULL,
  permission_key text NOT NULL CHECK (permission_key = ANY (ARRAY['view'::text, 'create'::text, 'edit'::text, 'delete'::text, 'manage'::text])),
  min_access_level_number smallint NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT company_approval_settings_pkey PRIMARY KEY (id),
  CONSTRAINT company_approval_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);
CREATE TABLE public.company_approval_delegates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  category text NOT NULL,
  scope_key text NOT NULL,
  permission_key text NOT NULL,
  access_level_key text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT company_approval_delegates_pkey PRIMARY KEY (id),
  CONSTRAINT company_approval_delegates_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT company_approval_delegates_access_level_key_fkey FOREIGN KEY (access_level_key) REFERENCES public.access_level(key)
);
CREATE TABLE public.permission_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  branch_id uuid,
  requested_by uuid NOT NULL,
  category text NOT NULL,
  scope_key text NOT NULL,
  permission_key text NOT NULL,
  action_payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])),
  reviewed_by uuid,
  review_note text,
  created_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone,
  CONSTRAINT permission_requests_pkey PRIMARY KEY (id),
  CONSTRAINT permission_requests_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT permission_requests_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT permission_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.staff(id),
  CONSTRAINT permission_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.staff(id)
);
CREATE TABLE public.profile (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  username text,
  handle text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profile_pkey PRIMARY KEY (id),
  CONSTRAINT profile_id_fkey FOREIGN KEY (id) REFERENCES public.users(id)
);
CREATE TABLE public.currencies (
  id smallint GENERATED ALWAYS AS IDENTITY NOT NULL,
  code text,
  name text,
  flag text,
  symbol text,
  CONSTRAINT currencies_pkey PRIMARY KEY (id)
);
CREATE TABLE public.company_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  company_id uuid NOT NULL,
  role text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT company_roles_pkey PRIMARY KEY (id),
  CONSTRAINT company_roles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT company_roles_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company uuid NOT NULL,
  branch uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  parent uuid,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id),
  CONSTRAINT categories_company_fkey FOREIGN KEY (company) REFERENCES public.companies(id),
  CONSTRAINT categories_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id),
  CONSTRAINT categories_parent_fkey FOREIGN KEY (parent) REFERENCES public.categories(id)
);
CREATE TABLE public.brands (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  logo_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT brands_pkey PRIMARY KEY (id),
  CONSTRAINT brands_company_fkey FOREIGN KEY (company) REFERENCES public.companies(id)
);
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company uuid NOT NULL,
  created_by_branch uuid NOT NULL,
  title text NOT NULL,
  sub_title text,
  handle text NOT NULL,
  description text,
  brand text,
  category uuid,
  collection uuid,
  tags ARRAY,
  thumbnail text,
  images jsonb DEFAULT '[]'::jsonb,
  type USER-DEFINED NOT NULL DEFAULT 'physical'::product_type,
  requires_shipping boolean NOT NULL DEFAULT true,
  weight double precision,
  weight_unit text DEFAULT 'kg'::text,
  length double precision,
  width double precision,
  height double precision,
  dimension_unit text DEFAULT 'cm'::text,
  warranty_information text,
  status text NOT NULL DEFAULT 'active'::text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deactivation_reason USER-DEFINED,
  access_scope text NOT NULL DEFAULT 'selected'::text CHECK (access_scope = ANY (ARRAY['selected'::text, 'all'::text])),
  last_updated_by_branch uuid,
  last_updated_by uuid,
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_company_fkey FOREIGN KEY (company) REFERENCES public.companies(id),
  CONSTRAINT products_category_fkey FOREIGN KEY (category) REFERENCES public.categories(id),
  CONSTRAINT products_created_by_branch_fkey FOREIGN KEY (created_by_branch) REFERENCES public.branches(id),
  CONSTRAINT products_last_updated_by_branch_fkey FOREIGN KEY (last_updated_by_branch) REFERENCES public.branches(id),
  CONSTRAINT products_last_updated_by_fkey FOREIGN KEY (last_updated_by) REFERENCES auth.users(id)
);
CREATE TABLE public.product_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product uuid NOT NULL,
  sku text NOT NULL UNIQUE,
  variant_label text,
  options jsonb,
  mpn text UNIQUE,
  isbn text UNIQUE,
  upc text UNIQUE,
  ean text UNIQUE,
  min_sale_quantity integer NOT NULL DEFAULT 1,
  quantity_increment integer NOT NULL DEFAULT 1,
  bulk_threshold integer,
  reorder_level double precision DEFAULT 0,
  reserve double precision DEFAULT 0,
  images jsonb DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  is_variant boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_tracked_inventory boolean NOT NULL DEFAULT true,
  is_tracked_shop boolean NOT NULL DEFAULT true,
  CONSTRAINT product_variants_pkey PRIMARY KEY (id),
  CONSTRAINT product_variants_product_fkey FOREIGN KEY (product) REFERENCES public.products(id)
);
CREATE TABLE public.pricing_contexts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company uuid NOT NULL,
  branch uuid NOT NULL,
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pricing_contexts_pkey PRIMARY KEY (id),
  CONSTRAINT pricing_contexts_company_fkey FOREIGN KEY (company) REFERENCES public.companies(id),
  CONSTRAINT pricing_contexts_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id)
);
CREATE TABLE public.pricing_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pricing_context uuid NOT NULL,
  scope_type text NOT NULL,
  scope_id uuid,
  condition_type text NOT NULL DEFAULT 'always'::text,
  condition_value integer,
  action_type text NOT NULL,
  action_value numeric NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pricing_rules_pkey PRIMARY KEY (id),
  CONSTRAINT pricing_rules_context_fkey FOREIGN KEY (pricing_context) REFERENCES public.pricing_contexts(id)
);
CREATE TABLE public.pricing_context_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pricing_context uuid NOT NULL,
  assignment_type text NOT NULL,
  assignment_target_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pricing_context_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT pricing_context_assignments_context_fkey FOREIGN KEY (pricing_context) REFERENCES public.pricing_contexts(id)
);
CREATE TABLE public.standard_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  variant uuid NOT NULL,
  branch uuid NOT NULL,
  selling_price numeric NOT NULL,
  margin_percentage numeric,
  currency text NOT NULL DEFAULT 'NGN'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  margin_type text CHECK (margin_type = ANY (ARRAY['percentage'::text, 'fixed'::text])),
  margin_value double precision,
  CONSTRAINT standard_prices_pkey PRIMARY KEY (id),
  CONSTRAINT standard_prices_variant_fkey FOREIGN KEY (variant) REFERENCES public.product_variants(id),
  CONSTRAINT standard_prices_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id)
);
CREATE TABLE public.folders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company uuid NOT NULL,
  name text NOT NULL,
  folderId uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT folders_pkey PRIMARY KEY (id),
  CONSTRAINT folders_company_fkey FOREIGN KEY (company) REFERENCES public.companies(id),
  CONSTRAINT folders_parent_fkey FOREIGN KEY (folderId) REFERENCES public.folders(id)
);
CREATE TABLE public.images (
  id uuid NOT NULL,
  company uuid NOT NULL,
  name text NOT NULL,
  folder uuid,
  storage text NOT NULL,
  url text NOT NULL,
  path text NOT NULL,
  size text,
  mime_type text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT images_pkey PRIMARY KEY (id),
  CONSTRAINT images_company_fkey FOREIGN KEY (company) REFERENCES public.companies(id),
  CONSTRAINT images_folder_fkey FOREIGN KEY (folder) REFERENCES public.folders(id),
  CONSTRAINT images_id_fkey FOREIGN KEY (id) REFERENCES storage.objects(id)
);
CREATE TABLE public.trash (
  id uuid NOT NULL,
  company uuid NOT NULL,
  name text NOT NULL,
  folder uuid,
  storage text NOT NULL,
  url text NOT NULL,
  path text NOT NULL,
  size text,
  mime_type text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trash_pkey PRIMARY KEY (id),
  CONSTRAINT trash_company_fkey FOREIGN KEY (company) REFERENCES public.companies(id),
  CONSTRAINT trash_id_fkey FOREIGN KEY (id) REFERENCES storage.objects(id)
);
CREATE TABLE public.staff_branch_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  company_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  allowed boolean NOT NULL DEFAULT true,
  CONSTRAINT staff_branch_overrides_pkey PRIMARY KEY (id),
  CONSTRAINT staff_branch_overrides_staff_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id),
  CONSTRAINT staff_branch_overrides_company_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT staff_branch_overrides_branch_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id)
);
CREATE TABLE public.measurement_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text UNIQUE,
  name text,
  CONSTRAINT measurement_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.measurement_units (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text,
  type text,
  symbol text,
  multiplier double precision,
  is_base boolean DEFAULT true,
  CONSTRAINT measurement_units_pkey PRIMARY KEY (id),
  CONSTRAINT measurement_units_type_fkey FOREIGN KEY (type) REFERENCES public.measurement_types(code)
);
CREATE TABLE public.countries (
  id integer NOT NULL DEFAULT nextval('countries_id_seq'::regclass),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  flag text NOT NULL,
  CONSTRAINT countries_pkey PRIMARY KEY (id)
);
CREATE TABLE public.limit_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  value_type USER-DEFINED NOT NULL,
  scope USER-DEFINED NOT NULL DEFAULT 'company'::limit_scope,
  measurement USER-DEFINED NOT NULL DEFAULT 'persistent'::limit_measurement,
  resource_group text NOT NULL,
  unit text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT limit_keys_pkey PRIMARY KEY (id)
);
CREATE TABLE public.subscription_bundles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  base_price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN'::text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  sort_order integer NOT NULL DEFAULT 100,
  status USER-DEFINED NOT NULL DEFAULT 'coming_soon'::module_status,
  CONSTRAINT subscription_bundles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.bundle_modules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL,
  module_key text NOT NULL,
  CONSTRAINT bundle_modules_pkey PRIMARY KEY (id),
  CONSTRAINT bundle_modules_bundle_fkey FOREIGN KEY (bundle_id) REFERENCES public.subscription_bundles(id),
  CONSTRAINT bundle_modules_module_fkey FOREIGN KEY (module_key) REFERENCES public.modules(key)
);
CREATE TABLE public.bundle_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL,
  limit_key_id uuid NOT NULL,
  default_value_numeric numeric,
  default_value_boolean boolean,
  CONSTRAINT bundle_limits_pkey PRIMARY KEY (id),
  CONSTRAINT bundle_limits_bundle_fkey FOREIGN KEY (bundle_id) REFERENCES public.subscription_bundles(id),
  CONSTRAINT bundle_limits_limit_key_fkey FOREIGN KEY (limit_key_id) REFERENCES public.limit_keys(id)
);
CREATE TABLE public.limit_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  limit_key_id uuid NOT NULL,
  tier_index integer NOT NULL CHECK (tier_index >= 0),
  step_value numeric NOT NULL CHECK (step_value >= 0::numeric),
  price_delta numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT limit_tiers_pkey PRIMARY KEY (id),
  CONSTRAINT limit_tiers_limit_key_fkey FOREIGN KEY (limit_key_id) REFERENCES public.limit_keys(id)
);
CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'trialing'::subscription_status,
  start_date timestamp with time zone NOT NULL DEFAULT now(),
  end_date timestamp with time zone,
  auto_renew boolean DEFAULT true,
  canceled_at timestamp with time zone,
  last_billed_at timestamp with time zone,
  next_billing_date timestamp with time zone,
  amount numeric DEFAULT 0,
  currency text DEFAULT 'NGN'::text,
  billing_interval text,
  grace_period_end timestamp with time zone,
  trial_start timestamp with time zone,
  trial_end timestamp with time zone,
  bachs_subscription_id text UNIQUE,
  bachs_customer_id text,
  cancel_at_period_end boolean DEFAULT false,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT subscriptions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id)
);
CREATE TABLE public.subscription_modules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL,
  company_id uuid NOT NULL,
  module_key text NOT NULL,
  bundle_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subscription_modules_pkey PRIMARY KEY (id),
  CONSTRAINT subscription_modules_subscription_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id),
  CONSTRAINT subscription_modules_company_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT subscription_modules_module_fkey FOREIGN KEY (module_key) REFERENCES public.modules(key),
  CONSTRAINT subscription_modules_bundle_fkey FOREIGN KEY (bundle_id) REFERENCES public.subscription_bundles(id)
);
CREATE TABLE public.subscription_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL,
  company_id uuid NOT NULL,
  limit_key_id uuid NOT NULL,
  value_numeric numeric,
  value_boolean boolean,
  tier_index integer,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subscription_limits_pkey PRIMARY KEY (id),
  CONSTRAINT subscription_limits_subscription_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id),
  CONSTRAINT subscription_limits_company_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT subscription_limits_limit_key_fkey FOREIGN KEY (limit_key_id) REFERENCES public.limit_keys(id)
);
CREATE TABLE public.usage_counters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  limit_key_id uuid NOT NULL,
  period text,
  current_usage_numeric numeric NOT NULL DEFAULT 0 CHECK (current_usage_numeric >= 0::numeric),
  current_usage_boolean boolean,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT usage_counters_pkey PRIMARY KEY (id),
  CONSTRAINT usage_counters_company_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT usage_counters_limit_key_fkey FOREIGN KEY (limit_key_id) REFERENCES public.limit_keys(id)
);
CREATE TABLE public.user_entitlements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entitlement_key text NOT NULL,
  value_numeric numeric,
  value_boolean boolean,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_entitlements_pkey PRIMARY KEY (id),
  CONSTRAINT user_entitlements_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.trial_template_modules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  module_key text NOT NULL UNIQUE,
  CONSTRAINT trial_template_modules_pkey PRIMARY KEY (id),
  CONSTRAINT trial_template_modules_module_fkey FOREIGN KEY (module_key) REFERENCES public.modules(key)
);
CREATE TABLE public.trial_template_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  limit_key_id uuid NOT NULL UNIQUE,
  value_numeric numeric,
  value_boolean boolean,
  CONSTRAINT trial_template_limits_pkey PRIMARY KEY (id),
  CONSTRAINT trial_template_limits_limit_key_fkey FOREIGN KEY (limit_key_id) REFERENCES public.limit_keys(id)
);
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company uuid NOT NULL,
  branch uuid NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  address text,
  payment_terms text NOT NULL DEFAULT 'Due on receipt'::text,
  credit_limit numeric,
  status text NOT NULL DEFAULT 'active'::text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT customers_pkey PRIMARY KEY (id),
  CONSTRAINT customers_company_fkey FOREIGN KEY (company) REFERENCES public.companies(id),
  CONSTRAINT customers_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id)
);
CREATE TABLE public.quotations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch uuid NOT NULL,
  customer uuid NOT NULL,
  quote_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft'::text,
  status_source text,
  status_note text,
  valid_until timestamp with time zone,
  sent_at timestamp with time zone,
  pdf_url text,
  discount_type text DEFAULT 'amount'::text,
  discount_value numeric NOT NULL DEFAULT 0,
  apply_vat boolean NOT NULL DEFAULT true,
  vat_rate numeric NOT NULL DEFAULT 7.5,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT quotations_pkey PRIMARY KEY (id),
  CONSTRAINT quotations_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id)
);
CREATE TABLE public.quotation_line_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quotation uuid NOT NULL,
  variant uuid NOT NULL,
  pricing_context uuid,
  description_snapshot text NOT NULL,
  variant_label_snapshot text,
  sku_snapshot text,
  quantity numeric NOT NULL,
  unit_price_snapshot numeric NOT NULL,
  discount_type text,
  discount_value numeric DEFAULT 0,
  pricing_context_used uuid,
  line_total numeric NOT NULL,
  CONSTRAINT quotation_line_items_pkey PRIMARY KEY (id),
  CONSTRAINT quotation_line_items_quotation_fkey FOREIGN KEY (quotation) REFERENCES public.quotations(id),
  CONSTRAINT quotation_line_items_pricing_context_fkey FOREIGN KEY (pricing_context) REFERENCES public.pricing_contexts(id)
);
CREATE TABLE public.sales_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch uuid NOT NULL,
  customer uuid NOT NULL,
  quotation uuid,
  order_number text NOT NULL,
  status text NOT NULL DEFAULT 'confirmed'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sales_orders_pkey PRIMARY KEY (id),
  CONSTRAINT sales_orders_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id),
  CONSTRAINT sales_orders_quotation_fkey FOREIGN KEY (quotation) REFERENCES public.quotations(id)
);
CREATE TABLE public.sales_order_line_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sales_order uuid NOT NULL,
  variant uuid NOT NULL,
  quantity_ordered numeric NOT NULL,
  quantity_delivered numeric NOT NULL DEFAULT 0,
  quantity_invoiced numeric NOT NULL DEFAULT 0,
  quantity_returned numeric NOT NULL DEFAULT 0,
  unit_price_snapshot numeric,
  line_total numeric,
  CONSTRAINT sales_order_line_items_pkey PRIMARY KEY (id),
  CONSTRAINT sales_order_line_items_sales_order_fkey FOREIGN KEY (sales_order) REFERENCES public.sales_orders(id)
);
CREATE TABLE public.proforma_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch uuid NOT NULL,
  sales_order uuid NOT NULL,
  proforma_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT proforma_invoices_pkey PRIMARY KEY (id),
  CONSTRAINT proforma_invoices_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id),
  CONSTRAINT proforma_invoices_sales_order_fkey FOREIGN KEY (sales_order) REFERENCES public.sales_orders(id)
);
CREATE TABLE public.proforma_invoice_line_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  proforma_invoice uuid NOT NULL,
  sales_order_line_item uuid NOT NULL,
  quantity numeric NOT NULL,
  unit_price_snapshot numeric NOT NULL,
  line_total numeric NOT NULL,
  CONSTRAINT proforma_invoice_line_items_pkey PRIMARY KEY (id),
  CONSTRAINT proforma_invoice_line_items_proforma_invoice_fkey FOREIGN KEY (proforma_invoice) REFERENCES public.proforma_invoices(id),
  CONSTRAINT proforma_invoice_line_items_sales_order_line_item_fkey FOREIGN KEY (sales_order_line_item) REFERENCES public.sales_order_line_items(id)
);
CREATE TABLE public.deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch uuid NOT NULL,
  sales_order uuid NOT NULL,
  proforma_invoice uuid,
  delivery_number text NOT NULL,
  method text NOT NULL DEFAULT 'delivery'::text,
  status text NOT NULL DEFAULT 'pending'::text,
  delivered_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT deliveries_pkey PRIMARY KEY (id),
  CONSTRAINT deliveries_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id),
  CONSTRAINT deliveries_sales_order_fkey FOREIGN KEY (sales_order) REFERENCES public.sales_orders(id),
  CONSTRAINT deliveries_proforma_invoice_fkey FOREIGN KEY (proforma_invoice) REFERENCES public.proforma_invoices(id)
);
CREATE TABLE public.delivery_line_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  delivery uuid NOT NULL,
  sales_order_line_item uuid NOT NULL,
  quantity numeric NOT NULL,
  CONSTRAINT delivery_line_items_pkey PRIMARY KEY (id),
  CONSTRAINT delivery_line_items_delivery_fkey FOREIGN KEY (delivery) REFERENCES public.deliveries(id),
  CONSTRAINT delivery_line_items_sales_order_line_item_fkey FOREIGN KEY (sales_order_line_item) REFERENCES public.sales_order_line_items(id)
);
CREATE TABLE public.sales_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch uuid NOT NULL,
  customer uuid NOT NULL,
  sales_order uuid,
  delivery uuid,
  proforma_invoice uuid,
  invoice_number text NOT NULL,
  status text NOT NULL DEFAULT 'unpaid'::text,
  issued_at timestamp with time zone NOT NULL DEFAULT now(),
  due_date timestamp with time zone,
  total numeric NOT NULL DEFAULT 0,
  paid numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'sales'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sales_invoices_pkey PRIMARY KEY (id),
  CONSTRAINT sales_invoices_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id),
  CONSTRAINT sales_invoices_sales_order_fkey FOREIGN KEY (sales_order) REFERENCES public.sales_orders(id),
  CONSTRAINT sales_invoices_delivery_fkey FOREIGN KEY (delivery) REFERENCES public.deliveries(id),
  CONSTRAINT sales_invoices_proforma_invoice_fkey FOREIGN KEY (proforma_invoice) REFERENCES public.proforma_invoices(id)
);
CREATE TABLE public.sales_invoice_line_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sales_invoice uuid NOT NULL,
  sales_order_line_item uuid,
  variant uuid NOT NULL,
  description_snapshot text NOT NULL,
  quantity numeric NOT NULL,
  unit_price_snapshot numeric NOT NULL,
  line_total numeric NOT NULL,
  CONSTRAINT sales_invoice_line_items_pkey PRIMARY KEY (id),
  CONSTRAINT sales_invoice_line_items_sales_invoice_fkey FOREIGN KEY (sales_invoice) REFERENCES public.sales_invoices(id),
  CONSTRAINT sales_invoice_line_items_sales_order_line_item_fkey FOREIGN KEY (sales_order_line_item) REFERENCES public.sales_order_line_items(id)
);
CREATE TABLE public.sales_returns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch uuid NOT NULL,
  delivery uuid NOT NULL,
  sales_invoice uuid,
  return_number text NOT NULL,
  status text NOT NULL DEFAULT 'requested'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sales_returns_pkey PRIMARY KEY (id),
  CONSTRAINT returns_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id),
  CONSTRAINT returns_delivery_fkey FOREIGN KEY (delivery) REFERENCES public.deliveries(id),
  CONSTRAINT returns_sales_invoice_fkey FOREIGN KEY (sales_invoice) REFERENCES public.sales_invoices(id)
);
CREATE TABLE public.sales_return_line_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sales_return uuid NOT NULL,
  delivery_line_item uuid NOT NULL,
  quantity numeric NOT NULL,
  restockable boolean NOT NULL DEFAULT true,
  CONSTRAINT sales_return_line_items_pkey PRIMARY KEY (id),
  CONSTRAINT return_line_items_return_record_fkey FOREIGN KEY (sales_return) REFERENCES public.sales_returns(id),
  CONSTRAINT return_line_items_delivery_line_item_fkey FOREIGN KEY (delivery_line_item) REFERENCES public.delivery_line_items(id)
);
CREATE TABLE public.credit_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch uuid NOT NULL,
  customer uuid NOT NULL,
  sales_invoice uuid NOT NULL,
  sales_return uuid,
  credit_note_number text NOT NULL,
  status text NOT NULL DEFAULT 'issued'::text,
  total numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT credit_notes_pkey PRIMARY KEY (id),
  CONSTRAINT credit_notes_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id),
  CONSTRAINT credit_notes_sales_invoice_fkey FOREIGN KEY (sales_invoice) REFERENCES public.sales_invoices(id),
  CONSTRAINT credit_notes_return_record_fkey FOREIGN KEY (sales_return) REFERENCES public.sales_returns(id)
);
CREATE TABLE public.credit_note_line_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  credit_note uuid NOT NULL,
  sales_invoice_line_item uuid NOT NULL,
  quantity numeric NOT NULL,
  unit_price_snapshot numeric NOT NULL,
  line_total numeric NOT NULL,
  CONSTRAINT credit_note_line_items_pkey PRIMARY KEY (id),
  CONSTRAINT credit_note_line_items_credit_note_fkey FOREIGN KEY (credit_note) REFERENCES public.credit_notes(id),
  CONSTRAINT credit_note_line_items_sales_invoice_line_item_fkey FOREIGN KEY (sales_invoice_line_item) REFERENCES public.sales_invoice_line_items(id)
);
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch uuid NOT NULL,
  sales_invoice uuid NOT NULL,
  amount numeric NOT NULL,
  method text NOT NULL,
  reference text,
  paid_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id),
  CONSTRAINT payments_sales_invoice_fkey FOREIGN KEY (sales_invoice) REFERENCES public.sales_invoices(id)
);
CREATE TABLE public.pos_sales (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch uuid NOT NULL,
  customer uuid,
  sales_invoice uuid NOT NULL,
  delivery uuid NOT NULL,
  payment_method text NOT NULL,
  status text NOT NULL DEFAULT 'completed'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pos_sales_pkey PRIMARY KEY (id),
  CONSTRAINT pos_sales_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id),
  CONSTRAINT pos_sales_sales_invoice_fkey FOREIGN KEY (sales_invoice) REFERENCES public.sales_invoices(id),
  CONSTRAINT pos_sales_delivery_fkey FOREIGN KEY (delivery) REFERENCES public.deliveries(id)
);
CREATE TABLE public.quotation_sends (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quotation uuid NOT NULL,
  recipient_email text NOT NULL,
  message text,
  sent_by uuid,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT quotation_sends_pkey PRIMARY KEY (id),
  CONSTRAINT quotation_sends_quotation_fkey FOREIGN KEY (quotation) REFERENCES public.quotations(id)
);
CREATE TABLE public.warehouses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company uuid NOT NULL,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  home_branch uuid,
  CONSTRAINT warehouses_pkey PRIMARY KEY (id),
  CONSTRAINT warehouses_company_fkey FOREIGN KEY (company) REFERENCES public.companies(id),
  CONSTRAINT warehouses_home_branch_fkey FOREIGN KEY (home_branch) REFERENCES public.branches(id)
);
CREATE TABLE public.warehouse_shelves (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  warehouse uuid NOT NULL,
  code text NOT NULL,
  label text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT warehouse_shelves_pkey PRIMARY KEY (id),
  CONSTRAINT warehouse_shelves_warehouse_fkey FOREIGN KEY (warehouse) REFERENCES public.warehouses(id)
);
CREATE TABLE public.stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  warehouse uuid NOT NULL,
  branch uuid NOT NULL,
  shelf uuid,
  variant uuid NOT NULL,
  quantity integer NOT NULL,
  reference_type text NOT NULL CHECK (reference_type = ANY (ARRAY['delivery'::text, 'purchase_receipt'::text, 'return_restock'::text, 'purchase_return'::text, 'adjustment'::text])),
  reference_id uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stock_movements_pkey PRIMARY KEY (id),
  CONSTRAINT stock_movements_warehouse_fkey FOREIGN KEY (warehouse) REFERENCES public.warehouses(id),
  CONSTRAINT stock_movements_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id),
  CONSTRAINT stock_movements_shelf_fkey FOREIGN KEY (shelf) REFERENCES public.warehouse_shelves(id),
  CONSTRAINT stock_movements_variant_fkey FOREIGN KEY (variant) REFERENCES public.product_variants(id)
);
CREATE TABLE public.product_branch_aliases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product uuid NOT NULL,
  branch uuid NOT NULL,
  alias_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_branch_aliases_pkey PRIMARY KEY (id),
  CONSTRAINT product_branch_aliases_product_fkey FOREIGN KEY (product) REFERENCES public.products(id),
  CONSTRAINT product_branch_aliases_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id)
);
CREATE TABLE public.pricing_settings (
  key text NOT NULL,
  value numeric NOT NULL,
  CONSTRAINT pricing_settings_pkey PRIMARY KEY (key)
);
CREATE TABLE public.product_branch_access (
  product_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  can_edit boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_branch_access_pkey PRIMARY KEY (product_id, branch_id),
  CONSTRAINT product_branch_access_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT product_branch_access_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id)
);
CREATE TABLE public.product_cost_estimates (
  variant_id uuid NOT NULL,
  cost_price double precision NOT NULL,
  cost_currency text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_by_branch uuid,
  CONSTRAINT product_cost_estimates_pkey PRIMARY KEY (variant_id),
  CONSTRAINT product_cost_estimates_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id),
  CONSTRAINT product_cost_estimates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id),
  CONSTRAINT product_cost_estimates_updated_by_branch_fkey FOREIGN KEY (updated_by_branch) REFERENCES public.branches(id)
);
CREATE TABLE public.suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company uuid NOT NULL,
  branch uuid NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  address text,
  payment_terms text NOT NULL DEFAULT 'Due on receipt'::text,
  status text NOT NULL DEFAULT 'active'::text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT suppliers_pkey PRIMARY KEY (id),
  CONSTRAINT suppliers_company_fkey FOREIGN KEY (company) REFERENCES public.companies(id),
  CONSTRAINT suppliers_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id)
);
CREATE TABLE public.purchase_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch uuid NOT NULL,
  request_number text NOT NULL,
  status text NOT NULL DEFAULT 'pending_approval'::text,
  notes text,
  requested_by uuid,
  needed_by timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  approved_by uuid,
  approved_at timestamp with time zone,
  rejected_by uuid,
  rejected_at timestamp with time zone,
  rejection_reason text,
  title text,
  CONSTRAINT purchase_requests_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_requests_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id),
  CONSTRAINT purchase_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id),
  CONSTRAINT purchase_requests_rejected_by_fkey FOREIGN KEY (rejected_by) REFERENCES auth.users(id)
);
CREATE TABLE public.purchase_request_line_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  purchase_request uuid NOT NULL,
  variant uuid NOT NULL,
  quantity_requested numeric NOT NULL,
  estimated_unit_cost numeric,
  notes text,
  CONSTRAINT purchase_request_line_items_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_request_line_items_purchase_request_fkey FOREIGN KEY (purchase_request) REFERENCES public.purchase_requests(id),
  CONSTRAINT purchase_request_line_items_variant_fkey FOREIGN KEY (variant) REFERENCES public.product_variants(id)
);
CREATE TABLE public.purchase_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch uuid NOT NULL,
  supplier uuid NOT NULL,
  purchase_request uuid,
  order_number text NOT NULL,
  status text NOT NULL DEFAULT 'sent'::text,
  expected_delivery_date timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  title text,
  CONSTRAINT purchase_orders_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_orders_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id),
  CONSTRAINT purchase_orders_supplier_fkey FOREIGN KEY (supplier) REFERENCES public.suppliers(id),
  CONSTRAINT purchase_orders_purchase_request_fkey FOREIGN KEY (purchase_request) REFERENCES public.purchase_requests(id)
);
CREATE TABLE public.purchase_order_line_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  purchase_order uuid NOT NULL,
  variant uuid NOT NULL,
  quantity_ordered numeric NOT NULL,
  quantity_received numeric NOT NULL DEFAULT 0,
  quantity_billed numeric NOT NULL DEFAULT 0,
  quantity_returned numeric NOT NULL DEFAULT 0,
  unit_cost_snapshot numeric,
  line_total numeric,
  CONSTRAINT purchase_order_line_items_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_order_line_items_purchase_order_fkey FOREIGN KEY (purchase_order) REFERENCES public.purchase_orders(id),
  CONSTRAINT purchase_order_line_items_variant_fkey FOREIGN KEY (variant) REFERENCES public.product_variants(id)
);
CREATE TABLE public.purchase_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch uuid NOT NULL,
  purchase_order uuid NOT NULL,
  receipt_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft'::text,
  received_at timestamp with time zone,
  received_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  CONSTRAINT purchase_receipts_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_receipts_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id),
  CONSTRAINT purchase_receipts_purchase_order_fkey FOREIGN KEY (purchase_order) REFERENCES public.purchase_orders(id)
);
CREATE TABLE public.purchase_receipt_line_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  purchase_receipt uuid NOT NULL,
  purchase_order_line_item uuid NOT NULL,
  variant uuid NOT NULL,
  quantity numeric NOT NULL,
  unit_cost_snapshot numeric,
  shelf uuid,
  CONSTRAINT purchase_receipt_line_items_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_receipt_line_items_purchase_receipt_fkey FOREIGN KEY (purchase_receipt) REFERENCES public.purchase_receipts(id),
  CONSTRAINT purchase_receipt_line_items_purchase_order_line_item_fkey FOREIGN KEY (purchase_order_line_item) REFERENCES public.purchase_order_line_items(id),
  CONSTRAINT purchase_receipt_line_items_variant_fkey FOREIGN KEY (variant) REFERENCES public.product_variants(id),
  CONSTRAINT purchase_receipt_line_items_shelf_fkey FOREIGN KEY (shelf) REFERENCES public.warehouse_shelves(id)
);
CREATE TABLE public.purchase_bills (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch uuid NOT NULL,
  supplier uuid NOT NULL,
  purchase_order uuid,
  purchase_receipt uuid,
  bill_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft'::text,
  issued_at timestamp with time zone NOT NULL DEFAULT now(),
  due_date timestamp with time zone,
  total numeric NOT NULL DEFAULT 0,
  paid numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT purchase_bills_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_bills_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id),
  CONSTRAINT purchase_bills_supplier_fkey FOREIGN KEY (supplier) REFERENCES public.suppliers(id),
  CONSTRAINT purchase_bills_purchase_order_fkey FOREIGN KEY (purchase_order) REFERENCES public.purchase_orders(id),
  CONSTRAINT purchase_bills_purchase_receipt_fkey FOREIGN KEY (purchase_receipt) REFERENCES public.purchase_receipts(id)
);
CREATE TABLE public.purchase_bill_line_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  purchase_bill uuid NOT NULL,
  purchase_order_line_item uuid,
  variant uuid NOT NULL,
  description_snapshot text NOT NULL,
  quantity numeric NOT NULL,
  unit_price_snapshot numeric NOT NULL,
  line_total numeric NOT NULL,
  CONSTRAINT purchase_bill_line_items_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_bill_line_items_purchase_bill_fkey FOREIGN KEY (purchase_bill) REFERENCES public.purchase_bills(id),
  CONSTRAINT purchase_bill_line_items_purchase_order_line_item_fkey FOREIGN KEY (purchase_order_line_item) REFERENCES public.purchase_order_line_items(id),
  CONSTRAINT purchase_bill_line_items_variant_fkey FOREIGN KEY (variant) REFERENCES public.product_variants(id)
);
CREATE TABLE public.purchase_returns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch uuid NOT NULL,
  purchase_receipt uuid NOT NULL,
  return_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft'::text,
  reason text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT purchase_returns_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_returns_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id),
  CONSTRAINT purchase_returns_purchase_receipt_fkey FOREIGN KEY (purchase_receipt) REFERENCES public.purchase_receipts(id)
);
CREATE TABLE public.purchase_return_line_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  purchase_return uuid NOT NULL,
  purchase_receipt_line_item uuid NOT NULL,
  quantity numeric NOT NULL,
  unit_cost_snapshot numeric,
  line_total numeric,
  CONSTRAINT purchase_return_line_items_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_return_line_items_purchase_return_fkey FOREIGN KEY (purchase_return) REFERENCES public.purchase_returns(id),
  CONSTRAINT purchase_return_line_items_purchase_receipt_line_item_fkey FOREIGN KEY (purchase_receipt_line_item) REFERENCES public.purchase_receipt_line_items(id)
);
CREATE TABLE public.supplier_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch uuid NOT NULL,
  purchase_bill uuid NOT NULL,
  amount numeric NOT NULL,
  method text NOT NULL,
  reference text,
  paid_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT supplier_payments_pkey PRIMARY KEY (id),
  CONSTRAINT supplier_payments_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id),
  CONSTRAINT supplier_payments_purchase_bill_fkey FOREIGN KEY (purchase_bill) REFERENCES public.purchase_bills(id)
);
CREATE TABLE public.purchase_request_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company uuid NOT NULL,
  branch uuid NOT NULL,
  title text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT purchase_request_drafts_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_request_drafts_company_fkey FOREIGN KEY (company) REFERENCES public.companies(id),
  CONSTRAINT purchase_request_drafts_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id),
  CONSTRAINT purchase_request_drafts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT purchase_request_drafts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);
CREATE TABLE public.purchase_order_drafts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company uuid NOT NULL,
  branch uuid NOT NULL,
  title text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT purchase_order_drafts_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_order_drafts_company_fkey FOREIGN KEY (company) REFERENCES public.companies(id),
  CONSTRAINT purchase_order_drafts_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id),
  CONSTRAINT purchase_order_drafts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT purchase_order_drafts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);
CREATE TABLE public.cancelled_purchase_requests (
  id uuid NOT NULL,
  company uuid NOT NULL,
  branch uuid NOT NULL,
  title text,
  request_number text,
  original_status text NOT NULL,
  payload jsonb NOT NULL,
  cancelled_by uuid,
  cancelled_at timestamp with time zone NOT NULL DEFAULT now(),
  cancellation_reason text,
  created_at timestamp with time zone,
  CONSTRAINT cancelled_purchase_requests_pkey PRIMARY KEY (id),
  CONSTRAINT cancelled_purchase_requests_company_fkey FOREIGN KEY (company) REFERENCES public.companies(id),
  CONSTRAINT cancelled_purchase_requests_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id)
);
CREATE TABLE public.cancelled_purchase_orders (
  id uuid NOT NULL,
  company uuid NOT NULL,
  branch uuid NOT NULL,
  title text,
  order_number text,
  original_status text NOT NULL,
  payload jsonb NOT NULL,
  cancelled_by uuid,
  cancelled_at timestamp with time zone NOT NULL DEFAULT now(),
  cancellation_reason text,
  created_at timestamp with time zone,
  CONSTRAINT cancelled_purchase_orders_pkey PRIMARY KEY (id),
  CONSTRAINT cancelled_purchase_orders_company_fkey FOREIGN KEY (company) REFERENCES public.companies(id),
  CONSTRAINT cancelled_purchase_orders_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id)
);
CREATE TABLE public.purchase_order_source_requests (
  purchase_order uuid NOT NULL,
  purchase_request uuid NOT NULL,
  branch uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT purchase_order_source_requests_pkey PRIMARY KEY (purchase_order, purchase_request),
  CONSTRAINT purchase_order_source_requests_purchase_order_fkey FOREIGN KEY (purchase_order) REFERENCES public.purchase_orders(id),
  CONSTRAINT purchase_order_source_requests_purchase_request_fkey FOREIGN KEY (purchase_request) REFERENCES public.purchase_requests(id),
  CONSTRAINT purchase_order_source_requests_branch_fkey FOREIGN KEY (branch) REFERENCES public.branches(id)
);