import {
  formatDate,
  formatLocalDate,
  getRandomName,
  joinWithAnd,
  linesToColumns,
  normalizeDelimitedString,
  pluralize,
  tryParseInt,
  capitalize,
  slugify,
  escapeRegExp,
  camelize,
  hyphenate,
  underscore,
  constantize,
  pascalize,
} from './string.js'
import {describe, expect, test} from 'vitest'

describe('getRandomName', () => {
  test('generates a non-empty string', () => {
    // Given/When
    const got = getRandomName()

    // Then
    expect(got.length).not.toBe(0)
  })

  test('generates a business name by default', () => {
    // Given/When
    const got = getRandomName()

    // Then
    expect(got).toMatch(/^[a-z]+-[a-z]+$/)
  })

  test('generates a creative name when specified', () => {
    // Given/When
    const got = getRandomName('creative')

    // Then
    expect(got).toMatch(/^[a-z]+-[a-z]+$/)
  })
})

describe('capitalize', () => {
  test('capitalizes the first letter of a string', () => {
    // Given
    const str = 'hello world'

    // When
    const result = capitalize(str)

    // Then
    expect(result).toBe('Hello world')
  })

  test('handles empty string', () => {
    // Given
    const str = ''

    // When
    const result = capitalize(str)

    // Then
    expect(result).toBe('')
  })

  test('handles single character', () => {
    // Given
    const str = 'a'

    // When
    const result = capitalize(str)

    // Then
    expect(result).toBe('A')
  })

  test('does not change already capitalized string', () => {
    // Given
    const str = 'Hello world'

    // When
    const result = capitalize(str)

    // Then
    expect(result).toBe('Hello world')
  })
})

describe('slugify', () => {
  test('converts string to slug format', () => {
    // Given
    const str = 'Hello World!'

    // When
    const result = slugify(str)

    // Then
    expect(result).toBe('hello-world')
  })

  test('handles special characters', () => {
    // Given
    const str = 'Hello @#$% World!!!'

    // When
    const result = slugify(str)

    // Then
    expect(result).toBe('hello-world')
  })

  test('handles multiple spaces and dashes', () => {
    // Given
    const str = '  Hello   World  -  Test  '

    // When
    const result = slugify(str)

    // Then
    expect(result).toBe('hello-world-test')
  })

  test('handles underscores', () => {
    // Given
    const str = 'hello_world_test'

    // When
    const result = slugify(str)

    // Then
    expect(result).toBe('hello-world-test')
  })

  test('removes leading and trailing dashes', () => {
    // Given
    const str = '---hello world---'

    // When
    const result = slugify(str)

    // Then
    expect(result).toBe('hello-world')
  })
})

describe('escapeRegExp', () => {
  test('escapes regex special characters', () => {
    // Given
    const str = '.*+?^${}()|[]\\'

    // When
    const result = escapeRegExp(str)

    // Then
    expect(result).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\')
  })

  test('does not change normal strings', () => {
    // Given
    const str = 'hello world'

    // When
    const result = escapeRegExp(str)

    // Then
    expect(result).toBe('hello world')
  })
})

describe('camelize', () => {
  test('converts string to camelCase', () => {
    // Given
    const str = 'hello-world-test'

    // When
    const result = camelize(str)

    // Then
    expect(result).toBe('helloWorldTest')
  })

  test('handles underscores', () => {
    // Given
    const str = 'hello_world_test'

    // When
    const result = camelize(str)

    // Then
    expect(result).toBe('helloWorldTest')
  })

  test('handles spaces', () => {
    // Given
    const str = 'hello world test'

    // When
    const result = camelize(str)

    // Then
    expect(result).toBe('helloWorldTest')
  })
})

describe('hyphenate', () => {
  test('converts string to param-case', () => {
    // Given
    const str = 'helloWorldTest'

    // When
    const result = hyphenate(str)

    // Then
    expect(result).toBe('hello-world-test')
  })

  test('handles underscores', () => {
    // Given
    const str = 'hello_world_test'

    // When
    const result = hyphenate(str)

    // Then
    expect(result).toBe('hello-world-test')
  })

  test('handles spaces', () => {
    // Given
    const str = 'hello world test'

    // When
    const result = hyphenate(str)

    // Then
    expect(result).toBe('hello-world-test')
  })
})

describe('underscore', () => {
  test('converts string to snake_case', () => {
    // Given
    const str = 'helloWorldTest'

    // When
    const result = underscore(str)

    // Then
    expect(result).toBe('hello_world_test')
  })

  test('handles hyphens', () => {
    // Given
    const str = 'hello-world-test'

    // When
    const result = underscore(str)

    // Then
    expect(result).toBe('hello_world_test')
  })

  test('handles spaces', () => {
    // Given
    const str = 'hello world test'

    // When
    const result = underscore(str)

    // Then
    expect(result).toBe('hello_world_test')
  })
})

describe('constantize', () => {
  test('converts string to CONSTANT_CASE', () => {
    // Given
    const str = 'helloWorldTest'

    // When
    const result = constantize(str)

    // Then
    expect(result).toBe('HELLO_WORLD_TEST')
  })

  test('handles hyphens', () => {
    // Given
    const str = 'hello-world-test'

    // When
    const result = constantize(str)

    // Then
    expect(result).toBe('HELLO_WORLD_TEST')
  })

  test('handles spaces', () => {
    // Given
    const str = 'hello world test'

    // When
    const result = constantize(str)

    // Then
    expect(result).toBe('HELLO_WORLD_TEST')
  })
})

describe('pascalize', () => {
  test('converts string to PascalCase', () => {
    // Given
    const str = 'hello-world-test'

    // When
    const result = pascalize(str)

    // Then
    expect(result).toBe('HelloWorldTest')
  })

  test('handles underscores', () => {
    // Given
    const str = 'hello_world_test'

    // When
    const result = pascalize(str)

    // Then
    expect(result).toBe('HelloWorldTest')
  })

  test('handles spaces', () => {
    // Given
    const str = 'hello world test'

    // When
    const result = pascalize(str)

    // Then
    expect(result).toBe('HelloWorldTest')
  })
})

describe('tryParseInt', () => {
  test('converts a string to an int', () => {
    expect(tryParseInt('  999 ')).toEqual(999)
  })
  test('ignores unspecified strings', () => {
    expect(tryParseInt(undefined)).toEqual(undefined)
  })
  test('ignores bad strings', () => {
    expect(tryParseInt('not this')).toEqual(undefined)
  })
})

describe('linesToColumns', () => {
  test('converts a set of lines to columns', () => {
    // Given
    const lines = [
      ['one', 'two', 'three'],
      ['four', 'five', 'six'],
    ]

    // When
    const got = linesToColumns(lines)

    // Then
    expect(got).toEqual(
      `
one    two    three
four   five   six
`.trim(),
    )
  })
})

describe('pluralize', () => {
  const pluralized = (items: string[]) => {
    return pluralize(
      items,
      (items) => `This list has many items: ${items.join(', ')}`,
      (item) => `This list has a single item (${item})`,
      () => 'This list has no items',
    )
  }

  const pluralizedWithoutNone = (items: string[]) => {
    return pluralize(
      items,
      (items) => `This list has many items: ${items.join(', ')}`,
      (item) => `This list has a single item (${item})`,
    )
  }

  test('formats the list when it has many items', () => {
    // Given
    const lines = ['one', 'two', 'three']

    // When
    const str = pluralized(lines)

    // Then
    expect(str).toBe('This list has many items: one, two, three')
  })

  test('formats the list when it has only one item', () => {
    // Given
    const lines = ['one']

    // When
    const str = pluralized(lines)

    // Then
    expect(str).toBe('This list has a single item (one)')
  })

  test('formats the list when it has no items', () => {
    // Given/When
    const str = pluralized([])

    // Then
    expect(str).toBe('This list has no items')
  })

  test('returns empty string when no items and no none callback', () => {
    // Given/When
    const str = pluralizedWithoutNone([])

    // Then
    expect(str).toBe('')
  })
})

describe('formatDate', () => {
  test('formats a date', () => {
    // Given
    const date = new Date('2020-01-01T00:00:00.000Z')

    // When
    const str = formatDate(date)

    // Then
    expect(str).toBe('2020-01-01 00:00:00')
  })
})

describe('formatLocalDate', () => {
  test('formats an ISO date string to local date string', () => {
    // Given
    const ISODateString = '2020-01-01T00:00:00.000Z'

    // When
    const str = formatLocalDate(ISODateString)

    // Then
    expect(str).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)
  })
})

describe('joinWithAnd', () => {
  test('joins one string', () => {
    // Given
    const strings = ['one']

    // When
    const str = joinWithAnd(strings)

    // Then
    expect(str).toBe('"one"')
  })

  test('joins two strings with and', () => {
    // Given
    const strings = ['one', 'two']

    // When
    const str = joinWithAnd(strings)

    // Then
    expect(str).toBe('"one" and "two"')
  })

  test('joins three strings with and', () => {
    // Given
    const strings = ['one', 'two', 'three']

    // When
    const str = joinWithAnd(strings)

    // Then
    expect(str).toBe('"one", "two" and "three"')
  })

  test('returns empty string for empty array', () => {
    // Given
    const strings: string[] = []

    // When
    const str = joinWithAnd(strings)

    // Then
    expect(str).toBe('')
  })
})

describe('normalizeDelimitedString', () => {
  test('remove empty items', () => {
    // Given
    const scopes = 'read_products, write_products,,'

    // When
    const result = normalizeDelimitedString(scopes)

    // Then
    expect(result).toEqual('read_products,write_products')
  })

  test('sort the list', () => {
    // Given
    const scopes = 'write_products,read_products'

    // When
    const result = normalizeDelimitedString(scopes)

    // Then
    expect(result).toEqual('read_products,write_products')
  })

  test('trim white spaces', () => {
    // Given
    const scopes = 'write_products,  read_products'

    // When
    const result = normalizeDelimitedString(scopes)

    // Then
    expect(result).toEqual('read_products,write_products')
  })

  test('remove duplicated', () => {
    // Given
    const scopes = 'write_products,read_products,write_products'

    // When
    const result = normalizeDelimitedString(scopes)

    // Then
    expect(result).toEqual('read_products,write_products')
  })

  test('returns undefined for undefined input', () => {
    // Given/When
    const result = normalizeDelimitedString(undefined)

    // Then
    expect(result).toBeUndefined()
  })

  test('returns undefined for empty string', () => {
    // Given/When
    const result = normalizeDelimitedString('')

    // Then
    expect(result).toBeUndefined()
  })

  test('handles custom delimiter', () => {
    // Given
    const scopes = 'write_products; read_products;'

    // When
    const result = normalizeDelimitedString(scopes, ';')

    // Then
    expect(result).toEqual('read_products;write_products')
  })
})
