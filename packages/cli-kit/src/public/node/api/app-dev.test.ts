import {appDevRequest} from './app-dev.js'
import {graphqlRequestDoc} from './graphql.js'
import {serviceEnvironment, Environment} from '../../../private/node/context/service.js'
import {test, vi, expect, describe} from 'vitest'
import {TypedDocumentNode} from '@graphql-typed-document-node/core'

vi.mock('./graphql.js')
vi.mock('../../../private/node/context/service.js')

const shopFqdn = 'test-shop.shop.dev'
const mockedToken = 'token'

describe('appDevRequest', () => {
  test('graphqlRequestDoc is called with correct parameters in production environment', async () => {
    // Given
    vi.mocked(serviceEnvironment).mockReturnValue(Environment.Production)
    const query = 'query' as unknown as TypedDocumentNode<object, {variables: string}>

    // When
    await appDevRequest(query, shopFqdn, mockedToken, {variables: 'variables'})

    // Then
    expect(graphqlRequestDoc).toHaveBeenLastCalledWith({
      query,
      api: 'App Dev',
      url: 'https://test-shop.shop.dev/app_dev/unstable/graphql.json',
      token: mockedToken,
      variables: {variables: 'variables'},
    })
  })

  test('graphqlRequestDoc is called with correct parameters in local environment', async () => {
    // Given
    vi.mocked(serviceEnvironment).mockReturnValue(Environment.Local)
    const query = 'query' as unknown as TypedDocumentNode<object, {variables: string}>

    // When
    await appDevRequest(query, shopFqdn, mockedToken, {variables: 'variables'})

    // Then
    expect(graphqlRequestDoc).toHaveBeenLastCalledWith({
      query,
      api: 'App Dev',
      url: 'https://app.shop.dev/app_dev/unstable/graphql.json',
      token: mockedToken,
      addedHeaders: {'x-forwarded-host': shopFqdn},
      variables: {variables: 'variables'},
    })
  })
})
