import {searchForAppsByNameFactory} from './prompt-helpers.js'
import {appNamePrompt, createAsNewAppPrompt, selectAppPrompt} from '../../prompts/dev.js'
import {Organization, MinimalOrganizationApp, OrganizationApp} from '../../models/organization.js'
import {getCachedCommandInfo, setCachedCommandTomlPreference} from '../local-storage.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AppConfigurationFileName} from '../../models/app/loader.js'

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
  localAppName: string,
  apps: MinimalOrganizationApp[],
  hasMorePages: boolean,
  org: Organization,
  developerPlatformClient: DeveloperPlatformClient,
  options?: {
    isLaunchable?: boolean
    scopesArray?: string[]
    directory?: string
  },
): Promise<OrganizationApp> {
  let createNewApp = apps.length === 0
  if (!createNewApp) {
    createNewApp = await createAsNewAppPrompt()
  }
  if (createNewApp) {
    const name = await appNamePrompt(localAppName)
    return developerPlatformClient.createApp(org, name, options)
  } else {
    const app = await selectAppPrompt(searchForAppsByNameFactory(developerPlatformClient, org.id), apps, hasMorePages, {
      directory: options?.directory,
    })

    const data = getCachedCommandInfo()
    const tomls = (data?.tomls as {[key: string]: AppConfigurationFileName}) ?? {}
    const selectedToml = tomls[app.apiKey]

    if (selectedToml) setCachedCommandTomlPreference(selectedToml)

    const fullSelectedApp = await developerPlatformClient.appFromId(app)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return fullSelectedApp!
  }
}
