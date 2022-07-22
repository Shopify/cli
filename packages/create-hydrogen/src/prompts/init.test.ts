import init from './init'
import {describe, test, it, expect, vi} from 'vitest'

describe('init', () => {
  it('uses default name "hydrogen-app" when name is not passed', async () => {
    const prompt = vi.fn()
    const input = {}
    const output = {name: 'hydrogen-app', template: 'test', language: 'js'}

    // Given
    prompt.mockResolvedValue(Promise.resolve(output))

    // When
    const got = await init(input, prompt)

    // Then
    expect(prompt).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          type: 'input',
          name: 'name',
          message: 'Name your new Hydrogen storefront',
          default: 'hydrogen-app',
        },
      ]),
    )

    expect(got).toEqual(output)
  })

  it('uses the name when passed to the prompt', async () => {
    const prompt = vi.fn()
    const input = {name: 'snow-devil'}
    const output = {name: 'hydrogen-app', template: 'test', language: 'js'}

    // Given
    prompt.mockResolvedValue(Promise.resolve(output))

    // When
    const got = await init(input, prompt)

    // Then
    expect(prompt).not.toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({name: 'name'})]))
    expect(got).toEqual(output)
  })

  it('when template is not passed', async () => {
    const prompt = vi.fn()
    const input = {name: 'snow-devil'}
    const output = {name: 'snow-devil', template: 'test', language: 'js'}

    // Given
    prompt.mockResolvedValue(Promise.resolve(output))

    // When
    const got = await init(input, prompt)

    // Then
    expect(prompt).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'select',
          name: 'template',
          choices: [
            {
              name: 'Demo Store',
              value: 'demo-store',
            },
            {
              name: 'Hello World',
              value: 'hello-world',
            },
          ],
          message: 'Choose a template',
          default: 'demo-store',
          result: expect.any(Function),
        }),
      ]),
    )
    expect(got).toEqual(output)
  })

  describe('demo-store-js', () => {
    const expected = 'https://github.com/Shopify/hydrogen/templates/demo-store-js#dist'

    test('when "demo-store"', async () => {
      // Given
      const input = {name: 'snow-devil', template: 'demo-store'}
      const output = {
        name: 'snow-devil',
        template: expected,
      }

      // When
      const got = await init(input)

      // Then
      expect(got).toEqual(output)
    })

    test('when "Demo Store"', async () => {
      // given
      const input = {name: 'snow-devil', template: 'Demo Store'}
      const output = {
        name: 'snow-devil',
        template: expected,
      }

      // When
      const got = await init(input)

      // Then
      expect(got).toEqual(output)
    })

    test('when "Demo store"', async () => {
      // given
      const input = {name: 'snow-devil', template: 'Demo store'}
      const output = {
        name: 'snow-devil',
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

    test('when "demo-store-ts"', async () => {
      // Given
      const input = {name: 'snow-devil', template: 'demo-store-ts'}
      const output = {
        name: 'snow-devil',
        template: expected,
      }

      // When
      const got = await init(input)

      // Then
      expect(got).toEqual(output)
    })

    test('when "Demo Store ts"', async () => {
      // given
      const input = {name: 'snow-devil', template: 'Demo Store ts'}
      const output = {
        name: 'snow-devil',
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

    test('when "hello-world-ts"', async () => {
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

    test('when "Hello World ts"', async () => {
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
