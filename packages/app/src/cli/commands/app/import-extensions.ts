import {buildTomlObject as buildPaymentsTomlObject} from '../../services/payments/extension-to-toml.js'
import {buildTomlObject as buildFlowTomlObject} from '../../services/flow/extension-to-toml.js'
import {buildTomlObject as buildMarketingActivityTomlObject} from '../../services/marketing_activity/extension-to-toml.js'
import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'
import {appFlags} from '../../flags.js'
import {loadApp} from '../../models/app/loader.js'
import {AppInterface} from '../../models/app/app.js'
import {importExtensions} from '../../services/import-extensions.js'
import {loadLocalExtensionsSpecifications} from '../../models/extensions/load-specifications.js'
import AppCommand, {AppCommandOutput} from '../../utilities/app-command.js'
import {renderSelectPrompt, renderFatalError} from '@shopify/cli-kit/node/ui'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {AbortError} from '@shopify/cli-kit/node/error'
import {isShopify} from '@shopify/cli-kit/node/context/local'

interface MigrationChoice {
  label: string
  value: string
  extensionTypes: string[]
  buildTomlObject: (ext: ExtensionRegistration, allExtensions: ExtensionRegistration[]) => string
}

const getMigrationChoices = (isShopifolk: boolean): MigrationChoice[] => [
  {
    label: 'Payments Extensions',
    value: 'payments',
    extensionTypes: [
      'payments_app',
      'payments_app_credit_card',
      'payments_app_custom_credit_card',
      'payments_app_custom_onsite',
      'payments_app_redeemable',
      'payments_extension',
    ],
    buildTomlObject: buildPaymentsTomlObject,
  },
  {
    label: 'Flow Extensions',
    value: 'flow',
    extensionTypes: ['flow_action_definition', 'flow_trigger_definition', 'flow_trigger_discovery_webhook'],
    buildTomlObject: buildFlowTomlObject,
  },
  ...(isShopifolk
    ? [
        {
          label: 'Marketing Activity Extensions',
          value: 'marketing activity',
          extensionTypes: ['marketing_activity_extension'],
          buildTomlObject: buildMarketingActivityTomlObject,
        },
      ]
    : []),
]

export default class ImportExtensions extends AppCommand {
  static description = 'Import dashboard-managed extensions into your app.'

  static flags = {
    ...globalFlags,
    ...appFlags,
    'client-id': Flags.string({
      hidden: false,
      description: 'The Client ID of your app.',
      env: 'SHOPIFY_FLAG_CLIENT_ID',
      exclusive: ['config'],
    }),
  }

  async run(): Promise<AppCommandOutput> {
    const {flags} = await this.parse(ImportExtensions)
    const specifications = await loadLocalExtensionsSpecifications()
    const app: AppInterface = await loadApp({
      specifications,
      directory: flags.path,
      userProvidedConfigName: flags.config,
    })
    const isShopifolk = await isShopify()
    const migrationChoices = getMigrationChoices(isShopifolk)
    const choices = migrationChoices.map((choice) => {
      return {label: choice.label, value: choice.value}
    })
    const promptAnswer = await renderSelectPrompt({message: 'Extension type to migrate', choices})
    const migrationChoice = migrationChoices.find((choice) => choice.value === promptAnswer)
    if (migrationChoice === undefined) {
      renderFatalError(new AbortError('Invalid migration choice'))
      return {app}
    }
    await importExtensions({
      app,
      apiKey: flags['client-id'],
      extensionTypes: migrationChoice.extensionTypes,
      buildTomlObject: migrationChoice.buildTomlObject,
    })

    return {app}
  }
}
