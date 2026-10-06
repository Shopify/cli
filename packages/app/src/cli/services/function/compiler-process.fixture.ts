import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import functionSpec, {type FunctionConfigType} from '../../models/extensions/specifications/function.js'
import {renderConcurrent} from '@shopify/cli-kit/node/ui'
import {runWithCommandEventsForCommand} from '@shopify/cli-kit/node/command-events'
import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'
import {outputInfo, outputResult} from '@shopify/cli-kit/node/output'
import {AbortError, handler} from '@shopify/cli-kit/node/error'
import {joinPath} from '@shopify/cli-kit/node/path'
import type {ExtensionSpecification} from '../../models/extensions/specification.js'
import type {AppInterface} from '../../models/app/app.js'

// Runs only in the outer subprocess test with a harmless compiler and real temporary files.
const directory = process.argv[2]!
const json = process.argv[3] === 'json'
const configuration: FunctionConfigType = {
  name: 'Fixture function',
  type: 'product_discounts',
  api_version: '2022-07',
  build: {wasm_opt: false, typegen_command: 'node typegen.cjs'},
  configuration_ui: false,
}
const extension = new ExtensionInstance<FunctionConfigType>({
  configuration,
  specification: functionSpec as unknown as ExtensionSpecification,
  directory,
  configurationPath: joinPath(directory, 'shopify.extension.toml'),
  entryPath: joinPath(directory, 'src', 'index.ts'),
})
const app = {directory, name: 'Compiler fixture', dotenv: undefined} as AppInterface
const resultSchema = defineJsonOutputSchema({
  name: 'CompilerFixtureResult',
  schema: zod.object({status: zod.literal('success'), path: zod.string()}).strict(),
})

// eslint-disable-next-line no-void -- The fixture boundary handles build failures and owns its process exit status.
void runWithCommandEventsForCommand(json ? ['--json'] : [], async () => {
  try {
    await renderConcurrent({
      processes: [
        {
          prefix: extension.localIdentifier,
          action: async (stdout, stderr, signal) => {
            await extension.build({app, environment: 'production', stdout, stderr, signal})
          },
        },
      ],
      showTimestamps: false,
    })
    if (json) outputResult(resultSchema.encode({status: 'success', path: extension.outputPath}))
    else outputInfo('Fixture compilation completed.')
  } catch (error) {
    if (!(error instanceof AbortError)) throw error
    await handler(error)
    process.exitCode = 1
  }
})
