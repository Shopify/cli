import {createExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {defaultFunctionsFlavors} from '../../../constants.js'
import {zod} from '@shopify/cli-kit/node/schema'

export type FunctionConfigType = zod.infer<typeof FunctionExtensionSchema>
export const FunctionExtensionSchema = BaseSchema.extend({
  build: zod.object({
    command: zod
      .string()
      .transform((value) => (value.trim() === '' ? undefined : value))
      .optional(),
    path: zod.string().optional(),
  }),
  configurationUi: zod.boolean().optional().default(true),
  ui: zod
    .object({
      enable_create: zod.boolean().optional(),
      paths: zod
        .object({
          create: zod.string(),
          details: zod.string(),
        })
        .optional(),
    })
    .optional(),
  apiVersion: zod.string(),
  input: zod
    .object({
      variables: zod
        .object({
          namespace: zod.string(),
          key: zod.string(),
        })
        .optional(),
    })
    .optional(),
})

const spec = createExtensionSpecification({
  identifier: 'function',
  additionalIdentifiers: [
    'order_discounts',
    'cart_checkout_validation',
    'cart_transform',
    'delivery_customization',
    'payment_customization',
    'product_discounts',
    'shipping_discounts',
    'fulfillment_constraints',
  ],
  surface: 'admin',
  singleEntryPath: false,
  schema: FunctionExtensionSchema,
  supportedFlavors: defaultFunctionsFlavors,
  partnersWebIdentifier: 'function',
  graphQLType: 'function',
  isPreviewable: false,
  appModuleFeatures: (_) => ['function'],
})

export default spec
