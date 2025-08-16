import Copy from './index.js'
import {StoreCopyOperation} from '../../../services/store/operations/store-copy.js'
import {StoreExportOperation} from '../../../services/store/operations/store-export.js'
import {StoreImportOperation} from '../../../services/store/operations/store-import.js'
import {ApiClient} from '../../../services/store/api/api-client.js'
import {MockApiClient} from '../../../services/store/mock/mock-api-client.js'
import {describe, vi, expect, test, beforeEach} from 'vitest'
import {Config, loadHelpClass} from '@oclif/core'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../../services/store/operations/store-copy.js')
vi.mock('../../services/store/operations/store-export.js')
vi.mock('../../services/store/operations/store-import.js')
vi.mock('../../services/store/api/api-client.js')
vi.mock('../../services/store/mock/mock-api-client.js')
vi.mock('@oclif/core', async () => {
  const actual = await vi.importActual('@oclif/core')
  return {
    ...actual,
    loadHelpClass: vi.fn(),
  }
})

const CommandConfig = new Config({root: __dirname})

describe('Copy', () => {
  const mockExecute = vi.fn()
  const mockShowHelp = vi.fn()
  const mockOrganizations = [
    {
      id: 'gid://organization/1',
      name: 'Test Organization',
      shops: [
        {id: 'gid://shop/1', domain: 'source.myshopify.com', organizationId: 'gid://organization/1'},
        {id: 'gid://shop/2', domain: 'target.myshopify.com', organizationId: 'gid://organization/1'},
      ],
    },
  ]

  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit called')
    })

    // Mock loadHelpClass
    vi.mocked(loadHelpClass).mockResolvedValue(
      class MockHelp {
        showHelp = mockShowHelp
      } as any,
    )

    // Mock API Client
    vi.mocked(ApiClient).mockImplementation(
      () =>
        ({
          ensureAuthenticatedBusinessPlatform: vi.fn().mockResolvedValue('mock-session'),
        } as any),
    )

    vi.mocked(MockApiClient).mockImplementation(
      () =>
        ({
          ensureAuthenticatedBusinessPlatform: vi.fn().mockResolvedValue('mock-session'),
        } as any),
    )

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
      await run(['--from-store=source.myshopify.com', '--to-store=target.myshopify.com'])

      expect(StoreCopyOperation).toHaveBeenCalledTimes(1)
      expect(mockExecute).toHaveBeenCalledWith('source.myshopify.com', 'target.myshopify.com', expect.any(Object))
    })

    test('should instantiate StoreExportOperation for store-to-file export', async () => {
      await run(['--from-store=source.myshopify.com', '--to-file=output.sqlite'])

      expect(StoreExportOperation).toHaveBeenCalledTimes(1)
      expect(mockExecute).toHaveBeenCalledWith('source.myshopify.com', 'output.sqlite', expect.any(Object))
    })

    test('should auto-generate to-file path when exporting without to-file parameter', async () => {
      const mockDate = new Date('2024-01-01T12:00:00Z')
      vi.spyOn(Date, 'now').mockReturnValue(mockDate.getTime())

      await run(['--from-store=source.myshopify.com'])

      expect(StoreExportOperation).toHaveBeenCalledTimes(1)
      expect(mockExecute).toHaveBeenCalledWith(
        'source.myshopify.com',
        expect.stringContaining('source.myshopify.com-export-1704110400000.sqlite'),
        expect.any(Object),
      )
    })

    test('should sanitize domain name when auto-generating to-file path', async () => {
      const mockDate = new Date('2024-01-01T12:00:00Z')
      vi.spyOn(Date, 'now').mockReturnValue(mockDate.getTime())

      await run(['--from-store=test@store!.myshopify.com'])

      expect(StoreExportOperation).toHaveBeenCalledTimes(1)
      expect(mockExecute).toHaveBeenCalledWith(
        'test@store!.myshopify.com',
        expect.stringContaining('test_store_.myshopify.com-export-1704110400000.sqlite'),
        expect.any(Object),
      )
    })

    test('should instantiate StoreImportOperation for file-to-store import', async () => {
      await run(['--from-file=input.sqlite', '--to-store=target.myshopify.com'])

      expect(StoreImportOperation).toHaveBeenCalledTimes(1)
      expect(mockExecute).toHaveBeenCalledWith('input.sqlite', 'target.myshopify.com', expect.any(Object))
    })

    test('should auto-generate to-file for export when only from-store is provided', async () => {
      await run(['--from-store=source.myshopify.com'])

      expect(StoreExportOperation).toHaveBeenCalledTimes(1)
      expect(mockExecute).toHaveBeenCalledWith(
        'source.myshopify.com',
        expect.stringContaining('-export-'),
        expect.any(Object),
      )
    })

    test('should show help when invalid flag combination', async () => {
      await run(['--to-file=output.sqlite'])

      expect(loadHelpClass).toHaveBeenCalledWith(expect.any(Object))
      expect(mockShowHelp).toHaveBeenCalledWith(['store:copy'])
      expect(StoreCopyOperation).not.toHaveBeenCalled()
      expect(StoreExportOperation).not.toHaveBeenCalled()
      expect(StoreImportOperation).not.toHaveBeenCalled()
    })

    test('should show help when no flags provided', async () => {
      await run([])

      expect(loadHelpClass).toHaveBeenCalledWith(expect.any(Object))
      expect(mockShowHelp).toHaveBeenCalledWith(['store:copy'])
      expect(StoreCopyOperation).not.toHaveBeenCalled()
      expect(StoreExportOperation).not.toHaveBeenCalled()
      expect(StoreImportOperation).not.toHaveBeenCalled()
    })

    test('should show help when mixing store and file flags', async () => {
      await run(['--from-store=source.myshopify.com', '--from-file=input.sqlite', '--to-store=target.myshopify.com'])

      expect(loadHelpClass).toHaveBeenCalledWith(expect.any(Object))
      expect(mockShowHelp).toHaveBeenCalledWith(['store:copy'])
      expect(StoreCopyOperation).not.toHaveBeenCalled()
      expect(StoreExportOperation).not.toHaveBeenCalled()
      expect(StoreImportOperation).not.toHaveBeenCalled()
    })

    test('should pass flags to the operation', async () => {
      await run(['--from-store=source.myshopify.com', '--to-store=target.myshopify.com', '--no-prompt', '--mock'])

      expect(mockExecute).toHaveBeenCalledWith(
        'source.myshopify.com',
        'target.myshopify.com',
        expect.objectContaining({
          'no-prompt': true,
          mock: true,
        }),
      )
    })
  })
})
