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
          unmountInk(abortWithError)
        })
        .catch(() => {})
    })
  }, [])

  return {isAborted}
}
