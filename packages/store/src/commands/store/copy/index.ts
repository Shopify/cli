import {BaseBDCommand} from '../../../lib/base-command.js'
import {commonFlags, storeFlags, fileFlags, resourceConfigFlags} from '../../../lib/flags.js'
import {FlagOptions} from '../../../lib/types.js'
import {parseResourceConfigFlags} from '../../../lib/resource-config.js'
import {OperationMode} from '../../../services/store/types/operations.js'
import {StoreCopyOperation} from '../../../services/store/operations/store-copy.js'
import {StoreExportOperation} from '../../../services/store/operations/store-export.js'
import {StoreImportOperation} from '../../../services/store/operations/store-import.js'
import {ApiClient} from '../../../services/store/api/api-client.js'
import {MockApiClient} from '../../../services/store/mock/mock-api-client.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {joinPath, cwd} from '@shopify/cli-kit/node/path'
import {loadHelpClass} from '@oclif/core'

export default class Copy extends BaseBDCommand {
  static summary = 'Copy, export, or import store data'
  static description = `Examples:

    COPY data from one store to another in your organization
    shopify store copy --from-store source.myshopify.com --to-store target.myshopify.com

    EXPORT store data to SQLite
    shopify store copy --from-store source.myshopify.com --to-file path/to/file.sqlite

    IMPORT data from SQLite to a store
    shopify store copy --from-file path/to/file.sqlite --to-store target.myshopify.com
`

  static hidden = true
  static flags = {
    ...storeFlags,
    ...fileFlags,
    ...resourceConfigFlags,
    ...commonFlags,
    ...globalFlags,
  }

  async runCommand(): Promise<void> {
    this.flags = (await this.parse(Copy)).flags as FlagOptions

    if (this.flags.key) {
      parseResourceConfigFlags(this.flags.key as string[])
    }

    // Check access for all organizations first
    const apiClient = this.flags.mock ? new MockApiClient() : new ApiClient()
    const bpSession = await apiClient.ensureAuthenticatedBusinessPlatform()

    const {'from-store': fromStore, 'to-store': toStore, 'from-file': fromFile} = this.flags
    let {'to-file': toFile} = this.flags
    const operationMode = this.determineOperationMode(fromStore, toStore, fromFile, toFile)

    if (!operationMode) {
      const Help = await loadHelpClass(this.config)
      await new Help(this.config).showHelp(['store:copy'])
      return
    }
    if (operationMode === OperationMode.StoreExport && !toFile) {
      const storeDomain = (fromStore as string).replace(/[^a-zA-Z0-9.-]/g, '_')
      toFile = joinPath(cwd(), `${storeDomain}-export-${Date.now()}.sqlite`)
    }

    const operation = this.getOperation(operationMode, bpSession, apiClient)
    const source = fromStore ?? fromFile
    const destination = toStore ?? toFile
    await operation.execute(source as string, destination as string, this.flags)
  }

  private getOperation(mode: OperationMode, bpSession: string, apiClient: ApiClient | MockApiClient) {
    switch (mode) {
      case OperationMode.StoreCopy:
        return new StoreCopyOperation(bpSession, apiClient)
      case OperationMode.StoreExport:
        return new StoreExportOperation(bpSession, apiClient)
      case OperationMode.StoreImport:
        return new StoreImportOperation(bpSession, apiClient)
      default:
        throw new Error(`Unknown operation mode: ${mode}`)
    }
  }

  private determineOperationMode(
    fromStore: unknown,
    toStore: unknown,
    fromFile: unknown,
    toFile: unknown,
  ): OperationMode | undefined {
    if (fromStore && toStore && !fromFile && !toFile) {
      return OperationMode.StoreCopy
    }

    if (fromStore && !toStore && !fromFile) {
      return OperationMode.StoreExport
    }

    if (fromFile && toStore && !fromStore && !toFile) {
      return OperationMode.StoreImport
    }
  }
}
