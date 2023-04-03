import {generateSchemaService} from './generate-schema.js'
import * as localEnvironment from './context.js'
import * as identifiers from '../models/app/identifiers.js'
import {testApp, testFunctionExtension} from '../models/app/app.test-data.js'
import {ApiSchemaDefinitionQuery} from '../api/graphql/functions/api_schema_definition.js'
import {beforeEach, describe, expect, MockedFunction, vi, test} from 'vitest'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {isTerminalInteractive} from '@shopify/cli-kit/node/context/local'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('@shopify/cli-kit/node/api/partners')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/context/local')

vi.mock('../models/app/identifiers.js', async () => {
  const identifiers: any = await vi.importActual('../models/app/identifiers.js')
  return {
    ...identifiers,
    getAppIdentifiers: vi.fn(),
  }
})
vi.mock('./context.js', async () => {
  const context: any = await vi.importActual('./context.js')
  return {
    ...context,
    fetchOrCreateOrganizationApp: vi.fn(),
  }
})

describe('generateSchemaService', () => {
  const token = 'token'
  const request = partnersRequest as MockedFunction<typeof partnersRequest>

  beforeEach(() => {
    vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
    request.mockImplementation(() => Promise.resolve({definition: 'schema'}))
  })

  test('performs GraphQL query to fetch the schema', async () => {
    // Given
    const app = testApp()
    const extension = await testFunctionExtension()
    const apiKey = 'api-key'

    // When
    const result = await generateSchemaService({app, extension, apiKey})

    // Then
    expect(result).toBe('schema')
  })

  test('aborts if a schema could not be generated', async () => {
    // Given
    const app = testApp()
    const extension = await testFunctionExtension()
    const apiKey = 'api-key'
    request.mockImplementation(() => Promise.resolve({definition: null}))

    // When
    const result = generateSchemaService({app, extension, apiKey})

    // Then
    await expect(result).rejects.toThrow(AbortError)
  })

  describe('API key', () => {
    const apiKey = 'api-key'
    const identifiersApiKey = 'identifier-api-key'
    const promptApiKey = 'prompt-api-key'

    const getAppIdentifiers = identifiers.getAppIdentifiers as MockedFunction<typeof identifiers.getAppIdentifiers>
    const fetchOrCreateOrganizationApp = localEnvironment.fetchOrCreateOrganizationApp as MockedFunction<
      typeof localEnvironment.fetchOrCreateOrganizationApp
    >

    beforeEach(async () => {
      getAppIdentifiers.mockReturnValue({app: identifiersApiKey})
      fetchOrCreateOrganizationApp.mockResolvedValue({
        id: 'id',
        title: 'title',
        apiKey: promptApiKey,
        organizationId: '1',
        apiSecretKeys: [],
        grantedScopes: [],
      })
      vi.mocked(isTerminalInteractive).mockReturnValue(true)
    })

    test('uses options API key if provided', async () => {
      // Given
      const app = testApp()
      const extension = await testFunctionExtension()
      const {
        configuration: {apiVersion: version},
        type,
      } = extension

      // When
      await generateSchemaService({app, extension, apiKey})

      // Then
      expect(request).toHaveBeenCalledWith(ApiSchemaDefinitionQuery, token, {
        apiKey,
        version,
        type,
      })
    })

    test('uses app identifier API key, if options API key is not provided', async () => {
      // Given
      const app = testApp()
      const extension = await testFunctionExtension()
      const {
        configuration: {apiVersion: version},
        type,
      } = extension

      // When
      await generateSchemaService({app, extension})

      // Then
      expect(request).toHaveBeenCalledWith(ApiSchemaDefinitionQuery, token, {
        apiKey: identifiersApiKey,
        version,
        type,
      })
    })

    test('prompts for app if no API key is provided in interactive mode', async () => {
      // Given
      const app = testApp()
      const extension = await testFunctionExtension()
      const {
        configuration: {apiVersion: version},
        type,
      } = extension
      getAppIdentifiers.mockReturnValue({app: undefined})

      // When
      await generateSchemaService({app, extension})

      // Then
      expect(request).toHaveBeenCalledWith(ApiSchemaDefinitionQuery, token, {
        apiKey: promptApiKey,
        version,
        type,
      })
    })

    test('aborts if no API key is provided in non-interactive mode', async () => {
      // Given
      const app = testApp()
      const extension = await testFunctionExtension()
      getAppIdentifiers.mockReturnValue({app: undefined})
      vi.mocked(isTerminalInteractive).mockReturnValue(false)

      // When
      const result = generateSchemaService({app, extension})

      await expect(result).rejects.toThrow()
      expect(request).not.toHaveBeenCalled()
    })
  })
})
