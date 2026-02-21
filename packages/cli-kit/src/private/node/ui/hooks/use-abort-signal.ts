import {AbortSignal} from '../../../../public/node/abort.js'
import {useApp} from 'ink'
import {useLayoutEffect, useState} from 'react'

const noop = () => Promise.resolve()

export default function useAbortSignal(abortSignal?: AbortSignal, onAbort: (error?: unknown) => Promise<void> = noop) {
  const {exit: unmountInk} = useApp()
  const [isAborted, setIsAborted] = useState(false)

  useLayoutEffect(() => {
    abortSignal?.addEventListener('abort', () => {
      const abortWithError = abortSignal.reason.message === 'AbortError' ? undefined : abortSignal.reason
      onAbort(abortWithError)
        .then(() => {
          setIsAborted(true)
          // Defer unmounting to the next setImmediate so React 19 can flush
          // batched state updates before the tree is torn down.  React 19's
          // scheduler also uses setImmediate in Node.js (check phase), and
          // since it was queued first (by setIsAborted above), it renders
          // before this callback fires (FIFO within the check phase).
          // NOTE: setTimeout(fn, 0) is NOT safe here because its timers-phase
          // fires BEFORE the check phase on slow CI machines where >1 ms has
          // elapsed, causing unmount to race ahead of the render.
          setImmediate(() => unmountInk(abortWithError))
        })
        .catch(() => {})
    })
  }, [])

  return {isAborted}
}
