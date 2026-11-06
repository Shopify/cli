import MouseOn from './on.js'
import {setMouseEnabled} from '@shopify/cli-kit/node/mouse'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {afterEach, describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/mouse')

afterEach(() => {
  mockAndCaptureOutput().clear()
})

describe('MouseOn', () => {
  test('enables mouse interactions', async () => {
    const outputMock = mockAndCaptureOutput()

    await MouseOn.run([], import.meta.url)

    expect(setMouseEnabled).toHaveBeenCalledWith(true)
    expect(outputMock.info()).toContain('Mouse interactions on.')
    expect(outputMock.info()).toContain('To select text, hold Option in iTerm2 or Shift in')
    expect(outputMock.info()).toContain('most other terminals while dragging.')
  })

  test('returns the mouse configuration as JSON', async () => {
    const outputMock = mockAndCaptureOutput()

    await MouseOn.run(['--json'], import.meta.url)

    expect(setMouseEnabled).toHaveBeenCalledWith(true)
    expect(JSON.parse(outputMock.output())).toEqual({enabled: true})
    expect(outputMock.warn()).toBe('')
  })
})
