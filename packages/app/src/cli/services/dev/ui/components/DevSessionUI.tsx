import metadata from '../../../../metadata.js'
import {DevSessionStatus, DevSessionStatusManager} from '../../processes/dev-session-status-manager.js'
import {MAX_EXTENSION_HANDLE_LENGTH} from '../../../../models/extensions/schemas.js'
import {OutputProcess} from '@shopify/cli-kit/node/output'
import {ConcurrentOutput} from '@shopify/cli-kit/node/ui/components'
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
  onAbort: () => Promise<void>
}

const DevSessionUI: FunctionComponent<DevSesionUIProps> = ({
  abortController,
  processes,
  devSessionStatusManager,
  onAbort,
}) => {
  const {isRawModeSupported: canUseShortcuts} = useStdin()

  const [isShuttingDownMessage, setIsShuttingDownMessage] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [status, setStatus] = useState<DevSessionStatus>(devSessionStatusManager.status)

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
    await onAbort()
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

  return (
    <>
      <ConcurrentOutput
        processes={errorHandledProcesses}
        prefixColumnSize={MAX_EXTENSION_HANDLE_LENGTH}
        abortSignal={abortController.signal}
        keepRunningAfterProcessesResolve={true}
        useAlternativeColorPalette={true}
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

          {error ? <Text color="red">{error}</Text> : null}
        </Box>
      ) : null}
    </>
  )
}

export {DevSessionUI}
