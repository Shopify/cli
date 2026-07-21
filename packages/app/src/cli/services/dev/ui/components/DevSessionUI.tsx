import {TabPanel, Tab, TabShortcut} from './TabPanel.js'
import metadata from '../../../../metadata.js'
import {DevSessionStatus, DevSessionStatusManager} from '../../processes/dev-session/dev-session-status-manager.js'
import {MAX_EXTENSION_HANDLE_LENGTH} from '../../../../models/extensions/schemas.js'
import {buildDevConsoleURL} from '../../../../utilities/app/app-url.js'
import {OutputProcess} from '@shopify/cli-kit/node/output'
import {Alert, ConcurrentOutput, Link, LoadingIndicator, TabularData} from '@shopify/cli-kit/node/ui/components'
import {useAbortSignal} from '@shopify/cli-kit/node/ui/hooks'
import React, {FunctionComponent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react'
import {AbortController, AbortSignal} from '@shopify/cli-kit/node/abort'
import {Box, MouseProvider, Text, useInput, useStdin, useStdout} from '@shopify/cli-kit/node/ink'
import {handleCtrlC} from '@shopify/cli-kit/node/ui'
import {openURL, terminalSupportsHyperlinks} from '@shopify/cli-kit/node/system'
import {basename} from '@shopify/cli-kit/node/path'
import figures from '@shopify/cli-kit/node/figures'
import {waitForPostRunHookAndExit} from '@shopify/cli-kit/node/hooks/postrun'
import {Writable} from 'stream'

interface DevStatusShortcut extends TabShortcut {
  shortcutLabel: string
  linkLabel: string
  url?: string
}

// Three rows for the buttons, four for the largest tab, and breathing room between them.
const BOTTOM_PANEL_HEIGHT = 9

const StatusMessage = ({message, type}: NonNullable<DevSessionStatus['statusMessage']>) => {
  if (type === 'loading') return <LoadingIndicator title={message} />

  return (
    <Text>
      {type === 'success' ? '✅' : '❌'} {message}
    </Text>
  )
}

interface DevSesionUIProps {
  processes: OutputProcess[]
  abortController: AbortController
  devSessionStatusManager: DevSessionStatusManager
  shopFqdn: string
  appURL?: string
  appName?: string
  organizationName?: string
  configPath?: string
  localURL?: string
  usingLocalhost?: boolean
  unavailableGraphiqlPort?: number
  localhostPortUnavailable?: number
  onAbort: () => Promise<void>
}

const FullScreenLayout: FunctionComponent<React.PropsWithChildren> = ({children}) => {
  const {stdout} = useStdout()
  const [terminalSize, setTerminalSize] = useState({columns: stdout.columns, rows: stdout.rows})

  useLayoutEffect(() => {
    const updateTerminalSize = () => setTerminalSize({columns: stdout.columns, rows: stdout.rows})
    stdout.on('resize', updateTerminalSize)
    return () => {
      stdout.off('resize', updateTerminalSize)
    }
  }, [stdout])

  return (
    <Box flexDirection="column" height={terminalSize.rows} width={terminalSize.columns}>
      {children}
    </Box>
  )
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
  localURL,
  usingLocalhost = false,
  unavailableGraphiqlPort,
  localhostPortUnavailable,
  onAbort,
}) => {
  const {isRawModeSupported: canUseShortcuts} = useStdin()
  const processesWithInitialLogs = useMemo(() => {
    const initialLogs: string[] = []
    if (configPath) {
      initialLogs.push(
        `Using ${basename(configPath)} for default values. You can pass \`--reset\` to your command to reset your app configuration.`,
      )
    }
    if (usingLocalhost) {
      initialLogs.push(
        '⚠️ `--use-localhost` is not compatible with Shopify features which directly invoke your app (such as Webhooks, App proxy, and Flow actions), or those which require testing your app from another device (such as POS).',
      )
    }
    if (unavailableGraphiqlPort !== undefined) {
      initialLogs.push(
        `⚠️ A random port will be used for GraphiQL because ${unavailableGraphiqlPort} is not available. You can choose one with \`--graphiql-port\`.`,
      )
    }
    if (localhostPortUnavailable !== undefined) {
      initialLogs.push(
        `⚠️ A random port will be used for localhost because ${localhostPortUnavailable} is not available. You can choose one with \`--localhost-port\` flag.`,
      )
    }
    if (initialLogs.length === 0) return processes

    const initialLogProcess: OutputProcess = {
      prefix: 'app-preview',
      action: async (stdout) => {
        stdout.write(initialLogs.join('\n'))
      },
    }
    return [initialLogProcess, ...processes]
  }, [configPath, localhostPortUnavailable, processes, unavailableGraphiqlPort, usingLocalhost])

  const [isShuttingDownMessage, setIsShuttingDownMessage] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [status, setStatus] = useState<DevSessionStatus>(devSessionStatusManager.status)
  const [shouldShowPersistentDevInfo, setShouldShowPersistentDevInfo] = useState<boolean>(false)
  const [availableLogPrefixes, setAvailableLogPrefixes] = useState<string[]>(() => [
    ...new Set(processesWithInitialLogs.map(({prefix}) => prefix)),
  ])
  const availableLogPrefixesRef = useRef(new Set(availableLogPrefixes))
  const [selectedLogPrefix, setSelectedLogPrefix] = useState<string | undefined>()

  const addAvailableLogPrefix = useCallback((prefix: string) => {
    if (availableLogPrefixesRef.current.has(prefix)) return

    availableLogPrefixesRef.current.add(prefix)
    setAvailableLogPrefixes((currentPrefixes) => [...currentPrefixes, prefix])
  }, [])

  const filterOutputByPrefix = useCallback(
    (prefix: string) => selectedLogPrefix === undefined || prefix === selectedLogPrefix,
    [selectedLogPrefix],
  )

  const selectNextLogPrefix = () => {
    setSelectedLogPrefix((currentPrefix) => {
      const currentPrefixIndex = currentPrefix === undefined ? -1 : availableLogPrefixes.indexOf(currentPrefix)
      return availableLogPrefixes[currentPrefixIndex + 1]
    })
  }

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
    waitForPostRunHookAndExit()
  })

  const errorHandledProcesses = useMemo(() => {
    return processesWithInitialLogs.map((process) => {
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
  }, [processesWithInitialLogs, abortController])

  // Subscribe to dev session status updates
  useEffect(() => {
    devSessionStatusManager.on('dev-session-update', setStatus)

    return () => {
      devSessionStatusManager.off('dev-session-update', setStatus)
    }
  }, [])

  useEffect(() => {
    processesWithInitialLogs.forEach(({prefix}) => addAvailableLogPrefix(prefix))
  }, [addAvailableLogPrefix, processesWithInitialLogs])

  useInput(
    (input, key) => {
      handleCtrlC(input, key, () => abortController.abort())
    },
    {isActive: Boolean(canUseShortcuts)},
  )

  const devStatusShortcuts: DevStatusShortcut[] = [
    {
      key: 'p',
      shortcutLabel: 'Open app preview',
      linkLabel: 'Preview',
      url: status.previewURL,
      condition: () => Boolean(status.isReady && status.previewURL),
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
      key: 'c',
      shortcutLabel: 'Open Dev Console for extension previews',
      linkLabel: 'Dev Console',
      url: buildDevConsoleURL(shopFqdn),
      condition: () => Boolean(status.isReady && status.appEmbedded === false && status.hasExtensions),
      action: async () => {
        await metadata.addPublicMetadata(() => ({
          cmd_dev_preview_url_opened: true,
        }))
        await openURL(buildDevConsoleURL(shopFqdn))
      },
    },
    {
      key: 'g',
      shortcutLabel: 'Open GraphiQL (Admin API)',
      linkLabel: 'GraphiQL',
      url: status.graphiqlURL,
      condition: () => Boolean(status.isReady && status.graphiqlURL),
      action: async () => {
        await metadata.addPublicMetadata(() => ({
          cmd_dev_graphiql_opened: true,
        }))
        if (status.graphiqlURL) {
          await openURL(status.graphiqlURL)
        }
      },
    },
  ]

  const activeShortcuts = devStatusShortcuts.filter((shortcut) => shortcut.condition?.() ?? true)

  const tabs: {[key: string]: Tab} = {
    // eslint-disable-next-line id-length
    d: {
      label: 'Dev status',
      shortcuts: devStatusShortcuts,
      content: (
        <>
          {status.statusMessage && (
            <StatusMessage message={status.statusMessage.message} type={status.statusMessage.type} />
          )}
          {canUseShortcuts && activeShortcuts.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              {activeShortcuts.map((shortcut) => (
                <Text key={shortcut.key} wrap="truncate">
                  {figures.pointerSmall} <Text bold>({shortcut.key})</Text>{' '}
                  {terminalSupportsHyperlinks() && shortcut.url ? (
                    <Link url={shortcut.url} label={shortcut.shortcutLabel} />
                  ) : (
                    <>
                      {shortcut.shortcutLabel}
                      {shortcut.url ? (
                        <>
                          : <Link url={shortcut.url} />
                        </>
                      ) : null}
                    </>
                  )}
                </Text>
              ))}
            </Box>
          )}
          <Box flexDirection="column">
            {isShuttingDownMessage ? (
              <Text>{isShuttingDownMessage}</Text>
            ) : (
              <>
                {status.isReady && !(canUseShortcuts && terminalSupportsHyperlinks()) && (
                  <>
                    {!canUseShortcuts &&
                      activeShortcuts
                        .filter((shortcut) => shortcut.url)
                        .map((shortcut) => (
                          <Text key={shortcut.key}>
                            {shortcut.linkLabel} URL: <Link url={shortcut.url!} />
                          </Text>
                        ))}
                  </>
                )}
              </>
            )}
          </Box>
        </>
      ),
    },
    // eslint-disable-next-line id-length
    a: {
      label: 'App info',
      content: (
        <Box flexDirection="column">
          <TabularData
            tabularData={[
              ['App:', appName ?? ''],
              ['App URL:', appURL ?? ''],
              ['Local URL:', appURL ? '' : (localURL ?? '')],
              ['Config:', configPath?.split('/').pop() ?? ''],
              ['Org:', organizationName ?? ''],
            ].filter(([, value]) => value)}
          />
        </Box>
      ),
    },
    // eslint-disable-next-line id-length
    s: {
      label: 'Store info',
      content: (
        <Box flexDirection="column">
          <TabularData
            tabularData={[
              ['Dev store:', {link: {url: `https://${shopFqdn}`}}],
              ['Dev store admin:', {link: {url: `https://${shopFqdn}/admin`}}],
              ['Org:', organizationName ?? ''],
            ].filter(([, value]) => value)}
          />
        </Box>
      ),
    },
    // eslint-disable-next-line id-length
    f: {
      label: `Filter logs: ${selectedLogPrefix ?? 'all'}`,
      action: async () => {
        selectNextLogPrefix()
      },
    },
    q: {
      label: 'Quit',
      action: async () => {
        abortController.abort()
      },
    },
  }

  const content = (
    <>
      <ConcurrentOutput
        processes={errorHandledProcesses}
        prefixColumnSize={MAX_EXTENSION_HANDLE_LENGTH}
        abortSignal={abortController.signal}
        keepRunningAfterProcessesResolve={true}
        scrollable={canUseShortcuts}
        useAlternativeColorPalette={true}
        outputFilter={canUseShortcuts ? filterOutputByPrefix : undefined}
        onOutputPrefix={canUseShortcuts ? addAvailableLogPrefix : undefined}
      />
      {shouldShowPersistentDevInfo && (
        <Box marginTop={1} flexDirection="column">
          <Alert
            type={'info'}
            headline={`A preview of your development changes is still available on ${shopFqdn}.`}
            body={['Run', {command: 'shopify app dev clean'}, 'to restore the latest released version of your app.']}
            link={{
              label: 'Learn more about dev previews',
              url: 'https://shopify.dev/beta/developer-dashboard/shopify-app-dev',
            }}
          />
        </Box>
      )}
      {/* eslint-disable-next-line no-negated-condition */}
      {!isAborted ? (
        <Box flexDirection="column" flexShrink={0} height={BOTTOM_PANEL_HEIGHT}>
          {canUseShortcuts ? (
            <TabPanel tabs={tabs} initialActiveTab="d" />
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
              {tabs.d?.content}
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

  return canUseShortcuts ? (
    <MouseProvider isActive={!isAborted} trackMouseMovement={false}>
      <FullScreenLayout>{content}</FullScreenLayout>
    </MouseProvider>
  ) : (
    content
  )
}

export {DevSessionUI}
