import AutocorrectOn from './on.js'
import {setAutocorrect} from '../../../services/conf.js'
import {Config} from '@oclif/core'
import {describe, expect, vi, test} from 'vitest'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('../../../services/conf.js')

describe('AutocorrectOn', () => {
  test('Enables autocorrect config to on', async () => {
    // Given
    const config = new Config({root: __dirname})
    const outputMock = mockAndCaptureOutput()

    // When
    await new AutocorrectOn([], config).run()

    // Then
    expect(setAutocorrect).toBeCalledWith(true)

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
