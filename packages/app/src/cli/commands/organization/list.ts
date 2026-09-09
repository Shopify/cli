import {
  organizationList,
  organizationListJsonOutputSchema,
  type OrganizationListResult,
} from '../../services/organization/list.js'
import {NoOrgError} from '../../services/dev/fetch.js'
import {authAliasFlag, globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import BaseCommand from '@shopify/cli-kit/node/base-command'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderTable} from '@shopify/cli-kit/node/ui'

export default class OrganizationList extends BaseCommand {
  static baseFlags = {...BaseCommand.baseFlags, ...authAliasFlag}

  static summary = 'List Shopify organizations you have access to.'

  static descriptionWithMarkdown = `Lists the Shopify organizations that you have access to, along with their organization IDs.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
  }

  static get jsonOutputSchema() {
    return organizationListJsonOutputSchema
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(OrganizationList)

    let result: OrganizationListResult
    try {
      result = await organizationList()
    } catch (error) {
      if (flags.json && error instanceof NoOrgError) {
        outputResult(organizationListJsonOutputSchema.encode({organizations: []}))
        return
      }
      throw error
    }

    if (flags.json) {
      outputResult(organizationListJsonOutputSchema.encode(result))
    } else {
      renderTable({
        rows: result.organizations.map((organization) => ({id: organization.id, name: organization.name})),
        columns: {
          id: {header: 'ID'},
          name: {header: 'NAME'},
        },
      })
    }
  }
}
