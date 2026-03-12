import {touchFile, writeFile} from '@shopify/cli-kit/node/fs'
import type {LifecycleStep, BuildContext} from '../client-steps.js'

/**
 * Executes a create_tax_stub build step.
 *
 * Creates a minimal JavaScript stub file at the extension's output path,
 * satisfying the tax calculation extension bundle format.
 */
export async function executeCreateTaxStubStep(_step: LifecycleStep, context: BuildContext): Promise<void> {
  const {extension} = context
  await touchFile(extension.outputPath)
  await writeFile(extension.outputPath, '(()=>{})();')
}
