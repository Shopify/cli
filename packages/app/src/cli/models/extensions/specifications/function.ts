import {createExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent} from '@shopify/cli-kit/node/output'

interface UI {
  app_bridge?: {
    create_path: string
    details_path: string
  }
  ui_extension_handle?: string
}

export type FunctionConfigType = zod.infer<typeof FunctionExtensionSchema>
export const FunctionExtensionSchema = BaseSchema.extend({
  build: zod.object({
    command: zod
      .string()
      .transform((value) => (value.trim() === '' ? undefined : value))
      .optional(),
    path: zod.string().optional(),
    watch: zod.union([zod.string(), zod.string().array()]).optional(),
  }),
  configuration_ui: zod.boolean().optional().default(true),
  ui: zod
    .object({
      enable_create: zod.boolean().optional(),
      paths: zod
        .object({
          create: zod.string(),
          details: zod.string(),
        })
        .optional(),
      handle: zod.string().optional(),
    })
    .optional(),
  api_version: zod.string(),
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
  targeting: zod
    .array(
      zod.object({
        target: zod.string(),
        input_query: zod.string().optional(),
        export: zod.string().optional(),
      }),
    )
    .optional(),
})

const functionSpec = createExtensionSpecification({
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
    'order_routing_location_rule',
    'local_pickup_delivery_option_generator',
    'pickup_point_delivery_option_generator',
  ],
  schema: FunctionExtensionSchema,
  appModuleFeatures: (_) => ['function'],
  deployConfig: async (config, directory, apiKey, moduleId) => {
    let inputQuery: string | undefined
    const inputQueryPath = joinPath(directory, 'input.graphql')
    if (await fileExists(inputQueryPath)) {
      inputQuery = await readFile(inputQueryPath)
    }

    const targets =
      config.targeting &&
      (await Promise.all(
        config.targeting.map(async (config) => {
          let inputQuery

          if (config.input_query) {
            inputQuery = await readInputQuery(joinPath(directory, config.input_query))
          }

          return {handle: config.target, export: config.export, input_query: inputQuery}
        }),
      ))

    let ui: UI | undefined

    if (config.ui?.paths) {
      ui = {
        app_bridge: {
          details_path: config.ui.paths.details,
          create_path: config.ui.paths.create,
        },
      }
    }

    if (config.ui?.handle !== undefined) {
      ui = {
        ...ui,
        ui_extension_handle: config.ui.handle,
      }
    }

    return {
      title: config.name,
      module_id: moduleId,
      description: config.description,
      app_key: apiKey,
      api_type: config.type === 'function' ? undefined : config.type,
      api_version: config.api_version,
      input_query: inputQuery,
      input_query_variables: config.input?.variables
        ? {
            single_json_metafield: config.input.variables,
          }
        : undefined,
      ui,
      enable_creation_ui: config.ui?.enable_create ?? true,
      localization: await loadLocalesConfig(directory, 'function'),
      targets,
    }
  },
  preDeployValidation: async (extension) => {
    const wasmExists = await fileExists(extension.outputPath)
    if (!wasmExists) {
      throw new AbortError(
        outputContent`The function extension "${extension.handle}" hasn't compiled the wasm in the expected path: ${extension.outputPath}`,
        `Make sure the build command outputs the wasm in the expected directory.`,
      )
    }
  },
})

async function readInputQuery(path: string): Promise<string> {
  if (await fileExists(path)) {
    return readFile(path)
  } else {
    throw new AbortError(
      `No input query file at ${path}.`,
      `Create the file or remove the line referencing it in the extension's TOML.`,
    )
  }
}

export default functionSpec
