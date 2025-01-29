import {searchForAppsByNameFactory} from './prompt-helpers.js'
import {appNamePrompt, createAsNewAppPrompt, selectAppPrompt} from '../../prompts/dev.js'
import {Organization, MinimalOrganizationApp, OrganizationApp} from '../../models/organization.js'
import {getCachedCommandInfo, setCachedCommandTomlPreference} from '../local-storage.js'
import {CreateAppOptions, DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AppConfigurationFileName} from '../../models/app/loader.js'
import {BugError} from '@shopify/cli-kit/node/error'

/**
 * Select an app from env, list or create a new one:
 * If there is no valid app yet, prompt the user to select one from the list or create a new one.
 * If no apps exists, we automatically prompt the user to create a new one.
 * @param app - Current local app information
 * @param apps - List of remote available apps
 * @param orgId - Current Organization
 * @returns The selected (or created) app
 */
export async function selectOrCreateApp(
  apps: MinimalOrganizationApp[],
  hasMorePages: boolean,
  org: Organization,
  developerPlatformClient: DeveloperPlatformClient,
  options: CreateAppOptions,
): Promise<OrganizationApp> {
  let createNewApp = apps.length === 0
  if (!createNewApp) {
    createNewApp = await createAsNewAppPrompt()
  }
  if (createNewApp) {
    const name = await appNamePrompt(options.name)
    return developerPlatformClient.createApp(org, {...options, name})
  } else {
    const app = await selectAppPrompt(searchForAppsByNameFactory(developerPlatformClient, org.id), apps, hasMorePages, {
      directory: options.directory,
    })

    const data = getCachedCommandInfo()
    const tomls = (data?.tomls as {[key: string]: AppConfigurationFileName}) ?? {}
    const selectedToml = tomls[app.apiKey]

    if (selectedToml) setCachedCommandTomlPreference(selectedToml)

    const fullSelectedApp = await developerPlatformClient.appFromIdentifiers(app)

    if (!fullSelectedApp) {
      // This is unlikely, and a bug. But we still want a nice user facing message plus appropriate context logged.
      throw new BugError(
        `Unable to fetch app ${app.apiKey} from Shopify`,
        'Try running `shopify app config link` to connect to an app you have access to.',
      )
    }
    return fullSelectedApp
  }
}
