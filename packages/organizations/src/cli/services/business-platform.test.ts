import {
  isOrganizationAccessError,
  OrganizationStoreAccessError,
  organizationStoresRequestDoc,
} from './business-platform.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {businessPlatformOrganizationsRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {getAppAutomationToken} from '@shopify/cli-kit/node/environment'
import {isServiceAccountTokenSet} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('@shopify/cli-kit/node/environment')
vi.mock('@shopify/cli-kit/node/api/business-platform')
vi.mock('@shopify/cli-kit/node/session')

const organization = {id: '299069', businessName: 'A Better Looking Shop'}

// The shape cli-kit gives a handled 4xx response: a `GraphQLClientError`, which carries `statusCode`.
function handledClientError(statusCode: number): Error {
  return Object.assign(new Error(`The Business Platform GraphQL API responded with the HTTP status ${statusCode}.`), {
    statusCode,
  })
}

// The shape graphql-request throws when the caller handles errors itself.
function rawClientError(status: number): Error {
  return Object.assign(new Error('GraphQL Error (Code: 401)'), {response: {status, errors: undefined}, request: {}})
}

beforeEach(() => {
  vi.mocked(isServiceAccountTokenSet).mockReturnValue(false)
  vi.mocked(getAppAutomationToken).mockReturnValue(undefined)
})

describe('isOrganizationAccessError', () => {
  test('recognises a handled 401 and 403', () => {
    expect(isOrganizationAccessError(handledClientError(401))).toBe(true)
    expect(isOrganizationAccessError(handledClientError(403))).toBe(true)
  })

  test('recognises a raw graphql-request 401', () => {
    expect(isOrganizationAccessError(rawClientError(401))).toBe(true)
  })

  test('ignores other statuses and other errors', () => {
    expect(isOrganizationAccessError(handledClientError(404))).toBe(false)
    expect(isOrganizationAccessError(handledClientError(500))).toBe(false)
    expect(isOrganizationAccessError(new Error('boom'))).toBe(false)
    expect(isOrganizationAccessError(undefined)).toBe(false)
  })
})

describe('OrganizationStoreAccessError', () => {
  test('tells a service account which access it lacks and where to grant it', () => {
    vi.mocked(isServiceAccountTokenSet).mockReturnValue(true)

    const error = new OrganizationStoreAccessError(organization)

    expect(error).toBeInstanceOf(AbortError)
    expect(error.message).toBe("This service account can't manage dev stores in A Better Looking Shop.")
    // The guidance lives in nextSteps, the field the store commands' --json output carries.
    expect(error.tryMessage).toBeNull()
    expect(error.nextSteps).toEqual([
      'Give the service account Dev store management access in the Shopify admin under Settings > Users > Security.',
      'Or use a token from a service account that has that access.',
    ])
  })

  test('points a legacy automation token at service accounts', () => {
    vi.mocked(getAppAutomationToken).mockReturnValue('legacy-token')

    const error = new OrganizationStoreAccessError(organization)

    expect(error.message).toBe("This automation token can't manage dev stores in A Better Looking Shop.")
    expect(error.nextSteps?.join(' ')).toContain('SHOPIFY_SERVICE_ACCOUNT_TOKEN')
  })

  test('talks about permission for a logged-in user', () => {
    const error = new OrganizationStoreAccessError(organization)

    expect(error.message).toBe("You don't have permission to manage dev stores in A Better Looking Shop.")
    expect(error.nextSteps).toEqual([
      "Check that you're logged in to the right account.",
      'Or ask an organization admin for access.',
    ])
  })

  test('falls back to the organization ID when the name is unknown', () => {
    const error = new OrganizationStoreAccessError({id: '299069'})

    expect(error.message).toBe("You don't have permission to manage dev stores in organization 299069.")
  })
})

describe('organizationStoresRequestDoc', () => {
  const request = {
    query: {} as never,
    token: 'token',
    variables: {first: 1},
    unauthorizedHandler: {type: 'token_refresh' as const, handler: async () => ({token: 'refreshed'})},
  }

  test("sends the request to the organization's Organizations API and returns the result", async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValue({ok: true})

    await expect(organizationStoresRequestDoc(organization, request)).resolves.toEqual({ok: true})
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledWith({...request, organizationId: '299069'})
  })

  test('replaces a refused request with the access error', async () => {
    vi.mocked(isServiceAccountTokenSet).mockReturnValue(true)
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockRejectedValue(handledClientError(401))

    await expect(organizationStoresRequestDoc(organization, request)).rejects.toThrow(
      "This service account can't manage dev stores in A Better Looking Shop.",
    )
  })

  test('rethrows every other error unchanged', async () => {
    const notFound = handledClientError(404)
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockRejectedValue(notFound)

    await expect(organizationStoresRequestDoc(organization, request)).rejects.toBe(notFound)
  })
})
