import CheckPattern from './check-pattern.js'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {afterEach, describe, expect, test} from 'vitest'

const output = await mockAndCaptureOutput()

describe('Check-Pattern', () => {
  afterEach(() => {
    output.clear()
  })

  test('should call outputInfo with valid JSON if json flag is provided', async () => {
    // Given
    const args = [`--path=/tmp/`, `--pattern=*.json`, `--json`]
    // When
    const checkPattern = new CheckPattern(args, {} as any)
    await checkPattern.run()
    // Then
    const stdoutOutput = output.info()
    expect(JSON.parse(stdoutOutput)).toBeTruthy()
    expect(stdoutOutput).toMatchObject(
      JSON.stringify({
        '*.json': [],
      }),
    )
  })

  test.only('should render a success output if json flag is not provided', async () => {
    // Given
    const args = [`--path=/tmp/`, `--pattern=templates/*.json`]

    // When
    const checkPattern = new CheckPattern(args, {} as any)
    await checkPattern.run()

    // Then
    expect(output.info()).toMatchInlineSnapshot(`
    "╭─ success ────────────────────────────────────────────────────────────────────╮
│                                                                              │
│  Theme file pattern matching results:                                        │
│                                                                              │
│  No matches for: templates/*.json                                            │
│                                                                              │
╰──────────────────────────────────────────────────────────────────────────────╯
"`)
  })
})
