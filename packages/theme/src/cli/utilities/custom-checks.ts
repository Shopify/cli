import {themeFlags} from '../flags.js'
import {Parser} from '@oclif/core'
import type {LoadConfigOptions} from '@shopify/theme-check-node'

/** Read execution permission from original operator input, independently of theme environment flags. */
export async function customCheckOptions(argv: string[]): Promise<LoadConfigOptions> {
  // The command validates all its flags separately. Parse only the permission flag here so
  // shopify.theme.toml cannot authorize the JavaScript shipped with the same theme.
  const separatorIndex = argv.indexOf('--')
  const flagArguments = separatorIndex < 0 ? argv : argv.slice(0, separatorIndex)
  const permissionArguments = flagArguments.filter(
    (argument) => argument === '--allow-custom-checks' || argument === '--no-allow-custom-checks',
  )
  const {flags} = await Parser.parse(permissionArguments, {
    flags: {'allow-custom-checks': themeFlags['allow-custom-checks']},
  })
  return {authorizeCustomChecks: () => flags['allow-custom-checks'] === true}
}
