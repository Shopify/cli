import StoreCreatePreview from './preview.js'
import {createPreviewStoreCommand} from '../../../services/store/create/preview/index.js'
import {writeCreatePreviewStoreResult} from '../../../services/store/create/preview/result.js'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../../../services/store/create/preview/index.js')
vi.mock('../../../services/store/create/preview/result.js')
vi.mock('@shopify/cli-kit/node/ui', async () => {
  const actual = await vi.importActual<typeof import('@shopify/cli-kit/node/ui')>('@shopify/cli-kit/node/ui')
  return {...actual, renderSingleTask: vi.fn(async ({task}) => task())}
})

describe('store create preview command', () => {
  test('passes parsed flags through to the service', async () => {
    const result = {
      status: 'success' as const,
      message: 'Your preview store is ready.',
      store: {
        id: '123',
        name: 'Lavender Candles',
        subdomain: 'x.myshopify.com',
        accessUrl: 'https://app.shopify.com/auth/preview-store?token=access-token',
        claimUrl: 'https://admin.shopify.com/store-transfer/accept/claim-token',
        requestedCountry: 'US',
      },
      nextSteps: [],
    }
    vi.mocked(createPreviewStoreCommand).mockResolvedValueOnce(result)

    await StoreCreatePreview.run(['--name', 'Lavender Candles', '--country', 'us', '--json'])

    expect(renderSingleTask).toHaveBeenCalledWith({
      title: expect.objectContaining({value: 'Creating store…'}),
      task: expect.any(Function),
    })
    expect(createPreviewStoreCommand).toHaveBeenCalledWith({name: 'Lavender Candles', country: 'US'})
    expect(writeCreatePreviewStoreResult).toHaveBeenCalledWith(result, 'json')
  })

  test('rejects invalid country codes before calling the service', async () => {
    await expect(StoreCreatePreview.run(['--country', 'USA'])).rejects.toThrow('process.exit unexpectedly called')

    expect(createPreviewStoreCommand).not.toHaveBeenCalled()
  })
})
