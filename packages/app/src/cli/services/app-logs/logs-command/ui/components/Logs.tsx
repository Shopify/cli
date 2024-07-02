import {usePollAppLogs} from './hooks/usePollAppLogs.js'
import {PollOptions, FunctionRunLog, AppLogPrefix} from '../../../types.js'
import {prettyPrintJsonIfPossible} from '../../../utils.js'

import React, {FunctionComponent} from 'react'

import {Box, Text} from '@shopify/cli-kit/node/ink'

interface LogsProps {
  resubscribeCallback: () => Promise<string>
  pollOptions: PollOptions
}

const Logs: FunctionComponent<LogsProps> = ({pollOptions: {jwtToken, filters}, resubscribeCallback}) => {
  const {appLogOutputs, errors} = usePollAppLogs({filters, initialJwt: jwtToken, resubscribeCallback})

  return (
    <>
      {appLogOutputs.map(
        (
          {
            appLog,
            prefix,
          }: {
            appLog: FunctionRunLog
            prefix: AppLogPrefix
          },
          index: number,
        ) => (
          <Box flexDirection="column" key={index}>
            {/* update: use invocationId after https://github.com/Shopify/shopify-functions/issues/235 */}
            <Box flexDirection="row" gap={1}>
              <Text color="green">{prefix.logTimestamp}</Text>
              <Text color="blueBright">{`${prefix.source}`}</Text>
              <Text color={prefix.status === 'Success' ? 'green' : 'red'}>{prefix.status}</Text>
              <Text>{prefix.description}</Text>
            </Box>
            <Text>{appLog.logs}</Text>
            {appLog.input && (
              <>
                <Text>Input ({appLog.inputBytes} bytes):</Text>
                <Text>{prettyPrintJsonIfPossible(appLog.input)}</Text>
              </>
            )}
            {appLog.output && (
              <>
                <Text>Output ({appLog.outputBytes} bytes):</Text>
                <Text>{prettyPrintJsonIfPossible(appLog.output)}</Text>
              </>
            )}
          </Box>
        ),
      )}

      {errors.length > 0 && (
        <Box flexDirection="column">
          {errors.map((error, index) => (
            <Box key={index}>
              <Text color="red">{error}</Text>
            </Box>
          ))}
        </Box>
      )}
    </>
  )
}

export {Logs}
