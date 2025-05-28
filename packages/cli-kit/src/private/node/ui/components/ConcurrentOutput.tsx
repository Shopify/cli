import {OutputProcess} from '../../../../public/node/output.js'
import {AbortSignal} from '../../../../public/node/abort.js'
import React, {FunctionComponent, useCallback, useEffect, useMemo, useState} from 'react'
import {Box, Static, Text, TextProps, useApp} from 'ink'
import figures from 'figures'
import stripAnsi from 'strip-ansi'
import {Writable} from 'stream'
import {AsyncLocalStorage} from 'node:async_hooks'

export interface ConcurrentOutputProps {
  processes: OutputProcess[]
  prefixColumnSize?: number
  abortSignal: AbortSignal
  showTimestamps?: boolean
  keepRunningAfterProcessesResolve?: boolean
  useAlternativeColorPalette?: boolean
  onLogOutput?: (log: {timestamp: number; message: string; prefix?: string}) => void
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

interface ConcurrentOutputContext {
  outputPrefix?: string
  stripAnsi?: boolean
}

const outputContextStore = new AsyncLocalStorage<ConcurrentOutputContext>()

function useConcurrentOutputContext<T>(context: ConcurrentOutputContext, callback: () => T): T {
  return outputContextStore.run(context, callback)
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
  prefixColumnSize,
  abortSignal,
  showTimestamps = true,
  keepRunningAfterProcessesResolve = false,
  useAlternativeColorPalette = false,
  onLogOutput,
}) => {
  const [processOutput, setProcessOutput] = useState<Chunk[]>([])
  const {exit: unmountInk} = useApp()
  const concurrentColors: TextProps['color'][] = useMemo(
    () =>
      useAlternativeColorPalette
        ? ['#b994c3', '#e69e19', '#d17a73', 'cyan', 'magenta', 'blue']
        : ['yellow', 'cyan', 'magenta', 'green', 'blue'],
    [useAlternativeColorPalette],
  )

  const calculatedPrefixColumnSize = useMemo(() => {
    const maxColumnSize = 25

    // If the prefixColumnSize is not provided, we calculate it based on the longest process prefix
    const columnSize =
      prefixColumnSize ??
      processes.reduce((maxPrefixLength, process) => Math.max(maxPrefixLength, process.prefix.length), 0)

    // Apply overall limit to the prefix column size
    return Math.min(columnSize, maxColumnSize)
  }, [processes, prefixColumnSize])

  const addPrefix = (prefix: string, prefixes: string[]) => {
    const index = prefixes.indexOf(prefix)
    if (index !== -1) {
      return index
    }
    prefixes.push(prefix)
    return prefixes.length - 1
  }

  const lineColor = useCallback(
    (index: number) => {
      const colorIndex = index % concurrentColors.length
      return concurrentColors[colorIndex]
    },
    [concurrentColors],
  )

  const writableStream = useCallback(
    (process: OutputProcess, prefixes: string[]) => {
      return new Writable({
        write(chunk, _encoding, next) {
          const context = outputContextStore.getStore()
          const prefix = context?.outputPrefix ?? process.prefix
          const shouldStripAnsi = context?.stripAnsi ?? true
          const log = chunk.toString('utf8').replace(/(\n)$/, '')

          const index = addPrefix(prefix, prefixes)

          const lines = shouldStripAnsi ? stripAnsi(log).split(/\n/) : log.split(/\n/)
          setProcessOutput((previousProcessOutput) => [
            ...previousProcessOutput,
            {
              color: lineColor(index),
              prefix,
              lines,
            },
          ])
          onLogOutput?.({
            timestamp: new Date().getTime(),
            message: log,
            prefix,
          })
          next()
        },
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lineColor],
  )

  const formatPrefix = (prefix: string) => {
    // Truncate prefix if needed
    if (prefix.length > calculatedPrefixColumnSize) {
      return prefix.substring(0, calculatedPrefixColumnSize)
    }

    return `${' '.repeat(calculatedPrefixColumnSize - prefix.length)}${prefix}`
  }

  useEffect(() => {
    const runProcesses = async () => {
      const prefixes: string[] = []

      try {
        await Promise.all(
          processes.map(async (process) => {
            const stdout = writableStream(process, prefixes)
            const stderr = writableStream(process, prefixes)
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
        return (
          <Box flexDirection="column" key={index}>
            {chunk.lines.map((line, index) => (
              <Box key={index} flexDirection="row">
                <Text>
                  {showTimestamps ? (
                    <Text>
                      {currentTime()} {lineVertical}{' '}
                    </Text>
                  ) : null}
                  <Text color={chunk.color}>{formatPrefix(chunk.prefix)}</Text>
                  <Text>
                    {' '}
                    {lineVertical} {line}
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
export {ConcurrentOutput, ConcurrentOutputContext, useConcurrentOutputContext}
