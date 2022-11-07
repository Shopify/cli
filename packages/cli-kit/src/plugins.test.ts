import {getListOfTunnelPlugins, runTunnelPlugin} from './plugins.js'
import {err, ok} from './public/common/result.js'
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
      successes: [{result: ok({url: 'tunnel_url'}), plugin: {name: 'plugin-ngrok'}}],
      errors: [],
    } as any)

    // When
    const got = await runTunnelPlugin(config, 1234, 'ngrok')

    // Then
    expect(got.valueOrThrow()).toEqual('tunnel_url')
  })

  it('returns tunnel url when there are two tunnel providers and one not matched the requested', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook').mockResolvedValue({
      successes: [
        {result: ok({url: 'tunnel_url'}), plugin: {name: 'plugin-ngrok'}},
        {result: err({type: 'invalid-provider'}), plugin: {name: 'other-plugin'}},
      ],
      errors: [],
    } as any)

    // When
    const got = await runTunnelPlugin(config, 1234, 'ngrok')

    // Then
    expect(got.valueOrThrow()).toEqual('tunnel_url')
  })

  it('returns error if multiple plugins responded to the hook', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook').mockResolvedValue({
      successes: [
        {result: ok({url: 'tunnel_url'}), plugin: {name: 'plugin-ngrok'}},
        {result: ok({url: 'tunnel_url_2'}), plugin: {name: 'plugin-ngrok-2'}},
      ],
      errors: [],
    } as any)

    // When
    const got = await runTunnelPlugin(config, 1234, 'ngrok')

    // Then
    expect(got.isErr() && got.error.type).equal('multiple-urls')
  })

  it('returns error if no plugin responds with a url', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook').mockResolvedValue({successes: [], errors: []} as any)

    // When
    const got = await runTunnelPlugin(config, 1234, 'ngrok')

    // Then
    expect(got.isErr() && got.error.type).equal('no-provider')
  })

  it('returns error if plugin responds with an uknonwn error', async () => {
    // Given
    const config = new Config({root: ''})
    vi.spyOn(config, 'runHook').mockResolvedValue({
      successes: [{result: err({type: 'unknown', message: 'message'}), plugin: {name: 'plugin-ngrok'}}],
      errors: [],
    } as any)

    // When
    const got = await runTunnelPlugin(config, 1234, 'ngrok')

    // Then
    expect(got.isErr() && got.error.type).equal('unknown')
    expect(got.isErr() && got.error.message).equal('message')
  })
})
