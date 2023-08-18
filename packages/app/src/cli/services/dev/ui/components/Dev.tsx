import {developerPreviewUpdate, enableDeveloperPreview} from '../../../context.js'
import {fetchAppFromApiKey} from '../../fetch.js'
import {OutputProcess, outputDebug} from '@shopify/cli-kit/node/output'
import {ConcurrentOutput} from '@shopify/cli-kit/node/ui/components'
import {useAbortSignal} from '@shopify/cli-kit/node/ui/hooks'
import React, {FunctionComponent, useEffect, useMemo, useRef, useState} from 'react'
import {AbortController, AbortSignal} from '@shopify/cli-kit/node/abort'
import {Box, Text, useInput, useStdin} from 'ink'
import {handleCtrlC} from '@shopify/cli-kit/node/ui'
import {openURL} from '@shopify/cli-kit/node/system'
import figures from '@shopify/cli-kit/node/figures'
import {Writable} from 'stream'

export interface DevProps {
  processes: OutputProcess[]
  abortController: AbortController
  previewUrl: string
  app: {
    canEnablePreviewMode: boolean
    developmentStorePreviewEnabled?: boolean
    apiKey: string
    token: string
  }
}

const Dev: FunctionComponent<DevProps> = ({abortController, processes, previewUrl, app}) => {
  const {apiKey, token, canEnablePreviewMode, developmentStorePreviewEnabled} = app
  const {isRawModeSupported: canUseShortcuts} = useStdin()
  const pollingInterval = useRef<NodeJS.Timeout>()
  const {isAborted} = useAbortSignal(abortController.signal, () => {
    outputDebug('Stopping poll for dev preview mode...')
    clearInterval(pollingInterval.current)
  })
  const [devPreviewEnabled, setDevPreviewEnabled] = useState<boolean>(Boolean(developmentStorePreviewEnabled))
  const [error, setError] = useState<string | undefined>(undefined)

  const errorHandledProcesses = useMemo(() => {
    return processes.map((process) => {
      return {
        ...process,
        action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
          try {
            await process.action(stdout, stderr, signal)
            // eslint-disable-next-line no-catch-all/no-catch-all
          } catch (error) {
            abortController.abort()
          }
        },
      }
    })
  }, [processes, abortController])

  useEffect(() => {
    const pollDevPreviewMode = async () => {
      const app = await fetchAppFromApiKey(apiKey, token)
      setDevPreviewEnabled(app?.developmentStorePreviewEnabled ?? false)
    }

    const enablePreviewMode = async () => {
      // Enable dev preview on app dev start
      const enablingDevPreviewSucceeds = await enableDeveloperPreview({apiKey, token})
      setDevPreviewEnabled(enablingDevPreviewSucceeds ? true : Boolean(developmentStorePreviewEnabled))
    }

    if (canEnablePreviewMode) {
      enablePreviewMode()
        .then(() => {
          setError('')
        })
        .catch(() => {
          setError('There was an error turning on developer preview mode. Try enabling it manually by pressing d.')
        })

      const startPolling = () => {
        return setInterval(
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          () =>
            pollDevPreviewMode()
              .then(() => {
                setError('')
              })
              .catch(() => {
                setError(
                  'There was an error trying to fetch the latest value of developer preview mode, trying again in 5 seconds.',
                )
              }),
          5000,
        )
      }

      pollingInterval.current = startPolling()
    }
  }, [canEnablePreviewMode])

  useInput(
    (input, key) => {
      handleCtrlC(input, key, abortController.abort)

      const onInput = async () => {
        if (input === 'p' && previewUrl) {
          await openURL(previewUrl)
        } else if (input === 'q') {
          abortController.abort()
        } else if (input === 'd' && canEnablePreviewMode) {
          const newDevPreviewEnabled = !devPreviewEnabled
          const developerPreviewUpdateSucceded = await developerPreviewUpdate({
            apiKey,
            token,
            enabled: newDevPreviewEnabled,
          })
          if (developerPreviewUpdateSucceded) {
            setDevPreviewEnabled(newDevPreviewEnabled)
          } else {
            setError(`There was an error turning ${newDevPreviewEnabled ? 'on' : 'off'} developer preview mode`)
          }
        }
      }

      onInput()
        .then(() => {
          setError('')
        })
        .catch(() => {
          setError('There was an error trying to handle your input.')
        })
    },
    {isActive: canUseShortcuts},
  )

  return (
    <>
      <ConcurrentOutput
        processes={errorHandledProcesses}
        abortSignal={abortController.signal}
        keepRunningAfterProcessesResolve={true}
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
              {canEnablePreviewMode ? (
                <Text>
                  {figures.pointerSmall} Press <Text bold>d</Text> {figures.lineVertical} development store preview:{' '}
                  {devPreviewEnabled ? <Text color="green">✔ on</Text> : <Text color="red">✖ off</Text>}
                </Text>
              ) : null}
              <Text>
                {figures.pointerSmall} Press <Text bold>p</Text> {figures.lineVertical} preview in your browser
              </Text>
              <Text>
                {figures.pointerSmall} Press <Text bold>q</Text> {figures.lineVertical} quit
              </Text>
            </Box>
          ) : null}
          <Box marginTop={canUseShortcuts ? 1 : 0}>
            <Text>Preview URL: {previewUrl}</Text>
          </Box>
          {error ? <Text color="red">{error}</Text> : null}
        </Box>
      ) : null}
    </>
  )
}

export {Dev}
