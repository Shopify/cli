import {StoreAuthAssociatedUserSchema, StoreAuthSessionSchema} from './types.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const StoreAuthListSessionSchema = StoreAuthSessionSchema.partial().extend({
  subdomain: zod.string(),
  connected: zod.string(),
  acquiredAt: StoreAuthSessionSchema.shape.acquiredAt
    .optional()
    .describe('When the stored token was acquired, in ISO 8601 format.'),
  expiresAt: StoreAuthSessionSchema.shape.expiresAt.describe(
    'When the stored access token expires, in ISO 8601 format.',
  ),
  refreshTokenExpiresAt: StoreAuthSessionSchema.shape.refreshTokenExpiresAt.describe(
    'When the stored refresh token expires, in ISO 8601 format.',
  ),
})

export const storeAuthListJsonOutputSchema = defineJsonOutputSchema({
  name: 'StoreAuthListResult',
  schema: zod.object({
    sessions: zod.array(StoreAuthListSessionSchema),
    message: zod.string().optional(),
  }),
  definitions: {
    StoreAuthListSession: StoreAuthListSessionSchema,
    StoreAuthAssociatedUser: StoreAuthAssociatedUserSchema,
  },
})

export type StoreAuthListResult = InferJsonOutputSchema<typeof storeAuthListJsonOutputSchema>
