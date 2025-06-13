import {BaseProcess, DevProcessFunction} from './types.js'
import {DevSessionStatusManager} from './dev-session/dev-session-status-manager.js'
import {AppLinkedInterface} from '../../../models/app/app.js'
import {AppEvent, AppEventWatcher, EventType} from '../app-events/app-event-watcher.js'
import {ports} from '../../../constants.js'
import {createApp, createRouter, defineEventHandler} from 'h3'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {SerialBatchProcessor} from '@shopify/cli-kit/node/serial-batch-processor'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileExists, writeFile} from '@shopify/cli-kit/node/fs'
import {createServer} from 'http'
import {unlink} from 'fs/promises'

interface DevStatusServerProcessOptions {
  devSessionStatusManager: DevSessionStatusManager
  localApp: AppLinkedInterface
  appWatcher: AppEventWatcher
  graphiqlUrl?: string
  appEventsProcessor: SerialBatchProcessor<AppEvent>
}

export interface DevStatusServerProcess extends BaseProcess<DevStatusServerProcessOptions & {port: number}> {
  type: 'dev-status-server'
}

export interface DevLockfileCleanupProcess extends BaseProcess<{port: number; appWatcher: AppEventWatcher}> {
  type: 'dev-lockfile-cleanup'
}

export async function setupDevStatusServerProcess(
  options: DevStatusServerProcessOptions,
): Promise<[DevStatusServerProcess, DevLockfileCleanupProcess]> {
  const port = await getAvailableTCPPort(ports.devStatusServer)
  return [
    {
      type: 'dev-status-server',
      prefix: 'status',
      options: {...options, port},
      function: launchDevStatusServer,
    },
    {
      type: 'dev-lockfile-cleanup',
      prefix: 'lockfile',
      options: {port, appWatcher: options.appWatcher},
      function: launchDevLockfileCleanup,
    },
  ] as const
}

let lastReportedTimestamp = 0

interface Action {
  type: string
  uid: string
  message: string
  timestamp: number
  documentation: string
}

export const launchDevStatusServer: DevProcessFunction<DevStatusServerProcessOptions> = async (
  {stdout, abortSignal},
  {devSessionStatusManager, appWatcher, graphiqlUrl, appEventsProcessor},
) => {
  const app = createApp()
  const router = createRouter()
  const port = await getAvailableTCPPort(ports.devStatusServer)
  const nextActions: Action[] = []

  appWatcher.onEvent(async (event) => {
    event.extensionEvents.forEach((extensionEvent) => {
      if (extensionEvent.type === EventType.Created && extensionEvent.extension.isFunctionExtension) {
        nextActions.push({
          type: 'activate-function',
          uid: extensionEvent.extension.uid,
          message: `Activate function ${extensionEvent.extension.name}, use graphql to obtain the function ID and then use it to activate the function.`,
          timestamp: Date.now(),
          documentation: `
            Use the following graphql query to obtain the function ID:
{
  app {
    functions(first: 10) {
      edges {
        node {
          id
          title
          apiType
        }
      }
    }
  }
}
`,
        })
      }
    })
  })

  router.get(
    '/dev-status',
    defineEventHandler(async () => {
      const status = devSessionStatusManager.status
      const currentApp = appWatcher.currentApp
      const manifest = await currentApp.manifest()

      const lastLog = devSessionStatusManager.logs[devSessionStatusManager.logs.length - 1]

      const filteredLogs = devSessionStatusManager.logs.filter((log) => log.timestamp > lastReportedTimestamp)

      if (lastLog && lastLog.timestamp > lastReportedTimestamp) {
        lastReportedTimestamp = lastLog.timestamp
      }

      await appEventsProcessor.waitForCompletion()
      // const filteredNextActions = nextActions.filter((action) => action.timestamp > lastReportedTimestamp)

      return {
        status: status.isReady ? status.statusMessage?.type : 'NOT_READY',
        nextActions,
        previewURL: status.previewURL,
        statusMessage: status.statusMessage?.message,
        manifest,
        graphiqlUrl,
        appName: currentApp.name,
        logs: filteredLogs,
        cursor: lastReportedTimestamp,
      }
    }),
  )

  app.use(router)

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  const server = createServer(app)

  outputInfo(`Dev status server started on port ${port}`, stdout)

  abortSignal.addEventListener('abort', () => {
    server.close()
  })

  await server.listen(port)
}

export const launchDevLockfileCleanup: DevProcessFunction<{port: number; appWatcher: AppEventWatcher}> = async (
  {stdout: _stdout},
  {port, appWatcher},
) => {
  const appDirectory = appWatcher.currentApp.directory
  const lockfilePath = joinPath(appDirectory, '.shopify', 'dev-control-port.lock')

  if (await fileExists(lockfilePath)) {
    await unlink(lockfilePath)
  }

  await writeFile(lockfilePath, port.toString(), {
    encoding: 'utf8',
    autoDeleteOnExit: true,
  })
}
