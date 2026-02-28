import {configWithoutFirstClassFields, createConfigExtensionSpecification} from '../specification.js'
import {BaseSchemaWithoutHandle} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const BrandingSchema = BaseSchemaWithoutHandle.extend({
  name: zod.string({required_error: 'String is required'}).max(30, {message: 'String must be less than 30 characters'}),
  handle: zod
    .string({required_error: 'String is required'})
    .max(256, {message: 'String must be less than 256 characters long'})
    .refine((value) => value && /^\w*(?!-)[_a-z0-9-]+(?<!-)$/.test(value), {
      message: "String can't contain special characters",
    })
    .optional(),
})

export const BrandingSpecIdentifier = 'branding'

const appBrandingSpec = createConfigExtensionSpecification({
  identifier: BrandingSpecIdentifier,
  schema: BrandingSchema,
  deployConfig: async (config) => {
    // Use configWithoutFirstClassFields to strip type/handle/uid/path/extensions,
    // then re-add handle since it's real branding data (not just a base field)
    const stripped = configWithoutFirstClassFields(config)
    const handle = (config as {handle?: string}).handle
    if (handle === undefined) return stripped
    return {...stripped, handle}
  },
  transformRemoteToLocal: (content: object) => ({
    name: (content as {name?: string}).name,
    handle: (content as {app_handle?: string}).app_handle,
  }),
})

export default appBrandingSpec
