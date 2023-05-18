import {askFor, command} from './command-helpers.js'
import * as loader from '../models/app/loader.js'
import {test, expect, describe, vi, beforeEach} from 'vitest'
import {Flags} from '@oclif/core'

vi.mock('../models/app/loader.js')

describe('command factory', () => {
  beforeEach(() => {})
  test('does the thing', async () => {
    vi.mocked(loader.load).mockReturnValue({app: true} as any)

    // Given
    const serviceFn = vi.fn()
    const CommandClass = command(
      'test',
      {
        notProvidedSoUsesPrompt: Flags.string(),
        withDefault: Flags.string({default: 'has default'}),
        mandatory: Flags.string({required: true}),
        providedAsFlag: Flags.string(),
      },
      askFor([
        {key: 'providedViaPrompt', ask: () => Promise.resolve(123)},
        {key: 'notProvidedSoUsesPrompt', ask: () => Promise.resolve('from prompt')},
        {key: 'providedAsFlag', ask: () => Promise.resolve("shouldn't happen")},
      ] as const),
      serviceFn,
    )

    // When
    const commandInstance = new CommandClass(['--mandatory', 'provided', '--providedAsFlag', 'from flag'], {} as any)
    await commandInstance.run()

    // Expect
    expect(serviceFn).toBeCalledWith(
      {app: true},
      {
        providedViaPrompt: 123,
        notProvidedSoUsesPrompt: 'from prompt',
        path: expect.any(String),
        withDefault: 'has default',
        mandatory: 'provided',
        providedAsFlag: 'from flag',
      },
    )
  })
})
