import {evaluate, EvaluationConfig} from './evaluater.js'
import {DevServerSession} from '../theme-environment/types.js'
import {render} from '../theme-environment/storefront-renderer.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../theme-environment/storefront-renderer')
vi.mock('@shopify/cli-kit/node/output')

describe('evaluate', () => {
  const mockConfig: EvaluationConfig = {
    themeSession: {} as DevServerSession,
    themeId: 'test-theme-id',
    url: 'https://test-shop.myshopify.com',
    replSession: [],
  }

  test('should evaluate a result successfully', async () => {
    const mockResponse = {
      status: 200,
      text: vi.fn().mockResolvedValue(`<div id="shopify-section-announcement-bar" class="shopify-section">
[{ "type": "display", "value": 123123 }]</div>`),
    }
    vi.mocked(render).mockResolvedValue(mockResponse as any)

    const result = await evaluate('shop.id', mockConfig)

    expect(result).toBe('123123')
  })

  test('should return undefined if the server responds with a liquid syntax error', async () => {
    const mockResponse = {
      status: 200,
      text: vi.fn().mockResolvedValue(`<div id="shopify-section-announcement-bar" class="shopify-section">
        [{ "type": "display", "value": "Liquid syntax error: Unknown variable 'shop' in ..."}]</div>`),
    }
    vi.mocked(render).mockResolvedValue(mockResponse as any)

    const result = await evaluate('asdf', mockConfig)

    expect(result).toBe(undefined)
  })

  test('should return undefined if the server responds with a non-200 status code', async () => {
    const mockResponse = {
      status: 500,
      text: vi.fn().mockResolvedValue('Internal Server Error'),
    }
    vi.mocked(render).mockResolvedValue(mockResponse as any)

    const result = await evaluate('asdf', mockConfig)

    expect(result).toBe(undefined)
  })

  test('should return undefined if an error occurs during JSON parsing', async () => {
    const mockResponse = {
      status: 200,
      text: vi.fn().mockResolvedValue('text'),
    }
    vi.mocked(render).mockResolvedValue(mockResponse as any)
    vi.spyOn(JSON, 'parse').mockImplementation(() => {
      throw new Error('JSON parsing error')
    })

    await expect(evaluate('asdf', mockConfig)).rejects.toThrow('JSON parsing error')
  })
})
