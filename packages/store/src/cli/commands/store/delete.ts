import {deleteDevStore} from '../../services/store/delete/dev.js'
import {storeFlags} from '../../flags.js'
import {resolveOrganizationForStore} from '../../utilities/store-lookup/organization.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {AbortError, AbortSilentError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {isTTY, renderDangerousConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {Flags} from '@oclif/core'

export default class StoreDelete extends Command {
  static hidden = true

  static summary = 'Delete a development store.'

  static descriptionWithMarkdown = 'Deletes a development store from your organization.'

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --organization-id 1234567',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --organization-id 1234567 --json',
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com --organization-id 1234567 --force',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    store: storeFlags.store,
    'organization-id': storeFlags['organization-id'],
    force: Flags.boolean({
      char: 'f',
      description: 'Skip confirmation.',
      env: 'SHOPIFY_FLAG_FORCE',
      default: false,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreDelete)

    try {
      // Deleting a store is irreversible: in non-interactive runs (CI, agents, piped
      // input) confirmation is impossible, so an explicit --force is required instead.
      if (!flags.force && !isTTY()) {
        throw new AbortError(`Deleting the development store ${flags.store} requires confirmation.`, null, [
          'Use the `--force` flag to skip confirmation when running non-interactively.',
        ])
      }

      const organization = await resolveOrganizationForStore(flags.store, flags['organization-id']?.toString())

      if (!flags.force) {
        const confirmed = await renderDangerousConfirmationPrompt({
          message: `Delete development store ${flags.store}? This can't be undone.`,
          confirmation: flags.store,
        })
        if (!confirmed) throw new AbortSilentError()
      }

      await deleteDevStore({
        store: flags.store,
        organization,
        json: flags.json,
      })
    } catch (error) {
      // Only expected failures (AbortError) are rendered as JSON. Unexpected errors rethrow to the
      // global error handler so they keep their stack traces and get reported as CLI bugs.
      if (flags.json && error instanceof AbortError) {
        outputResult(
          JSON.stringify(
            {
              error: true,
              message: error.message,
              nextSteps: error.nextSteps ?? [],
              exitCode: 1,
            },
            null,
            2,
          ),
        )
        process.exit(1)
      }
      throw error
    }
  }
}
