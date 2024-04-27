import {OutputProcess} from '../../../../public/node/output.js'
import {AbortSignal} from '../../../../public/node/abort.js'
import {addOrUpdateConcurrentUIEventOutput} from '../../demo-recorder.js'
import React, {Fragment, FunctionComponent, useCallback, useEffect, useMemo, useState} from 'react'
import {Box, Static, Text, TextProps, useApp} from 'ink'
import stripAnsi from 'strip-ansi'
import figures from 'figures'
import {Writable} from 'stream'

export interface ConcurrentOutputProps {
  processes: OutputProcess[]
  prefixColumnSize?: number
  abortSignal: AbortSignal
  showTimestamps?: boolean
  keepRunningAfterProcessesResolve?: boolean
}

interface Chunk {
  color: TextProps['color']
  prefix: string
  lines: string[]
}

interface ParsedLog {
  prefix?: string
  log: string
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
 * Allows users of ConcurrentOutput to format logs with a prefix column override.
 *
 * @param prefix The override value for the prefix column
 * @param log The log to prefix
 */
function prefixLog(prefix: string, log: string) : string {
  return `<::${prefix}::>${log}`
}

function parseLog(log: string) : ParsedLog {
  // Example: <::hello-world::> foo bar\nssssada
  const prefixRegex = /(<::(([^:])+)::>\s?)[\s\S]+/g
  const prefixMatch = prefixRegex.exec(log)
  if (prefixMatch && prefixMatch[1] && prefixMatch[2]) {
    return {
      prefix: prefixMatch[2], // hello-world
      log: log.substring(prefixMatch[1].length) // To strip off <::hello-world::>
    }
  }
  return {
    log
  }
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
  prefixColumnSize = 12,
  abortSignal,
  showTimestamps = true,
  keepRunningAfterProcessesResolve = false,
}) => {
  const [processOutput, setProcessOutput] = useState<Chunk[]>([])
  const {exit: unmountInk} = useApp()

  const concurrentColors = [
    'yellow',
    '#008080' /*teal*/,
    'cyan',
    '#ff8700' /*orange*/,
    'magenta',
    '#ffd787' /*gold*/,
    '#008000', /*green*/
    '#800080' /*purple*/,
    '#000080' /*navy*/,
    '#808000' /*olive*/
  ]

  const addPrefix = (prefix: string, prefixes: string[]) => {
    const index = prefixes.indexOf(prefix)
    if (index != -1) {
      return index
    }
    prefixes.push(prefix)
    return prefixes.length-1
  }

  const lineColor = (index: number) => {
    const colorIndex = index % concurrentColors.length
    return concurrentColors[colorIndex]
  }

  const writableStream = (process: OutputProcess, prefixes: string[]) => {
    return new Writable({
      write(chunk, _encoding, next) {
        const parsedLog : ParsedLog = parseLog(chunk.toString('utf8'))
        const prefix = parsedLog.prefix ?? process.prefix
        const index = addPrefix(prefix, prefixes)

        const lines = stripAnsi(parsedLog.log.replace(/(\n)$/, '')).split(/\n/)
        addOrUpdateConcurrentUIEventOutput({prefix, index, output: lines.join('\n')})
        setProcessOutput((previousProcessOutput) => [
          ...previousProcessOutput,
          {
            color: lineColor(index),
            prefix,
            lines,
          },
        ])
        next()
      },
    })
  }

  const formatPrefix = (prefix: string) => {
    if (prefix.length > prefixColumnSize) {
      return prefix.substring(0, prefixColumnSize)
    }

    return `${prefix}${' '.repeat(prefixColumnSize - prefix.length)}`
  }

  useEffect(() => {
    const runProcesses = async () => {
      const prefixes : string[] = []

      try {
        await Promise.all(
          processes.map(async (process, index) => {
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
  }, [abortSignal, processes, unmountInk, keepRunningAfterProcessesResolve])

  const {lineVertical} = figures

  return (
    <Static items={processOutput}>
      {(chunk, index) => {
        return (
          <Box flexDirection="column" key={index}>
            {chunk.lines.map((line, index) => (
              <Box key={index} flexDirection="row">
                {showTimestamps ? (
                  <Fragment>
                    <Text color={chunk.color}>
                      {currentTime()}
                    </Text>
                    <Text color={'white'}>
                      {' '}{lineVertical}{' '}
                    </Text>
                  </Fragment>
                ) : null}
                <Text color={chunk.color}>
                  {formatPrefix(chunk.prefix)}
                </Text>
                <Text color={'white'}>
                  {' '}{lineVertical}{' '}
                </Text>
                <Text color={chunk.color}>
                  {line}
                </Text>
              </Box>
            ))}
          </Box>
        )
      }}
    </Static>
  )
}
export {ConcurrentOutput,prefixLog}
