import {Box, Text, Static, useInput, useStdin} from '@shopify/cli-kit/node/ink'
import React, {FunctionComponent, useEffect, useMemo, useRef, useState} from 'react'

import figures from '@shopify/cli-kit/node/figures'
import {FunctionRunData} from '../../../function/replay.js'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {setupExtensionWatcher} from '../../extension/bundler.js'
import {exec} from '@shopify/cli-kit/node/system'
import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../../../models/extensions/specifications/function.js'
import {AppInterface} from '../../../../models/app/app.js'
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
}

interface SystemMessage {
  type: 'systemMessage'
  message: string
}

type ReplayLog = FunctionRun | SystemMessage

const Replay: FunctionComponent<ReplayProps> = ({selectedRun, abortController, app, extension}) => {
  const now = new Date()
  const season = now.getMonth() > 3 ? 'Summer' : 'Winter'
  const year = now.getFullYear()

  // const [functionRuns, setFunctionRuns] = useState<FunctionRun[]>([])
  // const [replayLogs, setReplayLogs] = useState<String[]>([])
  const [logs, setLogs] = useState<ReplayLog[]>([])

  const {input, export: runExport} = selectedRun.payload

  useEffect(() => {
    const startWatchingFunction = async () => {
      const customStdout = new Writable({
        write(chunk, _enconding, next) {
          setLogs((logs) => [...logs, {type: 'systemMessage', message: chunk.toString()}])
          next()
        },
      })

      ;(global as any).andrewStdout = customStdout

      await setupExtensionWatcher({
        extension,
        app,
        stdout: customStdout, // TODO
        stderr: customStdout, // TODO
        onChange: async () => {
          // console.log("in onChange")
          // setLogs((logs) => [...logs, {type: 'systemMessage', message: 'Changes detected, rebuilding and rerunning'}])
          const functionRun = await runFunctionRunnerWithLogInput(extension, JSON.stringify(input), runExport)
          // console.log("the functionRun in onChange")
          // console.log(JSON.parse(functionRun.output).JsonOutput)
          // console.log("the function run to be added")
          // console.log(functionRun)
          // console.log("function after output is swapped")
          // functionRun.output = JSON.parse(functionRun.output).JsonOutput
          // console.log("all the functionRuns")
          // console.log(functionRuns)
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

    // let i = 0;
    // setInterval(() => {
    //   i++
    //   setFunctionRuns((functionRuns) => [...functionRuns, {input: '{\n' +
    //   '  "cart": {\n' +
    //   '    "lines": [\n' +
    //   '      {\n' +
    //   '        "quantity": 3,\n' +
    //   '        "merchandise": {\n' +
    //   '          "typename": "ProductVariant",\n' +
    //   '          "id": "gid://shopify/ProductVariant/45334064595182"\n' +
    //   '        }\n' +
    //   '      }\n' +
    //   '    ]\n' +
    //   '  }\n' +
    //   '}', output: '2', logs: '3'}])
    //   if (i % 5 === 0) {
    //     console.log('here')
    //   }
    // }, 1000)

    // TODO: return a way to clean up watcher
  }, [input, runExport, app, extension])

  return (
    <>
      {/* <ConcurrentOutput
        processes={errorHandledProcesses}
        prefixColumnSize={calculatePrefixColumnSize(errorHandledProcesses, app.extensions)}
        abortSignal={abortController.signal}
        keepRunningAfterProcessesResolve={true}
      /> */}
      {/* eslint-disable-next-line no-negated-condition */}
      {/* {!isAborted ? ( */}
      {/* {
          console.log("in the return")
      } */}
      {/* {
          console.log("logging functionRuns")
      }
      {
        console.log(functionRuns)
      } */}
      {/* {
        console.log("iterating over output")
      }
      {
         functionRuns.map((run) => (
          console.log(JSON.stringify(run.output))))
      }
      {
        console.log("attempting to create")
      }
      {functionRuns.map((run, index) => (
        <Text key={`functionRuns${index}`}>{JSON.stringify(run)}</Text>
      ))} */}

      {/* {console.log("printing logs")} */}
      {/* {console.log(logs)} */}

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
        {/* {canUseShortcuts ? ( */}
        <Box flexDirection="column">
          <Text>
            {figures.pointerSmall} {selectedRun.status.toUpperCase()} | Watching for changes to {selectedRun.source}...
          </Text>
          <Text>
            {figures.pointerSmall} Press <Text bold>d</Text> {figures.lineVertical} diff output with original
          </Text>
          <Text>
            {figures.pointerSmall} Press <Text bold>q</Text> {figures.lineVertical} quit
          </Text>
        </Box>
        {/* ) : null} */}
        {/* <Box marginTop={canUseShortcuts ? 1 : 0}> */}
        {/* <Text>{statusMessage}</Text> */}
        {/* </Box> */}
        {/* {error ? <Text color="red">{error}</Text> : null} */}
      </Box>
      {/* ) : null} */}
    </>
  )
}

function ReplayLog({log}: {log: ReplayLog}) {
  if (log.type === 'functionRun') {
    return <Text>{log.logs}</Text>
  }

  if (log.type === 'systemMessage') {
    return <Text>{log.message}</Text>
  }

  return null
}

export {Replay}

interface ReplayOptions {
  app: AppInterface
  extension: ExtensionInstance<FunctionConfigType>
  apiKey?: string
  stdout?: boolean
  path: string
  json: boolean
  watch: boolean
  log?: string
}

async function runFunctionRunnerWithLogInput(
  fun: ExtensionInstance<FunctionConfigType>,
  input: string,
  exportName: string,
): Promise<FunctionRun> {
  // console.log("in custom runFunctionRunnerWithLogInput")
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

  // console.log('functionRunnerOutput')
  // console.log(functionRunnerOutput)

  // console.log("about to parse")
  const result = JSON.parse(functionRunnerOutput)
  // console.log(result.output)
  return {...result, type: 'functionRun'}
}
