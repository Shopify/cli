import InfoCommand from './info'
import {HydrogenApp, load as loadApp} from '../../models/hydrogen'
import {describe, expect, vi, it, beforeAll} from 'vitest'
import {outputMocker} from '@shopify/cli-testing'

beforeAll(() => {
  vi.mock('../../models/hydrogen')
})

describe('hydrogen info', () => {
  it('displays the app information', async () => {
    // Given
    const name = 'snow-devil'
    const directory = './some/path'
    const outputMock = mockOutput({name, directory})

    // When
    await InfoCommand.run()

    // Then
    expect(outputMock.output()).toMatchInlineSnapshot(
      `
      "YOUR PROJECT                       
      Name               snow-devil
      Project location   ./some/path

      STOREFRONT                         
      storeDomain            Not yet configured
      storefrontApiVersion   Not yet configured
      storefrontToken        Not yet configured
      ! StoreDomain must be a valid shopify domain

      ESLINT                             
      eslint                   Not found
      eslint-plugin-hydrogen   Not found

      TOOLING AND SYSTEM                 
      @shopify/hydrogen       Not found
      @shopify/cli-hydrogen   Not found
      @shopify/cli            Not found
      Package manager         npm
      OS                      darwin-arm64
      Shell                   /bin/zsh
      Node.js version         v18.0.0"
    `,
    )
  })
})

function mockOutput(mockHydrogenApp: Partial<HydrogenApp> = {}) {
  const app = {
    name: 'snow-devil',
    configuration: {
      shopify: {
        ...mockHydrogenApp,
      },
    },
    dependencyManager: 'npm',
    language: 'javascript',
    configurationPath: '',
    nodeDependencies: {},
    directory: './some/path',
    ...mockHydrogenApp,
  } as const

  vi.mocked(loadApp).mockResolvedValue(app)

  return outputMocker.mockAndCapture()
}
