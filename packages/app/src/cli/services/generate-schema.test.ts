import {generateSchemaService} from './generate-schema.js'
import * as localEnvironment from './environment.js'
import * as identifiers from '../models/app/identifiers.js'
import {testApp, testFunctionExtension} from '../models/app/app.test-data.js'
import {api, environment, error} from '@shopify/cli-kit'
import {beforeEach, describe, expect, it, MockedFunction, vi} from 'vitest'

describe('generateSchemaService', () => {
  const token = 'token'
  const request = api.partners.request as MockedFunction<typeof api.partners.request>
  const isTerminalInteractive = environment.local.isTerminalInteractive as MockedFunction<
    typeof environment.local.isTerminalInteractive
  >

  beforeEach(() => {
    vi.mock('@shopify/cli-kit', async () => {
      const cliKit: any = await vi.importActual('@shopify/cli-kit')
      return {
        ...cliKit,
        session: {
          ensureAuthenticatedPartners: () => 'token',
        },
        api: {
          partners: {
            request: vi.fn(),
          },
          graphql: cliKit.api.graphql,
        },
        environment: {
          ...cliKit.environment,
          local: {
            ...cliKit.environment.local,
            isTerminalInteractive: vi.fn(),
          },
        },
      }
    })

    request.mockImplementation(() => Promise.resolve({definition: 'schema'}))
  })

  it('performs GraphQL query to fetch the schema', async () => {
    // Given
    const app = testApp()
    const extension = testFunctionExtension()
    const apiKey = 'api-key'

    // When
    const result = await generateSchemaService({app, extension, apiKey})

    // Then
    expect(result).toBe('schema')
  })

  it('aborts if a schema could not be generated', async () => {
    // Given
    const app = testApp()
    const extension = testFunctionExtension()
    const apiKey = 'api-key'
    request.mockImplementation(() => Promise.resolve({definition: null}))

    // When
    const result = generateSchemaService({app, extension, apiKey})

    // Then
    await expect(result).rejects.toThrow(error.Abort)
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
      isTerminalInteractive.mockReturnValue(true)
    })

    it('uses options API key if provided', async () => {
      // Given
      const app = testApp()
      const extension = testFunctionExtension()
      const {
        configuration: {apiVersion: version},
        type,
      } = extension

      // When
      await generateSchemaService({app, extension, apiKey})

      // Then
      expect(request).toHaveBeenCalledWith(api.graphql.ApiSchemaDefinitionQuery, token, {
        apiKey,
        version,
        type,
      })
    })

    it('uses app identifier API key, if options API key is not provided', async () => {
      // Given
      const app = testApp()
      const extension = testFunctionExtension()
      const {
        configuration: {apiVersion: version},
        type,
      } = extension

      // When
      await generateSchemaService({app, extension})

      // Then
      expect(request).toHaveBeenCalledWith(api.graphql.ApiSchemaDefinitionQuery, token, {
        apiKey: identifiersApiKey,
        version,
        type,
      })
    })

    it('prompts for app if no API key is provided in interactive mode', async () => {
      // Given
      const app = testApp()
      const extension = testFunctionExtension()
      const {
        configuration: {apiVersion: version},
        type,
      } = extension
      getAppIdentifiers.mockReturnValue({app: undefined})

      // When
      await generateSchemaService({app, extension})

      // Then
      expect(request).toHaveBeenCalledWith(api.graphql.ApiSchemaDefinitionQuery, token, {
        apiKey: promptApiKey,
        version,
        type,
      })
    })

    it('aborts if no API key is provided in non-interactive mode', async () => {
      // Given
      const app = testApp()
      const extension = testFunctionExtension()
      getAppIdentifiers.mockReturnValue({app: undefined})
      isTerminalInteractive.mockReturnValue(false)

      // When
      const result = generateSchemaService({app, extension})

      await expect(result).rejects.toThrow()
      expect(request).not.toHaveBeenCalled()
    })
  })
})
