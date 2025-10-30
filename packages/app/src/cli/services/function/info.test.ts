import {functionInfo} from './info.js'
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

  describe('JSON format', () => {
    test('returns JSON string with function information', async () => {
      // Given
      const functionWithTargeting = await testFunctionExtension({
        dir: '/path/to/function',
        config: {
          name: 'My Function',
          type: 'function',
          handle: 'my-function',
          api_version: '2024-01',
          configuration_ui: true,
          targeting: [
            {
              target: 'purchase.payment-customization.run',
              input_query: 'query.graphql',
              export: 'run',
            },
          ],
        },
      })

      const options = {
        format: 'json' as const,
        functionRunnerPath: '/path/to/runner',
        schemaPath: '/path/to/schema.graphql',
      }

      // When
      const result = functionInfo(functionWithTargeting, options)

      // Then
      expect(typeof result).toBe('string')
      const parsed = JSON.parse(result as string)
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
        wasmPath: functionWithTargeting.outputPath,
        functionRunnerPath: '/path/to/runner',
      })
    })
  })

  describe('Text format', () => {
    test('returns AlertCustomSection array with configuration section', async () => {
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

      const configSection = result.find((section) => section.title?.includes('CONFIGURATION'))
      expect(configSection).toBeDefined()
      expect(configSection?.body).toHaveProperty('tabularData')
    })

    test('includes targeting section when targets are configured', async () => {
      // Given
      const functionWithTargeting = await testFunctionExtension({
        dir: '/path/to/function',
        config: {
          name: 'My Function',
          type: 'function',
          handle: 'my-function',
          api_version: '2024-01',
          configuration_ui: true,
          targeting: [
            {
              target: 'purchase.payment-customization.run',
              input_query: 'query.graphql',
              export: 'run',
            },
          ],
        },
      })

      const options = {
        format: 'text' as const,
        functionRunnerPath: '/path/to/runner',
        schemaPath: '/path/to/schema.graphql',
      }

      // When
      const result = functionInfo(functionWithTargeting, options) as AlertCustomSection[]

      // Then
      const targetingSection = result.find((section) => section.title?.includes('TARGETING'))
      expect(targetingSection).toBeDefined()
      expect(targetingSection?.body).toHaveProperty('tabularData')
    })

    test('excludes targeting section when no targets are configured', async () => {
      // Given
      const options = {
        format: 'text' as const,
        functionRunnerPath: '/path/to/runner',
        schemaPath: '/path/to/schema.graphql',
      }

      // When
      const result = functionInfo(ourFunction, options) as AlertCustomSection[]

      // Then
      const targetingSection = result.find((section) => section.title?.includes('TARGETING'))
      expect(targetingSection).toBeUndefined()
    })

    test('includes build section with schema and wasm paths', async () => {
      // Given
      const options = {
        format: 'text' as const,
        functionRunnerPath: '/path/to/runner',
        schemaPath: '/path/to/schema.graphql',
      }

      // When
      const result = functionInfo(ourFunction, options) as AlertCustomSection[]

      // Then
      const buildSection = result.find((section) => section.title?.includes('BUILD'))
      expect(buildSection).toBeDefined()
      expect(buildSection?.body).toHaveProperty('tabularData')
    })

    test('includes function runner section', async () => {
      // Given
      const options = {
        format: 'text' as const,
        functionRunnerPath: '/path/to/runner',
        schemaPath: '/path/to/schema.graphql',
      }

      // When
      const result = functionInfo(ourFunction, options) as AlertCustomSection[]

      // Then
      const runnerSection = result.find((section) => section.title?.includes('FUNCTION RUNNER'))
      expect(runnerSection).toBeDefined()
      expect(runnerSection?.body).toHaveProperty('tabularData')
    })

    test('targeting section includes target name, input query path, and export', async () => {
      // Given
      const functionWithTargeting = await testFunctionExtension({
        dir: '/path/to/function',
        config: {
          name: 'My Function',
          type: 'function',
          handle: 'my-function',
          api_version: '2024-01',
          configuration_ui: true,
          targeting: [
            {
              target: 'purchase.payment-customization.run',
              input_query: 'query.graphql',
              export: 'run',
            },
          ],
        },
      })

      const options = {
        format: 'text' as const,
        functionRunnerPath: '/path/to/runner',
        schemaPath: '/path/to/schema.graphql',
      }

      // When
      const result = functionInfo(functionWithTargeting, options) as AlertCustomSection[]

      // Then
      const targetingSection = result.find((section) => section.title?.includes('TARGETING'))
      const tabularData = (targetingSection?.body as {tabularData: unknown[][]}).tabularData

      expect(tabularData.length).toBeGreaterThan(0)
      // Should have rows for target name, input query path, and export
      expect(tabularData.length).toBe(3)
    })
  })
})
