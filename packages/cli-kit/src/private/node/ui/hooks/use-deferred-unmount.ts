import {useApp} from 'ink'
import {useCallback} from 'react'

export default function useDeferredUnmount() {
  const {exit: unmountInk} = useApp()

  return useCallback(
    (error?: Parameters<typeof unmountInk>[0]) => {
      // Defer unmounting to the next setImmediate so React 19 can flush
      // batched state updates before the tree is torn down. React 19's
      // scheduler also uses setImmediate in Node.js, so the submitted
      // prompt frame renders before this callback fires.
      setImmediate(() => unmountInk(error))
    },
    [unmountInk],
  )
}
