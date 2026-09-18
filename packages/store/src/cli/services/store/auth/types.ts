import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const StoreAuthAssociatedUserSchema = zod.object({
  id: zod.number(),
  email: zod.string().optional(),
  firstName: zod.string().optional(),
  lastName: zod.string().optional(),
  accountOwner: zod.boolean().optional(),
})

export const StoreAuthSessionSchema = zod.object({
  store: zod.string(),
  userId: zod.string(),
  scopes: zod.array(zod.string()),
  acquiredAt: zod.string(),
  expiresAt: zod.string().optional(),
  refreshTokenExpiresAt: zod.string().optional(),
  associatedUser: StoreAuthAssociatedUserSchema.optional(),
})

export const storeAuthJsonOutputSchema = defineJsonOutputSchema({
  name: 'StoreAuthResult',
  schema: StoreAuthSessionSchema.extend({hasRefreshToken: zod.boolean()}),
  definitions: {StoreAuthAssociatedUser: StoreAuthAssociatedUserSchema},
})

export type StoreAuthSession = zod.infer<typeof StoreAuthSessionSchema>
export type StoreAuthResult = InferJsonOutputSchema<typeof storeAuthJsonOutputSchema>
