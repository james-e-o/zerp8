# Existing Feature Restrictions - To Be Updated

## Current Hardcoded Restrictions Found

### 1. `src/hooks/useCompanyAccess.js`
**Status:** Still in use for backward compatibility

Lines with hardcoded feature checks:
```javascript
const canAccessStaff = isOwner || isCompanyLevel;          // Line 26
const canAccessSubscriptions = isOwner;                    // Line 27
const canAccessModules = isOwner || isCompanyLevel;        // Line 28
const canAccessSettings = isOwner || isCompanyLevel;       // Line 29
```

**Action:** Keep as-is for backward compatibility. Don't remove. New code should use `useAccess()` instead.

---

### 2. `src/lib/access-control.js`
**Status:** Updated with new functions; old functions kept for backward compatibility

Old functions still present:
- `requireCompanyAccess()` - Uses hardcoded feature map
- `checkAccessLevel()` - Role-based
- `checkAccessScope()` - Scope-based

New functions added:
- `requirePermission()` - Uses permission object
- `hasPermission()` - Direct permission check
- `hasAnyPermission()` - OR logic
- `hasAllPermissions()` - AND logic

**Action:** Done. Old functions kept for backward compatibility.

---

### 3. `src/components/AccessProtector.js`
**Status:** Updated to support both old and new systems

**Action:** Done. Automatically detects which system to use based on props.

---

## How to Apply to Your Features

### Example 1: Protecting Staff Feature

**Location:** Create or update `src/app/users/[u]/company/[companySlug]/staff/layout.js`

```javascript
'use client';

import { useRouter } from 'next/navigation';
import { useAccess } from '@/hooks/useAccess';
import { requirePermission } from '@/lib/access-control';

export default function StaffLayout({ children }) {
  const router = useRouter();
  const access = useAccess();

  // Protect entire staff section
  // User must have can_view_staff permission
  requirePermission(access, 'can_view_staff', router, {
    redirectUrl: '/users/[u]/company/[companySlug]',
  });

  if (access.isLoading) {
    return <div className="p-8">Loading permissions...</div>;
  }

  return children;
}
```

**What this does:**
- Checks if user has `can_view_staff` permission
- If not, redirects to company dashboard
- If suspended, denies access
- Works with both role defaults AND user overrides

---

### Example 2: Staff Actions (Create, Edit, Delete Buttons)

**Location:** `src/app/users/[u]/company/[companySlug]/staff/page.js` or components

```javascript
'use client';

import { useAccess } from '@/hooks/useAccess';
import { Button } from '@/components/ui/button';

export default function StaffPage() {
  const access = useAccess();

  if (access.isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <h1>Staff Directory</h1>

      {/* View Staff - Everyone with can_view_staff can see table */}
      {access.permissions.can_view_staff && (
        <StaffTable />
      )}

      {/* Create Staff Button - Only if can_create_staff */}
      {access.permissions.can_create_staff && (
        <Button onClick={() => router.push('./new')}>
          Create Staff Member
        </Button>
      )}

      {/* Edit Button - Only if can_edit_staff */}
      {access.permissions.can_edit_staff && (
        <Button variant="outline">Edit Selected</Button>
      )}

      {/* Delete Button - Only if can_delete_staff */}
      {access.permissions.can_delete_staff && (
        <Button variant="destructive">Delete Selected</Button>
      )}
    </div>
  );
}
```

---

### Example 3: Protecting Modules Feature

**Location:** Create or update `src/app/users/[u]/company/[companySlug]/modules/layout.js`

```javascript
'use client';

import { useRouter } from 'next/navigation';
import { useAccess } from '@/hooks/useAccess';
import { requirePermission } from '@/lib/access-control';

export default function ModulesLayout({ children }) {
  const router = useRouter();
  const access = useAccess();

  // Protect: User must have can_view_modules permission
  requirePermission(access, 'can_view_modules', router, {
    redirectUrl: '/users/[u]/company/[companySlug]',
  });

  if (access.isLoading) return <div>Loading...</div>;

  return children;
}
```

**In the modules page/components:**

```javascript
'use client';

import { useAccess } from '@/hooks/useAccess';

export default function ModulesPage() {
  const access = useAccess();

  return (
    <div>
      {/* Show edit controls only if user can edit */}
      {access.permissions.can_edit_modules && (
        <button>Edit Module Configuration</button>
      )}

      {/* Show delete controls only if user can delete */}
      {access.permissions.can_delete_modules && (
        <button className="text-red-600">Delete Module</button>
      )}
    </div>
  );
}
```

---

### Example 4: Protecting Subscriptions Feature

**Location:** `src/app/users/[u]/company/[companySlug]/subscriptions/layout.js`

⚠️ **NOTE:** The companySlug/layout.js already handles subscription validation (checking if active subscription exists). This is DIFFERENT from permission-based access.

You can ADD permission checks on TOP of the existing subscription check:

```javascript
'use client';

import { useRouter } from 'next/navigation';
import { useAccess } from '@/hooks/useAccess';
import { requirePermission } from '@/lib/access-control';

export default function SubscriptionsLayout({ children }) {
  const router = useRouter();
  const access = useAccess();

  // OPTIONAL: Add permission-based access control
  // Only managers+ can view subscriptions
  requirePermission(access, 'can_view_subscriptions', router, {
    silent: true, // Don't show toast since subscription check already handles redirect
  });

  if (access.isLoading) return <div>Loading...</div>;

  // Note: The parent layout already checks for active subscription
  // This just adds permission layer on top
  return children;
}
```

---

## Implementation Order (Recommended)

### Phase 1: Core Setup ✅ (DONE)
- [x] Created `useAccess()` hook
- [x] Created `feature-permissions.js`
- [x] Updated `access-control.js` with new functions
- [x] Updated `AccessProtector.js`

### Phase 2: Test with One Feature (YOU DO THIS)
1. Pick ONE feature (e.g., Staff)
2. Update its layout.js to use `useAccess()` + `requirePermission()`
3. Update buttons/actions to check `access.permissions`
4. Test in browser
5. Verify overrides work in database

### Phase 3: Update Remaining Features (YOU DO THIS)
1. Modules feature
2. Subscriptions (permission layer on top of existing)
3. Settings
4. Reports (if exists)
5. Any other features

### Phase 4: Remove/Update Old useCompanyAccess Calls (GRADUAL)
- Don't rush - keep backward compatibility
- Update as you work on each feature
- Old code will continue to work

---

## Quick Checklist for Applying to a Feature

Use this for each feature you update:

```
[ ] Add permission_keys to database (if new feature)
[ ] Update FEATURE_PERMISSIONS in feature-permissions.js
[ ] Update FEATURE_GROUPS in feature-permissions.js
[ ] Create/update layout.js with requirePermission()
[ ] Update page/component buttons with permission checks
[ ] Test with owner role (should have all permissions)
[ ] Test with limited role (should not have permissions)
[ ] Test override in database (create override, reload, verify it works)
[ ] Test suspension (set suspended=true, verify no access)
```

---

## Files Ready to Use

All these files are now ready for you to use:

✅ `src/lib/feature-permissions.js` - Add your features here
✅ `src/hooks/useAccess.js` - Import and use in layouts/pages
✅ `src/lib/access-control.js` - Import helper functions as needed
✅ `src/components/AccessProtector.js` - Wrap components to protect them
✅ `PERMISSION_SYSTEM_GUIDE.md` - Detailed reference guide
✅ This file - Existing restrictions and how to update them

---

## Questions/Issues?

Reference the main guide: `PERMISSION_SYSTEM_GUIDE.md`

Key sections:
- **Usage Examples** - Copy/paste examples
- **Adding New Features** - Step-by-step
- **Helper Functions Reference** - All available functions
- **Troubleshooting** - Common issues
