import {createConfigExtensionSpecification, configWithoutFirstClassFields} from '../specification.js'
import {BaseSchemaWithoutHandle} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const PosConfigurationSchema = BaseSchemaWithoutHandle.extend({
  pos: zod
    .object({
      embedded: zod.boolean({invalid_type_error: 'Value must be Boolean'}),
    })
    .optional(),
})

export const PosSpecIdentifier = 'point_of_sale'

const appPOSSpec = createConfigExtensionSpecification({
  identifier: PosSpecIdentifier,
  schema: PosConfigurationSchema,
  deployConfig: async (config) => {
    const {name, ...rest} = configWithoutFirstClassFields(config)
    return rest
  },
  transformRemoteToLocal: (content: object) => ({pos: {embedded: (content as {embedded: boolean}).embedded}}),
})

export default appPOSSpec
