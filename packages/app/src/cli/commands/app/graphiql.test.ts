import AppGraphiQL from './graphiql.js'
import {openAppGraphiQL} from '../../services/app/graphiql.js'
import {prepareAppStoreContext} from '../../utilities/execute-command-helpers.js'
import {
  testAppLinked,
  testOrganization,
  testOrganizationApp,
  testOrganizationStore,
  testProject,
} from '../../models/app/app.test-data.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../services/app/graphiql.js')
vi.mock('../../utilities/execute-command-helpers.js')

describe('app graphiql command', () => {
  const app = testAppLinked()
  const remoteApp = testOrganizationApp()
  const store = testOrganizationStore({shopDomain: 'shop.myshopify.com'})

  beforeEach(() => {
    vi.mocked(prepareAppStoreContext).mockResolvedValue({
      appContextResult: {
        app,
        remoteApp,
        developerPlatformClient: remoteApp.developerPlatformClient,
        organization: testOrganization(),
        specifications: [],
        project: testProject(),
        activeConfig: {} as never,
      },
      store,
    })
    vi.mocked(openAppGraphiQL).mockResolvedValue()
  })

  test('prepares app/store context and opens GraphiQL', async () => {
    const result = await AppGraphiQL.run([
      '--path',
      '/tmp/app',
      '--client-id',
      'client-id',
      '--store',
      'shop',
      '--port',
      '9123',
      '--variables',
      '{"id":1}',
      '--version',
      '2024-10',
    ])

    expect(prepareAppStoreContext).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/tmp/app',
        'client-id': 'client-id',
        store: 'shop.myshopify.com',
        port: 9123,
        variables: '{"id":1}',
        version: '2024-10',
      }),
    )
    expect(openAppGraphiQL).toHaveBeenCalledWith({
      remoteApp,
      store: 'shop.myshopify.com',
      port: 9123,
      variables: '{"id":1}',
      apiVersion: '2024-10',
    })
    expect(result).toEqual({app})
  })
})
