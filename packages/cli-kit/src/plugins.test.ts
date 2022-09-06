import {getListOfTunnelPlugins, runTunnelPlugin} from './plugins.js'
import {describe, expect, it, vi} from 'vitest'
import {Config} from '@oclif/core'

describe('getListOfTunnelPlugins', () => {
  it('returns empty list when there are no tunnel plugins ', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook').mockResolvedValue({successes: [], errors: []} as any)

    // When
    const got = await getListOfTunnelPlugins(config)

    // Then
    expect(got).toEqual({plugins: []})
  })

  it('returns error when there are duplicated providers ', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook').mockResolvedValue({
      successes: [
        {result: {name: 'ngrok'}, plugin: {name: 'plugin-ngrok'}},
        {result: {name: 'ngrok'}, plugin: {name: 'another-ngrok'}},
      ],

      errors: [],
    } as any)

    // When
    const got = await getListOfTunnelPlugins(config)

    // Then
    expect(got).toEqual({plugins: ['ngrok', 'ngrok'], error: 'multiple-plugins-for-provider'})
  })

  it('returns list of tunnel providers', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook').mockResolvedValue({
      successes: [
        {result: {name: 'ngrok'}, plugin: {name: 'plugin-ngrok'}},
        {result: {name: 'cloudflare'}, plugin: {name: 'plugin-cloudflare'}},
      ],
      errors: [],
    } as any)

    // When
    const got = await getListOfTunnelPlugins(config)

    // Then
    expect(got).toEqual({plugins: ['ngrok', 'cloudflare']})
  })
})

describe('runTunnelPlugin', () => {
  it('returns tunnel url when there is 1 tunnel and returns a valid url', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook').mockResolvedValue({
      successes: [{result: {url: 'tunnel_url'}, plugin: {name: 'plugin-ngrok'}}],
      errors: [],
    } as any)

    // When
    const got = await runTunnelPlugin(config, 1234, 'ngrok')

    // Then
    expect(got).toEqual({url: 'tunnel_url'})
  })

  it('returns error if multiple plugins responded to the hook', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook').mockResolvedValue({
      successes: [
        {result: {url: 'tunnel_url'}, plugin: {name: 'plugin-ngrok'}},
        {result: {url: 'tunnel_url_2'}, plugin: {name: 'plugin-ngrok-2'}},
      ],
      errors: [],
    } as any)

    // When
    const got = await runTunnelPlugin(config, 1234, 'ngrok')

    // Then
    expect(got).toEqual({error: 'multiple-urls'})
  })

  it('returns error if no plugin responds with a url', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook').mockResolvedValue({successes: [], errors: []} as any)

    // When
    const got = await runTunnelPlugin(config, 1234, 'ngrok')

    // Then
    expect(got).toEqual({error: 'no-urls'})
  })
})
