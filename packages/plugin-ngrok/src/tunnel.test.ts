import {authenticate, hookStart} from './tunnel.js'
import {beforeEach, describe, expect, vi, test} from 'vitest'
import {platformAndArch} from '@shopify/cli-kit/node/os'
import ngrok from '@shopify/ngrok'
import {renderFatalError, renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'

const port = 1234

vi.mock('@shopify/ngrok')
vi.mock('@shopify/cli-kit/node/ui')

vi.mock('@shopify/cli-kit/node/error', async () => {
  const error: any = await vi.importActual('@shopify/cli-kit/node/error')
  return {
    ...error,
    AbortError: vi.fn(),
  }
})
vi.mock('@shopify/cli-kit/node/os', async () => {
  return {
    platformAndArch: vi.fn(),
  }
})

beforeEach(async () => {
  vi.mocked(ngrok.connect).mockResolvedValue('https://fake.ngrok.io')
  vi.mocked(ngrok.authtoken).mockResolvedValue(undefined)
  vi.mocked(ngrok.validConfig).mockResolvedValue(true)
  vi.mocked(ngrok.upgradeConfig).mockResolvedValue(undefined)
})

describe('start', () => {
  test('creates a new tunnel on the given port', async () => {
    // When
    const got = await hookStart(port)
    const status = got.valueOrBug().getTunnelStatus()

    // Then
    expect(ngrok.connect).toHaveBeenCalledWith({proto: 'http', addr: 1234})
    expect(status).toEqual({status: 'connected', url: 'https://fake.ngrok.io'})
  })

  test('asks for the token and authenticates if the configuration file is wrong', async () => {
    // Given
    vi.mocked(ngrok.validConfig).mockResolvedValue(false)
    vi.mocked(renderTextPrompt).mockResolvedValue('123')
    const authtokenSpy = vi.spyOn(ngrok, 'authtoken')

    // When
    await hookStart(port)

    // Then
    expect(authtokenSpy).toHaveBeenCalledWith('123')
  })

  test('outputs an error if the ngrok tunnel fails to start with a specific message', async () => {
    // Given
    vi.mocked(ngrok.connect).mockRejectedValue(new Error('Your account has been suspended'))

    // When
    const got = await hookStart(port)

    // Then
    expect(AbortError).toHaveBeenCalledWith(
      'The ngrok tunnel could not be started.\n\nYour account has been suspended',
      undefined,
    )
    expect(renderFatalError).toHaveBeenCalledWith(expect.any(AbortError))
    expect(got.isErr() && got.error.type).toEqual('unknown')
    expect(got.isErr() && got.error.message).toEqual('Your account has been suspended')
  })

  test('outputs an error if the ngrok tunnel fails to start because of another tunnel is already running in a non windows platform', async () => {
    // Given
    vi.mocked(ngrok.connect).mockRejectedValue(new Error('error message contains code err_ngrok_108'))
    vi.mocked(platformAndArch).mockReturnValue({platform: 'darwin', arch: 'arch'})

    // When
    const got = await hookStart(port)

    // Then
    expect(AbortError).toHaveBeenCalledWith(
      'The ngrok tunnel could not be started.\n\nerror message contains code err_ngrok_108',
      expect.stringContaining('Kill all the ngrok processes with \u001b[1m\u001b[33mkillall ngrok\u001b[39m\u001b[22m'),
    )
    expect(renderFatalError).toHaveBeenCalledWith(expect.any(AbortError))
    expect(got.isErr() && got.error.type).toEqual('tunnel-already-running')
    expect(got.isErr() && got.error.message).toEqual('error message contains code err_ngrok_108')
  })

  test('outputs an error if the ngrok tunnel fails to start because of another tunnel is already running in windows platform', async () => {
    // Given
    vi.mocked(ngrok.connect).mockRejectedValue(new Error('error message contains code err_ngrok_108'))
    vi.mocked(platformAndArch).mockReturnValue({platform: 'windows', arch: 'arch'})

    // When
    const got = await hookStart(port)

    // Then
    expect(AbortError).toHaveBeenCalledWith(
      'The ngrok tunnel could not be started.\n\nerror message contains code err_ngrok_108',
      expect.stringContaining(
        'Kill all the ngrok processes with \u001b[1m\u001b[33mtaskkill /f /im ngrok.exe\u001b[39m\u001b[22m',
      ),
    )
    expect(renderFatalError).toHaveBeenCalledWith(expect.any(AbortError))
    expect(got.isErr() && got.error.type).toEqual('tunnel-already-running')
    expect(got.isErr() && got.error.message).toEqual('error message contains code err_ngrok_108')
  })

  test.each(['err_ngrok_105', 'err_ngrok_106', 'err_ngrok_107'])(
    'outputs an error if the ngrok tunnel fails to start because of a %p token problem',
    async (ngrokError: string) => {
      // Given
      vi.mocked(ngrok.connect).mockRejectedValue(new Error(`error message contains code ${ngrokError}`))

      // When
      const got = await hookStart(port)

      expect(AbortError).toHaveBeenCalledWith(
        `The ngrok tunnel could not be started.\n\nerror message contains code ${ngrokError}`,
        expect.stringContaining(
          'Update your ngrok token with \u001b[1m\u001b[33mshopify ngrok auth\u001b[39m\u001b[22m',
        ),
      )
      expect(renderFatalError).toHaveBeenCalledWith(expect.any(AbortError))
      expect(got.isErr() && got.error.type).toEqual('wrong-credentials')
      expect(got.isErr() && got.error.message).not.toBeUndefined()
    },
  )
})

describe('authenticate', () => {
  test('calls the authenticate method from tunnel with the expected token', async () => {
    // When
    await authenticate('token')

    // Then
    expect(ngrok.authtoken).toHaveBeenCalledWith('token')
  })

  test('calls the upgradeConfig method from tunnel', async () => {
    // When
    await authenticate('token')

    // Then
    expect(ngrok.upgradeConfig).toHaveBeenCalled()
  })
})
