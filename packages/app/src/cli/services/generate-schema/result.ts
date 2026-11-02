import {functionSchemaJsonOutputSchema, type FunctionSchemaResult, type GeneratedFunctionSchema} from './types.js'
import {writeFile} from '@shopify/cli-kit/node/fs'
import {outputInfo, outputResult} from '@shopify/cli-kit/node/output'
// Public artifact paths use native separators rather than CLI Kit's normalized paths.
// eslint-disable-next-line no-restricted-imports
import {resolve} from 'node:path'

export async function presentFunctionSchema(
  result: GeneratedFunctionSchema,
  options: {stdout: boolean; json: boolean},
): Promise<void> {
  const jsonResult: FunctionSchemaResult = options.stdout
    ? {schema: result.definition}
    : {path: resolve(result.path), format: 'graphql'}
  if (options.stdout) {
    outputResult(options.json ? functionSchemaJsonOutputSchema.encode(jsonResult) : result.definition)
    return
  }
  await writeFile(result.path, result.definition)
  if (options.json) outputResult(functionSchemaJsonOutputSchema.encode(jsonResult))
  else outputInfo(`GraphQL Schema for ${result.localIdentifier} written to ${result.path}`)
}
