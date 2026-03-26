import {useApp} from 'ink'
import {useEffect} from 'react'

interface Options {
  onFulfilled?: () => unknown
  onRejected?: (error: Error) => void
}

export default function useAsyncAndUnmount(
  asyncFunction: () => Promise<unknown>,
  {onFulfilled = () => {}, onRejected = () => {}}: Options = {},
) {
  const {exit: unmountInk} = useApp()

  const scheduleUnmount = (error?: Error) => {
    // Defer unmounting to the next setImmediate so React 19 can flush
    // batched state updates before the tree is torn down.
    setImmediate(() => unmountInk(error))
  }

  useEffect(() => {
    asyncFunction()
      .then(() => {
        onFulfilled()
        scheduleUnmount()
      })
      .catch((error) => {
        onRejected(error)
        scheduleUnmount(error)
      })
  }, [])
}
