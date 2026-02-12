import {getListOfTunnelPlugins} from './plugins.js'
import {describe, expect, test, vi} from 'vitest'
import {Config} from '@oclif/core'

describe('getListOfTunnelPlugins', () => {
  test('returns empty list when there are no tunnel plugins ', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook').mockResolvedValue({successes: [], errors: []} as any)

    // When
    const got = await getListOfTunnelPlugins(config)

    // Then
    expect(got).toEqual({plugins: []})
  })

  test('returns error when there are duplicated providers ', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook').mockResolvedValue({
      successes: [
        {result: {name: 'cloudflare'}, plugin: {name: 'plugin-cloudflare'}},
        {result: {name: 'cloudflare'}, plugin: {name: 'another-cloudflare'}},
      ],

      errors: [],
    } as any)

    // When
    const got = await getListOfTunnelPlugins(config)

    // Then
    expect(got).toEqual({plugins: ['cloudflare', 'cloudflare'], error: 'multiple-plugins-for-provider'})
  })

  test('returns list of tunnel providers', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook').mockResolvedValue({
      successes: [
        {result: {name: 'cloudflare'}, plugin: {name: 'plugin-cloudflare'}},
        {result: {name: 'ngrok'}, plugin: {name: 'plugin-ngrok'}},
      ],
      errors: [],
    } as any)

    // When
    const got = await getListOfTunnelPlugins(config)

    // Then
    expect(got).toEqual({plugins: ['cloudflare', 'ngrok']})
  })
})
