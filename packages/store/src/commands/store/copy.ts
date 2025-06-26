import {BaseBDCommand} from '../../lib/base-command.js'
import {commonFlags, shopSelectionFlags, resourceConfigFlags} from '../../lib/flags.js'
import {OperationMode} from '../../services/store/types/operations.js'
import {isStoreIdentifier, isFileIdentifier} from '../../services/store/utils/validation.js'
import {StoreCopyOperation} from '../../services/store/operations/store-copy.js'
import {StoreExportOperation} from '../../services/store/operations/store-export.js'
import {StoreImportOperation} from '../../services/store/operations/store-import.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class Copy extends BaseBDCommand {
  static summary = 'Copy, export, or import store data'
  static description = 'Copy data between stores, export store data to SQLite, or import data from SQLite to a store'
  static hidden = true
  static flags = {
    ...shopSelectionFlags,
    ...resourceConfigFlags,
    ...commonFlags,
    ...globalFlags,
  }

  async runCommand(): Promise<void> {
    this.flags = (await this.parse(Copy)).flags

    const from = this.flags.from as string
    const to = this.flags.to as string

    if (!from && !to) {
      throw new Error('You must specify at least one of --from or --to flags')
    }

    const operationMode = this.determineOperationMode(from, to)

    const operation = this.getOperation(operationMode)
    await operation.execute(from, to, this.flags)
  }

  private getOperation(mode: OperationMode) {
    switch (mode) {
      case OperationMode.STORE_COPY:
        return new StoreCopyOperation()
      case OperationMode.STORE_EXPORT:
        return new StoreExportOperation()
      case OperationMode.STORE_IMPORT:
        return new StoreImportOperation()
      default:
        throw new Error(`Unknown operation mode: ${mode}`)
    }
  }

  private determineOperationMode(from: string, to: string | undefined): OperationMode {
    const isFromStore = from ? isStoreIdentifier(from) : false
    const isFromFile = from ? isFileIdentifier(from) : false
    const isToStore = to ? isStoreIdentifier(to) : false
    const isToFile = to ? isFileIdentifier(to) : false

    if (isFromStore && isToStore) {
      return OperationMode.STORE_COPY
    } else if (isFromStore && isToFile) {
      return OperationMode.STORE_EXPORT
    } else if (isFromFile && isToStore) {
      return OperationMode.STORE_IMPORT
    }

    throw new Error('Invalid combination of --from and --to flags')
  }
}
