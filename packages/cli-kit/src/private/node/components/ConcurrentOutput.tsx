import {OutputProcess} from '../../../output.js'
import React, {FunctionComponent, useEffect, useState} from 'react'
import {Static, Text, useApp} from 'ink'
import stripAnsi from 'strip-ansi'
import {Writable} from 'node:stream'

export type WritableStream = (process: OutputProcess, index: number) => Writable
export type RunProcesses = (
  writableStream: WritableStream,
  unmountInk: (error?: Error | undefined) => void,
) => Promise<void>

interface Props {
  processes: OutputProcess[]
  runProcesses: RunProcesses
}

interface Line {
  color: string
  value: string
  prefix: string
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
 *
 * 2022-10-10 13:11:03 | frontend   |
 * 2022-10-10 13:11:03 | frontend   | > starter-react-frontend-app@0.1.0 dev
 * 2022-10-10 13:11:03 | frontend   | > cross-env NODE_ENV=development node vite-server.js
 * 2022-10-10 13:11:03 | frontend   |
 * 2022-10-10 13:11:03 | frontend   |

 * 2022-10-10 13:11:03 | backend    | [nodemon] 2.0.19
 * 2022-10-10 13:11:03 | backend    |
 * 2022-10-10 13:11:03 | backend    | [nodemon] to restart at any time, enter `rs`
 * 2022-10-10 13:11:03 | backend    | [nodemon] watching path(s): backend/
 * 2022-10-10 13:11:03 | backend    | [nodemon] watching extensions: js,mjs,json
 * 2022-10-10 13:11:03 | backend    | [nodemon] starting `node backend/index.js`
 * 2022-10-10 13:11:03 | backend    |
 *
 * ```
 */
const ConcurrentOutput: FunctionComponent<Props> = ({processes, runProcesses}) => {
  const [processOutput, setProcessOutput] = useState<Line[]>([])
  const concurrentColors = ['yellow', 'cyan', 'magenta', 'green']
  const prefixColumnSize = Math.max(...processes.map((process) => process.prefix.length))
  const {exit: unmountInk} = useApp()

  function lineColor(index: number) {
    const colorIndex = index < concurrentColors.length ? index : index % concurrentColors.length
    return concurrentColors[colorIndex]!
  }

  const writableStream = (process: OutputProcess, index: number) => {
    return new Writable({
      write(chunk, _encoding, next) {
        const lines = stripAnsi(chunk.toString('ascii')).split(/\n/)

        setProcessOutput((previousProcessOutput) => [
          ...previousProcessOutput,
          ...lines.map((line) => ({
            color: lineColor(index),
            value: line,
            prefix: process.prefix,
          })),
        ])

        next()
      },
    })
  }

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    runProcesses(writableStream, unmountInk)
  }, [])

  return (
    <Static items={processOutput}>
      {(line, index) => {
        const previousLine = processOutput[index - 1]
        return (
          <Text key={index}>
            {previousLine?.prefix && previousLine.prefix !== line.prefix && '\n'}
            <Text color={line.color}>
              <Text>{new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')}</Text>
              <Text bold>{` | `}</Text>
              <Text>
                {line.prefix}
                {' '.repeat(prefixColumnSize - line.prefix.length)}
              </Text>
              <Text bold>{` | `}</Text>
              <Text>{line.value}</Text>
            </Text>
          </Text>
        )
      }}
    </Static>
  )
}

export default ConcurrentOutput
