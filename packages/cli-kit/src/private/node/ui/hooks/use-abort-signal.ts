import {AbortSignal} from '../../../../public/node/abort.js'
import {useComplete} from '../../ui.js'
import {useEffect, useLayoutEffect, useState} from 'react'

const noop = () => Promise.resolve()

export default function useAbortSignal(abortSignal?: AbortSignal, onAbort: (error?: unknown) => Promise<void> = noop) {
  const complete = useComplete()
  const [isAborted, setIsAborted] = useState(false)

  useLayoutEffect(() => {
    abortSignal?.addEventListener('abort', () => {
      const abortWithError = abortSignal.reason.message === 'AbortError' ? undefined : abortSignal.reason
      onAbort(abortWithError)
        .then(() => setIsAborted(true))
        .catch(() => {})
    })
  }, [])

  useEffect(() => {
    if (isAborted) {
      const abortWithError = abortSignal?.reason?.message === 'AbortError' ? undefined : abortSignal?.reason
      complete(abortWithError)
    }
  }, [isAborted])

  return {isAborted}
}
