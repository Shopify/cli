import {
  isOrganizationAccessError,
  OrganizationStoreAccessError,
  withOrganizationStoreAccess,
} from './business-platform.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'
import {getAppAutomationToken} from '@shopify/cli-kit/node/environment'
import {isServiceAccountTokenSet} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('@shopify/cli-kit/node/environment')
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
    expect(JSON.stringify(error.tryMessage)).toContain('Dev store management')
    expect(JSON.stringify(error.tryMessage)).toContain('Settings > Users > Security')
  })

  test('points a legacy automation token at service accounts', () => {
    vi.mocked(getAppAutomationToken).mockReturnValue('legacy-token')

    const error = new OrganizationStoreAccessError(organization)

    expect(error.message).toBe("This automation token can't manage dev stores in A Better Looking Shop.")
    expect(JSON.stringify(error.tryMessage)).toContain('SHOPIFY_SERVICE_ACCOUNT_TOKEN')
  })

  test('talks about permission for a logged-in user', () => {
    const error = new OrganizationStoreAccessError(organization)

    expect(error.message).toBe("You don't have permission to manage dev stores in A Better Looking Shop.")
  })
})

describe('withOrganizationStoreAccess', () => {
  test('returns the request result', async () => {
    await expect(withOrganizationStoreAccess(organization, async () => 'ok')).resolves.toBe('ok')
  })

  test('replaces a refused request with the access error', async () => {
    vi.mocked(isServiceAccountTokenSet).mockReturnValue(true)

    const result = withOrganizationStoreAccess(organization, async () => {
      throw handledClientError(401)
    })

    await expect(result).rejects.toThrow("This service account can't manage dev stores in A Better Looking Shop.")
  })

  test('rethrows every other error unchanged', async () => {
    const boom = new Error('boom')

    await expect(
      withOrganizationStoreAccess(organization, async () => {
        throw boom
      }),
    ).rejects.toBe(boom)
  })
})
