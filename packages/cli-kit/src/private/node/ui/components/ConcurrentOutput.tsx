import {OutputProcess} from '../../../../public/node/output.js'
import useAsyncAndUnmount from '../hooks/use-async-and-unmount.js'
import {AbortController} from '../../../../public/node/abort.js'
import {handleCtrlC} from '../../ui.js'
import React, {FunctionComponent, useCallback, useState} from 'react'
import {Box, Key, Static, Text, useInput} from 'ink'
import stripAnsi from 'strip-ansi'
import treeKill from 'tree-kill'
import figures from 'figures'
import {Writable} from 'stream'

export type WritableStream = (process: OutputProcess, index: number) => Writable

interface Shortcut {
  key: string
  action: string
}
export interface ConcurrentOutputProps {
  processes: OutputProcess[]
  abortController: AbortController
  showTimestamps?: boolean
  onInput?: (input: string, key: Key, exit: () => void) => void
  footer?: {
    shortcuts: Shortcut[]
    subTitle?: string
  }
}
interface Chunk {
  color: string
  prefix: string
  lines: string[]
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
  abortController,
  showTimestamps = true,
  onInput,
  footer,
}) => {
  const [processOutput, setProcessOutput] = useState<Chunk[]>([])
  const concurrentColors = ['yellow', 'cyan', 'magenta', 'green', 'blue']
  const prefixColumnSize = Math.max(...processes.map((process) => process.prefix.length))

  function lineColor(index: number) {
    const colorIndex = index < concurrentColors.length ? index : index % concurrentColors.length
    return concurrentColors[colorIndex]!
  }

  const writableStream = (process: OutputProcess, index: number) => {
    return new Writable({
      write(chunk, _encoding, next) {
        const lines = stripAnsi(chunk.toString('utf8').replace(/(\n)$/, '')).split(/\n/)

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
  }

  const runProcesses = () => {
    return Promise.all(
      processes.map(async (process, index) => {
        const stdout = writableStream(process, index)
        const stderr = writableStream(process, index)

        await process.action(stdout, stderr, abortController.signal)
      }),
    )
  }

  useInput(
    useCallback(
      (input, key) => {
        handleCtrlC(input, key)

        onInput!(input, key, () => treeKill(process.pid, 'SIGINT'))
      },
      [onInput],
    ),
    {isActive: typeof onInput !== 'undefined'},
  )

  useAsyncAndUnmount(runProcesses, {onRejected: () => abortController.abort()})

  return (
    <>
      <Static items={processOutput}>
        {(chunk, index) => {
          return (
            <Box flexDirection="column" key={index}>
              {chunk.lines.map((line, index) => (
                <Box key={index} flexDirection="row">
                  {showTimestamps ? (
                    <Box>
                      <Box marginRight={1}>
                        <Text color={chunk.color}>
                          {new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')}
                        </Text>
                      </Box>

                      <Text bold color={chunk.color}>
                        |
                      </Text>
                    </Box>
                  ) : null}

                  <Box width={prefixColumnSize} marginX={1}>
                    <Text color={chunk.color}>{chunk.prefix}</Text>
                  </Box>

                  <Text bold color={chunk.color}>
                    |
                  </Text>

                  <Box flexGrow={1} paddingLeft={1}>
                    <Text color={chunk.color}>{line}</Text>
                  </Box>
                </Box>
              ))}
            </Box>
          )
        }}
      </Static>
      {footer ? (
        <Box marginY={1} flexDirection="column" flexGrow={1}>
          <Box flexDirection="column">
            {footer.shortcuts.map((shortcut, index) => (
              <Text key={index}>
                {figures.pointerSmall} Press <Text bold>{shortcut.key}</Text> | {shortcut.action}
              </Text>
            ))}
          </Box>
          {footer.subTitle ? (
            <Box marginTop={1}>
              <Text>{footer.subTitle}</Text>
            </Box>
          ) : null}
        </Box>
      ) : null}
    </>
  )
}

export {ConcurrentOutput}
