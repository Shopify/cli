import {evaluate, EvaluationConfig} from './evaluater.js'
import {DevServerSession} from '../theme-environment/types.js'
import {render} from '../theme-environment/storefront-renderer.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('../theme-environment/storefront-renderer')
vi.mock('@shopify/cli-kit/node/output')

describe('evaluate', () => {
  let mockConfig: EvaluationConfig

  beforeEach(() => {
    mockConfig = {
      themeSession: {} as DevServerSession,
      themeId: 'test-theme-id',
      url: 'https://test-shop.myshopify.com',
      replSession: [],
    }
  })

  test('should evaluate a result successfully', async () => {
    const mockResponse = {
      status: 200,
      text: vi.fn().mockResolvedValue(`<div id="shopify-section-announcement-bar" class="shopify-section">
[{ "type": "display", "value": 123123 }]</div>`),
    }
    vi.mocked(render).mockResolvedValue(mockResponse as any)

    const result = await evaluate('shop.id', mockConfig)

    expect(result).toBe(123123)
  })

  test('should add assignments to the session', async () => {
    const mockResponse = {
      status: 200,
      text: vi.fn().mockResolvedValue(`<div id="shopify-section-announcement-bar" class="shopify-section">
[{ "type": "context", "value": "assign x = 1" }]</div>`),
    }
    vi.mocked(render).mockResolvedValue(mockResponse as any)

    const result = await evaluate('assign x = 1', mockConfig)

    expect(mockConfig.replSession).toEqual([{type: 'context', value: '{% assign x = 1 %}'}])
    expect(result).toBeUndefined()
  })

  test('should translate smart assignments and add them to the session', async () => {
    const mockResponseOne = {
      status: 200,
      text: vi
        .fn()
        .mockResolvedValue(
          '<div id="shopify-section-announcement-bar" class="shopify-section">\nLiquid syntax error (snippets/eval line 1): Unexpected character = in "{{ x = 1 | json }}"</div>',
        ),
    }
    const mockResponseTwo = {
      status: 200,
      text: vi
        .fn()
        .mockResolvedValue(
          '<div id="shopify-section-announcement-bar" class="shopify-section">\nLiquid syntax error (snippets/eval line 1): Unknown tag \'x\'</div>',
        ),
    }
    const mockResponseThree = {
      status: 200,
      text: vi
        .fn()
        .mockResolvedValue(
          '<div id="shopify-section-announcement-bar" class="shopify-section">\n[{ "type": "context", "value": "" }]</div>',
        ),
    }
    vi.mocked(render)
      .mockResolvedValueOnce(mockResponseOne as any)
      .mockResolvedValueOnce(mockResponseTwo as any)
      .mockResolvedValueOnce(mockResponseThree as any)

    const result = await evaluate('x = 1', mockConfig)

    expect(mockConfig.replSession).toEqual([{type: 'context', value: '{% assign x = 1 %}'}])
    expect(result).toBeUndefined()
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
    const jsonParseSpy = vi.spyOn(JSON, 'parse').mockImplementationOnce(() => {
      throw new Error('JSON parsing error')
    })

    await expect(evaluate('asdf', mockConfig)).rejects.toThrow('JSON parsing error')
    jsonParseSpy.mockRestore()
  })
})
