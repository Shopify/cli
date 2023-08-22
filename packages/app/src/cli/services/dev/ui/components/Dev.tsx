import {developerPreviewUpdate, disableDeveloperPreview, enableDeveloperPreview} from '../../../context.js'
import {fetchAppFromApiKey} from '../../fetch.js'
import {OutputProcess} from '@shopify/cli-kit/node/output'
import {ConcurrentOutput} from '@shopify/cli-kit/node/ui/components'
import {useAbortSignal} from '@shopify/cli-kit/node/ui/hooks'
import React, {FunctionComponent, useEffect, useMemo, useRef, useState} from 'react'
import {AbortController, AbortSignal} from '@shopify/cli-kit/node/abort'
import {Box, Text, useInput, useStdin} from 'ink'
import {handleCtrlC} from '@shopify/cli-kit/node/ui'
import {openURL} from '@shopify/cli-kit/node/system'
import figures from '@shopify/cli-kit/node/figures'
import {TunnelClient} from '@shopify/cli-kit/node/plugins/tunnel'
import {treeKill} from '@shopify/cli-kit/node/tree-kill'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
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
  tunnelClient?: TunnelClient
  pollingTime?: number
}

const Dev: FunctionComponent<DevProps> = ({
  abortController,
  processes,
  previewUrl,
  app,
  tunnelClient,
  pollingTime = 5000,
}) => {
  const {apiKey, token, canEnablePreviewMode, developmentStorePreviewEnabled} = app
  const {isRawModeSupported: canUseShortcuts} = useStdin()
  const pollingInterval = useRef<NodeJS.Timeout>()
  const [statusMessage, setStatusMessage] = useState(`Preview URL: ${previewUrl}`)

  const {isAborted} = useAbortSignal(abortController.signal, async () => {
    setStatusMessage('Shutting down dev ...')
    setTimeout(() => {
      if (isUnitTest()) return
      treeKill('SIGINT')
    }, 2000)
    clearInterval(pollingInterval.current)
    await disableDeveloperPreview({apiKey, token})
    tunnelClient?.stopTunnel()
  })

  const [devPreviewEnabled, setDevPreviewEnabled] = useState<boolean>(Boolean(developmentStorePreviewEnabled))
  const [error, setError] = useState<string | undefined>(undefined)

  const errorHandledProcesses = useMemo(() => {
    return processes.map((process) => {
      return {
        ...process,
        action: (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
          return process.action(stdout, stderr, signal).catch(() => {
            abortController.abort()
          })
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
          setError(
            'Failed to turn on development store preview automatically.\nTry turning it on manually by pressing `d`.',
          )
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
                  'Failed to fetch the latest status of the development store preview, trying again in 5 seconds.',
                )
              }),
          pollingTime,
        )
      }

      pollingInterval.current = startPolling()
    }
  }, [canEnablePreviewMode])

  useInput(
    (input, key) => {
      handleCtrlC(input, key, () => abortController.abort())

      const onInput = async () => {
        setError('')

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
            setError(`Failed to turn ${newDevPreviewEnabled ? 'on' : 'off'} development store preview.`)
          }
        }
      }

      onInput().catch(() => {
        setError('Failed to handle your input.')
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
            <Text>{statusMessage}</Text>
          </Box>
          {error ? <Text color="red">{error}</Text> : null}
        </Box>
      ) : null}
    </>
  )
}

export {Dev}
