import {OutputProcess} from '../../../output.js'
import React, {FunctionComponent, useEffect, useState} from 'react'
import {Static, Text} from 'ink'
import stripAnsi from 'strip-ansi'
import {Writable} from 'node:stream'

export type WritableStream = (process: OutputProcess, index: number) => Writable
export type RunProcesses = (writableStream: WritableStream) => Promise<void>

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
 * Output will be divided in a two column layout, with the left column
 * containing the process prefix and the right column containing the output.
 * Every process will be rendered with a different color, up to 4 colors.
 *
 * For example running `shopify app dev`:
 *
 * ```shell
 * backend    |
 * backend    | > shopify-app-template-node@0.1.0 dev
 * backend    | > cross-env NODE_ENV=development ...
 * backend    |

 * frontend   |
 * frontend   | > starter-react-frontend-app@0.1.0 dev
 * frontend   | > cross-env NODE_ENV=development node vite-server.js
 * frontend   |

 * backend    | [nodemon] 2.0.19
 * backend    | [nodemon] to restart at any time, enter `rs`
 * backend    | [nodemon] watching path(s): backend/
 * backend    | [nodemon] watching extensions: js,mjs,json
 * backend    | [nodemon] starting `node backend/index.js
 * ```
 */
const ConcurrentOutput: FunctionComponent<Props> = ({processes, runProcesses}) => {
  const [processOutput, setProcessOutput] = useState<Line[]>([])
  const concurrentColors = ['yellow', 'cyan', 'magenta', 'green']
  const prefixColumnSize = Math.max(...processes.map((process) => process.prefix.length))

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
    runProcesses(writableStream)
  }, [])

  return (
    <Static items={processOutput}>
      {(line, index) => {
        const previousLine = processOutput[index - 1]
        return (
          <Text key={index}>
            {previousLine?.prefix && previousLine.prefix !== line.prefix && '\n'}
            <Text color={line.color}>
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
