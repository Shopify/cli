import {FileWatcher, type OutputContextOptions, type WatcherEvent} from '../../dev/app-events/file-watcher.js'
import {type AppLinkedInterface} from '../../../models/app/app.js'
import {type FSWatcher} from 'chokidar'
import {AsyncResource} from 'node:async_hooks'

/** Owns scan readiness and startup change completion for one replay. */
export class ReplayFileWatcher extends FileWatcher {
  private startupTask?: Promise<void>
  private rescanRequested = false
  private startupComplete = false
  private pendingChanges = 0
  private changesSettled?: () => void
  private observeScan?: (watcher: FSWatcher) => void

  constructor(
    app: AppLinkedInterface,
    private readonly replayContext: OutputContextOptions,
  ) {
    super(app, replayContext)
  }

  override onChange(listener: (events: WatcherEvent[]) => void) {
    super.onChange((events: WatcherEvent[]) => {
      if (this.replayContext.signal.aborted) return
      // Each non-empty batch emits one AppEvent or fails through the watcher's error channel.
      if (!this.startupComplete && events.length > 0) this.pendingChanges++
      listener(events)
    })
  }

  changeProcessed() {
    if (this.pendingChanges > 0) this.pendingChanges--
    if (this.pendingChanges === 0) this.changesSettled?.()
  }

  async waitForStartupChanges() {
    const {signal} = this.replayContext
    if (this.pendingChanges > 0 && !signal.aborted) {
      await new Promise<void>((resolve) => {
        const complete = () => {
          this.changesSettled = undefined
          signal.removeEventListener('abort', complete)
          resolve()
        }
        this.changesSettled = complete
        signal.addEventListener('abort', complete, {once: true})
      })
    }
    this.startupComplete = true
  }

  override start(): Promise<void> {
    if (this.replayContext.signal.aborted) return Promise.resolve()
    this.rescanRequested = true
    this.startupTask ??= this.scan()
    return this.startupTask
  }

  protected override onWatcherCreated(watcher: FSWatcher, listener: (event: string, path: string) => void) {
    this.observeScan?.(watcher)
    return AsyncResource.bind(listener)
  }

  private async scan() {
    const {signal} = this.replayContext
    try {
      do {
        this.rescanRequested = false
        const ready = new Promise<void>((resolve, reject) => {
          let nativeWatcher: FSWatcher | undefined
          const cleanup = () => {
            nativeWatcher?.removeListener('ready', onReady)
            nativeWatcher?.removeListener('error', onError)
            signal.removeEventListener('abort', onReady)
          }
          const onReady = () => {
            cleanup()
            resolve()
          }
          const onError = (error: Error) => {
            cleanup()
            reject(error)
          }
          signal.addEventListener('abort', onReady, {once: true})
          this.observeScan = (watcher) => {
            nativeWatcher = watcher
            if (signal.aborted) {
              watcher.close().then(onReady).catch(onError)
            } else {
              watcher.once('ready', onReady)
              watcher.once('error', onError)
            }
          }
          if (signal.aborted) onReady()
        })
        // Import rescans await start(), so change completion must be awaited outside this scan loop.
        // eslint-disable-next-line no-await-in-loop
        await Promise.all([super.start(), ready])
      } while (this.rescanRequested && !signal.aborted)
    } finally {
      this.observeScan = undefined
      this.startupTask = undefined
    }
  }
}
