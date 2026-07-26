import StoreAuth from './auth.js'
import {authenticateStoreWithApp} from '../../services/store/auth/index.js'
import {createStoreAuthPresenter} from '../../services/store/auth/result.js'
import {promptForStoreAuthScopes} from '../../prompts/store.js'
import {describe, expect, test, vi} from 'vitest'
import {isTTY} from '@shopify/cli-kit/node/ui'

vi.mock('../../services/store/auth/index.js')
vi.mock('../../services/store/attribution.js')
vi.mock('../../services/store/auth/result.js', () => ({
  createStoreAuthPresenter: vi.fn((format: 'text' | 'json') => ({format})),
}))
vi.mock('../../prompts/store.js')
vi.mock('@shopify/cli-kit/node/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/ui')>()),
  isTTY: vi.fn(),
}))

describe('store auth command', () => {
  test('passes parsed flags through to the auth service', async () => {
    await StoreAuth.run(['--store', 'shop.myshopify.com', '--scopes', 'read_products,write_products'])

    expect(createStoreAuthPresenter).toHaveBeenCalledWith('text')
    expect(authenticateStoreWithApp).toHaveBeenCalledWith(
      {
        store: 'shop.myshopify.com',
        scopes: 'read_products,write_products',
      },
      {presenter: {format: 'text'}},
    )
  })

  test('passes a json presenter when --json is provided', async () => {
    await StoreAuth.run(['--store', 'shop.myshopify.com', '--scopes', 'read_products', '--json'])

    expect(createStoreAuthPresenter).toHaveBeenCalledWith('json')
    expect(authenticateStoreWithApp).toHaveBeenCalledWith(
      {
        store: 'shop.myshopify.com',
        scopes: 'read_products',
      },
      {presenter: {format: 'json'}},
    )
  })

  test('defines the expected flags', () => {
    expect(StoreAuth.flags.store).toBeDefined()
    expect(StoreAuth.flags.scopes).toBeDefined()
    expect(StoreAuth.flags.scopes.required).toBeFalsy()
    expect(StoreAuth.flags.json).toBeDefined()
    expect('signup' in StoreAuth.flags).toBe(false)
    expect('port' in StoreAuth.flags).toBe(false)
    expect('client-secret-file' in StoreAuth.flags).toBe(false)
  })

  test('prompts for scopes and joins the selection when --scopes is omitted and the session is interactive', async () => {
    vi.mocked(isTTY).mockReturnValue(true)
    vi.mocked(promptForStoreAuthScopes).mockResolvedValue(['read_products', 'write_products'])

    await StoreAuth.run(['--store', 'shop.myshopify.com'])

    expect(promptForStoreAuthScopes).toHaveBeenCalled()
    expect(authenticateStoreWithApp).toHaveBeenCalledWith(
      {
        store: 'shop.myshopify.com',
        scopes: 'read_products,write_products',
      },
      {presenter: {format: 'text'}},
    )
  })

  test('throws when --scopes is omitted and the session is not interactive', async () => {
    vi.mocked(isTTY).mockReturnValue(false)

    await expect(StoreAuth.run(['--store', 'shop.myshopify.com'])).rejects.toThrow()
    expect(promptForStoreAuthScopes).not.toHaveBeenCalled()
    expect(authenticateStoreWithApp).not.toHaveBeenCalled()
  })

  test('throws when the interactive scope selection is empty', async () => {
    vi.mocked(isTTY).mockReturnValue(true)
    vi.mocked(promptForStoreAuthScopes).mockResolvedValue([])

    await expect(StoreAuth.run(['--store', 'shop.myshopify.com'])).rejects.toThrow()
    expect(authenticateStoreWithApp).not.toHaveBeenCalled()
  })
})
