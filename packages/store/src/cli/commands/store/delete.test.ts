import StoreDelete from './delete.js'
import {deleteDevStore} from '../../services/store/delete/dev.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../services/store/delete/dev.js')

vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal()
  return {
    ...actual,
    outputResult: vi.fn(),
  }
})

describe('store delete command', () => {
  test('passes parsed flags through to the service', async () => {
    await StoreDelete.run(['--store', 'my-store.myshopify.com'])

    expect(deleteDevStore).toHaveBeenCalledWith({
      store: 'my-store.myshopify.com',
      organization: undefined,
      json: false,
    })
  })

  test('passes organization flag through to the service', async () => {
    await StoreDelete.run(['--store', 'my-store.myshopify.com', '--organization', '12345'])

    expect(deleteDevStore).toHaveBeenCalledWith({
      store: 'my-store.myshopify.com',
      organization: '12345',
      json: false,
    })
  })

  test('passes json flag through to the service', async () => {
    await StoreDelete.run(['--store', 'my-store.myshopify.com', '--json'])

    expect(deleteDevStore).toHaveBeenCalledWith({
      store: 'my-store.myshopify.com',
      organization: undefined,
      json: true,
    })
  })

  test('defines the expected flags', () => {
    expect(StoreDelete.flags.store).toBeDefined()
    expect(StoreDelete.flags.organization).toBeDefined()
    expect(StoreDelete.flags.json).toBeDefined()
  })

  test('outputs structured JSON error when --json is active and service throws AbortError', async () => {
    vi.mocked(deleteDevStore).mockRejectedValueOnce(new AbortError('Something went wrong'))
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit')
    }) as never)

    await expect(StoreDelete.run(['--store', 'my-store.myshopify.com', '--json'])).rejects.toThrow(
      'process.exit',
    )

    const call = vi.mocked(outputResult).mock.calls[0]![0] as string
    const parsed = JSON.parse(call)
    expect(parsed).toEqual({
      error: true,
      message: 'Something went wrong',
      nextSteps: [],
      exitCode: 1,
    })
    expect(mockExit).toHaveBeenCalledWith(1)

    mockExit.mockRestore()
  })

  test('does not output JSON for non-AbortError even when --json is active', async () => {
    vi.mocked(deleteDevStore).mockRejectedValueOnce(new Error('unexpected'))

    await expect(StoreDelete.run(['--store', 'my-store.myshopify.com', '--json'])).rejects.toThrow()
    expect(vi.mocked(outputResult)).not.toHaveBeenCalled()
  })

  test('does not output JSON for AbortError when --json is not active', async () => {
    vi.mocked(deleteDevStore).mockRejectedValueOnce(new AbortError('Something went wrong'))

    await expect(StoreDelete.run(['--store', 'my-store.myshopify.com'])).rejects.toThrow()
    expect(vi.mocked(outputResult)).not.toHaveBeenCalled()
  })
})
