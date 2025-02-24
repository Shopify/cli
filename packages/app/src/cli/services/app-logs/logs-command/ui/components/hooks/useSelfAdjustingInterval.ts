import {useRef, useEffect} from 'react'

export function useSelfAdjustingInterval<T extends {retryIntervalMs: number | null}>(callback: () => Promise<T>) {
  const savedCallback = useRef(callback)
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    let id: NodeJS.Timeout
    function tick() {
      const ret = savedCallback.current()
      ret
        .then(({retryIntervalMs}) => {
          if (retryIntervalMs) {
            id = setTimeout(tick, retryIntervalMs)
          }
        })
        .catch(() => {
          // stop interval on error/rejection
        })
    }
    id = setTimeout(tick, 0)
    return () => id && clearTimeout(id)
  }, [])
}
