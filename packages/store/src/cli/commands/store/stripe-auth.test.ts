import StoreStripeAuth, {readSignupJwtFromStdin} from './stripe-auth.js'
import {authenticateStoreWithApp} from '../../services/store/auth/index.js'
import {createStoreAuthPresenter} from '../../services/store/auth/result.js'
import {isStdinPiped} from '@shopify/cli-kit/node/system'
import {describe, expect, test, vi} from 'vitest'
import {Readable} from 'stream'

vi.mock('../../services/store/auth/index.js')
vi.mock('../../services/store/attribution.js')
vi.mock('../../services/store/auth/result.js', () => ({
  createStoreAuthPresenter: vi.fn((format: 'text' | 'json') => ({format})),
}))
vi.mock('@shopify/cli-kit/node/system', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/system')>()),
  isStdinPiped: vi.fn(),
}))

describe('store stripe-auth command', () => {
  test('passes signup JWT through to the auth service', async () => {
    await StoreStripeAuth.run([
      '--store',
      'shop.myshopify.com',
      '--scopes',
      'read_products',
      '--signup',
      'signed.signup.jwt',
    ])

    expect(createStoreAuthPresenter).toHaveBeenCalledWith('text')
    expect(authenticateStoreWithApp).toHaveBeenCalledWith(
      {
        store: 'shop.myshopify.com',
        scopes: 'read_products',
        signup: 'signed.signup.jwt',
      },
      {presenter: {format: 'text'}},
    )
  })

  test('passes a json presenter when --json is provided', async () => {
    await StoreStripeAuth.run([
      '--store',
      'shop.myshopify.com',
      '--scopes',
      'read_products',
      '--signup',
      'signed.signup.jwt',
      '--json',
    ])

    expect(createStoreAuthPresenter).toHaveBeenCalledWith('json')
    expect(authenticateStoreWithApp).toHaveBeenCalledWith(
      {
        store: 'shop.myshopify.com',
        scopes: 'read_products',
        signup: 'signed.signup.jwt',
      },
      {presenter: {format: 'json'}},
    )
  })

  test('defines the expected flags', () => {
    expect(StoreStripeAuth.flags.store).toBeDefined()
    expect(StoreStripeAuth.flags.scopes).toBeDefined()
    expect(StoreStripeAuth.flags.signup).toBeDefined()
    expect(StoreStripeAuth.flags.signup.required).toBe(false)
    expect(StoreStripeAuth.flags.json).toBeDefined()
    expect('port' in StoreStripeAuth.flags).toBe(false)
    expect('client-secret-file' in StoreStripeAuth.flags).toBe(false)
  })

  test('reads the signup JWT from stdin', async () => {
    await expect(readSignupJwtFromStdin(Readable.from([' signed.signup.jwt\n']))).resolves.toBe('signed.signup.jwt')
  })

  test('rejects blank stdin signup JWTs', async () => {
    await expect(readSignupJwtFromStdin(Readable.from(['\n']))).rejects.toThrow('Missing signup JWT')
  })

  test('reports the missing credential instead of waiting when stdin is an interactive terminal', async () => {
    vi.mocked(isStdinPiped).mockReturnValue(false)

    await expect(readSignupJwtFromStdin()).rejects.toThrow('Missing signup JWT')
  })

  test('rejects a stdin signup JWT larger than the accepted size', async () => {
    const oversized = 'a'.repeat(8 * 1024 + 1)

    await expect(readSignupJwtFromStdin(Readable.from([oversized]))).rejects.toThrow('too large')
  })

  test('does not authenticate when the signup flag is empty and no JWT is piped', async () => {
    vi.mocked(isStdinPiped).mockReturnValue(false)

    await expect(
      StoreStripeAuth.run(['--store', 'shop.myshopify.com', '--scopes', 'read_products', '--signup', '']),
    ).rejects.toThrow()
    expect(authenticateStoreWithApp).not.toHaveBeenCalled()
  })
})
