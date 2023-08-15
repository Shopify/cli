import {AbortSignal} from '../../../../public/node/abort.js'
import {useApp} from 'ink'
import {useLayoutEffect, useState} from 'react'

const noop = () => {}

export default function useAbortSignal(abortSignal?: AbortSignal, onAbort: () => void = noop) {
  const {exit: unmountInk} = useApp()
  const [isAborted, setIsAborted] = useState(false)

  useLayoutEffect(() => {
    abortSignal?.addEventListener('abort', () => {
      onAbort()
      setIsAborted(true)
      unmountInk()
    })
  }, [])

  return {isAborted}
}
