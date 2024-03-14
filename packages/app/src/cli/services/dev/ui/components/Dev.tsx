import metadata from '../../../../metadata.js'
import {DeveloperPlatformClient} from '../../../../utilities/developer-platform-client.js'
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
    apiKey: string
    developerPlatformClient: DeveloperPlatformClient
  }
  pollingTime?: number
  developerPreview: DeveloperPreviewController
  isEditionWeek?: boolean
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
}) => {
  const {canEnablePreviewMode, developmentStorePreviewEnabled} = app
  const {isRawModeSupported: canUseShortcuts} = useStdin()
  const pollingInterval = useRef<NodeJS.Timeout>()
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
    await developerPreview.disable()
  })

  const [devPreviewEnabled, setDevPreviewEnabled] = useState<boolean>(true)
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

          if (input === 'p' && previewUrl) {
            await metadata.addPublicMetadata(() => ({
              cmd_dev_preview_url_opened: true,
            }))
            await openURL(previewUrl)
          } else if (input === 'g' && graphiqlUrl) {
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
              {graphiqlUrl ? (
                <Text>
                  {figures.pointerSmall} Press <Text bold>g</Text> {figures.lineVertical} open GraphiQL (Admin API) in
                  your browser
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
