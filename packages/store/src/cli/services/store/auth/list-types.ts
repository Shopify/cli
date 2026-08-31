import {StoreAuthAssociatedUserSchema} from './types.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const StoreAuthListSessionSchema = zod.object({
  subdomain: zod.string(),
  connected: zod.string(),
  store: zod.string().optional(),
  userId: zod.string().optional(),
  scopes: zod.array(zod.string()).optional(),
  acquiredAt: zod.string().optional().describe('When the stored token was acquired, in ISO 8601 format.'),
  expiresAt: zod.string().optional().describe('When the stored access token expires, in ISO 8601 format.'),
  refreshTokenExpiresAt: zod.string().optional().describe('When the stored refresh token expires, in ISO 8601 format.'),
  associatedUser: StoreAuthAssociatedUserSchema.optional(),
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
