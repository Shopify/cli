import {FunctionRunData} from '../../../../replay.js'
import {AppLinkedInterface} from '../../../../../../models/app/app.js'
import {FunctionConfigType} from '../../../../../../models/extensions/specifications/function.js'
import {ExtensionInstance} from '../../../../../../models/extensions/extension-instance.js'
import {FunctionRunFromRunner, ReplayLog} from '../types.js'
import {runFunction} from '../../../../runner.js'
import {AppEventWatcher, EventType} from '../../../../../dev/app-events/app-event-watcher.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {useEffect, useState} from 'react'
import {useAbortSignal} from '@shopify/cli-kit/node/ui/hooks'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {treeKill} from '@shopify/cli-kit/node/tree-kill'
import {Writable} from 'stream'

interface WatchFunctionForReplayOptions {
  selectedRun: FunctionRunData
  abortController: AbortController
  app: AppLinkedInterface
  extension: ExtensionInstance<FunctionConfigType>
  appWatcher?: AppEventWatcher
}

export function useFunctionWatcher({
  selectedRun,
  abortController,
  app,
  extension,
  appWatcher,
}: WatchFunctionForReplayOptions) {
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

  const {input, export: runExport} = selectedRun.payload

  const [statusMessage, setStatusMessage] = useState(`Watching for changes to ${selectedRun.source}...`)

  const appWatcherInstance = appWatcher ?? new AppEventWatcher(app)

  useEffect(() => {
    const watchAbortController = new AbortController()
    abortController.signal.addEventListener('abort', () => {
      watchAbortController.abort()
    })

    const runFunction = async () => {
      const functionRun = await runFunctionRunnerWithLogInput(extension, JSON.stringify(input), runExport)
      setRecentFunctionRuns((recentFunctionRuns) => {
        return [functionRun, recentFunctionRuns[0]]
      })
      setStatusMessage(`Watching for changes to ${selectedRun.source}...`)
      setLogs((logs) => [...logs, functionRun])
    }

    const initialReplay = async () => {
      setStatusMessage('Replaying log with local function...')
      await runFunction()
    }

    const startWatchingFunction = async () => {
      appWatcherInstance.onEvent(async (event) => {
        const functionExt = event.extensionEvents.find((extEvent) => extEvent.extension.handle === extension.handle)
        if (!functionExt || functionExt.type !== EventType.Updated) return
        if (functionExt.buildResult?.status === 'error') {
          setError(`Error while reloading and building extension: ${functionExt.buildResult?.error}`)
          return
        }
        setError(undefined)
        setStatusMessage('Re-running with latest changes...')
        await runFunction()
      })

      const customStdout = new Writable({
        write(chunk, _enconding, next) {
          setLogs((logs) => [...logs, {type: 'systemMessage', message: chunk.toString()}])
          next()
        },
      })

      await appWatcherInstance.start({stdout: customStdout, stderr: customStdout, signal: watchAbortController.signal})
    }

    // eslint-disable-next-line promise/catch-or-return, @typescript-eslint/no-floating-promises
    initialReplay().then(() => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      startWatchingFunction()
    })

    return () => {
      watchAbortController.abort()
    }
  }, [input, runExport, app, extension])

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

async function runFunctionRunnerWithLogInput(
  fun: ExtensionInstance<FunctionConfigType>,
  input: string,
  exportName: string,
): Promise<FunctionRunFromRunner> {
  let functionRunnerOutput = ''
  const customStdout = new Writable({
    write(chunk, _encoding, next) {
      functionRunnerOutput += chunk as string
      next()
    },
  })

  await runFunction({functionExtension: fun, input, export: exportName, stdout: customStdout, json: true})

  const result = JSON.parse(functionRunnerOutput)
  return {...result, type: 'functionRun'}
}
