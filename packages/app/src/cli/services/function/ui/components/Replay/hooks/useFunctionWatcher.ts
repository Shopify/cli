import {FunctionRunData} from '../../../../replay.js'
import {AppInterface} from '../../../../../../models/app/app.js'
import {FunctionConfigType} from '../../../../../../models/extensions/specifications/function.js'
import {ExtensionInstance} from '../../../../../../models/extensions/extension-instance.js'
import {setupExtensionWatcher} from '../../../../../dev/extension/bundler.js'
import {FunctionRunFromRunner, ReplayLog} from '../types.js'
import {exec} from '@shopify/cli-kit/node/system'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {useEffect, useRef, useState} from 'react'
import {useInput, useStdin} from '@shopify/cli-kit/node/ink'
import {handleCtrlC} from '@shopify/cli-kit/node/ui'
import {useAbortSignal} from '@shopify/cli-kit/node/ui/hooks'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {treeKill} from '@shopify/cli-kit/node/tree-kill'
import {FatalError} from '@shopify/cli-kit/node/error'
import {Writable} from 'stream'

interface WatchFunctionForReplayOptions {
  selectedRun: FunctionRunData
  abortController: AbortController
  app: AppInterface
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

  const {input, export: runExport} = selectedRun.payload

  const {isRawModeSupported: canUseShortcuts} = useStdin()
  const pollingInterval = useRef<NodeJS.Timeout>()

  const [statusMessage, setStatusMessage] = useState(`Watching for changes to ${selectedRun.source}...`)

  useEffect(() => {
    const initialReplay = async () => {
      setStatusMessage('Replaying log with local function...')
      const functionRun = await runFunctionRunnerWithLogInput(extension, JSON.stringify(input), runExport)
      setRecentFunctionRuns((recentFunctionRuns) => {
        return [functionRun, recentFunctionRuns[0]]
      })
      setStatusMessage(`Watching for changes to ${selectedRun.source}...`)
      setLogs((logs) => [...logs, functionRun])
    }

    const startWatchingFunction = async () => {
      const customStdout = new Writable({
        write(chunk, _enconding, next) {
          setLogs((logs) => [...logs, {type: 'systemMessage', message: chunk.toString()}])
          next()
        },
      })

      await setupExtensionWatcher({
        extension,
        app,
        stdout: customStdout,
        stderr: customStdout,
        onChange: async () => {
          setError(undefined)
          setStatusMessage('Re-running with latest changes...')
          const functionRun = await runFunctionRunnerWithLogInput(extension, JSON.stringify(input), runExport)

          setRecentFunctionRuns((recentFunctionRuns) => {
            return [functionRun, recentFunctionRuns[0]]
          })

          setStatusMessage(`Watching for changes to ${selectedRun.source}...`)
          setLogs((logs) => [...logs, functionRun])
        },
        onReloadAndBuildError: async (error) => {
          if (error instanceof FatalError) {
            setError(`Fatal error while reloading and building extension: ${error.formattedMessage || error.message}`)
          } else {
            setError(`Error while reloading and building extension: ${error.message}`)
          }
        },
        signal: abortController.signal,
      })
    }

    // eslint-disable-next-line promise/catch-or-return, @typescript-eslint/no-floating-promises
    initialReplay().then(() => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      startWatchingFunction()
    })
  }, [input, runExport, app, extension])

  useAbortSignal(abortController.signal, async (err) => {
    if (err) {
      setStatusMessage('Shutting down replay watcher because of an error ...')
    } else {
      setStatusMessage('Shutting down replay watcher ...')
      setTimeout(() => {
        if (isUnitTest()) return
        treeKill(process.pid, 'SIGINT', false, () => {
          process.exit(0)
        })
      }, 2000)
    }
    clearInterval(pollingInterval.current)
  })

  useInput(
    (input, key) => {
      handleCtrlC(input, key, () => abortController.abort())

      const onInput = async () => {
        try {
          setError('')

          if (input === 'q') {
            abortController.abort()
          }
          // eslint-disable-next-line no-catch-all/no-catch-all
        } catch (_) {
          setError('Failed to handle your input.')
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      onInput()
    },
    {isActive: Boolean(canUseShortcuts)},
  )
  return {logs, canUseShortcuts, statusMessage, recentFunctionRuns, error}
}

async function runFunctionRunnerWithLogInput(
  fun: ExtensionInstance<FunctionConfigType>,
  input: string,
  exportName: string,
): Promise<FunctionRunFromRunner> {
  let functionRunnerOutput = ''
  const customStdout = new Writable({
    write(chunk, _encoding, next) {
      functionRunnerOutput += chunk
      next()
    },
  })

  await exec('npm', ['exec', '--', 'function-runner', '--json', '-f', fun.outputPath, '--export', exportName], {
    cwd: fun.directory,
    input,
    stdout: customStdout,
    stderr: 'inherit',
  })

  const result = JSON.parse(functionRunnerOutput)
  return {...result, type: 'functionRun'}
}
