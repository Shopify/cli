import {writeOrganizationListResult} from '../../services/organization/list/result.js'
import {organizationList} from '../../services/organization/list.js'
import {organizationListJsonOutputSchema} from '../../services/organization/list/types.js'
import {NoOrgError} from '../../services/dev/fetch.js'
import {authAliasFlag, globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import BaseCommand from '@shopify/cli-kit/node/base-command'

export default class OrganizationList extends BaseCommand {
  static baseFlags = {...BaseCommand.baseFlags, ...authAliasFlag}

  static summary = 'List Shopify organizations you have access to.'

  static descriptionWithMarkdown = `Lists the Shopify organizations that you have access to, along with their organization IDs.`

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
  }

  static get jsonOutputSchema() {
    return organizationListJsonOutputSchema
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(OrganizationList)

    try {
      const result = await organizationList()
      writeOrganizationListResult(result, flags.json ? 'json' : 'text')
    } catch (error) {
      if (flags.json && error instanceof NoOrgError) {
        writeOrganizationListResult({organizations: []}, 'json')
        return
      }
      throw error
    }
  }
}
