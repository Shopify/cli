import {createConfigExtensionSpecification, TransformationConfig} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const PosConfigurationSchema = BaseSchema.extend({
  pos: zod
    .object({
      embedded: zod.boolean({
        error: (issue) => {
          if (issue.code === 'invalid_type') {
            return 'Value must be Boolean'
          }
          return issue.message
        },
      }),
    })
    .optional(),
})

export const PosSpecIdentifier = 'point_of_sale'

const PosTransformConfig: TransformationConfig = {
  embedded: 'pos.embedded',
}

const appPOSSpec = createConfigExtensionSpecification({
  identifier: PosSpecIdentifier,
  schema: PosConfigurationSchema,
  transformConfig: PosTransformConfig,
})

export default appPOSSpec
