import {BaseBDCommand} from '../../lib/base-command.js'
import {commonFlags, storeFlags, fileFlags, resourceConfigFlags} from '../../lib/flags.js'
import {OperationMode} from '../../services/store/types/operations.js'
import {StoreCopyOperation} from '../../services/store/operations/store-copy.js'
import {StoreExportOperation} from '../../services/store/operations/store-export.js'
import {StoreImportOperation} from '../../services/store/operations/store-import.js'
import {ApiClient} from '../../services/store/api/api-client.js'
import {MockApiClient} from '../../services/store/mock/mock-api-client.js'
import {Organization} from '../../apis/destinations/index.js'
import {ensureOrgHasBulkDataAccess} from '../../services/store/utils/store-utils.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {joinPath, cwd} from '@shopify/cli-kit/node/path'

export default class Copy extends BaseBDCommand {
  static summary = 'Copy, export, or import store data'
  static description = 'Copy data between stores, export store data to SQLite, or import data from SQLite to a store'
  static hidden = true
  static flags = {
    ...storeFlags,
    ...fileFlags,
    ...resourceConfigFlags,
    ...commonFlags,
    ...globalFlags,
  }

  async runCommand(): Promise<void> {
    this.flags = (await this.parse(Copy)).flags

    // Check access for all organizations first
    const apiClient = this.flags.mock ? new MockApiClient() : new ApiClient()
    const bpSession = await apiClient.ensureAuthenticatedBusinessPlatform()
    const allOrgs = await apiClient.fetchOrganizations(bpSession)

    const accessChecks = await Promise.all(
      allOrgs.map(async (org) => ({
        org,
        hasAccess: await ensureOrgHasBulkDataAccess(org.id, bpSession, apiClient),
      })),
    )

    const orgsWithAccess = accessChecks.filter(({hasAccess}) => hasAccess).map(({org}) => org)
    if (orgsWithAccess.length === 0) {
      throw new Error(`This command is only available to Early Access Program members.`)
    }

    const {'from-store': fromStore, 'to-store': toStore, 'from-file': fromFile, _} = this.flags
    let {'to-file': toFile} = this.flags
    const operationMode = this.determineOperationMode(fromStore, toStore, fromFile, toFile)

    if (operationMode === OperationMode.StoreExport && !toFile) {
      const storeDomain = (fromStore as string).replace(/[^a-zA-Z0-9.-]/g, '_')
      toFile = joinPath(cwd(), `${storeDomain}-export-${Date.now()}.sqlite`)
    }

    const operation = this.getOperation(operationMode, bpSession, apiClient, orgsWithAccess)

    switch (operationMode) {
      case OperationMode.StoreCopy:
        await operation.execute(fromStore as string, toStore as string, this.flags)
        break
      case OperationMode.StoreExport:
        await operation.execute(fromStore as string, toFile as string, this.flags)
        break
      case OperationMode.StoreImport:
        await operation.execute(fromFile as string, toStore as string, this.flags)
        break
    }
  }

  private getOperation(
    mode: OperationMode,
    bpSession: string,
    apiClient: ApiClient | MockApiClient,
    orgs: Organization[],
  ) {
    switch (mode) {
      case OperationMode.StoreCopy:
        return new StoreCopyOperation(bpSession, apiClient, orgs)
      case OperationMode.StoreExport:
        return new StoreExportOperation(bpSession, apiClient, orgs)
      case OperationMode.StoreImport:
        return new StoreImportOperation(bpSession, apiClient, orgs)
      default:
        throw new Error(`Unknown operation mode: ${mode}`)
    }
  }

  private determineOperationMode(
    fromStore: unknown,
    toStore: unknown,
    fromFile: unknown,
    toFile: unknown,
  ): OperationMode {
    if (fromStore && toStore && !fromFile && !toFile) {
      return OperationMode.StoreCopy
    }

    if (fromStore && !toStore && !fromFile) {
      return OperationMode.StoreExport
    }

    if (fromFile && toStore && !fromStore && !toFile) {
      return OperationMode.StoreImport
    }

    throw new Error(
      'Invalid flag combination. Valid operations are: copy (--from-store --to-store), export (--from-store --to-file), or import (--from-file --to-store)',
    )
  }
}
