import {StoreSchema, StoreOrganizationSchema, StoreCommandErrorSchema} from '../types.js'
import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const DeletedStoreSchema = zod.object({
  domain: StoreSchema.shape.subdomain,
  deletionRequested: zod.literal(true),
  deletionConfirmed: zod.boolean(),
})

export const deleteDevStoreJsonOutputSchema = defineJsonOutputSchema({
  name: 'DeleteDevStoreResult',
  schema: zod.union([
    zod.object({
      store: DeletedStoreSchema,
      organization: StoreOrganizationSchema,
      message: zod.string().optional(),
    }),
    StoreCommandErrorSchema,
  ]),
  definitions: {
    DeletedStore: DeletedStoreSchema,
    StoreOrganization: StoreOrganizationSchema,
    StoreCommandError: StoreCommandErrorSchema,
  },
})
