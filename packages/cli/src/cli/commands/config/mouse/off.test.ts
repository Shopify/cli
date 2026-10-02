import MouseOff from './off.js'
import {setMouseEnabled} from '@shopify/cli-kit/node/mouse'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {afterEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/mouse')

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('MouseOff', () => {
  test('disables mouse interactions', async () => {
    const outputMock = mockAndCaptureOutput()

    await MouseOff.run([], import.meta.url)

    expect(setMouseEnabled).toHaveBeenCalledWith(false)
    expect(outputMock.info()).toContain('Mouse interactions off.')
  })

  test('returns the mouse configuration as JSON', async () => {
    const outputMock = mockAndCaptureOutput()

    await MouseOff.run(['--json'], import.meta.url)

    expect(setMouseEnabled).toHaveBeenCalledWith(false)
    expect(JSON.parse(outputMock.output())).toEqual({enabled: false})
    expect(outputMock.warn()).toBe('')
  })
})
