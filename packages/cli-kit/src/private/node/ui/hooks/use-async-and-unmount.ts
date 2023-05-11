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
        unmountInk()
      })
      .catch((error) => {
        onRejected(error)
        unmountInk(error)
      })
  }, [])
}
