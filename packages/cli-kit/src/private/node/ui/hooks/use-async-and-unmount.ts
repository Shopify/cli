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

  useEffect(() => {
    asyncFunction()
      .then(() => {
        onFulfilled()
        // Defer unmount so React 19 can flush batched state updates
        // before the component tree is torn down.
        setImmediate(() => unmountInk())
      })
      .catch((error) => {
        onRejected(error)
        setImmediate(() => unmountInk(error))
      })
  }, [])
}
