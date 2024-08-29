import {usePollAppLogs} from './hooks/usePollAppLogs.js'
import {
  PollOptions,
  FunctionRunLog,
  NetworkAccessResponseFromCacheLog,
  NetworkAccessRequestExecutionInBackgroundLog,
  BackgroundExecutionReason,
  NetworkAccessRequestExecutedLog,
  AppLogResult,
} from '../../../types.js'
import {prettyPrintJsonIfPossible} from '../../../utils.js'

import React, {FunctionComponent} from 'react'

import {Static, Box, Text} from '@shopify/cli-kit/node/ink'

interface LogsProps {
  resubscribeCallback: () => Promise<string>
  pollOptions: PollOptions
  storeNameById: Map<string, string>
}

const getBackgroundExecutionReasonMessage = (reason: BackgroundExecutionReason): string => {
  switch (reason) {
    case BackgroundExecutionReason.NoCachedResponse:
      return 'No cached response available'
    case BackgroundExecutionReason.CacheAboutToExpire:
      return 'Cache is about to expire'
    default:
      return 'Unknown reason'
  }
}

const Logs: FunctionComponent<LogsProps> = ({pollOptions: {jwtToken, filters}, resubscribeCallback, storeNameById}) => {
  const {appLogResults} = usePollAppLogs({filters, initialJwt: jwtToken, resubscribeCallback, storeNameById})

  return (
    <Static items={appLogResults}>
      {(appLogResult: AppLogResult, index: number) => {
        if ('error' in appLogResult) {
          return (
            <Box flexDirection="column">
              <Box key={index}>
                <Text color="red">{appLogResult.error}</Text>
              </Box>
            </Box>
          )
        }

        const {prefix, appLog} = appLogResult
        return (
          <Box flexDirection="column" key={index}>
            {/* update: use invocationId after https://github.com/Shopify/shopify-functions/issues/235 */}
            <Box flexDirection="row" gap={1}>
              <Text>
                <Text color="green">{prefix.logTimestamp} </Text>
                <Text color="blueBright">{`${prefix.storeName.split('.')[0]}`} </Text>
                <Text color="blueBright">{`${prefix.source}`} </Text>
                <Text color={prefix.status === 'Success' ? 'green' : 'red'}>{prefix.status} </Text>
                <Text>{prefix.description}</Text>
              </Text>
            </Box>
            <Box flexDirection="column" marginLeft={4}>
              {appLog instanceof FunctionRunLog && (
                <>
                  <Text>{appLog.logs}</Text>
                  {appLog.input && (
                    <>
                      <Text>Input ({appLog.inputBytes} bytes): </Text>
                      <Text>{prettyPrintJsonIfPossible(appLog.input)}</Text>
                    </>
                  )}
                  {appLog.output && (
                    <>
                      <Text>
                        {'\n'}Output ({appLog.outputBytes} bytes):
                      </Text>
                      <Text>{prettyPrintJsonIfPossible(appLog.output)}</Text>
                    </>
                  )}
                </>
              )}
              {appLog instanceof NetworkAccessResponseFromCacheLog && (
                <>
                  <Text>Cache write time: {new Date(appLog.cacheEntryEpochMs).toISOString()}</Text>
                  <Text>Cache TTL: {appLog.cacheTtlMs / 1000} s</Text>
                  <Text>HTTP request:</Text>
                  <Text>{prettyPrintJsonIfPossible(appLog.httpRequest)}</Text>
                  <Text>HTTP response:</Text>
                  <Text>{prettyPrintJsonIfPossible(appLog.httpResponse)}</Text>
                </>
              )}
              {appLog instanceof NetworkAccessRequestExecutionInBackgroundLog && (
                <>
                  <Text>Reason: {getBackgroundExecutionReasonMessage(appLog.reason)}</Text>
                  <Text>HTTP request:</Text>
                  <Text>{prettyPrintJsonIfPossible(appLog.httpRequest)}</Text>
                </>
              )}
              {appLog instanceof NetworkAccessRequestExecutedLog && (
                <>
                  <Text>Attempt: {appLog.attempt}</Text>
                  {appLog.connectTimeMs && <Text>Connect time: {appLog.connectTimeMs} ms</Text>}
                  {appLog.writeReadTimeMs && <Text>Write read time: {appLog.writeReadTimeMs} ms</Text>}
                  <Text>HTTP request:</Text>
                  <Text>{prettyPrintJsonIfPossible(appLog.httpRequest)}</Text>
                  {appLog.httpResponse && (
                    <>
                      <Text>HTTP response:</Text>
                      <Text>{prettyPrintJsonIfPossible(appLog.httpResponse)}</Text>
                    </>
                  )}
                  {appLog.error && <Text>Error: {appLog.error}</Text>}
                </>
              )}
            </Box>
          </Box>
        )
      }}
    </Static>
  )
}

export {Logs}
