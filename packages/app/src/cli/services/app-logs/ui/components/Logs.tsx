import {DeveloperPlatformClient} from '../../../../utilities/developer-platform-client.js'
import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import React, {useMemo, FunctionComponent} from 'react'
import {OutputProcess} from '@shopify/cli-kit/node/output'
import {AbortController, AbortSignal} from '@shopify/cli-kit/node/abort'
import {Text} from '@shopify/cli-kit/node/ink'
import {ConcurrentOutput} from '@shopify/cli-kit/node/ui/components'
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

// fix: we dont need to pass in process's here, there is only a single process
// leaving for now to keep code consistent with dev for now
// same for other spots
const calculatePrefixColumnSize = (processes: OutputProcess[], extensions: ExtensionInstance[]) => {
  return Math.max(
    ...processes.map((process) => process.prefix.length),
    ...extensions.map((extension) => extension.handle.length),
  )
}

const Logs: FunctionComponent<LogsProps> = ({logsProcess, app, abortController}) => {
  const prefixColumnSize = calculatePrefixColumnSize([logsProcess], app.extensions)
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
      {/* TESTING - Next steps, create a similar component to this, and use that for output */}
      <ConcurrentOutput
        processes={errorHandledProcesses}
        prefixColumnSize={prefixColumnSize}
        abortSignal={abortController.signal}
        keepRunningAfterProcessesResolve={true}
      />
    </>
  )
}

export {Logs}
