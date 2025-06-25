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
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit called')
    })

    vi.mocked(StoreCopyOperation).mockImplementation(
      () =>
        ({
          execute: mockExecute,
          fromArg: undefined,
          toArg: undefined,
        } as any),
    )

    vi.mocked(StoreExportOperation).mockImplementation(
      () =>
        ({
          execute: mockExecute,
          fromArg: undefined,
        } as any),
    )

    vi.mocked(StoreImportOperation).mockImplementation(
      () =>
        ({
          execute: mockExecute,
          fromArg: undefined,
          toArg: undefined,
        } as any),
    )
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

    test('should auto-generate toFile path when exporting without toFile parameter', async () => {
      const mockDate = new Date('2024-01-01T12:00:00Z')
      vi.spyOn(Date, 'now').mockReturnValue(mockDate.getTime())

      await run(['--fromStore=source.myshopify.com'])

      expect(StoreExportOperation).toHaveBeenCalledTimes(1)
      expect(mockExecute).toHaveBeenCalledWith(
        'source.myshopify.com',
        expect.stringContaining('source.myshopify.com-export-1704110400000.sqlite'),
        expect.any(Object),
      )
    })

    test('should sanitize domain name when auto-generating toFile path', async () => {
      const mockDate = new Date('2024-01-01T12:00:00Z')
      vi.spyOn(Date, 'now').mockReturnValue(mockDate.getTime())

      await run(['--fromStore=test@store!.myshopify.com'])

      expect(StoreExportOperation).toHaveBeenCalledTimes(1)
      expect(mockExecute).toHaveBeenCalledWith(
        'test@store!.myshopify.com',
        expect.stringContaining('test_store_.myshopify.com-export-1704110400000.sqlite'),
        expect.any(Object),
      )
    })

    test('should instantiate StoreImportOperation for file-to-store import', async () => {
      await run(['--fromFile=input.sqlite', '--toStore=target.myshopify.com'])

      expect(StoreImportOperation).toHaveBeenCalledTimes(1)
      expect(mockExecute).toHaveBeenCalledWith('input.sqlite', 'target.myshopify.com', expect.any(Object))
    })

    test('should auto-generate toFile for export when only fromStore is provided', async () => {
      await run(['--fromStore=source.myshopify.com'])

      expect(StoreExportOperation).toHaveBeenCalledTimes(1)
      expect(mockExecute).toHaveBeenCalledWith(
        'source.myshopify.com',
        expect.stringContaining('-export-'),
        expect.any(Object),
      )
    })

    test('should throw error when invalid flag combination', async () => {
      await expect(run(['--toFile=output.sqlite'])).rejects.toThrow('Process exit called')
      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Invalid flag combination. Valid operations are: copy (--fromStore --toStore), export (--fromStore --toFile), or import (--fromFile --toStore)',
      })
      expect(process.exit).toHaveBeenCalledWith(1)
    })

    test('should throw error when no flags provided', async () => {
      await expect(run([])).rejects.toThrow('Process exit called')
      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Invalid flag combination. Valid operations are: copy (--fromStore --toStore), export (--fromStore --toFile), or import (--fromFile --toStore)',
      })
      expect(process.exit).toHaveBeenCalledWith(1)
    })

    test('should throw error when mixing store and file flags', async () => {
      await expect(
        run(['--fromStore=source.myshopify.com', '--fromFile=input.sqlite', '--toStore=target.myshopify.com']),
      ).rejects.toThrow('Process exit called')
      expect(renderError).toHaveBeenCalledWith({
        headline: 'Operation failed',
        body: 'Invalid flag combination. Valid operations are: copy (--fromStore --toStore), export (--fromStore --toFile), or import (--fromFile --toStore)',
      })
      expect(process.exit).toHaveBeenCalledWith(1)
    })

    test('should pass flags to the operation', async () => {
      await run(['--fromStore=source.myshopify.com', '--toStore=target.myshopify.com', '--no-prompt', '--mock'])

      expect(mockExecute).toHaveBeenCalledWith(
        'source.myshopify.com',
        'target.myshopify.com',
        expect.objectContaining({
          'no-prompt': true,
          mock: true,
        }),
      )
    })

    test('should pass mock flag to export operation', async () => {
      await run(['--fromStore=source.myshopify.com', '--toFile=output.sqlite', '--mock'])

      expect(StoreExportOperation).toHaveBeenCalledTimes(1)
      expect(mockExecute).toHaveBeenCalledWith(
        'source.myshopify.com',
        'output.sqlite',
        expect.objectContaining({
          mock: true,
        }),
      )
    })

    test('should pass mock flag to import operation', async () => {
      await run(['--fromFile=input.sqlite', '--toStore=target.myshopify.com', '--mock'])

      expect(StoreImportOperation).toHaveBeenCalledTimes(1)
      expect(mockExecute).toHaveBeenCalledWith(
        'input.sqlite',
        'target.myshopify.com',
        expect.objectContaining({
          mock: true,
        }),
      )
    })
  })
})
