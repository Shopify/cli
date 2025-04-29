import {Spinner} from './Spinner.js'
import metadata from '../../../../metadata.js'
import {
  DevSessionStatus,
  DevSessionStatusManager,
  DevSessionStatusMessageType,
} from '../../processes/dev-session/dev-session-status-manager.js'
import {MAX_EXTENSION_HANDLE_LENGTH} from '../../../../models/extensions/schemas.js'
import {OutputProcess} from '@shopify/cli-kit/node/output'
import {Alert, ConcurrentOutput} from '@shopify/cli-kit/node/ui/components'
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
  onAbort: () => Promise<void>
}

const DevSessionUI: FunctionComponent<DevSesionUIProps> = ({
  abortController,
  processes,
  devSessionStatusManager,
  shopFqdn,
  onAbort,
}) => {
  const {isRawModeSupported: canUseShortcuts} = useStdin()

  const [isShuttingDownMessage, setIsShuttingDownMessage] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [status, setStatus] = useState<DevSessionStatus>(devSessionStatusManager.status)
  const [shouldShowPersistentDevInfo, setShouldShowPersistentDevInfo] = useState<boolean>(false)

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

          if (input === 'p' && status.previewURL && status.isReady) {
            await metadata.addPublicMetadata(() => ({
              cmd_dev_preview_url_opened: true,
            }))
            await openURL(status.previewURL)
          } else if (input === 'g' && status.graphiqlURL && status.isReady) {
            await metadata.addPublicMetadata(() => ({
              cmd_dev_graphiql_opened: true,
            }))
            await openURL(status.graphiqlURL)
          } else if (input === 'q') {
            abortController.abort()
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
          {status.statusMessage ? (
            <Text>
              {getStatusIndicator(status.statusMessage.type)} {status.statusMessage.message}
            </Text>
          ) : null}
          {canUseShortcuts ? (
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
                {status.isReady && (
                  <>
                    <Text>{`Preview URL: ${status.previewURL}`}</Text>
                    {status.graphiqlURL ? <Text>{`GraphiQL URL: ${status.graphiqlURL}`}</Text> : null}
                  </>
                )}
              </>
            )}
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
