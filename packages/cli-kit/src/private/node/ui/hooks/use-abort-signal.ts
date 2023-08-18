import {AbortSignal} from '../../../../public/node/abort.js'
import {useApp} from 'ink'
import {useLayoutEffect, useState} from 'react'

const noop = () => Promise.resolve()

export default function useAbortSignal(abortSignal?: AbortSignal, onAbort: () => Promise<void> = noop) {
  const {exit: unmountInk} = useApp()
  const [isAborted, setIsAborted] = useState(false)

  useLayoutEffect(() => {
    abortSignal?.addEventListener('abort', () => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises, promise/catch-or-return
      onAbort().then(() => {
        setIsAborted(true)
        unmountInk()
      })
    })
  }, [])

  return {isAborted}
}
