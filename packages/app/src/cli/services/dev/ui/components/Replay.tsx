import {FunctionRunData} from '../../../function/replay.js'
import {setupExtensionWatcher} from '../../extension/bundler.js'
import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../../../models/extensions/specifications/function.js'
import {AppInterface} from '../../../../models/app/app.js'
import {prettyPrintJsonIfPossible} from '../../../app-logs/utils.js'
import {exec} from '@shopify/cli-kit/node/system'
import figures from '@shopify/cli-kit/node/figures'
import {AbortController} from '@shopify/cli-kit/node/abort'
import React, {FunctionComponent, useEffect, useMemo, useRef, useState} from 'react'
import {Box, Text, Static, useInput, useStdin} from '@shopify/cli-kit/node/ink'
import {handleCtrlC} from '@shopify/cli-kit/node/ui'
import {useAbortSignal} from '@shopify/cli-kit/node/ui/hooks'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {treeKill} from '@shopify/cli-kit/node/tree-kill'
import {Writable} from 'stream'

export interface ReplayProps {
  selectedRun: FunctionRunData
  abortController: AbortController
  app: AppInterface
  extension: ExtensionInstance<FunctionConfigType>
}

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

const Replay: FunctionComponent<ReplayProps> = ({selectedRun, abortController, app, extension}) => {
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

  const delta = useMemo(() => {
    return recentFunctionRuns[0].instructions - recentFunctionRuns[1].instructions
  }, [recentFunctionRuns])

  const [statusMessage, setStatusMessage] = useState('Default Status Message')
  useEffect(() => {
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
        stdout: customStdout, // TODO
        stderr: customStdout, // TODO
        onChange: async () => {
          const functionRun = await runFunctionRunnerWithLogInput(extension, JSON.stringify(input), runExport)

          setRecentFunctionRuns((recentFunctionRuns) => {
            return [functionRun, recentFunctionRuns[0]]
          })

          setLogs((logs) => [...logs, functionRun])
        },
        onReloadAndBuildError: async (error) => {
          // TODO: handle error
        },
        signal: abortController.signal,
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    startWatchingFunction()

    // TODO: return a way to clean up watcher
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

  return (
    <>
      {/* Scrolling upper section */}
      <Static items={logs}>
        {(log, index) => {
          return (
            <Box key={`randomBoxKey${index}`} flexDirection="column">
              <ReplayLog log={log} />
            </Box>
          )
        }}
      </Static>
      {/* Bottom Bar */}
      <Box
        marginY={1}
        paddingTop={1}
        flexDirection="column"
        flexGrow={1}
        borderStyle="single"
        borderBottom={false}
        borderLeft={false}
        borderRight={false}
        borderTop
      >
        {canUseShortcuts ? (
          <Box flexDirection="column">
            <Box flexDirection="row">
              {/* <Text>{figures.pointerSmall}&nbsp;</Text>
              {selectedRun.status === 'success' ? (
                <Text color="white" backgroundColor="green">
                  {selectedRun.status.toUpperCase()}
                </Text>
              ) : (
                <Text color="white" backgroundColor="red">
                  {selectedRun.status.toUpperCase()}
                </Text>
              )} */}
              <Text>
                {figures.pointerSmall} Watching for changes to {selectedRun.source}...
              </Text>
            </Box>
            <Box flexDirection="column">
              <Text>
                {figures.pointerSmall} Instruction count delta: {delta}
              </Text>
            </Box>
            <Text>
              {figures.pointerSmall} Press <Text bold>q</Text> {figures.lineVertical} quit
            </Text>
          </Box>
        ) : null}
      </Box>
    </>
  )
}

function ReplayLog({log}: {log: ReplayLog}) {
  if (log.type === 'functionRun') {
    return (
      <Box flexDirection="column">
        <Text color="black" backgroundColor="yellow">
          Input
        </Text>
        <Text>{prettyPrintJsonIfPossible(log.input)}</Text>
        <Text color="black" backgroundColor="blue">
          Logs
        </Text>
        <Text>{log.logs}</Text>
        <Text color="black" backgroundColor="green">
          Output
        </Text>
        <Text>{prettyPrintJsonIfPossible(log.output)}</Text>
      </Box>
    )
  }

  if (log.type === 'systemMessage') {
    return <Text>{log.message}</Text>
  }

  return null
}

export {Replay}

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
