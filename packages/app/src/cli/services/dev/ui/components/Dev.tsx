import {developerPreviewUpdate, enableDeveloperPreview} from '../../../context.js'
import {fetchAppFromApiKey} from '../../fetch.js'
import {OutputProcess, outputDebug} from '@shopify/cli-kit/node/output'
import {ConcurrentOutput} from '@shopify/cli-kit/node/ui/components'
import {useAbortSignal} from '@shopify/cli-kit/node/ui/hooks'
import React, {FunctionComponent, useEffect, useRef, useState} from 'react'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {Box, Text, useApp, useInput, useStdin} from 'ink'
import {handleCtrlC} from '@shopify/cli-kit/node/ui'
import {openURL} from '@shopify/cli-kit/node/system'
import figures from '@shopify/cli-kit/node/figures'

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

enum DevState {
  Running = 'running',
  Stopped = 'stopped',
}

const Dev: FunctionComponent<DevProps> = ({abortController, processes, previewUrl, app}) => {
  const {apiKey, token, canEnablePreviewMode, developmentStorePreviewEnabled} = app
  const {isRawModeSupported} = useStdin()
  const [state, setState] = useState<DevState>(DevState.Running)
  const pollingInterval = useRef<NodeJS.Timeout>()
  const {isAborted} = useAbortSignal(abortController.signal, () => {
    outputDebug('Stopping poll for dev preview mode...')
    clearInterval(pollingInterval.current)
    setState(DevState.Stopped)
  })
  const useShortcuts = isRawModeSupported && state === DevState.Running && !isAborted
  const {exit: unmountInk} = useApp()
  const [devPreviewEnabled, setDevPreviewEnabled] = useState<boolean>(Boolean(developmentStorePreviewEnabled))
  const [error, setError] = useState<string | undefined>(undefined)

  const onError = (error: Error | undefined) => {
    setState(DevState.Stopped)
    unmountInk(error)
  }

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
      enablePreviewMode().catch(onError)

      const startPolling = () => {
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        return setInterval(() => pollDevPreviewMode().catch(onError), 5000)
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

      onInput().catch(onError)
    },
    {isActive: useShortcuts},
  )

  return (
    <>
      <ConcurrentOutput
        processes={processes}
        abortSignal={abortController.signal}
        keepRunningAfterProcessesResolve={true}
      />
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
        {useShortcuts ? (
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
        <Box marginTop={useShortcuts ? 1 : 0}>
          <Text>Preview URL: {previewUrl}</Text>
        </Box>
        {error ? <Text color="red">{error}</Text> : null}
      </Box>
    </>
  )
}

export {Dev}
