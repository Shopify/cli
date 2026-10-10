import {logsRequest} from './api.js'
import {graphqlRequest} from '@shopify/cli-kit/node/api/graphql'
import {expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/api/graphql')

const connection = {
  clientId: 'test-app',
  url: 'https://app.example.com/app_logs/unstable/organizations/42/graphql',
  token: () => 'identity-token',
  unauthorizedHandler: {type: 'token_refresh' as const, handler: async () => ({token: 'refreshed-token'})},
}

test.each(['AbortError', 'TimeoutError'])('reports %s without returning empty logs', async (name) => {
  vi.mocked(graphqlRequest).mockRejectedValue(Object.assign(new Error('Timed out'), {name}))
  await expect(logsRequest(connection, 'query { app { clientId } }', {})).rejects.toMatchObject({
    details: {code: 'QUERY_TIMEOUT'},
  })
})

test('propagates unexpected transport failures', async () => {
  const error = new Error('Connection failed')
  vi.mocked(graphqlRequest).mockRejectedValue(error)
  await expect(logsRequest(connection, 'query { app { clientId } }', {})).rejects.toBe(error)
})
