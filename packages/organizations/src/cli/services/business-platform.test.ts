import {businessPlatformTokenRefreshHandler, storeManagementRequestDoc} from './business-platform.js'
import {describe, expect, test, vi} from 'vitest'
import {businessPlatformOrganizationsRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {getAppAutomationToken} from '@shopify/cli-kit/node/environment'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {TypedDocumentNode} from '@graphql-typed-document-node/core'

vi.mock('@shopify/cli-kit/node/api/business-platform')
vi.mock('@shopify/cli-kit/node/environment')

const query = {} as TypedDocumentNode<{organization: {id: string}}, {id: string}>
const requestOptions = {
  query,
  token: 'bp-token',
  organizationId: '123',
  variables: {id: 'shop-id'},
  unauthorizedHandler: businessPlatformTokenRefreshHandler(),
}

// Structural fake of graphql-request's `ClientError`, as cli-kit rethrows it when a 401 survives the refresh retry.
function clientErrorLike(status: number): Error {
  return Object.assign(new Error(`GraphQL Error (Code: ${status})`), {
    response: {status, headers: {}},
    request: {query: 'query { organization { id } }'},
  })
}

describe('storeManagementRequestDoc', () => {
  test('sends the request to the Organizations API and returns its response', async () => {
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockResolvedValue({organization: {id: '123'}})

    const result = await storeManagementRequestDoc(requestOptions)

    expect(result).toEqual({organization: {id: '123'}})
    expect(businessPlatformOrganizationsRequestDoc).toHaveBeenCalledWith(requestOptions)
  })

  test('explains that the token lacks Dev store management when an automation token gets a 401', async () => {
    vi.mocked(getAppAutomationToken).mockReturnValue('service-account-token')
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockRejectedValue(clientErrorLike(401))

    const error = await storeManagementRequestDoc(requestOptions).catch((error: unknown) => error)

    expect(error).toBeInstanceOf(AbortError)
    expect(error).toMatchObject({
      message: "This token can't manage dev stores.",
      tryMessage:
        "Use a token from a service account with Dev store management. You can create one in your organization's settings in the Shopify admin.",
    })
  })

  test('rethrows a 401 unchanged when no automation token is in use', async () => {
    const unauthorized = clientErrorLike(401)
    vi.mocked(getAppAutomationToken).mockReturnValue(undefined)
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockRejectedValue(unauthorized)

    await expect(storeManagementRequestDoc(requestOptions)).rejects.toBe(unauthorized)
  })

  test('rethrows a 403 unchanged, because the Organizations API only answers 403 for a locked organization', async () => {
    const forbidden = clientErrorLike(403)
    vi.mocked(getAppAutomationToken).mockReturnValue('service-account-token')
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockRejectedValue(forbidden)

    await expect(storeManagementRequestDoc(requestOptions)).rejects.toBe(forbidden)
  })

  test('rethrows other errors unchanged while an automation token is in use', async () => {
    const failure = new AbortError("The custom token provided can't be used for the Business Platform API.")
    vi.mocked(getAppAutomationToken).mockReturnValue('service-account-token')
    vi.mocked(businessPlatformOrganizationsRequestDoc).mockRejectedValue(failure)

    await expect(storeManagementRequestDoc(requestOptions)).rejects.toBe(failure)
  })
})
