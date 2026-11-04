/* eslint-disable no-console -- Exercises the upstream library's console output. */
import {withThemeCheckDiagnostics} from './diagnostics.js'
import {runWithCommandEvents} from '@shopify/cli-kit/node/command-events'
import {expect, test, vi} from 'vitest'

test('keeps overlapping checks scoped and restores the console after failures', async () => {
  const original = vi.spyOn(console, 'error').mockImplementation(() => {})
  const firstSink = vi.fn()
  const secondSink = vi.fn()
  let finishFirst!: () => void
  let finishSecond!: () => void
  const firstWait = new Promise<void>((resolve) => {
    finishFirst = resolve
  })
  const secondWait = new Promise<void>((resolve) => {
    finishSecond = resolve
  })
  const first = runWithCommandEvents({outputMode: 'json', sink: firstSink}, () =>
    withThemeCheckDiagnostics(async () => {
      await firstWait
      console.error('First %s', 'warning')
    }),
  )
  const failure = new Error('Check failed')
  const second = runWithCommandEvents({outputMode: 'json', sink: secondSink}, () =>
    withThemeCheckDiagnostics(async () => {
      await secondWait
      console.error('Second warning')
      throw failure
    }),
  )
  const rejected = expect(second).rejects.toBe(failure)
  try {
    console.error('Unrelated output')
    expect(original).toHaveBeenCalledWith('Unrelated output')
    finishFirst()
    await first
    expect(console.error).not.toBe(original)
    finishSecond()
    await rejected
    expect(console.error).toBe(original)
    expect(firstSink).toHaveBeenCalledWith(
      expect.objectContaining({type: 'diagnostic', level: 'warning', message: 'First warning'}),
    )
    expect(secondSink).toHaveBeenCalledWith(
      expect.objectContaining({type: 'diagnostic', level: 'warning', message: 'Second warning'}),
    )
    expect(firstSink).toHaveBeenCalledOnce()
    expect(secondSink).toHaveBeenCalledOnce()
  } finally {
    finishFirst()
    finishSecond()
    await Promise.allSettled([first, second])
  }
})

test('preserves console output in text mode', async () => {
  const original = vi.spyOn(console, 'error').mockImplementation(() => {})
  await runWithCommandEvents({outputMode: 'text'}, () =>
    withThemeCheckDiagnostics(async () => {
      console.error('Text warning')
    }),
  )
  expect(console.error).toBe(original)
  expect(original).toHaveBeenCalledWith('Text warning')
})

test('scopes deferred text notices separately from overlapping JSON diagnostics', async () => {
  const message =
    'Custom Theme Checks are disabled. Explicit authorization is required to execute custom check JavaScript.'
  const original = vi.spyOn(console, 'error').mockImplementation(() => {})
  const textNotice = vi.fn()
  const jsonNotice = vi.fn()
  const jsonSink = vi.fn()
  let finishText!: () => void
  let finishJson!: () => void
  const textWait = new Promise<void>((resolve) => {
    finishText = resolve
  })
  const jsonWait = new Promise<void>((resolve) => {
    finishJson = resolve
  })
  const failure = new Error('Check failed')
  const text = runWithCommandEvents({outputMode: 'text'}, () =>
    withThemeCheckDiagnostics(
      async () => {
        await textWait
        console.error(message)
        console.error('Unrelated config warning')
        throw failure
      },
      {onCustomChecksDisabled: textNotice},
    ),
  )
  const rejected = expect(text).rejects.toBe(failure)
  const json = runWithCommandEvents({outputMode: 'json', sink: jsonSink}, () =>
    withThemeCheckDiagnostics(
      async () => {
        await jsonWait
        console.error(message)
      },
      {onCustomChecksDisabled: jsonNotice},
    ),
  )
  try {
    finishJson()
    await json
    expect(jsonNotice).toHaveBeenCalledOnce()
    expect(textNotice).not.toHaveBeenCalled()
    expect(jsonSink).toHaveBeenCalledWith(expect.objectContaining({type: 'diagnostic', level: 'warning', message}))
    expect(console.error).not.toBe(original)
    finishText()
    await rejected
    expect(textNotice).toHaveBeenCalledOnce()
    expect(original).toHaveBeenCalledExactlyOnceWith('Unrelated config warning')
    expect(console.error).toBe(original)
  } finally {
    finishText()
    finishJson()
    await Promise.allSettled([text, json])
  }
})
/* eslint-enable no-console */
