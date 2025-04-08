import {setThemeStore} from './local-storage.js'
import {metafieldsPull} from './metafields-pull.js'
import {ensureThemeStore} from '../utilities/theme-store.js'
import {hasRequiredThemeDirectories} from '../utilities/theme-fs.js'
import {ensureDirectoryConfirmed} from '../utilities/theme-ui.js'
import {AdminSession, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {metafieldDefinitionsByOwnerType} from '@shopify/cli-kit/node/themes/api'
import {describe, test, vi, beforeEach, expect, afterEach} from 'vitest'
import {fileExists, inTemporaryDirectory, readFile} from '@shopify/cli-kit/node/fs'

vi.mock('../utilities/theme-store.js')
vi.mock('../utilities/theme-fs.js')
vi.mock('../utilities/theme-ui.js')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/themes/api')

const metafieldDefinitionPath = (path: string) => `${path}/.shopify/metafields.json`

describe('metafields-pull', () => {
  const fakeMetafieldDefinition = {
    key: 'fakename',
    name: 'fakename',
    namespace: 'fakespace',
    description: 'fake metafield definition is fake',
    type: {
      category: 'text',
      name: 'string',
    },
  }
  const capturedOutput = mockAndCaptureOutput()

  beforeEach(() => {
    vi.mocked(ensureThemeStore).mockImplementation(() => {
      const themeStore = 'example.myshopify.com'
      setThemeStore(themeStore)
      return themeStore
    })
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue({token: '', storeFqdn: ''})
    vi.mocked(ensureDirectoryConfirmed).mockResolvedValue(true)
    vi.mocked(hasRequiredThemeDirectories).mockResolvedValue(true)
  })

  afterEach(() => {
    capturedOutput.clear()
  })

  test('should download metafields for each ownerType and write to file', async () => {
    // Given
    vi.mocked(metafieldDefinitionsByOwnerType).mockImplementation((type: any, _session: AdminSession) => {
      if (type !== 'PRODUCT') return Promise.resolve([])
      return Promise.resolve([fakeMetafieldDefinition])
    })

    await inTemporaryDirectory(async (tmpDir) => {
      // When
      await metafieldsPull({path: tmpDir})

      // Then
      const filePath = metafieldDefinitionPath(tmpDir)
      await expect(fileExists(filePath)).resolves.toBe(true)
      await expect(readFile(filePath)).resolves.toBe(
        JSON.stringify(
          {
            article: [],
            blog: [],
            collection: [],
            company: [],
            company_location: [],
            location: [],
            market: [],
            order: [],
            page: [],
            product: [fakeMetafieldDefinition],
            variant: [],
            shop: [],
          },
          null,
          2,
        ),
      )
    })

    expect(capturedOutput.info()).toContain('Metafield definitions have been successfully downloaded.')
    expect(capturedOutput.error()).toBeFalsy()
  })

  test('should output to debug if some metafield definitions are not found', async () => {
    // Given
    vi.mocked(metafieldDefinitionsByOwnerType).mockImplementation((type: any, _session: AdminSession) => {
      if (type === 'PRODUCT') return Promise.reject(new Error(`Failed to fetch metafield definitions for ${type}`))
      if (type === 'COLLECTION') return Promise.resolve([fakeMetafieldDefinition])
      return Promise.resolve([])
    })

    await inTemporaryDirectory(async (tmpDir) => {
      // When
      await metafieldsPull({path: tmpDir})

      // Then
      const filePath = metafieldDefinitionPath(tmpDir)
      await expect(fileExists(filePath)).resolves.toBe(true)
      await expect(readFile(filePath)).resolves.toBe(
        JSON.stringify(
          {
            article: [],
            blog: [],
            collection: [fakeMetafieldDefinition],
            company: [],
            company_location: [],
            location: [],
            market: [],
            order: [],
            page: [],
            product: [],
            variant: [],
            shop: [],
          },
          null,
          2,
        ),
      )
      expect(capturedOutput.info()).toContain('Metafield definitions have been successfully downloaded.')
      expect(capturedOutput.debug()).toContain('Failed to fetch metafield definitions for the following owner types')
      expect(capturedOutput.error()).toBeFalsy()
    })
  })

  test('should render error if no metafield definitions are found', async () => {
    // Given
    vi.mocked(metafieldDefinitionsByOwnerType).mockImplementation((type: string, _session: AdminSession) => {
      return Promise.reject(new Error(`Failed to fetch metafield definitions for ${type}`))
    })

    await inTemporaryDirectory(async (tmpDir) => {
      // When
      await metafieldsPull({path: tmpDir})

      // Then
      const filePath = metafieldDefinitionPath(tmpDir)
      await expect(fileExists(filePath)).resolves.toBe(false)
      expect(capturedOutput.info()).toBeFalsy()
      expect(capturedOutput.error()).toContain('Failed to fetch metafield definitions.')
    })
  })

  describe('run from language server', () => {
    beforeEach(() => {
      process.env.SHOPIFY_LANGUAGE_SERVER = '1'
      vi.mocked(hasRequiredThemeDirectories).mockResolvedValue(false)
    })

    afterEach(() => {
      process.env.SHOPIFY_LANGUAGE_SERVER = undefined
    })

    test('should not fetch metafields if the directory is not a theme', async () => {
      vi.mocked(hasRequiredThemeDirectories).mockResolvedValue(false)

      await inTemporaryDirectory(async (tmpDir) => {
        // When
        await metafieldsPull({path: tmpDir})

        // Then
        const filePath = metafieldDefinitionPath(tmpDir)
        await expect(fileExists(filePath)).resolves.toBe(false)
      })

      expect(capturedOutput.info()).toBeFalsy()
      expect(capturedOutput.error()).toBeFalsy()
    })
  })
})
