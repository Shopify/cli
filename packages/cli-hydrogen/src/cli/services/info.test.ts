import {info} from './info.js'
import {HydrogenApp} from '../models/hydrogen.js'
import {describe, expect, it, vi, beforeEach} from 'vitest'
import {output} from '@shopify/cli-kit'
import {checkForNewVersion} from '@shopify/cli-kit/node/node-package-manager'

beforeEach(async () => {
  vi.mock('@shopify/cli-kit/node/node-package-manager')
})

describe('Project settings', () => {
  it('displays the name and directory of the app', async () => {
    // Given
    const name = 'snow-devil'
    const directory = './some/path'

    // When
    const result = await mockInfoWithApp({name, directory})

    // Then
    expect(result).toMatch(`Name               ${name}`)
    expect(result).toMatch(`Project location   ${directory}`)
  })
})

describe('ESLint settings', () => {
  it('shows an error when the ESLint exists, but the eslint-plugin-hydrogen does not', async () => {
    // Given
    const app = {
      configuration: {
        nodeDependencies: {
          eslint: '^7.1.0',
        },
      },
    }

    // When
    const result = await mockInfoWithApp(app)
    // Then
    expect(result).toMatch('! Run `yarn shopify add eslint` to install and configure eslint for hydrogen')
  })

  it('does not show an error when both the ESLint and the eslint-plugin-hydrogen exist', async () => {
    // Given
    const app = {
      configuration: {
        nodeDependencies: {
          eslint: '^7.1.0',
          'eslint-plugin-hydrogen': '^1.0.0',
        },
      },
    }

    // When
    const result = await mockInfoWithApp(app)

    // Then
    expect(result).not.toMatch('! Run `yarn shopify add eslint` to install and configure eslint for hydrogen')
  })
})

describe('System settings', () => {
  it('shows an upgrade message when the CLI dependencies are out of date', async () => {
    // Given
    const app = {
      configuration: {
        nodeDependencies: {
          '@shopify/cli': '1.0.0',
          '@shopify/cli-hydrogen': '1.0.0',
        },
      },
    }

    const latestVersion = '2.0.0'

    // When
    vi.mocked(checkForNewVersion).mockResolvedValue(latestVersion)
    const result = await mockInfoWithApp(app)

    // Then
    expect(result).toMatch(`Version ${latestVersion} available! Run npm run shopify -- upgrade`)
  })

  it('does not show an upgrade message when the CLI dependencies are up of date', async () => {
    // Given
    const app = {
      configuration: {
        nodeDependencies: {
          '@shopify/cli': '2.0.0',
          '@shopify/cli-hydrogen': '2.0.0',
        },
      },
    }

    const latestVersion = '2.0.0'

    // When
    vi.mocked(checkForNewVersion).mockResolvedValue(latestVersion)
    const result = await mockInfoWithApp(app)

    // Then
    expect(result).not.toMatch(`Version ${latestVersion} available! Run npm run shopify -- upgrade`)
  })
})

async function mockInfoWithApp(mockHydrogenApp: Partial<HydrogenApp> = {}) {
  const app = {
    name: 'snow-devil',
    configuration: {
      shopify: {
        ...mockHydrogenApp.configuration?.shopify,
      },
    },
    packageManager: 'npm',
    language: 'JavaScript',
    nodeDependencies: {
      ...mockHydrogenApp.configuration?.nodeDependencies,
    },
    directory: './some/path',
    ...mockHydrogenApp,
  } as const

  return output.unstyled(output.stringifyMessage(await info(app, {showPrivateData: false})))
}
