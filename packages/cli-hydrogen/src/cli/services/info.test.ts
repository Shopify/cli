import {info} from './info.js'
import {HydrogenApp} from '../models/hydrogen.js'
import {describe, expect, it} from 'vitest'

describe('Project settings', () => {
  it('displays the name and directory of the app', async () => {
    // Given
    const name = 'snow-devil'
    const directory = './some/path'

    // When
    const output = await mockInfoWithApp({name, directory})

    // Then
    expect(output).toMatch(`Name ${name}`)
    expect(output).toMatch(`Project location ${directory}`)
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
    const output = await mockInfoWithApp(app)

    // Then
    expect(output).toMatch('! Run `yarn shopify add eslint` to install and configure eslint for hydrogen')
  })

  it('does not show an error when both the ESLint and the eslint-plugin-hydrogen exist', async () => {
    // Given
    const app = {
      configuration: {
        nodeDependencies: {
          eslint: '^7.1.0',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'eslint-plugin-hydrogen': '^1.0.0',
        },
      },
    }

    // When
    const output = await mockInfoWithApp(app)

    // Then
    expect(output).not.toMatch('! Run `yarn shopify add eslint` to install and configure eslint for hydrogen')
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

  const output = await info(app, {showPrivateData: false})

  const trimmedOuput = (output as string).replace(/\s+/g, ' ').trim()

  return trimmedOuput
}
