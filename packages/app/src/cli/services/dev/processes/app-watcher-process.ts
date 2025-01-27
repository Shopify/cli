import {BaseProcess, DevProcessFunction} from './types.js'
import {AppEventWatcher} from '../app-events/app-event-watcher.js'

interface AppWatcherProcessOptions {
  appWatcher: AppEventWatcher
}

export interface AppWatcherProcess extends BaseProcess<AppWatcherProcessOptions> {
  type: 'app-watcher'
}

/**
 * Sets up the app watcher process.
 *
 * This process just STARTS the app watcher, the watcher object is created before and shared with all other processes
 * so they can receive events from it.
 *
 * The "start" is done in a process so that it can receive the stdout, stderr and abortSignal of the concurrent output context
 * that is shared with the other processes.
 *
 * @param options - The options for the app watcher process.
 * @returns The app watcher process.
 */
export async function setupAppWatcherProcess(options: AppWatcherProcessOptions): Promise<AppWatcherProcess> {
  return {
    type: 'app-watcher',
    prefix: `dev-session`,
    options,
    function: launchAppWatcher,
  }
}

const launchAppWatcher: DevProcessFunction<AppWatcherProcessOptions> = async (
  {stdout, stderr, abortSignal},
  options: AppWatcherProcessOptions,
) => {
  const {appWatcher} = options
  await appWatcher.start({stdout, stderr, signal: abortSignal})
}
