import {
  camelize,
  capitalize,
  capitalizeWords,
  constantize,
  escapeRegExp,
  formatDate,
  formatLocalDate,
  getRandomName,
  hyphenate,
  joinWithAnd,
  linesToColumns,
  normalizeDelimitedString,
  pascalize,
  pluralize,
  slugify,
  timeAgo,
  tryParseInt,
  underscore,
} from './string.js'
import {describe, expect, test} from 'vitest'

describe('getRandomName', () => {
  test('generates a non-empty string for business family by default', () => {
    // Given/When
    const got = getRandomName()

    // Then
    expect(got.length).not.toBe(0)
  })

  test('generates a non-empty string for creative family', () => {
    // Given/When
    const got = getRandomName('creative')

    // Then
    expect(got.length).not.toBe(0)
  })
})

describe('capitalize', () => {
  test('capitalizes the first letter of a string', () => {
    expect(capitalize('hello world')).toBe('Hello world')
  })
})

describe('slugify', () => {
  test('converts strings to slugs', () => {
    expect(slugify('  Hello World!  ')).toBe('hello-world')
  })
})

describe('escapeRegExp', () => {
  test('escapes special regex characters', () => {
    expect(escapeRegExp('hello [world] (1+1=2) *.?')).toBe('hello \\[world\\] \\(1\\+1=2\\) \\*\\.\\?')
  })
})

describe('camelize', () => {
  test('transforms string to camelCase', () => {
    expect(camelize('hello-world_foo bar')).toBe('helloWorldFooBar')
  })
})

describe('capitalizeWords', () => {
  test('transforms string to Capital Case', () => {
    expect(capitalizeWords('hello_world-foo')).toBe('Hello World Foo')
  })
})

describe('hyphenate', () => {
  test('transforms string to param-case', () => {
    expect(hyphenate('helloWorld_foo')).toBe('hello-world-foo')
  })
})

describe('underscore', () => {
  test('transforms string to snake_case', () => {
    expect(underscore('helloWorld-foo')).toBe('hello_world_foo')
  })
})

describe('constantize', () => {
  test('transforms string to CONSTANT_CASE', () => {
    expect(constantize('helloWorld-foo')).toBe('HELLO_WORLD_FOO')
  })
})

describe('pascalize', () => {
  test('transforms string to PascalCase', () => {
    expect(pascalize('hello_world-foo')).toBe('HelloWorldFoo')
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
  test('returns empty string when given empty array', () => {
    expect(joinWithAnd([])).toBe('')
  })

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
})

describe('timeAgo', () => {
  const second = 1000
  const minute = 60 * second
  const hour = 60 * minute
  const day = 24 * hour
  const now = new Date(0)

  test('formats seconds (singular)', () => {
    expect(timeAgo(new Date(now.getTime() - second), now)).toBe('1 second ago')
  })

  test('formats seconds (plural)', () => {
    expect(timeAgo(new Date(now.getTime() - 30 * second), now)).toBe('30 seconds ago')
  })

  test('formats minutes (singular)', () => {
    expect(timeAgo(new Date(now.getTime() - minute), now)).toBe('1 minute ago')
  })

  test('formats minutes (plural)', () => {
    expect(timeAgo(new Date(now.getTime() - 3 * minute), now)).toBe('3 minutes ago')
  })

  test('formats hours (singular)', () => {
    expect(timeAgo(new Date(now.getTime() - hour), now)).toBe('1 hour ago')
  })

  test('formats hours (plural)', () => {
    expect(timeAgo(new Date(now.getTime() - 5 * hour), now)).toBe('5 hours ago')
  })

  test('formats days (singular)', () => {
    expect(timeAgo(new Date(now.getTime() - day), now)).toBe('1 day ago')
  })

  test('formats days (plural)', () => {
    expect(timeAgo(new Date(now.getTime() - 7 * day), now)).toBe('7 days ago')
  })
})
