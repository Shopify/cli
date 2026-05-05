import {deleteDevStore} from '../../services/store/delete/dev.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {Flags} from '@oclif/core'

export default class StoreDelete extends Command {
  static summary = 'Delete a development store.'

  static descriptionWithMarkdown = 'Deletes an app development store from your organization.'

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    store: Flags.string({
      description: 'The domain of the development store to delete (e.g. my-store.myshopify.com).',
      required: true,
      aliases: ['name'],
      env: 'SHOPIFY_FLAG_STORE',
    }),
    organization: Flags.string({
      description:
        'The organization that owns the store (numeric ID). Auto-selects if you belong to a single org.',
      aliases: ['organization-id'],
      env: 'SHOPIFY_FLAG_ORGANIZATION',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreDelete)
    try {
      await deleteDevStore({
        store: flags.store,
        organization: flags.organization,
        json: flags.json,
      })
    } catch (error) {
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
