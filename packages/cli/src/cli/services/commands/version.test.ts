import {versionJsonOutputSchema, versionService} from './version.js'
import {afterEach, describe, expect, test, vi} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/common/version', () => ({CLI_KIT_VERSION: '2.2.2'}))

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('version service', () => {
  test('returns the installed version without writing output', async () => {
    const outputMock = mockAndCaptureOutput()

    await expect(versionService()).resolves.toBe('2.2.2')

    expect(outputMock.output()).toBe('')
  })

  test('defines a scalar JSON result contract', () => {
    expect(versionJsonOutputSchema.encode('2.2.2')).toBe('"2.2.2"')
    expect(() => versionJsonOutputSchema.validate({version: '2.2.2'})).toThrow()
  })
})
