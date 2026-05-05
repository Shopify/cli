import {signupsRequest} from './signups.js'
import {graphqlRequest} from './graphql.js'
import {handleDeprecations} from './partners.js'
import {signupsFqdn} from '../context/fqdn.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('./graphql.js')
vi.mock('../context/fqdn.js')

const signupsFqdnValue = 'shopify.com'
const url = `https://${signupsFqdnValue}/services/signups/graphql`
const mockedToken = 'identity-token'

beforeEach(() => {
  vi.mocked(signupsFqdn).mockResolvedValue(signupsFqdnValue)
})

describe('signupsRequest', () => {
  test('calls graphqlRequest with correct parameters', async () => {
    vi.mocked(graphqlRequest).mockResolvedValue({storeCreate: {shopPermanentDomain: 'test.myshopify.com'}})
    const query = 'mutation StoreCreate($signup: ShopInput!) { storeCreate(signup: $signup) { shopPermanentDomain } }'
    const variables = {signup: {country: 'US'}}

    await signupsRequest(query, mockedToken, variables)

    expect(graphqlRequest).toHaveBeenCalledWith({
      query,
      api: 'Signups',
      url,
      token: mockedToken,
      variables,
      responseOptions: {onResponse: handleDeprecations},
    })
  })

  test('calls graphqlRequest without variables when not provided', async () => {
    vi.mocked(graphqlRequest).mockResolvedValue({})
    const query = 'query { __schema { types { name } } }'

    await signupsRequest(query, mockedToken)

    expect(graphqlRequest).toHaveBeenCalledWith({
      query,
      api: 'Signups',
      url,
      token: mockedToken,
      variables: undefined,
      responseOptions: {onResponse: handleDeprecations},
    })
  })

  test('returns the response from graphqlRequest', async () => {
    const expectedResponse = {storeCreate: {shopPermanentDomain: 'new-store.myshopify.com', polling: false}}
    vi.mocked(graphqlRequest).mockResolvedValue(expectedResponse)

    const result = await signupsRequest('query', mockedToken)

    expect(result).toEqual(expectedResponse)
  })
})
