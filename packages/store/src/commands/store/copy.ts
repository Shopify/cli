import {BaseBDCommand} from '../../lib/base-command.js'
import {commonFlags, storeFlags, fileFlags, resourceConfigFlags} from '../../lib/flags.js'
import {OperationMode} from '../../services/store/types/operations.js'
import {StoreCopyOperation} from '../../services/store/operations/store-copy.js'
import {StoreExportOperation} from '../../services/store/operations/store-export.js'
import {StoreImportOperation} from '../../services/store/operations/store-import.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'

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

    const {fromStore, toStore, fromFile, toFile} = this.flags

    const operationMode = this.determineOperationMode(fromStore, toStore, fromFile, toFile)

    const operation = this.getOperation(operationMode)

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

  private getOperation(mode: OperationMode) {
    switch (mode) {
      case OperationMode.StoreCopy:
        return new StoreCopyOperation()
      case OperationMode.StoreExport:
        return new StoreExportOperation()
      case OperationMode.StoreImport:
        return new StoreImportOperation()
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

    if (fromStore && toFile && !fromFile && !toStore) {
      return OperationMode.StoreExport
    }

    if (fromFile && toStore && !fromStore && !toFile) {
      return OperationMode.StoreImport
    }

    throw new Error(
      'Invalid flag combination. Valid operations are: copy (--fromStore --toStore), export (--fromStore --toFile), or import (--fromFile --toStore)',
    )
  }
}
