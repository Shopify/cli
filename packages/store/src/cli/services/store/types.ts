import {zod} from '@shopify/cli-kit/node/schema'

export {StoreSchema, StoreOrganizationSchema} from '@shopify/organizations'

// These commands predate the global JSON error envelope and keep their existing stdout contract.
export const StoreCommandErrorSchema = zod.object({
  error: zod.literal(true),
  message: zod.string(),
  nextSteps: zod.array(zod.unknown()).describe('Suggested next steps, as text or formatted UI tokens.'),
  exitCode: zod.literal(1),
})
