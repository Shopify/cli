import metadata from '../../../../metadata.js'
import {DeveloperPlatformClient} from '../../../../utilities/developer-platform-client.js'
import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import {devSessionStatus} from '../../processes/dev-session.js'
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

export interface DevProps {
  processes: OutputProcess[]
  abortController: AbortController
  previewUrl: string
  graphiqlUrl?: string
  graphiqlPort: number
  app: {
    id: string
    apiKey: string
    developerPlatformClient: DeveloperPlatformClient
    extensions: ExtensionInstance[]
  }
  isEditionWeek?: boolean
  shopFqdn: string
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
  isEditionWeek,
  shopFqdn,
}) => {
  const {isRawModeSupported: canUseShortcuts} = useStdin()
  const pollingInterval = useRef<NodeJS.Timeout>()
  const devSessionPollingInterval = useRef<NodeJS.Timeout>()
  const localhostGraphiqlUrl = `http://localhost:${graphiqlPort}/graphiql`
  const defaultStatusMessage = `Preview URL: ${previewUrl}${
    graphiqlUrl ? `\nGraphiQL URL: ${localhostGraphiqlUrl}` : ''
  }`
  const [statusMessage, setStatusMessage] = useState(defaultStatusMessage)

  const {isAborted} = useAbortSignal(abortController.signal, async (err) => {
    if (err) {
      setStatusMessage('Shutting down dev because of an error ...')
    } else {
      setStatusMessage('Shutting down dev ...')
      setTimeout(() => {
        if (isUnitTest()) return
        treeKill(process.pid, 'SIGINT', false, () => {
          process.exit(0)
        })
      }, 2000)
    }
    clearInterval(pollingInterval.current)
    clearInterval(devSessionPollingInterval.current)
    await app.developerPlatformClient.devSessionDelete({appId: app.id, shopFqdn})
  })

  const [devSessionEnabled, setDevSessionEnabled] = useState<boolean>(devSessionStatus().isDevSessionReady)
  const [error, setError] = useState<string | undefined>(undefined)

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

  /*
   * Poll Dev Session status
   *
   * Polling mechanism to check if the dev session is ready.
   * When the session is ready, the polling stops and the shortcuts are shown.
   * Reason is that shortcuts won't work properly until the session is ready and the app is installed.
   *
   * This only applies for App Management dev-sessions.
   */
  useEffect(() => {
    const pollDevSession = async () => {
      const {isDevSessionReady} = devSessionStatus()
      setDevSessionEnabled(isDevSessionReady)
      if (isDevSessionReady) clearInterval(devSessionPollingInterval.current)
    }

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    devSessionPollingInterval.current = setInterval(pollDevSession, 200)

    return () => clearInterval(devSessionPollingInterval.current)
  }, [devSessionStatus])

  useInput(
    (input, key) => {
      handleCtrlC(input, key, () => abortController.abort())

      const onInput = async () => {
        try {
          setError('')

          if (input === 'p' && previewUrl && devSessionEnabled) {
            await metadata.addPublicMetadata(() => ({
              cmd_dev_preview_url_opened: true,
            }))
            await openURL(previewUrl)
          } else if (input === 'g' && graphiqlUrl && devSessionEnabled) {
            await metadata.addPublicMetadata(() => ({
              cmd_dev_graphiql_opened: true,
            }))
            await openURL(localhostGraphiqlUrl)
          } else if (input === 'q') {
            abortController.abort()
          } else if (input === 'e' && isEditionWeek) {
            await openURL('https://shopify.link/yQmk')
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
        useAlternativeColorPalette
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
          <Box marginTop={canUseShortcuts ? 1 : 0}>
            <Text>{statusMessage}</Text>
          </Box>
          {error ? <Text color="red">{error}</Text> : null}
        </Box>
      ) : null}
    </>
  )
}

export {Dev, calculatePrefixColumnSize}
