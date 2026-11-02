import {FunctionRunData} from '../../../../replay.js'
import {AppLinkedInterface} from '../../../../../../models/app/app.js'
import {FunctionConfigType} from '../../../../../../models/extensions/specifications/function.js'
import {ExtensionInstance} from '../../../../../../models/extensions/extension-instance.js'
import {FunctionRunFromRunner, ReplayLog} from '../types.js'
import {watchReplay, ReplayWatchEvent} from '../../../../replay/watch.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {useEffect, useState} from 'react'
import {useAbortSignal} from '@shopify/cli-kit/node/ui/hooks'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {treeKill} from '@shopify/cli-kit/node/tree-kill'

interface WatchFunctionForReplayOptions {
  selectedRun: FunctionRunData
  abortController: AbortController
  app: AppLinkedInterface
  extension: ExtensionInstance<FunctionConfigType>
}

export function useFunctionWatcher({selectedRun, abortController, app, extension}: WatchFunctionForReplayOptions) {
  const functionRunFromSelectedRun = {
    type: 'functionRun',
    input: selectedRun.payload.input,
    output: selectedRun.payload.output,
    logs: selectedRun.payload.logs,
    name: selectedRun.source,
    size: 0,
    memory_usage: 0,
    instructions: selectedRun.payload.fuelConsumed,
  } as FunctionRunFromRunner

  const [logs, setLogs] = useState<ReplayLog[]>([])
  const [recentFunctionRuns, setRecentFunctionRuns] = useState<[FunctionRunFromRunner, FunctionRunFromRunner]>([
    functionRunFromSelectedRun,
    functionRunFromSelectedRun,
  ])

  const [error, setError] = useState<string | undefined>(undefined)

  const [statusMessage, setStatusMessage] = useState(`Watching for changes to ${selectedRun.source}...`)

  useEffect(() => {
    let mounted = true
    let hasExecuted = false
    const watchAbortController = new AbortController()
    const abort = () => watchAbortController.abort()
    abortController.signal.addEventListener('abort', abort, {once: true})
    if (abortController.signal.aborted) abort()

    const watchingMessage = `Watching for changes to ${selectedRun.source}...`
    const onEvent = (event: ReplayWatchEvent) => {
      if (!mounted) return
      switch (event.type) {
        case 'status':
          if (event.status === 'watching') {
            setStatusMessage(watchingMessage)
          } else if (event.status === 'running') {
            setStatusMessage(hasExecuted ? 'Re-running with latest changes...' : 'Replaying log with local function...')
          }
          break
        case 'build':
          setError(
            event.status === 'failed' ? `Error while reloading and building extension: ${event.error}` : undefined,
          )
          break
        case 'execution': {
          const functionRun: FunctionRunFromRunner = {...JSON.parse(event.resultJson), type: 'functionRun'}
          hasExecuted = true
          setRecentFunctionRuns((recentFunctionRuns) => [functionRun, recentFunctionRuns[0]])
          setStatusMessage(watchingMessage)
          setLogs((logs) => [...logs, functionRun])
          break
        }
        case 'diagnostic':
          setLogs((logs) => [...logs, {type: 'systemMessage', message: event.message}])
          break
      }
    }

    watchReplay({selectedRun, app, extension, abortController: watchAbortController, onEvent}).catch(
      (error: unknown) => {
        if (mounted) setError(error instanceof Error ? error.message : String(error))
      },
    )

    return () => {
      mounted = false
      abortController.signal.removeEventListener('abort', abort)
      watchAbortController.abort()
    }
  }, [selectedRun, app, extension, abortController])

  useAbortSignal(abortController.signal, async () => {
    setTimeout(() => {
      if (isUnitTest()) return
      treeKill(process.pid, 'SIGINT', false, () => {
        process.exit(0)
      })
    }, 2000)
  })

  return {logs, statusMessage, recentFunctionRuns, error}
}
