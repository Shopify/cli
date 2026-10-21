import AutocorrectOff from './off.js'
import {setAutocorrect} from '../../../services/conf.js'
import {describe, expect, vi, test} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('../../../services/conf.js')

describe('AutocorrectOff', () => {
  test('Update autocorrect config to disabled', async () => {
    // Given
    const outputMock = mockAndCaptureOutput()

    // When
    await AutocorrectOff.run([], import.meta.url)

    // Then
    expect(setAutocorrect).toBeCalledWith(false)
    expect(outputMock.info()).toMatchInlineSnapshot(`
    "╭─ info ───────────────────────────────────────────────────────────────────────╮
    │                                                                              │
    │  Autocorrect off. You'll need to confirm corrections for mistyped commands.  │
    │                                                                              │
    ╰──────────────────────────────────────────────────────────────────────────────╯
    "
  `)
  })
})
