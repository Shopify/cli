import {AbortSignal} from '../../../../public/node/abort.js'
import {useComplete} from '../../ui.js'
import {useEffect, useLayoutEffect, useState} from 'react'

const noop = () => Promise.resolve()

function getAbortError(abortSignal?: AbortSignal) {
  return abortSignal?.reason?.name === 'AbortError' ? undefined : abortSignal?.reason
}

export default function useAbortSignal(abortSignal?: AbortSignal, onAbort: (error?: unknown) => Promise<void> = noop) {
  const complete = useComplete()
  const [isAborted, setIsAborted] = useState(false)

  useLayoutEffect(() => {
    abortSignal?.addEventListener('abort', () => {
      onAbort(getAbortError(abortSignal))
        .then(() => setIsAborted(true))
        .catch(() => {})
    })
  }, [])

  useEffect(() => {
    if (isAborted) {
      complete(getAbortError(abortSignal))
    }
  }, [isAborted])

  return {isAborted}
}
