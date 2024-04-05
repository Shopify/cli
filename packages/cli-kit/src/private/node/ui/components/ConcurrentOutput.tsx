import {OutputProcess} from '../../../../public/node/output.js'
import {AbortSignal} from '../../../../public/node/abort.js'
import {addOrUpdateConcurrentUIEventOutput} from '../../demo-recorder.js'
import React, {FunctionComponent, useCallback, useEffect, useMemo, useState} from 'react'
import {Box, Static, Text, TextProps, useApp} from 'ink'
import stripAnsi from 'strip-ansi'
import figures from 'figures'
import {Writable} from 'stream'

export interface ConcurrentOutputProps {
  processes: OutputProcess[]
  abortSignal: AbortSignal
  showTimestamps?: boolean
  keepRunningAfterProcessesResolve?: boolean
}

interface Chunk {
  color: TextProps['color']
  prefix: string
  lines: string[]
}

function addLeadingZero(number: number) {
  if (number < 10) {
    return `0${number}`
  } else {
    return number.toString()
  }
}

function currentTime() {
  const currentDateTime = new Date()
  const hours = addLeadingZero(currentDateTime.getHours())
  const minutes = addLeadingZero(currentDateTime.getMinutes())
  const seconds = addLeadingZero(currentDateTime.getSeconds())
  return `${hours}:${minutes}:${seconds}`
}

/**
 * Renders output from concurrent processes to the terminal.
 * Output will be divided in a three column layout
 * with the left column containing the timestamp,
 * the right column containing the output,
 * and the middle column containing the process prefix.
 * Every process will be rendered with a different color, up to 4 colors.
 *
 * For example running `shopify app dev`:
 *
 * ```shell
 * 2022-10-10 13:11:03 | backend    | npm
 * 2022-10-10 13:11:03 | backend    |  WARN ignoring workspace config at ...
 * 2022-10-10 13:11:03 | backend    |
 * 2022-10-10 13:11:03 | backend    |
 * 2022-10-10 13:11:03 | backend    | > shopify-app-template-node@0.1.0 dev
 * 2022-10-10 13:11:03 | backend    | > cross-env NODE_ENV=development nodemon backend/index.js --watch ./backend
 * 2022-10-10 13:11:03 | backend    |
 * 2022-10-10 13:11:03 | backend    |
 * 2022-10-10 13:11:03 | frontend   |
 * 2022-10-10 13:11:03 | frontend   | > starter-react-frontend-app@0.1.0 dev
 * 2022-10-10 13:11:03 | frontend   | > cross-env NODE_ENV=development node vite-server.js
 * 2022-10-10 13:11:03 | frontend   |
 * 2022-10-10 13:11:03 | frontend   |
 * 2022-10-10 13:11:03 | backend    |
 * 2022-10-10 13:11:03 | backend    | [nodemon] to restart at any time, enter `rs`
 * 2022-10-10 13:11:03 | backend    | [nodemon] watching path(s): backend/
 * 2022-10-10 13:11:03 | backend    | [nodemon] watching extensions: js,mjs,json
 * 2022-10-10 13:11:03 | backend    | [nodemon] starting `node backend/index.js`
 * 2022-10-10 13:11:03 | backend    |
 *
 * ```
 */
const ConcurrentOutput: FunctionComponent<ConcurrentOutputProps> = ({
  processes,
  abortSignal,
  showTimestamps = true,
  keepRunningAfterProcessesResolve = false,
}) => {
  const [processOutput, setProcessOutput] = useState<Chunk[]>([])
  const {exit: unmountInk} = useApp()
  const prefixColumnSize = Math.max(...processes.map((process) => process.prefix.length))
  const concurrentColors: TextProps['color'][] = useMemo(() => ['yellow', 'cyan', 'magenta', 'green', 'blue'], [])
  const lineColor = useCallback(
    (index: number) => {
      const colorIndex = index < concurrentColors.length ? index : index % concurrentColors.length
      return concurrentColors[colorIndex]!
    },
    [concurrentColors],
  )
  const writableStream = useCallback(
    (process: OutputProcess, index: number) => {
      return new Writable({
        write(chunk, _encoding, next) {
          const lines = stripAnsi(chunk.toString('utf8').replace(/(\n)$/, '')).split(/\n/)
          addOrUpdateConcurrentUIEventOutput({prefix: process.prefix, index, output: lines.join('\n')})
          setProcessOutput((previousProcessOutput) => [
            ...previousProcessOutput,
            {
              color: lineColor(index),
              prefix: process.prefix,
              lines,
            },
          ])
          next()
        },
      })
    },
    [lineColor],
  )

  useEffect(() => {
    const runProcesses = async () => {
      try {
        await Promise.all(
          processes.map(async (process, index) => {
            const stdout = writableStream(process, index)
            const stderr = writableStream(process, index)
            await process.action(stdout, stderr, abortSignal)
          }),
        )
        if (!keepRunningAfterProcessesResolve) {
          unmountInk()
        }
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (error: unknown) {
        if (!keepRunningAfterProcessesResolve) {
          unmountInk(error as Error | undefined)
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    runProcesses()
  }, [abortSignal, processes, writableStream, unmountInk, keepRunningAfterProcessesResolve])

  const {lineVertical} = figures

  return (
    <Static items={processOutput}>
      {(chunk, index) => {
        const prefixBuffer = ' '.repeat(prefixColumnSize - chunk.prefix.length)
        return (
          <Box flexDirection="column" key={index}>
            {chunk.lines.map((line, index) => (
              <Box key={index} flexDirection="row">
                <Text color={chunk.color}>
                  {showTimestamps ? (
                    <Text>
                      {currentTime()} {lineVertical}{' '}
                    </Text>
                  ) : null}
                  <Text>
                    {chunk.prefix}
                    {prefixBuffer} {lineVertical} {line}
                  </Text>
                </Text>
              </Box>
            ))}
          </Box>
        )
      }}
    </Static>
  )
}
export {ConcurrentOutput}
