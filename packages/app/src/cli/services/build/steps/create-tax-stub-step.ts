import {touchFile, writeFile, fileExists, isDirectory} from '@shopify/cli-kit/node/fs'
import type {LifecycleStep, BuildContext} from '../client-steps.js'

/**
 * Executes a create_tax_stub build step.
 *
 * Creates a minimal JavaScript stub file at the extension's output path,
 * satisfying the tax calculation extension bundle format.
 */
export async function executeCreateTaxStubStep(_step: LifecycleStep, context: BuildContext): Promise<void> {
  const {extension} = context
  if ((await fileExists(extension.outputPath)) && (await isDirectory(extension.outputPath))) {
    throw new Error(`outputPath '${extension.outputPath}' is a directory — expected a file path for the tax stub`)
  }
  await touchFile(extension.outputPath)
  await writeFile(extension.outputPath, '(()=>{})();')
}
