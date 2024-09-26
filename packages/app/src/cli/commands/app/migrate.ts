import Command from '../../utilities/app-command.js'
import {PartnersClient} from '../../utilities/developer-platform-client/partners-client.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputSuccess} from '@shopify/cli-kit/node/output'

export default class Migrate extends Command {
  public async run(): Promise<void> {
    const partnersClient = new PartnersClient()
    const response = await partnersClient.migrateApps({input: {organizationID: 1}})
    if (response.migrateApps.userErrors) {
      throw new AbortError(response.migrateApps.userErrors.map((error) => error.message).join('\n'))
    } else {
      outputSuccess('Apps migrated successfully')
    }
  }
}
