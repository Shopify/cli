import {runThemeCheck} from '../theme-check.js'
import type {BuildStep, BuildContext} from '../build-steps.js'

/**
 * Executes a build_theme build step.
 *
 * Runs theme check on the extension directory and writes any offenses to stdout.
 */
export async function executeBuildThemeStep(_step: BuildStep, context: BuildContext): Promise<void> {
  const {extension, options} = context
  options.stdout.write(`Running theme check on your Theme app extension...`)
  const offenses = await runThemeCheck(extension.directory)
  if (offenses) options.stdout.write(offenses)
}
