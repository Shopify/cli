import {DeveloperPlatformClient} from '../../../../utilities/developer-platform-client.js'
import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import React, {useState, FunctionComponent, useEffect, useCallback} from 'react'
import {OutputProcess} from '@shopify/cli-kit/node/output'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {Box, Text} from '@shopify/cli-kit/node/ink'
import {Writable} from 'stream'

export interface LogsProps {
  logsProcess: OutputProcess
  abortController: AbortController
  app: {
    apiKey: string
    developerPlatformClient: DeveloperPlatformClient
    extensions: ExtensionInstance[]
  }
}

export interface DetailsFunctionRunLogEvent {
  input: string
  inputBytes: number
  invocationId: string
  output: string
  outputBytes: number
  logs: string
  functionId: string
  fuelConsumed: number
  errorMessage: string | null
  errorType: string | null
  status?: string
  source: string
}

const Logs: FunctionComponent<LogsProps> = ({logsProcess, abortController}) => {
  const [logs, setLogs] = useState<DetailsFunctionRunLogEvent[]>([])

  const writableStream = useCallback(() => {
    return new Writable({
      write(chunk, _encoding, next) {
        const log = chunk.toString('utf8')
        const parsedLog = JSON.parse(log)
        // Mock for now
        setLogs((prevLogs) => [
          ...prevLogs,
          {
            ...parsedLog,
            status: parsedLog.status === 'success' ? 'Success' : 'Failure',
            source: parsedLog.source,
          },
        ])

        next()
      },
    })
  }, [logsProcess])

  useEffect(() => {
    const runProcess = async () => {
      const stdout = writableStream()
      const stderr = writableStream()
      await logsProcess.action(stdout, stderr, abortController.signal)
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    runProcess()
  }, [logsProcess])

  return (
    <>
      {logs.map((log: DetailsFunctionRunLogEvent, index: number) => (
        <Box flexDirection="column" key={index}>
          {/* use inviocation id here (as key) */}
          <Box flexDirection="row" rowGap={2}>
            <Text color="green">{currentTime()} </Text>
            <Text color="blueBright"> {`${log.source}`}</Text>
            <Text color={log.status === 'Success' ? 'green' : 'red'}> {` ${log.status}`}</Text>
            <Text> {`${log.functionId}`}</Text>
            <Text> in {log.fuelConsumed}M instructions</Text>
          </Box>
          <Text>{log.logs}</Text>
          <Text>Input ({log.inputBytes} bytes):</Text>
          <Text>{prettyPrintJson(log.input)}</Text>
        </Box>
      ))}
      <Text color="blueBright">{'[Polling is active] hello from <Log />'}</Text>
    </>
  )
}

export {Logs}

function currentTime() {
  const currentDateTime = new Date()
  const year = currentDateTime.getFullYear()
  const month = addLeadingZero(currentDateTime.getMonth() + 1)
  const day = addLeadingZero(currentDateTime.getDate())
  const hours = addLeadingZero(currentDateTime.getHours())
  const minutes = addLeadingZero(currentDateTime.getMinutes())
  const seconds = addLeadingZero(currentDateTime.getSeconds())
  const milliseconds = addLeadingZero(currentDateTime.getMilliseconds(), 3)

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`
}

function addLeadingZero(number: number, length = 2) {
  return number.toString().padStart(length, '0')
}

function prettyPrintJson(jsonString: string) {
  try {
    const jsonObject = JSON.parse(jsonString)
    return JSON.stringify(jsonObject, null, 2)
  } catch (error) {
    console.error('Failed to parse JSON:', error)
    return jsonString
  }
}
