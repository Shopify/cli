import {devStorePlanHandles, type DevStorePlan} from './plans.js'
import {StoreSchema, StoreOrganizationSchema} from '../../models/store.js'
import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const CreatedDevStoreSchema = StoreSchema.pick({name: true}).extend({
  domain: StoreSchema.shape.subdomain,
  adminUrl: zod.string().nullish(),
  plan: zod.enum(devStorePlanHandles as [DevStorePlan, ...DevStorePlan[]]),
  featurePreview: zod.string().optional(),
  country: StoreSchema.shape.country,
  demoData: zod.boolean(),
})

export const createDevStoreJsonOutputSchema = defineJsonOutputSchema({
  name: 'CreateDevStoreResult',
  schema: zod.object({
    store: CreatedDevStoreSchema,
    organization: StoreOrganizationSchema,
  }),
  definitions: {CreatedDevStore: CreatedDevStoreSchema, StoreOrganization: StoreOrganizationSchema},
})
