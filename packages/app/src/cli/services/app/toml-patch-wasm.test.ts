import {echoToml, updateTomlValues} from './toml-patch-wasm.js'
import {describe, expect, test} from 'vitest'

// Sample TOML content for testing
const sampleToml = `
# This is a sample TOML file
title = "TOML Example"

[owner]
name = "Test User"
organization = "Test Org"

[database]
server = "192.168.1.1"
ports = [ 8001, 8001, 8002 ] # Comment after array
enabled = true
`

describe('WASM TOML Patch Integration', () => {
  test('echoToml should correctly echo TOML content', async () => {
    // Test with sample TOML content
    const result = await echoToml(sampleToml)

    // Verify the content is echoed correctly
    expect(result).toBe(sampleToml)
  })

  test('echoToml should preserve formatting and comments', async () => {
    // Create a TOML string with specific formatting and comments
    const formattedToml = `
# Header comment
title = "Example"  # Inline comment

  # Indented comment
[section]
  key = "value"    # Another comment

  # Empty line before this comment
  array = [
    # Comment in array
    1,
    2  # Comment after item
  ]
`
    // Test with formatted TOML content
    const result = await echoToml(formattedToml)

    // Verify format and comments are preserved
    expect(result).toBe(formattedToml)
    expect(result).toContain('# Header comment')
    expect(result).toContain('# Inline comment')
    expect(result).toContain('# Indented comment')
    expect(result).toContain('# Comment in array')
    expect(result).toContain('# Comment after item')
  })

  test('echoToml should reject with error when parsing invalid TOML', async () => {
    // Examples of invalid TOML
    const invalidToml = `
    title = "Unclosed string
    [section
    key = value
    `

    // Verify error contains specific details about the parsing error
    await expect(echoToml(invalidToml)).rejects.toMatch(/TOML parse error/)

    // Additional assertions for specific parts of the error message
    await expect(echoToml(invalidToml)).rejects.toMatch(/invalid basic string/)
    await expect(echoToml(invalidToml)).rejects.toMatch(/line \d+, column \d+/)
  })

  test('updating TOML makes minimal changes and preserves as much as possible', async () => {
    const output = await updateTomlValues(sampleToml, [
      ['owner.dotted.notation', 123.5],
      ['database.server', 'changed'],
      ['top_level', true],
      ['owner.organization', undefined],
    ])

    const expected = `
# This is a sample TOML file
title = "TOML Example"
top_level = true

[owner]
name = "Test User"
dotted.notation = 123.5

[database]
server = "changed"
ports = [ 8001, 8001, 8002 ] # Comment after array
enabled = true
`

    expect(output).toBe(expected)
  })
})
