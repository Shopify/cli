import {createExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {ExtensionInstance} from '../extension-instance.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent} from '@shopify/cli-kit/node/output'
import {randomUUID} from '@shopify/cli-kit/node/crypto'

interface UI {
  app_bridge?: {
    create_path: string
    details_path: string
  }
  ui_extension_handle?: string
}

// Only offers the target-level remedy, even though removing either side would resolve the conflict:
// extension-level `[input.variables]` is on its way out, so the fix we suggest is the one that lasts.
const mixedInputVariablesMessage =
  'Input variables must be defined either at the extension level or on a target, not both. ' +
  'Remove `[input.variables]` from your extension configuration and declare `input_variables` on each target that needs them.'

const InputVariablesSchema = zod.object({
  namespace: zod.string(),
  key: zod.string(),
})

export type FunctionConfigType = zod.infer<typeof FunctionExtensionSchema>
export const FunctionExtensionSchema = BaseSchema.extend({
  build: zod
    .object({
      command: zod
        .string()
        .transform((value) => (value.trim() === '' ? undefined : value))
        .optional(),
      path: zod.string().optional(),
      watch: zod.union([zod.string(), zod.string().array()]).optional(),
      wasm_opt: zod.boolean().optional().default(true),
      typegen_command: zod
        .string()
        .transform((value) => (value.trim() === '' ? undefined : value))
        .optional(),
    })
    .optional(),
  name: zod.string(),
  type: zod.string(),
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
      variables: InputVariablesSchema.optional(),
    })
    .optional(),
  targeting: zod
    .array(
      zod.object({
        target: zod.string(),
        input_query: zod.string().optional(),
        input_variables: InputVariablesSchema.optional(),
        export: zod.string().optional(),
      }),
    )
    .optional(),
}).superRefine((config, ctx) => {
  if (!config.input?.variables) return

  // Reported per offending target so the error points at the line to change, rather than at the
  // top of the TOML.
  config.targeting?.forEach((targeting, index) => {
    if (!targeting.input_variables) return

    ctx.addIssue({
      code: zod.ZodIssueCode.custom,
      path: ['targeting', index, 'input_variables'],
      message: mixedInputVariablesMessage,
    })
  })
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
  getOutputRelativePath: (_extension: ExtensionInstance<FunctionConfigType>) => joinPath('dist', 'index.wasm'),
  devSessionWatchConfig: (extension: ExtensionInstance<FunctionConfigType>) => {
    const config = extension.configuration
    if (!config.build || !config.build.watch) return undefined

    const paths = [config.build.watch].flat().map((path) => joinPath(extension.directory, path))

    paths.push(joinPath(extension.directory, 'locales', '**.json'))
    paths.push(joinPath(extension.directory, '**', '!(.)*.graphql'))
    paths.push(joinPath(extension.directory, '**.toml'))

    return {paths}
  },
  clientSteps: [
    {
      lifecycle: 'deploy',
      steps: [{id: 'build-function', name: 'Build Function', type: 'build_function', config: {}}],
    },
  ],
  deployConfig: async (config, directory, apiKey) => {
    let inputQuery: string | undefined
    const moduleId = randomUUID()
    const inputQueryPath = joinPath(directory, 'input.graphql')
    if (await fileExists(inputQueryPath)) {
      inputQuery = await readFile(inputQueryPath)
    }

    const targets =
      config.targeting &&
      (await Promise.all(
        config.targeting.map(async (targeting) => {
          let inputQuery

          if (targeting.input_query) {
            inputQuery = await readInputQuery(joinPath(directory, targeting.input_query))
          }

          return {
            handle: targeting.target,
            export: targeting.export,
            input_query: inputQuery,
            input_query_variables: targeting.input_variables
              ? {single_json_metafield: targeting.input_variables}
              : undefined,
          }
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
