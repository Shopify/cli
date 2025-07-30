import {BaseBDCommand} from '../../../lib/base-command.js'
import {commonFlags} from '../../../lib/flags.js'
import {FlagOptions} from '../../../lib/types.js'
import {ApiClient} from '../../../services/store/api/api-client.js'
import {MockApiClient} from '../../../services/store/mock/mock-api-client.js'
import {StoreExportOperation} from '../../../services/store/operations/store-export.js'
import {renderProgressWithPolling} from '../../../services/store/utils/bulk-operation-progress.js'
import {StoreIdentifier} from '../../../apis/organizations/index.js'
import {Organization} from '../../../apis/destinations/index.js'
import {StoreOperation} from '../../../services/store/types/operations.js'
import {BulkDataOperationByIdResponse} from '../../../apis/organizations/types.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Args} from '@oclif/core'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import { deserialize } from '../../../services/store/utils/composite-id.js'

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

    const compositeId = deserialize(args.id)
    const b64OrgId = compositeId.organizationId

    const orgGid = Buffer.from(b64OrgId, 'base64').toString('utf-8')

    const organizationIdentifier: StoreIdentifier = {type: 'organization', id: orgGid}

    const operationResponse = await apiClient.pollBulkDataOperation(organizationIdentifier, compositeId.bulkDataOperationId, bpSession)

    const operation = buildOperationFromResponse(operationResponse, bpSession, apiClient)

    if (this.flags.watch) {
      await renderProgressWithPolling(
        () => Promise.resolve(operationResponse),
        (operationId: string) => apiClient.pollBulkDataOperation(organizationIdentifier, operationId, bpSession),
        operation.renderProgress,
        () => `Watching operation ${compositeId.bulkDataOperationId}...\n`,
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

function buildOperationFromResponse(
  operationResponse: BulkDataOperationByIdResponse,
  bpSession: string,
  apiClient: ApiClient | MockApiClient,
): StoreOperation {
  // TODO: actually do this properly
  return new StoreExportOperation(bpSession, apiClient)
}
