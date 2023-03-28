import AutocorrectStatus from './status.js'
import {isAutocorrectEnabled} from '../../../services/conf.js'
import {Config} from '@oclif/core'
import {describe, expect, vi, test} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('../../../services/conf.js')

describe('Autocorrect Status', () => {
  test('Displays autocorrect off message if Autocorrect is off', async () => {
    // Given
    vi.mocked(isAutocorrectEnabled).mockReturnValue(false)
    const config = new Config({root: __dirname})
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()
    // When
    await new AutocorrectStatus([], config).run()

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
    const config = new Config({root: __dirname})
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()
    // When
    await new AutocorrectStatus([], config).run()

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
