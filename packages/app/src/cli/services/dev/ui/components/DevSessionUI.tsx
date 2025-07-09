import {Spinner} from './Spinner.js'
import metadata from '../../../../metadata.js'
import {
  DevSessionStatus,
  DevSessionStatusManager,
  DevSessionStatusMessageType,
} from '../../processes/dev-session/dev-session-status-manager.js'
import {MAX_EXTENSION_HANDLE_LENGTH} from '../../../../models/extensions/schemas.js'
import {OutputProcess} from '@shopify/cli-kit/node/output'
import {Alert, ConcurrentOutput, Link, TabularData} from '@shopify/cli-kit/node/ui/components'
import {useAbortSignal} from '@shopify/cli-kit/node/ui/hooks'
import React, {FunctionComponent, useEffect, useMemo, useState} from 'react'
import {AbortController, AbortSignal} from '@shopify/cli-kit/node/abort'
import {Box, Text, useInput, useStdin} from '@shopify/cli-kit/node/ink'
import {handleCtrlC} from '@shopify/cli-kit/node/ui'
import {openURL} from '@shopify/cli-kit/node/system'
import figures from '@shopify/cli-kit/node/figures'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {treeKill} from '@shopify/cli-kit/node/tree-kill'
import {Writable} from 'stream'

interface DevSesionUIProps {
  processes: OutputProcess[]
  abortController: AbortController
  devSessionStatusManager: DevSessionStatusManager
  shopFqdn: string
  appURL?: string
  appName?: string
  organizationName?: string
  configPath?: string
  onAbort: () => Promise<void>
}

const DevSessionUI: FunctionComponent<DevSesionUIProps> = ({
  abortController,
  processes,
  devSessionStatusManager,
  shopFqdn,
  appURL,
  appName,
  organizationName,
  configPath,
  onAbort,
}) => {
  const {isRawModeSupported: canUseShortcuts} = useStdin()

  const [isShuttingDownMessage, setIsShuttingDownMessage] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [status, setStatus] = useState<DevSessionStatus>(devSessionStatusManager.status)
  const [shouldShowPersistentDevInfo, setShouldShowPersistentDevInfo] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<'status' | 'info'>('status')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const {isAborted} = useAbortSignal(abortController.signal, async (err: any) => {
    if (err) setError(typeof err === 'string' ? err : err.message)
    const appPreviewReady = devSessionStatusManager.status.isReady
    if (appPreviewReady) {
      setShouldShowPersistentDevInfo(true)
    } else {
      setIsShuttingDownMessage('Shutting down dev ...')
      await onAbort()
    }
    if (isUnitTest()) return
    treeKill(process.pid, 'SIGINT', false, () => {
      process.exit(0)
    })
  })

  const errorHandledProcesses = useMemo(() => {
    return processes.map((process) => {
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
  }, [processes, abortController])

  // Subscribe to dev session status updates
  useEffect(() => {
    devSessionStatusManager.on('dev-session-update', setStatus)

    return () => {
      devSessionStatusManager.off('dev-session-update', setStatus)
    }
  }, [])

  useInput(
    (input, key) => {
      handleCtrlC(input, key, () => abortController.abort())

      const onInput = async () => {
        try {
          setError('')

          if (input === 'p' && status.previewURL && status.isReady && activeTab === 'status') {
            await metadata.addPublicMetadata(() => ({
              cmd_dev_preview_url_opened: true,
            }))
            await openURL(status.previewURL)
          } else if (input === 'g' && status.graphiqlURL && status.isReady && activeTab === 'status') {
            await metadata.addPublicMetadata(() => ({
              cmd_dev_graphiql_opened: true,
            }))
            await openURL(status.graphiqlURL)
          } else if (input === 'i') {
            setActiveTab('info')
          } else if (input === 's') {
            setActiveTab('status')
          } else if (input === 'q') {
            abortController.abort()
          }
          // eslint-disable-next-line no-catch-all/no-catch-all
        } catch (_) {
          setError('Failed to handle your input.')
        }
      }

      // Handle escape key to return to status tab
      if (key.escape) {
        setActiveTab('status')
      }

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      onInput()
    },
    {isActive: Boolean(canUseShortcuts)},
  )

  const getStatusIndicator = (type: DevSessionStatusMessageType) => {
    switch (type) {
      case 'loading':
        return <Spinner />
      case 'success':
        return '✅'
      case 'error':
        return '❌'
    }
  }

  return (
    <>
      <ConcurrentOutput
        processes={errorHandledProcesses}
        prefixColumnSize={MAX_EXTENSION_HANDLE_LENGTH}
        abortSignal={abortController.signal}
        keepRunningAfterProcessesResolve={true}
        useAlternativeColorPalette={true}
      />
      {shouldShowPersistentDevInfo && (
        <Box marginTop={1} flexDirection="column">
          <Alert
            type={'info'}
            headline={`A preview of your development changes is still available on ${shopFqdn}.`}
            body={['Run', {command: 'shopify app dev clean'}, 'to restore the latest released version of your app.']}
            link={{
              label: 'Learn more about app previews',
              url: 'https://shopify.dev/beta/developer-dashboard/shopify-app-dev',
            }}
          />
        </Box>
      )}
      {/* eslint-disable-next-line no-negated-condition */}
      {!isAborted ? (
        <Box paddingTop={0} flexDirection="column" flexGrow={1}>
          {/* Top border with connection */}
          <Text>{`${'═'.repeat(20)}╤${'═'.repeat(process.stdout.columns ? process.stdout.columns - 21 : 100)}`}</Text>
          {/* Footer with left sidebar tabs and right content */}
          <Box flexDirection="row">
            {/* Left sidebar with vertical tabs */}

            <Box flexDirection="column" width={20} paddingX={0} paddingY={0}>
              <Box paddingLeft={1} paddingY={0}>
                <Text color={activeTab === 'status' ? 'cyan' : 'white'}>(s) Status</Text>
              </Box>
              <Box paddingX={0} paddingY={0}>
                <Text>{'─'.repeat(20)}</Text>
              </Box>
              <Box paddingLeft={1} paddingY={0}>
                <Text color={activeTab === 'info' ? 'cyan' : 'white'}>(i) App Details</Text>
              </Box>
              <Box paddingX={0} paddingY={0}>
                <Text>{'─'.repeat(20)}</Text>
              </Box>
              <Box paddingLeft={1} paddingY={0}>
                <Text color="white">(q) Quit</Text>
              </Box>
              <Box paddingX={0} paddingY={0}>
                <Text>{'─'.repeat(20)}</Text>
              </Box>
            </Box>
            <Box flexDirection="column" width={1} paddingX={0} paddingY={0}>
              <Text>│┤│┤│┤││</Text>
            </Box>
            {/* Right content area */}
            <Box flexDirection="column" flexGrow={1} paddingX={1}>
              {activeTab === 'status' ? (
                <>
                  {status.statusMessage && (
                    <Text>
                      {getStatusIndicator(status.statusMessage.type)} {status.statusMessage.message}
                    </Text>
                  )}
                  {canUseShortcuts && (
                    <Box marginTop={1} flexDirection="column">
                      {status.graphiqlURL && status.isReady ? (
                        <Text>
                          {figures.pointerSmall} Press <Text bold>g</Text> {figures.lineVertical} open GraphiQL (Admin
                          API) in your browser
                        </Text>
                      ) : null}
                      {status.isReady ? (
                        <Text>
                          {figures.pointerSmall} Press <Text bold>p</Text> {figures.lineVertical} preview in your
                          browser
                        </Text>
                      ) : null}
                    </Box>
                  )}
                  <Box marginTop={canUseShortcuts ? 1 : 0} flexDirection="column">
                    {isShuttingDownMessage ? (
                      <Text>{isShuttingDownMessage}</Text>
                    ) : (
                      <>
                        <Text> </Text>
                        {status.isReady && (
                          <>
                            {status.previewURL ? (
                              <Text>
                                Preview URL: <Link url={status.previewURL} />
                              </Text>
                            ) : null}
                            {status.graphiqlURL ? (
                              <Text>
                                GraphiQL URL: <Link url={status.graphiqlURL} />
                              </Text>
                            ) : null}
                          </>
                        )}
                      </>
                    )}
                  </Box>
                </>
              ) : (
                <Box flexDirection="column">
                  <Text bold>App Details</Text>
                  <Box marginTop={1}>
                    <TabularData
                      tabularData={[
                        ['App:', appName ?? ''],
                        ['App URL:', appURL ?? ''],
                        ['Config Path:', configPath?.split('/').pop() ?? ''],
                        ['Dev Store:', shopFqdn],
                        ['Org:', organizationName ?? ''],
                      ]}
                    />
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      ) : null}
      {error ? (
        <Box marginTop={1} flexDirection="column">
          <Text color="red">{error}</Text>
        </Box>
      ) : null}
    </>
  )
}

export {DevSessionUI}
