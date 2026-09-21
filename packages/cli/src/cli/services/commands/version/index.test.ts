import {versionService} from './index.js'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {afterEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/common/version', () => ({CLI_KIT_VERSION: '2.2.2'}))

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('version service', () => {
  test('returns the installed version as an object without writing output', async () => {
    const outputMock = mockAndCaptureOutput()

    await expect(versionService()).resolves.toEqual({version: '2.2.2'})

    expect(outputMock.output()).toBe('')
  })
})
