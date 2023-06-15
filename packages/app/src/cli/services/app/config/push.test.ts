import {pushConfig} from './push.js'
import {testApp} from '../../../models/app/app.test-data.js'
import {parseConfigurationFile} from '../../../models/app/loader.js'
import {describe, vi, test, expect} from 'vitest'
import {joinPath} from '@shopify/cli-kit/node/path'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../../../models/app/loader.js')
vi.mock('@shopify/cli-kit/node/api/partners')
vi.mock('@shopify/cli-kit/node/session')

describe('pushConfig', () => {
  test('successfully calls the update mutation when push is run and a file is present', async () => {
    const options = {
      apiKey: 'my-key',
      app: testApp({
        directory: '/',
        configurationPath: joinPath('/', 'shopify.app.toml'),
        configuration: {
          scopes: 'my-scope',
        },
      }),
    }

    vi.mocked(parseConfigurationFile).mockResolvedValue({
      scopes: 'my-scope',
      apiKey: 'my-key',
      applicationUrl: 'https://google.com',
    })

    vi.mocked(partnersRequest).mockResolvedValue({
      appUpdate: {
        userErrors: [],
      },
    })

    await pushConfig(options)

    expect(vi.mocked(partnersRequest).mock.calls[1]![2]!).toEqual({
      apiKey: 'my-key',
      applicationUrl: 'https://google.com',
      scopes: 'my-scope',
    })
  })
})
