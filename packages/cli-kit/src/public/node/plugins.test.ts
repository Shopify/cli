import {getListOfTunnelPlugins, runTunnelPlugin} from './plugins.js'
import {err, ok} from './result.js'
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

describe('runTunnelPlugin', () => {
  test('returns tunnel url when there is 1 tunnel and returns a valid url', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook').mockResolvedValue({
      successes: [{result: ok({status: 'connected', url: 'tunnel_url'}), plugin: {name: 'plugin-cloudflare'}}],
      errors: [],
    } as any)

    // When
    const got = await runTunnelPlugin(config, 'cloudflare')

    // Then
    expect(got.valueOrAbort()).toEqual('tunnel_url')
  })

  test('returns tunnel url when there are two tunnel providers and one not matched the requested', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook').mockResolvedValue({
      successes: [
        {result: ok({status: 'connected', url: 'tunnel_url'}), plugin: {name: 'plugin-cloudflare'}},
        {result: err({type: 'invalid-provider'}), plugin: {name: 'other-plugin'}},
      ],
      errors: [],
    } as any)

    // When
    const got = await runTunnelPlugin(config, 'cloudflare')

    // Then
    expect(got.valueOrAbort()).toEqual('tunnel_url')
  })

  test('returns error if multiple plugins responded to the hook', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook').mockResolvedValue({
      successes: [
        {result: ok({url: 'tunnel_url'}), plugin: {name: 'plugin-cloudflare'}},
        {result: ok({url: 'tunnel_url_2'}), plugin: {name: 'plugin-cloudflare-2'}},
      ],
      errors: [],
    } as any)

    // When
    const got = await runTunnelPlugin(config, 'cloudflare')

    // Then
    expect(got.isErr() && got.error.type).equal('multiple-urls')
  })

  test('returns error if no plugin responds with a url', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook').mockResolvedValue({successes: [], errors: []} as any)

    // When
    const got = await runTunnelPlugin(config, 'cloudflare')

    // Then
    expect(got.isErr() && got.error.type).equal('no-provider')
  })

  test('returns error if plugin responds with an uknonwn error', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook').mockResolvedValue({
      successes: [{result: err({type: 'unknown', message: 'message'}), plugin: {name: 'plugin-cloudflare'}}],
      errors: [],
    } as any)

    // When
    const got = await runTunnelPlugin(config, 'cloudflare')

    // Then
    expect(got.isErr() && got.error.type).equal('unknown')
    expect(got.isErr() && got.error.message).equal('message')
  })

  test('returns tunnel url when there is 1 tunnel and returns a valid url after a retry', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook')
      .mockResolvedValueOnce({
        successes: [{result: ok({status: 'starting'}), plugin: {name: 'plugin-cloudflare'}}],
        errors: [],
      } as any)
      .mockResolvedValueOnce({
        successes: [{result: ok({status: 'connected', url: 'tunnel_url'}), plugin: {name: 'plugin-cloudflare'}}],
        errors: [],
      } as any)

    // When
    const got = await runTunnelPlugin(config, 'cloudflare')

    // Then
    expect(got.valueOrAbort()).toEqual('tunnel_url')
  })
})
