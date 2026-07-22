import {assembleCommandTokens, previewCommandLine} from './command-line.js'
import {describe, expect, test} from 'vitest'

describe('assembleCommandTokens', () => {
  test('emits positional args first, in the given order, then flags', () => {
    // Given
    const args = [
      {name: 'source', value: 'src'},
      {name: 'target', value: 'dst'},
    ]
    const flags = [{name: 'path', kind: 'string' as const, value: './foo'}]

    // When
    const tokens = assembleCommandTokens(args, flags)

    // Then
    expect(tokens).toEqual(['src', 'dst', '--path', './foo'])
  })

  test('a true boolean flag becomes a lone --name; a false boolean is omitted', () => {
    // Given
    const flags = [
      {name: 'reset', kind: 'boolean' as const, value: true},
      {name: 'force', kind: 'boolean' as const, value: false},
    ]

    // When
    const tokens = assembleCommandTokens([], flags)

    // Then
    expect(tokens).toEqual(['--reset'])
  })

  test('a false boolean that allows negation emits --no-name', () => {
    // Given
    const flags = [
      {name: 'watch', kind: 'boolean' as const, value: false, allowNo: true},
      {name: 'tunnel', kind: 'boolean' as const, value: true, allowNo: true},
    ]

    // When
    const tokens = assembleCommandTokens([], flags)

    // Then: false + allowNo → negated form; true stays the plain form.
    expect(tokens).toEqual(['--no-watch', '--tunnel'])
  })

  test('enum and integer flags emit --name value', () => {
    // Given
    const flags = [
      {name: 'mode', kind: 'enum' as const, value: 'fast'},
      {name: 'limit', kind: 'integer' as const, value: '10'},
    ]

    // When
    const tokens = assembleCommandTokens([], flags)

    // Then
    expect(tokens).toEqual(['--mode', 'fast', '--limit', '10'])
  })
})

describe('previewCommandLine', () => {
  test('renders the colon-separated id in spaced form with the bin name', () => {
    expect(previewCommandLine('shopify', 'app:dev', ['--reset'])).toBe('shopify app dev --reset')
  })

  test('quotes tokens that contain whitespace', () => {
    expect(previewCommandLine('shopify', 'theme:push', ['--path', './my theme'])).toBe(
      'shopify theme push --path "./my theme"',
    )
  })
})
