import {setupExtensionWatcherForReplay} from './hooks/extension-watcher.js'
import {FunctionRunData} from '../../replay.js'
import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../../../models/extensions/specifications/function.js'
import {AppInterface} from '../../../../models/app/app.js'
import {prettyPrintJsonIfPossible} from '../../../app-logs/utils.js'
import figures from '@shopify/cli-kit/node/figures'
import {AbortController} from '@shopify/cli-kit/node/abort'
import React, {FunctionComponent} from 'react'
import {Box, Text, Static} from '@shopify/cli-kit/node/ink'

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
  const {logs, isAborted, canUseShortcuts, statusMessage, recentFunctionRuns, error} = setupExtensionWatcherForReplay({
    selectedRun,
    abortController,
    app,
    extension,
  })

  return (
    <>
      {/* Scrolling upper section */}
      <Static items={logs}>
        {(log, index) => {
          return (
            <Box key={`replayOutputScrollerLog${index}`} flexDirection="column">
              <ReplayLog log={log} />
            </Box>
          )
        }}
      </Static>
      {/* Bottom Bar */}
      {/* eslint-disable-next-line no-negated-condition */}
      {!isAborted ? (
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
                <Text>
                  {figures.pointerSmall} {statusMessage}
                </Text>
              </Box>
              <StatsDisplay recentFunctionRuns={recentFunctionRuns} />
              <Text>
                {figures.pointerSmall} Press <Text bold>q</Text> {figures.lineVertical} quit
              </Text>
            </Box>
          ) : null}
          {error ? <Text color="red">{error}</Text> : null}
        </Box>
      ) : null}
    </>
  )
}

function InputDisplay({input}: {input: string}) {
  return (
    <Box flexDirection="column">
      <Text color="black" backgroundColor="yellow">
        Input
      </Text>
      <Text>{prettyPrintJsonIfPossible(input)}</Text>
    </Box>
  )
}

function LogDisplay({logs}: {logs: string}) {
  return (
    <Box flexDirection="column">
      <Text color="black" backgroundColor="blue">
        Logs
      </Text>
      <Text>{logs}</Text>
    </Box>
  )
}

function OutputDisplay({output}: {output: string}) {
  return (
    <Box flexDirection="column">
      <Text color="black" backgroundColor="green">
        Output
      </Text>
      <Text>{prettyPrintJsonIfPossible(output)}</Text>
    </Box>
  )
}

function BenchmarkDisplay({functionRun}: {functionRun: FunctionRun}) {
  return (
    <Box flexDirection="column">
      <Text color="black" backgroundColor="greenBright">
        Benchmark Results
      </Text>
      <Text>Name: {functionRun.name}</Text>
      <Text>Linear Memory Usage: {functionRun.memory_usage}KB</Text>
      <Text>Instructions: {functionRun.instructions / 1000}K</Text>
      <Text>Size: {functionRun.size}KB</Text>
    </Box>
  )
}

function StatsDisplay({recentFunctionRuns}: {recentFunctionRuns: [FunctionRun, FunctionRun]}) {
  const delta = recentFunctionRuns[0].instructions - recentFunctionRuns[1].instructions
  return (
    <Box flexDirection="column">
      <Text>
        {figures.pointerSmall} Instruction count delta: {delta}
      </Text>
    </Box>
  )
}

function ReplayLog({log}: {log: ReplayLog}) {
  if (log.type === 'functionRun') {
    return (
      <Box flexDirection="column">
        <InputDisplay input={log.input} />
        <LogDisplay logs={log.logs} />
        <OutputDisplay output={log.output} />
        <BenchmarkDisplay functionRun={log} />
      </Box>
    )
  }

  if (log.type === 'systemMessage') {
    return <Text>{log.message}</Text>
  }

  return null
}

export {Replay}
