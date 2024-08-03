import {evaluate, EvaluationConfig} from './evaluater.js'
import {DevServerSession} from '../theme-environment/types.js'
import {render} from '../theme-environment/storefront-renderer.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {outputContent, outputInfo, outputToken} from '@shopify/cli-kit/node/output'

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
      snippet: '',
    }
  })

  test('should evaluate a result successfully', async () => {
    const mockResponse = {
      status: 200,
      text: vi.fn().mockResolvedValue(`<div id="shopify-section-announcement-bar" class="shopify-section">
[{ "type": "display", "value": 123123 }]</div>`),
    }
    vi.mocked(render).mockResolvedValue(mockResponse as any)

    const result = await evaluate({...mockConfig, snippet: 'shop.id'})

    expect(result).toBe(123123)
  })

  test('should add assignments to the session', async () => {
    const mockResponse = {
      status: 200,
      text: vi.fn().mockResolvedValue(`<div id="shopify-section-announcement-bar" class="shopify-section">
[{ "type": "context", "value": "assign x = 1" }]</div>`),
    }
    vi.mocked(render).mockResolvedValue(mockResponse as any)

    const result = await evaluate({...mockConfig, snippet: 'assign x = 1'})

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
      .mockResolvedValue(mockResponseTwo as any)

    const result = await evaluate({...mockConfig, snippet: 'x = 1'})

    expect(mockConfig.replSession).toEqual([{type: 'context', value: '{% assign x = 1 %}'}])
    expect(result).toBeUndefined()
  })

  test('should handle `unknown tag` syntax errors and output an error message', async () => {
    const mockResponseOne = {
      status: 200,
      text: vi.fn().mockResolvedValue(`<div id="shopify-section-announcement-bar" class="shopify-section">
Liquid syntax error (snippets/eval line 1): Unknown tag 'invalid_tag'</div>`),
    }

    vi.mocked(render).mockResolvedValue(mockResponseOne as any)

    const result = await evaluate({...mockConfig, snippet: 'invalid_tag'})

    expect(result).toBeUndefined()
    expect(outputInfo).toHaveBeenCalledOnce()
    expect(outputInfo).toHaveBeenCalledWith(
      outputContent`${outputToken.errorText("Unknown object, property, tag, or filter: 'invalid_tag'")}`,
    )
  })

  test('should handle general liquid syntax errors for unknown objects and output an error message', async () => {
    const mockResponseOne = {
      status: 200,
      text: vi.fn().mockResolvedValue(`<div id="shopify-section-announcement-bar" class="shopify-section">
Liquid syntax error (snippets/eval line 1): Liquid error: undefined method 'unknown_object' for nil:NilClass</div>`),
    }
    vi.mocked(render).mockResolvedValue(mockResponseOne as any)

    const result = await evaluate({...mockConfig, snippet: 'unknown_object'})

    expect(result).toBeUndefined()
    expect(outputInfo).toHaveBeenCalledOnce()
    expect(outputInfo).toHaveBeenCalledWith(
      outputContent`${outputToken.errorText("Liquid error: undefined method 'unknown_object' for nil:NilClass")}`,
    )
  })

  test('should return undefined if the server responds with a liquid syntax error', async () => {
    const mockResponse = {
      status: 200,
      text: vi.fn().mockResolvedValue(`<div id="shopify-section-announcement-bar" class="shopify-section">
        [{ "type": "display", "value": "Liquid syntax error: Unknown variable 'shop' in ..."}]</div>`),
    }
    vi.mocked(render).mockResolvedValue(mockResponse as any)

    const result = await evaluate({...mockConfig, snippet: 'asdf'})

    expect(result).toBe(undefined)
  })

  test('should return undefined if the server responds with a non-200 status code', async () => {
    const mockResponse = {
      status: 500,
      text: vi.fn().mockResolvedValue('Internal Server Error'),
    }
    vi.mocked(render).mockResolvedValue(mockResponse as any)

    const result = await evaluate({...mockConfig, snippet: 'asdf'})

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

    await expect(evaluate({...mockConfig, snippet: 'asdf'})).rejects.toThrow('JSON parsing error')
    jsonParseSpy.mockRestore()
  })
})
