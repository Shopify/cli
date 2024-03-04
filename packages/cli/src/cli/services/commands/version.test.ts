import {versionService} from './version.js'
import {afterEach, describe, expect, vi, test} from 'vitest'
import {checkForNewVersion, packageManagerFromUserAgent} from '@shopify/cli-kit/node/node-package-manager'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/node-package-manager')
vi.mock('@shopify/cli-kit/common/version', () => ({CLI_KIT_VERSION: '2.2.2'}))

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('check CLI version', () => {
  test('displays latest version and yarn upgrade message when a newer exists', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(checkForNewVersion).mockResolvedValue('3.0.10')
    vi.mocked(packageManagerFromUserAgent).mockReturnValue('yarn')

    // When
    await versionService()

    // Then
    expect(outputMock.info()).toMatchInlineSnapshot(`
        "Current Shopify CLI version: 2.2.2
        💡 Version 3.0.10 available! Run \`yarn shopify upgrade\`"
      `)
  })

  test('displays latest version and pnpm upgrade message when a newer exists', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(checkForNewVersion).mockResolvedValue('3.0.10')
    vi.mocked(packageManagerFromUserAgent).mockReturnValue('pnpm')

    // When
    await versionService()

    // Then
    expect(outputMock.info()).toMatchInlineSnapshot(`
        "Current Shopify CLI version: 2.2.2
        💡 Version 3.0.10 available! Run \`pnpm shopify upgrade\`"
      `)
  })

  test('displays latest version and npm upgrade message when a newer exists', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(checkForNewVersion).mockResolvedValue('3.0.10')
    vi.mocked(packageManagerFromUserAgent).mockReturnValue('npm')

    // When
    await versionService()

    // Then
    expect(outputMock.info()).toMatchInlineSnapshot(`
        "Current Shopify CLI version: 2.2.2
        💡 Version 3.0.10 available! Run \`npm run shopify upgrade\`"
      `)
  })

  test('displays only current version when no newer version exists', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    vi.mocked(checkForNewVersion).mockResolvedValue(undefined)

    // When
    await versionService()

    // Then
    expect(outputMock.info()).toMatchInlineSnapshot(`"Current Shopify CLI version: 2.2.2"`)
  })
})
