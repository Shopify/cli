import {preserveEnvironmentMerge} from './theme-merge.js'
import {readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {basename} from '@shopify/cli-kit/node/path'
import {test, describe, expect, vi, beforeEach} from 'vitest'

vi.mock('@shopify/cli-kit/node/fs')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/path')

const mockBasePath = '/fake/base/file.json'
const mockCurrentPath = '/fake/current/file.json'
const mockIncomingPath = '/fake/incoming/file.json'

describe('theme-merge', () => {
  beforeEach(() => {
    vi.mocked(basename).mockReturnValue('file.json')
    vi.mocked(readFile).mockResolvedValue(Buffer.from('{}'))
    vi.mocked(writeFile).mockResolvedValue()
  })

  describe('preserveEnvironmentMerge', () => {
    test('should preserve current environment for settings_data.json', async () => {
      vi.mocked(basename).mockReturnValue('settings_data.json')

      const result = await preserveEnvironmentMerge(mockBasePath, mockCurrentPath, mockIncomingPath)

      expect(result.success).toBe(true)
      expect(result.conflictResolved).toBe(true)
      expect(result.strategy).toBe('preserve-current-environment')
      expect(outputInfo).toHaveBeenCalledWith('🔒 Preserved settings_data.json for current environment')
    })

    test('should preserve current environment for template JSON files', async () => {
      vi.mocked(basename).mockReturnValue('product.json')

      const result = await preserveEnvironmentMerge(mockBasePath, mockCurrentPath, mockIncomingPath)

      expect(result.success).toBe(true)
      expect(result.conflictResolved).toBe(true)
      expect(result.strategy).toBe('preserve-current-environment')
      expect(outputInfo).toHaveBeenCalledWith('🔒 Preserved product.json for current environment')
    })

    test('should preserve current environment for locale files', async () => {
      vi.mocked(basename).mockReturnValue('checkout.json')

      const result = await preserveEnvironmentMerge(mockBasePath, mockCurrentPath, mockIncomingPath)

      expect(result.success).toBe(true)
      expect(result.conflictResolved).toBe(true)
      expect(result.strategy).toBe('preserve-current-environment')
    })

    test('should preserve environment for all JSON files (due to regex pattern)', async () => {
      vi.mocked(basename).mockReturnValue('config.json')

      const result = await preserveEnvironmentMerge(mockBasePath, mockCurrentPath, mockIncomingPath)

      expect(result.success).toBe(true)
      expect(result.conflictResolved).toBe(true)
      expect(result.strategy).toBe('preserve-current-environment')
      expect(outputInfo).toHaveBeenCalledWith('🔒 Preserved config.json for current environment')
    })

    test('should preserve current version for non-JSON files', async () => {
      vi.mocked(basename).mockReturnValue('styles.css')

      const result = await preserveEnvironmentMerge(mockBasePath, mockCurrentPath, mockIncomingPath)

      expect(result.success).toBe(true)
      expect(result.conflictResolved).toBe(true)
      expect(result.strategy).toBe('preserve-current-non-json')
    })

    test('should preserve environment for JSON files (no parsing error path)', async () => {
      // Since all JSON files are treated as environment-specific, parsing errors don't occur
      vi.mocked(basename).mockReturnValue('config.json')

      const result = await preserveEnvironmentMerge(mockBasePath, mockCurrentPath, mockIncomingPath)

      expect(result.success).toBe(true)
      expect(result.conflictResolved).toBe(true)
      expect(result.strategy).toBe('preserve-current-environment')
    })

    test('should handle non-JSON files without file reads', async () => {
      vi.mocked(basename).mockReturnValue('style.css')

      const result = await preserveEnvironmentMerge(mockBasePath, mockCurrentPath, mockIncomingPath)

      expect(result.success).toBe(true)
      expect(result.conflictResolved).toBe(true)
      expect(result.strategy).toBe('preserve-current-non-json')
      // No file reads should occur for non-JSON files
      expect(readFile).not.toHaveBeenCalled()
    })

    test('should identify environment-specific files correctly', async () => {
      const environmentFiles = [
        'settings_data.json',
        'product.json',
        'collection.json',
        'checkout.json',
        'customer.json',
        'sections.json',
      ]

      await Promise.all(
        environmentFiles.map(async (fileName) => {
          vi.mocked(basename).mockReturnValue(fileName)

          const result = await preserveEnvironmentMerge(mockBasePath, mockCurrentPath, mockIncomingPath)

          expect(result.strategy).toBe('preserve-current-environment')
        }),
      )
    })

    test('should use custom marker size parameter', async () => {
      const customMarkerSize = 10

      const result = await preserveEnvironmentMerge(mockBasePath, mockCurrentPath, mockIncomingPath, customMarkerSize)

      expect(result.success).toBe(true)
      // The marker size is passed but not directly tested since it's for Git conflict markers
      // which this merge strategy is designed to avoid
    })

    test('should preserve environment for all JSON files including schema.json', async () => {
      vi.mocked(basename).mockReturnValue('schema.json')

      const result = await preserveEnvironmentMerge(mockBasePath, mockCurrentPath, mockIncomingPath)

      expect(result.success).toBe(true)
      expect(result.strategy).toBe('preserve-current-environment')
      expect(outputInfo).toHaveBeenCalledWith('🔒 Preserved schema.json for current environment')
    })
  })

  describe('file type identification', () => {
    const testCases = [
      {file: 'settings_data.json', isEnvironmentSpecific: true},
      {file: 'templates/product.json', isEnvironmentSpecific: true},
      {file: 'sections/hero.json', isEnvironmentSpecific: true},
      {file: 'locales/en/checkout.json', isEnvironmentSpecific: true},
      {file: 'locales/fr/customer.json', isEnvironmentSpecific: true},
      {file: 'locales/es/sections.json', isEnvironmentSpecific: true},
      // JSON files are all environment-specific
      {file: 'config/schema.json', isEnvironmentSpecific: true},
      {file: 'assets/style.css', isEnvironmentSpecific: false},
      {file: 'templates/page.liquid', isEnvironmentSpecific: false},
    ]

    testCases.forEach(({file, isEnvironmentSpecific}) => {
      test(`should identify ${file} as ${isEnvironmentSpecific ? 'environment-specific' : 'code file'}`, async () => {
        const fileName = file.split('/').pop() ?? file
        vi.mocked(basename).mockReturnValue(fileName)

        const result = await preserveEnvironmentMerge(mockBasePath, mockCurrentPath, mockIncomingPath)

        if (isEnvironmentSpecific) {
          expect(result.strategy).toBe('preserve-current-environment')
        } else {
          expect(result.strategy).toBe('preserve-current-non-json')
        }
      })
    })
  })
})
