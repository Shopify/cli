import {useComplete} from '../../ui.js'
import {useEffect, useState} from 'react'

interface Options {
  onFulfilled?: () => unknown
  onRejected?: (error: Error) => void
}

export default function useAsyncAndUnmount(
  asyncFunction: () => Promise<unknown>,
  {onFulfilled = () => {}, onRejected = () => {}}: Options = {},
) {
  const complete = useComplete()
  const [result, setResult] = useState<{error?: Error} | null>(null)

  useEffect(() => {
    asyncFunction()
      .then(() => {
        onFulfilled()
        setResult({})
      })
      .catch((error) => {
        onRejected(error)
        setResult({error})
      })
  }, [])

  useEffect(() => {
    if (result !== null) {
      complete(result.error)
    }
  }, [result])
}
