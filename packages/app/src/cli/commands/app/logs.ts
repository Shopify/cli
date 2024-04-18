import {selectDeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import Command from '../../utilities/app-command.js'
import {appFlags} from '../../flags.js'
import {logs} from '../../services/logs.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class Logs extends Command {
  static summary = 'Streams logs from your app.'
  static descriptionWithMarkdown = `Stream function Logs.`

  static flags = {
    ...globalFlags,
    ...appFlags,
  }

  static description = this.descriptionWithoutMarkdown()

  public async run(): Promise<void> {
    const {flags} = await this.parse(Logs)
    console.log('[logs.ts run()] flags passed in', flags)
    const apiKey = flags['client-id'] || flags['api-key']
    const developerPlatformClient = selectDeveloperPlatformClient()
    const commandOptions = {
      directory: flags.path,
      reset: flags.reset,
      storeFqdn: flags.store,
      apiKey,
    }
    // interface LogOptions {
    //   apiKey: string
    //   storeId: string
    //   developerPlatformClient: DeveloperPlatformClient
    // }

    console.log('[logs.ts run()] wipLogsConfig', commandOptions)
    await logs(commandOptions)
  }
}

// interface LogContextOptions {
//   directory: string
//   apiKey?: string
//   storeFqdn?: string
//   reset: boolean
// }

// interface LogContextOutput {
//   remoteApp: Omit<OrganizationApp, 'apiSecretKeys'> & {apiSecret?: string}
//   storeId: string
//   developerPlatformClient: DeveloperPlatformClient
// }

// // returns localApp...
// async function ensureLogsContext(
//   options: LogContextOptions,
//   developerPlatformClient: DeveloperPlatformClient,
// ): Promise<LogContextOutput> {
//   const {configuration, cachedInfo, remoteApp} = await getAppContext({
//     ...options,
//     developerPlatformClient,
//     promptLinkingApp: !options.apiKey,
//   })

//   const orgId = getOrganization() || cachedInfo?.orgId || (await selectOrg(developerPlatformClient))

//   const {app: selectedApp, store: selectedStore} = await fetchDevDataFromOptions(
//     options,
//     orgId,
//     developerPlatformClient,
//   )
//   const organization = await fetchOrgFromId(orgId, developerPlatformClient)

//   return {
//     storeId: '2',
//     apiKey: remoteApp?.apiKey,
//   }
// }

// async function selectOrg(developerPlatformClient: DeveloperPlatformClient): Promise<string> {
//   const orgs = await fetchOrganizations(developerPlatformClient)
//   const org = await selectOrganizationPrompt(orgs)
//   return org.id
// }
