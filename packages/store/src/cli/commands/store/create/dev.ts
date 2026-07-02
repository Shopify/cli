import {createDevStore} from '../../../services/store/create/dev.js'
import {devStorePlanHandles, DevStorePlan} from '../../../services/store/constants.js'
import {storeNamePrompt, storePlanPrompt} from '../../../prompts/store.js'
import {devStoreFlags, invalidCountryCodeMessage, isCountryCode, storeFlags} from '../../../flags.js'
import {selectOrg} from '@shopify/organizations'
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
      env: 'SHOPIFY_FLAG_STORE_NAME',
    }),
    'organization-id': storeFlags['organization-id'],
    plan: Flags.string({
      description: 'The Shopify plan to use for the new development store.',
      options: devStorePlanHandles,
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
    country: devStoreFlags.country,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreCreateDev)
    this.failMissingNonTTYFlags(flags, ['name', 'organization-id', 'plan'])

    if (flags.country !== undefined && !isCountryCode(flags.country)) {
      this.error(invalidCountryCodeMessage)
    }

    const organization = await selectOrg(flags['organization-id']?.toString())
    const name = flags.name ?? (await storeNamePrompt())
    const plan = (flags.plan as DevStorePlan | undefined) ?? (await storePlanPrompt())

    try {
      await createDevStore({
        name,
        organization,
        plan,
        featurePreview: flags['feature-preview'],
        withDemoData: flags['with-demo-data'],
        country: flags.country,
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
