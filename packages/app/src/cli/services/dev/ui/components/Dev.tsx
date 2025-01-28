import metadata from '../../../../metadata.js'
import {DeveloperPlatformClient} from '../../../../utilities/developer-platform-client.js'
import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import {DevSessionStatus, DevSessionStatusManager} from '../../processes/dev-session-status-manager.js'
import {OutputProcess} from '@shopify/cli-kit/node/output'
import {ConcurrentOutput} from '@shopify/cli-kit/node/ui/components'
import {useAbortSignal} from '@shopify/cli-kit/node/ui/hooks'
import React, {FunctionComponent, useEffect, useMemo, useRef, useState} from 'react'
import {AbortController, AbortSignal} from '@shopify/cli-kit/node/abort'
import {Box, Text, useInput, useStdin} from '@shopify/cli-kit/node/ink'
import {handleCtrlC} from '@shopify/cli-kit/node/ui'
import {openURL} from '@shopify/cli-kit/node/system'
import figures from '@shopify/cli-kit/node/figures'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {treeKill} from '@shopify/cli-kit/node/tree-kill'
import {Writable} from 'stream'

export interface DeveloperPreviewController {
  fetchMode: () => Promise<boolean>
  enable: () => Promise<void>
  disable: () => Promise<void>
  update: (state: boolean) => Promise<boolean>
}

export interface DevProps {
  processes: OutputProcess[]
  abortController: AbortController
  previewUrl: string
  graphiqlUrl?: string
  graphiqlPort: number
  app: {
    canEnablePreviewMode: boolean
    developmentStorePreviewEnabled?: boolean
    id: string
    apiKey: string
    developerPlatformClient: DeveloperPlatformClient
    extensions: ExtensionInstance[]
  }
  pollingTime?: number
  developerPreview: DeveloperPreviewController
  isEditionWeek?: boolean
  shopFqdn: string
  devSessionStatusManager: DevSessionStatusManager
}

const calculatePrefixColumnSize = (processes: OutputProcess[], extensions: ExtensionInstance[]) => {
  return Math.max(
    ...processes.map((process) => process.prefix.length),
    ...extensions.map((extension) => extension.handle.length),
  )
}

const Dev: FunctionComponent<DevProps> = ({
  abortController,
  processes,
  previewUrl,
  graphiqlUrl = '',
  graphiqlPort,
  app,
  pollingTime = 5000,
  developerPreview,
  isEditionWeek,
  shopFqdn,
  devSessionStatusManager,
}) => {
  const {canEnablePreviewMode, developmentStorePreviewEnabled} = app

  const {isRawModeSupported: canUseShortcuts} = useStdin()
  const pollingInterval = useRef<NodeJS.Timeout>()
  const localhostGraphiqlUrl = `http://localhost:${graphiqlPort}/graphiql`
  const graphiqlURLMessage = graphiqlUrl ? `GraphiQL URL: ${localhostGraphiqlUrl}` : ''

  const [isShuttingDownMessage, setIsShuttingDownMessage] = useState<string | undefined>(undefined)
  const [devPreviewEnabled, setDevPreviewEnabled] = useState<boolean>(true)
  const [devSessionEnabled, setDevSessionEnabled] = useState<boolean>(devSessionStatusManager.status.isReady)
  const [appPreviewURL, setAppPreviewURL] = useState<string>(previewUrl)
  const [error, setError] = useState<string | undefined>(undefined)

  const {isAborted} = useAbortSignal(abortController.signal, async (err) => {
    if (err) {
      setIsShuttingDownMessage('Shutting down dev because of an error ...')
    } else {
      setIsShuttingDownMessage('Shutting down dev ...')
      setTimeout(() => {
        if (isUnitTest()) return
        treeKill(process.pid, 'SIGINT', false, () => {
          process.exit(0)
        })
      }, 2000)
    }
    clearInterval(pollingInterval.current)
    await app.developerPlatformClient.devSessionDelete({appId: app.id, shopFqdn})
    await developerPreview.disable()
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
    const handleDevSessionUpdate = (status: DevSessionStatus) => {
      setDevSessionEnabled(status.isReady)
      if (status.previewURL) setAppPreviewURL(status.previewURL)
    }

    if (app.developerPlatformClient.supportsDevSessions) {
      devSessionStatusManager.on('dev-session-update', handleDevSessionUpdate)
    } else {
      setDevSessionEnabled(true)
    }

    return () => {
      devSessionStatusManager.off('dev-session-update', handleDevSessionUpdate)
    }
  }, [])

  useEffect(() => {
    const pollDevPreviewMode = async () => {
      try {
        const enabled = await developerPreview.fetchMode()
        setDevPreviewEnabled(enabled ?? false)
        setError('')
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (_) {
        setError('Failed to fetch the latest status of the development store preview, trying again in 5 seconds.')
      }
    }

    const enablePreviewMode = async () => {
      // Enable dev preview on app dev start
      try {
        await developerPreview.enable()
        setError('')
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (_) {
        setError(
          'Failed to turn on development store preview automatically.\nTry turning it on manually by pressing `d`.',
        )
        setDevPreviewEnabled(Boolean(developmentStorePreviewEnabled))
      }
    }

    if (canEnablePreviewMode) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      enablePreviewMode()

      const startPolling = () => {
        return setInterval(
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          () => pollDevPreviewMode(),
          pollingTime,
        )
      }

      pollingInterval.current = startPolling()
    }

    return () => {
      clearInterval(pollingInterval.current)
    }
  }, [canEnablePreviewMode])

  useInput(
    (input, key) => {
      handleCtrlC(input, key, () => abortController.abort())

      const onInput = async () => {
        try {
          setError('')

          if (input === 'p' && appPreviewURL && devSessionEnabled) {
            await metadata.addPublicMetadata(() => ({
              cmd_dev_preview_url_opened: true,
            }))
            await openURL(appPreviewURL)
          } else if (input === 'g' && graphiqlUrl && devSessionEnabled) {
            await metadata.addPublicMetadata(() => ({
              cmd_dev_graphiql_opened: true,
            }))
            await openURL(localhostGraphiqlUrl)
          } else if (input === 'q') {
            abortController.abort()
          } else if (input === 'e' && isEditionWeek) {
            await openURL('https://shopify.link/yQmk')
          } else if (input === 'd' && canEnablePreviewMode) {
            await metadata.addPublicMetadata(() => ({
              cmd_dev_dev_preview_toggle_used: true,
            }))
            const newDevPreviewEnabled = !devPreviewEnabled
            setDevPreviewEnabled(newDevPreviewEnabled)
            try {
              const developerPreviewUpdateSucceded = await developerPreview.update(newDevPreviewEnabled)
              if (!developerPreviewUpdateSucceded) {
                throw new Error(`Failed to turn ${newDevPreviewEnabled ? 'on' : 'off'} development store preview.`)
              }
              // eslint-disable-next-line no-catch-all/no-catch-all
            } catch (_) {
              setDevPreviewEnabled(devPreviewEnabled)
              setError(`Failed to turn ${newDevPreviewEnabled ? 'on' : 'off'} development store preview.`)
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

  const now = new Date()
  const season = now.getMonth() > 3 ? 'Summer' : 'Winter'
  const year = now.getFullYear()

  return (
    <>
      <ConcurrentOutput
        processes={errorHandledProcesses}
        prefixColumnSize={calculatePrefixColumnSize(errorHandledProcesses, app.extensions)}
        abortSignal={abortController.signal}
        keepRunningAfterProcessesResolve={true}
        useAlternativeColorPalette={app.developerPlatformClient.supportsDevSessions}
      />
      {/* eslint-disable-next-line no-negated-condition */}
      {!isAborted ? (
        <Box
          marginY={1}
          paddingTop={1}
          flexDirection="column"
          flexGrow={1}
          borderStyle="single"
          borderBottom={false}
          borderLeft={false}
          borderRight={false}
          borderTop
        >
          {canUseShortcuts ? (
            <Box flexDirection="column">
              {isEditionWeek ? (
                <Text>
                  {figures.pointerSmall} Press <Text bold>e</Text> {figures.lineVertical} check out {season} Edition
                  {` ${year}`}, live NOW with 100+ product announcements!
                </Text>
              ) : null}
              {canEnablePreviewMode ? (
                <Text>
                  {figures.pointerSmall} Press <Text bold>d</Text> {figures.lineVertical} toggle development store
                  preview: {}
                  {devPreviewEnabled ? <Text color="green">✔ on</Text> : <Text color="red">✖ off</Text>}
                </Text>
              ) : null}
              {graphiqlUrl && devSessionEnabled ? (
                <Text>
                  {figures.pointerSmall} Press <Text bold>g</Text> {figures.lineVertical} open GraphiQL (Admin API) in
                  your browser
                </Text>
              ) : null}
              {devSessionEnabled ? (
                <Text>
                  {figures.pointerSmall} Press <Text bold>p</Text> {figures.lineVertical} preview in your browser
                </Text>
              ) : null}
              <Text>
                {figures.pointerSmall} Press <Text bold>q</Text> {figures.lineVertical} quit
              </Text>
            </Box>
          ) : null}

          <Box marginTop={canUseShortcuts ? 1 : 0} flexDirection="column">
            {isShuttingDownMessage ? (
              <Text>{isShuttingDownMessage}</Text>
            ) : (
              <>
                <Text>{`Preview URL: ${appPreviewURL}`}</Text>
                {graphiqlUrl ? <Text>{graphiqlURLMessage}</Text> : null}
              </>
            )}
          </Box>

          {error ? <Text color="red">{error}</Text> : null}
        </Box>
      ) : null}
    </>
  )
}

export {Dev, calculatePrefixColumnSize}
