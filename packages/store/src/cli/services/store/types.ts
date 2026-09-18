import {zod} from '@shopify/cli-kit/node/schema'

// Commands select the fields they expose and preserve their existing names and requiredness.
// IDs remain command-specific: creation returns a numeric ID, while inspection returns a Shop GID.
export const StoreSchema = zod.object({
  id: zod.string(),
  name: zod.string(),
  subdomain: zod.string(),
  country: zod.string().optional(),
  type: zod.string().optional(),
  authScopes: zod.array(zod.string()).optional(),
})
