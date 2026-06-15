import {createDevStore} from '../../../services/store/create/dev.js'
import {devStorePlanHandles, DevStorePlan} from '../../../services/store/constants.js'
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
    plan: Flags.string({
      description: 'The Shopify plan to use for the new development store.',
      options: devStorePlanHandles,
      required: true,
      env: 'SHOPIFY_FLAG_STORE_PLAN',
    }),
    'feature-preview': Flags.string({
      description: 'The handle of a feature preview to enable on the new development store.',
      env: 'SHOPIFY_FLAG_STORE_FEATURE_PREVIEW',
    }),
    'with-demo-data': Flags.boolean({
      description: 'Populate the new development store with demo data.',
      default: false,
      env: 'SHOPIFY_FLAG_STORE_WITH_DEMO_DATA',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreCreateDev)
    try {
      await createDevStore({
        name: flags.name,
        organizationId: flags['organization-id'],
        plan: flags.plan as DevStorePlan,
        featurePreview: flags['feature-preview'],
        withDemoData: flags['with-demo-data'],
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
