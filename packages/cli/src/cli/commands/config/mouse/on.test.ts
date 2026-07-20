import MouseOn from './on.js'
import {setMouseEnabled} from '@shopify/cli-kit/node/mouse'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {Config} from '@oclif/core'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/mouse')

describe('MouseOn', () => {
  test('enables mouse interactions', async () => {
    const config = new Config({root: __dirname})
    const outputMock = mockAndCaptureOutput()

    await new MouseOn([], config).run()

    expect(setMouseEnabled).toHaveBeenCalledWith(true)
    expect(outputMock.info()).toContain('Mouse interactions on.')
    expect(outputMock.info()).toContain('To select text, hold Option in iTerm2 or Shift in')
    expect(outputMock.info()).toContain('most other terminals while dragging.')
  })
})
