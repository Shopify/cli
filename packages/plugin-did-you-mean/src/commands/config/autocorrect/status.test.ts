import AutocorrectStatus from './status.js'
import {isAutocorrectEnabled} from '../../../services/conf.js'
import {describe, expect, vi, test} from 'vitest'
import {mockAndCaptureOutput, withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'

vi.mock('../../../services/conf.js')

describe('Autocorrect Status', () => {
  test.each([true, false])('returns JSON when autocorrect is %s', async (enabled) => {
    vi.mocked(isAutocorrectEnabled).mockReturnValue(enabled)
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await AutocorrectStatus.run(['--json'], import.meta.url)

      expect(stdout()).toBe(`${JSON.stringify({enabled}, null, 2)}\n`)
      expect(stderr()).toBe('')
    })
  })

  test('Displays autocorrect off message if Autocorrect is off', async () => {
    // Given
    vi.mocked(isAutocorrectEnabled).mockReturnValue(false)
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()
    // When
    await AutocorrectStatus.run([], import.meta.url)

    // Then
    expect(outputMock.info()).toMatchInlineSnapshot(`
    "╭─ info ───────────────────────────────────────────────────────────────────────╮
    │                                                                              │
    │  Autocorrect off. You'll need to confirm corrections for mistyped commands.  │
    │                                                                              │
    ╰──────────────────────────────────────────────────────────────────────────────╯
    "
  `)
  })

  test('Displays autocorrect on message if Autocorrect is on', async () => {
    // Given
    vi.mocked(isAutocorrectEnabled).mockReturnValue(true)
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()
    // When
    await AutocorrectStatus.run([], import.meta.url)

    // Then
    expect(outputMock.info()).toMatchInlineSnapshot(`
    "╭─ info ───────────────────────────────────────────────────────────────────────╮
    │                                                                              │
    │  Autocorrect on. The system will automatically run commands even when you    │
    │  mistype them.                                                               │
    │                                                                              │
    ╰──────────────────────────────────────────────────────────────────────────────╯
    "
    `)
  })
})
