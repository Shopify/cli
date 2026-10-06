import {themeFlags} from '../../../flags.js'
import {downloadMetafieldDefinitions, MetafieldsPullFlags} from '../../../services/metafields-pull.js'
import ThemeCommand, {RequiredFlags} from '../../../utilities/theme-command.js'
import {themeMetafieldsPullJsonOutputSchema} from '../../../services/metafields-pull/types.js'
import {renderThemeMetafieldsPullResult} from '../../../services/metafields-pull/result.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {emitCommandEvent} from '@shopify/cli-kit/node/command-events'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {InferredFlags} from '@oclif/core/interfaces'
import type {ThemeEnvironmentResult} from '../../../services/json-output/schema.js'

type MetafieldsFlags = InferredFlags<typeof MetafieldsPull.flags>

export default class MetafieldsPull extends ThemeCommand {
  static get jsonOutputSchema() {
    return themeMetafieldsPullJsonOutputSchema
  }

  static summary = 'Download metafields definitions from your shop into a local file.'

  static descriptionWithMarkdown = `Retrieves metafields from Shopify Admin.

If the metafields file already exists, it will be overwritten.`

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    ...themeFlags,
    force: Flags.boolean({
      hidden: true,
      char: 'f',
      description: 'Proceed without confirmation, if current directory does not seem to be theme directory.',
      env: 'SHOPIFY_FLAG_FORCE',
    }),
  }

  static multiEnvironmentsFlags: RequiredFlags = null

  async command(flags: MetafieldsFlags, _session?: unknown, multiEnvironment = false) {
    const args: MetafieldsPullFlags = {
      path: flags.path,
      password: flags.password,
      store: flags.store,
      force: flags.force,
      verbose: flags.verbose,
      noColor: flags['no-color'],
    }

    const result = await downloadMetafieldDefinitions(args)
    if (result.status === 'failed') {
      const error = new AbortError(
        'Failed to fetch metafield definitions.',
        'Check your connection and permissions, then try again.',
      )
      error.details = {failedOwnerTypes: result.failedOwnerTypes}
      throw error
    }
    if (result.status === 'downloaded' && result.failedOwnerTypes.length > 0) {
      process.exitCode = 1
      emitCommandEvent({
        type: 'diagnostic',
        level: 'error',
        message: `Failed to fetch metafield definitions for: ${result.failedOwnerTypes.join(', ')}.`,
      })
    }
    if (!multiEnvironment || !flags.json) renderThemeMetafieldsPullResult(result, flags.json ? 'json' : 'text')
    return result
  }

  protected collectsEnvironmentResults(flags: Partial<MetafieldsFlags>): boolean {
    return Boolean(flags.json)
  }

  protected renderEnvironmentResults(environments: ThemeEnvironmentResult[]): void {
    outputResult(themeMetafieldsPullJsonOutputSchema.encode({environments}))
  }
}
