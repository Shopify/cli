import {defineProvider, startTunnel, TunnelError} from './tunnel.js'
import {ok} from '../result.js'
import {describe, test, expect} from 'vitest'

describe('tunnel', () => {
  describe('defineProvider', () => {
    test('returns a function that resolves with the provider name', async () => {
      // Given
      const providerName = 'test-provider'
      const provider = defineProvider({name: providerName})

      // When
      const result = await provider.call({} as any, {} as any)

      // Then
      expect(result).toEqual({name: providerName})
    })
  })

  describe('startTunnel', () => {
    test('returns error when provider does not match', async () => {
      // Given
      const tunnelFn = startTunnel({
        provider: 'cloudflare',
        action: async () =>
          ok({
            provider: 'cloudflare',
            port: 8080,
            getTunnelStatus: () => ({status: 'not-started'}),
            stopTunnel: () => {},
          }),
      })

      // When
      const result = await tunnelFn.call({} as any, {provider: 'wrong-provider', port: 8080, config: {} as any})

      // Then
      expect(result.isErr()).toBe(true)
      expect((result as any).error).toBeInstanceOf(TunnelError)
      expect((result as any).error.type).toBe('invalid-provider')
    })

    test('calls action with port when provider matches', async () => {
      // Given
      const port = 8080
      const provider = 'cloudflare'
      let calledWithPort: number | undefined

      const tunnelFn = startTunnel({
        provider,
        action: async (receivedPort) => {
          calledWithPort = receivedPort
          return ok({
            provider,
            port: receivedPort,
            getTunnelStatus: () => ({status: 'not-started'}),
            stopTunnel: () => {},
          })
        },
      })

      // When
      const result = await tunnelFn.call({} as any, {provider, port, config: {} as any})

      // Then
      expect(result.isErr()).toBe(false)
      expect(calledWithPort).toBe(port)
    })

    test('returns successful tunnel client when everything succeeds', async () => {
      // Given
      const port = 8080
      const provider = 'cloudflare'
      const tunnelClient = {
        provider,
        port,
        getTunnelStatus: () => ({status: 'not-started' as const}),
        stopTunnel: () => {},
      }

      const tunnelFn = startTunnel({
        provider,
        action: async () => ok(tunnelClient),
      })

      // When
      const result = await tunnelFn.call({} as any, {provider, port, config: {} as any})

      // Then
      expect(result.isErr()).toBe(false)
      if (!result.isErr()) {
        expect(result.value).toEqual(tunnelClient)
        expect(result.value.getTunnelStatus()).toEqual({status: 'not-started'})
      }
    })
  })

  describe('TunnelError', () => {
    test('creates error with correct type and message', () => {
      // Given
      const errorType = 'invalid-provider'
      const errorMessage = 'Invalid tunnel provider'

      // When
      const error = new TunnelError(errorType, errorMessage)

      // Then
      expect(error).toBeInstanceOf(TunnelError)
      expect(error.type).toBe(errorType)
      expect(error.message).toBe(errorMessage)
    })

    test('creates error with only type when message is omitted', () => {
      // Given
      const errorType = 'unknown'

      // When
      const error = new TunnelError(errorType)

      // Then
      expect(error).toBeInstanceOf(TunnelError)
      expect(error.type).toBe(errorType)
      expect(error.message).toBe('')
    })
  })
})
