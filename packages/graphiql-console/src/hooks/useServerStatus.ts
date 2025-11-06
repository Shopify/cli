/* eslint-disable no-restricted-globals */
/* eslint-disable no-catch-all/no-catch-all */
// Browser environment - fetch is the correct API, not @shopify/cli-kit/node/http
// Catch blocks intentionally handle all errors as server unavailability

import {usePolling} from './usePolling.ts'
import {useState, useCallback, useRef} from 'react'
import type {ServerStatus} from '@/components/types'

interface UseServerStatusOptions {
  // e.g., "http://localhost:3457"
  baseUrl: string
  // Default: 2000ms
  pingInterval?: number
  // Default: 5000ms
  statusInterval?: number
  // Default: 3000ms
  pingTimeout?: number
}

/**
 * Hook that monitors server health and app installation status
 * Replaces vanilla JS polling logic from current implementation
 */
export function useServerStatus(options: UseServerStatusOptions) {
  const {baseUrl, pingInterval = 2000, statusInterval = 5000, pingTimeout = 3000} = options

  const [status, setStatus] = useState<ServerStatus>({
    serverIsLive: true,
    appIsInstalled: true,
  })

  const timeoutRefs = useRef<NodeJS.Timeout[]>([])

  // Ping polling: Check if server is running
  const checkServerPing = useCallback(async () => {
    // Set timeout to mark server dead after pingTimeout ms
    const timeoutId = setTimeout(() => {
      setStatus((prev) => ({...prev, serverIsLive: false}))
    }, pingTimeout)
    timeoutRefs.current.push(timeoutId)

    try {
      const response = await fetch(`${baseUrl}/graphiql/ping`, {
        method: 'GET',
      })

      if (response.status === 200) {
        // Clear all pending "mark dead" timeouts
        timeoutRefs.current.forEach((id) => clearTimeout(id))
        timeoutRefs.current = []
        setStatus((prev) => ({...prev, serverIsLive: true}))
      } else {
        setStatus((prev) => ({...prev, serverIsLive: false}))
      }
    } catch {
      // Network error - server is down
      setStatus((prev) => ({...prev, serverIsLive: false}))
    }
  }, [baseUrl, pingTimeout])

  // Status polling: Check app installation and get store info
  const checkAppStatus = useCallback(async () => {
    try {
      const response = await fetch(`${baseUrl}/graphiql/status`, {
        method: 'GET',
      })
      const data = await response.json()

      if (data.status === 'OK') {
        setStatus((prev) => ({
          ...prev,
          appIsInstalled: true,
          storeFqdn: data.storeFqdn,
          appName: data.appName,
          appUrl: data.appUrl,
        }))
      } else {
        setStatus((prev) => ({
          ...prev,
          appIsInstalled: false,
        }))
      }
    } catch {
      // If status check fails, assume app is not installed
      setStatus((prev) => ({...prev, appIsInstalled: false}))
    }
  }, [baseUrl])

  // Set up polling
  usePolling(checkServerPing, {interval: pingInterval})
  usePolling(checkAppStatus, {interval: statusInterval})

  return status
}
