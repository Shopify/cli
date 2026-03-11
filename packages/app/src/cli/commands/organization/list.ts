import {organizationList} from '../../services/organization/list.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import BaseCommand from '@shopify/cli-kit/node/base-command'

export default class OrganizationList extends BaseCommand {
  static summary = 'List Shopify organizations you have access to.'

  static descriptionWithMarkdown = `Lists the Shopify organizations that you have access to, along with their organization IDs.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(OrganizationList)
    await organizationList({json: flags.json})
  }
}
