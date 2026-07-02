# @shopify/store

## 4.4.0

### Minor Changes

- 74a758d: Add `shopify store bulk execute`, `shopify store bulk status`, and `shopify store bulk cancel` so you can run Admin API bulk operations against a store using stored auth (`shopify store auth`), without needing an app. Mutations are disabled by default; pass `--allow-mutations` to run them.

### Patch Changes

- 82674f9: Render `store info` details as a two-column data table and surface store URLs as clickable next-step actions (e.g. "View your store").
- 73cebde: Allow `shopify theme pull` and `shopify theme push` to authenticate with a matching `shopify store auth` session when no theme password is provided.
- Updated dependencies [8ac5e57]
- Updated dependencies [3ad1710]
- Updated dependencies [8604491]
- Updated dependencies [73cebde]
  - @shopify/cli-kit@4.4.0
  - @shopify/organizations@4.4.0

## 4.3.0

### Minor Changes

- 57c26ac: Add `shopify auth list` to list stores authenticated directly with `shopify store auth`.
- 9aecd52: Add `shopify store create preview` to create preview stores and persist their Admin API token in local store auth.
- 2b3d2e2: Add `shopify store list` to list the stores in the Shopify organizations available to the current CLI account.

### Patch Changes

- b0ae39d: `store info` now supports store-auth sessions, falling back to the Admin API when a stored store auth token is available and the Business Platform lookup can't be used.
- Updated dependencies [08eb0ad]
- Updated dependencies [d22ad61]
- Updated dependencies [2b3d2e2]
  - @shopify/cli-kit@4.3.0
  - @shopify/organizations@4.3.0

## 4.2.0

### Patch Changes

- Updated dependencies [ef14e49]
- Updated dependencies [334e2d4]
- Updated dependencies [16d24c5]
  - @shopify/cli-kit@4.2.0
  - @shopify/organizations@4.2.0

## 4.1.0

### Patch Changes

- Updated dependencies [8943b19]
- Updated dependencies [5156580]
  - @shopify/cli-kit@4.1.0

## 4.0.0

### Major Changes

- 0c35553: Drop support for Node 20

### Patch Changes

- Updated dependencies [67745ee]
- Updated dependencies [a7d448b]
- Updated dependencies [2cb5f44]
- Updated dependencies [0c35553]
  - @shopify/cli-kit@4.0.0

## 3.94.0

### Patch Changes

- Updated dependencies [04b8492]
  - @shopify/cli-kit@3.94.0
