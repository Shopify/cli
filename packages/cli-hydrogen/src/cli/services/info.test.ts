import {info} from './info'
import {HydrogenApp} from '../models/hydrogen'
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

describe('Shopify settings', () => {
  it('shows an error when the Shopify domain is invalid', async () => {
    // Given
    const shopify: HydrogenApp['configuration']['shopify'] = {
      storeDomain: 'snow-devil.myspotify.com',
    }

    // When
    const output = await mockInfoWithApp({configuration: {shopify}})

    // Then
    expect(output).toMatch(`! StoreDomain must be a valid shopify domain`)
  })

  it('does not show an error when the Shopify domain is valid', async () => {
    // Given
    const shopify: HydrogenApp['configuration']['shopify'] = {
      storeDomain: 'snow-devil.myshopify.com',
    }

    // When
    const output = await mockInfoWithApp({configuration: {shopify}})

    // Then
    expect(output).not.toMatch(`! StoreDomain must be a valid shopify domain`)
  })
})

async function mockInfoWithApp(mockHydrogenApp: Partial<HydrogenApp> = {}) {
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

  const output = await info(app, {format: 'text'})
  const trimmedOuput = (output as string).replace(/\s+/g, ' ').trim()

  return trimmedOuput
}
