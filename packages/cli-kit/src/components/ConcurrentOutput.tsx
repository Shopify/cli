import {OutputProcess, stripAnsiEraseCursorEscapeCharacters} from '../output.js'
import React, {FunctionComponent, useEffect, useState} from 'react'
import {AbortController} from 'abort-controller'
import {Static, Text} from 'ink'
import {Writable} from 'node:stream'

interface Props {
  processes: OutputProcess[]
  abortController: AbortController
}

interface Line {
  color: string
  value: string
  prefix: string
}

const ConcurrentOutput: FunctionComponent<Props> = ({processes, abortController}) => {
  const [processOutput, setProcessOutput] = useState<Line[]>([])
  const concurrentColors = ['yellow', 'cyan', 'magenta', 'green']
  const prefixColumnSize = Math.max(...processes.map((process) => process.prefix.length))

  function lineColor(index: number) {
    const colorIndex = index < concurrentColors.length ? index : index % concurrentColors.length
    return concurrentColors[colorIndex]!
  }

  useEffect(() => {
    const runProcess = async () => {
      try {
        await Promise.all(
          processes.map(async (process, index) => {
            const stdout = new Writable({
              write(chunk, _encoding, next) {
                const lines = stripAnsiEraseCursorEscapeCharacters(chunk.toString('ascii')).split(/\n/)
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

            const stderr = new Writable({
              write(chunk, _encoding, next) {
                const lines = stripAnsiEraseCursorEscapeCharacters(chunk.toString('ascii')).split(/\n/)
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

            await process.action(stdout, stderr, abortController.signal)
          }),
        )
      } catch (error) {
        abortController.abort()
        throw error
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    runProcess()
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
