import {searchForAppsByNameFactory} from './prompt-helpers.js'
import {appNamePrompt, createAsNewAppPrompt, selectAppPrompt} from '../../prompts/dev.js'
import {Organization, MinimalOrganizationApp, OrganizationApp} from '../../models/organization.js'
import {getCachedCommandInfo, setCachedCommandTomlPreference} from '../local-storage.js'
import {CreateAppOptions, DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AppConfigurationFileName} from '../../models/app/loader.js'
import {BugError} from '@shopify/cli-kit/node/error'
import {outputInfo} from '@shopify/cli-kit/node/output'

const MAX_PROMPT_RETRIES = 2

const TRY_MESSAGE = [
  'This may happen if:',
  '  • Running in an unstable environment (container restart, resource limits)',
  '  • Network interruption during app fetching',
  '',
  'Try running the command again. If the issue persists:',
  '  • Check system resources and stability',
  '  • Try running outside of containers/WSL if applicable',
  '  • Report this issue with the error details and a verbose log',
]
  .filter(Boolean)
  .join('\n')

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
    // Capture app selection context
    const cachedData = getCachedCommandInfo()
    const tomls = (cachedData?.tomls as {[key: string]: AppConfigurationFileName}) ?? {}

    for (let attempt = 0; attempt < MAX_PROMPT_RETRIES; attempt++) {
      // eslint-disable-next-line no-await-in-loop
      const app = await selectAppPrompt(
        searchForAppsByNameFactory(developerPlatformClient, org.id),
        apps,
        hasMorePages,
        {directory: options.directory},
      )

      if (!app) {
        if (attempt < MAX_PROMPT_RETRIES - 1) outputInfo('App selection failed. Retrying...')
        continue
      } else {
        const selectedToml = tomls[app.apiKey]
        if (selectedToml) setCachedCommandTomlPreference(selectedToml)

        // eslint-disable-next-line no-await-in-loop
        const fullSelectedApp = await developerPlatformClient.appFromIdentifiers(app.apiKey)

        if (fullSelectedApp) {
          return fullSelectedApp
        }
      }
    }

    // User-facing error message with key diagnostic info
    const errorMessage = [
      'Unable to select an app: the selection prompt failed multiple times.',
      '',
      `Available apps: ${apps.length}`,
    ].join('\n')

    throw new BugError(errorMessage, TRY_MESSAGE)
  }
}
