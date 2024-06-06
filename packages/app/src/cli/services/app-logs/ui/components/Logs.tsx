import {DeveloperPlatformClient} from '../../../../utilities/developer-platform-client.js'
import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import React, {useMemo, FunctionComponent} from 'react'
import {OutputProcess} from '@shopify/cli-kit/node/output'
import {AbortController, AbortSignal} from '@shopify/cli-kit/node/abort'
import {Text} from '@shopify/cli-kit/node/ink'
import {Writable} from 'stream'

export interface LogsProps {
  logsProcess: OutputProcess
  abortController: AbortController
  app: {
    apiKey: string
    developerPlatformClient: DeveloperPlatformClient
    extensions: ExtensionInstance[]
  }
}

const Logs: FunctionComponent<LogsProps> = ({logsProcess, app, abortController}) => {
  const errorHandledProcesses = useMemo(() => {
    return [logsProcess].map((process) => {
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
  }, [logsProcess, abortController])

  return (
    <>
      <Text color="blueBright">{'Testing, hello from <Log />'}</Text>
    </>
  )
}

export {Logs}
