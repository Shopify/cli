import {BaseProcess, DevProcessFunction} from './types.js'
import {AppEventWatcher} from '../app-events/app-event-watcher.js'

interface AppWatcherProcessOptions {
  appWatcher: AppEventWatcher
}

export interface AppWatcherProcess extends BaseProcess<AppWatcherProcessOptions> {
  type: 'app-watcher'
}

export async function setupAppWatcherProcess(options: AppWatcherProcessOptions): Promise<AppWatcherProcess> {
  return {
    type: 'app-watcher',
    prefix: `extensions`,
    options,
    function: launchAppWatcher,
  }
}

export const launchAppWatcher: DevProcessFunction<AppWatcherProcessOptions> = async (
  {stdout, stderr, abortSignal},
  options: AppWatcherProcessOptions,
) => {
  const {appWatcher} = options
  await appWatcher.start({stdout, stderr, signal: abortSignal})
}
