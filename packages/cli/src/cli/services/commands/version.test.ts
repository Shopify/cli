import {versionService} from './version.js'
import {afterEach, describe, expect, vi, test} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/shared/node/testing/output'

vi.mock('@shopify/cli-kit/shared/node/node-package-manager')
vi.mock('@shopify/cli-kit/shared/common/version', () => ({CLI_KIT_VERSION: '2.2.2'}))

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('check CLI version', () => {
  test('displays latest version', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()

    // When
    await versionService()

    // Then
    expect(outputMock.info()).toMatchInlineSnapshot(`
        "2.2.2"
      `)
  })
})
