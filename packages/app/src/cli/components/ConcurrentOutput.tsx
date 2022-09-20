import React, {FunctionComponent, useEffect, useState} from 'react'
import {Box, Newline, Text} from 'ink'
import {output} from '@shopify/cli-kit'
import {AbortController} from 'abort-controller'
import {Writable} from 'node:stream'

interface Props {
  processes: output.OutputProcess[]
}

const ConcurrentOutput: FunctionComponent<Props> = ({processes}) => {
  const abortController = new AbortController()
  const concurrentColors = ['yellow', 'cyan', 'magenta', 'green']

  function prefixColor(index: number) {
    const colorIndex = index < concurrentColors.length ? index : index % concurrentColors.length
    return concurrentColors[colorIndex]!
  }

  const [commandOutput, setCommandOutput] = useState<{[key: string]: string}>(
    processes.reduce((acc, process) => {
      acc[process.prefix] = ''
      return acc
    }, {} as {[key: string]: string}),
  )

  useEffect(() => {
    const runProcesses = async () => {
      try {
        await Promise.all(
          processes.map((process) => {
            const stdout = new Writable({
              write(chunk, _encoding, next) {
                const lines = output.stripAnsiEraseCursorEscapeCharacters(chunk.toString('ascii'))
                setCommandOutput((previousCommandOutput) => {
                  return {
                    ...previousCommandOutput,
                    [process.prefix]: previousCommandOutput[process.prefix]!.concat(lines),
                  }
                })
                next()
              },
            })
            const stderr = new Writable({
              write(chunk, _encoding, next) {
                const lines = output.stripAnsiEraseCursorEscapeCharacters(chunk.toString('ascii'))
                setCommandOutput((previousCommandOutput) => {
                  return {
                    ...previousCommandOutput,
                    [process.prefix]: previousCommandOutput[process.prefix]!.concat(lines),
                  }
                })
                next()
              },
            })

            return process.action(stdout, stderr, abortController.signal)
          }),
        )
      } catch (_error) {
        // We abort any running process
        abortController.abort()
        throw _error
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    runProcesses()
  }, [])

  return (
    <Box>
      {processes.map((process, index) => (
        <Box
          borderStyle="round"
          padding={1}
          key={index}
          borderColor={prefixColor(index)}
          margin={1}
          width={`${Math.floor(100 / processes.length)}%`}
          flexDirection="column"
        >
          <Text bold color={prefixColor(index)}>
            {process.prefix}
          </Text>
          <Newline />

          <Box key={index}>
            <Text>{commandOutput[process.prefix]}</Text>
          </Box>
        </Box>
      ))}
    </Box>
  )
}

export default ConcurrentOutput
