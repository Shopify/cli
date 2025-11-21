import {buildTomlObject as buildPaymentsTomlObject} from '../services/payments/extension-to-toml.js'
import {buildTomlObject as buildFlowTomlObject} from '../services/flow/extension-to-toml.js'
import {buildTomlObject as buildAdminLinkTomlObject} from '../services/admin-link/extension-to-toml.js'
import {buildTomlObject as buildMarketingActivityTomlObject} from '../services/marketing_activity/extension-to-toml.js'
import {buildTomlObject as buildSubscriptionLinkTomlObject} from '../services/subscription_link/extension-to-toml.js'
import {ExtensionRegistration} from '../api/graphql/all_app_extension_registrations.js'
import {CurrentAppConfiguration} from '../models/app/app.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'

interface MigrationChoiceCommon {
  label: string
  value: string
  neverSelectAutomatically?: boolean
}

type ExtensionMigrationChoice = MigrationChoiceCommon & {
  mode: 'extension'
  extensionTypes: string[]
  buildTomlObject: (
    ext: ExtensionRegistration,
    allExtensions: ExtensionRegistration[],
    appConfiguration: CurrentAppConfiguration,
  ) => string
}

type SupportedShopImportSources = 'declarative definitions'

export type ShopImportMigrationChoice = MigrationChoiceCommon & {
  mode: 'shop-import'
  // Only declarative definitions are supported for shop import at present.
  value: SupportedShopImportSources
}

export type MigrationChoice = ExtensionMigrationChoice | ShopImportMigrationChoice

export const allMigrationChoices: MigrationChoice[] = [
  {
    mode: 'extension',
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
    mode: 'extension',
    label: 'Flow Extensions',
    value: 'flow',
    extensionTypes: ['flow_action_definition', 'flow_trigger_definition', 'flow_trigger_discovery_webhook'],
    buildTomlObject: buildFlowTomlObject,
  },
  {
    mode: 'extension',
    label: 'Marketing Activity Extensions',
    value: 'marketing activity',
    extensionTypes: ['marketing_activity_extension'],
    buildTomlObject: buildMarketingActivityTomlObject,
  },
  {
    mode: 'extension',
    label: 'Subscription Link Extensions',
    value: 'subscription link',
    extensionTypes: ['subscription_link', 'subscription_link_extension'],
    buildTomlObject: buildSubscriptionLinkTomlObject,
  },
  {
    mode: 'extension',
    label: 'Admin Link extensions',
    value: 'link extension',
    extensionTypes: ['app_link', 'bulk_action'],
    buildTomlObject: buildAdminLinkTomlObject,
  },
  {
    mode: 'shop-import',
    label: 'Metafields and Metaobject definitions',
    value: 'declarative definitions',
    neverSelectAutomatically: true,
  },
]

export function getMigrationChoices(extensions: ExtensionRegistration[]): MigrationChoice[] {
  return allMigrationChoices.filter(
    (choice) =>
      choice.mode === 'shop-import' ||
      choice.extensionTypes.some((type) => extensions.some((ext) => ext.type.toLowerCase() === type.toLowerCase())),
  )
}

export async function selectMigrationChoice(migrationChoices: MigrationChoice[]): Promise<MigrationChoice> {
  if (migrationChoices.length === 1 && migrationChoices[0] && !migrationChoices[0].neverSelectAutomatically) {
    return migrationChoices[0]
  }

  const choices = migrationChoices.map((choice) => {
    return {label: choice.label, value: choice.value}
  })
  const promptAnswer = await renderSelectPrompt({message: 'Extension type to migrate', choices})
  const migrationChoice = migrationChoices.find((choice) => choice.value === promptAnswer)
  if (migrationChoice === undefined) {
    throw new AbortError('Invalid migration choice')
  }
  return migrationChoice
}
