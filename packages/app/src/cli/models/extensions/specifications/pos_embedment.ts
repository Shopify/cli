import {createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const AppAccessSchema = zod.object({
  pos: zod
    .object({
      embedded: zod.boolean(),
    })
    .optional(),
})

const spec = createConfigExtensionSpecification({
  identifier: 'pos_embedment',
  schema: AppAccessSchema,
})

export default spec
