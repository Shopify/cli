import {getExtensionsToMigrate, migrateFlowExtensions} from './migrate/migrate-flow-extensions.js'
import {fetchAppExtensionRegistrations} from './dev/fetch.js'
import {fetchAppAndIdentifiers} from './context.js'
import {extensionMigrationPrompt} from './context/prompts.js'
import {AppInterface} from '../models/app/app.js'

import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {err} from '@shopify/cli-kit/node/result'

interface DeployOptions {
  /** The app to be built and uploaded */
  app: AppInterface

  /** API key of the app in Partners admin */
  apiKey?: string

  /** If true, ignore any cached appId or extensionId */
  reset: boolean

  /** If true, proceed with deploy without asking for confirmation */
  force: boolean

  /** The deployment label */
  label?: string
}

export async function migrate(options: DeployOptions) {
  const token = await ensureAuthenticatedPartners()
  const [partnersApp, envIdentifiers] = await fetchAppAndIdentifiers(options, token)
  const initialRemoteExtensions = await fetchAppExtensionRegistrations({token, apiKey: partnersApp.apiKey})
  const validIdentifiers = envIdentifiers.extensions ?? {}
  const localExtensions = [...options.app.extensions.ui, ...options.app.extensions.theme]
  const extensionsToMigrate = getExtensionsToMigrate(
    localExtensions,
    initialRemoteExtensions.app.extensionRegistrations,
    validIdentifiers,
  )
  console.log(extensionsToMigrate[0])

  if (extensionsToMigrate.length > 0) {
    let remoteExtensions = initialRemoteExtensions.app.extensionRegistrations
    const confirmedMigration = await extensionMigrationPrompt(extensionsToMigrate)

    if (confirmedMigration) {
      remoteExtensions = await migrateFlowExtensions(
        extensionsToMigrate,
        partnersApp.apiKey,
        initialRemoteExtensions.app.extensionRegistrations,
      )
      console.log({remoteExtensions})
    } else {
      return err('user-cancelled')
    }
  }
}
