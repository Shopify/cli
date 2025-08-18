import {loadFixtureWithOverrides, createFixtureWithOverrides} from './fixture-override.js'
import {describe, test, expect, beforeEach, afterEach} from 'vitest'
import {writeFile, removeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {tmpdir} from 'os'

describe('Fixture Override Utilities', () => {
  let tempDir: string
  let sourceFixturePath: string
  let targetFixturePath: string

  const sampleFixture = {
    name: 'test_fixture',
    export: 'run',
    query: 'query test($input: TestInput!) { ... }',
    input: {
      cart: {
        id: 'gid://shopify/Cart/123',
        lines: [
          {
            id: 'gid://shopify/CartLine/111',
            quantity: 2,
            cost: {
              subtotalAmount: {
                amount: '80.00',
                currencyCode: 'USD',
              },
            },
            merchandise: {
              id: 'gid://shopify/ProductVariant/222',
              title: 'Test Product',
            },
            attributes: [
              {key: 'Size', value: 'Large'},
              {key: 'Color', value: 'Blue'},
            ],
          },
          {
            id: 'gid://shopify/CartLine/333',
            quantity: 1,
            cost: {
              subtotalAmount: {
                amount: '45.00',
                currencyCode: 'USD',
              },
            },
            merchandise: {
              id: 'gid://shopify/ProductVariant/444',
              title: 'Another Product',
            },
          },
        ],
        cost: {
          subtotalAmount: {
            amount: '125.00',
            currencyCode: 'USD',
          },
          totalAmount: {
            amount: '135.00',
            currencyCode: 'USD',
          },
        },
      },
    },
    output: {
      errors: [],
    },
  }

  beforeEach(async () => {
    tempDir = joinPath(tmpdir(), `fixture-override-test-${Date.now()}`)
    sourceFixturePath = joinPath(tempDir, 'source.json')
    targetFixturePath = joinPath(tempDir, 'target.json')

    // Create source fixture file
    await writeFile(sourceFixturePath, JSON.stringify(sampleFixture, null, 2))
  })

  afterEach(async () => {
    try {
      await removeFile(sourceFixturePath)
      await removeFile(targetFixturePath)
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('loadFixtureWithOverrides', () => {
    test('loads fixture without overrides', async () => {
      const result = await loadFixtureWithOverrides(sourceFixturePath)

      expect(result.name).toBe('test_fixture')
      expect(result.input.cart.lines[0].quantity).toBe(2)
      expect(result.input.cart.lines[1].quantity).toBe(1)
    })

    test('applies simple overrides', async () => {
      const overrides = {
        'input.cart.lines.0.quantity': 5,
      }

      const result = await loadFixtureWithOverrides(sourceFixturePath, overrides)

      expect(result.input.cart.lines[0].quantity).toBe(5)
      expect(result.input.cart.lines[1].quantity).toBe(1) // Unchanged
    })

    test('applies multiple overrides', async () => {
      const overrides = {
        'input.cart.lines.0.quantity': 5,
        'input.cart.lines.1.quantity': 3,
        'input.cart.cost.subtotalAmount.amount': '265.00',
      }

      const result = await loadFixtureWithOverrides(sourceFixturePath, overrides)

      expect(result.input.cart.lines[0].quantity).toBe(5)
      expect(result.input.cart.lines[1].quantity).toBe(3)
      expect(result.input.cart.cost.subtotalAmount.amount).toBe('265.00')
    })

    test('applies nested object overrides', async () => {
      const overrides = {
        'input.cart.lines.0.merchandise.title': 'Modified Product',
      }

      const result = await loadFixtureWithOverrides(sourceFixturePath, overrides)

      expect(result.input.cart.lines[0].merchandise.title).toBe('Modified Product')
      expect(result.input.cart.lines[1].merchandise.title).toBe('Another Product') // Unchanged
    })

    test('applies array index overrides', async () => {
      const overrides = {
        'input.cart.lines.0.attributes.0.value': 'XL',
        'input.cart.lines.0.attributes.1.value': 'Red',
      }

      const result = await loadFixtureWithOverrides(sourceFixturePath, overrides)

      expect(result.input.cart.lines[0].attributes[0].value).toBe('XL')
      expect(result.input.cart.lines[0].attributes[1].value).toBe('Red')
    })

    test('throws error for invalid path', async () => {
      const overrides = {
        'input.cart.invalid.path': 'value',
      }

      await expect(loadFixtureWithOverrides(sourceFixturePath, overrides)).rejects.toThrow(
        'Path input.cart.invalid.path is invalid: key invalid does not exist',
      )
    })

    test('throws error for invalid array index', async () => {
      const overrides = {
        'input.cart.lines.10.quantity': 5,
      }

      await expect(loadFixtureWithOverrides(sourceFixturePath, overrides)).rejects.toThrow(
        'Path input.cart.lines.10.quantity is invalid: array index 10 is out of bounds',
      )
    })

    test('throws error for non-array path with numeric key', async () => {
      const overrides = {
        'input.cart.cost.0.amount': '100.00',
      }

      await expect(loadFixtureWithOverrides(sourceFixturePath, overrides)).rejects.toThrow(
        'Path input.cart.cost.0.amount is invalid: 0 is not an array index',
      )
    })
  })

  describe('createFixtureWithOverrides', () => {
    test('creates new fixture with overrides', async () => {
      const overrides = {
        'input.cart.lines.0.quantity': 5,
        'input.cart.cost.subtotalAmount.amount': '265.00',
      }

      await createFixtureWithOverrides(sourceFixturePath, targetFixturePath, overrides, 'modified_fixture')

      const result = await loadFixtureWithOverrides(targetFixturePath)

      expect(result.name).toBe('modified_fixture')
      expect(result.input.cart.lines[0].quantity).toBe(5)
      expect(result.input.cart.cost.subtotalAmount.amount).toBe('265.00')
    })

    test('creates fixture without name override', async () => {
      const overrides = {
        'input.cart.lines.0.quantity': 5,
      }

      await createFixtureWithOverrides(sourceFixturePath, targetFixturePath, overrides)

      const result = await loadFixtureWithOverrides(targetFixturePath)

      expect(result.name).toBe('test_fixture') // Original name preserved
      expect(result.input.cart.lines[0].quantity).toBe(5)
    })
  })
})
