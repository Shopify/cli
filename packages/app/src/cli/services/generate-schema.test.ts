import {generateSchemaService} from './generate-schema.js'
import * as localEnvironment from './environment.js'
import * as identifiers from '../models/app/identifiers.js'
import {testApp, testFunctionExtension} from '../models/app/app.test-data.js'
import {ApiSchemaDefinitionQuery} from '../api/graphql/functions/api_schema_definition.js'
import {beforeEach, describe, expect, it, MockedFunction, vi} from 'vitest'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {isTerminalInteractive} from '@shopify/cli-kit/node/environment/local'
import {AbortError} from '@shopify/cli-kit/node/error'

describe('generateSchemaService', () => {
  const token = 'token'
  const request = partnersRequest as MockedFunction<typeof partnersRequest>

  beforeEach(() => {
    vi.mock('@shopify/cli-kit/node/api/partners')
    vi.mock('@shopify/cli-kit/node/session')
    vi.mocked(ensureAuthenticatedPartners).mockResolvedValue('token')
    vi.mock('@shopify/cli-kit/node/environment/local')
    request.mockImplementation(() => Promise.resolve({definition: 'schema'}))
  })

  it('performs GraphQL query to fetch the schema', async () => {
    // Given
    const app = testApp()
    const extension = await testFunctionExtension()
    const apiKey = 'api-key'

    // When
    const result = await generateSchemaService({app, extension, apiKey})

    // Then
    expect(result).toBe('schema')
  })

  it('aborts if a schema could not be generated', async () => {
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
    const fetchOrganizationAndFetchOrCreateApp =
      localEnvironment.fetchOrganizationAndFetchOrCreateApp as MockedFunction<
        typeof localEnvironment.fetchOrganizationAndFetchOrCreateApp
      >

    beforeEach(async () => {
      vi.mock('../models/app/identifiers.js', async () => {
        const identifiers: any = await vi.importActual('../models/app/identifiers.js')
        return {
          ...identifiers,
          getAppIdentifiers: vi.fn(),
        }
      })
      vi.mock('./environment.js', async () => {
        const environment: any = await vi.importActual('./environment.js')
        return {
          ...environment,
          fetchOrganizationAndFetchOrCreateApp: vi.fn(),
        }
      })
      getAppIdentifiers.mockReturnValue({app: identifiersApiKey})
      fetchOrganizationAndFetchOrCreateApp.mockResolvedValue({
        partnersApp: {
          id: 'id',
          title: 'title',
          apiKey: promptApiKey,
          organizationId: '1',
          apiSecretKeys: [],
          grantedScopes: [],
        },
        orgId: '1',
      })
      vi.mocked(isTerminalInteractive).mockReturnValue(true)
    })

    it('uses options API key if provided', async () => {
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

    it('uses app identifier API key, if options API key is not provided', async () => {
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

    it('prompts for app if no API key is provided in interactive mode', async () => {
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

    it('aborts if no API key is provided in non-interactive mode', async () => {
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
