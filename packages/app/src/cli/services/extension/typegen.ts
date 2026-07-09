import {exec} from '@shopify/cli-kit/node/system'
import {runWithTimer} from '@shopify/cli-kit/node/metadata'
import {packageManagerBinaryCommandForDirectory} from '@shopify/cli-kit/node/node-package-manager'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {Writable} from 'stream'

interface BuildGraphqlTypesOptions {
  stdout: Writable
  stderr: Writable
  signal?: AbortSignal
}

/**
 * Generates GraphQL types for a UI extension based on its input query.
 *
 * This mirrors the JavaScript typegen path used by functions: it runs
 * `graphql-code-generator` using the codegen configuration in the extension's
 * `package.json`, which is expected to reference the local GraphQL schema and
 * input query documents. UI extensions are always JavaScript/TypeScript
 * (esbuild-based), so there is no non-JS path to guard against.
 */
export async function buildGraphqlTypes(extension: {directory: string}, options: BuildGraphqlTypesOptions) {
  const command = await packageManagerBinaryCommandForDirectory(
    extension.directory,
    'graphql-code-generator',
    '--config',
    'package.json',
  )

  return runWithTimer('cmd_all_timing_network_ms')(async () => {
    return exec(command.command, command.args, {
      cwd: extension.directory,
      stderr: options.stderr,
      signal: options.signal,
    })
  })
}
