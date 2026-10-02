import {StoreCommandErrorSchema} from '../types.js'
import {createDevStoreJsonOutputSchema as createDevStoreSuccessJsonOutputSchema} from '@shopify/organizations'
import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export {createDevStore} from '@shopify/organizations'

export const createDevStoreJsonOutputSchema = defineJsonOutputSchema({
  name: 'CreateDevStoreResult',
  schema: zod.union([createDevStoreSuccessJsonOutputSchema.schema, StoreCommandErrorSchema]),
  definitions: {...createDevStoreSuccessJsonOutputSchema.definitions, StoreCommandError: StoreCommandErrorSchema},
})
