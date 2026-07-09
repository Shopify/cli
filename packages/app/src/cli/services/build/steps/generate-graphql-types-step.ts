import {buildGraphqlTypes} from '../../extension/typegen.js'
import type {LifecycleStep, BuildContext} from '../client-steps.js'

/**
 * Executes a generate_graphql_types build step.
 *
 * Runs `graphql-code-generator` to generate TypeScript types from a UI
 * extension's `input_query` documents, mirroring the typegen path functions run
 * as part of their build. This is a no-op for extensions that don't declare an
 * `input_query` on any target, so extensions without input queries (and without
 * a codegen config) are left untouched.
 */
export async function executeGenerateGraphqlTypesStep(_step: LifecycleStep, context: BuildContext): Promise<void> {
  if (!extensionHasInputQuery(context.extension)) return

  await buildGraphqlTypes(context.extension, context.options)
}

/**
 * Returns true when any of the extension's targets declares an `input_query`.
 */
function extensionHasInputQuery(extension: BuildContext['extension']): boolean {
  const extensionPoints = extension.configuration.extension_points
  if (!Array.isArray(extensionPoints)) return false

  return extensionPoints.some(
    (extensionPoint) =>
      typeof extensionPoint === 'object' &&
      extensionPoint !== null &&
      'input_query' in extensionPoint &&
      Boolean((extensionPoint as {input_query?: string}).input_query),
  )
}
