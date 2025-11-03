import {
  functionInfo,
  buildTargetingData,
  formatAsJson,
  buildConfigurationSection,
  buildTargetingSection,
  buildBuildSection,
  buildFunctionRunnerSection,
  buildTextFormatSections,
} from './info.js'
import {testFunctionExtension} from '../../models/app/app.test-data.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {describe, expect, test, beforeEach} from 'vitest'
import {AlertCustomSection} from '@shopify/cli-kit/node/ui'

describe('functionInfo', () => {
  let ourFunction: ExtensionInstance

  beforeEach(async () => {
    ourFunction = await testFunctionExtension({
      dir: '/path/to/function',
      config: {
        name: 'My Function',
        type: 'function',
        handle: 'my-function',
        api_version: '2024-01',
        configuration_ui: false,
      },
    })
  })

  describe('functionInfo integration', () => {
    test('returns JSON string when format is json', async () => {
      // Given
      const options = {
        format: 'json' as const,
        functionRunnerPath: '/path/to/runner',
        schemaPath: '/path/to/schema.graphql',
      }

      // When
      const result = functionInfo(ourFunction, options)

      // Then
      expect(typeof result).toBe('string')
      const parsed = JSON.parse(result as string)
      expect(parsed).toHaveProperty('handle')
      expect(parsed).toHaveProperty('name')
      expect(parsed).toHaveProperty('apiVersion')
    })

    test('returns AlertCustomSection array when format is text', async () => {
      // Given
      const options = {
        format: 'text' as const,
        functionRunnerPath: '/path/to/runner',
        schemaPath: '/path/to/schema.graphql',
      }

      // When
      const result = functionInfo(ourFunction, options) as AlertCustomSection[]

      // Then
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('buildTargetingData', () => {
    test('transforms targeting configuration with multiple targets', () => {
      // Given
      const config = {
        handle: 'test',
        targeting: [
          {
            target: 'purchase.payment-customization.run',
            input_query: 'query1.graphql',
            export: 'run',
          },
          {
            target: 'purchase.checkout.delivery-customization.run',
            input_query: 'query2.graphql',
            export: 'customize',
          },
        ],
      }

      // When
      const result = buildTargetingData(config, '/path/to/function')

      // Then
      expect(result).toEqual({
        'purchase.payment-customization.run': {
          inputQueryPath: '/path/to/function/query1.graphql',
          export: 'run',
        },
        'purchase.checkout.delivery-customization.run': {
          inputQueryPath: '/path/to/function/query2.graphql',
          export: 'customize',
        },
      })
    })

    test('handles targets without input_query', () => {
      // Given
      const config = {
        handle: 'test',
        targeting: [
          {
            target: 'purchase.payment-customization.run',
            export: 'run',
          },
        ],
      }

      // When
      const result = buildTargetingData(config, '/path/to/function')

      // Then
      expect(result).toEqual({
        'purchase.payment-customization.run': {
          export: 'run',
        },
      })
    })

    test('handles targets without export', () => {
      // Given
      const config = {
        handle: 'test',
        targeting: [
          {
            target: 'purchase.payment-customization.run',
            input_query: 'query.graphql',
          },
        ],
      }

      // When
      const result = buildTargetingData(config, '/path/to/function')

      // Then
      expect(result).toEqual({
        'purchase.payment-customization.run': {
          inputQueryPath: '/path/to/function/query.graphql',
        },
      })
    })
  })

  describe('formatAsJson', () => {
    test('returns correctly formatted JSON string', async () => {
      // Given
      const testFunc = await testFunctionExtension({
        dir: '/path/to/function',
        config: {
          name: 'My Function',
          type: 'function',
          handle: 'my-function',
          api_version: '2024-01',
          configuration_ui: false,
        },
      })
      const config = {
        handle: 'my-function',
        name: 'My Function',
        api_version: '2024-01',
      }
      const targeting = {
        'purchase.payment-customization.run': {
          inputQueryPath: '/path/to/function/query.graphql',
          export: 'run',
        },
      }

      // When
      const result = formatAsJson(testFunc, config, targeting, '/path/to/runner', '/path/to/schema.graphql')

      // Then
      const parsed = JSON.parse(result)
      expect(parsed).toEqual({
        handle: 'my-function',
        name: 'My Function',
        apiVersion: '2024-01',
        targeting: {
          'purchase.payment-customization.run': {
            inputQueryPath: '/path/to/function/query.graphql',
            export: 'run',
          },
        },
        schemaPath: '/path/to/schema.graphql',
        wasmPath: testFunc.outputPath,
        functionRunnerPath: '/path/to/runner',
      })
    })

    test('handles missing optional fields', async () => {
      // Given
      const testFunc = await testFunctionExtension({
        dir: '/path/to/function',
        config: {
          name: 'My Function',
          type: 'function',
          api_version: '2024-01',
          configuration_ui: false,
        },
      })
      const config = {}
      const targeting = {}

      // When
      const result = formatAsJson(testFunc, config, targeting, '/path/to/runner')

      // Then
      const parsed = JSON.parse(result)
      expect(parsed.handle).toBeUndefined()
      expect(parsed.schemaPath).toBeUndefined()
      expect(parsed.targeting).toEqual({})
    })
  })

  describe('buildConfigurationSection', () => {
    test('builds configuration section with all fields', () => {
      // Given
      const config = {
        handle: 'my-function',
        name: 'My Function',
        api_version: '2024-01',
      }

      // When
      const result = buildConfigurationSection(config, 'My Function')

      // Then
      expect(result.title).toBe('CONFIGURATION\n')
      expect(result.body).toHaveProperty('tabularData')
      expect(result.body).toHaveProperty('firstColumnSubdued', true)
      expect((result.body as {tabularData: unknown[][]}).tabularData).toEqual([
        ['Handle', 'my-function'],
        ['Name', 'My Function'],
        ['API Version', '2024-01'],
      ])
    })

    test('uses N/A for missing fields', () => {
      // Given
      const config = {}

      // When
      const result = buildConfigurationSection(config, undefined as unknown as string)

      // Then
      expect((result.body as {tabularData: unknown[][]}).tabularData).toEqual([
        ['Handle', 'N/A'],
        ['Name', 'N/A'],
        ['API Version', 'N/A'],
      ])
    })
  })

  describe('buildTargetingSection', () => {
    test('builds targeting section with multiple targets', () => {
      // Given
      const targeting = {
        'purchase.payment-customization.run': {
          inputQueryPath: '/path/to/function/query1.graphql',
          export: 'run',
        },
        'purchase.checkout.delivery-customization.run': {
          inputQueryPath: '/path/to/function/query2.graphql',
          export: 'customize',
        },
      }

      // When
      const result = buildTargetingSection(targeting)

      // Then
      expect(result).not.toBeNull()
      expect(result?.title).toBe('\nTARGETING\n')
      const tabularData = (result?.body as {tabularData: unknown[][]})?.tabularData
      // 2 targets × 3 rows each
      expect(tabularData?.length).toBe(6)
    })
  })

  describe('buildBuildSection', () => {
    test('builds build section with schema and wasm paths', () => {
      // Given
      const wasmPath = '/path/to/function.wasm'
      const schemaPath = '/path/to/schema.graphql'

      // When
      const result = buildBuildSection(wasmPath, schemaPath)

      // Then
      expect(result.title).toBe('\nBUILD\n')
      expect(result.body).toHaveProperty('tabularData')
      expect(result.body).toHaveProperty('firstColumnSubdued', true)
      expect((result.body as {tabularData: unknown[][]}).tabularData).toEqual([
        ['Schema Path', {filePath: schemaPath}],
        ['Wasm Path', {filePath: wasmPath}],
      ])
    })

    test('uses N/A for missing schema path', () => {
      // Given
      const wasmPath = '/path/to/function.wasm'

      // When
      const result = buildBuildSection(wasmPath)

      // Then
      expect((result.body as {tabularData: unknown[][]}).tabularData).toEqual([
        ['Schema Path', {filePath: 'N/A'}],
        ['Wasm Path', {filePath: wasmPath}],
      ])
    })
  })

  describe('buildFunctionRunnerSection', () => {
    test('builds function runner section', () => {
      // Given
      const functionRunnerPath = '/path/to/runner'

      // When
      const result = buildFunctionRunnerSection(functionRunnerPath)

      // Then
      expect(result.title).toBe('\nFUNCTION RUNNER\n')
      expect(result.body).toHaveProperty('tabularData')
      expect(result.body).toHaveProperty('firstColumnSubdued', true)
      expect((result.body as {tabularData: unknown[][]}).tabularData).toEqual([
        ['Path', {filePath: functionRunnerPath}],
      ])
    })
  })

  describe('buildTextFormatSections', () => {
    test('includes all sections when targeting is present', async () => {
      // Given
      const testFunc = await testFunctionExtension({
        dir: '/path/to/function',
        config: {
          name: 'My Function',
          type: 'function',
          handle: 'my-function',
          api_version: '2024-01',
          configuration_ui: false,
        },
      })
      const config = {
        handle: 'my-function',
        name: 'My Function',
        api_version: '2024-01',
      }
      const targeting = {
        'purchase.payment-customization.run': {
          inputQueryPath: '/path/to/function/query.graphql',
          export: 'run',
        },
      }

      // When
      const result = buildTextFormatSections(testFunc, config, targeting, '/path/to/runner', '/path/to/schema.graphql')

      // Then
      // configuration, targeting, build, function runner
      expect(result.length).toBe(4)
      expect(result[0]?.title).toContain('CONFIGURATION')
      expect(result[1]?.title).toContain('TARGETING')
      expect(result[2]?.title).toContain('BUILD')
      expect(result[3]?.title).toContain('FUNCTION RUNNER')
    })
  })
})
