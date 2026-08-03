import {createSyncDiagnosticChannel} from './index.js'
import {describe, expect, test} from 'vitest'

describe('createSyncDiagnosticChannel', () => {
  test('delivers synchronously in registration order and isolates observer failures', () => {
    const calls: string[] = []
    const channel = createSyncDiagnosticChannel<{level: 'debug'; message: string; value: string}>(
      () => {
        calls.push('first')
        throw new Error('failure')
      },
      () => calls.push('second'),
    )

    channel.emit({level: 'debug', message: 'message', value: 'value'})

    expect(calls).toEqual(['first', 'second'])
  })
})
