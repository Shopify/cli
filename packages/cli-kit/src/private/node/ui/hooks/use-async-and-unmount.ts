import {useApp} from 'ink'
import {useEffect, useRef} from 'react'

interface Options {
  onFulfilled?: () => unknown
  onRejected?: (error: Error) => void
}

export default function useAsyncAndUnmount(
  asyncFunction: () => Promise<unknown>,
  {onFulfilled = () => {}, onRejected = () => {}}: Options = {},
) {
  const {exit: unmountInk} = useApp()
  const isMounted = useRef(true)

  useEffect(() => {
    asyncFunction()
      .then(() => {
        if (isMounted.current) {
          onFulfilled()
          unmountInk()
        }
      })
      .catch((error) => {
        if (isMounted.current) {
          onRejected(error)
          unmountInk(error)
        }
      })

    return () => {
      isMounted.current = false
    }
  }, [asyncFunction, onFulfilled, onRejected, unmountInk])
}
