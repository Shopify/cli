import {FunctionRunData} from '../../../replay.js'
import {AppInterface} from '../../../../../models/app/app.js'
import {FunctionConfigType} from '../../../../../models/extensions/specifications/function.js'
import {ExtensionInstance} from '../../../../../models/extensions/extension-instance.js'
import {setupExtensionWatcher} from '../../../../dev/extension/bundler.js'
import {exec} from '@shopify/cli-kit/node/system'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {useEffect, useRef, useState} from 'react'
import {useInput, useStdin} from '@shopify/cli-kit/node/ink'
import {handleCtrlC, renderFatalError} from '@shopify/cli-kit/node/ui'
import {useAbortSignal} from '@shopify/cli-kit/node/ui/hooks'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {treeKill} from '@shopify/cli-kit/node/tree-kill'
import {FatalError} from '@shopify/cli-kit/node/error'
import {outputWarn} from '@shopify/cli-kit/node/output'
import {Writable} from 'stream'

interface FunctionRun {
  type: 'functionRun'
  input: string
  output: string
  logs: string
  name: string
  size: number
  memory_usage: number
  instructions: number
}

interface SystemMessage {
  type: 'systemMessage'
  message: string
}

type ReplayLog = FunctionRun | SystemMessage

interface WatchFunctionForReplayOptions {
  selectedRun: FunctionRunData
  abortController: AbortController
  app: AppInterface
  extension: ExtensionInstance<FunctionConfigType>
}

export function setupExtensionWatcherForReplay({
  selectedRun,
  abortController,
  app,
  extension,
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
  } as FunctionRun

  const [logs, setLogs] = useState<ReplayLog[]>([])
  const [recentFunctionRuns, setRecentFunctionRuns] = useState<[FunctionRun, FunctionRun]>([
    functionRunFromSelectedRun,
    functionRunFromSelectedRun,
  ])

  const [error, setError] = useState<string | undefined>(undefined)

  const {input, export: runExport} = selectedRun.payload

  const {isRawModeSupported: canUseShortcuts} = useStdin()
  const pollingInterval = useRef<NodeJS.Timeout>()

  const [statusMessage, setStatusMessage] = useState(`Watching for changes to ${selectedRun.source}...`)

  useEffect(() => {
    // run the selectedRun once
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
          setError('')
          setStatusMessage('Re-running with latest changes...')
          const functionRun = await runFunctionRunnerWithLogInput(extension, JSON.stringify(input), runExport)

          setRecentFunctionRuns((recentFunctionRuns) => {
            return [functionRun, recentFunctionRuns[0]]
          })

          setStatusMessage(`Watching for changes to ${selectedRun.source}...`)
          setLogs((logs) => [...logs, functionRun])
        },
        onReloadAndBuildError: async (error) => {
          setError('Error while reloading and building extension')
          if (error instanceof FatalError) {
            renderFatalError(error)
          } else {
            outputWarn(`Failed to replay function: ${error.message}`)
          }
        },
        signal: abortController.signal,
      })
    }
    // Confirm if this is required: a way to clean up watcher?

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    initialReplay()
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    startWatchingFunction()
  }, [input, runExport, app, extension])

  const {isAborted} = useAbortSignal(abortController.signal, async (err) => {
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
  return {logs, isAborted, canUseShortcuts, statusMessage, recentFunctionRuns, error}
}

async function runFunctionRunnerWithLogInput(
  fun: ExtensionInstance<FunctionConfigType>,
  input: string,
  exportName: string,
): Promise<FunctionRun> {
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
