import {output} from '@shopify/cli-kit'
import {Box, Newline, Text} from 'ink'
import React, {useEffect, useState} from 'react'
import {AbortController} from 'abort-controller'
import {Writable} from 'node:stream'

interface Props {
  color: string
  process: output.OutputProcess
  width: string
  abortControllerSignal: AbortController['signal']
  onError: () => void
}

const Process = ({process, color, width, abortControllerSignal, onError}: Props) => {
  const [processOutput, setProcessOutput] = useState<string[]>([])

  useEffect(() => {
    const runProcess = async () => {
      try {
        const stdout = new Writable({
          write(chunk, _encoding, next) {
            const lines = output.stripAnsiEraseCursorEscapeCharacters(chunk.toString('ascii')).split('\n')
            setProcessOutput((previousProcessOutput) => [...previousProcessOutput, ...lines])
            next()
          },
        })

        const stderr = new Writable({
          write(chunk, _encoding, next) {
            const lines = output.stripAnsiEraseCursorEscapeCharacters(chunk.toString('ascii')).split('\n')
            setProcessOutput((previousProcessOutput) => [...previousProcessOutput, ...lines])
            next()
          },
        })

        await process.action(stdout, stderr, abortControllerSignal)
      } catch (error) {
        onError()
        throw error
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    runProcess()
  }, [])

  return (
    <Box borderStyle="round" padding={1} borderColor={color} margin={1} width={width} flexDirection="column">
      <Text bold color={color}>
        {process.prefix}
      </Text>
      <Newline />

      <Box flexDirection="column">
        {processOutput.map((line, index) => (
          <Text key={index}>{line}</Text>
        ))}
      </Box>
    </Box>
  )
}

export default Process
