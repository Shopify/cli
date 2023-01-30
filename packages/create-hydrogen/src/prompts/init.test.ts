import init from './init.js'
import {describe, test, it, expect, vi} from 'vitest'
import {renderSelectPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/ui')

describe('init', () => {
  it('uses default name "hydrogen-app" when name is not passed', async () => {
    const input = {template: 'hello-world', language: 'js'}
    const output = {name: 'hydrogen-app'}

    // Given
    vi.mocked(renderTextPrompt).mockResolvedValue(output.name)

    // When
    const got = await init(input)

    // Then
    expect(renderTextPrompt).toHaveBeenCalledWith([
      {
        message: 'Name your new Hydrogen storefront',
        default: 'hydrogen-app',
      },
    ])

    expect(got.name).toEqual(output.name)
  })

  it('uses the name when passed to the prompt', async () => {
    const input = {name: 'snow-devil', template: 'hello-world', language: 'js'}
    const output = {name: 'snow-devil'}

    // Given
    vi.mocked(renderTextPrompt).mockResolvedValue(output.name)

    // When
    const got = await init(input)

    // Then
    expect(renderTextPrompt).not.toHaveBeenCalledWith([
      expect.objectContaining({message: 'Name your new Hydrogen storefront'}),
    ])
    expect(got.name).toEqual(output.name)
  })

  it('when template is not passed', async () => {
    const expected = 'https://github.com/Shopify/hydrogen/templates/demo-store-js#dist'

    const input = {name: 'snow-devil', language: 'js'}
    const output = {name: 'snow-devil', template: expected, language: 'js'}

    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValue(expected)

    // When
    const got = await init(input)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith([
      expect.objectContaining({
        choices: [
          {
            label: 'Demo Store',
            value: 'demo-store',
          },
          {
            label: 'Hello World',
            value: 'hello-world',
          },
        ],
        message: 'Choose a template',
        defaultValue: 'demo-store',
      }),
    ])
    expect(got).toEqual(output)
  })

  it('when language is not passed', async () => {
    const expected = 'https://github.com/Shopify/hydrogen/templates/demo-store-js#dist'

    const input = {name: 'snow-devil', template: 'demo-store'}
    const output = {name: 'snow-devil', template: expected, language: 'js'}

    // Given
    vi.mocked(renderSelectPrompt).mockResolvedValue('js')

    // When
    const got = await init(input)

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith([
      expect.objectContaining({
        choices: [
          {
            label: 'JavaScript',
            value: 'js',
          },
          {
            label: 'TypeScript',
            value: 'ts',
          },
        ],
        message: 'Choose a language',
        defaultValue: 'js',
      }),
    ])
    expect(got).toEqual(output)
  })

  it('when language is set to ts', async () => {
    const expected = 'https://github.com/Shopify/hydrogen/templates/demo-store-ts#dist'

    const input = {name: 'snow-devil', template: 'demo-store', language: 'ts'}
    const output = {name: 'snow-devil', template: expected, language: 'ts'}

    // When
    const got = await init(input)

    // Then
    expect(got).toEqual(output)
  })

  it('when template URL is passed', async () => {
    const expected = 'https://github.com/Shopify/hydrogen/templates/demo-store-ts#dist'

    const input = {name: 'snow-devil', template: expected}
    const output = {name: 'snow-devil', template: expected}

    // When
    const got = await init(input)

    // Then
    expect(got).toEqual(output)
  })

  describe('demo-store-js', () => {
    const expected = 'https://github.com/Shopify/hydrogen/templates/demo-store-js#dist'

    test('when "demo-store"', async () => {
      // Given
      const input = {name: 'snow-devil', language: 'js', template: 'demo-store'}
      const output = {
        name: 'snow-devil',
        language: 'js',
        template: expected,
      }

      // When
      const got = await init(input)

      // Then
      expect(got).toEqual(output)
    })

    test('when "Demo Store"', async () => {
      // given
      const input = {name: 'snow-devil', language: 'js', template: 'Demo Store'}
      const output = {
        name: 'snow-devil',
        language: 'js',
        template: expected,
      }

      // When
      const got = await init(input)

      // Then
      expect(got).toEqual(output)
    })

    test('when "Demo store"', async () => {
      // given
      const input = {name: 'snow-devil', language: 'js', template: 'Demo store'}
      const output = {
        name: 'snow-devil',
        language: 'js',
        template: expected,
      }

      // When
      const got = await init(input)

      // Then
      expect(got).toEqual(output)
    })

    test('when hydrogen git url', async () => {
      // given
      const input = {name: 'snow-devil', template: 'https://github.com/Shopify/hydrogen/templates/demo-store-js'}
      const output = {
        name: 'snow-devil',
        template: expected,
      }

      // When
      const got = await init(input)

      // Then
      expect(got).toEqual(output)
    })

    test('when hydrogen git path', async () => {
      // given
      const input = {name: 'snow-devil', template: 'Shopify/hydrogen/templates/demo-store-js'}
      const output = {
        name: 'snow-devil',
        template: expected,
      }

      // When
      const got = await init(input)

      // Then
      expect(got).toEqual(output)
    })
  })

  describe('demo-store-ts', () => {
    const expected = 'https://github.com/Shopify/hydrogen/templates/demo-store-ts#dist'

    test('when "demo-store"', async () => {
      // Given
      const input = {name: 'snow-devil', language: 'ts', template: 'demo-store'}
      const output = {
        name: 'snow-devil',
        language: 'ts',
        template: expected,
      }

      // When
      const got = await init(input)

      // Then
      expect(got).toEqual(output)
    })

    test('when "Demo Store"', async () => {
      // given
      const input = {name: 'snow-devil', language: 'ts', template: 'Demo Store'}
      const output = {
        name: 'snow-devil',
        language: 'ts',
        template: expected,
      }

      // When
      const got = await init(input)

      // Then
      expect(got).toEqual(output)
    })

    test('when hydrogen git url', async () => {
      // given
      const input = {name: 'snow-devil', template: 'https://github.com/Shopify/hydrogen/templates/demo-store-ts'}
      const output = {
        name: 'snow-devil',
        template: expected,
      }

      // When
      const got = await init(input)

      // Then
      expect(got).toEqual(output)
    })

    test('when hydrogen git path', async () => {
      // given
      const input = {name: 'snow-devil', template: 'Shopify/hydrogen/templates/demo-store-ts'}
      const output = {
        name: 'snow-devil',
        template: expected,
      }

      // When
      const got = await init(input)

      // Then
      expect(got).toEqual(output)
    })
  })

  describe('hello-world-js', () => {
    const expected = 'https://github.com/Shopify/hydrogen/templates/hello-world-js#dist'

    test('when "hello-world"', async () => {
      // Given
      const input = {name: 'snow-devil', language: 'js', template: 'hello-world'}
      const output = {
        name: 'snow-devil',
        language: 'js',
        template: expected,
      }

      // When
      const got = await init(input)

      // Then
      expect(got).toEqual(output)
    })

    test('when "Hello World"', async () => {
      // given
      const input = {name: 'snow-devil', language: 'js', template: 'Hello World'}
      const output = {
        name: 'snow-devil',
        language: 'js',
        template: expected,
      }

      // When
      const got = await init(input)

      // Then
      expect(got).toEqual(output)
    })

    test('when "Hello world"', async () => {
      // given
      const input = {name: 'snow-devil', language: 'js', template: 'Hello world'}
      const output = {
        name: 'snow-devil',
        language: 'js',
        template: expected,
      }

      // When
      const got = await init(input)

      // Then
      expect(got).toEqual(output)
    })

    test('when hydrogen git url', async () => {
      // given
      const input = {name: 'snow-devil', template: 'https://github.com/Shopify/hydrogen/templates/hello-world-js'}
      const output = {
        name: 'snow-devil',
        template: expected,
      }

      // When
      const got = await init(input)

      // Then
      expect(got).toEqual(output)
    })

    test('when hydrogen git path', async () => {
      // given
      const input = {name: 'snow-devil', template: 'Shopify/hydrogen/templates/hello-world-js'}
      const output = {
        name: 'snow-devil',
        template: expected,
      }

      // When
      const got = await init(input)

      // Then
      expect(got).toEqual(output)
    })
  })

  describe('hello-world-ts', () => {
    const expected = 'https://github.com/Shopify/hydrogen/templates/hello-world-ts#dist'

    test('when "hello-world"', async () => {
      // Given
      const input = {name: 'snow-devil', language: 'ts', template: 'hello-world'}
      const output = {
        name: 'snow-devil',
        language: 'ts',
        template: expected,
      }

      // When
      const got = await init(input)

      // Then
      expect(got).toEqual(output)
    })

    test('when "Hello World"', async () => {
      // given
      const input = {name: 'snow-devil', language: 'ts', template: 'Hello World'}
      const output = {
        name: 'snow-devil',
        language: 'ts',
        template: expected,
      }

      // When
      const got = await init(input)

      // Then
      expect(got).toEqual(output)
    })

    test('when hydrogen git url', async () => {
      // given
      const input = {name: 'snow-devil', template: 'https://github.com/Shopify/hydrogen/templates/hello-world-ts'}
      const output = {
        name: 'snow-devil',
        template: expected,
      }

      // When
      const got = await init(input)

      // Then
      expect(got).toEqual(output)
    })

    test('when hydrogen git path', async () => {
      // given
      const input = {name: 'snow-devil', template: 'Shopify/hydrogen/templates/hello-world-ts'}
      const output = {
        name: 'snow-devil',
        template: expected,
      }

      // When
      const got = await init(input)

      // Then
      expect(got).toEqual(output)
    })
  })

  test('when custom git url', async () => {
    const expected = 'https://github.com/cartogram/cartogram-hydrogen-template/'
    // given
    const input = {name: 'snow-devil', template: 'https://github.com/cartogram/cartogram-hydrogen-template'}
    const output = {
      name: 'snow-devil',
      template: expected,
    }

    // When
    const got = await init(input)

    // Then
    expect(got).toEqual(output)
  })

  test('when custom git path', async () => {
    const expected = 'https://github.com/cartogram/cartogram-hydrogen-template/'
    // given
    const input = {name: 'snow-devil', template: 'cartogram/cartogram-hydrogen-template'}
    const output = {
      name: 'snow-devil',
      template: expected,
    }

    // When
    const got = await init(input)

    // Then
    expect(got).toEqual(output)
  })
})
