# Experiment 12: Convert ALLOWED_ROLES to Set and add ROLE_ORDER Map

## Hypothesis

Converting `ALLOWED_ROLES` array lookups to O(1) operations will reduce redundant iterations:
- `isRoleAllowed()` uses `includes()` - O(n) per call, called for every theme
- `byRole()` uses `indexOf()` twice - O(2n) per comparison, called O(n log n) times during sort

Creating `ALLOWED_ROLES_SET` for O(1) membership check and `ROLE_ORDER` Map for O(1) index lookup will eliminate these linear scans.

## File to Modify

`packages/theme/src/cli/utilities/theme-selector/fetch.ts`

## Changes

1. Add `ALLOWED_ROLES_SET` as a Set derived from `ALLOWED_ROLES` for O(1) `has()` lookup
2. Add `ROLE_ORDER` Map that maps role -> index for O(1) sort-order lookup
3. Update `isRoleAllowed()` to use `ALLOWED_ROLES_SET.has()` instead of `includes()`
4. Update `byRole()` to use `ROLE_ORDER.get()` instead of `indexOf()`

## Implementation

Replace the relevant sections in `packages/theme/src/cli/utilities/theme-selector/fetch.ts`:

```typescript
export type Role = 'live' | 'development' | 'unpublished'
export const ALLOWED_ROLES: Role[] = ['live', 'unpublished', 'development']

// O(1) lookup for role membership
const ALLOWED_ROLES_SET = new Set<string>(ALLOWED_ROLES)

// O(1) lookup for role sort order
const ROLE_ORDER = new Map<string, number>(ALLOWED_ROLES.map((role, index) => [role, index]))
```

Update `isRoleAllowed`:
```typescript
function isRoleAllowed(theme: Theme) {
  return ALLOWED_ROLES_SET.has(theme.role)
}
```

Update `byRole`:
```typescript
function byRole(themeA: Theme, themeB: Theme) {
  return (ROLE_ORDER.get(themeA.role) ?? Infinity) - (ROLE_ORDER.get(themeB.role) ?? Infinity)
}
```

## Success Criteria

1. All tests pass: `pnpm --filter @shopify/theme vitest run`
2. Type checking passes
3. No behavioral changes - same filtering and sorting results

## Verification

Run the theme package tests to verify the optimization doesn't break any functionality.
