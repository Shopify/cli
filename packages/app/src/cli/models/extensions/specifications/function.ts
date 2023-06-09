import {createExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {defaultFunctionsFlavors} from '../../../constants.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'

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
  appModuleFeatures: (_) => ['function'],
  deployConfig: async (config, directory, apiKey, moduleId) => {
    let inputQuery: string | undefined
    const inputQueryPath = joinPath(directory, 'input.graphql')
    if (await fileExists(inputQueryPath)) {
      inputQuery = await readFile(inputQueryPath)
    }

    return {
      title: config.name,
      module_id: moduleId,
      description: config.description,
      app_key: apiKey,
      api_type: config.type,
      api_version: config.apiVersion,
      input_query: inputQuery,
      input_query_variables: config.input?.variables
        ? {
            single_json_metafield: config.input.variables,
          }
        : undefined,
      ui: config.ui?.paths
        ? {
            app_bridge: {
              details_path: config.ui.paths.details,
              create_path: config.ui.paths.create,
            },
          }
        : undefined,
      enable_creation_ui: config.ui?.enable_create ?? true,
    }
  },
})

export default spec
