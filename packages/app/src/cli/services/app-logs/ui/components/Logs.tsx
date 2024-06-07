import {DeveloperPlatformClient} from '../../../../utilities/developer-platform-client.js'
import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import React, {useState, useMemo, FunctionComponent, useEffect, useCallback} from 'react'
import {OutputProcess} from '@shopify/cli-kit/node/output'
import {AbortController, AbortSignal} from '@shopify/cli-kit/node/abort'
import {Box, Text, TextProps} from 'ink'
import {Writable} from 'stream'

interface Chunk {
  color: TextProps['color']
  prefix: string
  lines: string[]
}

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
}

// fix: we dont need to pass in process's here, there is only a single process
// leaving for now to keep code consistent with dev for now
// same for other spots
const calculatePrefixColumnSize = (processes: OutputProcess[], extensions: ExtensionInstance[]) => {
  return Math.max(
    ...processes.map((process) => process.prefix.length),
    ...extensions.map((extension) => extension.handle.length),
  )
}

const Logs: FunctionComponent<LogsProps> = ({logsProcess, app, abortController}) => {
  const [logs, setLogs] = useState<DetailsFunctionRunLogEvent[]>([])

  const writableStream = useCallback(
    (logProcess: OutputProcess, prefixes: string[]) => {
      return new Writable({
        write(chunk, _encoding, next) {
          const log = chunk.toString('utf8')
          try {
            const parsedLog = JSON.parse(log)
            setLogs((prevLogs) => [
              ...prevLogs,
              {
                ...parsedLog,
                status: parsedLog.status || 'unknown',
              },
            ])
          } catch (error) {
            console.error('Failed to parse log:', error)
            throw error
          }

          next()
        },
      })
    },
    [logsProcess],
  )

  useEffect(() => {
    const runProcess = async () => {
      const prefixes: string[] = []
      const stdout = writableStream(logsProcess, prefixes)
      const stderr = writableStream(logsProcess, prefixes)
      await logsProcess.action(stdout, stderr, abortController.signal)
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    runProcess()
  }, [logsProcess])

  // NOT USED: keeping for now
  const prefixColumnSize = calculatePrefixColumnSize([logsProcess], app.extensions)
  const errorHandledProcesses = useMemo(() => {
    return [logsProcess].map((process) => {
      return {
        ...process,
        action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
          try {
            return await process.action(stdout, stderr, signal)
            // eslint-disable-next-line no-catch-all/no-catch-all
          } catch (error) {
            abortController.abort(error)
          }
        },
      }
    })
  }, [logsProcess, abortController])

  return (
    <>
      <Text color="blueBright">{'Testing, hello from <Log />'}</Text>
      {/* TODO - update to use <Static /> */}
      {logs.map((log: DetailsFunctionRunLogEvent, index: number) => (
        <Box flexDirection="column" key={index}>
          {/* use inviocation id here (as key) */}
          <Box>
            <Text color="green">{currentTime()}</Text>
            <Text color="blueBright">{'my-product-discount'}</Text>
            <Text color={log.status === 'success' ? 'green' : 'red'}>{log.status}</Text>
            <Text>{log.functionId}</Text>
            <Text>in {log.fuelConsumed}M instructions</Text>
          </Box>
          <Text>{log.logs}</Text>
          <Text>Input ({log.inputBytes} bytes):</Text>
          <Text>{prettyPrintJson(log.input)}</Text>
        </Box>
      ))}
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
