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
