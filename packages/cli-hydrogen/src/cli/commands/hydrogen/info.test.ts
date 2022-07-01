import InfoCommand from './info.js'
import {HydrogenApp, load as loadApp} from '../../models/hydrogen.js'
import {describe, expect, vi, it, beforeAll} from 'vitest'
import {outputMocker} from '@shopify/cli-kit'

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
    expect(outputMock.output()).toMatch(/Name snow-devil/)
    expect(outputMock.output()).toMatch(/Project location .\/some\/path/)
    expect(outputMock.output()).toMatch(/Package manager npm/)
  })
})

function mockOutput(mockHydrogenApp: Partial<HydrogenApp> = {}) {
  const app = {
    name: 'snow-devil',
    configuration: {
      shopify: {
        ...mockHydrogenApp?.configuration?.shopify,
      },
    },
    dependencyManager: 'npm',
    language: 'JavaScript',
    configurationPath: '',
    nodeDependencies: {},
    directory: './some/path',
    ...mockHydrogenApp,
  } as const

  vi.mocked(loadApp).mockResolvedValue(app)

  const mocker = outputMocker.mockAndCaptureOutput()

  return {
    ...mocker,
    output() {
      const output = mocker.output()
      const trimmedOuput = (output as string).replace(/\s+/g, ' ').trim()

      return trimmedOuput
    },
  }
}
