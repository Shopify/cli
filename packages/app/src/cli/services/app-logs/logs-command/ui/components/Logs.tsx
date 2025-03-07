import {usePollAppLogs} from './hooks/usePollAppLogs.js'
import {
  PollOptions,
  FunctionRunLog,
  AppLogPrefix,
  AppLogPayload,
  NetworkAccessResponseFromCacheLog,
  NetworkAccessRequestExecutionInBackgroundLog,
  BackgroundExecutionReason,
  NetworkAccessRequestExecutedLog,
} from '../../../types.js'
import {prettyPrintJsonIfPossible} from '../../../utils.js'

import React, {FunctionComponent} from 'react'
import {OrganizationSource} from '../../../../../models/organization.js'
import {Box, Text} from '@shopify/cli-kit/node/ink'

interface LogsProps {
  resubscribeCallback: () => Promise<string>
  pollOptions: PollOptions
  storeNameById: Map<string, string>
  organizationSource: OrganizationSource
  orgId: string
  appId: string
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

const Logs: FunctionComponent<LogsProps> = ({
  pollOptions: {jwtToken, filters},
  resubscribeCallback,
  storeNameById,
  organizationSource,
  orgId,
  appId,
}) => {
  const {appLogOutputs, errors} = usePollAppLogs({
    filters,
    initialJwt: jwtToken,
    resubscribeCallback,
    storeNameById,
    organizationSource,
    orgId,
    appId,
  })

  return (
    <>
      {appLogOutputs.map(
        (
          {
            appLog,
            prefix,
          }: {
            appLog: AppLogPayload
            prefix: AppLogPrefix
          },
          index: number,
        ) => (
          <Box flexDirection="column" key={index}>
            {/* update: use invocationId after https://github.com/Shopify/shopify-functions/issues/235 */}
            <Box flexDirection="row" gap={1}>
              <Text>
                <Text color="green">{prefix.logTimestamp} </Text>
                <Text color="blueBright">{`${prefix.storeName.split('.')[0]}`} </Text>
                <Text color="blueBright">{prefix.source} </Text>
                <Text color={prefix.status === 'Success' ? 'green' : 'red'}>{prefix.status} </Text>
                <Text>{prefix.description}</Text>
              </Text>
            </Box>
            <Box flexDirection="column" marginLeft={4}>
              {appLog instanceof FunctionRunLog && (
                <>
                  <Text>{appLog.logs}</Text>
                  {appLog.inputQueryVariablesMetafieldKey && appLog.inputQueryVariablesMetafieldNamespace && (
                    <Box flexDirection="column" marginTop={1}>
                      <Text bold>Input Query Variables:</Text>
                      <Box flexDirection="row" marginLeft={1} marginTop={1}>
                        <Text dimColor>Namespace:</Text>
                        <Text> {appLog.inputQueryVariablesMetafieldNamespace}</Text>
                      </Box>
                      <Box flexDirection="row" marginLeft={1}>
                        <Text dimColor>Key:</Text>
                        <Text> {appLog.inputQueryVariablesMetafieldKey}</Text>
                      </Box>
                      <Box marginLeft={1} marginTop={1}>
                        <Text>
                          {prettyPrintJsonIfPossible(appLog.inputQueryVariablesMetafieldValue) || (
                            <Text color="red">Metafield is not set</Text>
                          )}
                        </Text>
                      </Box>
                    </Box>
                  )}
                  {appLog.input && (
                    <Box flexDirection="column" marginTop={1}>
                      <Text bold>
                        Input <Text dimColor>({appLog.inputBytes} bytes):</Text>
                      </Text>
                      <Box marginLeft={1} marginTop={1}>
                        <Text>{prettyPrintJsonIfPossible(appLog.input)}</Text>
                      </Box>
                    </Box>
                  )}
                  {appLog.output && (
                    <Box flexDirection="column" marginTop={1}>
                      <Text bold>
                        Output <Text dimColor>({appLog.outputBytes} bytes):</Text>
                      </Text>
                      <Box marginLeft={1} marginTop={1}>
                        <Text>{prettyPrintJsonIfPossible(appLog.output)}</Text>
                      </Box>
                    </Box>
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
