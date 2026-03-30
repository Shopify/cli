import useDeferredUnmount from './use-deferred-unmount.js'
import {render, waitFor} from '../../testing/ui.js'
import {describe, expect, test, vi} from 'vitest'

import React, {useEffect} from 'react'

function DeferredUnmountHarness({
  onReady,
}: {
  onReady: (deferredUnmount: ReturnType<typeof useDeferredUnmount>) => void
}) {
  const deferredUnmount = useDeferredUnmount()

  useEffect(() => {
    onReady(deferredUnmount)
  }, [deferredUnmount, onReady])

  return null
}

describe('useDeferredUnmount', () => {
  test('defers exit asynchronously and forwards the provided error', async () => {
    const onReady = vi.fn()
    const renderInstance = render(<DeferredUnmountHarness onReady={onReady} />)

    await waitFor(
      () => {},
      () => onReady.mock.calls.length > 0,
    )

    const deferredUnmount = onReady.mock.lastCall?.[0]
    const error = new Error('deferred failure')
    const renderPromise = renderInstance.waitUntilExit()

    deferredUnmount(error)

    expect(renderPromise.isPending()).toBe(true)
    expect(renderPromise.isFulfilled()).toBe(false)
    expect(renderPromise.isRejected()).toBe(false)

    await expect(renderPromise).rejects.toThrowError(error)
  })
})
