import Copy from './copy.js'
import {StoreCopyOperation} from '../../services/store/operations/store-copy.js'
import {StoreExportOperation} from '../../services/store/operations/store-export.js'
import {StoreImportOperation} from '../../services/store/operations/store-import.js'
import {describe, vi, expect, test, beforeEach} from 'vitest'
import {Config} from '@oclif/core'
import {renderError} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../../services/store/operations/store-copy.js')
vi.mock('../../services/store/operations/store-export.js')
vi.mock('../../services/store/operations/store-import.js')

const CommandConfig = new Config({root: __dirname})

describe('Copy', () => {
  const mockExecute = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit called')
    })
    
    // Mock all operations with the same execute function
    vi.mocked(StoreCopyOperation).mockImplementation(() => ({
      execute: mockExecute,
      fromArg: undefined,
      toArg: undefined,
    }) as any)
    
    vi.mocked(StoreExportOperation).mockImplementation(() => ({
      execute: mockExecute,
      fromArg: undefined,
    }) as any)
    
    vi.mocked(StoreImportOperation).mockImplementation(() => ({
      execute: mockExecute,
      fromArg: undefined,
      toArg: undefined,
    }) as any)
  })

  describe('run', () => {
    async function run(argv: string[]) {
      await CommandConfig.load()
      const copy = new Copy(argv, CommandConfig)
      await copy.run()
    }

    test('should instantiate StoreCopyOperation for store-to-store copy', async () => {
      await run(['--fromStore=source.myshopify.com', '--toStore=target.myshopify.com'])

      expect(StoreCopyOperation).toHaveBeenCalledTimes(1)
      expect(mockExecute).toHaveBeenCalledWith('source.myshopify.com', 'target.myshopify.com', expect.any(Object))
    })

    test('should instantiate StoreExportOperation for store-to-file export', async () => {
      await run(['--fromStore=source.myshopify.com', '--toFile=output.sqlite'])

      expect(StoreExportOperation).toHaveBeenCalledTimes(1)
      expect(mockExecute).toHaveBeenCalledWith('source.myshopify.com', 'output.sqlite', expect.any(Object))
    })

    test('should instantiate StoreImportOperation for file-to-store import', async () => {
      await run(['--fromFile=input.sqlite', '--toStore=target.myshopify.com'])

      expect(StoreImportOperation).toHaveBeenCalledTimes(1)
      expect(mockExecute).toHaveBeenCalledWith('input.sqlite', 'target.myshopify.com', expect.any(Object))
    })

    test('should throw error when invalid flag combination', async () => {
      await run(['--fromStore=source.myshopify.com'])
      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Invalid flag combination. Valid operations are: copy (--fromStore --toStore), export (--fromStore --toFile), or import (--fromFile --toStore)',
      })
    })

    test('should throw error when no flags provided', async () => {
      await run([])
      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Invalid flag combination. Valid operations are: copy (--fromStore --toStore), export (--fromStore --toFile), or import (--fromFile --toStore)',
      })
    })

    test('should throw error when mixing store and file flags', async () => {
      await run(['--fromStore=source.myshopify.com', '--fromFile=input.sqlite', '--toStore=target.myshopify.com'])
      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Invalid flag combination. Valid operations are: copy (--fromStore --toStore), export (--fromStore --toFile), or import (--fromFile --toStore)',
      })
    })

    test('should pass flags to the operation', async () => {
      await run(['--fromStore=source.myshopify.com', '--toStore=target.myshopify.com', '--skipConfirmation', '--mock'])

      expect(mockExecute).toHaveBeenCalledWith(
        'source.myshopify.com', 
        'target.myshopify.com', 
        expect.objectContaining({
          skipConfirmation: true,
          mock: true,
        })
      )
    })
  })
})