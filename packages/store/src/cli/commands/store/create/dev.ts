import {createDevStore} from '../../../services/store/create/dev.js'
import {storeFlags} from '../../../flags.js'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {Flags} from '@oclif/core'

export default class StoreCreateDev extends Command {
  static hidden = true

  static summary = 'Create a new development store.'

  static descriptionWithMarkdown = 'Creates a new app development store in your organization.'

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    name: Flags.string({
      description: 'Name for the new development store.',
      required: true,
      env: 'SHOPIFY_FLAG_STORE_NAME',
    }),
    'organization-id': storeFlags['organization-id'],
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreCreateDev)
    try {
      await createDevStore({
        name: flags.name,
        organizationId: flags['organization-id'],
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
