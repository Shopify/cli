import MouseOff from './off.js'
import {setMouseEnabled} from '@shopify/cli-kit/node/mouse'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {Config} from '@oclif/core'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/mouse')

describe('MouseOff', () => {
  test('disables mouse interactions', async () => {
    const config = new Config({root: __dirname})
    const outputMock = mockAndCaptureOutput()

    await new MouseOff([], config).run()

    expect(setMouseEnabled).toHaveBeenCalledWith(false)
    expect(outputMock.info()).toContain('Mouse interactions off.')
  })
})
