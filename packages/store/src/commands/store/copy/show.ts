import {BaseBDCommand} from '../../../lib/base-command.js'
import {commonFlags} from '../../../lib/flags.js'
import {FlagOptions} from '../../../lib/types.js'
import {ApiClient} from '../../../services/store/api/api-client.js'
import {MockApiClient} from '../../../services/store/mock/mock-api-client.js'
import {StoreCopyOperation} from '../../../services/store/operations/store-copy.js'
import {renderProgressWithPolling} from '../../../services/store/utils/bulk-operation-progress.js'
import {StoreIdentifier} from '../../../apis/organizations/index.js'
import {Organization} from '../../../apis/destinations/index.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Args} from '@oclif/core'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export default class Show extends BaseBDCommand {
  static summary = 'Show information about a store copy operation'
  static description = `Display detailed information about a specific store copy operation by ID.`
  static flags = {
    ...commonFlags,
    ...globalFlags,
  }

  static args = {
    id: Args.string({
      description: 'The ID of the copy operation to show',
      required: true,
    }),
  }

  async runCommand(): Promise<void> {
    this.flags = (await this.parse(Show)).flags as FlagOptions
    const {args} = await this.parse(Show)

    const apiClient = this.flags.mock ? new MockApiClient() : new ApiClient()
    const bpSession = await apiClient.ensureAuthenticatedBusinessPlatform()

    const orgs = await apiClient.fetchOrgs(bpSession)

    const organizationIdentifier: StoreIdentifier = this.getOrgIdentifier(orgs)
    const operationResponse = await apiClient.pollBulkDataOperation(organizationIdentifier, args.id, bpSession)
    if (this.flags.watch) {
      // this needs to be a copy, import, or export depending on the real type
      const operation = new StoreCopyOperation(bpSession, apiClient)

      await renderProgressWithPolling(
        () => Promise.resolve(operationResponse),
        (operationId: string) => apiClient.pollBulkDataOperation(organizationIdentifier, operationId, bpSession),
        operation.renderProgress,
        () => `Watching operation ${args.id}...`,
        (status, _completedCount) => {
          if (status === 'failed') return 'Operation failed.'
          return `Operation completed successfully!`
        },
      )
    } else {
      renderInfo({
        headline: `Bulk Data Operation ID: ${operationResponse.organization.bulkData.operation.id}`,
        body: `Status: ${operationResponse.organization.bulkData.operation.status}`,
      })
    }
  }

  private getOrgIdentifier(orgs: Organization[]): StoreIdentifier {
    if (orgs.length == 1) {
      return {type: 'organization', id: orgs[0]!.id}
    } else {
      const orgNames = orgs.map((org) => org.name).join(',\n')
      throw new Error(
        `Multiple organizations found:\n\n${orgNames}\n\nWe haven't implemented logic to handle this yet.`,
      )
    }
  }
}
