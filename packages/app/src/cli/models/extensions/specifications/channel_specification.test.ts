import {describe, expect, test} from 'vitest'
import channelSpecificationSpec from './channel_specification.js'

describe('channel_specification', () => {
  test('includes bundling feature', () => {
    const features = channelSpecificationSpec.appModuleFeatures()
    expect(features).toContain('bundling')
  })

  test('deployConfig returns basic configuration', async () => {
    const config = {
      type: 'channel_specification' as const,
      handle: 'my-channel',
      name: 'My Channel',
    }

    const result = await channelSpecificationSpec.deployConfig?.(
      config,
      '/path/to/extension',
      'api-key',
      undefined,
    )

    expect(result).toEqual({
      handle: 'my-channel',
      name: 'My Channel',
    })
  })
})
