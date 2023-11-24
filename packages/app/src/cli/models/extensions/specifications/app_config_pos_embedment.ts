import {createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const PosEmbedmentSchema = zod.object({
  pos: zod
    .object({
      embedded: zod.boolean(),
    })
    .optional(),
})

const spec = createConfigExtensionSpecification({
  identifier: 'pos_embedment',
  schema: PosEmbedmentSchema,
})

export default spec
