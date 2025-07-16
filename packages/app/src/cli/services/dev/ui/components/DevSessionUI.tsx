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
  const [activeTab, setActiveTab] = useState<string>('s')

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

          // First check if input matches any tab key
          const matchingTab = tabs[input]
          if (matchingTab) {
            if (matchingTab.action) {
              await matchingTab.action()
            } else {
              setActiveTab(input)
            }
            return
          }

          // Then check if input matches any shortcut key for the current active tab
          const currentTab = tabs[activeTab]
          if (currentTab?.shortcuts) {
            const matchingShortcut = currentTab.shortcuts.find((shortcut) => shortcut.key === input)
            if (matchingShortcut) {
              // Check condition if it exists
              if (!matchingShortcut.condition || matchingShortcut.condition()) {
                await matchingShortcut.action()
              }
            }
          }
          // eslint-disable-next-line no-catch-all/no-catch-all
        } catch (_) {
          setError('Failed to handle your input.')
        }
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

  interface TabShortcut {
    key: string
    condition?: () => boolean
    action: () => Promise<void>
  }

  interface Tab {
    label: string
    content?: React.ReactNode
    shortcuts?: TabShortcut[]
    action?: () => Promise<void>
  }

  interface TabDisplay extends Tab {
    inputKey: string
    header: string
  }

  const tabs: {[key: string]: Tab} = {
    // eslint-disable-next-line id-length
    s: {
      label: 'Status',
      shortcuts: [
        {
          key: 'p',
          condition: () => Boolean(status.previewURL && status.isReady),
          action: async () => {
            await metadata.addPublicMetadata(() => ({
              cmd_dev_preview_url_opened: true,
            }))
            if (status.previewURL) {
              await openURL(status.previewURL)
            }
          },
        },
        {
          key: 'g',
          condition: () => Boolean(status.graphiqlURL && status.isReady),
          action: async () => {
            await metadata.addPublicMetadata(() => ({
              cmd_dev_graphiql_opened: true,
            }))
            if (status.graphiqlURL) {
              await openURL(status.graphiqlURL)
            }
          },
        },
      ],
      content: (
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
                  {figures.pointerSmall} Press <Text bold>g</Text> {figures.lineVertical} open GraphiQL (Admin API) in
                  your browser
                </Text>
              ) : null}
              {status.isReady ? (
                <Text>
                  {figures.pointerSmall} Press <Text bold>p</Text> {figures.lineVertical} preview in your browser
                </Text>
              ) : null}
            </Box>
          )}
          <Box marginTop={canUseShortcuts ? 1 : 0} flexDirection="column">
            {isShuttingDownMessage ? (
              <Text>{isShuttingDownMessage}</Text>
            ) : (
              <>
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
      ),
    },
    i: {
      label: 'App Info',
      content: (
        <Box flexDirection="column">
          <TabularData
            tabularData={[
              ['App:', appName ?? ''],
              ['App URL:', appURL ?? ''],
              ['Config:', configPath?.split('/').pop() ?? ''],
              ['Dev Store:', shopFqdn],
              ['Org:', organizationName ?? ''],
            ]}
          />
        </Box>
      ),
    },
    q: {
      label: 'Quit',
      action: async () => {
        abortController.abort()
      },
    },
  }

  const tabsArray: TabDisplay[] = Object.entries(tabs).map(([key, tab]) => {
    return {
      ...tab,
      inputKey: key,
      header: ` (${key}) ${tab.label} `,
    }
  })

  // We need to subtract the number of tabs from the total length to account for the borders between and after the tabs
  const tabHeaderLength = tabsArray.reduce((acc, tab) => acc + (tab.header?.length ?? 0), 0) + tabsArray.length + 1

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
        <Box paddingTop={1} flexDirection="column" flexGrow={1}>
          {canUseShortcuts ? (
            <>
              {/* Top border with connected tab boxes */}
              <Text>
                {tabsArray
                  .map((tab, index) => {
                    return `${index === 0 ? '╒' : '╤'}${'═'.repeat(tab.header?.length ?? 0)}`
                  })
                  .join('')}
                {'╤'}
                {'═'.repeat(Math.max(0, (process.stdout.columns || 100) - tabHeaderLength - 2))}
                {'╕'}
              </Text>
              {/* Tab content row */}
              <Text>
                {tabsArray.map((tab) => {
                  return (
                    <React.Fragment key={tab.inputKey}>
                      {'│'}
                      <Text
                        bold={activeTab === tab.inputKey}
                        color={activeTab === tab.inputKey ? 'cyan' : 'white'}
                        backgroundColor={activeTab === tab.inputKey ? 'gray' : 'transparent'}
                      >
                        {tab.header}
                      </Text>
                    </React.Fragment>
                  )
                })}
                {`│${' '.repeat(Math.max(0, (process.stdout.columns || 100) - tabHeaderLength - 2))}│`}
              </Text>
              {/* Bottom border connecting tabs */}
              <Text>
                {tabsArray
                  .map((tab, index) => {
                    return `${index === 0 ? '└' : '┴'}${'─'.repeat(tab.header?.length ?? 0)}`
                  })
                  .join('')}
                {'┴'}
                {'─'.repeat(Math.max(0, (process.stdout.columns || 100) - tabHeaderLength - 2))}
                {'┘'}
              </Text>
              {/* Tab Content Area */}
              <Box flexDirection="column" marginLeft={1} marginRight={1}>
                {tabs[activeTab]?.content}
              </Box>
            </>
          ) : (
            <Box
              marginY={1}
              paddingTop={0}
              flexDirection="column"
              flexGrow={1}
              borderStyle="single"
              borderBottom={false}
              borderLeft={false}
              borderRight={false}
              borderTop
            >
              {/* Non-interactive fallback - reuse status tab content */}
              {tabs.s?.content}
            </Box>
          )}
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
