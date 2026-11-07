import {evaluate, EvaluationConfig} from './evaluator.js'
import {render} from '../theme-environment/storefront-renderer.js'
import {DevServerSession} from '../theme-environment/types.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {outputContent, outputInfo, outputToken} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'

vi.mock('../theme-environment/storefront-renderer')
vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shopify/cli-kit/node/output')>()),
  outputInfo: vi.fn(),
  outputDebug: vi.fn(),
}))

describe('evaluate', () => {
  let mockConfig: EvaluationConfig

  beforeEach(() => {
    mockConfig = {
      themeSession: {} as DevServerSession,
      themeId: 'test-theme-id',
      url: '/',
      replSession: [],
      snippet: '',
    }
  })

  test('should evaluate a result successfully', async () => {
    const mockResponse = createMockResponse({
      status: 200,
      text: '<div id="shopify-section-announcement-bar" class="shopify-section">\n[{ "type": "display", "value": 123123 }]\n</div>',
    })
    vi.mocked(render).mockResolvedValue(mockResponse as any)

    const result = await evaluate({...mockConfig, snippet: 'shop.id'})

    expect(result).toBe(123123)
  })

  test.each([null, false, 0, '', ['a', 1], {product_id: 1, tags: ['a']}])(
    'preserves a native Liquid value without evaluating it as a context: %j',
    async (value) => {
      vi.mocked(render).mockResolvedValue(
        createMockResponse({
          status: 200,
          text: `<div>\n${JSON.stringify([{type: 'display', value}])}\n</div>`,
        }) as any,
      )
      await expect(evaluate({...mockConfig, snippet: 'value', mode: 'batch'})).resolves.toEqual(value)
      expect(render).toHaveBeenCalledOnce()
      expect(mockConfig.replSession).toEqual([])
    },
  )

  test('throws a Liquid syntax error in batch mode without printing text', async () => {
    vi.mocked(render).mockResolvedValue(
      createMockResponse({status: 200, text: "<div>\nLiquid syntax error: Unknown tag 'invalid'\n</div>"}) as any,
    )
    await expect(evaluate({...mockConfig, snippet: 'invalid', mode: 'batch'})).rejects.toThrow(
      "Unknown object, property, tag, or filter: 'invalid'",
    )
    expect(outputInfo).not.toHaveBeenCalled()
  })

  test('throws for unsuccessful HTTP responses in batch mode', async () => {
    vi.mocked(render).mockResolvedValue(createMockResponse({status: 500, text: 'Internal server error'}) as any)
    await expect(evaluate({...mockConfig, snippet: 'shop.name', mode: 'batch'})).rejects.toThrow('HTTP 500')
    expect(render).toHaveBeenCalledOnce()
  })

  describe('when the URL is not prefixed with a forward slash', () => {
    test('should add a forward slash to the URL', async () => {
      const mockResponse = createMockResponse({
        status: 200,
        text: '<div id="shopify-section-announcement-bar" class="shopify-section">\n[{ "type": "display", "value": 123123 }]\n</div>',
      })
      vi.mocked(render).mockResolvedValue(mockResponse as any)

      await evaluate({...mockConfig, url: 'product/foo-bar'})

      expect(render).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({path: '/product/foo-bar'}))
    })
  })

  test('should add succesful assignments to the session', async () => {
    const mockResponse = createMockResponse({
      status: 200,
      text: '<div id="shopify-section-announcement-bar" class="shopify-section">\n[{ "type": "context", "value": "assign x = 1" }]</div>',
    })
    vi.mocked(render).mockResolvedValue(mockResponse as any)

    const result = await evaluate({...mockConfig, snippet: 'assign x = 1'})

    expect(mockConfig.replSession).toEqual([{type: 'context', value: '{% assign x = 1 %}'}])
    expect(result).toBeUndefined()
  })

  test('should not add unsuccessful assignments to the session', async () => {
    const mockResponse = createMockResponse({
      status: 200,
      text: '<div id="shopify-section-announcement-bar" class="shopify-section">\nLiquid syntax error (snippets/eval line 1): Unexpected character = in "{{ x = 1 | json }}"\n</div>',
    })
    vi.mocked(render).mockResolvedValue(mockResponse as any)

    const result = await evaluate({...mockConfig, snippet: 'assign x = ;'})

    expect(mockConfig.replSession).toEqual([])
    expect(result).toBeUndefined()
  })

  test('should translate equals-sign assignments into variable tag assignments and add them to the session', async () => {
    const mockResponseOne = createMockResponse({
      status: 200,
      text: '<div id="shopify-section-announcement-bar" class="shopify-section">\nLiquid syntax error (snippets/eval line 1): Unexpected character = in "{{ x = 1 | json }}"</div>',
    })
    const mockResponseTwo = createMockResponse({
      status: 200,
      text: '<div id="shopify-section-announcement-bar" class="shopify-section">\nLiquid syntax error (snippets/eval line 1): Unknown tag \'x\'</div>',
    })
    const mockResponseThree = createMockResponse({
      status: 200,
      text: '<div id="shopify-section-announcement-bar" class="shopify-section">\n[{ "type": "context", "value": "" }]</div>',
    })
    vi.mocked(render)
      .mockResolvedValueOnce(mockResponseOne as any)
      .mockResolvedValueOnce(mockResponseTwo as any)
      .mockResolvedValueOnce(mockResponseThree as any)
      .mockResolvedValue(mockResponseTwo as any)

    const result = await evaluate({...mockConfig, snippet: 'x = 1'})

    expect(mockConfig.replSession).toEqual([{type: 'context', value: '{% assign x = 1 %}'}])
    expect(result).toBeUndefined()
  })

  test('should handle `unknown tag` syntax errors and return undefined', async () => {
    const mockResponseOne = createMockResponse({
      status: 200,
      text: `<div id="shopify-section-announcement-bar" class="shopify-section">
Liquid syntax error (snippets/eval line 1): Unknown tag 'invalid_tag'</div>`,
    })

    vi.mocked(render).mockResolvedValue(mockResponseOne as any)

    const result = await evaluate({...mockConfig, snippet: 'invalid_tag'})

    expect(result).toBeUndefined()
    expect(outputInfo).toHaveBeenCalledOnce()
    expect(outputInfo).toHaveBeenCalledWith(
      outputContent`${outputToken.errorText("Unknown object, property, tag, or filter: 'invalid_tag'")}`,
    )
  })

  test('should handle general liquid syntax errors for unknown objects and return undefined', async () => {
    const mockResponseOne = createMockResponse({
      status: 200,
      text: `<div id="shopify-section-announcement-bar" class="shopify-section">
Liquid syntax error (snippets/eval line 1): Liquid error: undefined method 'unknown_object' for nil:NilClass
</div>`,
    })
    vi.mocked(render).mockResolvedValue(mockResponseOne as any)

    const result = await evaluate({...mockConfig, snippet: 'unknown_object'})

    expect(result).toBeUndefined()
    expect(outputInfo).toHaveBeenCalledOnce()
    expect(outputInfo).toHaveBeenCalledWith(
      outputContent`${outputToken.errorText("Liquid syntax error: Liquid error: undefined method 'unknown_object' for nil:NilClass")}`,
    )
  })

  test('should return undefined if the server responds with a liquid syntax error', async () => {
    const mockResponse = createMockResponse({
      status: 200,
      text: `<div id="shopify-section-announcement-bar" class="shopify-section">
        [{ "type": "display", "value": "Liquid syntax error: Unknown variable 'shop' in ..."}]
         </div>`,
    })
    vi.mocked(render).mockResolvedValue(mockResponse as any)

    const result = await evaluate({...mockConfig, snippet: 'asdf'})

    expect(result).toBe(undefined)
  })

  test('should return undefined and abort if the server responds with a non-200 status code', async () => {
    const mockResponse = createMockResponse({
      status: 500,
      text: 'Internal Server Error',
    })
    vi.mocked(render).mockResolvedValue(mockResponse as any)

    const result = await evaluate({...mockConfig, snippet: 'asdf'})

    expect(result).toBe(undefined)
  })

  test('should return undefined if an error occurs during JSON parsing', async () => {
    const mockResponse = createMockResponse({
      status: 200,
      text: 'text',
    })
    vi.mocked(render).mockResolvedValue(mockResponse as any)
    const jsonParseSpy = vi.spyOn(JSON, 'parse').mockImplementationOnce(() => {
      throw new Error('JSON parsing error')
    })

    await expect(evaluate({...mockConfig, snippet: 'asdf'})).rejects.toThrow('JSON parsing error')
    jsonParseSpy.mockRestore()
  })

  test('should handle expired session and throw AbortError', async () => {
    const mockResponse = createMockResponse({
      status: 401,
      text: 'Unauthorized',
    })
    vi.mocked(render).mockResolvedValue(mockResponse as any)

    await expect(evaluate({...mockConfig, snippet: 'asdf'})).rejects.toThrow(
      new AbortError('Session expired. Please initiate a new one.'),
    )
  })

  test('should handle too many requests and throw AbortError', async () => {
    const mockResponse = createMockResponse({
      status: 429,
      text: 'Too Many Requests',
    })
    vi.mocked(render).mockResolvedValue(mockResponse as any)

    await expect(evaluate({...mockConfig, snippet: 'asdf'})).rejects.toThrow(
      new AbortError('Evaluations limit reached. Try again later.'),
    )
  })

  test('should handle resource not found and throw AbortError', async () => {
    const mockResponse = createMockResponse({
      status: 200,
      text: 'Not Found',
      headers: {'server-timing': 'pageType;desc="404"'},
    })
    vi.mocked(render).mockResolvedValue(mockResponse as any)

    await expect(evaluate({...mockConfig, snippet: 'asdf'})).rejects.toThrow(
      new AbortError('Page not found. Please provide a valid --url value!'),
    )
  })
})

function createMockResponse({
  status,
  text,
  headers = {},
}: {
  status: number
  text: string
  headers?: Record<string, string>
}) {
  return {
    status,
    text: vi.fn().mockResolvedValue(text),
    headers: {
      get: vi.fn((header: string) => headers[header] ?? null),
    },
  }
}
