import {useComplete} from '../../ui.js'
import {useEffect, useState} from 'react'

interface Options<T> {
  onFulfilled?: (result: T) => unknown
  onRejected?: (error: Error) => void
}

export default function useAsyncAndUnmount<T>(
  asyncFunction: () => Promise<T>,
  {onFulfilled = () => {}, onRejected = () => {}}: Options<T> = {},
) {
  const complete = useComplete()
  const [result, setResult] = useState<{error?: Error} | null>(null)

  useEffect(() => {
    asyncFunction()
      .then((result) => {
        onFulfilled(result)
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
