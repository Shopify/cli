import {createDevStore} from '../../../services/store/create/dev.js'
import {devStorePlanHandles, DevStorePlan} from '../../../services/store/constants.js'
import {storeNamePrompt, storePlanPrompt, storeDemoDataPrompt} from '../../../prompts/store.js'
import {countryFlag, storeFlags} from '../../../flags.js'
import {selectOrg} from '@shopify/organizations'
import Command from '@shopify/cli-kit/node/base-command'
import {globalFlags, jsonFlag, requiredIfNonInteractive} from '@shopify/cli-kit/node/cli'
import {terminalSupportsPrompting} from '@shopify/cli-kit/node/system'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {Flags} from '@oclif/core'

export default class StoreCreateDev extends Command {
  static summary = 'Create a new dev store.'

  static descriptionWithMarkdown = 'Creates a new dev store in your organization.'

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --name "Lavender Candles" --organization-id 1234567 --plan basic',
    '<%= config.bin %> <%= command.id %> --name "Lavender Candles" --organization-id 1234567 --plan basic --demo-data',
    '<%= config.bin %> <%= command.id %> --name "Lavender Candles" --organization-id 1234567 --plan basic --json',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    name: requiredIfNonInteractive(
      Flags.string({
        description: 'Name for the new dev store.',
        env: 'SHOPIFY_FLAG_STORE_NAME',
      }),
    ),
    'organization-id': requiredIfNonInteractive(storeFlags['organization-id']),
    plan: requiredIfNonInteractive(
      Flags.string({
        description: 'The Shopify plan to use for the new dev store.',
        options: devStorePlanHandles,
        env: 'SHOPIFY_FLAG_STORE_PLAN',
      }),
    ),
    'feature-preview': Flags.string({
      description: 'The handle of a feature preview to enable on the new dev store.',
      env: 'SHOPIFY_FLAG_STORE_FEATURE_PREVIEW',
    }),
    'demo-data': Flags.boolean({
      description: 'Populate the new dev store with demo data.',
      allowNo: true,
      env: 'SHOPIFY_FLAG_STORE_DEMO_DATA',
    }),
    country: countryFlag,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(StoreCreateDev)

    const organization = await selectOrg(flags['organization-id']?.toString())
    const name = flags.name ?? (await storeNamePrompt())
    const plan = (flags.plan as DevStorePlan | undefined) ?? (await storePlanPrompt())
    // An unspecified flag means "ask" where we can prompt and "no" where we can't.
    const withDemoData = flags['demo-data'] ?? (terminalSupportsPrompting() ? await storeDemoDataPrompt() : false)

    try {
      await createDevStore({
        name,
        organization,
        plan,
        featurePreview: flags['feature-preview'],
        withDemoData,
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
