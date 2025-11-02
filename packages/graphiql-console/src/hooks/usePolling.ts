import {useEffect, useRef} from 'react'

interface UsePollingOptions {
  // Polling interval in milliseconds
  interval: number
  // Whether polling is active (default: true)
  enabled?: boolean
}

/**
 * Generic polling hook that calls a function at regular intervals
 * @param callback - Function to call on each interval
 * @param options - Polling configuration
 */
export function usePolling(callback: () => void | Promise<void>, options: UsePollingOptions) {
  const {interval, enabled = true} = options
  const callbackRef = useRef(callback)

  // Keep callback ref up-to-date
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (!enabled) return

    // Call immediately on mount
    Promise.resolve(callbackRef.current()).catch(() => {
      // Intentionally ignore errors in polling callbacks
    })

    // Set up interval
    const intervalId = setInterval(() => {
      Promise.resolve(callbackRef.current()).catch(() => {
        // Intentionally ignore errors in polling callbacks
      })
    }, interval)

    return () => clearInterval(intervalId)
  }, [interval, enabled])
}
