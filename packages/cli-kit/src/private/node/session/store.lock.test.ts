import {withSessionStoreLock} from './store.js'
import {inTemporaryDirectory} from '../../../public/node/fs.js'
import {describe, expect, test} from 'vitest'

function deferred() {
  let resolvePromise!: () => void
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve
  })
  return {promise, resolve: resolvePromise}
}

describe('withSessionStoreLock', () => {
  test('serializes session-store operations across callers', async () => {
    await inTemporaryDirectory(async (lockPath) => {
      // Given
      const firstEntered = deferred()
      const releaseFirst = deferred()
      const secondRequested = deferred()
      const events: string[] = []

      // When
      const first = withSessionStoreLock(async () => {
        events.push('first:start')
        firstEntered.resolve()
        await releaseFirst.promise
        events.push('first:end')
      }, lockPath)

      await firstEntered.promise
      const second = (async () => {
        secondRequested.resolve()
        await withSessionStoreLock(async () => {
          events.push('second:start')
          events.push('second:end')
        }, lockPath)
      })()
      await secondRequested.promise
      releaseFirst.resolve()
      await Promise.all([first, second])

      // Then
      expect(events).toEqual(['first:start', 'first:end', 'second:start', 'second:end'])
    })
  })

  test('releases the lock when the operation fails', async () => {
    await inTemporaryDirectory(async (lockPath) => {
      // Given
      const operationError = new Error('session update failed')

      // When
      await expect(
        withSessionStoreLock(async () => {
          throw operationError
        }, lockPath),
      ).rejects.toBe(operationError)

      // Then
      await expect(withSessionStoreLock(async () => 'completed', lockPath)).resolves.toBe('completed')
    })
  })
})
