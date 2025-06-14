import {FunctionRunFromRunner, ReplayLog} from './types.js'
import {useFunctionWatcher} from './hooks/useFunctionWatcher.js'
import {FunctionRunData} from '../../../replay.js'
import {ExtensionInstance} from '../../../../../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../../../../../models/extensions/specifications/function.js'
import {prettyPrintJsonIfPossible} from '../../../../app-logs/utils.js'
import {AppEventWatcher} from '../../../../dev/app-events/app-event-watcher.js'
import {AppInterface} from '../../../../../models/app/app.js'
import figures from '@shopify/cli-kit/node/figures'
import {AbortController} from '@shopify/cli-kit/node/abort'
import React, {FunctionComponent} from 'react'
import {Box, Text, Static, useInput, useStdin} from '@shopify/cli-kit/node/ink'
import {useAbortSignal} from '@shopify/cli-kit/node/ui/hooks'
import {handleCtrlC} from '@shopify/cli-kit/node/ui'

export interface ReplayProps {
  selectedRun: FunctionRunData
  abortController: AbortController
  app: AppInterface
  extension: ExtensionInstance<FunctionConfigType>
}

const Replay: FunctionComponent<ReplayProps> = ({selectedRun, abortController, app, extension}) => {
  const {isAborted} = useAbortSignal(abortController.signal)
  const {isRawModeSupported: canUseShortcuts} = useStdin()
  const appWatcher = new AppEventWatcher(app)
  const {logs, statusMessage, recentFunctionRuns, error} = useFunctionWatcher({
    selectedRun,
    abortController,
    app,
    extension,
    appWatcher,
  })

  useInput(
    (input, key) => {
      handleCtrlC(input, key, () => abortController.abort())
      if (input === 'q') {
        abortController.abort()
      }
    },
    {isActive: Boolean(canUseShortcuts)},
  )

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

function Header({title, backgroundColor}: {title: string; backgroundColor: string}) {
  const numSpaces = Math.max(Math.round((28 - title.length) / 2), 0)
  const spaces = ' '.repeat(numSpaces)
  return (
    <Text backgroundColor={backgroundColor} color="black">
      {'\n\n'}
      {spaces}
      {title}
      {spaces}
      {'\n'}
    </Text>
  )
}

function InputDisplay({input}: {input: string}) {
  return (
    <Box flexDirection="column">
      <Header title="Input" backgroundColor="yellow" />
      <Text>{prettyPrintJsonIfPossible(input)}</Text>
    </Box>
  )
}

function LogDisplay({logs}: {logs: string}) {
  return (
    <Box flexDirection="column">
      <Header title="Logs" backgroundColor="blueBright" />
      <Text>{logs}</Text>
    </Box>
  )
}

function OutputDisplay({output}: {output: string}) {
  return (
    <Box flexDirection="column">
      <Header title="Output" backgroundColor="greenBright" />
      <Text>{prettyPrintJsonIfPossible(output)}</Text>
    </Box>
  )
}

function BenchmarkDisplay({functionRun}: {functionRun: FunctionRunFromRunner}) {
  return (
    <Box flexDirection="column">
      <Header title="Benchmark Results" backgroundColor="green" />
      <Text>Name: {functionRun.name}</Text>
      <Text>Linear Memory Usage: {functionRun.memory_usage}KB</Text>
      <Text>Instructions: {functionRun.instructions / 1000}K</Text>
      <Text>Size: {functionRun.size}KB</Text>
    </Box>
  )
}

function StatsDisplay({recentFunctionRuns}: {recentFunctionRuns: [FunctionRunFromRunner, FunctionRunFromRunner]}) {
  const delta = recentFunctionRuns[0].instructions - recentFunctionRuns[1].instructions
  return (
    <Box flexDirection="column">
      <Text>
        {figures.pointerSmall} Instruction count change: {delta > 0 ? '+' : ''}
        {delta}
      </Text>
    </Box>
  )
}

function ReplayLog({log}: {log: ReplayLog}) {
  switch (log.type) {
    case 'functionRun':
      return (
        <Box flexDirection="column">
          <InputDisplay input={log.input} />
          <LogDisplay logs={log.logs} />
          <OutputDisplay output={log.output} />
          <BenchmarkDisplay functionRun={log} />
          <Text>&nbsp;</Text>
        </Box>
      )
    case 'systemMessage':
      return <Text>{log.message}</Text>
    default:
      return null
  }
}

export {Replay}
